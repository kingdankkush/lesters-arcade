// Boots the real HMH child headless in the unofficial ten-area Free world
// (?mode=free&world=ten-area) and drives one scenario of slice
// HMH-TEN-AREA-GAMEPLAY-WIRING through the actual fixed-step tick:
//
//   node scripts/hmh-ten-area-wiring-probe.mjs cover            evidence spawn beside a tall face, push into it
//   node scripts/hmh-ten-area-wiring-probe.mjs court:<bossId>   evidence spawn beside a court threshold, walk in, fight
//   node scripts/hmh-ten-area-wiring-probe.mjs field            the Free entry, no evidence: walk to the nearest
//                                                               tall face and hold cover while the Meadows spawns
//
// Prints one JSON line. Read-only spies (the honest-corpus pattern) observe
// the child's own state; nothing here writes simulation state.
import { registerHooks } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import { runChild } from './hmh-honest-corpus/child-driver.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, '..', 'apps', 'hmh-reboot', 'src');
const combatUrl = pathToFileURL(path.join(SRC, 'world-v2-combat.mjs')).href;
const dropsUrl = pathToFileURL(path.join(SRC, 'boss-drops.mjs')).href;
const probe = { runs: [], coverDamage: [], drops: null };
globalThis.__tenAreaProbe = probe;
const spyModule = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
registerHooks({
  resolve(specifier, context, nextResolve) {
    const parent = context.parentURL ?? '';
    if (specifier === './world-v2-combat.mjs' && /world-v2-runtime-context\.mjs$/.test(parent)) {
      return { url: spyModule(`import * as real from ${JSON.stringify(combatUrl)};
export * from ${JSON.stringify(combatUrl)};
export function createWorldV2Combat(options) {
  const combat = real.createWorldV2Combat(options);
  const probe = globalThis.__tenAreaProbe;
  probe.combat = combat;
  return Object.freeze({ ...combat, createRun() {
    const run = combat.createRun();
    probe.runs.push(run);
    const coverDamage = run.coverDamage;
    run.coverDamage = (origin, damage) => { const applied = coverDamage(origin, damage); probe.coverDamage.push({ damage, applied, inCover: run.cover.phase === 'cover' }); return applied; };
    return run;
  } });
}`), shortCircuit: true, format: 'module' };
    }
    if (specifier === './boss-drops.mjs' && /\/main\.mjs$/.test(parent)) {
      return { url: spyModule(`import * as real from ${JSON.stringify(dropsUrl)};
export * from ${JSON.stringify(dropsUrl)};
export function createBossDrops(...args) { const state = real.createBossDrops(...args); globalThis.__tenAreaProbe.drops = state; return state; }`), shortCircuit: true, format: 'module' };
    }
    return nextResolve(specifier, context);
  },
});

const scenario = process.argv[2] ?? 'cover';
const evidence = scenario !== 'field';
const search = `?mode=free&world=ten-area${evidence ? `&evidenceSafe=1&tenAreaEvidence=${encodeURIComponent(scenario)}` : ''}`;
const maxFrames = Number(process.argv[3] ?? (scenario.startsWith('court:') ? 30_000 : 4_000));
const bossId = scenario.startsWith('court:') ? scenario.slice(6) : null;

const log = { scenario, ticks: [], cover: { maxTicks: 0, enters: 0, poses: new Set() }, boss: { firstLiveTick: null, healthSeen: [], phases: new Set(), defeatedTick: null, lockedAtTick: null, opened: false } };
let walkTarget = null;
let escape = null;
const ledge = { climbId: null, mantles: 0, drops: 0, landTicks: 0, mantleTicks: 0 };
const ORBIT = Number(process.env.HMH_PROBE_ORBIT ?? 300);
function pad(tick, axes = [0, 0, 0, 0]) {
  return { id: 'headless-virtual-pad', index: 0, connected: true, mapping: 'standard', timestamp: tick, axes, buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
}
const pilot = {
  frame(spies, tick) {
    const run = probe.runs.at(-1);
    const me = spies.motion;
    if (!run || !me) return pad(tick);
    if (run.cover.phase === 'cover') { log.cover.maxTicks = Math.max(log.cover.maxTicks, run.cover.coverTicks); log.cover.poses.add(run.cover.pose); }
    log.cover.enters = run.cover.enters;
    const slots = spies.bossSlots;
    if (bossId && slots) {
      const slot = slots.slots[bossId];
      if (slot.status === 'live' && log.boss.firstLiveTick === null) log.boss.firstLiveTick = tick;
      if (slot.locked && log.boss.lockedAtTick === null) log.boss.lockedAtTick = tick;
      if (slot.boss) { log.boss.phases.add(slot.boss.phaseId); if (tick % 600 === 0 && slot.status === 'live') log.boss.healthSeen.push(Math.round(slot.boss.health)); }
      if (slot.status === 'defeated' && log.boss.defeatedTick === null) { log.boss.defeatedTick = tick; log.boss.opened = slot.closedWalls.length === 0; }
    }
    if (scenario === 'cover' || scenario === 'field') {
      const face = walkTarget ?? (walkTarget = nearestTallFace(probe.combat.coverFaces, me));
      // Walk to 40 out from the face's middle, then push into it; release after 900 ticks in cover to step out.
      const stand = { x: face.mid.x + face.normal.x * 40, y: face.mid.y + face.normal.y * 40 };
      const dx = stand.x - me.x, dy = stand.y - me.y, d = Math.hypot(dx, dy);
      if (process.env.HMH_PROBE_DEBUG && tick % 300 === 0) process.stderr.write(`DBG ${tick} me ${Math.round(me.x)},${Math.round(me.y)} stand ${Math.round(stand.x)},${Math.round(stand.y)} face ${face.id}
`);
      if (run.cover.phase !== 'cover' && d > 40 && run.cover.enters === 0) return pad(tick, [dx / d, dy / d, 0, 0]);
      if (run.cover.enters >= 1 && run.cover.coverTicks > 900 && scenario === 'cover') return pad(tick, [face.normal.x, face.normal.y, 0, 0]);
      return pad(tick, [-face.normal.x, -face.normal.y, 0, 0]);
    }
    if (scenario === 'ledge') {
      // Push across the climb, then walk to the drop strip of the same area and over it.
      const markers = probe.combat.traversalMarkers;
      const climb = markers.find((marker) => marker.id === ledge.climbId) ?? markers.find((marker) => marker.kind === 'climb' && Math.hypot((marker.zone.minX + marker.zone.maxX) / 2 - me.x, (marker.zone.minY + marker.zone.maxY) / 2 - me.y) < 80);
      if (!climb) return pad(tick);
      ledge.climbId = climb.id;
      ledge.mantles = run.traversal.mantles; ledge.drops = run.traversal.drops; ledge.landTicks = run.traversal.landTicks; ledge.mantleTicks = run.traversal.mantleTicks;
      if (run.traversal.mantles === 0) return pad(tick, [climb.direction.x, climb.direction.y, 0, 0]);
      const drop = markers.find((marker) => marker.kind === 'drop' && marker.areaId === climb.areaId);
      if (!drop || run.traversal.drops > 0) return pad(tick);
      const target = { x: (drop.zone.minX + drop.zone.maxX) / 2 - drop.direction.x * 60, y: (drop.zone.minY + drop.zone.maxY) / 2 - drop.direction.y * 60 };
      const dx = target.x - me.x, dy = target.y - me.y, d = Math.hypot(dx, dy);
      if (process.env.HMH_PROBE_DEBUG && tick % 120 === 0) process.stderr.write(`DBG ${tick} me ${Math.round(me.x)},${Math.round(me.y)} z ${run.traversal.phase} target ${Math.round(target.x)},${Math.round(target.y)} ${JSON.stringify(drop.zone)} ${JSON.stringify(drop.direction)}
`);
      if (d < 12) ledge.approached = true;
      return !ledge.approached ? pad(tick, [dx / d, dy / d, 0, 0]) : pad(tick, [drop.direction.x, drop.direction.y, 0, 0]);
    }
    if (bossId) {
      const court = probe.combat && spies.bossSlots?.definitions[bossId]?.arenas.threshold;
      if (!court) return pad(tick);
      const live = spies.bossSlots.slots[bossId].status !== 'dormant';
      // Into the threshold disk, then orbit the court's middle (spot-targeted
      // tells land behind a moving hero) while auto-fire works.
      if (!live) {
        const dx = court.threshold.x - me.x, dy = court.threshold.y - me.y, d = Math.hypot(dx, dy);
        return d > 16 ? pad(tick, [dx / d, dy / d, 0, 0]) : pad(tick);
      }
      // An orbit that slides into court cover steps straight back out.
      if (run.cover.phase === 'cover' && !process.env.HMH_PROBE_HOLD_COVER) escape = { until: tick + 45, x: run.cover.normal.x, y: run.cover.normal.y };
      if (escape && tick < escape.until) return pad(tick, [escape.x, escape.y, 0, 0]);
      const rx = me.x - court.centre.x, ry = me.y - court.centre.y, r = Math.hypot(rx, ry) || 1;
      const radial = (r - ORBIT) / 160;
      const mx = -ry / r - (rx / r) * radial, my = rx / r - (ry / r) * radial, m = Math.hypot(mx, my) || 1;
      return pad(tick, [mx / m, my / m, 0, 0]);
    }
    return pad(tick);
  },
  chooseUpgrade: () => null,
};
function nearestTallFace(faces, me) {
  let best = null;
  for (const face of faces) {
    if (face.kind !== 'tall' || face.length < 96 || Math.abs(face.normal.x) + Math.abs(face.normal.y) !== 1) continue;
    const mid = { x: face.a.x + face.tangent.x * face.length / 2, y: face.a.y + face.tangent.y * face.length / 2 };
    const distance = Math.hypot(mid.x - me.x, mid.y - me.y);
    // Approach from the face's own side, so the walk never meets the back wall.
    if ((me.x - mid.x) * face.normal.x + (me.y - mid.y) * face.normal.y < 40) continue;
    if (!best || distance < best.distance) best = { ...face, mid, distance };
  }
  return best;
}

const result = await runChild({ seed: 20_260_930, buildHash: 'site-2.0.0:game-2.0.0:cabinet-0.6.0', seasonId: 'hmh-season-1-2026', pilot, maxFrames, search, mode: 'free' });
const run = probe.runs.at(-1);
const summary = {
  scenario,
  worldId: result.spies?.simulation ? 'ten-area' : null,
  frames: result.frames,
  finalTick: result.tick,
  state: result.state,
  errors: result.errors.slice(0, 3).map((error) => `${error.where}: ${String(error.message).split('\n')[0]}`),
  runSummaries: result.outbox.filter((entry) => entry.message.type === 'game:run-summary').length,
  traversalMarkers: probe.combat?.traversalMarkers.length ?? null,
  cover: { enters: run?.cover.enters ?? 0, coverTicks: run?.cover.coverTicks ?? 0, poses: [...log.cover.poses].sort(), phase: run?.cover.phase ?? null },
  coverDamage: { calls: probe.coverDamage.length, reduced: probe.coverDamage.filter((row) => row.applied < row.damage).length, inCover: probe.coverDamage.filter((row) => row.inCover).length, sample: probe.coverDamage.filter((row) => row.applied < row.damage).slice(0, 3) },
  traversal: scenario === 'ledge' ? { climbId: ledge.climbId, mantles: ledge.mantles, drops: ledge.drops, mantleTicks: ledge.mantleTicks, landTicks: ledge.landTicks } : null,
  boss: bossId ? { ...log.boss, phases: [...log.boss.phases], seals: probe.drops?.seals.map((seal) => ({ bossId: seal.bossId, x: seal.x, y: seal.y, arenaId: seal.arenaId })) ?? [] } : null,
  health: result.spies?.health ?? null,
};
process.stdout.write(`${JSON.stringify(summary)}\n`);
process.exit(0);
