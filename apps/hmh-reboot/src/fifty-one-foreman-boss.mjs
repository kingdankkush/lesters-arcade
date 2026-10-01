// The 51% Foreman: the site boss of the Fork Fortress keep and work court
// (slice HMH-BOSSES-2-4, area brief 09). A huge human in a hard hat with a
// steam hammer, the owner's minigun slung as a hash cannon and a furnace pack.
// Phases at the v7 thresholds (65% and 30%):
//
//   0 'shift-start'    hammer slams up close, cannon fans at range;
//   1 'overtime'       adds the Quarry Charge (a dash along a charge lane);
//   2 'majority-rule'  steers at the hero; the presses cycle between supers.
//
// The super is the Machinery Cycle: the quarry presses along the court fire
// column by column, each keeping one safe row. It emits
// `arena:machinery-cycle` with the column geometry for the world to bind; no
// prop moves here. Pure data plus the shared district engine.
import { freezeDeep } from './value-guards.mjs';
import { seededUnit } from './deterministic-hash.mjs';
import { bindDistrictBoss, defineDistrictBoss, rayExit, rotateDirection } from './district-boss-kit.mjs';

export const FIFTY_ONE_FOREMAN_BOSS_ID = 'fifty-one-percent-foreman';
export const FIFTY_ONE_FOREMAN_TARGET_ID = 'boss-51-foreman';
export const FIFTY_ONE_FOREMAN_ARENA_HOOK = 'arena:machinery-cycle';

export const FIFTY_ONE_FOREMAN_BODY = freezeDeep({
  radius: 60, hurtRadius: 52, minZ: 4, maxZ: 120, armor: 1.2, knockbackResistance: 0.95,
  playerSeparationRadius: 90, maxPressureStep: 4, pinEscapeClearance: 50,
  walkUnitsPerTick: 1.4, steerUnitsPerTick: 1.8, dashUnitsPerTick: 13,
});

export const FIFTY_ONE_FOREMAN_PHASES = freezeDeep([
  { id: 'shift-start', index: 0, accent: 0xff7a1a },
  { id: 'overtime', index: 1, accent: 0xffc32b },
  { id: 'majority-rule', index: 2, accent: 0xff3d1f },
]);

export const FIFTY_ONE_FOREMAN_ATTACKS = freezeDeep({
  'hammer-slam': { id: 'hammer-slam', tier: 'primitive', clip: 'attack', tellTicks: 50, recoveryTicks: 50, damage: 18, knockback: 40, radius: 130, cooldownTicks: 150 },
  'hash-cannon': { id: 'hash-cannon', tier: 'primitive', clip: 'attack-2', tellTicks: 48, recoveryTicks: 45, damage: 12, knockback: 16, width: 64, spreadRadians: (11 * Math.PI) / 180, cooldownTicks: 180 },
  'quarry-charge': { id: 'quarry-charge', tier: 'primitive', clip: 'attack-2', tellTicks: 42, recoveryTicks: 60, damage: 16, knockback: 30, width: 80, maxDistance: 600, minPhase: 1, cooldownTicks: 360 },
  // A column is 450 wide, so stepping sideways into the neighbouring column
  // clears a press in (450 + 24) / 4 + 12 = 131 ticks <= the 140-tick tell.
  'machinery-cycle': { id: 'machinery-cycle', tier: 'super', clip: 'super', tellTicks: 140, columnIntervalTicks: 24, recoveryTicks: 70, damage: 18, knockback: 24, columns: 4, rows: 3, repeatTicks: 1_500 },
});

// The presses: four columns along x, three rows along y; each column keeps
// one safe row, chosen by fnv(runSeed, 'foreman-press', ordinal, column) and
// moving by at most one row between neighbours (walk-escape rule 4.1).
export function foremanPressLayout(arena, seed, ordinal, { columns, rows }) {
  const b = arena.bounds;
  const columnSize = (b.maxX - b.minX) / columns;
  const rowSize = (b.maxY - b.minY) / rows;
  const safeRows = [];
  for (let column = 0; column < columns; column += 1) {
    let row = Math.floor(seededUnit(seed, `foreman-press:${ordinal}:${column}`) * rows);
    if (column > 0 && Math.abs(row - safeRows[column - 1]) > 1) row = safeRows[column - 1] + Math.sign(row - safeRows[column - 1]);
    safeRows.push(row);
  }
  const cell = (column, row) => ({ minX: b.minX + column * columnSize, maxX: b.minX + (column + 1) * columnSize, minY: b.minY + row * rowSize, maxY: b.minY + (row + 1) * rowSize });
  return freezeDeep({ columns, rows, columnSize, rowSize, safeRows, cell });
}

function strikes(attackId, { boss, player, arena, phaseIndex, ordinal, origin, toPlayer, attack, strike, seed }) {
  switch (attackId) {
    case 'hammer-slam':
      return [strike({ type: 'circle', center: origin, radius: attack.radius }, attack.tellTicks)];
    case 'hash-cannon': {
      const lane = (side) => {
        const direction = rotateDirection(toPlayer, side * attack.spreadRadians);
        const length = rayExit(origin, direction, arena.bounds);
        return { type: 'lane', origin, target: { x: origin.x + direction.x * length, y: origin.y + direction.y * length }, width: attack.width };
      };
      // Overtime and Majority Rule fan the burst: the centre lane, then the pair.
      if (phaseIndex === 0) return [strike(lane(0), attack.tellTicks)];
      return [strike(lane(0), attack.tellTicks), strike({ type: 'union', shapes: [lane(-1), lane(1)] }, attack.tellTicks + 18)];
    }
    case 'quarry-charge': {
      const length = Math.min(attack.maxDistance, rayExit(origin, toPlayer, arena.bounds));
      return [strike({ type: 'charge-lane', origin, target: { x: origin.x + toPlayer.x * length, y: origin.y + toPlayer.y * length }, width: attack.width }, attack.tellTicks, {
        dash: { direction: toPlayer, distance: length },
      })];
    }
    case 'machinery-cycle': {
      const layout = foremanPressLayout(arena, seed, ordinal, attack);
      const bossColumn = Math.max(0, Math.min(layout.columns - 1, Math.floor((boss.x - arena.bounds.minX) / layout.columnSize)));
      const ascending = bossColumn <= (layout.columns - 1) / 2;
      const order = Array.from({ length: layout.columns }, (_, index) => (ascending ? index : layout.columns - 1 - index));
      return order.map((column, index) => strike({
        type: 'panels',
        cells: Array.from({ length: layout.rows }, (_, row) => row).filter((row) => row !== layout.safeRows[column]).map((row) => layout.cell(column, row)),
      }, attack.tellTicks + attack.columnIntervalTicks * index, {
        sectorId: `press-${column}`,
        hook: { type: FIFTY_ONE_FOREMAN_ARENA_HOOK, payload: { column, safeRow: layout.safeRows[column], columns: layout.columns, rows: layout.rows, sequence: index, stage: phaseIndex + 1 } },
      }));
    }
    default:
      throw new TypeError(`unknown 51% Foreman attack ${attackId}`);
  }
}

export const FIFTY_ONE_FOREMAN_DEFINITION = defineDistrictBoss({
  bossId: FIFTY_ONE_FOREMAN_BOSS_ID,
  targetId: FIFTY_ONE_FOREMAN_TARGET_ID,
  name: 'The 51% Foreman',
  actorId: FIFTY_ONE_FOREMAN_TARGET_ID,
  triggerId: 'keep-threshold',
  arenaSize: 1_800,
  introTicks: 150,
  firstActionDelayTicks: 30,
  firstSuperDelayTicks: 1_080,
  markOffsets: [{ x: -540, y: -400 }, { x: 540, y: -400 }, { x: -540, y: 440 }, { x: 540, y: 440 }],
  hookOffsets: [{ x: -675, y: 0 }, { x: -225, y: 0 }, { x: 225, y: 0 }, { x: 675, y: 0 }],
  body: FIFTY_ONE_FOREMAN_BODY,
  phases: FIFTY_ONE_FOREMAN_PHASES,
  attacks: FIFTY_ONE_FOREMAN_ATTACKS,
  superId: 'machinery-cycle',
  fallbackAttacks: ['hash-cannon', 'hammer-slam'],
  candidateAttacks: ({ phaseIndex, distance }) => {
    if (distance < 200) return ['hammer-slam', 'hash-cannon'];
    if (distance <= 520) return ['hash-cannon', 'hammer-slam', ...(phaseIndex >= 1 ? ['quarry-charge'] : [])];
    return phaseIndex >= 1 ? ['quarry-charge', 'hash-cannon'] : ['hash-cannon'];
  },
  stallTicks: 5_400,
  endlessCycleTicks: 1_440,
  endlessCycle: [
    { offset: 60, attackId: 'hash-cannon' },
    { offset: 300, attackId: 'quarry-charge' },
    { offset: 600, attackId: 'hammer-slam' },
    { offset: 900, attackId: 'machinery-cycle' },
  ],
  strikes,
});

export const fiftyOneForeman = bindDistrictBoss(FIFTY_ONE_FOREMAN_DEFINITION);
export const createFiftyOneForemanBoss = fiftyOneForeman.create;
export const stepFiftyOneForemanBoss = fiftyOneForeman.step;
export const applyFiftyOneForemanDamage = fiftyOneForeman.applyDamage;
export const resolveFiftyOneForemanAttack = fiftyOneForeman.resolveAttack;
export const fiftyOneForemanOpenArena = fiftyOneForeman.openArena;
