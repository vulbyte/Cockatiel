use lib_cockatiel::{container::Payload, CockatielClient, MessagePreProcess};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::io::{self, Write};
use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use tonic::transport::ClientTlsConfig;
use tracing::{error, info, warn, Level};
use tracing_subscriber::FmtSubscriber;

#[derive(Debug, Serialize, Deserialize, Clone)]
struct YoutubeAdapterConfig {
    channel_id: Option<String>,
    api_key: Option<String>,
    #[serde(default)]
    api_keys: Option<Vec<String>>,
    #[serde(default)]
    unlisted_video_ids: Option<Vec<String>>,
}

#[derive(Debug, Clone)]
struct StreamInfo {
    video_id: String,
    title: String,
    status: String, // "live" or "upcoming"
    published_at: String,
}

#[derive(Debug, Clone)]
struct ApiKeyManager {
    keys: Vec<String>,
    current_idx: Arc<AtomicUsize>,
}

impl ApiKeyManager {
    fn new(keys: Vec<String>) -> Self {
        Self {
            keys,
            current_idx: Arc::new(AtomicUsize::new(0)),
        }
    }

    fn current_key(&self) -> String {
        if self.keys.is_empty() {
            return String::new();
        }
        let idx = self.current_idx.load(Ordering::Relaxed) % self.keys.len();
        self.keys[idx].clone()
    }

    fn rotate_to_next(&self) -> String {
        if self.keys.is_empty() {
            return String::new();
        }
        let prev_idx = self.current_idx.load(Ordering::Relaxed) % self.keys.len();
        let next = self.current_idx.fetch_add(1, Ordering::SeqCst) + 1;
        let new_idx = next % self.keys.len();
        let key_snippet = self.keys[new_idx].chars().take(8).collect::<String>();
        warn!(
            "YouTube API key {} hit quota or limit. Rotating to key {} of {} (key: {}...)",
            prev_idx + 1,
            new_idx + 1,
            self.keys.len(),
            key_snippet
        );
        self.keys[new_idx].clone()
    }

    fn key_count(&self) -> usize {
        self.keys.len()
    }

    fn get_all_keys(&self) -> &[String] {
        &self.keys
    }

    fn is_quota_error(json: &serde_json::Value) -> bool {
        if let Some(err) = json.get("error") {
            if let Some(errors) = err.get("errors").and_then(|e| e.as_array()) {
                for e in errors {
                    let reason = e.get("reason").and_then(|r| r.as_str()).unwrap_or("");
                    let domain = e.get("domain").and_then(|d| d.as_str()).unwrap_or("");
                    if reason == "quotaExceeded"
                        || reason == "rateLimitExceeded"
                        || reason == "dailyLimitExceeded"
                        || domain == "youtube.quota"
                    {
                        return true;
                    }
                }
            }
            if let Some(msg) = err.get("message").and_then(|m| m.as_str()) {
                let lower = msg.to_lowercase();
                if lower.contains("quota") || lower.contains("exceeded") {
                    return true;
                }
            }
        }
        false
    }
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

fn save_adapter_config(channel_id: &str, api_keys: &[String], unlisted_ids: &[String]) {
    let path = PathBuf::from("config.json");
    let mut json_val = if let Ok(data) = std::fs::read_to_string(&path) {
        serde_json::from_str::<serde_json::Value>(&data).unwrap_or_else(|_| json!({}))
    } else {
        json!({})
    };

    let mut spec = json!({
        "channel_id": channel_id,
        "api_key": api_keys.first().cloned().unwrap_or_default(),
        "api_keys": api_keys,
    });
    if !unlisted_ids.is_empty() {
        spec["unlisted_video_ids"] = json!(unlisted_ids);
    }
    json_val["module_specific"] = spec;
    if let Ok(pretty) = serde_json::to_string_pretty(&json_val) {
        let _ = std::fs::write(&path, pretty);
        info!("Successfully saved YouTube configuration to config.json");
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

fn prompt_api_keys() -> Vec<String> {
    let mut keys = Vec::new();
    println!("\n  API Keys: Enter up to 5 YouTube Data API Keys for automatic quota rotation.");
    loop {
        let key = prompt_user("    > Enter YouTube Data API Key 1 (required): ");
        if !key.is_empty() {
            keys.push(key);
            break;
        }
        println!("    [Error]: Key 1 is required. Please provide a valid YouTube Data API Key.");
    }

    for i in 2..=5 {
        let key = prompt_user(&format!(
            "    > Enter YouTube Data API Key {} (optional, press Enter to finish): ",
            i
        ));
        if key.is_empty() {
            break;
        }
        if !keys.contains(&key) {
            keys.push(key);
        }
    }
    keys
}

/// Extracts an 11-character YouTube video ID from a raw ID or standard YouTube URL format
fn extract_video_id(input: &str) -> Option<String> {
    let s = input.trim();
    if s.is_empty() {
        return None;
    }

    // Direct 11-character video ID (YouTube video IDs are 11 chars: [a-zA-Z0-9_-])
    // Channel IDs are 24 chars starting with UC, so they will not match this.
    if s.len() == 11 && s.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_') {
        return Some(s.to_string());
    }

    // URL with query parameter: https://www.youtube.com/watch?v=VIDEO_ID...
    if let Some(pos) = s.find("v=") {
        let after_v = &s[pos + 2..];
        let id: String = after_v
            .chars()
            .take_while(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
            .collect();
        if id.len() == 11 {
            return Some(id);
        }
    }

    // Shortened URL: https://youtu.be/VIDEO_ID...
    if let Some(pos) = s.find("youtu.be/") {
        let after = &s[pos + 9..];
        let id: String = after
            .chars()
            .take_while(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
            .collect();
        if id.len() == 11 {
            return Some(id);
        }
    }

    // Live URL: https://www.youtube.com/live/VIDEO_ID...
    if let Some(pos) = s.find("/live/") {
        let after = &s[pos + 6..];
        let id: String = after
            .chars()
            .take_while(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
            .collect();
        if id.len() == 11 {
            return Some(id);
        }
    }

    // Shorts URL: https://www.youtube.com/shorts/VIDEO_ID...
    if let Some(pos) = s.find("/shorts/") {
        let after = &s[pos + 8..];
        let id: String = after
            .chars()
            .take_while(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
            .collect();
        if id.len() == 11 {
            return Some(id);
        }
    }

    None
}

/// Fetches stream metadata directly by video ID via the YouTube Data API v3 videos endpoint.
/// Works for both public and unlisted streams with automatic key rotation on quota exceeded.
async fn fetch_video_stream(
    client: &reqwest::Client,
    video_id: &str,
    keys: &ApiKeyManager,
) -> Result<Option<StreamInfo>, Box<dyn std::error::Error>> {
    let max_attempts = keys.key_count().max(1);

    for attempt in 0..max_attempts {
        let api_key = keys.current_key();
        let url = format!(
            "https://www.googleapis.com/youtube/v3/videos?part=snippet,liveStreamingDetails,status&id={}&key={}",
            video_id, api_key
        );

        let res = client.get(&url).send().await?;
        let json = res.json::<serde_json::Value>().await?;

        if ApiKeyManager::is_quota_error(&json) {
            warn!(
                "YouTube API quota exceeded for key {} while fetching video {}.",
                attempt + 1,
                video_id
            );
            if attempt + 1 < max_attempts {
                keys.rotate_to_next();
                continue;
            } else {
                error!(
                    "All {} configured YouTube API keys have exceeded their quota!",
                    keys.key_count()
                );
                return Ok(None);
            }
        }

        if let Some(err) = json.get("error") {
            if let Some(msg) = err.get("message").and_then(|m| m.as_str()) {
                error!("YouTube API error fetching video {}: {}", video_id, msg);
            }
            return Ok(None);
        }

        if let Some(items) = json.get("items").and_then(|i| i.as_array()) {
            if let Some(item) = items.first() {
                let title = item
                    .get("snippet")
                    .and_then(|s| s.get("title"))
                    .and_then(|t| t.as_str())
                    .unwrap_or("Untitled Stream")
                    .to_string();

                let published_at = item
                    .get("snippet")
                    .and_then(|s| s.get("publishedAt"))
                    .and_then(|p| p.as_str())
                    .unwrap_or("")
                    .to_string();

                let broadcast_content = item
                    .get("snippet")
                    .and_then(|s| s.get("liveBroadcastContent"))
                    .and_then(|b| b.as_str())
                    .unwrap_or("");

                let details = item.get("liveStreamingDetails");
                let is_ended = details
                    .and_then(|l| l.get("actualEndTime"))
                    .is_some();

                if is_ended {
                    info!("Stream {} has already ended.", video_id);
                    return Ok(None);
                }

                let status = if broadcast_content == "live" {
                    "live".to_string()
                } else if broadcast_content == "upcoming" || details.is_some() {
                    "upcoming".to_string()
                } else {
                    "live".to_string()
                };

                return Ok(Some(StreamInfo {
                    video_id: video_id.to_string(),
                    title,
                    status,
                    published_at,
                }));
            }
        }
        break;
    }

    Ok(None)
}

/// Resolves a handle (e.g., @vulbyte or vulbyte), channel URL, or channel ID into an exact YouTube Channel ID (UC...)
async fn get_channel_id(
    client: &reqwest::Client,
    input: &str,
    keys: &ApiKeyManager,
) -> Result<String, Box<dyn std::error::Error>> {
    let mut clean_input = input.trim();

    // If it's a URL like https://www.youtube.com/channel/UC..., extract the channel ID
    if let Some(pos) = clean_input.find("/channel/") {
        let after = &clean_input[pos + 9..];
        let cid: String = after
            .chars()
            .take_while(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
            .collect();
        if cid.starts_with("UC") && cid.len() == 24 {
            return Ok(cid);
        }
    }

    // If it's a URL like https://www.youtube.com/@vulbyte, extract the handle
    if let Some(pos) = clean_input.find("/@") {
        clean_input = &clean_input[pos + 1..];
    }

    if clean_input.starts_with("UC") && clean_input.len() == 24 {
        return Ok(clean_input.to_string());
    }

    let raw_handle = clean_input.strip_prefix('@').unwrap_or(clean_input);

    let max_rotations = keys.key_count().max(1);

    for _ in 0..max_rotations {
        let api_key = keys.current_key();

        // 1. Try YouTube Data API v3 channels.list with forHandle using URL-encoded %40 (official handle requirement)
        let encoded_handle = format!("%40{}", raw_handle);
        let url_with_at = format!(
            "https://www.googleapis.com/youtube/v3/channels?part=id&forHandle={}&key={}",
            encoded_handle, api_key
        );

        if let Ok(res) = client.get(&url_with_at).send().await {
            if let Ok(json) = res.json::<serde_json::Value>().await {
                if ApiKeyManager::is_quota_error(&json) {
                    warn!("API key quota exceeded resolving handle with @. Rotating key...");
                    keys.rotate_to_next();
                    continue;
                }
                if let Some(items) = json.get("items").and_then(|i| i.as_array()) {
                    if let Some(first) = items.first() {
                        if let Some(id) = first.get("id").and_then(|i| i.as_str()) {
                            info!("Resolved handle '@{}' to Channel ID: {}", raw_handle, id);
                            return Ok(id.to_string());
                        }
                    }
                }
            }
        }

        // 2. Try YouTube Data API v3 channels.list with forHandle without @
        let url_without_at = format!(
            "https://www.googleapis.com/youtube/v3/channels?part=id&forHandle={}&key={}",
            raw_handle, api_key
        );
        if let Ok(res) = client.get(&url_without_at).send().await {
            if let Ok(json) = res.json::<serde_json::Value>().await {
                if ApiKeyManager::is_quota_error(&json) {
                    warn!("API key quota exceeded resolving handle without @. Rotating key...");
                    keys.rotate_to_next();
                    continue;
                }
                if let Some(items) = json.get("items").and_then(|i| i.as_array()) {
                    if let Some(first) = items.first() {
                        if let Some(id) = first.get("id").and_then(|i| i.as_str()) {
                            info!("Resolved handle '{}' to Channel ID: {}", raw_handle, id);
                            return Ok(id.to_string());
                        }
                    }
                }
            }
        }

        // 3. Try legacy forUsername
        let url_username = format!(
            "https://www.googleapis.com/youtube/v3/channels?part=id&forUsername={}&key={}",
            raw_handle, api_key
        );
        if let Ok(res) = client.get(&url_username).send().await {
            if let Ok(json) = res.json::<serde_json::Value>().await {
                if ApiKeyManager::is_quota_error(&json) {
                    warn!("API key quota exceeded resolving legacy username. Rotating key...");
                    keys.rotate_to_next();
                    continue;
                }
                if let Some(items) = json.get("items").and_then(|i| i.as_array()) {
                    if let Some(first) = items.first() {
                        if let Some(id) = first.get("id").and_then(|i| i.as_str()) {
                            info!("Resolved username '{}' to Channel ID: {}", raw_handle, id);
                            return Ok(id.to_string());
                        }
                    }
                }
            }
        }
        break;
    }

    // 4. Fallback: Fetch public channel page and extract channel ID directly from HTML metadata
    info!(
        "Attempting web fallback to resolve Channel ID for '@{}'...",
        raw_handle
    );
    let page_url = format!("https://www.youtube.com/@{}", raw_handle);
    if let Ok(res) = client
        .get(&page_url)
        .header(
            "User-Agent",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        )
        .send()
        .await
    {
        if let Ok(html) = res.text().await {
            if let Some(pos) = html.find("itemprop=\"identifier\" content=\"UC") {
                let id = &html[pos + 31..pos + 55];
                if id.starts_with("UC") && id.len() == 24 {
                    info!(
                        "Successfully resolved '@{}' to Channel ID {} via channel page metadata!",
                        raw_handle, id
                    );
                    return Ok(id.to_string());
                }
            }
            if let Some(pos) = html.find("\"channelId\":\"UC") {
                let id = &html[pos + 13..pos + 37];
                if id.starts_with("UC") && id.len() == 24 {
                    info!(
                        "Successfully resolved '@{}' to Channel ID {} via channel page data!",
                        raw_handle, id
                    );
                    return Ok(id.to_string());
                }
            }
            if let Some(pos) = html.find("youtube.com/channel/UC") {
                let id = &html[pos + 20..pos + 44];
                if id.starts_with("UC") && id.len() == 24 {
                    info!(
                        "Successfully resolved '@{}' to Channel ID {} via channel link!",
                        raw_handle, id
                    );
                    return Ok(id.to_string());
                }
            }
        }
    }

    Err(format!(
        "Failed to resolve channel handle/ID '{}'. YouTube requires a 24-character Channel ID starting with 'UC'. Please enter your exact Channel ID (from YouTube Studio -> Customization -> Basic Info) or handle.",
        clean_input
    ).into())
}

fn extract_streams_from_json(val: &serde_json::Value, out: &mut Vec<StreamInfo>) {
    match val {
        serde_json::Value::Object(map) => {
            if let Some(content_id) = map.get("contentId").and_then(|c| c.as_str()) {
                if content_id.len() == 11 {
                    let text_dump = serde_json::to_string(val).unwrap_or_default();
                    let is_live = text_dump.contains("\"LIVE\"");
                    let is_upcoming = text_dump.contains("\"Upcoming\"")
                        || text_dump.contains("scheduledStartTime");

                    if is_live || is_upcoming {
                        let title = map
                            .get("rendererContext")
                            .and_then(|r| r.get("accessibilityContext"))
                            .and_then(|a| a.get("label"))
                            .and_then(|l| l.as_str())
                            .or_else(|| {
                                map.get("metadata")
                                    .and_then(|m| m.get("lockupMetadataViewModel"))
                                    .and_then(|l| l.get("title"))
                                    .and_then(|t| t.get("content"))
                                    .and_then(|c| c.as_str())
                            })
                            .unwrap_or("Untitled Stream")
                            .to_string();

                        let status = if is_live { "live" } else { "upcoming" }.to_string();
                        if !out.iter().any(|s| s.video_id == content_id) {
                            out.push(StreamInfo {
                                video_id: content_id.to_string(),
                                title,
                                status,
                                published_at: "".to_string(),
                            });
                        }
                    }
                }
            }

            if let Some(video_id) = map.get("videoId").and_then(|v| v.as_str()) {
                if video_id.len() == 11 {
                    let text_dump = serde_json::to_string(val).unwrap_or_default();
                    let is_live = text_dump.contains("\"LIVE\"")
                        || text_dump.contains("BADGE_STYLE_TYPE_LIVE_NOW");
                    let is_upcoming = text_dump.contains("\"Upcoming\"")
                        || text_dump.contains("UPCOMING")
                        || text_dump.contains("upcomingEventData");

                    if is_live || is_upcoming {
                        let title = map
                            .get("title")
                            .and_then(|t| t.get("runs"))
                            .and_then(|r| r.as_array())
                            .and_then(|arr| arr.first())
                            .and_then(|f| f.get("text"))
                            .and_then(|t| t.as_str())
                            .unwrap_or("Untitled Stream")
                            .to_string();

                        let status = if is_live { "live" } else { "upcoming" }.to_string();
                        if !out.iter().any(|s| s.video_id == video_id) {
                            out.push(StreamInfo {
                                video_id: video_id.to_string(),
                                title,
                                status,
                                published_at: "".to_string(),
                            });
                        }
                    }
                }
            }

            for v in map.values() {
                extract_streams_from_json(v, out);
            }
        }
        serde_json::Value::Array(arr) => {
            for v in arr {
                extract_streams_from_json(v, out);
            }
        }
        _ => {}
    }
}

/// Fallback to scraping the public channel streams page to find scheduled public streams
/// that have not yet been indexed by YouTube's Search API.
async fn fetch_channel_streams_web(
    client: &reqwest::Client,
    channel_id: &str,
) -> Vec<StreamInfo> {
    let mut streams = Vec::new();
    let url = format!("https://www.youtube.com/channel/{}/streams", channel_id);

    let res = match client
        .get(&url)
        .header(
            "User-Agent",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        )
        .send()
        .await
    {
        Ok(r) => r,
        Err(_) => return streams,
    };

    let html = match res.text().await {
        Ok(t) => t,
        Err(_) => return streams,
    };

    let marker = "var ytInitialData = ";
    if let Some(start) = html.find(marker) {
        let json_str = &html[start + marker.len()..];
        if let Some(end) = json_str.find(";</script>") {
            if let Ok(data) = serde_json::from_str::<serde_json::Value>(&json_str[..end]) {
                extract_streams_from_json(&data, &mut streams);
            }
        }
    }

    streams
}

async fn fetch_streams(
    client: &reqwest::Client,
    channel_id: &str,
    keys: &ApiKeyManager,
    unlisted_video_ids: &[String],
) -> Result<Vec<StreamInfo>, Box<dyn std::error::Error>> {
    let mut all_streams = Vec::new();

    // 1. Fetch any configured unlisted/direct stream IDs first
    for vid in unlisted_video_ids {
        match fetch_video_stream(client, vid, keys).await {
            Ok(Some(info)) => {
                if !all_streams.iter().any(|s: &StreamInfo| s.video_id == info.video_id) {
                    all_streams.push(info);
                }
            }
            Ok(None) => {}
            Err(e) => {
                error!("Failed to fetch stream {}: {}", vid, e);
            }
        }
    }

    // 2. Query YouTube Data API v3 Search endpoint for live and upcoming streams
    if !channel_id.is_empty() {
        let event_types = vec!["live", "upcoming"];

        for event_type in event_types {
            let max_key_rotations = keys.key_count().max(1);
            for _ in 0..max_key_rotations {
                let api_key = keys.current_key();
                let url = format!(
                    "https://www.googleapis.com/youtube/v3/search?part=snippet&channelId={}&eventType={}&type=video&key={}",
                    channel_id, event_type, api_key
                );

                match client.get(&url).send().await {
                    Ok(res) => {
                        if let Ok(json) = res.json::<serde_json::Value>().await {
                            if ApiKeyManager::is_quota_error(&json) {
                                warn!(
                                    "YouTube Search API quota exceeded for eventType={}. Rotating API key...",
                                    event_type
                                );
                                keys.rotate_to_next();
                                continue;
                            }
                            if let Some(err) = json.get("error") {
                                if let Some(msg) = err.get("message").and_then(|m| m.as_str()) {
                                    error!(
                                        "YouTube Search API error ({}) for channel {}: {}",
                                        event_type, channel_id, msg
                                    );
                                }
                            }
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
                        error!("Failed to fetch {} streams via Search API: {}", event_type, e);
                    }
                }
                break;
            }
        }

        // 3. Supplemental web discovery for public scheduled/live streams on the channel page
        let web_streams = fetch_channel_streams_web(client, channel_id).await;
        for ws in web_streams {
            if !all_streams.iter().any(|s: &StreamInfo| s.video_id == ws.video_id) {
                info!(
                    "Discovered stream on channel streams page: {} ({})",
                    ws.title, ws.video_id
                );
                all_streams.push(ws);
            }
        }
    }

    Ok(all_streams)
}

/// Prompts user to select a stream with a 30-second timeout fallback.
/// Also provides guidance and input prompt for unlisted streams.
async fn select_stream(
    streams: &[StreamInfo],
    client: &reqwest::Client,
    keys: &ApiKeyManager,
    unlisted_ids: &mut Vec<String>,
    channel_id: &str,
) -> Option<StreamInfo> {
    if streams.is_empty() {
        println!("\n==================================================");
        println!("        No Streams Currently Found                ");
        println!("==================================================");
        if !channel_id.is_empty() {
            println!("  Channel ID: {}", channel_id);
        }
        println!("  Active Keys: {} API key(s) configured", keys.key_count());
        println!("  NOTE ON YOUTUBE STREAM VISIBILITY:");
        println!("  * Public scheduled streams may take a moment to appear.");
        println!("  * Unlisted streams CANNOT be found via YouTube Search.");
        println!("    Enter an Unlisted Stream URL or Video ID below to monitor it.");
        println!("  * Private streams CANNOT be accessed with an API key (OAuth 2.0 required).");
        println!("    Please set stream visibility to Unlisted or Public in YouTube Studio.");
        println!("==================================================\n");
        print!("    > Enter Unlisted Video ID or URL (or press Enter to re-scan in 30s): ");
        io::stdout().flush().unwrap();

        let stdin_future = tokio::task::spawn_blocking(|| {
            let mut input = String::new();
            if io::stdin().read_line(&mut input).is_ok() {
                Some(input.trim().to_string())
            } else {
                None
            }
        });

        match tokio::time::timeout(tokio::time::Duration::from_secs(30), stdin_future).await {
            Ok(Ok(Some(input))) if !input.is_empty() => {
                if let Some(vid) = extract_video_id(&input) {
                    info!("Fetching unlisted stream metadata for Video ID: {}", vid);
                    match fetch_video_stream(client, &vid, keys).await {
                        Ok(Some(stream)) => {
                            if !unlisted_ids.contains(&vid) {
                                unlisted_ids.push(vid);
                                save_adapter_config(channel_id, keys.get_all_keys(), unlisted_ids);
                            }
                            return Some(stream);
                        }
                        Ok(None) => {
                            warn!("Video ID {} was not found or is private.", vid);
                        }
                        Err(e) => {
                            error!("Error fetching video {}: {}", vid, e);
                        }
                    }
                } else {
                    warn!("Invalid YouTube Video ID or URL format: {}", input);
                }
            }
            _ => {}
        }

        return None;
    }

    println!("\n==================================================");
    println!("        Available YouTube Streams                 ");
    println!("==================================================");
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
    println!("\n    > Enter a stream number [1-{}].", streams.len());
    println!("    > Or enter 'u' to monitor an Unlisted Stream URL/Video ID.");
    println!("    > If no selection is made, the newest stream will be auto-selected.\n");
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

    let input_res =
        match tokio::time::timeout(tokio::time::Duration::from_secs(30), stdin_future).await {
            Ok(Ok(Some(input))) if !input.is_empty() => Some(input),
            _ => {
                println!("\n    [Timeout]: No selection made within 30 seconds. Auto-selecting...");
                None
            }
        };

    if let Some(user_input) = input_res {
        if user_input.to_lowercase() == "u" {
            let unlisted_input = prompt_user("    > Enter Unlisted Video ID or URL: ");
            if let Some(vid) = extract_video_id(&unlisted_input) {
                info!("Fetching unlisted stream metadata for Video ID: {}", vid);
                match fetch_video_stream(client, &vid, keys).await {
                    Ok(Some(stream)) => {
                        if !unlisted_ids.contains(&vid) {
                            unlisted_ids.push(vid);
                            save_adapter_config(channel_id, keys.get_all_keys(), unlisted_ids);
                        }
                        return Some(stream);
                    }
                    Ok(None) => {
                        warn!("Video ID {} was not found or is private.", vid);
                    }
                    Err(e) => {
                        error!("Error fetching video {}: {}", vid, e);
                    }
                }
            } else {
                warn!("Invalid YouTube Video ID or URL format: {}", unlisted_input);
            }
        } else if let Ok(num) = user_input.parse::<usize>() {
            if num > 0 && num <= streams.len() {
                return Some(streams[num - 1].clone());
            }
        }
    }

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

/// Polls live chat for the selected stream until it ends, with automatic key rotation on quota limits
async fn monitor_stream_chat(
    cockatiel: &CockatielClient,
    client: &reqwest::Client,
    video_id: &str,
    keys: &ApiKeyManager,
) {
    let mut attempts = 0;
    let chat_id = 'found_chat: loop {
        attempts += 1;
        if attempts > 10 {
            info!("Live chat failed to open or stream has concluded. Returning to stream discovery...");
            return;
        }

        let max_key_rotations = keys.key_count().max(1);
        let mut got_response = false;

        for _ in 0..max_key_rotations {
            let api_key = keys.current_key();
            let video_url = format!(
                "https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails,status&id={}&key={}",
                video_id, api_key
            );

            match client.get(&video_url).send().await {
                Ok(res) => {
                    if let Ok(json) = res.json::<serde_json::Value>().await {
                        if ApiKeyManager::is_quota_error(&json) {
                            warn!("API key quota exceeded while checking video status. Rotating API key...");
                            keys.rotate_to_next();
                            continue;
                        }
                        if let Some(err) = json.get("error") {
                            error!("Error checking video status from YouTube API: {:?}", err);
                        }
                        if let Some(items) = json.get("items").and_then(|i| i.as_array()) {
                            if let Some(item) = items.first() {
                                got_response = true;
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
                                        break 'found_chat id.to_string();
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
            break;
        }

        if !got_response {
            info!("Waiting for live chat to start for video {}...", video_id);
        }
        tokio::time::sleep(tokio::time::Duration::from_secs(10)).await;
    };

    info!(
        "Connected to live chat ID: {}. Polling messages...",
        chat_id
    );
    let mut next_page_token: Option<String> = None;

    loop {
        let api_key = keys.current_key();
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
                    if ApiKeyManager::is_quota_error(&json) {
                        warn!("API key quota exceeded while polling live chat messages. Rotating API key...");
                        keys.rotate_to_next();
                        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                        continue;
                    }

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
    let mut api_keys: Vec<String> = Vec::new();
    let mut unlisted_ids: Vec<String> = Vec::new();

    if let Ok(env_key) = std::env::var("YOUTUBE_API_KEY") {
        let trimmed = env_key.trim().to_string();
        if !trimmed.is_empty() {
            api_keys.push(trimmed);
        }
    }

    if channel_input.is_empty() || api_keys.is_empty() {
        if let Some(saved) = load_adapter_config() {
            if let Some(saved_chan) = saved.channel_id {
                let mut saved_keys = Vec::new();
                if let Some(k_list) = saved.api_keys {
                    for k in k_list {
                        let trimmed = k.trim().to_string();
                        if !trimmed.is_empty() && !saved_keys.contains(&trimmed) {
                            saved_keys.push(trimmed);
                        }
                    }
                }
                if let Some(single) = saved.api_key {
                    let trimmed = single.trim().to_string();
                    if !trimmed.is_empty() && !saved_keys.contains(&trimmed) {
                        saved_keys.push(trimmed);
                    }
                }

                if !saved_keys.is_empty() {
                    println!("\n==================================================");
                    println!("        Saved YouTube Configuration Found          ");
                    println!("==================================================\n");
                    let choice = prompt_user(&format!(
                        "    > Use existing channel ID/handle '{}' with {} saved API key(s)? (y/n): ",
                        saved_chan,
                        saved_keys.len()
                    ));
                    if choice.to_lowercase() == "y" || choice.to_lowercase() == "yes" {
                        channel_input = saved_chan;
                        api_keys = saved_keys;
                        if let Some(saved_unlisted) = saved.unlisted_video_ids {
                            unlisted_ids = saved_unlisted;
                        }
                    }
                }
            }
        }
    }

    if channel_input.is_empty() {
        println!("\n==================================================");
        println!("   YouTube Live Chat Configuration Required    ");
        println!("==================================================\n");
        println!("  You can enter a Channel Handle (e.g. @vulbyte), Channel ID (UC...),");
        println!("  or a direct Video ID / Stream URL (for unlisted streams).\n");
        channel_input = prompt_user("    > Enter YouTube Channel Handle, Channel ID, or Stream URL: ");
    }

    if api_keys.is_empty() {
        api_keys = prompt_api_keys();
        println!();
        save_adapter_config(&channel_input, &api_keys, &unlisted_ids);
    }

    let key_manager = ApiKeyManager::new(api_keys.clone());
    info!(
        "Initialized YouTube API Key Manager with {} key(s) for automatic rotation",
        key_manager.key_count()
    );

    let client = reqwest::Client::new();
    let maybe_video_id = extract_video_id(&channel_input);

    let channel_id = if let Some(ref vid) = maybe_video_id {
        info!("Targeting direct video stream ID: {}", vid);
        if !unlisted_ids.contains(vid) {
            unlisted_ids.push(vid.clone());
        }
        "".to_string()
    } else {
        match get_channel_id(&client, &channel_input, &key_manager).await {
            Ok(cid) => {
                if cid != channel_input && cid.starts_with("UC") {
                    save_adapter_config(&cid, &api_keys, &unlisted_ids);
                }
                cid
            }
            Err(e) => {
                error!("{}", e);
                channel_input.clone()
            }
        }
    };

    // Initialize gRPC transport layer connection
    let _channel = tonic::transport::Channel::from_static("https://youtube.googleapis.com")
        .tls_config(ClientTlsConfig::new())?
        .connect()
        .await?;

    info!("Successfully connected to YouTube gRPC transport layer!");

    // Seamless loop: when a stream ends or disconnects, it automatically loops back to discover new streams
    loop {
        let streams = if !channel_id.is_empty() {
            info!(
                "Scanning for active and scheduled streams for channel ID: {}",
                channel_id
            );
            match fetch_streams(&client, &channel_id, &key_manager, &unlisted_ids).await {
                Ok(s) => s,
                Err(e) => {
                    error!("Failed to fetch streams: {}. Retrying in 15 seconds...", e);
                    tokio::time::sleep(tokio::time::Duration::from_secs(15)).await;
                    continue;
                }
            }
        } else {
            let mut s = Vec::new();
            for vid in &unlisted_ids {
                if let Ok(Some(info)) = fetch_video_stream(&client, vid, &key_manager).await {
                    s.push(info);
                }
            }
            s
        };

        let chosen_stream = match select_stream(
            &streams,
            &client,
            &key_manager,
            &mut unlisted_ids,
            &channel_id,
        )
        .await
        {
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
        monitor_stream_chat(&cockatiel, &client, &chosen_stream.video_id, &key_manager).await;

        info!("Stream finished. Restarting discovery loop for seamless transition...");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_video_id() {
        assert_eq!(
            extract_video_id("1a2iSWQzl7I"),
            Some("1a2iSWQzl7I".to_string())
        );
        assert_eq!(
            extract_video_id("https://www.youtube.com/watch?v=1a2iSWQzl7I"),
            Some("1a2iSWQzl7I".to_string())
        );
        assert_eq!(
            extract_video_id("https://www.youtube.com/watch?v=1a2iSWQzl7I&t=10s"),
            Some("1a2iSWQzl7I".to_string())
        );
        assert_eq!(
            extract_video_id("https://youtu.be/1a2iSWQzl7I"),
            Some("1a2iSWQzl7I".to_string())
        );
        assert_eq!(
            extract_video_id("https://www.youtube.com/live/1a2iSWQzl7I"),
            Some("1a2iSWQzl7I".to_string())
        );
        assert_eq!(
            extract_video_id("https://www.youtube.com/shorts/1a2iSWQzl7I"),
            Some("1a2iSWQzl7I".to_string())
        );
        assert_eq!(extract_video_id("@vulbyte"), None);
        assert_eq!(extract_video_id("vulbyte"), None);
        assert_eq!(extract_video_id("UCKZigHbgpJG9ldxXMqmiZUg"), None);
    }

    #[test]
    fn test_api_key_manager_rotation() {
        let keys = vec![
            "KEY_A".to_string(),
            "KEY_B".to_string(),
            "KEY_C".to_string(),
        ];
        let mgr = ApiKeyManager::new(keys);
        assert_eq!(mgr.key_count(), 3);
        assert_eq!(mgr.current_key(), "KEY_A");

        assert_eq!(mgr.rotate_to_next(), "KEY_B");
        assert_eq!(mgr.current_key(), "KEY_B");

        assert_eq!(mgr.rotate_to_next(), "KEY_C");
        assert_eq!(mgr.current_key(), "KEY_C");

        // Wraps around to first key
        assert_eq!(mgr.rotate_to_next(), "KEY_A");
        assert_eq!(mgr.current_key(), "KEY_A");
    }

    #[test]
    fn test_is_quota_error() {
        let quota_err = json!({
            "error": {
                "code": 403,
                "errors": [
                    {
                        "domain": "youtube.quota",
                        "message": "The request cannot be completed because you have exceeded your quota.",
                        "reason": "quotaExceeded"
                    }
                ],
                "message": "The request cannot be completed because you have exceeded your quota."
            }
        });
        assert!(ApiKeyManager::is_quota_error(&quota_err));

        let other_err = json!({
            "error": {
                "code": 404,
                "message": "Not found"
            }
        });
        assert!(!ApiKeyManager::is_quota_error(&other_err));
    }

    #[tokio::test]
    async fn test_resolve_handle_web_fallback() {
        let client = reqwest::Client::new();
        let mgr = ApiKeyManager::new(vec![]);
        let resolved = get_channel_id(&client, "vulbyte", &mgr).await;
        assert!(resolved.is_ok());
        assert_eq!(resolved.unwrap(), "UCKZigHbgpJG9ldxXMqmiZUg");

        let resolved_at = get_channel_id(&client, "@vulbyte", &mgr).await;
        assert!(resolved_at.is_ok());
        assert_eq!(resolved_at.unwrap(), "UCKZigHbgpJG9ldxXMqmiZUg");
    }

    #[tokio::test]
    async fn test_fetch_channel_streams_web() {
        let client = reqwest::Client::new();
        let streams = fetch_channel_streams_web(&client, "UCKZigHbgpJG9ldxXMqmiZUg").await;
        let found = streams.iter().any(|s| s.video_id == "1a2iSWQzl7I");
        assert!(found, "Expected to find scheduled stream 1a2iSWQzl7I in web streams: {:?}", streams);
    }
}
