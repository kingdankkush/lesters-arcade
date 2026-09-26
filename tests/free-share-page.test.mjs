import assert from 'node:assert/strict';
import test from 'node:test';

import * as freePageApi from '../api/free-share-page.mjs';
import { FREE_CARD_CACHE, FREE_CARD_INVALID_CACHE } from '../api/free-card.mjs';
import { decodeFreeRun } from '../server/share/free-run.mjs';
import { renderFreeSharePage } from '../server/share/render-free-page.mjs';
import { escapeHtml } from '../server/share/render-page.mjs';
import { encodeFreeShareToken } from '../apps/portal/src/free-share-token.mjs';
import { fakeRequest, fakeResponse } from './helpers/fake-http.mjs';

// Free share page, E13 (plan docs/handoffs/free-share-20260926.md §7, §8):
// GET /f/<slug>/<token> → /api/free-share-page?game=&token=. Server-rendered
// OG and Twitter tags for X, Discord and Facebook; no JavaScript; no Neon;
// noindex (self-reported content); the card's cache policy.

const env = Object.freeze({ VERCEL_ENV: 'development', SESSION_SECRET: `free-page-fixture-${'e2'.repeat(16)}` });
const HMH = { hero: 'lit-valkyrie', score: 48210, kills: 312, maxCombo: 42, survivalSeconds: 724, level: 9, bossDefeated: true };
const CHIKUN = { region: 'coast', score: 19475, forksPassed: 100, nearMisses: 18, coinsCollected: 41, bestCombo: 9, survivalSeconds: 180, laps: 2, daily: true };
const STACKED = { assisted: true, score: 412900, lines: 186, level: 14, quadClears: 5, maxCombo: 7, survivalSeconds: 1500 };
const HMH_TOKEN = encodeFreeShareToken('lester-blaster', HMH);
const CHIKUN_TOKEN = encodeFreeShareToken('chikun', CHIKUN);
const STACKED_TOKEN = encodeFreeShareToken('stacked', STACKED);
const GENERIC_IMAGE = 'https://lestersarcade.io/assets/brand/lesters-arcade-logo-horizontal.png';

async function page(url, { method = 'GET', db = null, query } = {}) {
  const res = fakeResponse();
  const req = fakeRequest({ method, url });
  if (query) req.query = query;
  await freePageApi.createHandler(() => freePageApi.buildDeps(env, { db }))(req, res);
  return { status: res.statusCode, headers: res.headers, html: res.text ?? '' };
}

function meta(html, key) {
  const pattern = new RegExp(`<meta (?:property|name)="${key.replace(/[.:]/g, (c) => `\\${c}`)}" content="([^"]*)">`);
  return pattern.exec(html)?.[1] ?? null;
}

test('the Free page carries full OG and Twitter tags pointing at the Free card, and the card cache policy', async () => {
  const response = await page(`/api/free-share-page?game=hard-money-heroes&token=${HMH_TOKEN}`);
  assert.equal(response.status, 200);
  assert.equal(response.headers['content-type'], 'text/html; charset=utf-8');
  assert.equal(response.headers['cache-control'], FREE_CARD_CACHE);
  assert.equal(freePageApi.FREE_PAGE_CACHE, FREE_CARD_CACHE);
  assert.equal(response.headers['x-robots-tag'], 'noindex');
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  const { html } = response;
  assert.match(html, /^<!doctype html>/);
  const pageUrl = `https://lestersarcade.io/f/hard-money-heroes/${HMH_TOKEN}`;
  const cardUrl = `https://lestersarcade.io/api/free-card/hard-money-heroes/${HMH_TOKEN}.png`;
  assert.match(html, /<title>48,210 pts in Hard Money Heroes · Free Play<\/title>/);
  assert.equal(meta(html, 'og:type'), 'website');
  assert.equal(meta(html, 'og:site_name'), 'Lester&#39;s Arcade');
  assert.equal(meta(html, 'og:title'), '48,210 pts in Hard Money Heroes · Free Play');
  assert.equal(meta(html, 'og:description'), 'Free Play · self-reported · Lit Valkyrie · Level 9 · Liquidator liquidated · 312 kills · 12:04 survived · ×42 combo. Can you beat it? Play free or Ranked at Lester&#39;s Arcade.');
  assert.equal(meta(html, 'og:url'), pageUrl);
  assert.equal(meta(html, 'og:image'), cardUrl);
  assert.equal(meta(html, 'og:image:width'), '1200');
  assert.equal(meta(html, 'og:image:height'), '630');
  assert.equal(meta(html, 'og:image:alt'), 'Hard Money Heroes Free Play score card: 48,210 points (self-reported)');
  assert.equal(meta(html, 'twitter:card'), 'summary_large_image');
  assert.equal(meta(html, 'twitter:site'), '@LestersArcade');
  assert.equal(meta(html, 'twitter:title'), meta(html, 'og:title'));
  assert.equal(meta(html, 'twitter:description'), meta(html, 'og:description'));
  assert.equal(meta(html, 'twitter:image'), cardUrl);
  assert.match(html, new RegExp(`<link rel="canonical" href="${pageUrl}">`));
  assert.match(html, /<meta name="robots" content="noindex">/);
  // Body: the card inline, the honest label, stats, Play buttons; no JS.
  assert.match(html, new RegExp(`<img class="shot" src="/api/free-card/hard-money-heroes/${HMH_TOKEN}\\.png" width="1200" height="630"`));
  assert.match(html, /<p class="eyebrow free">Free Play · Hard Money Heroes<\/p>/);
  assert.match(html, /<h1 id="run-title">48,210 <small>PTS<\/small><\/h1>/);
  assert.match(html, /<p class="status free">Free Play · self-reported<\/p>/);
  assert.match(html, /reported by the player&#39;s browser and is not verified/);
  assert.match(html, /<dt>Hero<\/dt><dd>Lit Valkyrie<\/dd>/);
  assert.match(html, /<dt>Level<\/dt><dd>9<\/dd>/);
  assert.match(html, /<dt>Kills<\/dt><dd>312<\/dd>/);
  assert.match(html, /<dt>Time<\/dt><dd>12:04<\/dd>/);
  assert.match(html, /<dt>Best combo<\/dt><dd>×42<\/dd>/);
  assert.match(html, /<dt>Boss<\/dt><dd>Defeated<\/dd>/);
  assert.match(html, /<a class="button primary" href="\/play\/hard-money-heroes">Play Hard Money Heroes<\/a>/);
  assert.match(html, /<a class="button" href="\/">All arcade games<\/a>/);
  assert.doesNotMatch(html, /<script/i, 'the page has no JS');
  assert.doesNotMatch(html, /Verified on LitVM|Publishing to LitVM|status verified|status pending/);
  assert.doesNotMatch(html, /0x[0-9a-f]{40}|session-/i, 'nothing personal');
  assert.doesNotMatch(html, /Practising/);
});

test('every game renders its own stats and route slug', async () => {
  const chikun = await page(`/api/free-share-page?game=chikun&token=${CHIKUN_TOKEN}`);
  assert.equal(chikun.status, 200);
  assert.equal(meta(chikun.html, 'og:title'), '19,475 pts in Chikun&#39;s Escape · Free Play');
  assert.equal(meta(chikun.html, 'og:description'), 'Free Play · self-reported · Lap 3 · Coast · Daily course · 100 forks · 18 near-misses · 41 coins. Can you beat it? Play free or Ranked at Lester&#39;s Arcade.');
  assert.equal(meta(chikun.html, 'og:image'), `https://lestersarcade.io/api/free-card/chikun/${CHIKUN_TOKEN}.png`);
  for (const row of ['<dt>Region</dt><dd>Coast</dd>', '<dt>Laps</dt><dd>2</dd>', '<dt>Forks</dt><dd>100</dd>', '<dt>Near-misses</dt><dd>18</dd>', '<dt>Coins</dt><dd>41</dd>', '<dt>Best combo</dt><dd>×9</dd>', '<dt>Time</dt><dd>3:00</dd>', '<dt>Course</dt><dd>Daily</dd>']) {
    assert.ok(chikun.html.includes(row), row);
  }
  assert.match(chikun.html, /href="\/play\/chikun">Play Chikun&#39;s Escape</);
  const plain = await page(`/api/free-share-page?game=chikun&token=${encodeFreeShareToken('chikun', { ...CHIKUN, daily: false })}`);
  assert.doesNotMatch(plain.html, /<dt>Course<\/dt>|Daily course/);

  const stacked = await page(`/api/free-share-page?game=stacked&token=${STACKED_TOKEN}`);
  assert.equal(stacked.status, 200);
  assert.equal(meta(stacked.html, 'og:title'), '412,900 pts in STACKED · Free Play');
  assert.equal(meta(stacked.html, 'og:description'), 'Free Play · self-reported · 25:00 played · ×7 best combo · Assisted · 186 lines · level 14 · 5 Halvings. Can you beat it? Play free or Ranked at Lester&#39;s Arcade.');
  for (const row of ['<dt>Lines</dt><dd>186</dd>', '<dt>Level</dt><dd>14</dd>', '<dt>Halvings</dt><dd>5</dd>', '<dt>Best combo</dt><dd>×7</dd>', '<dt>Time</dt><dd>25:00</dd>', '<dt>Assisted</dt><dd>Yes</dd>']) {
    assert.ok(stacked.html.includes(row), row);
  }
  assert.match(stacked.html, /href="\/play\/stacked">Play STACKED</);
  const solo = await page(`/api/free-share-page?game=stacked&token=${encodeFreeShareToken('stacked', { ...STACKED, assisted: false })}`);
  assert.doesNotMatch(solo.html, /<dt>Assisted<\/dt>|· Assisted/);
  // HMH without a hero or a boss kill.
  const survivor = await page(`/api/free-share-page?game=hard-money-heroes&token=${encodeFreeShareToken('lester-blaster', { ...HMH, hero: '', bossDefeated: false })}`);
  assert.match(survivor.html, /<dt>Hero<\/dt><dd>Survivor<\/dd>/);
  assert.match(survivor.html, /<dt>Boss<\/dt><dd>Not defeated<\/dd>/);
  assert.doesNotMatch(survivor.html, /Liquidator liquidated/);
});

test('extra query keys on a valid pair redirect to the canonical /f/ URL; on a bad pair they are a 400 page', async () => {
  for (const url of [
    `/api/free-share-page?game=chikun&token=${CHIKUN_TOKEN}&fbclid=IwAR0abc`,
    `/api/free-share-page?game=chikun&token=${CHIKUN_TOKEN}&utm_source=x&utm_medium=social`,
    `/api/free-share-page?fbclid=1&game=chikun&token=${CHIKUN_TOKEN}`,
    `/api/free-share-page?game=chikun&token=${CHIKUN_TOKEN}&token=${CHIKUN_TOKEN}&v=1`,
  ]) {
    for (const method of ['GET', 'HEAD']) {
      const response = await page(url, { method });
      assert.equal(response.status, 302, `${method} ${url}`);
      assert.equal(response.headers.location, `/f/chikun/${CHIKUN_TOKEN}`, `${method} ${url}`);
      assert.equal(response.headers['cache-control'], 'public, s-maxage=3600', url);
      assert.equal(response.html, '', 'no body');
    }
  }
  assert.equal(freePageApi.FREE_PAGE_REDIRECT_CACHE, 'public, s-maxage=3600');
  // Vercel passes the merged query as req.query too.
  const merged = await page(`/f/chikun/${CHIKUN_TOKEN}?fbclid=x`, { query: { game: 'chikun', token: CHIKUN_TOKEN, fbclid: 'x' } });
  assert.deepEqual([merged.status, merged.headers.location], [302, `/f/chikun/${CHIKUN_TOKEN}`]);
  // A conflicting pair, or a bad token, with an extra key: the 400 page, never a redirect.
  for (const url of [
    `/api/free-share-page?game=chikun&token=${STACKED_TOKEN}&fbclid=abc`,
    `/api/free-share-page?game=pinball&token=${CHIKUN_TOKEN}&fbclid=abc`,
    `/api/free-share-page?game=chikun&token=${CHIKUN_TOKEN}&token=${STACKED_TOKEN}&fbclid=abc`,
    `/api/free-share-page?game=chikun&game=stacked&token=${CHIKUN_TOKEN}&fbclid=abc`,
    '/api/free-share-page?fbclid=abc',
  ]) {
    const response = await page(url);
    assert.equal(response.status, 400, url);
    assert.equal(response.headers.location, undefined, url);
    assert.equal(meta(response.html, 'twitter:site'), '@LestersArcade', url);
  }
});

test('a missing or invalid pair is a cacheable 400 page with generic tags; other methods and failures are not cached', async () => {
  for (const url of [
    '/api/free-share-page',
    `/api/free-share-page?token=${CHIKUN_TOKEN}`,
    '/api/free-share-page?game=chikun',
    `/api/free-share-page?game=pinball&token=${CHIKUN_TOKEN}`,
    `/api/free-share-page?game=lester-blaster&token=${HMH_TOKEN}`,
    `/api/free-share-page?game=chikun&token=${CHIKUN_TOKEN.slice(0, -1)}`,
    `/api/free-share-page?game=chikun&token=${CHIKUN_TOKEN.toUpperCase()}`,
    `/api/free-share-page?game=chikun&token=${STACKED_TOKEN}`,
    `/api/free-share-page?game=chikun&token=b${CHIKUN_TOKEN.slice(1)}`,
  ]) {
    const response = await page(url);
    assert.equal(response.status, 400, url);
    assert.equal(response.headers['cache-control'], FREE_CARD_INVALID_CACHE, url);
    assert.equal(freePageApi.FREE_PAGE_INVALID_CACHE, FREE_CARD_INVALID_CACHE);
    assert.equal(response.headers['x-robots-tag'], 'noindex', url);
    assert.equal(meta(response.html, 'og:image'), GENERIC_IMAGE, url);
    assert.equal(meta(response.html, 'twitter:site'), '@LestersArcade', url);
    assert.equal(meta(response.html, 'og:url'), 'https://lestersarcade.io/', url);
    assert.match(response.html, /<meta name="robots" content="noindex">/, url);
    assert.match(response.html, /That is not a run link/, url);
    assert.match(response.html, /Free share links look like lestersarcade\.io\/f\/&lt;game&gt;\/&lt;code&gt;\./, url);
    assert.doesNotMatch(response.html, /Verified on LitVM/, url);
    assert.doesNotMatch(response.html, new RegExp(CHIKUN_TOKEN), `${url}: the token is not echoed`);
  }
  const post = await page(`/api/free-share-page?game=chikun&token=${CHIKUN_TOKEN}`, { method: 'POST' });
  assert.equal(post.status, 405);
  assert.equal(post.headers.allow, 'GET, HEAD');
  assert.equal(post.headers['cache-control'], 'no-store');
  const head = await page(`/api/free-share-page?game=chikun&token=${CHIKUN_TOKEN}`, { method: 'HEAD' });
  assert.deepEqual([head.status, head.html, head.headers['cache-control']], [200, '', FREE_CARD_CACHE]);
  // A throwing deps factory: a 500 page, one redacted log line, no-store.
  const logged = [];
  const original = console.error;
  console.error = (...args) => { logged.push(args); };
  try {
    const failure = Object.assign(new Error('connect postgres://arcade:hunter2-secret@db.example/neon failed'), { name: 'NeonDbError', code: '57P01' });
    const res = fakeResponse();
    await freePageApi.createHandler(async () => { throw failure; })(fakeRequest({ url: `/api/free-share-page?game=chikun&token=${CHIKUN_TOKEN}` }), res);
    assert.equal(res.statusCode, 500);
    assert.equal(res.headers['cache-control'], 'no-store');
    assert.equal(meta(res.text, 'og:image'), GENERIC_IMAGE);
    assert.doesNotMatch(res.text, /hunter2|postgres:\/\/|NeonDbError/);
    assert.deepEqual(logged, [['[free-share-page] internal-error', { name: 'NeonDbError', code: '57P01', sqlstate: '57P01' }]]);
  } finally {
    console.error = original;
  }
  // The pure request function and the seam.
  assert.deepEqual([...freePageApi.FREE_PAGE_QUERY], ['game', 'token']);
  const pure = await freePageApi.freeSharePageRequest({ method: 'GET', query: { game: 'stacked', token: STACKED_TOKEN } }, { db: null });
  assert.equal(pure.status, 200);
  assert.match(pure.body, /^<!doctype html>/);
  const bare = await page(`/api/free-share-page?game=stacked&token=${STACKED_TOKEN}`, { db: undefined });
  assert.equal(bare.status, 200, 'works with no database');
});

test('all interpolations are escaped even though every value is a number or a table label', () => {
  const hostile = `"><script>alert(1)</script><img src=x onerror=alert('x')>&\``;
  const decoded = decodeFreeRun('stacked', STACKED_TOKEN);
  const run = { ...decoded.run, token: hostile, slug: hostile, title: hostile, values: { ...decoded.run.values, level: hostile, lines: hostile } };
  const { html, status } = renderFreeSharePage({ run, status: 200 });
  assert.equal(status, 200);
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /<img src=x/);
  assert.doesNotMatch(html, /onerror=alert\('x'\)>/);
  assert.match(html, /&quot;&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.equal(escapeHtml('<a href="x">&`'), '&lt;a href=&quot;x&quot;&gt;&amp;&#96;');
  // The generic pages take no input at all.
  for (const code of [400, 405, 500]) {
    const generic = renderFreeSharePage({ run: null, status: code });
    assert.match(generic.html, /<meta name="twitter:site" content="@LestersArcade">/);
    assert.doesNotMatch(generic.html, /<script/i);
  }
});
