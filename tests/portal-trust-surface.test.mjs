import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

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
  for (const text of ['browser storage', 'Vercel Web Analytics', 'public blockchain', 'SETTLEMENT_LIVE=false', 'Do not send real assets', 'seed phrase', 'No accessibility-conformance certification']) {
    assert.ok(page.includes(text), `Required disclosure: ${text}`);
  }
  assert.doesNotMatch(page, /guaranteed (?:returns|rewards)|fully (?:WCAG|ADA) compliant/i);
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
