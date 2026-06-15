// Tests for the district generator (road networks, district clustering, biome transitions)

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DISTRICT_TYPES,
  ROAD_TYPES,
  DISTRICT_CELL,
  ROAD_WIDTH,
  SIDEWALK_WIDTH,
  generateDistrictGrid,
  generateRoadNetwork,
  generateTransitionZones,
  generateInteriorLayout,
  hashU32,
} from '../apps/portal/src/district-generator.mjs'

// Mock biomeAt for testing
const mockBiomeAt = (seed, x, y) => {
  // Simple deterministic biome based on position
  const h = (x * 73856093) ^ (y * 19349663);
  const biomes = ['town', 'forest', 'sand', 'water', 'rocky', 'grass', 'pavement', 'road'];
  return biomes[(Math.abs(h) % biomes.length)];
};

// Set global biomeAt for testing
import { setBiomeAtImpl } from '../apps/portal/src/district-generator.mjs';
setBiomeAtImpl(mockBiomeAt);

test('DISTRICT_TYPES exports eight district types', () => {
  assert.equal(Object.keys(DISTRICT_TYPES).length, 8);
  assert.ok(DISTRICT_TYPES.DOWNTOWN);
  assert.ok(DISTRICT_TYPES.SUBURBAN);
  assert.ok(DISTRICT_TYPES.INDUSTRIAL);
  assert.ok(DISTRICT_TYPES.CITY_PARK);
  assert.ok(DISTRICT_TYPES.FOREST_WILDERNESS);
  assert.ok(DISTRICT_TYPES.BEACH_AREA);
  assert.ok(DISTRICT_TYPES.COMMERCIAL);
  assert.ok(DISTRICT_TYPES.RESIDENTIAL);
});

test('each district type has valid structure', () => {
  for (const [key, district] of Object.entries(DISTRICT_TYPES)) {
    assert.ok(typeof district.id === 'string' && district.id, `${key} has id`);
    assert.ok(Array.isArray(district.templates) && district.templates.length > 0, `${key} has templates`);
    assert.ok(typeof district.weight === 'number' && district.weight > 0, `${key} has weight`);
    assert.ok(Array.isArray(district.biomeAffinities) && district.biomeAffinities.length > 0, `${key} has biomeAffinities`);
    assert.ok(typeof district.roadDensity === 'number' && district.roadDensity >= 0 && district.roadDensity <= 1, `${key} has roadDensity 0-1`);
  }
});

test('ROAD_TYPES exports seven road types', () => {
  assert.equal(Object.keys(ROAD_TYPES).length, 7);
  assert.ok(ROAD_TYPES.HIGHWAY);
  assert.ok(ROAD_TYPES.MAIN_STREET);
  assert.ok(ROAD_TYPES.SIDE_STREET);
  assert.ok(ROAD_TYPES.ALLEY);
  assert.ok(ROAD_TYPES.BOARDWALK);
  assert.ok(ROAD_TYPES.DIRT_PATH);
  assert.ok(ROAD_TYPES.FOREST_TRAIL);
});

test('each road type has valid structure', () => {
  for (const [key, road] of Object.entries(ROAD_TYPES)) {
    assert.ok(typeof road.id === 'string' && road.id, `${key} has id`);
    assert.ok(typeof road.width === 'number' && road.width > 0, `${key} has width`);
    assert.ok(typeof road.sidewalkWidth === 'number' && road.sidewalkWidth >= 0, `${key} has sidewalkWidth`);
    assert.ok(typeof road.template === 'string' && road.template, `${key} has template`);
    assert.ok(typeof road.spacing === 'number' && road.spacing > 0, `${key} has spacing`);
    assert.ok(typeof road.tileKey === 'string' && road.tileKey, `${key} has tileKey`);
  }
});

test('DISTRICT_CELL, ROAD_WIDTH, SIDEWALK_WIDTH constants', () => {
  assert.equal(DISTRICT_CELL, 5);
  assert.equal(ROAD_WIDTH, 1);
  assert.equal(SIDEWALK_WIDTH, 1);
});

test('hashU32 is deterministic', () => {
  const a = hashU32(123, 456);
  const b = hashU32(123, 456);
  assert.equal(a, b, 'same inputs produce same output');
  assert.ok(typeof a === 'number' && a >= 0);
});

test('generateDistrictGrid creates deterministic grid for given seed', () => {
  const grid1 = generateDistrictGrid(12345, 500, 500);
  const grid2 = generateDistrictGrid(12345, 500, 500);
  
  assert.equal(grid1.macroCellsX, grid2.macroCellsX);
  assert.equal(grid1.macroCellsY, grid2.macroCellsY);
  assert.equal(grid1.grid.length, grid2.grid.length);
  
  // Check determinism - same cell should have same district
  for (let i = 0; i < grid1.grid.length; i++) {
    const a = grid1.grid[i];
    const b = grid2.grid[i];
    assert.equal(a.dx, b.dx, `cell ${i} dx matches`);
    assert.equal(a.dy, b.dy, `cell ${i} dy matches`);
    assert.equal(a.district.id, b.district.id, `cell ${i} district matches`);
  }
});

test('grid has correct dimensions for world size', () => {
  const grid = generateDistrictGrid(12345, 1000, 1000);
  // world 1000x1000, DISTRICT_CELL=5, SCENE_CELL=7 => 35 world tiles per macro cell
  // 1000/35 ≈ 28.5 => ceil = 29
  assert.equal(grid.macroCellsX, 29);
  assert.equal(grid.macroCellsY, 29);
  assert.equal(grid.grid.length, 29 * 29);
});

test('each grid cell has valid structure', () => {
  const grid = generateDistrictGrid(12345, 500, 500);
  
  for (const cell of grid.grid) {
    assert.ok(typeof cell.dx === 'number' && cell.dx >= 0);
    assert.ok(typeof cell.dy === 'number' && cell.dy >= 0);
    assert.ok(typeof cell.centerX === 'number');
    assert.ok(typeof cell.centerY === 'number');
    assert.ok(typeof cell.biome === 'string');
    assert.ok(cell.district && typeof cell.district.id === 'string');
    assert.ok(Array.isArray(cell.templates) && cell.templates.length > 0);
    assert.ok(Array.isArray(cell.roads));
    assert.ok(Array.isArray(cell.connections));
  }
});

test('generateRoadNetwork produces roads between connected cells', () => {
  const grid = generateDistrictGrid(12345, 500, 500);
  const roads = generateRoadNetwork(grid.grid, grid.macroCellsX, grid.macroCellsY, 12345);

  assert.ok(roads.length > 0, 'roads generated');

  for (const road of roads) {
    assert.ok(road.from && typeof road.from.x === 'number' && typeof road.from.y === 'number');
    assert.ok(road.to && typeof road.to.x === 'number' && typeof road.to.y === 'number');
    assert.ok(road.type && typeof road.type === 'object');
    assert.ok(Array.isArray(road.path) && road.path.length > 0);
    for (const pt of road.path) {
      assert.ok(typeof pt.x === 'number');
      assert.ok(typeof pt.y === 'number');
      assert.ok(pt.type === 'road' || pt.type === 'bridge');
      assert.ok(typeof pt.biome === 'string');
    }
    assert.ok(typeof road.districtA === 'string');
    assert.ok(typeof road.districtB === 'string');
  }
});

test('generateTransitionZones runs without error', () => {
  const grid = generateDistrictGrid(12345, 500, 500);
  const roads = generateRoadNetwork(grid.grid, grid.macroCellsX, grid.macroCellsY, 12345);
  const transitions = generateTransitionZones(roads, 12345);
  
  assert.ok(Array.isArray(transitions));
  for (const t of transitions) {
    assert.ok(typeof t.x === 'number');
    assert.ok(typeof t.y === 'number');
    assert.ok(Array.isArray(t.biomes) && t.biomes.length > 1);
    assert.ok(typeof t.tileKey === 'string' && t.tileKey.startsWith('transition-'));
  }
});

test('generateInteriorLayout creates layout for known building types', () => {
  const types = ['office_interior', 'diner_interior', 'grocery_interior', 'gym_interior'];
  
  for (const type of types) {
    const layout = generateInteriorLayout(type, 12345);
    assert.ok(layout.grid);
    assert.ok(Array.isArray(layout.rooms));
    assert.ok(layout.rooms.length > 0);
    assert.ok(layout.buildingType === type);
    
    for (const room of layout.rooms) {
      assert.ok(typeof room.id === 'number');
      assert.ok(typeof room.name === 'string');
      assert.ok(typeof room.x === 'number' && room.x >= 0);
      assert.ok(typeof room.y === 'number' && room.y >= 0);
      assert.ok(typeof room.w === 'number' && room.w > 0);
      assert.ok(typeof room.h === 'number' && room.h > 0);
    }
  }
});

test('hashU32 produces uniform distribution', () => {
  const results = new Set();
  for (let i = 0; i < 1000; i++) {
    results.add(hashU32(i, 42));
  }
  // With 1000 samples, we should see good distribution (at least 800 unique)
  assert.ok(results.size >= 800, `hashU32 produced ${results.size} unique values out of 1000`);
});