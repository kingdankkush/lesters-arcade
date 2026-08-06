import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MINIMAP_VISIBILITY_RADIUS,
  createMinimapDiscoveryState,
  discoverMinimapPointsOfInterest,
  computeMinimapModel,
} from '../apps/hmh-reboot/src/minimap-model.mjs';
import { LEVEL_ONE_WORLD } from '../apps/hmh-reboot/src/level-one-world.mjs';

// MAP-REDO slice 4 / handoff §H8-11: two fog states. `explored` map geometry
// persists once visited; live enemy positions exist only inside current
// visibility; POIs appear after discovery and persist; the player marker is
// always accurate. The model is a pure projection of simulation state so the
// renderer stays dumb and the rules stay testable.

const BOUNDS = LEVEL_ONE_WORLD.bounds;

function model(overrides = {}) {
  return computeMinimapModel({
    bounds: BOUNDS,
    player: { x: 800, y: 2_400 },
    enemies: [],
    boss: null,
    pointsOfInterest: LEVEL_ONE_WORLD.pointsOfInterest,
    discovery: overrides.discovery ?? createMinimapDiscoveryState(),
    ...overrides,
  });
}

test('the player marker is always present and normalized to [0,1]', () => {
  const result = model({ player: { x: 6_000, y: 2_400 } });
  assert.ok(result.player);
  assert.ok(Math.abs(result.player.x - 0.5) < 1e-9);
  assert.ok(result.player.y > 0 && result.player.y < 1);
});

test('live enemies mark only inside current visibility and never persist', () => {
  const near = { id: 'e1', active: true, health: 10, x: 800 + MINIMAP_VISIBILITY_RADIUS - 40, y: 2_400 };
  const far = { id: 'e2', active: true, health: 10, x: 800 + MINIMAP_VISIBILITY_RADIUS + 200, y: 2_400 };
  const dead = { id: 'e3', active: true, health: 0, x: 820, y: 2_400 };
  const first = model({ enemies: [near, far, dead] });
  assert.equal(first.enemies.length, 1);
  // The player retreats: the previously-visible enemy must vanish — the map
  // remembers geography, never live positions.
  const second = model({ enemies: [near, far, dead], player: { x: 800 - MINIMAP_VISIBILITY_RADIUS * 2, y: 2_400 } });
  assert.equal(second.enemies.length, 0);
});

test('an active boss marks distinctly inside visibility', () => {
  const boss = { active: true, health: 400, x: 900, y: 2_400 };
  const result = model({ boss });
  assert.equal(result.boss?.kind, 'boss');
  const hidden = model({ boss: { ...boss, x: 6_000 } });
  assert.equal(hidden.boss, null);
});

test('POIs are discovered inside visibility and persist after leaving', () => {
  const discovery = createMinimapDiscoveryState();
  // relay-armory sits at (1550, 1550): out of visibility from spawn.
  const before = model({ discovery });
  assert.equal(before.pointsOfInterest.some((poi) => poi.id === 'relay-armory'), false);
  // Walk next to it: discovered.
  const at = model({ discovery, player: { x: 1_500, y: 1_500 } });
  assert.equal(at.pointsOfInterest.some((poi) => poi.id === 'relay-armory'), true);
  // Walk away: the marker persists — discovery is knowledge, not sensor data.
  const after = model({ discovery, player: { x: 11_000, y: 2_400 } });
  assert.equal(after.pointsOfInterest.some((poi) => poi.id === 'relay-armory'), true);
});

test('POI discovery can advance from accepted fixed-step positions without invoking render projection', () => {
  const discovery = createMinimapDiscoveryState();
  const discovered = discoverMinimapPointsOfInterest({
    discovery,
    player: { x: 1_500, y: 1_500 },
    pointsOfInterest: LEVEL_ONE_WORLD.pointsOfInterest,
  });
  assert.equal(discovered, 1);
  assert.equal(discovery.discoveredPoiIds.has('relay-armory'), true);
  assert.equal(discoverMinimapPointsOfInterest({
    discovery,
    player: { x: 1_500, y: 1_500 },
    pointsOfInterest: LEVEL_ONE_WORLD.pointsOfInterest,
  }), 0);

  const boundedDiscovery = createMinimapDiscoveryState();
  discoverMinimapPointsOfInterest({
    discovery: boundedDiscovery,
    player: { x: 1_510, y: 1_500 },
    pointsOfInterest: LEVEL_ONE_WORLD.pointsOfInterest,
    radius: 5,
  });
  assert.equal(boundedDiscovery.discoveredPoiIds.size, 0);
});

test('undiscovered POIs never leak', () => {
  const result = model({});
  for (const poi of result.pointsOfInterest) {
    assert.ok(Math.hypot(poi.worldX - 800, poi.worldY - 2_400) <= MINIMAP_VISIBILITY_RADIUS, `${poi.id} leaked without discovery`);
  }
});

test('the model is deterministic and bounded', () => {
  const enemies = Array.from({ length: 200 }, (_, index) => ({
    id: `swarm-${index}`, active: true, health: 5, x: 810 + (index % 20) * 10, y: 2_380 + Math.floor(index / 20) * 8,
  }));
  const a = model({ enemies });
  const b = model({ enemies });
  assert.deepEqual(a, b);
  assert.ok(a.enemies.length <= 64, `enemy markers must cap for render cost (${a.enemies.length})`);
});
