import assert from 'node:assert/strict';
import test from 'node:test';

import { HMH_RUN_SUMMARY_CATALOGS as C, validateRunSummaryPayload } from '../sdk/hmh-run-summary-schema.mjs';
import {
  createRunSummaryAccumulator,
  finalizeRunSummary,
  recordRunCollectible,
  recordRunDamage,
  recordRunKill,
  recordRunMilestone,
  recordRunTick,
  recordRunUpgradeOffer,
  recordRunUpgradeSelection,
  recordRunWeaponEvent,
} from '../sdk/hmh-run-summary.mjs';
import {
  BOSS_ATTACK_LABELS,
  ENEMY_LABELS,
  SECRET_LABELS,
  SITE_LABELS,
  UPGRADE_LABELS,
  buildHmhRunRecapModel,
  formatRunClock,
} from '../apps/portal/src/hmh-run-recap.mjs';
import { RUN_UPGRADE_CATALOG } from '../apps/hmh-reboot/src/run-progression.mjs';
import { LIQUIDATOR_ATTACK_DEFINITIONS } from '../apps/hmh-reboot/src/liquidator-boss.mjs';
import { WORLD_DESIGN_SITES } from '../apps/hmh-reboot/src/world-design-encounters.mjs';
import { WORLD_DESIGN_SECRETS } from '../apps/hmh-reboot/src/world-design-secrets.mjs';

const tick = (state, options) => recordRunTick(state, { position: { x: 0, y: 0 }, districtId: 'frontier-relay', ...options });

// A defeated run with a real build: two weapons, three augments, a machinery
// activation, a secret, a boss engagement and a terminal-tick level-up.
function defeatedRun({ mode = 'free', kill = { sourceId: 'enemy-2', weaponId: 'enemy-bagholder-rusher' }, terminalReason = 'defeated', bossKill = true } = {}) {
  const state = createRunSummaryAccumulator({ seed: 777, buildHash: 'recap-build', mode, heroId: 'lit-commando', startPosition: { x: 0, y: 0 } });
  for (let t = 1; t <= 100; t += 1) tick(state, { tick: t, activeWeaponId: t <= 40 ? 'coin-blaster' : 'scatter-shotgun', level: t < 60 ? 1 : 2, bossEngaged: t >= 90 });
  recordRunWeaponEvent(state, { type: 'pickup', weaponId: 'scatter-shotgun' });
  recordRunCollectible(state, { effectId: 'scatter-shotgun-cache' });
  recordRunKill(state, { enemyRoleId: 'bagholder-rusher', weaponId: 'coin-blaster' });
  recordRunKill(state, { enemyRoleId: 'gas-bomber', weaponId: 'scatter-shotgun' });
  recordRunKill(state, { enemyRoleId: 'forkrunner', weaponId: 'scatter-shotgun' });
  if (bossKill) recordRunKill(state, { enemyRoleId: 'liquidator', weaponId: 'scatter-shotgun', boss: true });
  recordRunUpgradeOffer(state, ['proof-of-work', 'diamond-hands', 'cold-storage']);
  recordRunUpgradeOffer(state, ['proof-of-work', 'diamond-hands', 'cold-storage']);
  recordRunUpgradeSelection(state, 'diamond-hands');
  recordRunUpgradeSelection(state, 'diamond-hands');
  recordRunUpgradeSelection(state, 'proof-of-work');
  recordRunMilestone(state, { type: 'site-operated', id: 'ravine-winch', tick: 75 });
  recordRunMilestone(state, { type: 'secret-found', id: 'farmstead-hidden-supplies', tick: 20 });
  recordRunDamage(state, { ...kill, targetId: 'player', damageApplied: 18, killed: true, tick: 100 });
  return finalizeRunSummary(state, { endTick: 100, elapsedMs: 1666.667, terminalReason, score: 900, level: 3, xp: 120, currentCombo: 1, maxCombo: 9, revealedCells: 4, totalCells: 40 });
}

test('recap names the killer, the build, and the milestones in tick order from the canonical payload', () => {
  const summary = defeatedRun();
  assert.equal(validateRunSummaryPayload(summary), '');
  const recap = buildHmhRunRecapModel(summary);
  assert.deepEqual(recap.defeat, {
    kind: 'enemy', causeId: 'enemy-bagholder-rusher', label: 'Bagholder Rusher', sentence: 'Killed by Bagholder Rusher.', detail: '18 damage at 0:01', tick: 100, damage: 18, clock: '0:01',
  });
  assert.deepEqual(recap.build.weapons.map((weapon) => [weapon.weaponId, weapon.label, weapon.kills, weapon.equippedTicks, weapon.equippedPermille]), [
    ['scatter-shotgun', 'Scatter Shotgun', 3, 60, 600],
    ['coin-blaster', 'Coin Blaster', 1, 40, 400],
  ]);
  assert.deepEqual(recap.build.upgrades, [
    { upgradeId: 'proof-of-work', label: 'Proof of Work', rank: 1 },
    { upgradeId: 'diamond-hands', label: 'Diamond Hands', rank: 2 },
  ]);
  assert.equal(recap.build.topUpgradeLabel, 'Diamond Hands (Rank 2)');
  assert.deepEqual(recap.milestones.map((milestone) => [milestone.id, milestone.label, milestone.tick, milestone.clock]), [
    ['secret:farmstead-hidden-supplies', 'Boarded supply chest', 20, '0:00'],
    ['level-up:first', 'Level 2', 60, '0:01'],
    ['site:ravine-winch', 'Quarry winch', 75, '0:01'],
    ['boss-engaged', 'Liquidator engaged', 90, '0:01'],
    ['level-up:last', 'Level 3', 100, '0:01'],
    ['cache:scatter-shotgun-cache', 'Scatter Shotgun cache', null, null],
    ['boss-defeated', 'Liquidator defeated', null, null],
  ]);
  assert.equal(recap.seed, 777);
  assert.equal(recap.maxCombo, 9);
  assert.equal(recap.level, 3);
  assert.equal(recap.survivalClock, '0:01');
  assert.ok(Object.isFrozen(recap) && Object.isFrozen(recap.milestones) && Object.isFrozen(recap.build.weapons));
});

test('recap labels boss attacks, hazards, self-kills, and survivals distinctly', () => {
  const boss = buildHmhRunRecapModel(defeatedRun({ kill: { sourceId: 'boss-liquidator', weaponId: 'boss-total-liquidation-super' } }));
  assert.equal(boss.defeat.label, 'Liquidator: Total Liquidation');
  const hazard = buildHmhRunRecapModel(defeatedRun({ kill: { sourceId: 'mining-valve', weaponId: 'world-steam' } }));
  assert.equal(hazard.defeat.label, 'Steam vent');
  const self = buildHmhRunRecapModel(defeatedRun({ kill: { sourceId: 'player', weaponId: 'satoshi-frag' } }));
  assert.equal(self.defeat.label, 'Your own Satoshi Frag');
  const unknown = buildHmhRunRecapModel(defeatedRun({ kill: { sourceId: 'enemy-1', weaponId: 'glitch' } }));
  assert.equal(unknown.defeat.label, 'Unknown cause');
  const survived = buildHmhRunRecapModel(defeatedRun({ terminalReason: 'completed', bossKill: false }));
  assert.deepEqual([survived.defeat.kind, survived.defeat.label, survived.defeat.sentence, survived.defeat.detail], ['none', null, 'No defeat recorded.', '']);
  assert.ok(!survived.milestones.some((milestone) => milestone.id === 'boss-defeated'));
});

test('recap label maps cover every catalog id the child can emit', () => {
  assert.deepEqual(Object.keys(ENEMY_LABELS).sort(), [...C.enemyRoles].sort());
  assert.deepEqual(Object.keys(BOSS_ATTACK_LABELS).sort(), Object.keys(LIQUIDATOR_ATTACK_DEFINITIONS).sort());
  assert.deepEqual(Object.keys(SITE_LABELS).sort(), [...C.worldSites].sort());
  assert.deepEqual(Object.keys(SECRET_LABELS).sort(), [...C.secrets].sort());
  for (const site of WORLD_DESIGN_SITES) assert.equal(SITE_LABELS[site.id], site.name);
  for (const secret of WORLD_DESIGN_SECRETS) assert.equal(SECRET_LABELS[secret.id], secret.name);
  // The portal copies upgrade titles instead of importing the child module
  // (bundle cap); this pin is what keeps the copy honest.
  assert.deepEqual(UPGRADE_LABELS, Object.fromEntries(C.upgrades.map((upgradeId) => [upgradeId, RUN_UPGRADE_CATALOG[upgradeId].title])));
  assert.equal(formatRunClock(61 * 3600 + 5 * 60), '61:05');
  assert.equal(formatRunClock(-4), '0:00');
});

test('identical payloads recap identically in Free and Ranked and carry text only', () => {
  const free = defeatedRun({ mode: 'free' });
  const ranked = defeatedRun({ mode: 'ranked' });
  assert.notEqual(free.identity.mode, ranked.identity.mode);
  assert.deepEqual(buildHmhRunRecapModel(free), buildHmhRunRecapModel(ranked));
  const strings = [];
  const walk = (value) => {
    if (typeof value === 'string') strings.push(value);
    else if (value && typeof value === 'object') Object.values(value).forEach(walk);
  };
  walk(buildHmhRunRecapModel(free));
  assert.ok(strings.length > 20);
  assert.ok(strings.every((text) => !/[<>&]/.test(text)), 'recap strings must never carry markup');
  assert.equal(JSON.stringify(buildHmhRunRecapModel(free)).includes('"mode"'), false);
});

test('recap tolerates pre-schema-6 payloads and rejects non-summaries', () => {
  const legacy = JSON.parse(JSON.stringify(defeatedRun()));
  delete legacy.defeat;
  delete legacy.milestones;
  legacy.schemaVersion = 5;
  const recap = buildHmhRunRecapModel(legacy);
  assert.deepEqual([recap.defeat.kind, recap.defeat.label], ['unknown', 'Unknown cause']);
  assert.deepEqual(recap.milestones.map((milestone) => milestone.id), ['cache:scatter-shotgun-cache', 'boss-defeated']);
  for (const input of [null, undefined, 42, 'summary', {}, { identity: {} }]) assert.equal(buildHmhRunRecapModel(input), null);
});
