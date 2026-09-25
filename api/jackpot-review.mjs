// GET /api/jackpot/review?week=YYYY-Www → /api/jackpot-review (design §C.6).
//
// The owner's review data for one week. Gates, before anything is read:
//   1. a valid Bearer session (bearerAuthHook; 401, or 503 without SESSION_SECRET);
//   2. the session wallet equals the LIVE on-chain admin() of the active
//      instance (one eth_call, cached in memory for 60 s, so after an
//      emergency forceAdmin the old admin loses access within a minute
//      without a redeploy) and, when JACKPOT_ADMIN_WALLET is set, that wallet
//      too (an extra constraint, never the only gate) → else 403 not-admin.
// Cache-Control: no-store. There are no owner write endpoints: every decision
// is an on-chain transaction from the admin wallet.
//
// The function is configured with maxDuration 30, memory 1024 and the
// obstacle shapes in includeFiles (vercel.json): a timeline the cron has not
// stored yet is replayed here.
// Test seam: buildDeps accepts jackpotDeployment next to the A30 overrides.

import { bearerAuthHook, authenticateBearer } from '../server/auth/bearer.mjs';
import { makeHandler } from '../server/http.mjs';
import { buildBaseDeps } from '../server/config.mjs';
import { attachLazyProvider } from '../server/chain/public-rpc.mjs';
import { ensureSchema } from '../server/neon/migrations.mjs';
import { createJackpotChain } from '../server/jackpot/chain.mjs';
import { jackpotInstances } from '../server/jackpot/indexer.mjs';
import { jackpotReviewBody, liveAdmin } from '../server/jackpot/review-model.mjs';
import { weekIndexOfKey } from '../server/jackpot/weeks.mjs';

export const REVIEW_QUERY = Object.freeze(['week']);
const cache = {};
const noStore = (status, body) => ({ status, body, headers: { 'Cache-Control': 'no-store' } });

export async function buildDeps(env = process.env, overrides = {}) {
  return attachLazyProvider(await buildBaseDeps(env, overrides, cache), overrides, cache);
}

function chainFor(deps) {
  const instance = jackpotInstances(deps.config.jackpot.deployment)[0];
  if (!instance) return null;
  return createJackpotChain({ provider: () => deps.provider, contract: instance.contract, deployment: deps.deployment });
}

// The admin gate (after the Bearer hook). → null | an error result
export async function reviewAdminGate(request, deps) {
  const auth = authenticateBearer(request.headers, deps);
  if (!auth.ok) return noStore(auth.status, { ok: false, error: auth.error });
  const jackpot = deps.config.jackpot;
  if (!jackpot.ready) return noStore(503, { ok: false, error: 'jackpot-not-configured' });
  if (jackpot.adminWallet.invalid || (jackpot.adminWallet.address && jackpot.adminWallet.address !== auth.wallet)) return noStore(403, { ok: false, error: 'not-admin' });
  const chain = chainFor(deps);
  let admin;
  try {
    admin = await liveAdmin(chain, { nowMs: deps.nowMs() });
  } catch {
    return noStore(503, { ok: false, error: 'chain-read-failed', retryable: true });
  }
  if (admin !== auth.wallet) return noStore(403, { ok: false, error: 'not-admin' });
  return null;
}

export async function jackpotReviewRequest(request = {}, deps) {
  const denied = await reviewAdminGate(request, deps);
  if (denied) return denied;
  const weekKey = String(request.query?.week ?? '');
  if (weekIndexOfKey(weekKey) === null) return noStore(400, { ok: false, error: 'invalid-query' });
  if (!deps.db) return noStore(503, { ok: false, error: 'index-not-configured' });
  await ensureSchema(deps.db);
  const body = await jackpotReviewBody(deps.db, { config: deps.config, deployment: deps.deployment, weekKey, chain: chainFor(deps), nowMs: deps.nowMs() });
  if (!body) return noStore(404, { ok: false, error: 'not-found' });
  return noStore(200, body);
}

const bearer = bearerAuthHook();
const adapter = makeHandler({ label: 'jackpot-review', methods: ['GET'], query: REVIEW_QUERY, auth: (request, deps) => bearer(request, deps), run: jackpotReviewRequest });

export function createHandler(depsFactory) {
  return adapter(depsFactory);
}

export default createHandler(() => buildDeps());
