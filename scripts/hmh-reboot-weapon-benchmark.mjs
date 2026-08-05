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
  HMH_WEAPON_DEFINITIONS,
  applyWeaponProgression,
  createWeaponLoadout,
  grantWeaponPickup,
  stepWeaponLoadout,
} from '../apps/hmh-reboot/src/weapon-system.mjs';
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

const WEAPON_IDS = Object.freeze(['coin-blaster', 'scatter-shotgun', 'auto-miner', 'launcher-rig']);
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
    const frame = stepWeaponLoadout(state, { tick, fire: true, direction: { x: 1, y: 0 }, progressionByWeapon });
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
    const frame = stepWeaponLoadout(state, { tick, fire: true, direction, progressionByWeapon });
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
    const frame = stepWeaponLoadout(state, { tick, fire: true, direction: aim, progressionByWeapon });
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
  note: 'Static rows: flight resolved through resolveProjectilePath against a static reference target on flat ground. Moving rows: strafing target carrying the real ordinary-enemy hurtbox profile, tracked with a fixed 10-tick reaction lag. Swarm rows: a line of enemies at fixed spacing across the firing lane, with overkill tracked explicitly. Reserve economics, cadence, reload, burst, spread and policies come from the live deterministic modules.',
  swarm: {
    packSizes: SWARM_PACK_SIZES,
    enemyHealth: SWARM_ENEMY_HEALTH,
    spacing: SWARM_SPACING,
    distance: SWARM_DISTANCE,
    deterministic: true,
    note: 'A pack is a line across the lane, which is the arrangement spread and blast can exploit and single-target fire cannot. Overkill counts damage landed on an already-dead body: it is how a weapon looks strong on a DPS row while clearing slowly. clearSeconds is null when the pack survived the window, which is a finding rather than a missing value.',
  },
  rows: first,
  movingRows: movingFirst,
  swarmRows: swarmFirst,
};

const out = fileURLToPath(new URL('../docs/qa/hmh-weapon-benchmark.json', import.meta.url));
await mkdir(fileURLToPath(new URL('../docs/qa/', import.meta.url)), { recursive: true });
await writeFile(out, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ status: 'pass', rows: first.length, movingRows: movingFirst.length, swarmRows: swarmFirst.length, out: 'docs/qa/hmh-weapon-benchmark.json' }));
for (const row of first.filter((entry) => entry.range === 'mid')) {
  console.log(`${row.weaponId} ${row.tier} @mid: dps=${row.sustainedDps} ttk=${row.timeToKillSeconds}s reload=${row.reloadDowntimeSeconds}s empty=${row.emptySeconds}s`);
}
for (const row of movingFirst.filter((entry) => entry.range === 'mid' && entry.tier === 'base')) {
  console.log(`${row.weaponId} base @mid vs ${row.strafe}: movingHitRate=${row.movingHitRate}`);
}
for (const row of swarmFirst.filter((entry) => entry.tier === 'base')) {
  console.log(`${row.weaponId} base swarm x${row.packSize}: killed=${row.killed}/${row.packSize} clear=${row.clearSeconds === null ? 'never' : `${row.clearSeconds}s`} overkill=${row.overkillRatio} contacts/proj=${row.contactsPerProjectile}`);
}
