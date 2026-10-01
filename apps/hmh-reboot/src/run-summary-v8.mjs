// Run summary schema 8 for the child: the official ten-area Level 1 of game
// 2.1.0 and later (docs/2.0/slices/HMH-RANKED-V8-TEN-AREA.md). Lazy: only the
// ten-area runtime context (world-v2-runtime-context.mjs) imports it.
//
// It hands main.mjs the same API as run-summary-v7.mjs (the names keep the
// v7 spelling main.mjs and its pinned tests read), so the official ten-area
// world records through the one accumulator path: the accumulator takes the
// V8 catalogues, the bridge validates the outgoing summary with the schema
// 1-8 validator, and the rows come from the simulation that owns them.
import { HMH_RUN_SUMMARY_CATALOGS_V8, validateRunSummaryPayload } from '../../../sdk/hmh-run-summary-schema-v8.mjs';
import { bossRunRows } from './boss-slots.mjs';
import { runEvolutionRows } from './boss-drops.mjs';
import { runProgressionRow, runUpgradeRows } from './run-progression.mjs';

export const RUN_SUMMARY_SCHEMA_VERSION = 8;
const C8 = HMH_RUN_SUMMARY_CATALOGS_V8;

// The ten-area mission's objective rows, in V8 catalogue order.
export function tenAreaObjectiveRows(mission) {
  return Object.freeze(C8.objectives.map((objectiveId) => {
    const done = mission.completed.has(objectiveId);
    return Object.freeze({
      objectiveId,
      completed: done ? 1 : 0,
      tick: done ? mission.completed.get(objectiveId) : 0,
      levelAtCompletion: done ? (mission.levels.get(objectiveId) ?? 0) : 0,
    });
  }));
}

// `movementRun()` is the session's cover + traversal run (world-v2-combat.mjs
// createWorldV2MovementRun); its counters fill the movement row.
export function createRunSummaryV8({ movementRun }) {
  if (typeof movementRun !== 'function') throw new TypeError('the schema-8 run summary needs the session movement run');
  const rows = ({ mission, bossSlots, progression }) => {
    const run = movementRun();
    if (!run) throw new Error('the schema-8 run summary has no movement run');
    return {
      objectives: tenAreaObjectiveRows(mission),
      prisoners: [],
      bosses: bossRunRows(bossSlots),
      evolutions: runEvolutionRows(progression),
      upgrades: runUpgradeRows(progression, C8.upgrades),
      progression: runProgressionRow(progression, { revivesUsed: bossSlots.revivesUsed }),
      movement: run.movementRow(),
    };
  };
  return Object.freeze({
    RUN_SUMMARY_SCHEMA_VERSION,
    HMH_RUN_SUMMARY_CATALOGS_V7: C8,
    validateRunSummaryV7: validateRunSummaryPayload,
    runSummaryV7Rows: rows,
  });
}
