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
