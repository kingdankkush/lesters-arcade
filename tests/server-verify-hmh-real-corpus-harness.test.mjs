// The real-child harness (scripts/hmh-honest-corpus) on this checkout: its plan
// and Ranked identities, and one headless boot of the unmodified child through
// the bridge handshake. The corpus it produced is replayed by
// tests/server-verify-hmh-real-corpus.test.mjs. This file installs the
// harness's browser globals, so it stays on its own (node --test isolates each
// file in a process).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HARNESS_BUILD_HASH, HARNESS_RELEASE, SEASON_ID } from '../scripts/hmh-honest-corpus/identity.mjs';
import { HEROES, LEVEL_ENTRIES, MELEE_LABELS, PLAN, SAMPLE_LABELS, identityFor } from '../scripts/hmh-honest-corpus/plan.mjs';
import { STYLE_DEFAULTS } from '../scripts/hmh-honest-corpus/pilot.mjs';
import { CORPUS_SCHEMA, serializeCorpus } from '../scripts/hmh-honest-corpus/corpus.mjs';
import { runChild } from '../scripts/hmh-honest-corpus/child-driver.mjs';
import { RANKED_GAMES, validateRankedIdentity } from '../apps/portal/src/ranked-identity.mjs';
import { checkSeedTicket } from '../server/verify/seed-ticket.mjs';
import { hmhV6LevelEntry } from '../server/verify/hmh-plausibility.mjs';
import { FIXTURE_CHAIN_ID, FIXTURE_ISSUED_AT, FIXTURE_REGISTRY, FIXTURE_SEED_SECRET, FIXTURE_WALLET } from './fixtures/ranked/build-fixtures.mjs';
import { GAME_VERSION, SITE_VERSION } from '../apps/portal/src/version-tracking.mjs';
import { HMH_CABINET_VERSION } from '../apps/portal/src/hmh-cabinet-version.mjs';

const CORPUS_1_8_3 = JSON.parse(readFileSync(new URL('./fixtures/hmh-honest-corpus/real-child-1.8.3.json', import.meta.url), 'utf8'));

test('the plan is 108 unique rows over every level entry, both heroes and every pilot style; the sample is fourteen of them', () => {
  assert.equal(PLAN.length, 108);
  assert.equal(new Set(PLAN.map((run) => run.label)).size, 108);
  assert.deepEqual([...new Set(PLAN.map((run) => run.entry))].sort(), [...LEVEL_ENTRIES].sort());
  assert.deepEqual([...new Set(PLAN.map((run) => run.heroId))].sort(), [...HEROES].sort());
  assert.deepEqual([...new Set(PLAN.map((run) => run.style))].sort(), Object.keys(STYLE_DEFAULTS).sort());
  for (const [index, run] of PLAN.entries()) assert.equal(run.label, `r${String(index).padStart(2, '0')}-${run.style}-${run.entry}-${run.tickCap}`);
  // The first 68 rows are the 1.8.3 plan, untouched; rows 68 to 107 are the
  // round-3 melee-trail rows (ten knifer, thirty standard; every entry and
  // both heroes in each style).
  for (const [style, count] of [['knifer', 10], ['standard', 30]]) {
    const rows = PLAN.filter((run) => run.style === style);
    assert.equal(rows.length, count, style);
    assert.deepEqual([...new Set(rows.map((run) => run.entry))].sort(), [...LEVEL_ENTRIES].sort(), style);
    assert.deepEqual([...new Set(rows.map((run) => run.heroId))].sort(), [...HEROES].sort(), style);
    assert.ok(rows.every((run) => run.index >= 68 && run.tickCap === 110_000), style);
  }
  assert.deepEqual(MELEE_LABELS, PLAN.slice(68).map((run) => run.label));
  assert.equal(SAMPLE_LABELS.length, 14);
  const sample = PLAN.filter((run) => SAMPLE_LABELS.includes(run.label));
  assert.deepEqual([...new Set(sample.map((run) => run.style))].sort(), Object.keys(STYLE_DEFAULTS).sort(), 'one run per style at least');
  assert.deepEqual([...new Set(sample.map((run) => run.entry))].sort(), [...LEVEL_ENTRIES].sort());
  assert.deepEqual([...new Set(sample.map((run) => run.heroId))].sort(), [...HEROES].sort());
  // The 1.8.3 corpus is this plan: every one of its rows is a plan label with the plan's facts.
  for (const row of CORPUS_1_8_3.runs) {
    const run = PLAN.find((entry) => entry.label === row.label);
    assert.ok(run, row.label);
    assert.deepEqual({ style: run.style, entry: run.entry, heroId: run.heroId, tickCap: run.tickCap }, { style: row.style, entry: row.entry, heroId: row.heroId, tickCap: row.tickCap }, row.label);
  }
});

test('the harness identity is what this checkout\'s portal sends: site, game and cabinet versions, and the current season', () => {
  assert.equal(HARNESS_BUILD_HASH, `site-${SITE_VERSION}:game-${GAME_VERSION}:cabinet-${HMH_CABINET_VERSION}`);
  assert.equal(HARNESS_RELEASE, GAME_VERSION);
  assert.match(HARNESS_BUILD_HASH, RANKED_GAMES['lester-blaster'].buildHashPattern);
  assert.equal(SEASON_ID, RANKED_GAMES['lester-blaster'].seasonId);
});

test('a plan row\'s identity is a fixture seed ticket whose seed lands on the planned entry; under the 1.8.3 build hash it reproduces the corpus seed', async () => {
  const run = PLAN.find((entry) => entry.label === 'r08-brawler-relay-3000');
  const id = await identityFor(run);
  assert.equal(id.identity.buildHash, HARNESS_BUILD_HASH);
  assert.equal(id.identity.seed, id.seed);
  assert.equal(hmhV6LevelEntry(id.seed).id, run.entry);
  assert.equal(validateRankedIdentity(id.identity, { chainId: FIXTURE_CHAIN_ID, scoreRegistryAddress: FIXTURE_REGISTRY, wallet: FIXTURE_WALLET, gameId: 'lester-blaster' }).ok, true);
  const ticket = checkSeedTicket(id.seedTicket, { secret: FIXTURE_SEED_SECRET, nowMs: FIXTURE_ISSUED_AT * 1000, sessionId: id.identity.sessionId, wallet: FIXTURE_WALLET, gameId: 'lester-blaster', seasonId: SEASON_ID, buildHash: HARNESS_BUILD_HASH });
  assert.equal(ticket.ok, true, JSON.stringify(ticket));
  // The seed binds the build hash: a new child release plays fresh seeds, and
  // the committed 1.8.3 seeds are exactly this plan's under the 1.8.3 hash.
  const row = CORPUS_1_8_3.runs.find((entry) => entry.label === run.label);
  assert.notEqual(CORPUS_1_8_3.child.buildHash, HARNESS_BUILD_HASH);
  assert.notEqual(id.seed, row.seed);
  const id183 = await identityFor(run, { buildHash: CORPUS_1_8_3.child.buildHash });
  assert.equal(id183.seed, row.seed);
  assert.equal(id183.seed, row.runSummary.identity.seed);
});

test('the corpus serializer writes one run per line under a pretty header, and reads back equal', () => {
  const corpus = { schema: CORPUS_SCHEMA, child: CORPUS_1_8_3.child, capturedAt: 'now', harness: 'scripts/hmh-honest-corpus', runs: CORPUS_1_8_3.runs.slice(0, 2) };
  const text = serializeCorpus(corpus);
  assert.deepEqual(JSON.parse(text), corpus);
  const lines = text.split('\n');
  assert.equal(lines.filter((line) => line.startsWith('{"label":')).length, 2);
  assert.ok(text.endsWith(' ]\n}\n'));
});

test('the harness boots this checkout\'s child headless: the bridge handshake completes and the simulation runs from the seeded entry', async () => {
  const still = {
    chooseUpgrade: (offer) => offer.pendingChoices[0].id,
    frame: () => ({ id: 'headless-virtual-pad', index: 0, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) }),
  };
  const seed = 12345;
  const result = await runChild({ seed, buildHash: HARNESS_BUILD_HASH, seasonId: SEASON_ID, pilot: still, maxFrames: 300 });
  assert.deepEqual(result.errors, []);
  assert.equal(result.state, 'active');
  assert.ok(result.tick >= 280 && result.tick <= 300, `tick ${result.tick}`);
  const types = result.outbox.map((entry) => entry.message.type);
  assert.ok(types.includes('game:ready'), types.join(' '));
  assert.ok(types.includes('game:state'), types.join(' '));
  assert.ok(result.outbox.every((entry) => entry.valid), 'every child message is a valid hmh-bridge/v1 message');
  const entry = hmhV6LevelEntry(seed);
  assert.ok(Math.hypot(result.spies.motion.x - entry.x, result.spies.motion.y - entry.y) < 400, `spawned at ${entry.id}`);
  assert.equal(result.spies.accumulator?.identity?.buildHash ?? HARNESS_BUILD_HASH, HARNESS_BUILD_HASH);
});
