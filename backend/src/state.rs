use std::collections::{HashMap, VecDeque};
use std::sync::Arc;
use tokio::sync::{mpsc, Mutex};
use uuid::Uuid;
use crate::protocol::ServerMessage;

/// Tracks a unique instance of a match session to prevent concurrent timer leaks
#[derive(Debug, Clone, PartialEq)]
pub struct MatchInfo {
    pub partner_id: Uuid,
    pub match_id: Uuid,
}

/// Represents an active connection for an anonymous user
#[derive(Debug)]
pub struct UserSession {
    pub id: Uuid,
    pub tx: mpsc::Sender<ServerMessage>,
    pub tags: Vec<String>,
}

/// The global shared memory state of our application
#[derive(Debug, Default)]
pub struct ChatState {
    pub queue: VecDeque<Uuid>,
    pub sessions: HashMap<Uuid, UserSession>,
    pub matches: HashMap<Uuid, MatchInfo>,
}

pub type SharedState = Arc<Mutex<ChatState>>;

impl ChatState {
    /// Registers a user session shell upon establishing a raw socket connection
    pub fn register_user(&mut self, id: Uuid, tx: mpsc::Sender<ServerMessage>) {
        let session = UserSession { id, tx, tags: Vec::new() };
        self.sessions.insert(id, session);
    }

    /// Appends user to the matchmaking pool with their targeted interests
    pub fn enqueue_user(&mut self, id: Uuid, tags: Vec<String>) {
        if let Some(session) = self.sessions.get_mut(&id) {
            session.tags = tags;
        }
        if !self.queue.contains(&id) {
            self.queue.push_back(id);
        }
    }

    pub fn dequeue_user(&mut self, id: Uuid) {
        self.queue.retain(|&x| x != id);
    }

    pub fn disconnect_user(&mut self, id: Uuid) -> Option<Uuid> {
        self.sessions.remove(&id);
        self.dequeue_user(id);

        if let Some(match_info) = self.matches.remove(&id) {
            let partner_id = match_info.partner_id;
            self.matches.remove(&partner_id);
            return Some(partner_id);
        }
        None
    }
}