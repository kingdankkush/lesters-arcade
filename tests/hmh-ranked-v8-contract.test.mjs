// Run summary schema 8 (the ten-area Level 1 of game 2.1.0): every value the
// v8 contract and schema copy from the child is pinned against the child's
// own world, gameplay tables, archetypes, placements and rules, so the
// verifier's bounds cannot drift from the behaviour they bound.
// docs/2.0/slices/HMH-RANKED-V8-TEN-AREA.md.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { HMH_RUN_SUMMARY_CATALOGS_V7 } from '../sdk/hmh-run-summary-schema-v7.mjs';
import { HMH_RUN_SUMMARY_CATALOGS_V8 as C8, HMH_V8_MOVEMENT_FIELDS, hmhRunSummaryCatalogs, hmhV8DistrictIndexAt } from '../sdk/hmh-run-summary-schema-v8.mjs';
import {
  HMH_RUN_SUMMARY_V8_MIN_GAME_VERSION,
  HMH_V8_BOSSES,
  HMH_V8_BOSS_RULES,
  HMH_V8_COLLECTIBLE_RULES,
  HMH_V8_CONSISTENCY_RULES,
  HMH_V8_MAP,
  HMH_V8_MOVEMENT_RULES,
  HMH_V8_OBJECTIVES,
  HMH_V8_ROLE_THREAT,
  HMH_V8_RUN_RULES,
  HMH_V8_TRAVEL,
  isHmhV8Build,
  isHmhV8GameVersion,
} from '../sdk/hmh-run-contract-v8.mjs';
import { HMH_V7_CONSISTENCY_RULES, HMH_V7_RUN_RULES } from '../sdk/hmh-run-contract-v7.mjs';
import { GAME_VERSION } from '../apps/portal/src/version-tracking.mjs';
import {
  WORLD_V2_RUNTIME_ID,
  WORLD_V2_RUNTIME_VERSION,
  buildWorldV2PointOfInterestPlacements,
  createWorldV2RuntimeWorld,
  getWorldV2DistrictAt,
} from '../apps/hmh-reboot/src/world-v2-runtime-world.mjs';
import { createWorldV2Gameplay, selectWorldV2Entry } from '../apps/hmh-reboot/src/world-v2-gameplay.mjs';
import { WORLD_V2_DISTRICT_ARCHETYPES, WORLD_V2_ENEMY_ARCHETYPES, WORLD_V2_MOVEMENT_RULES_VERSION } from '../apps/hmh-reboot/src/world-v2-combat.mjs';
import { DISTRICT_BOSS_KITS } from '../apps/hmh-reboot/src/boss-slots.mjs';
import { LIQUIDATOR_BELL_INTRO_TICKS } from '../apps/hmh-reboot/src/liquidator-boss.mjs';
import { COVER_RULES_V1 } from '../apps/hmh-reboot/src/cover-system.mjs';
import { TRAVERSAL_RULES_V1 } from '../apps/hmh-reboot/src/traversal-system.mjs';
import { COLLECTIBLE_EFFECTS, createCollectibleState } from '../apps/hmh-reboot/src/collectible-system.mjs';
import { objectiveRewardPlacements } from '../apps/hmh-reboot/src/objective-rewards.mjs';
import { BEAR_MARKET_BURNER_EVENT_BOUNDS } from '../apps/hmh-reboot/src/bear-market-burner-event.mjs';
import { FORKED_STANDARD_CONFIG } from '../apps/hmh-reboot/src/forked-standard.mjs';
import { HMH_TEN_AREA_LEVEL_ONE } from '../apps/hmh-reboot/src/world-context.mjs';
import { deriveTenAreaTravelEdges } from '../scripts/hmh-ranked-v8/derive-travel-graph.mjs';

const MAIN = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
const world = createWorldV2RuntimeWorld({ official: true });
const gameplay = createWorldV2Gameplay(world);
const inside = (rect, point) => point.x >= rect.minX && point.x <= rect.maxX && point.y >= rect.minY && point.y <= rect.maxY;

test('the version gate: schema 8 and the ten-area Level 1 from game 2.1.0, numerically', () => {
  assert.equal(HMH_RUN_SUMMARY_V8_MIN_GAME_VERSION, '2.1.0');
  for (const [buildHash, ok] of [
    ['site-2.1.0:game-2.1.0:cabinet-0.6.0', true], ['site-2.1.0:game-2.1.0', true], ['site-2.0.9:game-2.1.1', true], ['site-3.0.0:game-2.10.0:cabinet-1.0.0', true],
    ['site-2.1.0:game-2.0.0:cabinet-0.6.0', false], ['site-2.0.0:game-2.0.0', false], ['site-1.9.0:game-1.9.0', false], ['site-2.1.0', false], ['game-2.1', false], ['', false], [null, false],
  ]) assert.equal(isHmhV8Build(buildHash), ok, String(buildHash));
  assert.equal(isHmhV8GameVersion('2.1.0'), true);
  assert.equal(isHmhV8GameVersion('2.0.99'), false);
  assert.equal(isHmhV8GameVersion('10.0.0'), true);
  assert.equal(isHmhV8GameVersion('2.1'), false);
  // The child's gate is its own game version: off at 2.0.x, on from the
  // release commit that sets 2.1.0.
  assert.equal(HMH_TEN_AREA_LEVEL_ONE, isHmhV8GameVersion(GAME_VERSION));
});

test('the v8 map is the ten-area world, and the catalogues name its areas, caches and machines', () => {
  assert.deepEqual(HMH_V8_MAP, { mapId: WORLD_V2_RUNTIME_ID, mapVersion: WORLD_V2_RUNTIME_VERSION });
  assert.deepEqual(C8.districts, world.districts.map((district) => district.id));
  assert.deepEqual(C8.districtAreas, world.districts.map(({ area }) => [area.minX, area.minY, area.maxX, area.maxY]));
  assert.deepEqual(C8.pointsOfInterest, world.pointsOfInterest.map((poi) => poi.id));
  assert.deepEqual(C8.objectives, gameplay.missionObjectives.map((row) => row.id).sort());
  assert.deepEqual(C8.worldSites, C8.objectives);
  assert.deepEqual(C8.secrets, []);
  assert.deepEqual(C8.prisonerSlots, []);
  assert.deepEqual(C8.bosses, HMH_RUN_SUMMARY_CATALOGS_V7.bosses);
  assert.deepEqual(C8.enemyRoles, HMH_RUN_SUMMARY_CATALOGS_V7.enemyRoles);
  assert.deepEqual(C8.movementFields, HMH_V8_MOVEMENT_FIELDS);
  assert.equal(hmhRunSummaryCatalogs(8), C8);
  assert.equal(hmhRunSummaryCatalogs(7), HMH_RUN_SUMMARY_CATALOGS_V7);
  // The area lookup is the child's getWorldV2DistrictAt, roads between areas included.
  for (let x = 0; x <= 20_000; x += 250) {
    for (let y = 0; y <= 14_000; y += 250) {
      const index = hmhV8DistrictIndexAt(x, y);
      assert.equal(index < 0 ? null : C8.districts[index], getWorldV2DistrictAt(world, x, y)?.id ?? null, `${x},${y}`);
    }
  }
  assert.ok(Object.isFrozen(C8) && Object.isFrozen(C8.districtAreas[0]));
});

test('every role the ten-area map spawns is a catalogue role at the threat the child grants', () => {
  for (const id of Object.keys(WORLD_V2_ENEMY_ARCHETYPES)) {
    assert.ok(C8.enemyRoles.includes(id), id);
    assert.equal(HMH_V8_ROLE_THREAT[id], WORLD_V2_ENEMY_ARCHETYPES[id].costs.threat, id);
  }
  for (const pools of Object.values(WORLD_V2_DISTRICT_ARCHETYPES)) for (const ids of Object.values(pools)) for (const id of ids) assert.ok(C8.enemyRoles.includes(id), id);
  // Every boss defeat runs main.mjs's one defeat block, which awards the
  // Liquidator's threat to whichever boss is live.
  const liquidatorThreat = Number(/const LIQUIDATOR_THREAT_COST = (\d+);/.exec(MAIN)[1]);
  for (const bossId of C8.bosses) assert.equal(HMH_V8_ROLE_THREAT[bossId], liquidatorThreat, bossId);
  assert.equal(MAIN.match(/threatCost: LIQUIDATOR_THREAT_COST,/g).length, 1);
  assert.match(MAIN, /recordRunKill\(runSummaryAccumulator, \{ enemyRoleId: 'liquidator', weaponId: damageEvent\.weaponId, boss: true \}\);/);
  assert.match(MAIN, /threatCost: ENEMY_ARCHETYPES\[defeatedEnemy\.archetypeId\]\.costs\.threat,/);
  assert.match(MAIN, /ENEMY_ARCHETYPES = TEN_AREA_COMBAT\?\.archetypes \?\? LEGACY_ENEMY_ARCHETYPES;/);
});

test('the bosses: courts inside their areas, the contract ready ticks and bursts, and a 300-tick minimum fight for every start', () => {
  for (const bossId of C8.bosses) {
    const row = HMH_V8_BOSSES[bossId];
    const definition = gameplay.bossDefinitions[bossId];
    const area = world.districts.find((district) => district.id === row.district).area;
    const arena = definition.arenas.threshold ?? definition.arenas.bell;
    // The whole court (or the Liquidator's floor) lies in the area, so the
    // hero who starts the boss stands in it.
    for (const corner of [{ x: arena.bounds.minX, y: arena.bounds.minY }, { x: arena.bounds.maxX, y: arena.bounds.maxY }]) assert.ok(inside(area, corner), `${bossId} ${JSON.stringify(corner)}`);
    assert.equal(definition.readyTick, row.readyTick, bossId);
    assert.equal(definition.silverBurst, row.silverBurst, bossId);
    assert.equal(row.minFightTicks, HMH_V8_BOSS_RULES.BOSS_MIN_FIGHT_TICKS, bossId);
  }
  for (const [bossId, kit] of Object.entries(DISTRICT_BOSS_KITS)) {
    assert.ok(kit.definition.introTicks >= HMH_V8_BOSS_RULES.BOSS_INTRO_MIN_TICKS, bossId);
    assert.equal(kit.definition.phaseThresholds.length, HMH_V8_BOSS_RULES.BOSS_PHASE_THRESHOLDS, bossId);
  }
  assert.ok(LIQUIDATOR_BELL_INTRO_TICKS >= HMH_V8_BOSS_RULES.BOSS_INTRO_MIN_TICKS);
  // No Dark Pool on this map: the Liquidator starts only from his bell.
  assert.equal(gameplay.bossDefinitions.liquidator.darkPoolObjective, 'ten-area-dark-pool-unavailable');
  assert.ok(!gameplay.missionObjectives.some((row) => row.id === gameplay.bossDefinitions.liquidator.darkPoolObjective));
  assert.equal(gameplay.missionBossZones.filter((row) => row.bossZone?.kind === 'trigger').length, 1);
  assert.ok(inside(world.districts.find((district) => district.id === 'litecoin-city').area, gameplay.liquidatorFloor.bell));
});

test('the objectives: switch machines inside their areas, granting the switch XP per level', () => {
  for (const row of gameplay.missionObjectives) {
    const contract = HMH_V8_OBJECTIVES[row.id];
    assert.equal(contract.class, row.objectiveClass, row.id);
    assert.equal(contract.district, row.districtId, row.id);
    assert.equal(contract.requires, row.requires, row.id);
    assert.equal(row.xpPerLevel, HMH_V8_RUN_RULES.OBJECTIVE_XP_PER_LEVEL[contract.class], row.id);
    assert.equal(getWorldV2DistrictAt(world, row.operate.x, row.operate.y)?.id, contract.district, row.id);
  }
  assert.equal(HMH_V8_RUN_RULES, HMH_V7_RUN_RULES);
});

test('the travel graph is the one the ground allows, and the entry is the Meadows start', () => {
  assert.deepEqual(deriveTenAreaTravelEdges({ world }), HMH_V8_TRAVEL.edges);
  // Every authored road is an edge (the graph also holds the Meadows-River junction pair).
  for (const seam of world.seams) assert.ok(HMH_V8_TRAVEL.edges.some(([a, b]) => [a, b].sort().join() === [...seam.districtIds].sort().join()), seam.id);
  assert.equal(HMH_V8_TRAVEL.edges.length, world.seams.length + 1);
  const entry = selectWorldV2Entry(gameplay);
  assert.deepEqual({ x: entry.x, y: entry.y }, { x: HMH_V8_TRAVEL.entry.x, y: HMH_V8_TRAVEL.entry.y });
  assert.deepEqual(world.player.spawn, { x: HMH_V8_TRAVEL.entry.x, y: HMH_V8_TRAVEL.entry.y });
  assert.equal(getWorldV2DistrictAt(world, entry.x, entry.y).id, HMH_V8_TRAVEL.entry.district);
  assert.equal(HMH_V8_TRAVEL.maxStepPx, HMH_V7_CONSISTENCY_RULES.travel.maxStepPx);
  assert.equal(HMH_V8_TRAVEL.allowancePx, HMH_V7_CONSISTENCY_RULES.travel.allowancePx);
  // A tick's largest move on this map is a drop's landing (96), then six locked ticks.
  assert.ok(Math.max(...combatMarkers().map((marker) => marker.travel)) <= 96);
  assert.equal(TRAVERSAL_RULES_V1.landRecoveryTicks, 6);
});

function combatMarkers() {
  // The derived markers' travel (world-v2-combat MARKER_TRAVEL).
  const source = readFileSync(new URL('../apps/hmh-reboot/src/world-v2-combat.mjs', import.meta.url), 'utf8');
  return [{ travel: Number(/const MARKER_TRAVEL = (\d+);/.exec(source)[1]) }];
}

test('the pickup placements are the child’s ten-area placements, per effect', () => {
  const rearmed = /authoredPointOfInterestPlacements\.map\(p=>\[([^\]]+)\]\.includes\(p\.assetId\)\?Object\.freeze\(\{\.\.\.p,respawnTicks:(\d+)\}\):p\)/.exec(MAIN);
  const rearmAssets = rearmed[1].split(',').map((id) => id.replaceAll("'", ''));
  const rearmTicks = Number(rearmed[2]);
  assert.ok(MAIN.includes('const scheduledCollectiblePlacements = [lightningLedgerEventPlacement, bearMarketBurnerEventPlacement, forkedStandardEventPlacement];'));
  assert.ok(MAIN.includes('collectibleState = createCollectibleState({ placements: collectiblePlacements, objectivePlacements: objectiveRewardPlacements() });'));
  assert.match(MAIN, /const authoredPointOfInterestPlacements = HMH_WORLD_CONTEXT\.pointOfInterestPlacements \?\? buildAuthoredPointOfInterestPlacements/);
  const lightningMin = Number(/const MIN_EVENT_TICK = ([0-9_]+);/.exec(readFileSync(new URL('../apps/hmh-reboot/src/lightning-ledger-event.mjs', import.meta.url), 'utf8'))[1].replaceAll('_', ''));
  const pois = buildWorldV2PointOfInterestPlacements(world).map((p) => (rearmAssets.includes(p.assetId) ? { ...p, respawnTicks: rearmTicks } : p));
  const events = [
    { id: 'event:lightning', assetId: 'lightning-ledger-cache', x: 0, y: 0, availableTick: lightningMin },
    { id: 'event:burner', assetId: 'bear-market-burner-cache', x: 0, y: 0, availableTick: BEAR_MARKET_BURNER_EVENT_BOUNDS.minTick },
    { id: 'event:standard', assetId: 'forked-standard-cache', x: 0, y: 0, availableTick: FORKED_STANDARD_CONFIG.eventMinTick },
  ];
  const state = createCollectibleState({ placements: [...pois, ...events], objectivePlacements: objectiveRewardPlacements() });
  const table = Object.fromEntries(C8.collectibles.filter((id) => id !== 'genesis-seal').map((id) => [id, []]));
  for (const { placement, effect } of state.entries) table[effect.effectId].push([placement.respawnTicks ?? 0, placement.requiredObjective ?? placement.availableTick]);
  const sorted = (rows) => Object.fromEntries(Object.entries(rows).map(([id, list]) => [id, list.map((entry) => JSON.stringify(entry)).sort()]));
  assert.deepEqual(sorted(table), sorted(HMH_V8_CONSISTENCY_RULES.pickupPlacements));
  assert.equal(state.entries.length, HMH_V8_COLLECTIBLE_RULES.MAX_PLACEMENTS);
  assert.ok(Object.values(COLLECTIBLE_EFFECTS).every((effect) => C8.collectibles.includes(effect.effectId)));
  // No ten-area objective unlocks a legacy objective reward; only the vault opens (the Liquidator's defeat).
  assert.ok(!objectiveRewardPlacements().some((reward) => C8.objectives.includes(reward.requiredObjective)));
  assert.equal(gameplay.bossDefinitions.liquidator.unlockObjective, HMH_V8_CONSISTENCY_RULES.vault.objective);
});

test('the movement row: the rules version and the tick constants are the child’s cover and traversal rules', () => {
  assert.equal(HMH_V8_MOVEMENT_RULES.rulesVersion, WORLD_V2_MOVEMENT_RULES_VERSION);
  assert.equal(HMH_V8_MOVEMENT_RULES.rulesVersion, `${COVER_RULES_V1.rulesVersion}+${TRAVERSAL_RULES_V1.rulesVersion}`);
  assert.equal(HMH_V8_MOVEMENT_RULES.coverEnterTicks, COVER_RULES_V1.enterTicks);
  assert.equal(HMH_V8_MOVEMENT_RULES.mantleTicks, TRAVERSAL_RULES_V1.mantleTicks);
  assert.equal(HMH_V8_MOVEMENT_RULES.landRecoveryTicks, TRAVERSAL_RULES_V1.landRecoveryTicks);
  assert.deepEqual(HMH_V8_MOVEMENT_RULES.fields, HMH_V8_MOVEMENT_FIELDS);
});

test('the v8 contract, schema and verifier never import the child', () => {
  for (const file of ['../sdk/hmh-run-contract-v8.mjs', '../sdk/hmh-run-summary-schema-v8.mjs', '../sdk/hmh-run-v8-build.mjs', '../server/verify/hmh-plausibility-v8.mjs']) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /from '[^']*apps\//, file);
  }
});
