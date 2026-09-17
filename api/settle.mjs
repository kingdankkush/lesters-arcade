// Relayed Ranked settlement (owner decision 2026-09-16): the player paid the
// flat fee plus a settlement gas reserve at entry, so the score is submitted
// FOR them by a relayer funded from that reserve. One call: verify and sign
// the run (same rules as /api/attest), then, when a relayer key and RPC are
// configured, broadcast ScoreSubmissionRegistry.submitVerifiedSession from
// the relayer and return the transaction hash. Without a relayer key the
// response carries only the attestation and the browser falls back to a
// player-signed submit. Fails closed on every missing piece.

import { ethers } from 'ethers';
import { attestRequest, readVerifierConfig } from './attest.mjs';
import { LITVM_LITEFORGE_NETWORK } from '../apps/portal/src/arcade-core.mjs';
import { deserializeVerifiedRun } from '../apps/portal/src/verifier-attestation.mjs';

const SUBMIT_ABI = [
  'function submitVerifiedSession((bytes32 sessionId, bytes32 gameId, address player, uint256 score, uint64 kills, uint64 maxCombo, uint64 survivalSeconds, bytes32 bossId, bytes32 envelopeHash, bytes32 runtimeId, bytes32 seasonId, uint64 deadline, bytes32 achievementsHash) run, bytes32[] achievements, bytes signature) external',
  'function getSession(bytes32 sessionId) external view returns (tuple(bytes32 sessionId, address player, bytes32 gameId, uint256 score, uint64 kills, uint64 maxCombo, uint64 survivalSeconds, bytes32 bossId, bytes32 runtimeId, bytes32 seasonId, uint64 submittedAt, bool verified, bool exists))',
  'function relayers(address) view returns (bool)',
];

export function readRelayerConfig(env = process.env) {
  const privateKey = env.RELAYER_PRIVATE_KEY ?? '';
  const rpcUrl = env.RPC_URL ?? LITVM_LITEFORGE_NETWORK.rpcUrls.http;
  return Object.freeze({ configured: /^0x[0-9a-fA-F]{64}$/.test(privateKey), privateKey, rpcUrl, chainId: Number(env.LITVM_CHAIN_ID ?? LITVM_LITEFORGE_NETWORK.chainId) });
}

export async function settleRequest(body, { env = process.env, now = () => Math.floor(Date.now() / 1000), providerFactory = null } = {}) {
  const attested = await attestRequest(body, { env, now });
  if (attested.status !== 200) return attested;
  const relayer = readRelayerConfig(env);
  if (!relayer.configured) return { status: 200, body: { ...attested.body, relayed: false, txHash: null, note: 'No relayer configured; submit the attestation from the player wallet.' } };
  const verifierConfig = readVerifierConfig(env);
  try {
    const provider = providerFactory ? providerFactory(relayer) : new ethers.JsonRpcProvider(relayer.rpcUrl, relayer.chainId);
    const signer = new ethers.Wallet(relayer.privateKey, provider);
    const registry = new ethers.Contract(verifierConfig.verifyingContract, SUBMIT_ABI, signer);
    const run = deserializeVerifiedRun(attested.body.run);
    const existing = await registry.getSession(run.sessionId);
    if (existing?.exists) return { status: 409, body: { ok: false, error: 'session-already-settled', txHash: null } };
    if (!(await registry.relayers(signer.address))) return { status: 503, body: { ok: false, error: 'relayer-not-allowed', relayer: signer.address } };
    const tx = await registry.submitVerifiedSession(run, [...attested.body.achievements32], attested.body.signature);
    const receipt = await tx.wait();
    return { status: 200, body: { ...attested.body, relayed: true, relayer: signer.address, txHash: tx.hash, blockNumber: receipt?.blockNumber ?? null } };
  } catch (error) {
    return { status: 502, body: { ok: false, error: 'relay-failed', detail: String(error?.shortMessage ?? error?.message ?? error).slice(0, 240), attestation: { signature: attested.body.signature, deadline: attested.body.deadline, run: attested.body.run, achievements32: attested.body.achievements32, domain: attested.body.domain } } };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); res.status(405).json({ ok: false, error: 'method-not-allowed' }); return; }
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { res.status(400).json({ ok: false, error: 'invalid-json' }); return; } }
  const result = await settleRequest(body);
  res.setHeader('Cache-Control', 'no-store');
  res.status(result.status).json(result.body);
}
