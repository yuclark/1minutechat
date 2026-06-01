use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Messages sent from the Client (Frontend) to the Server (Backend)
#[derive(Debug, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum ClientMessage {
    #[serde(rename = "join")]
    Join { tags: Vec<String> },
    
    #[serde(rename = "send_message")]
    SendMessage { text: String },
    
    #[serde(rename = "skip")]
    Skip,
}

/// Messages sent from the Server (Backend) to the Client (Frontend)
#[derive(Debug, Serialize, Clone)]
#[serde(tag = "type", content = "payload")]
pub enum ServerMessage {
    #[serde(rename = "status")]
    Status { message: String },
    
    #[serde(rename = "chat_message")]
    ChatMessage {
        id: Uuid,
        sender: String,
        text: String,
    },
    
    #[serde(rename = "timer")]
    Timer { remaining_seconds: u32 },
    
    #[serde(rename = "match_found")]
    MatchFound,
}