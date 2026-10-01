// Smoke: this checkout's child, headless, on its default world under a Ranked
// session, standing still until it dies. Run it under the 2.1.0 label to see
// the ten-area Level 1 record a schema-8 summary:
//   HMH_HARNESS_RELEASE=2.1.0 node scripts/hmh-ranked-v8/smoke.mjs [maxFrames]
// Prints one JSON line: the world, the summary's schema, the schema answer,
// the map context the server resolves and its verdict.
import { runChild } from '../hmh-honest-corpus/child-driver.mjs';
import { HARNESS_BUILD_HASH, SEASON_ID } from '../hmh-honest-corpus/identity.mjs';
import { validateRunSummaryPayload } from '../../sdk/hmh-run-summary-schema-v8.mjs';
import { resolveHmhMapContext } from '../../server/verify/hmh-map-context.mjs';

const pad = (tick) => ({ id: 'headless-virtual-pad', index: 0, connected: true, mapping: 'standard', timestamp: tick, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) });
const pilot = { frame: (_spies, tick) => pad(tick), chooseUpgrade: (offer) => offer.pendingChoices[0].id };
const result = await runChild({ seed: 12_345, buildHash: HARNESS_BUILD_HASH, seasonId: SEASON_ID, pilot, maxFrames: Number(process.argv[2] ?? 30_000) });
const summary = result.outbox.find((entry) => entry.message.type === 'game:run-summary')?.message.payload ?? null;
const context = summary ? resolveHmhMapContext({ identity: { gameId: 'lester-blaster', buildHash: HARNESS_BUILD_HASH }, schemaVersion: summary.schemaVersion }) : null;
process.stdout.write(`${JSON.stringify({
  buildHash: HARNESS_BUILD_HASH,
  world: result.spies.tenAreaCombat ? 'ten-area-frontier' : 'forked-frontier',
  tick: result.tick,
  state: result.state,
  childErrors: result.errors.length,
  gameErrors: result.outbox.filter((entry) => entry.message.type === 'game:error').map((entry) => entry.message.payload),
  invalidMessages: result.outbox.filter((entry) => !entry.valid).length,
  schemaVersion: summary?.schemaVersion ?? null,
  schemaError: summary ? validateRunSummaryPayload(summary) || null : null,
  visitedDistrictMask: summary?.exploration.visitedDistrictMask ?? null,
  movement: summary?.movement ?? null,
  context: context ? { mapId: context.mapId, mapVersion: context.mapVersion, schemaVersion: context.schemaVersion } : null,
  verdict: context ? context.validatePlausibility(summary).verdict : null,
})}\n`);
process.exit(0);
