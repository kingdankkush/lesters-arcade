import {
  STACKED_BRIDGE_PROTOCOL, STACKED_MAX_MESSAGE_BYTES, STACKED_MAX_EVIDENCE_BYTES,
  STACKED_MAX_EVIDENCE_CHUNKS, STACKED_EVIDENCE_CHUNK_RAW_BYTES, STACKED_EVIDENCE_CHUNK_B64_CHARS,
  STACKED_EVIDENCE_CODEC_VERSION, STACKED_FIXED_STEP_HZ, STACKED_MAX_TICKS, STACKED_MAX_INPUT_TRANSITIONS,
} from './stacked-contracts.mjs';
import { fnv1a32Bytes } from './stacked-sim.mjs';

const sessionPattern = /^[a-z0-9][a-z0-9:_-]{2,127}$/;
const messagePattern = /^[a-z0-9][a-z0-9:_-]{0,63}$/;
const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
function exact(value, keys) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  if (![Object.prototype, null].includes(Object.getPrototypeOf(value))) return false;
  const own = Reflect.ownKeys(value);
  return own.length === keys.length && keys.every(key => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && descriptor.enumerable && Object.hasOwn(descriptor, 'value');
  });
}
export function assertStackedEvidenceHeader(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 26 || bytes.length > STACKED_MAX_EVIDENCE_BYTES) throw new RangeError('evidence byte length invalid');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0) !== 0x53494331 || bytes[4] !== STACKED_EVIDENCE_CODEC_VERSION || bytes[5] !== 1 || view.getUint16(6) !== STACKED_FIXED_STEP_HZ) throw new Error('SIC1 header invalid');
  if (view.getUint32(12) > STACKED_MAX_TICKS || view.getUint32(16) > STACKED_MAX_INPUT_TRANSITIONS || view.getUint32(16) > view.getUint32(12)) throw new Error('SIC1 counts invalid');
  if (view.getUint32(20) !== fnv1a32Bytes(bytes.subarray(24))) throw new Error('SIC1 checksum mismatch');
  return bytes;
}
export function encodeStackedBase64(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length > STACKED_MAX_EVIDENCE_BYTES) throw new RangeError('base64 input invalid');
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
export function decodeStackedBase64(text, maxBytes = STACKED_EVIDENCE_CHUNK_RAW_BYTES) {
  if (!integer(maxBytes, 0, STACKED_MAX_EVIDENCE_BYTES) || typeof text !== 'string' || text.length > Math.ceil(maxBytes / 3) * 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(text)) throw new Error('base64 payload invalid');
  const binary = atob(text);
  if (binary.length > maxBytes || btoa(binary) !== text) throw new Error('noncanonical base64 payload');
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}
export function validateStackedChunkMessage(message) {
  try {
    if (!exact(message, ['protocol', 'type', 'sessionId', 'messageId', 'payload'])) throw new Error('invalid envelope keys');
    if (message.protocol !== STACKED_BRIDGE_PROTOCOL || message.type !== 'game:evidence-chunk') throw new Error('invalid chunk protocol/type');
    if (typeof message.sessionId !== 'string' || !sessionPattern.test(message.sessionId) || typeof message.messageId !== 'string' || !messagePattern.test(message.messageId)) throw new Error('invalid chunk identity');
    const p = message.payload;
    if (!exact(p, ['chunkIndex', 'chunkCount', 'totalRawBytes', 'payload'])) throw new Error('invalid chunk payload keys');
    if (!integer(p.chunkCount, 1, STACKED_MAX_EVIDENCE_CHUNKS) || !integer(p.chunkIndex, 0, p.chunkCount - 1) || !integer(p.totalRawBytes, 26, STACKED_MAX_EVIDENCE_BYTES)) throw new Error('invalid chunk counters');
    if (p.chunkCount !== Math.ceil(p.totalRawBytes / STACKED_EVIDENCE_CHUNK_RAW_BYTES)) throw new Error('chunk count does not match total');
    if (typeof p.payload !== 'string' || p.payload.length > STACKED_EVIDENCE_CHUNK_B64_CHARS) throw new Error('chunk payload too large');
    const expected = Math.min(STACKED_EVIDENCE_CHUNK_RAW_BYTES, p.totalRawBytes - p.chunkIndex * STACKED_EVIDENCE_CHUNK_RAW_BYTES);
    if (decodeStackedBase64(p.payload).length !== expected) throw new Error('chunk byte length mismatch');
    if (new TextEncoder().encode(JSON.stringify(message)).byteLength > STACKED_MAX_MESSAGE_BYTES) throw new Error('message exceeds byte cap');
    return { ok: true, value: message };
  } catch (error) { return { ok: false, error: error.message }; }
}
export function chunkStackedEvidence(bytes, { sessionId } = {}) {
  assertStackedEvidenceHeader(bytes);
  if (typeof sessionId !== 'string' || !sessionPattern.test(sessionId)) throw new Error('invalid sessionId');
  const chunkCount = Math.ceil(bytes.length / STACKED_EVIDENCE_CHUNK_RAW_BYTES);
  const messages = [];
  for (let index = 0; index < chunkCount; index += 1) {
    const message = {
      protocol: STACKED_BRIDGE_PROTOCOL, type: 'game:evidence-chunk', sessionId,
      messageId: `evidence-${index}`,
      payload: { chunkIndex: index, chunkCount, totalRawBytes: bytes.length,
        payload: encodeStackedBase64(bytes.subarray(index * STACKED_EVIDENCE_CHUNK_RAW_BYTES, (index + 1) * STACKED_EVIDENCE_CHUNK_RAW_BYTES)) },
    };
    const validation = validateStackedChunkMessage(message);
    if (!validation.ok) throw new Error(validation.error);
    messages.push(Object.freeze({ ...message, payload: Object.freeze(message.payload) }));
  }
  return Object.freeze(messages);
}
export function reassembleStackedEvidence(messages, { sessionId } = {}) {
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > STACKED_MAX_EVIDENCE_CHUNKS) throw new Error('invalid chunk list');
  let expectedSession = sessionId;
  let total = 0;
  const ids = new Set();
  // Validate every bounded envelope before allocating the reassembly buffer.
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    const validation = validateStackedChunkMessage(message);
    if (!validation.ok) throw new Error(validation.error);
    if (index === 0) { expectedSession ??= message.sessionId; total = message.payload.totalRawBytes; }
    if (message.sessionId !== expectedSession || ids.has(message.messageId)) throw new Error('mixed or duplicate chunk identity');
    ids.add(message.messageId);
    const p = message.payload;
    if (p.chunkIndex !== index || p.chunkCount !== messages.length || p.totalRawBytes !== total) throw new Error('inconsistent or out-of-order chunks');
  }
  const bytes = new Uint8Array(total);
  for (let index = 0; index < messages.length; index += 1) bytes.set(decodeStackedBase64(messages[index].payload.payload), index * STACKED_EVIDENCE_CHUNK_RAW_BYTES);
  return assertStackedEvidenceHeader(bytes);
}
