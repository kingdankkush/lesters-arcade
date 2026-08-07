import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('HMH Pixi is a stable preloaded child vendor chunk instead of consuming the capped game entry', async () => {
  const [build, shell] = await Promise.all([
    readFile(new URL('../build.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../apps/portal/hmh-reboot/index.html', import.meta.url), 'utf8'),
  ]);
  assert.match(build, /'chunks\/hmh-pixi': hmhPixiVendor/);
  assert.match(build, /path:\s*'\.\.\/chunks\/hmh-pixi\.js',\s*external:\s*true/);
  assert.match(shell, /rel="modulepreload" href="\.\.\/dist\/chunks\/hmh-pixi\.js"/);
});
