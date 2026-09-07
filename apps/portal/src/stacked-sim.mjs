import { SeededRng, createSeededSubstreams } from './seeded-rng.mjs';
import {
  BOARD_WIDTH, BOARD_ROWS, BOARD_VISIBLE_ROWS, STACKED_MAX_TICKS,
  STACKED_GRAVITY_Q16, GRAVITY_LEVEL_CAP, LOCK_LEVEL_CAP,
  LOCK_DELAY_TICKS, LOCK_RESET_CAP, SOFT_DROP_FACTOR,
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

function hashText(text) { let h=0x811c9dc5; for(let i=0;i<text.length;i+=1){h^=text.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0;} return h.toString(16).padStart(8,'0'); }
export function createStackedRuntime({ seed, maxTicks = STACKED_MAX_TICKS, config = {} } = {}) {
  const safeSeed=normalizeSeed(seed);
  if (!Number.isInteger(maxTicks)||maxTicks<1||maxTicks>STACKED_MAX_TICKS) throw new RangeError('maxTicks out of range');
  const keys=Object.keys(config); if(keys.some((key)=>key!=='startLevel')) throw new TypeError('unsupported config key');
  const startLevel=config.startLevel ?? 1; if(!Number.isInteger(startLevel)||startLevel<1||startLevel>15) throw new RangeError('startLevel out of range');
  const streams = createSeededSubstreams(safeSeed, ['bag', 'garbage', 'zone']);
  const bagRng = streams.bag;
  const board = new Uint8Array(BOARD_WIDTH * BOARD_ROWS);
  const queue = [];
  const lockLevelIndex = Math.min(startLevel, LOCK_LEVEL_CAP) - 1;
  const lockDelay = LOCK_DELAY_TICKS[lockLevelIndex];
  const lockResetCap = LOCK_RESET_CAP[lockLevelIndex];
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
  const refill = () => {
    queue.push(...shuffledBag(bagRng));
    bagRefills += 1;
  };
  refill();
  refill();
  let active;
  const activate = (kind) => {
    const origin = SPAWN_ORIGIN[kind];
    active = {
      kind, rotation: 0, x: origin.x, y: origin.y,
      lastKickIndex: 0, lastActionWasRotation: false,
      lockTimer: lockDelay, lockResetsUsed: 0, lowestYReached: origin.y,
    };
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
    active.lockTimer = lockDelay;
    return true;
  };
  const resetForAction = () => {
    if (active.lockResetsUsed >= lockResetCap) return;
    active.lockTimer = lockDelay;
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
  const lock = () => {
    const cells = cellsFor(active.kind, active.rotation, active.x, active.y);
    const above = cells.every(([, y]) => y >= BOARD_VISIBLE_ROWS);
    for (const [x, y] of cells) board[y * BOARD_WIDTH + x] = 'IJLOSTZ'.indexOf(active.kind) + 1;
    piecesLocked += 1;
    holdUsed = false;
    if (above) {
      terminalReason = 'lock-out';
      return;
    }
    spawnFromQueue();
  };
  let gravityAccQ16=0;
  const snapshot=()=>({seed:safeSeed,tick,maxTicks,board:Array.from(board),active:active?{...active}:null,queue:[...queue],hold,holdUsed,holdsUsed,piecesSpawned,piecesLocked,bagRefills,bagDraws:bagRng.count,bagRngCount:bagRng.count,garbageRngCount:streams.garbage.count,prevMask,lastHorizontal,gravityAccQ16,softDropCells,hardDropCells,lines,startLevel,terminalReason});
  const stateHash=()=>hashText(JSON.stringify(snapshot()));
  const result=()=>terminalReason===null?null:freeze({seed:safeSeed,tick,terminalReason,stateHash:stateHash(),piecesSpawned,piecesLocked,bagRefills,bagDraws:bagRng.count,softDropCells,hardDropCells});
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
    active.lastActionWasRotation = false;
    lock();
  };
  const processGravityAndLock = (mask) => {
    const soft = (mask & 4) !== 0;
    const gravity = STACKED_GRAVITY_Q16[Math.min(startLevel, GRAVITY_LEVEL_CAP)];
    gravityAccQ16 += soft ? Math.min(gravity * SOFT_DROP_FACTOR, 20 * 65536) : gravity;
    while (gravityAccQ16 >= 65536) {
      if (!canMove(0, -1)) {
        gravityAccQ16 = 0;
        break;
      }
      active.y -= 1;
      active.lastActionWasRotation = false;
      if (soft) softDropCells += 1;
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
    const oldMask = prevMask;
    const rising = mask & ~oldMask;
    prevMask = mask;
    if ((rising & 1) !== 0) lastHorizontal = -1;
    if ((rising & 2) !== 0) lastHorizontal = 1;
    const heldThisTick = processHold(rising);
    if (!terminalReason) processRotation(rising);
    if (!terminalReason) processHorizontal(mask, oldMask, rising);
    const hardDropRequested = (rising & 8) !== 0;
    if (!terminalReason && hardDropRequested && !heldThisTick) processHardDrop();
    else if (!terminalReason) processGravityAndLock(hardDropRequested ? mask & ~4 : mask);
    if (!terminalReason && tick >= maxTicks) terminalReason = 'tick-ceiling';
    return snapshot();
  };
  return Object.freeze({step,snapshot,stateHash,result,get terminal(){return terminalReason!==null;}});
}
