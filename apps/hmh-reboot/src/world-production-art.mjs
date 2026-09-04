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
  // Authored edge strips: road shoulders, shore bands and scree skirts. They
  // sit above the ground and its district fringe but BELOW `surfaces`, so a
  // shore band is covered by the water it borders and only shows on the land
  // side, and a scree skirt lies under the ledge that shed it.
  const stripSprites = new ContainerClass();
  stripSprites.label = 'world-edge-strips';
  root.addChildAt(stripSprites, root.getChildIndex(fringeSprites) + 1);
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
  // W-11: the camera-facing wall of a ledge or the flank of a ramp. Strips sit
  // above the flat base fill (which doubles as the no-texture face) and below
  // the opaque top tile, so a wall never paints over the deck it belongs to.
  const surfaceFaceSprites = new ContainerClass();
  surfaceFaceSprites.label = 'world-surface-faces';
  root.addChildAt(surfaceFaceSprites, root.getChildIndex(layers.surfaces) + 1);
  // Ramps tile through a polygon mask (their projected outline is a
  // parallelogram, not a rectangle). They get their own sprite pool and a
  // pool of mask graphics, so the shared surface pool never carries a mask.
  const rampSprites = new ContainerClass();
  rampSprites.label = 'world-ramp-tiles';
  root.addChildAt(rampSprites, root.getChildIndex(surfaceSprites) + 1);
  const rampMasks = new ContainerClass();
  rampMasks.label = 'world-ramp-masks';
  root.addChildAt(rampMasks, root.getChildIndex(rampSprites) + 1);
  // W-5: a cliff's rock face paints over the body drawn into `blockers`.
  const blockerFaceSprites = new ContainerClass();
  blockerFaceSprites.label = 'world-blocker-faces';
  root.addChildAt(blockerFaceSprites, root.getChildIndex(layers.blockers) + 1);
  // Roads are stroked polylines, so they tile through a mask rather than a
  // rectangle: one viewport-sized sprite clipped to the road surface.
  const roadSprites = new ContainerClass();
  roadSprites.label = 'world-road-tiles';
  const roadMask = new GraphicsClass();
  roadMask.label = 'world-road-mask';
  roadSprites.addChild(roadMask);
  root.addChildAt(roadSprites, root.getChildIndex(layers.routes) + 1);
  return Object.freeze({
    root,
    layers: Object.freeze(layers),
    terrainSprites,
    fringeSprites,
    stripSprites,
    surfaceSprites,
    surfaceFaceSprites,
    rampSprites,
    rampMasks,
    blockerFaceSprites,
    surfaceCues,
    roadSprites,
    roadMask,
    TilingSpriteClass,
    GraphicsClass,
  });
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

function drawRoute(layers, points, route, kit, roadMask = null, roadTiled = false) {
  const zoom = points.zoom;
  const road=layers.routes,cues=layers.details;
  const trace = (layer=road) => {
    layer.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) layer.lineTo(point.x, point.y);
  };
  // Roads used to be a flat slab between two hard black outline strokes and a
  // dark verge, which read as a map overlay with a border rather than ground.
  // The outline is gone: the travelled surface is the authored road tile, its
  // edges are authored shoulder strips that dissolve into the terrain, and the
  // flat slab survives only where no tile loaded.
  if (!roadTiled) {
    trace();
    road.stroke({ color: kit.routeColor, width: route.width * zoom, alpha: route.kind === 'main' ? 0.96 : 0.82, cap: 'round', join: 'round' });
  }
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
  if (shape.type === 'capsule' && feature.visualKind === 'cliff') {
    // W-5 (partial): rock, not a capsule with a stripe. Every other capsule
    // (fences, rails, canopies, machinery, containers) keeps the path below.
    drawCliffMass(graphic, feature, kit, camera, worldToScreen);
  } else if (shape.type === 'capsule') {
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

// ---------------------------------------------------------------------------
// W-11 (projection-only): height must read as height.
//
// worldToScreen maps z straight to screen rows, so the camera-facing front of
// anything standing above the ground around it is exactly (topZ - baseZ) *
// zoom px tall, from the projected lip down to the projected foot. Nothing
// drew in that band before Cycle 073. These helpers draw it; the elevation
// itself stays with the world contract and is only read here.
// ---------------------------------------------------------------------------

const RAISED_FACE = Object.freeze({
  // No-texture fallback: the district ground pulled toward black, banded
  // darker toward the foot.
  shade: 0.3,
  bands: Object.freeze([0.1, 0.18, 0.26]),
  // Ground contact: thin bands on the ground just below the foot line.
  footBands: Object.freeze([0.34, 0.2, 0.1]),
  footBandWorld: 4,
  // The authored strip is baked neutral and pulled toward the surface it
  // belongs to.
  tintAmount: 0.45,
});

// W-5 (partial): cliff blockers keep their collision capsule and gain a
// visual height. The plate rides this far above the ground body; it is a
// readability constant, not the collision maxZ.
export const CLIFF_FACE = Object.freeze({ heightRatio: 0.45, minWorld: 24, maxWorld: 64 });

function cliffFaceHeight(maxZ, zoom) {
  return Math.max(CLIFF_FACE.minWorld, Math.min(CLIFF_FACE.maxWorld, (maxZ ?? 0) * CLIFF_FACE.heightRatio)) * zoom;
}

const faceTint = (color) => mixColor(0xffffff, color, RAISED_FACE.tintAmount);

const lerpPoint = (from, to, t) => ({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t });

// Each pooled sprite that ever needs clipping owns one mask graphic for its
// whole life. Pixi switches a mask's `includeInBuild` back on when a sprite
// drops it, so a mask shared between sprites could be turned into a visible
// white fill mid-frame; an owned mask is only ever assigned to its owner.
const OWNED_MASKS = new WeakMap();

function clipToPolygon(sprite, polygon, worldProduction) {
  const masks = worldProduction.rampMasks;
  const GraphicsClass = worldProduction.GraphicsClass;
  if (!sprite || !masks || typeof GraphicsClass !== 'function') return null;
  let mask = OWNED_MASKS.get(sprite);
  if (!mask) {
    mask = new GraphicsClass();
    mask.label = 'world-ramp-mask';
    mask.visible = false;
    masks.addChild(mask);
    OWNED_MASKS.set(sprite, mask);
  }
  mask.clear();
  tracePolygon(mask, polygon).fill({ color: 0xffffff });
  if (sprite.mask !== mask) sprite.mask = mask;
  // Pixi excludes an assigned mask from the colour buffer, so this is safe
  // only after the assignment above; an unassigned mask is a white fill.
  mask.visible = true;
  return mask;
}

function unclip(sprite) {
  if (sprite && (sprite.mask ?? null) !== null) sprite.mask = null;
}

/**
 * The camera-facing face of a rectangular surface. Its lip is the projected
 * south edge (points[3] -> points[2]); its foot is that edge projected at
 * whatever the ground query reports just south of it (a waterline where the
 * footing is water). Null when the surface is flush with its footing.
 */
function resolveRaisedFace({ surface, points, queryGround, project }) {
  if (surface.area?.type !== 'rect' || points.length < 4) return null;
  const { minX, maxX, maxY } = surface.area;
  const footingZ = (x) => {
    const footing = queryGround(x, maxY + 1);
    return footing.waterLevel ?? footing.groundZ ?? 0;
  };
  const footWest = project({ x: minX, y: maxY, z: footingZ(minX + 0.5) });
  const footEast = project({ x: maxX, y: maxY, z: footingZ(maxX - 0.5) });
  const lipWest = points[3];
  const lipEast = points[2];
  const dropWest = footWest.y - lipWest.y;
  const dropEast = footEast.y - lipEast.y;
  if (!(Math.max(dropWest, dropEast) > 0.5)) return null;
  return {
    polygon: [lipWest, lipEast, footEast, footWest],
    lipWest,
    lipEast,
    footWest,
    footEast,
    top: Math.min(lipWest.y, lipEast.y),
    bottom: Math.max(footWest.y, footEast.y),
    left: Math.min(lipWest.x, footWest.x),
    right: Math.max(lipEast.x, footEast.x),
    // A ledge face is a rectangle; a ramp flank is a trapezoid or triangle and
    // has to be clipped.
    rectangular: Math.abs(dropWest - dropEast) < 0.5 && Math.abs(lipWest.y - lipEast.y) < 0.5,
  };
}

/**
 * Draw one face: the flat shaded fallback and the ground-contact bands into
 * `layers.surfaces`, the authored strip stretched to exactly the face height
 * into the face container, and the lit cap along the lip into the cue layer.
 */
function drawRaisedFace({ layers, cueLayer, face, baseColor, capColor, camera, facePlacer, texture, tint, stripDefaults, worldProduction, contact = true }) {
  const zoom = camera.zoom;
  tracePolygon(layers.surfaces, face.polygon).fill({ color: mixColor(baseColor, 0x000000, RAISED_FACE.shade), alpha: 1 });
  if (face.rectangular) {
    const width = face.right - face.left;
    const bandHeight = (face.bottom - face.top) / RAISED_FACE.bands.length;
    RAISED_FACE.bands.forEach((alpha, index) => {
      layers.surfaces.rect(face.left, face.top + bandHeight * index, width, bandHeight).fill({ color: 0x03070b, alpha });
    });
    if (contact) {
      const band = RAISED_FACE.footBandWorld * zoom;
      RAISED_FACE.footBands.forEach((alpha, index) => {
        layers.surfaces.rect(face.left, face.bottom + band * index, width, band).fill({ color: 0x03070b, alpha });
      });
    }
  }
  let strip = null;
  if (texture && facePlacer) {
    strip = facePlacer.placeStrip(texture, { x: face.left, y: face.top }, { x: face.right, y: face.top }, {
      ...stripDefaults,
      depthWorld: (face.bottom - face.top) / zoom,
      side: 1,
      overlapWorld: 0,
      alpha: 1,
      tint,
    });
    if (strip) {
      if (face.rectangular) unclip(strip);
      else clipToPolygon(strip, face.polygon, worldProduction);
    }
  }
  // The lip catches the light: a thin bright cap where the top meets the wall.
  cueLayer.moveTo(face.lipWest.x, face.lipWest.y).lineTo(face.lipEast.x, face.lipEast.y)
    .stroke({ color: capColor, width: Math.max(1, 2 * zoom), alpha: 0.75 });
  return strip;
}

/**
 * A ramp reads as a slope, not a flat plate: five bands from its low end to
 * its high end, darkest low, plus a dark crease where it leaves the ground and
 * a faint lit crease where it meets the deck.
 */
function drawRampGrade(cueLayer, surface, points, zoom) {
  const alongX = surface.axis === 'x';
  const lowAtStart = surface.fromZ <= surface.toZ;
  const BANDS = 5;
  const edgeA = alongX ? [points[0], points[1]] : [points[0], points[3]];
  const edgeB = alongX ? [points[3], points[2]] : [points[1], points[2]];
  for (let index = 0; index < BANDS; index += 1) {
    const slot = lowAtStart ? index : BANDS - 1 - index;
    const t0 = slot / BANDS;
    const t1 = (slot + 1) / BANDS;
    const quad = [lerpPoint(edgeA[0], edgeA[1], t0), lerpPoint(edgeA[0], edgeA[1], t1), lerpPoint(edgeB[0], edgeB[1], t1), lerpPoint(edgeB[0], edgeB[1], t0)];
    tracePolygon(cueLayer, quad).fill({ color: 0x03070b, alpha: 0.26 - (0.22 * index) / (BANDS - 1) });
  }
  const startEdge = alongX ? [points[0], points[3]] : [points[0], points[1]];
  const endEdge = alongX ? [points[1], points[2]] : [points[3], points[2]];
  const [lowEdge, highEdge] = lowAtStart ? [startEdge, endEdge] : [endEdge, startEdge];
  cueLayer.moveTo(lowEdge[0].x, lowEdge[0].y).lineTo(lowEdge[1].x, lowEdge[1].y)
    .stroke({ color: 0x03070b, width: Math.max(1, 2 * zoom), alpha: 0.35 });
  cueLayer.moveTo(highEdge[0].x, highEdge[0].y).lineTo(highEdge[1].x, highEdge[1].y)
    .stroke({ color: 0xffffff, width: Math.max(1, 1.5 * zoom), alpha: 0.16 });
}

/**
 * Where a cliff capsule shows its face. A wall (axis within 30 degrees of the
 * screen x axis) faces the camera along the rim of its straight run, between
 * the plate rim (lifted by the face height) and the ground rim; a pillar shows
 * only its south end cap. Screen space throughout.
 */
function cliffFaceGeometry(a, b, radius, faceH) {
  let from = a;
  let to = b;
  if (to.x < from.x) {
    from = b;
    to = a;
  }
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  const unitX = length > 0 ? dx / length : 1;
  const unitY = length > 0 ? dy / length : 0;
  if (length > 1 && Math.abs(unitY) < 0.5) {
    const normalX = -unitY;
    const normalY = unitX;
    return {
      wall: true,
      rimFrom: { x: from.x + normalX * radius, y: from.y + normalY * radius - faceH },
      rimTo: { x: to.x + normalX * radius, y: to.y + normalY * radius - faceH },
      // Perpendicular distance between the two parallel rims.
      depth: faceH * unitX,
    };
  }
  return { wall: false, cap: a.y >= b.y ? a : b };
}

// Pixi restarts the path at the previous path's last point after a stroke, so
// an arc drawn straight after one gets a connecting line from wherever the
// last stroke ended. Start every arc at its own first point.
function arcFrom(graphic, x, y, radius, startAngle, endAngle) {
  return graphic.moveTo(x + Math.cos(startAngle) * radius, y + Math.sin(startAngle) * radius)
    .arc(x, y, radius, startAngle, endAngle);
}

/**
 * W-5 (partial). A cliff is a rock mass: a dark wall standing on the ground, a
 * lighter plate lifted by the face height, strata across the wall, a dark
 * silhouette rim and a thin lit edge along the plate's camera-facing lip. The
 * old treatment, a lifted capsule with a 12%-width accent stripe and posts,
 * is what read as a brown capsule with an orange stripe.
 */
function drawCliffMass(graphic, feature, kit, camera, worldToScreen) {
  const shape = feature.shape;
  const zoom = camera.zoom;
  const faceH = cliffFaceHeight(feature.maxZ, zoom);
  const a = worldToScreen({ ...shape.a, z: 0 }, camera);
  const b = worldToScreen({ ...shape.b, z: 0 }, camera);
  const width = Math.max(6, shape.radius * 2 * zoom);
  const radius = width / 2;
  const faceColor = mixColor(kit.baseColor, 0x000000, 0.42);
  const plateColor = mixColor(kit.baseColor, 0xffffff, 0.08);
  const rimColor = mixColor(kit.baseColor, 0x000000, 0.45);
  const hairline = Math.max(1, 1.5 * zoom);
  // Ground contact shadow under the mass.
  graphic.moveTo(a.x + 4, a.y + 7).lineTo(b.x + 4, b.y + 7).stroke({ color: 0x05070a, width, alpha: 0.46, cap: 'round' });
  // Body: the wall, standing on the ground.
  graphic.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color: faceColor, width, alpha: 1, cap: 'round' });
  const geometry = cliffFaceGeometry(a, b, radius, faceH);
  // Strata across the wall. The authored strip covers the straight run when
  // it is loaded; the end caps and the no-texture fallback keep these.
  for (const t of [0.36, 0.68]) {
    if (geometry.wall) {
      graphic.moveTo(geometry.rimFrom.x, geometry.rimFrom.y + faceH * t).lineTo(geometry.rimTo.x, geometry.rimTo.y + faceH * t)
        .stroke({ color: 0x05070a, width: hairline, alpha: 0.3 });
    } else {
      arcFrom(graphic, geometry.cap.x, geometry.cap.y - faceH * (1 - t), radius, Math.PI * 0.08, Math.PI * 0.92)
        .stroke({ color: 0x05070a, width: hairline, alpha: 0.3 });
    }
  }
  // Plate: the same capsule lifted by the face height, over a dark rim so the
  // top separates from the ground it stands on.
  graphic.moveTo(a.x, a.y - faceH).lineTo(b.x, b.y - faceH).stroke({ color: rimColor, width: width + Math.max(2, 3 * zoom), alpha: 0.7, cap: 'round' });
  graphic.moveTo(a.x, a.y - faceH).lineTo(b.x, b.y - faceH).stroke({ color: plateColor, width, alpha: 1, cap: 'round' });
  // The plate is a rounded rock crown, not a flat pill: a broad ridge light
  // offset toward the light (upper left), a shade toward the camera side, and
  // deterministic fracture lines seeded from the feature id.
  const ridgeX = radius * 0.22;
  const ridgeY = radius * 0.3;
  graphic.moveTo(a.x - ridgeX, a.y - faceH - ridgeY).lineTo(b.x - ridgeX, b.y - faceH - ridgeY)
    .stroke({ color: mixColor(kit.baseColor, 0xffffff, 0.18), width: width * 0.5, alpha: 0.5, cap: 'round' });
  graphic.moveTo(a.x + ridgeX, a.y - faceH + ridgeY).lineTo(b.x + ridgeX, b.y - faceH + ridgeY)
    .stroke({ color: mixColor(kit.baseColor, 0x000000, 0.28), width: width * 0.36, alpha: 0.4, cap: 'round' });
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  const unitX = length > 0 ? (b.x - a.x) / length : 1;
  const unitY = length > 0 ? (b.y - a.y) / length : 0;
  const cracks = Math.max(3, Math.min(14, Math.round(length / 60)));
  for (let index = 0; index < cracks; index += 1) {
    const seed = fnv1a(`${feature.id}:crack:${index}`);
    const t = 0.06 + ((seed & 0xff) / 255) * 0.88;
    const lateral = (((seed >>> 8) & 0xff) / 255 - 0.5) * radius * 1.1;
    const halfRun = radius * (0.18 + (((seed >>> 16) & 0xff) / 255) * 0.17);
    const angle = Math.atan2(unitX, -unitY) + (((seed >>> 24) & 0x7f) / 127 - 0.5) * 0.9;
    const centerX = a.x + (b.x - a.x) * t - unitY * lateral;
    const centerY = a.y - faceH + (b.y - a.y) * t + unitX * lateral;
    const kinkX = (((seed >>> 4) & 0xf) / 15 - 0.5) * halfRun * 0.6;
    const kinkY = (((seed >>> 12) & 0xf) / 15 - 0.5) * halfRun * 0.6;
    graphic.moveTo(centerX - Math.cos(angle) * halfRun, centerY - Math.sin(angle) * halfRun)
      .lineTo(centerX + kinkX, centerY + kinkY)
      .lineTo(centerX + Math.cos(angle) * halfRun, centerY + Math.sin(angle) * halfRun)
      .stroke({ color: mixColor(kit.baseColor, 0x000000, 0.5), width: hairline, alpha: 0.42 });
  }
  // Lit lip along the plate's camera-facing edge.
  if (geometry.wall) {
    graphic.moveTo(geometry.rimFrom.x, geometry.rimFrom.y - hairline * 0.5).lineTo(geometry.rimTo.x, geometry.rimTo.y - hairline * 0.5)
      .stroke({ color: kit.accentColor, width: hairline, alpha: 0.55 });
  } else {
    arcFrom(graphic, geometry.cap.x, geometry.cap.y - faceH, radius - hairline * 0.5, Math.PI * 0.1, Math.PI * 0.9)
      .stroke({ color: kit.accentColor, width: hairline, alpha: 0.55 });
  }
}

/** The authored rock face along a cliff wall's straight run. */
function placeCliffFace({ feature, kit, camera, project, placer, texture, stripDefaults }) {
  const shape = feature.shape;
  const zoom = camera.zoom;
  const a = project({ ...shape.a, z: 0 });
  const b = project({ ...shape.b, z: 0 });
  const radius = Math.max(6, shape.radius * 2 * zoom) / 2;
  const geometry = cliffFaceGeometry(a, b, radius, cliffFaceHeight(feature.maxZ, zoom));
  if (!geometry.wall) return null;
  return placer.placeStrip(texture, geometry.rimFrom, geometry.rimTo, {
    ...stripDefaults,
    depthWorld: geometry.depth / zoom,
    side: 1,
    overlapWorld: 0,
    alpha: 1,
    tint: faceTint(kit.baseColor),
  });
}

// One authored tile spans this many world units regardless of the bake
// resolution (256 x 0.26 from the original tuning). A higher-resolution bake
// therefore buys texel density at gameplay zoom, not larger features.
export const TERRAIN_TILE_REPEAT_WORLD = 399.36;

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

// Authored shoulders reach this far outward from each road edge, in world
// units. Wide enough to read as a verge at gameplay zoom, narrow enough that
// two routes crossing at a junction do not carpet the ground between them.
const SHOULDER_WORLD_DEPTH = 34;
// W-4. A waterline sheds a wide band of wet sand inland; a rock face sheds a
// narrower skirt of chips, deepened under a tall ledge.
const SHORE_WORLD_DEPTH = 46;
const SCREE_WORLD_DEPTH = 30;

/**
 * Pooled tiling strips laid along an arbitrary screen-space segment.
 *
 * Roads, shorelines and cliff skirts all need the same thing: a texture that
 * runs along an edge and fades outward across its depth. Pixi masks are
 * stencils and would give back the hard border this replaces, so the falloff
 * lives in the strip's own alpha and the strip is a rotated TilingSprite.
 */
function createStripPlacer({ container, TilingSpriteClass, camera, view, cullMargin = 0 }) {
  if (!container || typeof TilingSpriteClass !== 'function') return null;
  let cursor = 0;
  return {
    placeStrip(texture, from, to, { depthWorld, sideOffsetWorld = 0, side = 1, repeatWorld = TERRAIN_TILE_REPEAT_WORLD, tileSize = 512, stripHeight = 128, alpha = 1, overlapWorld = depthWorld, tint = 0xffffff }) {
      if (!texture) return null;
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const length = Math.hypot(dx, dy);
      if (!(length > 1) || !(depthWorld > 0)) return null;
      const depth = Math.max(1, depthWorld * camera.zoom);
      const unitX = dx / length;
      const unitY = dy / length;
      // Screen-space left normal. The strip's local +y maps to this, so the
      // texture's opaque row 0 always hugs the edge and its alpha falloff
      // points outward.
      const normalX = -unitY;
      const normalY = unitX;
      const offset = sideOffsetWorld * camera.zoom;
      // A fading skirt runs past both ends by its own depth so its ragged edge
      // never stops flush with a corner; an opaque wall must stop exactly at
      // the corners, so faces pass overlapWorld 0.
      const overlap = overlapWorld === depthWorld ? depth : Math.max(0, overlapWorld * camera.zoom);
      const forward = side >= 0;
      const originX = forward ? from.x + normalX * offset - unitX * overlap : to.x - normalX * offset + unitX * overlap;
      const originY = forward ? from.y + normalY * offset - unitY * overlap : to.y - normalY * offset + unitY * overlap;
      const reach = offset + depth;
      const corners = [
        { x: from.x + normalX * reach, y: from.y + normalY * reach },
        { x: to.x + normalX * reach, y: to.y + normalY * reach },
        { x: from.x - normalX * reach, y: from.y - normalY * reach },
        { x: to.x - normalX * reach, y: to.y - normalY * reach },
      ];
      if (!screenBoundsVisible(corners, view, cullMargin)) return null;
      let sprite = container.children[cursor] ?? null;
      if (!sprite) {
        sprite = new TilingSpriteClass({ texture, width: 1, height: 1 });
        container.addChild(sprite);
      }
      cursor += 1;
      sprite.visible = true;
      sprite.texture = texture;
      sprite.alpha = alpha;
      // Pooled: a sprite that was a tinted wall last frame may be a plain
      // shoulder this frame.
      sprite.tint = tint;
      sprite.rotation = Math.atan2(unitY, unitX) + (forward ? 0 : Math.PI);
      sprite.position.set(originX, originY);
      sprite.width = length + overlap * 2;
      sprite.height = depth;
      sprite.tileScale?.set?.((repeatWorld / (tileSize || 512)) * camera.zoom, depth / (stripHeight || 128));
      return sprite;
    },
    finish() {
      for (let index = cursor; index < container.children.length; index += 1) {
        container.children[index].visible = false;
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
  const roadTiled = Boolean(terrainTiles?.ready && terrainTiles.textureFor?.('road'));
  const stripPlacer = createStripPlacer({
    container: worldProduction.stripSprites,
    TilingSpriteClass: worldProduction.TilingSpriteClass,
    camera,
    view,
    cullMargin: performanceProfile.worldCullMargin,
  });
  const overlayTexture = (id) => (terrainTiles?.ready ? terrainTiles.overlayTextureFor?.(id) ?? null : null);
  const shoulderTexture = overlayTexture('road-shoulder');
  const shoreTexture = overlayTexture('shore-band');
  const screeTexture = overlayTexture('scree-skirt');
  const faceTexture = overlayTexture('rock-face');
  const stripDefaults = { tileSize: terrainTiles?.tileSize ?? 512, stripHeight: terrainTiles?.overlayHeight ?? 128 };
  // W-11 / W-5: ramps tile through their own masked pool; ledge fronts, ramp
  // flanks and cliff walls are strips in containers above the layer each one
  // dresses. Every one of these is null when its container or texture is
  // absent, and the Graphics fallback then carries the height on its own.
  const rampPlacer = createTerrainSpritePlacer({ container: worldProduction.rampSprites ?? null, terrainTiles, camera, view });
  const facePlacer = createStripPlacer({
    container: worldProduction.surfaceFaceSprites ?? null,
    TilingSpriteClass: worldProduction.TilingSpriteClass,
    camera,
    view,
    cullMargin: performanceProfile.worldCullMargin,
  });
  const blockerFacePlacer = createStripPlacer({
    container: worldProduction.blockerFaceSprites ?? null,
    TilingSpriteClass: worldProduction.TilingSpriteClass,
    camera,
    view,
    cullMargin: performanceProfile.worldCullMargin,
  });
  // Ramp masks are re-traced by whichever sprite owns them; hidden until then,
  // because an unassigned mask is a white fill on screen.
  for (const mask of worldProduction.rampMasks?.children ?? []) {
    mask.clear();
    mask.visible = false;
  }
  // World bounds, so a waterline that runs off the map does not get a beach
  // along the edge of the world.
  const worldMinY = Math.min(...world.districts.map((district) => district.area.minY));
  const worldMaxY = Math.max(...world.districts.map((district) => district.area.maxY));
  // Bridge decks and their ramps are their own surface material; a gravel
  // shoulder over a plank deck would read as dirt floating on the bridge.
  const deckedSurfaces = world.surfaces.filter((surface) => (surface.kind === 'bridge' || surface.kind === 'ramp') && surface.area?.type === 'rect');
  const overDeck = (x, y) => deckedSurfaces.some((surface) => x >= surface.area.minX && x <= surface.area.maxX && y >= surface.area.minY && y <= surface.area.maxY);
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
    const routeNodes = route.nodeIds.map((id) => world.routeGraph.nodes.find((candidate) => candidate.id === id));
    const routePoints = routeNodes.map((node) => {
      const ground = queryGround(node.x,node.y);
      return project({x:node.x,y:node.y,z:ground.groundZ});
    });
    routePoints.zoom = camera.zoom;
    if (!screenBoundsVisible(routePoints, view, performanceProfile.worldCullMargin)) continue;
    const firstNode = routeNodes[0];
    drawRoute(layers, routePoints, route, DISTRICT_PRODUCTION_MATERIALS[districtAt(firstNode.x).id], roadMaskGraphic, roadTiled);
    if (!stripPlacer || !shoulderTexture) continue;
    // Both verges of every segment. The strip's inner edge sits just inside the
    // travelled width so the surface tile covers the join.
    for (let index = 1; index < routePoints.length; index += 1) {
      const midX = (routeNodes[index - 1].x + routeNodes[index].x) / 2;
      const midY = (routeNodes[index - 1].y + routeNodes[index].y) / 2;
      if (overDeck(midX, midY)) continue;
      for (const side of [1, -1]) {
        stripPlacer.placeStrip(shoulderTexture, routePoints[index - 1], routePoints[index], {
          depthWorld: SHOULDER_WORLD_DEPTH,
          sideOffsetWorld: route.width / 2 - 6,
          side,
          tileSize: terrainTiles.tileSize,
          stripHeight: terrainTiles.overlayHeight,
          alpha: route.kind === 'main' ? 0.95 : 0.82,
        });
      }
    }
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
    const isRamp = surface.kind === 'ramp';
    // W-11: the camera-facing wall of a ledge or the flank of a ramp. A bridge
    // deck over water gets none: the water tile above `surfaces` would cover
    // it, so it keeps the lip cue alone.
    const face = surface.kind === 'ledge' || isRamp ? resolveRaisedFace({ surface, points, queryGround, project }) : null;
    if (isRaised) {
      const lift = Math.max(4, 9 * camera.zoom);
      // The whole mass casts, from the deck's north edge down past the foot.
      const footprint = face ? [points[0], points[1], face.footEast, face.footWest] : points;
      const shadow = footprint.map((point) => ({ x: point.x + lift * 0.55, y: point.y + lift }));
      tracePolygon(layers.surfaces, shadow).fill({ color: 0x03070b, alpha: 0.42 });
    }
    // W-4: once a waterline carries an authored wet-sand band the bright hairline
    // outline is what made it read as a map overlay, so it drops to a hint.
    // Raised surfaces and ramps keep a thin one: with the wall drawn under the
    // lip, the old 4 px outline only made the top read as an outlined panel.
    const bandedShore = isWater && Boolean(shoreTexture) && surface.kind === 'water';
    const outlined = isRaised || isRamp;
    tracePolygon(layers.surfaces,points)
      .fill({color:surfaceBase.color,alpha:surfaceBase.alpha})
      .stroke({color:surfaceBase.strokeColor,width:outlined?2:bandedShore?2:3,alpha:isWater?(bandedShore?0.3:0.8):outlined?0.55:0.9});
    if (face) {
      drawRaisedFace({
        layers,
        cueLayer,
        face,
        baseColor: kit.groundColor,
        capColor: mixColor(surfaceBase.color, 0xffffff, 0.5),
        camera,
        facePlacer,
        texture: faceTexture,
        tint: faceTint(kit.groundColor),
        stripDefaults,
        worldProduction,
        // A flank tapers to nothing at the low end, so it gets no foot band.
        contact: !isRamp,
      });
    }
    // Authored material over the flat base for rectangular surfaces; the base
    // colour remains visible for non-rect shapes and when tiles are absent.
    const surfaceMaterial = SURFACE_TERRAIN_MATERIAL[surface.kind];
    if (surfaceMaterial && surface.area.type === 'rect' && points.length >= 4) {
      const minX = Math.min(...points.map((point) => point.x));
      const maxX = Math.max(...points.map((point) => point.x));
      const minY = Math.min(...points.map((point) => point.y));
      const maxY = Math.max(...points.map((point) => point.y));
      if (isRamp) {
        // A ramp's projected outline is a parallelogram (its high corners sit
        // higher on screen), so the tile is clipped to that polygon instead of
        // overpainting two triangles of ground outside it.
        const rampTile = rampPlacer?.place(surfaceMaterial, minX, minY, maxX - minX, maxY - minY, surfaceBase.alpha) ?? null;
        if (rampTile) clipToPolygon(rampTile, points, worldProduction);
      } else {
        surfacePlacer?.place(surfaceMaterial, minX, minY, maxX - minX, maxY - minY, surfaceBase.alpha);
      }
    }
    if (isRamp && points.length >= 4) drawRampGrade(cueLayer, surface, points, camera.zoom);
    if (surface.kind === 'water' && shoreTexture && stripPlacer && surface.area.type === 'rect' && points.length >= 4) {
      // W-4: authored wet sand and a broken foam line on the land side of every
      // waterline, so a river stops ending at a drawn rectangle. Row 0 of the
      // strip is the waterline itself and the band fades inland; the opaque
      // water fill above covers whatever laps back over the surface.
      const edges = [
        { from: 0, to: 1, worldY: surface.area.minY },
        { from: 1, to: 2, worldY: null },
        { from: 2, to: 3, worldY: surface.area.maxY },
        { from: 3, to: 0, worldY: null },
      ];
      for (const edge of edges) {
        if (edge.worldY !== null && (edge.worldY <= worldMinY || edge.worldY >= worldMaxY)) continue;
        stripPlacer.placeStrip(shoreTexture, points[edge.from], points[edge.to], {
          ...stripDefaults,
          depthWorld: SHORE_WORLD_DEPTH,
          side: -1,
          alpha: 0.94,
        });
      }
    }
    if (isRaised && surface.kind === 'ledge' && screeTexture && stripPlacer && points.length >= 4) {
      // W-4: the debris a ledge front sheds onto the ground below it, deeper
      // under a taller deck. W-11 moved it from the lip to the foot of the
      // wall: anchored at the lip it hung down the unrendered face and never
      // reached the ground it is supposed to lie on.
      stripPlacer.placeStrip(screeTexture, face?.footEast ?? points[2], face?.footWest ?? points[3], {
        ...stripDefaults,
        depthWorld: SCREE_WORLD_DEPTH + Math.min(28, (surface.groundZ ?? 0) * 0.32),
        side: -1,
        alpha: 0.9,
      });
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
      if (!face) {
        // No wall drawn under this lip (a deck over water, or a surface flush
        // with its footing): the dark lip stays the only cue.
        cueLayer.moveTo(points[2].x, points[2].y).lineTo(points[3].x, points[3].y)
          .stroke({ color: 0x05090d, width: Math.max(3, 5 * camera.zoom), alpha: 0.6 });
      }
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
    if (feature.visualKind === 'cliff' && shape.type === 'capsule' && screeTexture && stripPlacer) {
      // W-4: rock faces shed chips down both flanks, so a cliff meets the
      // ground instead of being a capsule laid on top of it.
      for (const side of [1, -1]) {
        stripPlacer.placeStrip(screeTexture, points[0], points[1], {
          ...stripDefaults,
          depthWorld: SCREE_WORLD_DEPTH,
          sideOffsetWorld: shape.radius,
          side,
          alpha: 0.88,
        });
      }
    }
    const layer = feature.id.startsWith('town-') ? layers.townBlockers : layers.blockers;
    drawBlocker(layer, feature, BLOCKER_PRODUCTION_KITS[feature.visualKind], camera, (point, activeCamera) => project(point,activeCamera));
    if (feature.visualKind === 'cliff' && shape.type === 'capsule' && faceTexture && blockerFacePlacer) {
      // W-5 (partial): the authored rock face along the wall's straight run,
      // in the container above the body drawn into `blockers`.
      placeCliffFace({ feature, kit: BLOCKER_PRODUCTION_KITS.cliff, camera, project, placer: blockerFacePlacer, texture: faceTexture, stripDefaults });
    }
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
  rampPlacer?.finish();
  stripPlacer?.finish();
  facePlacer?.finish();
  blockerFacePlacer?.finish();
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
