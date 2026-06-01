use axum::{
    extract::{ws::{Message, WebSocket, WebSocketUpgrade}, State},
    response::IntoResponse,
};
use tokio::sync::mpsc;
use uuid::Uuid;
use crate::{
    protocol::{ClientMessage, ServerMessage},
    state::SharedState,
};

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<SharedState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

async fn handle_socket(mut socket: WebSocket, state: SharedState) {
    let user_id = Uuid::new_v4();
    let (tx, mut rx) = mpsc::channel::<ServerMessage>(100);

    // Join Phase
    {
        let mut guard = state.lock().await;
        guard.register_user(user_id, tx.clone());
        guard.enqueue_user(user_id);
        tracing::info!("User {} connected and added to matchmaking queue.", user_id);
    }

    // Initial message to frontend
    if let Ok(json) = serde_json::to_string(&ServerMessage::Status {
        message: "Searching for a stranger...".to_string(),
    }) {
        let _ = socket.send(Message::Text(json)).await;
    }

    loop {
        tokio::select! {
            // Outgoing: Read from internal channel -> write to WebSocket
            Some(server_msg) = rx.recv() => {
                if let Ok(json) = serde_json::to_string(&server_msg) {
                    if socket.send(Message::Text(json)).await.is_err() {
                        break;
                    }
                }
            }
            
            // Incoming: Read from WebSocket -> process protocol rules
            Some(result) = socket.recv() => {
                let msg = match result {
                    Ok(m) => m,
                    Err(_) => break,
                };

                match msg {
                    Message::Text(text) => {
                        if let Ok(client_msg) = serde_json::from_str::<ClientMessage>(&text) {
                            match client_msg {
                                ClientMessage::SendMessage { text } => {
                                    let guard = state.lock().await;
                                    if let Some(&partner_id) = guard.matches.get(&user_id) {
                                        // Route message EXCLUSIVELY to the partner.
                                        // The sender's UI handles its own text optimistically.
                                        if let Some(partner_session) = guard.sessions.get(&partner_id) {
                                            tracing::info!("Message Route: {} ---> {}", user_id, partner_id);
                                            let _ = partner_session.tx.send(ServerMessage::ChatMessage {
                                                id: Uuid::new_v4(),
                                                sender: "Stranger".to_string(),
                                                text,
                                            }).await;
                                        }
                                    }
                                }
                                ClientMessage::Skip => {
                                    let mut guard = state.lock().await;
                                    let old_partner = guard.disconnect_user(user_id);
                                    
                                    guard.register_user(user_id, tx.clone());
                                    guard.enqueue_user(user_id);
                                    
                                    if let Ok(json) = serde_json::to_string(&ServerMessage::Status {
                                        message: "Searching for a stranger...".to_string(),
                                    }) {
                                        let _ = socket.send(Message::Text(json)).await;
                                    }

                                    if let Some(partner_id) = old_partner {
                                        if let Some(partner_session) = guard.sessions.get(&partner_id) {
                                            let _ = partner_session.tx.send(ServerMessage::Status {
                                                message: "Stranger skipped! Matching with a new stranger...".to_string(),
                                            }).await;
                                            let _ = partner_session.tx.send(ServerMessage::Status {
                                                message: "Searching for a stranger...".to_string(),
                                            }).await;
                                            guard.enqueue_user(partner_id);
                                        }
                                    }
                                }
                            }
                        }
                    }
                    Message::Close(_) => break,
                    _ => {}
                }
            }
        }
    }

    // Cleanup Phase on disconnection
    let mut guard = state.lock().await;
    let partner_id = guard.disconnect_user(user_id);
    tracing::info!("User {} disconnected from system.", user_id);

    if let Some(pid) = partner_id {
        if let Some(partner_session) = guard.sessions.get(&pid) {
            let _ = partner_session.tx.send(ServerMessage::Status {
                message: "Stranger disconnected! Matching with a new stranger...".to_string(),
            }).await;
            let _ = partner_session.tx.send(ServerMessage::Status {
                message: "Searching for a stranger...".to_string(),
            }).await;
            guard.enqueue_user(pid);
        }
    }
}