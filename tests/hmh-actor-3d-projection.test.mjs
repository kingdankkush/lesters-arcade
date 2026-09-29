import assert from 'node:assert/strict';
import test from 'node:test';

const module = await import('../apps/hmh-reboot/src/actor-3d-projection.mjs').catch(() => ({}));
const actor = () => ({ id: 'hero', actorId: 'lit-commando', x: 100, y: 220, z: 12, groundZ: 12,
  heading: 0.25, clip: 'run', clipTimeSeconds: 0.5, health: 99, radius: 24, rng: { encounters: 17 } });
const camera = { x: 50, y: 100, groundZ: 0, zoom: 2, shakeX: 0, shakeY: 0 };
const viewport = { width: 800, height: 600 };

test('the 3D pilot is default-off and enabled only by its exact explicit switch', () => {
  assert.equal(typeof module.isActor3dPilotEnabled, 'function');
  for (const query of ['', '?actor3dPilot=0', '?actor3dPilot=true', '?productionPilot=1']) {
    assert.equal(module.isActor3dPilotEnabled(new URLSearchParams(query)), false);
  }
  assert.equal(module.isActor3dPilotEnabled(new URLSearchParams('?actor3dPilot=1')), true);
});

test('projection owns detached frozen visual fields and preserves ground-depth ordering', () => {
  assert.equal(typeof module.createActor3dProjection, 'function');
  const source = actor();
  const before = structuredClone(source);
  const projection = module.createActor3dProjection(source, camera, viewport);
  assert.deepEqual(source, before);
  assert.equal(projection.depth, 220);
  assert.deepEqual(projection.screen, { x: 500, y: 516 });
  assert.deepEqual(projection.position, { x: 100, y: 220, z: 12 });
  assert.equal(Object.isFrozen(projection), true);
  assert.equal(Object.isFrozen(projection.position), true);
  assert.equal(Object.isFrozen(projection.screen), true);
  for (const field of ['health', 'radius', 'rng']) assert.equal(field in projection, false);
  source.x = 1000;
  assert.equal(projection.position.x, 100);
  assert.throws(() => { projection.position.x = 1; }, TypeError);
});

test('height changes the visual foot position without changing the ground depth key', () => {
  const lower = module.createActor3dProjection(actor(), camera, viewport);
  const raised = module.createActor3dProjection({ ...actor(), z: 112 }, camera, viewport);
  assert.equal(raised.depth, lower.depth);
  assert.equal(raised.screen.y, lower.screen.y - 200);
});

function backendReceipt() {
  const calls = [];
  return { calls, backend: {
    createDisplay(id) { const display = { id, zIndex: -1 }; calls.push(['create', id]); return display; },
    renderActor(display, projection) { calls.push(['render', display.id, display.zIndex, projection]); },
    removeDisplay(display) { calls.push(['remove', display.id]); },
    dispose() { calls.push(['dispose']); },
  } };
}

test('disabled and unsupported sessions never load an optional renderer', async () => {
  assert.equal(typeof module.createActor3dPilotSession, 'function');
  let loads = 0;
  const createBackend = async () => { loads++; return backendReceipt().backend; };
  const disabled = module.createActor3dPilotSession({ createBackend });
  assert.equal(await disabled.start(), 'disabled');
  const reasons = [];
  const unsupported = module.createActor3dPilotSession({ enabled: true, supported: false, createBackend, onFallback: reason => reasons.push(reason) });
  assert.equal(await unsupported.start(), 'fallback');
  assert.deepEqual(reasons, ['unsupported']);
  assert.equal(loads, 0);
});

test('every live actor has its own attached display with world y depth, including equal-depth stable order', async () => {
  const { calls, backend } = backendReceipt();
  const attached = [];
  const session = module.createActor3dPilotSession({ enabled: true, supported: true, createBackend: async () => backend,
    attachDisplay: display => attached.push(display) });
  assert.equal(await session.start(), 'ready');
  const north = module.createActor3dProjection({ ...actor(), id: 'north', y: 180 }, camera, viewport);
  const south = module.createActor3dProjection({ ...actor(), id: 'south', y: 240, z: 120 }, camera, viewport);
  const peer = module.createActor3dProjection({ ...actor(), id: 'peer', y: 240 }, camera, viewport);
  session.render([north, south, peer]);
  assert.deepEqual(attached.map(display => [display.id, display.zIndex]), [['north', 180], ['south', 240], ['peer', 240]]);
  assert.deepEqual(calls.filter(call => call[0] === 'render').map(call => call.slice(1, 3)), [['north', 180], ['south', 240], ['peer', 240]]);
  session.render([north]);
  assert.deepEqual(calls.filter(call => call[0] === 'remove'), [['remove', 'south'], ['remove', 'peer']]);
});

test('renderer exceptions fall back and dispose all live displays once', async () => {
  const { calls, backend } = backendReceipt();
  backend.renderActor = () => { throw new Error('GPU lost'); };
  const reasons = [];
  const session = module.createActor3dPilotSession({ enabled: true, supported: true, createBackend: async () => backend,
    onFallback: reason => reasons.push(reason) });
  await session.start();
  session.render([module.createActor3dProjection(actor(), camera, viewport)]);
  assert.equal(session.status, 'fallback');
  session.dispose(); session.dispose();
  assert.deepEqual(reasons, ['renderer-failed']);
  assert.equal(calls.filter(call => call[0] === 'dispose').length, 1);
  assert.equal(calls.filter(call => call[0] === 'remove').length, 1);
});

test('context loss releases resources; a pending load disposed before resolution cannot resurrect', async () => {
  const { calls, backend } = backendReceipt();
  let resolve;
  const pending = new Promise(yes => { resolve = yes; });
  const session = module.createActor3dPilotSession({ enabled: true, supported: true, createBackend: () => pending });
  const load = session.start();
  session.dispose();
  resolve(backend);
  assert.equal(await load, 'disposed');
  assert.equal(session.status, 'disposed');
  assert.equal(calls.filter(call => call[0] === 'dispose').length, 1);
  const second = backendReceipt();
  const lost = module.createActor3dPilotSession({ enabled: true, supported: true, createBackend: async () => second.backend });
  await lost.start(); lost.handleContextLoss(); lost.handleContextLoss();
  assert.equal(lost.status, 'fallback');
  assert.equal(second.calls.filter(call => call[0] === 'dispose').length, 1);
});

test('malformed projection is rejected before a backend can observe it', async () => {
  const { calls, backend } = backendReceipt();
  const session = module.createActor3dPilotSession({ enabled: true, supported: true, createBackend: async () => backend });
  await session.start();
  assert.throws(() => session.render([actor()]), /projection/);
  assert.equal(calls.length, 0);
  assert.throws(() => module.createActor3dProjection({ ...actor(), x: Infinity }, camera, viewport), /finite/);
});

test('invalid camera or viewport output cannot become a branded visual projection', () => {
  assert.throws(() => module.createActor3dProjection(actor(), { ...camera, zoom: NaN }, viewport), /finite/);
  assert.throws(() => module.createActor3dProjection(actor(), camera, { ...viewport, width: Infinity }), /finite/);
});
