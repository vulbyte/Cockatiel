use super::Block;
pub(crate) const S_BOX: [u8; 256] = [
    0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
    0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
    0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
    0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
    0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
    0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
    0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
    0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
    0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
    0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
    0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
    0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
    0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
    0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
    0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
    0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16,
];

pub(crate) const S_BOX_INV: [u8; 256] = [
    0x52, 0x09, 0x6a, 0xd5, 0x30, 0x36, 0xa5, 0x38, 0xbf, 0x40, 0xa3, 0x9e, 0x81, 0xf3, 0xd7, 0xfb,
    0x7c, 0xe3, 0x39, 0x82, 0x9b, 0x2f, 0xff, 0x87, 0x34, 0x8e, 0x43, 0x44, 0xc4, 0xde, 0xe9, 0xcb,
    0x54, 0x7b, 0x94, 0x32, 0xa6, 0xc2, 0x23, 0x3d, 0xee, 0x4c, 0x95, 0x0b, 0x42, 0xfa, 0xc3, 0x4e,
    0x08, 0x2e, 0xa1, 0x66, 0x28, 0xd9, 0x24, 0xb2, 0x76, 0x5b, 0xa2, 0x49, 0x6d, 0x8b, 0xd1, 0x25,
    0x72, 0xf8, 0xf6, 0x64, 0x86, 0x68, 0x98, 0x16, 0xd4, 0xa4, 0x5c, 0xcc, 0x5d, 0x65, 0xb6, 0x92,
    0x6c, 0x70, 0x48, 0x50, 0xfd, 0xed, 0xb9, 0xda, 0x5e, 0x15, 0x46, 0x57, 0xa7, 0x8d, 0x9d, 0x84,
    0x90, 0xd8, 0xab, 0x00, 0x8c, 0xbc, 0xd3, 0x0a, 0xf7, 0xe4, 0x58, 0x05, 0xb8, 0xb3, 0x45, 0x06,
    0xd0, 0x2c, 0x1e, 0x8f, 0xca, 0x3f, 0x0f, 0x02, 0xc1, 0xaf, 0xbd, 0x03, 0x01, 0x13, 0x8a, 0x6b,
    0x3a, 0x91, 0x11, 0x41, 0x4f, 0x67, 0xdc, 0xea, 0x97, 0xf2, 0xcf, 0xce, 0xf0, 0xb4, 0xe6, 0x73,
    0x96, 0xac, 0x74, 0x22, 0xe7, 0xad, 0x35, 0x85, 0xe2, 0xf9, 0x37, 0xe8, 0x1c, 0x75, 0xdf, 0x6e,
    0x47, 0xf1, 0x1a, 0x71, 0x1d, 0x29, 0xc5, 0x89, 0x6f, 0xb7, 0x62, 0x0e, 0xaa, 0x18, 0xbe, 0x1b,
    0xfc, 0x56, 0x3e, 0x4b, 0xc6, 0xd2, 0x79, 0x20, 0x9a, 0xdb, 0xc0, 0xfe, 0x78, 0xcd, 0x5a, 0xf4,
    0x1f, 0xdd, 0xa8, 0x33, 0x88, 0x07, 0xc7, 0x31, 0xb1, 0x12, 0x10, 0x59, 0x27, 0x80, 0xec, 0x5f,
    0x60, 0x51, 0x7f, 0xa9, 0x19, 0xb5, 0x4a, 0x0d, 0x2d, 0xe5, 0x7a, 0x9f, 0x93, 0xc9, 0x9c, 0xef,
    0xa0, 0xe0, 0x3b, 0x4d, 0xae, 0x2a, 0xf5, 0xb0, 0xc8, 0xeb, 0xbb, 0x3c, 0x83, 0x53, 0x99, 0x61,
    0x17, 0x2b, 0x04, 0x7e, 0xba, 0x77, 0xd6, 0x26, 0xe1, 0x69, 0x14, 0x63, 0x55, 0x21, 0x0c, 0x7d,
];

const RCON: [u8; 11] = [
    0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1B, 0x36,
];

#[inline(always)]
fn sbox(input: u8) -> u8 {
    S_BOX[input as usize]
}

#[inline(always)]
fn sbox_inv(input: u8) -> u8 {
    S_BOX_INV[input as usize]
}

#[inline(always)]
fn sub_word(word: u32) -> u32 {
    let b0 = sbox(((word >> 24) & 0xFF) as u8) as u32;
    let b1 = sbox(((word >> 16) & 0xFF) as u8) as u32;
    let b2 = sbox(((word >> 8) & 0xFF) as u8) as u32;
    let b3 = sbox((word & 0xFF) as u8) as u32;
    (b0 << 24) | (b1 << 16) | (b2 << 8) | b3
}

#[inline(always)]
#[allow(dead_code)]
fn sub_word_inv(word: u32) -> u32 {
    let b0 = sbox_inv(((word >> 24) & 0xFF) as u8) as u32;
    let b1 = sbox_inv(((word >> 16) & 0xFF) as u8) as u32;
    let b2 = sbox_inv(((word >> 8) & 0xFF) as u8) as u32;
    let b3 = sbox_inv((word & 0xFF) as u8) as u32;
    (b0 << 24) | (b1 << 16) | (b2 << 8) | b3
}

#[inline(always)]
fn rot_word(word: u32) -> u32 {
    word.rotate_left(8)
}

#[inline(always)]
fn xtime(x: u8) -> u8 {
    (x << 1) ^ (((x >> 7) & 1) * 0x1b)
}

#[inline(always)]
#[allow(dead_code)] // Used in the optimized inv_mix_block implementation
fn mul0x09(x: u8) -> u8 {
    xtime(xtime(xtime(x))) ^ x
}

#[inline(always)]
#[allow(dead_code)] // Used in the optimized inv_mix_block implementation
fn mul0x0b(x: u8) -> u8 {
    let x2 = xtime(x);
    let x4 = xtime(x2);
    let x8 = xtime(x4);
    x8 ^ x2 ^ x
}

#[inline(always)]
#[allow(dead_code)] // Used in the optimized inv_mix_block implementation
fn mul0x0d(x: u8) -> u8 {
    let x2 = xtime(x);
    let x4 = xtime(x2);
    let x8 = xtime(x4);
    x8 ^ x4 ^ x
}

#[inline(always)]
#[allow(dead_code)] // Used in the optimized inv_mix_block implementation
fn mul0x0e(x: u8) -> u8 {
    let x2 = xtime(x);
    let x4 = xtime(x2);
    let x8 = xtime(x4);
    x8 ^ x4 ^ x2
}

#[inline(always)]
pub fn inv_mix_block(block: Block) -> Block {
    let mut state = [0u8; 16];
    state[0..4].copy_from_slice(&block.w0.to_le_bytes());
    state[4..8].copy_from_slice(&block.w1.to_le_bytes());
    state[8..12].copy_from_slice(&block.w2.to_le_bytes());
    state[12..16].copy_from_slice(&block.w3.to_le_bytes());

    for col in 0..4 {
        let i = 4 * col;
        let a0 = state[i];
        let a1 = state[i + 1];
        let a2 = state[i + 2];
        let a3 = state[i + 3];

        let a0_x2 = xtime(a0);
        let a1_x2 = xtime(a1);
        let a2_x2 = xtime(a2);
        let a3_x2 = xtime(a3);

        let a0_x4 = xtime(a0_x2);
        let a1_x4 = xtime(a1_x2);
        let a2_x4 = xtime(a2_x2);
        let a3_x4 = xtime(a3_x2);

        let a0_x8 = xtime(a0_x4);
        let a1_x8 = xtime(a1_x4);
        let a2_x8 = xtime(a2_x4);
        let a3_x8 = xtime(a3_x4);

        state[i] =
            (a0_x8 ^ a0_x4 ^ a0_x2) ^ (a1_x8 ^ a1_x2 ^ a1) ^ (a2_x8 ^ a2_x4 ^ a2) ^ (a3_x8 ^ a3);

        state[i + 1] =
            (a0_x8 ^ a0) ^ (a1_x8 ^ a1_x4 ^ a1_x2) ^ (a2_x8 ^ a2_x2 ^ a2) ^ (a3_x8 ^ a3_x4 ^ a3);

        state[i + 2] =
            (a0_x8 ^ a0_x4 ^ a0) ^ (a1_x8 ^ a1) ^ (a2_x8 ^ a2_x4 ^ a2_x2) ^ (a3_x8 ^ a3_x2 ^ a3);

        state[i + 3] =
            (a0_x8 ^ a0_x2 ^ a0) ^ (a1_x8 ^ a1_x4 ^ a1) ^ (a2_x8 ^ a2) ^ (a3_x8 ^ a3_x4 ^ a3_x2);
    }

    let w0 = u32::from_le_bytes(state[0..4].try_into().unwrap());
    let w1 = u32::from_le_bytes(state[4..8].try_into().unwrap());
    let w2 = u32::from_le_bytes(state[8..12].try_into().unwrap());
    let w3 = u32::from_le_bytes(state[12..16].try_into().unwrap());

    Block { w0, w1, w2, w3 }
}

/// Packs four consecutive expansion words into a round key. The expansion
/// computes each word big-endian (row 0 in the high byte), whereas the round
/// function and `Block::from_bytes` expect the little-endian column layout, so
/// each word is byte-swapped.
fn pack_round_key(w: &[u32], j: usize) -> Block {
    Block {
        w0: w[j].swap_bytes(),
        w1: w[j + 1].swap_bytes(),
        w2: w[j + 2].swap_bytes(),
        w3: w[j + 3].swap_bytes(),
    }
}

pub fn key_expansion_128(key: &[u8; 16]) -> [Block; 11] {
    const NK: usize = 4;
    const TOTAL_WORDS: usize = 44;
    let mut w = [0u32; TOTAL_WORDS];

    for (i, chunk) in key.chunks_exact(4).take(NK).enumerate() {
        w[i] = u32::from_be_bytes(chunk.try_into().unwrap());
    }
    for i in NK..TOTAL_WORDS {
        let mut temp = w[i - 1];
        if i % NK == 0 {
            temp = sub_word(rot_word(temp)) ^ ((RCON[i / NK] as u32) << 24);
        }
        w[i] = w[i - NK] ^ temp;
    }
    let mut blocks = [Block {
        w0: 0,
        w1: 0,
        w2: 0,
        w3: 0,
    }; 11];
    for (i, block) in blocks.iter_mut().enumerate() {
        let j = 4 * i;
        *block = pack_round_key(&w, j);
    }
    blocks
}

pub fn key_expansion_192(key: &[u8; 24]) -> [Block; 13] {
    const NK: usize = 6;
    const TOTAL_WORDS: usize = 52;
    let mut w = [0u32; TOTAL_WORDS];

    for (i, chunk) in key.chunks_exact(4).take(NK).enumerate() {
        w[i] = u32::from_be_bytes(chunk.try_into().unwrap());
    }
    for i in NK..TOTAL_WORDS {
        let mut temp = w[i - 1];
        if i % NK == 0 {
            temp = sub_word(rot_word(temp)) ^ ((RCON[i / NK] as u32) << 24);
        }
        w[i] = w[i - NK] ^ temp;
    }
    let mut blocks = [Block {
        w0: 0,
        w1: 0,
        w2: 0,
        w3: 0,
    }; 13];
    for (i, block) in blocks.iter_mut().enumerate() {
        let j = 4 * i;
        *block = pack_round_key(&w, j);
    }
    blocks
}

pub fn key_expansion_256(key: &[u8; 32]) -> [Block; 15] {
    const NK: usize = 8;
    const TOTAL_WORDS: usize = 60;
    let mut w = [0u32; TOTAL_WORDS];

    for (i, chunk) in key.chunks_exact(4).take(NK).enumerate() {
        w[i] = u32::from_be_bytes(chunk.try_into().unwrap());
    }
    for i in NK..TOTAL_WORDS {
        let mut temp = w[i - 1];
        if i % NK == 0 {
            temp = sub_word(rot_word(temp)) ^ ((RCON[i / NK] as u32) << 24);
        } else if i % NK == 4 {
            temp = sub_word(temp);
        }
        w[i] = w[i - NK] ^ temp;
    }
    let mut blocks = [Block {
        w0: 0,
        w1: 0,
        w2: 0,
        w3: 0,
    }; 15];
    for (i, block) in blocks.iter_mut().enumerate() {
        let j = 4 * i;
        *block = pack_round_key(&w, j);
    }
    blocks
}

#[inline(always)]
pub fn inverse_key_schedule_128(enc: &[Block; 11]) -> [Block; 11] {
    let mut dec = [Block {
        w0: 0,
        w1: 0,
        w2: 0,
        w3: 0,
    }; 11];
    dec[0] = enc[10];
    for i in 1..10 {
        dec[i] = inv_mix_block(enc[10 - i]);
    }
    dec[10] = enc[0];
    dec
}

#[inline(always)]
#[allow(dead_code)]
fn apply_inv_sbox_to_block(block: Block) -> Block {
    Block {
        w0: sub_word_inv(block.w0),
        w1: sub_word_inv(block.w1),
        w2: sub_word_inv(block.w2),
        w3: sub_word_inv(block.w3),
    }
}

#[inline(always)]
pub fn optimized_inverse_key_schedule_128(enc: &[Block; 11]) -> [Block; 11] {
    let mut dec = [Block {
        w0: 0,
        w1: 0,
        w2: 0,
        w3: 0,
    }; 11];
    dec[0] = enc[10];
    for i in 1..10 {
        dec[i] = inv_mix_block(enc[10 - i]);
    }
    dec[10] = enc[0];
    dec
}

#[inline(always)]
pub fn inverse_key_schedule_192(enc: &[Block; 13]) -> [Block; 13] {
    let mut dec = [Block {
        w0: 0,
        w1: 0,
        w2: 0,
        w3: 0,
    }; 13];
    dec[0] = enc[12];
    for i in 1..12 {
        dec[i] = inv_mix_block(enc[12 - i]);
    }
    dec[12] = enc[0];
    dec
}

#[inline(always)]
pub fn optimized_inverse_key_schedule_192(enc: &[Block; 13]) -> [Block; 13] {
    let mut dec = [Block {
        w0: 0,
        w1: 0,
        w2: 0,
        w3: 0,
    }; 13];
    dec[0] = enc[12];
    for i in 1..12 {
        dec[i] = inv_mix_block(enc[12 - i]);
    }
    dec[12] = enc[0];
    dec
}

#[inline(always)]
pub fn inverse_key_schedule_256(enc: &[Block; 15]) -> [Block; 15] {
    let mut dec = [Block {
        w0: 0,
        w1: 0,
        w2: 0,
        w3: 0,
    }; 15];
    dec[0] = enc[14];
    for i in 1..14 {
        dec[i] = inv_mix_block(enc[14 - i]);
    }
    dec[14] = enc[0];
    dec
}

#[inline(always)]
pub fn optimized_inverse_key_schedule_256(enc: &[Block; 15]) -> [Block; 15] {
    let mut dec = [Block {
        w0: 0,
        w1: 0,
        w2: 0,
        w3: 0,
    }; 15];
    dec[0] = enc[14];
    for i in 1..14 {
        dec[i] = inv_mix_block(enc[14 - i]);
    }
    dec[14] = enc[0];
    dec
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Reads a round key back as the four big-endian words of FIPS 197, so the
    /// recognizable test vectors can be compared against the little-endian
    /// `Block` layout the round function actually consumes.
    fn fips_words(block: &Block) -> [u32; 4] {
        let b = block.to_bytes();
        [
            u32::from_be_bytes([b[0], b[1], b[2], b[3]]),
            u32::from_be_bytes([b[4], b[5], b[6], b[7]]),
            u32::from_be_bytes([b[8], b[9], b[10], b[11]]),
            u32::from_be_bytes([b[12], b[13], b[14], b[15]]),
        ]
    }

    #[test]
    fn test_key_expansion_128() {
        // FIPS 197 Appendix A.1 - AES-128 test vector
        let key = [
            0x2b, 0x7e, 0x15, 0x16, 0x28, 0xae, 0xd2, 0xa6, 0xab, 0xf7, 0x15, 0x88, 0x09, 0xcf,
            0x4f, 0x3c,
        ];

        let expanded = key_expansion_128(&key);

        assert_eq!(expanded.len(), 11);

        assert_eq!(
            fips_words(&expanded[0]),
            [0x2b7e1516, 0x28aed2a6, 0xabf71588, 0x09cf4f3c]
        );
        assert_eq!(
            fips_words(&expanded[10]),
            [0xd014f9a8, 0xc9ee2589, 0xe13f0cc8, 0xb6630ca6]
        );

        let expanded2 = key_expansion_128(&key);
        for i in 0..11 {
            assert_eq!(expanded[i], expanded2[i]);
        }

        assert_eq!(
            fips_words(&expanded[4]),
            [0xef44a541, 0xa8525b7f, 0xb671253b, 0xdb0bad00]
        );

        let dec_schedule = inverse_key_schedule_128(&expanded);
        let opt_dec_schedule = optimized_inverse_key_schedule_128(&expanded);

        assert_eq!(dec_schedule[0], expanded[10]);
        assert_eq!(dec_schedule[10], expanded[0]);

        let expected_inv_mix = inv_mix_block(expanded[9]);
        assert_eq!(dec_schedule[1], expected_inv_mix);

        assert_eq!(opt_dec_schedule[0], expanded[10]);
        assert_eq!(opt_dec_schedule[10], expanded[0]);
    }

    #[test]
    fn test_key_expansion_192() {
        // FIPS 197 Appendix A.2 - AES-192 test vector
        let key = [
            0x8e, 0x73, 0xb0, 0xf7, 0xda, 0x0e, 0x64, 0x52, 0xc8, 0x10, 0xf3, 0x2b, 0x80, 0x90,
            0x79, 0xe5, 0x62, 0xf8, 0xea, 0xd2, 0x52, 0x2c, 0x6b, 0x7b,
        ];

        let expanded = key_expansion_192(&key);

        assert_eq!(
            fips_words(&expanded[0]),
            [0x8e73b0f7, 0xda0e6452, 0xc810f32b, 0x809079e5]
        );
        assert_eq!(fips_words(&expanded[1])[0], 0x62f8ead2);
        assert_eq!(fips_words(&expanded[1])[1], 0x522c6b7b);

        let expanded2 = key_expansion_192(&key);
        for i in 0..13 {
            assert_eq!(expanded[i], expanded2[i]);
        }

        let dec_schedule = inverse_key_schedule_192(&expanded);

        assert_eq!(dec_schedule[0], expanded[12]);
        assert_eq!(dec_schedule[12], expanded[0]);

        let opt_dec_schedule = optimized_inverse_key_schedule_192(&expanded);

        assert_eq!(opt_dec_schedule[0], expanded[12]);
        assert_eq!(opt_dec_schedule[12], expanded[0]);
    }

    #[test]
    fn test_key_expansion_256() {
        // FIPS 197 Appendix A.3 - AES-256 test vector
        let key = [
            0x60, 0x3d, 0xeb, 0x10, 0x15, 0xca, 0x71, 0xbe, 0x2b, 0x73, 0xae, 0xf0, 0x85, 0x7d,
            0x77, 0x81, 0x1f, 0x35, 0x2c, 0x07, 0x3b, 0x61, 0x08, 0xd7, 0x2d, 0x98, 0x10, 0xa3,
            0x09, 0x14, 0xdf, 0xf4,
        ];

        let expanded = key_expansion_256(&key);

        assert_eq!(
            fips_words(&expanded[0]),
            [0x603deb10, 0x15ca71be, 0x2b73aef0, 0x857d7781]
        );
        assert_eq!(
            fips_words(&expanded[1]),
            [0x1f352c07, 0x3b6108d7, 0x2d9810a3, 0x0914dff4]
        );
        assert_eq!(
            fips_words(&expanded[14]),
            [0xfe4890d1, 0xe6188d0b, 0x046df344, 0x706c631e]
        );

        let dec_schedule = inverse_key_schedule_256(&expanded);
        let opt_dec_schedule = optimized_inverse_key_schedule_256(&expanded);

        assert_eq!(dec_schedule[0], expanded[14]);
        assert_eq!(dec_schedule[14], expanded[0]);

        assert_eq!(opt_dec_schedule[0], expanded[14]);
        assert_eq!(opt_dec_schedule[14], expanded[0]);
    }

    #[test]
    fn test_inverse_key_schedule_128() {
        // FIPS 197 Appendix A.1 - AES-128 test vector
        let key = [
            0x2b, 0x7e, 0x15, 0x16, 0x28, 0xae, 0xd2, 0xa6, 0xab, 0xf7, 0x15, 0x88, 0x09, 0xcf,
            0x4f, 0x3c,
        ];

        let enc_schedule = key_expansion_128(&key);
        let dec_schedule = inverse_key_schedule_128(&enc_schedule);

        assert_eq!(dec_schedule[0], enc_schedule[10]);

        assert_eq!(dec_schedule[10], enc_schedule[0]);

        let expected_inv_mix = inv_mix_block(enc_schedule[9]);
        assert_eq!(dec_schedule[1], expected_inv_mix);
    }

    #[test]
    fn test_inverse_key_schedule_192() {
        // FIPS 197 Appendix A.2 - AES-192 test vector
        let key = [
            0x8e, 0x73, 0xb0, 0xf7, 0xda, 0x0e, 0x64, 0x52, 0xc8, 0x10, 0xf3, 0x2b, 0x80, 0x90,
            0x79, 0xe5, 0x62, 0xf8, 0xea, 0xd2, 0x52, 0x2c, 0x6b, 0x7b,
        ];

        let enc_schedule = key_expansion_192(&key);
        let dec_schedule = inverse_key_schedule_192(&enc_schedule);

        assert_eq!(dec_schedule[0], enc_schedule[12]);

        assert_eq!(dec_schedule[12], enc_schedule[0]);

        let expected_inv_mix = inv_mix_block(enc_schedule[11]);
        assert_eq!(dec_schedule[1], expected_inv_mix);
    }

    #[test]
    fn test_inverse_key_schedule_256() {
        // FIPS 197 Appendix A.3 - AES-256 test vector
        let key = [
            0x60, 0x3d, 0xeb, 0x10, 0x15, 0xca, 0x71, 0xbe, 0x2b, 0x73, 0xae, 0xf0, 0x85, 0x7d,
            0x77, 0x81, 0x1f, 0x35, 0x2c, 0x07, 0x3b, 0x61, 0x08, 0xd7, 0x2d, 0x98, 0x10, 0xa3,
            0x09, 0x14, 0xdf, 0xf4,
        ];

        let enc_schedule = key_expansion_256(&key);
        let dec_schedule = inverse_key_schedule_256(&enc_schedule);

        assert_eq!(dec_schedule[0], enc_schedule[14]);

        assert_eq!(dec_schedule[14], enc_schedule[0]);

        let expected_inv_mix = inv_mix_block(enc_schedule[13]);
        assert_eq!(dec_schedule[1], expected_inv_mix);
    }

    #[test]
    fn test_sub_word_inv() {
        let test_word = 0x12345678u32;
        let sub = sub_word(test_word);
        let inv_sub = sub_word_inv(sub);
        assert_eq!(test_word, inv_sub);

        let test_word = 0xabcdef01u32;
        let sub = sub_word(test_word);
        let inv_sub = sub_word_inv(sub);
        assert_eq!(test_word, inv_sub);
    }

    #[test]
    fn test_apply_inv_sbox_to_block() {
        let block = Block {
            w0: 0x12345678,
            w1: 0x9abcdef0,
            w2: 0xfedcba98,
            w3: 0x76543210,
        };

        let transformed = Block {
            w0: sub_word(block.w0),
            w1: sub_word(block.w1),
            w2: sub_word(block.w2),
            w3: sub_word(block.w3),
        };

        let restored = apply_inv_sbox_to_block(transformed);

        assert_eq!(block, restored);
    }
}
