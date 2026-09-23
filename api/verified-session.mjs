// E9 GET /api/session/<shareId> → /api/verified-session?id=<shareId>
// (contract §4.3.8, §2.5, §7.5, A29).
//
// A pending run is not a verified public record and reads as 404. Rows in
// signed, submitted or failed are returned with their status; consumers must
// render them as unpublished. client_claim and plausibility never leave Neon.

import { makeHandler } from '../server/http.mjs';
import { buildBaseDeps } from '../server/config.mjs';
import { ensureSchema } from '../server/neon/migrations.mjs';
import { readPublicSession } from '../server/neon/queries.mjs';
import { normalizeSessionId32 } from '../server/neon/rows.mjs';

export const VERIFIED_SESSION_QUERY = Object.freeze(['id']);
export const CONFIRMED_SESSION_CACHE = 'public, s-maxage=300, stale-while-revalidate=86400';
export const UNPUBLISHED_SESSION_CACHE = 'public, s-maxage=5';
export const MISSING_SESSION_CACHE = 'public, s-maxage=30';

const cache = {};

export async function buildDeps(env = process.env, overrides = {}) {
  return buildBaseDeps(env, overrides, cache);
}

const fail = (status, error, cacheControl = 'no-store') => ({ status, body: { ok: false, error }, headers: { 'Cache-Control': cacheControl } });

export async function verifiedSessionRequest({ query = {} } = {}, deps) {
  const sessionId32 = normalizeSessionId32(query.id);
  if (!sessionId32) return fail(400, 'invalid-session-id');
  if (!deps.db) return fail(503, 'index-not-configured');
  await ensureSchema(deps.db);
  const session = await readPublicSession(deps.db, sessionId32);
  if (!session) return fail(404, 'session-not-found', MISSING_SESSION_CACHE);
  return {
    status: 200,
    body: { ok: true, session },
    headers: { 'Cache-Control': session.status === 'confirmed' ? CONFIRMED_SESSION_CACHE : UNPUBLISHED_SESSION_CACHE },
  };
}

const adapter = makeHandler({ label: 'verified-session', methods: ['GET'], query: VERIFIED_SESSION_QUERY, run: verifiedSessionRequest });

export function createHandler(depsFactory) {
  return adapter(depsFactory);
}

export default createHandler(() => buildDeps());
