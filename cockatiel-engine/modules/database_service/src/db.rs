use rusqlite::{Connection, Result as SqlResult, Transaction, params};
use serde_json::{Value, json};
use uuid::Uuid;

/// Initializes the SQLite database tables
pub fn init_db(conn: &Connection) -> SqlResult<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS users (
            uuid7 TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            conduct_score REAL NOT NULL,
            data_json TEXT NOT NULL
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS timeline_events (
            event_uuid TEXT PRIMARY KEY,
            user_uuid TEXT NOT NULL,
            platform TEXT NOT NULL,
            raw_message TEXT NOT NULL,
            processed_message TEXT NOT NULL,
            is_final BOOLEAN NOT NULL,
            timestamp TEXT NOT NULL,
            FOREIGN KEY(user_uuid) REFERENCES users(uuid7)
        )",
        [],
    )?;

    Ok(())
}

/// Adds a new user with default JSON schema fields initialized
pub fn add_user(
    conn: &Connection,
    username: &str,
    platform: &str,
    platform_id: &str,
) -> SqlResult<String> {
    let user_uuid = Uuid::now_v7().to_string();
    let now_millis = chrono::Utc::now().timestamp_millis();

    let initial_json = json!({
        "version": 1,
        "username": username,
        "uuid7": user_uuid,
        "channels": {
            platform: [platform_id]
        },
        "ttsBans": [],
        "channelBans": [],
        "conduct_score": 0.0,
        "commendments": { "community": [], "engagement": [], "support": [], "rep": [] },
        "misconduct": { "discrimination": [], "harassment": [], "spam": [], "integrity": [] },
        "icon": null,
        "isSponsor": false,
        "isChatModerator": false,
        "isChatAdmin": false,
        "isVerified": false,
        "firstSeen": now_millis,
        "points": 0,
        "totalPoints": 0,
        "totalMessages": 0,
        "styling": {}
    });

    conn.execute(
        "INSERT INTO users (uuid7, username, conduct_score, data_json) VALUES (?1, ?2, ?3, ?4)",
        params![user_uuid, username, 0.0, initial_json.to_string()],
    )?;

    Ok(user_uuid)
}

/// Removes a user by their UUIDv7
pub fn remove_user(conn: &Connection, user_uuid: &str) -> SqlResult<bool> {
    let rows_affected = conn.execute("DELETE FROM users WHERE uuid7 = ?1", [user_uuid])?;
    Ok(rows_affected > 0)
}

/// Retrieves user data JSON blob
pub fn get_user_data(conn: &Connection, user_uuid: &str) -> SqlResult<Option<Value>> {
    let mut stmt = conn.prepare("SELECT data_json FROM users WHERE uuid7 = ?1")?;
    let mut rows = stmt.query_map([user_uuid], |row| {
        let s: String = row.get(0)?;
        Ok(s)
    })?;

    if let Some(row_res) = rows.next() {
        let json_str = row_res?;
        let val: Value = serde_json::from_str(&json_str).unwrap_or(json!({}));
        Ok(Some(val))
    } else {
        Ok(None)
    }
}

/// Safely merges secondary_uuid into primary_uuid inside a transaction and deletes secondary_uuid
pub fn combine_user(
    tx: &Transaction,
    primary_uuid: &str,
    secondary_uuid: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    // 1. Load primary JSON blob
    let primary_str: String = tx.query_row(
        "SELECT data_json FROM users WHERE uuid7 = ?1",
        [primary_uuid],
        |row| row.get(0),
    )?;
    let mut primary: Value = serde_json::from_str(&primary_str)?;

    // 2. Load secondary JSON blob
    let secondary_str: String = tx.query_row(
        "SELECT data_json FROM users WHERE uuid7 = ?1",
        [secondary_uuid],
        |row| row.get(0),
    )?;
    let secondary: Value = serde_json::from_str(&secondary_str)?;

    // 3. Merge Channels
    if let Some(p_channels) = primary.get_mut("channels").and_then(|v| v.as_object_mut()) {
        if let Some(s_channels) = secondary.get("channels").and_then(|v| v.as_object()) {
            for (platform, s_list) in s_channels {
                if let Some(s_arr) = s_list.as_array() {
                    let entry = p_channels
                        .entry(platform.clone())
                        .or_insert_with(|| json!([]));
                    if let Some(p_arr) = entry.as_array_mut() {
                        for item in s_arr {
                            if !p_arr.contains(item) {
                                p_arr.push(item.clone());
                            }
                        }
                    }
                }
            }
        }
    }

    // 4. Merge numeric fields
    if let Some(p_pts) = primary.get_mut("points").and_then(|v| v.as_i64()) {
        let s_pts = secondary
            .get("points")
            .and_then(|v| v.as_i64())
            .unwrap_or(0);
        primary["points"] = json!(p_pts + s_pts);
    }
    if let Some(p_tpts) = primary.get_mut("totalPoints").and_then(|v| v.as_i64()) {
        let s_tpts = secondary
            .get("totalPoints")
            .and_then(|v| v.as_i64())
            .unwrap_or(0);
        primary["totalPoints"] = json!(p_tpts + s_tpts);
    }
    if let Some(p_tmsg) = primary.get_mut("totalMessages").and_then(|v| v.as_i64()) {
        let s_tmsg = secondary
            .get("totalMessages")
            .and_then(|v| v.as_i64())
            .unwrap_or(0);
        primary["totalMessages"] = json!(p_tmsg + s_tmsg);
    }

    // 5. Merge boolean privilege flags (Logical OR)
    for flag in &["isSponsor", "isChatModerator", "isChatAdmin", "isVerified"] {
        let p_val = primary.get(flag).and_then(|v| v.as_bool()).unwrap_or(false);
        let s_val = secondary
            .get(flag)
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
        primary[*flag] = json!(p_val || s_val);
    }

    // 6. Keep earliest firstSeen timestamp
    let p_first = primary
        .get("firstSeen")
        .and_then(|v| v.as_i64())
        .unwrap_or(i64::MAX);
    let s_first = secondary
        .get("firstSeen")
        .and_then(|v| v.as_i64())
        .unwrap_or(i64::MAX);
    primary["firstSeen"] = json!(std::cmp::min(p_first, s_first));

    // 7. Save merged JSON to primary user record
    let updated_json_str = serde_json::to_string(&primary)?;
    tx.execute(
        "UPDATE users SET data_json = ?1 WHERE uuid7 = ?2",
        params![updated_json_str, primary_uuid],
    )?;

    // 8. Remove the secondary user record
    tx.execute("DELETE FROM users WHERE uuid7 = ?1", [secondary_uuid])?;

    Ok(())
}
