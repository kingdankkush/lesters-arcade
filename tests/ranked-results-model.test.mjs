import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BANNER_TEXT,
  DAILY_STANDING_ENABLED,
  EXPLORER_ORIGIN,
  buildRankedResultsModel,
  rejectionText,
  shortWallet,
} from '../apps/portal/src/ranked-results-model.mjs';
import { catalogFor, nftAchievementIds } from '../apps/portal/src/achievements/index.mjs';
import { LITVM_DEPLOYMENT } from '../apps/portal/src/generated/litvm-addresses.mjs';
import { xWeightedLength } from '../apps/portal/src/share-links.mjs';

// Contract §7.2 client states, §7.3 model, guide §3.3.
const STATES = ['preview', 'waiting-entry', 'verifying', 'queued', 'publishing', 'published', 'retrying', 'saved-locally', 'rejected', 'practice'];
const ENTRY_STATUSES = ['none', 'pending', 'confirmed', 'failed'];
const WALLET = `0x${'1a'.repeat(20)}`;
const SESSION_ID32 = `0x${'ab'.repeat(32)}`;
const ENTRY_TX = `0x${'cd'.repeat(32)}`;
const PUBLISH_TX = `0x${'ef'.repeat(32)}`;
const TIMELINE_IDS = ['entry', 'verified', 'publishing', 'published', 'achievements'];

const LOCAL_STATS = {
  'lester-blaster': { kills: 300, survivalSeconds: 700, maxCombo: 40, level: 9, bossKills: 0 },
  chikun: { regionReached: 'forest', laps: 0, forksPassed: 30, nearMisses: 8, coinsCollected: 20, bestCombo: 5 },
  stacked: { lines: 150, level: 12, quadClears: 4, perfectClears: 0, maxCombo: 6, survivalSeconds: 1200 },
};
const SERVER_STATS = {
  'lester-blaster': { kills: 312, survivalSeconds: 724, maxCombo: 42, level: 10, bossKills: 1 },
  chikun: { regionReached: 'farmland', laps: 1, forksPassed: 52, nearMisses: 18, coinsCollected: 41, bestCombo: 9 },
  stacked: { lines: 186, level: 14, quadClears: 5, perfectClears: 1, maxCombo: 7, survivalSeconds: 1500 },
};

// The server row a state implies (§7.2 mapping of §3.3 statuses), or null
// when the client has no SettleResponse yet.
function serverFor(state, gameId, extra = {}) {
  const status = { queued: 'signed', publishing: 'submitted', published: 'confirmed', retrying: 'failed', rejected: 'failed' }[state];
  if (!status) return null;
  return {
    ok: true, view: 'owner', sessionId32: SESSION_ID32, gameId, wallet: WALLET, status,
    score: 48210, stats: SERVER_STATS[gameId], txHash: status === 'confirmed' ? PUBLISH_TX : null,
    explorerUrl: status === 'confirmed' ? `${EXPLORER_ORIGIN}/tx/${PUBLISH_TX}` : null,
    achievements: [], retryable: state !== 'rejected' && state !== 'published', attempts: state === 'rejected' ? 3 : 0,
    lastError: state === 'rejected' ? 'replay-rejected' : null,
    ...extra,
  };
}

function snapshotFor(state, { gameId = 'chikun', entryStatus = 'confirmed', server, error = null } = {}) {
  return {
    state, sessionId32: SESSION_ID32, shareId: SESSION_ID32.slice(2), gameId, wallet: WALLET, localScore: 45000,
    entry: { status: entryStatus, txHash: entryStatus === 'none' ? null : ENTRY_TX },
    server: server === undefined ? serverFor(state, gameId) : server,
    error, updatedAt: 1,
  };
}

function contextFor(gameId = 'chikun', extra = {}) {
  return {
    gameId, gameTitle: undefined, sessionId: 'game-session-00000000-0000-4000-8000-000000000000', sessionId32: SESSION_ID32,
    wallet: WALLET, displayName: 'Lit Pilot', localScore: 45000, localStats: LOCAL_STATS[gameId], previousBest: 44000,
    entry: { status: 'none', txHash: null }, mode: 'ranked', ...extra,
  };
}

const EXPECTED_BANNER = {
  preview: 'preview', practice: 'practice', 'saved-locally': 'saved-locally', retrying: 'retrying', rejected: 'rejected',
  'waiting-entry': null, verifying: null, queued: null, publishing: null, published: null,
};

test('every client state times every entry status keeps the timeline, banner and actions consistent', () => {
  for (const state of STATES) {
    for (const entryStatus of ENTRY_STATUSES) {
      const label = `${state}/${entryStatus}`;
      const model = buildRankedResultsModel({ snapshot: snapshotFor(state, { entryStatus }), context: contextFor(), standing: { weekly: { rank: 3 }, allTime: { rank: 12 } } });
      assert.deepEqual(model.timeline.map((stepItem) => stepItem.id), TIMELINE_IDS, label);
      for (const stepItem of model.timeline) {
        assert.ok(['done', 'active', 'pending', 'failed', 'skipped'].includes(stepItem.status), `${label} ${stepItem.id}`);
        assert.equal(typeof stepItem.label, 'string');
        if (stepItem.href !== null) assert.ok(stepItem.href.startsWith(`${EXPLORER_ORIGIN}/tx/0x`), `${label} ${stepItem.id} links only to the explorer`);
      }
      const byId = Object.fromEntries(model.timeline.map((stepItem) => [stepItem.id, stepItem]));
      // Never a fake success: Published is done only in `published`, with the transaction link.
      assert.equal(byId.published.status === 'done', state === 'published', label);
      if (state === 'published') assert.equal(byId.published.href, `${EXPLORER_ORIGIN}/tx/${PUBLISH_TX}`);
      else assert.equal(byId.published.href, null, label);
      // Entry step follows snapshot.entry and the state.
      if (state === 'preview') assert.equal(byId.entry.status, 'skipped', label);
      else if (state === 'practice' || entryStatus === 'failed') assert.equal(byId.entry.status, 'failed', label);
      else if (entryStatus === 'confirmed' || model.timeline && serverFor(state, 'chikun')) assert.equal(byId.entry.status, 'done', label);
      else if (entryStatus === 'pending' || state === 'waiting-entry') assert.equal(byId.entry.status, 'active', label);
      // Verification is done exactly when the server holds the row.
      if (state === 'preview' || state === 'practice') assert.equal(byId.verified.status, 'skipped', label);
      else assert.equal(byId.verified.status === 'done', serverFor(state, 'chikun') !== null, label);
      if (state === 'rejected') assert.equal(byId.publishing.status, 'failed', `${label}: a dead-lettered publish fails the publishing step`);
      // Banner per state, and never a dead end.
      assert.equal(model.banner.kind, EXPECTED_BANNER[state], label);
      assert.equal(model.actions.playAgain, true, label);
      assert.equal(model.actions.practice, true, label);
      assert.equal(model.actions.profile, true, label);
      assert.equal(model.actions.retry, state === 'saved-locally', label);
      // Share only once published (Ranked) or for preview/practice (Free).
      assert.equal(model.actions.share, ['published', 'preview', 'practice'].includes(state), label);
      if (model.share) {
        assert.equal(model.share.template, state === 'published' ? 'ranked' : 'free', label);
        assert.equal(/Verified on LitVM/.test(model.share.text), state === 'published', label);
        assert.ok(xWeightedLength(model.share.text) + 24 <= 280, label);
      }
    }
  }
});

test('the timeline walks entry, verification, queue, publishing and publication', () => {
  const statuses = (state, options) => buildRankedResultsModel({ snapshot: snapshotFor(state, options), context: contextFor() }).timeline.map((stepItem) => stepItem.status);
  assert.deepEqual(statuses('waiting-entry', { entryStatus: 'pending' }), ['active', 'pending', 'pending', 'pending', 'pending']);
  assert.deepEqual(statuses('verifying'), ['done', 'active', 'pending', 'pending', 'pending']);
  assert.deepEqual(statuses('queued'), ['done', 'done', 'active', 'pending', 'done']);
  assert.deepEqual(statuses('publishing'), ['done', 'done', 'active', 'pending', 'done']);
  assert.deepEqual(statuses('published'), ['done', 'done', 'done', 'done', 'done']);
  assert.deepEqual(statuses('preview', { entryStatus: 'none' }), ['skipped', 'skipped', 'skipped', 'skipped', 'skipped']);
  assert.deepEqual(statuses('practice', { entryStatus: 'failed' }), ['failed', 'skipped', 'skipped', 'skipped', 'skipped']);
  assert.deepEqual(statuses('rejected', { server: null, error: { code: 'replay-rejected', retryable: false } }), ['done', 'failed', 'skipped', 'skipped', 'skipped']);
  assert.deepEqual(statuses('rejected'), ['done', 'done', 'failed', 'skipped', 'done']);
  assert.deepEqual(statuses('retrying', { server: null, entryStatus: 'pending', error: { code: 'entry-pending', retryable: true } }), ['active', 'active', 'pending', 'pending', 'pending']);
  assert.deepEqual(statuses('retrying'), ['done', 'done', 'active', 'pending', 'done']);
  assert.deepEqual(statuses('saved-locally', { server: null, error: { code: 'network-error', retryable: true } }), ['done', 'pending', 'pending', 'pending', 'pending']);
  // A resumed handle after reload has no entry promise, but the server row proves the entry.
  assert.equal(buildRankedResultsModel({ snapshot: snapshotFor('queued', { entryStatus: 'none' }), context: contextFor() }).timeline[0].status, 'done');
  // The ranked-entry event (merged into context.entry) can confirm the chip before the snapshot does.
  const chip = buildRankedResultsModel({ snapshot: snapshotFor('waiting-entry', { entryStatus: 'pending', server: null }), context: contextFor('chikun', { entry: { status: 'confirmed', txHash: ENTRY_TX } }) });
  assert.equal(chip.timeline[0].status, 'done');
  assert.equal(chip.timeline[0].href, `${EXPLORER_ORIGIN}/tx/${ENTRY_TX}`);
  // Only explorer transaction URLs are ever linked.
  const hostile = buildRankedResultsModel({ snapshot: snapshotFor('published', { server: { ...serverFor('published', 'chikun'), explorerUrl: 'javascript:alert(1)' } }), context: contextFor() });
  assert.equal(hostile.timeline[3].href, null);
  assert.equal(hostile.timeline[3].status, 'done');
});

test('banners cover every terminal and error state in plain words', () => {
  const banner = (state, options) => buildRankedResultsModel({ snapshot: snapshotFor(state, options), context: contextFor() }).banner;
  assert.equal(banner('preview', { entryStatus: 'none' }).text, 'Ranked preview · not published while online settlement is off');
  assert.equal(banner('practice', { entryStatus: 'failed' }).text, "Entry didn't confirm, so this run was practice");
  assert.equal(banner('saved-locally', { server: null, error: { code: 'network-error', retryable: true } }).text, 'Saved. Publishing will retry automatically');
  assert.match(banner('saved-locally', { server: null, error: { code: 'sign-in-required', retryable: true } }).detail, /Sign in again/);
  for (const code of ['entry-pending', 'run-timing-early']) {
    const retrying = banner('retrying', { server: null, error: { code, retryable: true } });
    assert.equal(retrying.kind, 'retrying', code);
    assert.equal(retrying.text, 'Publishing will retry shortly', code);
  }
  for (const state of ['saved-locally', 'retrying']) {
    const paused = banner(state, { server: null, error: { code: 'settlement-paused', retryable: true } });
    assert.equal(paused.kind, 'paused');
    assert.equal(paused.text, 'Ranked publishing is paused; your run is saved and will publish when it resumes');
  }
  assert.deepEqual(Object.values(BANNER_TEXT).length, 5);
  const rejected = banner('rejected', { server: null, error: { code: 'entry-not-paid', retryable: false } });
  assert.equal(rejected.kind, 'rejected');
  assert.match(rejected.text, /entry payment wasn't found/);
  assert.match(rejected.detail, /not refunded/);
  assert.match(banner('rejected').text, /replayed this run/, 'a dead letter maps its lastError');
  for (const [code, words] of [['entry-underpaid', /Ranked minimum/], ['implausible-run', /plausibility/], ['run-stale', /too old/], ['stale', /too old/],
    ['hero-locked', /hero/], ['seed-ticket-stale', /seed ticket/], ['identity-wallet', /run data/], ['score-out-of-bounds', /allowed range/],
    ['session-conflict', /different run/], ['wallet-mismatch', /different wallet/], ['something-new', /couldn't publish/]]) {
    assert.match(rejectionText(code), words, code);
    assert.doesNotMatch(rejectionText(code), /-/.test(code) ? new RegExp(code) : /$^/, `${code} is never shown raw`);
  }
  assert.equal(banner('published').kind, null);
  assert.equal(banner('verifying', { server: null }).kind, null);
});

test('standing text shows weekly and all-time ranks and the personal best only once published', () => {
  const model = (state, context = {}, standing = { weekly: { rank: 3, score: 48210 }, allTime: { rank: 12, score: 48210 } }) => buildRankedResultsModel({
    snapshot: snapshotFor(state, { gameId: 'lester-blaster' }), context: contextFor('lester-blaster', { previousBest: 44000, ...context }), standing,
  });
  const published = model('published');
  assert.equal(published.standing.text, '#3 this week · #12 all-time · New personal best (+4,210)');
  assert.equal(published.standing.personalBestDelta, 4210);
  assert.match(published.share.text, /48,210 pts · Rank 3 this week/);
  assert.match(published.share.text, /🔥 New personal best!/);
  assert.doesNotMatch(published.share.text, /#/, 'the share text never carries #');
  assert.equal(DAILY_STANDING_ENABLED, false, 'D2: Daily stays off until the owner switches it on');
  assert.equal(model('published', {}, { daily: { rank: 1 }, weekly: { rank: 3 }, allTime: null }).standing.text, '#3 this week · New personal best (+4,210)');
  assert.equal(model('published', { previousBest: 50000 }).standing.text, '#3 this week · #12 all-time');
  assert.equal(model('published', { previousBest: 50000 }).standing.personalBestDelta, null);
  assert.equal(model('published', { previousBest: null }, null).standing.text, null, 'an unknown previous best claims nothing');
  assert.equal(model('publishing').standing.text, null, 'no standing or personal best before the run is published');
  assert.equal(model('rejected').standing.personalBestDelta, null);
  const preview = buildRankedResultsModel({ snapshot: snapshotFor('preview', { gameId: 'lester-blaster', entryStatus: 'none' }), context: contextFor('lester-blaster', { previousBest: 40000 }) });
  assert.equal(preview.standing.text, 'New personal best (+5,000)', 'preview compares against the local best');
  assert.equal(preview.hero.score, 45000, 'preview has no server score');
});

test('each game lists its guide §3.3 stats, local until the server stats arrive', () => {
  const labels = { 'lester-blaster': ['Kills', 'Time', 'Best combo', 'Level', 'Boss'], chikun: ['Region', 'Laps', 'Forks', 'Near-misses', 'Coins', 'Best combo'], stacked: ['Lines', 'Level', 'Halvings', 'Perfect clears', 'Best combo', 'Time'] };
  const local = { 'lester-blaster': ['300', '11:40', '×40', '9', 'Not defeated'], chikun: ['Forest', '0', '30', '8', '20', '×5'], stacked: ['150', '12', '4', '0', '×6', '20:00'] };
  const server = { 'lester-blaster': ['312', '12:04', '×42', '10', 'Defeated'], chikun: ['Farmland', '1', '52', '18', '41', '×9'], stacked: ['186', '14', '5', '1', '×7', '25:00'] };
  for (const gameId of Object.keys(labels)) {
    const verifying = buildRankedResultsModel({ snapshot: snapshotFor('verifying', { gameId, server: null }), context: contextFor(gameId) });
    assert.deepEqual(verifying.stats.map((row) => row.label), labels[gameId], gameId);
    assert.deepEqual(verifying.stats.map((row) => row.value), local[gameId], `${gameId} local`);
    assert.equal(verifying.statsSource, 'local');
    assert.equal(verifying.hero.score, 45000);
    const queued = buildRankedResultsModel({ snapshot: snapshotFor('queued', { gameId }), context: contextFor(gameId) });
    assert.deepEqual(queued.stats.map((row) => row.value), server[gameId], `${gameId} server`);
    assert.equal(queued.statsSource, 'server');
    assert.equal(queued.hero.score, 48210, 'the server score replaces the local claim');
    assert.equal(queued.hero.scoreLabel, '48,210');
  }
  const missing = buildRankedResultsModel({ snapshot: snapshotFor('verifying', { gameId: 'stacked', server: null }), context: contextFor('stacked', { localStats: null }) });
  assert.ok(missing.stats.every((row) => row.value === '—'), 'missing stats read as a dash, never as zero');
  const long = buildRankedResultsModel({ snapshot: snapshotFor('queued', { gameId: 'stacked', server: { ...serverFor('queued', 'stacked'), stats: { ...SERVER_STATS.stacked, survivalSeconds: 7322 } } }), context: contextFor('stacked') });
  assert.equal(long.stats.at(-1).value, '2:02:02');
});

test('the hero handle is the display name, else the short wallet', () => {
  const handle = (context) => buildRankedResultsModel({ snapshot: snapshotFor('published'), context: contextFor('chikun', context) }).hero.handle;
  assert.equal(handle({}), 'Lit Pilot');
  assert.equal(handle({ displayName: null }), '0x1a1a…1a1a', 'hidden and blocked names arrive as null');
  assert.equal(handle({ displayName: '   ' }), '0x1a1a…1a1a');
  assert.equal(shortWallet('0xNOPE'), '');
  assert.equal(buildRankedResultsModel({ snapshot: { state: 'preview', gameId: 'chikun', entry: { status: 'none' } }, context: { gameId: 'chikun' } }).hero.handle, 'Player');
});

test('share is enabled only once published', () => {
  for (const state of STATES) {
    const model = buildRankedResultsModel({ snapshot: snapshotFor(state), context: contextFor() });
    if (state === 'published') {
      assert.equal(model.share.template, 'ranked');
      assert.equal(model.share.url, `https://lestersarcade.io/s/${SESSION_ID32.slice(2)}`);
      assert.match(model.share.text, /⛓ Verified on LitVM/);
    } else if (state === 'preview' || state === 'practice') {
      assert.equal(model.share.template, 'free', state);
      assert.equal(model.share.url, 'https://lestersarcade.io', `${state} shares the site root`);
      assert.match(model.share.text, /Practising on @LestersArcade$/);
      assert.doesNotMatch(model.share.text, /Verified|RANKED/);
    } else {
      assert.equal(model.share, null, state);
      assert.equal(model.actions.share, false, state);
    }
  }
  // A published snapshot without a usable session key cannot build the Ranked page link.
  const noKey = buildRankedResultsModel({ snapshot: { ...snapshotFor('published'), sessionId32: null, server: { ...serverFor('published', 'chikun'), sessionId32: null } }, context: contextFor('chikun', { sessionId32: null }) });
  assert.equal(noKey.actions.share, false);
});

test('NFT-flagged unlocks show no NFT wording without a token id', () => {
  const nftId = nftAchievementIds('chikun')[0];
  const plainId = catalogFor('chikun').find((entry) => !entry.nft).id;
  const snapshot = snapshotFor('published', { server: { ...serverFor('published', 'chikun'), achievements: [
    { id: nftId, gameId: 'chikun', title: 'x', tier: 'platinum', nft: true, image: '/assets/x.png', unlockedAt: 't', tokenId: null },
    { id: plainId, gameId: 'chikun', title: 'y', tier: 'bronze', nft: false, image: '/assets/y.png', unlockedAt: 't', tokenId: null },
  ] } });
  const model = buildRankedResultsModel({ snapshot, context: contextFor() });
  assert.equal(model.achievements.length, 2);
  for (const achievement of model.achievements) {
    assert.deepEqual(Object.keys(achievement).sort(), ['id', 'image', 'tier', 'title', 'tokenHref', 'tokenId']);
    assert.equal(achievement.tokenId, null);
    assert.equal(achievement.tokenHref, null);
  }
  const catalog = catalogFor('chikun').find((entry) => entry.id === nftId);
  assert.equal(model.achievements[0].title, catalog.title, 'catalog title');
  assert.equal(model.achievements[0].image, catalog.image, 'catalog image');
  assert.equal(model.achievements[0].tier, catalog.tier, 'catalog tier');
  assert.doesNotMatch(JSON.stringify(model), /nft|soulbound|mint/i, 'phase 1 never says NFT, soulbound or minting (A32)');
  assert.equal(model.timeline[4].label, '2 achievements recorded');
  // Phase 2: a real token id shows the token link.
  const held = buildRankedResultsModel({ snapshot: snapshotFor('published', { server: { ...serverFor('published', 'chikun'), achievements: [{ id: nftId, tier: 'platinum', tokenId: '7' }] } }), context: contextFor() });
  assert.equal(held.achievements[0].tokenId, '7');
  assert.equal(held.achievements[0].tokenHref, `${EXPLORER_ORIGIN}/token/${LITVM_DEPLOYMENT.addresses.achievementRegistries.chikun}/instance/7`);
  const unknown = buildRankedResultsModel({ snapshot: snapshotFor('published', { server: { ...serverFor('published', 'chikun'), achievements: [{ id: 'retired-id', title: 'Old', tier: 'gold', image: 'javascript:x', tokenId: 'NaN' }] } }), context: contextFor() });
  assert.deepEqual({ ...unknown.achievements[0] }, { id: 'retired-id', title: 'Old', tier: 'gold', image: null, tokenId: null, tokenHref: null });
});

test('an unpersisted STACKED body asks the player to keep the tab open until the server holds it', () => {
  const notice = (state, extra) => buildRankedResultsModel({ snapshot: { ...snapshotFor(state, { gameId: 'stacked', ...extra }), persisted: false }, context: contextFor('stacked') }).notice;
  assert.equal(notice('verifying', { server: null }), 'Keep this tab open until publishing finishes');
  assert.equal(notice('saved-locally', { server: null }), 'Keep this tab open until publishing finishes');
  assert.equal(notice('queued'), null, 'the server stores the evidence on the first successful POST');
  assert.equal(notice('published'), null);
  assert.equal(buildRankedResultsModel({ snapshot: snapshotFor('verifying', { gameId: 'stacked', server: null }), context: contextFor('stacked') }).notice, null, 'persisted bodies need no notice');
});

test('a missing or unknown snapshot degrades to an honest screen', () => {
  const none = buildRankedResultsModel({ snapshot: null, context: { gameId: 'stacked' } });
  assert.equal(none.state, 'preview');
  assert.equal(none.banner.kind, 'preview');
  const odd = buildRankedResultsModel({ snapshot: { state: 'teleported', gameId: 'stacked' }, context: { gameId: 'stacked' } });
  assert.equal(odd.state, 'verifying');
  assert.equal(odd.actions.share, false);
  assert.equal(odd.timeline[3].status, 'pending');
});
