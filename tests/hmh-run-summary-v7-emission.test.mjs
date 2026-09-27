// Run summary schema 7 emitted by the child (contract §4, §11, §12 and §15
// item 6; build ledger slice 9): the accumulator takes the V7 catalogues and
// the simulation's v7 rows, the payload passes the shared v7 schema, a
// maximal child summary fits hmh-bridge/v1, the child bridge validates its
// outgoing summary with the v7 validator, and the portal accepts schema 6 and
// 7 alike.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  createRunSummaryAccumulator,
  finalizeRunSummary,
  recordRunKill,
  recordRunTick,
  recordRunWeaponEvent,
} from '../sdk/hmh-run-summary.mjs';
import { HMH_RUN_SUMMARY_CATALOGS } from '../sdk/hmh-run-summary-schema.mjs';
import { HMH_RUN_SUMMARY_CATALOGS_V7, validateRunSummaryPayload } from '../sdk/hmh-run-summary-schema-v7.mjs';
import { HMH_MAX_MESSAGE_BYTES, createBridgeEnvelope, validateChildMessage } from '../sdk/hmh-bridge-protocol.mjs';
import { RUN_SUMMARY_SCHEMA_VERSION, runSummaryV7Rows, validateRunSummaryV7 } from '../apps/hmh-reboot/src/run-summary-v7.mjs';
import { createMissionState, settleMissionObjective } from '../apps/hmh-reboot/src/mission-objectives.mjs';
import { prisonerMissionRows } from '../apps/hmh-reboot/src/prisoners.mjs';
import { createBossSlots } from '../apps/hmh-reboot/src/boss-slots.mjs';
import { createRunProgression, grantRunXp, openRunUpgradeOffer, selectRunUpgrade } from '../apps/hmh-reboot/src/run-progression.mjs';
import { resolveGenesisSeal } from '../apps/hmh-reboot/src/boss-drops.mjs';

const C7 = HMH_RUN_SUMMARY_CATALOGS_V7;
const SEED = 424242;

function childRun() {
  const accumulator = createRunSummaryAccumulator({ seed: SEED, buildHash: 'site-1.9.0:game-1.9.0', mode: 'ranked', heroId: 'male-commando', startPosition: { x: 800, y: 2400 }, schemaVersion: RUN_SUMMARY_SCHEMA_VERSION, catalogs: C7 });
  const mission = createMissionState(SEED, { prisoners: prisonerMissionRows(SEED) });
  const bossSlots = createBossSlots({ seed: SEED });
  const progression = createRunProgression({ seed: SEED, ownedWeaponIds: ['coin-blaster'] });
  for (let tick = 1; tick <= 1_200; tick += 1) {
    recordRunTick(accumulator, { tick, position: { x: 800 + tick, y: 2400 }, activeWeaponId: 'coin-blaster', districtId: 'frontier-relay', level: progression.level });
  }
  // A switch, its gate, and a prisoner at the levels just before their grants.
  mission.completed.set('relay-power', 300);
  settleMissionObjective(mission, 'relay-power', progression.level);
  mission.completed.set('relay-barn-doors', 300);
  settleMissionObjective(mission, 'relay-barn-doors', progression.level);
  grantRunXp(progression, 400, 300);
  mission.rescued.set('p1-relay-barn-yard', 900);
  settleMissionObjective(mission, 'p1-relay-barn-yard', progression.level);
  const offer = openRunUpgradeOffer(progression);
  selectRunUpgrade(progression, offer[0].id);
  return { accumulator, mission, bossSlots, progression };
}

const finalize = ({ accumulator, mission, bossSlots, progression }) => finalizeRunSummary(accumulator, {
  endTick: 1_200, elapsedMs: 20_000, terminalReason: 'defeated', score: progression.score, level: progression.level, xp: progression.xp,
  currentCombo: 0, maxCombo: 0, revealedCells: 3, totalCells: 100,
  v7: runSummaryV7Rows({ mission, bossSlots, progression }),
});

test('schema 7 needs the V7 catalogues; schema 6 is the default and unchanged', () => {
  const base = { seed: 1, buildHash: 'site-1.9.0:game-1.9.0', mode: 'free', heroId: 'male-commando', startPosition: { x: 0, y: 0 } };
  assert.throws(() => createRunSummaryAccumulator({ ...base, schemaVersion: 7 }), /V7 catalogues/);
  assert.throws(() => createRunSummaryAccumulator({ ...base, schemaVersion: 8, catalogs: C7 }), /V7 catalogues/);
  const v6 = createRunSummaryAccumulator(base);
  assert.equal(v6.C, HMH_RUN_SUMMARY_CATALOGS);
  const summary = finalizeRunSummary(v6, { endTick: 0, elapsedMs: 0, terminalReason: 'abandoned', score: 0, level: 1, xp: 0, currentCombo: 0, maxCombo: 0, revealedCells: 0, totalCells: 1 });
  assert.equal(summary.schemaVersion, 6);
  assert.equal(summary.objectives, undefined);
  assert.equal(validateRunSummaryPayload(summary), '');
});

test('the child emits schema 7 the shared schema accepts, with every v7 row from its simulation', () => {
  const run = childRun();
  const summary = finalize(run);
  assert.equal(summary.schemaVersion, 7);
  assert.equal(validateRunSummaryPayload(summary), '');
  assert.equal(validateRunSummaryV7(summary), '');
  assert.deepEqual(summary.objectives.map((row) => row.objectiveId), C7.objectives);
  assert.deepEqual(summary.prisoners.map((row) => row.slotId), C7.prisonerSlots);
  assert.deepEqual(summary.bosses.map((row) => row.bossId), C7.bosses);
  assert.deepEqual(summary.evolutions.map((row) => row.evolutionId), C7.evolutions);
  assert.deepEqual(summary.upgrades.map((row) => row.upgradeId), C7.upgrades);
  assert.equal(summary.kills.byEnemyRole.length, C7.enemyRoles.length);
  assert.equal(summary.collectibles.length, C7.collectibles.length);
  // S8: the milestones mirror the objectives.
  const relay = summary.milestones.sites.find((row) => row.siteId === 'relay-power');
  assert.deepEqual([relay.operated, relay.tick], [1, 300]);
  assert.deepEqual(summary.prisoners.find((row) => row.slotId === 'p1-relay-barn-yard'), { slotId: 'p1-relay-barn-yard', rescued: 1, tick: 900, levelAtRescue: 2 });
  assert.equal(summary.progression.offersOpened, 1);
  assert.equal(summary.upgrades.reduce((sum, row) => sum + row.selected, 0), 1);
});

test('the Liquidator\'s kill fills kills.boss, his first initiation bossEngagedTick, and the Seals found the genesis-seal pickups (S5-S7, S12)', () => {
  const run = childRun();
  recordRunWeaponEvent(run.accumulator, { type: 'pickup', weaponId: 'scatter-shotgun' });
  recordRunKill(run.accumulator, { enemyRoleId: 'liquidator', weaponId: 'coin-blaster', boss: true });
  const liquidator = run.bossSlots.rows.get('liquidator');
  Object.assign(liquidator, { initiations: 1, first: 600, last: 600, defeatedTick: 1_000 });
  resolveGenesisSeal(run.progression, { tick: 1_050 });
  const summary = finalize(run);
  assert.equal(summary.kills.boss, 1);
  assert.equal(summary.milestones.bossEngagedTick, 600);
  assert.equal(summary.collectibles.find((row) => row.effectId === 'genesis-seal').collected, 1);
  assert.deepEqual([summary.progression.sealsFound, summary.progression.sealsBanked, summary.progression.evolutionsApplied], [1, 1, 0]);
  assert.equal(validateRunSummaryPayload(summary), '');
});

test('rows out of catalogue order are refused rather than emitted', () => {
  const run = childRun();
  const rows = runSummaryV7Rows(run);
  assert.throws(() => finalizeRunSummary(run.accumulator, {
    endTick: 1_200, elapsedMs: 1, terminalReason: 'defeated', score: 0, level: 2, xp: 400, currentCombo: 0, maxCombo: 0, revealedCells: 0, totalCells: 1,
    v7: { ...rows, prisoners: [...rows.prisoners].reverse() },
  }), /slotId rows must follow the catalogue/);
});

test('a maximal child summary fits hmh-bridge/v1 (contract §12)', () => {
  const summary = finalize(childRun());
  const widen = (value, key) => {
    if (Array.isArray(value)) return value.map((entry) => widen(entry, key));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([field, entry]) => [field, widen(entry, field)]));
    if (typeof value === 'number') return Number.isInteger(value) ? (['score', 'xp'].includes(key) ? 1e12 : 1_000_000_000) : 0.0000012345678901234567;
    if (typeof value === 'string' && ['buildHash'].includes(key)) return 'b'.repeat(128);
    if (typeof value === 'string' && ['heroId', 'causeId'].includes(key)) return 'h'.repeat(64);
    return value;
  };
  const maximal = widen(summary);
  const message = createBridgeEnvelope({ type: 'game:run-summary', sessionId: 's'.repeat(128), messageId: 'm'.repeat(64), payload: maximal });
  const bytes = new TextEncoder().encode(JSON.stringify(message)).byteLength;
  assert.ok(bytes < HMH_MAX_MESSAGE_BYTES, `${bytes} bytes`);
  assert.ok(bytes < 32_768, `about half the limit or less: ${bytes}`);
});

test('the child bridge validates its outgoing summary with the v7 validator; the portal bridge and history accept schema 6 and 7', () => {
  const summary = finalize(childRun());
  const message = createBridgeEnvelope({ type: 'game:run-summary', sessionId: 'game-session-000000001', messageId: 'game-9', payload: summary });
  assert.equal(validateChildMessage(message).ok, false, 'the protocol default is schema 1-6');
  assert.equal(validateChildMessage(message, { validateRunSummary: validateRunSummaryV7 }).ok, true);
  const bridge = readFileSync(new URL('../apps/hmh-reboot/src/bridge.mjs', import.meta.url), 'utf8');
  assert.ok(bridge.includes('validateChildMessage(message, { validateRunSummary })'));
  const main = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  assert.ok(main.includes("validateRunSummary: (payload) => summaryV7?.validateRunSummaryV7(payload) ?? 'run summary schema 7 is not loaded',"));
  assert.ok(main.includes('schemaVersion: summaryV7.RUN_SUMMARY_SCHEMA_VERSION,'));
  assert.ok(main.includes('v7: summaryV7.runSummaryV7Rows({ mission: missionState, bossSlots, progression: runProgression }),'));
  const portal = readFileSync(new URL('../apps/portal/src/hmh-reboot-bridge.mjs', import.meta.url), 'utf8');
  assert.ok(portal.includes("import { validateRunSummaryPayload as validateRunSummary } from '../../../sdk/hmh-run-summary-schema-v7.mjs';"));
  assert.ok(portal.includes('validateChildMessage(event.data, { validateRunSummary })'));
  const history = readFileSync(new URL('../apps/portal/src/hmh-run-history.mjs', import.meta.url), 'utf8');
  assert.ok(history.includes("from '../../../sdk/hmh-run-summary-schema-v7.mjs';"));
});
