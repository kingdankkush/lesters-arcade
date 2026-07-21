export const TERRAIN_PRESENTATION_OVERLAY_ORDER = Object.freeze([
  'terrain-shadow',
  'water-flow',
  'shoreline-foam',
  'bridge-contact-shadow',
  'bridge-deck-light',
  'elevation-rim-light',
  'road-dust',
]);

const ORDER_INDEX = new Map(TERRAIN_PRESENTATION_OVERLAY_ORDER.map((id, index) => [id, index]));

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function roleKind(cell = {}) {
  if (cell.isBridge || cell.terrainRole === 'bridge') return 'bridge';
  if (cell.isWater || cell.terrainRole === 'water') return 'water';
  return cell.terrainRole ?? cell.role ?? 'dirt';
}

function elevationPxForBand(band) {
  if (band === 'low') return 5;
  if (band === 'high') return -7;
  return 0;
}

function overlay(id, fields = {}) {
  return Object.freeze({
    id,
    alpha: clamp01(fields.alpha ?? 0),
    color: fields.color ?? 'rgba(255,255,255,1)',
    motionPhase: Number.isFinite(Number(fields.motionPhase)) ? Number(fields.motionPhase) : 0,
    blurPx: Math.max(0, Number(fields.blurPx) || 0),
    offsetPx: Object.freeze({
      x: Number(fields.offsetPx?.x) || 0,
      y: Number(fields.offsetPx?.y) || 0,
    }),
    blendMode: fields.blendMode ?? 'source-over',
  });
}

function hasVfx(cell, id) {
  return Array.isArray(cell?.vfx) && cell.vfx.includes(id);
}

export function buildTerrainEdgeBlendsForCell(cell = {}) {
  const cardinal = cell?.adjacency?.cardinal ?? {};
  const currentTextureKey = cell?.textureKey ?? null;
  const currentRole = roleKind(cell);
  if (!currentTextureKey || currentRole === 'bridge') return Object.freeze([]);
  const blends = [];
  for (const direction of ['north', 'east', 'south', 'west']) {
    const neighbor = cardinal[direction];
    if (!neighbor?.textureKey || neighbor.textureKey === currentTextureKey || neighbor.terrainRole === 'bridge') continue;
    const shoreline = currentRole === 'water' || neighbor.terrainRole === 'water' || currentRole === 'shore' || neighbor.terrainRole === 'shore';
    const hardElevation = currentRole === 'rocky' || neighbor.terrainRole === 'rocky';
    blends.push(Object.freeze({
      direction,
      textureKey: neighbor.textureKey,
      alpha: shoreline ? 0.34 : hardElevation ? 0.18 : 0.26,
      inset: shoreline ? 0.34 : 0.27,
      blendMode: shoreline ? 'source-over' : 'soft-light',
    }));
  }
  return Object.freeze(blends);
}

export function buildTerrainPresentationForCell(cell = {}, { frame = 0, overlayMode = 'full' } = {}) {
  const kind = roleKind(cell);
  const elevationBand = cell?.elevation?.band ?? 'mid';
  const frameNum = Number(frame) || 0;
  const motionPhase = (Math.sin(frameNum * 0.06 + (Number(cell.x) || 0) * 0.31 + (Number(cell.y) || 0) * 0.17) + 1) / 2;
  const overlays = [];

  if (elevationBand === 'high' || hasVfx(cell, 'terrain-cast-shadow')) {
    overlays.push(overlay('terrain-shadow', {
      alpha: elevationBand === 'high' ? 0.24 : 0.16,
      color: 'rgba(7,5,4,1)',
      blurPx: 3,
      offsetPx: { x: 4, y: 8 },
    }));
  }
  if (kind === 'water' || hasVfx(cell, 'water-shimmer')) {
    overlays.push(overlay('water-flow', {
      alpha: 0.07 + motionPhase * 0.045,
      color: 'rgba(95,226,255,1)',
      motionPhase,
      blendMode: 'screen',
    }));
  }
  if (hasVfx(cell, 'shoreline-foam')) {
    overlays.push(overlay('shoreline-foam', {
      alpha: 0.12 + motionPhase * 0.08,
      color: 'rgba(230,252,255,1)',
      motionPhase,
      blendMode: 'screen',
    }));
  }
  if (kind === 'bridge' || hasVfx(cell, 'bridge-shadow')) {
    overlays.push(overlay('bridge-contact-shadow', {
      alpha: 0.28,
      color: 'rgba(8,5,3,1)',
      blurPx: 2,
      offsetPx: { x: 0, y: 9 },
    }));
    overlays.push(overlay('bridge-deck-light', {
      alpha: 0.18,
      color: 'rgba(172,118,58,1)',
      blendMode: 'multiply',
    }));
  }
  if (elevationBand === 'high') {
    overlays.push(overlay('elevation-rim-light', {
      alpha: 0.16,
      color: 'rgba(255,214,118,1)',
      offsetPx: { x: -2, y: -4 },
      blendMode: 'screen',
    }));
  }
  if (kind === 'road' || hasVfx(cell, 'road-dust')) {
    overlays.push(overlay('road-dust', {
      alpha: 0.055 + motionPhase * 0.02,
      color: 'rgba(218,169,94,1)',
      motionPhase,
      blendMode: 'screen',
    }));
  }

  if (overlayMode === 'texture-only') overlays.length = 0;
  overlays.sort((a, b) => (ORDER_INDEX.get(a.id) ?? 999) - (ORDER_INDEX.get(b.id) ?? 999));
  return Object.freeze({
    kind,
    elevationBand,
    elevationPx: elevationPxForBand(elevationBand),
    overlays: Object.freeze(overlays),
  });
}

export function summarizeTerrainPresentation(cells = [], options = {}) {
  const presentations = cells.map((cell) => buildTerrainPresentationForCell(cell, options));
  const overlayIds = [...new Set(presentations.flatMap((entry) => entry.overlays.map((overlayEntry) => overlayEntry.id)))].sort(
    (a, b) => (ORDER_INDEX.get(a) ?? 999) - (ORDER_INDEX.get(b) ?? 999),
  );
  return Object.freeze({
    cellCount: cells.length,
    overlayIds: Object.freeze(overlayIds),
    hasWaterFlow: overlayIds.includes('water-flow'),
    hasBridgeLighting: overlayIds.includes('bridge-contact-shadow') && overlayIds.includes('bridge-deck-light'),
    hasElevationLighting: overlayIds.includes('elevation-rim-light'),
    hasCastShadows: overlayIds.includes('terrain-shadow') || overlayIds.includes('bridge-contact-shadow'),
  });
}


const DESERT_APPROACH_MATERIAL_SRC = './assets/generated/hmh-level-one-world-v3/materials/desert-approach-wang-v2-3-materials.png';
const DESERT_APPROACH_MASK_SRC = './assets/generated/hmh-level-one-world-v3/materials/desert-approach-wang-v2-3-masks.png';
const DESERT_APPROACH_ROLES = Object.freeze(['sand', 'dirt', 'rocky', 'road']);
const DESERT_APPROACH_ROLE_ROWS = Object.freeze({ sand: 0, dirt: 1, rocky: 2, road: 3 });
const DESERT_APPROACH_EDGE_LABELS = Object.freeze({ 1: 'NW', 2: 'NE', 4: 'SE', 8: 'SW' });

function desertApproachMaterials() {
  return Object.freeze(DESERT_APPROACH_ROLES.flatMap((role) => Array.from({ length: 4 }, (_, variantIndex) => Object.freeze({
    key: `desert-wang-v2-3/${role}-${variantIndex + 1}`,
    role,
    variantIndex,
    src: DESERT_APPROACH_MATERIAL_SRC,
    width: 128,
    height: 64,
    atlasRect: Object.freeze({ x: variantIndex * 128, y: DESERT_APPROACH_ROLE_ROWS[role] * 64, width: 128, height: 64 }),
    opaque: true,
    fullyOpaque: true,
    colors: role === 'rocky' ? 8 : 9,
    brightAccentPixels: role === 'rocky' ? 2 : 0,
    oppositeEdgesExact: true,
    formerDiamondEdgeContrast: role === 'sand' ? 1.822 : 1.6,
    sampling: 'nearest-neighbor',
  }))));
}

function desertApproachMasks() {
  return Object.freeze(Array.from({ length: 4 }, (_, phase) => Array.from({ length: 16 }, (_, edgeBits) => {
    const atlasIndex = phase * 16 + edgeBits;
    return Object.freeze({
      key: `desert-wang-v2-3/mask-p${phase}-m${edgeBits}`,
      phase,
      bits: edgeBits,
      edgeBits,
      edges: Object.freeze([1, 2, 4, 8].filter((bit) => (edgeBits & bit) !== 0).map((bit) => DESERT_APPROACH_EDGE_LABELS[bit])),
      src: DESERT_APPROACH_MASK_SRC,
      width: 128,
      height: 64,
      atlasRect: Object.freeze({ x: (atlasIndex % 8) * 128, y: Math.floor(atlasIndex / 8) * 64, width: 128, height: 64 }),
      binary: true,
      sampling: 'nearest-neighbor',
    });
  })).flat());
}

const DESERT_APPROACH_MATERIALS = desertApproachMaterials();
const DESERT_APPROACH_MASKS = desertApproachMasks();

export const HMH_DESERT_APPROACH_WANG_RUNTIME = Object.freeze({
  id: 'hmh-desert-approach-terrain-wang-v2-3-runtime',
  status: 'runtime-ready-seam-certified',
  projection: '2:1 isometric',
  tileSourceSize: Object.freeze([128, 64]),
  logicalFootprint: Object.freeze([64, 32]),
  wangBits: Object.freeze({ NW: 1, NE: 2, SE: 4, SW: 8 }),
  worldNeighborToIsoBit: Object.freeze({ north: 2, east: 4, south: 8, west: 1 }),
  worldNeighborToDiamondEdge: Object.freeze({ north: 'NE', east: 'SE', south: 'SW', west: 'NW' }),
  materials: DESERT_APPROACH_MATERIALS,
  masks: DESERT_APPROACH_MASKS,
  materialAtlas: Object.freeze({
    src: DESERT_APPROACH_MATERIAL_SRC,
    width: 512,
    height: 256,
    decodedBytes: 512 * 256 * 4,
    sampling: 'nearest-neighbor',
    roles: DESERT_APPROACH_ROLES,
    variantsPerRole: 4,
    latticeConstruction: 'de-edged-periodic-field-v2',
    sharedMacroFieldAcrossVariants: true,
    materials: DESERT_APPROACH_MATERIALS,
  }),
  maskAtlas: Object.freeze({
    src: DESERT_APPROACH_MASK_SRC,
    width: 1024,
    height: 512,
    decodedBytes: 1024 * 512,
    sampling: 'nearest-neighbor',
    phases: 4,
    masksPerPhase: 16,
    binary: true,
    masks: DESERT_APPROACH_MASKS,
  }),
  performance: Object.freeze({
    atlasCount: 2,
    maxDrawLayersPerCell: 2,
    maxTerrainLayersPerCell: 2,
    runtimeAtlasCount: 2,
    materialAtlasDecodedBytes: 512 * 256 * 4,
    maskAtlasDecodedBytes: 1024 * 512,
    totalDecodedBytes: 1024 * 1024,
  }),
  seamCertification: Object.freeze({
    materialsFullyOpaque: true,
    oppositeEdgesExact: true,
    maxFormerDiamondEdgeContrast: 1.822,
  }),
  sourcePolicy: 'Approved Desert Approach Wang v2.3 palette contract; repo-owned deterministic runtime fields and binary masks.',
});

const ROLE_PRIORITY = Object.freeze({ sand: 0, dirt: 1, rocky: 2, road: 3 });
const ROLE_SALT = Object.freeze({ sand: 101, dirt: 211, rocky: 307, road: 401 });
const ROUTE_CODES = new Set(['M', 'N', 'S']);
const DESERT_DIRT_BIOME_CODES = new Set(['A', 'C', 'D']);
const WORLD_DIRECTION_TO_ISO_BIT = Object.freeze({ north: 2, east: 4, south: 8, west: 1 });
const PHASE_PATTERN = Object.freeze([
  Object.freeze([0, 2, 1, 3]),
  Object.freeze([3, 1, 2, 0]),
  Object.freeze([1, 3, 0, 2]),
  Object.freeze([2, 0, 3, 1]),
]);

const MATERIAL_BY_ROLE_VARIANT = new Map(
  HMH_DESERT_APPROACH_WANG_RUNTIME.materials.map((asset) => [`${asset.role}|${asset.variantIndex}`, asset]),
);
const MASK_BY_PHASE_BITS = new Map(
  HMH_DESERT_APPROACH_WANG_RUNTIME.masks.map((mask) => [`${mask.phase}|${mask.bits}`, mask]),
);

function positiveModulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function stableIndex(seed, x, y, salt, count) {
  let h = (Math.round(x) * 374761393) ^ (Math.round(y) * 668265263) ^ ((Number(seed) || 0) | 0) ^ salt;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return positiveModulo(h, count);
}

function variantIndexFor(role, seed) {
  return stableIndex(seed, 0, 0, ROLE_SALT[role] ?? 0, 4);
}

function phaseFor(worldX, worldY) {
  const row = positiveModulo(Math.floor(Number(worldY) || 0), 4);
  const col = positiveModulo(Math.floor(Number(worldX) || 0), 4);
  return PHASE_PATTERN[row][col];
}

function materialFor(role, variantIndex) {
  return MATERIAL_BY_ROLE_VARIANT.get(`${role}|${variantIndex}`) ?? null;
}

function maskFor(phase, bits) {
  return MASK_BY_PHASE_BITS.get(`${phase}|${bits}`) ?? null;
}

function compactAtlasAsset(asset, fields = {}) {
  return Object.freeze({
    key: fields.key ?? asset.key,
    role: fields.role ?? asset.role,
    variantIndex: fields.variantIndex ?? asset.variantIndex,
    src: asset.src,
    width: asset.width,
    height: asset.height,
    atlasRect: asset.atlasRect,
    sampling: asset.sampling,
    source: 'hmh-desert-approach-terrain-wang-v2-3-runtime',
    ...fields,
  });
}

export function desertApproachRuntimeAtlasAssets() {
  const manifest = HMH_DESERT_APPROACH_WANG_RUNTIME;
  return Object.freeze([
    Object.freeze({
      key: 'desert-wang-v2-3/runtime-material-atlas',
      src: manifest.materialAtlas.src,
      width: manifest.materialAtlas.width,
      height: manifest.materialAtlas.height,
      decodedBytes: manifest.materialAtlas.decodedBytes,
      sampling: manifest.materialAtlas.sampling,
    }),
    Object.freeze({
      key: 'desert-wang-v2-3/runtime-mask-atlas',
      src: manifest.maskAtlas.src,
      width: manifest.maskAtlas.width,
      height: manifest.maskAtlas.height,
      decodedBytes: manifest.maskAtlas.decodedBytes,
      sampling: manifest.maskAtlas.sampling,
    }),
  ]);
}

export function desertApproachRuntimeRoleForCell(cell) {
  if (cell?.terrain === 'S') return 'sand';
  if (cell?.terrain === 'R') return 'rocky';
  if (cell?.terrain !== 'D') return null;
  if (!DESERT_DIRT_BIOME_CODES.has(cell.biome)) return null;
  return cell.biome === 'D' && ROUTE_CODES.has(String(cell.route ?? '.')) ? 'road' : 'dirt';
}

export function desertApproachRuntimeGroundAssetForCell(cell = {}, { seed = 0 } = {}) {
  const role = desertApproachRuntimeRoleForCell(cell);
  if (!role) return null;

  const worldX = Math.round(Number(cell.x ?? cell.worldX) || 0);
  const worldY = Math.round(Number(cell.y ?? cell.worldY) || 0);
  const variantIndex = variantIndexFor(role, seed);
  const baseMaterial = materialFor(role, variantIndex);
  if (!baseMaterial) return null;

  const cardinal = cell.adjacency?.cardinal ?? {};
  const neighborRoles = Object.freeze(Object.fromEntries(
    Object.keys(WORLD_DIRECTION_TO_ISO_BIT).map((direction) => [
      direction,
      desertApproachRuntimeRoleForCell(cardinal[direction] ?? {}),
    ]),
  ));
  const higherRoles = [...new Set(Object.values(neighborRoles).filter(
    (neighborRole) => neighborRole && ROLE_PRIORITY[neighborRole] > ROLE_PRIORITY[role],
  ))].sort((a, b) => ROLE_PRIORITY[b] - ROLE_PRIORITY[a]);
  const overlayRole = higherRoles[0] ?? null;

  if (!overlayRole) {
    return compactAtlasAsset(baseMaterial, {
      key: `${baseMaterial.key}/patch-${variantIndex}`,
      handledDirections: Object.freeze([]),
      renderLayers: 1,
    });
  }

  let edgeBits = 0;
  const overlayDirections = [];
  for (const [direction, neighborRole] of Object.entries(neighborRoles)) {
    if (neighborRole !== overlayRole) continue;
    edgeBits |= WORLD_DIRECTION_TO_ISO_BIT[direction];
    overlayDirections.push(direction);
  }
  const phase = phaseFor(worldX, worldY);
  const overlayVariantIndex = variantIndexFor(overlayRole, seed);
  const overlayMaterial = materialFor(overlayRole, overlayVariantIndex);
  const mask = maskFor(phase, edgeBits);
  if (!overlayMaterial || !mask || edgeBits === 0) {
    return compactAtlasAsset(baseMaterial, {
      key: `${baseMaterial.key}/patch-${variantIndex}`,
      handledDirections: Object.freeze([]),
      renderLayers: 1,
    });
  }

  const wangComposite = Object.freeze({
    overlayRole,
    overlayVariantIndex,
    overlayRect: overlayMaterial.atlasRect,
    maskSrc: mask.src,
    maskRect: mask.atlasRect,
    phase,
    edgeBits,
    handledDirections: Object.freeze(overlayDirections),
  });
  return compactAtlasAsset(baseMaterial, {
    key: `${baseMaterial.key}/over-${overlayRole}-${overlayVariantIndex}/p${phase}-m${edgeBits}`,
    handledDirections: wangComposite.handledDirections,
    renderLayers: 2,
    wangComposite,
  });
}
