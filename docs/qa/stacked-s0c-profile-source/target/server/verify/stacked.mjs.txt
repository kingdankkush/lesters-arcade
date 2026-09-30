// STACKED Ranked verifier (contract §5.3). Server only.
//
// The server replays the SIC1 input evidence with the purity-audited sim and
// reads the terminal result tuple (A9). Replay runs under the client's
// maxTicks (STACKED_MAX_TICKS) and exactly config { startLevel:1, buildHash,
// seasonId }, so a tick-ceiling end equals the client's.
import { replayStackedRun } from '../../apps/portal/src/stacked-sim.mjs';
import { assertStackedEvidenceHeader, decodeStackedBase64 } from '../../apps/portal/src/stacked-evidence-transport.mjs';
import { STACKED_MAX_EVIDENCE_BYTES, STACKED_MAX_TICKS } from '../../apps/portal/src/stacked-contracts.mjs';
import { sha256BytesHex } from '../../apps/portal/src/ranked-identity.mjs';
import { buildVerifiedRun, invalid, isPlainObject, rejected } from './verified-run.mjs';

export const STACKED_GAME_ID = 'stacked';
export const STACKED_EVIDENCE_ENCODING = 'stacked-sic1+base64';
export const STACKED_RANKED_START_LEVEL = 1;

function exactKeys(value, keys) {
  if (!isPlainObject(value)) return false;
  const actual = Object.keys(value).sort();
  return actual.length === keys.length && actual.every((key, index) => key === keys[index]);
}

// The SIC1 header seed is the raw uint32 at offset 8 (the tuple seed is
// normalized, 0 becoming 1).
export function stackedHeaderSeed(bytes) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(8);
}

// Decode and header-check the §5.1 evidence without replaying it.
export function decodeStackedEvidence(evidence) {
  if (!exactKeys(evidence, ['encoding', 'sic1', 'startLevel']) || evidence.encoding !== STACKED_EVIDENCE_ENCODING) return { ok: false, failure: invalid('invalid-evidence') };
  if (evidence.startLevel !== STACKED_RANKED_START_LEVEL) return { ok: false, failure: invalid('evidence-invalid', 'Ranked STACKED starts at level 1') };
  let bytes;
  try {
    bytes = assertStackedEvidenceHeader(decodeStackedBase64(evidence.sic1, STACKED_MAX_EVIDENCE_BYTES));
  } catch (error) {
    return { ok: false, failure: invalid('evidence-invalid', error?.message) };
  }
  return { ok: true, bytes };
}

// The §5.3 mapping from a replayed tuple to the VerifiedRun. Exported so tests
// can drive it with a hand-crafted tuple (score bound, maxCombo clamp).
export async function verifiedRunFromStackedTuple({ identity, tuple, sic1, digest, nowMs }) {
  return buildVerifiedRun({
    identity,
    nowMs,
    score: tuple.score,
    stats: (mappers) => mappers.statsFromStackedTuple(tuple),
    contract: {
      kills: tuple.lines,
      maxCombo: tuple.maxCombo,
      survivalSeconds: Math.floor(tuple.ticks / 60),
      bossId: null,
    },
    evidence: { encoding: STACKED_EVIDENCE_ENCODING, text: sic1, digest },
  });
}

// → Promise<VerifiedRun | { ok:false, status, error, detail? }>
// `identity` is the canonical identity (with version and sessionKey).
export async function verifyStackedRun({ identity, evidence, nowMs }) {
  const decoded = decodeStackedEvidence(evidence);
  if (!decoded.ok) return decoded.failure;
  const { bytes } = decoded;
  if (stackedHeaderSeed(bytes) !== identity.seed) return invalid('evidence-seed-mismatch');
  let tuple;
  try {
    tuple = replayStackedRun(bytes, {
      expectedSeed: identity.seed,
      maxTicks: STACKED_MAX_TICKS,
      config: { startLevel: STACKED_RANKED_START_LEVEL, buildHash: identity.buildHash, seasonId: identity.seasonId },
    });
  } catch (error) {
    return rejected('replay-rejected', { detail: String(error?.message ?? 'replay failed').slice(0, 240) });
  }
  if (tuple?.v !== 'stacked-result-v1' || tuple.buildHash !== identity.buildHash || tuple.seasonId !== identity.seasonId) {
    return rejected('replay-rejected', { detail: 'the replay tuple does not match the session binding' });
  }
  return verifiedRunFromStackedTuple({ identity, tuple, sic1: evidence.sic1, digest: await sha256BytesHex(bytes), nowMs });
}

// Stored evidence text → the §5.1 evidence object (reverifyStoredRun).
export function parseStackedEvidenceText(text) {
  return { encoding: STACKED_EVIDENCE_ENCODING, sic1: text, startLevel: STACKED_RANKED_START_LEVEL };
}
