// Known-evasion pilots for the Chikun plausibility calibration (design §B.4
// set (b), §C.8; jackpot-server slice).
//
// These are the committed versions of the 2026-09-24 probes. They exist so the
// calibration receipt can say, with numbers, what the screen CANNOT catch:
//   - humanisedSolver: the scripted routePilot reading the WHOLE runtime
//     snapshot (it sees every obstacle the runtime holds, far past any screen),
//     with naive humanisation: seeded Gaussian timing jitter and at least a
//     6-tick gap between presses (the human-model limit), so H4-H6 do not fire.
//   - widenedViewPilot: the same humanised routePilot, but limited to a view
//     `widen` times the stock 1,280-px landscape width, as a player with a
//     CSS-widened frame saw it before the rev. 2 view cap (design §B.4). Its
//     early descents are what S8 (unexplainedDescents) measures.
// Nothing here touches Math.random: every run is a pure function of its seed.
// They run on the pure runtime only, never against a server.

import { createChikunRuntime } from '../../apps/portal/src/chikun-cabinet.mjs';
import { routePilot } from '../chikun-course-pilot.mjs';
import { mulberry32, profileHash } from './chikun-bots.mjs';

export const EVASION_PILOT_VERSION = 'chikun-evasion-pilots-v1';
export const HUMAN_MIN_PRESS_GAP_TICKS = 6;
export const STOCK_VIEW_EDGE = 1280;
export const EVASION_PILOTS = Object.freeze({
  humanisedSolver: Object.freeze({ view: 'full', sigma: 2.5, delay: 0 }),
  widenedViewPilot: Object.freeze({ view: 'widened', widen: 2.5, sigma: 2.5, delay: 8 }),
});

function normal(random) {
  let sum = 0;
  for (let i = 0; i < 12; i += 1) sum += random();
  return sum - 6;
}

// Wraps a pilot (snapshot → flap?) with seeded timing jitter and a minimum gap
// between presses: an intended press at tick t lands at t + round(N(0, sigma))
// (never earlier than intended), and never within `minGap` ticks of the last.
export function humanise(pilot, { seed = 1, sigma = 2.5, minGap = HUMAN_MIN_PRESS_GAP_TICKS, label = 'humanise' } = {}) {
  const random = mulberry32((seed >>> 0) ^ profileHash(label));
  let pending = null;
  let last = -1_000;
  return (snapshot) => {
    const tick = snapshot.tick;
    if (pending === null && pilot(snapshot)) pending = tick + Math.max(0, Math.round(Math.abs(normal(random)) * sigma));
    if (pending !== null && tick >= pending && tick - last >= minGap) {
      pending = null;
      last = tick;
      return true;
    }
    return false;
  };
}

// What a player with a frame `widen` × the stock width sees: obstacles from
// the snapshot `delay` ticks old whose x is inside the widened view.
export function widenedView(pilot, { widen = 2.5, delay = 8 } = {}) {
  const edge = STOCK_VIEW_EDGE * widen;
  const history = [];
  return (snapshot) => {
    history.push(snapshot);
    if (history.length > delay + 1) history.shift();
    const seen = history[0];
    return pilot({ ...snapshot, forks: seen.forks.filter((fork) => fork.x < edge) });
  };
}

export function evasionPilotFor(name, { seed = 1 } = {}) {
  const spec = EVASION_PILOTS[name];
  if (!spec) throw new Error(`Unknown evasion pilot: ${name}`);
  const base = spec.view === 'widened' ? widenedView(routePilot, { widen: spec.widen, delay: spec.delay }) : routePilot;
  return humanise(base, { seed, sigma: spec.sigma, label: name });
}

// One seeded run of an evasion pilot on the pure runtime. → the runtime result
// (with its v6 evidence), or the result of the capped run.
export function playEvasionRun({ name, seed, maxTicks = 216_000 }) {
  const pilot = evasionPilotFor(name, { seed });
  const runtime = createChikunRuntime({ seed, maxTicks });
  while (!runtime.terminal) runtime.step({ flap: pilot(runtime.snapshot()) });
  return runtime.result();
}
