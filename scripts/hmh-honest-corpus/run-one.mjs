// One real headless run of this checkout's child, written as JSON: the run summary,
// every other bridge message, the run events, the upgrade log, the pilot statistics
// and any error the child threw. Spawned by batch.mjs, one process per run.
//   node run-one.mjs '{"seed":1,"style":"explorer","tickCap":60000,"buildHash":"...","seasonId":"...","out":"x.json"}'
import { writeFileSync } from 'node:fs';
import { runChild } from './child-driver.mjs';
import { createPilot } from './pilot.mjs';
import { selectLevelEntry } from '../../apps/hmh-reboot/src/level-entry.mjs';

const spec = JSON.parse(process.argv[2]);
const entry = selectLevelEntry(spec.seed);
const pilot = createPilot({ style: spec.style, seed: spec.seed, tickCap: spec.tickCap, entry });
const started = Date.now();
const hardFrames = spec.tickCap + (spec.surrenderFrames ?? 30_000);
let result;
let crash = null;
try {
  result = await runChild({ seed: spec.seed, buildHash: spec.buildHash, seasonId: spec.seasonId, heroId: spec.heroId ?? 'lit-commando', pilot, maxFrames: hardFrames, trace: spec.trace ? (spec.traceRows = []) : null, log: (line) => process.stderr.write(`[${spec.label}] ${line}\n`) });
} catch (error) {
  crash = error?.stack ?? String(error);
}
const summaryEntry = result?.outbox.find((entry) => entry.message.type === 'game:run-summary') ?? null;
const out = {
  label: spec.label,
  spec,
  entry,
  wallMs: Date.now() - started,
  crash,
  frames: result?.frames ?? null,
  finalTick: result?.tick ?? null,
  finalState: result?.state ?? null,
  errors: result?.errors ?? [],
  invalidChildMessages: (result?.outbox ?? []).filter((entry) => !entry.valid).map((entry) => ({ type: entry.message.type, error: entry.error })),
  childMessageCounts: Object.fromEntries(Object.entries((result?.outbox ?? []).reduce((acc, entry) => { acc[entry.message.type] = (acc[entry.message.type] ?? 0) + 1; return acc; }, {}))),
  runEvents: (result?.outbox ?? []).filter((entry) => entry.message.type === 'game:run-event').map((entry) => entry.message.payload),
  scoreResult: result?.outbox.find((entry) => entry.message.type === 'game:score-result')?.message.payload ?? null,
  gameOver: result?.outbox.find((entry) => entry.message.type === 'game:game-over')?.message.payload ?? null,
  runSummary: summaryEntry?.message.payload ?? null,
  upgradeLog: result?.upgradeLog ?? [],
  pilotStats: pilot.stats,
  finalHealth: result?.spies?.health ?? null,
  trace: spec.traceRows ?? null,
};
writeFileSync(spec.out, JSON.stringify(out));
process.stdout.write(`${spec.label} done tick=${out.finalTick} state=${out.finalState} summary=${Boolean(out.runSummary)} errors=${out.errors.length} crash=${Boolean(crash)} wall=${out.wallMs}ms\n`);
process.exit(0);
