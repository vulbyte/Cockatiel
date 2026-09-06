/*
NOTE: NEVER ADD A DELETE/REMOVE OPTION, ALL DATA HERE IS PUBLIC, THUS NO WORRIES FOR DATA PROTECTIONS, AND THE TIMELINE IS CONSIDERED AN ABSOLUTE SOURCE OF TRUTH, BROKEN DATABASES LIKE THE USER DATABASE SHOULD BE ABLE TO BE REBUILT BY RUNNING THE TIMELINE START TO END.
 */

use rusqlite::{Connection, Result as SqlResult, params};
use uuid::Uuid;

/// Represents a timeline event matching the database schema.
pub struct TimelineEvent {
    pub c: Option<String>,  // command flag
    pub d: Option<Vec<u8>>, // data blob
    pub e: Option<String>,  // raw error trace
    pub f: Option<String>,  // raw string for commands
    pub o: Option<String>,  // platform / origin
    pub p: Option<String>,  // processed message
    pub r: Option<String>,  // raw message
    pub s: Option<String>,  // stream origin ID
    pub t: Option<String>,  // message type
    pub u: Option<Uuid>,    // user UUID7
    pub v: Option<i32>,     // version
}

/// Initializes the SQLite database tables
pub fn init_db(conn: &Connection) -> SqlResult<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS timeline (
            i BLOB PRIMARY KEY,      --UUID7

            c TEXT,                  --command flag (if any)
            d BLOB,                  --dataBlob (ie: json, mp3, png, css, etc)
            e TEXT,                  --rawErrorTrace  (if any)
            f TEXT,                  --raw string for the commands (ie: '-r 1.0 -p 1.0 -v 178')
            o TEXT NOT NULL,         --platform, ie: cockatiel-engine, discord, youtube, etc etc
            p TEXT,                  --processed message (after inprocess modules)
            r TEXT NOT NULL,         --raw message (original input, for archival reasons)
            s TEXT,                  --id of stream origin, ie 'loD-whuR5zc'
            t TEXT NOT NULL,         --message type, ie: message, log, error, etc 
            u BLOB,                  --UUID7, timestamp for when user was first seen
            v INTEGER                --version of timeline message
        )",
        [],
    )?;

    Ok(())
}

/// Appends a timeline event to the database.
/// - Ignores any incoming `i` and generates a fresh UUID7.
/// - If `o` or `t` is empty, it still processes and inserts the row, but returns an error at the end.
/// - If `v` is empty, it defaults to 1.
pub fn add_event(conn: &Connection, event: &TimelineEvent) -> Result<(), String> {
    // 1. Ignore incoming `i` and generate a new UUID7
    let new_id = Uuid::now_v7();
    let id_bytes = new_id.as_bytes();

    // 2. Validate `o` and `t` for emptiness while preparing fallback values for storage
    let o_val = event.o.as_deref().unwrap_or("").to_string();
    let t_val = event.t.as_deref().unwrap_or("'").to_string(); // fallback or empty string

    let mut validation_error = None;
    if o_val.is_empty() {
        validation_error = Some("Origin (o) cannot be empty".to_string());
    }
    if t_val.is_empty() {
        let err_msg = "Message type (t) cannot be empty";
        if let Some(ref mut existing) = validation_error {
            *existing = format!("{}, and {}", existing, err_msg);
        } else {
            validation_error = Some(err_msg.to_string());
        }
    }

    // 3. If v is empty or None, assign 1
    let version = match event.v {
        Some(ver) if ver != 0 => ver,
        _ => 1,
    };

    // Convert optional user UUID to bytes if present
    let u_bytes = event.u.map(|uuid| uuid.as_bytes().to_vec());

    // 4. Process and insert into the database table
    let insert_result = conn.execute(
        "INSERT INTO timeline (i, c, d, e, f, o, p, r, s, t, u, v) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![
            id_bytes.as_slice(),
            event.c,
            event.d,
            event.e,
            event.f,
            o_val,
            event.p,
            event.r.as_deref().unwrap_or(""),
            event.s,
            t_val,
            u_bytes,
            version,
        ],
    );

    if let Err(err) = insert_result {
        return Err(format!("Database insertion error: {}", err));
    }

    // 5. Throw validation error at the end if o or t were empty
    if let Some(err_msg) = validation_error {
        return Err(err_msg);
    }

    Ok(())
}
