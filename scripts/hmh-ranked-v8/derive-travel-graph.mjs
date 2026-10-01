// Derives the ten-area travel graph of sdk/hmh-run-contract-v8.mjs
// (HMH_V8_TRAVEL.edges) from the child's own ground, so the contract's graph
// can be checked against the world instead of trusted.
//
// The ground is sampled on a `sample`-unit lattice. Walkable samples outside
// every area are joined into regions (4-neighbours, and any two such samples
// at most `jump` units apart: a tick moves the hero at most 96, a drop's
// landing). Two areas are adjacent when one region touches both. Collision
// blockers are ignored, which can only add passages, so the result is a
// superset of where a hero can actually walk between areas without standing
// in a third one.
//   node scripts/hmh-ranked-v8/derive-travel-graph.mjs   -> prints the edges
import { createWorldV2GroundQuery, createWorldV2RuntimeWorld } from '../../apps/hmh-reboot/src/world-v2-runtime-world.mjs';

export function deriveTenAreaTravelEdges({ sample = 20, jump = 100, world = createWorldV2RuntimeWorld() } = {}) {
  const queryGround = createWorldV2GroundQuery(world);
  const columns = Math.ceil((world.bounds.maxX - world.bounds.minX) / sample) + 1;
  const rows = Math.ceil((world.bounds.maxY - world.bounds.minY) / sample) + 1;
  const walk = new Uint8Array(columns * rows);
  const area = new Int8Array(columns * rows).fill(-1);
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = world.bounds.minX + column * sample;
      const y = world.bounds.minY + row * sample;
      if (!queryGround(x, y).walkable) continue;
      const index = row * columns + column;
      walk[index] = 1;
      area[index] = world.districts.findIndex((district) => x >= district.area.minX && x <= district.area.maxX && y >= district.area.minY && y <= district.area.maxY);
    }
  }
  const parent = Int32Array.from({ length: columns * rows }, (_, index) => index);
  const find = (index) => { let at = index; while (parent[at] !== at) { parent[at] = parent[parent[at]]; at = parent[at]; } return at; };
  const reach = Math.floor(jump / sample);
  const gap = (index) => walk[index] === 1 && area[index] < 0;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const index = row * columns + column;
      if (!gap(index)) continue;
      for (let dr = -reach; dr <= reach; dr += 1) {
        for (let dc = -reach; dc <= reach; dc += 1) {
          if (dc * dc + dr * dr > reach * reach) continue;
          const r = row + dr;
          const c = column + dc;
          if (r < 0 || c < 0 || r >= rows || c >= columns) continue;
          const other = r * columns + c;
          if (gap(other)) parent[find(index)] = find(other);
        }
      }
    }
  }
  const touched = new Map();
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const index = row * columns + column;
      if (!gap(index)) continue;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const r = row + dr;
        const c = column + dc;
        if (r < 0 || c < 0 || r >= rows || c >= columns) continue;
        const other = r * columns + c;
        if (walk[other] !== 1 || area[other] < 0) continue;
        const root = find(index);
        if (!touched.has(root)) touched.set(root, new Set());
        touched.get(root).add(area[other]);
      }
    }
  }
  const edges = new Set();
  for (const areas of touched.values()) {
    const ids = [...areas].map((index) => world.districts[index].id).sort();
    for (let a = 0; a < ids.length; a += 1) for (let b = a + 1; b < ids.length; b += 1) edges.add(`${ids[a]}|${ids[b]}`);
  }
  return [...edges].sort().map((pair) => pair.split('|'));
}

if (process.argv[1]?.endsWith('derive-travel-graph.mjs')) {
  for (const [a, b] of deriveTenAreaTravelEdges()) process.stdout.write(`${a} - ${b}\n`);
}
