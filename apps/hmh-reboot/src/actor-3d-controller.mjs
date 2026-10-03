// Quality-bounded actors. Owns presentation displays and visibility
// only; its backend receives detached frozen projections, never simulation.
import { createActor3dProjection, createActor3dPilotSession, createLiquidator3dEntries } from './actor-3d-projection.mjs';
import { HERO_ACTOR_IDS, createIdleFidgetPicker, createHeroMovementPicker, heroClipTime, heroHasClip, selectHeroActor3dClip } from './actor-3d-clips.mjs';

// Lazy chunk: the six 2.0 enemies register here (GLB + manifest under
// hmh-actor-3d-pilot/) without touching the initial bundle or the legacy tables.
export const ACTOR3D_ENEMY_IDS = Object.freeze(['bagholder-rusher', 'forkrunner', 'liquidator-agent', 'whale-enforcer', 'gas-bomber', 'validator-cultist',
  'tollkeeper', 'money-printer', 'pump-and-dump-bloater', 'hodl-revenant', 'rug-puller', 'oracle-marksman']);
// The three district bosses (slice HMH-BOSSES-2-4): GLB + manifest under
// hmh-actor-3d-pilot/<id>.glb, keyed by the boss modules' target ids. Their ten
// clips are presentation-only; the simulation's boss pose picks one per frame.
export const ACTOR3D_BOSS_IDS = Object.freeze(['boss-rug-pull-baron', 'boss-51-foreman', 'boss-lockkeeper']);
export const ACTOR3D_BOSS_CLIPS = Object.freeze(['idle', 'run', 'tell', 'attack', 'attack-2', 'super-tell', 'super', 'hit', 'stagger', 'death']);
const BOSS_LOOP_CLIPS = new Set(['idle', 'run']);

// District bosses render ahead of ordinary enemies (boss priority, like the
// Liquidator). Input rows are detached presentation records:
// { id, actorId, active, visible, alpha, x, y, z, bodyHeight?, pose: { state, direction, phaseTick|tick }, originals }.
export function createDistrictBoss3dEntries(bosses, pixelsPerMetre = 40) {
  const rows = Array.isArray(bosses) ? bosses : bosses ? [bosses] : [];
  const entries = [];
  for (const boss of rows) {
    if (!ACTOR3D_BOSS_IDS.includes(boss?.actorId) || boss.active !== true || boss.visible !== true || boss.alpha !== 1) continue;
    const pose = boss.pose ?? {};
    if (!ACTOR3D_BOSS_CLIPS.includes(pose.state) || !Number.isInteger(pose.direction) || pose.direction < 0 || pose.direction > 7) continue;
    const tick = pose.phaseTick ?? pose.tick;
    if (![boss.x, boss.y, boss.z ?? 0, tick].every(Number.isFinite)) continue;
    const seconds = Math.max(0, tick) / 60;
    entries.push({ descriptor: { id: `boss:${boss.actorId}`, actorId: boss.actorId, x: boss.x, y: boss.y, z: boss.z ?? 0,
      heading: pose.direction * Math.PI / 4, clip: pose.state,
      clipTimeSeconds: BOSS_LOOP_CLIPS.has(pose.state) ? seconds % 1 : Math.min(1, seconds),
      pixelsPerMetre: Number.isFinite(boss.bodyHeight) && boss.bodyHeight > 0 ? boss.bodyHeight / 2.1 : pixelsPerMetre }, originals: boss.originals ?? [] });
  }
  return entries.sort((a, b) => (a.descriptor.id < b.descriptor.id ? -1 : a.descriptor.id > b.descriptor.id ? 1 : 0));
}

// Guns the 3D hero can hold: the native pistol, or a lazily seated weapon
// model (2.0 weapons lane). Until that model is resident the sprite hero and
// its held-weapon page keep drawing, so a slow fetch never empties the hand.
export const ACTOR3D_HERO_WEAPON_IDS = Object.freeze(['coin-blaster', 'scatter-shotgun', 'auto-miner', 'hash-rail', 'lightning-ledger', 'bear-market-burner', 'forked-standard', 'launcher-rig']);

export const ACTOR3D_QUALITY_LIMITS = Object.freeze({ low: 8, medium: 24, high: 64 });
// This policy lives in the lazy chunk. Hardware hints only choose presentation;
// unsupported WebGL contexts are still rejected before any GLB fetch.
export function resolveActor3dDeliveryPolicy({ switchValue, quality, profileId, hardwareConcurrency, saveData = false } = {}) {
  const qualityTier = profileId === 'desktop' && Object.hasOwn(ACTOR3D_QUALITY_LIMITS, quality) ? quality
    : profileId === 'desktop' ? 'medium' : 'low';
  const reason = switchValue === '0' || quality === 'sprites' ? 'opt-out'
    : switchValue !== '1' && (saveData || (Number.isFinite(hardwareConcurrency) && hardwareConcurrency <= 2)) ? 'device-budget' : 'default';
  return Object.freeze({ enabled:reason === 'default', qualityTier, reason });
}
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

export function createActor3dPresentationEntries(hero, enemies, boss = null, maxActors = ACTOR3D_QUALITY_LIMITS.medium, focus = hero, districtBosses = null, corpses = null) {
  actorLimit(maxActors);
  const entries = [], pixelsPerMetre = Number.isFinite(hero?.bodyHeight) && hero.bodyHeight > 0 ? hero.bodyHeight / 2.1 : 40;
  const authored = hero ? selectHeroActor3dClip(hero) : null;
  if (HERO_ACTOR_IDS.includes(hero?.actorId) && ACTOR3D_HERO_WEAPON_IDS.includes(hero.weaponId) && (hero.action !== 'interact' || authored)) {
    // Existing states map exactly as before; a named library clip (cover, traversal,
    // fidget...) is selected only when it exists for this hero and carries its own tick.
    let clip = hero.action === 'aim' && hero.moving ? 'run' : hero.action, tick = hero.actionTick;
    if (authored && heroHasClip(hero.actorId, authored.clip)) { clip = authored.clip; tick = authored.clipTick; }
    if (hero.action !== 'death' && heroHasClip(hero.actorId, hero.clip) && Number.isFinite(hero.clipTick)) { clip = hero.clip; tick = hero.clipTick; }
    entries.push({ descriptor: { id: 'hero', actorId: hero.actorId, x: hero.x, y: hero.y, z: hero.z, heading: hero.heading,
      bodyTint: hero.bodyTint, weaponTint: hero.weaponTint, weaponId: hero.weaponId,
      clip, clipTimeSeconds: heroClipTime(clip, tick), pixelsPerMetre }, originals: hero.originals });
  }
  entries.push(...createLiquidator3dEntries(boss));
  for (const entry of createDistrictBoss3dEntries(districtBosses, pixelsPerMetre)) if (entries.length < maxActors) entries.push(entry);
  const originX = Number.isFinite(focus?.x) ? focus.x : 0, originY = Number.isFinite(focus?.y) ? focus.y : 0;
  const candidates = (Array.isArray(enemies) ? enemies : enemies ? [enemies] : []).filter(enemy =>
    ACTOR3D_ENEMY_IDS.includes(enemy?.actorId) && enemy.active === true && enemy.visible === true && enemy.alpha === 1
    && ['idle', 'run', 'tell', 'attack', 'hit', 'death'].includes(enemy.pose?.state)
    && [enemy.x, enemy.y, enemy.z ?? 0, enemy.pose.phaseTick ?? enemy.pose.tick ?? 0].every(Number.isFinite))
    .map(enemy => ({ enemy, id: String(enemy.id), distance: (enemy.x - originX) ** 2 + (enemy.y - originY) ** 2 }))
    .sort((a, b) => a.distance - b.distance || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const { enemy } of candidates) {
    if (entries.length >= maxActors) break;
    // Native exports normalize every action to one second. The existing hit
    // event lasts six ticks; /60 displayed only the first tenth of its pose.
    const pose = enemy.pose, time = Math.max(0, pose.phaseTick ?? pose.tick ?? 0) / (pose.state === 'hit' ? 6 : 60);
    entries.push({ descriptor: { id: `enemy:${enemy.id}`, actorId: enemy.actorId, x: enemy.x, y: enemy.y, z: enemy.z,
      heading: (2 - (pose.direction ?? 0)) * Math.PI / 4, clip: pose.state,
      clipTimeSeconds: ['idle', 'run'].includes(pose.state) ? time % 1 : Math.min(1, time), pixelsPerMetre }, originals: enemy.originals });
  }
  // Retired bodies are presentation records, never living simulation actors.
  // Live actors reserve their quality slots first; translucent fades retain
  // the established sprite path because this depth pass is opaque-only.
  const fallen = (Array.isArray(corpses) ? corpses : corpses ? [corpses] : []).filter(corpse =>
    ACTOR3D_ENEMY_IDS.includes(corpse?.actorId) && corpse.visible === true && corpse.alpha === 1
    && typeof corpse.id === 'string' && corpse.id.length > 0 && corpse.pose?.state === 'death'
    && Number.isInteger(corpse.pose.direction) && corpse.pose.direction >= 0 && corpse.pose.direction < 8
    && [corpse.x,corpse.y,corpse.z ?? 0,corpse.pose.tick].every(Number.isFinite) && corpse.pose.tick >= 0)
    .map(corpse => ({corpse,distance:(corpse.x-originX)**2+(corpse.y-originY)**2}))
    .sort((a,b)=>a.distance-b.distance || (a.corpse.id < b.corpse.id ? -1 : a.corpse.id > b.corpse.id ? 1 : 0));
  for(const {corpse} of fallen) {
    if(entries.length >= maxActors) break;
    entries.push({descriptor:{id:`corpse:${corpse.id}`,actorId:corpse.actorId,x:corpse.x,y:corpse.y,z:corpse.z ?? 0,
      heading:(2-corpse.pose.direction)*Math.PI/4,clip:'death',clipTimeSeconds:Math.min(1,corpse.pose.tick/60),pixelsPerMetre},originals:corpse.originals});
  }
  return entries;
}

export function createActor3dPilotController({ renderer, canvas, qualityTier = 'medium', heroActorId = 'lit-commando', attachDisplay = () => {}, onTelemetry = () => {},
  fidgetPicker = null, presentationRandom = undefined,
  backendFactory = options => import('./actor-3d-pixi.mjs').then(module => module.createActor3dPixiBackend({ renderer, ...options })) } = {}) {
  const tier = Object.hasOwn(ACTOR3D_QUALITY_LIMITS, qualityTier) ? qualityTier : 'medium';
  const maxActors = ACTOR3D_QUALITY_LIMITS[tier];
  const selectedHero = HERO_ACTOR_IDS.includes(heroActorId) ? heroActorId : null;
  // Idle fidgets are chosen by a presentation hash after 4 s of standing still and
  // cancelled the instant the hero does anything else. Never simulation RNG.
  const fidgets = fidgetPicker ?? createIdleFidgetPicker({ actorId: selectedHero, ...(presentationRandom ? { random: presentationRandom } : {}) });
  const movement = createHeroMovementPicker({actorId:selectedHero});
  const abort = new AbortController();
  const hidden = new Map(); let disposed = false, backend = null;
  const restore = () => { for (const [display, record] of hidden) if (!display.destroyed) display.renderable = record.value; hidden.clear(); };
  const session = createActor3dPilotSession({ enabled: true, supported: supported(renderer, canvas), createBackend: async () => (backend = await backendFactory({ signal: abort.signal, maxActors, qualityTier:tier, heroActorId: selectedHero })), attachDisplay,
    onFallback: reason => { abort.abort(); restore(); onTelemetry({ status: 'fallback', count: 0, corpseCount:0, enemyHitCount:0, reason }); } });
  const lost = () => session.handleContextLoss();
  canvas?.addEventListener('webglcontextlost', lost);
  const controller = {
    get status() { return session.status; },
    ownsOriginal(display, id) { return hidden.get(display)?.id === id && session.status === 'ready'; },
    // World-unit offset of the drawn hero's muzzle from its foot position for
    // the last rendered frame, or null while sprites own the hero.
    heroMuzzleOffset() { return !disposed && session.status === 'ready' && hidden.size > 0 ? backend?.heroMuzzle?.() ?? null : null; },
    async start() { const status = await session.start(); if (!disposed && status !== 'fallback') onTelemetry({ status, count: 0, corpseCount:0, enemyHitCount:0 }); return status; },
    update(entries, camera, viewport) {
      restore(); if (disposed || session.status !== 'ready') return false;
      try {
        if (!Array.isArray(entries) || entries.length > maxActors) throw new TypeError('quality-bounded actor frame required');
        entries = entries.filter(entry => backend?.prepareActor?.(entry.descriptor.actorId) !== false
          && (entry.descriptor.id !== 'hero' || !entry.descriptor.weaponId || entry.descriptor.weaponId === 'coin-blaster' || backend?.prepareWeapon?.(entry.descriptor.weaponId) === true));
        const frame = entries.map(entry => createActor3dProjection(entry.descriptor, camera, viewport));
        if (!session.render(frame)) return false;
        for (const entry of entries) for (const display of entry.originals ?? []) {
          if (!hidden.has(display)) hidden.set(display, { value: display.renderable, id: entry.descriptor.id });
          display.renderable = false;
        }
        let corpseCount=0,enemyHitCount=0;
        for(const row of frame) { if(row.id.startsWith('corpse:')) corpseCount++; else if(row.id.startsWith('enemy:') && row.clip === 'hit') enemyHitCount++; }
        onTelemetry({ status: session.status, count: frame.length, qualityTier: tier, maxActors,corpseCount,enemyHitCount }); return true;
      } catch { session.handleFailure(); return false; }
    },
    updateGame(hero, enemies, camera, viewport, boss = null, districtBosses = null, corpses = null) {
      try {
        const accent = movement.observe(hero);
        const fidget = fidgets.observe({ tick: hero?.actionTick, idle: !accent && hero?.actorId === selectedHero && hero.action === 'idle' && !hero.moving && hero.clip === undefined && !selectHeroActor3dClip(hero) });
        const chosen = accent ?? fidget;
        const presented = chosen ? { ...hero, clip: chosen.clip, clipTick: chosen.tick } : hero;
        return controller.update(createActor3dPresentationEntries(presented, enemies, boss, maxActors, hero ?? camera, districtBosses, corpses).filter(entry => entry.descriptor.id !== 'hero' || entry.descriptor.actorId === selectedHero), camera, viewport);
      } catch { restore(); session.handleFailure(); return false; }
    },
    dispose() {
      if (disposed) return; disposed = true; movement.reset(); abort.abort(); restore(); session.dispose(); canvas?.removeEventListener('webglcontextlost', lost);
    },
  };
  return Object.freeze(controller);
}
