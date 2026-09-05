use futures_util::{SinkExt, StreamExt};
use lib_cockatiel::{container::Payload, CockatielClient, MessagePreProcess};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::io::{self, Write};
use std::path::PathBuf;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message as WsMessage};
use tracing::{error, info, Level};
use tracing_subscriber::FmtSubscriber;

#[derive(Debug, Serialize, Deserialize, Clone)]
struct TwitchAdapterConfig {
    channel: Option<String>,
    oauth_token: Option<String>,
    username: Option<String>,
    client_id: Option<String>,
}

/// Parses a Twitch IRC PRIVMSG line to extract the display name and message text
fn parse_twitch_privmsg(line: &str) -> Option<(String, String)> {
    if !line.contains("PRIVMSG") {
        return None;
    }

    let mut display_name = "Unknown".to_string();
    if line.starts_with('@') {
        if let Some(tags_end) = line.find(' ') {
            let tags = &line[1..tags_end];
            for tag in tags.split(';') {
                if tag.starts_with("display-name=") {
                    let name = &tag["display-name=".len()..];
                    if !name.is_empty() {
                        display_name = name.to_string();
                    }
                }
            }
        }
    }

    if display_name == "Unknown" {
        if let Some(nick_end) = line.find('!') {
            if let Some(nick_start) = line.find(':') {
                if nick_start < nick_end {
                    display_name = line[nick_start + 1..nick_end].to_string();
                }
            }
        }
    }

    if let Some(msg_idx) = line.find(" PRIVMSG ") {
        let remainder = &line[msg_idx + 9..];
        if let Some(colon_idx) = remainder.find(':') {
            let message_text = remainder[colon_idx + 1..].trim().to_string();
            return Some((display_name, message_text));
        }
    }

    None
}

fn load_adapter_config() -> Option<TwitchAdapterConfig> {
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

fn save_adapter_config(channel: &str, oauth_token: &str, username: &str, client_id: &str) {
    let path = PathBuf::from("config.json");
    if let Ok(data) = std::fs::read_to_string(&path) {
        if let Ok(mut json_val) = serde_json::from_str::<serde_json::Value>(&data) {
            let spec = json!({
                "channel": channel,
                "oauth_token": oauth_token,
                "username": username,
                "client_id": client_id
            });
            json_val["module_specific"] = spec;
            if let Ok(pretty) = serde_json::to_string_pretty(&json_val) {
                let _ = std::fs::write(&path, pretty);
                info!("Successfully saved Twitch configuration to config.json");
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
    input.trim().to_lowercase()
}

/// Automatically queries Twitch's /validate endpoint to get the exact lowercase username
async fn fetch_twitch_username(raw_token: &str) -> Option<String> {
    let client = reqwest::Client::new();
    let res = client
        .get("https://id.twitch.tv/oauth2/validate")
        .header("Authorization", format!("OAuth {}", raw_token))
        .send()
        .await
        .ok()?;

    if res.status().is_success() {
        let json: serde_json::Value = res.json().await.ok()?;
        json.get("login")?.as_str().map(|s| s.to_string())
    } else {
        None
    }
}

async fn capture_oauth_token_concurrent(
    client_id: &str,
) -> Result<String, Box<dyn std::error::Error>> {
    let listener = TcpListener::bind("127.0.0.1:3000").await?;
    let redirect_uri = "http://localhost:3000";
    let auth_url = format!(
        "https://id.twitch.tv/oauth2/authorize?client_id={}&redirect_uri={}&response_type=token&scope=chat:read+chat:edit",
        client_id, redirect_uri
    );

    println!("\n--------------------------------------------------");
    println!("  Opening browser for official Twitch authorization...");
    println!("  Ensure your Redirect URI in the Twitch Developer");
    println!("  Console is set to exactly: http://localhost:3000");
    println!("--------------------------------------------------\n");

    let _ = open::that(&auth_url);

    // Future 1: TCP Server running with fragment-capturing JS
    let tcp_fut = async {
        let (mut socket, _) = listener.accept().await?;
        let mut buf = [0; 4096];
        let n = socket.read(&mut buf).await?;
        let request = String::from_utf8_lossy(&buf[..n]);

        if request.contains("GET /callback?token=") {
            let token_start = request.find("GET /callback?token=").unwrap() + 20;
            let space_idx = request[token_start..]
                .find(' ')
                .unwrap_or(request[token_start..].len());
            let token = request[token_start..token_start + space_idx].to_string();

            let response_html = "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\n\r\n\
            <html><body style='background:#0e0e10;color:#efeff1;font-family:system-ui,sans-serif;text-align:center;padding-top:120px;'>\
            <h1 style='color:#a970ff;'>Twitch authentication successful!</h1>\
            <p>You can close this window and return to your terminal.</p>\
            </body></html>";
            let _ = socket.write_all(response_html.as_bytes()).await;
            Ok(token)
        } else if request.contains("error=") {
            let response_html = "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\n\r\n\
            <html><body style='background:#0e0e10;color:#efeff1;font-family:system-ui,sans-serif;text-align:center;padding-top:120px;'>\
            <h1 style='color:#ff4f4f;'>Twitch Redirect Error (Mismatch)</h1>\
            <p>Please check that your Redirect URI in the Twitch Developer Console is set to exactly <b>http://localhost:3000</b>.</p>\
            </body></html>";
            let _ = socket.write_all(response_html.as_bytes()).await;
            Err("Twitch returned a redirect_mismatch error. Make sure http://localhost:3000 is added under Redirect URIs in your Twitch Console app settings.".into())
        } else {
            // Serve landing page with JS to extract window.location.hash and forward to /callback
            let landing_html = "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\n\r\n\
            <html>\
            <script>\
                if (window.location.hash) {\
                    const hashParams = new URLSearchParams(window.location.hash.substring(1));\
                    const token = hashParams.get('access_token');\
                    if (token) {\
                        window.location.href = '/callback?token=' + token;\
                    }\
                }\
            </script>\
            <body style='background:#0e0e10;color:#efeff1;font-family:system-ui,sans-serif;text-align:center;padding-top:120px;'>\
            <h1 style='color:#a970ff;'>Authenticating with Twitch...</h1>\
            <p>Processing authorization token...</p>\
            </body></html>";
            let _ = socket.write_all(landing_html.as_bytes()).await;

            let (mut socket2, _) = listener.accept().await?;
            let mut buf2 = [0; 4096];
            let n2 = socket2.read(&mut buf2).await?;
            let request2 = String::from_utf8_lossy(&buf2[..n2]);

            if request2.contains("GET /callback?token=") {
                let token_start = request2.find("GET /callback?token=").unwrap() + 20;
                let space_idx = request2[token_start..]
                    .find(' ')
                    .unwrap_or(request2[token_start..].len());
                let token = request2[token_start..token_start + space_idx].to_string();

                let success_html = "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\n\r\n\
                <html><body style='background:#0e0e10;color:#efeff1;font-family:system-ui,sans-serif;text-align:center;padding-top:120px;'>\
                <h1 style='color:#a970ff;'>Twitch authentication successful!</h1>\
                <p>You can close this window and return to your terminal.</p>\
                </body></html>";
                let _ = socket2.write_all(success_html.as_bytes()).await;
                Ok(token)
            } else {
                Err("Failed to capture token from browser redirect flow.".into())
            }
        }
    };

    // Future 2: Terminal stdin fallback
    let stdin_fut = tokio::task::spawn_blocking(|| {
        print!("    > Or paste full redirect URL here: ");
        io::stdout().flush().unwrap();
        let mut input = String::new();
        io::stdin().read_line(&mut input).ok()?;
        Some(input.trim().to_string())
    });

    tokio::select! {
        res = tcp_fut => res,
        stdin_res = stdin_fut => {
            match stdin_res {
                Ok(Some(input)) => {
                    let m_trimmed = input.trim();
                    if m_trimmed.contains("error=") {
                        return Err(format!("Twitch auth error detected. Ensure your Redirect URI in the Twitch Console is set strictly to 'http://localhost:3000'. Details: {}", m_trimmed).into());
                    }

                    let raw_token = if let Some(idx) = m_trimmed.find("access_token=") {
                        let start = idx + 13;
                        let end = m_trimmed[start..].find('&').map(|i| i + start).unwrap_or(m_trimmed.len());
                        m_trimmed[start..end].to_string()
                    } else if let Some(idx) = m_trimmed.find("token=") {
                        let start = idx + 6;
                        let end = m_trimmed[start..].find('&').map(|i| i + start).unwrap_or(m_trimmed.len());
                        m_trimmed[start..end].to_string()
                    } else {
                        m_trimmed.to_string()
                    };

                    if raw_token.is_empty() {
                        Err("Empty token provided".into())
                    } else {
                        Ok(raw_token)
                    }
                }
                _ => Err("Failed to read from stdin".into()),
            }
        }
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let subscriber = FmtSubscriber::builder()
        .with_max_level(Level::INFO)
        .finish();
    tracing::subscriber::set_global_default(subscriber).unwrap();

    info!("Starting Twitch Adapter Module...");

    let cockatiel = CockatielClient::connect("twitch_adapter")
        .position("input")
        .connect()
        .await?;

    let cockatiel_listener = cockatiel.clone();
    tokio::spawn(async move {
        if let Err(e) = cockatiel_listener
            .receive(|container| match container.r#type.as_str() {
                "send" => {
                    info!("received send message from engine: {:?}", container);
                }
                "engine_message" => {
                    info!("received engine message from engine: {:?}", container);
                }
                other => {
                    tracing::trace!("Ignoring engine message of type={}", other);
                }
            })
            .await
        {
            error!("Receiver loop exited with error: {}", e);
        }
    });

    let mut channel = std::env::var("TWITCH_CHANNEL").unwrap_or_default();
    let mut oauth_token = std::env::var("TWITCH_OAUTH_TOKEN").unwrap_or_default();
    let mut username = std::env::var("TWITCH_USERNAME").unwrap_or_default();
    let mut client_id = std::env::var("TWITCH_CLIENT_ID").unwrap_or_default();

    if channel.is_empty() {
        if let Some(saved) = load_adapter_config() {
            if let Some(saved_chan) = saved.channel {
                println!("\n==================================================");
                println!("        Saved Twitch Configuration Found          ");
                println!("==================================================\n");
                let choice = prompt_user(&format!(
                    "    > do you want to connect to existing channel '{}' or connect to a new stream? (y/n): ",
                    saved_chan
                ));
                println!();

                if choice == "y" || choice == "yes" {
                    channel = saved_chan;
                    oauth_token = saved.oauth_token.unwrap_or_default();
                    username = saved.username.unwrap_or_default();
                    client_id = saved.client_id.unwrap_or_default();
                }
            }
        }
    }

    if channel.is_empty() {
        println!("\n==================================================");
        println!("        Twitch Live Chat Configuration Required    ");
        println!("==================================================\n");
        print!("    > paste Twitch channel name or stream link: ");
        io::stdout().flush().unwrap();
        let mut input = String::new();
        io::stdin()
            .read_line(&mut input)
            .expect("Failed to read input");
        println!();

        let trimmed = input.trim();
        if let Some(idx) = trimmed.find("twitch.tv/") {
            channel = trimmed[idx + 10..]
                .split('/')
                .next()
                .unwrap_or("")
                .to_string();
        } else {
            channel = trimmed.to_string();
        }

        if oauth_token.is_empty() {
            println!("\n--------------------------------------------------");
            println!("  Official Twitch Developer Setup Guide:          ");
            println!("   1. Go to https://dev.twitch.tv/console/apps      ");
            println!("   2. Click 'Register Your Application'.            ");
            println!("   3. Settings:                                     ");
            println!("      - Name: tiel-bot (nsfw words are banned)      ");
            println!("      - OAuth Redirect URI: http://localhost:3000   ");
            println!("      - Set the client type to public               ");
            println!("      - Category: Chat Bot                          ");
            println!("   4. Click 'Create' and copy your Client ID.       ");
            println!("--------------------------------------------------\n");
            print!("    > Paste your Twitch Client ID (or press Enter for anonymous read-only): ");
            io::stdout().flush().unwrap();
            let mut client_id_input = String::new();
            io::stdin().read_line(&mut client_id_input).unwrap();
            client_id = client_id_input.trim().to_string();
            println!();

            if !client_id.is_empty() {
                match capture_oauth_token_concurrent(&client_id).await {
                    Ok(raw_token) => {
                        let clean_token = raw_token.strip_prefix("oauth:").unwrap_or(&raw_token);
                        oauth_token = format!("oauth:{}", clean_token);

                        if let Some(fetched_user) = fetch_twitch_username(clean_token).await {
                            info!(
                                "Successfully verified token and retrieved username: {}",
                                fetched_user
                            );
                            username = fetched_user;
                        } else {
                            info!("Could not auto-fetch username via API, falling back to channel name.");
                            username = channel.clone();
                        }
                        info!("Successfully acquired and configured OAuth token!");
                    }
                    Err(e) => {
                        error!("Token capture failed: {}", e);
                    }
                }
            }
        }

        if username.is_empty() {
            username = if oauth_token.is_empty() {
                let unique_id = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .subsec_nanos()
                    % 10000;
                format!("justinfan{}", unique_id)
            } else {
                channel.clone()
            };
        }

        save_adapter_config(&channel, &oauth_token, &username, &client_id);
    }

    let twitch_ws_url = "wss://irc-ws.chat.twitch.tv:443";

    'reconnect: loop {
        info!("Connecting to Twitch IRC WebSocket at {}...", twitch_ws_url);
        let (ws_stream, _) = match connect_async(twitch_ws_url).await {
            Ok(val) => val,
            Err(e) => {
                error!(
                    "Failed to connect to Twitch IRC: {}. Retrying in 5 seconds...",
                    e
                );
                tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                continue 'reconnect;
            }
        };

        let (mut write_ws, mut read_ws) = ws_stream.split();

        let pass = if oauth_token.is_empty() {
            "oauth:123456"
        } else {
            &oauth_token
        };
        let nick = if username.is_empty() {
            "justinfan123"
        } else {
            &username.to_lowercase()
        };

        write_ws
            .send(WsMessage::Text(format!("PASS {}", pass)))
            .await?;
        write_ws
            .send(WsMessage::Text(format!("NICK {}", nick)))
            .await?;
        write_ws
            .send(WsMessage::Text(format!("JOIN #{}", channel.to_lowercase())))
            .await?;
        write_ws
            .send(WsMessage::Text(
                "CAP req :twitch.tv/tags twitch.tv/commands".to_string(),
            ))
            .await?;

        info!(
            "Successfully connected to Twitch channel #{} as nick '{}'!",
            channel, nick
        );

        while let Some(msg_result) = read_ws.next().await {
            match msg_result {
                Ok(WsMessage::Text(text)) => {
                    for line in text.lines() {
                        if line.starts_with("PING") {
                            let _ = write_ws
                                .send(WsMessage::Text("PONG :tmi.twitch.tv".to_string()))
                                .await;
                            continue;
                        }

                        if let Some((author_name, message_text)) = parse_twitch_privmsg(line) {
                            info!("[Twitch Chat] {}: {}", author_name, message_text);

                            let pre_process_msg = MessagePreProcess {
                                platform: "twitch".to_string(),
                                raw_data: line.to_string(),
                                raw_message: message_text,
                            };

                            if let Err(e) = cockatiel
                                .send("incoming_chat", Payload::MessagePreProcess(pre_process_msg))
                                .await
                            {
                                error!("Failed to send chat message to Cockatiel engine: {}", e);
                            }
                        }
                    }
                }
                Ok(WsMessage::Close(_)) => {
                    error!("Twitch IRC WebSocket closed connection.");
                    break;
                }
                Err(e) => {
                    error!("Twitch WebSocket error: {}", e);
                    break;
                }
                _ => {}
            }
        }

        info!("Disconnected from Twitch. Reconnecting in 5 seconds...");
        tokio::time::sleep(std::time::Duration::from_secs(5)).await;
    }
}
