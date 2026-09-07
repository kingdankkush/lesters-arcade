export const STACKED_VERSUS_TABLE_VERSION = 'stacked-versus-table-v1';

export const STACKED_ATTACK_TABLE = Object.freeze({
  version: STACKED_VERSUS_TABLE_VERSION,
  base: Object.freeze([0, 0, 1, 2, 4]),
  spin: Object.freeze({
    full: Object.freeze([0, 2, 4, 6, 6]),
    mini: Object.freeze([0, 0, 1, 1, 1]),
  }),
  backToBack: 1,
  backToBackMinLines: 2,
  backToBackQualifiers: Object.freeze(['quad', 'spin-full', 'spin-mini']),
  combo: Object.freeze([0, 0, 1, 1, 1, 2, 2, 3, 3, 4, 4, 4, 5]),
  perfectClear: 10,
  chargeTicks: 60,
  maxRowsPerLock: 8,
  queuePressureThreshold: 20,
});

const CLEAR_TYPES = Object.freeze(['none', 'single', 'double', 'triple', 'quad', 'spin-full', 'spin-mini']);

export function computeAttack({ lines, clearType, comboCountBefore, backToBackActive, perfectClear } = {}) {
  if (!Number.isInteger(lines) || lines < 0 || lines > 4) throw new RangeError('lines out of range');
  if (!CLEAR_TYPES.includes(clearType)) throw new TypeError('clearType out of range');
  if (!Number.isInteger(comboCountBefore) || comboCountBefore < -1) throw new RangeError('comboCountBefore out of range');
  if (typeof backToBackActive !== 'boolean' || typeof perfectClear !== 'boolean') throw new TypeError('attack flags must be booleans');

  const nextComboCount = lines > 0 ? comboCountBefore + 1 : -1;
  let rows = 0;
  if (lines > 0) {
    if (perfectClear) rows = STACKED_ATTACK_TABLE.perfectClear;
    else if (clearType === 'spin-full') rows = Math.max(STACKED_ATTACK_TABLE.spin.full[lines], STACKED_ATTACK_TABLE.base[lines]);
    else if (clearType === 'spin-mini') rows = Math.max(STACKED_ATTACK_TABLE.spin.mini[lines], STACKED_ATTACK_TABLE.base[lines]);
    else rows = STACKED_ATTACK_TABLE.base[lines];
    if (backToBackActive
      && STACKED_ATTACK_TABLE.backToBackQualifiers.includes(clearType)
      && lines >= STACKED_ATTACK_TABLE.backToBackMinLines) rows += STACKED_ATTACK_TABLE.backToBack;
    rows += STACKED_ATTACK_TABLE.combo[Math.min(nextComboCount, STACKED_ATTACK_TABLE.combo.length - 1)];
  }
  const nextBackToBack = lines === 0 ? backToBackActive : STACKED_ATTACK_TABLE.backToBackQualifiers.includes(clearType);
  return Object.freeze({ rows, nextBackToBack, nextComboCount });
}

const validateQueueEntry = (entry) => {
  if (!entry || !Number.isInteger(entry.rows) || entry.rows < 1 || !Number.isInteger(entry.chargeReadyTick) || entry.chargeReadyTick < 0) {
    throw new TypeError('invalid garbage queue entry');
  }
  if (!Array.isArray(entry.holeColumns) || entry.holeColumns.length !== entry.rows
    || entry.holeColumns.some((column) => !Number.isInteger(column) || column < 0 || column > 9)) {
    throw new TypeError('invalid garbage holeColumns');
  }
};

export function resolveGarbageExchange({ outgoingRows, queue, tick, chargeTicks } = {}) {
  if (!Number.isInteger(outgoingRows) || outgoingRows < 0) throw new RangeError('outgoingRows out of range');
  if (!Array.isArray(queue)) throw new TypeError('queue must be an array');
  for (const entry of queue) validateQueueEntry(entry);
  if (!Number.isInteger(tick) || tick < 0 || !Number.isInteger(chargeTicks) || chargeTicks < 0) throw new RangeError('tick values out of range');

  let remaining = outgoingRows;
  let cancelledRows = 0;
  const nextQueue = [];
  for (const entry of queue) {
    if (remaining === 0) { nextQueue.push(entry); continue; }
    const cancelled = Math.min(remaining, entry.rows);
    remaining -= cancelled;
    cancelledRows += cancelled;
    if (cancelled < entry.rows) {
      nextQueue.push(Object.freeze({
        rows: entry.rows - cancelled,
        chargeReadyTick: entry.chargeReadyTick,
        holeColumns: Object.freeze(entry.holeColumns.slice(cancelled)),
      }));
    }
  }
  Object.freeze(nextQueue);
  const sent = remaining === 0 ? null : Object.freeze({ rows: remaining, chargeReadyTick: tick + 1 + chargeTicks });
  return Object.freeze({ cancelledRows, queue: nextQueue, sent });
}
