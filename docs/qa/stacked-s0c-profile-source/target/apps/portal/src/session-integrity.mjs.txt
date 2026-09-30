const SESSION_HANDLE_PREFIX = 'game-session-';
const MAX_INPUT_TRANSITIONS = 20_000;
const MAX_GAMEPLAY_EVENTS = 10_000;
export const CURRENT_RANKED_SEASON_ID = 'hmh-season-1-2026';

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

export function canonicalSessionJson(value) {
  return JSON.stringify(canonicalize(value));
}

function normalizeAddress(value, field) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(normalized)) throw new Error(`${field} must be an EVM address`);
  return normalized;
}

function normalizeUuid(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(normalized)) {
    throw new Error('uuid must be an RFC 4122 identifier');
  }
  return normalized;
}

function secureUuid() {
  if (typeof globalThis.crypto?.randomUUID !== 'function') {
    throw new Error('secure randomUUID is required for canonical session identity');
  }
  return globalThis.crypto.randomUUID();
}

export function createCanonicalSessionHandle({ uuid = null } = {}) {
  return `${SESSION_HANDLE_PREFIX}${normalizeUuid(uuid ?? secureUuid())}`;
}

export async function sha256Hex(value, { cryptoProvider = globalThis.crypto } = {}) {
  if (!cryptoProvider?.subtle?.digest) throw new Error('Web Crypto SHA-256 is required');
  const bytes = new TextEncoder().encode(typeof value === 'string' ? value : canonicalSessionJson(value));
  const digest = await cryptoProvider.subtle.digest('SHA-256', bytes);
  return `0x${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

export async function createCanonicalSessionIdentity({
  sessionId,
  chainId,
  scoreRegistryAddress,
  wallet,
  gameId,
  seasonId,
  buildHash,
  seed,
  nonce,
} = {}) {
  const identity = Object.freeze({
    version: 'lesters-canonical-session-v1',
    sessionId: String(sessionId ?? '').trim(),
    chainId: Math.max(0, Math.floor(Number(chainId) || 0)),
    scoreRegistryAddress: normalizeAddress(scoreRegistryAddress, 'scoreRegistryAddress'),
    wallet: normalizeAddress(wallet, 'wallet'),
    gameId: String(gameId ?? '').trim(),
    seasonId: String(seasonId ?? '').trim(),
    buildHash: String(buildHash ?? '').trim(),
    seed: Math.max(0, Math.floor(Number(seed) || 0)),
    nonce: String(nonce ?? '').trim(),
  });
  for (const key of ['sessionId', 'gameId', 'seasonId', 'buildHash', 'nonce']) {
    if (!identity[key]) throw new Error(`${key} is required`);
  }
  return Object.freeze({ ...identity, sessionKey: await sha256Hex(identity) });
}

function normalizeInput(input = {}) {
  const fixed = (value) => Number((Number(value) || 0).toFixed(4));
  return Object.freeze({
    step: Math.max(0, Math.floor(Number(input.step) || 0)),
    moveX: fixed(input.moveX),
    moveY: fixed(input.moveY),
    aimX: fixed(input.aimX),
    aimY: fixed(input.aimY),
    shoot: Boolean(input.shoot),
    grenade: Boolean(input.grenade),
    dash: Boolean(input.dash),
  });
}

function inputStateKey(input) {
  const { step: _step, ...state } = input;
  return canonicalSessionJson(state);
}

export function createSessionEvidenceState({ sessionId } = {}) {
  if (!sessionId) throw new Error('sessionId is required');
  return {
    version: 'lesters-session-evidence-v1',
    sessionId: String(sessionId),
    inputs: [],
    events: [],
    lastInputStateKey: null,
    droppedInputs: 0,
    droppedEvents: 0,
  };
}

export function recordSessionInput(evidence, input) {
  if (!evidence?.inputs) throw new Error('session evidence is required');
  const normalized = normalizeInput(input);
  const stateKey = inputStateKey(normalized);
  if (stateKey === evidence.lastInputStateKey) return false;
  evidence.lastInputStateKey = stateKey;
  if (evidence.inputs.length >= MAX_INPUT_TRANSITIONS) {
    evidence.droppedInputs += 1;
    return false;
  }
  evidence.inputs.push(normalized);
  return true;
}

export function recordSessionEvent(evidence, { step = 0, type, payload = {} } = {}) {
  if (!evidence?.events) throw new Error('session evidence is required');
  const eventType = String(type ?? '').trim();
  if (!eventType) throw new Error('event type is required');
  if (evidence.events.length >= MAX_GAMEPLAY_EVENTS) {
    evidence.droppedEvents += 1;
    return false;
  }
  evidence.events.push(Object.freeze({
    step: Math.max(0, Math.floor(Number(step) || 0)),
    type: eventType,
    payload: canonicalize(payload),
  }));
  return true;
}

export async function finalizeSessionEvidence({ identity, evidence, finalState = {} } = {}) {
  if (!evidence || evidence.sessionId !== identity?.sessionId) throw new Error('evidence sessionId must match identity sessionId');
  if (evidence.droppedInputs || evidence.droppedEvents) throw new Error('session evidence overflowed its bounded logs');
  const canonicalIdentity = await createCanonicalSessionIdentity(identity);
  const normalizedFinalState = canonicalize(finalState);
  const inputHash = await sha256Hex(evidence.inputs);
  const eventHash = await sha256Hex(evidence.events);
  const finalStateHash = await sha256Hex(normalizedFinalState);
  const envelope = Object.freeze({
    version: 'lesters-session-envelope-v1',
    identity: canonicalIdentity,
    inputHash,
    eventHash,
    finalStateHash,
    inputTransitions: evidence.inputs.length,
    gameplayEvents: evidence.events.length,
  });
  return Object.freeze({
    ...envelope,
    sessionKey: canonicalIdentity.sessionKey,
    envelopeHash: await sha256Hex(envelope),
  });
}
