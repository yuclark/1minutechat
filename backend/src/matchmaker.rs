use std::time::Duration;
use tokio::time::sleep;
use uuid::Uuid;
use crate::protocol::ServerMessage;
use crate::state::{SharedState, MatchInfo};

pub async fn run_matchmaker(state: SharedState) {
    tracing::info!("Matchmaker engine background task started.");

    loop {
        sleep(Duration::from_millis(250)).await;
        let mut guard = state.lock().await;

        if guard.queue.len() >= 2 {
            let mut matched_indices: Option<(usize, usize)> = None;

            // STAGE 1: Search strictly for interest tag intersections
            'outer: for i in 0..guard.queue.len() {
                for j in (i + 1)..guard.queue.len() {
                    let u1 = guard.queue[i];
                    let u2 = guard.queue[j];

                    if let (Some(s1), Some(s2)) = (guard.sessions.get(&u1), guard.sessions.get(&u2)) {
                        let shares_interest = s1.tags.iter().any(|t1| {
                            s2.tags.iter().any(|t2| t1.to_lowercase() == t2.to_lowercase())
                        });

                        if shares_interest {
                            matched_indices = Some((i, j));
                            break 'outer;
                        }
                    }
                }
            }

            // STAGE 2: Fall back to random matching ONLY if the oldest user has waited over 1 minute
            if matched_indices.is_none() {
                let oldest_user_id = guard.queue[0];
                if let Some(session) = guard.sessions.get(&oldest_user_id) {
                    if let Some(enqueued_at) = session.enqueued_at {
                        if enqueued_at.elapsed() >= Duration::from_secs(60) {
                            tracing::info!("Queue threshold reached for user {}. Executing random fallback match.", oldest_user_id);
                            matched_indices = Some((0, 1));
                        }
                    }
                }
            }

            // Execute match processing block if either Stage 1 or Stage 2 conditions pass
            if let Some((idx1, idx2)) = matched_indices {
                let user2_id = guard.queue.remove(idx2).unwrap();
                let user1_id = guard.queue.remove(idx1).unwrap();

                let match_id = Uuid::new_v4();
                guard.matches.insert(user1_id, MatchInfo { partner_id: user2_id, match_id });
                guard.matches.insert(user2_id, MatchInfo { partner_id: user1_id, match_id });

                tracing::info!("Match consolidated: {} <---> {} [Session ID: {}]", user1_id, user2_id, match_id);

                if let Some(user1_session) = guard.sessions.get(&user1_id) {
                    let _ = user1_session.tx.send(ServerMessage::MatchFound).await;
                }
                if let Some(user2_session) = guard.sessions.get(&user2_id) {
                    let _ = user2_session.tx.send(ServerMessage::MatchFound).await;
                }

                tokio::spawn(start_chat_timer(user1_id, user2_id, match_id, state.clone()));
            }
        }
    }
}

async fn start_chat_timer(user1: Uuid, user2: Uuid, match_id: Uuid, state: SharedState) {
    let mut seconds_remaining = 60;

    while seconds_remaining > 0 {
        sleep(Duration::from_secs(1)).await;
        seconds_remaining -= 1;

        let guard = state.lock().await;
        let u1_match = guard.matches.get(&user1);
        let u2_match = guard.matches.get(&user2);

        match (u1_match, u2_match) {
            (Some(m1), Some(m2)) if m1.match_id == match_id && m2.match_id == match_id => {
                if let Some(session) = guard.sessions.get(&user1) {
                    let _ = session.tx.send(ServerMessage::Timer { remaining_seconds: seconds_remaining }).await;
                }
                if let Some(session) = guard.sessions.get(&user2) {
                    let _ = session.tx.send(ServerMessage::Timer { remaining_seconds: seconds_remaining }).await;
                }
            }
            _ => return,
        }
    }

    tracing::info!("Timer expired safely for match ID: {}.", match_id);
    let mut guard = state.lock().await;

    if let Some(m1) = guard.matches.get(&user1) {
        if m1.match_id == match_id { guard.matches.remove(&user1); }
    }
    if let Some(m2) = guard.matches.get(&user2) {
        if m2.match_id == match_id { guard.matches.remove(&user2); }
    }

    let tags1 = guard.sessions.get(&user1).map(|s| s.tags.clone()).unwrap_or_default();
    let tags2 = guard.sessions.get(&user2).map(|s| s.tags.clone()).unwrap_or_default();

    guard.enqueue_user(user1, tags1);
    guard.enqueue_user(user2, tags2);

    if let Some(session) = guard.sessions.get(&user1) {
        let _ = session.tx.send(ServerMessage::Status { message: "Time expired! Searching for a new match...".to_string() }).await;
    }
    if let Some(session) = guard.sessions.get(&user2) {
        let _ = session.tx.send(ServerMessage::Status { message: "Time expired! Searching for a new match...".to_string() }).await;
    }
}