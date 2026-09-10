import test from 'node:test';
import assert from 'node:assert/strict';
import * as challenges from '../apps/portal/src/hmh-challenges.mjs';

const identity = { buildHash: 'site-3.3.0:game-0.8.0', seasonId: 'testnet-season-1' };
const make = (options = {}) => challenges.buildHmhChallenge({ cadence: 'daily', now: Date.parse('2026-09-10T12:00:00Z'), ...identity, ...options });

test('daily UTC boundaries and Monday weekly boundaries ignore caller timezone', () => {
  const period = challenges.hmhChallengePeriod;
  assert.equal(period('daily', '2026-09-10T23:59:59.999Z'), '2026-09-10');
  assert.equal(period('daily', '2026-09-10T17:00:00-07:00'), '2026-09-11');
  assert.equal(period('weekly', '2026-09-13T23:59:59.999Z'), '2026-09-07');
  assert.equal(period('weekly', '2026-09-14T00:00:00.000Z'), '2026-09-14');
  assert.equal(period('weekly', '2027-01-01T00:00:00Z'), '2026-12-28');
});

test('cadence, period, version, build, and season all scope challenge identity', () => {
  const a = make();
  assert.deepEqual(make({ now: Date.parse('2026-09-10T23:00:00Z') }), a);
  assert.equal(a.endsAt, '2026-09-11T00:00:00.000Z');
  assert.equal(make({ cadence: 'weekly' }).endsAt, '2026-09-14T00:00:00.000Z');
  assert.notEqual(make({ buildHash: 'next' }).seed, a.seed);
  assert.notEqual(make({ seasonId: 'next' }).seed, a.seed);
  assert.throws(() => make({ version: 'unknown' }), /version/);
  assert.equal(a.official, false);
});

test('malformed dates, non-Monday weeks, invalid identities and unknown cadence fail closed', () => {
  for (const periodStart of ['2026-02-30', '2026-13-01', '2026-9-1', '', '<script>']) assert.throws(() => make({ periodStart }), /period/);
  assert.throws(() => make({ cadence: 'weekly', periodStart: '2026-09-10' }), /period/);
  assert.throws(() => make({ cadence: 'monthly' }), /cadence/);
  assert.throws(() => make({ now: NaN }), /date/);
  assert.throws(() => make({ buildHash: '' }), /build/);
  assert.throws(() => make({ seasonId: 'wallet@example.test' }), /season/);
});

test('sharing rebuilds a canonical cabinet URL without wallet, session, debug, or fragment data', () => {
  assert.equal(typeof challenges.buildHmhChallengeUrl, 'function', 'share URL builder is required');
  assert.equal(typeof challenges.readHmhChallengeSearch, 'function', 'strict shared challenge reader is required');
  const a = make();
  const url = new URL(challenges.buildHmhChallengeUrl(a, 'https://arcade.example/profile?wallet=secret&hmhDebug=balance#private'));
  assert.equal(url.pathname, '/games/hard-money-heroes');
  assert.equal(url.hash, '');
  assert.equal(url.searchParams.has('wallet'), false);
  assert.equal(url.searchParams.has('hmhDebug'), false);
  const request = challenges.readHmhChallengeSearch(url.search);
  assert.deepEqual(challenges.resolveHmhChallenge(request, { mode: 'free', gameId: 'lester-blaster', ...identity }), a);
  assert.throws(() => challenges.buildHmhChallengeUrl(a, 'javascript:alert(1)'), /origin/);
});

test('shared challenge parsing distinguishes absent from malformed and duplicate fields', () => {
  assert.equal(typeof challenges.readHmhChallengeSearch, 'function');
  const read = challenges.readHmhChallengeSearch;
  assert.equal(read('?unrelated=value'), null);
  assert.throws(() => read('?hmhChallenge=daily'), /Incomplete/);
  assert.throws(() => read('?hmhPeriod=2026-09-10'), /Incomplete/);
  const valid = new URL(challenges.buildHmhChallengeUrl(make(), 'https://arcade.example')).search;
  assert.throws(() => read(`${valid}&hmhChallenge=weekly`), /Duplicate/);
  assert.throws(() => read(valid.replace('hmh-challenge-v1', 'hmh-challenge-v2')), /version/);
  assert.throws(() => read(valid.replace('daily', 'monthly')), /cadence/);
  assert.throws(() => read(valid.replace('2026-09-10', '2026-02-30')), /period/);
  assert.throws(() => read(`${valid}&hmhBuild=${'x'.repeat(1000)}`), /Duplicate|Invalid|large/);
});
