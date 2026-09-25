// Keccak-256, pure and synchronous: the hash Solidity and ethers call
// keccak256 (Keccak's own padding, domain byte 0x01, not SHA3-256's 0x06).
//
// game-manifest.mjs digests manifests with it for GameRegistry anchoring. It
// used the vendored ethers `id` before, which put the whole 392 KB ethers
// chunk into the portal's and the Chikun child's first paint, although no
// first-paint code path hashes anything. tests/keccak256.test.mjs proves both
// functions equal ethers.keccak256 and ethers.id on a fixed corpus (empty
// input, ASCII, multibyte UTF-8, surrogate pairs, the 135/136/137-byte rate
// boundaries and long inputs).

const RATE_BYTES = 136; // 1088-bit rate, 512-bit capacity

// ρ rotation offsets and π destination lanes of the 24-step lane walk that
// starts at lane 1 (lane index = x + 5y).
const RHO = [1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 2, 14, 27, 41, 56, 8, 25, 43, 62, 18, 39, 61, 20, 44];
const PI = [10, 7, 11, 17, 18, 3, 5, 16, 8, 21, 24, 4, 15, 23, 19, 13, 12, 2, 20, 14, 22, 9, 6, 1];

// ι round constants as [low, high] 32-bit words, from the reference LFSR
// (x^8 + x^6 + x^5 + x^4 + 1): bit 2^j - 1 of round i is output i*7 + j.
// Marked pure so a bundle that never hashes (the portal's first paint only
// validates manifests) drops it.
const IOTA = /* @__PURE__ */ (() => {
  const constants = new Uint32Array(48);
  for (let round = 0, lfsr = 1; round < 24; round += 1) {
    for (let j = 0; j < 7; j += 1) {
      const bit = (1 << j) - 1;
      if (lfsr & 1) constants[2 * round + (bit >> 5)] ^= 1 << (bit & 31);
      lfsr = ((lfsr << 1) ^ (lfsr & 0x80 ? 0x71 : 0)) & 0xff;
    }
  }
  return constants;
})();

// Keccak-f[1600] on 25 lanes held as 50 little-endian 32-bit words
// (lane i is words 2i, low, and 2i + 1, high).
function permute(state, scratch) {
  for (let round = 0; round < 24; round += 1) {
    // θ: every lane takes the parity of its two neighbouring columns.
    for (let word = 0; word < 10; word += 1) {
      scratch[word] = state[word] ^ state[word + 10] ^ state[word + 20] ^ state[word + 30] ^ state[word + 40];
    }
    for (let x = 0; x < 5; x += 1) {
      const nextLo = scratch[((x + 1) % 5) * 2];
      const nextHi = scratch[((x + 1) % 5) * 2 + 1];
      const lo = scratch[((x + 4) % 5) * 2] ^ ((nextLo << 1) | (nextHi >>> 31));
      const hi = scratch[((x + 4) % 5) * 2 + 1] ^ ((nextHi << 1) | (nextLo >>> 31));
      for (let row = 0; row < 50; row += 10) {
        state[row + 2 * x] ^= lo;
        state[row + 2 * x + 1] ^= hi;
      }
    }
    // ρ and π: rotate each lane and move it to its new position.
    let lo = state[2];
    let hi = state[3];
    for (let step = 0; step < 24; step += 1) {
      const shift = RHO[step];
      const target = 2 * PI[step];
      const movedLo = state[target];
      const movedHi = state[target + 1];
      if (shift < 32) {
        state[target] = (lo << shift) | (hi >>> (32 - shift));
        state[target + 1] = (hi << shift) | (lo >>> (32 - shift));
      } else {
        state[target] = (hi << (shift - 32)) | (lo >>> (64 - shift));
        state[target + 1] = (lo << (shift - 32)) | (hi >>> (64 - shift));
      }
      lo = movedLo;
      hi = movedHi;
    }
    // χ: the only non-linear step, row by row.
    for (let row = 0; row < 50; row += 10) {
      for (let word = 0; word < 10; word += 1) scratch[word] = state[row + word];
      for (let word = 0; word < 10; word += 1) {
        state[row + word] = scratch[word] ^ (~scratch[(word + 2) % 10] & scratch[(word + 4) % 10]);
      }
    }
    // ι
    state[0] ^= IOTA[2 * round];
    state[1] ^= IOTA[2 * round + 1];
  }
}

function absorb(state, bytes, offset) {
  for (let index = 0; index < RATE_BYTES; index += 1) {
    state[index >> 2] ^= bytes[offset + index] << ((index & 3) * 8);
  }
}

// keccak256(Uint8Array) -> '0x' + 64 lowercase hex digits, like
// ethers.keccak256.
export function keccak256(bytes) {
  if (!(bytes instanceof Uint8Array)) throw new TypeError('keccak256 needs a Uint8Array');
  const state = new Uint32Array(50);
  const scratch = new Uint32Array(10);
  const whole = bytes.length - (bytes.length % RATE_BYTES);
  for (let offset = 0; offset < whole; offset += RATE_BYTES) {
    absorb(state, bytes, offset);
    permute(state, scratch);
  }
  // The last block is always padded, even when it holds no input:
  // 0x01 after the input, 0x80 in the last byte of the rate.
  const last = new Uint8Array(RATE_BYTES);
  last.set(bytes.subarray(whole));
  last[bytes.length - whole] ^= 0x01;
  last[RATE_BYTES - 1] ^= 0x80;
  absorb(state, last, 0);
  permute(state, scratch);
  let hex = '0x';
  for (let index = 0; index < 32; index += 1) {
    hex += ((state[index >> 2] >>> ((index & 3) * 8)) & 0xff).toString(16).padStart(2, '0');
  }
  return hex;
}

// UTF-16 -> UTF-8 exactly as ethers' toUtf8Bytes does it: a high surrogate
// without its low half throws, and a lone low surrogate is encoded as its own
// three-byte sequence (TextEncoder would write U+FFFD instead).
export function utf8Bytes(text) {
  if (typeof text !== 'string') throw new TypeError('utf8Bytes needs a string');
  const out = [];
  for (let index = 0; index < text.length; index += 1) {
    const unit = text.charCodeAt(index);
    if (unit < 0x80) {
      out.push(unit);
    } else if (unit < 0x800) {
      out.push((unit >> 6) | 0xc0, (unit & 0x3f) | 0x80);
    } else if ((unit & 0xfc00) === 0xd800) {
      index += 1;
      const low = text.charCodeAt(index);
      if (!(index < text.length && (low & 0xfc00) === 0xdc00)) throw new TypeError('invalid surrogate pair');
      const point = 0x10000 + ((unit & 0x3ff) << 10) + (low & 0x3ff);
      out.push((point >> 18) | 0xf0, ((point >> 12) & 0x3f) | 0x80, ((point >> 6) & 0x3f) | 0x80, (point & 0x3f) | 0x80);
    } else {
      out.push((unit >> 12) | 0xe0, ((unit >> 6) & 0x3f) | 0x80, (unit & 0x3f) | 0x80);
    }
  }
  return Uint8Array.from(out);
}

// keccakUtf8(text) equals ethers.id(text): the Keccak-256 of its UTF-8 bytes.
export function keccakUtf8(text) {
  return keccak256(utf8Bytes(text));
}
