// Headless Chikun bot players for the difficulty harness (chikun-tune slice).
//
// A bot reads only what a player of its skill could see: the public runtime
// snapshot, delayed by its reaction time and filtered to its viewport and
// look-ahead. It plans with the same physics as the runtime and the pure
// course functions (the runtime is a closure and cannot be cloned), then
// presses with seeded motor noise. Nothing here touches Math.random.
//
// Model, per tick t:
//  - Perception: obstacles come from the snapshot `perceptionLag` ticks old,
//    filtered to the viewport (landscape x < 1280; portrait x < the right edge
//    of buildChikunViewport) and to `lookAheadPx` beyond Chikun (x = 280). On
//    portrait the in-game "<KIND> AHEAD" marker (upcomingChikunObstacle, the
//    game's own function) is drawn at the screen edge, so the obstacle it names
//    is perceived whatever the look-ahead. perceptionLag + pressLead equals the
//    profile's reaction delay, so an obstacle that appears at tick t can first
//    change a press at tick t + reactionDelayTicks.
//  - Cruise: with nothing in sight the bot returns to its cruise height, drawn
//    per run from CHIKUN_BOT_CRUISE_RANGE (botCruiseY).
//  - Self: the bot knows its own presses (efference copy), so it predicts its
//    own state `pressLead` ticks ahead exactly with the runtime physics.
//  - Planning: a small beam search over target altitudes, one per known
//    obstacle (plus when to start acting), simulated tick by tick against the
//    known obstacles with obstacleClearance. Score: survive, then keep a safety
//    margin, then take coins, then use fewer presses.
//  - Motor noise: a press meant for tick T lands at T + round(N(0, sigma)),
//    with N from an Irwin-Hall sum of mulberry32(seed ^ profileHash) draws.
//    One press is in flight at a time, and presses are at least 6 ticks apart
//    (a 10 taps-per-second human limit that is the same for every profile).
import { obstacleClearance } from '../../apps/portal/src/chikun-obstacles.mjs';
import { buildChikunViewport, upcomingChikunObstacle } from '../../apps/chikun/src/viewport.mjs';

export const CHIKUN_BOT_MIN_PRESS_GAP_TICKS = 6;

// Fixed before tuning (brief acceptance 2). Changes need a botChanges entry.
export const CHIKUN_BOT_PROFILES = Object.freeze([
  Object.freeze({ name: 'novice', reactionDelayTicks: 24, jitterSigmaTicks: 5, lookAheadPx: 260, viewport: Object.freeze({ orientation: 'portrait', width: 390, height: 844 }) }),
  Object.freeze({ name: 'intermediate', reactionDelayTicks: 18, jitterSigmaTicks: 3.5, lookAheadPx: 360, viewport: Object.freeze({ orientation: 'portrait', width: 390, height: 844 }) }),
  Object.freeze({ name: 'expert', reactionDelayTicks: 12, jitterSigmaTicks: 2, lookAheadPx: 520, viewport: Object.freeze({ orientation: 'landscape', width: 1280, height: 720 }) }),
  Object.freeze({ name: 'hardcore', reactionDelayTicks: 8, jitterSigmaTicks: 1.2, lookAheadPx: 700, viewport: Object.freeze({ orientation: 'landscape', width: 1280, height: 720 }) }),
  Object.freeze({ name: 'exceptional', reactionDelayTicks: 5, jitterSigmaTicks: 0.8, lookAheadPx: 1000, viewport: Object.freeze({ orientation: 'landscape', width: 1280, height: 720 }) }),
]);

export function botProfile(name) {
  const profile = CHIKUN_BOT_PROFILES.find((entry) => entry.name === name);
  if (!profile) throw new Error(`Unknown Chikun bot profile: ${name}`);
  return profile;
}

// Physics of the v5 runtime (chikun-ground-v5-runtime.mjs): soft ceiling.
export const CHIKUN_V5_PHYSICS = Object.freeze({
  chikunX: 280, radius: 30, runY: 660, jumpVelocity: -7.3, flightVelocity: -4.8,
  jumpGravity: 0.23, flightGravity: 0.12, maxFallVelocity: 7, ceilingY: 62, ceilingLethal: false,
  landingSlack: 665, fallDeathY: 775,
});

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function profileHash(name) {
  let hash = 0x811c9dc5;
  for (const character of String(name)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

// Standard normal from an Irwin-Hall sum of 12 uniforms (no transcendental math).
function normal(random) {
  let sum = 0;
  for (let i = 0; i < 12; i += 1) sum += random();
  return sum - 6;
}

export function viewportRightEdge(viewport) {
  if (viewport.orientation !== 'portrait') return 1280;
  const view = buildChikunViewport(viewport.width, viewport.height, 1);
  return view.left + view.width;
}

// What a player can see, for the scripted pilots in scripts/chikun-course-pilot.mjs:
// obstacles from the snapshot `delay` ticks old, filtered to the screen (landscape
// x < 1280; portrait the phone screen plus the in-game marker), with Chikun's own
// state current. The full runtime snapshot also holds obstacles up to about
// 1,850 px (more at speed), far past any screen; a pilot reading it is a solver.
export function createVisiblePilot(pilot, { orientation = 'landscape', width = 1280, height = 720, delay = 8, marker = upcomingChikunObstacle } = {}) {
  const view = buildChikunViewport(width, height, 1);
  const rightEdge = view.portrait ? view.left + view.width : 1280;
  const history = [];
  if ((orientation === 'portrait') !== view.portrait) throw new Error('createVisiblePilot orientation does not match the viewport size');
  return (snapshot) => {
    history.push(snapshot);
    if (history.length > delay + 1) history.shift();
    const seen = history[0];
    const marked = view.portrait ? marker(seen.forks, view, seen.difficulty?.speedMultiplier ?? 1) : null;
    return pilot({ ...snapshot, forks: seen.forks.filter((o) => o.x < rightEdge || o === marked) });
  };
}

// Course adapter: obstacle geometry at any future tick, built at x = 0 once and
// shifted, with bobbing sky obstacles cached per 240-tick phase.
const BOBBING = new Set(['drone', 'hawk', 'eagle', 'pelican', 'plane']);
export function createCourseModel(course, seed) {
  const cadence = course.COURSE_CADENCE;
  const xAt = typeof course.courseObstacleX === 'function'
    ? (index, tick) => course.courseObstacleX(index, tick)
    : (index, tick) => 1180 + course.distanceAtTick(index * cadence) - course.distanceAtTick(tick);
  const staticGeometry = new Map();
  const phaseGeometry = new Map();
  function geometry(index, tick) {
    let local = staticGeometry.get(index);
    if (local === undefined) {
      local = course.buildCourseObstacle({ seed, index, tick, x: 0 });
      if (BOBBING.has(local.kind) || BOBBING.has(local.variant)) {
        staticGeometry.set(index, null);
        local = null;
      } else {
        staticGeometry.set(index, local);
        return local;
      }
    }
    if (local) return local;
    const key = index * 240 + (tick % 240);
    let bob = phaseGeometry.get(key);
    if (!bob) { bob = course.buildCourseObstacle({ seed, index, tick, x: 0 }); phaseGeometry.set(key, bob); }
    return bob;
  }
  function forget(belowIndex) {
    for (const key of staticGeometry.keys()) if (key < belowIndex) staticGeometry.delete(key);
    for (const key of phaseGeometry.keys()) if (Math.floor(key / 240) < belowIndex) phaseGeometry.delete(key);
  }
  const base = (index) => 1180 + course.distanceAtTick(index * cadence);
  const isStatic = (index) => { geometry(index, 0); return staticGeometry.get(index) !== null; };
  return { xAt, geometry, forget, base, isStatic, distance: course.distanceAtTick, speedAtTick: course.speedAtTick };
}

const GROUND = -1;
const TARGETS = Object.freeze([GROUND, 600, 540, 480, 420, 360, 300, 240, 180, 130]);
const START_DELAYS = Object.freeze([0, 18, 36, 60]);
const TAIL_TICKS = 36;
// With nothing in sight a bot returns to its cruise height. Players differ in
// that habit, so each run draws its own from CHIKUN_BOT_CRUISE_RANGE (seeded like
// the jitter, never Math.random): the survival percentiles then describe a spread
// of habits instead of hinging on one constant (the committed 480 px cruise sat
// 10 px under the shallowest low passage).
export const CHIKUN_BOT_CRUISE_RANGE = Object.freeze([420, 540]);
export function botCruiseY(profileName, seed) {
  const [low, high] = CHIKUN_BOT_CRUISE_RANGE;
  return low + Math.floor(mulberry32((seed >>> 0) ^ profileHash(profileName) ^ 0x63727573)() * (high - low + 1));
}
const MAX_HORIZON = 480;

function wantsPress(state, target, sinceLastPress, physics) {
  if (target === GROUND || sinceLastPress < CHIKUN_BOT_MIN_PRESS_GAP_TICKS) return false;
  if (state.loco === 'run') return target < physics.runY - 40;
  if (state.y > target + 60) return state.v > -4.3;
  if (state.y > target + 30) return state.v > -1;
  return false;
}

// One physics step, mirroring the runtime. Returns false when Chikun falls out.
function stepPhysics(state, press, overGap, physics) {
  if (press) {
    if (state.loco === 'run') { state.loco = 'jump'; state.v = physics.jumpVelocity; }
    else { state.loco = 'flight'; state.v = physics.flightVelocity; }
  }
  const beforeY = state.y;
  if (state.loco === 'run' && overGap) state.loco = 'fall';
  if (state.loco !== 'run') {
    state.v = Math.min(physics.maxFallVelocity, state.v + (state.loco === 'flight' ? physics.flightGravity : physics.jumpGravity));
    state.y += state.v;
    if (state.y < physics.ceilingY) {
      if (physics.ceilingLethal) return false;
      state.y = physics.ceilingY; state.v = Math.max(0, state.v);
    }
    if (state.y >= physics.runY && !overGap && beforeY <= physics.landingSlack && state.v >= 0) { state.y = physics.runY; state.v = 0; state.loco = 'run'; }
  }
  return state.y <= physics.fallDeathY;
}

// `skim` (0 by default, and 0 for every harness profile) rewards passing an obstacle
// within the 32 px near-miss band; the v6 replay fixtures use it for a near-miss-heavy run.
export function createChikunBot({ profile, seed = 1, course, physics = CHIKUN_V5_PHYSICS, margin = 6, skim = 0, marker = upcomingChikunObstacle, cruiseY = null } = {}) {
  if (!profile || !course) throw new Error('createChikunBot needs a profile and a course module');
  const cruise = cruiseY ?? botCruiseY(profile.name, seed);
  const random = mulberry32((seed >>> 0) ^ profileHash(profile.name));
  const model = createCourseModel(course, seed >>> 0);
  const pressLead = Math.min(profile.reactionDelayTicks, Math.ceil(2 * profile.jitterSigmaTicks));
  const perceptionLag = profile.reactionDelayTicks - pressLead;
  const robustTicks = Math.round(profile.jitterSigmaTicks);
  const rightEdge = viewportRightEdge(profile.viewport);
  const portrait = profile.viewport.orientation === 'portrait';
  const view = portrait ? buildChikunViewport(profile.viewport.width, profile.viewport.height, 1) : null;
  let markersSeen = 0;
  const history = [];
  const known = new Map();
  const seen = new Set();
  const executed = [];
  let pending = null;
  let lastPress = -1_000;
  let plan = null;
  let planTick = -1_000;
  let currentTarget = GROUND;
  let knownVersion = 0;
  let plannedVersion = -1;
  let maxKnownIndex = -1;

  function perceive(snapshot) {
    const forks = snapshot.forks;
    const speed = snapshot.difficulty?.speedMultiplier ?? 1;
    // The portrait "<KIND> AHEAD" marker is screen information: it is drawn at
    // the right edge of the phone screen (inside every portrait look-ahead), so a
    // portrait bot learns the marked obstacle whatever its lookAheadPx.
    const marked = view ? marker(forks, view, speed) : null;
    for (const o of forks) {
      if (o.passed || seen.has(o.index)) continue;
      if (o !== marked && (o.x - 280 > profile.lookAheadPx || o.x >= rightEdge)) continue;
      if (o === marked) markersSeen += 1;
      known.set(o.index, true);
      seen.add(o.index);
      if (o.index > maxKnownIndex) maxKnownIndex = o.index;
      knownVersion += 1;
    }
  }

  // Simulate from `start` at tick `tick0`: hold `hold` for `delay` ticks, then
  // fly segment i toward targets[i] until obstacle i is behind Chikun. `forced`
  // is a press already in flight. `timing` models the bot's own imprecision:
  // +k presses land k ticks late, -k the bot acts k ticks early (it anticipates
  // its ballistic state), 0 is nominal.
  function simulate(start, tick0, obstacles, targets, delay, hold, horizonEnd, forced, timing, table) {
    const state = { y: start.y, v: start.v, loco: start.loco };
    const k = timing < 0 ? -timing : timing;
    const { dist, lo } = table;
    const cx = physics.chikunX;
    let since = start.since;
    let presses = 0;
    let minClear = Infinity;
    let coins = 0;
    let segment = 0;
    let simPending = null;
    let taken = 0;
    let skims = 0;
    const closest = skim > 0 ? [Infinity, Infinity, Infinity, Infinity, Infinity, Infinity, Infinity, Infinity] : null;
    let tick = tick0;
    for (; tick < horizonEnd; tick += 1) {
      const schedule = timing < 0 ? tick + k : tick - k;
      while (segment < obstacles.length - 1 && obstacles[segment].base - dist[schedule - lo] + obstacles[segment].width < cx - 40) segment += 1;
      const target = schedule - tick0 < delay ? hold : targets[Math.min(segment, targets.length - 1)];
      let press = false;
      if (forced !== null && tick <= forced) press = tick === forced;
      else if (timing > 0) {
        if (simPending === null && wantsPress(state, target, since, physics)) simPending = tick + k;
        if (simPending === tick) { press = true; simPending = null; }
      } else if (timing < 0 && state.loco !== 'run') {
        const g = state.loco === 'flight' ? physics.flightGravity : physics.jumpGravity;
        const ahead = { loco: state.loco, v: Math.min(physics.maxFallVelocity, state.v + g * k), y: state.y + state.v * k + g * k * (k + 1) / 2 };
        press = wantsPress(ahead, target, since, physics);
      } else press = wantsPress(state, target, since, physics);
      if (press) { presses += 1; since = 0; } else since += 1;
      const now = dist[tick + 1 - lo];
      // Gap under Chikun at the post-step tick, as in the runtime.
      let overGap = false;
      for (let i = 0; i < obstacles.length; i += 1) {
        const o = obstacles[i];
        if (o.family !== 'gap') continue;
        const x = o.base - now;
        if (cx > x && cx < x + o.width) { overGap = true; break; }
      }
      if (!stepPhysics(state, press, overGap, physics)) return { alive: false, survived: tick - tick0, minClear: -1, coins, presses };
      if (physics.ceilingLethal && state.y - physics.ceilingY < minClear) minClear = state.y - physics.ceilingY;
      for (let i = 0; i < obstacles.length; i += 1) {
        const o = obstacles[i];
        const x = o.base - now;
        if (x > cx + 40 || x + o.width < cx - 40) continue;
        const local = o.local ?? model.geometry(o.index, tick + 1);
        const clearance = obstacleClearance(local, cx - x, state.y, physics.radius);
        if (clearance < 0) return { alive: false, survived: tick - tick0, minClear: clearance, coins, presses };
        if (clearance < minClear) minClear = clearance;
        if (closest && i < 8 && clearance < closest[i]) closest[i] = clearance;
        if ((taken & (1 << i)) === 0) {
          const dx = local.coin.x + x - cx, dy = local.coin.y - state.y;
          if (dx * dx + dy * dy <= 49 * 49) { taken |= 1 << i; coins += 1; }
        }
      }
    }
    if (closest) for (let i = 0; i < obstacles.length && i < 8; i += 1) if (closest[i] <= 32) skims += 1;
    return { alive: true, survived: tick - tick0, minClear, coins, presses, skims };
  }

  function score(outcome) {
    const clear = Math.min(outcome.minClear, 40);
    return (outcome.alive ? 1e9 : 0) + outcome.survived * 1e5
      + Math.min(clear, margin) * 2_000 + outcome.coins * 150 + clear * 12 - outcome.presses * 30 + skim * (outcome.skims ?? 0);
  }

  // Nominal first; the best nominal candidates are re-scored against the bot's
  // own +/- k tick timing error (worst case), as a player who knows how precise
  // they are would.
  function evaluate(candidates, start, tick0, obstacles, horizonEnd, forced, keep, table) {
    for (const c of candidates) { c.outcome = simulate(start, tick0, obstacles, c.targets, c.delay, c.hold, horizonEnd, forced, 0, table); c.value = score(c.outcome); }
    candidates.sort((a, b) => b.value - a.value);
    if (robustTicks > 0) {
      const top = candidates.slice(0, keep).filter((c) => c.outcome.alive);
      for (const c of top) {
        for (const timing of [robustTicks, -robustTicks]) {
          const other = simulate(start, tick0, obstacles, c.targets, c.delay, c.hold, horizonEnd, forced, timing, table);
          c.outcome = { alive: c.outcome.alive && other.alive, survived: Math.min(c.outcome.survived, other.survived), minClear: Math.min(c.outcome.minClear, other.minClear), coins: c.outcome.coins, presses: c.outcome.presses, skims: c.outcome.skims };
        }
        c.value = score(c.outcome);
      }
      candidates.sort((a, b) => b.value - a.value);
    }
    return candidates;
  }

  function buildPlan(start, tick0) {
    const obstacles = [];
    for (const index of [...known.keys()].sort((a, b) => a - b)) {
      const local = model.geometry(index, tick0);
      const x = model.xAt(index, tick0);
      if (x + local.width < physics.chikunX - 40) { known.delete(index); continue; }
      obstacles.push({ index, family: local.family, width: local.width, base: model.base(index), local: model.isStatic(index) ? local : null });
    }
    const hold = currentTarget;
    if (obstacles.length === 0) return { targets: [holdAltitude()], delay: 0, hold, obstacles };
    const last = obstacles[obstacles.length - 1];
    let horizonEnd = tick0;
    while (horizonEnd < tick0 + MAX_HORIZON && model.xAt(last.index, horizonEnd) + last.width >= physics.chikunX - 40) horizonEnd += 1;
    horizonEnd = Math.min(tick0 + MAX_HORIZON, horizonEnd + TAIL_TICKS);
    const lo = tick0 - robustTicks - 1;
    const dist = new Float64Array(horizonEnd + robustTicks + 2 - lo);
    for (let i = 0; i < dist.length; i += 1) dist[i] = model.distance(lo + i);
    const table = { dist, lo };
    const forced = pending !== null && pending >= tick0 ? pending : null;
    // Level 1: the first obstacle's target and when to start acting.
    const first = [];
    for (const target of TARGETS) for (const delay of START_DELAYS) {
      if (delay > 0 && target === hold) continue;
      first.push({ targets: [target], delay, hold });
    }
    let beam = evaluate(first, start, tick0, obstacles, horizonEnd, forced, 12, table);
    // Later levels: one more target per known obstacle, from the best three.
    for (let level = 1; level < obstacles.length && level < 3; level += 1) {
      const next = [];
      for (const node of beam.slice(0, 3)) for (const target of TARGETS) next.push({ targets: [...node.targets, target], delay: node.delay, hold });
      beam = evaluate(next, start, tick0, obstacles, horizonEnd, forced, 8, table);
    }
    const best = beam[0];
    return { targets: best.targets, delay: best.delay, hold, obstacles };
  }

  // With nothing in sight, cruise at the height from which a climb over the
  // tallest passage and a descent under a low passage take about equally long.
  function holdAltitude() {
    return cruise;
  }

  function predict(snapshot, lead, pressNow) {
    const c = snapshot.chikun;
    const state = { y: c.y, v: c.velocityY, loco: c.locomotion };
    let since = snapshot.tick - lastPress;
    for (let tick = snapshot.tick; tick < snapshot.tick + lead; tick += 1) {
      const press = (tick === snapshot.tick && pressNow) || pending === tick;
      if (press) since = 0; else since += 1;
      let overGap = false;
      for (const index of known.keys()) {
        const local = model.geometry(index, tick + 1);
        if (local.family !== 'gap') continue;
        const x = model.xAt(index, tick + 1);
        if (physics.chikunX > x && physics.chikunX < x + local.width) { overGap = true; break; }
      }
      stepPhysics(state, press, overGap, physics);
    }
    state.since = since;
    return state;
  }

  function decide(snapshot) {
    const tick = snapshot.tick;
    history.push(snapshot);
    if (history.length > perceptionLag + 1) history.shift();
    perceive(history[0]);
    // Execute a press that is due now.
    const press = pending !== null && pending <= tick;
    if (press) { pending = null; lastPress = tick; executed.push(tick); }
    const target = tick + pressLead;
    const state = predict(snapshot, pressLead, press);
    if (plan === null || knownVersion !== plannedVersion || target - planTick >= 10) {
      plan = buildPlan(state, target);
      planTick = target;
      plannedVersion = knownVersion;
      model.forget(Math.min(...known.keys(), maxKnownIndex + 1) - 1);
    }
    let segmentTarget = plan.targets[0];
    if (target - planTick < plan.delay) segmentTarget = plan.hold;
    else if (plan.obstacles.length > 1) {
      let i = 0;
      while (i < plan.obstacles.length - 1 && model.xAt(plan.obstacles[i].index, target) + plan.obstacles[i].width < physics.chikunX - 40) i += 1;
      segmentTarget = plan.targets[Math.min(i, plan.targets.length - 1)];
    }
    currentTarget = segmentTarget;
    if (pending === null && wantsPress(state, segmentTarget, state.since, physics)) {
      const offset = Math.round(normal(random) * profile.jitterSigmaTicks);
      pending = Math.max(tick + 1, target + offset, lastPress + CHIKUN_BOT_MIN_PRESS_GAP_TICKS);
    }
    return press;
  }

  return Object.freeze({ decide, get presses() { return executed.length; }, get markersSeen() { return markersSeen; }, cruiseY: cruise, profile, pressLead, perceptionLag });
}
