import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENEMY_ARCHETYPES } from '../apps/hmh-reboot/src/enemy-archetypes.mjs';
import { createEnemyPopulation, createEnemyState } from '../apps/hmh-reboot/src/enemy-simulation.mjs';
import { createEncounterDirector, getEncounterBand, selectEncounterArchetype, stepEncounterDirector } from '../apps/hmh-reboot/src/encounter-director.mjs';
import { HMH_OPENING_ENEMY_HEALTH_BY_ARCHETYPE } from '../apps/hmh-reboot/src/opening-balance.mjs';
import { createWeaponLoadout, grantWeaponPickup, stepWeaponLoadout, progressionByWeapon } from '../apps/hmh-reboot/src/weapon-system.mjs';
import { createHurtTarget, createProjectileState, resolveProjectilePath } from '../apps/hmh-reboot/src/projectile-physics.mjs';
import { resolveCombatHits } from '../apps/hmh-reboot/src/combat-events.mjs';
import { createRunProgression, getRunProgressionSnapshot, recordRunDefeat, selectRunUpgrade } from '../apps/hmh-reboot/src/run-progression.mjs';

const SEED = 0x484d4843;
const WEAPONS = ['coin-blaster', 'scatter-shotgun', 'auto-miner', 'launcher-rig'];
const LEGACY_OPENING_HEALTH = { 'bagholder-rusher': 24, forkrunner: 20 };
const POINT = { id: 'bench-spawn', regionId: 'bench-region', districtId: 'mining-camp', x: 900, y: 0 };

function stepDirector(state, population, tick) {
  return stepEncounterDirector({
    state, population, tick, districtId: 'mining-camp',
    player: { x: 0, y: 0, groundZ: 0 },
    camera: { minX: -720, minY: -450, maxX: 720, maxY: 450 },
    spawnPoints: [POINT], queryGround: () => ({ kind: 'ground', groundZ: 0 }),
    isBlocked: () => false, isRouteReachable: () => true,
  });
}

function spawnArchetype(archetypeId, tick) {
  const bandId = getEncounterBand(tick).id;
  const seed = Array.from({ length: 20 }, (_, index) => index).find((candidate) =>
    selectEncounterArchetype({ districtId: 'mining-camp', bandId, seed: candidate, spawnOrdinal: 0 }).archetypeId === archetypeId);
  if (seed === undefined) return null;
  const population = createEnemyPopulation();
  assert.equal(stepDirector(createEncounterDirector({ seed }), population, tick).inserted, true);
  return population.active[0];
}

function applyShot(enemy, shot, tick, weaponId, damageMultiplier = 1) {
  const target = createHurtTarget({
    id: enemy.id, bodyShape: { type: 'circle', x: 0, y: 0, radius: enemy.radius },
    hurtShape: { type: 'circle', x: 0, y: 0, radius: enemy.radius },
    previousGround: { x: 140, y: 0, z: 0 }, currentGround: { x: 140, y: 0, z: 0 },
    minZ: 0, maxZ: 44, health: enemy.health,
  });
  const projectile = createProjectileState({
    id: shot.id, ownerId: 'bench', previous: { x: 28, y: 0, z: 22 },
    current: { x: 28 + shot.direction.x * shot.range, y: shot.direction.y * shot.range, z: 22 },
    radius: shot.radius, damage: shot.damage, policy: shot.policy,
  });
  const path = resolveProjectilePath({ projectile, targets: [target] });
  const result = resolveCombatHits({ sessionSeed: SEED, targets: [enemy], hits: path.hits.map((hit, index) => ({
    id: `${shot.id}:${index}`, targetId: enemy.id, sourceId: 'player', weaponId, tick,
    damage: hit.damage * damageMultiplier, criticalChance: 0, armorPiercing: shot.projectileTag === 'armor-piercing',
  })) });
  enemy.health = result.targets[enemy.id].health;
  enemy.active = enemy.health > 0;
  return result.damageEvents;
}

function targetRow(archetypeId, spawnTick, weaponId, tier, legacy = false) {
  const enemy = spawnArchetype(archetypeId, spawnTick);
  if (!enemy) return null;
  if (legacy) enemy.health = enemy.maxHealth = ENEMY_ARCHETYPES[archetypeId].maxHealth;
  const initialHealth = enemy.health;
  const policy = tier === 'maxed' ? { [weaponId]: { branches: { rateOfFire: 3, damage: 3, reloadSpeed: 3 } } } : {};
  const loadout = createWeaponLoadout({ seed: SEED, weaponIds: WEAPONS });
  if (weaponId !== 'coin-blaster') grantWeaponPickup(loadout, { tick: 0, weaponId, select: true, progressionByWeapon: policy });
  let shots = 0;
  let projectiles = 0;
  let contacts = 0;
  let overkillDamage = 0;
  let clearTick = null;
  let reloadTicks = 0;
  for (let tick = 1; tick <= 1_800 && enemy.health > 0; tick += 1) {
    if (loadout.weapons[weaponId].reloadCompleteTick !== null) reloadTicks += 1;
    const frame = stepWeaponLoadout(loadout, { tick, fire: true, direction: { x: 1, y: 0 }, progressionByWeapon: policy });
    if (loadout.activeWeaponId !== weaponId) break;
    for (const event of frame.events.filter((entry) => entry.type === 'weapon:fire')) {
      shots += 1;
      projectiles += event.shots.length;
      for (const shot of event.shots) {
        if (enemy.health <= 0) break;
        const damage = applyShot(enemy, shot, tick, weaponId);
        contacts += damage.length;
        for (const hit of damage) overkillDamage += Math.max(0, hit.damageApplied - hit.healthBefore);
      }
      if (enemy.health <= 0) clearTick = tick;
    }
  }
  return { archetypeId, spawnTick, spawnMinute: spawnTick / 3_600, health: initialHealth, armor: enemy.armor, weaponId, tier,
    shots, projectiles, contacts, overkillDamage, killSeconds: clearTick === null ? null : Number((clearTick / 60).toFixed(3)), reloadSeconds: Number((reloadTicks / 60).toFixed(3)) };
}

function firstMinuteProgression(legacy = false) {
  const population = createEnemyPopulation();
  for (const archetypeId of Object.keys(HMH_OPENING_ENEMY_HEALTH_BY_ARCHETYPE)) {
    const enemy = createEnemyState({ archetypeId, id: `initial-${archetypeId}`, x: 140, y: 0 });
    enemy.health = enemy.maxHealth = (legacy ? LEGACY_OPENING_HEALTH : HMH_OPENING_ENEMY_HEALTH_BY_ARCHETYPE)[archetypeId];
    population.active.push(enemy);
    population.activeThreat += ENEMY_ARCHETYPES[archetypeId].costs.threat;
    population.seenIds.add(enemy.id);
  }
  const director = createEncounterDirector({ nextSpawnTick: 600, seed: SEED });
  const progression = createRunProgression({ seed: SEED });
  const loadout = createWeaponLoadout({ seed: SEED });
  let firstUpgradeTick = null;
  let kills = 0;
  let shots = 0;
  const selections = [];
  for (let tick = 1; tick < 3_600; tick += 1) {
    const spawn = stepDirector(director, population, tick);
    if (spawn.inserted && legacy) {
      const enemy = population.active.find((entry) => entry.id === spawn.enemyId);
      enemy.health = enemy.maxHealth = ENEMY_ARCHETYPES[enemy.archetypeId].maxHealth;
    }
    const enemy = population.active.find((entry) => entry.health > 0);
    const effects = getRunProgressionSnapshot(progression).effects;
    const frame = stepWeaponLoadout(loadout, { tick, fire: Boolean(enemy), direction: { x: 1, y: 0 }, progressionByWeapon: progressionByWeapon(progression.ranks) });
    for (const event of frame.events.filter((entry) => entry.type === 'weapon:fire')) {
      shots += 1;
      for (const shot of event.shots) if (enemy.health > 0) applyShot(enemy, shot, tick, 'coin-blaster', effects.outgoingDamageMultiplier);
      if (enemy.health <= 0) {
        kills += 1;
        recordRunDefeat(progression, { enemyId: enemy.id, threatCost: ENEMY_ARCHETYPES[enemy.archetypeId].costs.threat, tick });
        population.active.splice(population.active.indexOf(enemy), 1);
        population.activeThreat -= ENEMY_ARCHETYPES[enemy.archetypeId].costs.threat;
        let snapshot = getRunProgressionSnapshot(progression);
        while (snapshot.pendingLevels > 0) {
          firstUpgradeTick ??= tick;
          const choice = snapshot.pendingChoices.find((entry) => entry.id === 'proof-of-work') ?? snapshot.pendingChoices[0];
          selections.push({ tick, upgradeId: choice.id });
          snapshot = selectRunUpgrade(progression, choice.id).snapshot;
        }
      }
    }
  }
  const snapshot = getRunProgressionSnapshot(progression);
  return { kills, shots, firstUpgradeSeconds: firstUpgradeTick === null ? null : Number((firstUpgradeTick / 60).toFixed(3)),
    level: snapshot.level, xp: snapshot.xp, livingEnemies: population.active.length, selections };
}

export function runOpeningCombatBenchmark() {
  const rows = [];
  for (const tick of [0, 3_600, 7_200, 18_000, 36_000, 72_000]) {
    for (const archetypeId of Object.keys(ENEMY_ARCHETYPES)) {
      for (const weaponId of WEAPONS) for (const tier of ['base', 'maxed']) {
        const row = targetRow(archetypeId, tick, weaponId, tier);
        if (row) rows.push(row);
      }
    }
  }
  return {
    schema: 'hmh-opening-combat-benchmark-v1', seed: SEED, fixedHz: 60,
    method: 'Real director insertion, weapon cadence/reloads/reserves, projectile contact and armored damage resolution. Targets stand at x=140 with the muzzle at x=28 on flat ground. Critical hits, pickups, movement, incoming damage and combo XP are excluded. Shot paths resolve full travel immediately, so timing excludes flight and player reaction. These are controlled lower bounds, not human playtest certification.',
    progressionMethod: 'First minute uses the actual two opening enemies, ten-second director delay, ordinary spawn cadence, XP thresholds and offered upgrades. All targets stand in a clear firing lane; upgrades are chosen instantly, preferring offered pistol damage. Baseline reuses the same runtime with former 24/20 opening HP and full director HP.',
    previousHealthPolicy: { opening: LEGACY_OPENING_HEALTH, director: 'unscaled archetype maxHealth' },
    previousOpeningDirector: ['bagholder-rusher', 'forkrunner'].map((id) => targetRow(id, 600, 'coin-blaster', 'base', true)),
    firstMinute: { previous: firstMinuteProgression(true), current: firstMinuteProgression() }, rows,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const first = runOpeningCombatBenchmark();
  assert.deepEqual(runOpeningCombatBenchmark(), first, 'opening benchmark drifted for the same seed');
  const output = resolve(process.argv[2] ?? 'docs/qa/hmh-opening-balance-20260911.json');
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify({ ...first, deterministic: true }, null, 2)}\n`);
  console.log(JSON.stringify({ output, rows: first.rows.length, firstMinute: first.firstMinute, deterministic: true }));
}
