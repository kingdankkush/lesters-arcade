// Biome region model for Hard Money Heroes.
//
// The survival map is endless, so we don't pre-bake a finite grid. Instead we
// derive a biome deterministically from the run seed + world cell using value
// noise over a coarse lattice. This makes the layout "decided at level start"
// (stable for a given seed) and coherent (neighboring cells share a biome),
// while staying memory-free for an infinite world. Enemies/power-ups remain
// procedural at runtime — only the static environment is biome-driven.

export const BIOMES = Object.freeze(['town', 'desert', 'forest', 'rocky', 'road', 'water']);

// Region size in world tiles. Larger = bigger contiguous biome patches.
// Kept small enough that a player crosses 2-3 biomes during a single run (the
// visible window is ~±10 tiles), so biome variety actually reads in gameplay
// instead of the whole short run sitting inside one giant region.
export const BIOME_REGION = 7;

function hash2(seed, x, y) {
  let h = (seed | 0) ^ 0x9e3779b9;
  h = Math.imul(h ^ (x | 0), 0x85ebca6b);
  h = Math.imul(h ^ (y | 0), 0xc2b2ae35);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296; // [0,1)
}

// Weighted biome pick. Town is dominant (richest prop library); others sprinkle.
// Weights can be tuned without touching callers.
const BIOME_WEIGHTS = Object.freeze([
  ['town', 0.46],
  ['desert', 0.18],
  ['forest', 0.12],
  ['rocky', 0.12],
  ['road', 0.07],
  ['water', 0.05],
]);

export function biomeForRegion(seed, regionX, regionY) {
  const r = hash2(seed >>> 0, regionX, regionY);
  let acc = 0;
  for (const [name, w] of BIOME_WEIGHTS) {
    acc += w;
    if (r < acc) return name;
  }
  return 'town';
}

// Biome at a world tile (rounds the tile into its region).
export function biomeAt(seed, worldX, worldY) {
  const rx = Math.floor(worldX / BIOME_REGION);
  const ry = Math.floor(worldY / BIOME_REGION);
  return biomeForRegion(seed, rx, ry);
}

// Pick a parallax-background strip index that fits a biome, deterministically.
// `count` is how many bg strips exist; we offset per-biome so different biomes
// tend to show different backdrops, stable for a given seed.
export function parallaxIndexForBiome(seed, biome, count) {
  if (!count) return 0;
  const biomeIdx = Math.max(0, BIOMES.indexOf(biome));
  const r = hash2(seed >>> 0, biomeIdx * 101 + 7, 13);
  return Math.floor(r * count);
}

// Given a list of biome-tagged props, return those matching a biome, with a
// fallback chain so sparse biomes still render something coherent.
export function propsForBiome(worldProps, biome) {
  const exact = worldProps.filter((p) => p.biome === biome);
  if (exact.length) return exact;
  // Fallback: biomes that read acceptably together.
  const fallback = {
    desert: ['rocky', 'road', 'town'],
    forest: ['town', 'rocky'],
    rocky: ['desert', 'town'],
    road: ['town'],
    water: ['forest', 'town'],
    town: ['road'],
  }[biome] ?? ['town'];
  for (const fb of fallback) {
    const hit = worldProps.filter((p) => p.biome === fb);
    if (hit.length) return hit;
  }
  return worldProps;
}
