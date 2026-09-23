// E6 / E6s / E7 /api/profile (contract §4.3.6, A29, A34, D3).
//
// GET  /api/profile?wallet=0x…          public, server-derived, CDN-cached
// GET  /api/profile?wallet=0x…&self=1   the wallet's own view: Bearer for the
//                                       same wallet, always private, no-store
// PUT  /api/profile                     Bearer; preferences only
//
// Names and avatars come only from PlayerProfileRegistry (mirrored by E8 and
// the E12 indexer); stats, runs and achievements come only from verified
// sessions. The browser never writes any of them.

import { makeHandler, verifyBearer } from '../server/http.mjs';
import { buildBaseDeps } from '../server/config.mjs';
import { ensureSchema } from '../server/neon/migrations.mjs';
import { readPublicProfile, writePreferences } from '../server/neon/queries.mjs';
import { sanitizePreferences } from '../server/profile/sanitize.mjs';

export const PROFILE_QUERY = Object.freeze({ GET: Object.freeze(['wallet', 'self']), PUT: Object.freeze([]) });
export const PUBLIC_PROFILE_CACHE = 'public, s-maxage=10, stale-while-revalidate=30';
export const SELF_PROFILE_CACHE = 'private, no-store';
export const PROFILE_PUT_MAX_BYTES = 4096;
const WALLET = /^0x[0-9a-fA-F]{40}$/;

const cache = {};

export async function buildDeps(env = process.env, overrides = {}) {
  return buildBaseDeps(env, overrides, cache);
}

const result = (status, body, cacheControl = 'no-store') => ({ status, body, headers: { 'Cache-Control': cacheControl } });
const fail = (status, error, cacheControl = 'no-store') => result(status, { ok: false, error }, cacheControl);

function isSelfView(query) {
  return query.self !== undefined;
}

// Runs before the body is read (A30): E7 and the self view need a Bearer.
async function authorize(request, deps) {
  if (request.method === 'PUT') {
    if (!deps.config.session.configured) return fail(503, 'session-not-configured');
    if (!verifyBearer(request.headers, deps)) return fail(401, 'invalid-session');
  }
  if (request.method === 'GET' && isSelfView(request.query) && !verifyBearer(request.headers, deps)) {
    return fail(401, 'invalid-session', SELF_PROFILE_CACHE);
  }
  return null;
}

async function readProfile({ query = {}, headers = {} }, deps) {
  const rawWallet = String(query.wallet ?? '');
  const self = isSelfView(query);
  const errorCache = self ? SELF_PROFILE_CACHE : 'no-store';
  if (!WALLET.test(rawWallet)) return fail(400, 'invalid-wallet', errorCache);
  const wallet = rawWallet.toLowerCase();
  if (self) {
    if (query.self !== '1') return fail(400, 'invalid-query', SELF_PROFILE_CACHE);
    const session = verifyBearer(headers, deps);
    if (!session || session.wallet !== wallet) return fail(401, 'invalid-session', SELF_PROFILE_CACHE);
  }
  if (!deps.db) return fail(503, 'index-not-configured', errorCache);
  await ensureSchema(deps.db);
  const profile = await readPublicProfile(deps.db, wallet, { self, nowMs: deps.nowMs() });
  return result(200, profile, self ? SELF_PROFILE_CACHE : PUBLIC_PROFILE_CACHE);
}

async function writeProfilePreferences({ headers = {}, body = null }, deps) {
  if (!deps.config.session.configured) return fail(503, 'session-not-configured');
  const session = verifyBearer(headers, deps);
  if (!session) return fail(401, 'invalid-session');
  if (!body || typeof body !== 'object' || Array.isArray(body)) return fail(400, 'invalid-body');
  const preferences = sanitizePreferences(body.preferences);
  if (!preferences) return fail(400, 'invalid-body');
  if (!deps.db) return fail(503, 'index-not-configured');
  await ensureSchema(deps.db);
  const saved = await writePreferences(deps.db, session.wallet, preferences);
  return result(200, { ok: true, wallet: session.wallet, preferences: saved.preferences, updatedAt: saved.updatedAt });
}

// The pure request function (kept under its historical name).
export async function profileRequest(request = {}, deps) {
  const method = String(request.method ?? 'GET').toUpperCase();
  if (method === 'GET') return readProfile(request, deps);
  if (method === 'PUT') return writeProfilePreferences(request, deps);
  return { status: 405, body: { ok: false, error: 'method-not-allowed' }, headers: { 'Cache-Control': 'no-store', Allow: 'GET, PUT' } };
}

const adapter = makeHandler({
  label: 'profile',
  methods: ['GET', 'PUT'],
  query: PROFILE_QUERY,
  maxBytes: PROFILE_PUT_MAX_BYTES,
  auth: authorize,
  run: profileRequest,
});

export function createHandler(depsFactory) {
  return adapter(depsFactory);
}

export default createHandler(() => buildDeps());
