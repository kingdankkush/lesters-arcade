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

function findSecurityHeader(key) {
  for (const route of vercelConfig.headers ?? []) {
    const header = route.headers?.find((entry) => entry.key.toLowerCase() === key.toLowerCase());
    if (header) return { route, header };
  }
  return null;
}

test('production Vercel config ships a reviewed Content-Security-Policy', () => {
  const found = findSecurityHeader('Content-Security-Policy');
  assert.ok(found, 'Content-Security-Policy header should be configured');
  assert.equal(found.route.source, '/(.*)');

  const csp = parseCsp(found.header.value);
  assert.deepEqual(csp.get('default-src'), ["'self'"]);
  assert.deepEqual(csp.get('object-src'), ["'none'"]);
  assert.deepEqual(csp.get('base-uri'), ["'self'"]);
  assert.deepEqual(csp.get('frame-ancestors'), ["'none'"]);
  assert.equal(csp.has('upgrade-insecure-requests'), true);

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

test('Vercel security headers include conservative browser hardening defaults', () => {
  assert.equal(findSecurityHeader('X-Content-Type-Options')?.header.value, 'nosniff');
  assert.equal(findSecurityHeader('Referrer-Policy')?.header.value, 'strict-origin-when-cross-origin');
  assert.equal(findSecurityHeader('Permissions-Policy')?.header.value.includes('geolocation=()'), true);
});
