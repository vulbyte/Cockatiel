//#![allow(unused_parens, unused_imports, unused_macros)]
#![allow(warnings)]

use std::io::{self};
use std::path::{Path, PathBuf};
use turso::{Builder, Connection};

macro_rules! db_log {
    ($($arg:tt)*) => {
        println!("[DATABASE]: {}", format!($($arg)*));
    };
}

pub struct Sqlite3Handler {
    use_default_paths: bool,
    pub db_path: PathBuf,
    pub backup_db_path: PathBuf,

    pub connection: Connection,

    listeners: Vec<Box<dyn Fn()>>,
}

impl Sqlite3Handler {
    pub async fn new(&self) /*-> Result<Self, Boxgdyn std::error::Error>>*/
    {
        /*
        self.db_path = PathBuf::from("./data/");
        self.db_path = Self::prompt_new_path(self.db_path, "db_path");
        */

        /*
        self.backup_db_path = PathBuf::from("./data/");
        self.backup_db_path = Self::prompt_new_path(self.backup_db_path, "backup_db_path");
        */

        /*
        Ok(Self {
            self.db_path,
            self.backup_db_path,
            self.connection,
            self.listeners,
        });
        */
    }

    pub fn connect(&mut self, function: Box<dyn Fn()>) {
        self.listeners.push(function);
    }

    /*
    fn prompt_new_path(path: PathBuf, path_name: &str) -> PathBuf {
        let og_path = path;
        let mut input = String::new();

        loop {
            input.clear();
            println!("do you want to use a custom path for {}? (y/n)", path_name);
            io::stdin()
                .read_line(&mut input)
                .expect("failed to read line");
            match input.trim() {
                "q" => std::process::exit(1),
                "n" => {
                    return og_path;
                }
                "y" => {
                    break;
                }
                _ => {
                    println!("input is not y or n, try again or type q to quit");
                    continue;
                }
            }
        }

        loop {
            input.clear();
            println!(
                "what is your new path for {}? (~/ is not accepted, do not include file)",
                path_name
            );
            io::stdin()
                .read_line(&mut input)
                .expect("failed to read line");

            let mut candidate_path = PathBuf::from(input.trim());

            if candidate_path.is_dir() {
                println!("path found, accepting");
                return candidate_path;
            } else {
                println!("path not found, \nsuggestions:\n\tdoes it exist? \n\tdoes cockatiel have the needed perms?");
            }
        }
    }
    */

    /*
    pub fn prompt_new_dir(var_name: string) {
        let mut input:String;
        input.clear();

        println!("do you want to use the default dir for {}?", var_name);
        io::stdin::readline(&mut input;)

        if (input == 'n') {
            let mut path_valid: bool = false;
            let mut path: PathBuf;

            let mut string;

            while (path_valid) == false {
                println!("what is the new path for {}? (~/ does not work, exclude the name, as renaming is not supported)", var_name);
                io::stdin().read_line(&mut string);
                path = PathBuf::from(string.trim());
                if path.is_dir() {
                    println!("path is valid! gj");
                    path_valid = true;
                } else {
                    println!("path is invalid, id the dir correct?");
                    path_valid = false;
                }
            }
        } else {
            db_log!("user chose to use default paths: \n\t db:");
        }

        return path;
    }
    */

    /*
     */
}
