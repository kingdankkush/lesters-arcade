// Trusted-verifier attestation for Ranked settlement (owner direction
// 2026-09-16). Pure helpers shared by the browser client and the server
// function: one EIP-712 domain/type definition, one canonical VerifiedRun
// encoding, one signer and one recoverer. `ethers` is injected so the module
// stays DOM-free and the same code runs under Node and in the vendored bundle.
//
// Must match contracts/src/ScoreSubmissionRegistry.sol exactly:
//   EIP712("Lester's Arcade Ranked Settlement", "2")
//   VerifiedRun(bytes32 sessionId,bytes32 gameId,address player,uint256 score,
//     uint64 kills,uint64 maxCombo,uint64 survivalSeconds,bytes32 bossId,
//     bytes32 envelopeHash,bytes32 runtimeId,bytes32 seasonId,uint64 deadline,
//     bytes32 achievementsHash)

export const ATTESTATION_DOMAIN_NAME = "Lester's Arcade Ranked Settlement";
export const ATTESTATION_DOMAIN_VERSION = '2';
export const ATTESTATION_TTL_SECONDS = 15 * 60;

export const VERIFIED_RUN_TYPES = Object.freeze({
  VerifiedRun: Object.freeze([
    { name: 'sessionId', type: 'bytes32' },
    { name: 'gameId', type: 'bytes32' },
    { name: 'player', type: 'address' },
    { name: 'score', type: 'uint256' },
    { name: 'kills', type: 'uint64' },
    { name: 'maxCombo', type: 'uint64' },
    { name: 'survivalSeconds', type: 'uint64' },
    { name: 'bossId', type: 'bytes32' },
    { name: 'envelopeHash', type: 'bytes32' },
    { name: 'runtimeId', type: 'bytes32' },
    { name: 'seasonId', type: 'bytes32' },
    { name: 'deadline', type: 'uint64' },
    { name: 'achievementsHash', type: 'bytes32' },
  ]),
});

// Same ceilings as the contract; anything above is rejected before signing.
export const VERIFIED_RUN_BOUNDS = Object.freeze({
  maxScore: 10_000_000_000n,
  maxKills: 100_000n,
  maxCombo: 10_000n,
  maxSurvivalSeconds: 24n * 60n * 60n,
  maxAchievements: 32,
});

const HEX32 = /^0x[0-9a-fA-F]{64}$/;
const ZERO32 = `0x${'0'.repeat(64)}`;

function bigint(value, name) {
  const parsed = typeof value === 'bigint' ? value : BigInt(Math.max(0, Math.round(Number(value) || 0)));
  if (parsed < 0n) throw new TypeError(`${name} must be non-negative`);
  return parsed;
}

export function attestationDomain({ chainId, verifyingContract }) {
  if (!Number.isInteger(Number(chainId)) || Number(chainId) <= 0) throw new TypeError('attestation chainId must be a positive integer');
  if (!/^0x[0-9a-fA-F]{40}$/.test(String(verifyingContract ?? ''))) throw new TypeError('attestation verifyingContract must be an address');
  return Object.freeze({
    name: ATTESTATION_DOMAIN_NAME,
    version: ATTESTATION_DOMAIN_VERSION,
    chainId: Number(chainId),
    verifyingContract,
  });
}

// keccak256(abi.encodePacked(bytes32[])) — what the contract recomputes from
// the achievements array it is handed.
export function achievementsHash(ethers, achievements32 = []) {
  const ids = achievements32.map((id) => {
    if (!HEX32.test(String(id))) throw new TypeError('achievement ids must be bytes32 hex');
    return String(id).toLowerCase();
  });
  if (ids.length > VERIFIED_RUN_BOUNDS.maxAchievements) throw new RangeError('too many achievements for one session');
  if (ids.length === 0) return ethers.keccak256('0x');
  return ethers.solidityPackedKeccak256(['bytes32[]'], [ids]);
}

// Canonical run struct with every field bounded and normalised. Ids that are
// not already bytes32 are hashed with ethers.id (the same rule the client uses
// for gameId/bossId/achievement ids).
export function buildVerifiedRun(ethers, {
  sessionId32,
  gameId,
  player,
  score,
  kills = 0,
  maxCombo = 0,
  survivalSeconds = 0,
  bossId = null,
  envelopeHash,
  runtimeId,
  seasonId,
  deadline,
  achievements = [],
} = {}) {
  if (!HEX32.test(String(sessionId32 ?? ''))) throw new TypeError('sessionId32 must be bytes32 hex');
  if (!ethers.isAddress(player)) throw new TypeError('player must be an address');
  if (!HEX32.test(String(envelopeHash ?? '')) || String(envelopeHash).toLowerCase() === ZERO32) throw new TypeError('envelopeHash must be a non-zero bytes32 hex');
  const id32 = (value) => (HEX32.test(String(value ?? '')) ? String(value).toLowerCase() : ethers.id(String(value ?? '')));
  const achievements32 = achievements.filter(Boolean).map(id32);
  const run = {
    sessionId: String(sessionId32).toLowerCase(),
    gameId: id32(gameId),
    player: ethers.getAddress(player),
    score: bigint(score, 'score'),
    kills: bigint(kills, 'kills'),
    maxCombo: bigint(maxCombo, 'maxCombo'),
    survivalSeconds: bigint(survivalSeconds, 'survivalSeconds'),
    bossId: bossId ? id32(bossId) : ZERO32,
    envelopeHash: String(envelopeHash).toLowerCase(),
    runtimeId: id32(runtimeId ?? ''),
    seasonId: id32(seasonId ?? ''),
    deadline: bigint(deadline, 'deadline'),
    achievementsHash: achievementsHash(ethers, achievements32),
  };
  if (run.score > VERIFIED_RUN_BOUNDS.maxScore) throw new RangeError('score exceeds the settlement ceiling');
  if (run.kills > VERIFIED_RUN_BOUNDS.maxKills) throw new RangeError('kills exceed the settlement ceiling');
  if (run.maxCombo > VERIFIED_RUN_BOUNDS.maxCombo) throw new RangeError('maxCombo exceeds the settlement ceiling');
  if (run.survivalSeconds > VERIFIED_RUN_BOUNDS.maxSurvivalSeconds) throw new RangeError('survivalSeconds exceeds the settlement ceiling');
  if (run.deadline === 0n) throw new RangeError('deadline is required');
  return Object.freeze({ run: Object.freeze(run), achievements32: Object.freeze(achievements32) });
}

export function attestationDigest(ethers, { domain, run }) {
  return ethers.TypedDataEncoder.hash(domain, VERIFIED_RUN_TYPES, run);
}

// Server side: sign with the verifier key. Returns the compact 65-byte
// signature the contract's ECDSA.recover expects.
export async function signAttestation(ethers, { signer, domain, run }) {
  if (typeof signer?.signTypedData !== 'function') throw new TypeError('signer must support signTypedData');
  const signature = await signer.signTypedData(domain, VERIFIED_RUN_TYPES, run);
  return Object.freeze({ signature, digest: attestationDigest(ethers, { domain, run }), deadline: run.deadline.toString() });
}

// Both sides: recover and compare against the trusted verifier address.
export function recoverAttestationSigner(ethers, { domain, run, signature }) {
  return ethers.verifyTypedData(domain, VERIFIED_RUN_TYPES, run, signature);
}

export function isAttestationValid(ethers, { domain, run, signature, trustedVerifier, nowSeconds = Math.floor(Date.now() / 1000) }) {
  try {
    if (BigInt(run.deadline) < BigInt(nowSeconds)) return false;
    return recoverAttestationSigner(ethers, { domain, run, signature }).toLowerCase() === String(trustedVerifier).toLowerCase();
  } catch {
    return false;
  }
}

// Wire shape between the browser and /api/attest. bigint fields travel as
// decimal strings; everything else is hex.
export function serializeVerifiedRun(run) {
  return Object.freeze({
    ...run,
    score: run.score.toString(),
    kills: run.kills.toString(),
    maxCombo: run.maxCombo.toString(),
    survivalSeconds: run.survivalSeconds.toString(),
    deadline: run.deadline.toString(),
  });
}

export function deserializeVerifiedRun(wire) {
  return Object.freeze({
    ...wire,
    score: BigInt(wire.score),
    kills: BigInt(wire.kills),
    maxCombo: BigInt(wire.maxCombo),
    survivalSeconds: BigInt(wire.survivalSeconds),
    deadline: BigInt(wire.deadline),
  });
}
