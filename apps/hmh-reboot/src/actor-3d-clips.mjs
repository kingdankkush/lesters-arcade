// Hero clip selection helpers for the lazy-loaded 3D actor pilot. Presentation
// only: clip names, playback clocks and the idle-fidget picker never touch the
// simulation, its RNG streams, evidence or results. The table itself is
// generated from the authored catalogue by scripts/hmh-blender/export-hmh-hero-clips.py.
import { HERO_CLIP_TABLE, HERO_FIDGET_CLIPS, HERO_FIDGET_DELAY_TICKS, HERO_NATIVE_CLIPS, HERO_SHARED_LIBRARY_CLIPS } from './actor-3d-clip-table.mjs';
import { deterministicUnit } from './deterministic-hash.mjs';

export { HERO_CLIP_TABLE, HERO_FIDGET_CLIPS, HERO_FIDGET_DELAY_TICKS, HERO_NATIVE_CLIPS, HERO_SHARED_LIBRARY_CLIPS };
export const HERO_ACTOR_IDS = Object.freeze(['lit-commando', 'lilly', 'lit-valkyrie', 'lester-original']);
// The controller's original per-state clocks; kept verbatim so existing states map exactly as before.
const LEGACY_DURATION = Object.freeze({ 'pistol-fire': 12, hurt: 12, melee: 20, grenade: 24, dash: 18, death: 60 });
const LEGACY_LOOP = Object.freeze(['idle', 'run', 'aim']);

export function heroClipInfo(name) {
  return Object.hasOwn(HERO_CLIP_TABLE, name) ? HERO_CLIP_TABLE[name] : null;
}

export function heroHasClip(actorId, name) {
  if (typeof name !== 'string' || !heroClipInfo(name)) return false;
  return HERO_NATIVE_CLIPS.includes(name) || HERO_SHARED_LIBRARY_CLIPS.includes(name) || (HERO_FIDGET_CLIPS[actorId] ?? []).includes(name);
}

export function heroClipTime(name, tick) {
  const info = heroClipInfo(name);
  const loop = info ? info.loop : LEGACY_LOOP.includes(name);
  const frames = info ? info.frames : LEGACY_DURATION[name] ?? 60;
  if (!Number.isFinite(tick)) return 0;
  return loop ? Math.max(0, tick % frames) / frames : Math.min(1, Math.max(0, tick) / frames);
}

export function heroClipProp(name) {
  return heroClipInfo(name)?.prop ?? 'blaster';
}

// Read-only event projection into the existing library. No timers are written
// back to gameplay; these clocks come from observed shot/reload/mission state.
export function selectHeroActor3dClip(hero) {
  const { action, actionTick = 0, weaponId, shotAge, reloadProgress, missionGesture, missionTick, velocity, heading } = hero;
  if (['death', 'hurt', 'dash', 'melee', 'grenade'].includes(action)) return null;
  if (action === 'interact') {
    const clip = { lever:'interact-lever', crank:'interact-valve', press:'interact-button', kneel:'interact-door' }[missionGesture];
    return clip ? { clip, clipTick:Math.max(0, Number.isFinite(missionTick) ? missionTick : actionTick) } : null;
  }
  if (Number.isFinite(reloadProgress) && reloadProgress > 0 && reloadProgress < 1) {
    const clip = weaponId === 'coin-blaster' ? 'reload-pistol' : ['launcher-rig','bear-market-burner','lightning-ledger'].includes(weaponId) ? 'reload-heavy' : 'reload-long';
    return { clip, clipTick:reloadProgress * heroClipInfo(clip).frames };
  }
  const fire = { 'scatter-shotgun':'fire-shotgun', 'auto-miner':'fire-rifle', 'hash-rail':'fire-rifle', 'forked-standard':'fire-rifle',
    'lightning-ledger':'fire-heavy', 'bear-market-burner':'fire-heavy', 'launcher-rig':'fire-launcher' }[weaponId];
  if (fire && Number.isFinite(shotAge) && shotAge >= 0 && shotAge < heroClipInfo(fire).frames) return { clip:fire, clipTick:shotAge };
  if (action === 'aim' && hero.moving && [velocity?.x, velocity?.y, heading].every(Number.isFinite) && Math.hypot(velocity.x,velocity.y) > 1) {
    const forward = velocity.x*Math.cos(heading)+velocity.y*Math.sin(heading);
    const side = -velocity.x*Math.sin(heading)+velocity.y*Math.cos(heading);
    const clip = forward < -Math.abs(side)*.7 ? 'back-pedal' : Math.abs(side) > Math.abs(forward)*1.3 ? side > 0 ? 'strafe-r' : 'strafe-l' : 'run';
    return { clip, clipTick:Math.max(0, actionTick) };
  }
  return null;
}

// Short authored accents observe existing locomotion; they never accelerate,
// stop or rotate the actor. Action clocks are global only for idle/aim/run,
// so combat, cover and traversal reset this small presentation history.
export function createHeroMovementPicker({actorId} = {}) {
  let previous = null, active = null;
  const reset = () => { previous = null; active = null; };
  return Object.freeze({reset, observe(hero) {
    const tick = hero?.actionTick, heading = hero?.heading;
    const authored = hero ? selectHeroActor3dClip(hero) : null;
    if (hero?.actorId !== actorId || !HERO_ACTOR_IDS.includes(actorId)
      || !['idle','aim','run'].includes(hero.action) || hero.clip !== undefined
      || !Number.isInteger(tick) || tick < 0 || !Number.isFinite(heading)
      || (authored && authored.clip !== 'run')) { reset(); return null; }
    const moving = !!hero.moving;
    if (!previous || tick < previous.tick || tick - previous.tick > 30) {
      previous = {tick,moving,heading}; active = null; return null;
    }
    let next = null;
    if (moving !== previous.moving) next = moving ? 'run-start' : 'run-stop';
    else if (!moving && !active) {
      const delta = Math.atan2(Math.sin(heading-previous.heading),Math.cos(heading-previous.heading));
      if (Math.abs(delta) >= Math.PI/3) next = Math.abs(delta) >= Math.PI*.75 ? 'pivot' : delta > 0 ? 'turn-r' : 'turn-l';
    }
    if (next) { active = {clip:next,startTick:tick}; previous.heading = heading; }
    previous.tick = tick; previous.moving = moving;
    if (moving) previous.heading = heading;
    if (active) {
      const local = tick-active.startTick;
      if (local < heroClipInfo(active.clip).frames) return {clip:active.clip,tick:local};
      active = null; previous.heading = heading;
    }
    return null;
  }});
}

// Picks one of the hero's four idle fidgets after the hero has stood still for
// delayTicks, using a presentation-only hash (never the simulation's streams).
// Any non-idle observation cancels the fidget instantly. Deterministic for a
// given idle history and random source, so replays present identically.
export function createIdleFidgetPicker({ actorId, delayTicks = HERO_FIDGET_DELAY_TICKS, random = deterministicUnit } = {}) {
  const fidgets = HERO_FIDGET_CLIPS[actorId] ?? [];
  let idleSince = null, lastTick = null, active = null, previous = null;
  const reset = () => { idleSince = null; lastTick = null; active = null; };
  return Object.freeze({
    get fidgets() { return fidgets; },
    reset,
    observe({ tick, idle } = {}) {
      if (!idle || !Number.isInteger(tick) || tick < 0 || fidgets.length === 0) { reset(); return null; }
      if (idleSince === null || lastTick === null || tick < lastTick) { idleSince = tick; active = null; }
      lastTick = tick;
      if (active) {
        const local = tick - active.startTick, info = heroClipInfo(active.clip);
        if (info && local < info.frames) return { clip: active.clip, tick: local };
        previous = active.clip; active = null; idleSince = tick;
      }
      if (tick - idleSince < delayTicks) return null;
      const unit = random(`hmh-fidget:${actorId}:${tick}`);
      let index = Math.min(fidgets.length - 1, Math.max(0, Math.floor((Number.isFinite(unit) ? unit : 0) * fidgets.length)));
      if (fidgets.length > 1 && fidgets[index] === previous) index = (index + 1) % fidgets.length;
      active = { clip: fidgets[index], startTick: tick };
      return { clip: active.clip, tick: 0 };
    },
  });
}
