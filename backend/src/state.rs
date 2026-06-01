use std::collections::{HashMap, VecDeque};
use std::sync::Arc;
use tokio::sync::{mpsc, Mutex};
use uuid::Uuid;
use crate::protocol::ServerMessage;

/// Represents an active connection for an anonymous user
#[derive(Debug)]
pub struct UserSession {
    pub id: Uuid,
    /// A bounded transmitter channel used to send messages directly to this user's WebSocket task
    pub tx: mpsc::Sender<ServerMessage>,
}

/// The global shared memory state of our application
#[derive(Debug, Default)]
pub struct ChatState {
    /// The matchmaking queue (First In, First Out)
    pub queue: VecDeque<Uuid>,
    
    /// Map of all currently active online sessions: User ID -> Their Session Data
    pub sessions: HashMap<Uuid, UserSession>,
    
    /// Map tracking active pairs: User ID -> Partner's User ID
    pub matches: HashMap<Uuid, Uuid>,
}

/// A convenient, thread-safe pointer wrapper around our ChatState.
/// This allows multiple WebSocket tasks to safely read and write to the state concurrently.
pub type SharedState = Arc<Mutex<ChatState>>;