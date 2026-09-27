// The boss registry and the shared boss lifecycle (design package 4.1 and 4.7
// items 1-2, slice S1.5). It replaces the liquidatorBoss singleton's timer:
// a boss is dormant from tick 0, becomes ready at its contract readyTick, and
// starts only when the player triggers it. Only one boss is live at a time,
// and the first trigger to fire owns the boss for the rest of the run.
//
// Lifecycle: dormant -> (trigger) live [intro -> combat] -> defeated, or
// -> (retreat ring, or the hero leaving during the intro) cooldown -> ready
// again. Locks close capsule by capsule as their footprints clear and are
// forced at the intro end. The director is suppressed while a boss lives and
// for a grace after; the first four adds of a slot are free once per run and
// every further add draws from the director's capacity bank (contract 5.3).
//
// Only the Liquidator is registered: the Rug Pull Baron, the Lockkeeper and
// the 51% Foreman stay dark until their slices, and their v7 rows stay zero.
// Pure simulation, loaded lazily with the boss modules.
import { freezeDeep } from './value-guards.mjs';
import { directorViewBounds } from './encounter-director.mjs';
import {
  LIQUIDATOR_DARK_POOL,
  LIQUIDATOR_MARGIN_FLOOR,
  bodyOverlapsLock,
  insideBossArena,
  pastDarkPoolThreshold,
} from './boss-arenas.mjs';
import { referenceDps } from './boss-reference-dps.mjs';
import { LIQUIDATOR_TARGET_ID, createLiquidatorAddCandidates, createLiquidatorBoss } from './liquidator-boss.mjs';
import { attemptScheduledEnemyInsertion } from './enemy-simulation.mjs';
import { HMH_V7_BOSSES, HMH_V7_BOSS_RULES, HMH_V7_RUN_RULES, hmhV7BossHp } from '../../../sdk/hmh-run-contract-v7.mjs';
import { HMH_RUN_SUMMARY_CATALOGS_V7 } from '../../../sdk/hmh-run-summary-schema-v7.mjs';

const RULES = HMH_V7_BOSS_RULES;
// Grace after a defeat (4.3 reward 4) and after a retreat (4.1 "Spawning
// resumes through the existing 480-tick recovery after release").
export const BOSS_DEFEAT_GRACE_TICKS = 1_800;
export const BOSS_RELEASE_RECOVERY_TICKS = 480;

export const BOSS_DEFINITIONS = freezeDeep({
  liquidator: {
    bossId: 'liquidator',
    targetId: LIQUIDATOR_TARGET_ID,
    roleId: 'liquidator',
    name: 'The Liquidator',
    districtId: HMH_V7_BOSSES.liquidator.district,
    readyTick: HMH_V7_BOSSES.liquidator.readyTick,
    targetSeconds: HMH_V7_BOSSES.liquidator.targetSeconds,
    silverBurst: HMH_V7_BOSSES.liquidator.silverBurst,
    threat: HMH_V7_BOSSES.liquidator.threat,
    markers: HMH_V7_BOSSES.liquidator.phaseThresholds,
    arenas: { bell: LIQUIDATOR_MARGIN_FLOOR, 'dark-pool': LIQUIDATOR_DARK_POOL },
    triggerZone: 'liquidator-closing-bell',
    retreatZones: { 'margin-floor': 'liquidator-retreat-margin-floor', 'dark-pool': 'liquidator-retreat-dark-pool' },
    darkPoolObjective: 'warehouse-logbook',
    unlockObjective: 'liquidator-defeated',
  },
});

// Director insertions the capacity bank allows by `tick` (the verifier's
// directorSpawnCapacity over the v7 band schedule; a parity test pins it).
export function directorSpawnCapacityV7(tick) {
  let total = 0;
  for (const band of HMH_V7_RUN_RULES.ENCOUNTER_BAND_SCHEDULE) {
    if (tick < band.minTick) break;
    const last = Math.min(tick, band.maxTick);
    total += Math.floor((last - band.minTick) / band.spawnIntervalTicks) + 1;
  }
  return total;
}

export function createBossSlots({ seed = 0 } = {}) {
  return {
    seed: Number(seed) >>> 0,
    lastTick: -1,
    rows: new Map(HMH_RUN_SUMMARY_CATALOGS_V7.bosses.map((bossId) => [bossId, { initiations: 0, first: 0, last: 0, defeatedTick: 0 }])),
    slots: Object.fromEntries(Object.values(BOSS_DEFINITIONS).map((definition) => [definition.bossId, {
      bossId: definition.bossId,
      status: 'dormant',
      readyAt: definition.readyTick,
      owner: null,
      arena: null,
      initiatedTick: -1,
      boss: null,
      closedWalls: [],
      locked: false,
      freeAdds: RULES.BOSS_ADDS_FIRST,
      // Add waves this slot's bosses have issued in the run. Each new boss
      // counts on from here, so add ids (boss:<id>:w<n>:<k>) never repeat
      // across a retreat or a call-off: the population refuses a seen id.
      addWaves: 0,
    }])),
    bankedAdds: 0,
    graceUntil: -1,
    parachute: { held: false, used: false },
    revivesUsed: 0,
  };
}

const liveSlot = (slots) => Object.values(slots.slots).find((slot) => slot.status === 'live') ?? null;

function triggerArmed(slots, slot, trigger, tick) {
  return (slot.status === 'dormant' || slot.status === 'cooldown') && tick >= slot.readyAt
    && (slot.owner === null || slot.owner === trigger) && !liveSlot(slots);
}

// Which boss zones the mission may fill this tick, and what each shows.
export function bossZoneArming(slots, tick) {
  const armed = new Set();
  const status = new Map();
  for (const slot of Object.values(slots.slots)) {
    const definition = BOSS_DEFINITIONS[slot.bossId];
    const bell = definition.triggerZone;
    // Once the Dark Pool owns him, the bell shows SETTLED for the rest of the
    // run; a bell fight hides it while live and after the defeat.
    if (triggerArmed(slots, slot, 'bell', tick)) armed.add(bell);
    else if (slot.owner === 'dark-pool') status.set(bell, { status: 'settled', readyAt: null });
    else if (slot.status === 'live') status.set(bell, { status: 'live', readyAt: null });
    else if (slot.status === 'defeated') status.set(bell, { status: 'defeated', readyAt: null });
    else status.set(bell, { status: 'waiting', readyAt: slot.readyAt });
    for (const [arenaId, zoneId] of Object.entries(definition.retreatZones)) {
      const open = slot.status === 'live' && slot.arena?.id === arenaId && slot.boss?.active
        && tick - slot.initiatedTick >= RULES.BOSS_RETREAT_RING_TICKS;
      if (open) armed.add(zoneId);
      else status.set(zoneId, { status: 'hidden', readyAt: null });
    }
  }
  return freezeDeep({ armed, status });
}

function initiate(slots, slot, { trigger, tick, level, events }) {
  const definition = BOSS_DEFINITIONS[slot.bossId];
  const arena = definition.arenas[trigger];
  const row = slots.rows.get(slot.bossId);
  row.initiations += 1;
  row.first ||= tick;
  row.last = tick;
  slot.owner ??= trigger;
  slot.status = 'live';
  slot.arena = arena;
  slot.initiatedTick = tick;
  slot.closedWalls = [];
  slot.locked = false;
  slot.boss = createLiquidatorBoss({
    arena,
    entry: trigger,
    startTick: tick,
    groundZ: 0,
    seed: slots.seed,
    // Package 4.1: HP frozen at the trigger from the level at the trigger.
    maxHealth: hmhV7BossHp(slot.bossId, referenceDps(Math.max(1, Math.min(1_000, level)))),
    wave: slot.addWaves,
  });
  events.push({ type: 'boss-initiated', bossId: slot.bossId, trigger, tick, arenaId: arena.id, maxHealth: slot.boss.maxHealth });
}

function withdraw(slots, slot, { tick, reason, readyAt, events, opened }) {
  opened.push(...slot.closedWalls);
  slot.closedWalls = [];
  slot.locked = false;
  // Waves issued but not yet resolved count too: their ids are skipped, never reused.
  slot.addWaves = Math.max(slot.addWaves, slot.boss?.wave ?? 0);
  slot.boss = null;
  slot.status = 'cooldown';
  slot.readyAt = readyAt;
  slots.graceUntil = Math.max(slots.graceUntil, tick + BOSS_RELEASE_RECOVERY_TICKS);
  events.push({ type: 'boss-withdrawn', bossId: slot.bossId, reason, tick, readyAt });
}

function distanceToWall(wall, point) {
  const { a, b } = wall.shape;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared > 0 ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared)) : 0;
  return Math.hypot(point.x - (a.x + dx * t), point.y - (a.y + dy * t));
}

// One fixed step, after the mission step (which records the logbook first,
// package 3.2) and before the director, the boss step, enemies and combat.
export function stepBossSlots(slots, {
  tick,
  player,
  missionEvents = [],
  mission,
  level = 1,
  enemies = [],
} = {}) {
  if (!Number.isInteger(tick) || tick < 0 || tick <= slots.lastTick) throw new TypeError('boss slot ticks must be monotonic');
  if (![player?.x, player?.y].every(Number.isFinite)) throw new TypeError('finite player position required');
  slots.lastTick = tick;
  const events = [];
  const closed = [];
  const opened = [];
  const recycle = new Set();
  const slot = slots.slots.liquidator;
  const definition = BOSS_DEFINITIONS.liquidator;

  for (const event of missionEvents) {
    if (event?.type !== 'boss-zone' || event.bossId !== slot.bossId) continue;
    if (event.zoneKind === 'trigger' && triggerArmed(slots, slot, event.trigger, tick)) initiate(slots, slot, { trigger: event.trigger, tick, level, events });
    else if (event.zoneKind === 'retreat' && slot.status === 'live' && slot.arena?.id === event.arena && slot.boss?.active) {
      // The boss withdraws with its HP restored and is ready again 1,800
      // ticks later (package 4.1 decision 4); no reward, no penalty. The ring
      // counts its first armed tick (initiation + 600), so an unbroken channel
      // fills at +719 and 1,800 on is +2,519; the verifier spaces initiations
      // 2,520 apart, and the Dark Pool, which has no ring, re-initiates on the
      // first ready tick. The later of the two keeps the spacing however the
      // channel fills.
      const readyAt = Math.max(tick + RULES.BOSS_READY_AGAIN_TICKS, slot.initiatedTick + RULES.BOSS_REINITIATION_MIN_TICKS);
      withdraw(slots, slot, { tick, reason: 'retreat', readyAt, events, opened });
    }
  }
  // The Dark Pool: the logbook found (this tick or earlier) and the hero 48
  // past the threshold.
  if (mission?.completed?.has(definition.darkPoolObjective) && pastDarkPoolThreshold(player) && triggerArmed(slots, slot, 'dark-pool', tick)) {
    initiate(slots, slot, { trigger: 'dark-pool', tick, level, events });
  }

  if (slot.status === 'live' && !slot.locked) {
    const arena = slot.arena;
    const introEnd = slot.initiatedTick + slot.boss.introTicks;
    const bodies = [{ x: player.x, y: player.y, radius: player.radius ?? 24 }, ...enemies, { x: slot.boss.x, y: slot.boss.y, radius: slot.boss.radius }];
    if (tick >= introEnd && !insideBossArena(arena, player)) {
      // The hero left the floor before it sealed: the fight is called off. A
      // re-initiation waits the full contract spacing.
      withdraw(slots, slot, { tick, reason: 'abandoned', readyAt: slot.initiatedTick + RULES.BOSS_REINITIATION_MIN_TICKS, events, opened });
    } else {
      for (const wall of arena.walls) {
        if (slot.closedWalls.includes(wall.id)) continue;
        if (bodies.some((body) => bodyOverlapsLock(wall, body))) continue;
        slot.closedWalls.push(wall.id);
        closed.push(wall.id);
        events.push({ type: 'lock-closed', bossId: slot.bossId, wallId: wall.id, tick });
      }
      if (tick >= introEnd) {
        for (const wall of arena.walls) {
          if (slot.closedWalls.includes(wall.id)) continue;
          // An ordinary enemy standing in the wall line is recycled without
          // credit; one merely touching the footprint is pushed clear by its
          // own swept collision once the shutter exists.
          for (const enemy of enemies) if (distanceToWall(wall, enemy) < wall.shape.radius + (enemy.radius ?? 0)) recycle.add(enemy.id);
          slot.closedWalls.push(wall.id);
          closed.push(wall.id);
          events.push({ type: 'lock-closed', bossId: slot.bossId, wallId: wall.id, tick, forced: true });
        }
      }
      if (slot.closedWalls.length === arena.walls.length) {
        slot.locked = true;
        // Off-view ordinary enemies outside the floor are recycled without
        // credit at lock (package 4.1 "Director").
        const view = directorViewBounds(player);
        for (const enemy of enemies) {
          const onView = enemy.x >= view.minX && enemy.x <= view.maxX && enemy.y >= view.minY && enemy.y <= view.maxY;
          if (!insideBossArena(arena, enemy) && !onView) recycle.add(enemy.id);
        }
        events.push({ type: 'boss-locked', bossId: slot.bossId, tick });
      }
    }
  }
  return freezeDeep({ tick, events, closed, opened, recycle: [...recycle].sort() });
}

// Presentation and smoke tooling only (main.mjs ?boss=1): starts the boss on
// an arena of the caller's choosing with no locks. Never reached in play.
export function forceBossStart(slots, { bossId, tick, arena, level = 1 }) {
  const slot = slots.slots[bossId];
  const events = [];
  initiate(slots, slot, { trigger: 'bell', tick, level, events });
  slot.arena = arena;
  slot.boss = createLiquidatorBoss({ arena, entry: 'bell', startTick: tick, seed: slots.seed, maxHealth: slot.boss.maxHealth, wave: slot.addWaves });
  slot.locked = true;
  return slot.boss;
}

// Rewards for a real defeat (package 4.3): the Vault's unlock, a full heal and
// grenades to max, the silver burst (in place of the 1.8.1 ten coins), the
// Golden Parachute for a Dark Pool win, and a pacified Yard with a grace.
export function defeatBossSlot(slots, { bossId, tick }) {
  const slot = slots.slots[bossId];
  if (!slot || slot.status !== 'live') throw new Error(`boss ${String(bossId)} is not live`);
  const definition = BOSS_DEFINITIONS[bossId];
  const row = slots.rows.get(bossId);
  row.defeatedTick ||= tick;
  const opened = [...slot.closedWalls];
  slot.closedWalls = [];
  slot.locked = false;
  slot.status = 'defeated';
  slots.graceUntil = Math.max(slots.graceUntil, tick + BOSS_DEFEAT_GRACE_TICKS);
  const goldenParachute = slot.owner === 'dark-pool';
  if (goldenParachute) slots.parachute.held = true;
  return freezeDeep({
    bossId,
    silverBurst: definition.silverBurst,
    unlockObjective: definition.unlockObjective,
    fullHeal: true,
    grenadesToMax: true,
    goldenParachute,
    graceTicks: BOSS_DEFEAT_GRACE_TICKS,
    opened,
  });
}

// The Golden Parachute: one revive at 50% HP.
export function consumeGoldenParachute(slots, tick) {
  if (!slots.parachute.held || slots.parachute.used || !Number.isInteger(tick)) return false;
  slots.parachute.used = true;
  slots.revivesUsed += 1;
  return true;
}

// Whether the next boss add may be inserted now, and from which budget: a
// slot's first four are free once per run (never in an engagement's first 90
// ticks); every further one draws from the director's capacity bank.
export function bossAddAllowance(slots, { bossId, tick, directorInserted }) {
  const slot = slots.slots[bossId];
  if (!slot || slot.status !== 'live' || tick - slot.initiatedTick < RULES.BOSS_ADD_DELAY_TICKS) return null;
  if (slot.freeAdds > 0) {
    slot.freeAdds -= 1;
    return 'free';
  }
  if (directorInserted + slots.bankedAdds < directorSpawnCapacityV7(tick)) {
    slots.bankedAdds += 1;
    return 'bank';
  }
  return null;
}

// Hands back an allowance whose insertion the population refused, so the free
// four count real insertions and the bank counts only adds that exist. It
// never lifts a slot above its first four or the bank below zero.
function refundBossAddAllowance(slots, { bossId, allowance }) {
  const slot = slots.slots[bossId];
  if (allowance === 'free' && slot) slot.freeAdds = Math.min(RULES.BOSS_ADDS_FIRST, slot.freeAdds + 1);
  else if (allowance === 'bank') slots.bankedAdds = Math.max(0, slots.bankedAdds - 1);
}

// A resolved Enforcement Order's troops into the enemy population. `place`
// gives a candidate's groundZ, or null where it cannot stand (deep water, a
// blocker), and such a spot takes no allowance. Each add takes its allowance
// just before its insertion and returns it if the population refuses the add
// (a duplicate id, the body or threat capacity). The live boss reserves its
// adds' bodies and threat apart from the band caps; the population capacity
// (192) still holds.
export function insertBossAdds(slots, { bossId, event, tick, population, alive, directorInserted, place }) {
  const inserted = [];
  const rejected = [];
  for (const candidate of createLiquidatorAddCandidates({ event, alive })) {
    const groundZ = place(candidate);
    if (groundZ === null) continue;
    const allowance = bossAddAllowance(slots, { bossId, tick, directorInserted });
    if (!allowance) break;
    const result = attemptScheduledEnemyInsertion({
      population,
      schedule: { nextSpawnTick: tick, intervalTicks: 1, burstRemaining: 1 },
      candidate: { ...candidate, groundZ },
      tick,
      placementAllowed: true,
      visualMode: 'normal',
      threatRemaining: null,
    });
    if (result.inserted) inserted.push({ id: result.enemyId, allowance });
    else {
      refundBossAddAllowance(slots, { bossId, allowance });
      rejected.push({ id: candidate.id, reason: result.reason });
    }
  }
  return freezeDeep({ inserted, rejected });
}

// The director's view of the bosses: suppressed while one lives and during a
// grace; the Yard leans to Agents until the Liquidator falls (4.3 "Purpose").
export function bossDirectorOverlay(slots, tick) {
  const pacified = slots.slots.liquidator.status === 'defeated';
  return freezeDeep({
    suppressed: Boolean(liveSlot(slots)) || tick < slots.graceUntil,
    leanRole: pacified ? null : 'suppressor',
    pacified,
  });
}

// True when the director's own next insertion would overdraw the bank that
// banked boss adds share with it.
export function directorBankFull(slots, { tick, directorInserted }) {
  return directorInserted + slots.bankedAdds >= directorSpawnCapacityV7(tick);
}

export function bossHudState(slots, tick) {
  const slot = liveSlot(slots);
  if (!slot?.boss?.active) return freezeDeep({ active: false, bossId: null, name: '', ratio: 0, phaseId: '', markers: [] });
  const definition = BOSS_DEFINITIONS[slot.bossId];
  return freezeDeep({
    active: tick >= slot.initiatedTick,
    bossId: slot.bossId,
    name: definition.name,
    ratio: Math.max(0, Math.min(1, slot.boss.health / slot.boss.maxHealth)),
    phaseId: slot.boss.phaseId,
    markers: definition.markers,
  });
}

// The v7 `bosses` rows (contract section 4): dense, in catalogue order.
export function bossRunRows(slots) {
  return Object.freeze(HMH_RUN_SUMMARY_CATALOGS_V7.bosses.map((bossId) => {
    const row = slots.rows.get(bossId);
    return Object.freeze({ bossId, initiations: row.initiations, firstInitiatedTick: row.first, lastInitiatedTick: row.last, defeatedTick: row.defeatedTick });
  }));
}
