import { SeededRng, createSeededSubstreams } from './seeded-rng.mjs';
import {
  BOARD_WIDTH, BOARD_ROWS, BOARD_VISIBLE_ROWS, STACKED_MAX_TICKS,
  STACKED_GRAVITY_Q16, GRAVITY_LEVEL_CAP, LOCK_LEVEL_CAP,
  LOCK_DELAY_TICKS, LOCK_RESET_CAP, SOFT_DROP_FACTOR,
  STACKED_LEVEL_CAP, STACKED_COMBO_BONUS_CAP, STACKED_MAX_EVIDENCE_BYTES,
  STACKED_MAX_PIECES, STACKED_MAX_LINES, STACKED_MAX_QUAD_CLEARS, STACKED_MAX_SCORE,
  STACKED_MAX_INPUT_TRANSITIONS,
  STACKED_CLEAR_SCORES, STACKED_MINI_SPIN_SCORES, STACKED_FULL_SPIN_SCORES,
  PERFECT_CLEAR_BONUS, GARBAGE_START_TICK, GARBAGE_INTERVAL_START_TICKS,
  GARBAGE_INTERVAL_STEP_TICKS, GARBAGE_INTERVAL_STEP_PERIOD_TICKS,
  GARBAGE_INTERVAL_FLOOR_TICKS, GARBAGE_PENDING_MAX,
  GARBAGE_HOLE_REPEAT_NUM, GARBAGE_HOLE_REPEAT_DEN,
  HASHPOWER_PER_CLEAR, HASHPOWER_MAX, REORG_COST_PERIOD_TICKS, REORG_COST_MAX,
  STACKED_ZONE_IDS, STACKED_RESULT_TUPLE_TAG, STACKED_GAME_ID, STACKED_SEASON_ID,
  STACKED_TERMINAL_REASONS,
} from './stacked-contracts.mjs';

const freeze = (value) => {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};
const cell = (pairs) => freeze(pairs.map((pair) => freeze(pair)));
export const PIECE_CELLS = freeze({
  I: [cell([[0,2],[1,2],[2,2],[3,2]]),cell([[2,3],[2,2],[2,1],[2,0]]),cell([[0,1],[1,1],[2,1],[3,1]]),cell([[1,3],[1,2],[1,1],[1,0]])],
  O: [cell([[1,2],[2,2],[1,1],[2,1]]),cell([[1,2],[2,2],[1,1],[2,1]]),cell([[1,2],[2,2],[1,1],[2,1]]),cell([[1,2],[2,2],[1,1],[2,1]])],
  J: [cell([[0,2],[0,1],[1,1],[2,1]]),cell([[1,2],[2,2],[1,1],[1,0]]),cell([[0,1],[1,1],[2,1],[2,0]]),cell([[1,2],[1,1],[0,0],[1,0]])],
  L: [cell([[2,2],[0,1],[1,1],[2,1]]),cell([[1,2],[1,1],[1,0],[2,0]]),cell([[0,1],[1,1],[2,1],[0,0]]),cell([[0,2],[1,2],[1,1],[1,0]])],
  S: [cell([[1,2],[2,2],[0,1],[1,1]]),cell([[1,2],[1,1],[2,1],[2,0]]),cell([[1,1],[2,1],[0,0],[1,0]]),cell([[0,2],[0,1],[1,1],[1,0]])],
  T: [cell([[1,2],[0,1],[1,1],[2,1]]),cell([[1,2],[1,1],[2,1],[1,0]]),cell([[0,1],[1,1],[2,1],[1,0]]),cell([[1,2],[0,1],[1,1],[1,0]])],
  Z: [cell([[0,2],[1,2],[1,1],[2,1]]),cell([[2,2],[1,1],[2,1],[1,0]]),cell([[0,1],[1,1],[1,0],[2,0]]),cell([[1,2],[0,1],[1,1],[0,0]])],
});
export const SPAWN_ORIGIN = freeze({ I:{x:3,y:18}, O:{x:3,y:19}, J:{x:3,y:19}, L:{x:3,y:19}, S:{x:3,y:19}, T:{x:3,y:19}, Z:{x:3,y:19} });
export const STACKED_KICKS_JLSTZ = freeze({
  '0>1':[[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]], '1>0':[[0,0],[1,0],[1,-1],[0,2],[1,2]],
  '1>2':[[0,0],[1,0],[1,-1],[0,2],[1,2]], '2>1':[[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
  '2>3':[[0,0],[1,0],[1,1],[0,-2],[1,-2]], '3>2':[[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
  '3>0':[[0,0],[-1,0],[-1,-1],[0,2],[-1,2]], '0>3':[[0,0],[1,0],[1,1],[0,-2],[1,-2]],
});
export const STACKED_KICKS_I = freeze({
  '0>1':[[0,0],[-2,0],[1,0],[-2,-1],[1,2]], '1>0':[[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
  '1>2':[[0,0],[-1,0],[2,0],[-1,2],[2,-1]], '2>1':[[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
  '2>3':[[0,0],[2,0],[-1,0],[2,1],[-1,-2]], '3>2':[[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
  '3>0':[[0,0],[1,0],[-2,0],[1,-2],[-2,1]], '0>3':[[0,0],[-1,0],[2,0],[-1,2],[2,-1]],
});
export const STACKED_KICKS_180 = freeze({
  '0>2':[[0,0],[0,1],[1,1],[-1,1],[1,0],[-1,0]], '2>0':[[0,0],[0,-1],[-1,-1],[1,-1],[-1,0],[1,0]],
  '1>3':[[0,0],[1,0],[1,2],[1,1],[0,2],[0,1]], '3>1':[[0,0],[-1,0],[-1,2],[-1,1],[0,2],[0,1]],
});

export const normalizeSeed = (seed) => {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError('seed must be uint32');
  return (seed >>> 0) || 1;
};
export const cellsFor = (kind, rotation, x, y) => PIECE_CELLS[kind][rotation].map(([bx, by]) => [x + bx, y + by]);
export const collides = (board, cells) => cells.some(([x, y]) => x < 0 || x >= BOARD_WIDTH || y < 0 || y >= BOARD_ROWS || board[y * BOARD_WIDTH + x] !== 0);

function shuffledBag(rng) {
  const bag = ['I','J','L','O','S','T','Z'];
  for (let i = 6; i > 0; i -= 1) { const j = rng.nextBelow(i + 1); const held = bag[i]; bag[i] = bag[j]; bag[j] = held; }
  return bag;
}
export function drawStackedPieces(seed, count) {
  if (!Number.isInteger(count) || count < 0) throw new RangeError('count must be a non-negative integer');
  const rng = createSeededSubstreams(normalizeSeed(seed), ['bag']).bag;
  const pieces=[]; let bagRefills=0;
  const refill=()=>{ pieces.push(...shuffledBag(rng)); bagRefills += 1; };
  refill(); refill();
  const output=[];
  for (let i=0;i<count;i+=1) { output.push(pieces.shift()); if ((i + 1) % 7 === 0) refill(); }
  return freeze({ pieces: output, bagRefills, bagDraws: rng.count });
}

export function attemptRotation(board, active, targetRotation) {
  if (active.kind === 'O') return freeze({ ...active, lastKickIndex: 0 });
  const delta = (targetRotation - active.rotation + 4) & 3;
  const table = delta === 2 ? STACKED_KICKS_180 : active.kind === 'I' ? STACKED_KICKS_I : STACKED_KICKS_JLSTZ;
  const kicks = table[`${active.rotation}>${targetRotation}`];
  for (let index=0; index<kicks.length; index+=1) {
    const [dx,dy]=kicks[index];
    if (!collides(board, cellsFor(active.kind,targetRotation,active.x+dx,active.y+dy))) return freeze({ ...active, x:active.x+dx, y:active.y+dy, rotation:targetRotation, lastKickIndex:index });
  }
  return null;
}
export function detectSpin(board, active) {
  if (active.kind === 'O' || !active.lastActionWasRotation) return 'none';
  if (active.kind === 'T') {
    const corners=[[0,0],[2,0],[0,2],[2,2]].map(([dx,dy])=>[active.x+dx,active.y+dy]);
    const occupied=corners.map(([x,y])=>x<0||x>=BOARD_WIDTH||y<0||y>=BOARD_ROWS||board[y*BOARD_WIDTH+x]!==0);
    if (occupied.filter(Boolean).length < 3) return 'none';
    const front = active.rotation===0?[2,3]:active.rotation===1?[1,3]:active.rotation===2?[0,1]:[0,2];
    return front.filter((i)=>occupied[i]).length>=2 || active.lastKickIndex===4 ? 'full' : 'mini';
  }
  for (const [dx,dy] of [[0,-1],[-1,0],[1,0],[0,1]]) if (!collides(board,cellsFor(active.kind,active.rotation,active.x+dx,active.y+dy))) return 'none';
  return 'mini';
}

export function levelForLines(startLevel, lines) {
  if (!Number.isInteger(startLevel) || startLevel < 1 || startLevel > 15) throw new RangeError('startLevel out of range');
  if (!Number.isInteger(lines) || lines < 0) throw new RangeError('lines must be a non-negative integer');
  return Math.min(STACKED_LEVEL_CAP, startLevel + Math.floor(lines / 10));
}

export function garbageIntervalTicks(tick) {
  if (!Number.isInteger(tick) || tick < 0) throw new RangeError('tick must be a non-negative integer');
  if (tick < GARBAGE_START_TICK) return Number.POSITIVE_INFINITY;
  const steps = Math.floor((tick - GARBAGE_START_TICK) / GARBAGE_INTERVAL_STEP_PERIOD_TICKS);
  return Math.max(GARBAGE_INTERVAL_FLOOR_TICKS, GARBAGE_INTERVAL_START_TICKS - GARBAGE_INTERVAL_STEP_TICKS * steps);
}

export function reorgCost(tick) {
  if (!Number.isInteger(tick) || tick < 0) throw new RangeError('tick must be a non-negative integer');
  return Math.min(REORG_COST_MAX, 1 + Math.floor(tick / REORG_COST_PERIOD_TICKS));
}

export function canRejectReorg(hashpower, tick) {
  if (!Number.isInteger(hashpower) || hashpower < 0 || hashpower > HASHPOWER_MAX) throw new RangeError('hashpower out of range');
  return hashpower >= reorgCost(tick);
}

const ZONE_START_TICKS = freeze([0, 10_800, 25_200, 43_200, 64_800, 90_000]);
export function zoneForTick(tick) {
  if (!Number.isInteger(tick) || tick < 0) throw new RangeError('tick must be a non-negative integer');
  for (let index = ZONE_START_TICKS.length - 1; index >= 0; index -= 1) if (tick >= ZONE_START_TICKS[index]) return index;
  return 0;
}

export function garbageHoleColumn(rng, previousColumn, columns = BOARD_WIDTH) {
  if (!rng || typeof rng.nextBelow !== 'function') throw new TypeError('rng.nextBelow is required');
  if (!Number.isInteger(previousColumn) || previousColumn < -1 || previousColumn >= columns) throw new RangeError('previousColumn out of range');
  if (!Number.isInteger(columns) || columns < 2) throw new RangeError('columns out of range');
  if (previousColumn < 0) return rng.nextBelow(columns);
  if (rng.nextBelow(GARBAGE_HOLE_REPEAT_DEN) < GARBAGE_HOLE_REPEAT_NUM) return previousColumn;
  const offset = rng.nextBelow(columns - 1);
  return (previousColumn + 1 + offset) % columns;
}

const validateBoard = (board) => {
  if (!(board instanceof Uint8Array) || board.length !== BOARD_WIDTH * BOARD_ROWS) throw new TypeError('board must be a 10x24 Uint8Array');
  for (const value of board) if (value > 8) throw new RangeError('board cell out of range');
};

export function compactCompletedRows(board) {
  validateBoard(board);
  const fullRows = [];
  let garbageRowsCleared = 0;
  for (let y = 0; y < BOARD_ROWS; y += 1) {
    let full = true;
    let hasGarbage = false;
    for (let x = 0; x < BOARD_WIDTH; x += 1) {
      const value = board[y * BOARD_WIDTH + x];
      if (value === 0) full = false;
      if (value === 8) hasGarbage = true;
    }
    if (full) {
      fullRows.push(y);
      if (hasGarbage) garbageRowsCleared += 1;
    }
  }
  const fullSet = new Set(fullRows);
  const compacted = new Uint8Array(board.length);
  let targetY = 0;
  for (let sourceY = 0; sourceY < BOARD_ROWS; sourceY += 1) {
    if (fullSet.has(sourceY)) continue;
    compacted.set(board.subarray(sourceY * BOARD_WIDTH, (sourceY + 1) * BOARD_WIDTH), targetY * BOARD_WIDTH);
    targetY += 1;
  }
  return Object.freeze({ board: compacted, lines: fullRows.length, fullRows: Object.freeze(fullRows), garbageRowsCleared });
}

export function applyGarbageRows(board, holeColumns) {
  validateBoard(board);
  if (!Array.isArray(holeColumns) || holeColumns.some((hole) => !Number.isInteger(hole) || hole < 0 || hole >= BOARD_WIDTH)) {
    throw new TypeError('holeColumns must contain board columns');
  }
  const next = board.slice();
  let rowsApplied = 0;
  for (const hole of holeColumns) {
    let overflow = false;
    for (let x = 0; x < BOARD_WIDTH; x += 1) if (next[(BOARD_ROWS - 1) * BOARD_WIDTH + x] !== 0) overflow = true;
    if (overflow) return Object.freeze({ board: next, rowsApplied, terminalReason: 'garbage-out' });
    next.copyWithin(BOARD_WIDTH, 0, (BOARD_ROWS - 1) * BOARD_WIDTH);
    for (let x = 0; x < BOARD_WIDTH; x += 1) next[x] = x === hole ? 0 : 8;
    rowsApplied += 1;
  }
  return Object.freeze({ board: next, rowsApplied, terminalReason: null });
}

export function evidenceCeilingReached(encodedBytes) {
  if (!Number.isInteger(encodedBytes) || encodedBytes < 0) throw new RangeError('encodedBytes must be a non-negative integer');
  return encodedBytes >= STACKED_MAX_EVIDENCE_BYTES;
}

export function resolveScoringBlock({
  score = 0, lines, spinKind = 'none', chainActive = false, comboCount = -1, level,
  perfectClear = false,
} = {}) {
  if (!Number.isInteger(score) || score < 0) throw new RangeError('score must be a non-negative integer');
  if (!Number.isInteger(lines) || lines < 0 || lines > 4) throw new RangeError('lines out of range');
  if (!['none', 'mini', 'full'].includes(spinKind)) throw new TypeError('spinKind out of range');
  if (typeof chainActive !== 'boolean' || typeof perfectClear !== 'boolean') throw new TypeError('scoring flags must be booleans');
  if (!Number.isInteger(comboCount) || comboCount < -1) throw new RangeError('comboCount out of range');
  if (!Number.isInteger(level) || level < 1 || level > STACKED_LEVEL_CAP) throw new RangeError('level out of range');

  let base = STACKED_CLEAR_SCORES[lines];
  if (lines !== 4 && spinKind === 'full' && STACKED_FULL_SPIN_SCORES[lines] !== undefined) base = STACKED_FULL_SPIN_SCORES[lines];
  if (lines !== 4 && spinKind === 'mini' && STACKED_MINI_SPIN_SCORES[lines] !== undefined) base = STACKED_MINI_SPIN_SCORES[lines];
  let clearScore = base * level;
  const isSpinClear = lines > 0 && spinKind !== 'none';
  if (chainActive && (lines === 4 || isSpinClear)) clearScore = Math.floor(clearScore * 3 / 2);
  const perfectClearScore = perfectClear && lines > 0
    ? (lines === 4 && chainActive ? PERFECT_CLEAR_BONUS.chainedQuad : PERFECT_CLEAR_BONUS[lines]) * level
    : 0;
  const nextComboCount = lines > 0 ? comboCount + 1 : -1;
  const comboScore = lines > 0 ? 50 * Math.min(nextComboCount, STACKED_COMBO_BONUS_CAP) * level : 0;
  const scoreDelta = clearScore + perfectClearScore + comboScore;
  const qualifiesChain = lines === 4 || isSpinClear;
  const nextChainActive = lines === 0 ? chainActive : qualifiesChain;
  const hashpowerMinted = lines > 0
    ? HASHPOWER_PER_CLEAR[lines] + (isSpinClear ? 1 : 0) + (chainActive ? 1 : 0)
    : 0;
  return freeze({
    base, clearScore, perfectClearScore, comboScore, scoreDelta, score: score + scoreDelta,
    nextComboCount, nextChainActive, qualifiesChain, hashpowerMinted,
  });
}

export function packStackedBoard(board) {
  validateBoard(board);
  const packed = new Uint8Array(board.length / 2);
  for (let index = 0; index < board.length; index += 2) packed[index / 2] = (board[index] << 4) | board[index + 1];
  return packed;
}

const SHA256_INITIAL = freeze([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
const SHA256_K = freeze([
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
]);
const rotateRight = (value, bits) => (value >>> bits) | (value << (32 - bits));
const sha256Hex = (input) => {
  const bitLength = input.length * 8;
  const paddedLength = Math.ceil((input.length + 9) / 64) * 64;
  const bytes = new Uint8Array(paddedLength);
  bytes.set(input);
  bytes[input.length] = 0x80;
  bytes[paddedLength - 4] = bitLength >>> 24;
  bytes[paddedLength - 3] = bitLength >>> 16;
  bytes[paddedLength - 2] = bitLength >>> 8;
  bytes[paddedLength - 1] = bitLength;
  const hash = SHA256_INITIAL.slice();
  const words = new Uint32Array(64);
  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      const base = offset + index * 4;
      words[index] = ((bytes[base] << 24) | (bytes[base + 1] << 16) | (bytes[base + 2] << 8) | bytes[base + 3]) >>> 0;
    }
    for (let index = 16; index < 64; index += 1) {
      const a = words[index - 15];
      const b = words[index - 2];
      const s0 = rotateRight(a, 7) ^ rotateRight(a, 18) ^ (a >>> 3);
      const s1 = rotateRight(b, 17) ^ rotateRight(b, 19) ^ (b >>> 10);
      words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
    }
    let [a,b,c,d,e,f,g,h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temp1 = (h + sum1 + choice + SHA256_K[index] + words[index]) >>> 0;
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (sum0 + majority) >>> 0;
      h=g; g=f; f=e; e=(d+temp1)>>>0; d=c; c=b; b=a; a=(temp1+temp2)>>>0;
    }
    hash[0]=(hash[0]+a)>>>0; hash[1]=(hash[1]+b)>>>0; hash[2]=(hash[2]+c)>>>0; hash[3]=(hash[3]+d)>>>0;
    hash[4]=(hash[4]+e)>>>0; hash[5]=(hash[5]+f)>>>0; hash[6]=(hash[6]+g)>>>0; hash[7]=(hash[7]+h)>>>0;
  }
  return hash.map((value) => value.toString(16).padStart(8, '0')).join('');
};

export function boardHash(board) {
  return `0x${sha256Hex(packStackedBoard(board))}`;
}

const requireTupleInteger = (state, field, min, max) => {
  const value = state[field];
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new RangeError(`${field} out of range`);
  return value;
};

const requireTupleString = (state, field, pattern) => {
  const value = state[field];
  if (typeof value !== 'string' || !pattern.test(value)) throw new TypeError(`${field} out of range`);
  return value;
};

const tupleBoard = (source) => {
  if (!(source instanceof Uint8Array) && !Array.isArray(source)) throw new TypeError('board must be a 10x24 byte sequence');
  if (source.length !== BOARD_WIDTH * BOARD_ROWS) throw new TypeError('board must be a 10x24 byte sequence');
  for (const value of source) {
    if (!Number.isInteger(value) || value < 0 || value > 8) throw new RangeError('board cell out of range');
  }
  return source instanceof Uint8Array ? source : Uint8Array.from(source);
};

export function buildStackedResultTuple(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) throw new TypeError('state is required');
  if (!STACKED_TERMINAL_REASONS.includes(state.terminalReason)) throw new TypeError('terminalReason is required');
  const seed = requireTupleInteger(state, 'seed', 0, 0xffffffff);
  const buildHash = requireTupleString(state, 'buildHash', /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/);
  const seasonId = requireTupleString(state, 'seasonId', /^[a-z0-9][a-z0-9-]{1,63}$/);
  const ticks = requireTupleInteger(state, 'tick', 0, STACKED_MAX_TICKS);
  const pieces = requireTupleInteger(state, 'piecesSpawned', 0, STACKED_MAX_PIECES);
  const lines = requireTupleInteger(state, 'lines', 0, STACKED_MAX_LINES);
  if (requireTupleInteger(state, 'linesCleared', 0, STACKED_MAX_LINES) !== lines) throw new RangeError('lines and linesCleared must match');
  const level = requireTupleInteger(state, 'level', 1, STACKED_LEVEL_CAP);
  const startLevel = requireTupleInteger(state, 'startLevel', 1, 15);
  const score = requireTupleInteger(state, 'score', 0, STACKED_MAX_SCORE);
  const quadClears = requireTupleInteger(state, 'quadClears', 0, STACKED_MAX_QUAD_CLEARS);
  const singles = requireTupleInteger(state, 'singles', 0, STACKED_MAX_LINES);
  const doubles = requireTupleInteger(state, 'doubles', 0, STACKED_MAX_LINES);
  const triples = requireTupleInteger(state, 'triples', 0, STACKED_MAX_LINES);
  const spinsMini = requireTupleInteger(state, 'spinsMini', 0, STACKED_MAX_PIECES);
  const spinsFull = requireTupleInteger(state, 'spinsFull', 0, STACKED_MAX_PIECES);
  const perfectClears = requireTupleInteger(state, 'perfectClears', 0, STACKED_MAX_QUAD_CLEARS);
  const maxCombo = requireTupleInteger(state, 'maxCombo', 0, STACKED_MAX_LINES);
  const maxBackToBack = requireTupleInteger(state, 'maxBackToBack', 0, STACKED_MAX_LINES);
  const garbageRowsReceived = requireTupleInteger(state, 'garbageRowsReceived', 0, STACKED_MAX_LINES);
  const garbageGroups = requireTupleInteger(state, 'garbageGroups', 0, STACKED_MAX_LINES);
  const garbageRowsCleared = requireTupleInteger(state, 'garbageRowsCleared', 0, STACKED_MAX_LINES);
  const holdsUsed = requireTupleInteger(state, 'holdsUsed', 0, STACKED_MAX_PIECES * 2);
  const bagRefills = requireTupleInteger(state, 'bagRefills', 0, STACKED_MAX_PIECES);
  const bagDraws = requireTupleInteger(state, 'bagDraws', 0, STACKED_MAX_PIECES * 6);
  const garbageDraws = requireTupleInteger(state, 'garbageRngCount', 0, STACKED_MAX_LINES * 2);
  const transitionCount = requireTupleInteger(state, 'transitionCount', 0, STACKED_MAX_INPUT_TRANSITIONS);
  const board = tupleBoard(state.board);

  const maxTicks = requireTupleInteger(state, 'maxTicks', 1, STACKED_MAX_TICKS);
  if (ticks > maxTicks) throw new RangeError('maxTicks out of range');
  if (state.terminalReason === 'tick-ceiling' && ticks !== maxTicks) throw new RangeError('tick-ceiling tick mismatch');
  if (singles + 2 * doubles + 3 * triples + 4 * quadClears !== lines) throw new RangeError('clear counters do not equal lines');
  if (lines > Math.floor(pieces * 4 / 10) + garbageRowsReceived) throw new RangeError('lines exceed placed material');
  if (level !== levelForLines(startLevel, lines)) throw new RangeError('level does not match lines');
  if (spinsMini + spinsFull > pieces) throw new RangeError('spins exceed pieces');
  if (holdsUsed > pieces) throw new RangeError('holdsUsed exceeds piecesSpawned');
  if (perfectClears > lines) throw new RangeError('perfectClears exceed lines');
  if (garbageRowsCleared > garbageRowsReceived) throw new RangeError('garbageRowsCleared exceeds garbageRowsReceived');
  if (bagRefills !== 2 + Math.floor(pieces / 7)) throw new RangeError('bagRefills identity mismatch');
  if (bagDraws < 6 * bagRefills) throw new RangeError('bagDraws identity mismatch');
  if (garbageDraws < garbageGroups) throw new RangeError('garbageDraws identity mismatch');
  return freeze({
    v: STACKED_RESULT_TUPLE_TAG,
    gameId: STACKED_GAME_ID,
    seed, buildHash, seasonId, ticks, pieces, lines, level, score, quadClears,
    spins: spinsMini + spinsFull,
    perfectClears, maxCombo, maxBackToBack, garbageRowsReceived, garbageGroups,
    garbageRowsCleared, holdsUsed, bagRefills, bagDraws, garbageDraws, transitionCount,
    boardHash: boardHash(board),
    terminalReason: state.terminalReason,
  });
}

const appendU32Le = (bytes, value) => {
  const word = BigInt.asUintN(32, BigInt(value));
  for (let index = 0n; index < 4n; index += 1n) bytes.push(Number((word >> (index * 8n)) & 255n));
};
const appendU64Le = (bytes, value) => {
  const word = BigInt.asUintN(64, BigInt(value));
  for (let index = 0n; index < 8n; index += 1n) bytes.push(Number((word >> (index * 8n)) & 255n));
};
export const fnv1a32Bytes = (bytes) => {
  let hash = 0x811c9dc5;
  for (const byte of bytes) { hash ^= byte; hash = Math.imul(hash, 0x01000193) >>> 0; }
  return hash >>> 0;
};
const runtimeStateBytes = new WeakMap();
export function stackedRuntimeStateBytes(runtime) {
  const encode = runtimeStateBytes.get(runtime);
  if (!encode) throw new TypeError('runtime must be a STACKED runtime');
  return Uint8Array.from(encode());
}
function createStackedRuntimeInternal(
  { seed, maxTicks = STACKED_MAX_TICKS, config = {} } = {},
  lockBoundary = null,
  acknowledgeMatchGarbage = null,
) {
  const safeSeed=normalizeSeed(seed);
  if (!Number.isInteger(maxTicks)||maxTicks<1||maxTicks>STACKED_MAX_TICKS) throw new RangeError('maxTicks out of range');
  const keys=Object.keys(config); if(keys.some((key)=>!['startLevel','buildHash','seasonId'].includes(key))) throw new TypeError('unsupported config key');
  const startLevel=config.startLevel ?? 1; if(!Number.isInteger(startLevel)||startLevel<1||startLevel>15) throw new RangeError('startLevel out of range');
  const buildHash=config.buildHash ?? 'stacked-local'; if(typeof buildHash!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(buildHash)) throw new TypeError('buildHash out of range');
  const seasonId=config.seasonId ?? STACKED_SEASON_ID; if(typeof seasonId!=='string'||!/^[a-z0-9][a-z0-9-]{1,63}$/.test(seasonId)) throw new TypeError('seasonId out of range');
  const streams = createSeededSubstreams(safeSeed, ['bag', 'garbage', 'zone']);
  const bagRng = streams.bag;
  const garbageRng = streams.garbage;
  const board = new Uint8Array(BOARD_WIDTH * BOARD_ROWS);
  const queue = [];
  let level = startLevel;
  const lockLevelIndex = () => Math.min(level, LOCK_LEVEL_CAP) - 1;
  const currentLockDelay = () => LOCK_DELAY_TICKS[lockLevelIndex()];
  const currentLockResetCap = () => LOCK_RESET_CAP[lockLevelIndex()];
  let bagRefills = 0;
  let piecesSpawned = 0;
  let piecesLocked = 0;
  let hold = null;
  let holdUsed = false;
  let holdsUsed = 0;
  let tick = 0;
  let prevMask = 0;
  let lastHorizontal = 1;
  let terminalReason = null;
  let softDropCells = 0;
  let hardDropCells = 0;
  let lines = 0;
  let score = 0;
  let comboCount = -1;
  let maxCombo = 0;
  let chainActive = false;
  let backToBackCount = 0;
  let maxBackToBack = 0;
  let hashpower = 0;
  let garbageTimerTicks = -1;
  const garbagePending = [];
  let garbageGroups = 0;
  let garbageRowsReceived = 0;
  let garbageRowsCleared = 0;
  let reorgsRejected = 0;
  let lastGarbageHole = -1;
  let quadClears = 0;
  let singles = 0;
  let doubles = 0;
  let triples = 0;
  let spinsMini = 0;
  let spinsFull = 0;
  let perfectClears = 0;
  let maxStackHeight = 0;
  let transitionCount = 0;
  let encodedEvidenceBytes = 24;
  let lastTransitionTick = 0;
  let terminalResult = null;
  const refill = () => {
    queue.push(...shuffledBag(bagRng));
    bagRefills += 1;
  };
  refill();
  refill();
  let active;
  let activeSpawnTick = 0;
  const activate = (kind) => {
    const origin = SPAWN_ORIGIN[kind];
    active = {
      kind, rotation: 0, x: origin.x, y: origin.y,
      lastKickIndex: 0, lastActionWasRotation: false,
      lockTimer: currentLockDelay(), lockResetsUsed: 0, lowestYReached: origin.y,
    };
    activeSpawnTick = tick;
    if (collides(board, cellsFor(kind, 0, active.x, active.y))) {
      terminalReason = 'block-out';
      return;
    }
    if (!collides(board, cellsFor(kind, 0, active.x, active.y - 1))) active.y -= 1;
    active.lowestYReached = active.y;
  };
  const spawnFromQueue = () => {
    const kind = queue.shift();
    piecesSpawned += 1;
    if (piecesSpawned % 7 === 0) refill();
    activate(kind);
  };
  spawnFromQueue();
  const canMove = (dx, dy) => !collides(board, cellsFor(active.kind, active.rotation, active.x + dx, active.y + dy));
  const establishNewLowestY = () => {
    if (active.y >= active.lowestYReached) return false;
    active.lowestYReached = active.y;
    active.lockResetsUsed = 0;
    active.lockTimer = currentLockDelay();
    return true;
  };
  const resetForAction = () => {
    if (active.lockResetsUsed >= currentLockResetCap()) return;
    active.lockTimer = currentLockDelay();
    active.lockResetsUsed += 1;
  };
  const move = (dx, dy, rotationFlag = false) => {
    if (!canMove(dx, dy)) return false;
    active.x += dx;
    active.y += dy;
    active.lastActionWasRotation = rotationFlag;
    if (!establishNewLowestY()) resetForAction();
    return true;
  };
  const updateMaxStackHeight = () => {
    let height = 0;
    for (let y = BOARD_ROWS - 1; y >= 0; y -= 1) {
      let occupied = false;
      for (let x = 0; x < BOARD_WIDTH; x += 1) if (board[y * BOARD_WIDTH + x] !== 0) occupied = true;
      if (occupied) { height = y + 1; break; }
    }
    maxStackHeight = Math.max(maxStackHeight, height);
  };
  const drainPendingGarbage = (scoringLevel) => {
    while (garbagePending.length > 0 && terminalReason === null) {
      const hole = garbagePending.shift();
      const cost = reorgCost(tick);
      if (canRejectReorg(hashpower, tick)) {
        hashpower -= cost;
        reorgsRejected += 1;
        score += 250 * scoringLevel;
        continue;
      }
      const applied = applyGarbageRows(board, [hole]);
      if (applied.terminalReason) {
        terminalReason = applied.terminalReason;
        break;
      }
      board.set(applied.board);
      garbageRowsReceived += applied.rowsApplied;
    }
  };
  const lock = () => {
    const cells = cellsFor(active.kind, active.rotation, active.x, active.y);
    const above = cells.every(([, y]) => y >= BOARD_VISIBLE_ROWS);
    const spinKind = detectSpin(board, active);
    for (const [x, y] of cells) board[y * BOARD_WIDTH + x] = 'IJLOSTZ'.indexOf(active.kind) + 1;
    piecesLocked += 1;
    holdUsed = false;
    if (spinKind === 'mini') spinsMini += 1;
    if (spinKind === 'full') spinsFull += 1;
    if (above) {
      updateMaxStackHeight();
      terminalReason = 'lock-out';
      return;
    }
    const compacted = compactCompletedRows(board);
    board.set(compacted.board);
    const cleared = compacted.lines;
    const perfectClear = cleared > 0 && board.every((value) => value === 0);
    const preClearLevel = level;
    const lockEvent = {
      tick, lines: cleared, spinKind, perfectClear,
      comboCountBefore: comboCount, backToBackActive: chainActive,
    };
    const scored = resolveScoringBlock({ score, lines: cleared, spinKind, chainActive, comboCount, level, perfectClear });
    score = scored.score;
    comboCount = scored.nextComboCount;
    maxCombo = Math.max(maxCombo, comboCount);
    if (cleared > 0) {
      hashpower = Math.min(HASHPOWER_MAX, hashpower + scored.hashpowerMinted);
      if (cleared === 1) singles += 1;
      if (cleared === 2) doubles += 1;
      if (cleared === 3) triples += 1;
      if (cleared === 4) quadClears += 1;
      if (perfectClear) perfectClears += 1;
      if (scored.qualifiesChain) {
        backToBackCount = chainActive ? backToBackCount + 1 : 1;
        maxBackToBack = Math.max(maxBackToBack, backToBackCount);
      } else backToBackCount = 0;
    }
    chainActive = scored.nextChainActive;
    garbageRowsCleared += compacted.garbageRowsCleared;
    lines += cleared;
    level = levelForLines(startLevel, lines);
    drainPendingGarbage(preClearLevel);
    let matchGarbageRose = false;
    if (!terminalReason && lockBoundary !== null) {
      const holes = lockBoundary(freeze(lockEvent));
      if (!Array.isArray(holes) || holes.some((hole) => !Number.isInteger(hole) || hole < 0 || hole >= BOARD_WIDTH)) {
        throw new TypeError('match lock boundary must return board-column holes');
      }
      if (holes.length > 0) {
        const applied = applyGarbageRows(board, holes);
        board.set(applied.board);
        garbageRowsReceived += applied.rowsApplied;
        acknowledgeMatchGarbage(applied.rowsApplied);
        matchGarbageRose = applied.rowsApplied > 0;
        if (applied.terminalReason) terminalReason = applied.terminalReason;
      }
    }
    updateMaxStackHeight();
    if (terminalReason) return;
    spawnFromQueue();
    if (matchGarbageRose && terminalReason === 'block-out') terminalReason = 'garbage-out';
  };
  let gravityAccQ16=0;
  const snapshot=()=>freeze({
    seed:safeSeed,buildHash,seasonId,tick,maxTicks,board:Array.from(board),active:active?{...active}:null,queue:[...queue],hold,holdUsed,holdsUsed,
    piecesSpawned,piecesLocked,piecesPlaced:piecesLocked,bagRefills,bagDraws:bagRng.count,bagRngCount:bagRng.count,garbageRngCount:garbageRng.count,
    prevMask,lastHorizontal,gravityAccQ16,softDropCells,hardDropCells,lines,linesCleared:lines,level,startLevel,score,comboCount,maxCombo,
    chainActive,backToBackCount,maxBackToBack,hashpower,garbageTimerTicks,garbagePending:[...garbagePending],garbageRowsReceived,garbageGroups,
    garbageRowsCleared,reorgsRejected,lastGarbageHole,quadClears,singles,doubles,triples,spinsMini,spinsFull,perfectClears,maxStackHeight,
    transitionCount,encodedEvidenceBytes,lastTransitionTick,terminal:terminalReason!==null,terminalReason,
  });
  const canonicalStateBytes = () => {
    const bytes = [];

    // Historical S-03 prefix. Its byte order is frozen so the 0.2.0 correction is append-only.
    appendU32Le(bytes, tick);
    bytes.push(...board);
    const pieceId = active ? 'IJLOSTZ'.indexOf(active.kind) + 1 : 0;
    for (const value of active
      ? [pieceId, active.x, active.y, gravityAccQ16, active.rotation, activeSpawnTick]
      : [0, 0, 0, 0, 0, 0]) appendU32Le(bytes, value);
    appendU32Le(bytes, piecesSpawned % 7);
    appendU32Le(bytes, bagRng.count);
    bytes.push(hold === null ? 0 : 'IJLOSTZ'.indexOf(hold) + 1, holdUsed ? 1 : 0);
    for (const hole of garbagePending) {
      appendU32Le(bytes, 1);
      appendU32Le(bytes, 0);
      bytes.push(hole);
    }
    appendU32Le(bytes, garbageRng.count);
    bytes.push(lastGarbageHole < 0 ? 255 : lastGarbageHole);
    appendU32Le(bytes, zoneForTick(tick));
    appendU32Le(bytes, comboCount);
    bytes.push(chainActive ? 1 : 0);
    appendU32Le(bytes, lines);
    appendU64Le(bytes, score);

    // SRT2 correction block: version marker followed by every formerly omitted canonical field.
    bytes.push(0x53, 0x52, 0x54, 0x02);
    appendU32Le(bytes, safeSeed);
    appendU32Le(bytes, startLevel);
    appendU32Le(bytes, maxTicks);
    appendU32Le(bytes, piecesSpawned);
    appendU32Le(bytes, piecesLocked);
    appendU32Le(bytes, bagRefills);
    appendU32Le(bytes, queue.length);
    for (const kind of queue) bytes.push('IJLOSTZ'.indexOf(kind) + 1);
    if (active) {
      bytes.push(active.lastKickIndex, active.lastActionWasRotation ? 1 : 0);
      appendU32Le(bytes, active.lockTimer);
      appendU32Le(bytes, active.lockResetsUsed);
      appendU32Le(bytes, active.lowestYReached);
    } else {
      bytes.push(0, 0);
      appendU32Le(bytes, 0);
      appendU32Le(bytes, 0);
      appendU32Le(bytes, 0);
    }
    bytes.push(prevMask);
    appendU32Le(bytes, lastHorizontal);
    appendU32Le(bytes, lastTransitionTick);
    appendU32Le(bytes, holdsUsed);
    appendU32Le(bytes, softDropCells);
    appendU32Le(bytes, hardDropCells);
    appendU32Le(bytes, maxCombo);
    appendU32Le(bytes, backToBackCount);
    appendU32Le(bytes, maxBackToBack);
    appendU32Le(bytes, hashpower);
    appendU32Le(bytes, garbageTimerTicks);
    appendU32Le(bytes, garbagePending.length);
    for (const hole of garbagePending) bytes.push(hole);
    appendU32Le(bytes, lastGarbageHole);
    appendU32Le(bytes, garbageGroups);
    appendU32Le(bytes, garbageRowsReceived);
    appendU32Le(bytes, garbageRowsCleared);
    appendU32Le(bytes, reorgsRejected);
    appendU32Le(bytes, quadClears);
    appendU32Le(bytes, singles);
    appendU32Le(bytes, doubles);
    appendU32Le(bytes, triples);
    appendU32Le(bytes, spinsMini);
    appendU32Le(bytes, spinsFull);
    appendU32Le(bytes, perfectClears);
    appendU32Le(bytes, maxStackHeight);
    appendU32Le(bytes, transitionCount);
    appendU32Le(bytes, encodedEvidenceBytes);
    bytes.push(terminalReason === null ? 0 : STACKED_TERMINAL_REASONS.indexOf(terminalReason) + 1);
    return bytes;
  };
  const stateHash=()=>fnv1a32Bytes(canonicalStateBytes());
  const result=()=>{
    if(terminalReason===null) return null;
    if(terminalResult===null) terminalResult=buildStackedResultTuple(snapshot());
    return terminalResult;
  };
  const processHold = (rising) => {
    if ((rising & 128) === 0 || holdUsed) return false;
    const outgoing = active.kind;
    holdUsed = true;
    holdsUsed += 1;
    if (hold === null) {
      hold = outgoing;
      spawnFromQueue();
    } else {
      const incoming = hold;
      hold = outgoing;
      activate(incoming);
    }
    return true;
  };
  const processRotation = (rising) => {
    let target = null;
    if ((rising & 32) !== 0) target = (active.rotation + 3) & 3;
    else if ((rising & 16) !== 0) target = (active.rotation + 1) & 3;
    else if ((rising & 64) !== 0) target = (active.rotation + 2) & 3;
    if (target === null) return;
    const rotated = attemptRotation(board, active, target);
    if (!rotated) return;
    active = {
      ...rotated,
      lastActionWasRotation: true,
      lockTimer: active.lockTimer,
      lockResetsUsed: active.lockResetsUsed,
      lowestYReached: active.lowestYReached,
    };
    if (!establishNewLowestY()) resetForAction();
  };
  const processHorizontal = (mask, oldMask, rising) => {
    let horizontal = 0;
    if ((rising & 3) === 3) horizontal = lastHorizontal;
    else if ((rising & 1) !== 0) horizontal = -1;
    else if ((rising & 2) !== 0) horizontal = 1;
    else if ((oldMask & 3) === 3 && (mask & 3) === 1) horizontal = -1;
    else if ((oldMask & 3) === 3 && (mask & 3) === 2) horizontal = 1;
    if (horizontal !== 0) move(horizontal, 0);
  };
  const processHardDrop = () => {
    let distance = 0;
    while (canMove(0, -1)) {
      active.y -= 1;
      distance += 1;
    }
    hardDropCells += distance;
    score += distance * 2;
    active.lastActionWasRotation = false;
    lock();
  };
  const processGravityAndLock = (mask) => {
    const soft = (mask & 4) !== 0;
    const gravity = STACKED_GRAVITY_Q16[Math.min(level, GRAVITY_LEVEL_CAP)];
    gravityAccQ16 += soft ? Math.min(gravity * SOFT_DROP_FACTOR, 20 * 65536) : gravity;
    while (gravityAccQ16 >= 65536) {
      if (!canMove(0, -1)) {
        gravityAccQ16 = 0;
        break;
      }
      active.y -= 1;
      active.lastActionWasRotation = false;
      if (soft) { softDropCells += 1; score += 1; }
      gravityAccQ16 -= 65536;
      establishNewLowestY();
    }
    if (!canMove(0, -1)) {
      active.lockTimer -= 1;
      if (active.lockTimer <= 0) lock();
    }
  };
  const step = (mask) => {
    if (terminalReason) throw new Error('cannot step terminal STACKED runtime');
    if (!Number.isInteger(mask) || mask < 0 || mask > 255) throw new RangeError('mask must be uint8');
    tick += 1;
    if (tick % 60 === 0) score += 10 * level;
    const oldMask = prevMask;
    const rising = mask & ~oldMask;
    if (mask !== oldMask) {
      const gap = tick - lastTransitionTick;
      const changed = mask ^ oldMask;
      const oneBit = changed !== 0 && (changed & (changed - 1)) === 0;
      if (oneBit && gap >= 1 && gap <= 16) encodedEvidenceBytes += 1;
      else {
        let value = gap - 1;
        let varintBytes = 1;
        while (value >= 128) { value = Math.floor(value / 128); varintBytes += 1; }
        encodedEvidenceBytes += 2 + varintBytes;
      }
      transitionCount += 1;
      lastTransitionTick = tick;
    }
    prevMask = mask;
    if (evidenceCeilingReached(encodedEvidenceBytes)) terminalReason = 'evidence-ceiling';
    if (!terminalReason && tick === GARBAGE_START_TICK) garbageTimerTicks = GARBAGE_INTERVAL_START_TICKS;
    else if (!terminalReason && garbageTimerTicks > 0) {
      garbageTimerTicks -= 1;
      if (garbageTimerTicks === 0) {
        lastGarbageHole = garbageHoleColumn(garbageRng, lastGarbageHole);
        garbagePending.push(lastGarbageHole);
        garbageGroups += 1;
        if (garbagePending.length > GARBAGE_PENDING_MAX) terminalReason = 'garbage-out';
        else garbageTimerTicks = garbageIntervalTicks(tick);
      }
    }
    if (!terminalReason) {
      if ((rising & 1) !== 0) lastHorizontal = -1;
      if ((rising & 2) !== 0) lastHorizontal = 1;
      const heldThisTick = processHold(rising);
      if (!terminalReason) {
        processRotation(rising);
        processHorizontal(mask, oldMask, rising);
        const hardDropRequested = (rising & 8) !== 0;
        if (hardDropRequested && !heldThisTick) processHardDrop();
        else processGravityAndLock(hardDropRequested ? mask & ~4 : mask);
      }
    }
    if (!terminalReason && tick >= maxTicks) terminalReason = 'tick-ceiling';
    return snapshot();
  };
  const runtime = Object.freeze({step,snapshot,stateHash,result,get terminal(){return terminalReason!==null;}});
  runtimeStateBytes.set(runtime, canonicalStateBytes);
  return runtime;
}

export function createStackedRuntime(args = {}) {
  return createStackedRuntimeInternal(args, null);
}

export function createStackedMatchRuntime(args, lockBoundary, acknowledgeMatchGarbage) {
  if (typeof lockBoundary !== 'function') throw new TypeError('lockBoundary must be a function');
  if (typeof acknowledgeMatchGarbage !== 'function') throw new TypeError('acknowledgeMatchGarbage must be a function');
  return createStackedRuntimeInternal(args, lockBoundary, acknowledgeMatchGarbage);
}
