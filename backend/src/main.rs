mod state;
mod matchmaker;
mod ws;
mod protocol;

use axum::{routing::get, Router};
use std::sync::Arc;
use tokio::sync::Mutex;
use tower_http::cors::CorsLayer;
use state::ChatState;

#[tokio::main]
async fn main() {
    // Initialize standard out logging
    tracing_subscriber::fmt::init();

    // Create the shared application state
    let shared_state = Arc::new(Mutex::new(ChatState::default()));

    // Spawn the matchmaker background engine task
    tokio::spawn(matchmaker::run_matchmaker(shared_state.clone()));

    // Configure routes and permissive CORS for development frontends
    let app = Router::new()
        .route("/ws", get(ws::ws_handler))
        .layer(CorsLayer::permissive())
        .with_state(shared_state);

    // Bind server to port 4000
    let listener = tokio::net::TcpListener::bind("127.0.0.1:4000").await.unwrap();
    tracing::info!("Server listening on: http://127.0.0.1:4000");
    
    axum::serve(listener, app).await.unwrap();
}