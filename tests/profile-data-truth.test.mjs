import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { ACHIEVEMENTS, createInitialArcadeState, createPlayerProfile, buildProfileExperienceV2Model, buildHardMoneyHeroesStatsModule, unlockAchievement } from '../apps/portal/src/arcade-core.mjs';

const wallet = `0x${'b'.repeat(40)}`;
function fixture() {
  const state = createInitialArcadeState();
  state.profiles[wallet] = createPlayerProfile(wallet);
  state.runHistory = ['free', 'paid', 'ranked', undefined, 'unknown'].map((mode, index) => ({
    sessionId: `cache-${index}`, gameId: 'lester-blaster', wallet, mode,
    score: 100 + index, recordedAt: `2026-09-01T00:00:0${index}.000Z`,
  }));
  return state;
}

test('profile counts only explicit cached Ranked or paid modes, not Free or unknown modes', () => {
  const state = fixture();
  const before = JSON.stringify(state.runHistory);
  const model = buildProfileExperienceV2Model(state, wallet);
  assert.equal(model.trophyRoom.summary.totalRankedRuns, 2);
  assert.equal(model.trophyRoom.summary.rankedCountScope, 'cached-known-mode');
  assert.equal(model.trophyRoom.cards.find((card) => card.id === 'ranked-runs').label, 'Cached Ranked Runs');
  assert.match(model.trophyRoom.cards.find((card) => card.id === 'ranked-runs').meta, /not.*lifetime|not.*verified/i);
  assert.equal(JSON.stringify(state.runHistory), before, 'projection must not rewrite source modes');
});

test('missing mode stays unknown in the profile feed rather than acquiring paid identity', () => {
  const model = buildProfileExperienceV2Model(fixture(), wallet);
  assert.equal(model.sessionFeed.rows.find((row) => row.sessionId === 'cache-3').mode, null);
});

test('the cached mode count is independent of the visible feed limit', () => {
  const model = buildProfileExperienceV2Model(fixture(), wallet, { sessionLimit: 1 });
  assert.equal(model.sessionFeed.rows.length, 1);
  assert.equal(model.trophyRoom.summary.totalRankedRuns, 2);
});

test('all-Free and unknown history does not create a Ranked count', () => {
  const state = fixture();
  state.runHistory = state.runHistory.filter((row) => !['ranked', 'paid'].includes(row.mode));
  assert.equal(buildProfileExperienceV2Model(state, wallet).trophyRoom.summary.totalRankedRuns, 0);
});

test('explicit official paid sessions still count when no detailed summary exists', () => {
  const state = fixture(); state.runHistory = [];
  state.officialSessions = [{ sessionId: 'paid-official', gameId: 'lester-blaster', wallet, mode: 'paid', startedAt: '2026-09-01T00:00:00.000Z' }];
  assert.equal(buildProfileExperienceV2Model(state, wallet).trophyRoom.summary.totalRankedRuns, 1);
});

test('profile rarity remains unavailable without a verified global unlock index', () => {
  const state = fixture();
  unlockAchievement(state.profiles[wallet], ACHIEVEMENTS.CABINET_PIONEER.id, { unlockedAt: '2026-09-01T00:00:00.000Z' });
  const model = buildProfileExperienceV2Model(state, wallet);
  const items = model.achievements.groups.flatMap((group) => group.badges);
  assert.ok(items.length > 0);
  assert.ok(items.every((item) => item.rarityPct === null && item.rarityStatus === 'unavailable'));
  assert.ok(model.achievements.recent.every((item) => item.rarityPct === null && item.rarityStatus === 'unavailable'));
  const featured = model.trophyRoom.cards.find((card) => card.id === 'rare-achievement');
  assert.equal(featured.label, 'Featured Badge');
  assert.equal(featured.rarityPct, null);
  assert.match(featured.meta, /global.*unavailable/i);
  assert.doesNotMatch(featured.meta, /[0-9].*%/);
});

test('the HMH featured achievement does not expose a synthetic unlock percentage', () => {
  const state = fixture();
  unlockAchievement(state.profiles[wallet], ACHIEVEMENTS.CABINET_PIONEER.id, { unlockedAt: '2026-09-01T00:00:00.000Z' });
  const model = buildHardMoneyHeroesStatsModule(state, wallet);
  assert.ok(model.topAchievement);
  assert.equal(model.topAchievement.rarityPct, null);
  assert.equal(model.topAchievement.rarityStatus, 'unavailable');
});

test('profile receipt-card copy does not authenticate cached transaction metadata', () => {
  const state = fixture();
  state.settlements = [{ gameId: 'lester-blaster', sessionId: 'cache-1', wallet, primaryTxHash: `0x${'1'.repeat(64)}`, mode: 'simulated', settled: true }];
  const card = buildProfileExperienceV2Model(state, wallet).trophyRoom.cards.find((entry) => entry.id === 'settled-receipts');
  assert.equal(card.label, 'Cached Receipt Entries');
  assert.match(card.meta, /not.*proof.*settlement/i);
  assert.notEqual(card.tone, 'verified');
});

test('a cached transaction hash or cached settled flag does not authenticate a profile feed row', () => {
  const state = fixture();
  state.runHistory[1].primaryTxHash = `0x${'2'.repeat(64)}`;
  state.sessions['cache-1'] = { sessionId: 'cache-1', gameId: 'lester-blaster', wallet, mode: 'paid', integrity: { verdict: 'settled' }, settlement: { primaryTxHash: `0x${'2'.repeat(64)}` } };
  const row = buildProfileExperienceV2Model(state, wallet).sessionFeed.rows.find((entry) => entry.sessionId === 'cache-1');
  assert.equal(row.trust.label, 'Cached receipt');
  assert.notEqual(row.trust.tone, 'verified');
  assert.notEqual(row.trust.verdict, 'settled');
});

test('conservative cached rejection warnings are retained', () => {
  const state = fixture();
  state.flaggedSessions = [{ sessionId: 'cache-1', verdict: 'rejected', flags: ['fixture flag'] }];
  const row = buildProfileExperienceV2Model(state, wallet).sessionFeed.rows.find((entry) => entry.sessionId === 'cache-1');
  assert.equal(row.trust.verdict, 'rejected');
  assert.deepEqual(row.trust.flags, ['fixture flag']);
});

test('same-identity duplicate metadata preserves an explicit cached mode when the newer record omits it', () => {
  for (const mode of ['paid', 'ranked', 'free']) {
    const state = fixture();
    state.runHistory = [{ ...state.runHistory[0], sessionId: 'duplicate', mode }];
    state.officialSessions = [{ sessionId: 'duplicate', wallet, gameId: 'lester-blaster', score: 555 }];
    const before = JSON.stringify([state.runHistory, state.officialSessions]);
    const model = buildProfileExperienceV2Model(state, wallet);
    assert.equal(model.trophyRoom.summary.totalRankedRuns, mode === 'free' ? 0 : 1);
    assert.equal(model.sessionFeed.rows[0].mode, mode);
    assert.equal(model.sessionFeed.rows[0].score, 555, 'retain newer metadata');
    assert.equal(JSON.stringify([state.runHistory, state.officialSessions]), before);
  }
});

test('an explicit newer Free or unknown mode is not replaced by cached Ranked metadata', () => {
  for (const mode of ['free', 'unknown', '']) {
    const state = fixture();
    state.runHistory = [{ ...state.runHistory[0], sessionId: 'duplicate', mode: 'paid' }];
    state.officialSessions = [{ sessionId: 'duplicate', wallet, gameId: 'lester-blaster', mode }];
    const model = buildProfileExperienceV2Model(state, wallet);
    assert.equal(model.trophyRoom.summary.totalRankedRuns, 0);
    assert.equal(model.sessionFeed.rows[0].mode, mode);
  }
});

test('a same-ID record for a different cabinet does not inherit cached mode', () => {
  const state = fixture();
  state.runHistory = [{ ...state.runHistory[0], sessionId: 'duplicate', mode: 'paid' }];
  state.officialSessions = [{ sessionId: 'duplicate', wallet, gameId: 'chikun' }];
  const model = buildProfileExperienceV2Model(state, wallet);
  assert.equal(model.trophyRoom.summary.totalRankedRuns, 0);
  assert.equal(model.sessionFeed.rows[0].mode, null);
});

test('selected Ranked feed filters before limiting while preserving mixed feed rows and global cache count', () => {
  const state = fixture();
  state.runHistory = [
    ...Array.from({ length: 13 }, (_, i) => ({ wallet, gameId: 'lester-blaster', sessionId: `new-free-${i}`, mode: 'free', recordedAt: '2026-09-03T00:00:00.000Z' })),
    ...Array.from({ length: 13 }, (_, i) => ({ wallet, gameId: 'chikun', sessionId: `other-${i}`, mode: 'paid', recordedAt: '2026-09-02T00:00:00.000Z' })),
    { wallet, gameId: 'lester-blaster', sessionId: 'old-ranked', mode: 'ranked', recordedAt: '2026-09-01T00:00:00.000Z' },
  ];
  const model = buildProfileExperienceV2Model(state, wallet, { sessionLimit: 1 });
  assert.equal(model.sessionFeed.rows.length, 1);
  assert.equal(model.sessionFeed.rows[0].mode, 'free', 'do not replace mixed feed needed by existing details/links');
  assert.ok(Array.isArray(model.sessionFeed.rankedRows));
  assert.deepEqual(model.sessionFeed.rankedRows.map((row) => row.sessionId), ['old-ranked']);
  assert.equal(model.trophyRoom.summary.totalRankedRuns, state.runHistory.filter((row) => row.mode === 'ranked' || row.mode === 'paid').length);
  const other = buildProfileExperienceV2Model(state, wallet, { selectedGameId: 'chikun', sessionLimit: 1 });
  assert.equal(other.sessionFeed.rankedRows.length, 1);
  assert.equal(other.sessionFeed.rankedRows[0].gameId, 'chikun');
});

test('profile truth regression suite is included in the explicit syntax gate', () => {
  const source = readFileSync(new URL('../scripts/syntax-check.mjs', import.meta.url), 'utf8');
  assert.ok(source.includes("'tests/profile-data-truth.test.mjs'"));
});
