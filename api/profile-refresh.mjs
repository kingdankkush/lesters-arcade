// E8 POST /api/profile/refresh?wallet=0x… (or body {wallet})
// → /api/profile-refresh (contract §4.3.7, A29, security review S5).
//
// Re-reads PlayerProfileRegistry.getProfile over the server's own RPC right
// after a rename confirms, sanitizes and moderates it, and upserts
// wallet_profiles. It never touches the owner flags hidden and
// board_excluded. Rate limits: a Bearer token for the same wallet spends
// that wallet's bucket; any other call spends only the caller's IP bucket,
// so nobody can exhaust a victim's refreshes.

import { ethers } from 'ethers';
import { ipBucket, makeHandler, verifyBearer } from '../server/http.mjs';
import { buildBaseDeps } from '../server/config.mjs';
import { PROFILE_REGISTRY_ABI } from '../server/chain/abis.mjs';
import { attachLazyProvider } from '../server/chain/public-rpc.mjs';
import { ensureSchema } from '../server/neon/migrations.mjs';
import { upsertWalletProfile } from '../server/neon/queries.mjs';
import { hitRateLimit, rateLimitedResult } from '../server/neon/rate-limit.mjs';
import { sanitizeOnchainProfile } from '../server/profile/sanitize.mjs';

export const PROFILE_REFRESH_QUERY = Object.freeze(['wallet']);
export const PROFILE_REFRESH_MAX_BYTES = 1024;
export const REFRESH_LIMITS = Object.freeze({ wallet: 30, ip: 60, windowSeconds: 3600 });
// Used only when SESSION_SECRET is absent (anonymous limits still apply).
const UNKEYED_IP_BUCKET_SALT = 'lestersarcade-ip-bucket-unkeyed';
const WALLET = /^0x[0-9a-fA-F]{40}$/;
const profileIface = new ethers.Interface(PROFILE_REGISTRY_ABI);

const cache = {};

export async function buildDeps(env = process.env, overrides = {}) {
  return attachLazyProvider(await buildBaseDeps(env, overrides, cache), overrides, cache);
}

const fail = (status, error) => ({ status, body: { ok: false, error }, headers: { 'Cache-Control': 'no-store' } });

async function readOnchainProfile(provider, registry, wallet) {
  const data = profileIface.encodeFunctionData('getProfile', [wallet]);
  const [raw, blockNumber] = await Promise.all([provider.call({ to: registry, data }), provider.getBlockNumber()]);
  const [profile] = profileIface.decodeFunctionResult('getProfile', raw);
  return { profile, blockNumber: Number(blockNumber) };
}

export async function profileRefreshRequest({ query = {}, headers = {}, body = null, ip = 'unknown' } = {}, deps) {
  const fromQuery = query.wallet;
  const fromBody = body && typeof body === 'object' && !Array.isArray(body) ? body.wallet : undefined;
  if (fromQuery !== undefined && fromBody !== undefined && String(fromQuery).toLowerCase() !== String(fromBody).toLowerCase()) return fail(400, 'invalid-wallet');
  const raw = String(fromQuery ?? fromBody ?? '');
  if (!WALLET.test(raw)) return fail(400, 'invalid-wallet');
  const wallet = raw.toLowerCase();
  if (!deps.db) return fail(503, 'index-not-configured');
  const registry = String(deps.deployment?.addresses?.playerProfileRegistry ?? '').toLowerCase();
  if (deps.deployment?.status !== 'deployed' || !WALLET.test(registry)) return fail(503, 'chain-not-configured');
  await ensureSchema(deps.db);

  const session = verifyBearer(headers, deps);
  const ownWallet = session?.wallet === wallet;
  const bucket = ownWallet
    ? `refresh:w:${wallet}`
    : `refresh:ip:${ipBucket(ip, deps.config.session.configured ? deps.config.session.secret() : UNKEYED_IP_BUCKET_SALT)}`;
  const limit = await hitRateLimit(deps.db, { bucket, limit: ownWallet ? REFRESH_LIMITS.wallet : REFRESH_LIMITS.ip, windowSeconds: REFRESH_LIMITS.windowSeconds, nowMs: deps.nowMs() });
  if (!limit.ok) return rateLimitedResult(limit.retryAfterSeconds);

  let onchain;
  try {
    onchain = await readOnchainProfile(deps.provider, registry, wallet);
  } catch {
    return { status: 502, body: { ok: false, error: 'chain-read-failed', retryable: true, retryAfterMs: 5000 }, headers: { 'Cache-Control': 'no-store' } };
  }
  const clean = sanitizeOnchainProfile(onchain.profile);
  const lastUpdated = Number(onchain.profile?.lastUpdated ?? 0);
  const display = await upsertWalletProfile(deps.db, {
    wallet,
    ...clean,
    profileBlock: onchain.blockNumber,
    onchainUpdatedAt: lastUpdated > 0 ? new Date(lastUpdated * 1000).toISOString() : null,
  });
  return { status: 200, body: { ok: true, wallet, profile: display }, headers: { 'Cache-Control': 'no-store' } };
}

const adapter = makeHandler({
  label: 'profile-refresh',
  methods: ['POST'],
  query: PROFILE_REFRESH_QUERY,
  maxBytes: PROFILE_REFRESH_MAX_BYTES,
  run: profileRefreshRequest,
});

export function createHandler(depsFactory) {
  return adapter(depsFactory);
}

export default createHandler(() => buildDeps());
