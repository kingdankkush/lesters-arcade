// Ranked settle request builders (contract §5.1, §7.2). Lazy-loaded by main.js.
//
// Each builder turns a finished live Ranked session plus its game's canonical
// evidence into exactly the §5.1 body the server verifies:
//   identity     = rankedIdentityFor(session, { scoreRegistryAddress })  (A10)
//   sessionId32  = await rankedSessionKey(identity)
//   seedTicket   = session.seedTicket   (applied before the entry, A25)
//   entryTxHash  = session.entryReceipt?.txHash ?? null   (A17)
// Preview never builds a body, so every builder requires the seed ticket.
//
// Pure: no DOM, no network, no clock.
import { RANKED_GAMES, RANKED_SETTLE_VERSION, rankedIdentityFor, rankedSessionKey } from './ranked-identity.mjs';
import { encodeStackedBase64 } from './stacked-evidence-transport.mjs';

const HEX32 = /^0x[0-9a-f]{64}$/;
const MAX_CLAIM_SCORE = 1e12;
const CHIKUN_EVIDENCE_VERSION = 'chikun-flap-evidence-v6';

async function baseRequest({ session, scoreRegistryAddress, claimScore }, gameId) {
  if (!session || typeof session !== 'object') throw new TypeError('a Ranked session is required to build a settle request');
  if (session.gameId !== gameId) throw new TypeError(`expected a ${gameId} session, got ${String(session.gameId)}`);
  const ticket = session.seedTicket;
  if (!ticket || typeof ticket !== 'object') throw new Error('this live Ranked session has no seed ticket; it cannot be settled (A25)');
  const identity = rankedIdentityFor(session, { scoreRegistryAddress });
  const sessionId32 = await rankedSessionKey(identity);
  const receipt = session.entryReceipt ?? null;
  const receiptKey = typeof receipt?.sessionId32 === 'string' ? receipt.sessionId32.toLowerCase() : null;
  if (receiptKey && receiptKey !== sessionId32) throw new Error('the paid entry was opened under a different session key');
  const txHash = typeof receipt?.txHash === 'string' ? receipt.txHash.toLowerCase() : null;
  const body = {
    v: RANKED_SETTLE_VERSION,
    gameId,
    sessionId32,
    identity: { ...identity },
    seedTicket: { v: ticket.v, salt: ticket.salt, issuedAt: ticket.issuedAt, mac: ticket.mac },
    entryTxHash: txHash && HEX32.test(txHash) ? txHash : null,
    evidence: null,
  };
  if (Number.isSafeInteger(claimScore) && claimScore >= 0 && claimScore <= MAX_CLAIM_SCORE) body.claim = { score: claimScore };
  return body;
}

// `evidence` is the verified v6 flap object from the replay claim.
export async function buildChikunSettleRequest({ session, scoreRegistryAddress, evidence, claimScore } = {}) {
  const body = await baseRequest({ session, scoreRegistryAddress, claimScore }, 'chikun');
  if (!evidence || typeof evidence !== 'object' || evidence.version !== CHIKUN_EVIDENCE_VERSION) throw new TypeError('Ranked Chikun settles only chikun-flap-evidence-v6');
  if (!Array.isArray(evidence.flapDeltas)) throw new TypeError('Chikun v6 evidence carries flapDeltas');
  if (evidence.seed !== body.identity.seed) throw new Error('Chikun evidence was played under another seed');
  body.evidence = {
    encoding: RANKED_GAMES.chikun.evidenceEncoding,
    flap: {
      version: evidence.version,
      seed: evidence.seed,
      fixedStepHz: evidence.fixedStepHz,
      maxTicks: evidence.maxTicks,
      flapDeltas: [...evidence.flapDeltas],
    },
  };
  return body;
}

// `sic1Bytes` is the host-verified SIC1 evidence (Uint8Array).
export async function buildStackedSettleRequest({ session, scoreRegistryAddress, sic1Bytes, claimScore } = {}) {
  const body = await baseRequest({ session, scoreRegistryAddress, claimScore }, 'stacked');
  if (!(sic1Bytes instanceof Uint8Array)) throw new TypeError('STACKED evidence must be the SIC1 bytes');
  body.evidence = { encoding: RANKED_GAMES.stacked.evidenceEncoding, sic1: encodeStackedBase64(sic1Bytes), startLevel: 1 };
  return body;
}

// `runSummary` is the reboot's canonical v6 summary; `sessionEnvelope` is the
// lesters-session-envelope-v1 finalized under the same Ranked identity.
export async function buildHmhSettleRequest({ session, scoreRegistryAddress, runSummary, sessionEnvelope, claimScore } = {}) {
  const body = await baseRequest({ session, scoreRegistryAddress, claimScore }, 'lester-blaster');
  if (!runSummary || typeof runSummary !== 'object') throw new TypeError('HMH settles only with its canonical run summary');
  if (runSummary.identity?.seed !== body.identity.seed || runSummary.identity?.buildHash !== body.identity.buildHash) {
    throw new Error('the HMH run summary was played under another seed or build');
  }
  if (!sessionEnvelope || sessionEnvelope.sessionKey !== body.sessionId32) throw new Error('the HMH session envelope does not match the session key');
  body.evidence = { encoding: RANKED_GAMES['lester-blaster'].evidenceEncoding, runSummary, sessionEnvelope };
  return body;
}
