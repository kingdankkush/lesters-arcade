import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import test from 'node:test';

import { errorLogFields, logInternalError, makeHandler } from '../server/http.mjs';
import { fakeRequest, fakeResponse, invoke } from './helpers/fake-http.mjs';

/**
 * ops-health AC3 (contract §4.1): every 500 internal-error in the api layer
 * logs exactly one line, console.error('[<label>] internal-error',
 * { name, code, sqlstate }), so the Vercel runtime log shows the cause class
 * of a failure and never its message, the request URL or a secret.
 */

const SECRET_URL = 'postgresql://owner:hunter2-secret@ep-quiet-lake.neon.tech/neondb';
const RPC_KEY_URL = 'https://liteforge.rpc.example/v1/rk9rk9rk9-secret-key';
const LOG_KEYS = ['name', 'code', 'sqlstate'];

function captureErrors(run) {
  const logged = [];
  const original = console.error;
  console.error = (...args) => { logged.push(args); };
  return Promise.resolve()
    .then(run)
    .finally(() => { console.error = original; })
    .then((value) => ({ value, logged }));
}

test('errorLogFields keeps only a shape-checked name, code and SQLSTATE', () => {
  const neon = Object.assign(new Error(`neon 500: terminating connection ${SECRET_URL}`), { code: '57P01' });
  assert.deepEqual(errorLogFields(neon), { name: 'Error', code: '57P01', sqlstate: '57P01' });
  const named = Object.assign(new Error('boom'), { name: 'NeonDbError', code: '23505' });
  assert.deepEqual(errorLogFields(named), { name: 'NeonDbError', code: '23505', sqlstate: '23505' });
  const ethersLike = Object.assign(new Error(`could not coalesce error (${RPC_KEY_URL})`), { code: 'NETWORK_ERROR' });
  assert.deepEqual(errorLogFields(ethersLike), { name: 'Error', code: 'NETWORK_ERROR', sqlstate: null });
  assert.deepEqual(errorLogFields(Object.assign(new TypeError('x'), { code: 'EPIPE' })), { name: 'TypeError', code: 'EPIPE', sqlstate: null }, 'a Node code is not a SQLSTATE');
  assert.deepEqual(errorLogFields(Object.assign(new Error('x'), { code: 42 })), { name: 'Error', code: '42', sqlstate: null });
  assert.deepEqual(errorLogFields(Object.assign(new Error('x'), { code: 'ERR', sqlstate: '40001' })), { name: 'Error', code: 'ERR', sqlstate: '40001' });
  // Text smuggled into the name or the code never reaches the log.
  assert.deepEqual(errorLogFields(Object.assign(new Error('x'), { name: SECRET_URL, code: RPC_KEY_URL })), { name: 'Error', code: null, sqlstate: null });
  assert.deepEqual(errorLogFields(Object.assign(new Error('x'), { name: 'Bad Name', code: 'has space' })), { name: 'Error', code: null, sqlstate: null });
  assert.deepEqual(errorLogFields(Object.assign(new Error('x'), { code: { nested: SECRET_URL } })), { name: 'Error', code: null, sqlstate: null });
  for (const thrown of [undefined, null, 'a string with a secret', 17, Symbol('s')]) {
    assert.deepEqual(errorLogFields(thrown), { name: 'Error', code: null, sqlstate: null }, String(typeof thrown));
  }
  for (const error of [neon, named, ethersLike, null]) assert.deepEqual(Object.keys(errorLogFields(error)), LOG_KEYS);
});

test('logInternalError writes one line with the label and the three fields', async () => {
  const failure = Object.assign(new Error(`connect ${SECRET_URL}`), { code: '08006' });
  const { logged } = await captureErrors(() => logInternalError('health', failure));
  assert.deepEqual(logged, [['[health] internal-error', { name: 'Error', code: '08006', sqlstate: '08006' }]]);
  assert.doesNotMatch(JSON.stringify(logged), /hunter2|postgresql|connect/);
});

test('the handler seam logs a thrown run and a missing result the same way', async () => {
  const createThrowing = makeHandler({ label: 'fixture', run: async () => { throw Object.assign(new RangeError(`bad ${RPC_KEY_URL}`), { code: 'ERR_OUT_OF_RANGE' }); } });
  const thrown = await captureErrors(() => invoke(createThrowing(() => ({})), { url: '/api/fixture' }));
  assert.deepEqual([thrown.value.status, thrown.value.body], [500, { ok: false, error: 'internal-error' }]);
  assert.equal(thrown.value.headers['cache-control'], 'no-store');
  assert.deepEqual(thrown.logged, [['[fixture] internal-error', { name: 'RangeError', code: 'ERR_OUT_OF_RANGE', sqlstate: null }]]);

  const createEmpty = makeHandler({ label: 'empty', run: async () => undefined });
  const empty = await captureErrors(() => invoke(createEmpty(() => ({})), { url: '/api/empty' }));
  assert.deepEqual([empty.value.status, empty.value.body], [500, { ok: false, error: 'internal-error' }]);
  assert.deepEqual(empty.logged, [['[empty] internal-error', { name: 'TypeError', code: null, sqlstate: null }]], 'a handler that answers nothing is logged, not silent');
});

// invoke() for any content type: E10 answers HTML, the rest JSON.
async function invokeAny(handler, request) {
  const res = fakeResponse();
  await handler(fakeRequest(request), res);
  return { status: res.statusCode, headers: res.headers, text: res.text };
}

function apiModules(dir = new URL('../api/', import.meta.url), prefix = 'api/') {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) files.push(...apiModules(new URL(`${entry.name}/`, dir), `${prefix}${entry.name}/`));
    else if (entry.name.endsWith('.mjs')) files.push(`${prefix}${entry.name}`);
  }
  return files.sort();
}

test('every api function logs a failing dependency as one redacted line', async () => {
  const files = apiModules();
  assert.ok(files.includes('api/cron/index-chain.mjs') && files.includes('api/share-page.mjs') && files.includes('api/share-card.mjs'), files.join(', '));
  for (const file of files) {
    // eslint-disable-next-line no-await-in-loop
    const mod = await import(new URL(`../${file}`, import.meta.url));
    assert.equal(typeof mod.createHandler, 'function', `${file} exports createHandler (A30)`);
    const failure = Object.assign(new Error(`connect ${SECRET_URL} via ${RPC_KEY_URL}`), { name: 'NeonDbError', code: '57P01' });
    const handler = mod.createHandler(async () => { throw failure; });
    let answered = null;
    for (const method of ['GET', 'POST', 'PUT']) {
      // eslint-disable-next-line no-await-in-loop
      const attempt = await captureErrors(() => invokeAny(handler, { method, url: `/${file.replace(/\.mjs$/, '')}`, headers: { 'content-type': 'application/json' }, body: method === 'GET' ? undefined : {} }));
      if (attempt.value.status === 405) { assert.deepEqual(attempt.logged, [], `${file} ${method}: a 405 logs nothing`); continue; }
      answered = { method, ...attempt };
      break;
    }
    assert.ok(answered, `${file} accepts GET, POST or PUT`);
    assert.equal(answered.value.status, 500, `${file} ${answered.method}`);
    assert.equal(answered.logged.length, 1, `${file}: exactly one line`);
    const [label, fields] = answered.logged[0];
    assert.match(label, /^\[[a-z0-9/-]+\] internal-error$/, file);
    assert.deepEqual(fields, { name: 'NeonDbError', code: '57P01', sqlstate: '57P01' }, file);
    assert.deepEqual(Object.keys(fields), LOG_KEYS, `${file}: only name, code and sqlstate`);
    assert.doesNotMatch(JSON.stringify(answered.logged), /hunter2|postgresql|rpc\.example|secret/, file);
  }
});
