import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { renderShareCardPng } from '../api/share-card.mjs';
import { buildShareCardElement } from '../server/share/render-card.mjs';
import { renderSharePage } from '../server/share/render-page.mjs';

// Free sharing (fable/free-share, plan docs/handoffs/free-share-20260926.md)
// reuses the Ranked page's tag set, document frame and stylesheet, so this
// suite pins that the Ranked /s/ page (E10) and card (E11) output stays
// byte-identical to what 9f20cda0 (1.8.4, before the Free share branch)
// produced for the same inputs. The digests were recorded by running these
// exact fixtures through the 9f20cda0 renderers. A deliberate Ranked change
// re-records them in the same commit and says so.

const SHARE_ID = 'ab'.repeat(32);
const CONFIRMED = Object.freeze({
  shareId: SHARE_ID,
  gameId: 'lester-blaster',
  status: 'confirmed',
  verification: 'replay',
  displayName: 'Page Pilot',
  walletShort: '0x7d7d…7d7d',
  avatarUri: null,
  score: 48210,
  standing: { weekly: 1, monthly: 1, allTime: 3 },
  stats: { score: 48210, kills: 312, survivalSeconds: 724, maxCombo: 42, level: 10, bossKills: 1 },
  versionLabel: null,
  cardRev: '0123456789ab',
  explorerUrl: `https://liteforge.explorer.caldera.xyz/tx/0x${'cd'.repeat(32)}`,
  achievements: [{ id: 'first-blood', tier: 'bronze' }],
});
const CASES = Object.freeze({
  confirmed: CONFIRMED,
  pending: { ...CONFIRMED, status: 'pending', explorerUrl: null, standing: null },
  failed: { ...CONFIRMED, status: 'failed', explorerUrl: null, standing: null },
  hidden: { ...CONFIRMED, displayName: null },
  chikun: { ...CONFIRMED, gameId: 'chikun', score: 19475, achievements: [], stats: { regionReached: 'coast', laps: 2, forksPassed: 100, nearMisses: 18, coinsCollected: 41, bestCombo: 9 }, jackpotChampion: { label: 'Weekly Jackpot Champion · Sep 14 – Sep 21' } },
  stacked: { ...CONFIRMED, gameId: 'stacked', score: 412900, achievements: [], stats: { lines: 186, level: 14, quadClears: 5, perfectClears: 1, maxCombo: 7, survivalSeconds: 1500 } },
});

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const pageDigest = ({ status, headers, html }) => sha256(JSON.stringify({ status, headers, html }));

// Recorded at 9f20cda0 (server/share/render-page.mjs and render-card.mjs as of 1.8.4).
// 1.9.3 (deliberate Ranked change): the default avatar of a profile without a
// public name moved from /assets/lester-pilot.svg to the Litecoin Chad
// default (SHARE_DEFAULT_AVATAR), so only `hidden` was re-recorded. With that
// one path swapped back, the 1.9.3 page still hashes to the 1.8.4 digest
// 308243c8... (checked when re-recording).
const PAGE_DIGESTS = Object.freeze({
  confirmed: '2625c8e64c329aacc91b8b581702282482b4d19ff8ded58f97d8255c80ee55a0',
  pending: 'dc8dcd128971172ce5bf570b880180d5d00adc895154f216239e05f788e9c272',
  failed: '842a37975f89eaf1b3ba6b54289df529a7b7a7702ea243e4796c75eb583e4d38',
  hidden: '5adc6f6e296250a65e205a218847c23f81897d3af2eb6a30a001c1f963ff6589',
  chikun: 'c1a7a538dc597101209282a328d1f728523bc206150b421b9e17115889b3b8c5',
  stacked: '0a67c9f09ad44f6c90306d8cf7aed79f4e7f126e3d2a16c86a6e64876ae917fd',
  generic400: 'efa43da3395f3a77a6f84cf1ff355f4174b4f15ef48dec98c7c5d4683b349e43',
  generic404: '20233804e2090dcaf42d89cefb78c493173dd6583bab033c07819abb480b4ebe',
  generic503: 'd830741b8fa19694d0151b9b640cdcdbc8c0cb9a1f3b4a3bd4a1bc83bf8346a6',
});
const CARD_TREE_DIGESTS = Object.freeze({
  confirmed: 'd6682d0854af4875aee539c0e788472030165b7c6569e6a14ac3091de1ae0cc3',
  pending: '9515a6c92cdc6aa337df834ead49ad2408d522e4d2f740bc9a09174fa385b998',
  failed: '9515a6c92cdc6aa337df834ead49ad2408d522e4d2f740bc9a09174fa385b998',
  hidden: '7552ce4f2e8cdef66f313ae52ada8c61002d0d5c4eeb60dee5ccb0cba0d2d95c',
  chikun: '74c7b7ae6a03f64d8d1ba8ca3d0dbb0367881830b17417e554982183287bfbb6',
  stacked: 'c7aa58b854fa5be61786c5d9eecd90947994e45b65f20fc0a4a8efc2920f066b',
});
// The PNG bytes also depend on @vercel/og (Satori + resvg), so this digest is
// pinned to the version it was recorded with and skipped on any other.
// 1.9.0: the confirmed case is a Hard Money Heroes card, and fable/hmh-banners
// (be0eac56) replaced its background, share-cards/lester-blaster.png, with the
// owner's new Ranked share cover. With the 1.8.6 background file the renderer
// still produces the 1.8.4 digest a4bce565... (checked on the 1.9.0 release
// candidate), so the renderer and the element tree (above) are unchanged and
// only the background bytes moved.
const CARD_PNG = Object.freeze({ og: '0.11.1', case: 'confirmed', digest: '37ae617f1df0a88a2c8e78757e11f75c5cd03eda790265f43bde7221322a6cac' });

export function rankedShareDigests() {
  const pages = {};
  const trees = {};
  for (const [name, session] of Object.entries(CASES)) {
    pages[name] = pageDigest(renderSharePage({ session, status: 200, avatarSrc: () => '/assets/lester-pilot.svg' }));
    trees[name] = sha256(JSON.stringify(buildShareCardElement({ session, background: 'data:image/png;base64,AAAA', badgeImages: { 'first-blood': 'data:image/png;base64,BBBB' } })));
  }
  for (const status of [400, 404, 503]) pages[`generic${status}`] = pageDigest(renderSharePage({ session: null, status }));
  return { pages, trees };
}

test('the Ranked /s/ page is byte-identical to 1.8.4 for every status and game', () => {
  const { pages } = rankedShareDigests();
  assert.deepEqual(pages, { ...PAGE_DIGESTS });
});

test('the Ranked card element tree is byte-identical to 1.8.4', () => {
  const { trees } = rankedShareDigests();
  assert.deepEqual(trees, { ...CARD_TREE_DIGESTS });
});

test('the Ranked card PNG renders as 1.8.4 did, on the 1.9.0 HMH Ranked cover (same @vercel/og)', async (t) => {
  const og = JSON.parse(await readFile(new URL('../node_modules/@vercel/og/package.json', import.meta.url), 'utf8'));
  if (og.version !== CARD_PNG.og) { t.skip(`@vercel/og ${og.version} (digest recorded with ${CARD_PNG.og})`); return; }
  assert.equal(sha256(await renderShareCardPng(CASES[CARD_PNG.case])), CARD_PNG.digest);
});
