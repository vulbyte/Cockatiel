#![allow(clippy::type_complexity)]

use futures_util::{SinkExt, StreamExt};
use prost::Message as ProstMessage;
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    env, fs,
    path::PathBuf,
    process,
    sync::{Arc, Mutex},
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tokio::{net::TcpListener, sync::mpsc};
use tokio_tungstenite::{accept_async, tungstenite::protocol::Message};

use uuid::Uuid;

use module_registry::ModuleRegistry;

mod keymap;
mod module_auto_registry;
mod tui;

pub mod cockatiel_protobuf {
    include!(concat!(env!("OUT_DIR"), "/cockatiel_protobuf.rs"));
}

use cockatiel_protobuf::{Container, container::Payload};

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

    #[serde(default)]
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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ModuleState {
    Running,
    Paused,
    Stopped,
    Crashed,
}

#[derive(Clone)]
pub struct ModuleInfo {
    pub name: String,
    pub instance_uuid7: String,
    pub priority: i32,
    pub process_position: String,
    pub state: ModuleState,

    pub sender: Option<mpsc::Sender<Container>>,
}

#[derive(Clone)]
pub struct TimelineDisplayEvent {
    pub id: String,
    pub timestamp: String,
    pub text: String,
}

#[derive(Clone)]
pub struct EngineState {
    pub modules: Vec<ModuleInfo>,
    pub timeline: Vec<TimelineDisplayEvent>,
}

impl EngineState {
    pub fn new() -> Self {
        Self {
            modules: Vec::new(),
            timeline: Vec::new(),
        }
    }
}

#[derive(Debug)]
pub enum EngineCommand {
    OpenModuleActions(String),
    TogglePause(String),
    Restart(String),
    Shutdown(String),
    InspectTimeline(String),
    Quit,
}

fn log_event(state: &Arc<Mutex<EngineState>>, text: impl Into<String>) {
    let text = text.into();

    println!("[Cockatiel] {}", text);

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs().to_string())
        .unwrap_or_else(|_| "0".into());

    let mut state = state.lock().unwrap();

    state.timeline.push(TimelineDisplayEvent {
        id: Uuid::now_v7().to_string(),
        timestamp,
        text,
    });

    if state.timeline.len() > 100 {
        state.timeline.remove(0);
    }
}

fn module_search_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();

    if let Ok(custom) = env::var("COCKATIEL_MODULE_PATHS") {
        paths.extend(env::split_paths(&custom));
    }

    paths.push(PathBuf::from("./modules"));
    paths.push(PathBuf::from("./cockatiel-engine/modules"));

    if let Ok(current) = env::current_dir() {
        paths.push(current.join("modules"));
        paths.push(current.join("cockatiel-engine/modules"));
    }

    paths.sort();
    paths.dedup();

    paths
}

fn get_file(path: &str) -> Result<String, String> {
    let path = PathBuf::from(path);

    if !path.exists() {
        return Err("file does not exist".into());
    }

    if path.is_dir() {
        return Err("path is a directory".into());
    }

    fs::read_to_string(path).map_err(|e| e.to_string())
}

fn create_config(directory: PathBuf) -> Result<String, String> {
    let target = directory.join("config.json");

    let pin: u32 = 100000 + (Uuid::new_v4().as_u128() % 900000) as u32;

    let config = format!(
        r#"{{
    "database_location": "./cockatiel_data.db",
    "backup_database_location": "./cockatiel_backup.db",
    "paring_pin": {},
    "port": 9734,
    "inputs": [],
    "preprocessModules": [],
    "inprocessModules": [],
    "postprocessModules": []
}}"#,
        pin
    );

    fs::write(&target, &config).map_err(|e| e.to_string())?;

    Ok(config)
}

async fn verify_config() -> Result<(String, PathBuf), Box<dyn std::error::Error>> {
    for path in ["../config.json", "./config.json"] {
        if let Ok(content) = get_file(path) {
            return Ok((content, PathBuf::from(path)));
        }
    }

    let current = env::current_dir()?;

    let target = if current.ends_with("cockatiel-engine") {
        current.parent().unwrap_or(&current).to_path_buf()
    } else {
        current
    };

    let content = create_config(target.clone())?;

    Ok((content, target.join("config.json")))
}

fn get_config(state: &Arc<Mutex<ConfigState>>) -> Config {
    let mut state = state.lock().unwrap();

    if let Ok(metadata) = fs::metadata(&state.path) {
        let size = metadata.len();

        if size != state.last_size {
            if let Ok(content) = fs::read_to_string(&state.path) {
                if let Ok(config) = serde_json::from_str(&content) {
                    state.config = config;
                    state.last_size = size;
                }
            }
        }
    }

    state.config.clone()
}

fn update_config<F>(state: &Arc<Mutex<ConfigState>>, update: F)
where
    F: FnOnce(&mut Config),
{
    let mut state = state.lock().unwrap();

    update(&mut state.config);

    if let Ok(serialized) = serde_json::to_string_pretty(&state.config) {
        if fs::write(&state.path, serialized).is_ok() {
            if let Ok(metadata) = fs::metadata(&state.path) {
                state.last_size = metadata.len();
            }
        }
    }
}

fn pipeline_list(config: &Config, position: &str) -> Vec<ModuleEntry> {
    let mut list = match position {
        "input" => config.inputs.clone(),
        "preprocess" => config.preprocess_modules.clone(),
        "inprocess" => config.inprocess_modules.clone(),
        "postprocess" => config.postprocess_modules.clone(),
        _ => Vec::new(),
    };

    list.sort_by_key(|entry| entry.priority);

    list
}

fn add_module_to_config(
    config_state: &Arc<Mutex<ConfigState>>,
    name: &str,
    position: &str,
    priority: i32,
) {
    update_config(config_state, |config| {
        let list = match position {
            "input" => &mut config.inputs,
            "preprocess" => &mut config.preprocess_modules,
            "inprocess" => &mut config.inprocess_modules,
            "postprocess" => &mut config.postprocess_modules,
            _ => return,
        };

        if let Some(existing) = list.iter_mut().find(|entry| entry.name == name) {
            existing.priority = priority;
            return;
        }

        list.push(ModuleEntry {
            name: name.into(),
            priority,
        });

        list.sort_by_key(|entry| entry.priority);
    });
}

async fn send_to_instance(
    modules: &Arc<Mutex<HashMap<String, ModuleInfo>>>,
    instance: &str,
    container: Container,
) {
    let sender = {
        modules
            .lock()
            .unwrap()
            .get(instance)
            .and_then(|m| m.sender.clone())
    };

    if let Some(sender) = sender {
        let _ = sender.send(container).await;
    }
}

async fn broadcast_stage(
    modules: &Arc<Mutex<HashMap<String, ModuleInfo>>>,
    config_state: &Arc<Mutex<ConfigState>>,
    position: &str,
    container: &Container,
) {
    let config = get_config(config_state);
    let entries = pipeline_list(&config, position);

    let names: Vec<String> = entries.into_iter().map(|e| e.name).collect();

    let senders = {
        let modules = modules.lock().unwrap();

        modules
            .values()
            .filter(|module| module.state == ModuleState::Running)
            .filter_map(|module| module.sender.clone())
            .collect::<Vec<_>>()
    };

    for sender in senders {
        let _ = sender.send(container.clone()).await;
    }
}

fn refresh_ui_modules(
    ui_state: &Arc<Mutex<EngineState>>,
    modules: &Arc<Mutex<HashMap<String, ModuleInfo>>>,
) {
    let mut list = modules
        .lock()
        .unwrap()
        .values()
        .cloned()
        .collect::<Vec<_>>();

    list.sort_by(|a, b| a.priority.cmp(&b.priority).then(a.name.cmp(&b.name)));

    ui_state.lock().unwrap().modules = list;
}

fn module_action(
    command: EngineCommand,
    modules: &Arc<Mutex<HashMap<String, ModuleInfo>>>,
    ui_state: &Arc<Mutex<EngineState>>,
) {
    match command {
        EngineCommand::TogglePause(instance) => {
            let mut modules = modules.lock().unwrap();

            if let Some(module) = modules.get_mut(&instance) {
                module.state = if module.state == ModuleState::Paused {
                    ModuleState::Running
                } else {
                    ModuleState::Paused
                };

                log_event(
                    ui_state,
                    format!(
                        "{} [{}] is now {:?}",
                        module.name, module.instance_uuid7, module.state
                    ),
                );
            }
        }

        EngineCommand::Shutdown(instance) => {
            let module = { modules.lock().unwrap().get(&instance).cloned() };

            if let Some(module) = module {
                if let Some(sender) = module.sender {
                    let container = Container {
                        version: 1,
                        auth_token: String::new(),
                        module_name: "cockatiel".into(),
                        module_instance_uuid7: instance.clone(),
                        payload: Some(Payload::Shutdown(cockatiel_protobuf::Shutdown {
                            reason: "Shutdown requested by operator".into(),
                        })),
                    };

                    let _ = sender.try_send(container);
                }
            }
        }

        EngineCommand::Restart(instance) => {
            log_event(ui_state, format!("Restart requested for {}", instance));

            // Actual process restart is deliberately
            // handled by the module launcher.
            // For now this asks the existing instance
            // to shut down.
        }

        EngineCommand::InspectTimeline(id) => {
            log_event(ui_state, format!("Timeline inspection requested: {}", id));
        }

        EngineCommand::OpenModuleActions(instance) => {
            log_event(ui_state, format!("Selected module {}", instance));
        }

        EngineCommand::Quit => {}
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!(
        r#"
                         X
              XXXXXXXXXXXX  XXX
            XXXXXXXXXXXXXXXXX
           XXX    XXXXXXXXXXX
        XXXXX      XXXXXXXXXXXXXX
       XXXXXXX    XXXXXXXXXXX
        XXXXXXXXXXXXXXXXXX
           XXXXXXXXXXXXXXX
           XXX XXXXXXX XXX
           XX    XXXX    XX
           cockatiel
              -by vulbyte
"#
    );

    let mut module_registry = ModuleRegistry::new();

    let search_paths = module_search_paths();

    log_event(&ui_state, "Searching for Cockatiel modules...");

    match module_registry.discover(&search_paths) {
        Ok(()) => {}

        Err(errors) => {
            for error in errors {
                log_event(&ui_state, format!("Module discovery: {}", error));
            }
        }
    }

    for module in module_registry.values() {
        log_event(
            &ui_state,
            format!(
                "Found module {} v{} at {}",
                module.manifest.name,
                module.manifest.version,
                module.directory.display()
            ),
        );
    }

    let (config_string, config_path) = verify_config().await?;

    let config: Config = serde_json::from_str(&config_string)?;

    let config_size = fs::metadata(&config_path)?.len();

    let config_state = Arc::new(Mutex::new(ConfigState {
        path: config_path,
        last_size: config_size,
        config: config.clone(),
    }));

    let modules: Arc<Mutex<HashMap<String, ModuleInfo>>> = Arc::new(Mutex::new(HashMap::new()));

    let ui_state = Arc::new(Mutex::new(EngineState::new()));

    let (command_tx, command_rx) = std::sync::mpsc::channel::<EngineCommand>();

    let tui_state = Arc::clone(&ui_state);

    let tui_command_tx = command_tx.clone();

    thread::spawn(move || match tui::Tui::new() {
        Ok(mut tui) => {
            if let Err(error) = tui.run(tui_state, tui_command_tx) {
                eprintln!("TUI error: {}", error);
            }
        }

        Err(error) => {
            eprintln!("Could not start TUI: {}", error);
        }
    });

    let command_modules = Arc::clone(&modules);

    let command_ui_state = Arc::clone(&ui_state);

    thread::spawn(move || {
        while let Ok(command) = command_rx.recv() {
            if matches!(command, EngineCommand::Quit) {
                break;
            }

            module_action(command, &command_modules, &command_ui_state);
        }
    });

    let listener = TcpListener::bind(format!("0.0.0.0:{}", config.port)).await?;

    log_event(&ui_state, format!("Listening on port {}", config.port));

    loop {
        let (stream, address) = listener.accept().await?;

        log_event(&ui_state, format!("Connection from {}", address));

        let config_state = Arc::clone(&config_state);

        let modules = Arc::clone(&modules);

        let ui_state = Arc::clone(&ui_state);

        tokio::spawn(async move {
            if let Err(error) = handle_connection(stream, config_state, modules, ui_state).await {
                eprintln!("Connection error: {}", error);
            }
        });
    }
}

async fn handle_connection(
    stream: tokio::net::TcpStream,
    config_state: Arc<Mutex<ConfigState>>,
    modules: Arc<Mutex<HashMap<String, ModuleInfo>>>,
    ui_state: Arc<Mutex<EngineState>>,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut websocket = accept_async(stream).await?;

    let (tx, mut rx) = mpsc::channel::<Container>(64);

    let mut authenticated = false;

    let mut module_name = String::new();
    let mut instance_uuid7 = String::new();

    loop {
        tokio::select! {
                    incoming = websocket.next() => {
                        let Some(incoming) = incoming else {
                            break;
                        };

                        let message = incoming?;

                        let Message::Binary(data) =
                            message
                        else {
                            continue;
                        };

                        let container =
                            Container::decode(
                                data.as_ref()
                            )?;

                        match container.payload {

                            Some(
                                Payload::ConnectionRequest(request)
                            ) => {
                                let config =
                                    get_config(
                                        &config_state
                                    );

                                if request.pin
                                    != config.paring_pin as i32
                                {
                                    log_event(
                                        &ui_state,
                                        format!(
                                            "Rejected connection from {}",
                                            container.module_name
                                        ),
                                    );

                                    let response =
                                        Container {
                                            version: 1,
                                            auth_token:
                                                String::new(),
                                            module_name:
                                                "cockatiel".into(),
                                            module_instance_uuid7:
                                                String::new(),
                                            payload: Some(
                                                Payload::ConnectionRequestReturn(
                                                    cockatiel_protobuf::ConnectionRequestReturn {
                                                        new_port: 0,
                                                        module_instance_uuid7:
                                                            String::new(),
                                                    }
                                                )
                                            ),
                                        };

                                    let mut bytes =
                                        Vec::new();

                                    response.encode(
                                        &mut bytes
                                    )?;

                                    websocket
                                        .send(
                                            Message::Binary(
                                                bytes.into()
                                            )
                                        )
                                        .await?;

                                    break;
                                }

                                module_name =
                                    container.module_name.clone();

                                let requested_id =
                                    request
                                        .module_instance_uuid7
                                        .clone();

                                let assigned_id =
                                    {
                                        let modules =
                                            modules.lock().unwrap();

                                        if requested_id.is_empty()
                                            || modules.contains_key(
                                                &requested_id
                                            )
                                        {
                                            loop {
                                                let id =
                                                    Uuid::now_v7()
                                                        .to_string();

                                                if !modules.contains_key(
                                                    &id
                                                ) {
                                                    break id;
                                                }
                                            }
                                        } else {
                                            requested_id.clone()
                                        }
                                    };

                                instance_uuid7 =
                                    assigned_id.clone();

                                authenticated = true;

                                let position =
                                    match request
                                        .process_position
                                        .to_lowercase()
                                        .as_str()
                                    {
                                        "input"
                                        | "inputs" =>
                                            "input",

                                        "preprocess" =>
                                            "preprocess",

                                        "inprocess" =>
                                            "inprocess",

                                        "postprocess"
                                        | "output"
                                        | "outputs"
                                        | "display"
                                        | "post" =>
                                            "postprocess",

                                        _ => "input",
                                    }
                                    .to_string();

                                add_module_to_config(
                                    &config_state,
                                    &module_name,
                                    &position,
                                    request.priority,
                                );

                                {
                                    let mut modules =
                                        modules.lock().unwrap();

                                    modules.insert(
                                        assigned_id.clone(),
                                        ModuleInfo {
                                            name:
                                                module_name.clone(),
                                            instance_uuid7:
                                                assigned_id.clone(),
                                            priority:
                                                request.priority,
                                            process_position:
                                                position.clone(),
                                            state:
                                                ModuleState::Running,
                                            sender:
                                                Some(tx.clone()),
                                        },
                                    );
                                }

                                refresh_ui_modules(
                                    &ui_state,
                                    &modules
                                );

                                log_event(
                                    &ui_state,
                                    format!(
                                        "{} [{}] connected",
                                        module_name,
                                        assigned_id
                                    ),
                                );

                                let response =
                                    Container {
                                        version: 1,
                                        auth_token:
                                            String::new(),
                                        module_name:
                                            "cockatiel".into(),
                                        module_instance_uuid7:
                                            assigned_id.clone(),
                                        payload: Some(
                                            Payload::ConnectionRequestReturn(
                                                cockatiel_protobuf::ConnectionRequestReturn {
                                                    new_port: 0,
                                                    module_instance_uuid7:
                                                        if assigned_id != requested_id {
                                                            assigned_id.clone()
                                                        } else {
                                                            String::new()
                                                        },
                                                }
                                            )
                                        ),
                                    };

                                let mut bytes =
                                    Vec::new();

                                response.encode(
                                    &mut bytes
                                )?;

                                websocket
                                    .send(
                                        Message::Binary(
                                            bytes.into()
                                        )
                                    )
                                    .await?;
                            }

                            Some(
                                Payload::MessagePreProcess(ref message)
                            ) => {
                                if !authenticated {
                                    continue;
                                }

                                let mut next =
                                    container.clone();

                                next.module_instance_uuid7 =
                                    instance_uuid7.clone();

                                broadcast_stage(
                                    &modules,
                                    &config_state,
                                    "preprocess",
                                    &next,
                                )
                                .await;

                                let config =
                                    get_config(
                                        &config_state
                                    );

                                let next_modules =
                                    pipeline_list(
                                        &config,
                                        "inprocess"
                                    );

                                if let Some(module) =
                                    next_modules.first()
                                {
                                    send_to_instance_by_name(
                                        &modules,
                                        &module.name,
                                        next,
                                    )
                                    .await;
                                } else {

                                    let mut final_container = container.clone();

                                    final_container.payload =
                                        Some(
                                            Payload::MessagePostProcess(
                                                cockatiel_protobuf::MessagePostProcess {
                                                    platform: message.platform.clone(),
                                                    raw_data: message.raw_data.clone(),
                                                    user_uuid7: message.user_uuid7.clone(),
                                                    raw_message: message.raw_message.clone(),
                                                    processed_message: String::new(),
                                                    command: message.command.clone(),
                                                    user_data: message.user_data.clone(),
                                                }
                                            )
                                        );

                                    broadcast_stage(
                                        &modules,
                                        &config_state,
                                        "postprocess",
                                        &final_container,
                                    )
                                    .await;
                                }
                            }

                            Some(
                                Payload::MessageInProcess(ref message)
                            ) => {
                                if !authenticated {
                                    continue;
                                }

                                let config =
                                    get_config(
                                        &config_state
                                    );

                                let modules_in_process =
                                    pipeline_list(
                                        &config,
                                        "inprocess"
                                    );

                                let mut next_index = 0;

                                for (
                                    index,
                                    entry
                                ) in modules_in_process
                                    .iter()
                                    .enumerate()
                                {
                                    if entry.name
                                        == module_name
                                    {
                                        next_index =
                                            index + 1;
                                        break;
                                    }
                                }

        let mut final_container =
                                        container.clone();

                                    final_container.payload =
                                        Some(
                                            Payload::MessagePostProcess(
                                                cockatiel_protobuf::MessagePostProcess {
                                                    platform:
                                                        message.platform.clone(), // Added .clone()
                                                    raw_data:
                                                        message.raw_data.clone(), // Added .clone()
                                                    user_uuid7:
                                                        message.user_uuid7.clone(), // Added .clone()
                                                    raw_message:
                                                        message.raw_message.clone(), // Added .clone()
                                                    processed_message:
                                                        String::new(),
                                                    command:
                                                        message.command.clone(), // Added .clone()
                                                    user_data:
                                                        message.user_data.clone(), // Added .clone()
                                                }
                                            )
                                        );
                            }

                            Some(
                                Payload::MessagePostProcess(ref message)
                            ) => {
                                if !authenticated {
                                    continue;
                                }

                                broadcast_stage(
                                    &modules,
                                    &config_state,
                                    "postprocess",
                                    &container,
                                )
                                .await;

                                log_event(
                                    &ui_state,
                                    format!(
                                        "Message finalized from {}",
                                        message.user_uuid7
                                    ),
                                );
                            }

                            Some(
                                Payload::TimelineEvent(ref event)
                            ) => {
                                if !authenticated {
                                    continue;
                                }

                                log_event(
                                    &ui_state,
                                    format!(
                                        "Timeline: {}",
                                        event.i
                                    ),
                                );

                                // Timeline database is a normal module.
                                broadcast_stage(
                                    &modules,
                                    &config_state,
                                    "postprocess",
                                    &container,
                                )
                                .await;
                            }

                            Some(
                                Payload::Log(log)
                            ) => {
                                if authenticated {
                                    log_event(
                                        &ui_state,
                                        format!(
                                            "[{}] {}",
                                            module_name,
                                            log.log
                                        ),
                                    );
                                }
                            }

                            Some(
                                Payload::Err(error)
                            ) => {
                                if authenticated {
                                    log_event(
                                        &ui_state,
                                        format!(
                                            "[{}] ERROR: {}",
                                            module_name,
                                            error.log
                                        ),
                                    );
                                }
                            }

                            Some(
                                Payload::Shutdown(shutdown)
                            ) => {
                                if authenticated {
                                    log_event(
                                        &ui_state,
                                        format!(
                                            "{} shut down: {}",
                                            module_name,
                                            shutdown.reason
                                        ),
                                    );
                                }

                                break;
                            }

                           Some(Payload::CommandPayload(command)) => { if authenticated {
                                    log_event(
                                        &ui_state,
                                        format!(
                                            "{} registered {} commands",
                                            module_name,
                                            command.command_flags.len()
                                        ),
                                    );
                                }
                            }

                            Some(Payload::CommandsPayload(commands)) => {
                                if authenticated {
                                    log_event(
                                        &ui_state,
                                        format!(
                                            "{} registered {} commands",
                                            module_name,
                                            commands.commands.len()
                                        ),
                                    );
                                }
                            }

                            Some(Payload::UserData(user)) => {
                                if authenticated {
                                    log_event(
                                        &ui_state,
                                        format!(
                                            "User update: {}",
                                            user.username
                                        ),
                                    );
                                }
                            }

                            Some(Payload::AuthVerify(_))
                            | Some(Payload::AuthNew(_))
                            | Some(Payload::ConnectionRequestReturn(_))
                            | None => {}
                        }
                    }

                    outbound = rx.recv() => {
                        let Some(outbound) =
                            outbound
                        else {
                            break;
                        };

                        let mut bytes =
                            Vec::new();

                        outbound.encode(
                            &mut bytes
                        )?;

                        if websocket
                            .send(
                                Message::Binary(
                                    bytes.into()
                                )
                            )
                            .await
                            .is_err()
                        {
                            break;
                        }
                    }
                }
    }

    if authenticated {
        let mut modules_guard = modules.lock().unwrap();

        if let Some(module) = modules_guard.get_mut(&instance_uuid7) {
            module.state = ModuleState::Crashed;

            module.sender = None;
        }

        drop(modules_guard);

        refresh_ui_modules(&ui_state, &modules);

        log_event(
            &ui_state,
            format!("{} [{}] disconnected", module_name, instance_uuid7),
        );
    }

    Ok(())
}

async fn send_to_instance_by_name(
    modules: &Arc<Mutex<HashMap<String, ModuleInfo>>>,
    name: &str,
    container: Container,
) {
    let sender = {
        modules
            .lock()
            .unwrap()
            .values()
            .find(|module| module.name == name && module.state == ModuleState::Running)
            .and_then(|module| module.sender.clone())
    };

    if let Some(sender) = sender {
        let _ = sender.send(container).await;
    }
}
