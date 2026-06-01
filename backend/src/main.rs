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

    // Read port from environment variable (assigned by cloud host), fallback to 4000 locally
    let port = std::env::var("PORT")
        .unwrap_or_else(|_| "4000".to_string())
        .parse::<u16>()
        .expect("PORT must be a valid number");

    // Bind server to 0.0.0.0 to accept external internet traffic
    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port)).await.unwrap();
    tracing::info!("Server listening on port: {}", port);
    
    axum::serve(listener, app).await.unwrap();
}