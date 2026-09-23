// EIP-712 attestations for Ranked settlement, and the re-sign rule
// (contract §8.2, §3.3, A3, A20; security review S16).
//
// The signing logic that /api/attest used to expose now lives only here, on
// the settle path, behind auth, the paid-entry check and server verification.
// verifier-attestation.mjs stays the single definition of the domain, the
// VerifiedRun type and the canonical run struct.
//
// attestation (the verified_sessions column) stores only
// { signature, digest, deadline, achievements32 }: the run is always rebuilt
// from the row's own columns, and a re-sign never trusts stored JSON. It
// re-verifies the run from session_evidence, requires the result to equal the
// row's score, contract fields and envelope hash, and signs that fresh run.

import { ethers as defaultEthers } from 'ethers';
import {
  ATTESTATION_TTL_SECONDS,
  attestationDigest,
  attestationDomain,
  buildVerifiedRun,
  signAttestation,
} from '../../apps/portal/src/verifier-attestation.mjs';
import { casStatus, readStoredEvidence } from './store.mjs';

export { ATTESTATION_TTL_SECONDS, attestationDomain };

// A row whose attestation expires within this margin is re-signed before any
// submit (§3.3).
export const RESIGN_MARGIN_SECONDS = 120;
export const MAX_NFT_ACHIEVEMENTS = 32;
const HEX32 = /^0x[0-9a-f]{64}$/;
const SIGNATURE = /^0x[0-9a-f]{130}$/;

export function attestationDeadlineFor(nowMs) {
  return Math.floor(Number(nowMs) / 1000) + ATTESTATION_TTL_SECONDS;
}

function nonEmptyText(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`verified run ${name} is required (a null would hash ethers.id(''))`);
  return value;
}

// Signs a VerifiedRun (§5.3) for submitVerifiedSession.
//   nftAchievementIds  the NFT candidates earned this run (A20), at most 32;
//                      hashed with ethers.id by buildVerifiedRun
//   deadlineSeconds    now + ATTESTATION_TTL_SECONDS (`deadline` is accepted
//                      as an alias, the name §8.2 uses)
// → { run, achievements32, signature, digest, deadline }
export async function signVerifiedRun(ethers, { verifiedRun, nftAchievementIds = [], deadlineSeconds, deadline, domain, signer } = {}) {
  const lib = ethers ?? defaultEthers;
  if (!verifiedRun || verifiedRun.ok === false) throw new TypeError('signVerifiedRun needs a VerifiedRun');
  nonEmptyText(verifiedRun.runtimeId, 'runtimeId');
  nonEmptyText(verifiedRun.seasonId, 'seasonId');
  const ids = [...new Set((nftAchievementIds ?? []).map(String))];
  if (ids.length > MAX_NFT_ACHIEVEMENTS) throw new RangeError('at most 32 achievement ids ride in one settlement');
  const built = buildVerifiedRun(lib, {
    sessionId32: verifiedRun.sessionId32,
    gameId: verifiedRun.gameId,
    player: verifiedRun.wallet,
    score: verifiedRun.score,
    kills: verifiedRun.contract.kills,
    maxCombo: verifiedRun.contract.maxCombo,
    survivalSeconds: verifiedRun.contract.survivalSeconds,
    bossId: verifiedRun.contract.bossId ?? null,
    envelopeHash: verifiedRun.envelopeHash,
    runtimeId: verifiedRun.runtimeId,
    seasonId: verifiedRun.seasonId,
    deadline: deadlineSeconds ?? deadline,
    achievements: ids,
  });
  const signed = await signAttestation(lib, { signer, domain, run: built.run });
  return Object.freeze({ run: built.run, achievements32: built.achievements32, signature: signed.signature, digest: signed.digest, deadline: signed.deadline });
}

// What the attestation column stores.
export function attestationRecord(signed) {
  return { signature: signed.signature, digest: signed.digest, deadline: String(signed.deadline), achievements32: [...signed.achievements32] };
}

export function isAttestationRecord(value) {
  return Boolean(value) && typeof value === 'object'
    && typeof value.signature === 'string' && SIGNATURE.test(value.signature.toLowerCase())
    && typeof value.digest === 'string' && HEX32.test(value.digest.toLowerCase())
    && /^[0-9]{1,20}$/.test(String(value.deadline ?? ''))
    && Array.isArray(value.achievements32) && value.achievements32.length <= MAX_NFT_ACHIEVEMENTS
    && value.achievements32.every((id) => typeof id === 'string' && HEX32.test(id.toLowerCase()));
}

// The run struct of a stored row: its own columns plus the stored deadline
// and achievement ids.
export function runFromRow(ethers, row) {
  const lib = ethers ?? defaultEthers;
  if (!isAttestationRecord(row?.attestation)) throw new TypeError('row has no attestation');
  return buildVerifiedRun(lib, {
    sessionId32: row.sessionId32,
    gameId: row.gameId,
    player: row.wallet,
    score: BigInt(row.score),
    kills: BigInt(row.kills),
    maxCombo: BigInt(row.maxCombo),
    survivalSeconds: BigInt(row.survivalSeconds),
    bossId: row.bossId ?? null,
    envelopeHash: row.envelopeHash,
    runtimeId: nonEmptyText(row.runtimeId, 'runtimeId'),
    seasonId: nonEmptyText(row.seasonId, 'seasonId'),
    deadline: BigInt(row.attestation.deadline),
    achievements: row.attestation.achievements32.map((id) => id.toLowerCase()),
  });
}

// True when the stored attestation matches the row's columns under `domain`.
export function attestationMatchesRow(ethers, row, domain) {
  try {
    const { run } = runFromRow(ethers, row);
    return attestationDigest(ethers ?? defaultEthers, { domain, run }).toLowerCase() === String(row.attestation.digest).toLowerCase();
  } catch {
    return false;
  }
}

// §3.3: re-sign before any submit when the attestation is missing or expires
// within two minutes.
export function needsResign(row, nowMs) {
  if (!isAttestationRecord(row?.attestation)) return true;
  return Number(row.attestation.deadline) < Math.floor(Number(nowMs) / 1000) + RESIGN_MARGIN_SECONDS;
}

function sameRun(fresh, row) {
  return fresh.sessionId32 === row.sessionId32
    && String(fresh.wallet).toLowerCase() === row.wallet
    && fresh.gameId === row.gameId
    && fresh.seasonId === row.seasonId
    && fresh.runtimeId === row.runtimeId
    && Number(fresh.score) === Number(row.score)
    && Number(fresh.contract?.kills) === Number(row.kills)
    && Number(fresh.contract?.maxCombo) === Number(row.maxCombo)
    && Number(fresh.contract?.survivalSeconds) === Number(row.survivalSeconds)
    && (fresh.contract?.bossId ?? null) === (row.bossId ?? null)
    && String(fresh.envelopeHash).toLowerCase() === row.envelopeHash;
}

// The re-sign rule (§3.3, S16). Re-verifies the stored evidence with
// verify.reverifyStoredRun, requires the fresh VerifiedRun to equal the row,
// intersects the row's nft_achievements with the CURRENT catalog's
// nftAchievementIds(gameId), signs the fresh run, and moves the row to signed
// (compare-and-set from its current status).
// → { ok:true, moved } | { ok:false, class, code }
export async function resignRow({ ethers, db, row, verify, catalog, signer, domain, nowMs }) {
  const lib = ethers ?? defaultEthers;
  const now = typeof nowMs === 'function' ? nowMs() : Number(nowMs);
  const stored = await readStoredEvidence(db, row.sessionId32);
  if (!stored || !stored.identity) return { ok: false, class: 'deterministic', code: 'stored-run-mismatch' };
  let fresh;
  try {
    fresh = await verify.reverifyStoredRun({ gameId: row.gameId, identity: stored.identity, evidence: { encoding: stored.encoding, text: stored.text } }, { nowMs: now });
  } catch {
    // The verifier could not run (a module or runtime fault), which is not
    // evidence that the run is wrong: wait and try again.
    return { ok: false, class: 'wait', code: 'unknown-error' };
  }
  if (!fresh || fresh.ok === false || !sameRun(fresh, row)) return { ok: false, class: 'deterministic', code: 'stored-run-mismatch' };
  if (String(fresh.evidence?.digest ?? stored.digest).toLowerCase() !== String(stored.digest).toLowerCase()) return { ok: false, class: 'deterministic', code: 'stored-run-mismatch' };
  let current;
  try {
    current = new Set(await catalog.nftAchievementIds(row.gameId));
  } catch {
    return { ok: false, class: 'wait', code: 'unknown-error' };
  }
  const nftIds = (row.nftAchievements ?? []).filter((id) => current.has(id)).slice(0, MAX_NFT_ACHIEVEMENTS);
  const signed = await signVerifiedRun(lib, { verifiedRun: fresh, nftAchievementIds: nftIds, deadlineSeconds: attestationDeadlineFor(now), domain, signer });
  const moved = await casStatus(db, {
    sessionId32: row.sessionId32,
    from: row.status,
    to: 'signed',
    set: { attestation: attestationRecord(signed), next_attempt_at: null },
    nowMs: now,
  });
  return { ok: true, moved };
}
