import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { PORTAL_COPY, escapeHtml, portalCopyFor } from '../apps/portal/src/portal-content.mjs';

const portal = new URL('../apps/portal/', import.meta.url);
const sections = ['support', 'privacy', 'terms', 'accessibility', 'testnet'];
const read = name => {
  const path = new URL(name, portal);
  assert.ok(existsSync(path), `The shipped ${name} surface must exist`);
  return readFileSync(path, 'utf8');
};

test('the portal footer reaches every trust section on a shipped static page', () => {
  const footer = read('index.html').match(/<footer\b[\s\S]*?<\/footer>/)?.[0];
  assert.ok(footer, 'the existing footer must be retained');
  const page = read('trust.html');
  for (const section of sections) {
    assert.match(footer, new RegExp(`href=["'](?:\\./|/)?trust\\.html#${section}["']`));
    assert.equal([...page.matchAll(new RegExp(`id=["']${section}["']`, 'g'))].length, 1, `${section} resolves exactly once`);
  }
});

test('the trust page uses the owner-supplied public identity and support address', () => {
  const page = read('trust.html');
  assert.match(page, /Website operator:\s*<strong>KingDankKush<\/strong>/);
  assert.match(page, /href="mailto:kingdankkush420@gmail\.com"/);
  assert.doesNotMatch(page, /support@lestersarcade|\[OPERATOR\]|\[SUPPORT\]|response within|24\/7 support/i);
});

test('the trust copy discloses storage, analytics and public testnet risks without promising payouts', () => {
  const page = read('trust.html');
  for (const text of ['browser storage', 'Vercel Web Analytics', 'public blockchain', 'Do not send real assets', 'seed phrase', 'No accessibility-conformance certification']) {
    assert.ok(page.includes(text), `Required disclosure: ${text}`);
  }
  assert.doesNotMatch(page, /guaranteed (?:returns|rewards)|fully (?:WCAG|ADA) compliant/i);
});

// Contract A33: the Ranked status line and the storage disclosure are generated
// from SETTLEMENT_LIVE and HOSTED_PROFILE_SYNC by scripts/build-portal-pages.mjs.
test('the trust page Ranked status and storage disclosure follow the settlement flags', () => {
  const page = read('trust.html');
  const paragraph = text => '<p>' + escapeHtml(text).replace(/`([^`]+)`/g, '<code>$1</code>') + '</p>';
  const between = key => page.match(new RegExp(`<!-- copy:${key}:start -->([\\s\\S]*?)<!-- copy:${key}:end -->`))?.[1] ?? '';
  assert.ok(page.indexOf('id="privacy"') < page.indexOf('copy:ranked-storage:start') && page.indexOf('copy:ranked-storage:end') < page.indexOf('id="terms"'), 'storage disclosure sits in the privacy section');
  assert.ok(page.indexOf('id="testnet"') < page.indexOf('copy:ranked-status:start'), 'status line sits in the testnet notice');
  assert.equal(between('ranked-status').trim(), PORTAL_COPY.trustStatus.map(paragraph).join('\n      '));
  assert.equal(between('ranked-storage').trim(), PORTAL_COPY.trustStorage.map(paragraph).join('\n      '));

  const preview = portalCopyFor({ settlementLive: false, hostedProfileSync: false });
  assert.equal(preview.trustStatus.map(paragraph)[0].includes('<code>SETTLEMENT_LIVE=false</code>'), true);
  assert.match(preview.trustStorage.join(' '), /stay in this browser/);
  const launch = portalCopyFor({ settlementLive: true, hostedProfileSync: true });
  const status = launch.trustStatus.join(' ');
  const storage = launch.trustStorage.join(' ');
  assert.match(status, /^Ranked is live on the LitVM LiteForge testnet\. A Ranked run costs 0.102 zkLTC/);
  assert.match(status, /Hard Money Heroes runs are plausibility-checked against the game's limits and are not replayed/);
  assert.doesNotMatch(status, /SETTLEMENT_LIVE|preview|simulated/i);
  for (const text of ['Neon Postgres database', 'your wallet address', 'evidence', 'achievements', 'preferences', 'HMAC', 'not raw IP addresses']) {
    assert.ok(storage.includes(text), `Launch storage disclosure: ${text}`);
  }
});

test('trust information works without game JavaScript and has basic accessible navigation', () => {
  const page = read('trust.html');
  assert.match(page, /<html lang="en">/);
  assert.match(page, /name="viewport"/);
  assert.match(page, /href="#main"[^>]*>Skip to content/);
  assert.match(page, /<main id="main"/);
  assert.match(page, /href="\/"[^>]*>Back to the arcade/);
  assert.doesNotMatch(page, /<script\b|<form\b|on(?:click|submit)=/i);
  assert.ok(existsSync(new URL('trust.css', portal)));
});
