use std::time::{Duration, SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct Instant {
    pub secs: i64,
    pub micros: u32,
}

impl Instant {
    pub fn to_system_time(self) -> SystemTime {
        if self.secs >= 0 {
            UNIX_EPOCH + Duration::new(self.secs as u64, self.micros * 1000)
        } else {
            let positive_secs = (-self.secs) as u64;

            if self.micros > 0 {
                // We have partial seconds that reduce the negative offset
                // Need to borrow 1 second and subtract the remainder
                let nanos_to_subtract = (1_000_000 - self.micros) * 1000;
                UNIX_EPOCH - Duration::new(positive_secs - 1, nanos_to_subtract)
            } else {
                // Exactly N seconds before epoch
                UNIX_EPOCH - Duration::new(positive_secs, 0)
            }
        }
    }
}

impl<T: chrono::TimeZone> From<chrono::DateTime<T>> for Instant {
    fn from(value: chrono::DateTime<T>) -> Self {
        Instant {
            secs: value.timestamp(),
            micros: value.timestamp_subsec_micros(),
        }
    }
}

pub trait Clock {
    fn now(&self) -> Instant;
}
