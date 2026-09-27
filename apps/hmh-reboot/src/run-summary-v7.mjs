// Run summary schema 7 for the child (contract §4, §11 and §15 item 6). The v7
// catalogues and validator live in sdk/hmh-run-summary-schema-v7.mjs, which
// stays off the HMH initial path: this module is loaded by the awaited
// lazy-module import before any session starts (main.mjs
// loadLazyRuntimeModules), so the accumulator is created with the V7
// catalogues and the bridge validates the outgoing summary with the v7
// validator. The v7 rows come from the simulation that owns them.
import { HMH_RUN_SUMMARY_CATALOGS_V7, validateRunSummaryPayload } from '../../../sdk/hmh-run-summary-schema-v7.mjs';
import { missionObjectiveRows } from './mission-objectives.mjs';
import { bossRunRows } from './boss-slots.mjs';
import { runEvolutionRows } from './boss-drops.mjs';
import { prisonerRows } from './prisoners.mjs';
import { runProgressionRow, runUpgradeRows } from './run-progression.mjs';

export const RUN_SUMMARY_SCHEMA_VERSION = 7;
export { HMH_RUN_SUMMARY_CATALOGS_V7, validateRunSummaryPayload as validateRunSummaryV7 };

// The v7 rows finalizeRunSummary shapes into the payload.
export function runSummaryV7Rows({ mission, bossSlots, progression }) {
  return {
    objectives: missionObjectiveRows(mission),
    prisoners: prisonerRows(mission),
    bosses: bossRunRows(bossSlots),
    evolutions: runEvolutionRows(progression),
    upgrades: runUpgradeRows(progression, HMH_RUN_SUMMARY_CATALOGS_V7.upgrades),
    progression: runProgressionRow(progression, { revivesUsed: bossSlots.revivesUsed }),
  };
}
