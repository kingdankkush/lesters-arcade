import {
  STACKED_RUN_SUMMARY_VERSION, STACKED_TERMINAL_REASONS, STACKED_MAX_TICKS,
  STACKED_MAX_SCORE, STACKED_MAX_PIECES, STACKED_MAX_LINES, STACKED_MAX_QUAD_CLEARS,
  STACKED_MAX_ELAPSED_MS, STACKED_LEVEL_CAP, STACKED_ZONE_COUNT, BOARD_ROWS,
  STACKED_DAS_RANGE_TICKS, STACKED_ARR_RANGE_TICKS, STACKED_DCD_RANGE_TICKS,
} from '../apps/portal/src/stacked-contracts.mjs';

function exact(value, keys) {
  if (!value || ![Object.prototype, null].includes(Object.getPrototypeOf(value)) || Reflect.ownKeys(value).length !== keys.length) return false;
  return keys.every(key => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && descriptor.enumerable && Object.hasOwn(descriptor, 'value');
  });
}
const int = (min, max) => value => Number.isInteger(value) && value >= min && value <= max;
const text = pattern => value => typeof value === 'string' && pattern.test(value);
const choice = values => value => values.includes(value);
const line = int(0, STACKED_MAX_LINES);
const piece = int(0, STACKED_MAX_PIECES);
const tick = int(0, STACKED_MAX_TICKS);
const schemas = {
  identity: {
    seed: int(0, 0xffffffff), buildHash: text(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/),
    mode: choice(['free', 'ranked']), seasonId: text(/^[a-z0-9][a-z0-9-]{1,63}$/),
    terminalReason: choice(STACKED_TERMINAL_REASONS), startTick: tick, endTick: tick,
  },
  totals: { score: int(0, STACKED_MAX_SCORE), survivalTicks: tick, elapsedMs: int(0, STACKED_MAX_ELAPSED_MS), level: int(1, STACKED_LEVEL_CAP), zoneReached: int(1, STACKED_ZONE_COUNT), pieces: piece, linesCleared: line },
  clears: { singles: line, doubles: line, triples: line, quadClears: int(0, STACKED_MAX_QUAD_CLEARS), perfectClears: int(0, STACKED_MAX_QUAD_CLEARS), allClearStreakMax: int(0, 1000) },
  technique: { spins: piece, spinClears: line, maxCombo: line, maxBackToBack: line, holds: piece, hardDrops: piece, softDropCells: int(0, STACKED_MAX_PIECES * BOARD_ROWS) },
  pressure: { garbageRowsReceived: line, garbageRowsCleared: line, maxStackHeight: int(0, BOARD_ROWS), topOutTick: tick },
  handling: { dasTicks: int(STACKED_DAS_RANGE_TICKS.min, STACKED_DAS_RANGE_TICKS.max), arrTicks: int(STACKED_ARR_RANGE_TICKS.min, STACKED_ARR_RANGE_TICKS.max), dcdTicks: int(STACKED_DCD_RANGE_TICKS.min, STACKED_DCD_RANGE_TICKS.max), inputDevice: choice(['keyboard', 'touch', 'gamepad', 'mixed']) },
  versus: Object.fromEntries(['wins', 'losses', 'draws', 'garbageSent', 'garbageReceived', 'kos', 'roundsPlayed'].map(key => [key, value => value === 0])),
};

// Wire validation only; canonical replay still decides score and eligibility.
export function validateStackedRunSummary(summary) {
  try {
    if (!exact(summary, ['schemaVersion', ...Object.keys(schemas)]) || summary.schemaVersion !== STACKED_RUN_SUMMARY_VERSION) return 'summary keys/version invalid';
    for (const [group, fields] of Object.entries(schemas)) {
      if (!exact(summary[group], Object.keys(fields))) return `${group} keys invalid`;
      for (const [key, validate] of Object.entries(fields)) if (!validate(summary[group][key])) return `${group}.${key} invalid`;
    }
    const { identity: i, totals: t, clears: c, technique: k, pressure: p } = summary;
    if (c.singles + 2 * c.doubles + 3 * c.triples + 4 * c.quadClears !== t.linesCleared) return 'clear total mismatch';
    if (k.spinClears > t.linesCleared || k.spins > t.pieces) return 'spin count exceeds material';
    if (k.holds + k.hardDrops > t.pieces * 2) return 'hold/drop count exceeds pieces';
    if (p.garbageRowsCleared > p.garbageRowsReceived) return 'garbage clearance exceeds receipt';
    if (i.endTick - i.startTick !== t.survivalTicks) return 'survival tick mismatch';
    if (t.linesCleared > Math.floor(t.pieces * 4 / 10) + p.garbageRowsReceived) return 'lines exceed material';
    if (i.mode === 'ranked' && t.level !== Math.min(STACKED_LEVEL_CAP, 1 + Math.floor(t.linesCleared / 10))) return 'Ranked level mismatch';
    if (Math.abs(t.elapsedMs - Math.round(t.survivalTicks * 50 / 3)) > 1) return 'elapsed time mismatch';
    if (p.topOutTick > i.endTick || (['block-out', 'lock-out', 'garbage-out'].includes(i.terminalReason) && p.topOutTick !== i.endTick)) return 'top-out tick mismatch';
    if (i.terminalReason === 'tick-ceiling' && i.endTick !== STACKED_MAX_TICKS) return 'tick ceiling mismatch';
    return '';
  } catch { return 'summary invalid'; }
}
