// 2.1 HMH-FEEL parity probe: one real headless Ranked run of this checkout's
// child with the feel settings given on the command line, printed as JSON:
// every bridge message the child sent (run events, state, score result,
// game over and the run summary, i.e. the evidence), a per-tick digest of the
// simulation stream the pilot sees (hero position and health, every live
// enemy's id, position and health), and the feel telemetry. Two runs that
// differ only in presentation settings must print identical `evidence` and
// `stream` fields. Run in its own process (the harness installs globals).
//   node scripts/hmh-honest-corpus/feel-parity.mjs '{"hitstop":true,"tickCap":2400}'
import { runChild } from './child-driver.mjs';
import { createPilot } from './pilot.mjs';
import { HARNESS_BUILD_HASH, SEASON_ID } from './identity.mjs';
import { selectLevelEntry } from '../../apps/hmh-reboot/src/level-entry.mjs';

const spec = JSON.parse(process.argv[2] ?? '{}');
const seed = spec.seed ?? 424_242;
const tickCap = spec.tickCap ?? 2400;
const entry = selectLevelEntry(seed);
const pilot = createPilot({ style: spec.style ?? 'brawler', seed, tickCap, entry });

// FNV-1a over the tick's simulation snapshot, chained tick to tick.
let digest = 0x811c9dc5;
const mixText = (text) => {
  for (let i = 0; i < text.length; i += 1) digest = Math.imul(digest ^ text.charCodeAt(i), 16777619) >>> 0;
};
const ticks = [];
let maxLiveEnemies = 0;
const observe = (spies, tick) => {
  const me = spies.motion;
  const enemies = (spies.population?.active ?? []).filter((enemy) => enemy.active && enemy.health > 0);
  maxLiveEnemies = Math.max(maxLiveEnemies, enemies.length);
  let row = `${tick}|${me?.x}|${me?.y}|${spies.health}`;
  for (const enemy of enemies) row += `|${enemy.id}:${enemy.x}:${enemy.y}:${enemy.health}`;
  mixText(row);
  if (tick % 300 === 0) ticks.push([tick, digest]);
};
const wrapped = {
  ...pilot,
  frame(spies, tick) {
    observe(spies, tick);
    return pilot.frame(spies, tick);
  },
};

const started = Date.now();
const result = await runChild({
  seed,
  buildHash: HARNESS_BUILD_HASH,
  seasonId: SEASON_ID,
  pilot: wrapped,
  maxFrames: tickCap + (spec.surrenderFrames ?? 20_000),
  settingsOverride: {
    reduceMotion: false,
    reduceFlash: false,
    screenShake: spec.screenShake ?? true,
    hitstop: spec.hitstop !== false,
    ...(spec.damageNumbers === undefined ? {} : { damageNumbers: spec.damageNumbers }),
  },
});
const dataset = globalThis.document?.querySelector?.('#hmhRebootStage')?.dataset ?? {};
const evidence = result.outbox.map((entry) => ({ tick: entry.tick, valid: entry.valid, message: entry.message }));
process.stdout.write(`${JSON.stringify({
  spec: { seed, tickCap, hitstop: spec.hitstop !== false, damageNumbers: spec.damageNumbers ?? null },
  finalTick: result.tick,
  finalState: result.state,
  errors: result.errors.map((error) => `${error.where}: ${String(error.message).slice(0, 400)}`),
  evidence,
  stream: { digest, ticks, maxLiveEnemies },
  feel: {
    hitstopStarted: Number(dataset.hitstopStarted ?? 0),
    hitstopHeldFrames: Number(dataset.hitstopHeldFrames ?? 0),
    hitstopIgnored: Number(dataset.hitstopIgnored ?? 0),
    hitstopMaxPerSecond: Number(dataset.hitstopMaxPerSecond ?? 0),
    damageNumbersSpawned: Number(dataset.damageNumbersSpawned ?? 0),
    damageNumbersPeak: Number(dataset.damageNumbersPeak ?? 0),
    settingHitstop: dataset.settingHitstop ?? null,
  },
  wallMs: Date.now() - started,
})}\n`);
process.exit(0);
