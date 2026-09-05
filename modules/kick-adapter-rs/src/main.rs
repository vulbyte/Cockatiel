use futures_util::{SinkExt, StreamExt};
use lib_cockatiel::{container::Payload, CockatielClient, MessagePreProcess};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::io::{self, Write};
use std::path::PathBuf;
use tokio_tungstenite::{
    connect_async,
    tungstenite::{client::IntoClientRequest, protocol::Message},
};
use tracing::{error, info, Level};
use tracing_subscriber::FmtSubscriber;

#[derive(Debug, Serialize, Deserialize, Clone)]
struct KickAdapterConfig {
    channel_name: Option<String>,
    client_id: Option<String>,
    client_secret: Option<String>,
    oauth_token: Option<String>,
}

fn load_adapter_config() -> Option<KickAdapterConfig> {
    let path = PathBuf::from("config.json");
    if !path.exists() {
        return None;
    }
    let data = std::fs::read_to_string(path).ok()?;
    let json_val: serde_json::Value = serde_json::from_str(&data).ok()?;
    if let Some(mod_spec) = json_val.get("module_specific") {
        serde_json::from_value(mod_spec.clone()).ok()
    } else {
        None
    }
}

fn save_adapter_config(
    channel_name: &str,
    client_id: &str,
    client_secret: &str,
    oauth_token: &str,
) {
    let path = PathBuf::from("config.json");
    if let Ok(data) = std::fs::read_to_string(&path) {
        if let Ok(mut json_val) = serde_json::from_str::<serde_json::Value>(&data) {
            let spec = json!({
                "channel_name": channel_name,
                "client_id": client_id,
                "client_secret": client_secret,
                "oauth_token": oauth_token
            });
            json_val["module_specific"] = spec;
            if let Ok(pretty) = serde_json::to_string_pretty(&json_val) {
                let _ = std::fs::write(&path, pretty);
                info!("Successfully saved Kick configuration to config.json");
            }
        }
    }
}

fn prompt_user(prompt_text: &str) -> String {
    print!("{}", prompt_text);
    io::stdout().flush().unwrap();
    let mut input = String::new();
    io::stdin()
        .read_line(&mut input)
        .expect("Failed to read input");
    input.trim().to_string()
}

async fn fetch_chatroom_id(
    client: &reqwest::Client,
    name: &str,
) -> Result<u64, Box<dyn std::error::Error>> {
    let clean_name = name.trim().strip_prefix('@').unwrap_or(name.trim());
    let url = format!("https://kick.com/api/v2/channels/{}", clean_name);

    let res = client
        .get(&url)
        .header(
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        )
        .send()
        .await?
        .json::<serde_json::Value>()
        .await?;

    if let Some(chatroom) = res.get("chatroom") {
        if let Some(id) = chatroom.get("id").and_then(|i| i.as_u64()) {
            return Ok(id);
        }
    }

    Err(format!(
        "Could not find chatroom ID for Kick channel: {}",
        clean_name
    )
    .into())
}

async fn fetch_app_access_token(
    client: &reqwest::Client,
    client_id: &str,
    client_secret: &str,
) -> Result<String, Box<dyn std::error::Error>> {
    let params = [
        ("grant_type", "client_credentials"),
        ("client_id", client_id),
        ("client_secret", client_secret),
    ];

    let res = client
        .post("https://id.kick.com/oauth/token")
        .form(&params)
        .send()
        .await?;

    if res.status().is_success() {
        let json_res: serde_json::Value = res.json().await?;
        if let Some(token) = json_res.get("access_token").and_then(|t| t.as_str()) {
            return Ok(token.to_string());
        }
    } else {
        let err_text = res.text().await.unwrap_or_default();
        return Err(format!("Failed to obtain OAuth token from Kick: {}", err_text).into());
    }

    Err("Invalid response structure from Kick OAuth server".into())
}

async fn send_kick_message(
    client: &reqwest::Client,
    oauth_token: &str,
    message: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    if oauth_token.is_empty() {
        return Ok(());
    }

    let url = "https://api.kick.com/public/v1/chat";
    let body = json!({
        "content": message,
        "type": "user"
    });

    let res = client
        .post(url)
        .header("Authorization", format!("Bearer {}", oauth_token))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await?;

    if res.status().is_success() {
        info!("[Kick Outbound] Successfully sent message to chat.");
    } else {
        let err_text = res.text().await.unwrap_or_default();
        error!("[Kick Outbound] Failed to send message: {}", err_text);
    }

    Ok(())
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let subscriber = FmtSubscriber::builder()
        .with_max_level(Level::INFO)
        .finish();
    tracing::subscriber::set_global_default(subscriber).unwrap();

    info!("Starting Kick Adapter Module...");

    let http_client = reqwest::Client::new();
    let http_client_for_sender = http_client.clone();

    let mut channel_name = std::env::var("KICK_CHANNEL_NAME").unwrap_or_default();
    let mut client_id = std::env::var("KICK_CLIENT_ID").unwrap_or_default();
    let mut client_secret = std::env::var("KICK_CLIENT_SECRET").unwrap_or_default();
    let mut oauth_token = std::env::var("KICK_OAUTH_TOKEN").unwrap_or_default();

    if channel_name.is_empty() {
        if let Some(saved) = load_adapter_config() {
            if let Some(saved_name) = saved.channel_name {
                println!("\n==================================================");
                println!("        Saved Kick Configuration Found            ");
                println!("==================================================\n");
                let choice = prompt_user(&format!(
                    "    > Do you want to use existing Kick channel name '{}'? (y/n): ",
                    saved_name
                ));
                println!();

                if choice.to_lowercase() == "y" || choice.to_lowercase() == "yes" {
                    channel_name = saved_name;
                    client_id = saved.client_id.unwrap_or_default();
                    client_secret = saved.client_secret.unwrap_or_default();
                    oauth_token = saved.oauth_token.unwrap_or_default();
                }
            }
        }
    }

    if channel_name.is_empty() {
        println!("\n==================================================");
        println!("         Kick Live Chat Configuration Required     ");
        println!("==================================================\n");
        channel_name = prompt_user("    > Enter Kick Channel Name / Username (e.g. vulbyte): ");

        println!("\n------------------------------------------------------------------");
        println!(" 💡 Kick Application Setup (Required for bot replies/moderation):");
        println!("    1. Go to: https://kick.com/settings/developer");
        println!("    2. Click 'Create new' with these exact settings:");
        println!("       - Application Name:  tielbot");
        println!("       - App Description:   Stream chat adapter for Cockatiel");
        println!("       - Redirect URL:      http://localhost");
        println!("       - Enable webhooks:   Off (Disabled)");
        println!("       - Scopes Requested:  Check **ALL** permissions");
        println!("    3. Copy your Client ID and Client Secret when prompted below.");
        println!("    ");
        println!("    ℹ️  Note: If you only want read-only monitoring, press Enter");
        println!("        to skip credentials.");
        println!("------------------------------------------------------------------\n");

        client_id = prompt_user("    > Enter Client ID [Optional - press Enter to skip]: ");
        if !client_id.is_empty() {
            client_secret = prompt_user("    > Enter Client Secret: ");

            if !client_secret.is_empty() {
                info!("Requesting automated OAuth token from Kick API...");
                match fetch_app_access_token(&http_client, &client_id, &client_secret).await {
                    Ok(token) => {
                        info!("Successfully generated Kick OAuth Token automatically!");
                        oauth_token = token;
                    }
                    Err(e) => {
                        error!(
                            "Failed to generate OAuth token: {}. Continuing in read-only mode.",
                            e
                        );
                    }
                }
            }
        }
        println!();

        save_adapter_config(&channel_name, &client_id, &client_secret, &oauth_token);
    } else if oauth_token.is_empty() && !client_id.is_empty() && !client_secret.is_empty() {
        if let Ok(token) = fetch_app_access_token(&http_client, &client_id, &client_secret).await {
            oauth_token = token;
        }
    }

    let cockatiel = CockatielClient::connect("kick_adapter")
        .position("input")
        .connect()
        .await?;

    let token_clone = oauth_token.clone();
    let cockatiel_listener = cockatiel.clone();
    tokio::spawn(async move {
        if let Err(e) = cockatiel_listener
            .receive(move |container| {
                let client_ref = http_client_for_sender.clone();
                let t_ref = token_clone.clone();
                match container.r#type.as_str() {
                    "send" => {
                        info!("Received engine send request: {:?}", container);

                        let message_text = match &container.payload {
                            Some(Payload::MessagePreProcess(mp)) => Some(mp.raw_message.clone()),
                            _ => None,
                        };

                        if let Some(msg) = message_text {
                            tokio::spawn(async move {
                                if let Err(err) = send_kick_message(&client_ref, &t_ref, &msg).await
                                {
                                    error!("Error sending outbound Kick message: {}", err);
                                }
                            });
                        }
                    }
                    "engine_message" => {
                        info!("Received engine message: {:?}", container);
                    }
                    other => {
                        tracing::trace!("Ignoring engine message of type={}", other);
                    }
                }
            })
            .await
        {
            error!("Receiver loop exited with error: {}", e);
        }
    });

    info!(
        "Resolving Kick channel '{}' to chatroom ID...",
        channel_name
    );
    let chatroom_id = match fetch_chatroom_id(&http_client, &channel_name).await {
        Ok(id) => {
            info!("Successfully resolved chatroom ID: {}", id);
            id
        }
        Err(e) => {
            error!("Failed to resolve Kick chatroom ID: {}. Exiting.", e);
            return Err(e);
        }
    };

    let pusher_url = "wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=7.6.0&flash=false";

    loop {
        info!("Connecting to Kick Pusher WebSocket...");

        let mut req = match pusher_url.into_client_request() {
            Ok(r) => r,
            Err(e) => {
                error!("Failed to build WebSocket request: {}", e);
                tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
                continue;
            }
        };

        let headers = req.headers_mut();
        headers.insert("Origin", "https://kick.com".parse().unwrap());
        headers.insert("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36".parse().unwrap());

        let (mut ws_stream, _) = match connect_async(req).await {
            Ok(conn) => conn,
            Err(e) => {
                error!(
                    "Failed to connect to Kick WebSocket: {}. Retrying in 5 seconds...",
                    e
                );
                tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
                continue;
            }
        };

        info!("Connected to Kick WebSocket layer!");

        let mut ping_interval = tokio::time::interval(tokio::time::Duration::from_secs(30));

        loop {
            tokio::select! {
                _ = ping_interval.tick() => {}
                msg = ws_stream.next() => {
                    match msg {
                        Some(Ok(Message::Text(text))) => {
                            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&text) {
                                let event = parsed.get("event").and_then(|e| e.as_str()).unwrap_or("");

                                if event == "pusher:connection_established" {
                                    info!("Pusher handshake established. Subscribing to chatroom {}...", chatroom_id);
                                    let subscribe_msg = json!({
                                        "event": "pusher:subscribe",
                                        "data": {
                                            "auth": "",
                                            "channel": format!("chatrooms.{}.v2", chatroom_id)
                                        }
                                    });
                                    if let Err(e) = ws_stream.send(Message::Text(subscribe_msg.to_string())).await {
                                        error!("Failed to send subscription frame: {}", e);
                                        break;
                                    }
                                } else if event == "pusher_internal:subscription_succeeded" {
                                    info!("Successfully subscribed to Kick chatroom: chatrooms.{}.v2", chatroom_id);
                                } else if event == "App\\Events\\ChatMessageEvent" {
                                    if let Some(data_str) = parsed.get("data").and_then(|d| d.as_str()) {
                                        if let Ok(data_json) = serde_json::from_str::<serde_json::Value>(data_str) {
                                            let sender = data_json.get("sender")
                                                .and_then(|s| s.get("username"))
                                                .and_then(|u| u.as_str())
                                                .unwrap_or("Unknown");

                                            let content = data_json.get("content")
                                                .and_then(|c| c.as_str())
                                                .unwrap_or("");

                                            if !content.is_empty() {
                                                info!("[Kick Chat] {}: {}", sender, content);
                                                let pre_process = MessagePreProcess {
                                                    platform: "kick".to_string(),
                                                    raw_data: data_json.to_string(),
                                                    raw_message: content.to_string(),
                                                };
                                                if let Err(e) = cockatiel.send("incoming_chat", Payload::MessagePreProcess(pre_process)).await {
                                                    error!("Failed to send message to engine: {}", e);
                                                }
                                            }
                                        }
                                    }
                                } else if event == "pusher:ping" {
                                    let pong = json!({ "event": "pusher:pong", "data": {} });
                                    let _ = ws_stream.send(Message::Text(pong.to_string())).await;
                                }
                            }
                        }
                        Some(Ok(Message::Ping(p))) => {
                            let _ = ws_stream.send(Message::Pong(p)).await;
                        }
                        Some(Err(e)) => {
                            error!("WebSocket error: {}. Reconnecting...", e);
                            break;
                        }
                        None => {
                            error!("WebSocket connection closed. Reconnecting...");
                            break;
                        }
                        _ => {}
                    }
                }
            }
        }

        tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
    }
}
