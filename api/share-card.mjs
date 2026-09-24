// E11 GET /api/share-card/<shareId>.png?v=<cardRev> → /api/share-card?id=<shareId>&v=<cardRev>
// (contract §4.2, §4.3.9, §7.5, A5, A29, A30; security review S6, S13, S14).
//
// Renders the 1200×630 PNG a share page's og:image points at, with
// @vercel/og ImageResponse (Satori + resvg, bundled Geist font, no network).
// - Only `id` and `v` are accepted (else 400), so query strings cannot bust
//   the CDN cache and force renders.
// - `v` is the card revision (E9 cardRev). A different `v` answers 302 to the
//   current versioned URL (Cache-Control: public, s-maxage=60) instead of
//   rendering; a missing `v` renders the current revision.
// - Renders (never redirects, 404s or CDN hits) count against
//   card:ip:<ipBucket>, 120 per hour.
// - "Verified on LitVM" only for a confirmed session; confirmed cards are
//   cached for an hour at the edge but never `immutable` (a rename, hide or
//   confirmation changes cardRev, and so the URL).

import { readFile } from 'node:fs/promises';
import { ImageResponse } from '@vercel/og';
import { clientIp, ipBucket, logInternalError, queryOf, sendJson } from '../server/http.mjs';
import { buildBaseDeps } from '../server/config.mjs';
import { ensureSchema } from '../server/neon/migrations.mjs';
import { readPublicSession } from '../server/neon/queries.mjs';
import { hitRateLimit, rateLimitedResult } from '../server/neon/rate-limit.mjs';
import { normalizeSessionId32 } from '../server/neon/rows.mjs';
import { SHARE_CARD_HEIGHT, SHARE_CARD_MAX_BADGES, SHARE_CARD_WIDTH, buildShareCardElement } from '../server/share/render-card.mjs';
import { achievementById } from '../apps/portal/src/achievements/index.mjs';

export const SHARE_CARD_QUERY = Object.freeze(['id', 'v']);
export const CONFIRMED_CARD_CACHE = 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400';
export const UNPUBLISHED_CARD_CACHE = 'public, max-age=0, s-maxage=30';
export const MISSING_CARD_CACHE = 'public, s-maxage=30';
export const STALE_CARD_REDIRECT_CACHE = 'public, s-maxage=60';
export const CARD_RENDER_LIMITS = Object.freeze({ ip: 120, windowSeconds: 3600 });
// Used only when SESSION_SECRET is absent (the render limit still applies).
const UNKEYED_IP_BUCKET_SALT = 'lestersarcade-ip-bucket-unkeyed';
const CARD_REV = /^[0-9a-f]{12}$/;
// Every file the card reads sits under apps/portal/assets/share-cards/, the
// only directory vercel.json includeFiles adds to this function, and is
// resolved per file from this module (never cwd, never a directory-level
// URL, which the file tracer would copy whole). The badges are byte copies
// of the catalog art, written by scripts/build-share-card-backgrounds.py.
const BACKGROUNDS = Object.freeze({
  'lester-blaster': new URL('../apps/portal/assets/share-cards/lester-blaster.png', import.meta.url),
  chikun: new URL('../apps/portal/assets/share-cards/chikun.png', import.meta.url),
  stacked: new URL('../apps/portal/assets/share-cards/stacked.png', import.meta.url),
});
const CATALOG_BADGE = /^\/assets\/generated\/((?:[a-z0-9_-]+\/)*[a-z0-9_-][a-z0-9._-]*\.png)$/;

export function shareCardBackgroundUrl(gameId) {
  return Object.hasOwn(BACKGROUNDS, gameId) ? BACKGROUNDS[gameId] : null;
}

// Catalog image `/assets/generated/<path>.png` → its copy under share-cards/badges/.
export function shareCardBadgeUrl(image) {
  const match = CATALOG_BADGE.exec(String(image ?? ''));
  return match ? new URL(`../apps/portal/assets/share-cards/badges/${match[1]}`, import.meta.url) : null;
}

const cache = {};
const images = new Map();

export async function buildDeps(env = process.env, overrides = {}) {
  return buildBaseDeps(env, overrides, cache);
}

const fail = (status, error, cacheControl = 'no-store') => ({ status, body: { ok: false, error }, headers: { 'Cache-Control': cacheControl } });

export function shareCardPath(shareId, cardRev) {
  return `/api/share-card/${shareId}.png?v=${cardRev}`;
}

// A PNG as a data URI, memoized per process. A missing file (an out-of-date
// badge copy, an unknown game) reads as null: the card then draws a tier
// medallion or its plain backdrop instead.
async function pngDataUri(url) {
  if (!url) return null;
  const key = url.href;
  if (!images.has(key)) {
    images.set(key, readFile(url).then((bytes) => `data:image/png;base64,${bytes.toString('base64')}`).catch(() => null));
  }
  return images.get(key);
}

// { [achievementId]: data URI } for the first four achievements (the ones
// the card draws) that have catalog art.
export async function readShareCardBadges(session) {
  const out = {};
  for (const item of (session?.achievements ?? []).slice(0, SHARE_CARD_MAX_BADGES)) {
    let entry = null;
    try { entry = achievementById(session.gameId, item?.id); } catch { entry = null; }
    const uri = await pngDataUri(shareCardBadgeUrl(entry?.image));
    if (uri) out[item.id] = uri;
  }
  return out;
}

export async function renderShareCardPng(session) {
  const [background, badgeImages] = await Promise.all([
    pngDataUri(shareCardBackgroundUrl(session.gameId)),
    readShareCardBadges(session),
  ]);
  const element = buildShareCardElement({ session, background, badgeImages });
  const response = new ImageResponse(element, { width: SHARE_CARD_WIDTH, height: SHARE_CARD_HEIGHT });
  return Buffer.from(await response.arrayBuffer());
}

export async function shareCardRequest({ method = 'GET', query = {}, ip = 'unknown' } = {}, deps) {
  const sessionId32 = normalizeSessionId32(query.id);
  if (!sessionId32) return fail(400, 'invalid-session-id');
  if (!deps.db) return fail(503, 'index-not-configured');
  await ensureSchema(deps.db);
  const session = await readPublicSession(deps.db, sessionId32);
  if (!session) return fail(404, 'session-not-found', MISSING_CARD_CACHE);
  const current = String(session.cardRev ?? '');
  if (query.v !== undefined && query.v !== current && CARD_REV.test(current)) {
    return { status: 302, body: null, headers: { Location: shareCardPath(session.shareId, current), 'Cache-Control': STALE_CARD_REDIRECT_CACHE } };
  }
  const cacheControl = session.status === 'confirmed' ? CONFIRMED_CARD_CACHE : UNPUBLISHED_CARD_CACHE;
  const headers = { 'Content-Type': 'image/png', 'Cache-Control': cacheControl, 'X-Content-Type-Options': 'nosniff' };
  if (method === 'HEAD') return { status: 200, body: null, headers };
  const secret = deps.config?.session?.configured ? deps.config.session.secret() : UNKEYED_IP_BUCKET_SALT;
  const limit = await hitRateLimit(deps.db, { bucket: `card:ip:${ipBucket(ip, secret)}`, limit: CARD_RENDER_LIMITS.ip, windowSeconds: CARD_RENDER_LIMITS.windowSeconds, nowMs: deps.nowMs() });
  if (!limit.ok) return rateLimitedResult(limit.retryAfterSeconds);
  return { status: 200, body: await renderShareCardPng(session), headers };
}

function logInternal(error) {
  // { name, code, sqlstate } only: messages can embed connection strings (§4.1).
  logInternalError('share-card', error);
}

// A30 seam. The adapter is the E11 one: GET and HEAD, the declared query
// only, then a PNG, a redirect or a JSON error.
export function createHandler(depsFactory) {
  if (typeof depsFactory !== 'function') throw new TypeError('createHandler needs a deps factory');
  return async function handler(req, res) {
    const method = String(req?.method ?? 'GET').toUpperCase();
    try {
      if (method !== 'GET' && method !== 'HEAD') {
        sendJson(res, 405, { ok: false, error: 'method-not-allowed' }, { headers: { Allow: 'GET, HEAD' } });
        return;
      }
      const checked = queryOf(req, SHARE_CARD_QUERY);
      if (!checked.ok) { sendJson(res, checked.status, { ok: false, error: checked.error }); return; }
      const deps = await depsFactory();
      const result = await shareCardRequest({ method, query: checked.query, ip: clientIp(req) }, deps);
      if (Buffer.isBuffer(result.body) || result.body === null) {
        res.statusCode = result.status;
        for (const [key, value] of Object.entries(result.headers ?? {})) res.setHeader(key, value);
        if (Buffer.isBuffer(result.body)) res.setHeader('Content-Length', String(result.body.length));
        res.end(method === 'HEAD' || result.body === null ? undefined : result.body);
        return;
      }
      const { 'Cache-Control': cacheControl = 'no-store', ...headers } = result.headers ?? {};
      sendJson(res, result.status, result.body, { cache: cacheControl, headers });
    } catch (error) {
      logInternal(error);
      sendJson(res, 500, { ok: false, error: 'internal-error' });
    }
  };
}

export default createHandler(() => buildDeps());
