use rusqlite::{params, Connection, Result as SqlResult};
use serde_json::{json, Value};
use uuid::Uuid;

/// Represents a Ban record mapping to the protobuf structure
pub struct ProtoBan {
    pub commender_uuid7: String,
    pub commendee_uuid7: String,
    pub unbanned: bool,
    pub reason: String,
    pub raw_message: String,
    pub appeals: Vec<String>,
}

/// Represents a Commendment record mapping to the protobuf structure
pub struct ProtoCommendment {
    pub commender_uuid7: String,
    pub commendee_uuid7: String,
    pub raw_message: String,
}

/// Represents the parsed UserData proto event for Rust processing
pub struct ProtoUserEvent {
    pub uuid: Option<String>,
    pub username: Option<String>,
    pub is_sponsor: bool,
    pub is_moderator: bool,
    pub is_admin: bool,
    pub is_owner: bool,
    pub bans: Vec<ProtoBan>,
    pub commendments: Vec<ProtoCommendment>,
}

/// Ingests/Upserts a UserData event into the SQLite database.
pub fn upsert_user(conn: &Connection, event: &ProtoUserEvent) -> Result<String, String> {
    let user_uuid = match event.uuid {
        Some(ref u) if !u.is_empty() => u.clone(),
        _ => Uuid::now_v7().to_string(),
    };

    let username_val = event.username.as_deref().unwrap_or("").to_string();
    let mut validation_error = None;
    if username_val.is_empty() {
        validation_error = Some("Username cannot be empty".to_string());
    }

    let now_millis = chrono::Utc::now().timestamp_millis();

    // Format bans into JSON array
    let bans_json: Vec<Value> = event
        .bans
        .iter()
        .map(|b| {
            json!({
                "commender_uuid7": b.commender_uuid7,
                "commendee_uuid7": b.commendee_uuid7,
                "unbanned": b.unbanned,
                "reason": b.reason,
                "raw_message": b.raw_message,
                "appeals": b.appeals
            })
        })
        .collect();

    // Format commendments into JSON array
    let commendments_json: Vec<Value> = event
        .commendments
        .iter()
        .map(|c| {
            json!({
                "commender_uuid7": c.commender_uuid7,
                "commendee_uuid7": c.commendee_uuid7,
                "raw_message": c.raw_message
            })
        })
        .collect();

    // Check if user already exists to merge or initialize
    let existing_json: Option<String> = conn
        .query_row(
            "SELECT data_json FROM users WHERE uuid7 = ?1",
            [&user_uuid],
            |row| row.get(0),
        )
        .ok();

    let final_json_str = if let Some(json_str) = existing_json {
        let mut data: Value = serde_json::from_str(&json_str).unwrap_or_else(|_| json!({}));
        data["username"] = json!(username_val);
        data["isSponsor"] = json!(event.is_sponsor);
        data["isChatModerator"] = json!(event.is_moderator);
        data["isChatAdmin"] = json!(event.is_admin);
        data["isOwner"] = json!(event.is_owner);
        data["channelBans"] = json!(bans_json); // maps to your schema's channelBans/bans list
        data["commendments"] = json!(commendments_json);
        data.to_string()
    } else {
        let initial_json = json!({
            "version": 1,
            "username": username_val,
            "uuid7": user_uuid,
            "channels": {},
            "ttsBans": [],
            "channelBans": bans_json,
            "conduct_score": 0.0,
            "commendments": commendments_json,
            "misconduct": { "discrimination": [], "harassment": [], "spam": [], "integrity": [] },
            "icon": null,
            "isSponsor": event.is_sponsor,
            "isChatModerator": event.is_moderator,
            "isChatAdmin": event.is_admin,
            "isOwner": event.is_owner,
            "isVerified": false,
            "firstSeen": now_millis,
            "points": 0,
            "totalPoints": 0,
            "totalMessages": 0,
            "styling": {}
        });
        initial_json.to_string()
    };

    // Save or update row in SQLite
    let res = conn.execute(
        "INSERT INTO users (uuid7, username, conduct_score, data_json) 
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(uuid7) DO UPDATE SET username = excluded.username, data_json = excluded.data_json",
        params![user_uuid, username_val, 0.0, final_json_str],
    );

    if let Err(err) = res {
        return Err(format!("Database execution error: {}", err));
    }

    if let Some(err_msg) = validation_error {
        return Err(err_msg);
    }

    Ok(user_uuid)
}
