// E13 GET /f/<slug>/<token> → /api/free-share-page?game=<slug>&token=<token>
// (plan docs/handoffs/free-share-20260926.md §8; contract §4.3.9 addendum).
//
// Server-renders the public page of one Free run with its OG and Twitter
// tags, purely from the token: nothing is read from Neon and the function
// works with no environment at all. Only `game` and `token` are meaningful:
// - the pair decodes and nothing else is in the query → 200, cached like the
//   card (the URL fully determines the page);
// - the pair decodes but other keys ride along (Facebook's fbclid, utm_*, a
//   repeated identical key) → 302 to the canonical /f/<slug>/<token>, built
//   only from the validated slug and the canonical token, so a human
//   click-through survives tagging while the CDN key never splits and no
//   render happens;
// - a missing, conflicting or undecodable pair → the 400 page with generic
//   tags, held a minute at the edge (deterministic); 405 and 500 are no-store.

import { logInternalError } from '../server/http.mjs';
import { buildBaseDeps } from '../server/config.mjs';
import { FREE_SHARE_CACHE, FREE_SHARE_INVALID_CACHE, decodeFreeRun } from '../server/share/free-run.mjs';
import { renderFreeSharePage } from '../server/share/render-free-page.mjs';

export const FREE_PAGE_QUERY = Object.freeze(['game', 'token']);
export const FREE_PAGE_CACHE = FREE_SHARE_CACHE;
export const FREE_PAGE_INVALID_CACHE = FREE_SHARE_INVALID_CACHE;
export const FREE_PAGE_REDIRECT_CACHE = 'public, s-maxage=3600';

const cache = {};

export async function buildDeps(env = process.env, overrides = {}) {
  return buildBaseDeps(env, overrides, cache);
}

function rawQuery(req) {
  if (req?.query && typeof req.query === 'object') {
    return Object.entries(req.query).flatMap(([key, value]) => (Array.isArray(value) ? value.map((item) => [key, String(item)]) : [[key, String(value ?? '')]]));
  }
  const url = new URL(String(req?.url ?? '/'), 'http://local');
  return [...url.searchParams];
}

// The declared pair and whether anything else rode along. A repeated key is
// tolerated only when every copy carries the same value; a conflict is null.
export function readPair(req) {
  const pair = {};
  let extra = false;
  for (const [key, value] of rawQuery(req)) {
    if (!FREE_PAGE_QUERY.includes(key)) { extra = true; continue; }
    if (Object.hasOwn(pair, key) && pair[key] !== value) return null;
    pair[key] = value;
  }
  return { game: pair.game, token: pair.token, extra };
}

// Pure request → { status, body: html | '', headers }. `canonical` is true
// when undeclared keys were present: a decodable pair then redirects.
export async function freeSharePageRequest({ method = 'GET', query = {}, canonical = false } = {}) {
  const decoded = decodeFreeRun(query.game, query.token);
  if (!decoded.ok) {
    const page = renderFreeSharePage({ run: null, status: 400 });
    return { status: page.status, body: page.html, headers: page.headers };
  }
  if (canonical) {
    return { status: 302, body: '', headers: { Location: `/f/${decoded.run.slug}/${decoded.run.token}`, 'Cache-Control': FREE_PAGE_REDIRECT_CACHE, 'X-Robots-Tag': 'noindex' } };
  }
  const page = renderFreeSharePage({ run: decoded.run, status: 200 });
  return { status: page.status, body: method === 'HEAD' ? '' : page.html, headers: page.headers };
}

function sendHtml(res, { status, body, headers }, method) {
  res.statusCode = status;
  for (const [key, value] of Object.entries(headers ?? {})) res.setHeader(key, value);
  if (!Object.keys(headers ?? {}).some((key) => key.toLowerCase() === 'content-type')) res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(method === 'HEAD' || !body ? undefined : body);
}

function logInternal(error) {
  // { name, code, sqlstate } only: messages can embed connection strings (§4.1).
  logInternalError('free-share-page', error);
}

// A30 seam. GET and HEAD; the deps factory is awaited before the pair is
// judged; every answer (errors included) is an HTML page with generic tags,
// except the canonical redirect, which has no body.
export function createHandler(depsFactory) {
  if (typeof depsFactory !== 'function') throw new TypeError('createHandler needs a deps factory');
  return async function handler(req, res) {
    const method = String(req?.method ?? 'GET').toUpperCase();
    try {
      if (method !== 'GET' && method !== 'HEAD') {
        const page = renderFreeSharePage({ run: null, status: 405 });
        sendHtml(res, { status: 405, body: page.html, headers: { ...page.headers, Allow: 'GET, HEAD' } }, method);
        return;
      }
      const deps = await depsFactory();
      const pair = readPair(req);
      if (!pair) {
        const page = renderFreeSharePage({ run: null, status: 400 });
        sendHtml(res, { status: 400, body: page.html, headers: page.headers }, method);
        return;
      }
      sendHtml(res, await freeSharePageRequest({ method, query: { game: pair.game, token: pair.token }, canonical: pair.extra }, deps), method);
    } catch (error) {
      logInternal(error);
      const page = renderFreeSharePage({ run: null, status: 503 });
      sendHtml(res, { status: 500, body: page.html, headers: page.headers }, method);
    }
  };
}

export default createHandler(() => buildDeps());
