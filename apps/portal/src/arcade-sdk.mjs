// Lester's Arcade — Game SDK contract v1 (pure, DOM-free, testable).
//
// This is the keystone contract (audit §4.2/§4.3) between the parent arcade
// shell and a sandboxed cabinet (HMH today; third-party games next). The shell
// owns identity + rails; a game NEVER touches the wallet or writes official
// state directly. A game emits INTENT; the parent verifies (re-sim/anti-cheat),
// enforces the free/ranked boundary, chain-guards, signs, and records.
//
// This module defines the wire contract + validation only. It has no DOM or
// postMessage access so it is unit-testable in Node and reusable by both sides:
//   - the cabinet uses it to build well-formed messages
//   - the parent uses it to validate + route incoming messages
// The actual postMessage transport + iframe sandbox live in the runtime, built
// on top of these pure primitives.

export const ARCADE_SDK_VERSION = '1.0.0';

// --- Lifecycle: parent → game calls ----------------------------------------
// The parent drives the cabinet through these. A conforming game exposes them
// (directly when in-process, or via postMessage commands when sandboxed).
export const SDK_LIFECYCLE_METHODS = Object.freeze([
  'init',     // init(ctx): one-time setup. ctx carries NO keys/signing ability.
  'start',    // begin a fresh session (free or ranked, per ctx.mode)
  'pause',    // freeze sim + audio (single pause gate)
  'resume',   // unfreeze
  'end',      // end current session (game over or user exit)
  'teardown', // release all resources; cabinet is being unmounted
  'resize',   // viewport changed (orientation/fullscreen) -> relayout
]);

// --- Events: game → parent messages ----------------------------------------
export const SDK_EVENTS = Object.freeze([
  'arcade.ready',               // game finished init(), ready for start()
  'arcade.sessionStart',        // a session actually began
  'arcade.statUpdate',          // periodic live stats (score/kills/etc.)
  'arcade.achievement',         // an in-game milestone the parent may unlock
  'arcade.scoreSubmit',         // INTENT to submit a ranked score (parent verifies)
  'arcade.gameOver',            // session ended with a final summary
  'arcade.requestWalletAction', // INTENT for a wallet op (parent mediates ALL of these)
]);

// The ONLY wallet actions a game may request. The parent decides whether to
// honor them; the game can never perform them itself.
export const WALLET_ACTION_KINDS = Object.freeze(['connect', 'submitRanked', 'getProfile']);

const SESSION_MODES = Object.freeze(['free', 'ranked']);

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

// Build the context object the parent hands a game at init(). CRITICAL: this
// object carries identity + capability FLAGS only — never a wallet provider,
// signer, private key, or any function that can move funds or write official
// state. A game receives the player's display identity (read-only) and the
// session mode, and emits intent for anything privileged.
export function buildInitContext({
  gameId,
  sessionId = null,
  mode = 'free',
  displayName = null,
  walletShort = null,    // truncated address for display ONLY (never full key)
  rankedEligible = false,
  aspect = '16:9',
  reducedMotion = false,
  locale = 'en',
  seed = 0,
  buildHash = null,
  seasonId = null,
} = {}) {
  if (typeof gameId !== 'string' || gameId.trim() === '') {
    throw new Error('buildInitContext: gameId is required');
  }
  if (!SESSION_MODES.includes(mode)) {
    throw new Error(`buildInitContext: mode must be one of ${SESSION_MODES.join(', ')}`);
  }
  return Object.freeze({
    sdkVersion: ARCADE_SDK_VERSION,
    gameId,
    sessionId,
    mode,
    // Identity is display-only + read-only. No provider, no signer, no keys.
    player: Object.freeze({ displayName, walletShort }),
    rankedEligible: Boolean(rankedEligible),
    aspect,
    reducedMotion: Boolean(reducedMotion),
    locale,
    seed: Math.floor(Number(seed) || 0) >>> 0,
    buildHash: typeof buildHash === 'string' && buildHash.trim() ? buildHash.trim() : null,
    seasonId: typeof seasonId === 'string' && seasonId.trim() ? seasonId.trim() : null,
    // Explicit capability ceiling: a game can ONLY ask, never do.
    capabilities: Object.freeze({ canRequestWalletAction: true, canWriteOfficialState: false }),
  });
}

// Build a well-formed game→parent message envelope. The cabinet calls this to
// emit an event; the result is what gets postMessage'd. Always stamps the SDK
// version, source tag, and a monotonic-ish sequence the parent uses for
// ordering + rate-limit accounting.
export function buildArcadeMessage(type, payload = {}, { gameId, seq = 0 } = {}) {
  if (!SDK_EVENTS.includes(type)) {
    throw new Error(`buildArcadeMessage: unknown event type "${type}"`);
  }
  if (typeof gameId !== 'string' || gameId.trim() === '') {
    throw new Error('buildArcadeMessage: gameId is required');
  }
  return Object.freeze({
    source: 'lesters-arcade-sdk',
    sdkVersion: ARCADE_SDK_VERSION,
    gameId,
    seq,
    type,
    payload: payload ?? {},
  });
}

// Per-event payload validation. Returns { valid, errors[] }. Pure — the parent
// runs this on EVERY inbound message before acting, so a malformed or hostile
// cabinet can't drive the rails with garbage.
export function validateEventPayload(type, payload) {
  const errors = [];
  const p = isPlainObject(payload) ? payload : {};
  switch (type) {
    case 'arcade.ready':
      // no required payload
      break;
    case 'arcade.sessionStart':
      if (!SESSION_MODES.includes(p.mode)) errors.push('sessionStart.mode must be free|ranked');
      break;
    case 'arcade.statUpdate':
      if (!isFiniteNumber(p.score) || p.score < 0) errors.push('statUpdate.score must be a non-negative number');
      if (p.kills != null && (!isFiniteNumber(p.kills) || p.kills < 0)) errors.push('statUpdate.kills must be a non-negative number');
      break;
    case 'arcade.achievement':
      if (typeof p.id !== 'string' || p.id.trim() === '') errors.push('achievement.id must be a non-empty string');
      break;
    case 'arcade.scoreSubmit':
      if (!isFiniteNumber(p.score) || p.score < 0) errors.push('scoreSubmit.score must be a non-negative number');
      if (!isFiniteNumber(p.survivalTime) || p.survivalTime < 0) errors.push('scoreSubmit.survivalTime (seconds) must be a non-negative number');
      break;
    case 'arcade.gameOver':
      if (!isFiniteNumber(p.score) || p.score < 0) errors.push('gameOver.score must be a non-negative number');
      break;
    case 'arcade.requestWalletAction':
      if (!WALLET_ACTION_KINDS.includes(p.action)) errors.push(`requestWalletAction.action must be one of ${WALLET_ACTION_KINDS.join(', ')}`);
      break;
    default:
      errors.push(`unknown event type: ${type}`);
  }
  return { valid: errors.length === 0, errors };
}

// Parse + fully validate an inbound message from a sandboxed cabinet. This is
// the parent's security gate (audit §4.3): strict source tag, SDK-major match,
// gameId binding (a cabinet can only speak for ITS game), known event type, and
// per-event payload schema. Returns { valid, errors[], message }.
export function parseInboundMessage(raw, { expectedGameId = null } = {}) {
  const errors = [];
  if (!isPlainObject(raw)) {
    return { valid: false, errors: ['message must be an object'], message: null };
  }
  if (raw.source !== 'lesters-arcade-sdk') {
    errors.push('message.source must be "lesters-arcade-sdk"');
  }
  if (typeof raw.sdkVersion !== 'string' || raw.sdkVersion.split('.')[0] !== ARCADE_SDK_VERSION.split('.')[0]) {
    errors.push(`message.sdkVersion major must match platform ${ARCADE_SDK_VERSION}`);
  }
  if (expectedGameId != null && raw.gameId !== expectedGameId) {
    errors.push(`message.gameId "${raw.gameId}" does not match the cabinet's registered id "${expectedGameId}"`);
  }
  if (!SDK_EVENTS.includes(raw.type)) {
    errors.push(`unknown event type: ${raw.type}`);
  } else {
    const { valid, errors: payloadErrors } = validateEventPayload(raw.type, raw.payload);
    if (!valid) errors.push(...payloadErrors);
  }
  if (errors.length > 0) return { valid: false, errors, message: null };
  return { valid: true, errors: [], message: Object.freeze({ ...raw }) };
}

export function parsePostMessageEvent(event, { expectedSourceWindow = null, expectedOrigin = null, expectedGameId = null } = {}) {
  const errors = [];
  if (expectedSourceWindow && event?.source !== expectedSourceWindow) {
    errors.push('postMessage source does not match the sandboxed cabinet frame');
  }
  if (expectedOrigin && event?.origin !== expectedOrigin) {
    errors.push(`postMessage origin "${event?.origin}" does not match expected origin "${expectedOrigin}"`);
  }
  if (errors.length > 0) return { valid: false, errors, message: null };
  return parseInboundMessage(event?.data, { expectedGameId });
}

export function resolveParentTargetOrigin({ handshakeOrigin = null, referrer = null, fallbackOrigin = null } = {}) {
  for (const candidate of [handshakeOrigin, referrer, fallbackOrigin]) {
    if (typeof candidate !== 'string' || candidate.trim() === '') continue;
    try {
      return new URL(candidate).origin;
    } catch {
      // A bare origin such as http://localhost:5173 is already accepted by URL;
      // malformed strings are ignored so callers can fail closed.
    }
  }
  return null;
}

// Fixed-window rate limiter for inbound cabinet messages (audit §4.3: "rate
// limiting on postMessage"). A hostile/buggy cabinet flooding the parent gets
// throttled. Pure + clock-injectable so it's deterministic in tests.
export function createMessageRateLimiter({ windowMs = 1000, maxPerWindow = 60 } = {}) {
  let windowStart = null;
  let count = 0;
  return {
    // Returns true if the message is ALLOWED, false if it should be dropped.
    allow(now = Date.now()) {
      if (windowStart === null || now - windowStart >= windowMs) {
        windowStart = now;
        count = 0;
      }
      count += 1;
      return count <= maxPerWindow;
    },
    reset() {
      windowStart = null;
      count = 0;
    },
  };
}

// Parent-side decision: should this scoreSubmit/requestWalletAction(submitRanked)
// be allowed onto the official rails? Encodes the free/ranked boundary +
// chain-guard the audit demands BEFORE the parent signs anything. Pure: the
// parent passes in the live session + chain facts; this returns a verdict.
export function authorizeRankedSubmit({
  mode = 'free',
  rankedEligible = false,
  walletConnected = false,
  onExpectedChain = false,
  isMockWallet = false,
} = {}) {
  const reasons = [];
  if (mode !== 'ranked') reasons.push('session is not ranked (free runs never write official state)');
  if (!rankedEligible) reasons.push('game is not ranked-eligible per its manifest');
  if (!walletConnected) reasons.push('no wallet connected');
  if (isMockWallet) reasons.push('mock wallet can never submit to official boards');
  if (!onExpectedChain) reasons.push('wallet is not on the expected LitVM chain');
  return Object.freeze({ authorized: reasons.length === 0, reasons: Object.freeze(reasons) });
}
