// /api/avatar — a signed-in wallet's own profile picture (1.9.3).
//
// GET/HEAD /api/avatar?wallet=0x…&v=<12 hex>  public: the image bytes
// PUT      /api/avatar  Bearer; JSON { image: <base64> }  store or replace
// DELETE   /api/avatar  Bearer                            remove
//
// The wallet always comes from the SIWE session token (api/session.mjs),
// never from the body. The browser re-encodes the picture to a 256×256 WebP
// (PNG fallback) before upload; the server still checks everything itself
// (server/profile/avatar-image.mjs): strict base64, at most 96 KB decoded,
// WebP/PNG/JPEG by magic bytes only, 64-512 px and square-ish, no animation.
// PUT and DELETE share one bucket per wallet (10 per hour).
//
// Every read path that returns a profile's avatar (E5 boards, E6 profiles,
// E9 sessions, the /s/ share page) adds `avatarUrl` =
// '/api/avatar?wallet=<wallet>&v=<first 12 hex of the SHA-256>' while a
// non-hidden upload exists, and clients prefer it over the on-chain preset
// (apps/portal/src/arcade-avatars.mjs resolveAvatar). A new upload is a new
// URL, so the image is cached for a year as immutable; a `v` that is not the
// current upload's answers 404 (briefly cached). The response carries no
// X-Robots-Tag: X's card fetcher skips images marked noindex.
//
// Moderation: avatar_uploads.hidden (owner only, migration 4 comment,
// scripts/moderate-profile.mjs --hide-avatar) and wallet_profiles.hidden both
// make GET answer 404 and drop avatarUrl everywhere.

import { logInternalError, makeHandler, queryOf, sendJson, verifyBearer } from '../server/http.mjs';
import { buildBaseDeps } from '../server/config.mjs';
import { ensureSchema } from '../server/neon/migrations.mjs';
import { deleteAvatarUpload, readAvatarUpload, writeAvatarUpload } from '../server/neon/queries.mjs';
import { hitRateLimit, rateLimitedResult } from '../server/neon/rate-limit.mjs';
import { AVATAR_MAX_BYTES, validateAvatarUpload } from '../server/profile/avatar-image.mjs';
import { customAvatarUrlFor } from '../apps/portal/src/arcade-avatars.mjs';

export const AVATAR_QUERY = Object.freeze({ GET: Object.freeze(['wallet', 'v']), HEAD: Object.freeze(['wallet', 'v']), PUT: Object.freeze([]), DELETE: Object.freeze([]) });
export const AVATAR_IMAGE_CACHE = 'public, max-age=31536000, immutable';
export const AVATAR_MISSING_CACHE = 'public, max-age=60, s-maxage=60';
// base64 of 96 KB is 131,072 characters; the JSON wrapper adds a few bytes.
export const AVATAR_PUT_MAX_BYTES = Math.ceil(AVATAR_MAX_BYTES / 3) * 4 + 1024;
export const AVATAR_WRITE_LIMITS = Object.freeze({ wallet: 10, windowSeconds: 3600 });
const WALLET = /^0x[0-9a-fA-F]{40}$/;
const VERSION = /^[0-9a-f]{12}$/;

const cache = {};

export async function buildDeps(env = process.env, overrides = {}) {
  return buildBaseDeps(env, overrides, cache);
}

const fail = (status, error, cacheControl = 'no-store') => ({ status, body: { ok: false, error }, headers: { 'Cache-Control': cacheControl } });
const nowOf = (deps) => (typeof deps.nowMs === 'function' ? deps.nowMs() : Date.now());

// Public read → { status, body: Buffer | null | JSON, headers }.
export async function readAvatarRequest({ method = 'GET', query = {} } = {}, deps = {}) {
  const wallet = String(query.wallet ?? '');
  if (!WALLET.test(wallet)) return fail(400, 'invalid-wallet');
  if (!VERSION.test(String(query.v ?? ''))) return fail(400, 'invalid-version');
  if (!deps.db) return fail(503, 'index-not-configured');
  await ensureSchema(deps.db);
  const upload = await readAvatarUpload(deps.db, wallet.toLowerCase());
  if (!upload || upload.sha256.slice(0, 12) !== query.v) return fail(404, 'avatar-not-found', AVATAR_MISSING_CACHE);
  const headers = {
    'Content-Type': upload.contentType,
    'Cache-Control': AVATAR_IMAGE_CACHE,
    'X-Content-Type-Options': 'nosniff',
    'Content-Length': String(upload.image.length),
  };
  return { status: 200, body: method === 'HEAD' ? null : upload.image, headers };
}

async function spendWriteBucket(deps, wallet) {
  const limit = await hitRateLimit(deps.db, { bucket: `avatar:w:${wallet}`, limit: AVATAR_WRITE_LIMITS.wallet, windowSeconds: AVATAR_WRITE_LIMITS.windowSeconds, nowMs: nowOf(deps) });
  return limit.ok ? null : rateLimitedResult(limit.retryAfterSeconds);
}

// Runs before the body is read: writes need a live session.
async function authorize(request, deps) {
  if (!deps.config.session.configured) return fail(503, 'session-not-configured');
  if (!verifyBearer(request.headers, deps)) return fail(401, 'invalid-session');
  return null;
}

export async function writeAvatarRequest({ method, headers = {}, body = null } = {}, deps) {
  const session = verifyBearer(headers, deps);
  if (!session) return fail(401, 'invalid-session');
  if (!deps.db) return fail(503, 'index-not-configured');
  if (method === 'PUT') {
    if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.image !== 'string') return fail(400, 'invalid-body');
    const extra = Object.keys(body).filter((key) => key !== 'image');
    if (extra.length) return fail(400, 'invalid-body');
    const checked = validateAvatarUpload(body.image);
    if (!checked.ok) return fail(checked.status, checked.error);
    await ensureSchema(deps.db);
    const limited = await spendWriteBucket(deps, session.wallet);
    if (limited) return limited;
    const saved = await writeAvatarUpload(deps.db, { wallet: session.wallet, ...checked, image: checked.bytes });
    if (!saved.saved) return fail(403, 'avatar-hidden');
    return { status: 200, body: { ok: true, wallet: session.wallet, avatarUrl: customAvatarUrlFor(session.wallet, saved.sha256), contentType: checked.contentType, width: checked.width, height: checked.height }, headers: { 'Cache-Control': 'no-store' } };
  }
  await ensureSchema(deps.db);
  const limited = await spendWriteBucket(deps, session.wallet);
  if (limited) return limited;
  const removed = await deleteAvatarUpload(deps.db, session.wallet);
  if (removed.hidden) return fail(403, 'avatar-hidden');
  return { status: 200, body: { ok: true, wallet: session.wallet, removed: removed.removed }, headers: { 'Cache-Control': 'no-store' } };
}

const writeAdapter = makeHandler({
  label: 'avatar',
  methods: ['PUT', 'DELETE'],
  query: AVATAR_QUERY,
  maxBytes: AVATAR_PUT_MAX_BYTES,
  auth: authorize,
  run: writeAvatarRequest,
});

// A30 seam. GET and HEAD answer image bytes (or a JSON error); PUT and DELETE
// go through the shared makeHandler adapter (Bearer before the body, the body
// cap, the declared query only).
export function createHandler(depsFactory) {
  if (typeof depsFactory !== 'function') throw new TypeError('createHandler needs a deps factory');
  const writes = writeAdapter(depsFactory);
  return async function handler(req, res) {
    const method = String(req?.method ?? 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') {
      if (method !== 'PUT' && method !== 'DELETE') {
        sendJson(res, 405, { ok: false, error: 'method-not-allowed' }, { headers: { Allow: 'GET, HEAD, PUT, DELETE' } });
        return;
      }
      await writes(req, res);
      return;
    }
    try {
      const checked = queryOf(req, AVATAR_QUERY[method]);
      if (!checked.ok) { sendJson(res, checked.status, { ok: false, error: checked.error }); return; }
      const deps = await depsFactory();
      const result = await readAvatarRequest({ method, query: checked.query }, deps);
      if (Buffer.isBuffer(result.body) || result.body === null) {
        res.statusCode = result.status;
        for (const [key, value] of Object.entries(result.headers ?? {})) res.setHeader(key, value);
        res.end(result.body === null ? undefined : result.body);
        return;
      }
      const { 'Cache-Control': cacheControl = 'no-store', ...headers } = result.headers ?? {};
      sendJson(res, result.status, result.body, { cache: cacheControl, headers });
    } catch (error) {
      logInternalError('avatar', error);
      sendJson(res, 500, { ok: false, error: 'internal-error' });
    }
  };
}

export default createHandler(() => buildDeps());
