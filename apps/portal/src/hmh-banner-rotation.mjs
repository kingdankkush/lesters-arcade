// Level 1 intro and loading-screen art rotation (docs/art/HMH-BANNERS-20260926.md 5.6).
// Pure sequence logic, shared by the portal intro and the HMH host page. Presentation only:
// the randomness here is cosmetic (cosmetic-rng-ok) and nothing under apps/hmh-reboot/src
// imports this module (tests/hmh-banner-rotation.test.mjs), so it can never touch the
// simulation, the seed, the bridge or evidence.

export const HMH_ROTATION_TIMING = Object.freeze({ holdMs: 7000, fadeMs: 900, gateMs: 4000 });
export const HMH_ROTATION_STORAGE_KEY = 'hmh-banner-rotation';
export const HMH_ROTATION_DEFAULT_HERO = 'lit-commando';
// The intro hands its current image to the loading screen when both belong to one run start.
const RESUME_MAX_AGE_MS = 10 * 60 * 1000;

function shuffle(list, random) {
  const out = [...list];
  for (let index = out.length - 1; index > 0; index -= 1) {
    const pick = Math.floor(random() * (index + 1));
    [out[index], out[pick]] = [out[pick], out[index]];
  }
  return out;
}

// Slot 0 is the selected hero's own loading image (or the resumed image). Every later slot
// draws from the hero's own images with probability `heroShare` and from the rest of the pool
// otherwise, each through a shuffle bag, and never repeats the image on screen.
export function createBannerRotation({ pool, heroLoading, heroId, random = Math.random, heroShare = 0.5, resume = null } = {}) { // cosmetic-rng-ok presentation-only art order
  const hero = Object.hasOwn(heroLoading ?? {}, heroId) ? heroId : HMH_ROTATION_DEFAULT_HERO;
  const ids = pool.map((entry) => entry.id);
  const own = pool.filter((entry) => entry.heroes.includes(hero)).map((entry) => entry.id);
  const rest = pool.filter((entry) => !entry.heroes.includes(hero)).map((entry) => entry.id);
  const bags = { own: [], rest: [] };
  let current = resume?.hero === hero && ids.includes(resume.current) ? resume.current : heroLoading[hero];

  const draw = (name) => {
    const source = name === 'own' ? own : rest;
    if (!bags[name].length) bags[name] = shuffle(source, random);
    let id = bags[name].pop();
    if (id === current && source.length > 1) {
      if (!bags[name].length) bags[name] = shuffle(source.filter((item) => item !== current), random);
      const replacement = bags[name].pop();
      bags[name].unshift(id);
      id = replacement;
    }
    return id;
  };

  return Object.freeze({
    hero,
    current: () => current,
    next() {
      const useOwn = rest.length === 0 || (own.length > 0 && random() < heroShare);
      current = draw(useOwn ? 'own' : 'rest');
      return current;
    },
    state: (source, now = Date.now()) => ({ hero, current, source, at: now }),
  });
}

// sessionStorage can be missing or throw (private windows, blocked storage); every surface
// works without it.
export function readRotationResume(storage, heroId, { source = 'intro', now = Date.now() } = {}) {
  try {
    const value = JSON.parse(storage?.getItem(HMH_ROTATION_STORAGE_KEY) ?? 'null');
    if (value && value.hero === heroId && value.source === source && typeof value.current === 'string'
      && Number.isFinite(value.at) && now - value.at >= 0 && now - value.at < RESUME_MAX_AGE_MS) return value;
  } catch { /* storage unavailable */ }
  return null;
}

export function writeRotationResume(storage, state) {
  try { storage?.setItem(HMH_ROTATION_STORAGE_KEY, JSON.stringify(state)); } catch { /* storage unavailable */ }
}

export function clearRotationResume(storage) {
  try { storage?.removeItem(HMH_ROTATION_STORAGE_KEY); } catch { /* storage unavailable */ }
}
