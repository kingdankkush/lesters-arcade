import assert from 'node:assert/strict';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Readable } from 'node:stream';
import test from 'node:test';
import { inspect } from 'node:util';
import { ethers } from 'ethers';

import { issueSessionToken } from '../apps/portal/src/server-session.mjs';
import { createNeonClient, neonSchemaKeyFor } from '../apps/portal/src/server-neon.mjs';
import { bearerToken, clientIp, foldIp, ipBucket, makeHandler, queryOf, readJsonBody, sendJson, verifyBearer } from '../server/http.mjs';
import { buildBaseDeps, DEFAULT_MIN_PAID_WEI, readServerConfig } from '../server/config.mjs';
import { loadDeployment, UNAVAILABLE_DEPLOYMENT } from '../server/deployment.mjs';
import * as httpModule from '../server/http.mjs';
import * as deploymentModule from '../server/deployment.mjs';

/**
 * Contract §4.1, §9.2, A24, A28 and A30: the shared HTTP helpers, the
 * redacting server config and the deployment loader every endpoint builds on.
 */

const SESSION_VALUE = `session-fixture-${'a1'.repeat(16)}`;
const CRON_VALUE = `cron-fixture-${'c3'.repeat(16)}`;
const NEON_PASSWORD = `npg_${'Zq7'.repeat(8)}`;
const NEON_URL = `postgresql://owner:${NEON_PASSWORD}@ep-quiet-lake-123.us-east-2.aws.neon.tech/neondb?sslmode=require`;
const RPC_WITH_KEY = `https://liteforge.rpc.example/v1/${'rk9'.repeat(10)}`;
const VERIFIER_KEY = `0x${'2b'.repeat(32)}`;
const RELAYER_KEY = `0x${'3c'.repeat(32)}`;
const DEPLOYED = Object.freeze({
  status: 'deployed', chainId: 4441, startBlock: 10,
  addresses: Object.freeze({
    gameRegistry: '0xcb0b695ebee650afcce93f566259cb477b19bf23', playerProfileRegistry: '0x3eb9e9f2620940496a2b8ed6f7384e6687587c94',
    arcadeRankedEntry: '0x10cd09e694e2b2cd70d37f8cdddcda3ef1208190', scoreSubmissionRegistry: '0xc5c5949a02fac9a4115df182672c0f8ceb0eaf55',
    achievementRegistries: Object.freeze({ 'lester-blaster': '0xc1a383cb7521978f429424443fdd69bdd71ff737', chikun: '0xf6cd1cf7e1accaea93accdfb911034b3e8eb6f93', stacked: '0x5430f8c142ca7ec8971a447cc09ae63f8860a8a7' }),
  }),
});

function fullEnv(extra = {}) {
  return {
    VERCEL_ENV: 'development',
    SESSION_SECRET: SESSION_VALUE,
    NEON_DATABASE_URL: NEON_URL,
    RANKED_VERIFIER_PRIVATE_KEY: VERIFIER_KEY,
    RANKED_RELAYER_PRIVATE_KEY: RELAYER_KEY,
    RANKED_SCORE_REGISTRY_ADDRESS: '0xC5c5949a02fAC9a4115df182672C0f8cEB0Eaf55',
    CRON_SECRET: CRON_VALUE,
    RPC_URL: RPC_WITH_KEY,
    ...extra,
  };
}

function fakeRes() {
  const headers = {};
  return {
    statusCode: 0, body: null, headers,
    setHeader(key, value) { headers[key.toLowerCase()] = String(value); },
    end(text) { this.body = text === undefined ? null : JSON.parse(text); },
  };
}

test('config never exposes secrets to inspect, String or JSON', () => {
  const config = readServerConfig(fullEnv(), { deployment: DEPLOYED });
  const outputs = [
    inspect(config, { depth: 10, showHidden: true }),
    inspect({ nested: { config } }, { depth: 10, showHidden: true }),
    String(config),
    `${config}`,
    JSON.stringify(config),
    JSON.stringify({ config }),
  ];
  const secrets = [SESSION_VALUE, CRON_VALUE, NEON_PASSWORD, NEON_URL, RPC_WITH_KEY, 'rk9rk9rk9', VERIFIER_KEY, VERIFIER_KEY.slice(2), RELAYER_KEY, RELAYER_KEY.slice(2)];
  for (const output of outputs) {
    for (const secret of secrets) assert.equal(output.includes(secret), false, `a secret leaked into ${output.slice(0, 80)}`);
  }
  for (const value of Object.values(config)) {
    if (typeof value === 'string') for (const secret of secrets.filter((item) => item !== RPC_WITH_KEY && item !== 'rk9rk9rk9')) assert.equal(value.includes(secret), false);
  }
  assert.equal(config.settlementReady, true, JSON.stringify(config.missing));
  assert.deepEqual([...config.missing], []);
  // Secrets are reachable only through the closures.
  assert.equal(config.session.secret(), SESSION_VALUE);
  assert.equal(config.verifier.createSigner(ethers).address, new ethers.Wallet(VERIFIER_KEY).address);
  assert.equal(config.relayer.createWallet(ethers, null).address, new ethers.Wallet(RELAYER_KEY).address);
  assert.equal(config.cron.matches(`Bearer ${CRON_VALUE}`), true);
  assert.equal(config.cron.matches(`Bearer ${CRON_VALUE}x`), false);
  assert.equal(config.cron.matches(CRON_VALUE), false);
  assert.equal(config.cron.matches(undefined), false);
  assert.equal(config.neon.schemaKey, 'neon:ep-quiet-lake-123.us-east-2.aws.neon.tech/neondb');
  assert.equal(config.neon.createClient({ fetchImpl: async () => ({}) }).schemaKey, config.neon.schemaKey);
  assert.equal(config.scoreRegistry.address, DEPLOYED.addresses.scoreSubmissionRegistry);
  assert.equal(config.scoreRegistry.matchesDeployment, true);
  assert.equal(Object.isFrozen(config), true);
});

test('legacy env names fail closed', () => {
  for (const name of ['VERIFIER_PRIVATE_KEY', 'RELAYER_PRIVATE_KEY', 'SCORE_REGISTRY_ADDRESS']) {
    const config = readServerConfig(fullEnv({ [name]: '' }), { deployment: DEPLOYED });
    assert.equal(config.settlementReady, false, name);
    assert.ok(config.missing.includes(`legacy-env-present:${name}`), name);
    assert.deepEqual([...config.legacyEnvPresent], [name]);
  }
  // Only the legacy names: nothing is configured and settlement stays off.
  const legacyOnly = readServerConfig({ VERIFIER_PRIVATE_KEY: VERIFIER_KEY, RELAYER_PRIVATE_KEY: RELAYER_KEY, SCORE_REGISTRY_ADDRESS: DEPLOYED.addresses.scoreSubmissionRegistry }, { deployment: DEPLOYED });
  assert.equal(legacyOnly.settlementReady, false);
  assert.equal(legacyOnly.verifier.configured, false);
  assert.equal(legacyOnly.relayer.configured, false);
  assert.equal(legacyOnly.scoreRegistry.configured, false);
  for (const name of ['VERIFIER_PRIVATE_KEY', 'RELAYER_PRIVATE_KEY', 'SCORE_REGISTRY_ADDRESS']) assert.ok(legacyOnly.missing.includes(`legacy-env-present:${name}`));
  assert.equal(inspect(legacyOnly, { depth: 10, showHidden: true }).includes(VERIFIER_KEY.slice(2)), false);

  const mismatch = readServerConfig(fullEnv({ RANKED_SCORE_REGISTRY_ADDRESS: `0x${'99'.repeat(20)}` }), { deployment: DEPLOYED });
  assert.equal(mismatch.settlementReady, false);
  assert.ok(mismatch.missing.includes('address-mismatch'));
  const predicted = readServerConfig(fullEnv(), { deployment: { ...DEPLOYED, status: 'predicted' } });
  assert.ok(predicted.missing.includes('deployment-not-deployed'));
});

test('an absent VERCEL_ENV is production', () => {
  const production = readServerConfig({ SESSION_SECRET: SESSION_VALUE });
  assert.equal(production.environment, 'production');
  assert.equal(production.isProduction, true);
  assert.deepEqual([...production.session.allowedDomains], ['lestersarcade.io', 'www.lestersarcade.io']);
  const development = readServerConfig({ VERCEL_ENV: 'development' });
  assert.equal(development.isProduction, false);
  assert.deepEqual([...development.session.allowedDomains], ['lestersarcade.io', 'www.lestersarcade.io', 'localhost', '127.0.0.1']);
  const explicit = readServerConfig({ VERCEL_ENV: 'preview', SESSION_ALLOWED_DOMAINS: 'a.example, b.example' });
  assert.deepEqual([...explicit.session.allowedDomains], ['a.example', 'b.example']);
  const empty = readServerConfig({});
  assert.equal(empty.paused, false);
  assert.equal(empty.minPaidWei, DEFAULT_MIN_PAID_WEI);
  assert.equal(empty.rpcUrl, 'https://liteforge.rpc.caldera.xyz/http');
  assert.equal(empty.chainId, 4441);
  assert.equal(empty.session.configured, false);
  assert.throws(() => empty.session.secret(), /session-not-configured/);
  assert.equal(empty.neon.configured, false);
  assert.equal(empty.neon.createClient(), null);
  assert.equal(empty.cron.configured, false);
  assert.equal(empty.deployment.status, 'unavailable');
  assert.equal(empty.settlementReady, false);
  assert.equal(readServerConfig({ SETTLEMENT_PAUSED: 'true' }).paused, true);
  assert.equal(readServerConfig({ SETTLEMENT_PAUSED: '1' }).paused, false);
  assert.equal(readServerConfig({ RANKED_MIN_PAID_WEI: '5' }).minPaidWei, '5');
  assert.equal(readServerConfig({ RANKED_MIN_PAID_WEI: '1e18' }).minPaidWei, DEFAULT_MIN_PAID_WEI);
  assert.equal(readServerConfig({ INDEX_START_BLOCK: '1234' }).indexStartBlock, 1234);
  assert.equal(readServerConfig({ SESSION_SECRET: 'short' }).session.configured, false);
  assert.equal(readServerConfig({ NEON_DATABASE_URL: 'mysql://x/y' }).neon.configured, false);
});

test('IPv6 addresses share a /64 bucket', () => {
  const key = SESSION_VALUE;
  assert.equal(ipBucket('2001:db8:abcd:12::1', key), ipBucket('2001:0db8:abcd:0012:ffff:1:2:3', key), 'two addresses in one /64 share a bucket');
  assert.notEqual(ipBucket('2001:db8:abcd:12::1', key), ipBucket('2001:db8:abcd:13::1', key), 'different /64s do not');
  assert.equal(foldIp('2001:db8:abcd:12::1'), '2001:0db8:abcd:0012::/64');
  assert.equal(foldIp('[2001:db8::1]'), '2001:0db8:0000:0000::/64');
  assert.equal(foldIp('fe80::1%eth0'), 'fe80:0000:0000:0000::/64');
  assert.equal(foldIp('::ffff:203.0.113.7'), '203.0.113.7', 'IPv4-mapped IPv6 uses the v4 address');
  assert.equal(ipBucket('::ffff:203.0.113.7', key), ipBucket('203.0.113.7', key));
  assert.notEqual(ipBucket('203.0.113.7', key), ipBucket('203.0.113.8', key), 'IPv4 keeps the full address');
  assert.match(ipBucket('203.0.113.7', key), /^[0-9a-f]{32}$/);
  assert.notEqual(ipBucket('203.0.113.7', key), ipBucket('203.0.113.7', `${key}-other`), 'the bucket is keyed');
  assert.equal(foldIp('unknown'), 'unknown');
  assert.throws(() => ipBucket('1.2.3.4', ''), /secret/);
  assert.equal(clientIp({ headers: { 'x-forwarded-for': '198.51.100.9, 10.0.0.1' } }), '198.51.100.9');
  assert.equal(clientIp({ headers: { 'x-real-ip': '198.51.100.10' } }), '198.51.100.10');
  assert.equal(clientIp({ headers: {} }), 'unknown');
});

test('readJsonBody enforces the cap from content-length, the parsed body and the stream', async () => {
  let touched = false;
  const guarded = { headers: { 'content-length': '5000' }, get body() { touched = true; return {}; } };
  assert.deepEqual(await readJsonBody(guarded, { maxBytes: 4096 }), { ok: false, status: 413, error: 'body-too-large' });
  assert.equal(touched, false, 'the declared length is checked before the body is touched');
  assert.deepEqual(await readJsonBody({ headers: {}, body: { blob: 'x'.repeat(5000) } }, { maxBytes: 4096 }), { ok: false, status: 413, error: 'body-too-large' });
  assert.deepEqual(await readJsonBody({ headers: {}, body: '{"a":1}' }, { maxBytes: 4096 }), { ok: true, body: { a: 1 } });
  assert.deepEqual(await readJsonBody({ headers: {}, body: '{nope' }, { maxBytes: 4096 }), { ok: false, status: 400, error: 'invalid-json' });
  assert.deepEqual(await readJsonBody({ headers: {}, get body() { throw new Error('Invalid JSON'); } }, { maxBytes: 4096 }), { ok: false, status: 400, error: 'invalid-json' });
  assert.deepEqual(await readJsonBody({ headers: {}, body: { a: 2 } }, { maxBytes: 4096 }), { ok: true, body: { a: 2 } });
  const stream = Object.assign(Readable.from([Buffer.from('{"wallet":'), Buffer.from('"0xabc"}')]), { headers: {} });
  assert.deepEqual(await readJsonBody(stream, { maxBytes: 4096 }), { ok: true, body: { wallet: '0xabc' } });
  const big = Object.assign(Readable.from([Buffer.alloc(3000, 32), Buffer.alloc(3000, 32)]), { headers: {} });
  assert.deepEqual(await readJsonBody(big, { maxBytes: 4096 }), { ok: false, status: 413, error: 'body-too-large' });
  const empty = Object.assign(Readable.from([]), { headers: {} });
  assert.deepEqual(await readJsonBody(empty, { maxBytes: 4096 }), { ok: true, body: null });
});

test('queryOf rejects undeclared parameters and bearerToken reads the header', () => {
  assert.deepEqual(queryOf({ url: '/api/x?game=chikun&page=2' }, ['game', 'page']), { ok: true, query: { game: 'chikun', page: '2' } });
  assert.deepEqual(queryOf({ url: '/api/x?game=chikun&cb=123' }, ['game']), { ok: false, status: 400, error: 'invalid-query' });
  assert.deepEqual(queryOf({ query: { game: 'chikun', extra: '1' } }, ['game']), { ok: false, status: 400, error: 'invalid-query' });
  assert.deepEqual(queryOf({ query: { id: ['ab', 'ab'] } }, ['id']), { ok: true, query: { id: 'ab' } }, 'a repeated identical value is tolerated');
  assert.deepEqual(queryOf({ query: { id: ['ab', 'cd'] } }, ['id']), { ok: false, status: 400, error: 'invalid-query' });
  assert.equal(bearerToken({ headers: { authorization: 'Bearer abc.def' } }), 'abc.def');
  assert.equal(bearerToken({ headers: { Authorization: 'bearer abc.def' } }), 'abc.def');
  assert.equal(bearerToken({ headers: { authorization: 'Basic abc' } }), null);
  assert.equal(bearerToken({ headers: {} }), null);
});

test('verifyBearer accepts only a live token signed with SESSION_SECRET', async () => {
  const wallet = new ethers.Wallet(VERIFIER_KEY).address;
  const now = Date.parse('2026-09-23T12:00:00.000Z');
  const deps = await buildBaseDeps(fullEnv(), { db: null, deployment: DEPLOYED, nowMs: now });
  const { token } = issueSessionToken({ createHmac, timingSafeEqual }, { secret: SESSION_VALUE, wallet, nowMs: now, audience: 'lestersarcade:development' });
  assert.deepEqual(verifyBearer({ authorization: `Bearer ${token}` }, deps)?.wallet, wallet.toLowerCase());
  assert.equal(verifyBearer({ authorization: `Bearer ${token}x` }, deps), null);
  assert.equal(verifyBearer({}, deps), null);
  const unconfigured = await buildBaseDeps({}, { db: null, deployment: DEPLOYED, nowMs: now });
  assert.equal(verifyBearer({ authorization: `Bearer ${token}` }, unconfigured), null);
});

test('the handler seam checks the method, the query and auth before the body, and hides internal errors', async () => {
  const seen = [];
  const createHandler = makeHandler({
    methods: ['PUT'], query: [], maxBytes: 64,
    auth: async (request) => (request.headers.authorization === 'Bearer ok' ? null : { status: 401, body: { ok: false, error: 'invalid-session' } }),
    run: async (request, deps) => { seen.push({ body: request.body, deps }); if (request.body?.explode) throw Object.assign(new Error(`boom ${NEON_URL}`), { code: 'XX000' }); return { status: 200, body: { ok: true }, headers: { 'Cache-Control': 'private, no-store' } }; },
  });
  const handler = createHandler(async () => ({ marker: 'deps' }));
  let bodyRead = false;
  const unauth = fakeRes();
  await handler({ method: 'PUT', url: '/api/x', headers: {}, get body() { bodyRead = true; return {}; } }, unauth);
  assert.equal(unauth.statusCode, 401);
  assert.equal(bodyRead, false, 'a failed Bearer check never reads the body');

  const wrongMethod = fakeRes();
  await handler({ method: 'GET', url: '/api/x', headers: {} }, wrongMethod);
  assert.equal(wrongMethod.statusCode, 405);
  assert.equal(wrongMethod.headers.allow, 'PUT');

  const badQuery = fakeRes();
  await handler({ method: 'PUT', url: '/api/x?cb=1', headers: { authorization: 'Bearer ok' } }, badQuery);
  assert.deepEqual([badQuery.statusCode, badQuery.body.error], [400, 'invalid-query']);

  const tooBig = fakeRes();
  await handler({ method: 'PUT', url: '/api/x', headers: { authorization: 'Bearer ok' }, body: { pad: 'x'.repeat(100) } }, tooBig);
  assert.deepEqual([tooBig.statusCode, tooBig.body.error], [413, 'body-too-large']);

  const ok = fakeRes();
  await handler({ method: 'PUT', url: '/api/x', headers: { Authorization: 'Bearer ok' }, body: { a: 1 } }, ok);
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.headers['cache-control'], 'private, no-store');
  assert.equal(ok.headers['content-type'], 'application/json; charset=utf-8');
  assert.deepEqual(seen.at(-1).body, { a: 1 });
  assert.equal(seen.at(-1).deps.marker, 'deps');

  const logged = [];
  const original = console.error;
  console.error = (...args) => logged.push(args);
  const crash = fakeRes();
  try {
    await handler({ method: 'PUT', url: '/api/x', headers: { authorization: 'Bearer ok' }, body: { explode: true } }, crash);
  } finally {
    console.error = original;
  }
  assert.deepEqual([crash.statusCode, crash.body], [500, { ok: false, error: 'internal-error' }]);
  assert.deepEqual(logged, [['[api] internal-error', { name: 'Error', code: 'XX000', sqlstate: 'XX000' }]], 'one line: the cause class only');
  assert.equal(JSON.stringify(logged).includes(NEON_PASSWORD), false, 'never the message');

  const res = fakeRes();
  sendJson(res, 404, { ok: false, error: 'session-not-found' }, { cache: 'public, s-maxage=30', headers: { 'Retry-After': '5' } });
  assert.deepEqual([res.statusCode, res.headers['cache-control'], res.headers['retry-after']], [404, 'public, s-maxage=30', '5']);
});

test('server/http.mjs exports the §4.1 helpers, the handler seam and the Bearer seam only', () => {
  // §4.1 helpers, makeHandler (A30), foldIp (tested bucket input), the
  // Bearer seam that settle (E2-E4, E15) reuses: verifyBearer and sessionAudience,
  // and the redacted internal-error log the E10/E11 adapters share (ops-health).
  assert.deepEqual(Object.keys(httpModule).sort(), [
    'bearerToken', 'clientIp', 'errorLogFields', 'foldIp', 'ipBucket', 'logInternalError', 'makeHandler', 'queryOf', 'readJsonBody', 'sendJson', 'sessionAudience', 'verifyBearer',
  ]);
  assert.deepEqual(Object.keys(deploymentModule).sort(), ['UNAVAILABLE_DEPLOYMENT', 'loadDeployment']);
});

test('loadDeployment reads the generated module and falls back to an unavailable deployment', async () => {
  const loaded = await loadDeployment();
  assert.ok(['unavailable', 'predicted', 'deployed'].includes(loaded.status));
  assert.equal(loaded.chainId, 4441);
  for (const key of ['gameRegistry', 'playerProfileRegistry', 'arcadeRankedEntry', 'scoreSubmissionRegistry', 'achievementRegistries']) assert.ok(key in loaded.addresses, key);
  const missing = await loadDeployment({ importModule: async () => { throw new Error('Cannot find module'); } });
  assert.equal(missing, UNAVAILABLE_DEPLOYMENT);
  assert.deepEqual(missing.addresses.achievementRegistries, { 'lester-blaster': null, chikun: null, stacked: null });
  assert.equal(missing.startBlock, null);
  const generated = await loadDeployment({ importModule: async () => ({ LITVM_DEPLOYMENT: DEPLOYED }) });
  assert.equal(generated, DEPLOYED);
});

test('Neon clients carry a schemaKey without credentials and surface the SQLSTATE', async () => {
  assert.equal(neonSchemaKeyFor(NEON_URL), 'neon:ep-quiet-lake-123.us-east-2.aws.neon.tech/neondb');
  const client = createNeonClient({ connectionString: NEON_URL, fetchImpl: async () => ({ ok: false, status: 400, json: async () => ({ message: 'relation "x" already exists', code: '42P07' }) }) });
  assert.equal(client.schemaKey.includes(NEON_PASSWORD), false);
  await assert.rejects(client.query('CREATE TABLE x ()'), (error) => error.code === '42P07' && !error.message.includes(NEON_PASSWORD));
  const deps = await buildBaseDeps(fullEnv(), { deployment: DEPLOYED, fetchImpl: async () => ({ ok: true, json: async () => ({ rows: [] }) }) });
  assert.equal(deps.db.schemaKey, 'neon:ep-quiet-lake-123.us-east-2.aws.neon.tech/neondb');
  const cache = {};
  const first = await buildBaseDeps(fullEnv(), { deployment: DEPLOYED }, cache);
  const second = await buildBaseDeps(fullEnv(), { deployment: DEPLOYED }, cache);
  assert.equal(first.db, second.db, 'the Neon client is cached at module scope');
  assert.equal((await buildBaseDeps({}, { deployment: DEPLOYED })).db, null);
  assert.equal(typeof first.nowMs, 'function');
});
