// Ranked settlement verification (contract §5.2, §5.3). Server only.
//
//   bindRankedIdentity(body, opts)   identity checks, seed ticket, ticket seed,
//                                    session key. Cheap: no replay. Settle calls
//                                    it before the paid-entry check (§4.3.3 step 7).
//   verifyRankedRun(body, opts)      binds (unless `bound` is given), then replays
//                                    or plausibility-checks per game → VerifiedRun.
//   computeEvidenceDigest(body)      the stored evidence { encoding, text, bytes,
//                                    digest } without replaying (idempotency, step 8).
//   reverifyStoredRun(stored)        re-verifies stored evidence without the
//                                    ticket, paid and timing checks (re-sign, §3.3).
//
// The per-game verifiers are imported lazily, so a settle loads only the game
// it needs. Nothing here reads body.claim or trusts client stats (A9).
import { createCanonicalSessionIdentity, canonicalSessionJson, sha256Hex } from '../../apps/portal/src/session-integrity.mjs';
import { deriveRankedSeed } from '../../apps/portal/src/session-seed.mjs';
import { RANKED_CHAIN_ID, RANKED_GAMES, RANKED_IDENTITY_KEYS, sha256BytesHex, validateRankedIdentity } from '../../apps/portal/src/ranked-identity.mjs';
import { checkSeedTicket } from './seed-ticket.mjs';

const GAME_MODULES = Object.freeze({
  chikun: () => import('./chikun.mjs').then((module) => ({ verify: module.verifyChikunRun, parse: module.parseChikunEvidenceText })),
  stacked: () => import('./stacked.mjs').then((module) => ({ verify: module.verifyStackedRun, parse: module.parseStackedEvidenceText })),
  'lester-blaster': () => import('./hmh.mjs').then((module) => ({ verify: module.verifyHmhRun, parse: module.parseHmhEvidenceText })),
});

const fail = (error, detail) => Object.freeze({ ok: false, status: 400, error, ...(detail ? { detail } : {}) });
const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));

// §5.2 → { ok:true, gameId, identity /* canonical, with version and sessionKey */ }
//      | { ok:false, status:400, error }
export async function bindRankedIdentity(body, { chainId = RANKED_CHAIN_ID, scoreRegistryAddress, wallet, nowMs, seedSecret, crypto } = {}) {
  if (!isPlainObject(body)) return fail('identity-invalid');
  const checked = validateRankedIdentity(body.identity, { chainId, scoreRegistryAddress, wallet, gameId: body.gameId });
  if (!checked.ok) return fail(checked.error);
  const identity = checked.identity;
  const ticket = checkSeedTicket(body.seedTicket, {
    ...(crypto ? { crypto } : {}),
    secret: seedSecret,
    nowMs,
    sessionId: identity.sessionId,
    wallet: identity.wallet,
    gameId: identity.gameId,
    seasonId: identity.seasonId,
    buildHash: identity.buildHash,
  });
  if (!ticket.ok) return fail(ticket.error);
  const ticketSeed = await deriveRankedSeed({
    sessionId: identity.sessionId,
    wallet: identity.wallet,
    gameId: identity.gameId,
    seasonId: identity.seasonId,
    buildHash: identity.buildHash,
    salt: body.seedTicket.salt,
  });
  if (identity.seed !== ticketSeed) return fail('identity-seed-mismatch');
  const canonical = await createCanonicalSessionIdentity(identity);
  if (canonical.sessionKey !== body.sessionId32) return fail('session-key-mismatch');
  return Object.freeze({ ok: true, gameId: identity.gameId, identity: canonical });
}

async function gameModule(gameId) {
  if (!Object.hasOwn(GAME_MODULES, gameId)) throw new TypeError(`unknown ranked gameId: ${String(gameId)}`);
  return GAME_MODULES[gameId]();
}

// §5.3 → Promise<VerifiedRun | { ok:false, status, error, detail?, flags? }>
export async function verifyRankedRun(body, { chainId = RANKED_CHAIN_ID, scoreRegistryAddress, wallet, nowMs, seedSecret, crypto, bound } = {}) {
  const binding = bound ?? await bindRankedIdentity(body, { chainId, scoreRegistryAddress, wallet, nowMs, seedSecret, crypto });
  if (!binding?.ok) return binding ?? fail('identity-invalid');
  if (!isPlainObject(body) || binding.gameId !== body.gameId || binding.identity?.sessionKey !== body.sessionId32) return fail('session-key-mismatch');
  const { verify } = await gameModule(binding.gameId);
  return verify({ identity: binding.identity, evidence: body.evidence, nowMs });
}

function utf8Bytes(text) {
  return new TextEncoder().encode(text).length;
}

// The stored evidence of §2.6 for a settle body, without replaying:
// { ok:true, encoding, text, bytes, digest } or a 400 failure. Malformed
// evidence gets the same code here as from verifyRankedRun (STACKED decoding
// answers the verifier's own evidence-invalid); anything else is invalid-evidence.
export async function computeEvidenceDigest(body) {
  const game = isPlainObject(body) && Object.hasOwn(RANKED_GAMES, body.gameId) ? RANKED_GAMES[body.gameId] : null;
  const evidence = isPlainObject(body) ? body.evidence : null;
  if (!game || !isPlainObject(evidence) || evidence.encoding !== game.evidenceEncoding) return fail('invalid-evidence');
  const done = (text, digest) => Object.freeze({ ok: true, encoding: game.evidenceEncoding, text, bytes: utf8Bytes(text), digest });
  try {
    if (game.gameId === 'chikun') {
      if (!isPlainObject(evidence.flap)) return fail('invalid-evidence');
      return done(canonicalSessionJson(evidence.flap), await sha256Hex(evidence.flap));
    }
    if (game.gameId === 'stacked') {
      const { decodeStackedEvidence } = await import('./stacked.mjs');
      const decoded = decodeStackedEvidence(evidence);
      if (!decoded.ok) return decoded.failure;
      return done(evidence.sic1, await sha256BytesHex(decoded.bytes));
    }
    if (!Object.hasOwn(evidence, 'runSummary') || !Object.hasOwn(evidence, 'sessionEnvelope')) return fail('invalid-evidence');
    const stored = { runSummary: evidence.runSummary, sessionEnvelope: evidence.sessionEnvelope };
    return done(canonicalSessionJson(stored), await sha256Hex(stored));
  } catch {
    return fail('invalid-evidence');
  }
}

// §5.3 re-sign rule (§3.3, review S16): replay or re-check the evidence stored
// in session_evidence against the stored canonical identity, without the seed
// ticket, paid and timing checks. Returns the same VerifiedRun as the first
// settle (verifiedAt aside), or a failure. The stored identity is the
// VerifiedRun's canonical identity, so it must carry the sessionKey its nine
// preimage keys hash to. `nowMs` only stamps verifiedAt, which the re-sign
// rule does not compare; it defaults to the clock because §5.3 gives this
// function no clock argument.
export async function reverifyStoredRun({ gameId, identity, evidence } = {}, { nowMs = Date.now() } = {}) {
  if (!Object.hasOwn(RANKED_GAMES, gameId)) return fail('identity-game-unknown');
  if (!isPlainObject(identity) || identity.gameId !== gameId) return fail('identity-invalid');
  const preimage = Object.fromEntries(RANKED_IDENTITY_KEYS.map((key) => [key, identity[key]]));
  let canonical;
  try {
    canonical = await createCanonicalSessionIdentity(preimage);
  } catch {
    return fail('identity-invalid');
  }
  if (canonical.sessionKey !== identity.sessionKey) return fail('session-key-mismatch');
  if (!isPlainObject(evidence) || evidence.encoding !== RANKED_GAMES[gameId].evidenceEncoding || typeof evidence.text !== 'string') return fail('invalid-evidence');
  const { verify, parse } = await gameModule(gameId);
  let parsed;
  try {
    parsed = parse(evidence.text);
  } catch {
    return fail('invalid-evidence');
  }
  const verified = await verify({ identity: canonical, evidence: parsed, nowMs });
  if (verified.ok && verified.evidence.text !== evidence.text) return fail('invalid-evidence', 'stored evidence text is not canonical');
  return verified;
}
