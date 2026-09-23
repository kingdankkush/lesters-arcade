import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const vercelConfig = JSON.parse(readFileSync('vercel.json', 'utf8'));

function parseCsp(value) {
  return new Map(value.split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [name, ...tokens] = part.split(/\s+/);
      return [name, tokens];
    }));
}

function findSecurityHeader(key, source = null) {
  for (const route of vercelConfig.headers ?? []) {
    if (source && route.source !== source) continue;
    const header = route.headers?.find((entry) => entry.key.toLowerCase() === key.toLowerCase());
    if (header) return { route, header };
  }
  return null;
}

test('production Vercel config keeps portal framing closed except for same-origin playable children', () => {
  const portalSource = '/((?!(?:hmh-reboot|chikun|stacked)/).*)';
  const found = findSecurityHeader('Content-Security-Policy', portalSource);
  assert.ok(found, 'portal Content-Security-Policy header should be configured');

  const csp = parseCsp(found.header.value);
  assert.deepEqual(csp.get('default-src'), ["'self'"]);
  assert.deepEqual(csp.get('object-src'), ["'none'"]);
  assert.deepEqual(csp.get('base-uri'), ["'self'"]);
  assert.deepEqual(csp.get('frame-ancestors'), ["'none'"]);
  assert.equal(csp.has('upgrade-insecure-requests'), true);

  for (const childSource of ['/hmh-reboot/(.*)', '/chikun/(.*)', '/stacked/(.*)']) {
    const child = findSecurityHeader('Content-Security-Policy', childSource);
    assert.ok(child, `${childSource} Content-Security-Policy header should be configured`);
    const childCsp = parseCsp(child.header.value);
    assert.deepEqual(childCsp.get('frame-ancestors'), ["'self'"], 'only the same-origin portal may embed the child');
    assert.deepEqual(childCsp.get('default-src'), ["'self'"]);
    assert.deepEqual(childCsp.get('object-src'), ["'none'"]);
    assert.equal(childCsp.get('script-src').includes("'unsafe-inline'"), false);
    assert.equal(childCsp.get('style-src').includes("'unsafe-inline'"), false);
    if (childSource === '/stacked/(.*)') assert.equal(childCsp.get('script-src').includes("'unsafe-eval'"), false);
  }

  const scriptSrc = csp.get('script-src') ?? [];
  assert.equal(scriptSrc.includes("'self'"), true);
  assert.equal(scriptSrc.some((token) => /^https?:/i.test(token)), false, 'remote executable scripts remain blocked');

  const styleSrc = csp.get('style-src') ?? [];
  assert.equal(styleSrc.includes("'self'"), true);
  assert.equal(styleSrc.includes("'unsafe-inline'"), true, 'inline style/onload usage is intentionally documented for the current static shell');
  assert.equal(styleSrc.some((token) => /^https?:/i.test(token)), false, 'remote stylesheets remain blocked');

  const connectSrc = csp.get('connect-src') ?? [];
  assert.equal(connectSrc.includes("'self'"), true);
  assert.equal(connectSrc.includes('https://liteforge.rpc.caldera.xyz'), true);
  assert.equal(connectSrc.includes('wss://liteforge.rpc.caldera.xyz'), true);
});

// WalletConnect sign-in (signin-entry slice, contract §4.5). Hosts from Reown's
// CSP guide, https://docs.reown.com/advanced/security/content-security-policy
// (fetched 2026-09-23); AppKit itself is bundled, so script-src gains nothing.
test('portal CSP allows the Reown and WalletConnect hosts and keeps the games framable', () => {
  const portalSource = '/((?!(?:hmh-reboot|chikun|stacked)/).*)';
  const csp = parseCsp(findSecurityHeader('Content-Security-Policy', portalSource).header.value);
  const connectSrc = csp.get('connect-src');
  for (const host of [
    'https://rpc.walletconnect.com', 'https://rpc.walletconnect.org',
    'https://relay.walletconnect.com', 'https://relay.walletconnect.org',
    'wss://relay.walletconnect.com', 'wss://relay.walletconnect.org',
    'https://pulse.walletconnect.com', 'https://pulse.walletconnect.org',
    'https://api.web3modal.com', 'https://api.web3modal.org',
    'https://keys.walletconnect.com', 'https://keys.walletconnect.org',
    'https://notify.walletconnect.com', 'https://notify.walletconnect.org',
    'https://echo.walletconnect.com', 'https://echo.walletconnect.org',
    'https://push.walletconnect.com', 'https://push.walletconnect.org',
  ]) assert.ok(connectSrc.includes(host), `connect-src ${host}`);
  for (const host of ['https://walletconnect.org', 'https://walletconnect.com', 'https://secure.walletconnect.com', 'https://secure.walletconnect.org']) {
    assert.ok(csp.get('img-src').includes(host), `img-src ${host}`);
  }
  assert.ok(csp.get('font-src').includes('https://fonts.reown.com'));
  assert.equal(csp.get('img-src').includes('*'), false, 'no wildcard image source');

  // frame-src did not exist before: frames fell back to default-src 'self',
  // which is what lets /hmh-reboot/, /chikun/ and /stacked/ load. It must start
  // with 'self' or all three games break in production only.
  const frameSrc = csp.get('frame-src');
  assert.equal(frameSrc[0], "'self'");
  assert.deepEqual(frameSrc.slice(1).sort(), ['https://secure.walletconnect.com', 'https://secure.walletconnect.org', 'https://verify.walletconnect.com', 'https://verify.walletconnect.org']);

  // No remote script origin, ever: AppKit ships in dist/reown/.
  const scriptSrc = csp.get('script-src');
  assert.deepEqual(scriptSrc, ["'self'", "'unsafe-inline'"]);
  assert.equal(scriptSrc.some((token) => /^(https?|wss?):|\*/i.test(token)), false);

  // The children keep their own policies untouched.
  for (const childSource of ['/hmh-reboot/(.*)', '/chikun/(.*)', '/stacked/(.*)']) {
    const child = parseCsp(findSecurityHeader('Content-Security-Policy', childSource).header.value);
    assert.equal(child.has('frame-src'), false, `${childSource} is unchanged`);
    assert.equal((child.get('connect-src') ?? []).some((token) => /walletconnect|reown|web3modal/.test(token)), false);
  }
});

test('Vercel security headers include conservative browser hardening defaults', () => {
  assert.equal(findSecurityHeader('X-Content-Type-Options')?.header.value, 'nosniff');
  assert.equal(findSecurityHeader('Referrer-Policy')?.header.value, 'strict-origin-when-cross-origin');
  assert.equal(findSecurityHeader('Permissions-Policy')?.header.value.includes('geolocation=()'), true);
});
