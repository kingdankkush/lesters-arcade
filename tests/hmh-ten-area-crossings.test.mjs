// 2.1 QA follow-up: nothing pins the hero or traps an enemy at the ten-area
// world's bridge ends, deck ends and deep-water banks. The traversal pass
// stops a body dead (it never slides), so every edge a body can walk along
// diagonally carries a low collider (dev/greybox-edge-guards.mjs) that slides
// it first; these proofs drive the same swept collision + traversal step the
// hero and the enemy simulation use.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorldV2RuntimeWorld, createWorldV2GroundQuery, isWorldV2PointClear } from '../apps/hmh-reboot/src/world-v2-runtime-world.mjs';
import { createCollisionBody, resolveSweptCircleMotion } from '../apps/hmh-reboot/src/collision.mjs';
import { resolveSweptTraversalPath } from '../apps/hmh-reboot/src/elevation.mjs';
import { createWorldV2NavGrid } from '../apps/hmh-reboot/src/world-v2-navgrid.mjs';
import { CONSERVATIVE_TRANSITION } from '../apps/hmh-reboot/src/enemy-navgrid.mjs';

const world = createWorldV2RuntimeWorld();
const queryGround = createWorldV2GroundQuery(world);
const pieces = world.artPlans.authored.pieces;
const STEP = 4; // 240 units/s at 60 Hz

function stepper(radius, transitionOptions = {}) {
  const body = createCollisionBody({ id: `probe-${radius}`, kind: radius === 24 ? 'player' : 'regular', radius, minZ: 0, maxZ: 72 });
  return (p, d) => {
    const ground = queryGround(p.x, p.y);
    const collision = resolveSweptCircleMotion({ body, start: { x: p.x, y: p.y, z: ground.groundZ }, delta: d, blockers: world.collisionBlockers, bounds: world.bounds });
    const traversal = resolveSweptTraversalPath({ start: p, end: collision.position, queryGround, maxSampleDistance: Math.max(4, radius / 2), transitionOptions });
    return { x: traversal.position.x, y: traversal.position.y, allowed: traversal.allowed };
  };
}
const hero = stepper(24);
// Steer toward `goal` each frame; pinned = 20 frames without moving while the
// traversal pass refuses the step (a collider stop is a visible wall, not a pin).
function walk(step, from, goal, frames = 900) {
  let p = { ...from }, still = 0;
  for (let i = 0; i < frames; i++) {
    const dx = goal.x - p.x, dy = goal.y - p.y, d = Math.hypot(dx, dy);
    if (d < 6) return { arrived: true, pinned: false, at: p };
    const n = step(p, { x: dx / d * Math.min(STEP, d), y: dy / d * Math.min(STEP, d) });
    still = Math.hypot(n.x - p.x, n.y - p.y) < 0.25 && !n.allowed ? still + 1 : 0;
    p = n;
    if (still >= 20) return { arrived: false, pinned: true, at: p };
  }
  return { arrived: false, pinned: false, at: p };
}

// Each raised crossing: the deck or bridge, its ramps, and the walked axis.
function crossings() {
  return pieces.filter(piece => piece.kind === 'bridge' || piece.kind === 'deck').map(deck => {
    const b = deck.visible.bounds;
    const along = axis => pieces.filter(piece => piece.kind === 'ramp' && (axis === 'x'
      ? piece.visible.bounds.minY === b.minY && piece.visible.bounds.maxY === b.maxY && (piece.visible.bounds.maxX === b.minX || piece.visible.bounds.minX === b.maxX)
      : piece.visible.bounds.minX === b.minX && piece.visible.bounds.maxX === b.maxX && (piece.visible.bounds.maxY === b.minY || piece.visible.bounds.minY === b.maxY)));
    const axis = along('x').length >= along('y').length ? 'x' : 'y', ramps = along(axis);
    const all = [b, ...ramps.map(r => r.visible.bounds)];
    const span = { minX: Math.min(...all.map(r => r.minX)), minY: Math.min(...all.map(r => r.minY)), maxX: Math.max(...all.map(r => r.maxX)), maxY: Math.max(...all.map(r => r.maxY)) };
    return { deck, axis, ramps, span };
  });
}
const CROSSINGS = crossings();

test('every bridge and deck has its ramps; every bridge is railed and its banks are guarded', () => {
  assert.equal(CROSSINGS.filter(c => c.deck.kind === 'bridge').length, 4);
  for (const { deck, ramps } of CROSSINGS) assert.ok(ramps.length >= 1, `${deck.id} has a ramp`);
  for (const { deck } of CROSSINGS.filter(c => c.deck.kind === 'bridge')) {
    const rails = pieces.filter(piece => piece.kind === 'edge-guard' && piece.visible.guardOf === deck.id);
    assert.equal(rails.length, 2, deck.id);
    for (const rail of rails) { assert.equal(rail.blocker.combatCover, false); assert.equal(rail.blocker.maxZ, 40); assert.equal(rail.visible.areaId, null); }
  }
  const banks = pieces.filter(piece => piece.kind === 'edge-guard' && piece.visible.guardOf?.endsWith('-channel'));
  assert.ok(banks.length >= 15);
  for (const bank of banks) assert.equal(bank.blocker.maxZ, 8, 'shots and sight pass over a bank guard');
});

test('the hero walks across every bridge and up and down every deck ramp in both directions without a pin', () => {
  let walked = 0;
  for (const { deck, axis, ramps, span } of CROSSINGS) {
    const lanes = axis === 'x' ? [1 / 3, 1 / 2, 2 / 3].map(t => span.minY + (span.maxY - span.minY) * t) : [1 / 3, 1 / 2, 2 / 3].map(t => span.minX + (span.maxX - span.minX) * t);
    const b = deck.visible.bounds, mid = axis === 'x' ? (b.minX + b.maxX) / 2 : (b.minY + b.maxY) / 2;
    for (const lane of lanes) {
      const at = along => (axis === 'x' ? { x: along, y: lane } : { x: lane, y: along });
      const lo = axis === 'x' ? span.minX - 160 : span.minY - 160, hi = axis === 'x' ? span.maxX + 160 : span.maxY + 160;
      // A bridge is crossed end to end; a deck is walked up from each ramp to its middle and back.
      const legs = deck.kind === 'bridge' ? [[lo, hi], [hi, lo]] : ramps.flatMap(ramp => {
        const r = ramp.visible.bounds, foot = axis === 'x' ? (r.maxX === b.minX ? lo : hi) : (r.maxY === b.minY ? lo : hi);
        return [[foot, mid], [mid, foot]];
      });
      // A lane end beyond a ramp foot steps back toward the ramp until clear
      // (a prop or wall may stand where the open ground ends).
      const clearEnd = value => { const toward = Math.sign(mid - value); for (let k = 0; k < 6; k++) { const v = value + toward * 25 * k; if (isWorldV2PointClear(world, queryGround, at(v))) return v; } return null; };
      for (const [rawFrom, rawTo] of legs) {
        const from = rawFrom === mid ? mid : clearEnd(rawFrom), to = rawTo === mid ? mid : clearEnd(rawTo);
        if (from === null || to === null) continue; // the lane's outer end is walled off: its other lanes carry the proof
        const start = at(from), goal = at(to);
        assert.ok(isWorldV2PointClear(world, queryGround, start), `${deck.id} lane start ${start.x},${start.y} is clear`);
        const result = walk(hero, start, goal);
        assert.equal(result.pinned, false, `${deck.id} ${from}->${to} lane ${lane} pinned at ${Math.round(result.at.x)},${Math.round(result.at.y)}`);
        assert.equal(result.arrived, true, `${deck.id} ${from}->${to} lane ${lane} stopped at ${Math.round(result.at.x)},${Math.round(result.at.y)}`);
        walked++;
      }
    }
  }
  assert.ok(walked >= 60, `${walked} legs walked`);
});

test('no diagonal push pins a hero or a small enemy anywhere around a bridge end or along a guarded bank', () => {
  const diagonals = [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([x, y]) => ({ x: x * STEP / Math.SQRT2, y: y * STEP / Math.SQRT2 }));
  const enemy = stepper(18, CONSERVATIVE_TRANSITION);
  const regions = CROSSINGS.filter(c => c.deck.kind === 'bridge').map(c => ({ minX: c.span.minX - 240, minY: c.span.minY - 240, maxX: c.span.maxX + 240, maxY: c.span.maxY + 240 }));
  // The two QA pins.
  regions.push({ minX: 2560, minY: 11900, maxX: 2860, maxY: 12200 }, { minX: 7100, minY: 11180, maxX: 7420, maxY: 11480 });
  let probes = 0;
  const pins = [];
  for (const r of regions) for (let y = r.minY; y <= r.maxY; y += 30) for (let x = r.minX; x <= r.maxX; x += 30) {
    if (!isWorldV2PointClear(world, queryGround, { x, y })) continue;
    for (const [name, step] of [['hero', hero], ['enemy', enemy]]) for (const d of diagonals) {
      probes++;
      let p = { x, y }, still = 0;
      for (let i = 0; i < 45; i++) { const n = step(p, d); still = Math.hypot(n.x - p.x, n.y - p.y) < 0.25 && !n.allowed ? still + 1 : 0; p = n; if (still >= 20) { pins.push(`${name} from ${x},${y} dir ${Math.sign(d.x)},${Math.sign(d.y)} at ${Math.round(p.x)},${Math.round(p.y)}`); break; } }
    }
  }
  assert.ok(probes > 4000, `${probes} probes`);
  assert.deepEqual(pins, []);
});

test('no enemy nav cell next to a bridge or deck end traps an agent: each one is in the world network and its agent walks out across the crossing', () => {
  const grid = createWorldV2NavGrid({ world, queryGround });
  const { columns, rows, walkable, edges, neighbours } = grid;
  // Directed reachability from the spawn cell, and reverse reachability to it.
  const spawn = grid.cellAt(world.player.spawn.x, world.player.spawn.y);
  const search = reverse => {
    const seen = new Uint8Array(walkable.length), queue = [spawn]; seen[spawn] = 1;
    const incoming = reverse ? Array.from({ length: walkable.length }, () => []) : null;
    if (reverse) for (let c = 0; c < walkable.length; c++) for (let k = 0; k < 4; k++) if (edges[c] & (1 << k)) { const col = c % columns, row = (c - col) / columns; incoming[(row + neighbours[k][1]) * columns + col + neighbours[k][0]].push(c); }
    while (queue.length) {
      const c = queue.shift(), col = c % columns, row = (c - col) / columns;
      const next = reverse ? incoming[c] : [0, 1, 2, 3].filter(k => edges[c] & (1 << k)).map(k => (row + neighbours[k][1]) * columns + col + neighbours[k][0]);
      for (const n of next) if (!seen[n]) { seen[n] = 1; queue.push(n); }
    }
    return seen;
  };
  const reachable = search(false), returnable = search(true);
  const path = (from, to) => {
    const prev = new Int32Array(walkable.length).fill(-1), queue = [from]; prev[from] = from;
    while (queue.length) { const c = queue.shift(); if (c === to) break; const col = c % columns, row = (c - col) / columns; for (let k = 0; k < 4; k++) if (edges[c] & (1 << k)) { const n = (row + neighbours[k][1]) * columns + col + neighbours[k][0]; if (prev[n] < 0) { prev[n] = c; queue.push(n); } } }
    if (prev[to] < 0) return null;
    const out = []; for (let c = to; c !== from; c = prev[c]) out.push(c); return out.reverse();
  };
  const enemy = stepper(18, CONSERVATIVE_TRANSITION);
  let checked = 0;
  for (const { deck, axis, span } of CROSSINGS) {
    const b = deck.visible.bounds;
    // Deck ends: each ramp foot and each ramp/deck joint, across the full width.
    const ends = axis === 'x' ? [span.minX, b.minX, b.maxX, span.maxX] : [span.minY, b.minY, b.maxY, span.maxY];
    const far = axis === 'x' ? [{ x: span.maxX + 200, y: (span.minY + span.maxY) / 2 }, { x: span.minX - 200, y: (span.minY + span.maxY) / 2 }] : [{ x: (span.minX + span.maxX) / 2, y: span.maxY + 200 }, { x: (span.minX + span.maxX) / 2, y: span.minY - 200 }];
    const targets = far.map(p => grid.cellAt(p.x, p.y)).filter(c => c >= 0 && walkable[c]);
    for (const end of ends) {
      for (let across = (axis === 'x' ? span.minY : span.minX) - 120; across <= (axis === 'x' ? span.maxY : span.maxX) + 120; across += 60) for (const off of [-90, -30, 30, 90]) {
        const p = axis === 'x' ? { x: end + off, y: across } : { x: across, y: end + off };
        const cell = grid.cellAt(p.x, p.y);
        if (cell < 0 || !walkable[cell]) continue;
        checked++;
        assert.ok(edges[cell] !== 0, `${deck.id}: nav cell at ${p.x},${p.y} has no legal edge`);
        assert.ok(reachable[cell] && returnable[cell], `${deck.id}: nav cell at ${p.x},${p.y} is cut off from the world network`);
        // An agent standing at the cell centre follows the grid to the far side.
        const start = { x: grid.centreX(cell % columns), y: grid.centreY(Math.floor(cell / columns)) };
        const target = targets.sort((a, c) => Math.hypot(grid.centreX(a % columns) - start.x, grid.centreY(Math.floor(a / columns)) - start.y) < Math.hypot(grid.centreX(c % columns) - start.x, grid.centreY(Math.floor(c / columns)) - start.y) ? 1 : -1)[0];
        const route = path(cell, target);
        assert.ok(route, `${deck.id}: no route from ${p.x},${p.y}`);
        let at = start;
        for (const c of route) {
          const goal = { x: grid.centreX(c % columns), y: grid.centreY(Math.floor(c / columns)) };
          const leg = walk(enemy, at, goal, 120);
          assert.equal(leg.pinned, false, `${deck.id}: agent from ${p.x},${p.y} pinned at ${Math.round(leg.at.x)},${Math.round(leg.at.y)}`);
          assert.equal(leg.arrived, true, `${deck.id}: agent from ${p.x},${p.y} stuck at ${Math.round(leg.at.x)},${Math.round(leg.at.y)}`);
          at = leg.at;
        }
      }
    }
  }
  assert.ok(checked >= 200, `${checked} nav cells at deck ends checked`);
});
