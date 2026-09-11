import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { parse } from 'acorn';
import { drawDistrictMaterial } from '../apps/hmh-reboot/src/world-ground-fallback.mjs';
import { createWorldProductionLayers, renderWorldProductionArt } from '../apps/hmh-reboot/src/world-production-art.mjs';
import { LEVEL_ONE_WORLD, createLevelOneGroundQuery } from '../apps/hmh-reboot/src/level-one-world.mjs';
import { worldToScreen } from '../apps/hmh-reboot/src/world-space.mjs';

const source = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
function findNode(predicate, node = ast) {
  if (!node || typeof node !== 'object') return null;
  if (predicate(node)) return node;
  for (const value of Object.values(node)) {
    if (!value || typeof value !== 'object') continue;
    const found = Array.isArray(value)
      ? value.map(item => findNode(predicate, item)).find(Boolean)
      : findNode(predicate, value);
    if (found) return found;
  }
  return null;
}
const loaderNode = findNode(node => node.type === 'VariableDeclarator' && node.id.name === 'loadGroundFallback').init;
const importNode = findNode(node => node.type === 'ImportExpression', loaderNode);
// Stub only the network import boundary; execute the actual cached loader and
// failure handling shipped by main.mjs. No production module is rewritten.
const loaderSource = source.slice(loaderNode.start, importNode.start)
  + 'importGroundFallback()' + source.slice(importNode.end, loaderNode.end);
function createLoader(importGroundFallback) {
  const context = vm.createContext({
    groundFallbackLoad: undefined,
    worldProduction: { groundFallback: { draw: null } },
    importGroundFallback,
  });
  return { context, load: vm.runInContext(`(${loaderSource})`, context) };
}

test('the ground-detail module is optional and concurrent requests reuse its single download', async () => {
  assert.equal(importNode.source.value, './world-ground-fallback.mjs');
  assert.equal(ast.body.some(node => node.type === 'ImportDeclaration'
    && node.source.value.includes('world-ground-fallback')), false);
  let finish;
  let requests = 0;
  const { context, load } = createLoader(() => {
    requests += 1;
    return new Promise(resolve => { finish = resolve; });
  });
  assert.equal(requests, 0);
  const first = load();
  const second = load();
  assert.equal(first, second);
  assert.equal(requests, 1);
  assert.equal(context.worldProduction.groundFallback.draw, null);
  finish({ drawDistrictMaterial });
  await first;
  assert.equal(context.worldProduction.groundFallback.draw, drawDistrictMaterial);
  await load();
  assert.equal(requests, 1);
});

test('an unavailable optional chunk preserves playable flat fills instead of rejecting startup', async () => {
  const { context, load } = createLoader(() => Promise.reject(new Error('offline')));
  await assert.doesNotReject(load());
  assert.equal(context.worldProduction.groundFallback.draw, null);
});

test('only the explicit flatTerrain comparison requests basic ground during boot', async () => {
  const node = findNode(item => item.type === 'IfStatement'
    && source.slice(item.test.start, item.test.end) === '!terrainTilesEnabled'
    && source.slice(item.consequent.start, item.consequent.end).includes('await loadGroundFallback()'));
  assert.ok(node);
  for (const terrainTilesEnabled of [true, false]) {
    let requests = 0;
    const context = vm.createContext({ terrainTilesEnabled, loadGroundFallback: async () => { requests += 1; } });
    await vm.runInContext(`(async () => { ${source.slice(node.start, node.end)} })()`, context);
    assert.equal(requests, terrainTilesEnabled ? 0 : 1);
  }
});

test('the actual world renderer supports flat fills before opt-in and the installed detail renderer afterward', () => {
  class Container {
    children = [];
    addChild(child) { this.children.push(child); return child; }
    addChildAt(child, index) { this.children.splice(index, 0, child); return child; }
    getChildIndex(child) { return this.children.indexOf(child); }
  }
  class Graphics {
    constructor() {
      const target = { children: [] };
      const proxy = new Proxy(target, {
        get: (object, property) => property in object ? object[property] : () => proxy,
      });
      return proxy;
    }
  }
  const worldProduction = createWorldProductionLayers({ ContainerClass: Container, GraphicsClass: Graphics });
  const render = () => renderWorldProductionArt({
    worldProduction, world: LEVEL_ONE_WORLD,
    camera: { x: 800, y: 2400, zoom: 1.4, shakeX: 0, shakeY: 0 }, view: { width: 1440, height: 900 },
    worldToScreen, queryGround: createLevelOneGroundQuery(), tick: 0,
    performanceProfile: { particlesPerHazard: 0, worldCullMargin: 220 },
  });
  assert.equal(worldProduction.groundFallback.draw, null);
  assert.doesNotThrow(render, 'missing art and a missing optional chunk must retain flat ground');
  const districts = [];
  worldProduction.groundFallback.draw = (args) => {
    districts.push(args.district.id);
    drawDistrictMaterial(args);
  };
  assert.doesNotThrow(render);
  assert.ok(districts.includes('frontier-relay'), 'the installed module must render the visible opening district');
});

// These draw-call hashes were captured from the original pre-extraction
// renderer and matched side-by-side before its duplicate code was removed.
// A fixed palette keeps this preservation test independent of authored colour
// changes. Desktop and portrait coverage retain all six district motifs.
const references = JSON.parse(readFileSync(new URL('./fixtures/hmh-ground-fallback-reference.json', import.meta.url), 'utf8'));
for (const reference of references) {
  test(`basic ground preserves ${reference.id} at ${reference.view.width}×${reference.view.height}`, () => {
    const operations = [];
    const graphic = layer => new Proxy({}, {
      get: (_object, method) => (...args) => {
        operations.push([layer, method, ...args]);
        return graphic(layer);
      },
    });
    const { id, view } = reference;
    const camera = { x: 1200, y: 1200, zoom: view.width > 400 ? 1.4 : 1.9 };
    drawDistrictMaterial({
      layers: { terrain: graphic('terrain'), groundDetails: graphic('groundDetails') },
      district: { id, area: { minX: 0, minY: 0, maxX: 2400, maxY: 2400 } },
      kit: { groundColor: 0x153c35, detailColor: 0x42c89c }, camera, view, tick: 0,
      project: ({ x, y }) => ({
        x: (x - camera.x) * camera.zoom + view.width / 2,
        y: (y - camera.y) * camera.zoom + view.height / 2,
      }),
    });
    assert.equal(operations.length, reference.count);
    assert.equal(createHash('sha256').update(JSON.stringify(operations)).digest('hex'), reference.sha256);
  });
}
