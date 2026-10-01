// Hard Money Heroes Ranked verifier (contract §5.3). Server only.
//
// HMH is plausibility-checked, not replayed (A9): the run summary must pass the
// schema, bind to the session identity and the session envelope, and pass the
// reboot-calibrated validator of hmh-plausibility.mjs. This module never
// imports arcade-core.mjs or hmh-run-integrity.mjs.
// Schema 1-8: the v8 module answers schema 1-7 exactly as the v7 module.
import { validateRunSummaryPayload } from '../../sdk/hmh-run-summary-schema-v8.mjs';
import { isHmhV7Build } from '../../sdk/hmh-run-contract-v7.mjs';
import { isHmhV8Build } from '../../sdk/hmh-run-v8-build.mjs';
import { canonicalSessionJson, sha256Hex } from '../../apps/portal/src/session-integrity.mjs';
import { HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG } from '../../apps/portal/src/hmh-character-config.mjs';
import { resolveHmhMapContext } from './hmh-map-context.mjs';
import { buildVerifiedRun, invalid, isPlainObject, rejected, scoreOutOfBounds } from './verified-run.mjs';

export const HMH_GAME_ID = 'lester-blaster';
export const HMH_EVIDENCE_ENCODING = 'hmh-run-summary-v6+json';
export const HMH_RUN_SUMMARY_SCHEMA_VERSION = 6;
// Ranked accepts schema 6 (the 1.8.x child, including one cached by the service
// worker), schema 7, only from a build whose game version is 1.9.0 or later
// (numeric compare, contract §2 and §15.1), and schema 8 (the 2.1.0 Level 1 map),
// only from a build of game 2.1.0 or later. The evidence encoding keeps its v6
// label (the Neon constraint); the payload's schemaVersion selects the rules.
export const HMH_RANKED_SCHEMA_VERSIONS = Object.freeze([6, 7, 8]);
export function hmhRankedSchemaError(runSummary) {
  if (!HMH_RANKED_SCHEMA_VERSIONS.includes(runSummary.schemaVersion)) return 'Ranked requires run summary schema 6, 7 or 8';
  if (runSummary.schemaVersion === 7 && !isHmhV7Build(runSummary.identity.buildHash)) return 'run summary schema 7 requires game 1.9.0 or later';
  if (runSummary.schemaVersion === 8 && !isHmhV8Build(runSummary.identity.buildHash)) return 'run summary schema 8 requires game 2.1.0 or later';
  return '';
}
export const HMH_RUN_SUMMARY_MAX_JSON = 262_144;
export const HMH_SESSION_ENVELOPE_MAX_JSON = 8_192;
export const HMH_SESSION_ENVELOPE_VERSION = 'lesters-session-envelope-v1';
export const HMH_BOSS_ID = 'boss-liquidator';

// The boss result of a verified HMH run, for every schema. `bossId` is the
// on-chain boss id of the attestation and verified_sessions.boss_id: the
// Liquidator's (HMH_BOSS_ID) when kills.boss counts him, else null. It stays
// the Liquidator's on schema 8, where kills.boss still counts him only (schema
// rule S6), because he is the only HMH boss id the score registry and the
// indexer know (server/neon/rows.mjs BOSS_IDS). `bossesDefeated` names every
// boss the run defeated, in catalogue order: the bosses rows of schema 7 and 8
// (the district bosses included), the Liquidator alone on schema 6.
export function hmhBossResult(runSummary) {
  const bossesDefeated = Array.isArray(runSummary?.bosses)
    ? runSummary.bosses.filter((row) => row.defeatedTick > 0).map((row) => row.bossId)
    : (runSummary?.kills?.boss > 0 ? ['liquidator'] : []);
  return Object.freeze({ bossId: runSummary?.kills?.boss > 0 ? HMH_BOSS_ID : null, bossesDefeated: Object.freeze(bossesDefeated) });
}
const ENVELOPE_KEYS = Object.freeze(['envelopeHash', 'eventHash', 'finalStateHash', 'gameplayEvents', 'identity', 'inputHash', 'inputTransitions', 'sessionKey', 'version']);
const HASH_PATTERN = /^0x[0-9a-f]{64}$/;

// Hero id → Ranked runs required (§4.3.3 step 11), read from the character config.
export const HMH_HERO_GATES = Object.freeze(Object.fromEntries(
  HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG.unlockableCharacters.map((character) => [character.id, character.gate.count]),
));
// The heroes that need no gate. A hero id in neither list is unknown: the
// child accepts any id-shaped heroId, so the hero-locked check should refuse
// ids outside HMH_FREE_HEROES and HMH_HERO_GATES rather than treat them as free.
export const HMH_FREE_HEROES = Object.freeze([...HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG.starterCharacterIds]);

function exactKeys(value, keys) {
  if (!isPlainObject(value)) return false;
  const actual = Object.keys(value).sort();
  return actual.length === keys.length && actual.every((key, index) => key === keys[index]);
}

// `identity` is the canonical identity (with version and sessionKey).
async function checkSessionEnvelope(envelope, identity) {
  if (!exactKeys(envelope, ENVELOPE_KEYS)) return false;
  if (envelope.version !== HMH_SESSION_ENVELOPE_VERSION || envelope.sessionKey !== identity.sessionKey) return false;
  if (![envelope.inputHash, envelope.eventHash, envelope.finalStateHash, envelope.envelopeHash].every((hash) => typeof hash === 'string' && HASH_PATTERN.test(hash))) return false;
  if (!Number.isSafeInteger(envelope.inputTransitions) || envelope.inputTransitions < 0) return false;
  if (!Number.isSafeInteger(envelope.gameplayEvents) || envelope.gameplayEvents < 0) return false;
  if (!isPlainObject(envelope.identity) || canonicalSessionJson(envelope.identity) !== canonicalSessionJson(identity)) return false;
  const { sessionKey: _sessionKey, envelopeHash, ...hashed } = envelope;
  return envelopeHash === await sha256Hex(hashed);
}

// → Promise<VerifiedRun | { ok:false, status, error, detail?, flags? }>
export async function verifyHmhRun({ identity, evidence, nowMs }) {
  if (!exactKeys(evidence, ['encoding', 'runSummary', 'sessionEnvelope']) || evidence.encoding !== HMH_EVIDENCE_ENCODING) return invalid('invalid-evidence');
  const { runSummary, sessionEnvelope } = evidence;
  let summaryJson;
  let envelopeJson;
  try {
    summaryJson = JSON.stringify(runSummary);
    envelopeJson = JSON.stringify(sessionEnvelope);
  } catch {
    return invalid('invalid-evidence');
  }
  if (typeof summaryJson !== 'string' || summaryJson.length > HMH_RUN_SUMMARY_MAX_JSON) return invalid('invalid-evidence', 'runSummary-too-large');
  if (typeof envelopeJson !== 'string' || envelopeJson.length > HMH_SESSION_ENVELOPE_MAX_JSON) return invalid('invalid-evidence', 'sessionEnvelope-too-large');

  const schemaError = validateRunSummaryPayload(runSummary);
  if (schemaError) return invalid('run-summary-invalid', schemaError.slice(0, 240));
  const gateError = hmhRankedSchemaError(runSummary);
  if (gateError) return invalid('run-summary-invalid', gateError);
  const summaryIdentity = runSummary.identity;
  if (summaryIdentity.seed !== identity.seed || summaryIdentity.buildHash !== identity.buildHash || summaryIdentity.mode !== 'ranked') {
    return invalid('run-summary-identity-mismatch');
  }
  if (summaryIdentity.terminalReason !== 'defeated') return invalid('run-summary-not-terminal');
  if (!await checkSessionEnvelope(sessionEnvelope, identity)) return invalid('session-envelope-invalid');

  const score = runSummary.totals.score;
  if (score > 10_000_000_000) return scoreOutOfBounds(score);
  // Canonical identity, terminal evidence and score bounds have already passed.
  // Old child schemas retain their legacy map under newer portal identities.
  const mapContext = resolveHmhMapContext({ identity, schemaVersion: runSummary.schemaVersion });
  if (!mapContext) return invalid('run-summary-invalid', 'unsupported HMH map context');
  const plausibility = mapContext.validatePlausibility(runSummary);
  if (plausibility.verdict === 'rejected') return rejected('implausible-run', { flags: plausibility.flags });

  return buildVerifiedRun({
    identity,
    nowMs,
    score,
    stats: (mappers) => mappers.statsFromHmhRunSummary(runSummary),
    contract: {
      kills: runSummary.kills.total,
      maxCombo: runSummary.totals.maxCombo,
      survivalSeconds: Math.floor(runSummary.totals.elapsedMs / 1000),
      bossId: hmhBossResult(runSummary).bossId,
    },
    evidence: {
      encoding: HMH_EVIDENCE_ENCODING,
      text: canonicalSessionJson({ runSummary, sessionEnvelope }),
      digest: await sha256Hex({ runSummary, sessionEnvelope }),
    },
    plausibility,
  });
}

// Stored evidence text → the §5.1 evidence object (reverifyStoredRun).
export function parseHmhEvidenceText(text) {
  const parsed = JSON.parse(text);
  if (!exactKeys(parsed, ['runSummary', 'sessionEnvelope'])) throw new TypeError('stored HMH evidence must hold runSummary and sessionEnvelope');
  return { encoding: HMH_EVIDENCE_ENCODING, runSummary: parsed.runSummary, sessionEnvelope: parsed.sessionEnvelope };
}
