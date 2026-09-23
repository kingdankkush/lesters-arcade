// Chikun's Escape Ranked verifier (contract §5.3). Server only.
//
// The server replays the v6 flap evidence with the cabinet's own runtime and
// reads the result (A9); the client's claim is never consulted. Importing this
// module loads chikun-cabinet.mjs, which pulls in the obstacle JSON (import
// attribute) and the vendored ethers used by game-manifest.mjs.
import {
  CHIKUN_EVIDENCE_VERSION,
  CHIKUN_FIXED_STEP_HZ,
  CHIKUN_MAX_FLAP_TRANSITIONS,
  decodeFlapDeltas,
  replayChikunRun,
} from '../../apps/portal/src/chikun-cabinet.mjs';
import { canonicalSessionJson, sha256Hex } from '../../apps/portal/src/session-integrity.mjs';
import { buildVerifiedRun, invalid, isPlainObject, rejected } from './verified-run.mjs';

export const CHIKUN_GAME_ID = 'chikun';
export const CHIKUN_EVIDENCE_ENCODING = 'chikun-flap-evidence-v6+json';
// §5.1: maxTicks <= 216,000 (60 minutes at 60 Hz).
export const CHIKUN_RANKED_MAX_TICKS = 216_000;
const FLAP_KEYS = Object.freeze(['fixedStepHz', 'flapDeltas', 'maxTicks', 'seed', 'version']);

function exactKeys(value, keys) {
  if (!isPlainObject(value)) return false;
  const actual = Object.keys(value).sort();
  return actual.length === keys.length && actual.every((key, index) => key === keys[index]);
}

// → Promise<VerifiedRun | { ok:false, status, error, detail? }>
// `identity` is the canonical identity (with version and sessionKey).
export async function verifyChikunRun({ identity, evidence, nowMs }) {
  if (!exactKeys(evidence, ['encoding', 'flap']) || evidence.encoding !== CHIKUN_EVIDENCE_ENCODING || !isPlainObject(evidence.flap)) {
    return invalid('invalid-evidence');
  }
  const received = evidence.flap;
  if (received.version !== CHIKUN_EVIDENCE_VERSION) return invalid('evidence-version-unsupported', `Ranked accepts only ${CHIKUN_EVIDENCE_VERSION}`);
  if (received.seed !== identity.seed) return invalid('evidence-seed-mismatch');
  if (!exactKeys(received, FLAP_KEYS)) return invalid('evidence-invalid', 'flap keys');
  if (received.fixedStepHz !== CHIKUN_FIXED_STEP_HZ) return invalid('evidence-invalid', 'fixedStepHz');
  if (!Number.isInteger(received.maxTicks) || received.maxTicks < 1 || received.maxTicks > CHIKUN_RANKED_MAX_TICKS) return invalid('evidence-invalid', 'maxTicks');
  if (!Array.isArray(received.flapDeltas) || received.flapDeltas.length > CHIKUN_MAX_FLAP_TRANSITIONS) return invalid('evidence-invalid', 'flapDeltas length');
  try {
    decodeFlapDeltas(received.flapDeltas, received.maxTicks);
  } catch (error) {
    return invalid('evidence-invalid', error?.message);
  }
  // A clean copy: exactly what was received, and exactly what is stored.
  const flap = Object.freeze({
    version: received.version,
    seed: received.seed,
    fixedStepHz: received.fixedStepHz,
    maxTicks: received.maxTicks,
    flapDeltas: Object.freeze([...received.flapDeltas]),
  });

  let result;
  try {
    result = replayChikunRun(flap);
  } catch (error) {
    return rejected('replay-rejected', { detail: String(error?.message ?? 'replay failed').slice(0, 240) });
  }
  if (!result || typeof result.finalState?.terminalReason !== 'string' || !result.finalState.terminalReason || result.seed !== identity.seed) {
    return rejected('replay-rejected', { detail: 'the replay did not reach a terminal state' });
  }

  return buildVerifiedRun({
    identity,
    nowMs,
    score: result.score,
    stats: (mappers) => mappers.statsFromChikunResult(result),
    contract: {
      kills: result.forksPassed,
      maxCombo: result.bestCombo,
      survivalSeconds: Math.floor(result.survivalTicks / 60),
      bossId: null,
    },
    evidence: {
      encoding: CHIKUN_EVIDENCE_ENCODING,
      text: canonicalSessionJson(flap),
      digest: await sha256Hex(flap),
    },
  });
}

// Stored evidence text → the §5.1 evidence object (reverifyStoredRun).
export function parseChikunEvidenceText(text) {
  return { encoding: CHIKUN_EVIDENCE_ENCODING, flap: JSON.parse(text) };
}
