#![allow(unused_parens, unused_imports)]
//vulb
use vulb_lib::random::Random;
//cockatiel stuff
//use cockatiel_protobuf::ModuleEvent;
use cockatiel_protobuf::container;
use prost::Message as ProstMessage; // already defined with tungstenite
                                    //misc
                                    //use prost::Message;
use futures_util::{SinkExt, StreamExt};
//js stuff
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize}; // json parsing // for AuthToken
                                     //std
use std::collections::HashMap;
use std::env;
use std::fs;
use std::io::BufReader; // used for faster file reads
use std::net::SocketAddr;
use std::path;
use std::path::PathBuf;
use std::process;
use std::sync::Arc;
use std::sync::Mutex;
use std::thread;
use std::time;
use std::time::{SystemTime, UNIX_EPOCH};
//tokio
use tokio::net::TcpListener;
use tokio::net::TcpStream;
//tokio_rustls
use tokio_rustls::rustls::pki_types::{CertificateDer, PrivateKeyDer}; // cross platform cypto key and cert wrappers
use tokio_rustls::rustls::ServerConfig;
use tokio_rustls::server::TlsStream;
use tokio_rustls::TlsAcceptor; // async tls async acceptor wrapper
                               //tokio_tungstenite
use tokio_tungstenite::accept_async; //tcp stream //adds .next() and .send() //imports the config struct used to set up tls
use tokio_tungstenite::connect_async; //handles dialing and handshake and websocket
use tokio_tungstenite::tungstenite::protocol::Message;
use tokio_tungstenite::WebSocketStream; // //as OtherMessage; // used for message enum to package/unpackage data // for protobuf communication

//hashmaps are: module_name, tcpsocket(for sending requests);
//socket pools
type PreProcessModules = Arc<Mutex<HashMap<String, SocketAddr>>>; /* modules that will receive a "MessageRaw" protobuf stream before anything has been done and no not rely on syncronicity*/
type InProcessModules = Arc<Mutex<HashMap<String, SocketAddr>>>; /* modules that require an order to be processed */
type PostProcessingModules = Arc<Mutex<HashMap<String, SocketAddr>>>; /* modules that want the message post processing, will receive a MessageProcess Protobuf stream*/

// compiled protobufs module
pub mod cockatiel_protobuf {
    include!(/*moves a rust file into this file*/ concat!(
        /*take the entire string frag as one without spaces or seperators*/
        env!(
            "OUT_DIR" /*dir that is automatically made when generates the protobuf. is apparently a temp hidden directory*/
        ), /*reads the environment at comp time*/
        "/cockatiel_protobuf.rs" /*filename from prost-build assigns to compiled output*/
    ));
}

//for term colors
pub const fg_k: &str = "\x1b[30m";
pub const fg_r: &str = "\x1b[31m";
pub const fg_g: &str = "\x1b[32m";
pub const fg_b: &str = "\x1b[34m";
pub const fg_c: &str = "\x1b[36m";
pub const fg_m: &str = "\x1b[35m";
pub const fg_y: &str = "\x1b[33m";
pub const fg_w: &str = "\x1b[37m";

pub const bg_k: &str = "\x1b[40m";
pub const bg_r: &str = "\x1b[41m";
pub const bg_g: &str = "\x1b[42m";
pub const bg_b: &str = "\x1b[44m";
pub const bg_c: &str = "\x1b[46m";
pub const bg_m: &str = "\x1b[45m";
pub const bg_y: &str = "\x1b[43m";
pub const bg_w: &str = "\x1b[47m";
// --- Reset Modifier ---
pub const rst: &str = "\x1b[0m";

#[derive(Debug, Serialize, Deserialize)] //glerp
pub struct AuthToken {
    pub module_name: String,   // ie: tts
    pub authorized_port: u16,  // new port token is authorized to connect too
    pub authorized_ip: String, // the ip the client is allowed to connect from
    pub exp: usize,            // always local to the host system
}

// for the config file
#[derive(Debug, Serialize, Deserialize)]
pub struct Config {
    pub database_location: String,
    pub backup_database_location: String,
    pub paring_pin: u32,
    pub port: u16,
}

fn generate_new_module_jwt(
    module_name: String,
    authorized_port: u16,
    authorized_ip: String,
) -> Result<String, jsonwebtoken::errors::Error> {
    let config_string: String = get_file("./config.json").expect("failed to read or get config");
    let config: Config = serde_json::from_str(&config_string).unwrap();
    let server_pin = config.paring_pin;

    let experation = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs()
        + (60 * 15); //15min experation due to once connection is established it should be a low risk attack vector

    let auth = AuthToken {
        module_name,
        authorized_port,
        authorized_ip,
        exp: experation as usize,
    };

    let secret = server_pin.to_string();
    encode(
        &Header::default(),
        &auth,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
}

fn verify_module_jwt(token: String, connected_port: u16, module_ip: String) -> bool {
    let config_string = get_file("./config.json").expect("failed to read or get config");
    let config: Config = serde_json::from_str(&config_string).unwrap();
    let server_pin = config.paring_pin;
    let secret = server_pin.to_string();

    let validation = Validation::new(Algorithm::HS256);
    match decode::<AuthToken>(
        &token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &validation,
    ) {
        Ok(data) => {
            data.claims.authorized_port == connected_port && data.claims.authorized_ip == module_ip
        }
        Err(_) => false,
    }
}

//config located at ./config.json
macro_rules! p {
    ($($arg:tt)*) => {
        println!("\x1b[31m[Cockatiel]:\x1b[0m {}\n", format!($($arg)*))
    };
    //log
}

fn confirm_input(prompt: &str, yes_dialog: &str, no_dialog: &str) -> bool {
    // constrains an input to y/n/q, if an invalid input is received then it will re-prompt
    let yes_str = yes_dialog;
    let no_str = no_dialog;

    let mut input: String = Default::default();
    loop {
        println!("{}\n (y/n), or you can enter 'q' to quit", prompt);
        input.clear();
        match std::io::stdin().read_line(&mut input) {
            Ok(_) => {
                let trimmed = input.trim();
                match trimmed {
                    "y" => {
                        p!("{}", yes_str);
                        return true;
                    }
                    "n" => {
                        p!("{}", no_str);
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
                p!("could not read input, closing\n{fg_y}{}{rst}", e);
                panic!();
            }
        }
    }
}

async fn create_config(config_path: PathBuf) -> Result<String, String> {
    /*async because io*/
    let mut r = Random::new();

    let target_file = config_path.join("config.json");
    let pin: u32 = r.num_of_len(6);
    let port: u16 = generate_random_port().await;

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
            p!("config file could not be created.\nerr: {fg_y}{}{rst}\n", e);
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
        return Err("path is a directory, no path given".to_string());
    }

    match fs::read_to_string(&config_path) {
        Ok(contents) => Ok(contents),
        Err(e) => Err(e.to_string()),
    }
}

async fn generate_random_port() -> u16 {
    /*needs to be async due to the test connection*/
    let mut r = Random::new();
    let mut port;
    let default_port: u16 = 9734;

    let mut attempts: u32 = 0;
    loop {
        if attempts < 6 {
            attempts += 1;
        } else {
            return default_port;
        }

        port = r.num_of_len(5);
        if port > 1024 && port < 65535 {
            match TcpListener::bind(format!("127.0.0.1:{}", port)).await {
                Ok(_) => {
                    return port as u16;
                }
                Err(e) => {
                    p!("port is occupied cannot bind: {}", e);
                }
            };
        } else {
            return default_port;
        }
    }
}

async fn verify_config() -> String {
    /*io blocker*/
    let config: String = match get_file("./config.json") {
        Ok(config) => config,
        Err(err) => {
            p!("{fg_r}{}{rst}", err);
            println!("config file wasn't found at {fg_y}{}{rst} (location is dynamic to where applicaiton is ran from), do you want to make a new config? (y/n), \n\tif you select no, the program will end so you can move the file into the right spot and try again.",
                match env::current_dir(){
                    Ok(path)=>{path.to_str().expect("invalid utf-8").to_string()},
                    Err(e) => {format!("path unavailable\n {fg_r}{}{rst}", e)}
                }
            );
            let mut input = String::new();
            std::io::stdin()
                .read_line(&mut input)
                .expect("failed to read line");
            let trimmed = input.trim();
            if trimmed == "n" {
                process::exit(0);
            }
            let dir = match env::current_dir() {
                Ok(path) => path,
                Err(e) => {
                    p!("could not get current dir {fg_r}{}{rst}", e);
                    panic!();
                }
            };
            match create_config(dir).await {
                Ok(new_config) => new_config,
                Err(err) => {
                    p!("could not create config {fg_r}{}{rst}", err);
                    panic!();
                }
            }
        }
    };

    p!(
        "current config found is: \n{fg_y}{}{rst}\n\n is this correct? (y/n)",
        config
    );

    loop {
        let mut is_config_correct: String = String::new();
        match std::io::stdin().read_line(&mut is_config_correct) {
            Ok(_) => {
                let trimmed = is_config_correct.trim();
                match trimmed {
                    "y" => {
                        p!("epic");
                        return config;
                    }
                    "n" => {
                        p!("okay, edit the config file located at './config.json' to the correct values, then try again");
                        process::exit(0);
                    }
                    _ => {
                        p!("input invalid, please try again");
                        continue;
                    }
                }
            }
            Err(e) => {
                p!("could not read input, closing\n{fg_y}{}{rst}", e);
                panic!();
            }
        }
    }
}

fn check_if_connection_is_verified<S>(
    map: HashMap<String, SocketAddr>,
    connection: WebSocketStream<S>,
) -> Result<bool, Box<dyn std::error::Error>> {
    /*
    loop {
        if () {}
    }
    */
    return Ok(false);
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("cargo:retun-if-changed=proto/cockatiel_protobuf.proto");

    // Note: It's heavily recommended to put prost_build in a build.rs script rather than inside main()
    /*
    prost_build::compile_protos(
        &["proto/cockatiel_protobuf.proto"], // path to specific protofile
        &["proto/"], //root dir to searc hfor .proto file import
    )?;
    */

    let _args: Vec<String> = env::args().collect();
    let preprocess_modules: PreProcessModules = Arc::new(Mutex::new(HashMap::new()));
    let inprocess_modules: InProcessModules = Arc::new(Mutex::new(HashMap::new()));
    let postprocessing_modules: PostProcessingModules = Arc::new(Mutex::new(HashMap::new()));

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
    let config: Config = match serde_json::from_str(&config_string) {
        Ok(conf) => conf,
        Err(e) => {
            p!("failed to parse config and turn it into readable values. please tryagain, please try use a json validator like: https://jsonlint.com/ (not affiliated); \n\tif it is not able to be parsed you will need to create a new config.
            \n\t{fg_y}your config contains sensitive data, it is recommended you only share it with people you trust{rst}\n{fg_y}{}{rst}", e);
            panic!();
        }
    };

    let con_input: bool = confirm_input(
        &format!("current config is: {:?}, is this correct?", config),
        "awesome, continuing",
        &format!(
            "okay, we can't adjust that do please visit visit {:?}/config.json to adjust the file",
            env::current_dir()
        ),
    );
    match con_input {
        false => {
            p!(
                "alrighty, exiting the program {}",
                "glooluluuululu".to_string()
            );
            process::exit(1);
        }
        true => {
            p!(
                "alrighty, starting the program {}",
                "glooluluuululu".to_string()
            );
        }
    };

    let bind_addr = format!("0.0.0.0:{}", config.port);
    let handshake_port = TcpListener::bind(&bind_addr)
        .await
        .expect("Failed to bind to port");
    p!("Listening for connections on {}", bind_addr);

    // Accept loop for incoming TCP connections
    loop {
        match handshake_port.accept().await {
            Ok((stream, peer_address)) => {
                let preprocess_modules = Arc::clone(&preprocess_modules);
                let inprocess_modules = Arc::clone(&inprocess_modules);
                let postprocessing_modules = Arc::clone(&postprocessing_modules);
                let paring_pin = config.paring_pin;

                // spawn a new async thread to handle the websocket package
                tokio::spawn(async move {
                    let mut websocket_stream = match accept_async(stream).await {
                        Ok(ws) => {
                            p!("websocket accepted {}", peer_address);
                            ws
                        }
                        Err(_e) => {
                            p!("websocket connection failed {}", peer_address);
                            return; // Stop processing this connection
                        }
                    };

                    let mut package = Vec::new();
                    while let Some(pkg) = websocket_stream.next().await {
                        // Note the added `.next()` here
                        match pkg {
                            Ok(p) if p.is_binary() => {
                                package = p.into_data();
                                break;
                            }
                            _ => {
                                p!(
                                    "package received from {fg_y}{:?}{rst} is not binary data ",
                                    peer_address
                                );
                            }
                        };
                    }

                    let decode = match cockatiel_protobuf::Container::decode(package.as_ref()) {
                        Ok(decode) => {
                            // Note: `decode.module_name` must be defined in your Protobuf Container structure!
                            p!("received and decoded packet");
                            decode
                        }
                        Err(e) => {
                            p!("could not process binary from websocket\n{}", e);
                            return; // Early return out of the tokio spawn task if decode fails
                        }
                    };

                    /*match check_if_connection_is_valid(ws) => {
                        Ok(is_valid) => {
                            if(!is_valid){
                                p!("connection is not valid, denying further processing");
                                return;
                            }
                            p!("connection determined as valid, continuing");
                        },
                        Err(e) => {
                            p!("checking_if_connection_is_valid error'd, denying further processing.\n{fg_r}{}{rst}");
                            return;
                        }
                    }*/

                    match decode.payload {
                        //MATCH THE MESSAGE NAME NOT THE VAR NAME
                        Some(cockatiel_protobuf::container::Payload::ConnectionRequest(data)) => {
                            p!("RECEIVED ConnectionRequest \n{fg_g}{:?}{rst}", data);
                            if data.pin != paring_pin as i32 {
                                p!("connection was attempted, but the pin was incorrect. your pin: {fg_r}{}{rst}, submitted pin: {fg_r}{}{rst}", paring_pin, data.pin);
                                return;
                            }
                            let web_ui_connected: bool = false; /*placeholder*/
                            if web_ui_connected {
                                /*whatever format i sebtle on for transfering prompts to the web client*/
                            } else {
                                match confirm_input(
                                    &format!("got a connection request from module at ip {}.\ndo you want to allow this module to connect? (y/n) \n{fg_g}the pin given was valid{rst}", peer_address), 
                                    "connection allowed",
                                    "connection denied"
                                ) {
                                    false => {
                                        p!("connection denied, refusing input");
                                        drop(websocket_stream);
                                        return;
                                    },
                                    true => {},
                                }
                            }

                            // GENERATE AUTH
                            let new_port = generate_random_port().await;
                            let client_ip = peer_address.ip().to_string();
                            // Ensure module_name exists on data struct or use a fallback
                            let auth_token = match generate_new_module_jwt(
                                "Unknown_Module".to_string(), // Fallback if module_name doesn't exist
                                new_port,
                                client_ip,
                            ) {
                                Ok(token) => token,
                                Err(e) => {
                                    p!("failed to generate auth token \n{fg_y}{}{rst}", e);
                                    return;
                                }
                            };

                            // Note: You must ensure `cockatiel_protobuf::ConnectionRequestReturn` matches your exact generated protobuf
                            /*
                            let response_payload = cockatiel_protobuf::ConnectionRequestReturn{
                                assigned_port: new_port as u32,
                                token: auth_token,
                            };
                            let container = cockatiel_protobuf::Container {
                                payload: Some(cockatiel_protobuf::container::Payload::NewConnectionResponse(response_payload)),
                            };
                            let encoded_bytes = container.encoded_len(); // Then actually encode it!
                            */

                            // placeholder for sending encoded data:
                            let encoded_bytes = vec![0u8; 10];

                            if let Err(e) =
                                websocket_stream.send(Message::Binary(encoded_bytes)).await
                            {
                                p!("failed to send response. \n{fg_r}{}{rst}", e);
                                return;
                            }

                            // ADD TO ARRAY
                            p!("connection confirmed");
                            // Ensure process_position exists on your data struct
                            /*
                            match data.process_position.to_lowercase().as_str() {
                                "preprocessed" => {
                                    p!("adding module to preprocessed modules");
                                    preprocess_modules.lock().unwrap().insert(data.module_name.clone(), peer_address);
                                },
                                "inprocess" => {
                                    p!("adding module to inprocessed modules");
                                    inprocess_modules.lock().unwrap().insert(data.module_name.clone(), peer_address);
                                },
                                "postprocess" => {
                                    p!("adding module to postprocessed modules");
                                    postprocessing_modules.lock().unwrap().insert(data.module_name.clone(), peer_address);
                                },
                                _ => {
                                    p!("invalid input for key process_position:{}", data.process_position);
                                }
                            }
                            */
                        }
                        Some(cockatiel_protobuf::container::Payload::ConnectionRequestReturn(
                            _data,
                        )) => {
                            p!("ConnectionRequestReturn is not something cockatiel should handle. denying request");
                            drop(websocket_stream);
                        }
                        Some(cockatiel_protobuf::container::Payload::AuthVerify(data)) => {
                            p!("RECEIVED AuthVerify \n{fg_g}{:?}{rst}", data);
                        }
                        Some(cockatiel_protobuf::container::Payload::AuthNew(data)) => {
                            p!("RECEIVED AuthNew \n{fg_g}{:?}{rst}", data);
                        }
                        Some(cockatiel_protobuf::container::Payload::CommandsPayload(data)) => {
                            p!("RECEIVED CommandsPayload \n{fg_g}{:?}{rst}", data);
                        }
                        Some(cockatiel_protobuf::container::Payload::MessageRaw(data)) => {
                            p!("RECEIVED MessageRaw \n{fg_g}{:?}{rst}", data);
                        }
                        Some(cockatiel_protobuf::container::Payload::MessageProcessed(data)) => {
                            p!("RECEIVED MessageProcessed \n{fg_g}{:?}{rst}", data);
                        }
                        Some(cockatiel_protobuf::container::Payload::TimelineEvent(data)) => {
                            p!("RECEIVED TimelineEvent \n{fg_g}{:?}{rst}", data);
                        }
                        Some(cockatiel_protobuf::container::Payload::UserData(data)) => {
                            p!("RECEIVED UserData \n{fg_g}{:?}{rst}", data);
                        }
                        None => {
                            p!("MESSAGE RECEIVED IS NOT VALID/EMPTY");
                        }
                    };
                });
            }
            Err(e) => {
                p!("Error accepting connection: {}", e);
            }
        }
    }
}
