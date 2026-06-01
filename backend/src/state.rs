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

impl ChatState {
    /// Registers a brand new user session when they establish a WebSocket connection
    pub fn register_user(&mut self, id: Uuid, tx: mpsc::Sender<ServerMessage>) {
        let session = UserSession { id, tx };
        self.sessions.insert(id, session);
    }

    /// Pushes a registered user into the matchmaking waiting queue
    pub fn enqueue_user(&mut self, id: Uuid) {
        // Prevent adding duplicates to the queue
        if !self.queue.contains(&id) {
            self.queue.push_back(id);
        }
    }

    /// Removes a user from the waiting queue if they disconnect or get matched
    pub fn dequeue_user(&mut self, id: Uuid) {
        self.queue.retain(|&x| x != id);
    }

    /// Handles a full cleanup when a user completely disconnects from the platform.
    /// Returns their active partner's Uuid if they were in a chat, so we can handle them.
    pub fn disconnect_user(&mut self, id: Uuid) -> Option<Uuid> {
        // 1. Erase them from the session directory
        self.sessions.remove(&id);

        // 2. Erase them from the waiting queue
        self.dequeue_user(id);

        // 3. Check if they were actively matched with a stranger
        if let Some(partner_id) = self.matches.remove(&id) {
            // Bi-directional cleanup: remove the inverse match mapping too
            self.matches.remove(&partner_id);
            return Some(partner_id);
        }

        None
    }
}