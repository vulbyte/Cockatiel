use futures_util::{SinkExt, StreamExt};
use prost::Message;
use serde::{Deserialize, Serialize};
use std::env;
use std::fs;
use std::path::PathBuf;
use std::process;
use std::sync::Arc;
use tokio::net::TcpStream;
use tokio::sync::Mutex;
use tokio_tungstenite::{
    connect_async, tungstenite::protocol::Message as WsMessage, MaybeTlsStream, WebSocketStream,
};
use tracing::{error, info, warn};

pub mod cockatiel_protobuf {
    include!(concat!(env!("OUT_DIR"), "/cockatiel_protobuf.rs"));
}

pub use cockatiel_protobuf::*;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CockatielConfig {
    pub engine_port: u16,
    pub pairing_pin: u32,
    pub process_position: Option<String>,
    pub priority: Option<i32>,
    pub module_specific: Option<serde_json::Value>,
}

type WsWriter =
    futures_util::stream::SplitSink<WebSocketStream<MaybeTlsStream<TcpStream>>, WsMessage>;
type WsReader = futures_util::stream::SplitStream<WebSocketStream<MaybeTlsStream<TcpStream>>>;

#[derive(Clone)]
pub struct CockatielClient {
    writer: Arc<Mutex<WsWriter>>,
    reader: Arc<Mutex<WsReader>>,
    module_name: String,
}

fn prompt_user(prompt_text: &str) -> String {
    println!("{}", prompt_text);
    let mut input = String::new();
    std::io::stdin()
        .read_line(&mut input)
        .expect("Failed to read input");
    input.trim().to_string()
}

pub struct CockatielClientBuilder {
    module_name: String,
    priority: Option<i32>,
    process_position: Option<String>,
}

impl CockatielClientBuilder {
    pub fn new(module_name: &str) -> Self {
        Self {
            module_name: module_name.to_string(),
            priority: None,
            process_position: None,
        }
    }

    pub fn priority(mut self, priority: i32) -> Self {
        self.priority = Some(priority);
        self
    }

    pub fn position(mut self, position: &str) -> Self {
        self.process_position = Some(position.to_string());
        self
    }

    pub async fn connect(self) -> Result<CockatielClient, Box<dyn std::error::Error>> {
        return Ok(CockatielClient::connect_with_overrides(
            &self.module_name,
            self.priority,
            self.process_position,
        )
        .await?);
    }
}

impl CockatielClient {
    pub fn connect(module_name: &str) -> CockatielClientBuilder {
        CockatielClientBuilder::new(module_name)
    }

    /// Internal connection logic supporting builder overrides and config fallbacks
    pub async fn connect_with_overrides(
        module_name: &str,
        override_priority: Option<i32>,
        override_position: Option<String>,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let config_path = PathBuf::from("config.json");
        let args: Vec<String> = env::args().collect();
        let force_new = args.iter().any(|arg| arg == "--new" || arg == "-n");

        if force_new && config_path.exists() {
            println!("\n==================================================================");
            println!("      ⚠️  --new flag detected: Reset Configuration Request         ");
            println!("==================================================================\n");
            let confirmation = prompt_user("Are you sure you want to delete your existing 'config.json' and start fresh? (y/N):");
            if confirmation.to_lowercase() == "y" || confirmation.to_lowercase() == "yes" {
                if let Err(e) = fs::remove_file(&config_path) {
                    error!("Failed to remove existing config.json: {}", e);
                } else {
                    info!("Successfully cleared existing 'config.json'.");
                }
            } else {
                info!("Reset aborted. Keeping existing configuration.");
            }
        }

        let config = if config_path.exists() && !config_path.is_dir() {
            // FIXED: Use tokio::fs for asynchronous file reading
            let data = tokio::fs::read_to_string(&config_path).await?;
            serde_json::from_str::<CockatielConfig>(&data)
                .unwrap_or_else(|_| Self::run_setup_wizard(&config_path))
        } else {
            Self::run_setup_wizard(&config_path)
        };

        let engine_port = Self::resolve_engine_port(config.engine_port);
        let engine_ws_url = format!("ws://127.0.0.1:{}", engine_port);
        let priority = override_priority.or(config.priority).unwrap_or(10);
        let process_position = override_position
            .or(config.process_position)
            .unwrap_or_else(|| "input".to_string());

        info!("Connecting to Cockatiel Engine at {}...", engine_ws_url);

        let (ws_stream, _) = connect_async(&engine_ws_url)
            .await
            .expect("Failed to connect to Engine. Is cockatiel-engine running?");
        let (mut write_ws, mut read_ws) = ws_stream.split();

        info!("Connected to WebSocket! Building authentication handshake packet...");

        let handshake_payload = ConnectionRequest {
            pin: config.pairing_pin as i32,
            priority,
            process_position,
        };

        let handshake_container = Container {
            version: 1,
            r#type: "auth".to_string(),
            auth_token: "".to_string(),
            error: "".to_string(),
            module_name: module_name.to_string(),
            payload: Some(container::Payload::ConnectionRequest(handshake_payload)),
        };

        let mut init_buf = Vec::new();
        <Container as Message>::encode(&handshake_container, &mut init_buf)?;

        info!(
            "Sending handshake binary frame ({} bytes) to engine...",
            init_buf.len()
        );
        write_ws.send(WsMessage::Binary(init_buf)).await?;

        info!("Handshake sent. Waiting for authentication return frame from Cockatiel Engine...");

        match read_ws.next().await {
            Some(Ok(WsMessage::Binary(resp_bytes))) => {
                info!(
                    "Received binary response frame ({} bytes) during handshake.",
                    resp_bytes.len()
                );
                match <Container as Message>::decode(resp_bytes.as_ref()) {
                    Ok(resp_container) => {
                        info!(
                            "Decoded container response: type='{}', error='{}'",
                            resp_container.r#type, resp_container.error
                        );
                        match resp_container.payload {
                            Some(container::Payload::ConnectionRequestReturn(_)) => {
                                info!("Successfully authenticated with Cockatiel Engine!");
                            }
                            other => {
                                error!("Authentication handshake rejected by engine. Payload variant received: {:?}", other);
                                process::exit(1);
                            }
                        }
                    }
                    Err(e) => {
                        error!(
                            "Failed to decode response container Protobuf: {}. Raw bytes: {:?}",
                            e, resp_bytes
                        );
                        process::exit(1);
                    }
                }
            }
            Some(Ok(other_msg)) => {
                warn!(
                    "Received non-binary WebSocket frame during handshake: {:?}",
                    other_msg
                );
                error!(
                    "Authentication failed: Engine did not return expected binary Protobuf frame."
                );
                process::exit(1);
            }
            Some(Err(e)) => {
                error!(
                    "WebSocket error encountered while waiting for handshake response: {}",
                    e
                );
                process::exit(1);
            }
            None => {
                error!(
                    "WebSocket connection closed by Cockatiel Engine before handshake completed."
                );
                process::exit(1);
            }
        }

        Ok(Self {
            writer: Arc::new(Mutex::new(write_ws)),
            reader: Arc::new(Mutex::new(read_ws)),
            module_name: module_name.to_string(),
        })
    }

    /// Sends a typed request payload wrapped in the master Container protobuf
    pub async fn send(
        &self,
        request_type: &str,
        payload: container::Payload,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let container = Container {
            version: 1,
            r#type: request_type.to_string(),
            auth_token: "session-token".to_string(),
            error: "".to_string(),
            module_name: self.module_name.clone(),
            payload: Some(payload),
        };

        let mut buf = Vec::new();
        <Container as Message>::encode(&container, &mut buf)?;
        let mut writer = self.writer.lock().await;
        writer.send(WsMessage::Binary(buf)).await?;
        Ok(())
    }

    /// Continuously listens for incoming messages from the engine and invokes the listener function
    pub async fn receive<F>(&self, mut listener_fn: F) -> Result<(), Box<dyn std::error::Error>>
    where
        F: FnMut(Container),
    {
        loop {
            let next_msg = {
                let mut reader = self.reader.lock().await;
                reader.next().await
            };

            match next_msg {
                Some(Ok(WsMessage::Binary(bytes))) => {
                    if let Ok(container) = <Container as Message>::decode(bytes.as_ref()) {
                        listener_fn(container);
                    }
                }
                Some(Ok(WsMessage::Close(_))) => {
                    info!("Engine closed connection.");
                    break;
                }
                Some(Err(e)) => {
                    error!("WebSocket error: {}", e);
                    break;
                }
                None => break,
                _ => {}
            }
        }
        Ok(())
    }

    fn run_setup_wizard(config_path: &PathBuf) -> CockatielConfig {
        println!("\n==================================================================");
        println!("            Cockatiel Module - Interactive Setup Wizard             ");
        println!("==================================================================\n");

        let port_str = prompt_user("    > Enter Cockatiel Engine port [Default: 9734]:");
        let engine_port = if port_str.is_empty() {
            9734
        } else {
            port_str.parse().unwrap_or(9734)
        };

        let pin_str = prompt_user("    > Enter Engine Pairing PIN (shown in engine config/logs):");
        let pairing_pin = pin_str.parse().unwrap_or(0);

        let config = CockatielConfig {
            engine_port,
            pairing_pin,
            process_position: Some("input".to_string()),
            priority: Some(10),
            module_specific: None,
        };

        let json_data = serde_json::to_string_pretty(&config).unwrap();
        fs::write(config_path, json_data).expect("Failed to write module config file");
        println!("\n[Setup Complete]: Config successfully saved to 'config.json'!\n");

        config
    }

    fn resolve_engine_port(config_port: u16) -> u16 {
        let args: Vec<String> = env::args().collect();
        let mut i = 1;
        while i < args.len() {
            if (args[i] == "--port" || args[i] == "-p") && i + 1 < args.len() {
                if let Ok(p) = args[i + 1].parse::<u16>() {
                    info!("Overriding engine port from CLI flag: {}", p);
                    return p;
                }
            }
            i += 1;
        }
        config_port
    }
}
