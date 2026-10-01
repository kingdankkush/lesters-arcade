// The 2.1.0 child on its ten-area Level 1 (docs/2.0/slices/
// HMH-RANKED-V8-TEN-AREA.md): the world selection with the version gate on,
// the session checks, the schema-8 recording through the one accumulator
// path, and the real child headless under the 2.1.0 label.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  createRunSummaryAccumulator,
  finalizeRunSummary,
  recordRunKill,
  recordRunTick,
} from '../sdk/hmh-run-summary.mjs';
import { HMH_RUN_SUMMARY_CATALOGS_V7 } from '../sdk/hmh-run-summary-schema-v7.mjs';
import { HMH_RUN_SUMMARY_CATALOGS_V8 as C8, validateRunSummaryPayload } from '../sdk/hmh-run-summary-schema-v8.mjs';
import { validateV8RunPlausibility } from '../server/verify/hmh-plausibility-v8.mjs';
import { createStandaloneInitPayload } from '../apps/hmh-reboot/src/standalone-session.mjs';
import {
  CLIENT_OUTDATED_MESSAGE,
  LEGACY_WORLD_VALUE,
  sessionClientOutdated,
  TEN_AREA_WORLD_ID,
  resolveHmhWorldContext,
  resolveHmhWorldSelection,
  sessionAllowedForWorld,
} from '../apps/hmh-reboot/src/world-context.mjs';
import { createWorldV2RuntimeContext } from '../apps/hmh-reboot/src/world-v2-runtime-context.mjs';
import { createWorldV2MovementRun, WORLD_V2_MOVEMENT_RULES_VERSION } from '../apps/hmh-reboot/src/world-v2-combat.mjs';
import { createRunSummaryV8, tenAreaObjectiveRows } from '../apps/hmh-reboot/src/run-summary-v8.mjs';
import { createMissionState, settleMissionObjective } from '../apps/hmh-reboot/src/mission-objectives.mjs';
import { createBossSlots } from '../apps/hmh-reboot/src/boss-slots.mjs';
import { createRunProgression } from '../apps/hmh-reboot/src/run-progression.mjs';

const MAIN = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
const V8_BUILD = 'site-2.1.0:game-2.1.0:cabinet-0.6.0';
const V7_BUILD = 'site-2.0.0:game-2.0.0:cabinet-0.6.0';
const officialContext = createWorldV2RuntimeContext({ selection: resolveHmhWorldSelection({ params: '', tenAreaLevelOne: true }) });

test('from 2.1.0 the ten-area world is the default Level 1 for every page; the legacy map only for an explicit Free page', () => {
  const cases = [
    ['', TEN_AREA_WORLD_ID, 'default', true],
    ['mode=ranked', TEN_AREA_WORLD_ID, 'default', true],
    ['mode=free&evidenceSafe=1', TEN_AREA_WORLD_ID, 'default', true],
    ['mode=free&world=ten-area', TEN_AREA_WORLD_ID, 'explicit-ten-area', true],
    ['world=ten-area', TEN_AREA_WORLD_ID, 'explicit-ten-area', true],
    ['mode=free&world=forked-frontier', TEN_AREA_WORLD_ID, 'unknown-world', true],
    ['mode=free&world=legacy&world=legacy', TEN_AREA_WORLD_ID, 'unknown-world', true],
    ['world=legacy', TEN_AREA_WORLD_ID, 'explicit-free-mode-required', true],
    ['mode=ranked&world=legacy', TEN_AREA_WORLD_ID, 'explicit-free-mode-required', true],
    ['mode=free&mode=ranked&world=legacy', TEN_AREA_WORLD_ID, 'explicit-free-mode-required', true],
    ['mode=free&world=legacy', 'forked-frontier', 'explicit-free-legacy', false],
    ['evidenceSafe=1&world=legacy&mode=free', 'forked-frontier', 'explicit-free-legacy', false],
  ];
  for (const [search, worldId, reason, rankedEligible] of cases) {
    const selection = resolveHmhWorldSelection({ params: search, tenAreaLevelOne: true });
    assert.equal(selection.worldId, worldId, search);
    assert.equal(selection.reason, reason, search);
    assert.equal(selection.official, true, `${search}: both 2.1.0 worlds record a run summary`);
    assert.equal(selection.rankedEligible, rankedEligible, search);
    assert.equal(selection.legacy, worldId === 'forked-frontier', search);
    assert.ok(Object.isFrozen(selection));
  }
  assert.equal(LEGACY_WORLD_VALUE, 'legacy');
});

test('the official ten-area context records schema 8; the legacy Free-only context keeps schema 7 and refuses every Ranked session', async () => {
  assert.equal(officialContext.official, true);
  assert.equal(officialContext.rankedEligible, true);
  assert.equal(officialContext.world.officialRun, true);
  assert.equal(officialContext.gameplay.officialRun, true);
  const api = officialContext.runSummary;
  assert.equal(api.RUN_SUMMARY_SCHEMA_VERSION, 8);
  assert.equal(api.HMH_RUN_SUMMARY_CATALOGS_V7, C8, 'the v7-named seam main.mjs reads carries the V8 catalogues');
  assert.equal(api.validateRunSummaryV7, validateRunSummaryPayload);
  const preview = createWorldV2RuntimeContext({ selection: resolveHmhWorldSelection({ params: 'mode=free&world=ten-area', tenAreaLevelOne: false }) });
  assert.equal(preview.runSummary, null);
  assert.throws(() => createWorldV2RuntimeContext({ selection: { worldId: TEN_AREA_WORLD_ID, official: true, rankedEligible: false } }), /unofficial/);

  const standalone = createStandaloneInitPayload();
  const ranked = (buildHash) => ({ ...standalone, mode: 'ranked', session: { ...standalone.session, buildHash, rankedEligible: true } });
  assert.equal(sessionAllowedForWorld(officialContext, ranked(V8_BUILD)), true);
  assert.equal(sessionAllowedForWorld(officialContext, ranked(V7_BUILD)), false, 'a Ranked session under a pre-2.1.0 build is refused before play, not rejected after it');
  assert.equal(sessionAllowedForWorld(officialContext, standalone), true);
  assert.equal(sessionAllowedForWorld(officialContext, { ...standalone, session: { ...standalone.session, buildHash: V7_BUILD } }), true, 'Free carries no schema gate');

  const legacy = await resolveHmhWorldContext({ params: 'mode=free&world=legacy', tenAreaLevelOne: true, loadTenArea: () => { throw new Error('must not load'); } });
  assert.equal(legacy.world.id, 'forked-frontier');
  assert.equal(legacy.official, true);
  assert.equal(legacy.rankedEligible, false);
  assert.equal(legacy.runSummary, undefined, 'the legacy world keeps the schema-7 lazy module');
  assert.equal(sessionAllowedForWorld(legacy, standalone), true);
  for (const buildHash of [V8_BUILD, V7_BUILD]) assert.equal(sessionAllowedForWorld(legacy, ranked(buildHash)), false, buildHash);
  assert.equal(sessionAllowedForWorld(legacy, { ...standalone, session: { ...standalone.session, rankedEligible: true } }), false);

  const loaded = await resolveHmhWorldContext({ params: '', tenAreaLevelOne: true });
  assert.equal(loaded.world.id, TEN_AREA_WORLD_ID);
  assert.equal(loaded.official, true);
  await assert.rejects(resolveHmhWorldContext({ params: '', tenAreaLevelOne: true, loadTenArea: async () => ({ createWorldV2RuntimeContext: () => ({ official: false, rankedEligible: false, world: { id: TEN_AREA_WORLD_ID } }) }) }), /official Level 1/);
});

test('a stale pre-2.1.0 portal tab is told to reload before it plays a run its bridge could not record', async () => {
  const standalone = createStandaloneInitPayload();
  const withBuild = (mode, buildHash) => ({ ...standalone, mode, session: { ...standalone.session, buildHash, rankedEligible: mode === 'ranked' } });
  for (const mode of ['free', 'ranked']) {
    assert.equal(sessionClientOutdated(officialContext, withBuild(mode, V7_BUILD)), true, mode);
    assert.equal(sessionClientOutdated(officialContext, withBuild(mode, V8_BUILD)), false, mode);
  }
  assert.equal(sessionClientOutdated(officialContext, standalone), false, 'a build hash with no game version (the standalone page) is not refused');
  const legacy = await resolveHmhWorldContext({ params: 'mode=free&world=legacy', tenAreaLevelOne: true });
  assert.equal(sessionClientOutdated(legacy, withBuild('free', V7_BUILD)), false, 'the original map records schema 7, which any 1.9.0+ portal carries');
  const preview = createWorldV2RuntimeContext({ selection: resolveHmhWorldSelection({ params: 'mode=free&world=ten-area', tenAreaLevelOne: false }) });
  assert.equal(sessionClientOutdated(preview, withBuild('free', V7_BUILD)), false, 'the 2.0.x preview records nothing');
  assert.match(CLIENT_OUTDATED_MESSAGE, /Reload/);
  const refusal = MAIN.indexOf('if (sessionClientOutdated(HMH_WORLD_CONTEXT, payload)) {');
  assert.ok(refusal > 0 && refusal < MAIN.indexOf('if (!sessionAllowedForWorld(HMH_WORLD_CONTEXT, payload)) {'));
  assert.match(MAIN, /bridge\?\.send\('game:error', \{ code: 'client-outdated', message: CLIENT_OUTDATED_MESSAGE \}\)/);
});

test('the schema-8 accumulator: areas from the hero’s position, every boss kill on its own role, the movement row', () => {
  assert.throws(() => createRunSummaryAccumulator({ seed: 1, buildHash: V8_BUILD, mode: 'ranked', heroId: 'lit-commando', startPosition: { x: 0, y: 0 }, schemaVersion: 8, catalogs: HMH_RUN_SUMMARY_CATALOGS_V7 }), /V7 catalogues/);
  assert.throws(() => createRunSummaryAccumulator({ seed: 1, buildHash: V8_BUILD, mode: 'ranked', heroId: 'lit-commando', startPosition: { x: 0, y: 0 }, schemaVersion: 7, catalogs: C8 }), /V7 catalogues/);
  const state = createRunSummaryAccumulator({ seed: 7, buildHash: V8_BUILD, mode: 'ranked', heroId: 'lit-commando', startPosition: { x: 12_500, y: 6_700 }, schemaVersion: 8, catalogs: C8 });
  // The legacy district id main.mjs still passes is ignored on schema 8: the
  // area comes from the position, and a road between areas sets no bit.
  recordRunTick(state, { tick: 1, position: { x: 12_500, y: 6_700 }, activeWeaponId: 'coin-blaster', districtId: 'frontier-relay', level: 1 });
  recordRunTick(state, { tick: 2, position: { x: 10_000, y: 6_700 }, activeWeaponId: 'coin-blaster', districtId: 'frontier-relay', level: 1 });
  assert.equal(state.exploration[0], 2 ** C8.districts.indexOf('mweb-meadows'));
  recordRunTick(state, { tick: 3, position: { x: 9_400, y: 6_700 }, activeWeaponId: 'coin-blaster', districtId: 'frontier-relay', level: 1 });
  assert.equal(state.exploration[0], 2 ** C8.districts.indexOf('mweb-meadows') + 2 ** C8.districts.indexOf('litecoin-city'));
  // Two boss defeats through main.mjs's one defeat block, both recorded under 'liquidator'.
  recordRunKill(state, { enemyRoleId: 'liquidator', weaponId: 'coin-blaster', boss: true });
  recordRunKill(state, { enemyRoleId: 'liquidator', weaponId: 'coin-blaster', boss: true });
  recordRunKill(state, { enemyRoleId: 'rug-puller', weaponId: 'coin-blaster' });
  const bosses = C8.bosses.map((bossId) => ({ bossId, initiations: 0, firstInitiatedTick: 0, lastInitiatedTick: 0, defeatedTick: 0 }));
  bosses[0] = { bossId: 'rug-pull-baron', initiations: 1, firstInitiatedTick: 1, lastInitiatedTick: 1, defeatedTick: 2 };
  bosses[3] = { bossId: 'liquidator', initiations: 1, firstInitiatedTick: 2, lastInitiatedTick: 2, defeatedTick: 3 };
  const movement = { rulesVersion: WORLD_V2_MOVEMENT_RULES_VERSION, coverTicks: 2, coverEnters: 1, coverLeaves: 1, coverKills: 1, coverDamageReduced: 7, mantles: 0, drops: 0, mantleTicks: 0, landTicks: 0 };
  const summary = finalizeRunSummary(state, {
    endTick: 3, elapsedMs: 50, terminalReason: 'defeated', score: 0, level: 1, xp: 0, currentCombo: 0, maxCombo: 0, revealedCells: 1, totalCells: 2,
    v7: {
      objectives: C8.objectives.map((objectiveId) => ({ objectiveId, completed: 0, tick: 0, levelAtCompletion: 0 })),
      prisoners: [], bosses, evolutions: C8.evolutions.map((evolutionId) => ({ evolutionId, offered: 0, applied: 0 })),
      upgrades: C8.upgrades.map((upgradeId) => ({ upgradeId, offered: 0, selected: 0 })),
      progression: { offersOpened: 0, evolutionOffersOpened: 0, rerolls: 0, sealsFound: 0, sealsBanked: 0, evolutionsApplied: 0, revivesUsed: 0 },
      movement,
    },
  });
  assert.equal(summary.schemaVersion, 8);
  const kills = Object.fromEntries(summary.kills.byEnemyRole.map((row) => [row.enemyRoleId, row.count]));
  assert.equal(kills['rug-pull-baron'], 1);
  assert.equal(kills.liquidator, 1);
  assert.equal(kills['rug-puller'], 1);
  assert.equal(summary.kills.total, 3);
  assert.equal(summary.kills.boss, 1, 'kills.boss counts the Liquidator only (schema rule S6)');
  assert.equal(summary.milestones.bossEngagedTick, 2, 'the Liquidator’s first initiation (S7)');
  assert.deepEqual(summary.movement, movement);
  assert.deepEqual(summary.prisoners, []);
  assert.deepEqual(summary.milestones.secrets, []);
  assert.equal(validateRunSummaryPayload(summary), '');
});

test('the child’s schema-8 rows: the ten-area mission, the four boss slots and the session movement run', () => {
  const mission = createMissionState(5, { objectives: officialContext.gameplay.missionObjectives, bossZones: officialContext.gameplay.missionBossZones });
  mission.completed.set('ten-area-meadows-relay', 240);
  settleMissionObjective(mission, 'ten-area-meadows-relay', 2);
  assert.deepEqual(tenAreaObjectiveRows(mission), [
    { objectiveId: 'ten-area-meadows-relay', completed: 1, tick: 240, levelAtCompletion: 2 },
    { objectiveId: 'ten-area-woods-camp', completed: 0, tick: 0, levelAtCompletion: 0 },
  ]);
  const run = createWorldV2MovementRun({ faces: officialContext.combat.coverFaces, markers: officialContext.combat.traversalMarkers });
  const rows = createRunSummaryV8({ movementRun: () => run }).runSummaryV7Rows({
    mission,
    bossSlots: createBossSlots({ seed: 5, definitions: officialContext.gameplay.bossDefinitions }),
    progression: createRunProgression({ seed: 5 }),
  });
  assert.deepEqual(rows.bosses.map((row) => row.bossId), C8.bosses);
  assert.deepEqual(rows.prisoners, []);
  assert.deepEqual(Object.keys(rows.movement), C8.movementFields);
  assert.equal(rows.movement.rulesVersion, 'cover-v1+traversal-v1');
  assert.throws(() => createRunSummaryV8({ movementRun: () => null }).runSummaryV7Rows({ mission, bossSlots: createBossSlots({ seed: 5, definitions: officialContext.gameplay.bossDefinitions }), progression: createRunProgression({ seed: 5 }) }), /no movement run/);
});

test('the movement run counts leaves, kills in cover and cover damage, and nothing in the simulation reads them', () => {
  const faces = officialContext.combat.coverFaces;
  const face = faces.find((row) => row.kind === 'tall' && row.length >= 96 && Math.abs(row.normal.x) + Math.abs(row.normal.y) === 1);
  const run = createWorldV2MovementRun({ faces, markers: [] });
  const mid = { x: face.a.x + face.tangent.x * face.length / 2, y: face.a.y + face.tangent.y * face.length / 2 };
  const player = { x: mid.x + face.normal.x * 40, y: mid.y + face.normal.y * 40, groundZ: face.baseZ ?? 0, radius: 24 };
  run.creditKill();
  assert.equal(run.movementRow().coverKills, 0, 'a kill outside cover is not a cover kill');
  let tick = 1;
  for (; tick <= 12 && run.cover.phase !== 'cover'; tick += 1) run.step({ tick, player, move: { x: -face.normal.x, y: -face.normal.y } });
  assert.equal(run.cover.phase, 'cover');
  run.creditKill();
  // An attack from the covered side (beyond the face) is cut; the tally keeps the difference.
  const origin = { x: mid.x - face.normal.x * 300, y: mid.y - face.normal.y * 300, z: player.groundZ };
  const applied = run.coverDamage(origin, 50);
  assert.ok(applied < 50);
  for (let leave = 0; leave < 6 && run.cover.phase === 'cover'; leave += 1, tick += 1) run.step({ tick, player: { ...player, ...run.cover.position }, move: { x: face.normal.x, y: face.normal.y } });
  assert.equal(run.cover.phase, 'free');
  const row = run.movementRow();
  assert.equal(row.coverEnters, 1);
  assert.equal(row.coverLeaves, 1);
  assert.equal(row.coverKills, 1);
  assert.equal(row.coverDamageReduced, 50 - applied);
  assert.ok(row.coverTicks >= 1);
});

test('main.mjs records the official ten-area world through the same seams, and leaves the legacy path’s literals alone', () => {
  assert.match(MAIN, /summaryV7 = HMH_WORLD_CONTEXT\?\.runSummary \?\? v7;/);
  assert.match(MAIN, /RUN_SUMMARY_ENABLED = context\.official === true;\n  if \(context\.runSummary\) summaryV7 = context\.runSummary;/);
  assert.ok(MAIN.includes('schemaVersion: summaryV7.RUN_SUMMARY_SCHEMA_VERSION,'));
  assert.ok(MAIN.includes('catalogs: summaryV7.HMH_RUN_SUMMARY_CATALOGS_V7,'));
  assert.ok(MAIN.includes('v7: summaryV7.runSummaryV7Rows({ mission: missionState, bossSlots, progression: runProgression }),'));
  assert.ok(MAIN.includes("validateRunSummary: (payload) => summaryV7?.validateRunSummaryV7(payload) ?? 'run summary schema 7 is not loaded',"));
  assert.equal(MAIN.match(/tenAreaRun\?\.creditKill\(\);/g).length, 2, 'one after an ordinary kill, one in the boss defeat block');
  assert.match(MAIN, /creditWeaponKills\(weaponLoadout, \{ tick, weaponId: scoreEvent\.weaponId, count: 1, progressionByWeapon \}\);\n\s*tenAreaRun\?\.creditKill\(\);/);
  assert.match(MAIN, /tenAreaRun\?\.creditKill\(\);\n\s*const defeatedArenaId = bossSlots\.slots\.liquidator\.arena\?\.id \?\? 'margin-floor';/);
  assert.ok(MAIN.includes("districtId: getLevelOneDistrictAt(actor.x, actor.y)?.id ?? 'frontier-relay',"));
});

test('the real 2.1.0 child, headless under a Ranked session, plays the ten-area Level 1 and sends a schema-8 summary the server accepts', () => {
  const smoke = fileURLToPath(new URL('../scripts/hmh-ranked-v8/smoke.mjs', import.meta.url));
  const result = JSON.parse(execFileSync(process.execPath, ['--max-old-space-size=3072', smoke, '30000'], {
    encoding: 'utf8', env: { ...process.env, HMH_HARNESS_RELEASE: '2.1.0' }, stdio: ['ignore', 'pipe', 'ignore'], timeout: 300_000,
  }).trim().split('\n').at(-1));
  assert.equal(result.buildHash, 'site-2.1.0:game-2.1.0:cabinet-0.6.0');
  assert.equal(result.world, TEN_AREA_WORLD_ID);
  assert.equal(result.state, 'game-over');
  assert.equal(result.childErrors, 0);
  assert.deepEqual(result.gameErrors, []);
  assert.equal(result.invalidMessages, 0);
  assert.equal(result.schemaVersion, 8);
  assert.equal(result.schemaError, null);
  assert.equal(result.visitedDistrictMask, 2 ** C8.districts.indexOf('mweb-meadows'));
  assert.equal(result.movement.rulesVersion, 'cover-v1+traversal-v1');
  assert.deepEqual(result.context, { mapId: TEN_AREA_WORLD_ID, mapVersion: 2, schemaVersion: 8 });
  assert.notEqual(result.verdict, 'rejected');
  assert.equal(typeof validateV8RunPlausibility, 'function');
});
