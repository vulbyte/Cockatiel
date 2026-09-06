use serde_json::Value;
use std::fs;
use std::path::Path;

pub struct ConfigManager {
    config_path: String,
}

impl ConfigManager {
    pub fn new(path: &str) -> Self {
        Self {
            config_path: path.to_string(),
        }
    }

    /// Reads the entire JSON and returns the specific module's object
    pub fn get_config(&self, module_name: &str) -> Option<Value> {
        let data = fs::read_to_string(&self.config_path).ok()?;
        let json: Value = serde_json::from_str(&data).ok()?;
        json.get(module_name).cloned()
    }

    /// Updates or inserts a module's config into the master JSON file
    pub fn save_config(&self, module_name: &str, module_config: Value) -> Result<(), String> {
        let mut json: Value = if Path::new(&self.config_path).exists() {
            let data = fs::read_to_string(&self.config_path).unwrap_or_else(|_| "{}".to_string());
            serde_json::from_str(&data).unwrap_or(serde_json::json!({}))
        } else {
            serde_json::json!({})
        };

        json[module_name] = module_config;

        let pretty_json = serde_json::to_string_pretty(&json).map_err(|e| e.to_string())?;
        fs::write(&self.config_path, pretty_json).map_err(|e| e.to_string())?;
        Ok(())
    }
}
