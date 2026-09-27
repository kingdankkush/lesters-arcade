// Perf step 8: the Auto graphics governor (lazy; main.mjs imports it after
// boot, so none of this is in the initial JS).
//
// Auto used to be one rule: a phone starts at resolution 1, earns one step to
// 1.5 after ~4 s of fast frames and drops back for good when frames slow.
// Desktop kept its profile value, so a 4K screen at DPR 2 rendered 8.3 Mpx.
// The governor keeps that behaviour and extends it:
//
// - a desktop pixel budget (4.2 Mpx): the top rung is the profile resolution
//   scaled down until the backbuffer fits, never below one pixel per CSS px;
// - an effects rung: when frames slow, the atmosphere budget and the weapon
//   VFX pool cap drop first, and only then does the resolution step down;
// - hysteresis: one reading is the p95 of a ~1 s window; several slow readings
//   in a row step down, many fast readings in a row step up, a cooldown
//   follows every change, and a rung that was tried and failed is never tried
//   again (the old "a step down is final" rule, per rung).
//
// Low / Medium / High pin a tier: a one-rung ladder at the tier's resolution.
// Projection only: the governor reads frame deltas and writes the renderer
// resolution, a pool cap and an atmosphere budget. Nothing here is read by the
// simulation, so no rung can change a tick, a hit, a spawn or a result.

export const GOVERNOR_DEFAULTS = Object.freeze({
  readingFrames: 60,      // one reading ~1 s at 60 Hz
  slowP95Ms: 25,          // a reading at or above this counts toward a step down
  fastP95Ms: 18,          // a reading at or below this counts toward a step up
  slowReadings: 3,        // consecutive slow readings before stepping down
  fastReadings: 8,        // consecutive fast readings before stepping up
  cooldownFrames: 300,    // ~5 s of ignored frames after any change
  pixelBudget: 4_200_000, // backbuffer pixels at the top desktop rung
  resolutionStep: 0.25,
  mobileMaxResolution: 1.5,
  // Evidence runs (evidenceSafe=1) turn the effects rung off so a slow
  // capture machine cannot thin the atmosphere or the weapon glows in a
  // screenshot; the ladder is then the pre-step-8 policy (a phone's 1 -> 1.5
  // step, a fixed desktop top).
  effectsRung: true,
});

// The effects rung: the weapon VFX pool keeps half its 192 sprites and the
// atmosphere draws half its fog banks and motes.
// The full cap mirrors MAX_WEAPON_VFX_SPRITES (weapon-vfx.mjs; a test pins
// the two together). Not imported: that would hoist weapon-vfx.mjs into a
// shared chunk and grow the initial JS for no runtime gain.
export const FULL_EFFECTS_VFX_CAP = 192;
export const REDUCED_EFFECTS_VFX_CAP = 96;

const round2 = (value) => Math.floor(value * 100 + 1e-6) / 100;

// The top resolution that keeps width x height x resolution^2 within the
// budget, never above the profile's resolution and never below min(1, it).
export function budgetedResolution({ resolution, width, height, pixelBudget = GOVERNOR_DEFAULTS.pixelBudget } = {}) {
  if (!(resolution > 0)) throw new TypeError('resolution must be positive');
  const area = width * height;
  if (!(area > 0)) return resolution;
  const fit = Math.sqrt(pixelBudget / area);
  return round2(Math.max(Math.min(1, resolution), Math.min(resolution, fit)));
}

// Rungs run from the cheapest (index 0) to the richest. Auto starts on
// `{ top, full }`; a phone may earn one rung above it.
export function buildGovernorLadder({ quality = 'auto', profile, width, height, devicePixelRatio = 1, options = {} } = {}) {
  if (typeof profile?.id !== 'string' || !(profile.resolution > 0)) throw new TypeError('profile with a resolution is required');
  const settings = { ...GOVERNOR_DEFAULTS, ...options };
  if (quality !== 'auto') return Object.freeze({ rungs: Object.freeze([Object.freeze({ resolution: profile.resolution, effects: 'full' })]), start: 0 });
  const top = profile.id === 'mobile' ? profile.resolution : budgetedResolution({ resolution: profile.resolution, width, height, pixelBudget: settings.pixelBudget });
  const floor = Math.min(1, top);
  const resolutions = [top];
  // Steps land on multiples of resolutionStep at least 0.1 below the top.
  for (let value = Math.floor((top - 0.1) / settings.resolutionStep + 1e-6) * settings.resolutionStep; value > floor + 1e-6; value -= settings.resolutionStep) resolutions.push(round2(value));
  if (resolutions.at(-1) > floor) resolutions.push(floor);
  const rungs = settings.effectsRung ? resolutions.reverse().map((resolution) => Object.freeze({ resolution, effects: 'reduced' })) : [];
  rungs.push(Object.freeze({ resolution: top, effects: 'full' }));
  const start = rungs.length - 1;
  if (profile.id === 'mobile') {
    const up = Math.min(settings.mobileMaxResolution, Math.max(top, devicePixelRatio));
    if (up > top) rungs.push(Object.freeze({ resolution: up, effects: 'full' }));
  }
  return Object.freeze({ rungs: Object.freeze(rungs), start });
}

// The atmosphere budget on a rung: the reduced-effects rungs halve it.
export function rungAtmosphereBudget(budget, rung) {
  if (rung?.effects !== 'reduced') return budget;
  return Object.freeze({ fog: Math.floor((budget?.fog ?? 0) / 2), motes: Math.floor((budget?.motes ?? 0) / 2) });
}

/**
 * Pure policy: feed frame deltas, get a rung back when it changes. `viewport`
 * is re-read once per reading, so a resize or rotation that moves the pixel
 * budget rebuilds the ladder and returns to its start rung. `onRung` runs for
 * the start rung at creation and for every change.
 */
export function createGraphicsGovernor({ quality = 'auto', profile, devicePixelRatio = 1, viewport = () => ({ width: 0, height: 0 }), options = {}, onRung = () => {} } = {}) {
  const settings = { ...GOVERNOR_DEFAULTS, ...options };
  const samples = new Float32Array(settings.readingFrames);
  let count = 0, cooldown = 0, slow = 0, fast = 0, lastStep = 0;
  let size = null, ladder = null, index = 0, ceiling = 0;
  const rebuild = () => {
    const { width, height } = viewport();
    size = `${width}x${height}`;
    ladder = buildGovernorLadder({ quality, profile, width, height, devicePixelRatio, options: settings });
    index = ladder.start;
    ceiling = ladder.rungs.length - 1;
    slow = 0; fast = 0; lastStep = 0; count = 0;
  };
  const move = (next) => {
    lastStep = Math.sign(next - index);
    index = next;
    slow = 0; fast = 0;
    cooldown = settings.cooldownFrames;
    onRung(ladder.rungs[index]);
    return ladder.rungs[index];
  };
  rebuild();
  onRung(ladder.rungs[index]);
  const p95 = () => {
    const sorted = Array.from(samples).sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
  };
  return Object.freeze({
    get quality() { return quality; },
    get rung() { return ladder.rungs[index]; },
    get index() { return index; },
    get ladder() { return ladder; },
    get effects() { return ladder.rungs[index].effects; },
    atmosphereBudget: (budget) => rungAtmosphereBudget(budget, ladder.rungs[index]),
    // Returns the new rung when it changes, otherwise null.
    sample(deltaMs) {
      if (!Number.isFinite(deltaMs) || deltaMs <= 0 || ladder.rungs.length === 1) return null;
      if (cooldown > 0) { cooldown -= 1; return null; }
      samples[count] = Math.min(250, deltaMs);
      count += 1;
      if (count < settings.readingFrames) return null;
      count = 0;
      const { width, height } = viewport();
      if (`${width}x${height}` !== size) {
        const before = ladder.rungs[index];
        rebuild();
        const after = ladder.rungs[index];
        if (after.resolution === before.resolution && after.effects === before.effects) return null;
        cooldown = settings.cooldownFrames;
        onRung(after);
        return after;
      }
      const reading = p95();
      if (reading >= settings.slowP95Ms) { slow += 1; fast = 0; }
      else if (reading <= settings.fastP95Ms) { fast += 1; slow = 0; }
      else { slow = 0; fast = 0; }
      if (slow >= settings.slowReadings && index > 0) {
        // A rung we just climbed to and could not hold is never retried.
        if (lastStep > 0) ceiling = index - 1;
        return move(index - 1);
      }
      if (fast >= settings.fastReadings && index < ceiling) return move(index + 1);
      return null;
    },
  });
}

// The side effects of a rung: renderer resolution, the weapon VFX pool cap and
// the telemetry keys the bench, the smokes and the ?perf=1 overlay read.
export function createRungApplier({ app, vfxPool = null, dataset = {} } = {}) {
  return (rung) => {
    if (vfxPool && 'limit' in vfxPool) vfxPool.limit = rung.effects === 'reduced' ? REDUCED_EFFECTS_VFX_CAP : FULL_EFFECTS_VFX_CAP;
    if (app?.renderer && app.renderer.resolution !== rung.resolution) {
      app.renderer.resolution = rung.resolution;
      app.resize?.();
    }
    dataset.adaptiveResolution = String(rung.resolution);
    dataset.graphicsEffects = rung.effects;
  };
}
