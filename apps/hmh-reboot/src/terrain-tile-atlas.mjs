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

export const TERRAIN_TILE_PIPELINE_ID = 'hmh-terrain-tiles-v3';
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

// Authored edge strips. These are not runtime materials: they carry no district
// or surface semantics, they repeat along U only, and they live in their own
// manifest array so the per-material size and count contracts stay exact.
export const TERRAIN_OVERLAY_IDS = Object.freeze(['road-shoulder', 'shore-band', 'scree-skirt']);

export function terrainOverlayAsset(overlayId) {
  if (!TERRAIN_OVERLAY_IDS.includes(overlayId)) throw new TypeError(`unknown terrain overlay: ${String(overlayId)}`);
  return Object.freeze({
    overlayId,
    imageUrl: `${TILE_ROOT}/${overlayId}.png`,
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
  const overlayIds = new Set((manifest.overlays ?? []).map((entry) => entry.id));
  for (const required of TERRAIN_OVERLAY_IDS) {
    if (!overlayIds.has(required)) throw new TypeError(`terrain manifest is missing ${required}`);
  }
  return Object.freeze({
    tileSize: manifest.tileSize ?? TERRAIN_TILE_SIZE,
    fringeHeight: manifest.fringeHeight ?? 128,
    overlayHeight: manifest.overlayHeight ?? 128,
    materialIds: Object.freeze([...ids].sort()),
    overlayIds: Object.freeze([...overlayIds].sort()),
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
  const overlayTextures = new Map();
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
    get overlayHeight() {
      return manifest?.overlayHeight ?? 128;
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
      // Mipmaps: one 512 tile is drawn far smaller than 512 screen px, so the
      // GPU point-samples one texel out of every few and the baked detail
      // collapses into salt-and-pepper aliasing that reads as a repeating
      // grid. Prefiltered levels turn that back into a smooth surface.
      source.autoGenerateMipmaps = true;
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
      source.autoGenerateMipmaps = true;
      source.update?.();
      fringeTextures.set(materialId, texture);
      return texture;
    },
    fringeTextureFor(materialId) {
      return fringeTextures.get(materialId) ?? null;
    },
    registerOverlay(overlayId, texture) {
      if (!TERRAIN_OVERLAY_IDS.includes(overlayId)) throw new TypeError(`unknown terrain overlay: ${String(overlayId)}`);
      if (!texture?.source) throw new TypeError('terrain overlay texture source is required');
      // A strip repeats along its edge (U) and clamps across its depth (V), so
      // the opaque inner edge always faces the surface it borders.
      const source = texture.source;
      if (source.style) {
        source.style.addressMode = 'repeat';
        source.style.addressModeU = 'repeat';
        source.style.addressModeV = 'clamp-to-edge';
        source.style.update?.();
      }
      source.autoGenerateMipmaps = true;
      source.update?.();
      overlayTextures.set(overlayId, texture);
      return texture;
    },
    overlayTextureFor(overlayId) {
      return overlayTextures.get(overlayId) ?? null;
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
