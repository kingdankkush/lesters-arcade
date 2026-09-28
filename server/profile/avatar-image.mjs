// Custom avatar image checks (1.9.3, api/avatar.mjs).
//
// The browser re-encodes every upload to a 256×256 WebP (PNG where WebP
// encoding is unavailable) before sending it, which strips EXIF and any other
// metadata. The server never trusts that: it decodes strict base64, caps the
// bytes, identifies the format by its magic bytes only (never a client
// Content-Type), reads the pixel size from the header and rejects animation.
// The stored Content-Type is the sniffed one, so the image can only ever be
// served as image/webp, image/png or image/jpeg (never SVG or HTML).

import { createHash } from 'node:crypto';

export const AVATAR_MAX_BYTES = 96 * 1024;
export const AVATAR_MIN_SIDE = 64;
export const AVATAR_MAX_SIDE = 512;
// Square-ish: the longer side is at most 10% longer than the shorter one.
export const AVATAR_MAX_ASPECT = 1.1;
export const AVATAR_CONTENT_TYPES = Object.freeze(['image/webp', 'image/png', 'image/jpeg']);
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const ascii = (bytes, start, end) => bytes.subarray(start, end).toString('latin1');

// Strict base64 (no data: prefix, no whitespace) → Buffer, or null.
export function decodeAvatarBase64(text, { maxBytes = AVATAR_MAX_BYTES } = {}) {
  if (typeof text !== 'string' || !text || text.length % 4 !== 0 || !BASE64.test(text)) return null;
  // Reject before decoding anything larger than the cap.
  if ((text.length / 4) * 3 - (text.endsWith('==') ? 2 : text.endsWith('=') ? 1 : 0) > maxBytes) return { tooLarge: true };
  const bytes = Buffer.from(text, 'base64');
  // Buffer.from ignores bad padding; the round trip proves the text was canonical.
  if (bytes.toString('base64') !== text) return null;
  return bytes;
}

function pngInfo(bytes) {
  if (bytes.length < 33 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE) || ascii(bytes, 12, 16) !== 'IHDR') return null;
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  // APNG: an acTL chunk before the first IDAT marks an animation.
  let offset = 8;
  while (offset + 8 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = ascii(bytes, offset + 4, offset + 8);
    if (type === 'acTL') return { contentType: 'image/png', width, height, animated: true };
    if (type === 'IDAT' || type === 'IEND') break;
    offset += 12 + length;
  }
  return { contentType: 'image/png', width, height, animated: false };
}

// Start-of-frame markers: C0-CF except DHT (C4), JPG (C8) and DAC (CC).
const isSof = (marker) => marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);

function jpegInfo(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) return null;
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    let marker = bytes[offset + 1];
    // Fill bytes (0xFF 0xFF …) before a marker.
    while (marker === 0xff && offset + 2 < bytes.length) { offset += 1; marker = bytes[offset + 1]; }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { offset += 2; continue; }
    if (marker === 0xd9 || marker === 0xda) return null; // EOI or scan data before any frame header
    const length = bytes.readUInt16BE(offset + 2);
    if (length < 2) return null;
    if (isSof(marker)) {
      if (offset + 9 > bytes.length) return null;
      return { contentType: 'image/jpeg', width: bytes.readUInt16BE(offset + 7), height: bytes.readUInt16BE(offset + 5), animated: false };
    }
    offset += 2 + length;
  }
  return null;
}

function webpInfo(bytes) {
  if (bytes.length < 30 || ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 12) !== 'WEBP') return null;
  const chunk = ascii(bytes, 12, 16);
  if (chunk === 'VP8X') {
    const flags = bytes[20];
    const width = 1 + bytes.readUIntLE(24, 3);
    const height = 1 + bytes.readUIntLE(27, 3);
    return { contentType: 'image/webp', width, height, animated: (flags & 0x02) !== 0 };
  }
  if (chunk === 'VP8 ') {
    // Frame tag (3 bytes), then the key-frame start code 9D 01 2A.
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return null;
    return { contentType: 'image/webp', width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff, animated: false };
  }
  if (chunk === 'VP8L') {
    if (bytes[20] !== 0x2f) return null;
    const bits = bytes.readUInt32LE(21);
    return { contentType: 'image/webp', width: 1 + (bits & 0x3fff), height: 1 + ((bits >>> 14) & 0x3fff), animated: false };
  }
  return null;
}

// { contentType, width, height, animated } from the magic bytes, or null.
export function sniffAvatarImage(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 4) return null;
  return webpInfo(bytes) ?? pngInfo(bytes) ?? jpegInfo(bytes);
}

// The whole check. { ok: true, bytes, contentType, width, height, sha256 } or
// { ok: false, status, error } with an allowlisted error code.
export function validateAvatarUpload(base64, { maxBytes = AVATAR_MAX_BYTES } = {}) {
  const decoded = decodeAvatarBase64(base64, { maxBytes });
  if (decoded?.tooLarge) return { ok: false, status: 413, error: 'image-too-large' };
  if (!decoded || decoded.length === 0) return { ok: false, status: 400, error: 'invalid-image' };
  if (decoded.length > maxBytes) return { ok: false, status: 413, error: 'image-too-large' };
  const info = sniffAvatarImage(decoded);
  if (!info || !AVATAR_CONTENT_TYPES.includes(info.contentType)) return { ok: false, status: 415, error: 'unsupported-image-type' };
  if (info.animated) return { ok: false, status: 415, error: 'animated-image' };
  const { width, height } = info;
  const shorter = Math.min(width, height);
  const longer = Math.max(width, height);
  if (!(shorter >= AVATAR_MIN_SIDE) || !(longer <= AVATAR_MAX_SIDE) || longer > shorter * AVATAR_MAX_ASPECT) {
    return { ok: false, status: 422, error: 'invalid-image-dimensions' };
  }
  return {
    ok: true,
    bytes: decoded,
    contentType: info.contentType,
    width,
    height,
    sha256: createHash('sha256').update(decoded).digest('hex'),
  };
}
