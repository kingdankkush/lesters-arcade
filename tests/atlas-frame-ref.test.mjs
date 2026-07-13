import assert from 'node:assert/strict';
import test from 'node:test';

import { assetSrcForFrameRef, isAtlasFrameRef, parseAtlasFrameRef } from '../apps/portal/src/atlas-frame-ref.mjs';

test('atlas frame refs preserve a string manifest API and expose safe crop metadata', () => {
  const ref = './assets/generated/hmh-animated-roster-atlas/lester/lester-00.webp#frame=4,6,48,96,2048,1024';
  assert.equal(isAtlasFrameRef(ref), true);
  assert.equal(assetSrcForFrameRef(ref), './assets/generated/hmh-animated-roster-atlas/lester/lester-00.webp');
  assert.deepEqual(parseAtlasFrameRef(ref), {
    src: './assets/generated/hmh-animated-roster-atlas/lester/lester-00.webp',
    x: 4,
    y: 6,
    width: 48,
    height: 96,
    atlasWidth: 2048,
    atlasHeight: 1024,
  });
});

test('atlas frame parser rejects out-of-bounds crops and passes loose refs through', () => {
  assert.equal(parseAtlasFrameRef('sprite.png#frame=90,0,20,20,100,100'), null);
  assert.equal(isAtlasFrameRef('./sprite.png'), false);
  assert.equal(assetSrcForFrameRef('./sprite.png'), './sprite.png');
});
