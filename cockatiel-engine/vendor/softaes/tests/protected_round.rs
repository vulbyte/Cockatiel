use softaes::unprotected::{Block as UBlock, SoftAes as USoftAes};
use softaes::{key_schedule as ct, Block, SoftAes};

// A tiny xorshift generator so the test stays deterministic without rand.
fn next(state: &mut u64) -> u64 {
    let mut x = *state;
    x ^= x << 13;
    x ^= x >> 7;
    x ^= x << 17;
    *state = x;
    x
}

fn block16(state: &mut u64) -> [u8; 16] {
    let mut out = [0u8; 16];
    out[0..8].copy_from_slice(&next(state).to_le_bytes());
    out[8..16].copy_from_slice(&next(state).to_le_bytes());
    out
}

/// Every constant-time round must agree byte-for-byte with the table-based round
/// it mirrors. The table path is checked against the FIPS 197 vectors in kat.rs,
/// so matching it pins the bitsliced inverse round to the standard too.
#[test]
fn protected_rounds_match_table_rounds() {
    let mut state = 0x0123_4567_89ab_cdef;
    for _ in 0..100_000 {
        let blk = block16(&mut state);
        let rk = block16(&mut state);

        let p = Block::from_bytes(&blk);
        let prk = Block::from_bytes(&rk);
        let u = UBlock::from_bytes(&blk);
        let urk = UBlock::from_bytes(&rk);

        assert_eq!(
            SoftAes::block_encrypt(&p, &prk).to_bytes(),
            USoftAes::block_encrypt(&u, &urk).to_bytes(),
            "block_encrypt"
        );
        assert_eq!(
            SoftAes::block_encrypt_last(&p, &prk).to_bytes(),
            USoftAes::block_encrypt_last(&u, &urk).to_bytes(),
            "block_encrypt_last"
        );
        assert_eq!(
            SoftAes::block_decrypt(&p, &prk).to_bytes(),
            USoftAes::block_decrypt(&u, &urk).to_bytes(),
            "block_decrypt"
        );
        assert_eq!(
            SoftAes::block_decrypt_last(&p, &prk).to_bytes(),
            USoftAes::block_decrypt_last(&u, &urk).to_bytes(),
            "block_decrypt_last"
        );
    }
}

fn unhex<const N: usize>(s: &str) -> [u8; N] {
    let mut out = [0u8; N];
    for (i, byte) in out.iter_mut().enumerate() {
        *byte = u8::from_str_radix(&s[2 * i..2 * i + 2], 16).unwrap();
    }
    out
}

fn ct_encrypt(pt: &[u8; 16], ks: &[Block]) -> [u8; 16] {
    let last = ks.len() - 1;
    let mut st = Block::from_bytes(pt).xor(&ks[0]);
    for rk in &ks[1..last] {
        st = SoftAes::block_encrypt(&st, rk);
    }
    SoftAes::block_encrypt_last(&st, &ks[last]).to_bytes()
}

fn ct_decrypt(c: &[u8; 16], dks: &[Block]) -> [u8; 16] {
    let last = dks.len() - 1;
    let mut st = Block::from_bytes(c).xor(&dks[0]);
    for rk in &dks[1..last] {
        st = SoftAes::block_decrypt(&st, rk);
    }
    SoftAes::block_decrypt_last(&st, &dks[last]).to_bytes()
}

/// Run the full FIPS 197 Appendix C vectors through the constant-time path, both
/// directions, so the inverse round is checked end to end and not just against
/// the table round.
#[test]
fn protected_full_cipher_known_answers() {
    let pt = unhex::<16>("00112233445566778899aabbccddeeff");

    let key = unhex::<16>("000102030405060708090a0b0c0d0e0f");
    let c = unhex::<16>("69c4e0d86a7b0430d8cdb78070b4c55a");
    let ks = ct::key_expansion_128(&key);
    assert_eq!(ct_encrypt(&pt, &ks), c, "AES-128 encrypt");
    assert_eq!(ct_decrypt(&c, &ct::inverse_key_schedule_128(&ks)), pt);

    let key = unhex::<24>("000102030405060708090a0b0c0d0e0f1011121314151617");
    let c = unhex::<16>("dda97ca4864cdfe06eaf70a0ec0d7191");
    let ks = ct::key_expansion_192(&key);
    assert_eq!(ct_encrypt(&pt, &ks), c, "AES-192 encrypt");
    assert_eq!(ct_decrypt(&c, &ct::inverse_key_schedule_192(&ks)), pt);

    let key = unhex::<32>("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f");
    let c = unhex::<16>("8ea2b7ca516745bfeafc49904b496089");
    let ks = ct::key_expansion_256(&key);
    assert_eq!(ct_encrypt(&pt, &ks), c, "AES-256 encrypt");
    assert_eq!(ct_decrypt(&c, &ct::inverse_key_schedule_256(&ks)), pt);
}
