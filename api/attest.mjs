// Ranked settlement verifier (Vercel Node function, owner direction
// 2026-09-16). Issues the EIP-712 VerifiedRun attestation that
// ScoreSubmissionRegistry.submitVerifiedSession requires.
//
// Fail-closed by design:
//   * no VERIFIER_PRIVATE_KEY / SCORE_REGISTRY_ADDRESS env  -> 503, no signature
//   * malformed or out-of-bounds run                        -> 400
//   * implausible run (HMH physical ceilings)                -> 422
//   * unknown game / wrong chain                             -> 400
//
// v1 scope: identity, bounds, envelope shape and HMH plausibility. Per-game
// deterministic replay on the server (Chikun v2 replay, STACKED evidence
// stream) is the next step and needs the evidence payloads uploaded here.
// The signing key never leaves this process; the browser only ever sees the
// signature and the deadline.

import { ethers } from 'ethers';
import { LITVM_LITEFORGE_NETWORK } from '../apps/portal/src/arcade-core.mjs';
import { validateRunPlausibility } from '../apps/portal/src/hmh-run-integrity.mjs';
import {
  ATTESTATION_TTL_SECONDS,
  attestationDomain,
  buildVerifiedRun,
  serializeVerifiedRun,
  signAttestation,
} from '../apps/portal/src/verifier-attestation.mjs';

const KNOWN_GAMES = new Set(['lester-blaster', 'chikun', 'stacked']);
const HEX32 = /^0x[0-9a-fA-F]{64}$/;
const MAX_BODY_BYTES = 16_384;

export function readVerifierConfig(env = process.env) {
  const privateKey = env.VERIFIER_PRIVATE_KEY ?? '';
  const verifyingContract = env.SCORE_REGISTRY_ADDRESS ?? '';
  const chainId = Number(env.LITVM_CHAIN_ID ?? LITVM_LITEFORGE_NETWORK.chainId);
  const configured = /^0x[0-9a-fA-F]{64}$/.test(privateKey) && /^0x[0-9a-fA-F]{40}$/.test(verifyingContract);
  return Object.freeze({ configured, privateKey, verifyingContract, chainId });
}

function fail(status, error, extra = {}) {
  return { status, body: { ok: false, error, ...extra } };
}

// Pure request handler so it can be unit-tested without HTTP.
export async function attestRequest(body, { env = process.env, now = () => Math.floor(Date.now() / 1000) } = {}) {
  const config = readVerifierConfig(env);
  if (!config.configured) return fail(503, 'verifier-not-configured', { detail: 'The attestation service has no signing key or contract address configured.' });
  if (!body || typeof body !== 'object') return fail(400, 'invalid-body');
  const {
    gameId, sessionId32, player, score, kills = 0, maxCombo = 0, survivalSeconds = 0, bossId = null,
    envelope, runtimeId, seasonId, achievements = [], level = 1,
  } = body;
  if (!KNOWN_GAMES.has(String(gameId))) return fail(400, 'unknown-game');
  if (!HEX32.test(String(sessionId32 ?? ''))) return fail(400, 'invalid-session');
  if (!ethers.isAddress(player)) return fail(400, 'invalid-player');
  if (!envelope || typeof envelope !== 'object') return fail(400, 'missing-envelope');
  if (envelope.version !== 'lesters-session-envelope-v1') return fail(400, 'unsupported-envelope-version');
  for (const field of ['inputHash', 'eventHash', 'finalStateHash', 'envelopeHash']) {
    if (!/^[0-9a-f]{64}$/i.test(String(envelope[field] ?? '').replace(/^0x/, ''))) return fail(400, `invalid-envelope-${field}`);
  }
  if (envelope.identity?.wallet && String(envelope.identity.wallet).toLowerCase() !== String(player).toLowerCase()) {
    return fail(400, 'envelope-wallet-mismatch');
  }
  if (!Array.isArray(achievements) || achievements.length > 32 || achievements.some((id) => typeof id !== 'string' || !id || id.length > 64)) {
    return fail(400, 'invalid-achievements');
  }
  if (gameId === 'lester-blaster') {
    const integrity = validateRunPlausibility({
      score: Number(score), kills: Number(kills), maxCombo: Number(maxCombo), survivalSeconds: Number(survivalSeconds),
      bossDefeated: Boolean(bossId), level: Number(level) || 1,
    });
    // The browser tolerates 'suspicious' for local preview; a trusted signature
    // does not. Only a clean verdict is attested.
    if (!integrity.rankable || integrity.verdict !== 'ok') return fail(422, 'implausible-run', { verdict: integrity.verdict, flags: integrity.flags });
  }
  const deadline = BigInt(now() + ATTESTATION_TTL_SECONDS);
  let built;
  try {
    built = buildVerifiedRun(ethers, {
      sessionId32, gameId, player, score, kills, maxCombo, survivalSeconds, bossId,
      envelopeHash: `0x${String(envelope.envelopeHash).replace(/^0x/, '')}`,
      runtimeId, seasonId, deadline, achievements,
    });
  } catch (error) {
    return fail(400, 'invalid-run', { detail: error.message });
  }
  const domain = attestationDomain({ chainId: config.chainId, verifyingContract: config.verifyingContract });
  const signer = new ethers.Wallet(config.privateKey);
  const attestation = await signAttestation(ethers, { signer, domain, run: built.run });
  return {
    status: 200,
    body: {
      ok: true,
      verifier: signer.address,
      domain,
      run: serializeVerifiedRun(built.run),
      achievements32: built.achievements32,
      signature: attestation.signature,
      digest: attestation.digest,
      deadline: attestation.deadline,
    },
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ ok: false, error: 'method-not-allowed' });
    return;
  }
  let body = req.body;
  if (typeof body === 'string') {
    if (body.length > MAX_BODY_BYTES) { res.status(413).json({ ok: false, error: 'body-too-large' }); return; }
    try { body = JSON.parse(body); } catch { res.status(400).json({ ok: false, error: 'invalid-json' }); return; }
  }
  const result = await attestRequest(body);
  res.setHeader('Cache-Control', 'no-store');
  res.status(result.status).json(result.body);
}
