export const CHIKUN_BRIDGE_PROTOCOL = 'chikun-bridge/v1';
export const CHIKUN_MAX_MESSAGE_BYTES = 64 * 1024;

const SESSION_ID_PATTERN = /^[a-z0-9][a-z0-9:_-]{2,127}$/;
const MESSAGE_ID_PATTERN = /^[a-z0-9][a-z0-9:_-]{0,63}$/;
const NONCE_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,63}$/;

function pass(value) { return { ok: true, value }; }
function fail(error) { return { ok: false, error }; }
function isRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
function exactKeys(value, expected, label) {
  if (!isRecord(value)) return `${label} must be a plain object`;
  const set = new Set(expected);
  for (const key of Object.keys(value)) if (!set.has(key)) return `${label} has unexpected field: ${key}`;
  for (const key of expected) if (!Object.hasOwn(value, key)) return `${label} is missing field: ${key}`;
  return '';
}
function sizeOf(value) {
  try { return new TextEncoder().encode(JSON.stringify(value)).byteLength; } catch { return Infinity; }
}
function integer(value, minimum, maximum) { return Number.isInteger(value) && value >= minimum && value <= maximum; }
function finite(value, minimum, maximum) { return Number.isFinite(value) && value >= minimum && value <= maximum; }
function validateEmpty(payload, label) { return exactKeys(payload, [], `${label} payload`); }

function validateBase(input) {
  if (sizeOf(input) > CHIKUN_MAX_MESSAGE_BYTES) return fail('message exceeds size limit');
  const error = exactKeys(input, ['protocol', 'type', 'sessionId', 'messageId', 'payload'], 'message');
  if (error) return fail(error);
  if (input.protocol !== CHIKUN_BRIDGE_PROTOCOL) return fail('unsupported protocol');
  if (!SESSION_ID_PATTERN.test(input.sessionId)) return fail('invalid sessionId');
  if (!MESSAGE_ID_PATTERN.test(input.messageId)) return fail('invalid messageId');
  if (!isRecord(input.payload)) return fail('payload must be a plain object');
  return pass(input);
}

function validateProfile(value) {
  const error = exactKeys(value, ['displayName', 'locale'], 'profile');
  if (error) return error;
  if (typeof value.displayName !== 'string' || value.displayName.length < 1 || value.displayName.length > 64 || /[<>\u0000-\u001f]/.test(value.displayName)) return 'profile.displayName is invalid';
  if (typeof value.locale !== 'string' || !/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(value.locale)) return 'profile.locale is invalid';
  return '';
}

function validateSettings(value) {
  const error = exactKeys(value, ['musicEnabled', 'reduceMotion'], 'settings');
  if (error) return error;
  if (typeof value.musicEnabled !== 'boolean' || typeof value.reduceMotion !== 'boolean') return 'settings values must be boolean';
  return '';
}

function validateInit(payload) {
  const error = exactKeys(payload, ['gameId', 'mode', 'profile', 'session', 'settings'], 'portal:init payload');
  if (error) return error;
  if (payload.gameId !== 'chikun') return 'portal:init gameId is invalid';
  if (!['free', 'ranked'].includes(payload.mode)) return 'portal:init mode is invalid';
  const profileError = validateProfile(payload.profile);
  if (profileError) return profileError;
  const sessionError = exactKeys(payload.session, ['seed', 'buildHash', 'seasonId', 'rankedEligible'], 'portal:init session');
  if (sessionError) return sessionError;
  if (!integer(payload.session.seed, 0, 0xffff_ffff)) return 'portal:init seed is invalid';
  if (typeof payload.session.buildHash !== 'string' || payload.session.buildHash.length < 3 || payload.session.buildHash.length > 127) return 'portal:init buildHash is invalid';
  if (typeof payload.session.seasonId !== 'string' || payload.session.seasonId.length < 3 || payload.session.seasonId.length > 127) return 'portal:init seasonId is invalid';
  if (typeof payload.session.rankedEligible !== 'boolean') return 'portal:init rankedEligible must be boolean';
  if (payload.session.rankedEligible !== (payload.mode === 'ranked')) return 'portal:init ranked eligibility does not match mode';
  return validateSettings(payload.settings);
}

function validateState(payload) {
  const error = exactKeys(payload, ['status', 'score', 'coinsCollected', 'forksPassed', 'survivalTicks', 'paused'], 'game:state payload');
  if (error) return error;
  if (!['ready', 'running', 'paused', 'game-over'].includes(payload.status)) return 'game:state status is invalid';
  for (const field of ['score', 'coinsCollected', 'forksPassed', 'survivalTicks']) {
    if (!integer(payload[field], 0, 1_000_000_000)) return `game:state ${field} is invalid`;
  }
  if (typeof payload.paused !== 'boolean') return 'game:state paused must be boolean';
  return '';
}

function validateEvidence(value) {
  const error = exactKeys(value, ['version', 'seed', 'fixedStepHz', 'maxTicks', 'flapSteps'], 'evidence');
  if (error) return error;
  if (value.version !== 'chikun-flap-evidence-v1') return 'evidence version is invalid';
  if (!integer(value.seed, 0, 0xffff_ffff) || value.fixedStepHz !== 60 || !integer(value.maxTicks, 1, 216_000)) return 'evidence metadata is invalid';
  if (!Array.isArray(value.flapSteps) || value.flapSteps.length > 4096) return 'evidence flapSteps are invalid';
  let previous = -1;
  for (const tick of value.flapSteps) {
    if (!integer(tick, 0, value.maxTicks - 1) || tick <= previous) return 'evidence flapSteps must be bounded and strictly increasing';
    previous = tick;
  }
  return '';
}

function validateFinalState(value) {
  const error = exactKeys(value, ['step', 'y', 'velocity', 'score', 'coinsCollected', 'forksPassed', 'survivalTicks', 'survivalTime', 'crashed', 'terminalReason'], 'finalState');
  if (error) return error;
  if (!integer(value.step, 0, 216_000) || !finite(value.y, -10_000, 10_000) || !finite(value.velocity, -1_000, 1_000)) return 'finalState motion values are invalid';
  for (const field of ['score', 'coinsCollected', 'forksPassed', 'survivalTicks']) if (!integer(value[field], 0, 1_000_000_000)) return `finalState ${field} is invalid`;
  if (!finite(value.survivalTime, 0, 3_600) || typeof value.crashed !== 'boolean') return 'finalState terminal values are invalid';
  if (!['run-complete', 'ceiling', 'ground', 'fork'].includes(value.terminalReason)) return 'finalState terminalReason is invalid';
  return '';
}

function validateReplayClaim(value) {
  const error = exactKeys(value, ['version', 'seed', 'buildHash', 'seasonId', 'evidence', 'finalState'], 'replayClaim');
  if (error) return error;
  if (value.version !== 'chikun-parent-replay-v1' || !integer(value.seed, 0, 0xffff_ffff)) return 'replayClaim binding is invalid';
  if (typeof value.buildHash !== 'string' || typeof value.seasonId !== 'string') return 'replayClaim metadata is invalid';
  return validateEvidence(value.evidence) || validateFinalState(value.finalState);
}

function validateResult(payload) {
  const error = exactKeys(payload, ['score', 'survivalTime', 'survivalTicks', 'coinsCollected', 'forksPassed', 'achievements', 'evidence', 'finalState', 'replayClaim'], 'game:result payload');
  if (error) return error;
  for (const field of ['score', 'survivalTicks', 'coinsCollected', 'forksPassed']) if (!integer(payload[field], 0, 1_000_000_000)) return `game:result ${field} is invalid`;
  if (!finite(payload.survivalTime, 0, 3_600)) return 'game:result survivalTime is invalid';
  if (!Array.isArray(payload.achievements) || payload.achievements.length > 32 || payload.achievements.some((value) => typeof value !== 'string' || !ID_PATTERN.test(value))) return 'game:result achievements are invalid';
  return validateEvidence(payload.evidence) || validateFinalState(payload.finalState) || validateReplayClaim(payload.replayClaim);
}

function validateReady(payload) {
  const error = exactKeys(payload, ['runtimeVersion', 'renderer', 'capabilities'], 'game:ready payload');
  if (error) return error;
  if (!/^\d+\.\d+\.\d+$/.test(payload.runtimeVersion) || payload.renderer !== 'canvas-2d') return 'game:ready runtime metadata is invalid';
  const allowed = new Set(['pause', 'restart', 'score-result', 'fullscreen']);
  if (!Array.isArray(payload.capabilities) || payload.capabilities.some((value) => !allowed.has(value)) || new Set(payload.capabilities).size !== payload.capabilities.length) return 'game:ready capabilities are invalid';
  return '';
}

export function createChikunBridgeEnvelope({ type, sessionId, messageId, payload }) {
  return { protocol: CHIKUN_BRIDGE_PROTOCOL, type, sessionId, messageId, payload };
}

export function validateChikunConnectMessage(input) {
  if (sizeOf(input) > CHIKUN_MAX_MESSAGE_BYTES) return fail('connect message exceeds size limit');
  const error = exactKeys(input, ['protocol', 'type', 'nonce'], 'connect message');
  if (error) return fail(error);
  if (input.protocol !== CHIKUN_BRIDGE_PROTOCOL || input.type !== 'portal:connect') return fail('unsupported connect message');
  if (!NONCE_PATTERN.test(input.nonce)) return fail('invalid connect nonce');
  return pass(input);
}

export function validateChikunParentMessage(input) {
  const base = validateBase(input);
  if (!base.ok) return base;
  let error = '';
  if (input.type === 'portal:init') error = validateInit(input.payload);
  else if (input.type === 'portal:settings') {
    const keyError = exactKeys(input.payload, ['settings'], 'portal:settings payload');
    error = keyError || validateSettings(input.payload.settings);
  } else if (['portal:pause', 'portal:resume', 'portal:restart', 'portal:dispose'].includes(input.type)) error = validateEmpty(input.payload, input.type);
  else return fail('unsupported parent message type');
  return error ? fail(error) : pass(input);
}

export function validateChikunChildMessage(input) {
  const base = validateBase(input);
  if (!base.ok) return base;
  let error = '';
  if (input.type === 'game:ready') error = validateReady(input.payload);
  else if (input.type === 'game:state') error = validateState(input.payload);
  else if (input.type === 'game:result') error = validateResult(input.payload);
  else if (input.type === 'game:restart-request' || input.type === 'game:exit-request') error = validateEmpty(input.payload, input.type);
  else if (input.type === 'game:pause') {
    error = exactKeys(input.payload, ['paused', 'source'], 'game:pause payload');
    if (!error && (typeof input.payload.paused !== 'boolean' || !['portal', 'visibility', 'user'].includes(input.payload.source))) error = 'game:pause payload is invalid';
  } else if (input.type === 'game:error') {
    error = exactKeys(input.payload, ['code', 'message'], 'game:error payload');
    if (!error && (!ID_PATTERN.test(input.payload.code) || typeof input.payload.message !== 'string' || input.payload.message.length > 256)) error = 'game:error payload is invalid';
  } else return fail('unsupported child message type');
  return error ? fail(error) : pass(input);
}
