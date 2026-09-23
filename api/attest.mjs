// E14 /api/attest — RETIRED (contract A3, §4.3.12).
//
// The 1.7.0 endpoint signed any posted score with the verifier key and no
// authentication. Every method now answers
// 410 { ok:false, error:'endpoint-retired', use:'/api/settle' }, reads no
// body, needs no environment and touches nothing. Signing lives only on the
// authenticated settle path (server/settle/attestation.mjs).

import { makeHandler } from '../server/http.mjs';

export const RETIRED_BODY = Object.freeze({ ok: false, error: 'endpoint-retired', use: '/api/settle' });

// Nothing to build: the endpoint depends on no environment variable.
export async function buildDeps() {
  return Object.freeze({ retired: true });
}

export async function attestRequest() {
  return { status: 410, body: { ...RETIRED_BODY }, headers: { 'Cache-Control': 'no-store' } };
}

const adapter = makeHandler({ label: 'attest', methods: null, query: null, run: attestRequest });

export function createHandler(depsFactory) {
  return adapter(depsFactory);
}

export default createHandler(() => buildDeps());
