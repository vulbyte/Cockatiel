//! Software implementation of the AES round function.

#![no_std]

use core::{cmp, ops};

pub mod key_schedule;

/// An AES block.
#[repr(align(16))]
#[derive(Copy, Clone, Debug, Default)]
pub struct Block {
    w0: u32,
    w1: u32,
    w2: u32,
    w3: u32,
}

impl cmp::PartialEq for Block {
    #[inline(never)]
    fn eq(&self, other: &Block) -> bool {
        let z = self ^ other;
        z.w0 | z.w1 | z.w2 | z.w3 == 0
    }
}

impl cmp::Eq for Block {}

impl Block {
    #[inline(always)]
    pub fn from_bytes(input: &[u8; 16]) -> Block {
        Block {
            w0: u32::from_le_bytes([input[0], input[1], input[2], input[3]]),
            w1: u32::from_le_bytes([input[4], input[5], input[6], input[7]]),
            w2: u32::from_le_bytes([input[8], input[9], input[10], input[11]]),
            w3: u32::from_le_bytes([input[12], input[13], input[14], input[15]]),
        }
    }

    #[inline(always)]
    pub fn from_slice(input: &[u8]) -> Block {
        debug_assert!(input.len() == 16);
        Block {
            w0: u32::from_le_bytes([input[0], input[1], input[2], input[3]]),
            w1: u32::from_le_bytes([input[4], input[5], input[6], input[7]]),
            w2: u32::from_le_bytes([input[8], input[9], input[10], input[11]]),
            w3: u32::from_le_bytes([input[12], input[13], input[14], input[15]]),
        }
    }

    #[inline(always)]
    pub fn from64x2(a: u64, b: u64) -> Block {
        Block {
            w0: b as u32,
            w1: (b >> 32) as u32,
            w2: a as u32,
            w3: (a >> 32) as u32,
        }
    }

    #[inline(always)]
    pub fn to_bytes(&self) -> [u8; 16] {
        let mut out: [u8; 16] = Default::default();
        out[0..4].copy_from_slice(&self.w0.to_le_bytes());
        out[4..8].copy_from_slice(&self.w1.to_le_bytes());
        out[8..12].copy_from_slice(&self.w2.to_le_bytes());
        out[12..16].copy_from_slice(&self.w3.to_le_bytes());
        out
    }

    #[inline(always)]
    pub fn xor(&self, other: &Block) -> Block {
        Block {
            w0: self.w0 ^ other.w0,
            w1: self.w1 ^ other.w1,
            w2: self.w2 ^ other.w2,
            w3: self.w3 ^ other.w3,
        }
    }

    #[inline(always)]
    pub fn and(&self, other: &Block) -> Block {
        Block {
            w0: self.w0 & other.w0,
            w1: self.w1 & other.w1,
            w2: self.w2 & other.w2,
            w3: self.w3 & other.w3,
        }
    }
}

impl ops::BitAnd for Block {
    type Output = Block;

    #[inline(always)]
    fn bitand(self, rhs: Self) -> Self::Output {
        self.and(&rhs)
    }
}

impl ops::BitAnd for &Block {
    type Output = Block;

    #[inline(always)]
    fn bitand(self, rhs: Self) -> Self::Output {
        self.and(rhs)
    }
}

impl ops::BitXor for Block {
    type Output = Block;

    #[inline(always)]
    fn bitxor(self, rhs: Self) -> Self::Output {
        self.xor(&rhs)
    }
}

impl ops::BitXor for &Block {
    type Output = Block;

    #[inline(always)]
    fn bitxor(self, rhs: Self) -> Self::Output {
        self.xor(rhs)
    }
}

/// The round is computed with SRM-1R, a bitsliced representation that holds the
/// block as eight 32-bit bit planes. The real 16 lanes are duplicated into the
/// high halfword, so a row rotation is just a plain 32-bit rotate. ShiftRows is
/// folded into the input packing, SubBytes is a gate-only Boolean S-box circuit,
/// and MixColumns is a fixed sequence of rotations and XORs. No step indexes
/// memory with secret data, so the round is constant-time on every platform.
mod srm1r {
    use super::Block;

    #[inline(always)]
    fn dup16(x: u32) -> u32 {
        let x = x & 0xffff;
        x | (x << 16)
    }

    #[inline(always)]
    fn load_row_words(block: &Block, shift: u32) -> u32 {
        ((block.w0 >> shift) & 0xff)
            | (((block.w1 >> shift) & 0xff) << 8)
            | (((block.w2 >> shift) & 0xff) << 16)
            | (((block.w3 >> shift) & 0xff) << 24)
    }

    #[inline(always)]
    fn store_column_word(row0: u32, row1: u32, row2: u32, row3: u32, shift: u32) -> u32 {
        ((row0 >> shift) & 0xff)
            | (((row1 >> shift) & 0xff) << 8)
            | (((row2 >> shift) & 0xff) << 16)
            | (((row3 >> shift) & 0xff) << 24)
    }

    #[inline(always)]
    fn gather_row_bit(row_word: u32, bit: u32) -> u32 {
        (((row_word >> bit) & 0x0101_0101).wrapping_mul(0x0102_0408)) >> 24
    }

    #[inline(always)]
    fn pack_rows_bit(row0: u32, row1: u32, row2: u32, row3: u32, bit: u32) -> u32 {
        dup16(
            gather_row_bit(row0, bit)
                | (gather_row_bit(row1, bit) << 4)
                | (gather_row_bit(row2, bit) << 8)
                | (gather_row_bit(row3, bit) << 12),
        )
    }

    #[inline(always)]
    fn spread_row_bits(nibble: u32, bit: u32) -> u32 {
        (((nibble & 0x0f).wrapping_mul(0x0020_4081)) & 0x0101_0101) << bit
    }

    #[inline(always)]
    fn unpack_row_word(planes: &[u32; 8], row: u32) -> u32 {
        let lane_shift = 4 * row;
        spread_row_bits(planes[0] >> lane_shift, 7)
            | spread_row_bits(planes[1] >> lane_shift, 6)
            | spread_row_bits(planes[2] >> lane_shift, 5)
            | spread_row_bits(planes[3] >> lane_shift, 4)
            | spread_row_bits(planes[4] >> lane_shift, 3)
            | spread_row_bits(planes[5] >> lane_shift, 2)
            | spread_row_bits(planes[6] >> lane_shift, 1)
            | spread_row_bits(planes[7] >> lane_shift, 0)
    }

    #[inline(always)]
    fn pack_planes(row0: u32, row1: u32, row2: u32, row3: u32) -> [u32; 8] {
        [
            pack_rows_bit(row0, row1, row2, row3, 7),
            pack_rows_bit(row0, row1, row2, row3, 6),
            pack_rows_bit(row0, row1, row2, row3, 5),
            pack_rows_bit(row0, row1, row2, row3, 4),
            pack_rows_bit(row0, row1, row2, row3, 3),
            pack_rows_bit(row0, row1, row2, row3, 2),
            pack_rows_bit(row0, row1, row2, row3, 1),
            pack_rows_bit(row0, row1, row2, row3, 0),
        ]
    }

    fn subbytes(planes: &mut [u32; 8]) {
        let s0 = planes[1] ^ planes[4];
        let s1 = planes[5] ^ planes[7];
        let s2 = planes[3] ^ s0;
        let s3 = planes[0] ^ planes[2];
        let q0 = s1 ^ s2;
        let s4 = planes[0] ^ planes[6];
        let s5 = planes[2] ^ planes[6];
        let s6 = planes[3] ^ s1;
        let s7 = planes[5] ^ s3;
        let q1 = s1 ^ s5;
        let q2 = planes[2] ^ q0;
        let q3 = s4 ^ s2;
        let q4 = s3 ^ q0;
        let s8 = planes[4] ^ s3;
        let q5 = s6 ^ s8;
        let q6 = planes[2] ^ planes[3];
        let q7 = planes[6] ^ s2;
        let s9 = planes[6] ^ s0;
        let q8 = s3 ^ s9;
        let q9 = s4 ^ s6;
        let q10 = s0 ^ s5;
        let q12 = planes[7] ^ s2;
        let q13 = planes[1] ^ s7;
        let q14 = planes[7] ^ s3;
        let q15 = s2 ^ s7;
        let q16 = planes[1] ^ s1;
        let q17 = planes[1] ^ planes[7];
        let q11 = planes[5];

        let t20 = q6 & q12;
        let t21 = q3 & q14;
        let t22 = q1 & q16;
        let t23 = q2 & q17;
        let x0 = ((q3 | q14) ^ (q0 & q7)) ^ (t20 ^ t22);
        let x1 = ((q4 | q13) ^ (q10 & q11)) ^ (t21 ^ t20);
        let x2 = ((q2 | q17) ^ (q5 & q9)) ^ (t21 ^ t22);
        let x3 = ((q8 | q15) ^ t23) ^ (t21 ^ (q4 & q13));

        let a = x1 & !x3;
        let b = x0 & !x3;
        let c = x3 & !x1;
        let d = x2 & !x1;
        let e = x0 ^ a;
        let y0 = x3 ^ (x2 & !e);
        let f = x1 ^ b;
        let y1 = c ^ (x2 & f);
        let g = x2 ^ c;
        let y2 = x1 ^ (x0 & !g);
        let h = x3 ^ d;
        let y3 = a ^ (x0 & h);
        let y02 = y2 ^ y0;
        let y13 = y3 ^ y1;
        let y23 = y3 ^ y2;
        let y01 = y1 ^ y0;
        let y00 = y02 ^ y13;

        let a0 = y01 & q11;
        let a1 = y0 & q12;
        let a2 = y1 & q0;
        let a3 = y23 & q17;
        let a4 = y2 & q5;
        let a5 = y3 & q15;
        let a6 = y13 & q14;
        let a7 = y00 & q16;
        let a8 = y02 & q13;
        let a9 = y01 & q7;
        let a10 = y0 & q10;
        let a11 = y1 & q6;
        let a12 = y23 & q2;
        let a13 = y2 & q9;
        let a14 = y3 & q8;
        let a15 = y13 & q3;
        let a16 = y00 & q1;
        let a17 = y02 & q4;

        let r0 = a1 ^ a5;
        let r1 = a9 ^ a15;
        let r2 = a4 ^ r0;
        let r3 = a2 ^ a10;
        let r4 = a11 ^ a17;
        let r5 = a8 ^ r1;
        let r6 = a0 ^ a16;
        let r7 = a7 ^ a13;
        let r8 = a11 ^ a14;
        let r9 = r3 ^ r4;
        let r10 = r5 ^ r6;
        let r11 = r2 ^ r9;
        let r12 = a3 ^ r0;
        let r13 = r7 ^ r8;
        let r14 = r12 ^ r13;
        planes[0] = r10 ^ r14;
        let r15 = a6 ^ a10;
        let r16 = r15 ^ r2;
        planes[1] = !(r10 ^ r16);
        planes[2] = !(a2 ^ r2);
        let r17 = a12 ^ a13;
        let r18 = a15 ^ r17;
        planes[3] = r18 ^ r11;
        let r19 = a1 ^ a14;
        let r20 = a17 ^ r3;
        let r21 = r7 ^ r19;
        let r22 = r5 ^ r20;
        planes[4] = r21 ^ r22;
        let r23 = a9 ^ a12;
        planes[5] = r8 ^ r23;
        planes[6] = !(r1 ^ r4);
        planes[7] = !(a16 ^ r11);
    }

    fn mix_columns(planes: &mut [u32; 8]) {
        let adj = [
            planes[0].rotate_right(4),
            planes[1].rotate_right(4),
            planes[2].rotate_right(4),
            planes[3].rotate_right(4),
            planes[4].rotate_right(4),
            planes[5].rotate_right(4),
            planes[6].rotate_right(4),
            planes[7].rotate_right(4),
        ];
        let pair = [
            planes[0] ^ adj[0],
            planes[1] ^ adj[1],
            planes[2] ^ adj[2],
            planes[3] ^ adj[3],
            planes[4] ^ adj[4],
            planes[5] ^ adj[5],
            planes[6] ^ adj[6],
            planes[7] ^ adj[7],
        ];
        let opp = [
            pair[0].rotate_right(8),
            pair[1].rotate_right(8),
            pair[2].rotate_right(8),
            pair[3].rotate_right(8),
            pair[4].rotate_right(8),
            pair[5].rotate_right(8),
            pair[6].rotate_right(8),
            pair[7].rotate_right(8),
        ];

        planes[0] = pair[1] ^ adj[0] ^ opp[0];
        planes[1] = pair[2] ^ adj[1] ^ opp[1];
        planes[2] = pair[3] ^ adj[2] ^ opp[2];
        planes[3] = pair[4] ^ adj[3] ^ opp[3] ^ pair[0];
        planes[4] = pair[5] ^ adj[4] ^ opp[4] ^ pair[0];
        planes[5] = pair[6] ^ adj[5] ^ opp[5];
        planes[6] = pair[7] ^ adj[6] ^ opp[6] ^ pair[0];
        planes[7] = pair[0] ^ adj[7] ^ opp[7];
    }

    /// Multiplies every lane byte by 2 in GF(2^8) on the bit-plane representation.
    /// A left shift by one bit moves each plane down, and the carry out of bit 7
    /// is folded back into bits 0, 1, 3, and 4 (the set bits of the reduction
    /// polynomial 0x1b).
    #[inline(always)]
    fn xtime(q: &[u32; 8]) -> [u32; 8] {
        let carry = q[0];
        [
            q[1],
            q[2],
            q[3],
            q[4] ^ carry,
            q[5] ^ carry,
            q[6],
            q[7] ^ carry,
            carry,
        ]
    }

    /// Applies the inverse of the AES S-box affine map to every lane byte. Each
    /// output bit is `b[i+2] ^ b[i+5] ^ b[i+7]` (indices mod 8) with the constant
    /// 0x05 added; here the planes are ordered most-significant bit first, so the
    /// indices are mirrored and the constant lands on the bit-4 and bit-0 planes.
    #[inline(always)]
    fn inv_affine(q: &mut [u32; 8]) {
        const ONES: u32 = 0xffff_ffff;
        *q = [
            q[6] ^ q[3] ^ q[1],
            q[7] ^ q[4] ^ q[2],
            q[0] ^ q[5] ^ q[3],
            q[1] ^ q[6] ^ q[4],
            q[2] ^ q[7] ^ q[5],
            q[3] ^ q[0] ^ q[6] ^ ONES,
            q[4] ^ q[1] ^ q[7],
            q[5] ^ q[2] ^ q[0] ^ ONES,
        ];
    }

    /// Inverse S-box. Because the forward S-box is `affine(inverse(x))` and the
    /// GF(2^8) inversion is an involution, the inverse S-box is just
    /// `inv_affine(sbox(inv_affine(x)))`, which lets it reuse the forward circuit.
    fn inv_subbytes(planes: &mut [u32; 8]) {
        inv_affine(planes);
        subbytes(planes);
        inv_affine(planes);
    }

    fn inv_mix_columns(planes: &mut [u32; 8]) {
        let m2 = xtime(planes);
        let m4 = xtime(&m2);
        let m8 = xtime(&m4);

        let mut c9 = [0u32; 8];
        let mut cb = [0u32; 8];
        let mut cd = [0u32; 8];
        let mut ce = [0u32; 8];
        for k in 0..8 {
            c9[k] = m8[k] ^ planes[k];
            cb[k] = m8[k] ^ m2[k] ^ planes[k];
            cd[k] = m8[k] ^ m4[k] ^ planes[k];
            ce[k] = m8[k] ^ m4[k] ^ m2[k];
        }

        for k in 0..8 {
            planes[k] =
                ce[k] ^ cb[k].rotate_right(4) ^ cd[k].rotate_right(8) ^ c9[k].rotate_right(12);
        }
    }

    #[inline(always)]
    fn load_rows_fwd(block: &Block) -> [u32; 4] {
        [
            load_row_words(block, 0),
            load_row_words(block, 8).rotate_right(8),
            load_row_words(block, 16).rotate_right(16),
            load_row_words(block, 24).rotate_right(24),
        ]
    }

    #[inline(always)]
    fn load_rows_inv(block: &Block) -> [u32; 4] {
        [
            load_row_words(block, 0),
            load_row_words(block, 8).rotate_left(8),
            load_row_words(block, 16).rotate_left(16),
            load_row_words(block, 24).rotate_left(24),
        ]
    }

    #[inline(always)]
    fn store_columns(planes: &[u32; 8], rk: &Block) -> Block {
        let row0 = unpack_row_word(planes, 0);
        let row1 = unpack_row_word(planes, 1);
        let row2 = unpack_row_word(planes, 2);
        let row3 = unpack_row_word(planes, 3);

        Block {
            w0: store_column_word(row0, row1, row2, row3, 0) ^ rk.w0,
            w1: store_column_word(row0, row1, row2, row3, 8) ^ rk.w1,
            w2: store_column_word(row0, row1, row2, row3, 16) ^ rk.w2,
            w3: store_column_word(row0, row1, row2, row3, 24) ^ rk.w3,
        }
    }

    /// AES forward round (SubBytes, ShiftRows, MixColumns, AddRoundKey).
    #[inline]
    pub fn block_encrypt(block: &Block, rk: &Block) -> Block {
        let [row0, row1, row2, row3] = load_rows_fwd(block);
        let mut planes = pack_planes(row0, row1, row2, row3);
        subbytes(&mut planes);
        mix_columns(&mut planes);
        store_columns(&planes, rk)
    }

    /// AES final forward round (SubBytes, ShiftRows, AddRoundKey, no MixColumns).
    #[inline]
    pub fn block_encrypt_last(block: &Block, rk: &Block) -> Block {
        let [row0, row1, row2, row3] = load_rows_fwd(block);
        let mut planes = pack_planes(row0, row1, row2, row3);
        subbytes(&mut planes);
        store_columns(&planes, rk)
    }

    /// AES inverse round (InvShiftRows, InvSubBytes, InvMixColumns, AddRoundKey).
    /// The round key must already be transformed for the equivalent inverse
    /// cipher, as produced by `key_schedule::inverse_key_schedule_*`.
    #[inline]
    pub fn block_decrypt(block: &Block, rk: &Block) -> Block {
        let [row0, row1, row2, row3] = load_rows_inv(block);
        let mut planes = pack_planes(row0, row1, row2, row3);
        inv_subbytes(&mut planes);
        inv_mix_columns(&mut planes);
        store_columns(&planes, rk)
    }

    /// AES final inverse round (InvShiftRows, InvSubBytes, AddRoundKey, no
    /// InvMixColumns).
    #[inline]
    pub fn block_decrypt_last(block: &Block, rk: &Block) -> Block {
        let [row0, row1, row2, row3] = load_rows_inv(block);
        let mut planes = pack_planes(row0, row1, row2, row3);
        inv_subbytes(&mut planes);
        store_columns(&planes, rk)
    }
}

/// Constant-time software AES implementation.
///
/// The round function is bitsliced (SRM-1R), so it never indexes memory with
/// secret data and runs in constant time on every platform.
pub struct SoftAes;

impl SoftAes {
    /// AES forward round function.
    /// `rk` is the round key.
    #[inline]
    pub fn block_encrypt(block: &Block, rk: &Block) -> Block {
        srm1r::block_encrypt(block, rk)
    }

    /// AES decryption round function.
    /// `rk` is the round key from the inverse key schedule.
    #[inline]
    pub fn block_decrypt(block: &Block, rk: &Block) -> Block {
        srm1r::block_decrypt(block, rk)
    }

    /// AES forward round function for the last round.
    /// `rk` is the round key.
    #[inline]
    pub fn block_encrypt_last(block: &Block, rk: &Block) -> Block {
        srm1r::block_encrypt_last(block, rk)
    }

    /// AES final decryption round.
    /// `rk` is the round key from the inverse key schedule.
    #[inline]
    pub fn block_decrypt_last(block: &Block, rk: &Block) -> Block {
        srm1r::block_decrypt_last(block, rk)
    }
}

/// Constant-time software AES implementation (formerly the paranoid stride-16 variant)
pub type SoftAesSlow = SoftAes;

/// Constant-time software AES implementation (formerly the practical stride-64 variant)
pub type SoftAesModerate = SoftAes;

/// Constant-time software AES implementation (formerly the minimal-protection variant)
pub type SoftAesFast = SoftAes;

/// Fastest software AES implementation, but with no protection against side channels
pub mod unprotected;

#[test]
fn test() {
    let input_bytes = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
    let input = Block::from_bytes(&input_bytes);
    let rk = Block::from_bytes(&[1u8; 16]);
    let output = SoftAesFast::block_encrypt(&input, &rk);
    let expected = Block::from_bytes(&[
        107, 107, 93, 68, 45, 108, 50, 80, 177, 216, 92, 96, 38, 157, 32, 93,
    ]);
    assert_eq!(output, expected);
}
