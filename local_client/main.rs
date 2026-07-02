use axum::{
    extract::{Query, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Router,
};
use piper_rs::Piper;
use serde::Deserialize;
use std::sync::Arc;
use tower_http::cors::CorsLayer;

#[derive(Deserialize)]
struct TtsParams {
    text: String,
}

// Share the Piper engine across threads
struct AppState {
    piper: Piper,
}

#[tokio::main]
async fn main() {
    use tower_http::cors::CorsLayer;
    use std::sync::Arc;

    // 1. Initialize State
    let model_path = "en_US-lessac-medium.onnx";
    let piper = Piper::new(model_path).expect("Failed to load model");
    let shared_state = Arc::new(AppState { piper });

    // 2. Define Router once
    let app = Router::new()
        .route("/health", get(health_check)) // Added health check endpoint
        .route("/api/tts", post(tts_handler)) // Using POST for data transmission
        .layer(CorsLayer::permissive()) 
        .with_state(shared_state);

    // 3. Bind and Serve
    let listener = tokio::net::TcpListener::bind("127.0.0.1:5002").await.unwrap();
    println!("TTS Server running on http://127.0.0.1:5002");
    axum::serve(listener, app).await.unwrap();
}

async fn tts_handler(
    State(state): State<Arc<AppState>>,
    Query(params): Query<TtsParams>,
) -> impl IntoResponse {
    // Generate audio
    let audio_data = state
        .piper
        .speak(&params.text)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Return as a wav response
    Response::builder()
        .header(header::CONTENT_TYPE, "audio/wav")
        .body(audio_data.into())
        .unwrap()
}
