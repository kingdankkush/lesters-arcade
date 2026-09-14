import test from 'node:test';
import assert from 'node:assert/strict';
import { createSelectedHeroRendererLoader } from '../apps/hmh-reboot/src/selected-hero-renderer-loader.mjs';

test('hero renderer waits for selection, shares concurrent loading, and reuses a warm module', async () => {
  let calls = 0;
  const renderer = { createProductionHeroDisplay() {} };
  const load = createSelectedHeroRendererLoader(async () => { calls++; return renderer; });
  assert.equal(calls, 0);
  assert.deepEqual(await Promise.all([load(), load()]), [renderer, renderer]);
  assert.equal(await load(), renderer);
  assert.equal(calls, 1);
});

test('a failed hero renderer load can retry on the next selection', async () => {
  let calls = 0;
  const load = createSelectedHeroRendererLoader(async () => {
    if (++calls === 1) throw new Error('offline');
    return { ready: true };
  });
  await assert.rejects(load(), /offline/);
  assert.deepEqual(await load(), { ready: true });
  assert.equal(calls, 2);
});
