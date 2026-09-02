#![allow(unused_parens, unused_imports)]
use cockatiel_protobuf::container;
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

// We use BTreeMap to automatically sort by priority (i32).
// The Vec preserves insertion order for priority collisions!
type ModuleQueue =
    Arc<Mutex<BTreeMap<i32, Vec<(String, mpsc::Sender<cockatiel_protobuf::Container>)>>>>;

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

#[derive(Debug, Serialize, Deserialize)]
pub struct Config {
    pub database_location: String,
    pub backup_database_location: String,
    pub paring_pin: u32,
    pub port: u16,
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
    let port: u16 = 9734; // Default port

    let default_config = format!(
        r#"{{
            "database_location": "./",
            "backup_database_location": "./",
            "paring_pin": {},
            "port": {}
        }}"#,
        pin, port
    );

    match fs::write(&target_file, &default_config) {
        Ok(_) => {
            p!("config file created");
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

async fn verify_config() -> String {
    let config: String = match get_file("./config.json") {
        Ok(config) => config,
        Err(err) => {
            p!("{FG_R}{}{RST}", err);
            println!("config file wasn't found... do you want to make a new config? (y/n)");
            let mut input = String::new();
            std::io::stdin()
                .read_line(&mut input)
                .expect("failed to read line");
            if input.trim() == "n" {
                process::exit(0);
            }
            let dir = env::current_dir().unwrap();
            create_config(dir).await.unwrap()
        }
    };
    config
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("cargo:rerun-if-changed=proto/cockatiel_protobuf.proto");

    let preprocess_modules: ModuleQueue = Arc::new(Mutex::new(BTreeMap::new()));
    let inprocess_modules: ModuleQueue = Arc::new(Mutex::new(BTreeMap::new()));
    let postprocess_modules: ModuleQueue = Arc::new(Mutex::new(BTreeMap::new()));

    p!("
                            X
             XXXXXXXXX      XXX
          XXXXXXXXXXXXXXXXXXX 
         XX   XXXXXXXXXXXXX  
      XXXX      XXXXXXXXXXXXXX
     XXXXXX    XXXXXXXX XX   
       XXXXXXXXXXXXXXXXX      
         XXXXXXXXXXXXXXX      
         XXX XXXXXXX XXX      
         XX   XXXX    XX      

         cockatiel
            -by vulbyte
    ");

    let config_string: String = verify_config().await;
    let config: Config = serde_json::from_str(&config_string).unwrap();

    let bind_addr = format!("0.0.0.0:{}", config.port);
    let handshake_port = TcpListener::bind(&bind_addr)
        .await
        .expect("Failed to bind to port");
    p!("Listening for connections on {}", bind_addr);

    loop {
        match handshake_port.accept().await {
            Ok((stream, peer_address)) => {
                p!("Incoming connection from {}", peer_address);
                let preprocess_modules = Arc::clone(&preprocess_modules);
                let inprocess_modules = Arc::clone(&inprocess_modules);
                let postprocess_modules = Arc::clone(&postprocess_modules);
                let paring_pin = config.paring_pin;

                tokio::spawn(async move {
                    let mut websocket_stream = match accept_async(stream).await {
                        Ok(ws) => ws,
                        Err(_) => return,
                    };

                    // Create the channel for this module to receive routed messages
                    let (tx, mut rx) = mpsc::channel::<cockatiel_protobuf::Container>(32);
                    let mut current_module_name = String::new();
                    let mut current_priority = 0;
                    let mut current_position = String::new();
                    let mut is_authenticated = false;

                    loop {
                        tokio::select! {
                                                                            // 1. Listen for INCOMING messages from the module
                                                                            Some(pkg) = websocket_stream.next() => {
                                                                                let msg = match pkg {
                                                                                    Ok(Message::Binary(data)) => data,
                                                                                    Ok(Message::Close(_)) | Err(_) => break, // Disconnect cleanly
                                                                                    _ => continue,
                                                                                };

                                                                                let decode = match cockatiel_protobuf::Container::decode(msg.as_ref()) {
                                                                                    Ok(d) => d,
                                                                                    Err(_) => continue,
                                                                                };

                                                                                match decode.payload {

                        // 2. Wrap the Mutex locking in a tight scope
                        Some(cockatiel_protobuf::container::Payload::ConnectionRequest(data)) => {
                            if data.pin == paring_pin as i32 {
                                is_authenticated = true;
                                current_module_name = decode.module_name.clone();
                                current_priority = data.priority;
                                current_position = data.process_position.to_lowercase();

                                // --- NEW SCOPE BLOCK STARTS HERE ---
                                // We isolate the lock so it drops before the .await
                                {
                                    let mut queue = match current_position.as_str() {
                                        "preprocess" => preprocess_modules.lock().unwrap(),
                                        "inprocess" => inprocess_modules.lock().unwrap(),
                                        "postprocess" => postprocess_modules.lock().unwrap(),
                                        _ => {
                                            p!("Unknown process position. Disconnecting.");
                                            break;
                                        }
                                    };

                                    queue.entry(current_priority)
                                         .or_insert_with(Vec::new)
                                         .push((current_module_name.clone(), tx.clone()));
                                }
                                // --- NEW SCOPE BLOCK ENDS HERE --- Lock is completely dropped.

                                p!("Authenticated {} at priority {}", current_module_name, current_priority);

                                // Send Success Return
                                let mut buf = Vec::new();
                                let response = cockatiel_protobuf::Container {
                                    version: 1, r#type: "auth".into(), auth_token: "".into(),
                                    error: "".into(), module_name: "cockatiel".into(),
                                    payload: Some(cockatiel_protobuf::container::Payload::ConnectionRequestReturn(
                                        cockatiel_protobuf::ConnectionRequestReturn { new_port: 0 }
                                    ))
                                };
                                response.encode(&mut buf).unwrap();
                                let _ = websocket_stream.send(Message::Binary(buf)).await; // Perfectly safe now!
                            }
                        },
                                                                                    Some(cockatiel_protobuf::container::Payload::MessageRaw(data)) => {
                                                                                        if !is_authenticated { continue; }
                                                                                        p!("RECEIVED MessageRaw from {}: \n{FG_G}{:?}{RST}", current_module_name, data);

                                                                                        // TODO: The engine's routing logic to iterate through BTreeMaps goes here
                                                                                    },
                                                                                    _ => {}
                                                                                }
                                                                            }

                                                                            // 2. Listen for OUTBOUND messages routed TO this module by the engine
                                                                            Some(outbound_msg) = rx.recv() => {
                                                                                let mut buf = Vec::new();
                                                                                outbound_msg.encode(&mut buf).unwrap();
                                                                                if websocket_stream.send(Message::Binary(buf)).await.is_err() {
                                                                                    break;
                                                                                }
                                                                            }
                                                                        }
                    }

                    // CLEANUP on disconnect
                    if is_authenticated {
                        p!(
                            "Module {} disconnected. Cleaning up queues.",
                            current_module_name
                        );
                        let mut queue = match current_position.as_str() {
                            "preprocess" => preprocess_modules.lock().unwrap(),
                            "inprocess" => inprocess_modules.lock().unwrap(),
                            "postprocess" => postprocess_modules.lock().unwrap(),
                            _ => return,
                        };

                        if let Some(list) = queue.get_mut(&current_priority) {
                            list.retain(|(name, _)| name != &current_module_name);
                            if list.is_empty() {
                                queue.remove(&current_priority);
                            }
                        }
                    }
                });
            }
            Err(e) => p!("Error accepting connection: {}", e),
        }
    }
}
