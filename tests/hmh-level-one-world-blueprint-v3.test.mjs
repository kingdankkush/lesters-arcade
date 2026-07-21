import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const ROOT = new URL('../', import.meta.url);
const BLUEPRINT_URL = new URL('docs/game-design/data/hmh-level-1-world-blueprint-v3.json', ROOT);
const TILE_CONTEXT_URL = new URL('docs/game-design/data/hmh-level-1-world-blueprint-v3-tile-contexts.csv', ROOT);

function readJson(url) {
  return JSON.parse(readFileSync(url, 'utf8'));
}

function rowsFor(layer) {
  assert.equal(Array.isArray(layer?.rows), true);
  return layer.rows;
}

function cell(layer, x, y) {
  return rowsFor(layer)[y][x];
}

function floodReachable(navRows, start) {
  const seen = new Set();
  const queue = [[start.x, start.y]];
  while (queue.length) {
    const [x, y] = queue.shift();
    const key = `${x},${y}`;
    if (seen.has(key) || x < 0 || y < 0 || y >= navRows.length || x >= navRows[y].length) continue;
    if (navRows[y][x] === '#') continue;
    seen.add(key);
    queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  return seen;
}

test('Level 1 World Blueprint v3 defines every cell of a 100x100 authored map', () => {
  const blueprint = readJson(BLUEPRINT_URL);
  assert.equal(blueprint.id, 'hmh-level-1-world-blueprint-v3');
  assert.equal(blueprint.levelId, 'level-1-crypto-wasteland');
  assert.deepEqual(blueprint.dimensions, { width: 100, height: 100, cellCount: 10_000 });
  assert.deepEqual(blueprint.projection, { kind: 'isometric-2-to-1', tileWidth: 64, tileHeight: 32 });

  for (const key of ['terrain', 'biome', 'elevation', 'groundNav', 'route', 'encounter']) {
    const rows = rowsFor(blueprint.layers[key]);
    assert.equal(rows.length, 100, `${key} must have 100 rows`);
    assert.equal(rows.every((row) => row.length === 100), true, `${key} rows must all be 100 cells wide`);
  }
});

test('Blueprint v3 perimeter is diegetically blocked and deep water is non-traversable', () => {
  const blueprint = readJson(BLUEPRINT_URL);
  const nav = rowsFor(blueprint.layers.groundNav);
  assert.equal(nav[0].split('').every((code) => code === '#'), true);
  assert.equal(nav[99].split('').every((code) => code === '#'), true);
  assert.equal(nav.every((row) => row[0] === '#' && row[99] === '#'), true);

  const waterCodes = new Set(['W', 'O']);
  for (let y = 0; y < 100; y += 1) {
    for (let x = 0; x < 100; x += 1) {
      if (waterCodes.has(cell(blueprint.layers.terrain, x, y))) {
        assert.equal(cell(blueprint.layers.groundNav, x, y), '#', `deep water at ${x},${y} must block ground actors`);
      }
    }
  }
  assert.equal(blueprint.navigation.movementClasses.air.ignoresGroundCollision, true);
});

test('Blueprint v3 authored spine, optional POIs, boss, and extraction are ground-reachable', () => {
  const blueprint = readJson(BLUEPRINT_URL);
  const reachable = floodReachable(rowsFor(blueprint.layers.groundNav), blueprint.anchors.spawn);
  for (const anchor of [
    ...blueprint.criticalPath,
    ...blueprint.pointsOfInterest,
    blueprint.anchors.finalBoss,
    blueprint.anchors.extraction,
  ]) {
    assert.equal(reachable.has(`${anchor.x},${anchor.y}`), true, `${anchor.id ?? anchor.title} must be reachable`);
  }
  assert.equal(blueprint.criticalPath[0].id, 'broken-road-spawn');
  assert.equal(blueprint.criticalPath.at(-1).id, 'litecoin-city-threshold');
});

test('Blueprint v3 waterways flow downhill from mountains to lake and sea', () => {
  const blueprint = readJson(BLUEPRINT_URL);
  for (const waterway of blueprint.hydrology.waterways) {
    assert.equal(waterway.path.length >= 2, true);
    assert.equal(waterway.elevationProfile.length, waterway.path.length);
    let lastElevation = waterway.elevationProfile[0];
    for (let index = 1; index < waterway.path.length; index += 1) {
      const [x, y] = waterway.path[index];
      const elevation = waterway.elevationProfile[index];
      assert.equal(elevation <= lastElevation, true, `${waterway.id} flows uphill at ${x},${y}`);
      lastElevation = elevation;
    }
  }
  assert.equal(blueprint.hydrology.waterways.some((waterway) => waterway.destination === 'silver-wallet-lake'), true);
  assert.equal(blueprint.hydrology.waterways.some((waterway) => waterway.destination === 'south-coast-sea'), true);
});

test('Blueprint v3 bridges declare authored bank endpoints, visual axes, and deck footprints', () => {
  const blueprint = readJson(BLUEPRINT_URL);
  assert.equal(blueprint.hydrology.bridges.length, 4);
  for (const bridge of blueprint.hydrology.bridges) {
    assert.ok(['east-west', 'north-east-south-west'].includes(bridge.axis), `${bridge.id} needs a supported visual axis`);
    assert.ok(['rectangle', 'diagonal-band'].includes(bridge.shape), `${bridge.id} needs a supported deck shape`);
    assert.equal(Array.isArray(bridge.entry) && bridge.entry.length === 2, true, `${bridge.id} needs an authored entry bank`);
    assert.equal(Array.isArray(bridge.exit) && bridge.exit.length === 2, true, `${bridge.id} needs an authored exit bank`);
    assert.notEqual(cell(blueprint.layers.groundNav, ...bridge.entry), '#', `${bridge.id} entry bank must be walkable`);
    assert.notEqual(cell(blueprint.layers.groundNav, ...bridge.exit), '#', `${bridge.id} exit bank must be walkable`);
    assert.equal(Number.isInteger(bridge.deckRect?.xMin), true);
    assert.equal(Number.isInteger(bridge.deckRect?.xMax), true);
    assert.equal(Number.isInteger(bridge.deckRect?.yMin), true);
    assert.equal(Number.isInteger(bridge.deckRect?.yMax), true);
    assert.ok(bridge.deckRect.xMin <= bridge.x && bridge.deckRect.xMax >= bridge.x);
    assert.ok(bridge.deckRect.yMin <= bridge.y && bridge.deckRect.yMax >= bridge.y);
  }
  const outlet = blueprint.hydrology.bridges.find((bridge) => bridge.id === 'lake-outlet-farm-bridge');
  assert.equal(outlet.shape, 'diagonal-band');
  let outletDeckCells = 0;
  for (let y = outlet.deckRect.yMin; y <= outlet.deckRect.yMax; y += 1) {
    for (let x = outlet.deckRect.xMin; x <= outlet.deckRect.xMax; x += 1) {
      if (cell(blueprint.layers.terrain, x, y) === outlet.surface) outletDeckCells += 1;
    }
  }
  assert.equal(outletDeckCells, 19, 'farm bridge should read as a diagonal band instead of a square wood pad');
});

test('Silver Wallet outlet remains a visible blocked water corridor beside its farm bridge', () => {
  const blueprint = readJson(BLUEPRINT_URL);
  const outlet = blueprint.hydrology.waterways.find((waterway) => waterway.id === 'silver-wallet-outlet');
  assert.ok(outlet);
  const downstreamControlPoint = outlet.path.find(([x, y]) => x === 72 && y === 77);
  assert.deepEqual(downstreamControlPoint, [72, 77]);
  assert.equal(cell(blueprint.layers.terrain, 72, 77), 'W', 'farm plots must not erase the authored outlet river');
  assert.equal(cell(blueprint.layers.groundNav, 72, 77), '#', 'visible deep outlet water must remain collision-backed');
});

test('Blueprint v3 art grammar covers every terrain code and every tile has prompt context', () => {
  const blueprint = readJson(BLUEPRINT_URL);
  const terrainCodes = new Set(rowsFor(blueprint.layers.terrain).join('').split(''));
  const grammarCodes = new Set(blueprint.artGrammar.terrainFamilies.map((family) => family.code));
  for (const code of terrainCodes) assert.equal(grammarCodes.has(code), true, `terrain code ${code} needs an art family`);
  assert.equal(blueprint.artGrammar.terrainFamilies.every((family) => family.promptFamilyId), true);

  const csv = readFileSync(TILE_CONTEXT_URL, 'utf8').trim().split(/\r?\n/);
  assert.equal(csv.length, 10_001);
  assert.equal(csv[0].includes('northTerrain,eastTerrain,southTerrain,westTerrain,promptFamilyId'), true);

  const seam = blueprint.artGrammar.seamContract;
  assert.equal(seam.independentPerCellGeneration, false);
  assert.deepEqual(seam.logicalDiamond, { width: 64, height: 32 });
  assert.equal(seam.connectivityMasks.includes('NESW-4-bit'), true);
  assert.equal(seam.connectivityMasks.includes('47-tile-blob'), true);
  assert.equal(seam.layers.includes('ground'), true);
  assert.equal(seam.layers.includes('overhang'), true);
  assert.equal(seam.atlasGutterPixels >= 2, true);
  assert.equal(seam.landmarkOuterSafetyRingCells >= 1, true);
});

test('Blueprint v3 navigation contract separates artwork from terrain, structure, and actor collision truth', () => {
  const blueprint = readJson(BLUEPRINT_URL);
  const contract = blueprint.navigation.collisionContract;

  assert.equal(contract.sourceOfTruth, 'authored-blueprint-metadata');
  assert.equal(contract.neverInferFromImagePixels, true);
  assert.deepEqual(contract.layers, [
    'baseTerrain',
    'edgeBarriers',
    'propFootprints',
    'structureFootprints',
    'bridgeDecks',
    'hazards',
  ]);
  assert.equal(contract.terrainPolicies.deepWater.ground, 'blocked');
  assert.equal(contract.terrainPolicies.deepWater.air, 'passable');
  assert.equal(contract.terrainPolicies.bridgeDeck.ground, 'passable');
  assert.equal(contract.terrainPolicies.ford.ground, 'slow');
  assert.equal(contract.structurePolicy.everySolidPropRequiresFootprint, true);
  assert.equal(contract.structurePolicy.supportedShapes.includes('polygon'), true);
  assert.equal(contract.edgeBarrierBits.north, 1);
  assert.equal(contract.edgeBarrierBits.west, 8);
  assert.equal(contract.validation.includes('ground-enemies-cannot-cross-deep-water'), true);
  assert.equal(contract.validation.includes('air-enemies-can-cross-water'), true);
  assert.equal(contract.validation.includes('every-bridge-connects-two-reachable-ground-banks'), true);
});

test('Blueprint v3 has distinct exploration, combat, and rest beats with bounded generation scope', () => {
  const blueprint = readJson(BLUEPRINT_URL);
  const roles = new Set(blueprint.pointsOfInterest.map((poi) => poi.encounterRole));
  for (const role of ['optional-miniboss', 'exploration-landmark', 'swarm-arena', 'boss-arena']) {
    assert.equal(roles.has(role), true, `missing encounter role ${role}`);
  }
  assert.equal(blueprint.approvalGate.generateBeforeApproval.length, 2);
  assert.equal(blueprint.approvalGate.generateRemainingAfterApproval, true);
  assert.equal(blueprint.artGrammar.strategy, 'reusable-edge-aware-families-plus-authored-landmark-chunks');
});
