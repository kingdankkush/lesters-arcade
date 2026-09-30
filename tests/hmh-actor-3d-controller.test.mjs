import assert from 'node:assert/strict';
import test from 'node:test';
const module = await import('../apps/hmh-reboot/src/actor-3d-controller.mjs').catch(() => ({}));
const camera = { x: 0, y: 0, groundZ: 0, zoom: 1, shakeX: 0, shakeY: 0 }, view = { width: 800, height: 600 };
const entry = (id, y = 10) => ({ descriptor: { id, actorId: id === 'hero' ? 'lit-commando' : 'bagholder-rusher', x: 10, y, z: 0, heading: 0, clip: 'idle', clipTimeSeconds: 0 }, originals: [{ renderable: true }] });
const renderer = (depth = true) => ({ context: { webGLVersion: 2 }, gl: { MAX_VERTEX_UNIFORM_VECTORS: 0, DEPTH_BITS: 1, FRAMEBUFFER_BINDING: 2,
  getContextAttributes: () => ({ depth }), getParameter: value => value === 0 ? 256 : value === 2 ? null : 24, isContextLost: () => false } });
const canvas = () => { const events = new Map(); return { addEventListener: (name, fn) => events.set(name, fn), removeEventListener: name => events.delete(name), events }; };
const backend = () => ({ created: [], removed: [], disposed: 0, frames: [], createDisplay(id) { const display = { id }; this.created.push(display); return display; },
  beginFrame(frame) { this.frames.push(frame); }, renderActor() {}, removeDisplay(display) { this.removed.push(display); }, dispose() { this.disposed++; } });

test('unsupported depth contexts fall back before assets or shader code are loaded', async () => {
  assert.equal(typeof module.createActor3dPilotController, 'function'); let loads = 0; const reports = [];
  const controller = module.createActor3dPilotController({ renderer: renderer(false), canvas: canvas(), onTelemetry: report => reports.push(report), backendFactory: () => { loads++; return backend(); } });
  await controller.start(); assert.equal(controller.status, 'fallback'); assert.equal(loads, 0);
  assert.equal(reports.at(-1).reason, 'unsupported');
  const actor = entry('hero'); controller.update([actor], camera, view); assert.equal(actor.originals[0].renderable, true);
});

test('support checks the canvas depth through Pixi and restores a startup offscreen target', async () => {
  for (const rootDepth of [24, 0]) {
    const gpu = renderer(), surface = canvas(), offscreen = {}, bindings = []; let current = offscreen;
    gpu.gl.getParameter = value => value === 0 ? 256 : value === 2 ? current === surface ? null : offscreen : current === surface ? rootDepth : 0;
    gpu.renderTarget = { renderSurface: offscreen, bind(target, clear) { assert.equal(clear, false); current = target; this.renderSurface = target; bindings.push(target); } };
    let loads = 0; const controller = module.createActor3dPilotController({ renderer: gpu, canvas: surface, backendFactory: () => { loads++; return backend(); } });
    await controller.start(); assert.equal(controller.status, rootDepth ? 'ready' : 'fallback'); assert.equal(loads, rootDepth ? 1 : 0);
    assert.deepEqual(bindings, [surface, offscreen]); assert.equal(current, offscreen); controller.dispose();
  }
});

test('failed prior-target restoration refuses support before hiding originals or loading the backend', async () => {
  const gpu = renderer(), surface = canvas(), offscreen = {}; let current = offscreen, loads = 0;
  gpu.gl.getParameter = value => value === 0 ? 256 : value === 2 ? current === surface ? null : offscreen : current === surface ? 24 : 0;
  gpu.renderTarget = { renderSurface: offscreen, bind(target) { if (target === offscreen) throw new Error('prior surface unavailable'); current = target; this.renderSurface = target; } };
  const controller = module.createActor3dPilotController({ renderer: gpu, canvas: surface, backendFactory: () => { loads++; return backend(); } });
  const hero = entry('hero'); await controller.start(); assert.equal(controller.status, 'fallback'); assert.equal(loads, 0);
  assert.equal(controller.update([hero], camera, view), false); assert.equal(hero.originals[0].renderable, true);
});

test('only successfully rendered originals hide, then restore on removal, context loss and disposal', async () => {
  const gpu = backend(), surface = canvas(), attached = [], controller = module.createActor3dPilotController({ renderer: renderer(), canvas: surface,
    attachDisplay: display => attached.push(display), backendFactory: () => gpu });
  await controller.start(); const hero = entry('hero'), enemy = entry('enemy', 11), before = JSON.stringify([hero.descriptor, enemy.descriptor]);
  assert.equal(controller.update([hero, enemy], camera, view), true);
  assert.equal(controller.ownsOriginal(enemy.originals[0], 'enemy'), true);
  assert.equal(controller.ownsOriginal(enemy.originals[0], 'retired-owner'), false);
  assert.equal(hero.originals[0].renderable, false); assert.equal(enemy.originals[0].renderable, false); assert.equal(attached.length, 2);
  assert.equal(JSON.stringify([hero.descriptor, enemy.descriptor]), before); assert.ok(Object.isFrozen(gpu.frames[0]));
  assert.ok(gpu.frames[0].every(p => Object.isFrozen(p) && !p.originals));
  controller.update([hero], camera, view); assert.equal(enemy.originals[0].renderable, true); assert.equal(gpu.removed.length, 1);
  assert.equal(controller.ownsOriginal(enemy.originals[0], 'enemy'), false);
  surface.events.get('webglcontextlost')(); assert.equal(controller.status, 'fallback'); assert.equal(hero.originals[0].renderable, true);
  assert.equal(gpu.disposed, 1); controller.dispose(); assert.equal(gpu.disposed, 1); assert.equal(surface.events.size, 0);
});

test('a draw preparation failure restores every original and releases displays exactly once', async () => {
  const gpu = backend(), controller = module.createActor3dPilotController({ renderer: renderer(), canvas: canvas(), backendFactory: () => gpu });
  await controller.start(); const hero = entry('hero'); controller.update([hero], camera, view);
  gpu.renderActor = () => { throw new Error('shader preparation'); };
  assert.equal(controller.update([hero], camera, view), false); assert.equal(controller.status, 'fallback');
  assert.equal(hero.originals[0].renderable, true); assert.equal(gpu.disposed, 1); assert.equal(gpu.removed.length, 1);
});

test('disposed pending loads cannot attach displays or hide originals', async () => {
  let finish; const gpu = backend(), controller = module.createActor3dPilotController({ renderer: renderer(), canvas: canvas(),
    backendFactory: () => new Promise(resolve => { finish = resolve; }) });
  const pending = controller.start(); await Promise.resolve(); controller.dispose(); finish(gpu); await pending;
  const hero = entry('hero'); assert.equal(controller.update([hero], camera, view), false);
  assert.equal(hero.originals[0].renderable, true); assert.equal(gpu.disposed, 1);
});

test('the opening proof admits two actor instances and rejects a larger frame without mutating inputs', async () => {
  const controller = module.createActor3dPilotController({ renderer: renderer(), canvas: canvas(), backendFactory: () => backend() }); await controller.start();
  const actors = [entry('hero'), entry('enemy'), entry('other')]; assert.equal(controller.update(actors, camera, view), false);
  assert.equal(controller.status, 'fallback'); assert.ok(actors.every(a => a.originals[0].renderable));
});

test('ranked depth bands preserve painter order even at tied/adjacent ground Y and extreme local mesh depth', () => {
  assert.equal(typeof module.actor3dDepthBands, 'function');
  for (const depths of [[1, 1], [1, 1 + Number.EPSILON], [-10000, 14000]]) {
    const bands = module.actor3dDepthBands([{ id: 'a', depth: depths[0] }, { id: 'b', depth: depths[1] }], new Map([['a', 0], ['b', 1]]));
    assert.ok(bands.get('b').center + bands.get('b').halfWidth < bands.get('a').center - bands.get('a').halfWidth);
    assert.ok([...bands.values()].every(b => b.center - b.halfWidth > -1 && b.center + b.halfWidth < 1));
  }
});

test('game presentation selects only the reviewed identity/weapon/clips and preserves copied phase clocks', () => {
  assert.equal(typeof module.createActor3dPresentationEntries, 'function');
  const hero = { actorId: 'lit-commando', weaponId: 'coin-blaster', x: 1, y: 2, z: 3, heading: 0,
    action: 'aim', actionTick: 120, moving: true, bodyHeight: 84, originals: [] };
  const enemy = { id: 'bag-1', x: 4, y: 5, z: 6, pose: { state: 'tell', direction: 2, tick: 200, phaseTick: 10 }, originals: [] };
  const before = JSON.stringify([hero, enemy]); const frame = module.createActor3dPresentationEntries(hero, enemy);
  assert.equal(frame[0].descriptor.clip, 'run'); assert.equal(frame[0].descriptor.clipTimeSeconds, 0);
  assert.equal(frame[0].descriptor.pixelsPerMetre, 40); assert.equal(frame[1].descriptor.clip, 'tell');
  assert.equal(frame[1].descriptor.clipTimeSeconds, 10 / 60); assert.equal(frame[1].descriptor.heading, 0);
  assert.equal(JSON.stringify([hero, enemy]), before);
  assert.equal(module.createActor3dPresentationEntries({ ...hero, weaponId: 'hash-rail' }, enemy).length, 1);
  assert.equal(module.createActor3dPresentationEntries({ ...hero, action: 'interact' }, null).length, 0);
  assert.equal(module.createActor3dPresentationEntries({ ...hero, actorId: 'lester-original' }, null).length, 0);
});

test('actor lifetime tracking stays bounded when a long run replaces the projected enemy repeatedly', () => {
  assert.equal(typeof module.createActor3dDepthRegistry, 'function');
  const registry = module.createActor3dDepthRegistry(); registry.add('hero');
  for (let i = 0; i < 1000; i++) {
    registry.add(`enemy-${i}`); assert.equal(registry.size, 2);
    const bands = registry.frame([{ id: 'hero', depth: 10 }, { id: `enemy-${i}`, depth: 10 }]);
    assert.ok(bands.get(`enemy-${i}`).center < bands.get('hero').center);
    registry.remove(`enemy-${i}`); assert.equal(registry.size, 1);
  }
  registry.clear(); assert.equal(registry.size, 0);
});

test('pending load disposal aborts the backend resource request', async () => {
  let signal;
  const controller = module.createActor3dPilotController({ renderer: renderer(), canvas: canvas(),
    backendFactory: options => { signal = options.signal; return backend(); } });
  await controller.start(); assert.equal(signal?.aborted, false); controller.dispose(); assert.equal(signal.aborted, true);
});


test('Liquidator takes the second pilot slot and restores sprites when its eligible pose ends', async () => {
  const hero={actorId:'lit-commando',weaponId:'coin-blaster',x:0,y:0,z:0,heading:0,action:'idle',actionTick:0,bodyHeight:84,originals:[{renderable:true}]};
  const enemy={id:'rusher',x:1,y:1,z:0,pose:{state:'run',direction:2,tick:4},originals:[{renderable:true}]};
  const boss={active:true,visible:true,alpha:1,x:2,y:3,z:0,bodyHeight:84,pose:{state:'hit',direction:4,phaseTick:4},original:{renderable:true}};
  const before=JSON.stringify([hero,enemy,boss]);
  const frame=module.createActor3dPresentationEntries(hero,enemy,boss);
  assert.deepEqual(frame.map(e=>e.descriptor.actorId),['lit-commando','the-liquidator']);
  assert.equal(frame[1].descriptor.heading,Math.PI);assert.equal(frame[1].descriptor.clipTimeSeconds,4/60);
  assert.equal(JSON.stringify([hero,enemy,boss]),before);
  const gpu=backend(),surface=canvas(),controller=module.createActor3dPilotController({renderer:renderer(),canvas:surface,backendFactory:()=>gpu});
  await controller.start();controller.updateGame(hero,enemy,camera,view,boss);
  assert.equal(boss.original.renderable,false);assert.equal(enemy.originals[0].renderable,true);
  controller.updateGame(hero,enemy,camera,view,{...boss,alpha:.5});
  assert.equal(boss.original.renderable,true);assert.equal(enemy.originals[0].renderable,false);
  assert.equal(controller.status,'ready');assert.equal(gpu.frames.at(-1).length,2);
  controller.updateGame(hero,enemy,camera,view,boss);surface.events.get('webglcontextlost')();
  assert.equal(boss.original.renderable,true);assert.equal(hero.originals[0].renderable,true);controller.dispose();
});
