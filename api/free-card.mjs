// E12 GET /api/free-card/<slug>/<token>.png → /api/free-card?game=<slug>&token=<token>
// (plan docs/handoffs/free-share-20260926.md §8; contract §4.3.9 addendum).
//
// Renders the 1200×630 PNG a Free share page's og:image points at, with
// @vercel/og ImageResponse (Satori + resvg, bundled Geist font, no network),
// purely from the token: there is no server record of a Free run and nothing
// is read from Neon.
// - Only `game` and `token` are accepted (else 400 invalid-query, no-store),
//   so query strings cannot bust the CDN cache and force renders.
// - The decoder is the exact gate: a slug outside the table is 400
//   invalid-game, anything else that does not decode canonically is 400
//   invalid-token; both are held a minute at the edge (the answer depends on
//   nothing but the URL) and never render or count.
// - A good URL is cached a day at the edge (an hour in browsers, stale a
//   week while revalidating); no cardRev, a layout change bumps the token
//   version instead.
// - Renders (never HEADs, 400s or CDN hits) count against
//   free-card:ip:<ipBucket>, 120 per hour, only when a database is
//   configured; without one the card still renders (the CDN absorbs
//   identical URLs) and the contract §13 WAF rule is the backstop.
// - Every file the card reads sits under apps/portal/assets/share-cards/,
//   the only directory vercel.json includeFiles adds to this function, and
//   is resolved per file from this module (never cwd, never a directory URL).

import { readFile } from 'node:fs/promises';
import { ImageResponse } from '@vercel/og';
import { clientIp, ipBucket, logInternalError, queryOf, sendJson } from '../server/http.mjs';
import { buildBaseDeps } from '../server/config.mjs';
import { ensureSchema } from '../server/neon/migrations.mjs';
import { hitRateLimit, rateLimitedResult } from '../server/neon/rate-limit.mjs';
import { FREE_SHARE_CACHE, FREE_SHARE_INVALID_CACHE, decodeFreeRun } from '../server/share/free-run.mjs';
import { buildFreeCardElement } from '../server/share/render-free-card.mjs';
import { SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH } from '../server/share/render-card.mjs';

export const FREE_CARD_QUERY = Object.freeze(['game', 'token']);
export const FREE_CARD_CACHE = FREE_SHARE_CACHE;
export const FREE_CARD_INVALID_CACHE = FREE_SHARE_INVALID_CACHE;
export const FREE_CARD_RENDER_LIMITS = Object.freeze({ ip: 120, windowSeconds: 3600 });
// Used only when SESSION_SECRET is absent (the render limit still applies).
const UNKEYED_IP_BUCKET_SALT = 'lestersarcade-ip-bucket-unkeyed';
const BACKGROUNDS = Object.freeze({
  'lester-blaster': new URL('../apps/portal/assets/share-cards/lester-blaster.png', import.meta.url),
  chikun: new URL('../apps/portal/assets/share-cards/chikun.png', import.meta.url),
  stacked: new URL('../apps/portal/assets/share-cards/stacked.png', import.meta.url),
});
// The four HMH heroes the token can name (FREE_SHARE_HEROES), cropped by
// scripts/build-share-card-backgrounds.py.
const PORTRAITS = Object.freeze({
  'lit-commando': new URL('../apps/portal/assets/share-cards/heroes/lit-commando.png', import.meta.url),
  'lit-valkyrie': new URL('../apps/portal/assets/share-cards/heroes/lit-valkyrie.png', import.meta.url),
  'lester-original': new URL('../apps/portal/assets/share-cards/heroes/lester-original.png', import.meta.url),
  lilly: new URL('../apps/portal/assets/share-cards/heroes/lilly.png', import.meta.url),
});

export function freeCardBackgroundUrl(gameId) {
  return typeof gameId === 'string' && Object.hasOwn(BACKGROUNDS, gameId) ? BACKGROUNDS[gameId] : null;
}

export function heroPortraitUrl(heroId) {
  return typeof heroId === 'string' && Object.hasOwn(PORTRAITS, heroId) ? PORTRAITS[heroId] : null;
}

const cache = {};
const images = new Map();

export async function buildDeps(env = process.env, overrides = {}) {
  return buildBaseDeps(env, overrides, cache);
}

const fail = (status, error, cacheControl = 'no-store') => ({ status, body: { ok: false, error }, headers: { 'Cache-Control': cacheControl } });

// A PNG as a data URI, memoized per process. A missing file reads as null:
// the card then omits the portrait or draws on its plain backdrop.
async function pngDataUri(url) {
  if (!url) return null;
  const key = url.href;
  if (!images.has(key)) {
    images.set(key, readFile(url).then((bytes) => `data:image/png;base64,${bytes.toString('base64')}`).catch(() => null));
  }
  return images.get(key);
}

export async function renderFreeCardPng(run) {
  const heroId = run?.gameId === 'lester-blaster' ? run.values?.hero : '';
  const [background, heroPortrait] = await Promise.all([pngDataUri(freeCardBackgroundUrl(run?.gameId)), pngDataUri(heroPortraitUrl(heroId))]);
  const element = buildFreeCardElement({ run, background, heroPortrait });
  const response = new ImageResponse(element, { width: SHARE_CARD_WIDTH, height: SHARE_CARD_HEIGHT });
  return Buffer.from(await response.arrayBuffer());
}

// Pure request → { status, body: PNG | JSON | null, headers }.
export async function freeCardRequest({ method = 'GET', query = {}, ip = 'unknown' } = {}, deps = {}) {
  const decoded = decodeFreeRun(query.game, query.token);
  if (!decoded.ok) return fail(400, decoded.error, FREE_CARD_INVALID_CACHE);
  const headers = { 'Content-Type': 'image/png', 'Cache-Control': FREE_CARD_CACHE, 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex' };
  if (method === 'HEAD') return { status: 200, body: null, headers };
  if (deps?.db) {
    await ensureSchema(deps.db);
    const secret = deps.config?.session?.configured ? deps.config.session.secret() : UNKEYED_IP_BUCKET_SALT;
    const nowMs = typeof deps.nowMs === 'function' ? deps.nowMs() : Date.now();
    const limit = await hitRateLimit(deps.db, { bucket: `free-card:ip:${ipBucket(ip, secret)}`, limit: FREE_CARD_RENDER_LIMITS.ip, windowSeconds: FREE_CARD_RENDER_LIMITS.windowSeconds, nowMs });
    if (!limit.ok) return rateLimitedResult(limit.retryAfterSeconds);
  }
  return { status: 200, body: await renderFreeCardPng(decoded.run), headers };
}

function logInternal(error) {
  // { name, code, sqlstate } only: messages can embed connection strings (§4.1).
  logInternalError('free-card', error);
}

// A30 seam. The adapter is E11's: GET and HEAD, the declared query only, the
// deps factory awaited before the token is judged, then a PNG or a JSON error.
export function createHandler(depsFactory) {
  if (typeof depsFactory !== 'function') throw new TypeError('createHandler needs a deps factory');
  return async function handler(req, res) {
    const method = String(req?.method ?? 'GET').toUpperCase();
    try {
      if (method !== 'GET' && method !== 'HEAD') {
        sendJson(res, 405, { ok: false, error: 'method-not-allowed' }, { headers: { Allow: 'GET, HEAD' } });
        return;
      }
      const checked = queryOf(req, FREE_CARD_QUERY);
      if (!checked.ok) { sendJson(res, checked.status, { ok: false, error: checked.error }); return; }
      const deps = await depsFactory();
      const result = await freeCardRequest({ method, query: checked.query, ip: clientIp(req) }, deps);
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
