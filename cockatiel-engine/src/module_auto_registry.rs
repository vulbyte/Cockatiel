use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModuleManifest {
    pub name: String,

    #[serde(default)]
    pub description: String,

    #[serde(default)]
    pub version: String,

    #[serde(default)]
    pub capabilities: String,

    #[serde(default)]
    pub root_file: String,

    #[serde(default)]
    pub launch_command: String,

    #[serde(default)]
    pub command_flags: Vec<String>,

    #[serde(default)]
    pub autostart: bool,
}

#[derive(Debug, Clone)]
pub struct DiscoveredModule {
    pub manifest: ModuleManifest,
    pub directory: PathBuf,
}

#[derive(Debug, Default)]
pub struct ModuleRegistry {
    modules: HashMap<String, DiscoveredModule>,
}

impl ModuleRegistry {
    pub fn new() -> Self {
        Self {
            modules: HashMap::new(),
        }
    }

    pub fn discover(&mut self, roots: &[PathBuf]) -> Result<(), Vec<String>> {
        let mut errors = Vec::new();

        for root in roots {
            if !root.exists() {
                continue;
            }

            if !root.is_dir() {
                errors.push(format!(
                    "Module search path is not a directory: {}",
                    root.display()
                ));
                continue;
            }

            let entries = match fs::read_dir(root) {
                Ok(entries) => entries,
                Err(error) => {
                    errors.push(format!(
                        "Could not read module directory {}: {}",
                        root.display(),
                        error
                    ));
                    continue;
                }
            };

            for entry in entries {
                let entry = match entry {
                    Ok(entry) => entry,
                    Err(error) => {
                        errors.push(format!("Could not read module directory entry: {}", error));
                        continue;
                    }
                };

                let path = entry.path();

                if !path.is_dir() {
                    continue;
                }

                match Self::load_manifest(&path) {
                    Ok(Some(module)) => {
                        let name = module.manifest.name.clone();

                        if self.modules.contains_key(&name) {
                            errors.push(format!(
                                "Duplicate module manifest for '{}': {}",
                                name,
                                path.display()
                            ));
                            continue;
                        }

                        self.modules.insert(name, module);
                    }

                    Ok(None) => {}

                    Err(error) => {
                        errors.push(error);
                    }
                }
            }
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors)
        }
    }

    fn load_manifest(directory: &Path) -> Result<Option<DiscoveredModule>, String> {
        let manifest_path = directory.join("cockatiel_module_info.json");

        if !manifest_path.exists() {
            return Ok(None);
        }

        let contents = fs::read_to_string(&manifest_path)
            .map_err(|error| format!("Could not read {}: {}", manifest_path.display(), error))?;

        let manifest: ModuleManifest = serde_json::from_str(&contents).map_err(|error| {
            format!(
                "Invalid module manifest {}: {}",
                manifest_path.display(),
                error
            )
        })?;

        if manifest.name.trim().is_empty() {
            return Err(format!(
                "Module manifest {} has an empty name",
                manifest_path.display()
            ));
        }

        Ok(Some(DiscoveredModule {
            manifest,
            directory: directory.to_path_buf(),
        }))
    }

    pub fn get(&self, name: &str) -> Option<&DiscoveredModule> {
        self.modules.get(name)
    }

    pub fn contains(&self, name: &str) -> bool {
        self.modules.contains_key(name)
    }

    pub fn iter(&self) -> impl Iterator<Item = (&String, &DiscoveredModule)> {
        self.modules.iter()
    }

    pub fn values(&self) -> impl Iterator<Item = &DiscoveredModule> {
        self.modules.values()
    }

    pub fn len(&self) -> usize {
        self.modules.len()
    }
}
