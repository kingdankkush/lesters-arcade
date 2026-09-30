// Default-off two-instance proof. Owns presentation displays and visibility
// only; its backend receives detached frozen projections, never simulation.
import { createActor3dProjection, createActor3dPilotSession, createLiquidator3dEntries } from './actor-3d-projection.mjs';

export function actor3dDepthBands(frame, creationOrder) {
  if (frame.length > 2 || frame.some(p => !Number.isFinite(p.depth))) throw new TypeError('bounded finite actor depth required');
  const ordered = [...frame].sort((a, b) => a.depth - b.depth || creationOrder.get(a.id) - creationOrder.get(b.id));
  const step = 1.6 / Math.max(1, ordered.length), bands = new Map();
  for (let rank = 0; rank < ordered.length; rank++) bands.set(ordered[rank].id, { center: .8 - step * (rank + .5), halfWidth: step * .35 });
  return bands;
}

export function createActor3dDepthRegistry() {
  const order = new Map(); let next = 0;
  return Object.freeze({
    get size() { return order.size; },
    add(id) { if (order.size >= 2 || order.has(id)) throw new TypeError('bounded unique actor lifetime required'); order.set(id, next++); },
    remove(id) { order.delete(id); },
    frame(frame) { return actor3dDepthBands(frame, order); },
    clear() { order.clear(); },
  });
}

function supported(renderer, canvas) {
  const gl = renderer?.gl;
  let previous;
  try {
    if (renderer.context?.webGLVersion !== 2 || gl.isContextLost() || gl.getContextAttributes()?.depth !== true
      || gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS) < 160) return false;
    // Startup atlas rendering may leave a depthless framebuffer bound. Ask
    // Pixi to bind the canvas, then restore its target through the same API.
    if (gl.getParameter(gl.FRAMEBUFFER_BINDING) !== null) {
      previous = renderer.renderTarget?.renderSurface;
      if (!previous || !canvas) return false;
      renderer.renderTarget.bind(canvas, false);
    }
    return gl.getParameter(gl.DEPTH_BITS) >= 16;
  } catch { return false; }
  finally { if (previous) { try { renderer.renderTarget.bind(previous, false); } catch { return false; } } }
}

export function createActor3dPresentationEntries(hero, enemy, boss = null) {
  const entries = [], pixelsPerMetre = Number.isFinite(hero?.bodyHeight) && hero.bodyHeight > 0 ? hero.bodyHeight / 2.1 : 40;
  if (hero?.actorId === 'lit-commando' && hero.weaponId === 'coin-blaster' && hero.action !== 'interact') {
    const clip = hero.action === 'aim' && hero.moving ? 'run' : hero.action;
    const loop = ['idle', 'run', 'aim'].includes(clip), duration = { 'pistol-fire': 12, hurt: 12, melee: 20, grenade: 24, dash: 18, death: 60 }[clip] ?? 60;
    entries.push({ descriptor: { id: 'hero', actorId: hero.actorId, x: hero.x, y: hero.y, z: hero.z, heading: hero.heading,
      clip, clipTimeSeconds: loop ? Math.max(0, hero.actionTick % 60) / 60 : Math.min(1, Math.max(0, hero.actionTick) / duration), pixelsPerMetre }, originals: hero.originals });
  }
  const bossEntries = createLiquidator3dEntries(boss);
  if (bossEntries.length) return entries.concat(bossEntries);
  if (enemy && ['idle', 'run', 'tell', 'attack', 'hit', 'death'].includes(enemy.pose?.state)) {
    const pose = enemy.pose, time = Math.max(0, pose.phaseTick ?? pose.tick ?? 0) / 60;
    entries.push({ descriptor: { id: `enemy:${enemy.id}`, actorId: 'bagholder-rusher', x: enemy.x, y: enemy.y, z: enemy.z,
      heading: (2 - (pose.direction ?? 0)) * Math.PI / 4, clip: pose.state,
      clipTimeSeconds: ['idle', 'run'].includes(pose.state) ? time % 1 : Math.min(1, time), pixelsPerMetre }, originals: enemy.originals });
  }
  return entries;
}

export function createActor3dPilotController({ renderer, canvas, attachDisplay = () => {}, onTelemetry = () => {},
  backendFactory = options => import('./actor-3d-pixi.mjs').then(module => module.createActor3dPixiBackend({ renderer, ...options })) } = {}) {
  const abort = new AbortController();
  const hidden = new Map(); let disposed = false;
  const restore = () => { for (const [display, record] of hidden) if (!display.destroyed) display.renderable = record.value; hidden.clear(); };
  const session = createActor3dPilotSession({ enabled: true, supported: supported(renderer, canvas), createBackend: () => backendFactory({ signal: abort.signal }), attachDisplay,
    onFallback: reason => { abort.abort(); restore(); onTelemetry({ status: 'fallback', count: 0, reason }); } });
  const lost = () => session.handleContextLoss();
  canvas?.addEventListener('webglcontextlost', lost);
  const controller = {
    get status() { return session.status; },
    ownsOriginal(display, id) { return hidden.get(display)?.id === id && session.status === 'ready'; },
    async start() { const status = await session.start(); if (!disposed && status !== 'fallback') onTelemetry({ status, count: 0 }); return status; },
    update(entries, camera, viewport) {
      restore(); if (disposed || session.status !== 'ready') return false;
      try {
        if (!Array.isArray(entries) || entries.length > 2) throw new TypeError('two-instance pilot required');
        const frame = entries.map(entry => createActor3dProjection(entry.descriptor, camera, viewport));
        if (!session.render(frame)) return false;
        for (const entry of entries) for (const display of entry.originals ?? []) {
          if (!hidden.has(display)) hidden.set(display, { value: display.renderable, id: entry.descriptor.id });
          display.renderable = false;
        }
        onTelemetry({ status: session.status, count: frame.length }); return true;
      } catch { session.handleFailure(); return false; }
    },
    updateGame(hero, enemy, camera, viewport, boss = null) { return controller.update(createActor3dPresentationEntries(hero, enemy, boss), camera, viewport); },
    dispose() {
      if (disposed) return; disposed = true; abort.abort(); restore(); session.dispose(); canvas?.removeEventListener('webglcontextlost', lost);
    },
  };
  return Object.freeze(controller);
}
