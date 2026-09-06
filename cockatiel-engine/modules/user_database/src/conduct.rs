use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

const SECONDS_PER_YEAR: f64 = 365.25 * 24.0 * 3600.0;
const COMMENDATION_POINT_VALUE: f64 = 300_000.0;
const ONE_HOUR_IN_SECONDS: u64 = 3600;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ConductRank {
    Trash,    // Multiplier 0.5x
    Dirt,     // No chat customization
    Concrete, // Hidden from chat
    Copper,   // Multiplier 0.75x
    Bronze,   // Multiplier 0.85x
    Silver,   // Neutral / Baseline
    Gold,     // Multiplier 1.1x
    Platinum, // Trusted tier: no negative points
    Diamond,  // Multiplier 1.2x
    Obsidian, // Can send GIFs
    Opal,     // Multiplier 1.5x
}

impl ConductRank {
    pub fn score_multiplier(&self) -> f64 {
        match self {
            ConductRank::Trash => 0.5,
            ConductRank::Copper => 0.75,
            ConductRank::Bronze => 0.85,
            ConductRank::Gold => 1.1,
            ConductRank::Diamond => 1.2,
            ConductRank::Opal => 1.5,
            _ => 1.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommendationRecord {
    pub id: String,
    pub sender_id: String,
    pub created_at: DateTime<Utc>,
    pub message_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BanRecord {
    pub id: String,
    pub duration_seconds: u64,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConductEvaluation {
    pub conduct_score: f64, // Scaled between -5.0 and +5.0
    pub rank: ConductRank,
    pub total_points: u64,
    pub effective_commendations: f64,
    pub effective_bans: f64,
}

/// Calculates the time-decay weight $W_{\text{time}}(t) = e^{-0.5108 \cdot t} \cdot (1 - \frac{t}{3})$
/// - 0 to 1 year: weighted heavily (~1.0 to 0.6)
/// - 1 to 2 years: ~0.6 to 0.3
/// - 2 to 3 years: ~0.3 to 0.0
/// - > 3 years: 0.0
fn calculate_time_weight(event_time: DateTime<Utc>, now: DateTime<Utc>) -> f64 {
    let elapsed_seconds = (now - event_time).num_seconds() as f64;
    if elapsed_seconds < 0.0 {
        return 1.0;
    }

    let age_in_years = elapsed_seconds / SECONDS_PER_YEAR;
    if age_in_years >= 3.0 {
        return 0.0;
    }

    let exp_decay = (-0.5108 * age_in_years).exp();
    let linear_cutoff = 1.0 - (age_in_years / 3.0);
    exp_decay * linear_cutoff
}

/// Calculates sender anti-spam weight: $W_{\text{sender}}(n) = e^{-0.1738 \cdot (n - 1)}$
/// - 1st occurrence: 100% (1.0)
/// - 50th occurrence: ~0.02% (0.0002)
fn calculate_sender_weight(occurrence_index: usize) -> f64 {
    if occurrence_index == 0 {
        return 0.0;
    }
    let n = occurrence_index as f64;
    (-0.1738 * (n - 1.0)).exp()
}

/// Evaluates a user's conduct score (-5.0 to +5.0) and determines their ConductRank
pub fn evaluate_conduct_score(
    raw_activity_points: u64,
    commendations: &[CommendationRecord],
    bans: &[BanRecord],
    now: DateTime<Utc>,
) -> ConductEvaluation {
    // 1. Process Commendations (Time-decayed & Sender anti-spam tapered)
    let mut sorted_commendations = commendations.to_vec();
    sorted_commendations.sort_by_key(|c| c.created_at);

    let mut sender_counts: HashMap<String, usize> = HashMap::new();
    let mut total_effective_commendations = 0.0;

    for comm in &sorted_commendations {
        let time_w = calculate_time_weight(comm.created_at, now);
        if time_w <= 0.0 {
            continue;
        }

        let count = sender_counts.entry(comm.sender_id.clone()).or_insert(0);
        *count += 1;

        let sender_w = calculate_sender_weight(*count);
        total_effective_commendations += time_w * sender_w;
    }

    // 2. Process Bans (Ignore timeouts and bans < 1 hour)
    let mut total_effective_bans = 0.0;
    for ban in bans {
        if ban.duration_seconds < ONE_HOUR_IN_SECONDS {
            continue; // Ignore joke bans / short timeouts
        }

        let time_w = calculate_time_weight(ban.created_at, now);
        if time_w <= 0.0 {
            continue;
        }

        total_effective_bans += time_w;
    }

    // 3. Compute Net Score Points
    let commendation_pts = total_effective_commendations * COMMENDATION_POINT_VALUE;
    let ban_penalty_pts = total_effective_bans * COMMENDATION_POINT_VALUE;

    let net_points = (raw_activity_points as f64 + commendation_pts - ban_penalty_pts).max(0.0);

    // 4. Map Net Points to -5.0 ... +5.0 Conduct Scale
    // - Score scale reference: 0 pts = -1.0 (Bronze/Silver border), 1M pts = +1.0 (Gold), 3M+ pts = +5.0 (Opal)
    let raw_conduct_score = if net_points < COMMENDATION_POINT_VALUE {
        // Below 300k pts maps between -5.0 and 0.0
        -5.0 + (net_points / COMMENDATION_POINT_VALUE) * 5.0
    } else {
        // Above 300k pts scales linearly up to +5.0
        ((net_points - COMMENDATION_POINT_VALUE) / (COMMENDATION_POINT_VALUE * 10.0)).min(5.0)
    };

    let conduct_score = (raw_conduct_score * 100.0).round() / 100.0;

    // 5. Determine Rank Tier based on conduct_score
    let rank = match conduct_score {
        s if s <= -4.0 => ConductRank::Trash,
        s if s <= -3.0 => ConductRank::Dirt,
        s if s <= -2.0 => ConductRank::Concrete,
        s if s <= -1.0 => ConductRank::Copper,
        s if s <= 0.0 => ConductRank::Bronze,
        s if s <= 1.0 => ConductRank::Silver,
        s if s <= 2.0 => ConductRank::Gold,
        s if s <= 3.0 => ConductRank::Platinum,
        s if s <= 4.0 => ConductRank::Diamond,
        s if s <= 4.5 => ConductRank::Obsidian,
        _ => ConductRank::Opal,
    };

    ConductEvaluation {
        conduct_score,
        rank,
        total_points: net_points as u64,
        effective_commendations: (total_effective_commendations * 100.0).round() / 100.0,
        effective_bans: (total_effective_bans * 100.0).round() / 100.0,
    }
}
