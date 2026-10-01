// 2.1: in the ten-area world a body pushed diagonally along a ledge it may
// not cross slides along it (traversal-slide.mjs) instead of stopping dead.
// The step below is the hero's main.mjs step and the enemy simulation's: the
// swept collision, the swept traversal, then (ten-area only) the slide.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createWorldV2RuntimeWorld, createWorldV2GroundQuery, isWorldV2PointClear } from '../apps/hmh-reboot/src/world-v2-runtime-world.mjs';
import { createCollisionBody, resolveSweptCircleMotion } from '../apps/hmh-reboot/src/collision.mjs';
import { resolveSweptTraversalPath } from '../apps/hmh-reboot/src/elevation.mjs';
import { slideRefusedTraversal } from '../apps/hmh-reboot/src/traversal-slide.mjs';
import { CONSERVATIVE_TRANSITION } from '../apps/hmh-reboot/src/enemy-navgrid.mjs';

const world = createWorldV2RuntimeWorld();
const queryGround = createWorldV2GroundQuery(world);
const pieces = world.artPlans.authored.pieces;

function stepper(radius, { slide, transitionOptions = {} }) {
  const body = createCollisionBody({ id: `slide-${radius}`, kind: radius === 24 ? 'player' : 'regular', radius, minZ: 0, maxZ: 72 });
  const sweep = (p, d) => resolveSweptCircleMotion({ body, start: { x: p.x, y: p.y, z: queryGround(p.x, p.y).groundZ }, delta: d, blockers: world.collisionBlockers, bounds: world.bounds }).position;
  return (p, d) => {
    const end = sweep(p, d), maxSampleDistance = Math.max(4, radius / 2);
    let t = resolveSweptTraversalPath({ start: p, end, queryGround, maxSampleDistance, transitionOptions });
    if (!t.allowed && slide) { const s = slideRefusedTraversal({ attempt: t, end, queryGround, sweep, maxSampleDistance, transitionOptions }); if (s.moved) t = { ...t, position: s.position }; }
    return t.position;
  };
}
const push = (step, from, dir, frames = 30) => { let p = { ...from }; for (let i = 0; i < frames; i++) p = step(p, dir); return p; };

// Ledges: every deck's free sides (not where a ramp abuts) and every ramp's
// long sides, approached from the ground below and from the raised top.
function ledgeCases() {
  const cases = [];
  const raised = pieces.filter(piece => piece.kind === 'deck' || piece.kind === 'ramp');
  const rampAt = (b, side) => pieces.some(piece => piece.kind === 'ramp' && (side === 'west' ? piece.visible.bounds.maxX === b.minX : side === 'east' ? piece.visible.bounds.minX === b.maxX : side === 'north' ? piece.visible.bounds.maxY === b.minY : piece.visible.bounds.minY === b.maxY)
    && (side === 'west' || side === 'east' ? piece.visible.bounds.minY < b.maxY && piece.visible.bounds.maxY > b.minY : piece.visible.bounds.minX < b.maxX && piece.visible.bounds.maxX > b.minX));
  for (const piece of raised) {
    const b = piece.visible.bounds, cls = piece.kind === 'deck' ? 'deck-ledge' : 'ramp-side';
    for (const side of ['north', 'south', 'west', 'east']) {
      if (piece.kind === 'deck' && rampAt(b, side)) continue;
      if (piece.kind === 'ramp' && (piece.surface.axis === 'y' ? ['north', 'south'] : ['west', 'east']).includes(side)) continue; // a ramp's ends are walked
      const horizontal = side === 'north' || side === 'south';
      const out = side === 'north' ? { x: 0, y: -1 } : side === 'south' ? { x: 0, y: 1 } : side === 'west' ? { x: -1, y: 0 } : { x: 1, y: 0 };
      // On a ramp the high end is where the side drop exceeds the drop limit.
      const t = piece.kind === 'ramp' ? ((piece.surface.fromZ ?? 0) < (piece.surface.toZ ?? 0) ? 0.8 : 0.2) : 0.5;
      const mid = horizontal ? { x: b.minX + (b.maxX - b.minX) * t, y: side === 'north' ? b.minY : b.maxY } : { x: side === 'west' ? b.minX : b.maxX, y: b.minY + (b.maxY - b.minY) * t };
      const along = horizontal ? { x: 1, y: 0 } : { x: 0, y: 1 };
      for (const [where, offset, inward] of [['below', 40, -1], ['above', -40, 1]]) {
        const start = { x: mid.x + out.x * offset, y: mid.y + out.y * offset };
        if (!isWorldV2PointClear(world, queryGround, start)) continue;
        // Diagonal: toward the ledge (from below) or over it (from above), and along it.
        const toward = where === 'below' ? { x: -out.x, y: -out.y } : out;
        for (const sign of [1, -1]) cases.push({ id: `${piece.id}:${side}:${where}:${sign > 0 ? '+' : '-'}`, cls, start, dir: { x: (toward.x + along.x * sign) * 4 / Math.SQRT2, y: (toward.y + along.y * sign) * 4 / Math.SQRT2 }, along: { x: along.x * sign, y: along.y * sign } });
      }
    }
  }
  return cases;
}
const CASES = ledgeCases();

test('a diagonal push along every deck ledge and ramp side slides in the ten-area world (hero and enemy)', () => {
  const classes = new Set(CASES.map(c => c.cls));
  assert.deepEqual([...classes].sort(), ['deck-ledge', 'ramp-side']);
  assert.ok(CASES.length >= 60, `${CASES.length} ledge pushes`);
  const hero = stepper(24, { slide: true }), enemy = stepper(18, { slide: true, transitionOptions: CONSERVATIVE_TRANSITION });
  let refusedBefore = 0;
  const legacyHero = stepper(24, { slide: false });
  for (const c of CASES) {
    // The push must reach the ledge for the case to mean anything: without the
    // slide it stops dead somewhere along the way.
    const stuck = push(legacyHero, c.start, c.dir);
    const stuckAlong = (stuck.x - c.start.x) * c.along.x + (stuck.y - c.start.y) * c.along.y;
    if (stuckAlong < 60) refusedBefore++;
    for (const [name, step] of [['hero', hero], ['enemy', enemy]]) {
      const end = push(step, c.start, c.dir);
      const slid = (end.x - c.start.x) * c.along.x + (end.y - c.start.y) * c.along.y;
      // 30 frames of a 4-unit diagonal step carry ~85 units along the ledge;
      // a blocker or a corner may end the slide early, a refused step may not.
      const blockedBySolid = !isWorldV2PointClear(world, queryGround, { x: end.x + c.along.x * 8, y: end.y + c.along.y * 8 }, name === 'hero' ? 24 : 18);
      assert.ok(slid >= 60 || blockedBySolid, `${name} ${c.id} slid only ${slid.toFixed(1)}`);
    }
  }
  assert.ok(refusedBefore >= CASES.length / 2, `${refusedBefore} of ${CASES.length} pushes stopped dead without the slide`);
});

test('the slide is wired only for the ten-area world context, never the legacy world', () => {
  const main = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /TRAVERSAL_SLIDE = context\.legacy === false;/);
  assert.equal((main.match(/slideRefusedTraversal\(/g) ?? []).length, 1);
  assert.match(main, /if \(!lastTraversal\.allowed && TRAVERSAL_SLIDE\) \{/);
  assert.match(main, /\.\.\.\(TRAVERSAL_SLIDE \? \{ traversalSlide: true \} : \{\}\)/);
  const sim = readFileSync(new URL('../apps/hmh-reboot/src/enemy-simulation.mjs', import.meta.url), 'utf8');
  assert.match(sim, /traversalSlide = false,/);
  assert.match(sim, /if \(!traversal\.allowed && traversalSlide\) \{/);
});

test('the slide spends only the refused axis and keeps the body on legal ground', () => {
  const deck = pieces.find(piece => piece.id === 'mweb-meadows-deck'), b = deck.visible.bounds;
  const hero = stepper(24, { slide: true });
  // From the grass below the deck's north side, pushing south-east: the body
  // runs east along the side and never climbs the 24-unit ledge.
  const start = { x: (b.minX + b.maxX) / 2 - 60, y: b.minY - 40 };
  let p = start;
  for (let i = 0; i < 30; i++) { p = hero(p, { x: 2.83, y: 2.83 }); assert.equal(queryGround(p.x, p.y).groundZ, 0); }
  assert.ok(p.x - start.x > 60);
  assert.ok(p.y < b.minY);
});

test('ten-area melee strikes see only the colliders near the striker (the Forked Standard bounds its list at 512)', () => {
  const main = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /LOCAL_MELEE_BLOCKERS = context\.legacy === false;/);
  assert.match(main, /meleeBlockers: LOCAL_MELEE_BLOCKERS \? blockersNear\(WORLD_BLOCKERS, actor\.x, actor\.y, 480\) : WORLD_BLOCKERS,/);
  assert.ok(world.collisionBlockers.length > 512, 'the whole ten-area list would throw in stepForkedStandard');
  // The densest 480-unit neighbourhood in the world stays far under the bound.
  let densest = 0;
  for (let y = 0; y <= 14000; y += 400) for (let x = 0; x <= 20000; x += 400) {
    const near = world.collisionBlockers.filter(b => { const v = b.shape.vertices ?? [b.shape.a ?? b.shape, b.shape.b ?? b.shape]; return Math.max(...v.map(p => p.x)) >= x - 480 && Math.min(...v.map(p => p.x)) <= x + 480 && Math.max(...v.map(p => p.y)) >= y - 480 && Math.min(...v.map(p => p.y)) <= y + 480; }).length;
    densest = Math.max(densest, near);
  }
  assert.ok(densest < 256, `${densest} colliders near one point`);
});
