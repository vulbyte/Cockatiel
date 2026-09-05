use axum::{
    Json, Router,
    extract::State,
    http::StatusCode,
    routing::{get, post},
};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::{net::SocketAddr, sync::Arc, time::Duration};
use tokio::sync::Semaphore;
use tracing::{Level, info};
use tracing_subscriber::FmtSubscriber;

// State shared across all async tasks
#[derive(Clone)]
struct AppState {
    http_client: Client,
    // Prevents overwhelming downstream resources during traffic spikes
    rate_limiter: Arc<Semaphore>,
}

#[derive(Deserialize)]
struct TaskPayload {
    target_url: String,
}

#[derive(Serialize)]
struct TaskResponse {
    status: String,
    http_code: u16,
}

#[tokio::main]
async fn main() {
    // 1. Initialize logging
    let subscriber = FmtSubscriber::builder()
        .with_max_level(Level::INFO)
        .finish();
    tracing::subscriber::set_global_default(subscriber).expect("Failed to set tracing subscriber");

    // 2. Build optimized HTTP client with connection pooling
    let http_client = Client::builder()
        .pool_max_idle_per_host(50)
        .timeout(Duration::from_secs(10))
        .tcp_keepalive(Duration::from_secs(60))
        .build()
        .expect("Failed to build reqwest client");

    // Allow up to 100 concurrent requests (well above 25 req/sec threshold)
    let state = AppState {
        http_client,
        rate_limiter: Arc::new(Semaphore::new(100)),
    };

    // 3. Define routes
    let app = Router::new()
        .route("/health", get(health_check))
        .route("/process", post(process_request))
        .with_state(state);

    // 4. Start Axum server
    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    info!("Server listening on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

// Health check handler
async fn health_check() -> &'static str {
    "OK"
}

// Request handler with concurrency management
async fn process_request(
    State(state): State<AppState>,
    Json(payload): Json<TaskPayload>,
) -> Result<Json<TaskResponse>, (StatusCode, String)> {
    // Acquire a permit from the semaphore
    let _permit = state
        .rate_limiter
        .acquire()
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Semaphore closed".into()))?;

    // Perform non-blocking async HTTP request
    let res = state
        .http_client
        .get(&payload.target_url)
        .send()
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("Fetch error: {}", e)))?;

    let status_code = res.status().as_u16();

    Ok(Json(TaskResponse {
        status: "success".into(),
        http_code: status_code,
    }))
}
