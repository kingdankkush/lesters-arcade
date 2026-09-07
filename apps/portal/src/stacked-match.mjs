import {
  createStackedMatchRuntime, createStackedRuntime, fnv1a32Bytes, garbageHoleColumn, normalizeSeed,
  stackedRuntimeStateBytes,
} from './stacked-sim.mjs';
import { BOARD_ROWS, STACKED_MAX_LINES, STACKED_MAX_TICKS } from './stacked-contracts.mjs';
import { createSeededSubstreams } from './seeded-rng.mjs';

const appendU32Le = (bytes, value) => {
  const word = BigInt.asUintN(32, BigInt(value));
  for (let index = 0n; index < 4n; index += 1n) bytes.push(Number((word >> (index * 8n)) & 255n));
};

const appendByteSequence = (bytes, values) => {
  appendU32Le(bytes, values.length);
  for (const value of values) bytes.push(value);
};

const appendU32Sequence = (bytes, values) => {
  appendU32Le(bytes, values.length);
  for (const value of values) appendU32Le(bytes, value);
};

const appendUtf8 = (bytes, value) => appendByteSequence(bytes, new TextEncoder().encode(value));

const appendAttackTable = (bytes, table) => {
  bytes.push(table === null ? 0 : 1);
  if (table === null) return;
  appendUtf8(bytes, table.version);
  appendU32Sequence(bytes, table.base);
  appendU32Sequence(bytes, table.spin.full);
  appendU32Sequence(bytes, table.spin.mini);
  appendU32Le(bytes, table.backToBack);
  appendU32Le(bytes, table.backToBackMinLines);
  appendU32Le(bytes, table.backToBackQualifiers.length);
  for (const qualifier of table.backToBackQualifiers) {
    bytes.push({ quad: 1, 'spin-full': 2, 'spin-mini': 3 }[qualifier]);
  }
  appendU32Sequence(bytes, table.combo);
  appendU32Le(bytes, table.perfectClear);
  appendU32Le(bytes, table.chargeTicks);
  appendU32Le(bytes, table.maxRowsPerLock);
  appendU32Le(bytes, table.queuePressureThreshold);
};

const runtimeArgs = (seed, playerConfig) => {
  if (!playerConfig || typeof playerConfig !== 'object' || Array.isArray(playerConfig)) throw new TypeError('playerConfigs entries must be objects');
  const { maxTicks = STACKED_MAX_TICKS, ...config } = playerConfig;
  return { seed, maxTicks, config };
};

const clearTypeFor = ({ lines, spinKind }) => {
  if (spinKind === 'full') return 'spin-full';
  if (spinKind === 'mini') return 'spin-mini';
  return ['none', 'single', 'double', 'triple', 'quad'][lines];
};

const computeInjectedAttack = (table, event) => {
  const { lines, perfectClear, comboCountBefore, backToBackActive } = event;
  const clearType = clearTypeFor(event);
  const nextComboCount = lines > 0 ? comboCountBefore + 1 : -1;
  let rows = 0;
  if (lines > 0) {
    if (perfectClear) rows = table.perfectClear;
    else if (clearType === 'spin-full') rows = Math.max(table.spin.full[lines], table.base[lines]);
    else if (clearType === 'spin-mini') rows = Math.max(table.spin.mini[lines], table.base[lines]);
    else rows = table.base[lines];
    if (backToBackActive && table.backToBackQualifiers.includes(clearType) && lines >= table.backToBackMinLines) rows += table.backToBack;
    rows += table.combo[Math.min(nextComboCount, table.combo.length - 1)];
  }
  return rows;
};

const integerArray = (value, name, length, max = STACKED_MAX_LINES) => {
  const copied = Array.isArray(value) ? Array.from(value) : null;
  if (copied === null || copied.length !== length
    || copied.some((entry) => !Number.isSafeInteger(entry) || entry < 0 || entry > max)) {
    throw new TypeError(`attackTable.${name} must be ${length} bounded non-negative safe integers`);
  }
  return Object.freeze(copied);
};

const normalizeAttackTable = (table) => {
  if (table === null) return null;
  if (!table || typeof table !== 'object' || Array.isArray(table)) throw new TypeError('attackTable must be null or an object');
  const version = table.version ?? '';
  if (typeof version !== 'string' || version.length > 128) throw new TypeError('attackTable.version must be a string of at most 128 characters');
  const integer = (name, min = 0, max = STACKED_MAX_LINES) => {
    const value = table[name];
    if (!Number.isSafeInteger(value) || value < min || value > max) {
      throw new TypeError(`attackTable.${name} must be a bounded safe integer`);
    }
    return value;
  };
  if (!table.spin || typeof table.spin !== 'object' || Array.isArray(table.spin)) throw new TypeError('attackTable.spin must be an object');
  const qualifiers = Array.isArray(table.backToBackQualifiers) ? Array.from(table.backToBackQualifiers) : null;
  if (qualifiers === null
    || qualifiers.some((value) => !['quad', 'spin-full', 'spin-mini'].includes(value))) {
    throw new TypeError('attackTable.backToBackQualifiers is invalid');
  }
  const normalized = Object.freeze({
    version,
    base: integerArray(table.base, 'base', 5),
    spin: Object.freeze({ full: integerArray(table.spin.full, 'spin.full', 5), mini: integerArray(table.spin.mini, 'spin.mini', 5) }),
    backToBack: integer('backToBack'),
    backToBackMinLines: integer('backToBackMinLines'),
    backToBackQualifiers: Object.freeze(qualifiers),
    combo: integerArray(table.combo, 'combo', 13),
    perfectClear: integer('perfectClear'),
    chargeTicks: integer('chargeTicks', 0, STACKED_MAX_TICKS),
    maxRowsPerLock: integer('maxRowsPerLock', 1, BOARD_ROWS),
    queuePressureThreshold: integer('queuePressureThreshold'),
  });
  const maximumCombinedAttack = Math.max(
    ...normalized.base,
    ...normalized.spin.full,
    ...normalized.spin.mini,
  ) + normalized.backToBack + Math.max(...normalized.combo) + normalized.perfectClear;
  if (maximumCombinedAttack > STACKED_MAX_LINES) throw new RangeError('attackTable combined send out of range');
  return normalized;
};

const cancelQueuedRows = (queue, rows) => {
  let remaining = rows;
  while (remaining > 0 && queue.length > 0) {
    const entry = queue[0];
    const cancelled = Math.min(remaining, entry.rows);
    remaining -= cancelled;
    if (cancelled === entry.rows) queue.shift();
    else {
      queue[0] = Object.freeze({
        rows: entry.rows - cancelled,
        chargeReadyTick: entry.chargeReadyTick,
        holeColumns: Object.freeze(entry.holeColumns.slice(cancelled)),
      });
    }
  }
  return remaining;
};

export function createStackedMatch({ seed, playerConfigs, attackTable = null } = {}) {
  const safeSeed = normalizeSeed(seed);
  if (!Array.isArray(playerConfigs) || playerConfigs.length < 1 || playerConfigs.length > 2) {
    throw new RangeError('playerConfigs must contain one or two boards');
  }
  const table = normalizeAttackTable(attackTable);
  const pendingAttacks = playerConfigs.map(() => []);
  let generatedSends = [];
  const drainChargedRows = (player, event) => {
    const queue = pendingAttacks[player];
    const queuedRows = queue.reduce((total, entry) => total + entry.rows, 0);
    if (event.lines > 0 && queuedRows <= table.queuePressureThreshold) return [];
    const holes = [];
    for (const entry of queue) {
      if (holes.length >= table.maxRowsPerLock || entry.chargeReadyTick > event.tick) break;
      const count = Math.min(entry.rows, table.maxRowsPerLock - holes.length);
      holes.push(...entry.holeColumns.slice(0, count));
    }
    return holes;
  };
  const boards = playerConfigs.map((playerConfig, player) => table === null
    ? createStackedRuntime(runtimeArgs(safeSeed, playerConfig))
    : createStackedMatchRuntime(
      runtimeArgs(safeSeed, playerConfig),
      (event) => {
        const remaining = cancelQueuedRows(pendingAttacks[player], computeInjectedAttack(table, event));
        if (remaining > 0) generatedSends.push(Object.freeze({ player, rows: remaining, tick: event.tick }));
        return drainChargedRows(player, event);
      },
      (rowsApplied) => {
        const unmatched = cancelQueuedRows(pendingAttacks[player], rowsApplied);
        if (unmatched !== 0) throw new Error('applied match garbage exceeded queued rows');
      },
    ));
  const inputRings = boards.map(() => new Uint8Array(256));
  const inputRingTicks = boards.map(() => {
    const ticks = new Int32Array(256);
    ticks.fill(-1);
    return ticks;
  });
  const garbageRng = createSeededSubstreams(safeSeed, ['garbage']).garbage;
  let lastGarbageHole = -1;
  let tick = 0;

  const snapshot = () => Object.freeze({
    tick,
    boards: Object.freeze(boards.map((board) => board.snapshot())),
    pendingAttacks: Object.freeze(pendingAttacks.map((queue) => Object.freeze(queue.map((entry) => Object.freeze({ ...entry }))))),
    garbageRngCount: garbageRng.count,
  });
  const stateHash = () => {
    if (boards.length === 1 && table === null && pendingAttacks[0].length === 0) return boards[0].stateHash();
    const bytes = [0x53, 0x4d, 0x48, 0x02];
    appendU32Le(bytes, tick);
    appendAttackTable(bytes, table);
    appendU32Le(bytes, boards.length);
    for (let player = 0; player < boards.length; player += 1) {
      appendByteSequence(bytes, stackedRuntimeStateBytes(boards[player]));
      appendU32Le(bytes, pendingAttacks[player].length);
      for (const entry of pendingAttacks[player]) {
        appendU32Le(bytes, entry.rows);
        appendU32Le(bytes, entry.chargeReadyTick);
        appendByteSequence(bytes, entry.holeColumns);
      }
    }
    appendU32Le(bytes, garbageRng.count);
    appendU32Le(bytes, lastGarbageHole);
    return fnv1a32Bytes(bytes);
  };
  const result = () => {
    if (boards.length === 1) return boards[0].result();
    if (!boards.some((board) => board.terminal)) return null;
    return Object.freeze(boards.map((board) => board.result()));
  };
  const stepAll = (inputBitsByPlayer) => {
    if (boards.some((board) => board.terminal)) throw new Error('cannot step terminal STACKED match');
    if (!(inputBitsByPlayer instanceof Uint8Array) || inputBitsByPlayer.length !== boards.length) {
      throw new TypeError('inputBitsByPlayer must be a Uint8Array matching playerConfigs');
    }
    const slot = tick & 255;
    generatedSends = [];
    for (let player = 0; player < boards.length; player += 1) {
      if (inputRingTicks[player][slot] !== -1) throw new Error('STACKED input ring slot is still occupied');
      inputRings[player][slot] = inputBitsByPlayer[player];
      inputRingTicks[player][slot] = tick;
    }
    for (let player = 0; player < boards.length; player += 1) {
      if (inputRingTicks[player][slot] !== tick) throw new Error('STACKED input ring tick mismatch');
      boards[player].step(inputRings[player][slot]);
      inputRingTicks[player][slot] = -1;
    }
    tick += 1;
    if (table !== null) {
      if (boards.length === 2) for (const send of generatedSends) {
        lastGarbageHole = garbageHoleColumn(garbageRng, lastGarbageHole);
        const target = 1 - send.player;
        pendingAttacks[target].push(Object.freeze({
          rows: send.rows,
          chargeReadyTick: send.tick + 1 + table.chargeTicks,
          holeColumns: Object.freeze(Array(send.rows).fill(lastGarbageHole)),
        }));
      }
    }
    return snapshot();
  };

  return Object.freeze({ stepAll, snapshot, stateHash, result, get terminal() { return boards.some((board) => board.terminal); } });
}
