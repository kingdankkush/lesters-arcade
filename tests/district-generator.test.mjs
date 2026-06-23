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
  districtTemplateContextForCell,
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

test('generateDistrictGrid authors Level 1 belts with family metadata and ordered progression', () => {
  const { grid, macroCellsX, macroCellsY } = generateDistrictGrid(12345, 700, 175);
  const row = Math.floor(macroCellsY / 2);
  const cellAt = (dx) => grid.find((cell) => cell.dx === dx && cell.dy === row);

  assert.equal(cellAt(0)?.districtFamily, 'desert_approach');
  assert.equal(cellAt(Math.floor(macroCellsX * 0.2))?.districtFamily, 'ghost_town');
  assert.equal(cellAt(Math.floor(macroCellsX * 0.5))?.districtFamily, 'country_road');
  assert.equal(cellAt(Math.floor(macroCellsX * 0.7))?.districtFamily, 'residential_edge');
  assert.equal(cellAt(macroCellsX - 1)?.districtFamily, 'inner_city');

  for (const cell of grid) {
    assert.ok(typeof cell.stageBelt === 'string' && cell.stageBelt.length > 0, 'stage belt metadata exists');
    assert.ok(typeof cell.routeShape === 'string' && cell.routeShape.length > 0, 'route shape metadata exists');
    assert.ok(typeof cell.landmarkRole === 'string' && cell.landmarkRole.length > 0, 'landmark role metadata exists');
    assert.ok(Array.isArray(cell.templatePoolIds) && cell.templatePoolIds.length > 0, 'template pool metadata exists');
    assert.ok(typeof cell.loopCount === 'number' && cell.loopCount >= 1, 'every district promises at least one loop');
    assert.ok(typeof cell.landmarkTemplateId === 'string' && cell.landmarkTemplateId.length > 0, 'landmark template exists');
    assert.ok(cell.landmarkAnchorCell && Number.isInteger(cell.landmarkAnchorCell.localX) && Number.isInteger(cell.landmarkAnchorCell.localY), 'landmark anchor exists');
  }
});

test('generateDistrictGrid adds multiple authored set-piece anchors to Level 1 belt cells', () => {
  const { grid, macroCellsY } = generateDistrictGrid(12345, 700, 175);
  const row = Math.floor(macroCellsY / 2);
  const desertCell = grid.find((cell) => cell.districtFamily === 'desert_approach' && cell.dy === row);
  const ghostCell = grid.find((cell) => cell.districtFamily === 'ghost_town' && cell.dy === row);
  const countryCell = grid.find((cell) => cell.districtFamily === 'country_road' && cell.dy === row);
  const residentialCell = grid.find((cell) => cell.districtFamily === 'residential_edge' && cell.dy === row);
  const innerCityCell = grid.find((cell) => cell.districtFamily === 'inner_city' && cell.dy === row);

  assert.ok(Array.isArray(desertCell?.setPieceAnchors) && desertCell.setPieceAnchors.length >= 4, 'desert approach has multiple authored set pieces');
  assert.ok(desertCell.setPieceAnchors.some((anchor) => anchor.templateId === 'crypto_desert_outpost'), 'desert approach upgrades its landmark to a desert outpost');
  assert.ok(desertCell.setPieceAnchors.some((anchor) => anchor.templateId === 'crypto_canyon_gate'), 'desert approach adds a canyon gate anchor');
  assert.ok(desertCell.setPieceAnchors.some((anchor) => anchor.templateId === 'crypto_desert_salvage_basin'), 'desert approach adds a salvage basin anchor');

  assert.ok(Array.isArray(ghostCell?.setPieceAnchors) && ghostCell.setPieceAnchors.length >= 4, 'ghost town has multiple authored set pieces');
  assert.ok(ghostCell.setPieceAnchors.some((anchor) => anchor.templateId === 'crypto_ghost_mainstreet_front'), 'ghost town keeps its mainstreet landmark');
  assert.ok(ghostCell.setPieceAnchors.some((anchor) => anchor.templateId === 'crypto_ghost_saloon_square'), 'ghost town adds a saloon square anchor');

  assert.ok(Array.isArray(countryCell?.setPieceAnchors) && countryCell.setPieceAnchors.length >= 4, 'country road has multiple authored set pieces');
  assert.ok(countryCell.setPieceAnchors.some((anchor) => anchor.templateId === 'crypto_country_rest_stop'), 'country road upgrades its landmark to a rest stop');
  assert.ok(countryCell.setPieceAnchors.some((anchor) => anchor.templateId === 'crypto_country_pull_off'), 'country road adds a roadside pull-off anchor');
  assert.ok(countryCell.setPieceAnchors.some((anchor) => anchor.templateId === 'crypto_country_bus_turnout'), 'country road adds a bus turnout anchor');

  assert.ok(Array.isArray(residentialCell?.setPieceAnchors) && residentialCell.setPieceAnchors.length >= 4, 'residential edge has multiple authored set pieces');
  assert.ok(residentialCell.setPieceAnchors.some((anchor) => anchor.templateId === 'crypto_residential_square'), 'residential edge keeps its square anchor');
  assert.ok(residentialCell.setPieceAnchors.some((anchor) => anchor.templateId === 'crypto_residential_culdesac'), 'residential edge adds a culdesac anchor');

  assert.ok(Array.isArray(innerCityCell?.setPieceAnchors) && innerCityCell.setPieceAnchors.length >= 4, 'inner city has multiple authored set pieces');
  assert.ok(innerCityCell.setPieceAnchors.some((anchor) => anchor.templateId === 'crypto_innercity_industrial_gate'), 'inner city upgrades its boss-push landmark');
  assert.ok(innerCityCell.setPieceAnchors.some((anchor) => anchor.templateId === 'crypto_innercity_checkpoint_block'), 'inner city adds a checkpoint block set piece');
  assert.ok(innerCityCell.setPieceAnchors.some((anchor) => anchor.templateId === 'crypto_innercity_barricade_crossing'), 'inner city adds a barricade crossing set piece');
});

test('generateDistrictGrid authors Level 2 belts with urban-to-luxury progression when layout requests level2-authored', () => {
  const { grid, macroCellsX, macroCellsY } = generateDistrictGrid(12345, 700, 175, { layout: 'level2-authored' });
  const row = Math.floor(macroCellsY / 2);
  const cellAt = (dx) => grid.find((cell) => cell.dx === dx && cell.dy === row);

  assert.equal(cellAt(0)?.districtFamily, 'outer_boulevard');
  assert.equal(cellAt(Math.floor(macroCellsX * 0.34))?.districtFamily, 'financial_core');
  assert.equal(cellAt(Math.floor(macroCellsX * 0.67))?.districtFamily, 'luxury_neighborhood');
  assert.equal(cellAt(macroCellsX - 1)?.districtFamily, 'penthouse_rim');

  const outerCell = grid.find((cell) => cell.districtFamily === 'outer_boulevard' && cell.dy === row);
  const financeCell = grid.find((cell) => cell.districtFamily === 'financial_core' && cell.dy === row);
  const luxuryCell = grid.find((cell) => cell.districtFamily === 'luxury_neighborhood' && cell.dy === row);
  const penthouseCell = grid.find((cell) => cell.districtFamily === 'penthouse_rim' && cell.dy === row);

  assert.ok(outerCell?.templatePoolIds.includes('street_block'));
  assert.ok(outerCell?.setPieceAnchors?.some((anchor) => anchor.templateId === 'industrial_zone'));
  assert.ok(financeCell?.templatePoolIds.includes('downtown_district'));
  assert.ok(financeCell?.setPieceAnchors?.some((anchor) => anchor.templateId === 'city_park'));
  assert.ok(luxuryCell?.templatePoolIds.includes('suburban_residential'));
  assert.ok(luxuryCell?.setPieceAnchors?.some((anchor) => anchor.templateId === 'green_park'));
  assert.ok(penthouseCell?.templatePoolIds.includes('walled_compound'));
  assert.ok(penthouseCell?.setPieceAnchors?.some((anchor) => anchor.id === 'penthouse-vip-exit'));
});

test('districtTemplateContextForCell exposes landmark anchor and influence metadata for authored belts', () => {
  const { grid, macroCellsX, macroCellsY } = generateDistrictGrid(12345, 700, 175);
  const row = Math.floor(macroCellsY / 2);
  const ghostTownCell = grid.find((cell) => cell.districtFamily === 'ghost_town' && cell.dy === row);
  assert.ok(ghostTownCell, 'found ghost-town cell');

  const anchorCellX = ghostTownCell.dx * DISTRICT_CELL + ghostTownCell.landmarkAnchorCell.localX;
  const anchorCellY = ghostTownCell.dy * DISTRICT_CELL + ghostTownCell.landmarkAnchorCell.localY;
  const anchorContext = districtTemplateContextForCell(anchorCellX, anchorCellY, grid, macroCellsX);
  assert.equal(anchorContext?.forceTemplateId, ghostTownCell.landmarkTemplateId);
  assert.equal(anchorContext?.landmarkInfluence?.distance, 0);
  assert.equal(anchorContext?.landmarkInfluence?.anchorCellX, anchorCellX);
  assert.equal(anchorContext?.landmarkInfluence?.anchorCellY, anchorCellY);

  const nearbyContext = districtTemplateContextForCell(anchorCellX - 1, anchorCellY, grid, macroCellsX);
  assert.equal(nearbyContext?.landmarkTemplateId, ghostTownCell.landmarkTemplateId);
  assert.ok(nearbyContext?.landmarkInfluence?.distance >= 1, 'nearby cell keeps landmark influence');
});

test('districtTemplateContextForCell activates secondary set-piece anchors with their own local template pools', () => {
  const { grid, macroCellsX, macroCellsY } = generateDistrictGrid(12345, 700, 175);
  const row = Math.floor(macroCellsY / 2);
  const countryCell = grid.find((cell) => cell.districtFamily === 'country_road' && cell.dy === row);
  const seamAnchor = countryCell?.setPieceAnchors?.find((anchor) => anchor.id === 'country-seam-threshold');
  assert.ok(seamAnchor, 'country road exposes a seam threshold set piece');

  const anchorCellX = countryCell.dx * DISTRICT_CELL + seamAnchor.localX;
  const anchorCellY = countryCell.dy * DISTRICT_CELL + seamAnchor.localY;
  const anchorContext = districtTemplateContextForCell(anchorCellX, anchorCellY, grid, macroCellsX);
  assert.equal(anchorContext?.forceTemplateId, seamAnchor.templateId);
  assert.equal(anchorContext?.activeSetPiece?.templateId, seamAnchor.templateId);
  assert.equal(anchorContext?.activeSetPiece?.role, seamAnchor.role);
  assert.ok(anchorContext?.templatePoolIds.includes(seamAnchor.templateId));
  assert.ok(anchorContext?.templatePoolIds.includes('crypto_country_rest_stop'));

  const nearbyOffsetX = seamAnchor.localX <= 1 ? 1 : -1;
  const nearbyContext = districtTemplateContextForCell(anchorCellX + nearbyOffsetX, anchorCellY, grid, macroCellsX);
  assert.equal(nearbyContext?.activeSetPiece?.templateId, seamAnchor.templateId);
  assert.ok(nearbyContext?.landmarkInfluence?.distance >= 1, 'secondary set-piece influence extends beyond its anchor');
  assert.ok(nearbyContext?.templatePoolIds.includes(seamAnchor.templateId));
});

test('districtTemplateContextForCell exposes local authored template preferences so Level 1 reads as designed areas', () => {
  const { grid, macroCellsX, macroCellsY } = generateDistrictGrid(12345, 700, 175);
  const row = Math.floor(macroCellsY / 2);
  const desertCell = grid.find((cell) => cell.districtFamily === 'desert_approach' && cell.dy === row);
  const ghostCell = grid.find((cell) => cell.districtFamily === 'ghost_town' && cell.dy === row);

  const desertSpine = districtTemplateContextForCell(desertCell.dx * DISTRICT_CELL + 2, desertCell.dy * DISTRICT_CELL + 2, grid, macroCellsX);
  const desertCorner = districtTemplateContextForCell(desertCell.dx * DISTRICT_CELL, desertCell.dy * DISTRICT_CELL, grid, macroCellsX);
  const ghostMainStreet = districtTemplateContextForCell(ghostCell.dx * DISTRICT_CELL + 2, ghostCell.dy * DISTRICT_CELL + 2, grid, macroCellsX);

  assert.ok(desertSpine?.preferredTemplateIds.includes('crypto_desert_salvage_basin'));
  assert.ok(desertSpine?.preferredTemplateIds.includes('crypto_desert_outpost_yard'));
  assert.ok(desertCorner?.preferredTemplateIds.includes('crypto_canyon_pass'));
  assert.ok(ghostMainStreet?.preferredTemplateIds.includes('crypto_ghost_mainstreet_front'));
  assert.ok(ghostMainStreet?.preferredTemplateIds.includes('crypto_ghost_saloon_square'));
});

test('districtTemplateContextForCell exposes authored transition-band metadata at belt boundaries', () => {
  const { grid, macroCellsX, macroCellsY } = generateDistrictGrid(12345, 700, 175);
  const row = Math.floor(macroCellsY / 2);
  const countryCell = grid.find((cell) => cell.districtFamily === 'country_road' && cell.dy === row && grid.find((candidate) => candidate.dx === cell.dx + 1 && candidate.dy === row)?.districtFamily === 'residential_edge');
  const residentialCell = grid.find((cell) => cell.dx === countryCell.dx + 1 && cell.dy === row);

  assert.equal(residentialCell?.districtFamily, 'residential_edge');

  assert.equal(countryCell?.transitionEdges?.east?.toDistrictFamily, 'residential_edge');
  assert.ok(Array.isArray(countryCell?.transitionEdges?.east?.templatePoolIds));
  assert.ok(countryCell.transitionEdges.east.templatePoolIds.includes('crypto_country_rest_stop'));
  assert.ok(countryCell.transitionEdges.east.templatePoolIds.includes('crypto_residential_square'));
  assert.ok(countryCell.transitionEdges.east.templatePoolIds.includes('crypto_country_residential_checkpoint'), 'country/residential seam adds its checkpoint kit');

  const boundaryCellX = countryCell.dx * DISTRICT_CELL + (DISTRICT_CELL - 1);
  const boundaryCellY = countryCell.dy * DISTRICT_CELL + 2;
  const boundaryContext = districtTemplateContextForCell(boundaryCellX, boundaryCellY, grid, macroCellsX);
  assert.equal(boundaryContext?.transitionBand?.toDistrictFamily, 'residential_edge');
  assert.equal(boundaryContext?.transitionBand?.direction, 'east');
  assert.ok(boundaryContext?.templatePoolIds.includes('crypto_country_rest_stop'));
  assert.ok(boundaryContext?.templatePoolIds.includes('crypto_residential_square'));
  assert.ok(boundaryContext?.templatePoolIds.includes('crypto_country_residential_checkpoint'));
  assert.ok(boundaryContext?.preferredTemplateIds.includes('crypto_country_residential_checkpoint'));
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

test('generateDistrictGrid authors Level 1 branch lanes and POI spurs around the main spine', () => {
  const { grid, macroCellsY } = generateDistrictGrid(12345, 700, 175);
  const row = Math.floor(macroCellsY / 2);
  const northPoiRow = row - 2;
  const southPoiRow = row + 2;

  const hashrateCell = grid.find((cell) => cell.districtFamily === 'desert_approach' && cell.dy === northPoiRow);
  const rugpullCell = grid.find((cell) => cell.districtFamily === 'ghost_town' && cell.dy === southPoiRow);
  const hubCell = grid.find((cell) => cell.districtFamily === 'country_road' && cell.dy === row && cell.isCrossroadsHub);
  const citySeamCell = grid.find((cell) => cell.districtFamily === 'inner_city' && cell.dy === row);

  assert.ok(hashrateCell, 'north POI lane contains the hashrate camp');
  assert.ok(rugpullCell, 'south POI lane contains Rugpull Gulch');
  assert.ok(hubCell, 'main spine marks a crossroads hub');
  assert.ok(citySeamCell, 'main spine reaches the city seam');

  assert.equal(hashrateCell.macroRole, 'poi-spur');
  assert.equal(hashrateCell.poiId, 'old_hashrate_camp');
  assert.equal(rugpullCell.macroRole, 'poi-spur');
  assert.equal(rugpullCell.poiId, 'rugpull_gulch');
  assert.equal(hubCell.branchLane, 'center');
  assert.equal(citySeamCell.sightlineCue, 'litecoin-city-horizon');
});

test('districtTemplateContextForCell exposes POI-specific template pools and branch metadata', () => {
  const { grid, macroCellsX, macroCellsY } = generateDistrictGrid(12345, 700, 175);
  const row = Math.floor(macroCellsY / 2);
  const southPoiRow = row + 2;
  const rugpullCell = grid.find((cell) => cell.districtFamily === 'ghost_town' && cell.dy === southPoiRow && cell.poiId === 'rugpull_gulch');
  assert.ok(rugpullCell, 'found Rugpull Gulch POI cell');

  const poiAnchor = rugpullCell.setPieceAnchors.find((anchor) => anchor.id === 'rugpull_gulch-anchor');
  assert.ok(poiAnchor, 'Rugpull Gulch exposes a dedicated authored anchor');

  const anchorCellX = rugpullCell.dx * DISTRICT_CELL + poiAnchor.localX;
  const anchorCellY = rugpullCell.dy * DISTRICT_CELL + poiAnchor.localY;
  const anchorContext = districtTemplateContextForCell(anchorCellX, anchorCellY, grid, macroCellsX);

  assert.equal(anchorContext?.macroRole, 'poi-spur');
  assert.equal(anchorContext?.branchLane, 'south');
  assert.equal(anchorContext?.poiId, 'rugpull_gulch');
  assert.equal(anchorContext?.poiRewardCategory, 'weapon-or-shield');
  assert.equal(anchorContext?.poiMiniBossId, 'claim-jumper-sheriff');
  assert.equal(anchorContext?.forceTemplateId, 'crypto_rugpull_gulch');
  assert.ok(anchorContext?.templatePoolIds.includes('crypto_rugpull_gulch'));
  assert.ok(anchorContext?.preferredTemplateIds.includes('crypto_rugpull_gulch'));
});

test('generateRoadNetwork exposes authored route kinds for spine, hub, shoulder, and POI links', () => {
  const grid = generateDistrictGrid(12345, 700, 175);
  const roads = generateRoadNetwork(grid.grid, grid.macroCellsX, grid.macroCellsY, 12345);
  const routeKinds = new Set(roads.map((road) => road.routeKind));

  assert.equal(routeKinds.has('belt-spine'), true);
  assert.equal(routeKinds.has('hub-spine') || routeKinds.has('hub-connector'), true);
  assert.equal(routeKinds.has('shoulder-loop'), true);
  assert.equal(routeKinds.has('poi-connector'), true);
  assert.equal(routeKinds.has('poi-spur'), true);
});

test('districtTemplateContextForCell exposes authored zone plans for future visual-preview tooling', () => {
  const { grid, macroCellsX, macroCellsY } = generateDistrictGrid(12345, 700, 175, { layout: 'level1-authored' });
  const row = Math.floor(macroCellsY / 2);
  const ghostTownCell = grid.find((cell) => cell.districtFamily === 'ghost_town' && cell.dy === row);
  assert.ok(ghostTownCell, 'found ghost-town spine cell');

  const context = districtTemplateContextForCell(
    ghostTownCell.dx * DISTRICT_CELL + 2,
    ghostTownCell.dy * DISTRICT_CELL + 2,
    grid,
    macroCellsX,
  );

  assert.equal(context.authoredSetpiecePackIds.includes('town-mainstreet-lived-in'), true);
  assert.equal(context.authoredSetpieceZonePlans.some((plan) => plan.routeZones[0].id === 'main-street-sidewalk'), true);
  assert.equal(context.authoredSetpieceZonePlans.some((plan) => /buildings face the street/.test(plan.hardBoundaryZones[0].purpose)), true);
});

test('districtTemplateContextForCell classifies authored cells so runtime can suppress random scatter soup', () => {
  const { grid, macroCellsX, macroCellsY } = generateDistrictGrid(12345, 700, 175, { layout: 'level1-authored' });
  const row = Math.floor(macroCellsY / 2);
  const ghostTownCell = grid.find((cell) => cell.districtFamily === 'ghost_town' && cell.dy === row && cell.macroRole === 'main-spine');
  assert.ok(ghostTownCell, 'found ghost-town spine cell');

  const routeContext = districtTemplateContextForCell(
    ghostTownCell.dx * DISTRICT_CELL + 2,
    ghostTownCell.dy * DISTRICT_CELL + 2,
    grid,
    macroCellsX,
  );
  assert.equal(routeContext.authoredComposition.role, 'landmark-anchor');
  assert.equal(routeContext.sceneDensity, 1);
  assert.equal(routeContext.authoredComposition.skipScatter, true);

  const edgeContext = districtTemplateContextForCell(
    ghostTownCell.dx * DISTRICT_CELL + 2,
    ghostTownCell.dy * DISTRICT_CELL + 1,
    grid,
    macroCellsX,
  );
  assert.equal(['setpiece-ring', 'route-edge-dressing', 'clear-route-corridor'].includes(edgeContext.authoredComposition.role), true);
  assert.equal(edgeContext.sceneDensity <= 0.58, true);

  const negativeSpaceSample = grid.flatMap((cell) => {
    const samples = [];
    for (let localY = 0; localY < DISTRICT_CELL; localY += 1) {
      for (let localX = 0; localX < DISTRICT_CELL; localX += 1) {
        const context = districtTemplateContextForCell(
          cell.dx * DISTRICT_CELL + localX,
          cell.dy * DISTRICT_CELL + localY,
          grid,
          macroCellsX,
        );
        samples.push(context);
      }
    }
    return samples;
  }).find((context) => context?.authoredComposition?.ambientAllowed === false);

  assert.ok(negativeSpaceSample, 'found an authored negative-space cell');
  assert.equal(negativeSpaceSample.authoredComposition.skipScatter, true);
  assert.equal(negativeSpaceSample.sceneDensity < 0.1, true);
  assert.equal(negativeSpaceSample.authoredComposition.ambientAllowed, false);
});
