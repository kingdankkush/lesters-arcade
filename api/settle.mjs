// E3 POST /api/settle (contract §4.3.3, A30).
//
// The authenticated, idempotent, nonce-safe settlement of a paid Ranked run:
// Bearer, SETTLEMENT_PAUSED and the fail-closed config (all checked before
// the body is read, so a paused service answers 503 whatever the body), the
// 1,800,000-byte body cap, per-wallet and per-IP
// limits, identity and seed-ticket binding, the paid-entry check over the
// server's own RPC, ticket freshness, history and the HMH hero gate, server
// verification, run timing, achievement derivation, the Neon insert, the
// EIP-712 attestation and the relayed submission through the lease. The
// pipeline lives in server/settle/settle-core.mjs.
//
// buildDeps resolves the verify slice (server/verify/index.mjs) and the
// achievements registry at request time; while either is missing the
// endpoint answers 503 settlement-not-configured. The relayer wallet and the
// verifier signer are created only after the config checks pass (A28).

import { makeHandler } from '../server/http.mjs';
import { buildBaseDeps } from '../server/config.mjs';
import { attachLazyProvider } from '../server/chain/public-rpc.mjs';
import { attachSettleDeps, SETTLE_BODY_MAX_BYTES, settleAuthHook, settleRequest } from '../server/settle/settle-core.mjs';

export { settleRequest };

const cache = {};

export async function buildDeps(env = process.env, overrides = {}) {
  const base = attachLazyProvider(await buildBaseDeps(env, overrides, cache), overrides, cache);
  return attachSettleDeps(base, { env });
}

const adapter = makeHandler({
  label: 'settle',
  methods: ['POST'],
  query: [],
  maxBytes: SETTLE_BODY_MAX_BYTES,
  // Bearer, SETTLEMENT_PAUSED, config and modules, before the body is read.
  auth: settleAuthHook(),
  run: settleRequest,
});

export function createHandler(depsFactory) {
  return adapter(depsFactory);
}

export default createHandler(() => buildDeps());
