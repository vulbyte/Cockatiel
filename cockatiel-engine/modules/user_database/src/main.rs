use futures_util::{SinkExt, StreamExt};
use prost::Message as ProstMessage;
use rusqlite::{Connection, params};
use std::path::PathBuf;
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};
use uuid::Uuid;

pub mod cockatiel_protobuf {
    include!(concat!(env!("OUT_DIR"), "/cockatiel_protobuf.rs"));
}

use cockatiel_protobuf::{ConnectionRequest, Container, UserData, container::Payload};

const ENGINE_URL: &str = "ws://127.0.0.1:9734";

struct UserDatabase {
    connection: Connection,
}

impl UserDatabase {
    fn open(path: PathBuf) -> Result<Self, Box<dyn std::error::Error>> {
        let connection = Connection::open(path)?;

        connection.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS users (
                uuid7 TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                is_sponsor INTEGER NOT NULL DEFAULT 0,
                is_moderator INTEGER NOT NULL DEFAULT 0,
                is_admin INTEGER NOT NULL DEFAULT 0,
                is_owner INTEGER NOT NULL DEFAULT 0,
                data_json TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_users_username
                ON users(username);
            "#,
        )?;

        Ok(Self { connection })
    }

    fn upsert(&self, user: &UserData) -> Result<(), String> {
        let uuid = if user.uuid.trim().is_empty() {
            Uuid::now_v7().to_string()
        } else {
            user.uuid.clone()
        };

        let data_json = serde_json::to_string(user)
            .map_err(|e| format!("could not serialize UserData: {}", e))?;

        self.connection
            .execute(
                r#"
                INSERT INTO users (
                    uuid7,
                    username,
                    is_sponsor,
                    is_moderator,
                    is_admin,
                    is_owner,
                    data_json
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
                ON CONFLICT(uuid7) DO UPDATE SET
                    username = excluded.username,
                    is_sponsor = excluded.is_sponsor,
                    is_moderator = excluded.is_moderator,
                    is_admin = excluded.is_admin,
                    is_owner = excluded.is_owner,
                    data_json = excluded.data_json
                "#,
                params![
                    uuid,
                    user.username,
                    user.is_sponsor,
                    user.is_moderator,
                    user.is_admin,
                    user.is_owner,
                    data_json,
                ],
            )
            .map_err(|e| format!("user database error: {}", e))?;

        Ok(())
    }
}

fn database_path() -> PathBuf {
    std::env::var("COCKATIEL_USER_DB")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("cockatiel_users.db"))
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let database = UserDatabase::open(database_path())?;

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
        module_name: "user-module".into(),
        module_instance_uuid7: instance_uuid7.clone(),
        payload: Some(Payload::ConnectionRequest(ConnectionRequest {
            pin,
            process_position: "preprocess".into(),
            priority: 1,
            module_instance_uuid7: instance_uuid7,
        })),
    };

    let mut encoded = Vec::new();
    request.encode(&mut encoded)?;
    write.send(Message::Binary(encoded.into())).await?;

    println!("[user-module] connected");

    while let Some(message) = read.next().await {
        let message = match message {
            Ok(message) => message,
            Err(error) => {
                eprintln!("[user-module] websocket error: {}", error);
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
                eprintln!("[user-module] invalid packet: {}", error);
                continue;
            }
        };

        match container.payload {
            Some(Payload::ConnectionRequestReturn(response)) => {
                if response.new_port == 0 {
                    println!("[user-module] authenticated");
                } else {
                    eprintln!("[user-module] rejected with status {}", response.new_port);
                    break;
                }
            }

            Some(Payload::UserData(user)) => {
                if let Err(error) = database.upsert(&user) {
                    eprintln!("[user-module] failed to save {}: {}", user.username, error);
                }
            }

            Some(Payload::Shutdown(shutdown)) => {
                println!("[user-module] shutdown requested: {}", shutdown.reason);
                break;
            }

            _ => {}
        }
    }

    Ok(())
}
