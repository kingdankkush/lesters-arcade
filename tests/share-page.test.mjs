import assert from 'node:assert/strict';
import test from 'node:test';

import * as sharePageApi from '../api/share-page.mjs';
import { readPublicSession } from '../server/neon/queries.mjs';
import { escapeHtml, renderSharePage } from '../server/share/render-page.mjs';
import { createPgliteClient, seedAchievementUnlock, seedVerifiedSession, seedWalletProfile } from './helpers/pglite-client.mjs';
import { fakeRequest, fakeResponse } from './helpers/fake-http.mjs';

// Contract §7.5 and §4.3.9 (E10), A5, A29, A30, A32; guide §3.4, §5.12 item 3.
// The real handler runs against an unmigrated PGlite (so a missing
// ensureSchema fails) with index's seed helpers.

const env = Object.freeze({ VERCEL_ENV: 'development', SESSION_SECRET: `share-page-fixture-${'d7'.repeat(16)}` });
const WALLET = `0x${'7d'.repeat(20)}`;

async function page(db, url, method = 'GET') {
  const res = fakeResponse();
  await sharePageApi.createHandler(() => sharePageApi.buildDeps(env, { db }))(fakeRequest({ method, url }), res);
  return { status: res.statusCode, headers: res.headers, html: res.text ?? '' };
}

function meta(html, key) {
  const pattern = new RegExp(`<meta (?:property|name)="${key.replace(/[.:]/g, (c) => `\\${c}`)}" content="([^"]*)">`);
  return pattern.exec(html)?.[1] ?? null;
}

async function seedRun(db, { status = 'confirmed', gameId = 'lester-blaster', profile = { displayName: 'Page Pilot' } } = {}) {
  const row = await seedVerifiedSession(db, {
    gameId, status, wallet: WALLET, score: 48210,
    stats: { score: 48210, kills: 312, survivalSeconds: 724, maxCombo: 42, level: 10, bossKills: 1 },
  });
  if (profile) await seedWalletProfile(db, { wallet: WALLET, ...profile });
  return { row, shareId: row.sessionId32.slice(2) };
}

test('share page carries OG and Twitter tags with @LestersArcade and a versioned card URL', async () => {
  const db = createPgliteClient();
  try {
    const { row, shareId } = await seedRun(db);
    await seedAchievementUnlock(db, { wallet: WALLET, gameId: 'lester-blaster', achievementId: 'first-blood', sessionId32: row.sessionId32, tier: 'bronze' });
    const session = await readPublicSession(db, row.sessionId32);
    const response = await page(db, `/api/share-page?id=${shareId}`);
    assert.equal(response.status, 200);
    assert.equal(response.headers['content-type'], 'text/html; charset=utf-8');
    const { html } = response;
    assert.match(html, /^<!doctype html>/);
    const pageUrl = `https://lestersarcade.io/s/${shareId}`;
    const cardUrl = `https://lestersarcade.io/api/share-card/${shareId}.png?v=${session.cardRev}`;
    assert.match(session.cardRev, /^[0-9a-f]{12}$/);
    assert.equal(meta(html, 'og:type'), 'website');
    assert.equal(meta(html, 'og:site_name'), 'Lester&#39;s Arcade');
    assert.equal(meta(html, 'og:title'), 'Page Pilot scored 48,210 in Hard Money Heroes');
    assert.equal(meta(html, 'og:description'), 'Verified on LitVM · #1 this week · #1 all-time · 312 kills · 12:04 survived · ×42 combo. Can you beat it? Play free or Ranked at Lester&#39;s Arcade.');
    assert.equal(meta(html, 'og:url'), pageUrl);
    assert.equal(meta(html, 'og:image'), cardUrl, 'versioned card URL (?v=cardRev)');
    assert.equal(meta(html, 'og:image:width'), '1200');
    assert.equal(meta(html, 'og:image:height'), '630');
    assert.equal(meta(html, 'twitter:card'), 'summary_large_image');
    assert.equal(meta(html, 'twitter:site'), '@LestersArcade');
    assert.equal(meta(html, 'twitter:title'), meta(html, 'og:title'));
    assert.equal(meta(html, 'twitter:description'), meta(html, 'og:description'));
    assert.equal(meta(html, 'twitter:image'), cardUrl);
    assert.match(html, new RegExp(`<link rel="canonical" href="${pageUrl}">`));
    // Body: card, stats, badges, transaction link and Play buttons; no JS.
    assert.match(html, new RegExp(`<img class="shot" src="/api/share-card/${shareId}\\.png\\?v=${session.cardRev}" width="1200" height="630"`));
    assert.match(html, /✓ Verified on LitVM/);
    assert.match(html, /Plausibility-checked by the arcade server/, 'HMH says plausibility-checked (A33)');
    assert.match(html, new RegExp(`<a href="${session.explorerUrl.replace(/[/.]/g, (c) => `\\${c}`)}" rel="noopener noreferrer">View the transaction`));
    assert.match(html, /<a class="button primary" href="\/play\/hard-money-heroes">Play Hard Money Heroes<\/a>/);
    assert.match(html, /<dt>Kills<\/dt><dd>312<\/dd>/);
    assert.match(html, /<li data-tier="bronze"><img src="\/assets\/generated\/achievement-badges\/first-blood\.png"/);
    assert.doesNotMatch(html, /<script/i, 'the page has no JS');
    assert.doesNotMatch(html, /name="robots" content="noindex"/, 'a confirmed page is not noindexed by the page itself');
    assert.doesNotMatch(html, /NFT|soulbound|mint/i, 'no NFT wording without a token (A32)');
    for (const game of ['chikun', 'stacked']) {
      const other = await seedRun(db, { gameId: game });
      const otherPage = await page(db, `/api/share-page?id=${other.shareId}`);
      assert.match(otherPage.html, new RegExp(`href="/play/${game}"`), game);
      assert.match(otherPage.html, /Replayed and verified by the arcade server/, game);
    }
  } finally {
    await db.close();
  }
});

test('confirmed pages are cacheable, others briefly', async () => {
  const db = createPgliteClient();
  try {
    const confirmed = await seedRun(db);
    assert.equal((await page(db, `/api/share-page?id=${confirmed.shareId}`)).headers['cache-control'], 'public, s-maxage=300, stale-while-revalidate=86400');
    for (const status of ['signed', 'submitted', 'failed']) {
      const other = await seedRun(db, { status });
      const response = await page(db, `/api/share-page?id=${other.shareId}`);
      assert.equal(response.status, 200, status);
      assert.equal(response.headers['cache-control'], 'public, s-maxage=15', status);
    }
    const missing = await page(db, `/api/share-page?id=${'0f'.repeat(32)}`);
    assert.equal(missing.headers['cache-control'], 'public, s-maxage=30');
    const bad = await page(db, '/api/share-page?id=nope');
    assert.equal(bad.headers['cache-control'], 'no-store');
  } finally {
    await db.close();
  }
});

test('unpublished runs say publishing, with no transaction link', async () => {
  const db = createPgliteClient();
  try {
    for (const status of ['signed', 'submitted', 'failed']) {
      const { shareId } = await seedRun(db, { status });
      const { html, headers } = await page(db, `/api/share-page?id=${shareId}`);
      assert.match(html, /Publishing to LitVM…/, status);
      assert.doesNotMatch(html, /Verified on LitVM/i, status);
      assert.doesNotMatch(html, /liteforge\.explorer\.caldera\.xyz\/tx\//, `${status}: no transaction link`);
      assert.match(html, /<meta name="robots" content="noindex">/, status);
      assert.equal(headers['x-robots-tag'], 'noindex', status);
      assert.match(meta(html, 'og:title'), /is publishing to LitVM$/);
      assert.match(meta(html, 'og:description'), /^Publishing to LitVM… 48,210 pts/);
    }
    // A pending row is not a public record yet: 404.
    const pending = await seedRun(db, { status: 'pending' });
    assert.equal((await page(db, `/api/share-page?id=${pending.shareId}`)).status, 404);
  } finally {
    await db.close();
  }
});

test('hidden profiles show the short wallet', async () => {
  const db = createPgliteClient();
  try {
    const { shareId } = await seedRun(db, { profile: { displayName: 'Hidden Pilot', avatarUri: 'lestersarcade:avatar/lilly', hidden: true } });
    const { html } = await page(db, `/api/share-page?id=${shareId}`);
    assert.doesNotMatch(html, /Hidden Pilot/);
    assert.match(html, /0x7d7d…7d7d/);
    assert.match(html, /<p class="who"><img src="\/assets\/lester-pilot\.svg" alt="" width="44" height="44">0x7d7d…7d7d<\/p>/, 'default avatar');
    assert.equal(meta(html, 'og:title'), '0x7d7d…7d7d scored 48,210 in Hard Money Heroes');
    const named = renderSharePage({ session: { ...(await readPublicSession(db, `0x${shareId}`)), displayName: 'Shown', avatarUri: 'lestersarcade:avatar/lilly' }, status: 200, avatarSrc: (uri) => (uri === 'lestersarcade:avatar/lilly' ? '/assets/lilly.png' : null) });
    assert.match(named.html, /<img src="\/assets\/lilly\.png"/, 'a visible profile can use its avatar');
  } finally {
    await db.close();
  }
});

test('all interpolations are escaped', async () => {
  const hostile = `"><script>alert(1)</script><img src=x onerror=alert('x')>&\``;
  const shareId = 'ab'.repeat(32);
  const session = {
    sessionId32: `0x${shareId}`, shareId, gameId: 'chikun', gameTitle: hostile, wallet: WALLET, walletShort: hostile, displayName: hostile, avatarUri: null,
    score: 10, stats: { regionReached: hostile, forksPassed: 1, nearMisses: 2, coinsCollected: 3, bestCombo: 4, laps: 0 }, contract: {},
    status: 'confirmed', txHash: `0x${'aa'.repeat(32)}`, blockNumber: 1, explorerUrl: `javascript:alert(1)`, verifiedAt: null, confirmedAt: null,
    seasonId: 's', runtimeId: 'r', achievements: [{ id: hostile, tier: hostile, nft: false, unlockedAt: 't', tokenId: null }],
    standing: { weekly: 1, monthly: null, allTime: null }, verification: hostile, cardRev: hostile,
  };
  const { html } = renderSharePage({ session, status: 200, avatarSrc: () => hostile });
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /<img src=x/);
  assert.doesNotMatch(html, /onerror=alert\('x'\)>/);
  assert.doesNotMatch(html, /javascript:/, 'only explorer transaction URLs are linked');
  assert.match(html, /&quot;&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /og:image" content="https:\/\/lestersarcade\.io\/api\/share-card\/a{0}(?:ab){32}\.png">/, 'an invalid cardRev is dropped, never interpolated');
  assert.equal(escapeHtml(`<a href="x" title='y'>&\``), '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&#96;');
  // A malicious display name reaching the real handler is escaped too.
  const db = createPgliteClient();
  try {
    const row = await seedVerifiedSession(db, { gameId: 'stacked', wallet: WALLET, stats: { lines: 1 } });
    await seedWalletProfile(db, { wallet: WALLET, displayName: '<b>x</b>"' });
    const response = await page(db, `/api/share-page?id=${row.sessionId32.slice(2)}`);
    assert.doesNotMatch(response.html, /<b>x<\/b>/);
    assert.match(response.html, /&lt;b&gt;x&lt;\/b&gt;&quot;/);
  } finally {
    await db.close();
  }
});

test('unknown ids render a 404 with generic tags', async () => {
  const db = createPgliteClient();
  try {
    const response = await page(db, `/api/share-page?id=${'0f'.repeat(32)}`);
    assert.equal(response.status, 404);
    assert.equal(response.headers['content-type'], 'text/html; charset=utf-8');
    assert.equal(meta(response.html, 'og:image'), 'https://lestersarcade.io/assets/brand/lesters-arcade-logo-horizontal.png');
    assert.equal(meta(response.html, 'twitter:site'), '@LestersArcade');
    assert.equal(meta(response.html, 'og:url'), 'https://lestersarcade.io/');
    assert.match(response.html, /<meta name="robots" content="noindex">/);
    assert.doesNotMatch(response.html, /Verified on LitVM/);
    // Only `id` is accepted; anything else is a 400 page.
    for (const url of [`/api/share-page?id=${'0f'.repeat(32)}&utm_source=x`, '/api/share-page?id=session-1', '/api/share-page']) {
      const bad = await page(db, url);
      assert.equal(bad.status, 400, url);
      assert.equal(meta(bad.html, 'twitter:site'), '@LestersArcade', url);
      assert.equal(bad.headers['cache-control'], 'no-store', url);
    }
    const post = await page(db, `/api/share-page?id=${'0f'.repeat(32)}`, 'POST');
    assert.equal(post.status, 405);
    assert.equal(post.headers.allow, 'GET, HEAD');
    const head = await page(db, `/api/share-page?id=${'0f'.repeat(32)}`, 'HEAD');
    assert.equal(head.status, 404);
    assert.equal(head.html, '');
    // Without Neon: a 503 page with generic tags.
    const res = fakeResponse();
    await sharePageApi.createHandler(() => sharePageApi.buildDeps(env, { db: null }))(fakeRequest({ url: `/api/share-page?id=${'0f'.repeat(32)}` }), res);
    assert.equal(res.statusCode, 503);
    assert.equal(meta(res.text, 'og:image'), 'https://lestersarcade.io/assets/brand/lesters-arcade-logo-horizontal.png');
    assert.equal(res.headers['cache-control'], 'no-store');
  } finally {
    await db.close();
  }
});
