// Slice HMH-TEN-AREA-GAMEPLAY-WIRING: the district bosses, the six 2.0 enemies
// and cover + traversal, live in the unofficial ten-area Free world only.
// The legacy Ranked world's selection and simulation paths are pinned here
// (and by the real-child corpus comparison recorded in the slice document).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  DISTRICT_ROLE_GATES,
  ENCOUNTER_BANDS,
  createEncounterDirector,
  directorViewBounds,
  selectEncounterArchetype,
  stepEncounterDirector,
} from '../apps/hmh-reboot/src/encounter-director.mjs';
import { ENEMY_ARCHETYPE_IDS, findEnemyArchetype, getEnemyArchetype } from '../apps/hmh-reboot/src/enemy-archetypes.mjs';
import { NEW_ENEMY_ARCHETYPES, NEW_ENEMY_ARCHETYPE_IDS } from '../apps/hmh-reboot/src/enemy-archetypes-2.mjs';
import { attemptScheduledEnemyInsertion, createEnemyPopulation, stepEnemyPopulation } from '../apps/hmh-reboot/src/enemy-simulation.mjs';
import { resolveEnemyAttackAgainstPlayer, stepEnemyAttacks } from '../apps/hmh-reboot/src/enemy-combat.mjs';
import { createWorldV2GroundQuery, createWorldV2RuntimeWorld, isWorldV2PointClear } from '../apps/hmh-reboot/src/world-v2-runtime-world.mjs';
import { traceHeightAwareLineOfSight } from '../apps/hmh-reboot/src/elevation.mjs';
import { createWorldV2Gameplay } from '../apps/hmh-reboot/src/world-v2-gameplay.mjs';
import {
  DISTRICT_BOSS_LOOK,
  WORLD_V2_DISTRICT_ARCHETYPES,
  activeWorldV2Boss,
  createWorldV2Combat,
  heroClipForPose,
} from '../apps/hmh-reboot/src/world-v2-combat.mjs';
import { ACTOR3D_BOSS_CLIPS, ACTOR3D_BOSS_IDS, createDistrictBoss3dEntries } from '../apps/hmh-reboot/src/actor-3d-controller.mjs';
import { districtBoss3dPose } from '../apps/hmh-reboot/src/world-v2-combat.mjs';
import { DISTRICT_BOSS_KITS, createBossSlots, defeatBossSlot, stepBossSlots } from '../apps/hmh-reboot/src/boss-slots.mjs';
import { createBossDrops, dropGenesisSeal } from '../apps/hmh-reboot/src/boss-drops.mjs';
import { pastCourtThreshold } from '../apps/hmh-reboot/src/boss-courts-world-v1.mjs';
import { HMH_V7_BOSSES } from '../sdk/hmh-run-contract-v7.mjs';

const world = createWorldV2RuntimeWorld();
const queryGround = createWorldV2GroundQuery(world);
const gameplay = createWorldV2Gameplay(world);
const combat = createWorldV2Combat({ world, gameplay, queryGround });
const source = (path) => readFileSync(new URL(`../apps/hmh-reboot/src/${path}`, import.meta.url), 'utf8');

test('legacy encounter selection is byte-identical: the pinned digest over every legacy district, band, seed and 240 ordinals', () => {
  const rows = [];
  for (const districtId of Object.keys(DISTRICT_ROLE_GATES)) for (const band of ENCOUNTER_BANDS) for (const seed of [0, 1, 7, 1337, 99999]) for (const leanRole of [null, 'suppressor']) for (let o = 0; o < 240; o += 1) {
    const s = selectEncounterArchetype({ districtId, bandId: band.id, spawnOrdinal: o, seed, leanRole });
    rows.push(`${districtId}|${band.id}|${seed}|${leanRole}|${o}|${s.archetypeId}|${s.requestedRole}|${s.roleApplied}|${s.fallbackReason}`);
  }
  // Computed on the integration base before this slice (7d26c1880 + the boss
  // commit), with the 2.0 archetypes registered in this process.
  assert.equal(rows.length, 86_400);
  assert.equal(createHash('sha256').update(rows.join('\n')).digest('hex'), 'e08fd02af999dbf931291d28582709435256dfc9c70c890b0dfdf68280d2004f');
  assert.ok(rows.every((row) => ENEMY_ARCHETYPE_IDS.includes(row.split('|')[5])));
});

test('the legacy archetype table stays the historical six; registered 2.0 ids resolve only through the lookup', () => {
  assert.deepEqual([...ENEMY_ARCHETYPE_IDS], ['bagholder-rusher', 'forkrunner', 'liquidator-agent', 'whale-enforcer', 'gas-bomber', 'validator-cultist']);
  for (const id of NEW_ENEMY_ARCHETYPE_IDS) {
    const runtime = getEnemyArchetype(id);
    assert.equal(findEnemyArchetype(id), runtime);
    // Stats verbatim from the 2.0 table; only the insertion gate counts the
    // temporary sprite presentation as runtime-complete.
    for (const key of ['role', 'radius', 'speed', 'maxHealth', 'armor', 'balanceSource']) assert.deepEqual(runtime[key], NEW_ENEMY_ARCHETYPES[id][key], `${id}.${key}`);
    assert.deepEqual(runtime.attack, NEW_ENEMY_ARCHETYPES[id].attack);
    assert.equal(runtime.visual.productionComplete, true);
    assert.equal(NEW_ENEMY_ARCHETYPES[id].visual.productionComplete, false);
  }
  assert.equal(findEnemyArchetype('not-an-enemy'), undefined);
  assert.throws(() => getEnemyArchetype('not-an-enemy'), /Unknown enemy archetype/);
  // The shipped entry still never imports the 2.0 table or this slice.
  for (const file of ['main.mjs', 'encounter-director.mjs', 'enemy-simulation.mjs', 'enemy-archetypes.mjs', 'world-context.mjs']) {
    assert.doesNotMatch(source(file), /enemy-archetypes-2|world-v2-combat/, file);
  }
});

test('ten-area spawn selection places each 2.0 enemy in its areas by tier and band, and nowhere else', () => {
  const found = new Map();
  for (const districtId of Object.keys(gameplay.roleGates)) {
    const seen = new Set();
    for (const band of ENCOUNTER_BANDS) for (const seed of [0, 3, 1337]) for (let o = 0; o < 240; o += 1) {
      const s = selectEncounterArchetype({ districtId, bandId: band.id, spawnOrdinal: o, seed, roleGates: gameplay.roleGates, districtArchetypes: gameplay.districtArchetypes });
      const archetype = getEnemyArchetype(s.archetypeId);
      // The pick obeys the band's role gate exactly like a legacy pick.
      if (s.fallbackReason === null) assert.ok(band.allowedRoles.includes(archetype.role) || !gameplay.roleGates[districtId].some((role) => band.allowedRoles.includes(role)), `${districtId} ${band.id}`);
      seen.add(s.archetypeId);
      if (NEW_ENEMY_ARCHETYPE_IDS.includes(s.archetypeId) && !found.has(`${s.archetypeId}@${districtId}`)) found.set(`${s.archetypeId}@${districtId}`, band.id);
    }
    const newHere = [...seen].filter((id) => NEW_ENEMY_ARCHETYPE_IDS.includes(id)).sort();
    const expected = [...new Set(Object.values(WORLD_V2_DISTRICT_ARCHETYPES[districtId] ?? {}).flat())].filter((id) => NEW_ENEMY_ARCHETYPE_IDS.includes(id)).sort();
    assert.deepEqual(newHere, expected, districtId);
  }
  // Every 2.0 enemy appears somewhere, in its role's band.
  assert.deepEqual([...new Set([...found.keys()].map((key) => key.split('@')[0]))].sort(), [...NEW_ENEMY_ARCHETYPE_IDS].sort());
  assert.equal(found.get('rug-puller@litecoin-city'), 'opening');
  assert.equal(found.get('rug-puller@rugpull-woods'), 'opening');
  assert.equal(found.get('hodl-revenant@hollow-pines'), 'opening');
  assert.equal(found.get('oracle-marksman@ledger-ridge'), 'build');
  assert.equal(found.get('money-printer@litecoin-city'), 'pressure');
  assert.equal(found.get('pump-and-dump-bloater@halving-farms'), 'pressure');
  assert.equal(found.get('pump-and-dump-bloater@scrypt-bayou'), 'pressure');
  assert.equal(found.get('tollkeeper@hashwood-river'), 'pressure');
  assert.equal(found.get('tollkeeper@fork-fortress'), 'pressure');
  // The Meadows (tier 1) and the Coast keep the legacy roster.
  assert.equal(WORLD_V2_DISTRICT_ARCHETYPES['mweb-meadows'], undefined);
  assert.equal(WORLD_V2_DISTRICT_ARCHETYPES['silver-coast'], undefined);
});

test('the director inserts a 2.0 enemy through the shared insertion, movement and attack paths', () => {
  const population = createEnemyPopulation({ capacity: 192 });
  const state = createEncounterDirector({ nextSpawnTick: 0, seed: 3 });
  const district = world.districts.find((row) => row.id === 'hollow-pines');
  const spawnPoints = world.spawnPoints.filter((point) => point.districtId === district.id);
  const player = { x: district.center.x, y: district.center.y, groundZ: queryGround(district.center.x, district.center.y).groundZ };
  let inserted = null;
  for (let tick = 0; tick < 4_000 && !inserted; tick += 1) {
    const step = stepEncounterDirector({
      state, population, tick, districtId: district.id, player, camera: directorViewBounds(player), spawnPoints,
      queryGround, isBlocked: () => false, isRouteReachable: () => true,
      roleGates: gameplay.roleGates, districtArchetypes: gameplay.districtArchetypes,
    });
    if (step.inserted && step.archetypeId === 'hodl-revenant') inserted = step;
  }
  assert.ok(inserted, 'a HODL Revenant spawned in Hollow Pines');
  const revenant = population.active.find((enemy) => enemy.id === inserted.enemyId);
  assert.equal(revenant.archetypeId, 'hodl-revenant');
  // Stats are the declared balance source's (bagholder-rusher).
  assert.equal(revenant.radius, getEnemyArchetype('bagholder-rusher').radius);

  // A Tollkeeper (bruiser, whale-enforcer balance) walks and strikes like one.
  const tollPopulation = createEnemyPopulation({ capacity: 8 });
  const insert = attemptScheduledEnemyInsertion({
    population: tollPopulation, schedule: { nextSpawnTick: 0, intervalTicks: 1, burstRemaining: 1 },
    candidate: { archetypeId: 'tollkeeper', id: 'toll-1', x: 0, y: 0, groundZ: 0 }, tick: 0, placementAllowed: true, visualMode: 'normal', threatRemaining: null,
  });
  assert.equal(insert.inserted, true);
  const toll = tollPopulation.active[0];
  const hero = { id: 'player', x: 60, y: 0, groundZ: 0, radius: 24 };
  let strike = null;
  for (let tick = 1; tick < 400 && !strike; tick += 1) {
    stepEnemyPopulation({ population: tollPopulation, player: hero, tick, dtSeconds: 1 / 60, blockers: [], bounds: { minX: -2000, minY: -2000, maxX: 2000, maxY: 2000, visibleBoundaryId: 'test-floor' }, queryGround: () => ({ groundZ: 0, walkable: true, kind: 'ground' }), preservePrevious: true });
    const attacks = stepEnemyAttacks({ enemies: tollPopulation.active, player: hero, tick, budgets: { melee: 3, ranged: 2, area: 1, support: 1 } });
    strike = attacks.events[0] ?? null;
  }
  assert.ok(strike, 'the Tollkeeper struck');
  assert.equal(strike.archetypeId, 'tollkeeper');
  assert.equal(strike.geometry.type, 'shove-lane');
  assert.equal(strike.damage, getEnemyArchetype('whale-enforcer').attack.damage);
  assert.equal(resolveEnemyAttackAgainstPlayer(strike, { player: { ...strike.target, groundZ: 0, radius: 24 } }).hit, true);
  assert.ok(toll.archetypeId === 'tollkeeper');
});

test('sprite fallback and 3D ids: each 2.0 enemy borrows its declared legacy sprite with its own tint', () => {
  for (const id of NEW_ENEMY_ARCHETYPE_IDS) {
    const fallback = combat.spriteFallback(id);
    assert.equal(fallback.sourceActorId, NEW_ENEMY_ARCHETYPES[id].spriteFallback.sourceActorId);
    assert.ok(ENEMY_ARCHETYPE_IDS.includes(fallback.sourceActorId));
    assert.equal(fallback.tint, NEW_ENEMY_ARCHETYPES[id].spriteFallback.tint);
    assert.equal(combat.archetypes[id], getEnemyArchetype(id));
  }
  for (const id of ENEMY_ARCHETYPE_IDS) assert.equal(combat.spriteFallback(id), null);
  assert.match(source('actor-3d-controller.mjs'), /'rug-puller', 'oracle-marksman'/);
});

// --- District bosses ----------------------------------------------------------

const DISTRICT_BOSSES = ['rug-pull-baron', 'lockkeeper', 'fifty-one-percent-foreman'];
const DISTRICT_PHASES = { 'rug-pull-baron': ['the-rug-pull', 'curtain-call'], lockkeeper: ['lock-down', 'drained'], 'fifty-one-percent-foreman': ['overtime', 'majority-rule'] };
const failingLiquidatorApi = new Proxy({ defeatBossSlot, dropGenesisSeal }, { get: (target, name) => target[name] ?? (() => { throw new Error(`liquidator ${String(name)} called for a district boss`); }) });

function fightDistrictBoss(bossId, seed = 2026) {
  const api = combat.bossDispatch(failingLiquidatorApi);
  const slots = createBossSlots({ seed, definitions: gameplay.bossDefinitions });
  const court = gameplay.districtCourts[bossId];
  const readyTick = HMH_V7_BOSSES[bossId].readyTick;
  const outside = { x: court.bounds.minX - 400, y: court.centre.y, groundZ: 0, radius: 24 };
  const atThreshold = { x: court.threshold.x, y: court.threshold.y, groundZ: 0, radius: 24 };
  const log = [];
  // Before the ready tick the threshold does nothing.
  assert.equal(stepBossSlots(slots, { tick: readyTick - 1, player: atThreshold, level: 12 }).events.length, 0);
  assert.equal(slots.slots[bossId].status, 'dormant');
  const start = stepBossSlots(slots, { tick: readyTick, player: atThreshold, level: 12 });
  assert.deepEqual(start.events.map((event) => event.type), ['boss-initiated', ...start.events.slice(1).map((event) => event.type)]);
  assert.equal(start.events[0].bossId, bossId);
  assert.equal(combat.bossText(start.events[0]), `${gameplay.bossDefinitions[bossId].name} takes the court. The exits lock behind you.`);
  const boss = activeWorldV2Boss(slots);
  assert.equal(boss.bossId, bossId);
  assert.equal(api.isLiquidatorTargetable(boss, readyTick), false, 'untargetable intro');
  const hero = { x: court.centre.x, y: court.centre.y + 200, groundZ: 0, vx: 0, vy: 0 };
  let tick = readyTick;
  const phases = [];
  let staggered = false;
  let tells = 0;
  let resolved = 0;
  let defeated = null;
  let lastAttack = null;
  const clips = new Set();
  while (tick < readyTick + 40_000 && !defeated) {
    tick += 1;
    stepBossSlots(slots, { tick, player: { ...hero, radius: 24 }, level: 12 });
    const report = api.stepLiquidatorBoss({ boss, tick, player: hero, blockers: [], addsAlive: 0 });
    const resolvedNow = report.events.find((event) => event.type === 'attack');
    if (resolvedNow) lastAttack = { attackId: resolvedNow.attackId, tick };
    clips.add(districtBoss3dPose(DISTRICT_BOSS_KITS[bossId], { boss, player: hero, tick, lastAttack, hitUntil: -1, deathUntil: -1 }).state);
    for (const event of report.events) {
      if (event.type === 'tell') tells += 1;
      if (event.type === 'attack') resolved += 1;
      if (event.type === 'stagger') staggered = true;
      log.push(`${tick}:${event.type}:${event.attackId ?? event.phaseId ?? ''}`);
    }
    if (api.isLiquidatorTargetable(boss, tick) && tick % 30 === 0) {
      const damage = api.applyLiquidatorDamage({ boss, amount: 40, tick, roleMultiplier: 1 });
      if (damage.phaseCrossed) phases.push(damage.phaseCrossed);
      if (damage.runEvent) defeated = damage;
    }
  }
  return { slots, boss, court, defeated, phases, staggered, tells, resolved, tick, log, api, clips };
}

for (const bossId of DISTRICT_BOSSES) {
  test(`${bossId}: court after the ready tick -> spawn -> damage -> phases -> death -> seal -> court unlock`, () => {
    const fight = fightDistrictBoss(bossId);
    const { slots, boss, court, defeated, phases } = fight;
    assert.ok(defeated, 'the boss died');
    assert.equal(defeated.runEvent.name, 'boss-defeated');
    assert.equal(defeated.runEvent.data.bossId, gameplay.bossDefinitions[bossId].targetId);
    assert.deepEqual(phases, gameplay.bossDefinitions[bossId] && DISTRICT_PHASES[bossId]);
    assert.equal(phases.length, 2, 'both v7 thresholds crossed');
    assert.ok(fight.tells > 0 && fight.resolved > 0, 'tells were issued and resolved');
    // The 3D pose walks the GLB's clip set: tells, the super's tell, strikes.
    for (const clip of fight.clips) assert.ok(ACTOR3D_BOSS_CLIPS.includes(clip), clip);
    for (const clip of ['idle', 'tell', 'super-tell']) assert.ok(fight.clips.has(clip), `${bossId} ${clip}`);
    assert.ok(fight.clips.has('attack') || fight.clips.has('attack-2'), `${bossId} strikes`);
    // The court sealed during the fight.
    assert.equal(slots.slots[bossId].locked, true);
    assert.deepEqual([...slots.slots[bossId].closedWalls].sort(), court.walls.map((wall) => wall.id).sort());
    assert.deepEqual(combat.closedBossWalls(slots).sort(), court.walls.map((wall) => wall.id).sort());
    // Death: rewards, the court opens, the Seal drops on the court pedestal.
    // Exactly main.mjs's defeat call, which names the Liquidator; the dispatch
    // settles the live slot instead.
    const rewards = fight.api.defeatBossSlot(slots, { bossId: 'liquidator', tick: fight.tick });
    assert.equal(rewards.bossId, bossId);
    assert.deepEqual([...rewards.opened].sort(), court.walls.map((wall) => wall.id).sort());
    assert.equal(rewards.unlockObjective, `${bossId}-defeated`);
    assert.equal(slots.slots[bossId].status, 'defeated');
    assert.deepEqual(combat.closedBossWalls(slots), []);
    const drops = createBossDrops();
    const seal = fight.api.dropGenesisSeal(drops, { bossId: 'liquidator', tick: fight.tick, arenaId: slots.slots.liquidator.arena?.id ?? 'margin-floor' });
    assert.equal(seal.bossId, bossId);
    assert.deepEqual({ x: seal.x, y: seal.y }, { x: court.pedestal.x, y: court.pedestal.y });
    assert.equal(fight.api.dropGenesisSeal(drops, { bossId, tick: fight.tick + 1, arenaId: court.id }), null, 'one Seal per boss');
    assert.equal(combat.bossText({ type: 'boss-defeated', bossId }), `${gameplay.bossDefinitions[bossId].name} is defeated. The court opens and a Genesis Seal drops.`);
    // The defeated boss stays the presented one for its death beat.
    assert.equal(activeWorldV2Boss(slots), boss);
    assert.equal(fight.api.liquidatorPose({ boss, player: { x: 0, y: 0 }, tick: fight.tick, lastAttack: null, hitUntil: -1, deathUntil: fight.tick + 45 }).state, 'death');
  });
}

test('district fights are seed-deterministic and the presentation look is per boss', () => {
  for (const bossId of DISTRICT_BOSSES) {
    const a = fightDistrictBoss(bossId, 77);
    const b = fightDistrictBoss(bossId, 77);
    assert.deepEqual(a.log, b.log, bossId);
    assert.equal(a.tick, b.tick);
    const frame = { x: a.boss.x, y: a.boss.y, visible: true, alpha: 1, bodyHeight: 84, originals: [], player: { x: 0, y: 0 }, tick: a.tick, lastAttack: null, hitUntil: -1, deathUntil: a.tick + 45 };
    const [row] = combat.districtBoss3d(a.boss, frame);
    assert.equal(row.actorId, DISTRICT_BOSS_LOOK[bossId].actorId);
    assert.equal(row.pose.state, 'death', 'a defeated boss plays its death clip');
    const [entry] = createDistrictBoss3dEntries([row]);
    assert.equal(entry.descriptor.actorId, DISTRICT_BOSS_LOOK[bossId].actorId);
    assert.ok(ACTOR3D_BOSS_IDS.includes(row.actorId));
    const display = { tint: 0, scale: { x: 2, set(value) { this.x = value; } } };
    combat.styleBoss(display, a.boss);
    assert.equal(display.tint, DISTRICT_BOSS_LOOK[bossId].tint);
    assert.equal(display.scale.x, 2 * DISTRICT_BOSS_LOOK[bossId].scale);
  }
  assert.equal(combat.districtBoss3d({ bossId: 'liquidator' }, {}), null);
});

test('the dispatch hands the Liquidator to the original functions with the original arguments', () => {
  const calls = [];
  const api = combat.bossDispatch(Object.fromEntries(['stepLiquidatorBoss', 'applyLiquidatorDamage', 'isLiquidatorTargetable', 'getLiquidatorVulnerability', 'liquidatorPose', 'dropGenesisSeal']
    .map((name) => [name, (...args) => { calls.push([name, args]); return name; }])));
  const liquidator = { bossId: 'liquidator' };
  const options = { boss: liquidator, tick: 5 };
  assert.equal(api.stepLiquidatorBoss(options), 'stepLiquidatorBoss');
  assert.equal(api.applyLiquidatorDamage(options), 'applyLiquidatorDamage');
  assert.equal(api.isLiquidatorTargetable(liquidator, 5), 'isLiquidatorTargetable');
  assert.equal(api.getLiquidatorVulnerability(liquidator, 5), 'getLiquidatorVulnerability');
  assert.equal(api.liquidatorPose(options), 'liquidatorPose');
  assert.equal(api.isLiquidatorTargetable(null, 5), 'isLiquidatorTargetable');
  assert.deepEqual(calls.map(([name, args]) => [name, args[0]]), [
    ['stepLiquidatorBoss', options], ['applyLiquidatorDamage', options], ['isLiquidatorTargetable', liquidator],
    ['getLiquidatorVulnerability', liquidator], ['liquidatorPose', options], ['isLiquidatorTargetable', null],
  ]);
  // His ten-area floor has no legacy pedestal; his Seal lands on its centre.
  const seal = api.dropGenesisSeal(createBossDrops(), { bossId: 'liquidator', tick: 9, arenaId: gameplay.liquidatorFloor.id });
  assert.deepEqual({ x: seal.x, y: seal.y }, gameplay.liquidatorFloor.centre);
});

test('only one boss lives at a time: a second court refuses while the first fight runs', () => {
  const slots = createBossSlots({ seed: 1, definitions: gameplay.bossDefinitions });
  const baron = gameplay.districtCourts['rug-pull-baron'];
  const lock = gameplay.districtCourts.lockkeeper;
  stepBossSlots(slots, { tick: 20_000, player: { x: baron.threshold.x, y: baron.threshold.y, radius: 24 } });
  assert.equal(slots.slots['rug-pull-baron'].status, 'live');
  assert.ok(pastCourtThreshold(lock, lock.threshold));
  stepBossSlots(slots, { tick: 20_001, player: { x: lock.threshold.x, y: lock.threshold.y, radius: 24 } });
  assert.equal(slots.slots.lockkeeper.status, 'dormant');
});

// --- Cover + traversal --------------------------------------------------------

test('cover faces come from the ten-area cover-tall / cover-short blockers; markers from the greybox', () => {
  const coverBlockers = world.collisionBlockers.filter((blocker) => blocker.coverKind === 'tall' || blocker.coverKind === 'short');
  const authoredCover = coverBlockers.filter((blocker) => !blocker.id.startsWith('prop-'));
  assert.equal(authoredCover.length, 31);
  assert.equal(combat.coverFaces.filter((face) => authoredCover.some((blocker) => blocker.id === face.blockerId)).length, 124);
  // 2.1 collision-art: the vehicles, containers and hard barriers the area
  // plans draw stand on prop colliders (dev/greybox-prop-blockers.mjs), and
  // those are cover too.
  assert.equal(coverBlockers.length - authoredCover.length, 113);
  assert.equal(combat.coverFaces.length, 434);
  assert.ok(combat.coverFaces.every((face) => coverBlockers.some((blocker) => blocker.id === face.blockerId)));
  assert.deepEqual([...new Set(combat.coverFaces.map((face) => face.kind))].sort(), ['short', 'tall']);
  const markers = combat.traversalMarkers;
  assert.ok(markers.length >= 6, `derived ${markers.length} markers`);
  assert.equal(markers.length + combat.rejectedTraversalMarkers.length, 20);
  for (const marker of markers) {
    const kind = marker.id.includes('climb') ? 'climb' : 'drop';
    assert.equal(marker.kind, kind, marker.id);
    if (kind === 'climb') assert.ok(marker.toZ - marker.fromZ >= 24, marker.id);
    else assert.ok(marker.fromZ - marker.toZ >= 24, marker.id);
    const centre = { x: (marker.zone.minX + marker.zone.maxX) / 2, y: (marker.zone.minY + marker.zone.maxY) / 2 };
    assert.ok(Math.abs(queryGround(centre.x, centre.y).groundZ - marker.fromZ) <= 8, `${marker.id} zone on fromZ`);
    const landing = { x: centre.x + marker.direction.x * marker.travel, y: centre.y + marker.direction.y * marker.travel };
    assert.ok(Math.abs(queryGround(landing.x, landing.y).groundZ - marker.toZ) <= 0.5, `${marker.id} lands on toZ`);
    assert.ok(isWorldV2PointClear(world, queryGround, landing), `${marker.id} landing clear`);
  }
});

function coverSetup() {
  const face = combat.coverFaces.find((row) => row.kind === 'tall' && row.length >= 160);
  const mid = { x: face.a.x + face.tangent.x * face.length / 2, y: face.a.y + face.tangent.y * face.length / 2 };
  const player = { x: mid.x + face.normal.x * 40, y: mid.y + face.normal.y * 40, groundZ: 0, radius: 24 };
  return { face, player, push: { x: -face.normal.x, y: -face.normal.y } };
}

test('cover enter, peek, leave and damage reduction through the run step', () => {
  const { face, player, push } = coverSetup();
  const run = combat.createRun();
  let tick = 0;
  let step = null;
  for (let index = 0; index < 6; index += 1) step = run.step({ tick: ++tick, player, move: push });
  assert.equal(step.inCover, true, 'six pushing ticks enter cover');
  assert.equal(step.cover.event, 'enter');
  assert.equal(step.locomotion, 'cover');
  assert.equal(run.heroClip(tick).clip, 'cover-enter-tall');
  const at = step.position;
  // From the covered side, damage is cut to 40%; from behind it is whole.
  const front = { x: at.x - face.normal.x * 300, y: at.y - face.normal.y * 300, z: 0 };
  const behind = { x: at.x + face.normal.x * 300, y: at.y + face.normal.y * 300, z: 0 };
  assert.equal(run.coverDamage(front, 10), 4);
  assert.equal(run.coverDamage(behind, 10), 10);
  // Blind fire mid-face (a tall face longer than two peek reaches).
  step = run.step({ tick: ++tick, player: { ...player, ...at }, move: { x: 0, y: 0 }, fire: true });
  assert.equal(step.cover.pose, face.length > 2 * 40 + 48 ? 'cover-blind-fire' : 'cover-peek-fire');
  assert.ok(['cover-blind-fire', 'cover-peek-fire-l', 'cover-peek-fire-r'].includes(run.heroClip(tick + 20).clip));
  // A dodge rolls out at once, along the cover facing when the stick is idle.
  assert.deepEqual(run.dodgeLastMove({ x: 1, y: 0 }), { x: face.normal.x, y: face.normal.y });
  step = run.step({ tick: ++tick, player: { ...player, ...at }, move: { x: 0, y: 0 }, dodge: true });
  assert.equal(step.inCover, false);
  assert.equal(step.cover.event, 'leave-roll');
  assert.equal(step.position, null);
  assert.equal(run.coverDamage(front, 10), 10, 'no reduction out of cover');
  // Re-enter and step away for four ticks.
  for (let index = 0; index < 6; index += 1) step = run.step({ tick: ++tick, player, move: push });
  assert.equal(step.inCover, true);
  for (let index = 0; index < 4; index += 1) step = run.step({ tick: ++tick, player: { ...player, ...step.position ?? at }, move: { x: face.normal.x, y: face.normal.y } });
  assert.equal(step.cover.event, 'leave-step');
  assert.equal(run.cover.enters, 2);
});

test('mantle and drop on derived markers lock movement, refuse melee while mantling and reground on completion', () => {
  const climb = combat.traversalMarkers.find((marker) => marker.kind === 'climb');
  const drop = combat.traversalMarkers.find((marker) => marker.kind === 'drop');
  assert.ok(climb && drop);
  const run = combat.createRun();
  const at = { x: (climb.zone.minX + climb.zone.maxX) / 2, y: (climb.zone.minY + climb.zone.maxY) / 2, groundZ: climb.fromZ, radius: 24 };
  let step = run.step({ tick: 1, player: at, move: climb.direction });
  assert.equal(step.traversal.event, 'mantle-start');
  assert.equal(run.locked(), true);
  assert.equal(run.meleeInvulnerable({ geometry: { type: 'melee-circle' } }), true);
  assert.equal(run.meleeInvulnerable({ geometry: { type: 'shove-lane' } }), true);
  assert.equal(run.meleeInvulnerable({ geometry: { type: 'lane' } }), false, 'projectiles still land');
  assert.equal(run.heroClip(1).clip, 'mantle');
  let tick = 1;
  while (step.traversal.event !== 'mantle-complete') step = run.step({ tick: ++tick, player: at, move: { x: 0, y: 0 } });
  assert.equal(tick, 19, 'eighteen locked ticks');
  assert.equal(step.reground, true);
  assert.equal(step.position.z, climb.toZ);
  assert.equal(queryGround(step.position.x, step.position.y).groundZ, climb.toZ);
  assert.equal(run.meleeInvulnerable({ geometry: { type: 'melee-circle' } }), false);
  // Drop: an instant move, then six ticks of land recovery.
  const top = { x: (drop.zone.minX + drop.zone.maxX) / 2, y: (drop.zone.minY + drop.zone.maxY) / 2, groundZ: drop.fromZ, radius: 24 };
  step = run.step({ tick: ++tick, player: top, move: drop.direction });
  assert.equal(step.traversal.event, 'drop');
  assert.equal(step.reground, true);
  assert.equal(step.locomotion, 'landing');
  assert.equal(queryGround(step.position.x, step.position.y).groundZ, drop.toZ);
  let landTicks = 0;
  while (run.locked()) { step = run.step({ tick: ++tick, player: top, move: drop.direction }); landTicks += 1; }
  assert.equal(landTicks, 6);
  assert.equal(step.traversal.event, 'land-complete');
  // An authored ledge drop reuses the same recovery.
  assert.equal(run.landRecovery(++tick, { x: 0, y: 0, z: 0 }).phase, 'landing');
});

test('prompt rings and hero clips are presentation reads of the pose', () => {
  const { player } = coverSetup();
  const run = combat.createRun();
  const rings = run.prompts(player);
  assert.equal(rings[0].kind, 'cover-tall');
  const snapshot = JSON.stringify(run.cover);
  run.prompts(player);
  run.heroClip(3);
  assert.equal(JSON.stringify(run.cover), snapshot, 'reading prompts and clips changes no simulation state');
  assert.equal(heroClipForPose({ coverPose: 'cover-idle-l', coverKind: 'short' }), 'cover-idle-short');
  assert.equal(heroClipForPose({ coverPose: 'cover-peek-fire', coverKind: 'short', peekMode: 'pop' }), 'cover-popup-fire');
  assert.equal(heroClipForPose({ coverPose: 'none', traversalPose: 'land' }), 'land');
  assert.equal(heroClipForPose({ coverPose: 'none', traversalPose: 'none' }), null);
});

test('evidence spawns stand the hero beside a court threshold or a tall cover face, never in a real run', () => {
  const slots = createBossSlots({ seed: 1, definitions: gameplay.bossDefinitions });
  for (const bossId of DISTRICT_BOSSES) {
    const spawn = combat.evidenceSpawn(`court:${bossId}`, world.player.spawn);
    assert.equal(combat.evidenceReady(`court:${bossId}`, slots), true);
    assert.equal(slots.slots[bossId].readyAt, 120);
    assert.ok(isWorldV2PointClear(world, queryGround, spawn), bossId);
    const court = gameplay.districtCourts[bossId];
    assert.ok(!pastCourtThreshold(court, spawn));
    assert.ok(pastCourtThreshold(court, { x: spawn.x + spawn.walk.x * 100, y: spawn.y + spawn.walk.y * 100 }), `${bossId} reachable threshold`);
  }
  const cover = combat.evidenceSpawn('cover', world.player.spawn);
  assert.ok(isWorldV2PointClear(world, queryGround, cover));
  assert.equal(combat.evidenceSpawn('nope', world.player.spawn), null);
  assert.equal(combat.evidenceReady('cover', slots), false);
  assert.match(source('main.mjs'), /evidenceGameplayEnabled && TEN_AREA_COMBAT/);
});

// Regression (pre-release bug): a district boss retreated to the court mark
// farthest from the hero (up to ~1,300 away in an 1,800 court) and stood there,
// beyond the hero's 720 automatic aim and often behind a court prop, so a hero
// holding one spot (in cover, or pinned on a low stack) could never finish
// him. Now he retreats only to marks within 600 of the hero and closes in when
// an action comes due farther away.
test('a district boss never stays out of the hero\'s reach: a stationary hero anywhere in each court gets a clear shot within 15 s', () => {
  const AIM_RANGE = 720;
  const dispatch = combat.bossDispatch(failingLiquidatorApi);
  for (const bossId of DISTRICT_BOSSES) {
    const court = gameplay.districtCourts[bossId];
    const b = court.bounds;
    const spots = [court.centre, { x: b.minX + 160, y: b.minY + 160 }, { x: b.maxX - 160, y: b.minY + 160 }, { x: b.minX + 160, y: b.maxY - 160 }, { x: b.maxX - 160, y: b.maxY - 160 }]
      .filter((spot) => isWorldV2PointClear(world, queryGround, spot));
    assert.ok(spots.length >= 3, bossId);
    for (const spot of spots) {
      const slots = createBossSlots({ seed: 31, definitions: gameplay.bossDefinitions });
      const readyTick = HMH_V7_BOSSES[bossId].readyTick;
      stepBossSlots(slots, { tick: readyTick, player: { x: court.threshold.x, y: court.threshold.y, radius: 24 }, level: 12 });
      const boss = slots.slots[bossId].boss;
      const hero = { x: spot.x, y: spot.y, groundZ: queryGround(spot.x, spot.y).groundZ, vx: 0, vy: 0 };
      let streak = 0, worst = 0, reachable = 0, total = 0;
      for (let tick = readyTick + 1; tick <= readyTick + boss.introTicks + 6_000; tick += 1) {
        dispatch.stepLiquidatorBoss({ boss, tick, player: hero, blockers: [], addsAlive: 0 });
        if (tick < readyTick + boss.introTicks) continue;
        total += 1;
        const inRange = Math.hypot(boss.x - hero.x, boss.y - hero.y) <= AIM_RANGE
          && traceHeightAwareLineOfSight({ from: { x: hero.x, y: hero.y, z: hero.groundZ + 34 }, to: { x: boss.x, y: boss.y, z: boss.groundZ + 34 }, blockers: world.collisionBlockers }).clear;
        if (inRange) { reachable += 1; streak = 0; } else worst = Math.max(worst, ++streak);
      }
      assert.ok(worst <= 900, `${bossId} from ${spot.x},${spot.y}: ${worst} ticks out of reach`);
      assert.ok(reachable / total >= 0.5, `${bossId} from ${spot.x},${spot.y}: reachable ${reachable}/${total}`);
    }
  }
});

// QA sweep 2026-10-01: a district boss's tells and halts reached the
// critical-audio caption as "Liquidator: ...". The caption names the boss on
// the court; the Liquidator keeps his own line.
test('critical-audio captions name the district boss, never "Liquidator" for another boss', () => {
  for (const bossId of Object.keys(DISTRICT_BOSS_KITS)) assert.equal(combat.bossCaptionName(bossId), gameplay.bossDefinitions[bossId].name);
  assert.equal(combat.bossCaptionName('liquidator'), null);
  assert.equal(combat.bossCaptionName(undefined), null);
  const source = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  assert.match(source, /setAccessibleCombatStatus\(`\$\{TEN_AREA_COMBAT\?\.bossCaptionName\(event\.bossId\) \?\? 'Liquidator'\}: \$\{warning\}\.`\);/);
  assert.doesNotMatch(source, /setAccessibleCombatStatus\(`Liquidator: \$\{warning\}\.`\)/);
});

// QA sweep 2026-10-01: the ten-area Liquidator's defeat line promised "His
// vault is open", but this world places no Arc Rifle vault.
test('the ten-area Liquidator defeat line names the Genesis Seal, not a vault', () => {
  const line = combat.bossText({ type: 'boss-defeated', bossId: 'liquidator' });
  assert.match(line, /Genesis Seal/);
  assert.doesNotMatch(line, /vault/i);
  assert.equal(combat.bossText({ type: 'boss-initiated', bossId: 'liquidator' }), null, "the bell line stays the Liquidator's own");
});
