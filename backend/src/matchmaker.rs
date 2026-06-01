use std::time::Duration;
use tokio::time::sleep;
use uuid::Uuid;
use crate::protocol::ServerMessage;
use crate::state::SharedState;

/// The primary background loop that orchestrates user matching.
pub async fn run_matchmaker(state: SharedState) {
    tracing::info!("Matchmaker engine background task started.");

    loop {
        // 1. Pause for a tiny moment so we don't hog 100% of the server's CPU
        sleep(Duration::from_millis(200)).await;

        // 2. Safely lock the application state
        let mut guard = state.lock().await;

        // 3. Keep matching pairs as long as there are at least two people waiting
        while guard.queue.len() >= 2 {
            let user1_id = guard.queue.pop_front().unwrap();
            let user2_id = guard.queue.pop_front().unwrap();

            // Establish the bidirectional match mapping
            guard.matches.insert(user1_id, user2_id);
            guard.matches.insert(user2_id, user1_id);

            tracing::info!("Match found: {} <---> {}", user1_id, user2_id);

            // 4. Notify User 1
            if let Some(user1_session) = guard.sessions.get(&user1_id) {
                let _ = user1_session.tx.send(ServerMessage::MatchFound).await;
            }

            // 5. Notify User 2
            if let Some(user2_session) = guard.sessions.get(&user2_id) {
                let _ = user2_session.tx.send(ServerMessage::MatchFound).await;
            }

            // 6. Spawn an independent, isolated countdown task for this specific pair
            tokio::spawn(start_chat_timer(user1_id, user2_id, state.clone()));
        }
    }
}

/// Runs a 1-minute countdown timer for an active chat pair.
async fn start_chat_timer(user1: Uuid, user2: Uuid, state: SharedState) {
    let mut seconds_remaining = 60;

    while seconds_remaining > 0 {
        sleep(Duration::from_secs(1)).await;
        seconds_remaining -= 1;

        // Lock the state briefly to check if the match still exists
        let guard = state.lock().await;
        
        // If one user skipped or disconnected early, the match mapping is destroyed.
        // We catch that here and terminate this timer task instantly.
        if !guard.matches.contains_key(&user1) || !guard.matches.contains_key(&user2) {
            return;
        }

        // Broadcast the updated remaining time to both users
        if let Some(session) = guard.sessions.get(&user1) {
            let _ = session.tx.send(ServerMessage::Timer { remaining_seconds: seconds_remaining }).await;
        }
        if let Some(session) = guard.sessions.get(&user2) {
            let _ = session.tx.send(ServerMessage::Timer { remaining_seconds: seconds_remaining }).await;
        }
    }

    // --- IF THE TIMER REACHED ZERO ---
    tracing::info!("Timer expired for pair {} and {}. Disconnecting...", user1, user2);
    let mut guard = state.lock().await;

    // Remove the match mapping so their loops know they are no longer chatting
    guard.matches.remove(&user1);
    guard.matches.remove(&user2);

    // Throw them both back into the matchmaking waiting list automatically!
    guard.enqueue_user(user1);
    guard.enqueue_user(user2);

    // Notify their frontend loops to show the searching screen again
    if let Some(session) = guard.sessions.get(&user1) {
        let _ = session.tx.send(ServerMessage::Status { message: "Time expired! Matching with a new stranger...".to_string() }).await;
        let _ = session.tx.send(ServerMessage::Status { message: "Searching for a stranger...".to_string() }).await;
    }
    if let Some(session) = guard.sessions.get(&user2) {
        let _ = session.tx.send(ServerMessage::Status { message: "Time expired! Matching with a new stranger...".to_string() }).await;
        let _ = session.tx.send(ServerMessage::Status { message: "Searching for a stranger...".to_string() }).await;
    }
}