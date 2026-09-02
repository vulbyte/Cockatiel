//! End-to-end known-answer tests for the key schedule.
//!
//! The in-crate unit tests only check that key expansion reproduces the FIPS
//! 197 round-key words. These tests run a full cipher with the resulting round
//! keys and compare against the official FIPS 197 Appendix C ciphertexts, which
//! is the only way to catch a round key that is numerically right but laid out
//! in the wrong byte order for the round function.

use softaes::key_schedule as protected;
use softaes::unprotected::key_schedule::*;
use softaes::unprotected::{Block, SoftAes};

fn unhex<const N: usize>(s: &str) -> [u8; N] {
    let mut out = [0u8; N];
    for (i, byte) in out.iter_mut().enumerate() {
        *byte = u8::from_str_radix(&s[2 * i..2 * i + 2], 16).unwrap();
    }
    out
}

fn encrypt(pt: &[u8; 16], ks: &[Block]) -> [u8; 16] {
    let last = ks.len() - 1;
    let mut st = Block::from_bytes(pt).xor(&ks[0]);
    for rk in &ks[1..last] {
        st = SoftAes::block_encrypt(&st, rk);
    }
    SoftAes::block_encrypt_last(&st, &ks[last]).to_bytes()
}

fn decrypt(ct: &[u8; 16], dks: &[Block]) -> [u8; 16] {
    let last = dks.len() - 1;
    let mut st = Block::from_bytes(ct).xor(&dks[0]);
    for rk in &dks[1..last] {
        st = SoftAes::block_decrypt(&st, rk);
    }
    SoftAes::block_decrypt_last(&st, &dks[last]).to_bytes()
}

const PLAINTEXT: &str = "00112233445566778899aabbccddeeff";

#[test]
fn aes128_known_answer() {
    let key = unhex::<16>("000102030405060708090a0b0c0d0e0f");
    let pt = unhex::<16>(PLAINTEXT);
    let ct = unhex::<16>("69c4e0d86a7b0430d8cdb78070b4c55a");

    let ks = key_expansion_128(&key);
    assert_eq!(encrypt(&pt, &ks), ct, "AES-128 encrypt");

    // Both the plain and the optimized inverse schedules must round-trip.
    assert_eq!(decrypt(&ct, &inverse_key_schedule_128(&ks)), pt);
    assert_eq!(decrypt(&ct, &optimized_inverse_key_schedule_128(&ks)), pt);
}

#[test]
fn aes192_known_answer() {
    let key = unhex::<24>("000102030405060708090a0b0c0d0e0f1011121314151617");
    let pt = unhex::<16>(PLAINTEXT);
    let ct = unhex::<16>("dda97ca4864cdfe06eaf70a0ec0d7191");

    let ks = key_expansion_192(&key);
    assert_eq!(encrypt(&pt, &ks), ct, "AES-192 encrypt");

    assert_eq!(decrypt(&ct, &inverse_key_schedule_192(&ks)), pt);
    assert_eq!(decrypt(&ct, &optimized_inverse_key_schedule_192(&ks)), pt);
}

#[test]
fn aes256_known_answer() {
    let key = unhex::<32>("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f");
    let pt = unhex::<16>(PLAINTEXT);
    let ct = unhex::<16>("8ea2b7ca516745bfeafc49904b496089");

    let ks = key_expansion_256(&key);
    assert_eq!(encrypt(&pt, &ks), ct, "AES-256 encrypt");

    assert_eq!(decrypt(&ct, &inverse_key_schedule_256(&ks)), pt);
    assert_eq!(decrypt(&ct, &optimized_inverse_key_schedule_256(&ks)), pt);
}

/// The constant-time (protected) schedule must produce the exact same round
/// keys as the table-based one, so the KATs above cover it too.
#[test]
fn protected_schedule_matches_unprotected() {
    let key128 = unhex::<16>("000102030405060708090a0b0c0d0e0f");
    let p = protected::key_expansion_128(&key128);
    let u = key_expansion_128(&key128);
    for i in 0..11 {
        assert_eq!(p[i].to_bytes(), u[i].to_bytes(), "AES-128 round key {i}");
    }

    let key192 = unhex::<24>("000102030405060708090a0b0c0d0e0f1011121314151617");
    let p = protected::key_expansion_192(&key192);
    let u = key_expansion_192(&key192);
    for i in 0..13 {
        assert_eq!(p[i].to_bytes(), u[i].to_bytes(), "AES-192 round key {i}");
    }

    let key256 = unhex::<32>("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f");
    let p = protected::key_expansion_256(&key256);
    let u = key_expansion_256(&key256);
    for i in 0..15 {
        assert_eq!(p[i].to_bytes(), u[i].to_bytes(), "AES-256 round key {i}");
    }
}
