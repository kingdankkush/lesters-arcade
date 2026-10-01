// W4a: one world per page. Before game 2.1.0 the legacy world is the
// default; the ten-area world needs an explicit unranked Free selection and
// never becomes official. These cases pin that 2.0.x rule with the version
// gate off (tenAreaLevelOne: false); the 2.1.0 rule is in
// tests/hmh-ranked-v8-child.test.mjs.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  LEVEL_ONE_WORLD,
  createLevelOneGroundQuery,
  createLevelOneRevealState,
  getLevelOneDistrictAt,
  getLevelOneRevealSnapshot,
  revealLevelOneAt,
} from '../apps/hmh-reboot/src/level-one-world.mjs';
import { selectLevelEntry } from '../apps/hmh-reboot/src/level-entry.mjs';
import { createStandaloneInitPayload } from '../apps/hmh-reboot/src/standalone-session.mjs';
import {
  TEN_AREA_WORLD_ID,
  createLegacyWorldContext,
  resolveHmhWorldContext,
  resolveHmhWorldSelection,
  sessionAllowedForWorld,
} from '../apps/hmh-reboot/src/world-context.mjs';

const mainSource = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');

test('the ten-area world is selected only by exactly one world=ten-area with an explicit mode=free', () => {
  const cases = [
    ['', 'forked-frontier', 'default'],
    ['mode=free', 'forked-frontier', 'default'],
    ['world=ten-area', 'forked-frontier', 'explicit-free-mode-required'],
    ['mode=ranked&world=ten-area', 'forked-frontier', 'explicit-free-mode-required'],
    ['mode=free&mode=ranked&world=ten-area', 'forked-frontier', 'explicit-free-mode-required'],
    ['mode=free&world=ten-area&world=ten-area', 'forked-frontier', 'unknown-world'],
    ['mode=free&world=forked-frontier', 'forked-frontier', 'unknown-world'],
    ['mode=free&world=world-v2-local', 'forked-frontier', 'unknown-world'],
    ['mode=free&world=ten-area', TEN_AREA_WORLD_ID, 'explicit-unranked-free-ten-area'],
    ['mode=free&world=ten-area&evidenceSafe=1', TEN_AREA_WORLD_ID, 'explicit-unranked-free-ten-area'],
    ['evidenceSafe=1&world=ten-area&mode=free&debugHud=1', TEN_AREA_WORLD_ID, 'explicit-unranked-free-ten-area'],
  ];
  for (const [search, worldId, reason] of cases) {
    const selection = resolveHmhWorldSelection({ params: new URLSearchParams(search), tenAreaLevelOne: false });
    assert.equal(selection.worldId, worldId, search);
    assert.equal(selection.reason, reason, search);
    assert.equal(selection.official, worldId === 'forked-frontier', search);
    assert.equal(selection.rankedEligible, worldId === 'forked-frontier', search);
    assert.equal(selection.legacy, worldId === 'forked-frontier', search);
    assert.equal(Object.isFrozen(selection), true);
    assert.deepEqual(resolveHmhWorldSelection({ params: search, tenAreaLevelOne: false }), selection, 'string search resolves identically');
  }
  assert.equal(resolveHmhWorldSelection({ tenAreaLevelOne: false }).worldId, 'forked-frontier');
});

test('the legacy context hands main.mjs the legacy modules themselves', async () => {
  let loads = 0;
  const context = await resolveHmhWorldContext({ params: new URLSearchParams('mode=ranked&evidenceSafe=1'), tenAreaLevelOne: false, loadTenArea: () => { loads += 1; throw new Error('must not load'); } });
  assert.equal(loads, 0);
  assert.equal(context.world, LEVEL_ONE_WORLD);
  assert.equal(context.official, true);
  assert.equal(context.rankedEligible, true);
  assert.equal(context.legacy, true);
  assert.equal(context.createGroundQuery, createLevelOneGroundQuery);
  assert.equal(context.getDistrictAt, getLevelOneDistrictAt);
  assert.equal(context.reveal.create, createLevelOneRevealState);
  assert.equal(context.reveal.at, revealLevelOneAt);
  assert.equal(context.reveal.snapshot, getLevelOneRevealSnapshot);
  assert.equal(context.selectEntry, selectLevelEntry);
  assert.equal(context.defaultDistrictId, 'frontier-relay');
  assert.equal(context.gameplay, null);
  assert.equal(context.briefing, null);
  assert.equal(context.pointOfInterestPlacements, null);
  assert.deepEqual(createLegacyWorldContext().selection.reason, 'default');
});

test('the ten-area context loads on demand, is unofficial and refuses any non-Free or rankedEligible session', async () => {
  let loads = 0;
  const context = await resolveHmhWorldContext({ params: new URLSearchParams('mode=free&world=ten-area'), tenAreaLevelOne: false, loadTenArea: async () => { loads += 1; return import('../apps/hmh-reboot/src/world-v2-runtime-context.mjs'); } });
  assert.equal(loads, 1);
  assert.equal(context.world.id, TEN_AREA_WORLD_ID);
  assert.equal(context.official, false);
  assert.equal(context.rankedEligible, false);
  assert.equal(context.legacy, false);
  assert.equal(context.defaultDistrictId, 'mweb-meadows');
  assert.equal(context.audit.ok, true);
  assert.equal(context.pointOfInterestPlacements.length, 10);
  assert.equal(typeof context.createGroundQuery().constructor, 'function');
  assert.equal(context.getDistrictAt(12500, 6700)?.id, 'mweb-meadows');
  assert.deepEqual(context.selectEntry(0xdeadbeef), { id: 'meadows', name: 'MWEB Meadows', x: 12500, y: 6700 });
  const standalone = createStandaloneInitPayload();
  assert.equal(standalone.mode, 'free');
  assert.equal(standalone.session.rankedEligible, false);
  assert.equal(sessionAllowedForWorld(context, standalone), true);
  assert.equal(sessionAllowedForWorld(context, { ...standalone, mode: 'ranked' }), false);
  assert.equal(sessionAllowedForWorld(context, { ...standalone, session: { ...standalone.session, rankedEligible: true } }), false);
  assert.equal(sessionAllowedForWorld(context, { ...standalone, session: { seed: 1 } }), false, 'a missing rankedEligible is not an unranked promise');
  const legacy = createLegacyWorldContext();
  assert.equal(sessionAllowedForWorld(legacy, { ...standalone, mode: 'ranked', session: { ...standalone.session, rankedEligible: true } }), true);
  await assert.rejects(resolveHmhWorldContext({ params: 'mode=free&world=ten-area', tenAreaLevelOne: false, loadTenArea: async () => ({ createWorldV2RuntimeContext: () => ({ official: true, rankedEligible: false, world: { id: TEN_AREA_WORLD_ID } }) }) }), /unofficial and unranked/);
});

test('main.mjs adopts one world before the bridge and gates every submission path on the official flag', () => {
  const boot = mainSource.slice(mainSource.indexOf('async function boot() {'));
  const adoptAt = boot.indexOf('adoptWorldContext(await resolveHmhWorldContext({ params: new URLSearchParams(window.location.search) }));');
  assert.ok(adoptAt > 0, 'the world is resolved once from the page URL');
  assert.ok(adoptAt < boot.indexOf('createHmhChildBridge({'), 'before the bridge exists');
  assert.ok(adoptAt < boot.indexOf('await app.init('), 'before the renderer exists');
  assert.ok(adoptAt < boot.indexOf('const runtimeParams = new URLSearchParams(window.location.search);'), 'before any pilot flag is read');
  assert.match(mainSource, /RUN_SUMMARY_ENABLED = context\.official === true;/);
  assert.match(mainSource, /const runRecorder = \(record\) => \(\.\.\.args\) => \(RUN_SUMMARY_ENABLED \? record\(\.\.\.args\) : undefined\);/);
  assert.match(mainSource, /if \(!RUN_SUMMARY_ENABLED\) runSummaryAccumulator = null;/);
  assert.match(mainSource, /if \(bridge\?\.initialized && RUN_SUMMARY_ENABLED\) \{/);
  assert.equal(mainSource.match(/bridge\.send\('game:run-summary'/g).length, 1, 'one summary send, inside the death camera release');
  assert.match(mainSource, /if \(!sessionAllowedForWorld\(HMH_WORLD_CONTEXT, payload\)\) \{/);
  const refusal = mainSource.indexOf('if (!sessionAllowedForWorld(HMH_WORLD_CONTEXT, payload)) {');
  assert.ok(refusal > mainSource.indexOf('const initializeSession = (payload) => {') && refusal < mainSource.indexOf('stopCurrentSession();', mainSource.indexOf('const initializeSession = (payload) => {')), 'refused before the previous session is stopped');
  // The legacy world keeps its own helpers on the legacy path.
  assert.match(mainSource, /queryGround = context\.legacy \? createLevelOneGroundQuery\(\) : context\.createGroundQuery\(\);/);
  assert.match(mainSource, /worldReveal = context\.legacy \? LEGACY_WORLD_REVEAL : context\.reveal;/);
  assert.match(mainSource, /const selectLevelEntry = \(seed\) => \(HMH_WORLD_CONTEXT\?\.gameplay \? HMH_WORLD_CONTEXT\.selectEntry\(seed\) : selectLegacyLevelEntry\(seed\)\);/);
  // LEVEL_ONE_WORLD is the adopted runtime binding, not the legacy import.
  assert.match(mainSource, /import \{\s*LEVEL_ONE_WORLD as LEGACY_LEVEL_ONE_WORLD,/);
  assert.match(mainSource, /let LEVEL_ONE_WORLD = LEGACY_LEVEL_ONE_WORLD;/);
  assert.match(mainSource, /LEVEL_ONE_WORLD = context\.world;/);
  assert.doesNotMatch(mainSource, /LEGACY_LEVEL_ONE_WORLD\./, 'nothing reads the legacy import around the adopted world');
  for (const line of mainSource.split('\n').filter((row) => /buildAuthored\w+Placements\(\{ worldId: LEVEL_ONE_WORLD\.id/.test(row))) assert.ok(/HMH_WORLD_CONTEXT\.legacy \?/.test(line) || /^\s+\.\.\.buildAuthored/.test(line), line.trim());
  // World-keyed tables reach the existing seams; the legacy calls stay literal.
  assert.match(mainSource, /createBossSlots\(\{ seed: payload\.session\.seed, \.\.\.\(HMH_WORLD_CONTEXT\.gameplay \? \{ definitions: HMH_WORLD_CONTEXT\.gameplay\.bossDefinitions \} : \{\}\) \}\);/);
  assert.match(mainSource, /if \(HMH_WORLD_CONTEXT\.gameplay\) missionState=createMissionState\(payload\.session\.seed,\{objectives:HMH_WORLD_CONTEXT\.gameplay\.missionObjectives,bossZones:HMH_WORLD_CONTEXT\.gameplay\.missionBossZones\}\);/);
  assert.match(mainSource, /\.\.\.\(HMH_WORLD_CONTEXT\.gameplay \? \{ roleGates: HMH_WORLD_CONTEXT\.gameplay\.roleGates \} : \{\}\),/);
  assert.match(mainSource, /world: LEVEL_ONE_WORLD, queryGround, cellsPerSlice: 512/);
  assert.doesNotMatch(mainSource, /import\('\.\/world-v2-runtime-context\.mjs'\)/, 'the lazy world load belongs to world-context.mjs');
});
