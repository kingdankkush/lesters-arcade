import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { verifyRankedRun } from '../server/verify/index.mjs';
import { HMH_FREE_HEROES, HMH_HERO_GATES, verifyHmhRun } from '../server/verify/hmh.mjs';
import { HMH_BOSS_START_TICK, rebootLevelForXp } from '../server/verify/hmh-plausibility.mjs';
import { HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG } from '../apps/portal/src/hmh-character-config.mjs';
import { validateRunSummaryPayload } from '../sdk/hmh-run-summary-schema.mjs';
import { ENEMY_ARCHETYPES } from '../apps/hmh-reboot/src/enemy-archetypes.mjs';
import { FIXED_STEP_MS } from '../apps/hmh-reboot/src/simulation.mjs';
import { canonicalSessionJson } from '../apps/portal/src/session-integrity.mjs';
import { rankedEnvelopeHash } from '../apps/portal/src/ranked-identity.mjs';
import { validateRunPlausibility } from '../apps/portal/src/hmh-run-integrity.mjs';
import { FIXTURE_VERIFY_AT_MS, buildFixture, fixtureVerifyOptions, readFixture } from './fixtures/ranked/build-fixtures.mjs';

const HMH_STATS_KEYS = ['score', 'kills', 'bossKills', 'eliteKills', 'maxCombo', 'level', 'xp', 'survivalTicks', 'elapsedMs', 'survivalSeconds',
  'damageTaken', 'damageDealt', 'healing', 'litecoin', 'grenadeKills', 'meleeKills', 'weaponsUsed', 'uniqueWeaponCount', 'powerUpsCollected',
  'uniquePowerUps', 'districtsVisited', 'poisDiscovered', 'revealedPermille', 'killsByRole', 'familyKills', 'noDamage', 'perfectBossKill',
  'bossEngaged', 'heroId', 'terminalReason'];

const valid = readFixture('hmh-valid');
const realistic = readFixture('hmh-realistic');
const level90 = readFixture('hmh-level-90');
const verify = (body, overrides) => verifyRankedRun(body, fixtureVerifyOptions(overrides));
const bodyWith = (fixture, mutate) => {
  const body = structuredClone(fixture.body);
  mutate(body.evidence.runSummary, body);
  return body;
};
const row = (rows, key, id) => rows.find((entry) => entry[key] === id);

// Adds `count` kills of `role` with `weaponId`, keeping the summary schema-consistent.
function addKills(summary, role, count, { boss = false, weaponId = 'coin-blaster' } = {}) {
  summary.kills.total += count;
  row(summary.kills.byEnemyRole, 'enemyRoleId', role).count += count;
  row(summary.kills.byWeapon, 'weaponId', weaponId).count += count;
  row(summary.weapons, 'weaponId', weaponId).kills += count;
  if (boss) summary.kills.boss += count;
}
function setXp(summary, xp) {
  summary.totals.xp = xp;
  summary.totals.level = rebootLevelForXp(xp);
  summary.milestones.levelUps = summary.totals.level - 1;
  if (summary.milestones.levelUps > 0 && summary.milestones.lastLevelUpTick === 0) {
    summary.milestones.firstLevelUpTick = 60;
    summary.milestones.lastLevelUpTick = 60;
  }
}

test('valid summary and envelope verify', async () => {
  const run = await verify(valid.body);
  assert.equal(run.ok, true, JSON.stringify(run));
  const { runSummary, sessionEnvelope } = valid.body.evidence;
  assert.equal(validateRunSummaryPayload(runSummary), '');
  assert.equal(run.score, runSummary.totals.score);
  assert.deepEqual(run.contract, { kills: runSummary.kills.total, maxCombo: runSummary.totals.maxCombo, survivalSeconds: Math.floor(runSummary.totals.elapsedMs / 1000), bossId: null });
  assert.deepEqual(run.contract, valid.expected.contract);
  assert.deepEqual(Object.keys(run.stats), HMH_STATS_KEYS);
  assert.equal(run.stats.kills, runSummary.kills.total);
  assert.equal(run.stats.level, runSummary.totals.level);
  assert.equal(run.stats.heroId, 'lit-commando');
  assert.equal(run.stats.terminalReason, 'defeated');
  assert.equal(run.evidence.encoding, 'hmh-run-summary-v6+json');
  assert.equal(run.evidence.text, canonicalSessionJson({ runSummary, sessionEnvelope }));
  assert.equal(run.evidence.digest, `0x${createHash('sha256').update(run.evidence.text).digest('hex')}`);
  assert.equal(run.envelopeHash, await rankedEnvelopeHash({ gameId: 'lester-blaster', sessionId32: valid.body.sessionId32, encoding: 'hmh-run-summary-v6+json', evidenceDigest: run.evidence.digest }));
  assert.equal(run.runtimeId, 'lester-blaster:hmh-run-summary-v6');
  assert.equal(run.seasonId, 'hmh-season-1-2026');
  assert.deepEqual(run.plausibility, { verdict: 'ok', flags: [] });
  assert.equal(run.verifiedAt, new Date(FIXTURE_VERIFY_AT_MS).toISOString());
  // The claim is diagnostics only.
  assert.deepEqual(await verify(bodyWith(valid, (_summary, body) => { body.claim = { score: 1 }; })), run);
});

test('a realistic reboot run verifies', async () => {
  const summary = realistic.body.evidence.runSummary;
  // The §5.3 shape: 300 kills of threat 4-6, one xpMultiplier rank, a combo reaching 30, 4 weapon caches, about 18 minutes.
  assert.equal(summary.kills.total, 300);
  for (const { enemyRoleId, count } of summary.kills.byEnemyRole) {
    if (count > 0) assert.ok(ENEMY_ARCHETYPES[enemyRoleId].costs.threat >= 4 && ENEMY_ARCHETYPES[enemyRoleId].costs.threat <= 6, enemyRoleId);
  }
  assert.equal(row(summary.upgrades, 'upgradeId', 'validator-training').selected, 1);
  assert.ok(summary.totals.maxCombo >= 30);
  const caches = ['hash-rail-core', 'lightning-ledger-cache', 'bear-market-burner-cache', 'forked-standard-cache'];
  assert.equal(caches.reduce((sum, id) => sum + row(summary.collectibles, 'effectId', id).collected, 0), 4);
  assert.equal(Math.round(summary.totals.elapsedMs / 60_000), 18);
  const run = await verify(realistic.body);
  assert.equal(run.ok, true, JSON.stringify(run));
  assert.deepEqual(run.plausibility, { verdict: 'ok', flags: [] }, 'a normal paid reboot run raises no flag');
  // The legacy in-process validator would not have accepted it cleanly (review F1).
  const legacy = validateRunPlausibility({ score: summary.totals.score, kills: summary.kills.total, maxCombo: summary.totals.maxCombo, survivalSeconds: summary.totals.elapsedMs / 1000, totalXp: summary.totals.xp, level: summary.totals.level });
  assert.notEqual(legacy.verdict, 'ok');
});

test('a run above level 80 with consistent XP verifies', async () => {
  const summary = level90.body.evidence.runSummary;
  assert.equal(summary.totals.level, 90);
  assert.equal(rebootLevelForXp(summary.totals.xp), 90);
  const run = await verify(level90.body);
  assert.equal(run.ok, true, JSON.stringify(run));
  assert.equal(run.stats.level, 90);
  const legacy = validateRunPlausibility({ score: summary.totals.score, kills: summary.kills.total, maxCombo: summary.totals.maxCombo, survivalSeconds: summary.totals.elapsedMs / 1000, totalXp: summary.totals.xp, level: summary.totals.level, bossDefeated: true });
  assert.equal(legacy.verdict, 'rejected', 'the legacy level-80 cap would have refused a paid run');
});

test('level inconsistent with XP is rejected', async () => {
  for (const delta of [1, -1]) {
    const run = await verify(bodyWith(valid, (summary) => {
      summary.totals.level += delta;
      summary.milestones.levelUps += delta;
    }));
    assert.equal(run.status, 422);
    assert.equal(run.error, 'implausible-run');
    assert.deepEqual(run.flags.filter((flag) => flag.severity === 'reject').map((flag) => flag.id), ['level-xp-mismatch']);
  }
});

test('a boss kill before the boss band is rejected', async () => {
  assert.ok(realistic.body.evidence.runSummary.identity.endTick < HMH_BOSS_START_TICK);
  const run = await verify(bodyWith(realistic, (summary) => addKills(summary, 'liquidator', 1, { boss: true })));
  assert.equal(run.error, 'implausible-run');
  assert.ok(run.flags.some((flag) => flag.id === 'boss-before-band' && flag.severity === 'reject'), JSON.stringify(run.flags));
});

// The 1.8.2 live issue: this body verified with no flags and earned
// grenade-demolitionist, powerup-hoarder, grenade-century, slums-clear and
// foundry-clear in one paid run. From 1.8.4 it is a 422, before any stats.
test('grenade kills and pickups no 1.8.x run can produce are a 422, before any achievement stats', async () => {
  const body = bodyWith(valid, (summary) => {
    summary.grenades.kills = 250;
    row(summary.collectibles, 'effectId', 'bonus-life').collected = 250;
    summary.exploration.visitedDistrictMask = 63;
  });
  assert.equal(validateRunSummaryPayload(body.evidence.runSummary), '', 'the schema accepts the payload');
  const run = await verify(body);
  assert.equal(run.ok, false);
  assert.equal(run.status, 422);
  assert.equal(run.error, 'implausible-run');
  assert.deepEqual(run.flags.map((flag) => [flag.id, flag.severity]), [['grenade-kills-above-weapon-kills', 'reject'], ['pickups-above-capacity', 'reject']]);
  assert.equal(run.stats, undefined);
  // A district mask that skips a strip, or leaves out the seed's entry strip.
  for (const mask of [0b000101, 0b111110]) {
    const skipped = await verify(bodyWith(valid, (summary) => { summary.exploration.visitedDistrictMask = mask; }));
    assert.equal(skipped.status, 422);
    assert.deepEqual(skipped.flags.map((flag) => flag.id), ['district-path-invalid']);
  }
});

test('a summary that does not start at tick 0 is rejected', async () => {
  // A far end tick with a short elapsed span: the level-90 boss run as 1 s, the realistic run as 20 s.
  for (const [fixture, span] of [[level90, 60], [realistic, 1_200]]) {
    const body = bodyWith(fixture, (summary) => {
      summary.identity.startTick = summary.identity.endTick - span;
      summary.totals.survivalTicks = span;
      summary.totals.elapsedMs = span * FIXED_STEP_MS;
    });
    assert.equal(validateRunSummaryPayload(body.evidence.runSummary), '', 'the schema accepts it; plausibility must not');
    const run = await verify(body);
    assert.deepEqual([run.ok, run.status, run.error], [false, 422, 'implausible-run']);
    const rejectIds = run.flags.filter((flag) => flag.severity === 'reject').map((flag) => flag.id);
    assert.ok(rejectIds.includes('start-tick-invalid'), JSON.stringify(rejectIds));
    assert.ok(rejectIds.includes('kills-above-capacity'), JSON.stringify(rejectIds));
  }
});

test('a score above 1e10 is rejected before the plausibility check', async () => {
  const body = bodyWith(valid, (summary) => { summary.totals.score = 20_000_000_000; });
  assert.equal(validateRunSummaryPayload(body.evidence.runSummary), '', 'the schema allows scores up to 1e12');
  const run = await verify(body);
  assert.deepEqual([run.ok, run.status, run.error], [false, 422, 'score-out-of-bounds']);
  assert.equal(run.flags, undefined, 'answered by the score bound, not by implausible-run');
  // 1e10 itself is in bounds, so the same run reaches the plausibility check.
  assert.equal((await verify(bodyWith(valid, (summary) => { summary.totals.score = 10_000_000_000; }))).error, 'implausible-run');
});

test('XP above the reboot ceiling is rejected', async () => {
  const run = await verify(bodyWith(realistic, (summary) => setXp(summary, summary.totals.xp * 3)));
  assert.equal(run.error, 'implausible-run');
  const xpFlag = run.flags.find((flag) => flag.id === 'xp-above-ceiling');
  assert.equal(xpFlag.severity, 'reject');
  assert.ok(xpFlag.value > xpFlag.limit);
});

test('near-ceiling runs verify with flags', async () => {
  const run = await verify(level90.body);
  assert.equal(run.ok, true);
  assert.equal(run.plausibility.verdict, 'flagged');
  assert.ok(run.plausibility.flags.length > 0);
  assert.ok(run.plausibility.flags.every((flag) => flag.severity === 'flag'));
  assert.ok(run.plausibility.flags.some((flag) => flag.id === 'xp-near-ceiling' || flag.id === 'score-near-ceiling'));
  // A realistic run with its score pushed close to the ceiling ranks too, flagged.
  const pushed = await verify(bodyWith(realistic, (summary) => { summary.totals.score = Math.floor(summary.totals.score * 1.6); }));
  assert.equal(pushed.ok, true, JSON.stringify(pushed));
  assert.equal(pushed.plausibility.verdict, 'flagged');
  assert.ok(pushed.plausibility.flags.some((flag) => flag.id === 'score-near-ceiling' || flag.id === 'score-above-selected-upgrades'), JSON.stringify(pushed.plausibility.flags));
});

test('summary seed, build or mode mismatch is rejected', async () => {
  for (const mutate of [
    (summary) => { summary.identity.seed = (summary.identity.seed + 1) >>> 0; },
    (summary) => { summary.identity.buildHash = 'site-1.7.0:game-1.7.1'; },
    (summary) => { summary.identity.mode = 'free'; },
  ]) {
    assert.deepEqual(await verify(bodyWith(valid, mutate)), { ok: false, status: 400, error: 'run-summary-identity-mismatch' });
  }
});

test('non-defeated terminal reason is rejected', async () => {
  for (const reason of ['completed', 'abandoned', 'runtime-error']) {
    const run = await verify(bodyWith(valid, (summary) => {
      summary.identity.terminalReason = reason;
      summary.defeat = { kind: 'none', causeId: 'none', tick: 0, damage: 0 };
    }));
    assert.deepEqual(run, { ok: false, status: 400, error: 'run-summary-not-terminal' }, reason);
  }
});

test('tampered envelope hash is rejected', async () => {
  const flip = (hex) => `${hex.slice(0, -1)}${hex.at(-1) === '0' ? '1' : '0'}`;
  for (const mutate of [
    (_s, body) => { body.evidence.sessionEnvelope.envelopeHash = flip(body.evidence.sessionEnvelope.envelopeHash); },
    (_s, body) => { body.evidence.sessionEnvelope.inputHash = flip(body.evidence.sessionEnvelope.inputHash); },
    (_s, body) => { body.evidence.sessionEnvelope.sessionKey = realistic.body.sessionId32; },
    (_s, body) => { body.evidence.sessionEnvelope.identity.seed += 1; },
    (_s, body) => { body.evidence.sessionEnvelope.version = 'lesters-session-envelope-v2'; },
    (_s, body) => { body.evidence.sessionEnvelope.extra = 1; },
    (_s, body) => { body.evidence.sessionEnvelope = structuredClone(realistic.body.evidence.sessionEnvelope); },
  ]) {
    assert.deepEqual(await verify(bodyWith(valid, mutate)), { ok: false, status: 400, error: 'session-envelope-invalid' });
  }
});

test('boss kill maps to the boss-liquidator id', async () => {
  const boss = await verify(level90.body);
  assert.equal(level90.body.evidence.runSummary.kills.boss, 1);
  assert.equal(boss.contract.bossId, 'boss-liquidator');
  assert.equal(boss.stats.bossKills, 1);
  assert.equal((await verify(realistic.body)).contract.bossId, null);
});

test('hero gates match hmh-character-config', () => {
  assert.deepEqual(HMH_HERO_GATES, { 'lester-original': 5, lilly: 10 });
  assert.deepEqual(HMH_FREE_HEROES, ['lit-commando', 'lit-valkyrie']);
  assert.deepEqual(HMH_FREE_HEROES, HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG.starterCharacterIds);
  assert.equal(HMH_FREE_HEROES.some((id) => Object.hasOwn(HMH_HERO_GATES, id)), false);
  for (const character of HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG.unlockableCharacters) {
    assert.equal(HMH_HERO_GATES[character.id], character.gate.count);
  }
  assert.equal(Object.isFrozen(HMH_HERO_GATES), true);
});

test('schema, size and shape failures are 400s before any plausibility work', async () => {
  const schema5 = await verify(bodyWith(valid, (summary) => { summary.schemaVersion = 5; delete summary.defeat; delete summary.milestones; }));
  assert.deepEqual([schema5.status, schema5.error], [400, 'run-summary-invalid']);
  const broken = await verify(bodyWith(valid, (summary) => { summary.kills.total += 1; }));
  assert.deepEqual([broken.status, broken.error], [400, 'run-summary-invalid']);
  const huge = await verify(bodyWith(valid, (_summary, body) => { body.evidence.runSummary.padding = 'x'.repeat(262_144); }));
  assert.deepEqual([huge.status, huge.error], [400, 'invalid-evidence']);
  assert.equal((await verify(bodyWith(valid, (_s, body) => { body.evidence.encoding = 'hmh-run-summary-v5+json'; }))).error, 'invalid-evidence');
  assert.equal((await verify(bodyWith(valid, (_s, body) => { delete body.evidence.sessionEnvelope; }))).error, 'invalid-evidence');
});

test('the per-game verifier matches the dispatcher', async () => {
  const dispatched = await verify(valid.body);
  assert.deepEqual(await verifyHmhRun({ identity: dispatched.identity, evidence: valid.body.evidence, nowMs: FIXTURE_VERIFY_AT_MS }), dispatched);
});

test('the committed HMH fixtures rebuild from build-fixtures.mjs', async () => {
  assert.deepEqual(await buildFixture('hmh-valid'), valid);
  assert.deepEqual(await buildFixture('hmh-realistic'), realistic);
  assert.deepEqual(await buildFixture('hmh-level-90'), level90);
});
