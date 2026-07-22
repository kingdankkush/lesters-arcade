export const HMH_BRIDGE_PROTOCOL = 'hmh-bridge/v1';
export const HMH_MAX_MESSAGE_BYTES = 64 * 1024;

const SESSION_ID_PATTERN = /^[a-z0-9][a-z0-9:_-]{2,127}$/;
const MESSAGE_ID_PATTERN = /^[a-z0-9][a-z0-9:_-]{0,63}$/;
const NONCE_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,63}$/;
const CAPABILITIES = new Set(['pause', 'settings', 'restart', 'resize']);

function fail(error) {
  return { ok: false, error };
}

function pass(value) {
  return { ok: true, value };
}

function isPlainRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value, expected, label) {
  if (!isPlainRecord(value)) return `${label} must be a plain object`;
  const expectedSet = new Set(expected);
  for (const key of Object.keys(value)) {
    if (!expectedSet.has(key)) return `${label} has unexpected field: ${key}`;
  }
  for (const key of expected) {
    if (!Object.hasOwn(value, key)) return `${label} is missing field: ${key}`;
  }
  return '';
}

function serializedSize(value) {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength;
  } catch {
    return Infinity;
  }
}

function validateSettings(value) {
  const fields = ['musicEnabled', 'screenShake', 'gore', 'reduceMotion', 'reduceFlash', 'colorblindTags'];
  const keyError = exactKeys(value, fields, 'settings');
  if (keyError) return keyError;
  for (const field of fields) {
    if (typeof value[field] !== 'boolean') return `settings.${field} must be boolean`;
  }
  return '';
}

function validateBaseEnvelope(input) {
  if (serializedSize(input) > HMH_MAX_MESSAGE_BYTES) return fail('message exceeds size limit');
  const keyError = exactKeys(input, ['protocol', 'type', 'sessionId', 'messageId', 'payload'], 'message');
  if (keyError) return fail(keyError);
  if (input.protocol !== HMH_BRIDGE_PROTOCOL) return fail('unsupported protocol');
  if (!SESSION_ID_PATTERN.test(input.sessionId)) return fail('invalid sessionId');
  if (!MESSAGE_ID_PATTERN.test(input.messageId)) return fail('invalid messageId');
  if (!isPlainRecord(input.payload)) return fail('payload must be a plain object');
  return pass(input);
}

function validatePortalInit(payload) {
  const keyError = exactKeys(payload, ['mode', 'heroId', 'settings'], 'portal:init payload');
  if (keyError) return keyError;
  if (payload.mode !== 'free' && payload.mode !== 'ranked') return 'portal:init mode must be free or ranked';
  if (!ID_PATTERN.test(payload.heroId)) return 'portal:init heroId is invalid';
  return validateSettings(payload.settings);
}

function validateGameReady(payload) {
  const keyError = exactKeys(payload, ['runtimeVersion', 'renderer', 'capabilities'], 'game:ready payload');
  if (keyError) return keyError;
  if (!/^\d+\.\d+\.\d+$/.test(payload.runtimeVersion)) return 'game:ready runtimeVersion must be semver';
  if (payload.renderer !== 'pixi.js') return 'game:ready renderer must be pixi.js';
  if (!Array.isArray(payload.capabilities) || payload.capabilities.length > CAPABILITIES.size) return 'game:ready capabilities are invalid';
  if (payload.capabilities.some((value) => typeof value !== 'string' || !CAPABILITIES.has(value))) return 'game:ready capability is unsupported';
  if (new Set(payload.capabilities).size !== payload.capabilities.length) return 'game:ready capabilities must be unique';
  return '';
}

function finiteInRange(value, minimum, maximum) {
  return Number.isFinite(value) && value >= minimum && value <= maximum;
}

function integerInRange(value, minimum, maximum) {
  return Number.isInteger(value) && value >= minimum && value <= maximum;
}

function validateEmptyPayload(payload, label) {
  return exactKeys(payload, [], `${label} payload`);
}

function validateSettingsPayload(payload) {
  const keyError = exactKeys(payload, ['settings'], 'portal:settings payload');
  return keyError || validateSettings(payload.settings);
}

function validateGameState(payload) {
  const fields = ['status', 'score', 'kills', 'elapsedMs', 'health', 'maxHealth', 'xp', 'level', 'paused'];
  const keyError = exactKeys(payload, fields, 'game:state payload');
  if (keyError) return keyError;
  if (!new Set(['booting', 'ready', 'running', 'paused', 'game-over']).has(payload.status)) return 'game:state status is invalid';
  if (!integerInRange(payload.score, 0, 1_000_000_000_000)) return 'game:state score is invalid';
  if (!integerInRange(payload.kills, 0, 10_000_000)) return 'game:state kills is invalid';
  if (!finiteInRange(payload.elapsedMs, 0, 1_000_000_000)) return 'game:state elapsedMs is invalid';
  if (!finiteInRange(payload.maxHealth, 1, 1_000_000)) return 'game:state maxHealth is invalid';
  if (!finiteInRange(payload.health, 0, payload.maxHealth)) return 'game:state health is invalid';
  if (!finiteInRange(payload.xp, 0, 1_000_000_000_000)) return 'game:state xp is invalid';
  if (!integerInRange(payload.level, 1, 1000)) return 'game:state level is invalid';
  if (typeof payload.paused !== 'boolean') return 'game:state paused must be boolean';
  return '';
}

function validateGameOver(payload) {
  const keyError = exactKeys(payload, ['score', 'kills', 'elapsedMs', 'reason'], 'game:game-over payload');
  if (keyError) return keyError;
  if (!integerInRange(payload.score, 0, 1_000_000_000_000)) return 'game:game-over score is invalid';
  if (!integerInRange(payload.kills, 0, 10_000_000)) return 'game:game-over kills is invalid';
  if (!finiteInRange(payload.elapsedMs, 0, 1_000_000_000)) return 'game:game-over elapsedMs is invalid';
  if (!new Set(['defeated', 'completed', 'abandoned', 'runtime-error']).has(payload.reason)) return 'game:game-over reason is invalid';
  return '';
}

function validateGameError(payload) {
  const keyError = exactKeys(payload, ['code', 'message'], 'game:error payload');
  if (keyError) return keyError;
  if (!ID_PATTERN.test(payload.code)) return 'game:error code is invalid';
  if (typeof payload.message !== 'string' || payload.message.length < 1 || payload.message.length > 256 || /[<>]/.test(payload.message)) return 'game:error message is invalid';
  return '';
}

export function createBridgeEnvelope({ type, sessionId, messageId, payload }) {
  return { protocol: HMH_BRIDGE_PROTOCOL, type, sessionId, messageId, payload };
}

export function validateConnectMessage(input) {
  if (serializedSize(input) > HMH_MAX_MESSAGE_BYTES) return fail('connect message exceeds size limit');
  const keyError = exactKeys(input, ['protocol', 'type', 'nonce'], 'connect message');
  if (keyError) return fail(keyError);
  if (input.protocol !== HMH_BRIDGE_PROTOCOL) return fail('unsupported protocol');
  if (input.type !== 'portal:connect') return fail('unsupported connect message type');
  if (!NONCE_PATTERN.test(input.nonce)) return fail('invalid connect nonce');
  return pass(input);
}

export function validateParentMessage(input) {
  const base = validateBaseEnvelope(input);
  if (!base.ok) return base;
  let error = '';
  if (input.type === 'portal:init') error = validatePortalInit(input.payload);
  else if (input.type === 'portal:settings') error = validateSettingsPayload(input.payload);
  else if (['portal:pause', 'portal:resume', 'portal:restart', 'portal:dispose'].includes(input.type)) error = validateEmptyPayload(input.payload, input.type);
  else return fail('unsupported parent message type');
  return error ? fail(error) : pass(input);
}

export function validateChildMessage(input) {
  const base = validateBaseEnvelope(input);
  if (!base.ok) return base;
  let error = '';
  if (input.type === 'game:ready') error = validateGameReady(input.payload);
  else if (input.type === 'game:state') error = validateGameState(input.payload);
  else if (input.type === 'game:game-over') error = validateGameOver(input.payload);
  else if (input.type === 'game:error') error = validateGameError(input.payload);
  else return fail('unsupported child message type');
  return error ? fail(error) : pass(input);
}
