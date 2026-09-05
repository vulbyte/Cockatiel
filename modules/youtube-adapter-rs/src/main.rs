use lib_cockatiel::{container::Payload, CockatielClient, MessagePreProcess};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::io::{self, Write};
use std::path::PathBuf;
use tonic::transport::ClientTlsConfig;
use tracing::{error, info, Level};
use tracing_subscriber::FmtSubscriber;

#[derive(Debug, Serialize, Deserialize, Clone)]
struct YoutubeAdapterConfig {
    channel_id: Option<String>,
    api_key: Option<String>,
}

#[derive(Debug, Clone)]
struct StreamInfo {
    video_id: String,
    title: String,
    status: String, // "live" or "upcoming"
    published_at: String,
}

fn load_adapter_config() -> Option<YoutubeAdapterConfig> {
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

fn save_adapter_config(channel_id: &str, api_key: &str) {
    let path = PathBuf::from("config.json");
    if let Ok(data) = std::fs::read_to_string(&path) {
        if let Ok(mut json_val) = serde_json::from_str::<serde_json::Value>(&data) {
            let spec = json!({
                "channel_id": channel_id,
                "api_key": api_key
            });
            json_val["module_specific"] = spec;
            if let Ok(pretty) = serde_json::to_string_pretty(&json_val) {
                let _ = std::fs::write(&path, pretty);
                info!("Successfully saved YouTube configuration to config.json");
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

/// Resolves a handle (e.g., @vulbyte) or channel ID into an exact YouTube Channel ID
async fn get_channel_id(
    client: &reqwest::Client,
    input: &str,
    api_key: &str,
) -> Result<String, Box<dyn std::error::Error>> {
    let clean_input = input.trim();
    if clean_input.starts_with("UC") && clean_input.len() == 24 {
        return Ok(clean_input.to_string());
    }
    let handle = clean_input.strip_prefix('@').unwrap_or(clean_input);
    let url = format!(
        "https://www.googleapis.com/youtube/v3/channels?part=id&forHandle={}&key={}",
        handle, api_key
    );
    let res = client
        .get(&url)
        .send()
        .await?
        .json::<serde_json::Value>()
        .await?;
    if let Some(items) = res.get("items").and_then(|i| i.as_array()) {
        if let Some(first) = items.first() {
            if let Some(id) = first.get("id").and_then(|i| i.as_str()) {
                return Ok(id.to_string());
            }
        }
    }
    Ok(clean_input.to_string())
}

async fn fetch_streams(
    client: &reqwest::Client,
    channel_id: &str,
    api_key: &str,
) -> Result<Vec<StreamInfo>, Box<dyn std::error::Error>> {
    let mut all_streams = Vec::new();
    let event_types = vec!["live", "upcoming"];

    for event_type in event_types {
        let url = format!(
            "https://www.googleapis.com/youtube/v3/search?part=snippet&channelId={}&eventType={}&type=video&key={}",
            channel_id, event_type, api_key
        );

        match client.get(&url).send().await {
            Ok(res) => {
                if let Ok(json) = res.json::<serde_json::Value>().await {
                    if let Some(items) = json.get("items").and_then(|i| i.as_array()) {
                        for item in items {
                            if let Some(id_obj) = item.get("id") {
                                if let Some(video_id) =
                                    id_obj.get("videoId").and_then(|v| v.as_str())
                                {
                                    if let Some(snippet) = item.get("snippet") {
                                        let title = snippet
                                            .get("title")
                                            .and_then(|t| t.as_str())
                                            .unwrap_or("Untitled Stream")
                                            .to_string();

                                        let published_at = snippet
                                            .get("publishedAt")
                                            .and_then(|p| p.as_str())
                                            .unwrap_or("")
                                            .to_string();

                                        let status = event_type.to_string();

                                        // Avoid duplicates if a stream overlaps
                                        if !all_streams
                                            .iter()
                                            .any(|s: &StreamInfo| s.video_id == video_id)
                                        {
                                            all_streams.push(StreamInfo {
                                                video_id: video_id.to_string(),
                                                title,
                                                status,
                                                published_at,
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            Err(e) => {
                error!("Failed to fetch {} streams: {}", event_type, e);
            }
        }
    }

    Ok(all_streams)
}

/// Prompts user to select a stream with a 30-second timeout fallback
async fn select_stream(streams: &[StreamInfo]) -> Option<StreamInfo> {
    if streams.is_empty() {
        return None;
    }

    println!("\n==================================================");
    println!("        Available YouTube Streams                 ");
    println!("==================================================\n");
    for (i, stream) in streams.iter().enumerate() {
        let tag = if stream.status == "live" {
            "[LIVE]"
        } else {
            "[UPCOMING]"
        };
        println!(
            "    [{}] {} {} (ID: {})",
            i + 1,
            tag,
            stream.title,
            stream.video_id
        );
    }
    println!("\n    > You have 30 seconds to select a stream number.");
    println!("    > If no selection is made, the newest LIVE stream will be auto-selected.\n");
    print!("    > Select stream [1-{}]: ", streams.len());
    io::stdout().flush().unwrap();

    let stdin_future = tokio::task::spawn_blocking(|| {
        let mut input = String::new();
        if io::stdin().read_line(&mut input).is_ok() {
            Some(input.trim().to_string())
        } else {
            None
        }
    });

    let selected_idx =
        match tokio::time::timeout(tokio::time::Duration::from_secs(30), stdin_future).await {
            Ok(Ok(Some(input))) if !input.is_empty() => {
                input.parse::<usize>().ok().and_then(|num| {
                    if num > 0 && num <= streams.len() {
                        Some(num - 1)
                    } else {
                        None
                    }
                })
            }
            _ => {
                println!("\n    [Timeout]: No selection made within 30 seconds. Auto-selecting...");
                None
            }
        };

    if let Some(idx) = selected_idx {
        Some(streams[idx].clone())
    } else {
        // Fallback: pick newest live stream, or newest upcoming if none are live
        let mut live: Vec<&StreamInfo> = streams.iter().filter(|s| s.status == "live").collect();
        if !live.is_empty() {
            live.sort_by(|a, b| b.published_at.cmp(&a.published_at));
            println!("    > Auto-selected live stream: {}", live[0].title);
            return Some(live[0].clone());
        }

        let mut upcoming: Vec<&StreamInfo> =
            streams.iter().filter(|s| s.status == "upcoming").collect();
        if !upcoming.is_empty() {
            upcoming.sort_by(|a, b| b.published_at.cmp(&a.published_at));
            println!("    > Auto-selected upcoming stream: {}", upcoming[0].title);
            return Some(upcoming[0].clone());
        }

        Some(streams[0].clone())
    }
}

/// Polls live chat for the selected stream until it ends
async fn monitor_stream_chat(
    cockatiel: &CockatielClient,
    client: &reqwest::Client,
    video_id: &str,
    api_key: &str,
) {
    let video_url = format!(
        "https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails,status&id={}&key={}",
        video_id, api_key
    );

    let mut attempts = 0;
    let chat_id = loop {
        attempts += 1;
        if attempts > 6 {
            info!("Live chat failed to open or stream has concluded. Returning to stream discovery...");
            return;
        }

        match client.get(&video_url).send().await {
            Ok(res) => {
                if let Ok(json) = res.json::<serde_json::Value>().await {
                    if let Some(items) = json.get("items").and_then(|i| i.as_array()) {
                        if let Some(item) = items.first() {
                            if let Some(status) = item
                                .get("status")
                                .and_then(|s| s.get("uploadStatus"))
                                .and_then(|u| u.as_str())
                            {
                                if status == "processed"
                                    || status == "deleted"
                                    || status == "rejected"
                                {
                                    info!("Stream has ended.");
                                    return;
                                }
                            }
                            if let Some(details) = item.get("liveStreamingDetails") {
                                if let Some(id) =
                                    details.get("activeLiveChatId").and_then(|c| c.as_str())
                                {
                                    break id.to_string();
                                }
                                if details.get("actualEndTime").is_some() {
                                    info!("Stream has concluded.");
                                    return;
                                }
                            }
                        }
                    }
                }
            }
            Err(e) => {
                error!("Error checking video status: {}", e);
            }
        }
        info!("Waiting for live chat to start for video {}...", video_id);
        tokio::time::sleep(tokio::time::Duration::from_secs(10)).await;
    };

    info!(
        "Connected to live chat ID: {}. Polling messages...",
        chat_id
    );
    let mut next_page_token: Option<String> = None;

    loop {
        let mut chat_url = format!(
            "https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId={}&part=snippet,authorDetails&key={}",
            chat_id, api_key
        );
        if let Some(ref token) = next_page_token {
            chat_url.push_str(&format!("&pageToken={}", token));
        }

        match client.get(&chat_url).send().await {
            Ok(res) => {
                let status = res.status();

                if let Ok(json) = res.json::<serde_json::Value>().await {
                    if status == reqwest::StatusCode::NOT_FOUND {
                        info!("Live chat closed (Not found).");
                        break;
                    }

                    if status == reqwest::StatusCode::FORBIDDEN {
                        let is_ended = json
                            .get("error")
                            .and_then(|e| e.get("errors"))
                            .and_then(|e| e.as_array())
                            .map_or(false, |errors| {
                                errors.iter().any(|err| {
                                    let reason =
                                        err.get("reason").and_then(|r| r.as_str()).unwrap_or("");
                                    reason == "liveChatEnded" || reason == "liveChatDisabled"
                                })
                            });

                        if is_ended {
                            info!("Live chat closed (Stream ended).");
                            break;
                        } else {
                            tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
                            continue;
                        }
                    }

                    let interval = json
                        .get("pollingIntervalMillis")
                        .and_then(|v| v.as_u64())
                        .unwrap_or(5000);

                    if let Some(new_token) = json.get("nextPageToken").and_then(|v| v.as_str()) {
                        next_page_token = Some(new_token.to_string());
                    }

                    if let Some(items) = json.get("items").and_then(|i| i.as_array()) {
                        for item in items {
                            let author = item
                                .get("authorDetails")
                                .and_then(|a| a.get("displayName"))
                                .and_then(|d| d.as_str())
                                .unwrap_or("Unknown");

                            let msg = item
                                .get("snippet")
                                .and_then(|s| {
                                    s.get("displayMessage").or_else(|| {
                                        s.get("textMessageDetails")
                                            .and_then(|t| t.get("messageText"))
                                    })
                                })
                                .and_then(|m| m.as_str())
                                .unwrap_or("");

                            if !msg.is_empty() {
                                info!("[YouTube Chat] {}: {}", author, msg);
                                let pre_process = MessagePreProcess {
                                    platform: "youtube".to_string(),
                                    raw_data: item.to_string(),
                                    raw_message: msg.to_string(),
                                };
                                if let Err(e) = cockatiel
                                    .send("incoming_chat", Payload::MessagePreProcess(pre_process))
                                    .await
                                {
                                    error!("Failed to send message to engine: {}", e);
                                }
                            }
                        }
                    }

                    tokio::time::sleep(tokio::time::Duration::from_millis(interval)).await;
                } else {
                    if status == reqwest::StatusCode::FORBIDDEN
                        || status == reqwest::StatusCode::NOT_FOUND
                    {
                        info!("Live chat closed (Stream ended / Unparseable response).");
                        break;
                    }
                    tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
                }
            }
            Err(e) => {
                error!("Error polling chat: {}. Retrying...", e);
                tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
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

    info!("Starting YouTube Adapter Module...");

    let cockatiel = CockatielClient::connect("youtube_adapter")
        .position("input")
        .connect()
        .await?;

    let cockatiel_listener = cockatiel.clone();
    tokio::spawn(async move {
        if let Err(e) = cockatiel_listener
            .receive(|container| match container.r#type.as_str() {
                "send" => info!("Received send: {:?}", container),
                "engine_message" => info!("Received engine message: {:?}", container),
                other => tracing::trace!("Ignoring type={}", other),
            })
            .await
        {
            error!("Receiver error: {}", e);
        }
    });

    let mut channel_input = std::env::var("YOUTUBE_CHANNEL_ID").unwrap_or_default();
    let mut api_key = std::env::var("YOUTUBE_API_KEY").unwrap_or_default();

    if channel_input.is_empty() {
        if let Some(saved) = load_adapter_config() {
            if let Some(saved_chan) = saved.channel_id {
                println!("\n==================================================");
                println!("        Saved YouTube Configuration Found          ");
                println!("==================================================\n");
                let choice = prompt_user(&format!(
                    "    > Use existing channel ID/handle '{}'? (y/n): ",
                    saved_chan
                ));
                if choice.to_lowercase() == "y" || choice.to_lowercase() == "yes" {
                    channel_input = saved_chan;
                    api_key = saved.api_key.unwrap_or_default();
                }
            }
        }
    }

    if channel_input.is_empty() {
        println!("\n==================================================");
        println!("   YouTube Live Chat Configuration Required    ");
        println!("==================================================\n");
        channel_input = prompt_user("    > Enter YouTube Channel ID or Handle (e.g. @vulbyte): ");
        api_key = prompt_user("    > Enter YouTube Data API Key: ");
        println!();
        save_adapter_config(&channel_input, &api_key);
    }

    let client = reqwest::Client::new();
    let channel_id = get_channel_id(&client, &channel_input, &api_key)
        .await
        .unwrap_or(channel_input);

    // Initialize gRPC transport layer connection
    let _channel = tonic::transport::Channel::from_static("https://youtube.googleapis.com")
        .tls_config(ClientTlsConfig::new())?
        .connect()
        .await?;

    info!("Successfully connected to YouTube gRPC transport layer!");

    // Seamless loop: when a stream ends or disconnects, it automatically loops back to discover new streams
    loop {
        info!(
            "Scanning for active and scheduled streams for channel ID: {}",
            channel_id
        );
        let streams = match fetch_streams(&client, &channel_id, &api_key).await {
            Ok(s) => s,
            Err(e) => {
                error!("Failed to fetch streams: {}. Retrying in 15 seconds...", e);
                tokio::time::sleep(tokio::time::Duration::from_secs(15)).await;
                continue;
            }
        };

        let chosen_stream = match select_stream(&streams).await {
            Some(s) => s,
            None => {
                info!("No streams currently found. Re-scanning in 30 seconds...");
                tokio::time::sleep(tokio::time::Duration::from_secs(30)).await;
                continue;
            }
        };

        info!(
            "Selected stream: {} ({})",
            chosen_stream.title, chosen_stream.video_id
        );

        // Monitor stream live chat until the stream ends
        monitor_stream_chat(&cockatiel, &client, &chosen_stream.video_id, &api_key).await;

        info!("Stream finished. Restarting discovery loop for seamless transition...");
    }
}
