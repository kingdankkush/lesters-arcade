import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import {
  HMH_RUN_SUMMARY_CATALOGS,
  HMH_RUN_SUMMARY_CATALOGS_V6 as BASE_CATALOGS_V6,
  validateRunSummaryPayload as validateUpTo6,
} from '../sdk/hmh-run-summary-schema.mjs';
import {
  HMH_RUN_SUMMARY_CATALOGS_V6,
  HMH_RUN_SUMMARY_CATALOGS_V7,
  HMH_V7_HELD_PRISONER_BOSSES,
  HMH_V7_PANEL_ONLY_EVOLUTIONS,
  HMH_V7_PROGRESSION_FIELDS,
  HMH_V7_RESERVED_EVOLUTIONS,
  HMH_V7_START_WEAPON,
  HMH_V7_UPGRADE_WEAPON_GATES,
  hmhRunSummaryCatalogs,
  validateRunSummaryPayload,
} from '../sdk/hmh-run-summary-schema-v7.mjs';
import * as contract from '../sdk/hmh-run-contract-v7.mjs';
import { HMH_MAX_MESSAGE_BYTES, createBridgeEnvelope } from '../sdk/hmh-bridge-protocol.mjs';
import { readFixture } from './fixtures/ranked/build-fixtures.mjs';

const clone = (value, mutate = () => {}) => {
  const copy = structuredClone(value);
  mutate(copy);
  return copy;
};
const ACHIEVEMENT_RUNS = JSON.parse(readFileSync(new URL('./fixtures/achievements/hmh-run-summary.json', import.meta.url), 'utf8')).runs;
const V6_BASES = [
  ['hmh-valid', readFixture('hmh-valid').body.evidence.runSummary],
  ['hmh-realistic', readFixture('hmh-realistic').body.evidence.runSummary],
  ['hmh-level-90', readFixture('hmh-level-90').body.evidence.runSummary],
  ...Object.entries(ACHIEVEMENT_RUNS).map(([name, summary]) => [`achievements ${name}`, summary]),
];

// A schema-6 summary written as an older schema version: the fields each
// version added are removed.
function downgrade(summary, version) {
  return clone(summary, (s) => {
    s.schemaVersion = version;
    if (version < 6) { delete s.defeat; delete s.milestones; }
    if (version < 5) delete s.forkedStandard;
    if (version < 4) delete s.bearMarketBurner;
    if (version < 3) delete s.lightningLedger;
    if (version < 2) {
      for (const row of s.weapons) {
        for (const field of ['chargesStarted', 'chargesCancelled', 'chargedShots', 'cancelledChargeTicks', 'zeroHitShots', 'oneHitShots', 'twoHitShots', 'threePlusHitShots', 'bossHits', 'damageTakenWhileEquipped']) delete row[field];
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Schema versions 1-6 keep their behaviour (run summary v7 contract §2, §6):
// the answers of validateRunSummaryPayload over this corpus were hashed with
// the 60ea173a module (production 1.8.1), before schema 7 existed.
const V1_V6_CORPUS_DIGEST = 'e7d5115adc08dd044f210b065d894c704bf29ad264cb5722cd3229f90c12b173';
function v1ToV6Corpus() {
  const cases = [];
  for (const [name, base] of V6_BASES) {
    const add = (label, mutate) => cases.push([`${name} ${label}`, clone(base, mutate)]);
    cases.push([name, base]);
    for (const version of [1, 2, 3, 4, 5]) cases.push([`${name} as v${version}`, downgrade(base, version)]);
    for (const version of [0, 8, '6', null, 6.5]) add(`schemaVersion ${String(version)}`, (s) => { s.schemaVersion = version; });
    for (const key of Object.keys(base)) {
      if (key !== 'schemaVersion') add(`without ${key}`, (s) => { delete s[key]; });
    }
    add('extra top-level field', (s) => { s.extra = 1; });
    for (const field of ['objectives', 'prisoners', 'bosses', 'evolutions', 'progression']) add(`with v7 field ${field}`, (s) => { s[field] = []; });
    add('seed -1', (s) => { s.identity.seed = -1; });
    add('seed 2^32', (s) => { s.identity.seed = 2 ** 32; });
    add('empty buildHash', (s) => { s.identity.buildHash = ''; });
    add('bad heroId', (s) => { s.identity.heroId = 'A'; });
    add('bad mode', (s) => { s.identity.mode = 'paid'; });
    add('bad terminalReason', (s) => { s.identity.terminalReason = 'quit'; });
    add('start after end', (s) => { s.identity.startTick = s.identity.endTick + 1; });
    for (const field of Object.keys(base.totals)) {
      add(`totals.${field} +1`, (s) => { s.totals[field] += 1; });
      add(`totals.${field} -1`, (s) => { s.totals[field] = -1; });
      add(`totals.${field} 1.5`, (s) => { s.totals[field] = 1.5; });
    }
    add('level 0', (s) => { s.totals.level = 0; });
    add('currentCombo above maxCombo', (s) => { s.totals.currentCombo = s.totals.maxCombo + 1; });
    add('kills.total +1', (s) => { s.kills.total += 1; });
    add('kills.boss above total', (s) => { s.kills.boss = s.kills.total + 1; });
    add('kills.elite above total', (s) => { s.kills.elite = s.kills.total + 1; });
    add('role rows swapped', (s) => { [s.kills.byEnemyRole[0], s.kills.byEnemyRole[1]] = [s.kills.byEnemyRole[1], s.kills.byEnemyRole[0]]; });
    add('role row appended', (s) => { s.kills.byEnemyRole.push({ enemyRoleId: 'rug-puller', count: 0 }); });
    add('role row missing', (s) => { s.kills.byEnemyRole.pop(); });
    add('role count -1', (s) => { s.kills.byEnemyRole[0].count = -1; });
    add('liquidator row +1', (s) => { s.kills.byEnemyRole[6].count += 1; s.kills.total += 1; s.kills.byWeapon[0].count += 1; s.weapons[0].kills += 1; });
    add('weapon contacts above triggers', (s) => { s.weapons[0].triggerContacts = s.weapons[0].triggers + 1; });
    add('weapon reloads inconsistent', (s) => { s.weapons[0].reloadCompletes = s.weapons[0].reloadStarts + 1; });
    add('weapon kills mismatch', (s) => { s.weapons[0].kills += 1; });
    add('charges inconsistent', (s) => { if (s.weapons[4].chargesStarted !== undefined) s.weapons[4].chargedShots = s.weapons[4].chargesStarted + 1; });
    add('weapon row appended', (s) => { s.weapons.push({ ...s.weapons[0], weaponId: 'extra-weapon' }); });
    if (base.lightningLedger) {
      add('ledger chain 9', (s) => { s.lightningLedger.longestChain = 9; });
      add('ledger seconds mismatch', (s) => { s.lightningLedger.secondsHeld += 1; });
    }
    if (base.bearMarketBurner) add('burner refills 2', (s) => { s.bearMarketBurner.emergencyRefills = 2; });
    if (base.forkedStandard) add('standard forms mismatch', (s) => { s.forkedStandard.thrusts += 1; });
    if (base.defeat) {
      add('defeat none while defeated', (s) => { s.defeat = { kind: 'none', causeId: 'none', tick: 0, damage: 0 }; });
      add('defeat cause invalid', (s) => { s.defeat.causeId = 'Bad Cause'; });
      add('defeat after end', (s) => { s.defeat.tick = s.identity.endTick + 1; });
      add('completed with a killer', (s) => { s.identity.terminalReason = 'completed'; });
    }
    if (base.milestones) {
      add('levelUps mismatch', (s) => { s.milestones.levelUps += 1; });
      add('first level-up after last', (s) => { s.milestones.firstLevelUpTick = s.milestones.lastLevelUpTick + 1; });
      add('boss engaged after end', (s) => { s.milestones.bossEngagedTick = s.identity.endTick + 1; });
      add('boss engaged at 600', (s) => { s.milestones.bossEngagedTick = 600; });
      add('site operated 2', (s) => { s.milestones.sites[0].operated = 2; });
      add('site tick without flag', (s) => { s.milestones.sites[0].operated = 0; s.milestones.sites[0].tick = 60; });
      add('site operated at 60', (s) => { s.milestones.sites[0].operated = 1; s.milestones.sites[0].tick = 60; });
      add('v7 site appended', (s) => { s.milestones.sites.push({ siteId: 'relay-uplink', operated: 0, tick: 0 }); });
      add('v7 secret appended', (s) => { s.milestones.secrets.push({ secretId: 'crossing-behind-the-falls', found: 0, tick: 0 }); });
    }
    add('grenade field string', (s) => { s.grenades.kills = '1'; });
    add('collectible row appended', (s) => { s.collectibles.push({ effectId: 'genesis-seal', collected: 0, activeTicks: 0 }); });
    add('litecoin mismatch', (s) => { s.totals.litecoin += 1; });
    add('selected above offered', (s) => { s.upgrades[0].selected = s.upgrades[0].offered + 1; });
    add('v7 upgrade row appended', (s) => { s.upgrades.push({ upgradeId: 'scatter-pump', offered: 0, selected: 0 }); });
    add('district mask too wide', (s) => { s.exploration.visitedDistrictMask = 64; });
    add('poi mask too wide', (s) => { s.exploration.discoveredPoiMask = 1024; });
    add('permille mismatch', (s) => { s.exploration.revealedPermille += 1; });
    add('distance mismatch', (s) => { s.exploration.distanceMilli += 1; });
  }
  cases.push(['null', null], ['empty', {}], ['array', []]);
  return cases;
}

test('schema versions 1-6 validate exactly as in 1.8.1, through either module', () => {
  const corpus = v1ToV6Corpus();
  for (const [label, validate] of [['base', validateUpTo6], ['v7 module', validateRunSummaryPayload]]) {
    const results = corpus.map(([name, payload]) => [name, validate(payload)]);
    const digest = createHash('sha256').update(JSON.stringify(results)).digest('hex');
    assert.equal(digest, V1_V6_CORPUS_DIGEST, `${label}: ${results.length} cases`);
    // Every committed schema-6 summary still validates.
    for (const [name, summary] of V6_BASES) assert.equal(validate(summary), '', `${label}: ${name}`);
  }
});

// The base module is on the initial path of the 1.8.x child (bridge.mjs
// validates its own messages) and of the portal (hmh-run-history.mjs), where
// the HMH initial-JS budget had about 1.8 KB left at 60ea173a. Schema 7 lives
// in sdk/hmh-run-summary-schema-v7.mjs so those bundles stay as they were.
test('the base schema module keeps schema 1-6 and its bundle size', async () => {
  assert.equal(validateUpTo6(asSchema7(REALISTIC)), 'game:run-summary schemaVersion is invalid', 'schema 7 needs the v7 module');
  assert.equal(validateRunSummaryPayload(asSchema7(REALISTIC)), '');
  assert.equal(BASE_CATALOGS_V6, HMH_RUN_SUMMARY_CATALOGS_V6, 'the v7 module re-exports the same V6 object');
  const base = readFileSync(new URL('../sdk/hmh-run-summary-schema.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(base, /\bimport\b/, 'the base module imports nothing');
  assert.doesNotMatch(base, /rug-puller|genesis-seal|scatter-pump|objectives:|prisonerSlots/, 'no V7 catalogue in the base module');
  // What the child and the portal take from it, bundled as build.mjs bundles them.
  const bundle = await build({
    stdin: { contents: "export { validateRunSummaryPayload, HMH_RUN_SUMMARY_CATALOGS, HMH_RUN_SUMMARY_ID_PATTERN } from './hmh-run-summary-schema.mjs';", resolveDir: fileURLToPath(new URL('../sdk/', import.meta.url)), loader: 'js' },
    bundle: true, minify: true, treeShaking: true, format: 'esm', target: ['es2020'], legalComments: 'none', write: false, logLevel: 'silent',
  });
  const bytes = bundle.outputFiles[0].contents.byteLength;
  // 10,802 bytes at 60ea173a; the shared-rules refactor costs a few dozen.
  assert.ok(bytes <= 10_802 + 64, `${bytes} bytes`);
});

// ---------------------------------------------------------------------------
// Catalogues (contract §3).
const C6 = HMH_RUN_SUMMARY_CATALOGS_V6;
const C7 = HMH_RUN_SUMMARY_CATALOGS_V7;
const deepFrozen = (value) => Object.isFrozen(value) && Object.values(value).every((child) => !child || typeof child !== 'object' || deepFrozen(child));

test('the V6 catalogues are the 1.8.1 object, frozen, and the default export', () => {
  assert.equal(HMH_RUN_SUMMARY_CATALOGS, HMH_RUN_SUMMARY_CATALOGS_V6, 'the same object');
  assert.equal(BASE_CATALOGS_V6, HMH_RUN_SUMMARY_CATALOGS_V6);
  assert.ok(deepFrozen(C6));
  assert.deepEqual(Object.fromEntries(Object.entries(C6).map(([name, ids]) => [name, ids.length])), {
    enemyRoles: 7, weapons: 11, collectibles: 13, upgrades: 24, districts: 6, pointsOfInterest: 10, worldSites: 6, secrets: 3, defeatKinds: 6,
  });
  // sha256 of the catalogue JSON at 60ea173a (1.8.1): not one id or index moved.
  assert.equal(createHash('sha256').update(JSON.stringify(C6)).digest('hex').slice(0, 16), 'a5e586a63f7e69f1');
  for (const version of [1, 2, 3, 4, 5, 6, undefined, null, 8]) assert.equal(hmhRunSummaryCatalogs(version), C6, String(version));
  assert.equal(hmhRunSummaryCatalogs(7), C7);
});

test('the V7 catalogues append to V6 in order and add four catalogues', () => {
  assert.ok(deepFrozen(C7));
  const appended = {
    enemyRoles: ['rug-puller', 'pump-and-dump-bloater', 'tollkeeper', 'hodl-revenant', 'money-printer', 'oracle-marksman', 'rug-pull-baron', 'lockkeeper', 'fifty-one-percent-foreman'],
    collectibles: ['genesis-seal'],
    upgrades: ['scatter-pump', 'scatter-dump', 'scatter-shells', 'miner-hashrate', 'miner-asic', 'miner-pool', 'rail-blocktime', 'rail-proof', 'rail-mempool', 'launcher-airdrop', 'launcher-yield', 'launcher-bandolier'],
    worldSites: ['relay-uplink', 'hashwood-log-pile', 'hashwood-beacon', 'hashwood-lookout', 'yard-bascule-lever'],
    secrets: ['crossing-behind-the-falls', 'hashwood-hollow-grove', 'mining-collapsed-adit'],
  };
  for (const [name, ids] of Object.entries(C6)) {
    assert.deepEqual(C7[name].slice(0, ids.length), [...ids], `${name}: every V6 index is unchanged`);
    assert.deepEqual(C7[name].slice(ids.length), appended[name] ?? [], `${name} appends`);
  }
  assert.deepEqual(Object.keys(C7), [...Object.keys(C6), 'objectives', 'bosses', 'prisonerSlots', 'evolutions']);
  assert.equal(C7.objectives.length, 25);
  assert.deepEqual(C7.objectives, [...C7.objectives].sort(), 'objectives are sorted by id');
  assert.deepEqual(C7.bosses, ['rug-pull-baron', 'lockkeeper', 'fifty-one-percent-foreman', 'liquidator']);
  for (const bossId of C7.bosses) assert.ok(C7.enemyRoles.includes(bossId), `${bossId} is an enemy role`);
  assert.equal(C7.prisonerSlots.length, 8);
  assert.deepEqual(C7.prisonerSlots, [...C7.prisonerSlots].sort(), 'prisoner slots are sorted by id');
  assert.deepEqual(C7.evolutions, ['settler-rail', 'double-spend', 'hashstorm-overdrive', 'crypto-bomb-orbit', 'crit-candle', 'lightning-network', 'burn-address', 'chain-split']);
  for (const [name, ids] of Object.entries(C7)) assert.equal(new Set(ids).size, ids.length, `${name} ids are unique`);
  // The Foreman's id can never collide with the Level 2 achievement l2-51-percent.
  assert.ok(!C7.enemyRoles.includes('fifty-one-percent'));
  // The machines are exactly the switch objectives, and the secrets exactly the secret objectives.
  const byClass = (kind) => C7.objectives.filter((id) => contract.HMH_V7_OBJECTIVES[id].class === kind);
  assert.deepEqual([...C7.worldSites].sort(), byClass('switch'));
  assert.deepEqual([...C7.secrets].sort(), byClass('secret'));
  assert.deepEqual(['switch', 'gate', 'item', 'secret'].map((kind) => byClass(kind).length), [11, 6, 2, 6]);
});

// ---------------------------------------------------------------------------
// The shared sdk contract module (contract §5). Parity with the 1.8.1 child is
// pinned in tests/server-verify-hmh-plausibility.test.mjs.
test('the v7 contract module is pure, clock-free and covers its catalogues', () => {
  const source = readFileSync(new URL('../sdk/hmh-run-contract-v7.mjs', import.meta.url), 'utf8');
  const imports = [...source.matchAll(/\bfrom\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g)].map((match) => match[1] ?? match[2]);
  assert.deepEqual(imports, ['./hmh-run-summary-schema-v7.mjs']);
  for (const file of ['../sdk/hmh-run-contract-v7.mjs', '../sdk/hmh-run-summary-schema.mjs', '../sdk/hmh-run-summary-schema-v7.mjs', '../server/verify/hmh-plausibility.mjs']) {
    const code = readFileSync(new URL(file, import.meta.url), 'utf8').replace(/\/\/.*$/gm, '');
    assert.doesNotMatch(code, /\bDate\b|performance\.|Math\.random|\bwindow\b|\bdocument\b|process\./, `${file} reads no clock and no host`);
  }
  for (const [table, ids] of [
    [contract.HMH_V7_ROLE_THREAT, C7.enemyRoles], [contract.HMH_V7_BOSSES, C7.bosses], [contract.HMH_V7_OBJECTIVES, C7.objectives],
    [contract.HMH_V7_PRISONER_SLOTS, C7.prisonerSlots], [contract.HMH_V7_EVOLUTIONS, C7.evolutions], [contract.HMH_V7_UPGRADES, C7.upgrades],
    [contract.HMH_V7_UPGRADE_MAX_RANKS, C7.upgrades],
  ]) {
    assert.deepEqual(Object.keys(table), [...ids]);
    assert.ok(deepFrozen(table));
  }
  for (const [slotId, slot] of Object.entries(contract.HMH_V7_PRISONER_SLOTS)) {
    assert.equal(slot.heldBy, HMH_V7_HELD_PRISONER_BOSSES[slotId] ?? null, slotId);
    assert.ok(C7.districts.includes(slot.district), slotId);
  }
  for (const [id, node] of Object.entries(contract.HMH_V7_OBJECTIVES)) {
    assert.ok(['switch', 'gate', 'item', 'secret'].includes(node.class), id);
    assert.ok(C7.districts.includes(node.district), id);
    if (node.requires) assert.ok(C7.objectives.includes(node.requires) && node.requires !== id, id);
  }
  for (const [bossId, boss] of Object.entries(contract.HMH_V7_BOSSES)) {
    assert.equal(boss.threat, contract.HMH_V7_ROLE_THREAT[bossId], bossId);
    assert.equal(boss.phaseThresholds.length, contract.HMH_V7_BOSS_RULES.BOSS_PHASE_THRESHOLDS, bossId);
    assert.ok(C7.districts.includes(boss.district), bossId);
  }
  assert.deepEqual(C7.bosses.map((id) => contract.HMH_V7_BOSSES[id].readyTick), [7_200, 18_000, 27_000, 36_000], 'ready in catalogue order');
  assert.deepEqual(C7.bosses.map((id) => contract.hmhV7KillXp(contract.HMH_V7_BOSSES[id].threat)), [560, 720, 880, 1_040]);
  assert.deepEqual(C7.bosses.map((id) => contract.hmhV7KillScore(contract.HMH_V7_BOSSES[id].threat)), [700, 900, 1_100, 1_300]);
  assert.deepEqual(C7.bosses.map((id) => contract.HMH_V7_BOSSES[id].silverBurst), [15, 20, 20, 25]);
  assert.deepEqual(C7.evolutions.map((id) => contract.HMH_V7_EVOLUTIONS[id].weaponId), C7.weapons.slice(0, 8), 'evolutions follow the weapon catalogue');
  for (const [evolutionId, evolution] of Object.entries(contract.HMH_V7_EVOLUTIONS)) {
    for (const [upgradeId, rank] of Object.entries(evolution.mastery)) assert.ok(rank >= 1 && rank <= contract.HMH_V7_UPGRADE_MAX_RANKS[upgradeId], `${evolutionId} ${upgradeId}`);
  }
  for (const id of C7.upgrades.slice(C6.upgrades.length)) {
    assert.equal(contract.HMH_V7_UPGRADES[id].maxRank, 3, id);
    assert.ok(C7.weapons.includes(contract.HMH_V7_UPGRADES[id].requiresWeaponId), id);
  }
  const rules = contract.HMH_V7_BOSS_RULES;
  assert.equal(rules.BOSS_MIN_FIGHT_TICKS, 300);
  assert.equal(rules.BOSS_MIN_FIGHT_TICKS, rules.BOSS_INTRO_MIN_TICKS + rules.BOSS_PHASE_THRESHOLDS * rules.BOSS_PHASE_HALT_TICKS);
  // The Dark Pool start has no intro (package 4.3): the Liquidator's minimum is the two halts.
  assert.equal(rules.BOSS_MIN_FIGHT_TICKS_WITHOUT_INTRO, rules.BOSS_PHASE_THRESHOLDS * rules.BOSS_PHASE_HALT_TICKS);
  assert.deepEqual(C7.bosses.map((id) => contract.HMH_V7_BOSSES[id].minFightTicks), [300, 300, 300, 180]);
  assert.equal(rules.BOSS_REINITIATION_MIN_TICKS, 2_520);
  // Only a slot's first adds are outside the capacity bank, and none comes in an engagement's first halt-length.
  assert.deepEqual([rules.BOSS_ADDS_FIRST, rules.BOSS_ADD_DELAY_TICKS], [4, 90]);
  assert.ok(!('BOSS_ADDS_PER_WINDOW' in rules) && !('BOSS_ADD_WINDOW_TICKS' in rules), 'further adds draw from the capacity bank');
  // Weapon gates and evolution rows: the schema's lists are the contract table's.
  for (const id of C7.upgrades) assert.equal(HMH_V7_UPGRADE_WEAPON_GATES[id] ?? null, contract.HMH_V7_UPGRADES[id].requiresWeaponId, id);
  assert.ok(Object.isFrozen(HMH_V7_UPGRADE_WEAPON_GATES));
  assert.deepEqual(C7.evolutions.filter((id) => contract.HMH_V7_EVOLUTIONS[id].wave === 2), [...HMH_V7_RESERVED_EVOLUTIONS]);
  assert.deepEqual(C7.evolutions.filter((id) => contract.HMH_V7_EVOLUTIONS[id].weaponId === HMH_V7_START_WEAPON), [...HMH_V7_PANEL_ONLY_EVOLUTIONS]);
  assert.equal(HMH_V7_START_WEAPON, C7.weapons[0]);
  // The build that may carry schema 7: a game version, read from the session build hash with no clock.
  assert.equal(contract.HMH_RUN_SUMMARY_V7_MIN_GAME_VERSION, '1.9.0');
  assert.deepEqual(contract.hmhGameVersionOfBuild('site-1.8.1:game-1.8.1'), [1, 8, 1]);
  assert.deepEqual(contract.hmhGameVersionOfBuild('game-2.10.3'), [2, 10, 3]);
  for (const buildHash of ['site-1.9.0', 'site-1.9.0:game-1.9', 'site-1.9.0:game-1.9.0x', 'dev', '', null, 7]) assert.equal(contract.hmhGameVersionOfBuild(buildHash), null, String(buildHash));
  for (const [buildHash, v7] of [['site-1.8.1:game-1.8.1', false], ['site-1.9.0:game-1.8.99', false], ['site-0.9.0:game-0.99.0', false], ['site-1.9.0:game-1.9.0', true],
    ['site-1.8.1:game-1.9.0', true], ['site-2.0.0:game-1.10.0', true], ['site-2.0.0:game-2.0.0', true], ['site-9.9.9', false], ['dev', false]]) {
    assert.equal(contract.isHmhV7Build(buildHash), v7, buildHash);
  }
  // Collectible pickups: at most 21 placements, re-armed every 7,200 ticks at the soonest.
  assert.deepEqual({ ...contract.HMH_V7_COLLECTIBLE_RULES }, { MAX_PLACEMENTS: 21, MIN_REARM_TICKS: 7_200 });
  assert.deepEqual([0, 7_199, 7_200, 64_800].map(contract.hmhV7CollectibleCapacity), [21, 21, 42, 210]);
  const run = contract.HMH_V7_RUN_RULES;
  assert.deepEqual(run.OBJECTIVE_XP_PER_LEVEL, { switch: 18, gate: 30, item: 12, secret: 60 });
  assert.deepEqual(Object.values(run.OBJECTIVE_XP_PER_LEVEL).map((perLevel) => perLevel / 300), [0.06, 0.1, 0.04, 0.2]);
  assert.equal(run.XP_MULTIPLIER_MAX, 1 + run.MULTIPLIER_PER_RANK * run.MULTIPLIER_MAX_RANK);
  assert.equal(run.SCORE_MULTIPLIER_MAX, 1 + run.MULTIPLIER_PER_RANK * run.MULTIPLIER_MAX_RANK);
  assert.equal(contract.hmhV7BossHp('liquidator', 8), 1_200);
  assert.throws(() => contract.hmhV7BossHp('boss-liquidator', 8), /unknown boss/);
  assert.equal(contract.isHmhV7BossReady('lockkeeper', 17_999), false);
  assert.equal(contract.isHmhV7BossReady('lockkeeper', 18_000), true);
});

// ---------------------------------------------------------------------------
// Schema 7 rules (contract §6). The base is the realistic v6 fixture written
// as schema 7 with every new row untouched; each rule is then broken at its
// nearest boundary, next to the value that still passes.
const REALISTIC = readFixture('hmh-realistic').body.evidence.runSummary;
const row = (rows, key, id) => rows.find((entry) => entry[key] === id);
const sumOf = (rows, field) => rows.reduce((total, entry) => total + entry[field], 0);

function asSchema7(summary) {
  return clone(summary, (s) => {
    s.schemaVersion = 7;
    const pad = (rows, ids, idKey, zero) => { for (const id of ids.slice(rows.length)) rows.push({ [idKey]: id, ...zero }); };
    pad(s.kills.byEnemyRole, C7.enemyRoles, 'enemyRoleId', { count: 0 });
    pad(s.collectibles, C7.collectibles, 'effectId', { collected: 0, activeTicks: 0 });
    pad(s.upgrades, C7.upgrades, 'upgradeId', { offered: 0, selected: 0 });
    pad(s.milestones.sites, C7.worldSites, 'siteId', { operated: 0, tick: 0 });
    pad(s.milestones.secrets, C7.secrets, 'secretId', { found: 0, tick: 0 });
    s.objectives = C7.objectives.map((objectiveId) => ({ objectiveId, completed: 0, tick: 0, levelAtCompletion: 0 }));
    s.prisoners = C7.prisonerSlots.map((slotId) => ({ slotId, rescued: 0, tick: 0, levelAtRescue: 0 }));
    s.bosses = C7.bosses.map((bossId) => ({ bossId, initiations: 0, firstInitiatedTick: 0, lastInitiatedTick: 0, defeatedTick: 0 }));
    s.evolutions = C7.evolutions.map((evolutionId) => ({ evolutionId, offered: 0, applied: 0 }));
    s.progression = { offersOpened: sumOf(s.upgrades, 'selected'), evolutionOffersOpened: 0, rerolls: 0, sealsFound: 0, sealsBanked: 0, evolutionsApplied: 0, revivesUsed: 0 };
  });
}
const BASE = asSchema7(REALISTIC);
const T = BASE.identity.endTick;
const L = BASE.totals.level;

// Consistent edits on a schema-7 draft.
function addKill(s, role, weaponId = 'coin-blaster') {
  s.kills.total += 1;
  row(s.kills.byEnemyRole, 'enemyRoleId', role).count += 1;
  row(s.kills.byWeapon, 'weaponId', weaponId).count += 1;
  row(s.weapons, 'weaponId', weaponId).kills += 1;
  if (role === 'liquidator') s.kills.boss += 1;
}
function boss(s, bossId, { initiations = 1, first, last = first, defeated = 0 }) {
  Object.assign(row(s.bosses, 'bossId', bossId), { initiations, firstInitiatedTick: first, lastInitiatedTick: last, defeatedTick: defeated });
  if (defeated > 0) addKill(s, bossId);
  if (bossId === 'liquidator') s.milestones.bossEngagedTick = first;
}
function complete(s, objectiveId, tick, level) {
  Object.assign(row(s.objectives, 'objectiveId', objectiveId), { completed: 1, tick, levelAtCompletion: level });
  const site = row(s.milestones.sites, 'siteId', objectiveId);
  if (site) Object.assign(site, { operated: 1, tick });
  const secret = row(s.milestones.secrets, 'secretId', objectiveId);
  if (secret) Object.assign(secret, { found: 1, tick });
}
function rescue(s, slotId, tick, level) {
  Object.assign(row(s.prisoners, 'slotId', slotId), { rescued: 1, tick, levelAtRescue: level });
}
function seals(s, found, applied = []) {
  s.progression.sealsFound = found;
  s.progression.evolutionsApplied = applied.length;
  s.progression.sealsBanked = found - applied.length;
  s.progression.evolutionOffersOpened = Math.min(found, applied.length);
  row(s.collectibles, 'effectId', 'genesis-seal').collected = found;
  for (const id of applied) Object.assign(row(s.evolutions, 'evolutionId', id), { offered: 1, applied: 1 });
}
const v7 = (mutate) => clone(BASE, mutate);
const accepts = (mutate, label) => assert.equal(validateRunSummaryPayload(v7(mutate)), '', label);
const refuses = (mutate, message, label) => assert.equal(validateRunSummaryPayload(v7(mutate)), message, label);

test('a schema-7 summary with untouched new rows is valid, and so is a four-boss one', () => {
  assert.equal(validateRunSummaryPayload(BASE), '');
  accepts((s) => {
    boss(s, 'rug-pull-baron', { first: 7_200, defeated: 7_600 });
    boss(s, 'lockkeeper', { initiations: 2, first: 18_000, last: 20_520, defeated: 21_000 });
    boss(s, 'fifty-one-percent-foreman', { first: 27_000, defeated: 27_400 });
    complete(s, 'warehouse-logbook', 36_000, L);
    boss(s, 'liquidator', { first: 36_000, defeated: 36_400 });
    rescue(s, 'h1-baron-diggings', 7_700, 10);
    rescue(s, 'h2-foreman-hoist-vault', 27_500, 18);
    seals(s, 4, ['settler-rail']);
    s.progression.revivesUsed = 1;
  }, 'four bosses, both held prisoners, a Dark Pool revive');
});

test('S1: the new fields are exact, dense and in catalogue order', () => {
  for (const field of ['objectives', 'prisoners', 'bosses', 'evolutions', 'progression']) {
    refuses((s) => { delete s[field]; }, 'game:run-summary payload must contain exact fields', `without ${field}`);
    refuses((s) => { delete s[field]; s.extra = 1; }, 'game:run-summary payload has unexpected field: extra', `${field} replaced`);
  }
  refuses((s) => { s.ruleset = 1; }, 'game:run-summary payload must contain exact fields', 'no ruleset field (owner override 1)');
  refuses((s) => { s.objectives.reverse(); }, 'game:run-summary objectives[0] id is invalid');
  refuses((s) => { s.prisoners.pop(); }, 'game:run-summary prisoners rows are invalid');
  refuses((s) => { s.bosses[0].extra = 0; }, 'game:run-summary bosses[0] must contain exact fields');
  refuses((s) => { s.evolutions[7].offered = 1.5; }, 'game:run-summary evolutions[7].offered is invalid');
  refuses((s) => { s.progression.rerolls = -1; }, 'game:run-summary progression.rerolls is invalid');
  refuses((s) => { delete s.progression.revivesUsed; }, 'game:run-summary progression must contain exact fields');
  // The V6 row counts are refused in a schema-7 summary, and V7 rows in a schema-6 one.
  refuses((s) => { s.upgrades = s.upgrades.slice(0, 24); }, 'game:run-summary upgrades rows are invalid');
  refuses((s) => { s.kills.byEnemyRole = s.kills.byEnemyRole.slice(0, 7); }, 'game:run-summary kills.byEnemyRole rows are invalid');
  refuses((s) => { s.milestones.secrets = s.milestones.secrets.slice(0, 3); }, 'game:run-summary secrets rows are invalid');
  assert.equal(validateRunSummaryPayload(clone(REALISTIC, (s) => { s.objectives = BASE.objectives; })), 'game:run-summary payload must contain exact fields');
  assert.equal(validateRunSummaryPayload(clone(BASE, (s) => { s.schemaVersion = 6; })), 'game:run-summary payload must contain exact fields');
});

test('S2 and S3: a node completes once, inside the run, at a level the run reached', () => {
  const message = 'game:run-summary objectives are invalid';
  accepts((s) => complete(s, 'relay-barn-doors', T, L));
  refuses((s) => complete(s, 'relay-barn-doors', T + 1, L), message);
  accepts((s) => complete(s, 'relay-barn-doors', 60, 1));
  refuses((s) => complete(s, 'relay-barn-doors', 60, 0), message);
  refuses((s) => complete(s, 'relay-barn-doors', 60, L + 1), message);
  refuses((s) => { complete(s, 'relay-barn-doors', 60, 1); row(s.objectives, 'objectiveId', 'relay-barn-doors').completed = 2; }, message);
  refuses((s) => { row(s.objectives, 'objectiveId', 'relay-barn-doors').tick = 60; }, message, 'a tick without a completion');
  refuses((s) => { row(s.objectives, 'objectiveId', 'relay-barn-doors').levelAtCompletion = 1; }, message, 'a level without a completion');
  const cages = 'game:run-summary prisoners are invalid';
  accepts((s) => rescue(s, 'p1-relay-barn-yard', T, L));
  refuses((s) => rescue(s, 'p1-relay-barn-yard', T + 1, L), cages);
  refuses((s) => rescue(s, 'p1-relay-barn-yard', 60, 0), cages);
  refuses((s) => rescue(s, 'p1-relay-barn-yard', 60, L + 1), cages);
  refuses((s) => { rescue(s, 'p1-relay-barn-yard', 60, 1); row(s.prisoners, 'slotId', 'p1-relay-barn-yard').rescued = 2; }, cages);
  refuses((s) => { row(s.prisoners, 'slotId', 'p1-relay-barn-yard').tick = 60; }, cages);
});

test('S4: initiations bound the boss ticks, and a defeat follows the last initiation', () => {
  const message = 'game:run-summary bosses are invalid';
  refuses((s) => { row(s.bosses, 'bossId', 'lockkeeper').firstInitiatedTick = 18_000; }, message, 'ticks without an initiation');
  refuses((s) => { row(s.bosses, 'bossId', 'lockkeeper').defeatedTick = 18_400; addKill(s, 'lockkeeper'); }, message, 'a defeat without an initiation');
  accepts((s) => boss(s, 'lockkeeper', { first: 18_000 }));
  accepts((s) => boss(s, 'lockkeeper', { first: T }));
  refuses((s) => boss(s, 'lockkeeper', { first: T + 1 }), message);
  refuses((s) => boss(s, 'lockkeeper', { first: 18_000, last: 20_520 }), message, 'one initiation, two ticks');
  refuses((s) => boss(s, 'lockkeeper', { initiations: 2, first: 18_000 }), message, 'two initiations, one tick');
  refuses((s) => boss(s, 'lockkeeper', { initiations: 2, first: 20_520, last: 18_000 }), message, 'first after last');
  accepts((s) => boss(s, 'lockkeeper', { initiations: 2, first: 18_000, last: 20_520 }));
  accepts((s) => boss(s, 'lockkeeper', { first: 18_000, defeated: 18_001 }), 'the fight length is a plausibility rule');
  refuses((s) => boss(s, 'lockkeeper', { first: 18_000, defeated: 18_000 }), message);
  accepts((s) => boss(s, 'lockkeeper', { first: 18_000, defeated: T }));
  refuses((s) => boss(s, 'lockkeeper', { first: 18_000, defeated: T + 1 }), message);
});

test('S5 and S6: one kill per boss, exactly when its row records the defeat; kills.boss is the Liquidator', () => {
  const message = 'game:run-summary boss kills do not match the bosses rows';
  refuses((s) => { boss(s, 'rug-pull-baron', { first: 7_200, defeated: 7_600 }); addKill(s, 'rug-pull-baron'); }, message, 'two Baron kills');
  refuses((s) => { boss(s, 'rug-pull-baron', { first: 7_200 }); addKill(s, 'rug-pull-baron'); }, message, 'a kill without a defeat');
  refuses((s) => { Object.assign(row(s.bosses, 'bossId', 'rug-pull-baron'), { initiations: 1, firstInitiatedTick: 7_200, lastInitiatedTick: 7_200, defeatedTick: 7_600 }); }, message, 'a defeat without a kill');
  refuses((s) => { boss(s, 'liquidator', { first: 36_000, defeated: 36_400 }); addKill(s, 'liquidator'); }, message, 'two Liquidator kills');
  const liquidatorOnly = 'game:run-summary kills.boss must count the Liquidator only';
  refuses((s) => { boss(s, 'rug-pull-baron', { first: 7_200, defeated: 7_600 }); s.kills.boss = 1; }, liquidatorOnly, 'a district boss counted as the boss');
  refuses((s) => { boss(s, 'liquidator', { first: 36_000, defeated: 36_400 }); s.kills.boss = 0; }, liquidatorOnly);
  accepts((s) => { boss(s, 'liquidator', { first: 36_000, defeated: 36_400 }); assert.equal(s.kills.boss, 1); });
  accepts((s) => { for (const [bossId, first] of [['rug-pull-baron', 7_200], ['lockkeeper', 18_000], ['fifty-one-percent-foreman', 27_000], ['liquidator', 36_000]]) boss(s, bossId, { first, defeated: first + 400 }); assert.equal(s.kills.boss, 1); });
});

test('S7: bossEngagedTick is the Liquidator first initiation', () => {
  const message = 'game:run-summary bossEngagedTick must be the Liquidator initiation';
  refuses((s) => { boss(s, 'liquidator', { first: 36_000 }); s.milestones.bossEngagedTick = 0; }, message);
  refuses((s) => { boss(s, 'liquidator', { initiations: 2, first: 36_000, last: 38_520 }); s.milestones.bossEngagedTick = 38_520; }, message);
  refuses((s) => { boss(s, 'rug-pull-baron', { first: 7_200 }); s.milestones.bossEngagedTick = 7_200; }, message, 'a district boss is not the boss engagement');
  accepts((s) => boss(s, 'liquidator', { initiations: 2, first: 36_000, last: 38_520 }));
});

test('S8: the machines and secrets say what their objectives say', () => {
  const message = 'game:run-summary milestones do not match the objectives';
  accepts((s) => complete(s, 'relay-power', 600, 2));
  accepts((s) => complete(s, 'hashwood-lookout', 600, 2), 'a v7 machine');
  accepts((s) => complete(s, 'mining-collapsed-adit', 600, 2), 'a v7 secret');
  refuses((s) => { complete(s, 'relay-power', 600, 2); row(s.milestones.sites, 'siteId', 'relay-power').tick = 660; }, message);
  refuses((s) => { complete(s, 'relay-power', 600, 2); Object.assign(row(s.milestones.sites, 'siteId', 'relay-power'), { operated: 0, tick: 0 }); }, message);
  refuses((s) => { Object.assign(row(s.milestones.sites, 'siteId', 'yard-bascule-lever'), { operated: 1, tick: 600 }); }, message, 'a machine operated without its objective');
  refuses((s) => { complete(s, 'warehouse-logbook', 600, 2); Object.assign(row(s.milestones.secrets, 'secretId', 'warehouse-logbook'), { found: 0, tick: 0 }); }, message);
});

// S8 is the only guard of the A2-1 fix (secret silver needs the secret's
// objective, whose node XP is bounded), so each half of each row comparison
// is refused on its own: every payload below breaks exactly one of `completed
// === found/operated` and `tick === tick`, and passes every earlier clause
// (an untouched row is 0 at tick 0; a completed node may sit at tick 0).
test('S8: each half of the machine and secret comparison refuses on its own', () => {
  const message = 'game:run-summary milestones do not match the objectives';
  const secret = (s, id, found, tick) => Object.assign(row(s.milestones.secrets, 'secretId', id), { found, tick });
  const site = (s, id, operated, tick) => Object.assign(row(s.milestones.sites, 'siteId', id), { operated, tick });
  const objective = (s, id, completed, tick, level) => Object.assign(row(s.objectives, 'objectiveId', id), { completed, tick, levelAtCompletion: level });
  for (const id of C7.secrets) {
    // found = 1 at tick 0 while the objective is untouched (0 at tick 0): only `found` differs.
    refuses((s) => secret(s, id, 1, 0), message, `${id}: found without its objective`);
    // The objective completed at tick 0 while the secret row is untouched: only `found` differs, at matching ticks.
    refuses((s) => objective(s, id, 1, 0, 1), message, `${id}: objective without the secret`);
    // Both say found and completed; only the tick differs.
    refuses((s) => { complete(s, id, 600, 2); secret(s, id, 1, 601); }, message, `${id}: tick only`);
    // The matching pairs pass.
    accepts((s) => { objective(s, id, 1, 0, 1); secret(s, id, 1, 0); }, `${id} at tick 0`);
    accepts((s) => complete(s, id, 600, 2), id);
  }
  for (const id of C7.worldSites) {
    refuses((s) => site(s, id, 1, 0), message, `${id}: operated without its objective`);
    refuses((s) => objective(s, id, 1, 0, 1), message, `${id}: objective without the machine`);
    refuses((s) => { complete(s, id, 600, 2); site(s, id, 1, 599); }, message, `${id}: tick only`);
    accepts((s) => { objective(s, id, 1, 0, 1); site(s, id, 1, 0); }, `${id} at tick 0`);
  }
});

// Attack 2 K1 claimed all six secrets (their silver) in a zero-kill run; the
// plausibility rules reject it through the secrets' node XP
// (tests/server-verify-hmh-plausibility.test.mjs). Its milestone-only
// variant claims the secrets in milestones.secrets alone, so no objective
// grants node XP to bound; the schema refuses it, and only by S8.
test('S8 refuses the milestone-only variant of the A2-1 K1 payload', () => {
  const message = 'game:run-summary milestones do not match the objectives';
  const k1 = (s, { objectives }) => {
    for (const id of C7.secrets) {
      Object.assign(row(s.milestones.secrets, 'secretId', id), { found: 1, tick: 60 });
      if (objectives) Object.assign(row(s.objectives, 'objectiveId', id), { completed: 1, tick: 60, levelAtCompletion: 1 });
    }
  };
  accepts((s) => k1(s, { objectives: true }), 'the K1 payload itself is schema-valid');
  refuses((s) => k1(s, { objectives: false }), message, 'the milestone-only variant');
  // One secret claimed through its milestone alone is enough to refuse.
  refuses((s) => { k1(s, { objectives: true }); Object.assign(row(s.objectives, 'objectiveId', 'mining-collapsed-adit'), { completed: 0, tick: 0, levelAtCompletion: 0 }); }, message);
});

test('S9: a held prisoner is freed only after its boss was initiated', () => {
  const message = 'game:run-summary a held prisoner was rescued before its boss';
  refuses((s) => rescue(s, 'h1-baron-diggings', 9_000, 10), message, 'the Baron never initiated');
  refuses((s) => { boss(s, 'rug-pull-baron', { first: 7_200 }); rescue(s, 'h1-baron-diggings', 7_199, 10); }, message);
  accepts((s) => { boss(s, 'rug-pull-baron', { first: 7_200 }); rescue(s, 'h1-baron-diggings', 7_200, 10); }, 'a champion arena frees it without a kill');
  refuses((s) => { boss(s, 'rug-pull-baron', { first: 27_000 }); rescue(s, 'h2-foreman-hoist-vault', 27_600, 18); }, message, 'the wrong boss');
  accepts((s) => { boss(s, 'fifty-one-percent-foreman', { first: 27_000, defeated: 27_400 }); seals(s, 1); rescue(s, 'h2-foreman-hoist-vault', 27_600, 18); });
  // A defeated boss's cage is behind its reward gate: freed from the defeat on (red team: h2 freed while the Foreman lived).
  accepts((s) => { boss(s, 'fifty-one-percent-foreman', { first: 27_000, defeated: 27_400 }); seals(s, 1); rescue(s, 'h2-foreman-hoist-vault', 27_400, 18); });
  refuses((s) => { boss(s, 'fifty-one-percent-foreman', { first: 27_000, defeated: 27_400 }); seals(s, 1); rescue(s, 'h2-foreman-hoist-vault', 27_399, 18); }, message, 'freed during the fight');
  refuses((s) => { boss(s, 'fifty-one-percent-foreman', { first: 27_000, defeated: 40_000 }); seals(s, 1); rescue(s, 'h2-foreman-hoist-vault', 29_400, 18); }, message, 'the red-team payload');
});

test('S10-S12: evolutions, Genesis Seals and the genesis-seal collectible agree', () => {
  const defeatTwo = (s) => { boss(s, 'rug-pull-baron', { first: 7_200, defeated: 7_600 }); boss(s, 'lockkeeper', { first: 18_000, defeated: 18_400 }); };
  accepts((s) => { defeatTwo(s); seals(s, 2, ['settler-rail']); });
  const evolutions = 'game:run-summary evolutions are invalid';
  refuses((s) => { defeatTwo(s); seals(s, 2, ['settler-rail']); row(s.evolutions, 'evolutionId', 'settler-rail').applied = 2; s.progression.evolutionsApplied = 2; s.progression.sealsBanked = 0; }, evolutions);
  refuses((s) => { defeatTwo(s); seals(s, 2, ['settler-rail']); s.progression.evolutionsApplied = 0; s.progression.sealsBanked = 2; }, evolutions);
  const sealsMessage = 'game:run-summary Genesis Seals are inconsistent';
  accepts((s) => { defeatTwo(s); seals(s, 2); });
  refuses((s) => { defeatTwo(s); seals(s, 3); }, sealsMessage, 'more Seals than defeated bosses');
  refuses((s) => { boss(s, 'rug-pull-baron', { first: 7_200 }); seals(s, 1); }, sealsMessage, 'a champion arena drops no Seal');
  refuses((s) => { defeatTwo(s); seals(s, 1, ['settler-rail', 'double-spend']); s.progression.sealsBanked = 0; }, sealsMessage, 'more evolutions than Seals');
  refuses((s) => { defeatTwo(s); seals(s, 2, ['settler-rail']); s.progression.sealsBanked = 2; }, sealsMessage, 'a Seal both applied and banked');
  accepts((s) => { defeatTwo(s); seals(s, 2); s.progression.evolutionOffersOpened = 2; });
  refuses((s) => { defeatTwo(s); seals(s, 2); s.progression.evolutionOffersOpened = 3; }, sealsMessage, 'more evolution panels than Seals');
  const pickups = 'game:run-summary genesis-seal pickups are inconsistent';
  refuses((s) => { defeatTwo(s); seals(s, 2); row(s.collectibles, 'effectId', 'genesis-seal').collected = 1; }, pickups);
  refuses((s) => { defeatTwo(s); seals(s, 2); row(s.collectibles, 'effectId', 'genesis-seal').activeTicks = 1; }, pickups);
  // The wave-2 rows stay 0 (red team: lightning-network applied with a banked Seal).
  accepts((s) => { defeatTwo(s); seals(s, 2, ['crit-candle']); }, 'a wave-1 evolution of an owned gun');
  for (const id of HMH_V7_RESERVED_EVOLUTIONS) {
    refuses((s) => { defeatTwo(s); seals(s, 2, [id]); }, evolutions, `${id} applied`);
    refuses((s) => { defeatTwo(s); seals(s, 2); s.progression.evolutionOffersOpened = 1; row(s.evolutions, 'evolutionId', id).offered = 1; }, evolutions, `${id} shown`);
  }
  // The Pistol never evolves automatically: Settler Rail needs a panel that showed it (red team: applied, offered 0, no panel).
  refuses((s) => { defeatTwo(s); seals(s, 2, ['settler-rail']); row(s.evolutions, 'evolutionId', 'settler-rail').offered = 0; s.progression.evolutionOffersOpened = 0; }, evolutions, 'the Pistol evolved without a panel');
  accepts((s) => { defeatTwo(s); seals(s, 2, ['crit-candle']); row(s.evolutions, 'evolutionId', 'crit-candle').offered = 0; s.progression.evolutionOffersOpened = 0; }, 'a single mastered gun evolves at once, with no panel');
});

test('S13-S15: offers, picks, re-rolls and shown cards add up', () => {
  const offers = 'game:run-summary level-up offers are inconsistent';
  accepts((s) => { s.progression.offersOpened = L - 1; });
  refuses((s) => { s.progression.offersOpened = L; }, offers);
  refuses((s) => { s.progression.offersOpened = sumOf(s.upgrades, 'selected') - 1; }, offers, 'more picks than offers');
  const rerolls = 'game:run-summary rerolls are inconsistent';
  accepts((s) => { s.progression.rerolls = 2 * s.progression.offersOpened; });
  refuses((s) => { s.progression.rerolls = 2 * s.progression.offersOpened + 1; }, rerolls);
  const cards = 'game:run-summary offered cards are inconsistent';
  assert.equal(sumOf(BASE.upgrades, 'offered'), 2 * BASE.progression.offersOpened, 'the base shows two cards per offer');
  // rail-blocktime: a Railgun card, and the realistic run owns the Railgun.
  accepts((s) => { s.progression.rerolls = 3; row(s.upgrades, 'upgradeId', 'rail-blocktime').offered = 3; });
  refuses((s) => { s.progression.rerolls = 3; row(s.upgrades, 'upgradeId', 'rail-blocktime').offered = 4; }, cards);
  refuses((s) => { row(s.upgrades, 'upgradeId', 'rail-blocktime').offered = 1; }, cards, 'a card shown with no offer or re-roll');
  // Two panels, two different Pistol evolution cards at most: one card per panel.
  const withPanels = (s, panels) => {
    boss(s, 'rug-pull-baron', { first: 7_200, defeated: 7_600 });
    boss(s, 'lockkeeper', { first: 18_000, defeated: 18_400 });
    seals(s, 2);
    s.progression.evolutionOffersOpened = panels;
  };
  accepts((s) => { withPanels(s, 1); row(s.evolutions, 'evolutionId', 'settler-rail').offered = 1; row(s.evolutions, 'evolutionId', 'crit-candle').offered = 1; });
  accepts((s) => { withPanels(s, 2); row(s.evolutions, 'evolutionId', 'settler-rail').offered = 2; });
  refuses((s) => { withPanels(s, 1); s.progression.rerolls = 1; row(s.evolutions, 'evolutionId', 'settler-rail').offered = 2; }, cards, 'a card shown twice in one panel');
  refuses((s) => { withPanels(s, 2); row(s.evolutions, 'evolutionId', 'settler-rail').offered = 2; row(s.evolutions, 'evolutionId', 'crit-candle').offered = 3; }, cards);
  // A card never comes back in its offer: at most one showing per offer (red team: diamond-hands shown 48 times in 23 offers).
  const offered = row(BASE.upgrades, 'upgradeId', 'hardened-wallet').offered;
  accepts((s) => { s.progression.rerolls = BASE.progression.offersOpened - offered; row(s.upgrades, 'upgradeId', 'hardened-wallet').offered = BASE.progression.offersOpened; });
  refuses((s) => { s.progression.rerolls = BASE.progression.offersOpened - offered + 1; row(s.upgrades, 'upgradeId', 'hardened-wallet').offered = BASE.progression.offersOpened + 1; }, cards, 'one more showing than offers');
  // A re-roll shows one card, in a level panel or an evolution panel, never both
  // (red team: evolution cards counted against level-panel re-rolls, with no evolution panel).
  refuses((s) => { withPanels(s, 0); s.progression.rerolls = 2; row(s.upgrades, 'upgradeId', 'rail-blocktime').offered = 2; row(s.evolutions, 'evolutionId', 'settler-rail').offered = 1; }, cards, 'an evolution card with no evolution panel');
  refuses((s) => { withPanels(s, 1); s.progression.rerolls = 2; row(s.upgrades, 'upgradeId', 'rail-blocktime').offered = 2; row(s.evolutions, 'evolutionId', 'settler-rail').offered = 1; row(s.evolutions, 'evolutionId', 'crit-candle').offered = 1; row(s.evolutions, 'evolutionId', 'double-spend').offered = 1; row(s.weapons, 'weaponId', 'scatter-shotgun').pickups = 1; }, cards, 'the same re-rolls counted in both kinds of panel');
  accepts((s) => { withPanels(s, 1); s.progression.rerolls = 2; row(s.upgrades, 'upgradeId', 'rail-blocktime').offered = 1; row(s.evolutions, 'evolutionId', 'settler-rail').offered = 1; row(s.evolutions, 'evolutionId', 'crit-candle').offered = 1; row(s.evolutions, 'evolutionId', 'double-spend').offered = 1; row(s.weapons, 'weaponId', 'scatter-shotgun').pickups = 1; });
});

test('S16: the one revive is the Golden Parachute of a Dark Pool win', () => {
  const message = 'game:run-summary the revive has no Golden Parachute';
  const darkPool = (s, logbookTick = 36_000) => {
    complete(s, 'warehouse-logbook', logbookTick, L);
    boss(s, 'liquidator', { first: 36_000, defeated: 36_400 });
    seals(s, 1);
  };
  accepts((s) => { darkPool(s); s.progression.revivesUsed = 1; });
  refuses((s) => { darkPool(s); s.progression.revivesUsed = 2; }, message);
  refuses((s) => { s.progression.revivesUsed = 1; }, message, 'no Liquidator');
  refuses((s) => { boss(s, 'liquidator', { first: 36_000 }); complete(s, 'warehouse-logbook', 36_000, L); s.progression.revivesUsed = 1; }, message, 'the Liquidator not defeated');
  refuses((s) => { boss(s, 'liquidator', { first: 36_000, defeated: 36_400 }); seals(s, 1); s.progression.revivesUsed = 1; }, message, 'a Closing Bell win');
  refuses((s) => { darkPool(s, 36_001); s.progression.revivesUsed = 1; }, message, 'the logbook entered after the initiation');
  accepts((s) => { darkPool(s, 30_000); s.progression.revivesUsed = 1; }, 'the logbook found earlier, the Dark Pool entered once the Liquidator was ready');
  // The first trigger owns every later initiation (package 4.3): a Closing Bell
  // start, a retreat, then the logbook, is still a Closing Bell fight.
  const bellFirst = (s, logbookTick) => {
    boss(s, 'liquidator', { initiations: 2, first: 36_000, last: 38_520, defeated: 38_920 });
    complete(s, 'warehouse-logbook', logbookTick, L);
    seals(s, 1);
    s.progression.revivesUsed = 1;
  };
  refuses((s) => bellFirst(s, 37_000), message, 'the logbook between the first and the last initiation');
  refuses((s) => bellFirst(s, 36_001), message);
  accepts((s) => bellFirst(s, 36_000), 'a Dark Pool first initiation owns the re-initiation');
});

test('S17: a boss defeat needs a boss that was live then', () => {
  const message = 'game:run-summary a boss defeat needs a live boss';
  const killedBy = (s, tick) => { s.defeat = { kind: 'boss', causeId: 'boss-crash-lane', tick, damage: 25 }; };
  // Red team: the districts run, the Liquidator never initiated, 'killed by boss-liquidator'.
  refuses((s) => killedBy(s, T), message, 'no boss initiated');
  accepts((s) => { boss(s, 'lockkeeper', { first: 60_000 }); killedBy(s, 60_000); });
  refuses((s) => { boss(s, 'lockkeeper', { first: 60_001 }); killedBy(s, 60_000); }, message, 'initiated after the killing hit');
  // A strike still resolving just after the boss falls, but not long after (red team: the districts run, both bosses fallen long before).
  accepts((s) => { boss(s, 'rug-pull-baron', { first: 7_200, defeated: 7_600 }); seals(s, 1); killedBy(s, 7_900); });
  refuses((s) => { boss(s, 'rug-pull-baron', { first: 7_200, defeated: 7_600 }); seals(s, 1); killedBy(s, 7_901); }, message, 'the Baron fell 301 ticks before');
  refuses((s) => { boss(s, 'rug-pull-baron', { first: 7_200, defeated: 7_600 }); seals(s, 1); killedBy(s, T); }, message);
  accepts((s) => { boss(s, 'rug-pull-baron', { first: 7_200, defeated: 7_600 }); boss(s, 'lockkeeper', { first: 60_000 }); seals(s, 1); killedBy(s, T); }, 'a boss still live at the end');
});

test('S18: a gun card or evolution is shown only for a gun the run owns', () => {
  const message = 'game:run-summary a gun card was shown for a gun the run never owned';
  const draw = (s, upgradeId) => { s.progression.rerolls = 1; row(s.upgrades, 'upgradeId', upgradeId).offered = 1; };
  refuses((s) => draw(s, 'scatter-pump'), message, 'the Shotgun never picked up');
  accepts((s) => { draw(s, 'scatter-pump'); row(s.weapons, 'weaponId', 'scatter-shotgun').pickups = 1; });
  accepts((s) => draw(s, 'rail-blocktime'), 'the Railgun was picked up');
  refuses((s) => { draw(s, 'ledger-voltage'); row(s.weapons, 'weaponId', 'lightning-ledger').pickups = 0; }, message, 'a 1.8.1 gun branch too');
  // Red team: Double Spend applied with the Shotgun row at pickups 0 and equippedTicks 0.
  const evolve = (s, id) => {
    boss(s, 'rug-pull-baron', { first: 7_200, defeated: 7_600 });
    seals(s, 1, [id]);
  };
  refuses((s) => evolve(s, 'double-spend'), message, 'the Shotgun evolved without being owned');
  refuses((s) => { evolve(s, 'double-spend'); row(s.evolutions, 'evolutionId', 'double-spend').offered = 0; s.progression.evolutionOffersOpened = 0; }, message, 'and without a panel');
  accepts((s) => { evolve(s, 'double-spend'); row(s.weapons, 'weaponId', 'scatter-shotgun').pickups = 1; });
  accepts((s) => evolve(s, 'settler-rail'), 'the Pistol is owned from the start');
});

// ---------------------------------------------------------------------------
// Bridge size (contract §12): the widest schema-7 message still fits the
// unchanged hmh-bridge/v1 limit of 65,536 bytes.
function maximalPayload(C, version) {
  const big = 1_000_000_000;
  // The widest JSON a finite float field in [0, 10^9] can print: 17 significant
  // digits after five leading zeros (24 characters; smaller values switch to an
  // exponent, which prints at most 23).
  const wide = 1.2345678901234567e-6;
  const fields = (names) => Object.fromEntries(names.map((field) => [field, big]));
  const rowsOf = (ids, idKey, names) => ids.map((id) => ({ [idKey]: id, ...fields(names) }));
  const payload = {
    schemaVersion: version,
    identity: { seed: 0xffff_ffff, buildHash: 'b'.repeat(128), mode: 'ranked', heroId: 'h'.repeat(64), terminalReason: 'runtime-error', startTick: big, endTick: big },
    totals: { ...fields(['survivalTicks']), elapsedMs: wide, score: 1_000_000_000_000, level: big, xp: 1_000_000_000_000, ...fields(['litecoin', 'currentCombo', 'maxCombo', 'damageDealt', 'damageTaken', 'healing', 'distanceMilli']) },
    kills: { total: big, byEnemyRole: rowsOf(C.enemyRoles, 'enemyRoleId', ['count']), byWeapon: rowsOf(C.weapons, 'weaponId', ['count']), elite: big, boss: big },
    weapons: rowsOf(C.weapons, 'weaponId', ['pickups', 'swaps', 'triggers', 'triggerContacts', 'projectilesEmitted', 'projectileContacts', 'reloadStarts', 'reloadCompletes', 'emptyAttempts', 'equippedTicks', 'damage', 'kills', 'criticalHits', 'overkill', 'chargesStarted', 'chargesCancelled', 'chargedShots', 'cancelledChargeTicks', 'zeroHitShots', 'oneHitShots', 'twoHitShots', 'threePlusHitShots', 'bossHits', 'damageTakenWhileEquipped']),
    lightningLedger: { ...fields(['pulses', 'chainedHits', 'longestChain', 'maxRampPermille', 'heldTicks']), secondsHeld: wide, ...fields(['cellsSpent', 'cellsRefunded', 'fullChains', 'overheats', 'capstonePulses']), interruptions: fields(['release', 'switch', 'dodge', 'empty', 'overheat', 'invalidTarget', 'other']) },
    bearMarketBurner: fields(['pulses', 'contacts', 'fuelSpent', 'burnTicks', 'scorchZonesCreated', 'maxActiveBurns', 'totalSelloffPulses', 'emergencyRefills']),
    forkedStandard: fields(['attacks', 'contacts', 'whiffs', 'thrusts', 'sweeps', 'capstoneAttacks', 'droppedContacts']),
    grenades: fields(['thrown', 'detonated', 'contacts', 'kills', 'selfDamage', 'overflows']),
    collectibles: rowsOf(C.collectibles, 'effectId', ['collected', 'activeTicks']),
    upgrades: rowsOf(C.upgrades, 'upgradeId', ['offered', 'selected']),
    exploration: fields(['visitedDistrictMask', 'discoveredPoiMask', 'revealedCells', 'totalCells', 'revealedPermille', 'distanceMilli']),
    defeat: { kind: 'unknown', causeId: 'c'.repeat(64), tick: big, damage: wide },
    milestones: { ...fields(['levelUps', 'firstLevelUpTick', 'lastLevelUpTick', 'bossEngagedTick']), sites: rowsOf(C.worldSites, 'siteId', ['operated', 'tick']), secrets: rowsOf(C.secrets, 'secretId', ['found', 'tick']) },
  };
  if (version === 7) {
    Object.assign(payload, {
      objectives: rowsOf(C.objectives, 'objectiveId', ['completed', 'tick', 'levelAtCompletion']),
      prisoners: rowsOf(C.prisonerSlots, 'slotId', ['rescued', 'tick', 'levelAtRescue']),
      bosses: rowsOf(C.bosses, 'bossId', ['initiations', 'firstInitiatedTick', 'lastInitiatedTick', 'defeatedTick']),
      evolutions: rowsOf(C.evolutions, 'evolutionId', ['offered', 'applied']),
      progression: fields(HMH_V7_PROGRESSION_FIELDS),
    });
  }
  return payload;
}
const messageBytes = (payload) => new TextEncoder().encode(JSON.stringify(createBridgeEnvelope({
  type: 'game:run-summary', sessionId: `s${'e'.repeat(127)}`, messageId: `m${'1'.repeat(63)}`, payload,
}))).byteLength;

test('a maximal schema-7 run summary message fits the hmh-bridge/v1 limit', () => {
  assert.equal(HMH_MAX_MESSAGE_BYTES, 65_536, 'the bridge limit is unchanged');
  // No admitted float prints wider (red team: 123456789.12345679 was 5 characters short).
  const widest = maximalPayload(C7, 7).totals.elapsedMs;
  assert.equal(JSON.stringify(widest), '0.0000012345678901234567');
  for (const value of [123456789.12345679, 1e9, 1.2345678901234567e-300, 2.2250738585072014e-308, 5e-324, 1.0000000000000002e-7, 9.999999999999998e-7]) assert.ok(JSON.stringify(value).length <= 24, String(value));
  const maximal = maximalPayload(C7, 7);
  // Every catalogue row is present: the maximal payload has the exact schema-7 shape.
  const shape = (value) => (Array.isArray(value) ? value.map(shape) : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).map(([key, child]) => [key, shape(child)])) : typeof value);
  assert.deepEqual(shape(maximal), shape(BASE));
  const v6Bytes = messageBytes(maximalPayload(C6, 6));
  const v7Bytes = messageBytes(maximal);
  assert.ok(v7Bytes > v6Bytes, `${v7Bytes} > ${v6Bytes}`);
  assert.ok(v7Bytes <= HMH_MAX_MESSAGE_BYTES, `${v7Bytes} bytes fit`);
  // Contract §12 measured about 21.1 KB, a third of the limit.
  assert.ok(v7Bytes < HMH_MAX_MESSAGE_BYTES / 2, `${v7Bytes} bytes leave more than half the limit`);
});
