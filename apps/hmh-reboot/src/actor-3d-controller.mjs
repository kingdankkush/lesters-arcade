// Default-off quality-bounded actors. Owns presentation displays and visibility
// only; its backend receives detached frozen projections, never simulation.
import { createActor3dProjection, createActor3dPilotSession, createLiquidator3dEntries } from './actor-3d-projection.mjs';

// Lazy chunk: the six 2.0 enemies register here (GLB + manifest under
// hmh-actor-3d-pilot/) without touching the initial bundle or the legacy tables.
export const ACTOR3D_ENEMY_IDS = Object.freeze(['bagholder-rusher', 'forkrunner', 'liquidator-agent', 'whale-enforcer', 'gas-bomber', 'validator-cultist',
  'tollkeeper', 'money-printer', 'pump-and-dump-bloater', 'hodl-revenant', 'rug-puller', 'oracle-marksman']);

export const ACTOR3D_QUALITY_LIMITS = Object.freeze({ low: 8, medium: 24, high: 64 });
const actorLimit = value => {
  if (!Number.isInteger(value) || value < 2 || value > ACTOR3D_QUALITY_LIMITS.high) throw new TypeError('bounded actor limit required');
  return value;
};

export function actor3dDepthBands(frame, creationOrder, maxActors = ACTOR3D_QUALITY_LIMITS.medium) {
  if (frame.length > actorLimit(maxActors) || frame.some(p => !Number.isFinite(p.depth))) throw new TypeError('bounded finite actor depth required');
  const ordered = [...frame].sort((a, b) => a.depth - b.depth || creationOrder.get(a.id) - creationOrder.get(b.id));
  const step = 1.6 / Math.max(1, ordered.length), bands = new Map();
  for (let rank = 0; rank < ordered.length; rank++) bands.set(ordered[rank].id, { center: .8 - step * (rank + .5), halfWidth: step * .35 });
  return bands;
}

export function createActor3dDepthRegistry(maxActors = ACTOR3D_QUALITY_LIMITS.medium) {
  actorLimit(maxActors);
  const order = new Map(); let next = 0;
  return Object.freeze({
    get size() { return order.size; },
    add(id) { if (order.size >= maxActors || order.has(id)) throw new TypeError('bounded unique actor lifetime required'); order.set(id, next++); },
    remove(id) { order.delete(id); },
    frame(frame) { return actor3dDepthBands(frame, order, maxActors); },
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

export function createActor3dPresentationEntries(hero, enemies, boss = null, maxActors = ACTOR3D_QUALITY_LIMITS.medium, focus = hero) {
  actorLimit(maxActors);
  const entries = [], pixelsPerMetre = Number.isFinite(hero?.bodyHeight) && hero.bodyHeight > 0 ? hero.bodyHeight / 2.1 : 40;
  if (['lit-commando', 'lilly', 'lit-valkyrie', 'lester-original'].includes(hero?.actorId) && hero.weaponId === 'coin-blaster' && hero.action !== 'interact') {
    const clip = hero.action === 'aim' && hero.moving ? 'run' : hero.action;
    const loop = ['idle', 'run', 'aim'].includes(clip), duration = { 'pistol-fire': 12, hurt: 12, melee: 20, grenade: 24, dash: 18, death: 60 }[clip] ?? 60;
    entries.push({ descriptor: { id: 'hero', actorId: hero.actorId, x: hero.x, y: hero.y, z: hero.z, heading: hero.heading,
      bodyTint: hero.bodyTint, weaponTint: hero.weaponTint,
      clip, clipTimeSeconds: loop ? Math.max(0, hero.actionTick % 60) / 60 : Math.min(1, Math.max(0, hero.actionTick) / duration), pixelsPerMetre }, originals: hero.originals });
  }
  entries.push(...createLiquidator3dEntries(boss));
  const originX = Number.isFinite(focus?.x) ? focus.x : 0, originY = Number.isFinite(focus?.y) ? focus.y : 0;
  const candidates = (Array.isArray(enemies) ? enemies : enemies ? [enemies] : []).filter(enemy =>
    ACTOR3D_ENEMY_IDS.includes(enemy?.actorId) && enemy.active === true && enemy.visible === true && enemy.alpha === 1
    && ['idle', 'run', 'tell', 'attack', 'hit', 'death'].includes(enemy.pose?.state)
    && [enemy.x, enemy.y, enemy.z ?? 0, enemy.pose.phaseTick ?? enemy.pose.tick ?? 0].every(Number.isFinite))
    .map(enemy => ({ enemy, id: String(enemy.id), distance: (enemy.x - originX) ** 2 + (enemy.y - originY) ** 2 }))
    .sort((a, b) => a.distance - b.distance || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const { enemy } of candidates) {
    if (entries.length >= maxActors) break;
    const pose = enemy.pose, time = Math.max(0, pose.phaseTick ?? pose.tick ?? 0) / 60;
    entries.push({ descriptor: { id: `enemy:${enemy.id}`, actorId: enemy.actorId, x: enemy.x, y: enemy.y, z: enemy.z,
      heading: (2 - (pose.direction ?? 0)) * Math.PI / 4, clip: pose.state,
      clipTimeSeconds: ['idle', 'run'].includes(pose.state) ? time % 1 : Math.min(1, time), pixelsPerMetre }, originals: enemy.originals });
  }
  return entries;
}

export function createActor3dPilotController({ renderer, canvas, qualityTier = 'medium', heroActorId = 'lit-commando', attachDisplay = () => {}, onTelemetry = () => {},
  backendFactory = options => import('./actor-3d-pixi.mjs').then(module => module.createActor3dPixiBackend({ renderer, ...options })) } = {}) {
  const tier = Object.hasOwn(ACTOR3D_QUALITY_LIMITS, qualityTier) ? qualityTier : 'medium';
  const maxActors = ACTOR3D_QUALITY_LIMITS[tier];
  const selectedHero = ['lit-commando', 'lilly', 'lit-valkyrie', 'lester-original'].includes(heroActorId) ? heroActorId : null;
  const abort = new AbortController();
  const hidden = new Map(); let disposed = false, backend = null;
  const restore = () => { for (const [display, record] of hidden) if (!display.destroyed) display.renderable = record.value; hidden.clear(); };
  const session = createActor3dPilotSession({ enabled: true, supported: supported(renderer, canvas), createBackend: async () => (backend = await backendFactory({ signal: abort.signal, maxActors, heroActorId: selectedHero })), attachDisplay,
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
        if (!Array.isArray(entries) || entries.length > maxActors) throw new TypeError('quality-bounded actor frame required');
        entries = entries.filter(entry => backend?.prepareActor?.(entry.descriptor.actorId) !== false);
        const frame = entries.map(entry => createActor3dProjection(entry.descriptor, camera, viewport));
        if (!session.render(frame)) return false;
        for (const entry of entries) for (const display of entry.originals ?? []) {
          if (!hidden.has(display)) hidden.set(display, { value: display.renderable, id: entry.descriptor.id });
          display.renderable = false;
        }
        onTelemetry({ status: session.status, count: frame.length, qualityTier: tier, maxActors }); return true;
      } catch { session.handleFailure(); return false; }
    },
    updateGame(hero, enemies, camera, viewport, boss = null) {
      try { return controller.update(createActor3dPresentationEntries(hero, enemies, boss, maxActors, hero ?? camera).filter(entry => entry.descriptor.id !== 'hero' || entry.descriptor.actorId === selectedHero), camera, viewport); }
      catch { restore(); session.handleFailure(); return false; }
    },
    dispose() {
      if (disposed) return; disposed = true; abort.abort(); restore(); session.dispose(); canvas?.removeEventListener('webglcontextlost', lost);
    },
  };
  return Object.freeze(controller);
}
