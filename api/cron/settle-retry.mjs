// E13 GET /api/cron/settle-retry (Vercel Cron, every minute) — FAIL-CLOSED STUB.
//
// Created by the index slice in wave 1 so vercel.json can reference every
// function from day one (contract §4.2). It answers every method with
// 503 {ok:false, error:'not-implemented'} and touches nothing. The settle
// slice replaces this whole file, keeping the path, the default export, the
// pure settleRetryRequest export, buildDeps and createHandler (§10.4 rule 5, A30).

import { makeHandler } from '../../server/http.mjs';
import { buildBaseDeps } from '../../server/config.mjs';

const cache = {};

export async function buildDeps(env = process.env, overrides = {}) {
  return buildBaseDeps(env, overrides, cache);
}

export async function settleRetryRequest() {
  return { status: 503, body: { ok: false, error: 'not-implemented' }, headers: { 'Cache-Control': 'no-store' } };
}

const adapter = makeHandler({ label: 'cron/settle-retry', methods: null, query: null, run: settleRetryRequest });

export function createHandler(depsFactory) {
  return adapter(depsFactory);
}

export default createHandler(() => buildDeps());
