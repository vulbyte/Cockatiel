//#![allow(unused_parens, unused_imports)]
#![allow(warnings)]

use std::string;
use std::time::{self, SystemTime};
use uuid::Uuid;

struct UnitIntervalGenerator {
    state: u32,
}

impl UnitIntervalGenerator {
    fn new() -> Self {
        let now = SystemTime::now();
        let seed = now
            .duration_since(time::UNIX_EPOCH)
            .map(|d| d.as_nanos() as u32)
            .unwrap_or(621429);

        return Self { state: seed };
    }

    fn next(&mut self) -> u32 {
        //let m: u32 = 2u32.pow(32);
        let a: u32 = 1103515245;
        let c: u32 = 12345;

        self.state = a.wrapping_mul((self.state).wrapping_add(c)); //% m;
        return self.state;
    }

    fn next_u32(&mut self) -> u32 {
        return self.next();
    }

    fn next_f32(&mut self) -> f32 {
        return (&self.next() / (2u32.pow(32))) as f32;
    }
}

pub struct Random {
    uig: UnitIntervalGenerator,
}

impl Random {
    pub fn new() -> Self {
        Self {
            uig: UnitIntervalGenerator::new(),
        }
    }

    pub fn next_u32(&mut self) -> u32 {
        return self.uig.next_u32();
    }

    pub fn next_f32(&mut self) -> f32 {
        return self.uig.next_f32();
    }

    pub fn new_uuid7(&mut self) -> Uuid {
        return Uuid::now_v7();
    }

    pub fn num_of_len(&mut self, len: usize) -> u32 {
        let mut next_str = self.next_u32().to_string();

        if (next_str.len() < len as usize) {
            next_str = format!("{:0>width$}", next_str, width = len);
        } else if (next_str.len() > len as usize) {
            next_str = (&next_str[len..]).to_string();
        }

        let parsed: u32 = next_str.parse().unwrap();
        match next_str.parse::<u32>() {
            Ok(res) => {
                return res;
            }
            Err(err) => {
                return 8123;
            }
        };
    }
}
