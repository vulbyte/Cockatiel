#![allow(unused_parens, unused_imports)]
use cockatiel_protobuf::{container::Payload, Container};

use futures_util::{SinkExt, StreamExt};
use prost::Message as ProstMessage;
use serde::{Deserialize, Serialize};
use vulb_lib::random::Random;

use std::collections::{BTreeMap, HashMap};
use std::env;
use std::fs;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::process;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

use tokio::net::{TcpListener, TcpStream};
use tokio::sync::mpsc;
use tokio_tungstenite::{accept_async, tungstenite::protocol::Message, WebSocketStream};

pub mod cockatiel_protobuf {
    include!(concat!(env!("OUT_DIR"), "/cockatiel_protobuf.rs"));
}

// Term colors & reset
pub const FG_K: &str = "\x1b[30m";
pub const FG_R: &str = "\x1b[31m";
pub const FG_G: &str = "\x1b[32m";
pub const FG_B: &str = "\x1b[34m";
pub const FG_C: &str = "\x1b[36m";
pub const FG_M: &str = "\x1b[35m";
pub const FG_Y: &str = "\x1b[33m";
pub const FG_W: &str = "\x1b[37m";
pub const RST: &str = "\x1b[0m";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModuleEntry {
    pub name: String,
    pub priority: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Config {
    pub database_location: String,
    pub backup_database_location: String,
    pub paring_pin: u32,
    pub port: u16,
    #[serde(default, rename = "inputs")]
    pub inputs: Vec<ModuleEntry>,
    #[serde(default, rename = "preprocessModules")]
    pub preprocess_modules: Vec<ModuleEntry>,
    #[serde(default, rename = "inprocessModules")]
    pub inprocess_modules: Vec<ModuleEntry>,
    #[serde(default, rename = "postprocessModules")]
    pub postprocess_modules: Vec<ModuleEntry>,
}

pub struct ConfigState {
    pub path: PathBuf,
    pub last_size: u64,
    pub config: Config,
}

#[derive(Clone)]
pub struct PipelineTracker {
    pub inprocess_waterfall: Vec<String>,
    pub current_step: usize,
}

macro_rules! p {
($($arg:tt)*) => {
println!("\x1b[31m[Cockatiel]:\x1b[0m {}\n", format!($($arg)*))
};
}

fn confirm_input(prompt: &str, yes_dialog: &str, no_dialog: &str) -> bool {
    let mut input: String = Default::default();
    loop {
        println!("{}\n (y/n), or you can enter 'q' to quit", prompt);
        input.clear();
        match std::io::stdin().read_line(&mut input) {
            Ok(_) => {
                let trimmed = input.trim();
                match trimmed {
                    "y" => {
                        p!("{}", yes_dialog);
                        return true;
                    }
                    "n" => {
                        p!("{}", no_dialog);
                        return false;
                    }
                    "q" => {
                        process::exit(0);
                    }
                    _ => {
                        p!("input invalid, please try again");
                        continue;
                    }
                }
            }
            Err(e) => {
                p!("could not read input, closing\n{FG_Y}{}{RST}", e);
                panic!();
            }
        }
    }
}

async fn create_config(config_path: PathBuf) -> Result<String, String> {
    let mut r = Random::new();
    let target_file = config_path.join("config.json");
    let pin: u32 = r.num_of_len(6);
    let port: u16 = 9734;

    let default_config = format!(
        r#"{{
"database_location": "./",
"backup_database_location": "./",
"paring_pin": {},
"port": {},
"inputs": [],
"preprocessModules": [],
"inprocessModules": [],
"postprocessModules": []
}}"#,
        pin, port
    );

    match fs::write(&target_file, &default_config) {
        Ok(_) => {
            p!("config file created at {:?}", target_file);
            Ok(default_config)
        }
        Err(e) => {
            p!("config file could not be created.\nerr: {FG_Y}{}{RST}\n", e);
            Err(e.to_string())
        }
    }
}

fn get_file(file_path: &str) -> Result<String, String> {
    let config_path = PathBuf::from(file_path);
    if !config_path.exists() {
        return Err("file does not exist".to_string());
    }
    if config_path.is_dir() {
        return Err("path is a directory".to_string());
    }
    fs::read_to_string(&config_path).map_err(|e| e.to_string())
}

async fn verify_config() -> (String, PathBuf) {
    let paths = ["../config.json", "./config.json"];
    for path in &paths {
        if let Ok(content) = get_file(path) {
            p!("Loaded config file from: {}", path);
            return (content, PathBuf::from(path));
        }
    }

    p!("{FG_R}Config file not found in root or local directory.{RST}");
    println!("Config file wasn't found... Do you want to create a new config in the root workspace directory? (y/n)");
    let mut input = String::new();
    std::io::stdin()
        .read_line(&mut input)
        .expect("failed to read line");
    if input.trim() == "n" {
        process::exit(0);
    }
    let current = env::current_dir().unwrap();
    let target_dir = if current.ends_with("cockatiel-engine") {
        current.parent().unwrap().to_path_buf()
    } else {
        current
    };
    let content = create_config(target_dir.clone()).await.unwrap();
    (content, target_dir.join("config.json"))
}

fn get_authoritative_config(state: &Arc<Mutex<ConfigState>>) -> Config {
    let mut guard = state.lock().unwrap();
    if let Ok(metadata) = fs::metadata(&guard.path) {
        let current_size = metadata.len();
        if current_size != guard.last_size {
            if let Ok(content) = fs::read_to_string(&guard.path) {
                if let Ok(parsed) = serde_json::from_str(&content) {
                    guard.config = parsed;
                    guard.last_size = current_size;
                }
            }
        }
    }
    guard.config.clone()
}

fn update_and_save_config<F>(state: &Arc<Mutex<ConfigState>>, mut update_fn: F) -> Config
where
    F: FnMut(&mut Config),
{
    let mut guard = state.lock().unwrap();
    update_fn(&mut guard.config);
    if let Ok(serialized) = serde_json::to_string_pretty(&guard.config) {
        if fs::write(&guard.path, &serialized).is_ok() {
            if let Ok(metadata) = fs::metadata(&guard.path) {
                guard.last_size = metadata.len();
            }
        }
    }
    guard.config.clone()
}

fn insert_module_entry(list: &mut Vec<ModuleEntry>, name: &str, priority: i32) {
    if let Some(pos) = list.iter().position(|m| m.name == name) {
        list[pos].priority = priority;
        return;
    }

    let mut insert_idx = list.len();
    for (i, entry) in list.iter().enumerate() {
        if entry.priority > priority {
            insert_idx = i;
            break;
        }
    }
    list.insert(
        insert_idx,
        ModuleEntry {
            name: name.to_string(),
            priority,
        },
    );
}

async fn dispatch_stage_message(
    config_state: &Arc<Mutex<ConfigState>>,
    active_connections: &Arc<Mutex<HashMap<String, mpsc::Sender<Container>>>>,
    stage_selector: fn(&Config) -> &[ModuleEntry],
    container: &Container,
) {
    let config = get_authoritative_config(config_state);
    let entries = stage_selector(&config);

    let senders: Vec<mpsc::Sender<Container>> = {
        let conn_map = active_connections.lock().unwrap();
        entries
            .iter()
            .filter_map(|entry| conn_map.get(&entry.name).cloned())
            .collect()
    };

    for tx in senders {
        let _ = tx.send(container.clone()).await;
    }
}

async fn send_to_specific_module(
    module_name: &str,
    active_connections: &Arc<Mutex<HashMap<String, mpsc::Sender<Container>>>>,
    container: &Container,
) {
    let tx_opt = {
        let conn_map = active_connections.lock().unwrap();
        conn_map.get(module_name).cloned()
    };
    if let Some(tx) = tx_opt {
        let _ = tx.send(container.clone()).await;
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("cargo:rerun-if-changed=proto/cockatiel_protobuf.proto");

    p!("
X
XXXXXXXXXXX     XXX
XXXXXXXXXXXXXXXXXX 
XXX    XXXXXXXXXXXX 
XXXX      XXXXXXXXXXXXXX
XXXXXX    XXXXXXXXXXX   
XXXXXXXXXXXXXXXXX      
XXXXXXXXXXXXXXX      
XXX XXXXXXX XXX      
XX    XXXX   XX      

cockatiel
-by vulbyte
");

    let (config_string, config_path) = verify_config().await;

    let initial_config: Config = match serde_json::from_str(&config_string) {
        Ok(c) => c,
        Err(e) => {
            p!(
                "{FG_R}Error parsing config file at {:?}: {}{RST}",
                config_path,
                e
            );
            let overwrite = confirm_input(
"The config file is corrupted or empty. Do you want to overwrite it with a new default config?",
"Creating new default config...",
"Exiting so you can fix the config file manually."
);

            if overwrite {
                let target_dir = config_path.parent().unwrap().to_path_buf();
                let new_config_str = create_config(target_dir).await.unwrap();
                serde_json::from_str(&new_config_str).unwrap()
            } else {
                process::exit(1);
            }
        }
    };

    let initial_size = fs::metadata(&config_path).map(|m| m.len()).unwrap_or(0);

    let config_state = Arc::new(Mutex::new(ConfigState {
        path: config_path,
        last_size: initial_size,
        config: initial_config,
    }));

    let active_connections: Arc<Mutex<HashMap<String, mpsc::Sender<Container>>>> =
        Arc::new(Mutex::new(HashMap::new()));

    let active_pipelines: Arc<Mutex<HashMap<String, PipelineTracker>>> =
        Arc::new(Mutex::new(HashMap::new()));

    let current_config = get_authoritative_config(&config_state);
    let bind_addr = format!("0.0.0.0:{}", current_config.port);
    let handshake_port = TcpListener::bind(&bind_addr)
        .await
        .expect("Failed to bind to port");
    p!("Listening for connections on {}", bind_addr);

    loop {
        match handshake_port.accept().await {
            Ok((stream, peer_address)) => {
                p!("Incoming connection from {}", peer_address);
                let config_state = Arc::clone(&config_state);
                let active_connections = Arc::clone(&active_connections);
                let active_pipelines = Arc::clone(&active_pipelines);
                let paring_pin = current_config.paring_pin;

                tokio::spawn(async move {
                    let mut websocket_stream = match accept_async(stream).await {
                        Ok(ws) => ws,
                        Err(_) => return,
                    };

                    let (tx, mut rx) = mpsc::channel::<cockatiel_protobuf::Container>(32);
                    let mut current_module_name = String::new();
                    let mut is_authenticated = false;

                    loop {
                        tokio::select! {
                            Some(pkg) = websocket_stream.next() => {
                                let msg = match pkg {
                                    Ok(Message::Binary(data)) => data,
                                    Ok(Message::Close(_)) | Err(_) => break,
                                    _ => continue,
                                };

                                let decode = match cockatiel_protobuf::Container::decode(msg.as_ref()) {
                                    Ok(d) => d,
                                    Err(_) => continue,
                                };

                                match decode.payload {
                                    Some(Payload::Shutdown(_)) => {println!("received a shutdown command!")}
                                    Some(Payload::Log(_)) => {println!("received a log")}
                                    Some(Payload::Err(_)) => {println!("received an err")}

                                    Some(Payload::ConnectionRequest(data)) => {
                                        if data.pin == paring_pin as i32 {
                                            is_authenticated = true;
                                            current_module_name = decode.module_name.clone();
                                            let current_priority = data.priority;
                                            let current_position = data.process_position.to_lowercase();

                                            {
                                                let mut conn_map = active_connections.lock().unwrap();
                                                conn_map.insert(current_module_name.clone(), tx.clone());
                                            }

                                            update_and_save_config(&config_state, |cfg| {
                                                let list = match current_position.as_str() {
                                                    "input" | "inputs" => &mut cfg.inputs,
                                                    "preprocess" => &mut cfg.preprocess_modules,
                                                    "inprocess" => &mut cfg.inprocess_modules,
                                                    "postprocess" | "output" | "outputs" | "display" | "post" => &mut cfg.postprocess_modules,
                                                    _ => &mut cfg.inputs,
                                                };
                                                insert_module_entry(list, &current_module_name, current_priority);
                                            });

                                            p!("Authenticated {} at priority {}", current_module_name, current_priority);

                                            let mut buf = Vec::new();
                                            let response = cockatiel_protobuf::Container {
                                                version: 1,
                                                auth_token: "".into(),
                                                module_name: "cockatiel".into(),
                                                module_instance_uuid7: "".into(),
                                                payload: Some(Payload::ConnectionRequestReturn(
                                                    cockatiel_protobuf::ConnectionRequestReturn {
                                                        new_port: 0,
                                                        module_instance_uuid7: "".into(),
                                                    }
                                                )),
                                                ..Default::default()
                                            };
                                            response.encode(&mut buf).unwrap();
                                            let _ = websocket_stream.send(Message::Binary(buf)).await;
                                        } else {
                                            p!("❌ Authentication REJECTED for '{}': Invalid PIN provided (received {}, expected {})",
                                            decode.module_name, data.pin, paring_pin);

                                            let mut buf = Vec::new();
                                            let response = cockatiel_protobuf::Container {
                                                version: 1,
                                                auth_token: "".into(),
                                                module_name: "cockatiel".into(),
                                                module_instance_uuid7: "".into(),
                                                payload: None,
                                                ..Default::default()
                                            };
                                            response.encode(&mut buf).unwrap();
                                            let _ = websocket_stream.send(Message::Binary(buf)).await;
                                            break;
                                        }
                                    },
                                    Some(Payload::ConnectionRequestReturn(ret)) => {
                                        p!("Received ConnectionRequestReturn: assigned port/status code = {}", ret.new_port);
                                    },


                                    Some(Payload::MessagePreProcess(ref msg)) => {
                                        p!("Pipeline Stage 1 [PreProcess] Initiated | Platform: '{}'", msg.platform);

                                        // Extract authorName from raw_data JSON string
                                        let mut extracted_username = "".to_string();
                                        if let Ok(json_val) = serde_json::from_str::<serde_json::Value>(&msg.raw_data) {
                                            if let Some(author_name) = json_val.get("authorName").and_then(|v| v.as_str()) {
                                                extracted_username = author_name.to_string();
                                            }
                                        }

                                        dispatch_stage_message(&config_state, &active_connections, |c: &Config| &c.preprocess_modules, &decode).await;

                                        let inprocess_list: Vec<String> = {
                                            let mut config = get_authoritative_config(&config_state);
                                            config.inprocess_modules.sort_by_key(|m| m.priority);
                                            config.inprocess_modules.into_iter().map(|m| m.name).collect()
                                        };

                                        if inprocess_list.is_empty() {
                                            p!("No InProcess modules found. Skipping straight to Stage 3 [PostProcess].");

                                            let mut post_container = decode.clone();
                                            post_container.payload = Some(Payload::MessagePostProcess(
                                                cockatiel_protobuf::MessagePostProcess {
                                                    platform: msg.platform.clone(),
                                                    raw_message: msg.raw_message.clone(),
                                                    processed_message: "".to_string(),
                                                    user_uuid7: extracted_username,
                                                    ..Default::default()
                                                }
                                            ));
                                            dispatch_stage_message(&config_state, &active_connections, |c: &Config| &c.postprocess_modules, &post_container).await;
                                        }
                                        else {
                                            let msg_id = format!("msg_{}", SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos());
                                            let target_module = inprocess_list[0].clone();

                                            active_pipelines.lock().unwrap().insert(msg_id, PipelineTracker {
                                                inprocess_waterfall: inprocess_list,
                                                current_step: 0,
                                            });

                                            send_to_specific_module(&target_module, &active_connections, &decode).await;
                                        }
                                    },

                                    Some(Payload::MessageInProcess(ref msg)) => {
                                        if !is_authenticated { continue; }

                                        enum NextAction {
                                            Forward(String),
                                            Complete(cockatiel_protobuf::MessagePostProcess),
                                        }

                                        let action = {
                                            let mut pipelines = active_pipelines.lock().unwrap();
                                            let first_key = pipelines.keys().next().cloned();

                                            if let Some(msg_id) = first_key {
                                                if let Some(tracker) = pipelines.get_mut(&msg_id) {
                                                    tracker.current_step += 1;

                                                    if tracker.current_step < tracker.inprocess_waterfall.len() {
                                                        let next_module = tracker.inprocess_waterfall[tracker.current_step].clone();
                                                        Some(NextAction::Forward(next_module))

                                                    } else {
                                                        pipelines.remove(&msg_id);

                                                        // Inside MessageInProcess mapping
                                                        Some(NextAction::Complete(cockatiel_protobuf::MessagePostProcess {
                                                            platform: msg.platform.clone(),
                                                            raw_message: msg.raw_message.clone(),
                                                            processed_message: msg.processed_message.clone(),
                                                            user_uuid7: msg.user_uuid7.clone(),
                                                            ..Default::default()
                                                        }))
                                                    }
                                                } else {
                                                    None
                                                }
                                            } else {
                                                None
                                            }
                                        };

                                        match action {
                                            Some(NextAction::Forward(next_module)) => {
                                                p!("Pipeline Stage 2 [InProcess] -> Advancing to '{}'", next_module);
                                                send_to_specific_module(&next_module, &active_connections, &decode).await;
                                            }
                                            Some(NextAction::Complete(post_payload)) => {
                                                p!("Pipeline Stage 2 [InProcess] Complete. Broadcasting to Stage 3 [PostProcess].");
                                                let mut final_container = decode.clone();
                                                final_container.payload = Some(Payload::MessagePostProcess(post_payload));
                                                dispatch_stage_message(&config_state, &active_connections, |c: &Config| &c.postprocess_modules, &final_container).await;
                                            }
                                            None => {}
                                        }
                                    },

                                    Some(Payload::MessagePostProcess(ref msg)) => {
                                        if !is_authenticated { continue; }
                                        p!("Pipeline Stage 3 [Processed] | Platform: '{}' | User: {}", msg.platform, msg.user_uuid7);
                                        dispatch_stage_message(&config_state, &active_connections, |c: &Config| &c.postprocess_modules, &decode).await;
                                    },
                                    Some(Payload::CommandsPayload(ref cmds)) => {
                                        if !is_authenticated { continue; }
                                        p!("Received Commands from '{}': {} command(s) declared", current_module_name, cmds.commands.len());
                                    },
                                    Some(Payload::TimelineEvent(event)) => {
                                        if !is_authenticated { continue; }
                                        p!("Received TimelineEvent record | Key: {}", event.uuid7_key);
                                    },
                                    Some(Payload::UserData(user)) => {
                                        if !is_authenticated { continue; }
                                        p!("Received UserData state update | User: {} | Sponsor: {}", user.username, user.is_sponsor);
                                    },
                                    Some(Payload::AuthVerify(_auth)) => {
                                        if !is_authenticated { continue; }
                                        p!("Received AuthVerify request from '{}'", current_module_name);
                                    },
                                    Some(Payload::AuthNew(_auth)) => {
                                        if !is_authenticated { continue; }
                                        p!("Received AuthNew token refresh for '{}'", current_module_name);
                                    },
                                    None => {
                                        p!("Received container packet with empty payload from '{}'", current_module_name);
                                    }
                                }
                            }

                            Some(outbound_msg) = rx.recv() => {
                                let mut buf = Vec::new();
                                outbound_msg.encode(&mut buf).unwrap();
                                if websocket_stream.send(Message::Binary(buf)).await.is_err() {
                                    break;
                                }
                            }
                        }
                    }

                    if is_authenticated {
                        p!(
                            "Module {} disconnected. Cleaning up active connections.",
                            current_module_name
                        );
                        let mut conn_map = active_connections.lock().unwrap();
                        conn_map.remove(&current_module_name);
                    }
                });
            }
            Err(e) => p!("Error accepting connection: {}", e),
        }
    }
}
