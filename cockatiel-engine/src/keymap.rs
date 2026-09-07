use crossterm::event::{KeyCode, KeyEvent, KeyModifiers};
use serde::{Deserialize, Serialize};
use std::{fs, path::Path};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Keymap {
    pub quit: Vec<String>,
    pub force_quit: Vec<String>,

    pub up: Vec<String>,
    pub down: Vec<String>,
    pub left: Vec<String>,
    pub right: Vec<String>,

    pub select: Vec<String>,
    pub back: Vec<String>,

    pub pause: Vec<String>,
    pub restart: Vec<String>,
    pub shutdown: Vec<String>,

    pub inspect: Vec<String>,

    pub start_all: Vec<String>,
    pub stop_all: Vec<String>,

    pub module_next: Vec<String>,
    pub module_previous: Vec<String>,
}

impl Default for Keymap {
    fn default() -> Self {
        Self {
            quit: vec!["q".into(), "esc".into()],
            force_quit: vec!["ctrl+c".into()],

            up: vec!["up".into(), "k".into()],
            down: vec!["down".into(), "j".into()],
            left: vec!["left".into(), "h".into()],
            right: vec!["right".into(), "l".into()],

            select: vec!["enter".into()],
            back: vec!["esc".into()],

            pause: vec!["p".into()],
            restart: vec!["r".into()],
            shutdown: vec!["s".into()],

            inspect: vec!["i".into()],

            start_all: vec!["a".into()],
            stop_all: vec!["shift+a".into()],

            module_next: vec!["tab".into()],
            module_previous: vec!["backtab".into()],
        }
    }
}

impl Keymap {
    pub fn load(path: impl AsRef<Path>) -> Self {
        let path = path.as_ref();

        if !path.exists() {
            let default = Self::default();

            if let Ok(json) = serde_json::to_string_pretty(&default) {
                let _ = fs::write(path, json);
            }

            return default;
        }

        match fs::read_to_string(path) {
            Ok(contents) => match serde_json::from_str(&contents) {
                Ok(keymap) => keymap,

                Err(error) => {
                    eprintln!("[Cockatiel] Invalid keymap.json: {}", error);

                    Self::default()
                }
            },

            Err(error) => {
                eprintln!("[Cockatiel] Could not read keymap.json: {}", error);

                Self::default()
            }
        }
    }

    pub fn matches(&self, binding: &[String], key: &KeyEvent) -> bool {
        binding.iter().any(|binding| key_matches(binding, key))
    }
}

fn key_matches(binding: &str, key: &KeyEvent) -> bool {
    let binding = binding.to_lowercase();

    let parts: Vec<&str> = binding.split('+').collect();

    let key_name = parts.last().unwrap_or(&"");

    let mut modifiers = KeyModifiers::empty();

    for part in &parts[..parts.len().saturating_sub(1)] {
        match *part {
            "ctrl" | "control" => {
                modifiers |= KeyModifiers::CONTROL;
            }

            "shift" => {
                modifiers |= KeyModifiers::SHIFT;
            }

            "alt" => {
                modifiers |= KeyModifiers::ALT;
            }

            "super" | "cmd" | "command" | "meta" => {
                modifiers |= KeyModifiers::SUPER;
            }

            _ => {}
        }
    }

    if key.modifiers != modifiers {
        return false;
    }

    match *key_name {
        "up" => key.code == KeyCode::Up,
        "down" => key.code == KeyCode::Down,
        "left" => key.code == KeyCode::Left,
        "right" => key.code == KeyCode::Right,

        "enter" | "return" => key.code == KeyCode::Enter,

        "esc" | "escape" => key.code == KeyCode::Esc,

        "tab" => key.code == KeyCode::Tab,

        "backtab" => key.code == KeyCode::BackTab,

        "backspace" => key.code == KeyCode::Backspace,

        "delete" => key.code == KeyCode::Delete,

        value if value.len() == 1 => key.code == KeyCode::Char(value.chars().next().unwrap()),

        _ => false,
    }
}
