import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { startPlaySession, buildCabinetInitContextFromSession, buildParentSyncPacket } from '../apps/portal/src/arcade-core.mjs';

const WALLET = '0x1234567890abcdef1234567890abcdef12345678';
const daily = { cadence: 'daily', periodStart: '2026-09-10' };
const session = (options = {}) => startPlaySession({ wallet: WALLET, gameId: 'lester-blaster', mode: 'free', ...options });

test('parent binds same daily challenge to different session identities and the child init seed', () => {
  const a = session({ sessionNonce: 'challenge-a', hmhChallenge: daily });
  const b = session({ sessionNonce: 'challenge-b', hmhChallenge: daily });
  assert.notEqual(a.sessionId, b.sessionId);
  assert.equal(a.seed, b.seed, 'the shared daily course must not depend on session identity');
  assert.equal(a.hmhChallenge.periodStart, daily.periodStart);
  assert.equal(a.hmhChallenge.cadence, 'daily');
  assert.equal(a.hmhChallenge.buildHash, a.buildHash);
  assert.equal(a.hmhChallenge.seasonId, a.seasonId);
  assert.equal(a.canonicalContext.seed, a.seed);
  assert.equal(buildCabinetInitContextFromSession(a).seed, a.seed);
  assert.equal(Object.isFrozen(a.hmhChallenge), true);
});

test('different daily periods and weekly challenges have different deterministic seeds', () => {
  const a = session({ sessionNonce: 'one', hmhChallenge: daily });
  const b = session({ sessionNonce: 'one', hmhChallenge: { ...daily, periodStart: '2026-09-11' } });
  const c = session({ sessionNonce: 'one', hmhChallenge: { cadence: 'weekly', periodStart: '2026-09-07' } });
  assert.equal(new Set([a.seed, b.seed, c.seed]).size, 3);
  assert.equal(c.hmhChallenge.periodStart, '2026-09-07');
});

test('challenge runs retain Free isolation from all official parent writes', () => {
  const run = session({ hmhChallenge: daily });
  assert.equal(run.leaderboardEligible, false);
  assert.deepEqual(run.parentWriteScopes, []);
  assert.equal(run.entryFeeMicroUsdc, 0);
  assert.equal(run.urlSessionId, null);
  const packet = buildParentSyncPacket(run, { score: 500, runStats: { kills: 20 } });
  assert.deepEqual(packet.writeSets, []);
});

test('challenge injection is refused for paid HMH and other cabinets', () => {
  assert.throws(() => session({ mode: 'paid', hmhChallenge: daily }), /Free HMH/);
  assert.throws(() => session({ gameId: 'chikun', hmhChallenge: daily }), /Free HMH/);
});

test('old build or season links fail closed instead of silently starting a different course', () => {
  assert.throws(() => session({ hmhChallenge: { ...daily, buildHash: 'wrong-build' } }), /build/);
  assert.throws(() => session({ hmhChallenge: { ...daily, seasonId: 'wrong-season' } }), /season/);
});

test('ordinary free and paid sessions remain unique and are not challenges', () => {
  for (const mode of ['free', 'paid']) {
    const a = session({ mode, sessionNonce: '123e4567-e89b-42d3-a456-426614174000' });
    const b = session({ mode, sessionNonce: '123e4567-e89b-42d3-a456-426614174001' });
    assert.notEqual(a.seed, b.seed);
    assert.equal(a.hmhChallenge, null);
    assert.equal(b.hmhChallenge, null);
  }
});

test('challenge source and tests are registered in the explicit syntax gate', () => {
  const source = readFileSync(new URL('../scripts/syntax-check.mjs', import.meta.url), 'utf8');
  for (const path of ['apps/portal/src/hmh-challenges.mjs', 'tests/hmh-challenge-session.test.mjs', 'tests/hmh-challenges.test.mjs']) assert.ok(source.includes(`"${path}"`), path);
});
