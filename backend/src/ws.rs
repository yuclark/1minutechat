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

    // Register raw socket baseline context only
    {
        let mut guard = state.lock().await;
        guard.register_user(user_id, tx.clone());
        tracing::info!("User session {} initialized (Sitting on Homepage).", user_id);
    }

    loop {
        tokio::select! {
            Some(server_msg) = rx.recv() => {
                if let Ok(json) = serde_json::to_string(&server_msg) {
                    if socket.send(Message::Text(json)).await.is_err() {
                        break;
                    }
                }
            }
            
            Some(result) = socket.recv() => {
                let msg = match result {
                    Ok(m) => m,
                    Err(_) => break,
                };

                match msg {
                    Message::Text(text) => {
                        if let Ok(client_msg) = serde_json::from_str::<ClientMessage>(&text) {
                            match client_msg {
                                ClientMessage::Join { tags } => {
                                    let mut guard = state.lock().await;
                                    tracing::info!("User {} submitted tags and joined queue: {:?}", user_id, tags);
                                    guard.enqueue_user(user_id, tags);
                                    
                                    if let Ok(json) = serde_json::to_string(&ServerMessage::Status {
                                        message: "Searching for a stranger...".to_string(),
                                    }) {
                                        let _ = socket.send(Message::Text(json)).await;
                                    }
                                }
                                ClientMessage::SendMessage { text } => {
                                    let guard = state.lock().await;
                                    if let Some(match_info) = guard.matches.get(&user_id) {
                                        let partner_id = match_info.partner_id;
                                        if let Some(partner_session) = guard.sessions.get(&partner_id) {
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
                                    let current_tags = guard.sessions.get(&user_id).map(|s| s.tags.clone()).unwrap_or_default();
                                    let old_partner = guard.disconnect_user(user_id);
                                    
                                    guard.register_user(user_id, tx.clone());
                                    guard.enqueue_user(user_id, current_tags);
                                    
                                    if let Ok(json) = serde_json::to_string(&ServerMessage::Status {
                                        message: "Searching for a stranger...".to_string(),
                                    }) {
                                        let _ = socket.send(Message::Text(json)).await;
                                    }

                                    if let Some(partner_id) = old_partner {
                                        if let Some(partner_session) = guard.sessions.get(&partner_id) {
                                            let tags = partner_session.tags.clone();
                                            let _ = partner_session.tx.send(ServerMessage::Status {
                                                message: "Stranger skipped! Searching for a new match...".to_string(),
                                            }).await;
                                            guard.enqueue_user(partner_id, tags);
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

    let mut guard = state.lock().await;
    let partner_id = guard.disconnect_user(user_id);
    tracing::info!("User session {} terminated.", user_id);

    if let Some(pid) = partner_id {
        if let Some(partner_session) = guard.sessions.get(&pid) {
            let tags = partner_session.tags.clone();
            let _ = partner_session.tx.send(ServerMessage::Status {
                message: "Stranger disconnected! Searching for a new match...".to_string(),
            }).await;
            guard.enqueue_user(pid, tags);
        }
    }
}