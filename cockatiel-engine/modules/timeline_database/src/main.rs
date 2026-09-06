use futures_util::{SinkExt, StreamExt};
use prost::Message as ProstMessage;
use rusqlite::{Connection, params};
use std::path::PathBuf;
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};
use uuid::Uuid;

pub mod cockatiel_protobuf {
    include!(concat!(env!("OUT_DIR"), "/cockatiel_protobuf.rs"));
}

use cockatiel_protobuf::{ConnectionRequest, Container, TimelineEvent, container::Payload};

const ENGINE_URL: &str = "ws://127.0.0.1:9734";

struct TimelineDatabase {
    connection: Connection,
}

impl TimelineDatabase {
    fn open(path: PathBuf) -> Result<Self, Box<dyn std::error::Error>> {
        let connection = Connection::open(path)?;

        connection.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS timeline (
                i BLOB PRIMARY KEY,
                c TEXT,
                d BLOB,
                e TEXT,
                f TEXT,
                o TEXT NOT NULL,
                p TEXT,
                r TEXT NOT NULL,
                s TEXT,
                t TEXT NOT NULL,
                u BLOB,
                v INTEGER NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_timeline_user
                ON timeline(u);

            CREATE INDEX IF NOT EXISTS idx_timeline_origin
                ON timeline(o);

            CREATE INDEX IF NOT EXISTS idx_timeline_type
                ON timeline(t);

            CREATE INDEX IF NOT EXISTS idx_timeline_stream
                ON timeline(s);
            "#,
        )?;

        Ok(Self { connection })
    }

    fn insert(&self, event: &TimelineEvent) -> Result<(), String> {
        if event.i.trim().is_empty() {
            return Err("TimelineEvent.i cannot be empty".into());
        }

        if event.o.trim().is_empty() {
            return Err("TimelineEvent.o cannot be empty".into());
        }

        if event.t.trim().is_empty() {
            return Err("TimelineEvent.t cannot be empty".into());
        }

        let id = Uuid::parse_str(&event.i)
            .map_err(|e| format!("invalid timeline UUID7 '{}': {}", event.i, e))?;

        if id.get_version_num() != 7 {
            return Err(format!("timeline event '{}' is not a UUID7", event.i));
        }

        let user_uuid = if event.u.trim().is_empty() {
            None
        } else {
            Some(
                Uuid::parse_str(&event.u)
                    .map_err(|e| format!("invalid user UUID '{}': {}", event.u, e))?
                    .as_bytes()
                    .to_vec(),
            )
        };

        let version = if event.v == 0 { 1 } else { event.v };

        self.connection
            .execute(
                r#"
                INSERT INTO timeline
                    (i, c, d, e, f, o, p, r, s, t, u, v)
                VALUES
                    (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
                ON CONFLICT(i) DO UPDATE SET
                    c = excluded.c,
                    d = excluded.d,
                    e = excluded.e,
                    f = excluded.f,
                    o = excluded.o,
                    p = excluded.p,
                    r = excluded.r,
                    s = excluded.s,
                    t = excluded.t,
                    u = excluded.u,
                    v = excluded.v
                "#,
                params![
                    id.as_bytes().as_slice(),
                    event.c,
                    event.d,
                    event.e,
                    event.f,
                    event.o,
                    event.p,
                    event.r,
                    event.s,
                    event.t,
                    user_uuid,
                    version,
                ],
            )
            .map_err(|e| format!("timeline insert failed: {}", e))?;

        Ok(())
    }
}

fn database_path() -> PathBuf {
    std::env::var("COCKATIEL_TIMELINE_DB")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("cockatiel_data.db"))
}

fn connection_request(instance_uuid7: String, pin: i32) -> Container {
    Container {
        version: 1,
        auth_token: String::new(),
        module_name: "timeline-module".into(),
        module_instance_uuid7: instance_uuid7.clone(),
        payload: Some(Payload::ConnectionRequest(ConnectionRequest {
            pin,
            process_position: "postprocess".into(),
            priority: 1,
            module_instance_uuid7: instance_uuid7,
        })),
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let db = TimelineDatabase::open(database_path())?;

    let engine_url =
        std::env::var("COCKATIEL_ENGINE_URL").unwrap_or_else(|_| ENGINE_URL.to_string());

    let pin: i32 = std::env::var("COCKATIEL_PAIRING_PIN")
        .unwrap_or_else(|_| "0".into())
        .parse()?;

    let instance_uuid7 = Uuid::now_v7().to_string();

    println!(
        "[timeline-module] connecting to Cockatiel at {}",
        engine_url
    );

    let (ws, _) = connect_async(engine_url).await?;
    let (mut write, mut read) = ws.split();

    let request = connection_request(instance_uuid7.clone(), pin);

    let mut encoded = Vec::new();
    request.encode(&mut encoded)?;
    write.send(Message::Binary(encoded.into())).await?;

    println!(
        "[timeline-module] connection requested with instance {}",
        instance_uuid7
    );

    while let Some(message) = read.next().await {
        let message = match message {
            Ok(message) => message,
            Err(error) => {
                eprintln!("[timeline-module] websocket error: {}", error);
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
                eprintln!("[timeline-module] invalid protobuf packet: {}", error);
                continue;
            }
        };

        match container.payload {
            Some(Payload::ConnectionRequestReturn(response)) => {
                if response.new_port == 0 {
                    println!("[timeline-module] authenticated");
                } else {
                    eprintln!(
                        "[timeline-module] connection rejected, status {}",
                        response.new_port
                    );
                    break;
                }
            }

            Some(Payload::TimelineEvent(event)) => match db.insert(&event) {
                Ok(()) => {
                    println!("[timeline-module] stored {}", event.i);
                }

                Err(error) => {
                    eprintln!("[timeline-module] failed to store {}: {}", event.i, error);
                }
            },

            Some(Payload::Shutdown(shutdown)) => {
                println!("[timeline-module] shutdown requested: {}", shutdown.reason);
                break;
            }

            Some(Payload::Log(log)) => {
                println!("[timeline-module] {}", log.log);
            }

            Some(Payload::Err(error)) => {
                eprintln!("[timeline-module] {}", error.log);
            }

            _ => {}
        }
    }

    Ok(())
}
