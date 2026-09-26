import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../apps/portal/sw.js', import.meta.url), 'utf8');
const origin = 'https://lestersarcade.io';
const marker = source.match(/const CACHE_VERSION = '([^']+)'/)[1];
const key = (request) => new URL(typeof request === 'string' ? request : request.url, origin).href;

function worker({ offline = false, cacheNames = [] } = {}) {
  const handlers = new Map();
  const entries = new Map();
  const fetches = [];
  const deleted = [];
  let precached = [];
  let claimed = false;
  let skippedWaiting = false;
  const cache = {
    match: async (request) => entries.get(key(request))?.clone(),
    put: async (request, response) => {
      entries.set(key(request), response.clone());
    },
    addAll: async (requests) => { precached = requests; },
  };
  vm.runInNewContext(source, {
    URL, Request, Set, Promise,
    self: {
      location: { origin },
      clients: { claim: async () => { claimed = true; } },
      skipWaiting: async () => { skippedWaiting = true; },
      addEventListener: (name, callback) => handlers.set(name, callback),
    },
    caches: {
      open: async () => cache,
      keys: async () => cacheNames,
      delete: async (name) => { deleted.push(name); return true; },
    },
    fetch: async (request, options) => {
      fetches.push({ request, options });
      if (offline) throw new Error('offline');
      const revalidated = options?.cache === 'no-cache' || options?.cache === 'reload';
      return new Response(revalidated ? 'current release bytes' : 'previous HTTP-cache bytes');
    },
  });
  return {
    entries, fetches, deleted,
    get precached() { return precached; },
    get claimed() { return claimed; },
    get skippedWaiting() { return skippedWaiting; },
    async lifecycle(name) {
      let pending;
      handlers.get(name)({ waitUntil: (promise) => { pending = promise; } });
      await pending;
    },
    async request(path, overrides = {}) {
      let response;
      const request = { url: new URL(path, origin).href, method: 'GET', mode: 'cors', destination: '', cache: 'default', ...overrides };
      handlers.get('fetch')({ request, respondWith: (promise) => { response = promise; } });
      return response;
    },
  };
}

test('returning visits revalidate mutable entry scripts, styles, navigation and asset manifests', async () => {
  for (const [path, overrides] of [
    ['/dist/main.js?v=arcade-discovery-20260914', { destination: 'script' }],
    ['/dist/hmh-reboot/game.js', { destination: 'script' }],
    ['/dist/chunks/hmh-pixi.js', { destination: 'script' }],
    ['/hmh-reboot/styles.css', { destination: 'style' }],
    ['/assets/generated/hmh-native-world/atlas.json', {}],
    ['/index.html', { mode: 'navigate' }],
  ]) {
    const runtime = worker();
    const response = await runtime.request(path, overrides);
    assert.equal(await response.text(), 'current release bytes', path);
    assert.equal(runtime.fetches[0].options?.cache, 'no-cache', path);
  }
});

test('content-hashed chunks retain normal immutable HTTP caching', async () => {
  const runtime = worker();
  const response = await runtime.request('/dist/chunks/chunk-2WGYLO4P.js', { destination: 'script' });
  assert.equal(await response.text(), 'previous HTTP-cache bytes');
  assert.equal(runtime.fetches[0].options?.cache, undefined);
});

test('first media fill after a release revalidates HTTP cache and subsequent plays reuse the new bytes', async () => {
  for (const destination of ['image', 'audio', 'font', 'video']) {
    const runtime = worker();
    const path = `/assets/current-${destination}`;
    assert.equal(await (await runtime.request(path, { destination })).text(), 'current release bytes');
    assert.equal(await (await runtime.request(path, { destination })).text(), 'current release bytes');
    assert.equal(runtime.fetches.length, 1, `${destination} must retain repeat-visit cache efficiency`);
  }
});

test('activation retires only previous Lester arcade caches and preserves unrelated origin caches', async () => {
  const runtime = worker({ cacheNames: ['lesters-arcade-v32-hmh-gameplan-defects', 'lesters-arcade-v33-hmh-playable-update', marker, 'another-app-v1', 'wallet-offline-data'] });
  await runtime.lifecycle('activate');
  assert.deepEqual(runtime.deleted, ['lesters-arcade-v32-hmh-gameplan-defects', 'lesters-arcade-v33-hmh-playable-update']);
  assert.equal(runtime.claimed, true);
});

test('installation fetches a fresh offline shell rather than seeding it from a previous HTTP cache', async () => {
  const runtime = worker();
  await runtime.lifecycle('install');
  assert.ok(runtime.precached.length > 0);
  assert.ok(runtime.precached.every((request) => request instanceof Request && request.cache === 'reload'));
  assert.equal(runtime.skippedWaiting, true);
});

test('offline entry requests retain exact cached resources and navigation shell fallback', async () => {
  const runtime = worker({ offline: true });
  runtime.entries.set(key('/dist/main.js?v=current'), new Response('cached entry'));
  runtime.entries.set(key('/index.html'), new Response('cached shell'));
  assert.equal(await (await runtime.request('/dist/main.js?v=current', { destination: 'script' })).text(), 'cached entry');
  assert.equal(await (await runtime.request('/play/hmh', { mode: 'navigate' })).text(), 'cached shell');
});

test('foreign origins and non-GET requests remain outside the worker', async () => {
  const runtime = worker();
  assert.equal(await runtime.request('https://testnet.litvm.com', { destination: 'script' }), undefined);
  assert.equal(await runtime.request('/api/session', { method: 'POST' }), undefined);
  assert.equal(runtime.fetches.length, 0);
});

test('same-origin API requests stay outside the worker', async () => {
  const runtime = worker({ offline: true });
  runtime.entries.set(key('/api/leaderboard?game=chikun'), new Response('stale cached board'));
  for (const [path, overrides] of [
    ['/api/leaderboard?game=chikun', {}],
    ['/api/profile?wallet=0x1111111111111111111111111111111111111111&self=1', { cache: 'no-store' }],
    [`/api/session/${'ab'.repeat(32)}`, {}],
    [`/api/share-card/${'ab'.repeat(32)}.png?v=0123456789ab`, { destination: 'image' }],
    // free-share: the Free card is fetched same-origin for the native file share; never from the worker cache.
    [`/api/free-card/stacked/as${'0'.repeat(32)}.png`, { destination: 'image' }],
    ['/api/settle/status?sessionId32=0x00', { mode: 'navigate' }],
    ['/api', {}],
  ]) {
    assert.equal(await runtime.request(path, overrides), undefined, `${path} must reach the network untouched`);
  }
  assert.equal(runtime.fetches.length, 0, 'the worker never fetches or caches API responses');
  const online = worker();
  assert.equal(await (await online.request('/apiary/logo.png', { destination: 'image' })).text(), 'current release bytes', 'only the /api/ path prefix is bypassed');
});

test('explicit no-store requests bypass worker persistence and retain their fetch policy', async () => {
  const runtime = worker();
  runtime.entries.set(key('/private-snapshot'), new Response('existing cached value'));
  assert.equal(await (await runtime.request('/private-snapshot', { cache: 'no-store' })).text(), 'previous HTTP-cache bytes');
  assert.equal(runtime.fetches[0].options, undefined);
  assert.equal(await runtime.entries.get(key('/private-snapshot')).text(), 'existing cached value');
});

test('new portal registers worker updates without consulting the HTTP cache', () => {
  const html = readFileSync(new URL('../apps/portal/index.html', import.meta.url), 'utf8');
  assert.match(html, /serviceWorker\.register\('\.\/sw\.js',\s*\{\s*updateViaCache:\s*'none'\s*\}\)/);
});
