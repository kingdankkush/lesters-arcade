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

const report = {
  schemaVersion: 1,
  pipelineId: 'hmh-weapon-benchmark-v1',
  runtimeAuthority: 'measurement-only',
  seed: SEED,
  windowSeconds: WINDOW_TICKS / TICKS_PER_SECOND,
  targetHealth: TARGET_HEALTH,
  ranges: RANGES,
  note: 'Flight resolved through resolveProjectilePath against a static reference target on flat ground; moving-target and swarm pressure are future extensions. Reserve economics, cadence, reload, burst, spread and policies come from the live deterministic modules.',
  rows: first,
};

const out = fileURLToPath(new URL('../docs/qa/hmh-weapon-benchmark.json', import.meta.url));
await mkdir(fileURLToPath(new URL('../docs/qa/', import.meta.url)), { recursive: true });
await writeFile(out, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ status: 'pass', rows: first.length, out: 'docs/qa/hmh-weapon-benchmark.json' }));
for (const row of first.filter((entry) => entry.range === 'mid')) {
  console.log(`${row.weaponId} ${row.tier} @mid: dps=${row.sustainedDps} ttk=${row.timeToKillSeconds}s reload=${row.reloadDowntimeSeconds}s empty=${row.emptySeconds}s`);
}
