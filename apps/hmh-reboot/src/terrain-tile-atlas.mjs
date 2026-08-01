/**
 * Runtime registry for the authored seamless terrain tiles produced by
 * `scripts/build-hmh-terrain-tiles.py`.
 *
 * Playtest feedback was that surfaces were unreadable: water, walkable ground,
 * road and raised decks were flat colour fills separable only by hue. Each
 * surface now fills with its own tiled material.
 *
 * Projection-only. Surface semantics (what is walkable, what is water, what
 * elevation a tile sits at) come from the authored world contract in
 * `level-one-world.mjs`; this module only decides what a surface looks like.
 */

export const TERRAIN_TILE_PIPELINE_ID = 'hmh-terrain-tiles-v2';
export const TERRAIN_TILE_SIZE = 512;

const TILE_ROOT = '../assets/generated/hmh-terrain-tiles';

// District ground material. Keys match `DISTRICT_PRODUCTION_MATERIALS`.
export const DISTRICT_TERRAIN_MATERIAL = Object.freeze({
  'frontier-relay': 'packed-earth',
  'rugpull-ravine': 'red-rock',
  'liquidity-crossing': 'wet-bank',
  hashwood: 'forest-floor',
  'mining-camp': 'crushed-ore',
  'liquidation-yard': 'industrial-slab',
});

// Surface-kind material. These carry the readability the player asked for.
export const SURFACE_TERRAIN_MATERIAL = Object.freeze({
  water: 'water',
  'shallow-water': 'shallow-water',
  bridge: 'bridge-deck',
  ledge: 'ledge-top',
  ramp: 'ledge-top',
});

export const TERRAIN_MATERIAL_IDS = Object.freeze([
  'packed-earth', 'red-rock', 'wet-bank', 'forest-floor', 'crushed-ore',
  'industrial-slab', 'road', 'water', 'shallow-water', 'bridge-deck', 'ledge-top',
]);

export function terrainTileAsset(materialId) {
  if (!TERRAIN_MATERIAL_IDS.includes(materialId)) throw new TypeError(`unknown terrain material: ${String(materialId)}`);
  return Object.freeze({
    materialId,
    imageUrl: `${TILE_ROOT}/${materialId}.png`,
  });
}

export function terrainFringeAsset(materialId) {
  if (!TERRAIN_MATERIAL_IDS.includes(materialId)) throw new TypeError(`unknown terrain material: ${String(materialId)}`);
  return Object.freeze({
    materialId,
    imageUrl: `${TILE_ROOT}/${materialId}-fringe.png`,
  });
}

export function terrainManifestUrl() {
  return `${TILE_ROOT}/hmh-terrain-tiles.json`;
}

export function validateTerrainManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') throw new TypeError('terrain manifest is required');
  if (manifest.pipelineId !== TERRAIN_TILE_PIPELINE_ID) {
    throw new TypeError(`unexpected terrain pipeline: ${String(manifest.pipelineId)}`);
  }
  if (manifest.runtimeAuthority !== 'projection-only') {
    throw new TypeError('terrain tiles must remain projection-only');
  }
  const ids = new Set((manifest.materials ?? []).map((entry) => entry.id));
  for (const required of TERRAIN_MATERIAL_IDS) {
    if (!ids.has(required)) throw new TypeError(`terrain manifest is missing ${required}`);
  }
  return Object.freeze({
    tileSize: manifest.tileSize ?? TERRAIN_TILE_SIZE,
    fringeHeight: manifest.fringeHeight ?? 128,
    materialIds: Object.freeze([...ids].sort()),
    seamlessVerified: Boolean(manifest.seamlessVerified),
  });
}

/**
 * Holds loaded tile textures and hands out Pixi fill styles.
 *
 * The registry starts empty and every accessor returns null until a texture
 * arrives, so callers keep their flat-colour fallback and a run never blocks
 * or breaks on art.
 */
export function createTerrainTileRegistry({ TilingSpriteClass } = {}) {
  const textures = new Map();
  const fringeTextures = new Map();
  const failed = new Set();
  let manifest = null;

  return {
    get ready() {
      return textures.size > 0;
    },
    get loadedIds() {
      return [...textures.keys()].sort();
    },
    hasFailed(materialId) {
      return failed.has(materialId);
    },
    setManifest(value) {
      manifest = validateTerrainManifest(value);
      return manifest;
    },
    get tileSize() {
      return manifest?.tileSize ?? TERRAIN_TILE_SIZE;
    },
    get fringeHeight() {
      return manifest?.fringeHeight ?? 128;
    },
    register(materialId, texture) {
      if (!TERRAIN_MATERIAL_IDS.includes(materialId)) throw new TypeError(`unknown terrain material: ${String(materialId)}`);
      if (!texture?.source) throw new TypeError('terrain tile texture source is required');
      // Repeat addressing is what makes one tile cover a whole district. Set
      // it on the style and force an update: assigning only the source
      // convenience property left the sampler clamping, which stretched edge
      // pixels into long streaks instead of tiling.
      const source = texture.source;
      if (source.style) {
        source.style.addressMode = 'repeat';
        source.style.addressModeU = 'repeat';
        source.style.addressModeV = 'repeat';
        source.style.update?.();
      }
      source.addressMode = 'repeat';
      source.update?.();
      textures.set(materialId, texture);
      failed.delete(materialId);
      return texture;
    },
    registerFringe(materialId, texture) {
      if (!TERRAIN_MATERIAL_IDS.includes(materialId)) throw new TypeError(`unknown terrain material: ${String(materialId)}`);
      if (!texture?.source) throw new TypeError('terrain fringe texture source is required');
      // Repeats along the boundary (U) only; V clamps so the alpha falloff is
      // stretched across the fringe depth rather than repeated.
      const source = texture.source;
      if (source.style) {
        source.style.addressMode = 'repeat';
        source.style.addressModeU = 'repeat';
        source.style.addressModeV = 'clamp-to-edge';
        source.style.update?.();
      }
      source.update?.();
      fringeTextures.set(materialId, texture);
      return texture;
    },
    fringeTextureFor(materialId) {
      return fringeTextures.get(materialId) ?? null;
    },
    markFailed(materialId) {
      failed.add(materialId);
    },
    textureFor(materialId) {
      return textures.get(materialId) ?? null;
    },
    /**
     * Build or update a tiling sprite covering a screen-space rectangle.
     *
     * Pixi batches `Graphics.fill({texture})`, and batched samplers cannot use
     * repeat addressing -- the tile clamped and stretched its edge pixels into
     * streaks. TilingSprite has its own shader that wraps correctly, so it is
     * the only reliable way to tile a surface here.
     */
    createSprite(materialId, { width, height }) {
      const texture = textures.get(materialId);
      if (!texture || typeof TilingSpriteClass !== 'function') return null;
      const sprite = new TilingSpriteClass({ texture, width: Math.max(1, width), height: Math.max(1, height) });
      sprite.label = `terrain-${materialId}`;
      return sprite;
    },
  };
}
