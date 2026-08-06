import { freezeDeep } from './value-guards.mjs';
import { isScreenPointVisible } from './runtime-performance.mjs';
import {
  DISTRICT_TERRAIN_MATERIAL,
  SURFACE_TERRAIN_MATERIAL,
} from './terrain-tile-atlas.mjs';


function artKit(spec) {
  return freezeDeep({ classification: 'production-art', runtimeAuthority: 'projection-only', ...spec });
}

export const DISTRICT_PRODUCTION_MATERIALS = freezeDeep({
  'frontier-relay': artKit({ groundColor: 0x153c35, detailColor: 0x42c89c, routeColor: 0xa68d61, motif: 'relay-circuit', materialLayers: ['packed-earth', 'relay-traces', 'signal-pads'] }),
  'rugpull-ravine': artKit({ groundColor: 0x4a2b28, detailColor: 0xd97852, routeColor: 0xb88962, motif: 'forked-strata', materialLayers: ['red-rock', 'fracture-lines', 'salvage-scrap'] }),
  'liquidity-crossing': artKit({ groundColor: 0x103a4b, detailColor: 0x31c8e8, routeColor: 0xc0a06c, motif: 'liquidity-ripples', materialLayers: ['wet-bank', 'flow-lines', 'bridge-seams'] }),
  hashwood: artKit({ groundColor: 0x163d2a, detailColor: 0x62c878, routeColor: 0x8f8558, motif: 'hash-ring-roots', materialLayers: ['forest-floor', 'root-rings', 'spore-patches'] }),
  'mining-camp': artKit({ groundColor: 0x343638, detailColor: 0xf0ae4c, routeColor: 0xa68d67, motif: 'ore-grid', materialLayers: ['crushed-ore', 'loader-tracks', 'warning-marks'] }),
  'liquidation-yard': artKit({ groundColor: 0x3e1c31, detailColor: 0xff527e, routeColor: 0xb18b68, motif: 'margin-grid', materialLayers: ['industrial-slab', 'liquidation-grid', 'warning-chevrons'] }),
});

export const BLOCKER_PRODUCTION_KITS = freezeDeep({
  fence: artKit({ baseColor: 0x4b5f68, accentColor: 0xbde9ea, identityCues: ['alternating steel posts', 'cyan live-wire rail'] }),
  cliff: artKit({ baseColor: 0x5d3428, accentColor: 0xd98656, identityCues: ['layered red-rock wall', 'bright fracture caps'] }),
  'bridge-rail': artKit({ baseColor: 0x3e5660, accentColor: 0xa9f4ff, identityCues: ['double proof rail', 'cyan rivet nodes'] }),
  'dense-trees': artKit({ baseColor: 0x173c27, accentColor: 0x60d683, identityCues: ['overlapping dark canopies', 'hash-ring highlights'] }),
  machinery: artKit({ baseColor: 0x34373d, accentColor: 0xf5ad46, identityCues: ['heavy loader silhouette', 'amber hazard plates'] }),
  building: artKit({ baseColor: 0x342b38, accentColor: 0xf05b86, identityCues: ['dark industrial roof', 'magenta liquidation trim'] }),
  containers: artKit({ baseColor: 0x543548, accentColor: 0xff6a88, identityCues: ['stacked freight ribs', 'alternating warning doors'] }),
});

export const LANDMARK_PRODUCTION_KITS = freezeDeep({
  'signal-tower': artKit({ baseColor: 0x284d50, accentColor: 0x5cffe2, identityCues: ['forked relay mast', 'three broadcast rings', 'cyan signal lamp'] }),
  'forked-cliff': artKit({ baseColor: 0x67382c, accentColor: 0xffa05c, identityCues: ['split rock crown', 'orange strata bands', 'salvage pennant'] }),
  bridge: artKit({ baseColor: 0x4b5660, accentColor: 0x8feaff, identityCues: ['proof truss', 'lit rivet chain', 'raised deck'] }),
  'beacon-tree': artKit({ baseColor: 0x244b2e, accentColor: 0x7dff8c, identityCues: ['ancient hash-ring canopy', 'luminous trunk rune', 'green beacon halo'] }),
  headframe: artKit({ baseColor: 0x3e4146, accentColor: 0xffbd52, identityCues: ['tall mining gantry', 'ore pulley wheel', 'amber work lamp'] }),
  'extraction-tower': artKit({ baseColor: 0x41293c, accentColor: 0xff5d8f, identityCues: ['liquidation spire', 'margin-call antenna', 'magenta extraction beam'] }),
});

export const INTERACTION_PRODUCTION_KITS = freezeDeep({
  reward: artKit({ color: 0x63f29a, icon: 'cache-diamond' }),
  weapon: artKit({ color: 0x70c9ff, icon: 'armory-cross' }),
  'hazard-reward': artKit({ color: 0xffb34d, icon: 'fuel-cache' }),
  upgrade: artKit({ color: 0xc18cff, icon: 'upgrade-chevron' }),
  objective: artKit({ color: 0xff6e9b, icon: 'objective-terminal' }),
  rockfall: artKit({ color: 0xff875f, icon: 'falling-rock' }),
  'deep-water': artKit({ color: 0x37c9f1, icon: 'current-wave' }),
  'area-slow': artKit({ color: 0x7ee58a, icon: 'spore-ring' }),
  'moving-hazard': artKit({ color: 0xffb23e, icon: 'conveyor-arrows' }),
  'damage-zone': artKit({ color: 0xff416f, icon: 'liquidation-grid' }),
});

export const WORLD_PRODUCTION_ART = artKit({
  id: 'production-vector-world-v1',
  // `vignette` is normal-blended and sits above the additive lighting pass so
  // an edge darkening actually darkens.
  // Ground motifs sit below routes while tangible detail props stay above
  // surfaces. Keeping those concerns separate prevents decorative strokes from
  // crossing roads without burying destructibles or explosive-zone props.
  layers: Object.freeze(['terrain', 'groundDetails', 'routes', 'surfaces', 'details', 'blockers', 'townBlockers', 'landmarks', 'interactions', 'particles', 'lighting', 'vignette']),
  shaderIds: Object.freeze(['water-shimmer-v1', 'hazard-pulse-v1', 'beacon-glow-v1', 'edge-vignette-v1']),
});

const SURFACE_BASE_PALETTE = Object.freeze({
  water: 0x126d91,
  'shallow-water': 0x20a3b8,
  bridge: 0x856e51,
});

export function resolveWorldSurfaceBase({ kind, districtId } = {}) {
  if (typeof kind !== 'string' || kind.length === 0) throw new TypeError('surface kind must be a non-empty string');
  const kit = DISTRICT_PRODUCTION_MATERIALS[districtId];
  if (!kit) throw new RangeError(`unknown districtId: ${districtId}`);
  const isWater = kind.includes('water');
  const isRaised = kind === 'ledge' || kind === 'bridge';
  const districtSurface = kind === 'ledge'
    ? mixColor(kit.groundColor, kit.detailColor, 0.24)
    : mixColor(kit.groundColor, kit.detailColor, 0.16);
  return freezeDeep({
    color: SURFACE_BASE_PALETTE[kind] ?? districtSurface,
    // Water is the visual occlusion authority over routes beneath it. Shimmer,
    // caustics, and depth bands add translucency above this opaque base.
    alpha: 1,
    strokeColor: isWater ? 0x84e8ff : mixColor(kit.detailColor, 0x000000, 0.45),
    isWater,
    isRaised,
  });
}

function finiteNumber(value, name) {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return value;
}

function nonNegativeInteger(value, name) {
  if (!Number.isInteger(value) || value < 0) throw new TypeError(`${name} must be a non-negative integer`);
  return value;
}

function fnv1a(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function resolveWorldShaderState({ tick, districtId }) {
  const simulationTick = nonNegativeInteger(tick, 'tick');
  if (!DISTRICT_PRODUCTION_MATERIALS[districtId]) throw new RangeError(`unknown districtId: ${districtId}`);
  const offset = (fnv1a(districtId) % 360) * Math.PI / 180;
  const wave = (period) => (Math.sin(simulationTick / period * Math.PI * 2 + offset) + 1) / 2;
  return freezeDeep({
    districtId,
    tick: simulationTick,
    waterShimmer: Number(wave(90).toFixed(6)),
    hazardPulse: Number(wave(42).toFixed(6)),
    beaconGlow: Number(wave(120).toFixed(6)),
    scanlineOffset: simulationTick % 48,
  });
}

export function resolveWorldParticleField({ id, x, y, tick, count, radius }) {
  if (typeof id !== 'string' || id.length === 0) throw new TypeError('id must be a non-empty string');
  finiteNumber(x, 'x');
  finiteNumber(y, 'y');
  nonNegativeInteger(tick, 'tick');
  nonNegativeInteger(count, 'count');
  if (count > 64) throw new RangeError('count must be at most 64');
  if (!Number.isFinite(radius) || radius <= 0) throw new TypeError('radius must be positive');
  const seed = fnv1a(id);
  return Object.freeze(Array.from({ length: count }, (_, index) => {
    const angle = ((seed % 6283) / 1000) + index * 2.399963 + tick * (0.002 + (index % 3) * 0.0005);
    const distance = radius * (0.22 + ((Math.imul(seed ^ index, 2654435761) >>> 8) % 760) / 1000);
    const lift = Math.sin((tick + index * 17) / 18) * radius * 0.14;
    return Object.freeze({
      x: Number((x + Math.cos(angle) * distance).toFixed(4)),
      y: Number((y + Math.sin(angle) * distance + lift).toFixed(4)),
      alpha: Number((0.28 + ((seed + index * 31 + tick) % 60) / 100).toFixed(4)),
      size: Number((1.5 + ((seed >>> (index % 16)) & 3) * 0.75).toFixed(3)),
    });
  }));
}

// Visible world-space window for a camera, padded by one tile. Every material
// pass iterates only these cells, so cost tracks screen area rather than the
// 12,000 x 4,800 world.
function visibleTileRange({ area, camera, view, cell }) {
  const halfWidth = view.width / (2 * camera.zoom);
  const halfHeight = view.height / (2 * camera.zoom);
  return {
    startCol: Math.floor(Math.max(area.minX, camera.x - halfWidth - cell) / cell),
    endCol: Math.ceil(Math.min(area.maxX, camera.x + halfWidth + cell) / cell),
    startRow: Math.floor(Math.max(area.minY, camera.y - halfHeight - cell) / cell),
    endRow: Math.ceil(Math.min(area.maxY, camera.y + halfHeight + cell) / cell),
  };
}

function insideArea(area, x, y) {
  return x >= area.minX && x <= area.maxX && y >= area.minY && y <= area.maxY;
}

// Per-district ground motifs. Each district names its material layers in
// DISTRICT_PRODUCTION_MATERIALS (packed-earth / relay-traces / signal-pads and
// so on); these draw them so a district reads as a place rather than a colour
// field. All marks are seeded from world cell indices, so the pattern is
// deterministic, world-locked, and identical on replay.
const DISTRICT_MOTIF_RENDERERS = Object.freeze({
  // Orthogonal circuit traces with solder nodes.
  'frontier-relay': ({ details, x, y, seed, zoom, color, span }) => {
    const run = span * (0.5 + ((seed >>> 4) & 7) / 16);
    const horizontal = ((seed >>> 9) & 1) === 0;
    const endX = horizontal ? x + run : x;
    const endY = horizontal ? y : y + run;
    details.moveTo(x, y).lineTo(endX, endY).stroke({ color, width: Math.max(1, 1.6 * zoom), alpha: 0.16 });
    details.circle(endX, endY, Math.max(1.2, 2.4 * zoom)).fill({ color, alpha: 0.22 });
    if (((seed >>> 11) & 3) === 0) {
      details.moveTo(endX, endY).lineTo(endX + (horizontal ? 0 : run * 0.4), endY + (horizontal ? run * 0.4 : 0))
        .stroke({ color, width: Math.max(1, 1.2 * zoom), alpha: 0.12 });
    }
  },
  // Angular fracture strata.
  'rugpull-ravine': ({ details, x, y, seed, zoom, color, span }) => {
    const length = span * (0.55 + ((seed >>> 5) & 7) / 14);
    const lean = (((seed >>> 8) & 15) / 15 - 0.5) * 0.8;
    const midX = x + length * 0.45 + lean * span * 0.2;
    details.moveTo(x, y)
      .lineTo(midX, y + length * 0.42)
      .lineTo(x + length * lean * 0.6, y + length)
      .stroke({ color, width: Math.max(1, 2 * zoom), alpha: 0.15 });
  },
  // Flow ripples running with the crossing.
  'liquidity-crossing': ({ details, x, y, seed, zoom, color, span }) => {
    const width = span * (0.6 + ((seed >>> 6) & 7) / 16);
    for (let ripple = 0; ripple < 2; ripple += 1) {
      const offsetY = y + ripple * span * 0.18;
      details.moveTo(x, offsetY)
        .bezierCurveTo(x + width * 0.3, offsetY - span * 0.07, x + width * 0.7, offsetY + span * 0.07, x + width, offsetY)
        .stroke({ color, width: Math.max(1, 1.5 * zoom), alpha: 0.13 - ripple * 0.03 });
    }
  },
  // Concentric root rings.
  hashwood: ({ details, x, y, seed, zoom, color, span }) => {
    const rings = 2 + ((seed >>> 7) & 1);
    for (let ring = 0; ring < rings; ring += 1) {
      const radius = span * (0.12 + ring * 0.1);
      details.circle(x, y, radius * zoom)
        .stroke({ color, width: Math.max(1, 1.4 * zoom), alpha: 0.14 - ring * 0.035 });
    }
  },
  // Ore grid with occasional hazard chevrons.
  'mining-camp': ({ details, x, y, seed, zoom, color, span }) => {
    const size = span * (0.3 + ((seed >>> 6) & 3) / 12);
    details.rect(x, y, size, size * 0.62).stroke({ color, width: Math.max(1, 1.4 * zoom), alpha: 0.14 });
    if (((seed >>> 12) & 3) === 0) {
      for (let chevron = 0; chevron < 3; chevron += 1) {
        const chevronY = y + size * 0.18 * chevron;
        details.moveTo(x, chevronY).lineTo(x + size * 0.22, chevronY + size * 0.16).lineTo(x + size * 0.44, chevronY)
          .stroke({ color, width: Math.max(1, 1.6 * zoom), alpha: 0.18 });
      }
    }
  },
  // Diagonal margin-call warning banding.
  'liquidation-yard': ({ details, x, y, seed, zoom, color, span }) => {
    const bandLength = span * (0.5 + ((seed >>> 6) & 7) / 14);
    const bands = 2 + ((seed >>> 10) & 1);
    for (let band = 0; band < bands; band += 1) {
      const offset = band * span * 0.14;
      details.moveTo(x + offset, y)
        .lineTo(x + offset - bandLength * 0.5, y + bandLength)
        .stroke({ color, width: Math.max(1, 2.2 * zoom), alpha: 0.13 });
    }
  },
});

export function drawDistrictMaterial({ layers, district, kit, camera, view, project, tick }) {
  const details = layers.groundDetails;
  const zoom = camera.zoom;

  // Pass 1 — macro tonal patches. Large soft blocks of a slightly shifted
  // ground tone so the base plane stops reading as one flat colour.
  const MACRO_CELL = 760;
  const macro = visibleTileRange({ area: district.area, camera, view, cell: MACRO_CELL });
  for (let col = macro.startCol; col <= macro.endCol; col += 1) {
    for (let row = macro.startRow; row <= macro.endRow; row += 1) {
      const seed = fnv1a(`${district.id}:macro:${col}:${row}`);
      const centreX = col * MACRO_CELL + ((seed & 0xff) / 255) * MACRO_CELL;
      const centreY = row * MACRO_CELL + (((seed >>> 8) & 0xff) / 255) * MACRO_CELL;
      if (!insideArea(district.area, centreX, centreY)) continue;
      const screen = project({ x: centreX, y: centreY, z: 0 });
      const radiusWorld = MACRO_CELL * (0.36 + ((seed >>> 16) & 15) / 40);
      const radius = radiusWorld * zoom;
      if (screen.x + radius < 0 || screen.x - radius > view.width) continue;
      if (screen.y + radius < 0 || screen.y - radius > view.height) continue;
      const lighter = ((seed >>> 20) & 1) === 0;
      layers.terrain.circle(screen.x, screen.y, radius)
        .fill({
          color: lighter ? mixColor(kit.groundColor, kit.detailColor, 0.16) : mixColor(kit.groundColor, 0x000000, 0.2),
          alpha: 0.3,
        });
    }
  }

  // Pass 2 — the district motif.
  const MOTIF_CELL = 300;
  const motif = DISTRICT_MOTIF_RENDERERS[district.id];
  if (motif) {
    const range = visibleTileRange({ area: district.area, camera, view, cell: MOTIF_CELL });
    for (let col = range.startCol; col <= range.endCol; col += 1) {
      for (let row = range.startRow; row <= range.endRow; row += 1) {
        const seed = fnv1a(`${district.id}:motif:${col}:${row}`);
        if ((seed & 7) === 0) continue; // leave breathing room
        const worldX = col * MOTIF_CELL + ((seed & 0xff) / 255) * MOTIF_CELL * 0.8;
        const worldY = row * MOTIF_CELL + (((seed >>> 8) & 0xff) / 255) * MOTIF_CELL * 0.8;
        if (!insideArea(district.area, worldX, worldY)) continue;
        const screen = project({ x: worldX, y: worldY, z: 0 });
        const span = MOTIF_CELL * 0.55 * zoom;
        if (screen.x + span < 0 || screen.x - span > view.width) continue;
        if (screen.y + span < 0 || screen.y - span > view.height) continue;
        motif({ details, x: screen.x, y: screen.y, seed, zoom, color: kit.detailColor, span, tick });
      }
    }
  }

  // Pass 3 — micro scatter: fine grain so the surface holds up close in.
  const MICRO_CELL = 150;
  const micro = visibleTileRange({ area: district.area, camera, view, cell: MICRO_CELL });
  const grainWidth = Math.max(1, zoom * 1.4);
  for (let col = micro.startCol; col <= micro.endCol; col += 1) {
    for (let row = micro.startRow; row <= micro.endRow; row += 1) {
      const seed = fnv1a(`${district.id}:micro:${col}:${row}`);
      if ((seed & 1) === 0) continue;
      const worldX = col * MICRO_CELL + ((seed & 0xff) / 255) * MICRO_CELL;
      const worldY = row * MICRO_CELL + (((seed >>> 8) & 0xff) / 255) * MICRO_CELL;
      if (!insideArea(district.area, worldX, worldY)) continue;
      const screen = project({ x: worldX, y: worldY, z: 0 });
      if (screen.x < -MICRO_CELL || screen.x > view.width + MICRO_CELL) continue;
      if (screen.y < -MICRO_CELL || screen.y > view.height + MICRO_CELL) continue;
      const grain = (2 + ((seed >>> 18) & 3)) * zoom;
      if (((seed >>> 21) & 1) === 0) {
        details.circle(screen.x, screen.y, grain * 0.5).fill({ color: kit.detailColor, alpha: 0.075 });
      } else {
        details.moveTo(screen.x, screen.y).lineTo(screen.x + grain, screen.y + grain * 0.5)
          .stroke({ color: kit.detailColor, width: grainWidth, alpha: 0.07 });
      }
    }
  }
}

export function createWorldProductionLayers({ ContainerClass, GraphicsClass, TilingSpriteClass = null }) {
  if (typeof ContainerClass !== 'function' || typeof GraphicsClass !== 'function') throw new TypeError('Pixi classes are required');
  const root = new ContainerClass();
  root.label = WORLD_PRODUCTION_ART.id;
  root.runtimeAuthority = WORLD_PRODUCTION_ART.runtimeAuthority;
  const layers = {};
  for (const name of WORLD_PRODUCTION_ART.layers) {
    const graphic = new GraphicsClass();
    graphic.label = `world-${name}`;
    layers[name] = graphic;
    root.addChild(graphic);
  }
  layers.particles.blendMode = 'add';
  layers.lighting.blendMode = 'add';
  // Tiled terrain sits directly above the flat terrain fill and below every
  // detail pass, so authored materials replace colour without hiding props.
  const terrainSprites = new ContainerClass();
  terrainSprites.label = 'world-terrain-tiles';
  root.addChildAt(terrainSprites, root.getChildIndex(layers.terrain) + 1);
  // District-boundary fringe strips draw above the base tiles and below every
  // detail/route layer, so ground materials stop meeting as hard rectangles.
  const fringeSprites = new ContainerClass();
  fringeSprites.label = 'world-terrain-fringe';
  root.addChildAt(fringeSprites, root.getChildIndex(terrainSprites) + 1);
  // Water, bridge decks and ledges paint an opaque base into `surfaces`, so
  // their material must sit above that layer or the fill hides it.
  const surfaceSprites = new ContainerClass();
  surfaceSprites.label = 'world-surface-tiles';
  root.addChildAt(surfaceSprites, root.getChildIndex(layers.surfaces) + 1);
  // Readability cues must draw ABOVE the opaque surface material or the tile
  // hides them.
  const surfaceCues = new GraphicsClass();
  surfaceCues.label = 'world-surface-cues';
  root.addChildAt(surfaceCues, root.getChildIndex(surfaceSprites) + 1);
  // Roads are stroked polylines, so they tile through a mask rather than a
  // rectangle: one viewport-sized sprite clipped to the road surface.
  const roadSprites = new ContainerClass();
  roadSprites.label = 'world-road-tiles';
  const roadMask = new GraphicsClass();
  roadMask.label = 'world-road-mask';
  roadSprites.addChild(roadMask);
  root.addChildAt(roadSprites, root.getChildIndex(layers.routes) + 1);
  return Object.freeze({ root, layers: Object.freeze(layers), terrainSprites, fringeSprites, surfaceSprites, surfaceCues, roadSprites, roadMask, TilingSpriteClass });
}

export function clearWorldProductionLayers(worldProduction) {
  if (!worldProduction?.layers) throw new TypeError('worldProduction layers are required');
  for (const layer of Object.values(worldProduction.layers)) layer.clear();
  worldProduction.surfaceCues?.clear();
}

function rectVertices(area) {
  return area.type === 'rect'
    ? [{ x: area.minX, y: area.minY }, { x: area.maxX, y: area.minY }, { x: area.maxX, y: area.maxY }, { x: area.minX, y: area.maxY }]
    : area.vertices;
}

function tracePolygon(graphic, points) {
  graphic.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) graphic.lineTo(point.x, point.y);
  return graphic.closePath();
}

function mixColor(from, to, amount) {
  const blend = Math.max(0, Math.min(1, amount));
  const channel = (shift) => Math.round(((from >>> shift) & 0xff) * (1 - blend) + ((to >>> shift) & 0xff) * blend);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

function screenBoundsVisible(points, view, margin) {
  if (points.some((point) => isScreenPointVisible(point, view, margin))) return true;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return Math.max(...xs) >= -margin && Math.min(...xs) <= view.width + margin
    && Math.max(...ys) >= -margin && Math.min(...ys) <= view.height + margin;
}

function drawRoute(layers, points, route, kit, roadMask = null) {
  const zoom = points.zoom;
  const road=layers.routes,cues=layers.details;
  const trace = (layer=road) => {
    layer.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) layer.lineTo(point.x, point.y);
  };
  // Roads used to be a flat slab between two hard black borders. They are now
  // built up in passes: a soft shoulder that fades into the ground, a worn
  // verge, the surface, a lighter centre wear band, and dashed lane marks —
  // so a route reads as a travelled surface rather than a coloured shape.
  trace();
  road.stroke({ color: 0x130f13, width: (route.width + 40) * zoom, alpha: 0.32, cap: 'round', join: 'round' });
  trace();
  road.stroke({ color: 0x130f13, width: (route.width + 22) * zoom, alpha: 0.72, cap: 'round', join: 'round' });
  trace();
  road.stroke({ color: mixColor(kit.routeColor, 0x000000, 0.34), width: (route.width + 8) * zoom, alpha: 0.9, cap: 'round', join: 'round' });
  trace();
  road.stroke({ color: kit.routeColor, width: route.width * zoom, alpha: route.kind === 'main' ? 0.96 : 0.82, cap: 'round', join: 'round' });
  if (roadMask) {
    // Same geometry into the mask, so the tiled surface clips exactly to the
    // travelled width.
    roadMask.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) roadMask.lineTo(point.x, point.y);
    roadMask.stroke({ color: 0xffffff, width: route.width * zoom, cap: 'round', join: 'round' });
  }
  // Centre wear band: lighter where traffic polishes the surface.
  trace(cues);
  cues.stroke({ color: mixColor(kit.routeColor, 0xffffff, 0.16), width: Math.max(2, route.width * 0.42 * zoom), alpha: 0.3, cap: 'round', join: 'round' });

  // Dashed lane marks along each segment, spaced in world units so they stay
  // locked to the road as the camera moves.
  const DASH = 46;
  const GAP = 40;
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    if (length < 1) continue;
    const stepX = dx / length;
    const stepY = dy / length;
    const stride = (DASH + GAP) * zoom;
    const dashLength = DASH * zoom;
    for (let travelled = stride * 0.5; travelled + dashLength < length; travelled += stride) {
      cues.moveTo(from.x + stepX * travelled, from.y + stepY * travelled)
        .lineTo(from.x + stepX * (travelled + dashLength), from.y + stepY * (travelled + dashLength))
        .stroke({ color: kit.detailColor, width: Math.max(1, 2.4 * zoom), alpha: route.kind === 'main' ? 0.32 : 0.18 });
    }
  }
}

function drawBlocker(graphic, feature, kit, camera, worldToScreen) {
  const shape = feature.shape;
  const z = feature.maxZ ? Math.min(feature.maxZ * 0.08, 18) : 0;
  if (shape.type === 'capsule') {
    const a = worldToScreen({ ...shape.a, z }, camera);
    const b = worldToScreen({ ...shape.b, z }, camera);
    const width = Math.max(6, shape.radius * 2 * camera.zoom);
    graphic.moveTo(a.x + 4, a.y + 7).lineTo(b.x + 4, b.y + 7).stroke({ color: 0x05070a, width, alpha: 0.46, cap: 'round' });
    graphic.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color: kit.baseColor, width, alpha: 0.98, cap: 'round' });
    graphic.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color: kit.accentColor, width: Math.max(2, width * 0.12), alpha: 0.82, cap: 'round' });
    const posts = Math.max(2, Math.min(12, Math.floor(Math.hypot(b.x - a.x, b.y - a.y) / 85)));
    for (let index = 0; index <= posts; index += 1) {
      const t = index / posts;
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;
      if (feature.visualKind === 'dense-trees') {
        // Foliage: a grounded trunk shadow, a layered canopy built from three
        // offset lobes, and a lit crown — so a treeline reads as volume
        // rather than a row of flat discs.
        const canopy = Math.max(9, shape.radius * 0.45 * camera.zoom);
        const seed = fnv1a(`${feature.id}:${index}`);
        const lean = (((seed >>> 3) & 15) / 15 - 0.5) * canopy * 0.35;
        graphic.ellipse(x + canopy * 0.2, y + canopy * 0.45, canopy * 0.85, canopy * 0.32)
          .fill({ color: 0x03080a, alpha: 0.4 });
        graphic.roundRect(x - canopy * 0.11, y - canopy * 0.2, canopy * 0.22, canopy * 0.75, canopy * 0.08)
          .fill({ color: mixColor(kit.baseColor, 0x000000, 0.45), alpha: 0.95 });
        for (const lobe of [
          { dx: -canopy * 0.42 + lean, dy: -canopy * 0.34, r: canopy * 0.62, shade: 0.28 },
          { dx: canopy * 0.40 + lean, dy: -canopy * 0.28, r: canopy * 0.58, shade: 0.14 },
          { dx: lean, dy: -canopy * 0.72, r: canopy * 0.74, shade: 0 },
        ]) {
          graphic.circle(x + lobe.dx, y + lobe.dy, lobe.r)
            .fill({ color: mixColor(kit.baseColor, 0x000000, lobe.shade), alpha: 1 });
        }
        graphic.circle(x + lean - canopy * 0.18, y - canopy * 0.95, canopy * 0.3)
          .fill({ color: mixColor(kit.baseColor, kit.accentColor, 0.42), alpha: 0.7 });
        graphic.arc(x + lean, y - canopy * 0.72, canopy * 0.74, Math.PI * 1.12, Math.PI * 1.72)
          .stroke({ color: kit.accentColor, width: Math.max(1, 1.8 * camera.zoom), alpha: 0.5 });
      } else {
        graphic.roundRect(x - 3, y - 10 * camera.zoom, 6, 20 * camera.zoom, 2).fill({ color: kit.accentColor, alpha: 0.88 });
      }
    }
  } else if (shape.type === 'circle') {
    const center = worldToScreen({ x: shape.x, y: shape.y, z }, camera);
    graphic.circle(center.x + 4, center.y + 7, shape.radius * camera.zoom).fill({ color: 0x05070a, alpha: 0.45 });
    graphic.circle(center.x, center.y, shape.radius * camera.zoom).fill({ color: kit.baseColor, alpha: 1 }).stroke({ color: kit.accentColor, width: 3 });
  } else {
    // Structures are extruded: a ground footprint, side walls rising to the
    // roof, a lit roof plate, and trim. A flat polygon gave no sense of a
    // building occupying space.
    const height = Math.max(10, Math.min(feature.maxZ ?? 40, 72)) * 0.55 * camera.zoom;
    const groundPoints = shape.vertices.map((point) => worldToScreen({ ...point, z: 0 }, camera));
    const roofPoints = groundPoints.map((point) => ({ x: point.x, y: point.y - height }));
    // Cast shadow on the ground.
    tracePolygon(graphic, groundPoints.map((point) => ({ x: point.x + height * 0.3, y: point.y + height * 0.16 })))
      .fill({ color: 0x03070b, alpha: 0.4 });
    // Side walls: only the edges facing the camera (downward in screen space).
    for (let index = 0; index < groundPoints.length; index += 1) {
      const from = groundPoints[index];
      const to = groundPoints[(index + 1) % groundPoints.length];
      if (to.x - from.x === 0 && to.y - from.y === 0) continue;
      const facingCamera = to.x < from.x ? from.y > to.y : to.y >= from.y;
      if (!facingCamera) continue;
      const wallShade = Math.abs(to.x - from.x) > Math.abs(to.y - from.y) ? 0.18 : 0.42;
      tracePolygon(graphic, [
        { x: from.x, y: from.y },
        { x: to.x, y: to.y },
        { x: to.x, y: to.y - height },
        { x: from.x, y: from.y - height },
      ]).fill({ color: mixColor(kit.baseColor, 0x000000, wallShade), alpha: 1 });
    }
    tracePolygon(graphic, roofPoints)
      .fill({ color: mixColor(kit.baseColor, 0xffffff, 0.1), alpha: 1 })
      .stroke({ color: kit.accentColor, width: Math.max(2, 3 * camera.zoom), alpha: 0.86 });
    const top = roofPoints.reduce((best, point) => point.y < best.y ? point : best, roofPoints[0]);
    graphic.circle(top.x, top.y + 14, 5).fill({ color: kit.accentColor, alpha: 0.92 });
  }
}

function drawLandmark(graphic, landmark, kit, center, zoom, glow) {
  const s = Math.max(0.55, zoom);
  graphic.ellipse(center.x + 7 * s, center.y + 14 * s, 38 * s, 16 * s).fill({ color: 0x030608, alpha: 0.48 });
  if (landmark.visualKind === 'signal-tower') {
    graphic.moveTo(center.x, center.y + 32 * s).lineTo(center.x, center.y - 34 * s).stroke({ color: kit.baseColor, width: 12 * s });
    graphic.moveTo(center.x, center.y - 12 * s).lineTo(center.x - 18 * s, center.y - 28 * s).moveTo(center.x, center.y - 12 * s).lineTo(center.x + 18 * s, center.y - 28 * s).stroke({ color: kit.accentColor, width: 5 * s });
    for (const radius of [18, 28, 38]) graphic.arc(center.x, center.y - 24 * s, radius * s, Math.PI * 1.15, Math.PI * 1.85).stroke({ color: kit.accentColor, width: 2, alpha: 0.4 + glow * 0.45 });
  } else if (landmark.visualKind === 'forked-cliff') {
    graphic.poly([center.x - 32*s,center.y+30*s,center.x-12*s,center.y-30*s,center.x,center.y-5*s,center.x+15*s,center.y-36*s,center.x+34*s,center.y+30*s]).fill({ color: kit.baseColor }).stroke({ color: kit.accentColor, width: 4 });
  } else if (landmark.visualKind === 'bridge') {
    graphic.roundRect(center.x - 48*s, center.y - 14*s, 96*s, 28*s, 5*s).fill({ color: kit.baseColor }).stroke({ color: kit.accentColor, width: 3 });
    for (let index=0; index<5; index+=1) graphic.circle(center.x-36*s+index*18*s,center.y,3*s).fill({color:kit.accentColor});
  } else if (landmark.visualKind === 'beacon-tree') {
    graphic.roundRect(center.x-8*s,center.y-2*s,16*s,40*s,6*s).fill({color:kit.baseColor}).stroke({color:kit.accentColor,width:3});
    for (const [dx,dy,r] of [[0,-20,28],[-22,-5,20],[22,-5,20]]) graphic.circle(center.x+dx*s,center.y+dy*s,r*s).fill({color:kit.baseColor}).stroke({color:kit.accentColor,width:3,alpha:0.8});
    graphic.circle(center.x,center.y-14*s,(34+glow*8)*s).stroke({color:kit.accentColor,width:3,alpha:0.3+glow*0.45});
  } else if (landmark.visualKind === 'headframe') {
    graphic.moveTo(center.x-28*s,center.y+34*s).lineTo(center.x-18*s,center.y-30*s).lineTo(center.x+22*s,center.y-30*s).lineTo(center.x+30*s,center.y+34*s).stroke({color:kit.baseColor,width:10*s,join:'round'});
    graphic.circle(center.x+2*s,center.y-25*s,12*s).stroke({color:kit.accentColor,width:4});
    graphic.moveTo(center.x+2*s,center.y-13*s).lineTo(center.x+2*s,center.y+28*s).stroke({color:kit.accentColor,width:3});
  } else {
    graphic.poly([center.x-26*s,center.y+34*s,center.x-12*s,center.y-28*s,center.x,center.y-42*s,center.x+12*s,center.y-28*s,center.x+28*s,center.y+34*s]).fill({color:kit.baseColor}).stroke({color:kit.accentColor,width:4});
    graphic.moveTo(center.x,center.y-38*s).lineTo(center.x,center.y-68*s).stroke({color:kit.accentColor,width:5,alpha:0.85});
    graphic.circle(center.x,center.y-72*s,8*s).fill({color:kit.accentColor,alpha:0.7+glow*0.3});
  }
}

function drawInteraction(graphic, center, kit, zoom, pulse, hazard = false) {
  const size = (hazard ? 34 : 16) * zoom;
  if (hazard) {
    graphic.circle(center.x, center.y, size * (1 + pulse * 0.14)).fill({ color: kit.color, alpha: 0.07 + pulse * 0.08 }).stroke({ color: kit.color, width: 3, alpha: 0.58 + pulse * 0.3 });
    graphic.moveTo(center.x - size * 0.55, center.y).lineTo(center.x + size * 0.55, center.y).moveTo(center.x, center.y - size * 0.55).lineTo(center.x, center.y + size * 0.55).stroke({ color: kit.color, width: 2, alpha: 0.72 });
  } else {
    graphic.poly([center.x, center.y-size, center.x+size, center.y, center.x, center.y+size, center.x-size, center.y]).fill({color:0x071215,alpha:0.9}).stroke({color:kit.color,width:3,alpha:0.95});
    graphic.circle(center.x,center.y,size*0.28).fill({color:kit.color,alpha:0.88});
  }
}

// One authored tile spans this many world units regardless of the bake
// resolution (256 x 0.26 from the original tuning). A higher-resolution bake
// therefore buys texel density at gameplay zoom, not larger features.
export const TERRAIN_TILE_REPEAT_WORLD = 66.56;

/**
 * Reuses tiling sprites across frames so terrain costs no per-frame allocation.
 * Returns a placer that positions one sprite per surface and hides the rest.
 */
function createTerrainSpritePlacer({ container, terrainTiles, camera, view }) {
  if (!container || !terrainTiles?.ready) return null;
  let cursor = 0;
  // The road container also holds its mask, which must never be pooled or
  // hidden as if it were a terrain sprite.
  const poolable = () => container.children.filter((child) => child.label !== 'world-road-mask');
  const scale = (TERRAIN_TILE_REPEAT_WORLD / (terrainTiles.tileSize || 256)) * camera.zoom;
  // World-locked so the pattern does not swim under a moving camera.
  const originX = view.width / 2 - camera.x * camera.zoom;
  const originY = view.height / 2 - camera.y * camera.zoom;
  return {
    place(materialId, x, y, width, height, alpha = 1) {
      if (!(width > 0 && height > 0)) return null;
      let sprite = poolable()[cursor];
      const texture = terrainTiles.textureFor(materialId);
      if (!texture) return null;
      if (!sprite) {
        sprite = terrainTiles.createSprite(materialId, { width, height });
        if (!sprite) return null;
        container.addChild(sprite);
      }
      sprite.texture = texture;
      sprite.visible = true;
      sprite.position.set(x, y);
      sprite.width = width;
      sprite.height = height;
      sprite.alpha = alpha;
      sprite.tileScale.set(scale, scale);
      // Offset by the surface origin so every surface samples the same
      // continuous world-space pattern rather than restarting at its corner.
      sprite.tilePosition.set(originX - x, originY - y);
      cursor += 1;
      return sprite;
    },
    finish() {
      const sprites = poolable();
      for (let index = cursor; index < sprites.length; index += 1) {
        sprites[index].visible = false;
      }
    },
  };
}

export function renderWorldProductionArt({ worldProduction, world, camera, view, queryGround, worldToScreen, tick, performanceProfile, terrainTiles = null }) {
  if (!worldProduction?.layers || !world || !camera || !view) throw new TypeError('world renderer inputs are required');
  if (typeof queryGround !== 'function' || typeof worldToScreen !== 'function') throw new TypeError('world projection functions are required');
  if (!performanceProfile || !Number.isInteger(performanceProfile.particlesPerHazard)) throw new TypeError('performance profile is required');
  nonNegativeInteger(tick, 'tick');
  clearWorldProductionLayers(worldProduction);
  const layers = worldProduction.layers;
  const project = (point, activeCamera = camera) => worldToScreen(point, activeCamera, view);
  const tilePlacer = createTerrainSpritePlacer({ container: worldProduction.terrainSprites, terrainTiles, camera, view });
  const surfacePlacer = createTerrainSpritePlacer({ container: worldProduction.surfaceSprites, terrainTiles, camera, view });
  const cueLayer = worldProduction.surfaceCues ?? layers.surfaces;
  const roadMaskGraphic = worldProduction.roadMask ?? null;
  roadMaskGraphic?.clear();
  // Hidden unless it is actually consumed as a mask below; an unassigned mask
  // is just a white stroke on screen.
  if (roadMaskGraphic) roadMaskGraphic.visible = false;
  const roadPlacer = createTerrainSpritePlacer({ container: worldProduction.roadSprites, terrainTiles, camera, view });
  const districtAt = (x) => world.districts.find((district) => x >= district.area.minX && x <= district.area.maxX) ?? world.districts[0];
  const shaderByDistrict = new Map(world.districts.map((district) => [district.id, resolveWorldShaderState({ tick, districtId: district.id })]));

  for (const district of world.districts) {
    const kit = DISTRICT_PRODUCTION_MATERIALS[district.id];
    const a = project({ x: district.area.minX, y: district.area.minY, z: 0 });
    const b = project({ x: district.area.maxX, y: district.area.maxY, z: 0 });
    if (!screenBoundsVisible([a, b], view, performanceProfile.worldCullMargin)) continue;
    const groundMaterial = DISTRICT_TERRAIN_MATERIAL[district.id];
    layers.terrain.rect(a.x, a.y, b.x-a.x, b.y-a.y).fill({ color: kit.groundColor, alpha: 1 });
    const groundTiled = tilePlacer?.place(groundMaterial, a.x, a.y, b.x-a.x, b.y-a.y) ?? null;
    if (!groundTiled) {
      // Only draw the procedural motif when the authored tile is absent; the
      // tile already carries material detail and the two would fight.
      drawDistrictMaterial({ layers, district, kit, camera, view, project, tick });
    }
  }

  // District boundary blending: the west district's material bleeds a ragged
  // fringe across the shared edge into its eastern neighbour. Projection-only;
  // walkability and district semantics stay with the world contract. With no
  // fringe texture loaded (flat-colour fallback, load failure, ?flatTerrain=1)
  // nothing draws and the previous hard edge remains.
  const fringeContainer = worldProduction.fringeSprites;
  const FRINGE_WORLD_DEPTH = 46;
  let fringeCursor = 0;
  if (fringeContainer && terrainTiles?.ready) {
    const ordered = [...world.districts].sort((left, right) => left.area.minX - right.area.minX);
    for (let index = 0; index + 1 < ordered.length; index += 1) {
      const west = ordered[index];
      const east = ordered[index + 1];
      const boundaryX = east.area.minX;
      const westMaterial = DISTRICT_TERRAIN_MATERIAL[west.id];
      const texture = terrainTiles.fringeTextureFor?.(westMaterial) ?? null;
      if (!texture) continue;
      const top = project({ x: boundaryX, y: east.area.minY, z: 0 });
      const bottom = project({ x: boundaryX, y: east.area.maxY, z: 0 });
      const depth = FRINGE_WORLD_DEPTH * camera.zoom;
      if (!screenBoundsVisible([top, { x: top.x + depth, y: bottom.y }], view, performanceProfile.worldCullMargin)) continue;
      let sprite = fringeContainer.children[fringeCursor] ?? null;
      if (!sprite) {
        sprite = new worldProduction.TilingSpriteClass({ texture, width: 1, height: 1 });
        fringeContainer.addChild(sprite);
      }
      fringeCursor += 1;
      sprite.visible = true;
      sprite.texture = texture;
      // Rotated -90deg: the strip's U axis runs down the screen along the
      // boundary and its V falloff bleeds eastward into the next district.
      sprite.rotation = -Math.PI / 2;
      sprite.position.set(top.x, bottom.y);
      sprite.width = Math.max(1, bottom.y - top.y);
      sprite.height = depth;
      const tileWorldScale = (TERRAIN_TILE_REPEAT_WORLD / (terrainTiles.tileSize || 256)) * camera.zoom;
      sprite.tileScale?.set?.(tileWorldScale, depth / (terrainTiles.fringeHeight || 64));
    }
  }
  if (fringeContainer) {
    for (let index = fringeCursor; index < fringeContainer.children.length; index += 1) {
      fringeContainer.children[index].visible = false;
    }
  }

  for (const route of world.routes) {
    const routePoints = route.nodeIds.map((id) => {
      const node = world.routeGraph.nodes.find((candidate) => candidate.id === id);
      const ground = queryGround(node.x,node.y);
      return project({x:node.x,y:node.y,z:ground.groundZ});
    });
    routePoints.zoom = camera.zoom;
    if (!screenBoundsVisible(routePoints, view, performanceProfile.worldCullMargin)) continue;
    const firstNode = world.routeGraph.nodes.find((node) => node.id === route.nodeIds[0]);
    drawRoute(layers, routePoints, route, DISTRICT_PRODUCTION_MATERIALS[districtAt(firstNode.x).id], roadMaskGraphic);
  }

  for (const surface of world.surfaces) {
    const vertices=rectVertices(surface.area);
    const points=vertices.map((vertex)=>{const sampled=queryGround(vertex.x,vertex.y); return project({...vertex,z:surface.waterLevel??sampled.groundZ});});
    if (!screenBoundsVisible(points, view, performanceProfile.worldCullMargin)) continue;
    const district=districtAt(vertices[0].x); const shader=shaderByDistrict.get(district.id); const kit=DISTRICT_PRODUCTION_MATERIALS[district.id];
    const surfaceBase=resolveWorldSurfaceBase({kind:surface.kind,districtId:district.id});
    // Raised surfaces used to draw as a translucent panel with a bright
    // outline, which read as floating glass over the ground rather than a
    // step up. Ledges and bridges now get a cast shadow, an opaque deck, a
    // lit top edge, and a darker leading lip so the height change is legible.
    const { isWater, isRaised } = surfaceBase;
    if (isRaised) {
      const lift = Math.max(4, 9 * camera.zoom);
      const shadow = points.map((point) => ({ x: point.x + lift * 0.55, y: point.y + lift }));
      tracePolygon(layers.surfaces, shadow).fill({ color: 0x03070b, alpha: 0.42 });
    }
    tracePolygon(layers.surfaces,points)
      .fill({color:surfaceBase.color,alpha:surfaceBase.alpha})
      .stroke({color:surfaceBase.strokeColor,width:isRaised?4:3,alpha:isWater?0.8:0.9});
    // Authored material over the flat base for rectangular surfaces; the base
    // colour remains visible for non-rect shapes and when tiles are absent.
    const surfaceMaterial = SURFACE_TERRAIN_MATERIAL[surface.kind];
    if (surfaceMaterial && surface.area.type === 'rect' && points.length >= 4) {
      const minX = Math.min(...points.map((point) => point.x));
      const maxX = Math.max(...points.map((point) => point.x));
      const minY = Math.min(...points.map((point) => point.y));
      const maxY = Math.max(...points.map((point) => point.y));
      surfacePlacer?.place(surfaceMaterial, minX, minY, maxX - minX, maxY - minY, surfaceBase.alpha);
    }
    if (isWater) {
      // Shoreline foam: the single clearest "this is water, do not stand here"
      // cue, drawn as a bright inner band hugging the surface edge.
      tracePolygon(cueLayer, points)
        .stroke({ color: 0xcdf6ff, width: Math.max(2, 5 * camera.zoom), alpha: 0.5 });
      tracePolygon(cueLayer, points)
        .stroke({ color: 0x7fdcf0, width: Math.max(1, 2 * camera.zoom), alpha: 0.72 });
    }
    if (isRaised && points.length >= 4) {
      // Lit top edge and shaded front lip.
      cueLayer.moveTo(points[0].x, points[0].y).lineTo(points[1].x, points[1].y)
        .stroke({ color: mixColor(kit.detailColor, 0xffffff, 0.4), width: Math.max(2, 3 * camera.zoom), alpha: 0.7 });
      cueLayer.moveTo(points[2].x, points[2].y).lineTo(points[3].x, points[3].y)
        .stroke({ color: 0x05090d, width: Math.max(3, 5 * camera.zoom), alpha: 0.6 });
    }
    if (surface.kind.includes('water') && surface.area.type==='rect') {
      const a=points[0], b=points[2];
      // Water used to get 7 shimmer lines spread over a 4,800-unit river —
      // roughly one line every 600px, so it rendered as a flat slab. Bands are
      // now spaced in world units and clipped to the visible span, with a
      // depth gradient, drifting caustics, and lit banks.
      const BAND = 90;
      const top = Math.min(a.y, b.y);
      const bottom = Math.max(a.y, b.y);
      const left = Math.min(a.x, b.x);
      const right = Math.max(a.x, b.x);
      const visibleTop = Math.max(top, -BAND);
      const visibleBottom = Math.min(bottom, view.height + BAND);
      // Depth gradient: deeper toward the middle of the channel.
      const midY = (top + bottom) / 2;
      const depthBand = Math.max(1, (bottom - top) * 0.5);
      cueLayer.rect(left, midY - depthBand * 0.5, right - left, depthBand)
        .fill({ color: 0x062b3d, alpha: 0.34 });
      const step = BAND * camera.zoom;
      for (let y = Math.ceil(visibleTop / step) * step; y < visibleBottom; y += step) {
        const phase = shader.waterShimmer * Math.PI * 2 + y * 0.02;
        const drift = Math.sin(phase) * 26 * camera.zoom;
        const inset = 18 * camera.zoom;
        cueLayer.moveTo(left + inset + drift, y)
          .bezierCurveTo(
            left + (right - left) * 0.35, y - 6 * camera.zoom,
            left + (right - left) * 0.65, y + 6 * camera.zoom,
            right - inset + drift, y,
          )
          .stroke({ color: 0xbaf5ff, width: Math.max(1, 1.8 * camera.zoom), alpha: 0.1 + shader.waterShimmer * 0.12 });
        // Short caustic flecks between the long bands.
        const fleckSeed = fnv1a(`${surface.id ?? 'water'}:${Math.round(y)}`);
        const fleckX = left + inset + ((fleckSeed & 0xff) / 255) * Math.max(1, right - left - inset * 2);
        const fleckLength = (10 + ((fleckSeed >>> 9) & 15)) * camera.zoom;
        cueLayer.moveTo(fleckX - drift * 0.6, y + step * 0.5)
          .lineTo(fleckX - drift * 0.6 + fleckLength, y + step * 0.5)
          .stroke({ color: 0xe6ffff, width: Math.max(1, 1.4 * camera.zoom), alpha: 0.08 + shader.waterShimmer * 0.1 });
      }
      // Lit shorelines top and bottom.
      for (const edgeY of [top, bottom]) {
        cueLayer.moveTo(left, edgeY).lineTo(right, edgeY)
          .stroke({ color: 0x9fe8ff, width: Math.max(1, 2.4 * camera.zoom), alpha: 0.32 });
      }
    }
  }

  for (const feature of world.blockers) {
    const shape = feature.shape;
    // Circle shapes carry x/y directly (collision.mjs canonical form); the
    // old `shape.center` read produced NaN projections that silently culled
    // every circle blocker.
    const anchors = shape.type === 'circle' ? [{ x: shape.x, y: shape.y }] : shape.type === 'capsule' ? [shape.a, shape.b] : shape.vertices;
    const points = anchors.map((point) => project({ ...point, z: 0 }));
    if (!screenBoundsVisible(points, view, performanceProfile.worldCullMargin)) continue;
    const layer = feature.id.startsWith('town-') ? layers.townBlockers : layers.blockers;
    drawBlocker(layer, feature, BLOCKER_PRODUCTION_KITS[feature.visualKind], camera, (point, activeCamera) => project(point,activeCamera));
  }

  for (const destructible of world.interactions.destructibles) {
    const ground=queryGround(destructible.anchor.x,destructible.anchor.y); const center=project({...destructible.anchor,z:ground.groundZ}); const s=18*camera.zoom;
    if (!isScreenPointVisible(center, view, performanceProfile.worldCullMargin)) continue;
    layers.details.roundRect(center.x-s,center.y-s*0.7,s*2,s*1.4,4).fill({color:0x5c4433,alpha:1}).stroke({color:0xd7a766,width:3});
    layers.details.moveTo(center.x-s,center.y).lineTo(center.x+s,center.y).moveTo(center.x,center.y-s*0.7).lineTo(center.x,center.y+s*0.7).stroke({color:0x2e211a,width:2,alpha:0.7});
  }
  for (const zone of world.interactions.explosiveZones) {
    const ground=queryGround(zone.anchor.x,zone.anchor.y); const center=project({...zone.anchor,z:ground.groundZ}); const s=12*camera.zoom;
    if (!isScreenPointVisible(center, view, performanceProfile.worldCullMargin)) continue;
    for(let index=-1;index<=1;index+=1) layers.details.roundRect(center.x+index*s*1.6-s*0.5,center.y-s,s,s*2,3).fill({color:0xa13b31}).stroke({color:0xffbe55,width:2});
  }

  for (const landmark of world.landmarks) {
    const ground=queryGround(landmark.anchor.x,landmark.anchor.y); const center=project({...landmark.anchor,z:ground.groundZ}); const kit=LANDMARK_PRODUCTION_KITS[landmark.visualKind]; const glow=shaderByDistrict.get(landmark.districtId).beaconGlow;
    if (!isScreenPointVisible(center, view, performanceProfile.worldCullMargin)) continue;
    drawLandmark(layers.landmarks,landmark,kit,center,camera.zoom,glow);
    layers.lighting.circle(center.x,center.y,(44+glow*16)*camera.zoom).fill({color:kit.accentColor,alpha:0.035+glow*0.045});
  }

  for (const poi of world.pointsOfInterest) {
    const ground=queryGround(poi.anchor.x,poi.anchor.y); const center=project({...poi.anchor,z:ground.groundZ});
    if (!isScreenPointVisible(center, view, performanceProfile.worldCullMargin)) continue;
    drawInteraction(layers.interactions,center,INTERACTION_PRODUCTION_KITS[poi.hook],camera.zoom,0,false);
  }
  let renderedParticleCount = 0;
  for (const hazard of world.interactions.hazards) {
    const ground=queryGround(hazard.anchor.x,hazard.anchor.y); const center=project({...hazard.anchor,z:ground.groundZ}); const shader=shaderByDistrict.get(hazard.districtId); const kit=INTERACTION_PRODUCTION_KITS[hazard.kind];
    if (!isScreenPointVisible(center, view, performanceProfile.worldCullMargin)) continue;
    drawInteraction(layers.interactions,center,kit,camera.zoom,shader.hazardPulse,true);
    for(const particle of resolveWorldParticleField({id:hazard.id,x:hazard.anchor.x,y:hazard.anchor.y,tick,count:performanceProfile.particlesPerHazard,radius:52})) {const screen=project({...particle,z:ground.groundZ+particle.size*4}); layers.particles.circle(screen.x,screen.y,particle.size*camera.zoom).fill({color:kit.color,alpha:particle.alpha}); renderedParticleCount += 1;}
  }

  // The vignette used to draw a dark fill into the additive lighting layer,
  // where dark *lightens* — it contributed ~(1,3,4)/255 in the wrong
  // direction and was effectively invisible. It now draws on its own
  // normal-blended layer, in graduated bands so the frame edge falls off
  // smoothly instead of showing a hard 36px border.
  const vignetteDepth=Math.max(48,Math.min(view.width,view.height)*0.14);
  const BANDS=4;
  for(let band=0;band<BANDS;band+=1){
    const inset=vignetteDepth*(band/BANDS);
    const thickness=vignetteDepth/BANDS;
    const alpha=0.055+band*0.02;
    layers.vignette.rect(0,inset,view.width,thickness).fill({color:0x03080e,alpha});
    layers.vignette.rect(0,view.height-inset-thickness,view.width,thickness).fill({color:0x03080e,alpha});
    layers.vignette.rect(inset,0,thickness,view.height).fill({color:0x03080e,alpha:alpha*0.85});
    layers.vignette.rect(view.width-inset-thickness,0,thickness,view.height).fill({color:0x03080e,alpha:alpha*0.85});
  }
  tilePlacer?.finish();
  surfacePlacer?.finish();
  if (roadPlacer && roadMaskGraphic) {
    const roadSprite = roadPlacer.place('road', 0, 0, view.width, view.height, 0.96);
    if (roadSprite) {
      roadSprite.mask = roadMaskGraphic;
      // Pixi excludes an assigned mask from the colour buffer, so this is safe
      // only after the assignment above.
      roadMaskGraphic.visible = true;
    }
    roadPlacer.finish();
  }
  return freezeDeep({
    artId: WORLD_PRODUCTION_ART.id,
    shaderIds: WORLD_PRODUCTION_ART.shaderIds,
    // Report the budget this profile actually allows, not the desktop constant.
    // Mobile uses 6 per hazard and reduced-motion uses 0, so the hardcoded 10
    // reported particles that were never spawned.
    particleCount: world.interactions.hazards.length * performanceProfile.particlesPerHazard,
    renderedParticleCount,
    districtCount: world.districts.length,
    blockerCount: world.blockers.length,
    landmarkCount: world.landmarks.length,
  });
}
