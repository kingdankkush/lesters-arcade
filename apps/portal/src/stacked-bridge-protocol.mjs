import {
  STACKED_GAME_ID, STACKED_BRIDGE_PROTOCOL, STACKED_MAX_MESSAGE_BYTES,
  STACKED_ACTIONS, STACKED_CAPABILITIES, STACKED_RESULT_TUPLE_TAG, STACKED_TERMINAL_REASONS,
  STACKED_LEVEL_CAP, GRAVITY_LEVEL_CAP, STACKED_MAX_INPUT_TRANSITIONS, STACKED_MAX_TICKS, STACKED_MAX_SCORE, STACKED_MAX_PIECES,
  STACKED_MAX_LINES, STACKED_MAX_QUAD_CLEARS,
  STACKED_MAX_ELAPSED_MS, STACKED_MAX_EVIDENCE_BYTES,
  STACKED_MAX_EVIDENCE_CHUNKS, STACKED_EVIDENCE_CHUNK_RAW_BYTES,
} from './stacked-contracts.mjs';
import { validateStackedChunkMessage } from './stacked-evidence-transport.mjs';
import { validateStackedRunSummary } from '../../../sdk/stacked-run-summary-schema.mjs';

function exact(value, keys) {
  if (!value || ![Object.prototype, null].includes(Object.getPrototypeOf(value)) || Reflect.ownKeys(value).length !== keys.length) return false;
  return keys.every(key => {
    const d = Object.getOwnPropertyDescriptor(value, key);
    return d && d.enumerable && Object.hasOwn(d, 'value');
  });
}
const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
const number = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const bool = value => typeof value === 'boolean';
const token = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
const season = value => typeof value === 'string' && /^[a-z0-9][a-z0-9-]{1,63}$/.test(value);
const string = (value, min, max) => typeof value === 'string' && value.length >= min && value.length <= max;
const fields = (value, validators) => exact(value, Object.keys(validators)) && Object.entries(validators).every(([key, test]) => test(value[key]));
const tick = value => integer(value, 0, STACKED_MAX_TICKS);
const line = value => integer(value, 0, STACKED_MAX_LINES);
const piece = value => integer(value, 0, STACKED_MAX_PIECES);
const score = value => integer(value, 0, STACKED_MAX_SCORE);
const level = value => integer(value, 1, STACKED_LEVEL_CAP);
const hash = value => typeof value === 'string' && /^0x[a-f0-9]{64}$/.test(value);

// Canonical nested portal settings (§12); init alone adds startLevel.
export function validateStackedBridgeSettings(settings, { initial = false } = {}) {
  try {
    if (!exact(settings, ['version', 'handling', 'controls', 'video', 'audio', 'accessibility', ...(initial ? ['startLevel'] : [])]) || settings.version !== 1) return false;
    if (initial && !integer(settings.startLevel, 1, GRAVITY_LEVEL_CAP)) return false;
    if (!fields(settings.handling, { dasMs: v => integer(v, 67, 300), arrMs: v => integer(v, 17, 100), dcdMs: v => integer(v, 0, 133), cancelDas: bool })) return false;
    const binding = value => fields(value, { primary: token, secondary: v => v === null || token(v) });
    if (!fields(settings.controls, {
      keyboardBindings: v => exact(v, STACKED_ACTIONS) && STACKED_ACTIONS.every(key => binding(v[key])),
      touchLayout: v => ['gesture', 'buttons'].includes(v), touchOpacity: v => number(v, 0.2, 0.8),
      touchLeftHanded: bool, touchSensitivity: v => number(v, 0.5, 2),
    })) return false;
    if (!fields(settings.video, { qualityTier: v => ['auto', 'desktopHigh', 'desktopLow', 'mobile'].includes(v), reducedEffects: bool, audioReactive: bool, ghostPiece: bool, gridLines: bool })) return false;
    if (!fields(settings.audio, { musicEnabled: bool, sfxEnabled: bool, sfxVolume: v => number(v, 0, 1) })) return false;
    return fields(settings.accessibility, { reduceMotion: bool, reduceFlash: bool, colorblindPieces: bool, hudScale: v => number(v, 0.75, 1.5) });
  } catch { return false; }
}

function resultTuple(t) {
  if (!fields(t, {
    v: v => v === STACKED_RESULT_TUPLE_TAG, gameId: v => v === STACKED_GAME_ID,
    seed: v => integer(v, 0, 0xffffffff), buildHash: token, seasonId: season,
    ticks: tick, pieces: piece, lines: line, level, score,
    quadClears: v => integer(v, 0, STACKED_MAX_QUAD_CLEARS), spins: piece,
    perfectClears: v => integer(v, 0, STACKED_MAX_QUAD_CLEARS), maxCombo: line, maxBackToBack: line,
    garbageRowsReceived: line, garbageGroups: line, garbageRowsCleared: line,
    holdsUsed: piece, bagRefills: piece,
    bagDraws: v => integer(v, 0, STACKED_MAX_PIECES * 6), garbageDraws: v => integer(v, 0, STACKED_MAX_LINES * 2),
    transitionCount: v => integer(v, 0, STACKED_MAX_INPUT_TRANSITIONS), boardHash: hash,
    terminalReason: v => STACKED_TERMINAL_REASONS.includes(v),
  })) return false;
  return t.bagRefills === 2 + Math.floor(t.pieces / 7) && t.bagDraws >= t.bagRefills * 6 && t.garbageDraws >= t.garbageGroups
    && t.transitionCount <= t.ticks + 1 && t.garbageRowsCleared <= t.garbageRowsReceived;
}
function result(payload) {
  if (!fields(payload, {
    v: value => value === 'stacked-run-payload-v1',
    score,
    evidenceDigest: hash,
    totalRawBytes: value => integer(value, 26, STACKED_MAX_EVIDENCE_BYTES),
    tuple: resultTuple,
    summary: value => validateStackedRunSummary(value) === '',
    runStats: value => fields(value, {
      pauseCount: v => integer(v, 0, Number.MAX_SAFE_INTEGER),
      pausedWallClockMs: v => integer(v, 0, Number.MAX_SAFE_INTEGER),
      sampledTicksPerSecond: v => number(v, 0, Number.MAX_SAFE_INTEGER),
      qualityTier: v => ['desktopHigh', 'desktopLow', 'mobile'].includes(v),
      reducedMotion: bool,
      droppedInputs: v => integer(v, 0, Number.MAX_SAFE_INTEGER),
      degradationLevel: v => integer(v, 0, 3),
    }),
  })) return false;
  const { summary: s, tuple: t } = payload;
  return payload.score === s.totals.score && payload.score === t.score
    && s.totals.survivalTicks === t.ticks
    && s.identity.seed === t.seed
    && s.identity.buildHash === t.buildHash && s.identity.seasonId === t.seasonId
    && s.identity.terminalReason === t.terminalReason && s.totals.pieces === t.pieces
    && s.totals.linesCleared === t.lines && s.totals.level === t.level
    && s.clears.quadClears === t.quadClears && s.clears.perfectClears === t.perfectClears
    && s.technique.spins === t.spins && s.technique.maxCombo === t.maxCombo
    && s.technique.maxBackToBack === t.maxBackToBack && s.technique.holds === t.holdsUsed
    && s.pressure.garbageRowsReceived === t.garbageRowsReceived
    && s.pressure.garbageRowsCleared === t.garbageRowsCleared;
}
const validators = {
  'portal:init': p => fields(p, {
    gameId: v => v === STACKED_GAME_ID, mode: v => ['free', 'ranked'].includes(v),
    profile: v => fields(v, { displayName: x => string(x, 1, 96), locale: x => typeof x === 'string' && /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/.test(x) && x.length <= 35 }),
    session: v => fields(v, { seed: x => integer(x, 0, 0xffffffff), buildHash: token, seasonId: season, rankedEligible: bool }),
    settings: v => validateStackedBridgeSettings(v, { initial: true }),
  }) && p.session.rankedEligible === (p.mode === 'ranked') && (p.mode !== 'ranked' || p.settings.startLevel === 1),
  'portal:settings': p => fields(p, { settings: v => validateStackedBridgeSettings(v) }),
  'portal:pause': p => exact(p, []), 'portal:resume': p => exact(p, []), 'portal:exit': p => exact(p, []),
  'portal:audio-frame': p => fields(p, { audio: a => fields(a, {
    t: v => integer(v, 0, 1048575), sub: v => integer(v, 0, 1000), bass: v => integer(v, 0, 1000),
    lowMid: v => integer(v, 0, 1000), mid: v => integer(v, 0, 1000), high: v => integer(v, 0, 1000),
    level: v => integer(v, 0, 1000), onset: bool, beatPhase: v => integer(v, 0, 1000),
    bpm: v => v === 0 || integer(v, 600, 2000), available: bool,
  }) }),
  'game:ready': p => fields(p, {
    runtimeVersion: token, renderer: v => v === 'pixi-webgl',
    capabilities: v => Array.isArray(v) && v.length <= STACKED_CAPABILITIES.length && Object.keys(v).length === v.length
      && v.every(item => STACKED_CAPABILITIES.includes(item)) && new Set(v).size === v.length,
  }),
  'game:state': p => fields(p, { status: v => ['ready', 'running', 'paused', 'terminal'].includes(v), score, linesCleared: line, level, survivalTicks: tick, paused: bool }),
  'game:result': result,
  'game:error': p => fields(p, { code: token, message: v => string(v, 1, 512) }),
};

export function validateStackedBridgeMessage(message, { sessionId } = {}) {
  try {
    if (!exact(message, ['protocol', 'type', 'sessionId', 'messageId', 'payload'])
      || message.protocol !== STACKED_BRIDGE_PROTOCOL
      || typeof message.sessionId !== 'string' || !/^[a-z0-9][a-z0-9:_-]{2,127}$/.test(message.sessionId)
      || typeof message.messageId !== 'string' || !/^[a-z0-9][a-z0-9:_-]{0,63}$/.test(message.messageId)
      || (sessionId !== undefined && message.sessionId !== sessionId)) return { ok: false, error: 'invalid-envelope' };
    if (message.type === 'game:evidence-chunk') return validateStackedChunkMessage(message, { sessionId });
    if (!Object.hasOwn(validators, message.type) || !validators[message.type](message.payload)) return { ok: false, error: 'invalid-payload' };
    if (new TextEncoder().encode(JSON.stringify(message)).length > STACKED_MAX_MESSAGE_BYTES) return { ok: false, error: 'message-too-large' };
    return { ok: true };
  } catch { return { ok: false, error: 'invalid-message' }; }
}

