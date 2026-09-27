import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { SHARE_CARD_MAX_BYTES, canShareFiles, fetchShareCardFile } from '../apps/portal/src/share-file.mjs';

// The lazy card-file chunk of share-links.mjs (plan
// docs/handoffs/free-share-20260926.md §10.3): the Free card fetched
// same-origin as a File for the Web Share API. Every failure is null, so the
// caller shares text and URL instead; it never throws into a click handler.

const CARD = '/api/free-card/stacked/as0000000000000000000000000000000.png';
const png = (size = 2048, type = 'image/png') => new Blob([new Uint8Array(size)], { type });
const respond = (blob, { ok = true } = {}) => async () => ({ ok, blob: async () => blob });

test('a same-origin PNG card becomes a named image File', async () => {
  const seen = [];
  const file = await fetchShareCardFile(CARD, {
    fetchImpl: async (url, init) => { seen.push([url, init.credentials, init.signal instanceof AbortSignal]); return { ok: true, blob: async () => png() }; },
  });
  assert.ok(file instanceof File);
  assert.equal(file.name, 'lesters-arcade-free-run.png');
  assert.equal(file.type, 'image/png');
  assert.equal(file.size, 2048);
  assert.deepEqual(seen, [[CARD, 'omit', true]], 'same-origin path, no cookies, abortable');
});

test('every failure is null: status, type, size, network, timeout and foreign paths', async () => {
  assert.equal(await fetchShareCardFile(CARD, { fetchImpl: respond(png(), { ok: false }) }), null, '404');
  assert.equal(await fetchShareCardFile(CARD, { fetchImpl: respond(png(64, 'application/json')) }), null, 'wrong type');
  assert.equal(await fetchShareCardFile(CARD, { fetchImpl: respond(png(0)) }), null, 'empty');
  assert.equal(await fetchShareCardFile(CARD, { fetchImpl: respond(png(SHARE_CARD_MAX_BYTES + 1)) }), null, 'oversize');
  assert.equal(await fetchShareCardFile(CARD, { fetchImpl: async () => { throw new TypeError('offline'); } }), null, 'network error');
  const hang = (url, { signal }) => new Promise((resolve, reject) => { signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))); });
  const started = Date.now();
  assert.equal(await fetchShareCardFile(CARD, { fetchImpl: hang, timeoutMs: 30 }), null, 'timeout');
  assert.ok(Date.now() - started < 1_000);
  let fetched = 0;
  for (const path of ['https://evil.example/x.png', '//evil.example/api/free-card/x.png', '/api/share-card/ab.png', '', null, 42]) {
    assert.equal(await fetchShareCardFile(path, { fetchImpl: async () => { fetched += 1; return { ok: true, blob: async () => png() }; } }), null, String(path));
  }
  assert.equal(fetched, 0, 'only the Free card path is ever fetched');
  assert.equal(await fetchShareCardFile(CARD, { fetchImpl: null }), null);
});

test('canShareFiles probes canShare with a PNG file and never throws', () => {
  const probes = [];
  assert.equal(canShareFiles({ canShare: (data) => { probes.push(data); return true; } }), true);
  assert.equal(probes[0].files[0].type, 'image/png');
  assert.equal(canShareFiles({ canShare: () => false }), false);
  assert.equal(canShareFiles({ canShare: () => 'yes' }), false, 'only a real true');
  assert.equal(canShareFiles({ canShare: () => { throw new TypeError('no files'); } }), false);
  assert.equal(canShareFiles({}), false);
  assert.equal(canShareFiles(null), false);
});

test('the chunk is import-free and small; it loads only through share-links.mjs', async () => {
  const [source, links] = await Promise.all([
    readFile(new URL('../apps/portal/src/share-file.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../apps/portal/src/share-links.mjs', import.meta.url), 'utf8'),
  ]);
  assert.doesNotMatch(source, /^import /m);
  assert.ok(source.length < 3_000, `${source.length} B of source`);
  assert.match(links, /import\('\.\/share-file\.mjs'\)/);
});
