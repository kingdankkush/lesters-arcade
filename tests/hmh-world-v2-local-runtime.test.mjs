// W3c source RED draft; install under tests before execution.
import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import fs from 'node:fs';
import { createWorldV2Geometry } from '../apps/hmh-reboot/src/world-v2-geometry.mjs';
import { createGreyboxWorld } from '../apps/hmh-reboot/src/dev/greybox-world-v1.mjs';
import { createElevationSurface } from '../apps/hmh-reboot/src/elevation.mjs';
import { createStaticBlocker } from '../apps/hmh-reboot/src/collision.mjs';
import { createEnemyNavGrid, computeEnemyFlowField } from '../apps/hmh-reboot/src/enemy-navgrid.mjs';
import { createPlayerMotionState, stepPlayerMovement } from '../apps/hmh-reboot/src/movement.mjs';
import { FIXED_STEP_MS, MAX_CATCH_UP_STEPS } from '../apps/hmh-reboot/src/simulation.mjs';
import { createGreyboxPreviewLaunch } from '../apps/hmh-reboot/src/dev/greybox-preview-launch.mjs';
const accessModule = await import('../apps/hmh-reboot/src/dev/world-v2-local-access.mjs').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {}; throw error;
});
const runtimeModule = await import('../apps/hmh-reboot/src/dev/world-v2-local-runtime.mjs').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {}; throw error;
});
const url = 'http://127.0.0.1:8793/dist/hmh-world-v2-local/index.html?mode=free&world=world-v2-local';
const access = (value = url, topLevel = true) => {
  assert.equal(typeof accessModule.readWorldV2LocalAccess, 'function', 'local world pre-import access gate required');
  return accessModule.readWorldV2LocalAccess({ url: value, topLevel });
};
const live = new Set();
afterEach(() => { for (const runtime of live) runtime.dispose(); live.clear(); });
function make(geometry = fixture(), extra = {}) {
  assert.equal(typeof runtimeModule.createWorldV2LocalRuntime, 'function', 'actual local world movement/nav runtime required');
  const runtime = runtimeModule.createWorldV2LocalRuntime({ geometry, scheduleYield: async () => {}, ...extra });
  live.add(runtime); return runtime;
}
async function running(geometry = fixture()) { const runtime = make(geometry); await runtime.ready; runtime.start(); return runtime; }
const bounds = (minX = 0, minY = 0, maxX = 1000, maxY = 1000) => ({ minX, minY, maxX, maxY });
const surface = (id, area, options = {}) => createElevationSurface({ id, area: { type: 'rect', ...area }, visibleTerrainId: id, ...options });
function fixture({ box = bounds(), spawn = { x: 100, y: 500 }, surfaces = [], blockers = [] } = {}) {
  return createWorldV2Geometry({ mapId: 'w3c-diagnostic-only', officialRun: false, rankedEligible: false, rulesVersion: null,
    bounds: box, spawn, baseSurface: surface('floor', box), surfaces, collisionBlockers: blockers,
    areas: [{ id: 'room', name: 'Diagnostic room', bounds: box }], roads: [], sites: [] });
}
const right = Object.freeze({ move: Object.freeze({ x: 1, y: 0 }), aim: Object.freeze({ x: 1, y: 0, active: true }) });
const still = Object.freeze({ move: Object.freeze({ x: 0, y: 0 }), aim: Object.freeze({ x: 0, y: 0, active: false }) });
const wall = (id = 'wall', minZ = 0, maxZ = 180) => createStaticBlocker({ id, visibleAssetId: id, minZ, maxZ,
  shape: { type: 'polygon', vertices: [{ x: 200, y: 0 }, { x: 250, y: 0 }, { x: 250, y: 1000 }, { x: 200, y: 1000 }] } });
function step(runtime, count, input = right) { for (let index = 0; index < count; index++) runtime.advance(FIXED_STEP_MS, input); return runtime.snapshot(); }

test('only the explicit loopback top-level Free runtime link is allowed', () => {
  const result = access();
  assert.equal(result.allowed, true); assert.equal(result.officialRun, false); assert.equal(result.rankedEligible, false);
  assert.ok(Object.isFrozen(result));
  assert.equal(access(url.replace('127.0.0.1', 'localhost')).allowed, true);
  for (const value of [url.replace('mode=free', 'mode=ranked'), url.split('?')[0], url + '&seed=1', url + '&session=official',
    url + '&mode=free', url + '&world=world-v2-local', url + '#ranked', url.replace('http:', 'https:'),
    url.replace('127.0.0.1:8793', 'lestersarcade.io'), url.replace('127.0.0.1', '127.0.0.1.example.com'),
    url.replace('127.0.0.1', 'user:pass@127.0.0.1'), url.replace('world-v2-local/index.html', 'hmh-reboot/index.html'), 'not-a-url']) {
    assert.equal(access(value).allowed, false, value);
  }
  assert.equal(access(url, false).allowed, false);
});

test('denied local runtime access triggers zero heavy loader calls through the existing launch lifetime', async () => {
  const denied = access(url.replace('mode=free', 'mode=ranked'));
  let loads = 0;
  const launch = createGreyboxPreviewLaunch({ access: denied, root: {}, load: async () => { loads++; throw Error('heavy import must stay closed'); } });
  await launch.ready; assert.equal(loads, 0); assert.equal(launch.snapshot().phase, 'denied'); launch.dispose();
});

test('the local movement runtime refuses canonical authority and external seed/session options', () => {
  const initial = make();
  assert.equal(initial.snapshot().officialRun, false); assert.equal(initial.snapshot().rankedEligible, false);
  assert.equal(initial.snapshot().mode, 'local-free-test'); initial.dispose();
  for (const update of [{ officialRun: true }, { rankedEligible: true }, { rulesVersion: 2 }]) {
    assert.throws(() => make(Object.freeze({ ...fixture(), ...update })), TypeError);
  }
  for (const options of [{ seed: 1 }, { session: {} }, { mode: 'ranked' }, { fixedStepMs: 1 }, { maxCatchUpSteps: 8 }]) {
    assert.throws(() => make(fixture(), options), TypeError);
  }
});

test('a pending real chunked grid cannot start ticks or expose partial navigation', async () => {
  let release;
  const parked = new Promise(resolve => { release = resolve; });
  const runtime = make(fixture({ box: bounds(0, 0, 2000, 2000) }), { scheduleYield: () => parked });
  assert.equal(runtime.snapshot().phase, 'preparing'); assert.equal(runtime.snapshot().nav, null);
  assert.equal(runtime.navigationAt(100, 500), null);
  assert.throws(() => runtime.start(), /navigation|ready/);
  assert.equal(runtime.advance(1000, right).steps, 0); assert.equal(runtime.snapshot().tick, 0);
  release(); await runtime.ready;
  assert.equal(runtime.snapshot().phase, 'ready'); assert.ok(runtime.snapshot().nav.gridBytes > 0);
  runtime.start(); assert.equal(runtime.advance(FIXED_STEP_MS, right).steps, 1);
});

test('a failed real build stays failed and never adopts navigation or starts simulation', async () => {
  const runtime = make(fixture({ box: bounds(0, 0, 2000, 2000) }), { scheduleYield: async () => { throw Error('yield failure witness'); } });
  await assert.rejects(runtime.ready, /yield failure witness/);
  assert.equal(runtime.snapshot().phase, 'failed'); assert.match(runtime.snapshot().failure, /yield failure witness/);
  assert.equal(runtime.snapshot().nav, null); assert.equal(runtime.navigationAt(100, 500), null);
  assert.throws(() => runtime.start(), /navigation|ready/);
  assert.equal(runtime.advance(1000, right).steps, 0);
});

test('a real small nav build completing after dispose never adopts or retains its grid', async () => {
  const geometry = fixture({ box: bounds(0, 0, 180, 180), spawn: { x: 90, y: 90 } });
  let queries = 0;
  const observed = Object.freeze({ ...geometry, queryGround(x, y) { queries++; return geometry.queryGround(x, y); } });
  const runtime = make(observed);
  const beforeDispose = queries; assert.ok(beforeDispose > 0);
  runtime.dispose(); await runtime.ready;
  assert.ok(queries > beforeDispose, 'the actual builder completed its later directed-edge pass after disposal');
  assert.equal(runtime.snapshot().phase, 'disposed'); assert.equal(runtime.snapshot().nav, null);
  assert.equal(runtime.navigationAt(90, 90), null); assert.equal(runtime.snapshot().tick, 0);
  assert.equal(runtime.advance(1000, right).steps, 0); runtime.dispose();
});

test('disposal during an awaited yield cancels admission without resurrecting a runtime', async () => {
  let release; let yields = 0;
  const parked = new Promise(resolve => { release = resolve; });
  const runtime = make(fixture({ box: bounds(0, 0, 2000, 2000) }), { scheduleYield: () => { yields++; return parked; } });
  assert.equal(yields, 1); runtime.dispose(); release(); await runtime.ready;
  assert.equal(yields, 1, 'disposal-aware scheduling stops further slices');
  assert.equal(runtime.snapshot().phase, 'disposed'); assert.equal(runtime.snapshot().nav, null);
  assert.throws(() => runtime.start(), /navigation|ready|disposed/);
});

test('the real ten-area grid and flow are admitted whole and reported through detached scalar queries', async () => {
  const geometry = createWorldV2Geometry(createGreyboxWorld());
  const runtime = make(geometry); await runtime.ready;
  const expected = createEnemyNavGrid({ world: geometry, queryGround: geometry.queryGround });
  const flow = computeEnemyFlowField({ grid: expected, targetX: geometry.inspectionStart.x, targetY: geometry.inspectionStart.y });
  assert.ok(expected.walkable instanceof Uint8Array && expected.edges instanceof Uint8Array);
  assert.ok(flow.distance instanceof Int32Array && flow.directions instanceof Int8Array);
  assert.deepEqual(runtime.snapshot().nav, { columns: expected.columns, rows: expected.rows, cellSize: expected.cellSize,
    walkableCells: expected.walkable.reduce((sum, value) => sum + value, 0), gridBytes: expected.walkable.byteLength + expected.edges.byteLength,
    flowBytes: flow.distance.byteLength + flow.directions.byteLength });
  for (let cell = 0; cell < expected.walkable.length; cell += 997) {
    const x = expected.centreX(cell % expected.columns), y = expected.centreY(Math.floor(cell / expected.columns));
    assert.deepEqual(runtime.navigationAt(x, y), { cell, walkable: Boolean(expected.walkable[cell]), edges: expected.edges[cell], returnDistance: flow.distance[cell], direction: flow.directions[cell] });
  }
  assert.equal(runtime.navigationAt(-1, -1), null);
  assert.throws(() => runtime.navigationAt(NaN, 0), TypeError);
  assert.equal(runtime.snapshot().tick, 0);
});

test('actual fixed steps match render-cadence variants, unchanged movement primitives and the four-step catch-up cap', async () => {
  const a = await running(), b = await running();
  step(a, 120);
  for (let frame = 0; frame < 60; frame++) b.advance(FIXED_STEP_MS * 2, right);
  assert.equal(a.snapshot().tick, 120); assert.deepEqual(a.snapshot().actor, b.snapshot().actor);
  const expected = createPlayerMotionState({ x: 100, y: 500 });
  for (let tick = 0; tick < 120; tick++) stepPlayerMovement(expected, right, { dtSeconds: 1 / 60 });
  for (const key of ['x', 'y', 'vx', 'vy', 'legDirection', 'torsoDirection', 'locomotion']) assert.equal(a.snapshot().actor[key], expected[key], key);
  const frame = a.advance(5000, right);
  assert.equal(frame.steps, MAX_CATCH_UP_STEPS); assert.equal(a.snapshot().tick, 124); assert.ok(frame.totalDroppedMs > 4900);
  assert.equal(a.snapshot().fixedStepMs, FIXED_STEP_MS);
  assert.throws(() => a.advance(-1, right), TypeError);
  assert.throws(() => a.advance(FIXED_STEP_MS, { move: { x: NaN, y: 0 } }), TypeError);
});

test('pause and disposal stop actual ticks, reset partial time and never restore stale movement input', async () => {
  const runtime = await running(); runtime.advance(10, right);
  runtime.pause(); const paused = runtime.snapshot();
  assert.equal(runtime.advance(5000, right).steps, 0); assert.deepEqual(runtime.snapshot().actor, paused.actor);
  runtime.resume(); assert.equal(runtime.advance(10, still).steps, 0, 'pre-pause fraction was discarded');
  runtime.advance(10, still); assert.equal(runtime.snapshot().tick, 1); assert.equal(runtime.snapshot().actor.x, 100);
  runtime.dispose(); const closed = runtime.snapshot();
  assert.equal(runtime.advance(5000, right).steps, 0); assert.deepEqual(runtime.snapshot().actor, closed.actor);
  assert.equal(runtime.snapshot().nav, null); assert.equal(runtime.snapshot().phase, 'disposed');
  runtime.resume(); assert.equal(runtime.snapshot().phase, 'disposed');
});

test('the current human radius and height stop walls, slide diagonally and pass overhead clearance', async () => {
  const blocked = await running(fixture({ blockers: [wall()] }));
  const final = step(blocked, 120);
  assert.ok(final.actor.x > 170 && final.actor.x <= 176.00001); assert.equal(final.actor.vx, 0); assert.ok(final.lastStep.contacts > 0);
  const sliding = await running(fixture({ spawn: { x: 100, y: 100 }, blockers: [wall()] }));
  const slide = step(sliding, 120, { move: { x: 1, y: 1 } });
  assert.ok(slide.actor.x <= 176.00001 && slide.actor.y > 300); assert.equal(slide.actor.vx, 0);
  const overhead = await running(fixture({ blockers: [wall('overhead', 56, 100)] }));
  assert.ok(step(overhead, 120).actor.x > 500, 'the current 56-height body passes a beam beginning at z56');
});

test('deep water and upward cliffs refuse real player steps without substituting nav-cell collision', async () => {
  for (const obstruction of [surface('water', bounds(400, 0, 600, 1000), { kind: 'water', priority: 30 }),
    surface('cliff', bounds(400, 0, 600, 1000), { kind: 'ledge', groundZ: 48, priority: 30 })]) {
    const runtime = await running(fixture({ surfaces: [obstruction] }));
    const final = step(runtime, 200);
    assert.ok(final.actor.x > 380 && final.actor.x < 400); assert.equal(final.actor.groundZ, 0); assert.equal(final.actor.vx, 0);
    assert.equal(final.lastStep.traversalAllowed, false);
  }
});

test('real movement ascends, crosses and returns over the existing ramp and bridge semantics', async () => {
  const geometry = fixture({ surfaces: [surface('water', bounds(400, 0, 600, 1000), { kind: 'water', priority: 30 }),
    surface('west-ramp', bounds(200, 340, 400, 660), { kind: 'ramp', fromZ: 0, toZ: 24, priority: 40 }),
    surface('bridge', bounds(400, 340, 600, 660), { kind: 'bridge', groundZ: 24, priority: 41, visibleStepId: 'bridge-step' }),
    surface('east-ramp', bounds(600, 340, 800, 660), { kind: 'ramp', fromZ: 24, toZ: 0, priority: 40 })] });
  const runtime = await running(geometry); let maximum = 0;
  for (let tick = 0; tick < 260 && runtime.snapshot().actor.x < 850; tick++) { step(runtime, 1); maximum = Math.max(maximum, runtime.snapshot().actor.groundZ); }
  assert.ok(runtime.snapshot().actor.x >= 850); assert.equal(maximum, 24); assert.equal(runtime.snapshot().actor.groundZ, 0);
  for (let tick = 0; tick < 260 && runtime.snapshot().actor.x > 150; tick++) step(runtime, 1, { move: { x: -1, y: 0 } });
  assert.ok(runtime.snapshot().actor.x <= 150); assert.equal(runtime.snapshot().actor.groundZ, 0);
});

test('directed nav and projection snapshots cannot mutate runtime authority', async () => {
  const geometry = fixture({ box: bounds(0, 0, 180, 180), spawn: { x: 90, y: 90 }, surfaces: [
    surface('one-way', bounds(60, 0, 120, 180), { kind: 'ledge', groundZ: 48, oneWayDrop: { x: 1, y: 0 } })] });
  const runtime = make(geometry); await runtime.ready;
  const ledge = runtime.navigationAt(90, 90), east = runtime.navigationAt(150, 90), view = runtime.snapshot();
  assert.equal(ledge.edges & 1, 1); assert.equal(ledge.edges & 2, 0); assert.equal(east.edges & 2, 0); assert.equal(east.returnDistance, -1);
  assert.throws(() => { ledge.edges = 0; }, TypeError);
  assert.throws(() => { view.actor.x = 0; }, TypeError);
  assert.throws(() => { view.nav.gridBytes = 0; }, TypeError);
  assert.equal(Object.values(view.nav).some(ArrayBuffer.isView), false);
  runtime.start(); step(runtime, 1);
  assert.equal(view.tick, 0); assert.equal(view.actor.x, 90); assert.equal(runtime.navigationAt(90, 90).edges & 1, 1);
});

test('unsafe inspection starts fail before nav work and local source imports no canonical sessions or old encounter hooks', () => {
  const witness = make(); witness.dispose();
  let scheduled = 0;
  for (const geometry of [fixture({ spawn: { x: 220, y: 500 }, blockers: [wall()] }),
    fixture({ spawn: { x: 500, y: 500 }, surfaces: [surface('water', bounds(400, 0, 600, 1000), { kind: 'water' })] })]) {
    assert.throws(() => make(geometry, { scheduleYield: async () => { scheduled++; } }), /clear|walkable|inspection/);
  }
  assert.equal(scheduled, 0);
  function audit(root, read = file => fs.readFileSync(file, 'utf8')) {
    const seen = new Set();
    function visit(file) {
    if (seen.has(file.href)) return; seen.add(file.href);
    const pathname = decodeURIComponent(file.pathname);
    assert.doesNotMatch(pathname, /\/(?:main|bridge|standalone-session|mission[^/]*|boss[^/]*|run-summary[^/]*|run-progression|run-adapters|collectible[^/]*|settlement|profile[^/]*)\.mjs$/, 'canonical/legacy module in local runtime graph');
    for (const match of read(file).matchAll(/(?:import|export)\s[^;]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      const relative = match[1] ?? match[2] ?? match[3]; assert.ok(relative.startsWith('.'), `local source dependency ${relative}`); visit(new URL(relative, file));
    }
    }
    visit(root); return seen;
  }
  const control = new URL('file:///w3c-import-control/entry.mjs');
  assert.throws(() => audit(control, file => file.pathname.endsWith('/entry.mjs') ? "import './mission-objectives.mjs';" : ''), /canonical\/legacy/);
  assert.throws(() => audit(control, file => file.pathname.endsWith('/entry.mjs') ? "import './%6dission-objectives.mjs';" : ''), /canonical\/legacy/);
  assert.throws(() => audit(control, file => file.pathname.endsWith('/entry.mjs') ? "import './%XY.mjs';" : ''), URIError);
  assert.equal(audit(control, file => file.pathname.endsWith('/entry.mjs') ? "import './movement.mjs';" : 'export const control = true;').size, 2);
  audit(new URL('../apps/hmh-reboot/src/dev/world-v2-local-runtime.mjs', import.meta.url));
  audit(new URL('../apps/hmh-reboot/src/dev/world-v2-local-access.mjs', import.meta.url));
});
