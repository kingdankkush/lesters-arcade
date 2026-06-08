import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BIOMES,
  BIOME_REGION,
  biomeForRegion,
  biomeAt,
  parallaxIndexForBiome,
  propsForBiome,
} from '../apps/portal/src/biome-model.mjs';

test('biomeForRegion is deterministic for a given seed', () => {
  const a = biomeForRegion(12345, 3, -2);
  const b = biomeForRegion(12345, 3, -2);
  assert.equal(a, b);
  assert.ok(BIOMES.includes(a));
});

test('different seeds can yield different layouts', () => {
  const layoutA = [];
  const layoutB = [];
  for (let i = 0; i < 50; i += 1) {
    layoutA.push(biomeForRegion(1, i, 0));
    layoutB.push(biomeForRegion(2, i, 0));
  }
  assert.notDeepEqual(layoutA, layoutB);
});

test('cells within the same region share a biome (contiguity)', () => {
  const seed = 999;
  const rx = 4;
  const ry = 1;
  const base = biomeForRegion(seed, rx, ry);
  // every world tile inside the region maps to the same biome
  for (let dx = 0; dx < BIOME_REGION; dx += 5) {
    for (let dy = 0; dy < BIOME_REGION; dy += 5) {
      assert.equal(biomeAt(seed, rx * BIOME_REGION + dx, ry * BIOME_REGION + dy), base);
    }
  }
});

test('all biomes are reachable across the map', () => {
  const seen = new Set();
  for (let x = -40; x < 40; x += 1) {
    for (let y = -40; y < 40; y += 1) {
      seen.add(biomeForRegion(7, x, y));
    }
  }
  // at least the dominant ones should appear in a large sample
  assert.ok(seen.has('town'));
  assert.ok(seen.size >= 4);
});

test('parallaxIndexForBiome stays in range and is stable', () => {
  for (const biome of BIOMES) {
    const idx = parallaxIndexForBiome(42, biome, 70);
    assert.ok(idx >= 0 && idx < 70);
    assert.equal(idx, parallaxIndexForBiome(42, biome, 70));
  }
  assert.equal(parallaxIndexForBiome(42, 'town', 0), 0);
});

test('propsForBiome returns exact matches when present', () => {
  const props = [
    { id: 'a', biome: 'town' },
    { id: 'b', biome: 'desert' },
    { id: 'c', biome: 'town' },
  ];
  const town = propsForBiome(props, 'town');
  assert.deepEqual(town.map((p) => p.id), ['a', 'c']);
});

test('propsForBiome falls back when a biome has no props', () => {
  const props = [
    { id: 'a', biome: 'town' },
    { id: 'b', biome: 'rocky' },
  ];
  // forest has no props -> fallback chain ['town','rocky'] -> picks town first
  const forest = propsForBiome(props, 'forest');
  assert.ok(forest.length > 0);
  assert.equal(forest[0].biome, 'town');
});

test('propsForBiome never returns empty for a non-empty library', () => {
  const props = [{ id: 'only', biome: 'town' }];
  for (const biome of BIOMES) {
    assert.ok(propsForBiome(props, biome).length > 0);
  }
});
