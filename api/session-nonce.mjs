// E1 GET /api/session/nonce → /api/session-nonce — FAIL-CLOSED STUB.
//
// Created by the index slice in wave 1 so vercel.json can reference every
// function from day one (contract §4.2). It answers every method with
// 503 {ok:false, error:'not-implemented'} and touches nothing. The settle
// slice replaces this whole file, keeping the path, the default export, the
// pure sessionNonceRequest export, buildDeps and createHandler (§10.4 rule 5, A30).

import { makeHandler } from '../server/http.mjs';
import { buildBaseDeps } from '../server/config.mjs';

const cache = {};

export async function buildDeps(env = process.env, overrides = {}) {
  return buildBaseDeps(env, overrides, cache);
}

export async function sessionNonceRequest() {
  return { status: 503, body: { ok: false, error: 'not-implemented' }, headers: { 'Cache-Control': 'no-store' } };
}

const adapter = makeHandler({ label: 'session-nonce', methods: null, query: null, run: sessionNonceRequest });

export function createHandler(depsFactory) {
  return adapter(depsFactory);
}

export default createHandler(() => buildDeps());
