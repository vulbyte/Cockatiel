use futures_util::{SinkExt, StreamExt};
use prost::Message as ProstMessage;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};
use uuid::Uuid;

pub mod cockatiel_protobuf {
    include!(concat!(env!("OUT_DIR"), "/cockatiel_protobuf.rs"));
}

use cockatiel_protobuf::{
    Commands, ConnectionRequest, Container, MessagePostProcess, container::Payload,
};

const ENGINE_URL: &str = "ws://127.0.0.1:9734";

type CommandRegistry = Arc<Mutex<HashMap<String, Commands>>>;

fn format_help_menu(registry: &CommandRegistry) -> String {
    let registry = registry.lock().unwrap();

    if registry.is_empty() {
        return "No commands are currently available.".into();
    }

    let mut output = String::from("Available commands:\n\n");

    for commands in registry.values() {
        for command in &commands.commands {
            output.push_str(&format!(
                "!{} - {}\n",
                command.command_flag, command.command_description
            ));

            for flag in &command.command_flags {
                output.push_str(&format!(
                    "  -{}: {}\n",
                    flag.flag_name, flag.flag_description
                ));
            }

            output.push('\n');
        }
    }

    output
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let engine_url =
        std::env::var("COCKATIEL_ENGINE_URL").unwrap_or_else(|_| ENGINE_URL.to_string());

    let pin: i32 = std::env::var("COCKATIEL_PAIRING_PIN")
        .unwrap_or_else(|_| "0".into())
        .parse()?;

    let instance_uuid7 = Uuid::now_v7().to_string();

    let (ws, _) = connect_async(engine_url).await?;
    let (mut write, mut read) = ws.split();

    let request = Container {
        version: 1,
        auth_token: String::new(),
        module_name: "help-module".into(),
        module_instance_uuid7: instance_uuid7.clone(),
        payload: Some(Payload::ConnectionRequest(ConnectionRequest {
            pin,
            process_position: "postprocess".into(),
            priority: 1,
            module_instance_uuid7: instance_uuid7,
        })),
    };

    let mut encoded = Vec::new();
    request.encode(&mut encoded)?;
    write.send(Message::Binary(encoded.into())).await?;

    let registry: CommandRegistry = Arc::new(Mutex::new(HashMap::new()));

    println!("[help-module] connected");

    while let Some(message) = read.next().await {
        let message = match message {
            Ok(message) => message,
            Err(error) => {
                eprintln!("[help-module] websocket error: {}", error);
                break;
            }
        };

        let data = match message {
            Message::Binary(data) => data,
            Message::Close(_) => break,
            _ => continue,
        };

        let container = match Container::decode(data.as_ref()) {
            Ok(container) => container,
            Err(error) => {
                eprintln!("[help-module] invalid protobuf: {}", error);
                continue;
            }
        };

        let source_module = container.module_name.clone();

        match container.payload {
            Some(Payload::ConnectionRequestReturn(response)) => {
                if response.new_port == 0 {
                    println!("[help-module] authenticated");
                } else {
                    eprintln!("[help-module] rejected with status {}", response.new_port);
                    break;
                }
            }

            Some(Payload::Commands(commands)) => {
                registry.lock().unwrap().insert(source_module, commands);
            }

            Some(Payload::MessagePostProcess(message)) => {
                if message.user_uuid7 == "CockatielSystem" {
                    continue;
                }

                if !message.raw_message.trim().starts_with("!help") {
                    continue;
                }

                let help_text = format_help_menu(&registry);

                let response = Container {
                    version: 1,
                    auth_token: String::new(),
                    module_name: "help-module".into(),
                    module_instance_uuid7: instance_uuid7.clone(),
                    payload: Some(Payload::MessagePostProcess(MessagePostProcess {
                        platform: message.platform,
                        raw_data: String::new(),
                        user_uuid7: "CockatielSystem".into(),
                        raw_message: "!help".into(),
                        processed_message: help_text,
                        command: None,
                        user_data: String::new(),
                    })),
                };

                let mut encoded = Vec::new();
                response.encode(&mut encoded)?;
                write.send(Message::Binary(encoded.into())).await?;
            }

            Some(Payload::Shutdown(shutdown)) => {
                println!("[help-module] shutdown requested: {}", shutdown.reason);
                break;
            }

            _ => {}
        }
    }

    Ok(())
}
