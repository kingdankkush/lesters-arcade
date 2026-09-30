// Chikun's Escape Ranked verifier (contract §5.3). Server only.
//
// The server replays the flap evidence with the cabinet's own runtime and
// reads the result (A9); the client's claim is never consulted. Importing this
// module loads chikun-cabinet.mjs, which pulls in the obstacle JSON (import
// attribute) and game-manifest.mjs (its pure keccak256.mjs, not ethers).
//
// Dispatch: the evidence version selects a course from the shared official
// course table (apps/portal/src/chikun-official-course.mjs). Course one
// (chikun-flap-evidence-v6) is the default and the only course while
// CHIKUN_OFFICIAL_COURSE_TWO_ENABLED is false; course two
// (chikun-input-evidence-v7) is parsed, bounded and replayed only when the
// gate is open. v1-v5 are never official. Every v6 body takes exactly the
// path it took before the table existed (same errors, stats, encoding,
// evidence text, digest and envelope hash).
import {
  CHIKUN_EVIDENCE_VERSION,
  CHIKUN_FIXED_STEP_HZ,
  CHIKUN_MAX_FLAP_TRANSITIONS,
  decodeFlapDeltas,
  replayChikunRun,
} from '../../apps/portal/src/chikun-cabinet.mjs';
import { courseV2InputTicks } from '../../apps/portal/src/chikun-course-v2-runtime.mjs';
import {
  CHIKUN_OFFICIAL_COURSES_BY_VERSION,
  CHIKUN_OFFICIAL_COURSE_TWO_ENABLED,
  CHIKUN_OFFICIAL_MAX_TRANSITIONS,
  officialChikunCourseForEvidence,
  officialChikunCourses,
  officialChikunEvidenceEncodings,
} from '../../apps/portal/src/chikun-official-course.mjs';
import { canonicalSessionJson, sha256Hex } from '../../apps/portal/src/session-integrity.mjs';
import { buildVerifiedRun, invalid, isPlainObject, rejected } from './verified-run.mjs';

export const CHIKUN_GAME_ID = 'chikun';
export const CHIKUN_EVIDENCE_ENCODING = 'chikun-flap-evidence-v6+json';
export const CHIKUN_COURSE_TWO_EVIDENCE_VERSION = 'chikun-input-evidence-v7';
export const CHIKUN_COURSE_TWO_EVIDENCE_ENCODING = 'chikun-input-evidence-v7+json';
// §5.1: maxTicks <= 216,000 (60 minutes at 60 Hz).
export const CHIKUN_RANKED_MAX_TICKS = 216_000;

// The §6.3 stats of a verified run, in key order. Course two adds its own
// counters after the shared course-one keys.
export const CHIKUN_V6_STATS_KEYS = Object.freeze(['score', 'survivalTicks', 'survivalSeconds', 'coinsCollected', 'forksPassed', 'nearMisses', 'bestCombo',
  'nearMissStreakBest', 'flawlessRegions', 'flapCount', 'distanceMeters', 'regionIndexReached', 'regionReached', 'laps',
  'speedMultiplierReached', 'terminalReason', 'evidenceVersion']);
export const CHIKUN_V7_STATS_KEYS = Object.freeze([...CHIKUN_V6_STATS_KEYS, 'glideCount', 'shieldsUsed', 'powerupsCollected']);

function exactKeys(value, keys) {
  if (!isPlainObject(value)) return false;
  const actual = Object.keys(value).sort();
  return actual.length === keys.length && actual.every((key, index) => key === keys[index]);
}

const count = (value) => Math.max(0, Math.floor(Number(value) || 0));

// Per-course parsing, cleaning and stats. Keyed by evidence version; the
// shared table supplies the encoding, keys and runtimeId.
const COURSE_VERIFIERS = Object.freeze({
  [CHIKUN_EVIDENCE_VERSION]: Object.freeze({
    // v6: one delta-encoded flap stream, at most 12,000 flaps.
    parse(received) {
      if (!Array.isArray(received.flapDeltas) || received.flapDeltas.length > CHIKUN_MAX_FLAP_TRANSITIONS) return invalid('evidence-invalid', 'flapDeltas length');
      try {
        decodeFlapDeltas(received.flapDeltas, received.maxTicks);
      } catch (error) {
        return invalid('evidence-invalid', error?.message);
      }
      return null;
    },
    clean: (received) => Object.freeze({
      version: received.version,
      seed: received.seed,
      fixedStepHz: received.fixedStepHz,
      maxTicks: received.maxTicks,
      flapDeltas: Object.freeze([...received.flapDeltas]),
    }),
    stats: (mappers, result) => mappers.statsFromChikunResult(result),
  }),
  [CHIKUN_COURSE_TWO_EVIDENCE_VERSION]: Object.freeze({
    // v7: delta-encoded flaps plus held-glide toggles, at most 12,000 combined.
    parse(received) {
      for (const stream of ['flapDeltas', 'glideDeltas']) {
        if (!Array.isArray(received[stream]) || received[stream].length > CHIKUN_OFFICIAL_MAX_TRANSITIONS) return invalid('evidence-invalid', `${stream} length`);
      }
      if (received.flapDeltas.length + received.glideDeltas.length > CHIKUN_OFFICIAL_MAX_TRANSITIONS) return invalid('evidence-invalid', 'combined transitions');
      try {
        courseV2InputTicks(received.flapDeltas, received.maxTicks);
        courseV2InputTicks(received.glideDeltas, received.maxTicks);
      } catch (error) {
        return invalid('evidence-invalid', error?.message);
      }
      return null;
    },
    clean: (received) => Object.freeze({
      version: received.version,
      seed: received.seed,
      fixedStepHz: received.fixedStepHz,
      maxTicks: received.maxTicks,
      flapDeltas: Object.freeze([...received.flapDeltas]),
      glideDeltas: Object.freeze([...received.glideDeltas]),
    }),
    stats: (mappers, result) => ({
      ...mappers.statsFromChikunResult(result),
      glideCount: result.evidence.glideDeltas.length,
      shieldsUsed: count(result.shieldsUsed),
      powerupsCollected: count(result.powerupsCollected),
    }),
  }),
});

// → Promise<VerifiedRun | { ok:false, status, error, detail? }>
// `identity` is the canonical identity (with version and sessionKey).
// `courseTwoEnabled` defaults to the shared gate; tests inject true.
export async function verifyChikunRun({ identity, evidence, nowMs, courseTwoEnabled = CHIKUN_OFFICIAL_COURSE_TWO_ENABLED }) {
  const encodings = officialChikunEvidenceEncodings({ courseTwoEnabled });
  if (!exactKeys(evidence, ['encoding', 'flap']) || !encodings.includes(evidence.encoding) || !isPlainObject(evidence.flap)) {
    return invalid('invalid-evidence');
  }
  const received = evidence.flap;
  const course = officialChikunCourseForEvidence(received.version, { courseTwoEnabled });
  if (!course || course.encoding !== evidence.encoding) {
    return invalid('evidence-version-unsupported', `Ranked accepts only ${officialChikunCourses({ courseTwoEnabled }).map((entry) => entry.evidenceVersion).join(', ')}`);
  }
  const verifier = COURSE_VERIFIERS[course.evidenceVersion];
  if (received.seed !== identity.seed) return invalid('evidence-seed-mismatch');
  if (!exactKeys(received, course.evidenceKeys)) return invalid('evidence-invalid', 'flap keys');
  if (received.fixedStepHz !== CHIKUN_FIXED_STEP_HZ) return invalid('evidence-invalid', 'fixedStepHz');
  if (!Number.isInteger(received.maxTicks) || received.maxTicks < 1 || received.maxTicks > CHIKUN_RANKED_MAX_TICKS) return invalid('evidence-invalid', 'maxTicks');
  const malformed = verifier.parse(received);
  if (malformed) return malformed;
  // A clean copy: exactly what was received, and exactly what is stored.
  const flap = verifier.clean(received);

  let result;
  try {
    result = replayChikunRun(flap);
  } catch (error) {
    return rejected('replay-rejected', { detail: String(error?.message ?? 'replay failed').slice(0, 240) });
  }
  if (!result || typeof result.finalState?.terminalReason !== 'string' || !result.finalState.terminalReason || result.seed !== identity.seed) {
    return rejected('replay-rejected', { detail: 'the replay did not reach a terminal state' });
  }
  if (result.evidence?.version !== course.evidenceVersion) {
    return rejected('replay-rejected', { detail: 'the replay ran another course' });
  }

  return buildVerifiedRun({
    identity,
    nowMs,
    runtimeId: course.courseId === 1 ? null : course.runtimeId,
    score: result.score,
    stats: (mappers) => verifier.stats(mappers, result),
    contract: {
      kills: result.forksPassed,
      maxCombo: result.bestCombo,
      survivalSeconds: Math.floor(result.survivalTicks / 60),
      bossId: null,
    },
    evidence: {
      encoding: course.encoding,
      text: canonicalSessionJson(flap),
      digest: await sha256Hex(flap),
    },
  });
}

// Stored evidence text → the §5.1 evidence object (reverifyStoredRun). The
// encoding follows the stored version's course; anything else keeps the v6
// encoding and fails the verifier's version check as before.
export function parseChikunEvidenceText(text) {
  const flap = JSON.parse(text);
  const course = isPlainObject(flap) && typeof flap.version === 'string' && Object.hasOwn(CHIKUN_OFFICIAL_COURSES_BY_VERSION, flap.version) ? CHIKUN_OFFICIAL_COURSES_BY_VERSION[flap.version] : null;
  return { encoding: course?.encoding ?? CHIKUN_EVIDENCE_ENCODING, flap };
}
