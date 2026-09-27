// Package §3.4 placement rules, measured on the shipped map's real collision,
// ground and hazards (slice S1.4). Rules 3 and 5-10 belong to prisoners,
// sections, entries and layout v2; rule 5's sealed courts are covered by
// tests/hmh-objective-rewards.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MISSION_OBJECTIVES, MISSION_RULES, createMissionState } from '../apps/hmh-reboot/src/mission-objectives.mjs';
import { LEVEL_ONE_WORLD as world, createLevelOneGroundQuery, getLevelOneDistrictAt } from '../apps/hmh-reboot/src/level-one-world.mjs';
import { WORLD_DESIGN_SITES, WORLD_DESIGN_SITE_PROPS } from '../apps/hmh-reboot/src/world-design-encounters.mjs';
import { WORLD_DESIGN_GROUND_PATHS, WORLD_DESIGN_NEW_LOTS } from '../apps/hmh-reboot/src/world-design-layout.mjs';
import { WORLD_HAZARD_RULES } from '../apps/hmh-reboot/src/world-hazards.mjs';
import { createCollisionBody, resolveSweptCircleMotion } from '../apps/hmh-reboot/src/collision.mjs';
import { traceHeightAwareLineOfSight } from '../apps/hmh-reboot/src/elevation.mjs';
import { createEnemyNavGrid, computeEnemyFlowField } from '../apps/hmh-reboot/src/enemy-navgrid.mjs';

const queryGround = createLevelOneGroundQuery();
const hero = createCollisionBody({ id: 'player', kind: 'player', radius: world.player.radius, minZ: 0, maxZ: 56 });
const zones = createMissionState(0).zones;
const item = MISSION_OBJECTIVES.find((row) => row.mode === 'touch');
// Every ring a hero can stand in: machine and pry zones, and the item's touch ring.
const rings = [...zones.map((zone) => ({ id: zone.id, x: zone.x, y: zone.y, radius: zone.ringRadius, siteId: zone.kind === 'machine' ? zone.objectiveId : null })),
  { id: item.id, x: item.anchor.x, y: item.anchor.y, radius: item.ringRadius, siteId: null }];

test('rule 1: every operate spot fits the hero clear of every collider, and every ring disk is dry walkable ground on one height', () => {
  for (const zone of zones) {
    const fit = resolveSweptCircleMotion({ body: hero, start: { x: zone.x, y: zone.y, z: queryGround(zone.x, zone.y).groundZ }, delta: { x: 0, y: 0 }, blockers: world.collisionBlockers, bounds: world.bounds });
    assert.equal(fit.depenetrations.length, 0, `${zone.id} operate spot clips ${fit.depenetrations.map((entry) => entry.blockerId)}`);
    assert.ok(['east', 'west'].includes(zone.facing), zone.id);
  }
  for (const ring of rings) {
    const centreZ = queryGround(ring.x, ring.y).groundZ;
    for (let step = 0; step < 24; step += 1) {
      for (const fraction of [0, 0.5, 1]) {
        const x = ring.x + Math.cos(step * Math.PI / 12) * ring.radius * fraction;
        const y = ring.y + Math.sin(step * Math.PI / 12) * ring.radius * fraction;
        const ground = queryGround(x, y);
        assert.ok(ground.walkable && !ground.deepWater && ground.kind !== 'water', `${ring.id} ring is dry at ${x},${y}`);
        assert.ok(Math.abs(ground.groundZ - centreZ) <= MISSION_RULES.heightBand, `${ring.id} ring is one height`);
      }
    }
  }
});

test('every machine prop sits 46 units along its facing, outside the operate spot, and in plain sight of it (excluding the prop itself)', () => {
  for (const site of WORLD_DESIGN_SITES) {
    const prop = WORLD_DESIGN_SITE_PROPS.find((candidate) => candidate.id === `world-control:${site.id}`);
    const blocker = world.collisionBlockers.find((candidate) => candidate.id === prop.collisionBlockerId);
    assert.equal(prop.y, site.y, site.id);
    assert.equal(prop.x - site.x, site.facing === 'east' ? 46 : -46, site.id);
    assert.ok(Math.hypot(prop.x - site.x, prop.y - site.y) >= blocker.shape.radius + world.player.radius, `${site.id} operate spot is outside its prop collider`);
    const z = queryGround(site.x, site.y).groundZ + MISSION_RULES.lineOfSightHeight;
    const line = traceHeightAwareLineOfSight({ from: { x: site.x, y: site.y, z }, to: { x: prop.x, y: prop.y, z }, blockers: world.collisionBlockers.filter((candidate) => candidate.id !== blocker.id) });
    assert.equal(line.clear, true, `${site.id} line to its prop is blocked by ${line.blockerId}`);
  }
});

test('rule 2: ring centres are at least 300 apart and at least a hazard radius + 100 from every damaging or pushing hazard', () => {
  for (let left = 0; left < rings.length; left += 1) {
    for (let right = left + 1; right < rings.length; right += 1) {
      const distance = Math.hypot(rings[left].x - rings[right].x, rings[left].y - rings[right].y);
      assert.ok(distance >= 300, `${rings[left].id} and ${rings[right].id} are ${Math.round(distance)} apart`);
    }
  }
  // A spore bed only slows (area-slow): it neither hurts nor pushes a hero
  // standing still in a channel, so it is not a hazard for this rule.
  const hazards = [
    ...world.interactions.hazards.filter((hazard) => WORLD_HAZARD_RULES[hazard.kind] && hazard.kind !== 'area-slow').map((hazard) => ({ id: hazard.id, ...hazard.anchor, radius: WORLD_HAZARD_RULES[hazard.kind].radius ?? WORLD_HAZARD_RULES[hazard.kind].halfLength, siteId: null })),
    ...WORLD_DESIGN_SITES.filter((site) => site.hazard).map((site) => ({ id: `${site.id}:steam`, x: site.hazard.x, y: site.hazard.y, radius: site.hazard.radius, siteId: site.id })),
  ];
  for (const ring of rings) {
    for (const hazard of hazards) {
      const distance = Math.hypot(ring.x - hazard.x, ring.y - hazard.y);
      // A valve's own vent is its effect: its operator stands outside the
      // vent and has the 90-tick warning to walk clear.
      if (hazard.siteId === ring.siteId) assert.ok(distance > hazard.radius, `${ring.id} stands outside its own vent`);
      else assert.ok(distance >= hazard.radius + 100, `${ring.id} is ${Math.round(distance)} from ${hazard.id}`);
    }
  }
});

test('rule 4: each switch is within 900 of the gate it moves, and every requirement is inside its own district', () => {
  for (const site of WORLD_DESIGN_SITES) {
    const { a, b } = world.collisionBlockers.find((candidate) => candidate.id === site.gateId).shape;
    assert.ok(Math.hypot((a.x + b.x) / 2 - site.x, (a.y + b.y) / 2 - site.y) <= 900, site.id);
    assert.equal(getLevelOneDistrictAt(site.x, site.y)?.id, site.districtId, site.id);
  }
  for (const row of MISSION_OBJECTIVES.filter((candidate) => candidate.requires)) {
    const needed = MISSION_OBJECTIVES.find((candidate) => candidate.id === row.requires);
    assert.equal(needed.districtId, row.districtId, `${row.id} needs ${needed.id} from its own district`);
    assert.equal(getLevelOneDistrictAt(needed.anchor.x, needed.anchor.y)?.id, row.districtId);
  }
});

test('no machine prop narrows a route, a footpath, an authored lot or an encounter floor', () => {
  const nodes = new Map(world.routeGraph.nodes.map((node) => [node.id, node]));
  const segment = (p, a, b) => {
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
  };
  const nearest = (p, points) => Math.min(...points.slice(1).map((point, index) => segment(p, points[index], point)));
  for (const prop of WORLD_DESIGN_SITE_PROPS) {
    // Routes are swept as a ribbon of half-width + 24; paths as a hero at the edge.
    for (const route of world.routes) assert.ok(nearest(prop, route.nodeIds.map((id) => nodes.get(id))) >= route.width / 2 + 24 + 20, `${prop.id} narrows ${route.id}`);
    for (const path of WORLD_DESIGN_GROUND_PATHS) assert.ok(nearest(prop, path.points) >= path.width / 2 + 20, `${prop.id} narrows ${path.id}`);
    for (const lot of WORLD_DESIGN_NEW_LOTS) assert.ok(Math.hypot(lot.x - prop.x, lot.y - prop.y) >= Math.hypot(lot.width, lot.depth) / 2 + 24 + 20, `${prop.id} crowds ${lot.id}`);
    // Encounter floors stay free of new solids.
    for (const arena of world.encounterArenas) assert.ok(Math.hypot(arena.anchor.x - prop.x, arena.anchor.y - prop.y) >= arena.radius + 24 + 20, `${prop.id} stands on ${arena.id}`);
  }
});

test('the Winch Handle lies on open ground the hero can walk to from the spawn', () => {
  const grid = createEnemyNavGrid({ world, queryGround });
  const field = computeEnemyFlowField({ grid, targetX: item.anchor.x, targetY: item.anchor.y });
  assert.ok(field.distance[grid.cellAt(world.player.spawn.x, world.player.spawn.y)] > 0);
  const fit = resolveSweptCircleMotion({ body: hero, start: { ...item.anchor, z: 0 }, delta: { x: 0, y: 0 }, blockers: world.collisionBlockers, bounds: world.bounds });
  assert.equal(fit.depenetrations.length, 0);
});
