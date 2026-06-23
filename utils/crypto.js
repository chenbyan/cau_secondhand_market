/**
 * crypto.js — AES-128-ECB encryption + SHA-256 hashing (pure JS, no dependencies).
 *
 * AES key is embedded in client code — protects against database-only breaches.
 * CIPHER_KEY must never change once data is in production (changing it invalidates all stored ciphertext).
 *
 * Encrypted values are prefixed with 'aes1:' so legacy plaintext values are handled gracefully.
 */

// ─── AES-128 key (16 ASCII chars = 128 bits) ──────────────────────────────────
const CIPHER_KEY = 'CAU2nd#Ph0ne2026'
const ENC_PREFIX = 'aes1:'

// ─── AES S-box and inverse S-box ──────────────────────────────────────────────
/* eslint-disable */
const SBOX = [
  0x63,0x7c,0x77,0x7b,0xf2,0x6b,0x6f,0xc5,0x30,0x01,0x67,0x2b,0xfe,0xd7,0xab,0x76,
  0xca,0x82,0xc9,0x7d,0xfa,0x59,0x47,0xf0,0xad,0xd4,0xa2,0xaf,0x9c,0xa4,0x72,0xc0,
  0xb7,0xfd,0x93,0x26,0x36,0x3f,0xf7,0xcc,0x34,0xa5,0xe5,0xf1,0x71,0xd8,0x31,0x15,
  0x04,0xc7,0x23,0xc3,0x18,0x96,0x05,0x9a,0x07,0x12,0x80,0xe2,0xeb,0x27,0xb2,0x75,
  0x09,0x83,0x2c,0x1a,0x1b,0x6e,0x5a,0xa0,0x52,0x3b,0xd6,0xb3,0x29,0xe3,0x2f,0x84,
  0x53,0xd1,0x00,0xed,0x20,0xfc,0xb1,0x5b,0x6a,0xcb,0xbe,0x39,0x4a,0x4c,0x58,0xcf,
  0xd0,0xef,0xaa,0xfb,0x43,0x4d,0x33,0x85,0x45,0xf9,0x02,0x7f,0x50,0x3c,0x9f,0xa8,
  0x51,0xa3,0x40,0x8f,0x92,0x9d,0x38,0xf5,0xbc,0xb6,0xda,0x21,0x10,0xff,0xf3,0xd2,
  0xcd,0x0c,0x13,0xec,0x5f,0x97,0x44,0x17,0xc4,0xa7,0x7e,0x3d,0x64,0x5d,0x19,0x73,
  0x60,0x81,0x4f,0xdc,0x22,0x2a,0x90,0x88,0x46,0xee,0xb8,0x14,0xde,0x5e,0x0b,0xdb,
  0xe0,0x32,0x3a,0x0a,0x49,0x06,0x24,0x5c,0xc2,0xd3,0xac,0x62,0x91,0x95,0xe4,0x79,
  0xe7,0xc8,0x37,0x6d,0x8d,0xd5,0x4e,0xa9,0x6c,0x56,0xf4,0xea,0x65,0x7a,0xae,0x08,
  0xba,0x78,0x25,0x2e,0x1c,0xa6,0xb4,0xc6,0xe8,0xdd,0x74,0x1f,0x4b,0xbd,0x8b,0x8a,
  0x70,0x3e,0xb5,0x66,0x48,0x03,0xf6,0x0e,0x61,0x35,0x57,0xb9,0x86,0xc1,0x1d,0x9e,
  0xe1,0xf8,0x98,0x11,0x69,0xd9,0x8e,0x94,0x9b,0x1e,0x87,0xe9,0xce,0x55,0x28,0xdf,
  0x8c,0xa1,0x89,0x0d,0xbf,0xe6,0x42,0x68,0x41,0x99,0x2d,0x0f,0xb0,0x54,0xbb,0x16
]
const SBOXI = [
  0x52,0x09,0x6a,0xd5,0x30,0x36,0xa5,0x38,0xbf,0x40,0xa3,0x9e,0x81,0xf3,0xd7,0xfb,
  0x7c,0xe3,0x39,0x82,0x9b,0x2f,0xff,0x87,0x34,0x8e,0x43,0x44,0xc4,0xde,0xe9,0xcb,
  0x54,0x7b,0x94,0x32,0xa6,0xc2,0x23,0x3d,0xee,0x4c,0x95,0x0b,0x42,0xfa,0xc3,0x4e,
  0x08,0x2e,0xa1,0x66,0x28,0xd9,0x24,0xb2,0x76,0x5b,0xa2,0x49,0x6d,0x8b,0xd1,0x25,
  0x72,0xf8,0xf6,0x64,0x86,0x68,0x98,0x16,0xd4,0xa4,0x5c,0xcc,0x5d,0x65,0xb6,0x92,
  0x6c,0x70,0x48,0x50,0xfd,0xed,0xb9,0xda,0x5e,0x15,0x46,0x57,0xa7,0x8d,0x9d,0x84,
  0x90,0xd8,0xab,0x00,0x8c,0xbc,0xd3,0x0a,0xf7,0xe4,0x58,0x05,0xb8,0xb3,0x45,0x06,
  0xd0,0x2c,0x1e,0x8f,0xca,0x3f,0x0f,0x02,0xc1,0xaf,0xbd,0x03,0x01,0x13,0x8a,0x6b,
  0x3a,0x91,0x11,0x41,0x4f,0x67,0xdc,0xea,0x97,0xf2,0xcf,0xce,0xf0,0xb4,0xe6,0x73,
  0x96,0xac,0x74,0x22,0xe7,0xad,0x35,0x85,0xe2,0xf9,0x37,0xe8,0x1c,0x75,0xdf,0x6e,
  0x47,0xf1,0x1a,0x71,0x1d,0x29,0xc5,0x89,0x6f,0xb7,0x62,0x0e,0xaa,0x18,0xbe,0x1b,
  0xfc,0x56,0x3e,0x4b,0xc6,0xd2,0x79,0x20,0x9a,0xdb,0xc0,0xfe,0x78,0xcd,0x5a,0xf4,
  0x1f,0xdd,0xa8,0x33,0x88,0x07,0xc7,0x31,0xb1,0x12,0x10,0x59,0x27,0x80,0xec,0x5f,
  0x60,0x51,0x7f,0xa9,0x19,0xb5,0x4a,0x0d,0x2d,0xe5,0x7a,0x9f,0x93,0xc9,0x9c,0xef,
  0xa0,0xe0,0x3b,0x4d,0xae,0x2a,0xf5,0xb0,0xc8,0xeb,0xbb,0x3c,0x83,0x53,0x99,0x61,
  0x17,0x2b,0x04,0x7e,0xba,0x77,0xd6,0x26,0xe1,0x69,0x14,0x63,0x55,0x21,0x0c,0x7d
]
/* eslint-enable */

// GF(2^8) multiply
function xtime(a) { return ((a << 1) ^ (a & 0x80 ? 0x1b : 0)) & 0xff }
function gfMul(a, b) {
  return (
    (b & 1 ? a : 0) ^
    (b & 2 ? xtime(a) : 0) ^
    (b & 4 ? xtime(xtime(a)) : 0) ^
    (b & 8 ? xtime(xtime(xtime(a))) : 0) ^
    (b & 16 ? xtime(xtime(xtime(xtime(a)))) : 0)
  ) & 0xff
}

// AES-128 key schedule → 176-byte flat array (11 round keys × 16 bytes)
function expandKey(key) {
  const RCON = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36]
  const rk = new Uint8Array(176)
  rk.set(key.slice(0, 16))
  for (let i = 16; i < 176; i += 4) {
    let t0 = rk[i - 4], t1 = rk[i - 3], t2 = rk[i - 2], t3 = rk[i - 1]
    if (i % 16 === 0) {
      const tmp = t0
      t0 = SBOX[t1] ^ RCON[i / 16 - 1]
      t1 = SBOX[t2]
      t2 = SBOX[t3]
      t3 = SBOX[tmp]
    }
    rk[i]     = rk[i - 16] ^ t0
    rk[i + 1] = rk[i - 15] ^ t1
    rk[i + 2] = rk[i - 14] ^ t2
    rk[i + 3] = rk[i - 13] ^ t3
  }
  return rk
}

function encryptBlock(blk, rk) {
  const s = new Uint8Array(16)
  for (let i = 0; i < 16; i++) s[i] = blk[i] ^ rk[i]
  for (let r = 1; r <= 10; r++) {
    const t = new Uint8Array(16)
    // SubBytes + ShiftRows
    t[0]=SBOX[s[0]]; t[1]=SBOX[s[5]]; t[2]=SBOX[s[10]]; t[3]=SBOX[s[15]]
    t[4]=SBOX[s[4]]; t[5]=SBOX[s[9]]; t[6]=SBOX[s[14]]; t[7]=SBOX[s[3]]
    t[8]=SBOX[s[8]]; t[9]=SBOX[s[13]]; t[10]=SBOX[s[2]]; t[11]=SBOX[s[7]]
    t[12]=SBOX[s[12]]; t[13]=SBOX[s[1]]; t[14]=SBOX[s[6]]; t[15]=SBOX[s[11]]
    if (r < 10) {
      // MixColumns
      for (let c = 0; c < 4; c++) {
        const b = c * 4
        const a0 = t[b], a1 = t[b+1], a2 = t[b+2], a3 = t[b+3]
        s[b]   = gfMul(a0,2) ^ gfMul(a1,3) ^ a2 ^ a3
        s[b+1] = a0 ^ gfMul(a1,2) ^ gfMul(a2,3) ^ a3
        s[b+2] = a0 ^ a1 ^ gfMul(a2,2) ^ gfMul(a3,3)
        s[b+3] = gfMul(a0,3) ^ a1 ^ a2 ^ gfMul(a3,2)
      }
      for (let i = 0; i < 16; i++) s[i] ^= rk[r * 16 + i]
    } else {
      for (let i = 0; i < 16; i++) s[i] = t[i] ^ rk[160 + i]
    }
  }
  return s
}

function decryptBlock(blk, rk) {
  const s = new Uint8Array(16)
  for (let i = 0; i < 16; i++) s[i] = blk[i] ^ rk[160 + i]
  for (let r = 9; r >= 0; r--) {
    const t = new Uint8Array(16)
    // InvShiftRows + InvSubBytes
    t[0]=SBOXI[s[0]]; t[1]=SBOXI[s[13]]; t[2]=SBOXI[s[10]]; t[3]=SBOXI[s[7]]
    t[4]=SBOXI[s[4]]; t[5]=SBOXI[s[1]]; t[6]=SBOXI[s[14]]; t[7]=SBOXI[s[11]]
    t[8]=SBOXI[s[8]]; t[9]=SBOXI[s[5]]; t[10]=SBOXI[s[2]]; t[11]=SBOXI[s[15]]
    t[12]=SBOXI[s[12]]; t[13]=SBOXI[s[9]]; t[14]=SBOXI[s[6]]; t[15]=SBOXI[s[3]]
    // AddRoundKey
    for (let i = 0; i < 16; i++) t[i] ^= rk[r * 16 + i]
    if (r > 0) {
      // InvMixColumns
      for (let c = 0; c < 4; c++) {
        const b = c * 4
        const a0 = t[b], a1 = t[b+1], a2 = t[b+2], a3 = t[b+3]
        s[b]   = gfMul(a0,0xe) ^ gfMul(a1,0xb) ^ gfMul(a2,0xd) ^ gfMul(a3,0x9)
        s[b+1] = gfMul(a0,0x9) ^ gfMul(a1,0xe) ^ gfMul(a2,0xb) ^ gfMul(a3,0xd)
        s[b+2] = gfMul(a0,0xd) ^ gfMul(a1,0x9) ^ gfMul(a2,0xe) ^ gfMul(a3,0xb)
        s[b+3] = gfMul(a0,0xb) ^ gfMul(a1,0xd) ^ gfMul(a2,0x9) ^ gfMul(a3,0xe)
      }
    } else {
      for (let i = 0; i < 16; i++) s[i] = t[i]
    }
  }
  return s
}

// ─── Utilities ─────────────────────────────────────────────────────────────────
function toUtf8(str) {
  const out = []
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i)
    if (c < 0x80) { out.push(c) }
    else if (c < 0x800) { out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f)) }
    else { out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f)) }
  }
  return new Uint8Array(out)
}

function fromUtf8(bytes) {
  let s = '', i = 0
  while (i < bytes.length) {
    const b = bytes[i]
    if (b < 0x80) { s += String.fromCharCode(b); i++ }
    else if ((b & 0xe0) === 0xc0) { s += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i+1] & 0x3f)); i += 2 }
    else { s += String.fromCharCode(((b & 0x0f) << 12) | ((bytes[i+1] & 0x3f) << 6) | (bytes[i+2] & 0x3f)); i += 3 }
  }
  return s
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
function toBase64(bytes) {
  let s = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i], b1 = bytes[i+1] || 0, b2 = bytes[i+2] || 0
    s += B64[b0 >> 2] + B64[((b0 & 3) << 4) | (b1 >> 4)]
    s += (i+1 < bytes.length ? B64[((b1 & 15) << 2) | (b2 >> 6)] : '=')
    s += (i+2 < bytes.length ? B64[b2 & 63] : '=')
  }
  return s
}
function fromBase64(s) {
  const lk = {}; for (let i = 0; i < 64; i++) lk[B64[i]] = i
  const out = []
  for (let i = 0; i < s.length; i += 4) {
    const b0 = lk[s[i]], b1 = lk[s[i+1]]
    const b2 = lk[s[i+2]], b3 = lk[s[i+3]]
    out.push((b0 << 2) | (b1 >> 4))
    if (s[i+2] !== '=') out.push(((b1 & 15) << 4) | (b2 >> 2))
    if (s[i+3] !== '=') out.push(((b2 & 3) << 6) | b3)
  }
  return new Uint8Array(out)
}

// ─── AES-128-ECB with PKCS7 padding ────────────────────────────────────────────
let _rk = null
function getRK() {
  if (!_rk) _rk = expandKey(toUtf8(CIPHER_KEY))
  return _rk
}

function encrypt(plaintext) {
  if (!plaintext) return plaintext
  const src = toUtf8(String(plaintext))
  const padLen = 16 - (src.length % 16)
  const padded = new Uint8Array(src.length + padLen)
  padded.set(src)
  padded.fill(padLen, src.length)
  const rk = getRK(), out = new Uint8Array(padded.length)
  for (let i = 0; i < padded.length; i += 16) {
    out.set(encryptBlock(padded.subarray(i, i + 16), rk), i)
  }
  return ENC_PREFIX + toBase64(out)
}

function decrypt(ciphertext) {
  if (!ciphertext || ciphertext.indexOf(ENC_PREFIX) !== 0) return ciphertext
  const bytes = fromBase64(ciphertext.slice(ENC_PREFIX.length))
  const rk = getRK(), out = []
  for (let i = 0; i < bytes.length; i += 16) {
    const blk = decryptBlock(bytes.subarray(i, i + 16), rk)
    for (let j = 0; j < 16; j++) out.push(blk[j])
  }
  const pad = out[out.length - 1]
  if (pad < 1 || pad > 16) return ''
  return fromUtf8(new Uint8Array(out.slice(0, out.length - pad)))
}

// ─── SHA-256 (for hashing verification codes / future password fields) ─────────
function sha256(str) {
  /* eslint-disable no-bitwise */
  const K = new Uint32Array([
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
  ])
  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ])
  const bytes = Array.from(toUtf8(str))
  const bitLen = bytes.length * 8
  bytes.push(0x80)
  while (bytes.length % 64 !== 56) bytes.push(0)
  bytes.push(0, 0, 0, 0,
    (bitLen >>> 24) & 0xff, (bitLen >>> 16) & 0xff,
    (bitLen >>> 8) & 0xff, bitLen & 0xff)
  for (let bi = 0; bi < bytes.length; bi += 64) {
    const w = new Uint32Array(64)
    for (let j = 0; j < 16; j++) {
      w[j] = ((bytes[bi+j*4] << 24) | (bytes[bi+j*4+1] << 16) |
               (bytes[bi+j*4+2] << 8) | bytes[bi+j*4+3]) >>> 0
    }
    for (let j = 16; j < 64; j++) {
      const s0 = ((w[j-15] >>> 7) | (w[j-15] << 25)) ^ ((w[j-15] >>> 18) | (w[j-15] << 14)) ^ (w[j-15] >>> 3)
      const s1 = ((w[j-2] >>> 17) | (w[j-2] << 15)) ^ ((w[j-2] >>> 19) | (w[j-2] << 13)) ^ (w[j-2] >>> 10)
      w[j] = (w[j-16] + s0 + w[j-7] + s1) >>> 0
    }
    let [a, b, c, d, e, f, g, h] = H
    for (let j = 0; j < 64; j++) {
      const S1  = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))
      const ch  = (e & f) ^ (~e & g)
      const t1  = (h + S1 + ch + K[j] + w[j]) >>> 0
      const S0  = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const t2  = (S0 + maj) >>> 0
      h = g; g = f; f = e; e = (d + t1) >>> 0
      d = c; c = b; b = a; a = (t1 + t2) >>> 0
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0
    H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0
    H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0
  }
  /* eslint-enable no-bitwise */
  return Array.from(H).map(n => n.toString(16).padStart(8, '0')).join('')
}

/**
 * Hash a short code (e.g. 6-digit OTP) with a per-record salt.
 * Storage format: '<salt>:<sha256(salt+":"+code)>'
 */
function hashCode(code, salt) {
  return salt + ':' + sha256(salt + ':' + String(code))
}

function verifyCode(code, stored) {
  if (!stored || stored.indexOf(':') < 0) return false
  const idx = stored.indexOf(':')
  const salt = stored.slice(0, idx)
  return hashCode(code, salt) === stored
}

function randomSalt(len) {
  len = len || 8
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let s = ''
  // WeChat miniprogram: Math.random() is acceptable for non-crypto salts
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

module.exports = { encrypt, decrypt, sha256, hashCode, verifyCode, randomSalt }
