// The ten-area real-child corpus (run summary schema 8) and the full §5.1
// Ranked body for one of its runs: the plan row's seed ticket and identity
// (scripts/hmh-honest-corpus/plan-ten-area.mjs, public fixture secret), and a
// session envelope bound to that identity. Shared by the v8 verifier tests.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RANKED_GAMES, RANKED_SETTLE_VERSION } from '../../../apps/portal/src/ranked-identity.mjs';
import { createSessionEvidenceState, finalizeSessionEvidence, recordSessionInput } from '../../../apps/portal/src/session-integrity.mjs';
import { TEN_AREA_PLAN, tenAreaIdentityFor } from '../../../scripts/hmh-honest-corpus/plan-ten-area.mjs';
import { FIXTURE_CHAIN_ID, FIXTURE_ISSUED_AT, FIXTURE_REGISTRY, FIXTURE_SEED_SECRET, FIXTURE_WALLET } from './build-fixtures.mjs';

export const V8_CORPUS_FILE = new URL('../hmh-honest-corpus/real-child-2.1.0-ten-area.json', import.meta.url);
export const readV8Corpus = () => JSON.parse(readFileSync(V8_CORPUS_FILE, 'utf8'));

// → { body, options } for verifyRankedRun(body, options); `summary` replaces
// the run's own summary (a forged variant) under the same identity.
export async function rankedBodyFor(run, summary = run.runSummary, { buildHash = run.runSummary.identity.buildHash } = {}) {
  const plan = TEN_AREA_PLAN.find((entry) => entry.label === run.label);
  const id = await tenAreaIdentityFor(plan, { buildHash });
  assert.equal(id.seed, run.runSummary.identity.seed, run.label);
  const evidence = createSessionEvidenceState({ sessionId: id.identity.sessionId });
  recordSessionInput(evidence, { step: 1, moveX: 0, aimX: 0, shoot: false });
  const sessionEnvelope = JSON.parse(JSON.stringify(await finalizeSessionEvidence({
    identity: id.identity, evidence,
    finalState: { score: summary.totals.score, kills: summary.kills.total, level: summary.totals.level, elapsedMs: summary.totals.elapsedMs },
  })));
  return {
    body: {
      v: RANKED_SETTLE_VERSION, gameId: 'lester-blaster', sessionId32: id.sessionId32, identity: id.identity, seedTicket: id.seedTicket, entryTxHash: null,
      evidence: { encoding: RANKED_GAMES['lester-blaster'].evidenceEncoding, runSummary: summary, sessionEnvelope },
      claim: { score: summary.totals.score },
    },
    options: { chainId: FIXTURE_CHAIN_ID, scoreRegistryAddress: FIXTURE_REGISTRY, wallet: FIXTURE_WALLET, nowMs: FIXTURE_ISSUED_AT * 1000 + Math.ceil(summary.totals.elapsedMs) + 120_000, seedSecret: FIXTURE_SEED_SECRET },
  };
}
