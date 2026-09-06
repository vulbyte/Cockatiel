/*
NOTE: NEVER ADD A DELETE/REMOVE OPTION, ALL DATA HERE IS PUBLIC, THUS NO WORRIES FOR DATA PROTECTIONS, AND THE TIMELINE IS CONSIDERED AN ABSOLUTE SOURCE OF TRUTH, BOKEN DATABASES LIKE THE USER DATABASE SHOULD BE ABLE TO BE REBUILT BY RUNNING THE TIMELINE START TO END.
 */

use rusqlite::{Connection, Result as SqlResult, Transaction, params};
use serde_json::{Value, json};
use uuid::Uuid;

/// Initializes the SQLite database tables
pub fn init_db(conn: &Connection) -> SqlResult<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS timeline (
            i BLOB PRIMARY KEY,     --UUID7

            c TEXT,                 --command flag (if any)
            d BLOB,                 --dataBlob (ie: json, mp3, png, css, etc)
            e TEXT,                 --rawErrorTrace  (if any)
            f TEXT,                 --raw string for the commands (ie: '-r 1.0 -p 1.0 -v 178')
            o TEXT NOT NULL,        --platform, ie: cockatiel-engine, discord, youtube, etc etc
            p TEXT,                 --processed message (after inprocess modules (unless abadon flag is thrown))
            r TEXT NOT NULL,        --raw message (original input, for archival reasons) IF ERR HAS A MESSAGE, THAT GOES HERE
            s TEXT,                 --id of stream origin, ie 'loD-whuR5zc'
            t TEXT NOT NULL,        --message type, ie: message, log, error, etc 
            u BLOB,                 --UUID7, timestamp is used for when the user was first seen (if null provide the module uuid)
            v INTEGER,              --cersion of timeline message, if this changes it should be in a different db most likely
        )",
        [],
    )?;

    Ok(())
}

pub fn add_event() {}
