use futures_util::{SinkExt, StreamExt};
use prost::Message as ProstMessage;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::net::TcpStream;
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};

pub mod cockatiel_protobuf {
    include!(concat!(env!("OUT_DIR"), "/cockatiel_protobuf.rs"));
}

use cockatiel_protobuf::{ConnectionRequest, Container, MessagePostProcess, container::Payload};

type CommandRegistry = Arc<Mutex<HashMap<String, cockatiel_protobuf::Commands>>>;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let engine_url = "ws://127.0.0.1:9734"; // Adjust engine port/IP if needed
    let pairing_pin = 123456; // Match your engine pairing pin or read from config

    println!(
        "[Help Module] Connecting to Cockatiel Engine at {}...",
        engine_url
    );

    let (ws_stream, _) = connect_async(engine_url).await?;
    let (mut write, mut read) = ws_stream.split();

    // 1. Authenticate as a postprocess module with high priority
    let auth_req = Container {
        version: 1,
        auth_token: "".into(),
        module_name: "help_service".into(),
        module_instance_uuid7: "".into(),
        payload: Some(Payload::ConnectionRequest(ConnectionRequest {
            pin: pairing_pin,
            priority: 1, // High priority to process commands quickly
            process_position: "postprocess".into(),
            module_instance_uuid7: "".into(),
        })),
        ..Default::default()
    };

    let mut buf = Vec::new();
    auth_req.encode(&mut buf)?;
    write.send(Message::Binary(buf)).await?;

    let registry: CommandRegistry = Arc::new(Mutex::new(HashMap::new()));
    println!("[Help Module] Authenticated successfully. Listening for commands and chat inputs...");

    // 2. Main Event Loop
    while let Some(msg) = read.next().await {
        if let Ok(Message::Binary(data)) = msg {
            if let Ok(container) = Container::decode(data.as_slice()) {
                let source_module = container.module_name.clone();

                match container.payload {
                    // Cache or update advertised capabilities from any connected module
                    Some(Payload::CommandsPayload(cmds)) => {
                        println!(
                            "[Help Module] Received capabilities update from module: '{}'",
                            source_module
                        );
                        let mut reg = registry.lock().unwrap();
                        reg.insert(source_module, cmds);
                    }

                    // Listen for chat messages to see if someone triggered !help
                    Some(Payload::MessagePostProcess(post_msg)) => {
                        // Prevent loops if the system itself sent a message
                        if post_msg.user_uuid7 == "CockatielSystem" {
                            continue;
                        }

                        let raw_text = post_msg.raw_message.trim();

                        if raw_text.starts_with("!help") {
                            println!(
                                "[Help Module] '!help' triggered by user. Formatting command catalog..."
                            );
                            let help_text = format_help_menu(&registry);

                            // Send response back via engine pipeline
                            let response_container = Container {
                                version: 1,
                                auth_token: "".into(),
                                module_name: "help_service".into(),
                                module_instance_uuid7: "".into(),
                                payload: Some(Payload::MessagePostProcess(MessagePostProcess {
                                    platform: post_msg.platform.clone(),
                                    raw_message: "!help".into(),
                                    processed_message: help_text,
                                    user_uuid7: "CockatielSystem".into(),
                                    ..Default::default()
                                })),
                                ..Default::default()
                            };

                            let mut out_buf = Vec::new();
                            response_container.encode(&mut out_buf)?;
                            write.send(Message::Binary(out_buf)).await?;
                            println!("[Help Module] Help text forwarded to input/output handlers.");
                        }
                    }
                    _ => {}
                }
            }
        }
    }

    Ok(())
}

// Formats the command cache layout exactly to your template spec
fn format_help_menu(registry: &CommandRegistry) -> String {
    let reg = registry.lock().unwrap();
    let mut output = String::new();

    if reg.is_empty() {
        return "No commands are currently available.".to_string();
    }

    for (_, cmds) in reg.iter() {
        for cmd in &cmds.commands {
            output.push_str(&format!(
                "!{}\n - {}\n",
                cmd.command_flag, cmd.command_description
            ));

            for flag in &cmd.command_flags {
                output.push_str(&format!(
                    "  [ -{}: {} ]\n",
                    flag.flag_name, flag.flag_description
                ));
            }
        }
    }

    output
}
