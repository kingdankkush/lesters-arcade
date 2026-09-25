// scripts/live-ui-audit.mjs: the read-only guarantee and the pure checks it
// applies to production pages (live UI audit 2026-09-24). The browser part
// runs only by hand against the live site (docs/qa/live-ui-audit-20260924.json).
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import {
  AUDIT_GAMES,
  AUDIT_SHARE_IDS,
  AUDIT_WALLET,
  DEFAULT_SITE,
  VIEWPORTS,
  contrastRatio,
  forbiddenWording,
  isBlockedRequest,
  parseArgs,
  parseCssColor,
  summarizeChecks,
} from '../scripts/live-ui-audit.mjs';

test('the audit never writes to the site: only GET and HEAD reach it', () => {
  for (const method of ['GET', 'HEAD', 'get']) {
    assert.equal(isBlockedRequest({ method, url: `${DEFAULT_SITE}/api/leaderboard?game=chikun&period=weekly` }), false);
  }
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
    assert.equal(isBlockedRequest({ method, url: `${DEFAULT_SITE}/api/settle` }), true, `${method} to the site`);
    assert.equal(isBlockedRequest({ method, url: `${DEFAULT_SITE}/api/profile/refresh?wallet=${AUDIT_WALLET}` }), true);
    assert.equal(isBlockedRequest({ method, url: 'https://preview.example.test/api/session' }), true, 'any /api/ write, whatever the host');
  }
  // Public JSON-RPC reads to LiteForge are POSTs; there is no wallet, so none can carry a signed transaction.
  assert.equal(isBlockedRequest({ method: 'POST', url: 'https://liteforge.rpc.caldera.xyz/http' }), false);
  assert.equal(isBlockedRequest({ method: 'POST', url: 'http://127.0.0.1:8862/api/settle', site: 'http://127.0.0.1:8862' }), true);
  assert.equal(isBlockedRequest({ method: 'POST', url: 'not a url' }), true, 'an unparsable request is blocked');
  const source = readFileSync(new URL('../scripts/live-ui-audit.mjs', import.meta.url), 'utf8');
  assert.match(source, /if \(isBlockedRequest\(\{ method: request\.method\(\), url: request\.url\(\), site \}\)\) \{\s*blocked\.push/);
  assert.doesNotMatch(source, /eth_sendTransaction|personal_sign|eth_requestAccounts|process\.env\.\w*(KEY|SECRET)/);
});

test('launch wording rules catch NFT, hashtag, device-local and old tab remnants', () => {
  assert.deepEqual(forbiddenWording('24 achievements recorded. Rank 3 this week · #3 all-time'), []);
  assert.deepEqual(forbiddenWording('Mint a soulbound NFT'), ['nft']);
  assert.deepEqual(forbiddenWording('Share with #LestersArcade'), ['hashtag']);
  assert.deepEqual(forbiddenWording('Scoreboards are device-local previews'), ['device-local']);
  assert.deepEqual(forbiddenWording('PERIOD\nDAILY\nWEEKLY'), ['daily-yearly-tab']);
  assert.deepEqual(forbiddenWording('Daily UTC challenge'), [], 'the Free Mode seed schedule is not a board tab');
  assert.deepEqual(forbiddenWording('House Demo scores'), ['house-or-local-preview']);
  assert.deepEqual(forbiddenWording('Show Local Preview'), ['house-or-local-preview']);
  assert.deepEqual(forbiddenWording('SHOW LOCAL PREVIEW'), ['house-or-local-preview'], 'uppercased tab labels too');
});

test('contrast math matches WCAG and the grey buttons found live', () => {
  assert.equal(Math.round(contrastRatio([0, 0, 0], [255, 255, 255]) * 100) / 100, 21);
  assert.equal(Math.round(contrastRatio([8, 6, 22], [107, 107, 107]) * 100) / 100, 3.76, 'Share profile before the fix');
  assert.ok(contrastRatio([232, 251, 255], [7, 17, 42]) > 7, 'the arcade button after the fix');
  assert.deepEqual(parseCssColor('rgb(8, 6, 22)'), { rgb: [8, 6, 22], alpha: 1 });
  assert.deepEqual(parseCssColor('rgba(4, 11, 26, 0.8)'), { rgb: [4, 11, 26], alpha: 0.8 });
  assert.equal(parseCssColor('transparent'), null);
});

test('arguments, targets and the summary', () => {
  assert.deepEqual(parseArgs([]), { site: DEFAULT_SITE, out: null, viewports: ['desktop', 'phone'] });
  assert.deepEqual(parseArgs(['--site', 'https://lestersarcade.io/', '--out', 'x', '--viewports', 'narrow,bogus,desktop']), { site: 'https://lestersarcade.io', out: 'x', viewports: ['narrow', 'desktop'] });
  assert.throws(() => parseArgs(['--broadcast']), /Unknown argument/);
  assert.throws(() => parseArgs(['--site', 'lestersarcade.io']), /http\(s\) origin/);
  assert.deepEqual(Object.keys(VIEWPORTS), ['desktop', 'phone', 'narrow']);
  assert.deepEqual([VIEWPORTS.desktop.viewport.width, VIEWPORTS.phone.viewport.width, VIEWPORTS.narrow.viewport.width], [1440, 390, 320]);
  assert.deepEqual(AUDIT_GAMES.map((game) => game.slug), ['hard-money-heroes', 'chikun', 'stacked']);
  assert.ok(AUDIT_SHARE_IDS.every((id) => /^[0-9a-f]{64}$/.test(id)));
  assert.match(AUDIT_WALLET, /^0x[0-9a-f]{40}$/);
  assert.deepEqual(summarizeChecks([
    { viewport: 'desktop', id: 'a', ok: true },
    { viewport: 'phone', id: 'b', ok: false },
    { viewport: 'phone', id: 'c', ok: null },
  ]), { total: 3, passed: 1, failed: 1, notRun: 1, failedIds: ['phone:b'] });
});
