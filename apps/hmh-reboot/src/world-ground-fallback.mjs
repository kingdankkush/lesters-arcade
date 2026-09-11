// Optional basic-graphics ground detail. Loaded only after explicit fallback selection.
function fnv1a(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function mixColor(from, to, amount) {
  const blend = Math.max(0, Math.min(1, amount));
  const channel = (shift) => Math.round(((from >>> shift) & 0xff) * (1 - blend) + ((to >>> shift) & 0xff) * blend);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
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

