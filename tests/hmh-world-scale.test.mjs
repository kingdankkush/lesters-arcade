import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { WORLD_SCALE } from '../apps/portal/src/hmh-world-scale.mjs';

test('WO-7 declares the canonical HMH world pixel-density law', () => {
  assert.deepEqual(WORLD_SCALE, {
    tileW: 64,
    tileH: 32,
    texelDensity: 1.0,
    tolerance: 0.25,
  });
  assert.ok(Object.isFrozen(WORLD_SCALE), 'scale constants should be immutable');
});

test('ART_BIBLE documents the same density constants and tolerance', () => {
  const artBible = readFileSync(new URL('../docs/art/ART_BIBLE.md', import.meta.url), 'utf8');
  assert.match(artBible, /1 world tile = 64×32 screen pixels/);
  assert.match(artBible, /1 art pixel = 1 screen pixel at zoom 1/);
  assert.match(artBible, /±25%/);
});

test('world scale module and test are covered by the explicit syntax gate', () => {
  const syntax = readFileSync(new URL('../scripts/syntax-check.mjs', import.meta.url), 'utf8');
  assert.match(syntax, /apps\/portal\/src\/hmh-world-scale\.mjs/);
  assert.match(syntax, /tests\/hmh-world-scale\.test\.mjs/);
});
