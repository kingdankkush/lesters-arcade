/**
 * Deterministic weapon benchmark (Cycle 036 handoff, Priority C).
 *
 * Measures every weapon through the REAL deterministic modules — weapon
 * system cadence/reload/reserve, projectile flight via resolveProjectilePath —
 * against reference targets at close/mid/long range. Same seed, fixed 60 Hz,
 * two full runs compared for drift. This exists so balance changes are made
 * against measurements instead of one successful run.
 *
 * `npm run bench:hmh:weapons` writes docs/qa/hmh-weapon-benchmark.json.
 */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import {
  HMH_EVOLUTION_TUNING,
  HMH_WEAPON_DEFINITIONS,
  applyWeaponProgression,
  createWeaponLoadout,
  creditCritCandleKills,
  grantWeaponPickup,
  stepWeaponLoadout,
} from '../apps/hmh-reboot/src/weapon-system.mjs';
import { createBombletPool, spawnBomblets, stepBomblets } from '../apps/hmh-reboot/src/evolution-effects.mjs';
import { seededUnit } from '../apps/hmh-reboot/src/deterministic-hash.mjs';
import {
  createHurtTarget,
  createProjectileState,
  resolveProjectilePath,
} from '../apps/hmh-reboot/src/projectile-physics.mjs';
import {
  ORDINARY_ENEMY_HURTBOX_POLICY,
  createOrdinaryEnemyHurtboxProfile,
} from '../apps/hmh-reboot/src/enemy-hurtboxes.mjs';

const TICKS_PER_SECOND = 60;
const WINDOW_TICKS = 30 * TICKS_PER_SECOND;
const RANGES = Object.freeze({ close: 140, mid: 420, long: 760 });
const TARGET_HEALTH = 120;
const SEED = 0x484d4843;

// Package 8.2 (S0.3): the Railgun rows. Its charge releases as soon as it is
// ready while the trigger is held (releaseCharged, the runtime's autofire).
const WEAPON_IDS = Object.freeze(['coin-blaster', 'scatter-shotgun', 'auto-miner', 'launcher-rig', 'hash-rail']);
const RELEASE_CHARGED = true;
const TIERS = Object.freeze({
  base: {},
  maxed: { branches: { rateOfFire: 3, damage: 3, reloadSpeed: 3 } },
});

function finiteOrThrow(value, label) {
  if (!Number.isFinite(value)) throw new Error(`benchmark produced non-finite ${label}`);
  return value;
}

function benchmarkCase(weaponId, tierId, rangeId) {
  const distance = RANGES[rangeId];
  const progressionByWeapon = { [weaponId]: TIERS[tierId] };
  const state = createWeaponLoadout({ weaponIds: [...WEAPON_IDS], activeWeaponId: 'coin-blaster', seed: SEED });
  if (weaponId !== 'coin-blaster') {
    // Grant twice: the bench measures the weapon at full authored reserve cap.
    grantWeaponPickup(state, { tick: 0, weaponId, select: true, progressionByWeapon });
  }
  const target = () => createHurtTarget({
    id: 'bench-target',
    bodyShape: { type: 'circle', x: 0, y: 0, radius: 16 },
    hurtShape: { type: 'circle', x: 0, y: 0, radius: 16 },
    previousGround: { x: distance, y: 0, z: 0 },
    currentGround: { x: distance, y: 0, z: 0 },
    minZ: 0,
    maxZ: 44,
    health: 999999,
  });

  let shotsFired = 0;
  let projectilesEmitted = 0;
  let contacts = 0;
  let damageApplied = 0;
  let firstHitTick = null;
  let killTick = null;
  let reloadTicks = 0;
  let emptyTicks = 0;
  let remainingHealth = TARGET_HEALTH;

  for (let tick = 1; tick <= WINDOW_TICKS; tick += 1) {
    const weapon = state.weapons[weaponId];
    if (weapon.reloadCompleteTick !== null) reloadTicks += 1;
    if (weapon.ammoInClip <= 0 && weapon.reloadCompleteTick === null && (weapon.reserveAmmo ?? 1) <= 0) emptyTicks += 1;
    const frame = stepWeaponLoadout(state, { tick, fire: true, releaseCharged: RELEASE_CHARGED, direction: { x: 1, y: 0 }, progressionByWeapon });
    for (const event of frame.events) {
      if (event.type !== 'weapon:fire') continue;
      shotsFired += 1;
      for (const shot of event.shots) {
        projectilesEmitted += 1;
        // Full-range flight as one resolved segment against the reference
        // target: deterministic, no per-tick integration needed for a static
        // target on flat ground.
        const reach = Math.min(shot.range, distance + 40);
        const projectile = createProjectileState({
          id: shot.id,
          ownerId: 'bench',
          previous: { x: 28, y: 0, z: 22 },
          current: { x: 28 + shot.direction.x * reach, y: shot.direction.y * reach, z: 22 },
          radius: shot.radius,
          damage: shot.damage,
          policy: shot.policy,
        });
        const resolved = resolveProjectilePath({ projectile, targets: [target()] });
        for (const hit of resolved.hits) {
          contacts += 1;
          damageApplied += finiteOrThrow(hit.damage ?? shot.damage, 'hit damage');
          if (firstHitTick === null) firstHitTick = tick;
          if (killTick === null) {
            remainingHealth -= hit.damage ?? shot.damage;
            if (remainingHealth <= 0) killTick = tick;
          }
        }
      }
    }
  }

  const seconds = WINDOW_TICKS / TICKS_PER_SECOND;
  return {
    weaponId,
    tier: tierId,
    range: rangeId,
    shotsFired,
    projectilesEmitted,
    contacts,
    triggerAccuracy: shotsFired === 0 ? 0 : Number((contacts > 0 ? Math.min(1, contacts / projectilesEmitted) : 0).toFixed(4)),
    damageApplied: finiteOrThrow(damageApplied, 'damage'),
    sustainedDps: Number((damageApplied / seconds).toFixed(2)),
    timeToFirstHitSeconds: firstHitTick === null ? null : Number((firstHitTick / TICKS_PER_SECOND).toFixed(3)),
    timeToKillSeconds: killTick === null ? null : Number((killTick / TICKS_PER_SECOND).toFixed(3)),
    reloadDowntimeSeconds: Number((reloadTicks / TICKS_PER_SECOND).toFixed(2)),
    emptySeconds: Number((emptyTicks / TICKS_PER_SECOND).toFixed(2)),
    reserveRemaining: state.weapons[weaponId].reserveAmmo,
  };
}

// Moving-target extension (Cycle 045, MAP-REDO slice 5): a strafing target
// with the REAL ordinary-enemy hurtbox profile, tracked with a fixed 10-tick
// (167 ms) reaction lag. Cross-track aim error therefore equals the strafe
// displacement over the reaction window — the exact regime the hurtbox
// policy governs. Triangle-wave strafe keeps everything closed-form
// deterministic.
const STRAFE_SPEEDS = Object.freeze({ rusher: 220, walker: 116 });
const STRAFE_AMPLITUDE = 80;
const REACTION_LAG_TICKS = 10;
const MOVING_BODY_RADIUS = 18;

function strafeOffset(tick, speed) {
  const period = (STRAFE_AMPLITUDE * 4) / speed * TICKS_PER_SECOND;
  const phase = ((tick % period) + period) % period / period;
  const tri = phase < 0.5 ? phase * 4 - 1 : 3 - phase * 4;
  return tri * STRAFE_AMPLITUDE;
}

function benchmarkMovingCase(weaponId, tierId, rangeId, strafeId) {
  const distance = RANGES[rangeId];
  const strafeSpeed = STRAFE_SPEEDS[strafeId];
  const progressionByWeapon = { [weaponId]: TIERS[tierId] };
  const state = createWeaponLoadout({ weaponIds: [...WEAPON_IDS], activeWeaponId: 'coin-blaster', seed: SEED });
  if (weaponId !== 'coin-blaster') {
    grantWeaponPickup(state, { tick: 0, weaponId, select: true, progressionByWeapon });
  }
  const profile = createOrdinaryEnemyHurtboxProfile(MOVING_BODY_RADIUS);
  const targetAt = (y) => createHurtTarget({
    id: 'bench-moving-target',
    bodyShape: profile.bodyShape,
    hurtShape: profile.projectileShape,
    previousGround: { x: distance, y, z: 0 },
    currentGround: { x: distance, y, z: 0 },
    minZ: profile.minZ,
    maxZ: profile.maxZ,
    health: 999999,
  });

  let shotsFired = 0;
  let projectilesEmitted = 0;
  let contacts = 0;
  for (let tick = 1; tick <= WINDOW_TICKS; tick += 1) {
    const aimY = strafeOffset(Math.max(0, tick - REACTION_LAG_TICKS), strafeSpeed);
    const targetY = strafeOffset(tick, strafeSpeed);
    const aim = { x: distance - 28, y: aimY - 0 };
    const aimLength = Math.hypot(aim.x, aim.y) || 1;
    const direction = { x: aim.x / aimLength, y: aim.y / aimLength };
    const frame = stepWeaponLoadout(state, { tick, fire: true, releaseCharged: RELEASE_CHARGED, direction, progressionByWeapon });
    for (const event of frame.events) {
      if (event.type !== 'weapon:fire') continue;
      shotsFired += 1;
      for (const shot of event.shots) {
        projectilesEmitted += 1;
        const reach = Math.min(shot.range, distance + 40);
        const projectile = createProjectileState({
          id: shot.id,
          ownerId: 'bench',
          previous: { x: 28, y: 0, z: 22 },
          current: { x: 28 + shot.direction.x * reach, y: shot.direction.y * reach, z: 22 },
          radius: shot.radius,
          damage: shot.damage,
          policy: shot.policy,
        });
        const resolved = resolveProjectilePath({ projectile, targets: [targetAt(targetY)] });
        contacts += resolved.hits.length;
      }
    }
  }
  return {
    weaponId,
    tier: tierId,
    range: rangeId,
    strafe: strafeId,
    strafeSpeed,
    hurtboxPolicyId: ORDINARY_ENEMY_HURTBOX_POLICY.id,
    shotsFired,
    projectilesEmitted,
    contacts,
    movingHitRate: projectilesEmitted === 0 ? 0 : Number((contacts / projectilesEmitted).toFixed(4)),
  };
}

export function runMovingBenchmark() {
  const rows = [];
  for (const weaponId of WEAPON_IDS) {
    for (const tierId of Object.keys(TIERS)) {
      for (const rangeId of Object.keys(RANGES)) {
        for (const strafeId of Object.keys(STRAFE_SPEEDS)) {
          rows.push(benchmarkMovingCase(weaponId, tierId, rangeId, strafeId));
        }
      }
    }
  }
  return rows;
}

// --- C6 swarm pressure ----------------------------------------------------
// The static and moving rows both measure ONE target, so nothing in the
// benchmark answered a question about crowds: which weapon actually clears a
// pack, how much damage a launcher wastes on small bodies, whether spread
// earns its reload. The handoff calls this the missing input for S1 and S5.
//
// A pack is a line of enemies at fixed spacing across the firing lane, which
// is the arrangement spread and blast can exploit and single-target fire
// cannot. Overkill is tracked explicitly: damage landed on a body that was
// already dead is wasted, and it is exactly how a weapon looks strong on a DPS
// row while clearing slowly.
const SWARM_PACK_SIZES = Object.freeze([4, 8]);
const SWARM_ENEMY_HEALTH = 60;
const SWARM_SPACING = 46;
const SWARM_DISTANCE = RANGES.mid;

function benchmarkSwarmCase(weaponId, tierId, packSize) {
  const progressionByWeapon = { [weaponId]: TIERS[tierId] };
  const state = createWeaponLoadout({ weaponIds: [...WEAPON_IDS], activeWeaponId: 'coin-blaster', seed: SEED });
  if (weaponId !== 'coin-blaster') {
    grantWeaponPickup(state, { tick: 0, weaponId, select: true, progressionByWeapon });
  }

  const pack = [];
  for (let index = 0; index < packSize; index += 1) {
    const offset = (index - (packSize - 1) / 2) * SWARM_SPACING;
    pack.push({ id: `swarm-${index}`, y: offset, health: SWARM_ENEMY_HEALTH, dead: false });
  }

  let shotsFired = 0;
  let projectilesEmitted = 0;
  let contacts = 0;
  let damageApplied = 0;
  let overkillDamage = 0;
  let killed = 0;
  let firstKillTick = null;
  let clearTick = null;

  const MUZZLE = { x: 28, y: 0, z: 22 };

  // Aim at the nearest living member rather than firing blindly down the axis.
  // The first build fired at a fixed (1, 0) while the pack straddled that line,
  // so no member ever sat on it and single-target weapons scored zero contacts
  // -- the harness was measuring its own layout, not the weapons.
  const aimAtNearest = () => {
    let best = null;
    let bestDistance = Infinity;
    for (const member of pack) {
      if (member.dead) continue;
      const dx = SWARM_DISTANCE - MUZZLE.x;
      const dy = member.y - MUZZLE.y;
      const distance = Math.hypot(dx, dy);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = { x: dx / distance, y: dy / distance };
      }
    }
    return best;
  };

  for (let tick = 1; tick <= WINDOW_TICKS && clearTick === null; tick += 1) {
    const aim = aimAtNearest();
    if (!aim) break;
    const frame = stepWeaponLoadout(state, { tick, fire: true, releaseCharged: RELEASE_CHARGED, direction: aim, progressionByWeapon });
    for (const event of frame.events) {
      if (event.type !== 'weapon:fire') continue;
      shotsFired += 1;
      for (const shot of event.shots) {
        projectilesEmitted += 1;
        const reach = Math.min(shot.range, SWARM_DISTANCE + 120);
        const projectile = createProjectileState({
          id: shot.id,
          ownerId: 'bench',
          previous: { ...MUZZLE },
          current: { x: MUZZLE.x + shot.direction.x * reach, y: MUZZLE.y + shot.direction.y * reach, z: MUZZLE.z },
          radius: shot.radius,
          damage: shot.damage,
          policy: shot.policy,
        });
        // Every living member is a candidate, so pierce and spread can
        // register more than one contact from a single projectile.
        const living = pack.filter((member) => !member.dead);
        if (living.length === 0) break;
        const targets = living.map((member) => createHurtTarget({
          id: member.id,
          bodyShape: { type: 'circle', x: 0, y: 0, radius: 16 },
          hurtShape: { type: 'circle', x: 0, y: 0, radius: 16 },
          previousGround: { x: SWARM_DISTANCE, y: member.y, z: 0 },
          currentGround: { x: SWARM_DISTANCE, y: member.y, z: 0 },
          minZ: 0,
          maxZ: 44,
          health: 999999,
        }));
        const resolved = resolveProjectilePath({ projectile, targets });
        for (const hit of resolved.hits) {
          contacts += 1;
          const damage = finiteOrThrow(hit.damage ?? shot.damage, 'swarm hit damage');
          damageApplied += damage;
          const member = pack.find((candidate) => candidate.id === hit.targetId);
          if (!member || member.dead) {
            overkillDamage += damage;
            continue;
          }
          const absorbed = Math.min(member.health, damage);
          overkillDamage += damage - absorbed;
          member.health -= absorbed;
          if (member.health <= 0) {
            member.dead = true;
            killed += 1;
            if (firstKillTick === null) firstKillTick = tick;
            if (killed === packSize) clearTick = tick;
          }
        }
      }
    }
  }

  return {
    weaponId,
    tier: tierId,
    packSize,
    range: 'mid',
    shotsFired,
    projectilesEmitted,
    contacts,
    contactsPerProjectile: projectilesEmitted === 0 ? 0 : Number((contacts / projectilesEmitted).toFixed(4)),
    damageApplied: Number(damageApplied.toFixed(2)),
    overkillDamage: Number(overkillDamage.toFixed(2)),
    overkillRatio: damageApplied === 0 ? 0 : Number((overkillDamage / damageApplied).toFixed(4)),
    killed,
    timeToFirstKillSeconds: firstKillTick === null ? null : Number((firstKillTick / TICKS_PER_SECOND).toFixed(3)),
    clearSeconds: clearTick === null ? null : Number((clearTick / TICKS_PER_SECOND).toFixed(3)),
  };
}

export function runSwarmBenchmark() {
  const rows = [];
  for (const weaponId of WEAPON_IDS) {
    for (const tierId of Object.keys(TIERS)) {
      for (const packSize of SWARM_PACK_SIZES) {
        rows.push(benchmarkSwarmCase(weaponId, tierId, packSize));
      }
    }
  }
  return rows;
}

// --- Package 8.2 output60 ---------------------------------------------------
// The ammo economy question the DPS rows cannot answer: how much damage a gun
// puts out in 60 s from a full clip and a full reserve cap (two cache grants)
// against the 8-body pack, which is replaced by a fresh pack the tick after it
// is cleared. output60 is the damage that landed on living bodies; overkill is
// reported beside it. Reserve, salvage-free reload, cadence and the release's
// rank-3 trickle come from the live weapon step. The package's acceptance:
// every maxed finite gun reaches at least the maxed Pistol's output60.
const OUTPUT60_WINDOW_TICKS = 60 * TICKS_PER_SECOND;
const OUTPUT60_PACK_SIZE = 8;

function benchmarkOutput60Case(weaponId, tierId) {
  const progressionByWeapon = { [weaponId]: TIERS[tierId] };
  const state = createWeaponLoadout({ weaponIds: [...WEAPON_IDS], activeWeaponId: 'coin-blaster', seed: SEED });
  if (weaponId !== 'coin-blaster') {
    // Two grants: a full clip and the full reserve cap (twice the grant).
    grantWeaponPickup(state, { tick: 0, weaponId, select: true, progressionByWeapon });
    grantWeaponPickup(state, { tick: 0, weaponId, select: true, progressionByWeapon });
  }
  const MUZZLE = { x: 28, y: 0, z: 22 };
  let pack = [];
  let packOrdinal = 0;
  const spawnPack = () => {
    pack = [];
    for (let index = 0; index < OUTPUT60_PACK_SIZE; index += 1) {
      const offset = (index - (OUTPUT60_PACK_SIZE - 1) / 2) * SWARM_SPACING;
      pack.push({ id: `pack-${packOrdinal}-${index}`, y: offset, health: SWARM_ENEMY_HEALTH, dead: false });
    }
    packOrdinal += 1;
  };
  spawnPack();
  const aimAtNearest = () => {
    let best = null;
    let bestDistance = Infinity;
    for (const member of pack) {
      if (member.dead) continue;
      const dx = SWARM_DISTANCE - MUZZLE.x;
      const dy = member.y - MUZZLE.y;
      const distance = Math.hypot(dx, dy);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = { x: dx / distance, y: dy / distance };
      }
    }
    return best;
  };

  let shotsFired = 0;
  let projectilesEmitted = 0;
  let contacts = 0;
  let damageApplied = 0;
  let overkillDamage = 0;
  let killed = 0;
  let packsCleared = 0;
  let emptyTicks = 0;
  for (let tick = 1; tick <= OUTPUT60_WINDOW_TICKS; tick += 1) {
    if (pack.every((member) => member.dead)) spawnPack();
    const weapon = state.weapons[weaponId];
    if (weapon.ammoInClip <= 0 && weapon.reloadCompleteTick === null && (weapon.reserveAmmo ?? 1) <= 0) emptyTicks += 1;
    const aim = aimAtNearest();
    const frame = stepWeaponLoadout(state, { tick, fire: true, releaseCharged: RELEASE_CHARGED, direction: aim, progressionByWeapon });
    for (const event of frame.events) {
      if (event.type !== 'weapon:fire') continue;
      shotsFired += 1;
      for (const shot of event.shots) {
        projectilesEmitted += 1;
        const reach = Math.min(shot.range, SWARM_DISTANCE + 120);
        const projectile = createProjectileState({
          id: shot.id,
          ownerId: 'bench',
          previous: { ...MUZZLE },
          current: { x: MUZZLE.x + shot.direction.x * reach, y: MUZZLE.y + shot.direction.y * reach, z: MUZZLE.z },
          radius: shot.radius,
          damage: shot.damage,
          policy: shot.policy,
        });
        const living = pack.filter((member) => !member.dead);
        if (living.length === 0) break;
        const targets = living.map((member) => createHurtTarget({
          id: member.id,
          bodyShape: { type: 'circle', x: 0, y: 0, radius: 16 },
          hurtShape: { type: 'circle', x: 0, y: 0, radius: 16 },
          previousGround: { x: SWARM_DISTANCE, y: member.y, z: 0 },
          currentGround: { x: SWARM_DISTANCE, y: member.y, z: 0 },
          minZ: 0,
          maxZ: 44,
          health: 999999,
        }));
        const resolved = resolveProjectilePath({ projectile, targets });
        for (const hit of resolved.hits) {
          contacts += 1;
          const damage = finiteOrThrow(hit.damage ?? shot.damage, 'output60 hit damage');
          damageApplied += damage;
          const member = pack.find((candidate) => candidate.id === hit.targetId);
          if (!member || member.dead) {
            overkillDamage += damage;
            continue;
          }
          const absorbed = Math.min(member.health, damage);
          overkillDamage += damage - absorbed;
          member.health -= absorbed;
          if (member.health <= 0) {
            member.dead = true;
            killed += 1;
            if (pack.every((candidate) => candidate.dead)) packsCleared += 1;
          }
        }
      }
    }
  }
  return {
    weaponId,
    tier: tierId,
    packSize: OUTPUT60_PACK_SIZE,
    range: 'mid',
    windowSeconds: OUTPUT60_WINDOW_TICKS / TICKS_PER_SECOND,
    shotsFired,
    projectilesEmitted,
    contacts,
    damageApplied: Number(damageApplied.toFixed(2)),
    overkillDamage: Number(overkillDamage.toFixed(2)),
    output60: Number((damageApplied - overkillDamage).toFixed(2)),
    killed,
    packsCleared,
    emptySeconds: Number((emptyTicks / TICKS_PER_SECOND).toFixed(2)),
    reserveRemaining: state.weapons[weaponId].reserveAmmo,
  };
}

export function runOutput60Benchmark() {
  const rows = [];
  for (const weaponId of WEAPON_IDS) {
    for (const tierId of Object.keys(TIERS)) rows.push(benchmarkOutput60Case(weaponId, tierId));
  }
  return rows;
}

// --- Package 8.5 evolved rows (build ledger slice 7) --------------------------
// The wave-1 evolutions against the same gun maxed, both measured the same
// way, crits included (the run's base 8% at x1.75, Crit Candle's +15% under
// the 45% cap, the seeded roll the combat resolver makes):
//   singleTargetDps: 30 s at the static mid-range reference target, expected
//     crit damage per hit;
//   output60: the output60 pack scenario with seeded crits, Crit Candle's
//     first-body carry and crit-kill charge rebate, and Crypto Bomb Orbit's
//     bomblets orbiting each blast point against the pack.
// Tuning targets (package 8.5): an evolved gun's single target at most 1.2x
// the maxed Pistol's; its output60 at least 1.25x the same gun maxed. The
// Settler Rail is the Pistol's sidegrade: 0.80-0.95x the maxed Pistol single
// target and a pack clear at least 30% faster. Hashstorm's vent ring hits
// only bodies within 140 of the hero, so the mid-range pack never sees it.
const EVOLVED_WEAPONS = Object.freeze({
  'coin-blaster': 'settler-rail',
  'scatter-shotgun': 'double-spend',
  'auto-miner': 'hashstorm-overdrive',
  'launcher-rig': 'crypto-bomb-orbit',
  'hash-rail': 'crit-candle',
});
const EVOLVED_CRIT = Object.freeze({ chance: 0.08, multiplier: 1.75, cap: 0.45 });
const evolvedTier = (weaponId, tierId) => ({ branches: TIERS.maxed.branches, ...(tierId === 'evolved' ? { evolutionId: EVOLVED_WEAPONS[weaponId] } : {}) });
const critChanceFor = (progression) => Math.min(EVOLVED_CRIT.cap, EVOLVED_CRIT.chance + (progression.evolutionId === 'crit-candle' ? HMH_EVOLUTION_TUNING['crit-candle'].chanceBonus : 0));

function evolvedSingleTarget(weaponId, tierId) {
  const progressionByWeapon = { [weaponId]: evolvedTier(weaponId, tierId) };
  const progression = applyWeaponProgression(weaponId, progressionByWeapon[weaponId]);
  const expected = 1 + critChanceFor(progression) * (EVOLVED_CRIT.multiplier - 1);
  const state = createWeaponLoadout({ weaponIds: [...WEAPON_IDS], activeWeaponId: 'coin-blaster', seed: SEED });
  if (weaponId !== 'coin-blaster') grantWeaponPickup(state, { tick: 0, weaponId, select: true, progressionByWeapon });
  const distance = RANGES.mid;
  let damage = 0;
  for (let tick = 1; tick <= WINDOW_TICKS; tick += 1) {
    const frame = stepWeaponLoadout(state, { tick, fire: true, releaseCharged: RELEASE_CHARGED, direction: { x: 1, y: 0 }, progressionByWeapon });
    for (const event of frame.events) {
      if (event.type !== 'weapon:fire') continue;
      for (const shot of event.shots) {
        const reach = Math.min(shot.range, distance + 40);
        const resolved = resolveProjectilePath({
          projectile: createProjectileState({ id: shot.id, ownerId: 'bench', previous: { x: 28, y: 0, z: 22 }, current: { x: 28 + shot.direction.x * reach, y: shot.direction.y * reach, z: 22 }, radius: shot.radius, damage: shot.damage, policy: shot.policy }),
          targets: [createHurtTarget({ id: 'bench-target', bodyShape: { type: 'circle', x: 0, y: 0, radius: 16 }, hurtShape: { type: 'circle', x: 0, y: 0, radius: 16 }, previousGround: { x: distance, y: 0, z: 0 }, currentGround: { x: distance, y: 0, z: 0 }, minZ: 0, maxZ: 44, health: 999999 })],
        });
        for (const hit of resolved.hits) damage += (hit.damage ?? shot.damage) * expected;
      }
    }
  }
  return Number((damage / (WINDOW_TICKS / TICKS_PER_SECOND)).toFixed(2));
}

// 'line': the output60 pack, a line across the lane (spread and blasts reach
// it, a lane weapon meets one body a shot). 'column': the same 8 bodies queued
// along the lane 46 apart from 420 out, the arrangement a pierce lane reaches.
const EVOLVED_ARRANGEMENTS = Object.freeze(['line', 'column']);
const memberPoint = (arrangement, member) => (arrangement === 'column' ? { x: SWARM_DISTANCE + member.slot * SWARM_SPACING, y: 0 } : { x: SWARM_DISTANCE, y: member.y });

function evolvedOutput60(weaponId, tierId, arrangement = 'line') {
  const progressionByWeapon = { [weaponId]: evolvedTier(weaponId, tierId) };
  const progression = applyWeaponProgression(weaponId, progressionByWeapon[weaponId]);
  const chance = critChanceFor(progression);
  const candle = progression.evolutionId === 'crit-candle';
  const orbit = progression.evolutionId === 'crypto-bomb-orbit';
  const state = createWeaponLoadout({ weaponIds: [...WEAPON_IDS], activeWeaponId: 'coin-blaster', seed: SEED });
  if (weaponId !== 'coin-blaster') {
    grantWeaponPickup(state, { tick: 0, weaponId, select: true, progressionByWeapon });
    grantWeaponPickup(state, { tick: 0, weaponId, select: true, progressionByWeapon });
  }
  const MUZZLE = { x: 28, y: 0, z: 22 };
  const bomblets = createBombletPool();
  let pack = [];
  let packOrdinal = 0;
  const spawnPack = () => {
    pack = Array.from({ length: OUTPUT60_PACK_SIZE }, (_, index) => ({ id: `pack-${packOrdinal}-${index}`, slot: index, y: (index - (OUTPUT60_PACK_SIZE - 1) / 2) * SWARM_SPACING, health: SWARM_ENEMY_HEALTH, dead: false }));
    packOrdinal += 1;
  };
  spawnPack();
  let landed = 0;
  let killed = 0;
  let packsCleared = 0;
  let critKills = 0;
  let bombletDamage = 0;
  let volleys = 0;
  // Damage onto one pack member; returns true on a kill.
  const land = (member, damage) => {
    if (!member || member.dead) return false;
    const absorbed = Math.min(member.health, damage);
    landed += absorbed;
    member.health -= absorbed;
    if (member.health > 0) return false;
    member.dead = true;
    killed += 1;
    if (pack.every((candidate) => candidate.dead)) packsCleared += 1;
    return true;
  };
  const roll = (hitId, targetId, p) => seededUnit(SEED, `critical:${hitId}:${targetId}`) < p;
  for (let tick = 1; tick <= OUTPUT60_WINDOW_TICKS; tick += 1) {
    if (pack.every((member) => member.dead)) spawnPack();
    const living = () => pack.filter((member) => !member.dead);
    for (const detonation of stepBomblets(bomblets, { tick, targets: living().map((member) => ({ id: member.id, ...memberPoint(arrangement, member), radius: 16 })) }).detonations) {
      for (const hit of detonation.hits) {
        const damage = hit.damage * (roll(hit.id, hit.targetId, chance) ? EVOLVED_CRIT.multiplier : 1);
        const before = landed;
        land(pack.find((member) => member.id === hit.targetId), damage);
        bombletDamage += landed - before;
      }
    }
    const nearest = living().map((member) => memberPoint(arrangement, member)).sort((left, right) => Math.hypot(left.x - MUZZLE.x, left.y) - Math.hypot(right.x - MUZZLE.x, right.y))[0];
    const aim = nearest ? { x: (nearest.x - MUZZLE.x) / Math.hypot(nearest.x - MUZZLE.x, nearest.y), y: nearest.y / Math.hypot(nearest.x - MUZZLE.x, nearest.y) } : { x: 1, y: 0 };
    const frame = stepWeaponLoadout(state, { tick, fire: true, releaseCharged: RELEASE_CHARGED, direction: aim, progressionByWeapon });
    let tickCritKills = 0;
    for (const event of frame.events) {
      if (event.type !== 'weapon:fire') continue;
      if (event.volley) volleys += 1;
      for (const shot of event.shots) {
        const reach = Math.min(shot.range, arrangement === 'column' ? SWARM_DISTANCE + OUTPUT60_PACK_SIZE * SWARM_SPACING + 120 : SWARM_DISTANCE + 120);
        const current = { x: MUZZLE.x + shot.direction.x * reach, y: MUZZLE.y + shot.direction.y * reach, z: MUZZLE.z };
        const targets = living().map((member) => ({ member, point: memberPoint(arrangement, member) })).map(({ member, point }) => createHurtTarget({ id: member.id, bodyShape: { type: 'circle', x: 0, y: 0, radius: 16 }, hurtShape: { type: 'circle', x: 0, y: 0, radius: 16 }, previousGround: { ...point, z: 0 }, currentGround: { ...point, z: 0 }, minZ: 0, maxZ: 44, health: 999999 }));
        if (targets.length === 0) break;
        const resolved = resolveProjectilePath({ projectile: createProjectileState({ id: shot.id, ownerId: 'bench', previous: { ...MUZZLE }, current, radius: shot.radius, damage: shot.damage, policy: shot.policy }), targets });
        let firstCrit = null;
        for (const hit of resolved.hits) {
          const hitId = `${shot.id}:${hit.targetId}`;
          const critical = candle && firstCrit === true ? true : roll(hitId, hit.targetId, chance);
          if (firstCrit === null) firstCrit = critical;
          const killedNow = land(pack.find((member) => member.id === hit.targetId), (hit.damage ?? shot.damage) * (critical ? EVOLVED_CRIT.multiplier : 1));
          if (killedNow && critical) tickCritKills += 1;
        }
        if (orbit) {
          const point = resolved.hits[0]?.point ?? current;
          spawnBomblets(bomblets, { tick, parentId: shot.id, centre: { x: point.x, y: point.y, z: 0 }, parentDamage: shot.damage });
        }
      }
    }
    // Crit kills of tick t shorten the next charge from t+1.
    if (tickCritKills > 0 && candle) {
      critKills += tickCritKills;
      creditCritCandleKills(state, { tick, count: tickCritKills, progressionByWeapon });
    }
  }
  return { output60: Number(landed.toFixed(2)), killed, packsCleared, critKills, volleys, bombletDamage: Number(bombletDamage.toFixed(2)), bombletOverflow: bomblets.overflow };
}

export function runEvolvedBenchmark() {
  const rows = [];
  for (const weaponId of WEAPON_IDS) {
    for (const tierId of ['maxed', 'evolved']) {
      const singleTargetDps = evolvedSingleTarget(weaponId, tierId);
      for (const arrangement of EVOLVED_ARRANGEMENTS) {
        rows.push({ weaponId, tier: tierId, arrangement, evolutionId: tierId === 'evolved' ? EVOLVED_WEAPONS[weaponId] : null, singleTargetDps, ...evolvedOutput60(weaponId, tierId, arrangement) });
      }
    }
  }
  const pistolSingle = rows.find((row) => row.weaponId === 'coin-blaster' && row.tier === 'maxed').singleTargetDps;
  const acceptance = {};
  const ratio = (value, base) => Number((value / Math.max(1e-9, base)).toFixed(3));
  for (const weaponId of WEAPON_IDS) {
    const find = (tier, arrangement) => rows.find((row) => row.weaponId === weaponId && row.tier === tier && row.arrangement === arrangement);
    const evolved = find('evolved', 'line');
    const singleRatio = ratio(evolved.singleTargetDps, pistolSingle);
    const packRatio = Object.fromEntries(EVOLVED_ARRANGEMENTS.map((arrangement) => [arrangement, ratio(find('evolved', arrangement).output60, find('maxed', arrangement).output60)]));
    const clearRatio = Object.fromEntries(EVOLVED_ARRANGEMENTS.map((arrangement) => [arrangement, ratio(find('evolved', arrangement).killed, find('maxed', arrangement).killed)]));
    acceptance[weaponId] = weaponId === 'coin-blaster'
      ? { singleRatio, singleTarget: singleRatio >= 0.8 && singleRatio <= 0.95, clearRatio, packClear: Object.fromEntries(Object.entries(clearRatio).map(([key, value]) => [key, value >= 1.3])) }
      : { singleRatio, singleTarget: evolved.singleTargetDps <= 1.2 * pistolSingle, maxedSingleRatio: ratio(find('maxed', 'line').singleTargetDps, pistolSingle), packRatio, pack: Object.fromEntries(Object.entries(packRatio).map(([key, value]) => [key, value >= 1.25])) };
  }
  return { rows, pistolSingleTargetDps: pistolSingle, acceptance };
}

export function runBenchmark() {
  const rows = [];
  for (const weaponId of WEAPON_IDS) {
    for (const tierId of Object.keys(TIERS)) {
      for (const rangeId of Object.keys(RANGES)) {
        rows.push(benchmarkCase(weaponId, tierId, rangeId));
      }
    }
  }
  return rows;
}

const first = runBenchmark();
const second = runBenchmark();
assert.deepEqual(first, second, 'benchmark drifted across identical same-seed runs');
const movingFirst = runMovingBenchmark();
const movingSecond = runMovingBenchmark();
assert.deepEqual(movingFirst, movingSecond, 'moving benchmark drifted across identical same-seed runs');
const swarmFirst = runSwarmBenchmark();
const swarmSecond = runSwarmBenchmark();
assert.deepEqual(swarmFirst, swarmSecond, 'swarm benchmark drifted across identical same-seed runs');
const output60First = runOutput60Benchmark();
const output60Second = runOutput60Benchmark();
assert.deepEqual(output60First, output60Second, 'output60 benchmark drifted across identical same-seed runs');
const evolvedFirst = runEvolvedBenchmark();
assert.deepEqual(evolvedFirst, runEvolvedBenchmark(), 'evolved benchmark drifted across identical same-seed runs');

const report = {
  schemaVersion: 3,
  pipelineId: 'hmh-weapon-benchmark-v3',
  runtimeAuthority: 'measurement-only',
  seed: SEED,
  windowSeconds: WINDOW_TICKS / TICKS_PER_SECOND,
  targetHealth: TARGET_HEALTH,
  ranges: RANGES,
  strafeSpeeds: STRAFE_SPEEDS,
  reactionLagTicks: REACTION_LAG_TICKS,
  hurtboxPolicyId: ORDINARY_ENEMY_HURTBOX_POLICY.id,
  note: 'Static rows: flight resolved through resolveProjectilePath against a static reference target on flat ground. Moving rows: strafing target carrying the real ordinary-enemy hurtbox profile, tracked with a fixed 10-tick reaction lag. Swarm rows: a line of enemies at fixed spacing across the firing lane, with overkill tracked explicitly. Output60 rows: 60 s from a full clip and a full reserve cap against the 8-body pack, replaced the tick after it is cleared; output60 is the damage that landed on living bodies. Reserve economics, cadence, reload, burst, spread, charge and policies come from the live deterministic modules; the trigger is held and a charged shot releases as soon as it is ready.',
  swarm: {
    packSizes: SWARM_PACK_SIZES,
    enemyHealth: SWARM_ENEMY_HEALTH,
    spacing: SWARM_SPACING,
    distance: SWARM_DISTANCE,
    deterministic: true,
    note: 'A pack is a line across the lane, which is the arrangement spread and blast can exploit and single-target fire cannot. Overkill counts damage landed on an already-dead body: it is how a weapon looks strong on a DPS row while clearing slowly. clearSeconds is null when the pack survived the window, which is a finding rather than a missing value.',
  },
  output60: {
    windowSeconds: OUTPUT60_WINDOW_TICKS / TICKS_PER_SECOND,
    packSize: OUTPUT60_PACK_SIZE,
    acceptance: 'every maxed finite gun reaches at least the maxed Pistol output60 (package 8.2)',
    deterministic: true,
  },
  rows: first,
  movingRows: movingFirst,
  swarmRows: swarmFirst,
  output60Rows: output60First,
  evolved: {
    note: 'Package 8.5 wave-1 evolutions against the same gun maxed, crits included (base 8% x1.75, Crit Candle +15% under the 45% cap, the resolver\'s seeded roll). singleTargetDps: 30 s at the static mid target, expected crit per hit. output60: the output60 pack with seeded crits, Crit Candle\'s first-body carry and charge rebate, and Crypto Bomb Orbit\'s bomblets. Targets: evolved single target <= 1.2x the maxed Pistol; evolved output60 >= 1.25x the same gun maxed; Settler Rail 0.80-0.95x the maxed Pistol single target and 30% more kills in 60 s. Hashstorm\'s vent ring reaches only bodies within 140 of the hero, so the mid-range pack never sees it.',
    pistolSingleTargetDps: evolvedFirst.pistolSingleTargetDps,
    acceptance: evolvedFirst.acceptance,
    deterministic: true,
  },
  evolvedRows: evolvedFirst.rows,
};

const out = fileURLToPath(new URL('../docs/qa/hmh-weapon-benchmark.json', import.meta.url));
await mkdir(fileURLToPath(new URL('../docs/qa/', import.meta.url)), { recursive: true });
await writeFile(out, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ status: 'pass', rows: first.length, movingRows: movingFirst.length, swarmRows: swarmFirst.length, output60Rows: output60First.length, out: 'docs/qa/hmh-weapon-benchmark.json' }));
for (const row of first.filter((entry) => entry.range === 'mid')) {
  console.log(`${row.weaponId} ${row.tier} @mid: dps=${row.sustainedDps} ttk=${row.timeToKillSeconds}s reload=${row.reloadDowntimeSeconds}s empty=${row.emptySeconds}s`);
}
for (const row of movingFirst.filter((entry) => entry.range === 'mid' && entry.tier === 'base')) {
  console.log(`${row.weaponId} base @mid vs ${row.strafe}: movingHitRate=${row.movingHitRate}`);
}
for (const row of swarmFirst.filter((entry) => entry.tier === 'base')) {
  console.log(`${row.weaponId} base swarm x${row.packSize}: killed=${row.killed}/${row.packSize} clear=${row.clearSeconds === null ? 'never' : `${row.clearSeconds}s`} overkill=${row.overkillRatio} contacts/proj=${row.contactsPerProjectile}`);
}
for (const row of evolvedFirst.rows) {
  console.log(`${row.weaponId} ${row.tier}${row.evolutionId ? ` (${row.evolutionId})` : ''} ${row.arrangement}: single=${row.singleTargetDps} output60=${row.output60} kills=${row.killed} critKills=${row.critKills} volleys=${row.volleys} bomblets=${row.bombletDamage}`);
}
console.log(`evolved acceptance: ${JSON.stringify(evolvedFirst.acceptance)}`);
for (const row of output60First) {
  console.log(`${row.weaponId} ${row.tier} output60: ${row.output60} (applied ${row.damageApplied}, overkill ${row.overkillDamage}, packs ${row.packsCleared}, empty ${row.emptySeconds}s, reserve left ${row.reserveRemaining})`);
}
