import { createHash } from 'node:crypto';

import { createEnemyNavGrid } from './enemy-navgrid.mjs';
import {
  buildLayoutV2World,
  layoutV2RoadClearWidth,
  layoutV2RoadSamples,
  layoutV2ShapeDistance,
} from './layout-v2-kit.mjs';

// Layout v2 checker (design package section 2.9, built in S0.3/S2.0). Runs the
// real enemy navgrid over a layout and evaluates the per-district gates:
//
//  1 reachability share         5 spacing rules
//  2 no unreachable pockets     6 corridor-width, road-clearance and cover sweeps
//  3 sealed-lock arena floods   7 empty 400 x 400 cells
//  4 spawn sanctuaries / lair   + seam connectivity through the intended
//    coverage                     crossings, crossing cuts and the highway
//                                 sightline (longest straight)
//
// Gates 8-14 (density v2, decoded memory, build time, determinism, visual
// review, browser smoke, XS Max scenes, briefing) live in their own harnesses;
// the test that runs this checker measures build time and determinism.
//
// Node-only (node:crypto): never imported by the runtime.

export const LAYOUT_V2_GATE_LIMITS = Object.freeze({
  reachMin: 0.5,
  reachMax: 0.8,
  lairPathMax: 2_600,
  viewHalfWidth: 720,
  viewHalfHeight: 450,
  heroSpawnMin: 560,
  lairCoverageShare: 0.9,
  lairInteractionMin: 700,
  lairArenaPad: 200,
  lairHazardPad: 200,
  entryBossMin: 900,
  interactionClearance: 24,
  coverRadius: 250,
  coverSampleStep: 50,
  highwayLongestStraight: 1_000,
  arenaRadiusMin: 330,
  arenaRadiusMax: 520,
  emptyTile: 400,
  emptyTilesMax: 3,
});

const STEP = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function flood(grid, startCell) {
  const distance = new Int32Array(grid.walkable.length).fill(-1);
  if (startCell < 0) return distance;
  const queue = new Int32Array(grid.walkable.length);
  let head = 0;
  let tail = 0;
  distance[startCell] = 0;
  queue[tail++] = startCell;
  while (head < tail) {
    const cell = queue[head++];
    const column = cell % grid.columns;
    const row = (cell - column) / grid.columns;
    const mask = grid.edges[cell];
    for (let k = 0; k < STEP.length; k += 1) {
      if (!(mask & (1 << k))) continue;
      const next = (row + STEP[k][1]) * grid.columns + column + STEP[k][0];
      if (distance[next] !== -1) continue;
      distance[next] = distance[cell] + 1;
      queue[tail++] = next;
    }
  }
  return distance;
}

// The walkable cell nearest a point (rings of cells), or -1.
function anchorCell(grid, x, y, rings = 2) {
  const column = Math.floor((x - grid.minX) / grid.cellSize);
  const row = Math.floor((y - grid.minY) / grid.cellSize);
  let best = -1;
  let bestDistance = Infinity;
  for (let dy = -rings; dy <= rings; dy += 1) {
    for (let dx = -rings; dx <= rings; dx += 1) {
      const c = column + dx;
      const r = row + dy;
      if (!grid.isWalkableCell(c, r)) continue;
      const d = Math.hypot(grid.centreX(c) - x, grid.centreY(r) - y);
      if (d < bestDistance) { bestDistance = d; best = r * grid.columns + c; }
    }
  }
  return best;
}

function cellCentre(grid, cell) {
  const column = cell % grid.columns;
  return { x: grid.centreX(column), y: grid.centreY((cell - column) / grid.columns) };
}

const inRect = ([minX, minY, maxX, maxY], x, y, pad = 0) => x >= minX - pad && x <= maxX + pad && y >= minY - pad && y <= maxY + pad;

function districtOf(layout, x) {
  return layout.districts.find((district) => x >= district.minX && x < district.maxX) ?? layout.districts.at(-1);
}

function gridHash(grid) {
  return createHash('sha256').update(grid.walkable).update(grid.edges).digest('hex');
}

export function buildLayoutV2Grids(layout) {
  const world = (gates) => buildLayoutV2World(layout, { gates });
  const open = world('open');
  const start = world((gate) => gate.role === 'arena-lock');
  const sealed = world('closed');
  const grid = (built) => createEnemyNavGrid({ world: built, queryGround: built.queryGround });
  return { open, start, sealed, openGrid: grid(open), startGrid: grid(start), sealedGrid: grid(sealed) };
}

export function checkLayoutV2(layout, grids = buildLayoutV2Grids(layout)) {
  const limits = LAYOUT_V2_GATE_LIMITS;
  const { open, openGrid, startGrid, sealedGrid } = grids;
  const failures = [];
  const fail = (gate, district, detail) => failures.push({ gate, district: district ?? null, detail });
  const enforced = (districtId) => layout.districts.find((district) => district.id === districtId)?.status === 'greybox';
  const spawn = layout.player.spawn;
  const spawnCell = anchorCell(openGrid, spawn.x, spawn.y);
  const reach = flood(openGrid, spawnCell);
  const startReach = flood(startGrid, anchorCell(startGrid, spawn.x, spawn.y));
  const statics = open.collisionBlockers;

  // Gate 1 and 2: reachability share, and no unreachable walkable cells.
  const districts = Object.fromEntries(layout.districts.map((district) => [district.id, { cells: 0, reached: 0, unreachable: 0, share: 0, sanctuaries: 0, sanctuaryCells: [], heroCells: 0, covered: 0, lairCoverage: 0, emptyTiles: [] }]));
  for (let cell = 0; cell < openGrid.walkable.length; cell += 1) {
    const { x, y } = cellCentre(openGrid, cell);
    const stats = districts[districtOf(layout, x).id];
    stats.cells += 1;
    if (reach[cell] >= 0) stats.reached += 1;
    else if (openGrid.walkable[cell]) stats.unreachable += 1;
  }
  let totalCells = 0;
  let totalReached = 0;
  for (const district of layout.districts) {
    const stats = districts[district.id];
    stats.share = stats.reached / stats.cells;
    totalCells += stats.cells;
    totalReached += stats.reached;
    if (enforced(district.id) && (stats.share < limits.reachMin || stats.share > limits.reachMax)) fail('reachability', district.id, `reachable share ${(stats.share * 100).toFixed(1)}% outside 50-80%`);
    if (stats.unreachable > 0) fail('unreachable-pocket', district.id, `${stats.unreachable} walkable cells no route reaches`);
  }

  // Pockets: sealed at the start by their gate, reachable once it opens.
  for (const pocket of layout.pockets ?? []) {
    let walkable = 0;
    let reachedOpen = 0;
    let reachedStart = 0;
    for (let cell = 0; cell < openGrid.walkable.length; cell += 1) {
      const { x, y } = cellCentre(openGrid, cell);
      if (!inRect(pocket.rect, x, y)) continue;
      if (openGrid.walkable[cell]) walkable += 1;
      if (reach[cell] >= 0) reachedOpen += 1;
      if (startReach[cell] >= 0) reachedStart += 1;
    }
    if (walkable === 0 || reachedOpen === 0) fail('pocket', pocket.district, `${pocket.id} has no reachable floor once ${pocket.gate} opens`);
    if (reachedStart > 0) fail('pocket', pocket.district, `${pocket.id} is reachable before ${pocket.gate} opens (${reachedStart} cells)`);
  }

  // Gate 3: every arena seals. A flood from its centre with every gate shut
  // must stay inside its seal region (one cell of tolerance for the mouths).
  for (const arena of layout.arenas ?? []) {
    const [cx, cy] = arena.center;
    if (arena.radius < limits.arenaRadiusMin || arena.radius > limits.arenaRadiusMax) fail('arena-seal', arena.district, `${arena.id} radius ${arena.radius} outside r330-520`);
    const centreCell = anchorCell(sealedGrid, cx, cy);
    if (centreCell < 0 || reach[anchorCell(openGrid, cx, cy)] < 0) { fail('arena-seal', arena.district, `${arena.id} centre is not reachable floor`); continue; }
    const sealedFlood = flood(sealedGrid, centreCell);
    let escaped = 0;
    let inside = 0;
    for (let cell = 0; cell < sealedFlood.length; cell += 1) {
      if (sealedFlood[cell] < 0) continue;
      const { x, y } = cellCentre(sealedGrid, cell);
      if (inRect(arena.sealRegion, x, y, sealedGrid.cellSize)) inside += 1;
      else escaped += 1;
    }
    if (escaped > 0) fail('arena-seal', arena.district, `${arena.id} sealed flood escapes through ${escaped} cells`);
    void inside;
  }

  // Gate 4: spawn sanctuaries and lair coverage, on enemy path distance.
  const lairFloods = [];
  for (const lair of layout.lairs ?? []) {
    const cell = anchorCell(openGrid, lair.x, lair.y, 1);
    if (cell < 0 || reach[cell] < 0) { fail('lair', lair.district, `${lair.id} is not on reachable floor`); continue; }
    lairFloods.push({ lair, distance: flood(openGrid, cell) });
  }
  const maxSteps = Math.floor(limits.lairPathMax / openGrid.cellSize);
  const inArena = (x, y) => (layout.arenas ?? []).some((arena) => Math.hypot(x - arena.center[0], y - arena.center[1]) <= arena.radius);
  for (let cell = 0; cell < reach.length; cell += 1) {
    if (reach[cell] < 0) continue;
    const { x, y } = cellCentre(openGrid, cell);
    if (inArena(x, y)) continue;
    const stats = districts[districtOf(layout, x).id];
    let valid = 0;
    for (const { lair, distance } of lairFloods) {
      const steps = distance[cell];
      if (steps < 0 || steps > maxSteps) continue;
      if (Math.abs(lair.x - x) <= limits.viewHalfWidth && Math.abs(lair.y - y) <= limits.viewHalfHeight) continue;
      if (Math.hypot(lair.x - x, lair.y - y) < limits.heroSpawnMin) continue;
      valid += 1;
      if (valid >= 2) break;
    }
    stats.heroCells += 1;
    if (valid === 0) { stats.sanctuaries += 1; if (stats.sanctuaryCells.length < 12) stats.sanctuaryCells.push([x, y]); }
    if (valid >= 2) stats.covered += 1;
  }
  for (const district of layout.districts) {
    const stats = districts[district.id];
    stats.lairCoverage = stats.heroCells ? stats.covered / stats.heroCells : 1;
    if (!enforced(district.id)) continue;
    if (stats.sanctuaries > 0) fail('spawn-sanctuary', district.id, `${stats.sanctuaries} reachable cells have no valid lair, e.g. ${stats.sanctuaryCells.map(([x, y]) => `(${x}, ${y})`).join(' ')}`);
    if (stats.lairCoverage < limits.lairCoverageShare) fail('lair-coverage', district.id, `${(stats.lairCoverage * 100).toFixed(1)}% of cells have two valid lairs (need 90%)`);
  }

  // Gate 5: spacing.
  const bossPoints = [
    ...(layout.interactions ?? []).filter((site) => site.kind === 'prisoner' || site.kind === 'boss-trigger'),
  ];
  for (const lair of layout.lairs ?? []) {
    if (!enforced(lair.district)) continue;
    for (const site of layout.interactions ?? []) {
      const gap = Math.hypot(site.x - lair.x, site.y - lair.y);
      if (gap < limits.lairInteractionMin) fail('spacing', lair.district, `${lair.id} is ${gap.toFixed(0)} from ${site.id} (need 700)`);
    }
    for (const arena of layout.arenas ?? []) {
      const gap = Math.hypot(arena.center[0] - lair.x, arena.center[1] - lair.y);
      if (gap < arena.radius + limits.lairArenaPad) fail('spacing', lair.district, `${lair.id} is inside ${arena.id} radius + 200`);
    }
    for (const hazard of layout.hazards ?? []) {
      const gap = Math.hypot(hazard.x - lair.x, hazard.y - lair.y);
      if (gap < hazard.radius + limits.lairHazardPad) fail('spacing', lair.district, `${lair.id} is inside ${hazard.id} radius + 200`);
    }
  }
  for (const entry of layout.entries ?? []) {
    for (const site of bossPoints) {
      const gap = Math.hypot(site.x - entry.x, site.y - entry.y);
      if (gap < limits.entryBossMin) fail('spacing', entry.district, `entry ${entry.id} is ${gap.toFixed(0)} from ${site.id} (need 900)`);
    }
    if (reach[anchorCell(openGrid, entry.x, entry.y)] < 0) fail('spacing', entry.district, `entry ${entry.id} is not reachable floor`);
  }
  for (const site of layout.interactions ?? []) {
    if (!enforced(site.district)) continue;
    const clearance = Math.min(...statics.map((blocker) => layoutV2ShapeDistance(blocker.shape, site.x, site.y)));
    if (clearance < limits.interactionClearance) fail('spacing', site.district, `${site.id} sits ${clearance.toFixed(0)} from a blocker (need 24)`);
    const openCell = anchorCell(openGrid, site.x, site.y);
    if (openCell < 0 || reach[openCell] < 0) fail('spacing', site.district, `${site.id} is not reachable`);
    if (!site.gated) {
      const startCell = anchorCell(startGrid, site.x, site.y);
      if (startCell < 0 || startReach[startCell] < 0) fail('spacing', site.district, `${site.id} is not reachable before any chain`);
    }
  }

  // Gate 6: corridor width, road clearance, the highway's gates, the cover
  // rule and the highway sightline (longest straight).
  const gates = open.gateBlockers;
  for (const road of layout.roads ?? []) {
    const clear = layoutV2RoadClearWidth(road);
    const highway = road.tier === 'highway';
    let wet = 0;
    for (const sample of layoutV2RoadSamples(road)) {
      const district = districtOf(layout, sample.x).id;
      const gap = Math.min(...statics.map((blocker) => layoutV2ShapeDistance(blocker.shape, sample.x, sample.y)));
      if (gap + 1e-6 < clear / 2 && enforced(district)) fail('road-clearance', district, `${road.id} has ${(gap * 2).toFixed(0)} clear at (${sample.x.toFixed(0)}, ${sample.y.toFixed(0)}), needs ${clear}`);
      for (const offset of [-0.45 * clear, 0, 0.45 * clear]) {
        const ground = open.queryGround(sample.x + sample.nx * offset, sample.y + sample.ny * offset);
        if (!ground.walkable) wet += 1;
      }
      if (highway) {
        for (const gate of gates) {
          if (layoutV2ShapeDistance(gate.shape, sample.x, sample.y) < clear / 2) fail('road-clearance', district, `the highway is gated by ${gate.id}`);
        }
      }
    }
    if (wet > 0) fail('road-clearance', null, `${road.id} has ${wet} road samples off walkable ground`);
    if (highway) {
      for (let index = 1; index < road.points.length; index += 1) {
        const [ax, ay] = road.points[index - 1];
        const [bx, by] = road.points[index];
        const length = Math.hypot(bx - ax, by - ay);
        if (length > limits.highwayLongestStraight) fail('sightline', districtOf(layout, ax).id, `highway straight from (${ax}, ${ay}) runs ${length.toFixed(0)} (max 1,000)`);
      }
      const covers = statics.filter((blocker) => blocker.combatCover);
      const uncovered = new Map();
      for (const sample of layoutV2RoadSamples(road, limits.coverSampleStep)) {
        const district = districtOf(layout, sample.x).id;
        if (!enforced(district)) continue;
        const nearest = Math.min(...covers.map((blocker) => layoutV2ShapeDistance(blocker.shape, sample.x, sample.y)));
        if (nearest > limits.coverRadius) uncovered.set(district, [...(uncovered.get(district) ?? []), `(${sample.x.toFixed(0)}, ${sample.y.toFixed(0)})`]);
      }
      for (const [district, points] of uncovered) fail('cover', district, `no hard cover within 250 of highway points ${points.slice(0, 6).join(' ')}${points.length > 6 ? ` +${points.length - 6}` : ''}`);
    }
  }
  for (const deck of layout.decks ?? []) {
    const [minX, minY, maxX, maxY] = deck.rect;
    const width = deck.span === 'y' ? maxX - minX : maxY - minY;
    if (deck.clear > width + 32) fail('crossing-width', deck.district, `${deck.id} deck ${width} cannot give ${deck.clear} clear`);
  }

  // Seam connectivity: every legal crossing of a district boundary lies inside
  // an intended opening, and every intended opening is crossable both ways.
  for (const seam of layout.seams ?? []) {
    const column = Math.round((seam.x - openGrid.minX) / openGrid.cellSize);
    const hits = seam.openings.map(() => ({ east: false, west: false }));
    for (let row = 0; row < openGrid.rows; row += 1) {
      const west = row * openGrid.columns + column - 1;
      const east = west + 1;
      const eastward = (openGrid.edges[west] & 1) !== 0 && reach[west] >= 0;
      const westward = (openGrid.edges[east] & 2) !== 0 && reach[east] >= 0;
      if (!eastward && !westward) continue;
      const y = openGrid.centreY(row);
      const index = seam.openings.findIndex(([minY, maxY]) => y >= minY && y <= maxY);
      if (index < 0) { fail('seam', districtOf(layout, seam.x).id, `unintended crossing at x ${seam.x}, y ${y}`); continue; }
      if (eastward) hits[index].east = true;
      if (westward) hits[index].west = true;
    }
    seam.openings.forEach(([, , name], index) => {
      if (!hits[index].east || !hits[index].west) fail('seam', districtOf(layout, seam.x).id, `opening ${name} at x ${seam.x} is not crossable both ways`);
    });
  }

  // Crossing cuts: removing the named crossings must split the two points
  // (or, with viaAllowed, force the long way round).
  const cutResults = [];
  const decks = new Map((layout.decks ?? []).map((deck) => [deck.id, deck]));
  for (const cut of layout.cuts ?? []) {
    const from = anchorCell(openGrid, ...cut.from);
    const to = anchorCell(openGrid, ...cut.to);
    const baseline = flood(openGrid, from)[to];
    if (baseline < 0) { fail('crossing-cut', null, `${cut.id}: the two sides are not connected at all`); continue; }
    const walkable = Uint8Array.from(openGrid.walkable);
    const edges = Uint8Array.from(openGrid.edges);
    for (const id of cut.remove) {
      const deck = decks.get(id);
      if (!deck) { fail('crossing-cut', null, `${cut.id}: unknown crossing ${id}`); continue; }
      for (let cell = 0; cell < walkable.length; cell += 1) {
        const { x, y } = cellCentre(openGrid, cell);
        if (inRect(deck.rect, x, y)) { walkable[cell] = 0; edges[cell] = 0; }
      }
    }
    for (let cell = 0; cell < walkable.length; cell += 1) {
      if (!walkable[cell]) continue;
      const column = cell % openGrid.columns;
      const row = (cell - column) / openGrid.columns;
      for (let k = 0; k < STEP.length; k += 1) {
        const c = column + STEP[k][0];
        const r = row + STEP[k][1];
        if (c < 0 || r < 0 || c >= openGrid.columns || r >= openGrid.rows || !walkable[r * openGrid.columns + c]) edges[cell] &= ~(1 << k);
      }
    }
    const cutDistance = flood({ ...openGrid, walkable, edges }, from)[to];
    cutResults.push({ id: cut.id, baselinePath: baseline * openGrid.cellSize, cutPath: cutDistance < 0 ? null : cutDistance * openGrid.cellSize });
    if (cut.viaAllowed) {
      if (cutDistance < 0 || cutDistance < baseline * 2) fail('crossing-cut', null, `${cut.id}: removing ${cut.remove.join(', ')} should force the long way via ${cut.viaAllowed}`);
    } else if (cutDistance >= 0) {
      fail('crossing-cut', null, `${cut.id}: still connected without ${cut.remove.join(', ')}`);
    }
  }

  // Gate 7: empty reachable 400 x 400 cells per district.
  const exempt = (minX, minY, maxX, maxY) => (layout.openExemptions ?? []).some((zone) => {
    if (zone.rect) return minX < zone.rect[2] && maxX > zone.rect[0] && minY < zone.rect[3] && maxY > zone.rect[1];
    const [x, y, radius] = zone.circle;
    return Math.hypot(Math.max(minX, Math.min(x, maxX)) - x, Math.max(minY, Math.min(y, maxY)) - y) <= radius;
  }) || (layout.arenas ?? []).some((arena) => {
    const [x, y] = arena.center;
    return Math.hypot(Math.max(minX, Math.min(x, maxX)) - x, Math.max(minY, Math.min(y, maxY)) - y) <= arena.radius;
  });
  const features = [...(layout.interactions ?? []), ...(layout.lairs ?? [])];
  const tile = limits.emptyTile;
  for (const district of layout.districts) {
    for (let minX = district.minX; minX + tile <= district.maxX; minX += tile) {
      for (let minY = 0; minY + tile <= open.bounds.maxY; minY += tile) {
        const maxX = minX + tile;
        const maxY = minY + tile;
        if (exempt(minX, minY, maxX, maxY)) continue;
        if (features.some((site) => site.x >= minX && site.x < maxX && site.y >= minY && site.y < maxY)) continue;
        let empty = true;
        for (let row = Math.floor(minY / openGrid.cellSize); empty && openGrid.centreY(row) < maxY; row += 1) {
          for (let column = Math.floor(minX / openGrid.cellSize); openGrid.centreX(column) < maxX; column += 1) {
            if (openGrid.centreX(column) < minX || openGrid.centreY(row) < minY) continue;
            if (reach[row * openGrid.columns + column] < 0) { empty = false; break; }
          }
        }
        if (empty) districts[district.id].emptyTiles.push([minX, minY]);
      }
    }
    const count = districts[district.id].emptyTiles.length;
    if (enforced(district.id) && count > limits.emptyTilesMax) fail('empty-space', district.id, `${count} empty reachable 400 x 400 cells (max 3): ${districts[district.id].emptyTiles.map(([x, y]) => `(${x}, ${y})`).join(' ')}`);
  }

  return {
    ok: failures.length === 0,
    failures,
    districts,
    overallShare: totalReached / totalCells,
    openGridHash: gridHash(openGrid),
    walkableCells: openGrid.walkable.reduce((sum, value) => sum + value, 0),
    blockers: open.collisionBlockers.length,
    cuts: cutResults,
  };
}

export function formatLayoutV2Report(report, layout) {
  const lines = [`layout ${layout.id}: ${report.ok ? 'PASS' : `FAIL (${report.failures.length})`}  overall reachable ${(report.overallShare * 100).toFixed(1)}%  blockers ${report.blockers}`];
  for (const district of layout.districts) {
    const stats = report.districts[district.id];
    lines.push(`  ${district.id.padEnd(20)} ${district.status.padEnd(8)} reach ${(stats.share * 100).toFixed(1).padStart(5)}%  sanctuaries ${stats.sanctuaries}  2+ lairs ${(stats.lairCoverage * 100).toFixed(1)}%  empty ${stats.emptyTiles.length}`);
  }
  for (const cut of report.cuts) lines.push(`  cut ${cut.id}: ${cut.baselinePath} -> ${cut.cutPath ?? 'disconnected'}`);
  for (const failure of report.failures) lines.push(`  x [${failure.gate}] ${failure.district ?? 'map'}: ${failure.detail}`);
  return lines.join('\n');
}
