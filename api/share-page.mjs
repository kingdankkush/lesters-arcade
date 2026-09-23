// E10 GET /s/<shareId> → /api/share-page?id=<shareId>
// (contract §4.2, §4.3.9, §7.5, A5, A29, A30; security review S6, S13, S14).
//
// Server-renders the public page of one verified Ranked run with its OG and
// Twitter tags, reading the same public record as E9 (readPublicSession):
// pending runs are not public and read as 404, hidden profiles show the short
// wallet, client claims never leave Neon. Only `id` is read and rendered.
// Cache: confirmed public, s-maxage=300, stale-while-revalidate=86400; other
// statuses public, s-maxage=15; 404 public, s-maxage=30; errors no-store.
//
// Extra query parameters: a valid run link that also carries undeclared
// parameters (Facebook appends fbclid to every outbound click, campaigns add
// utm_*; Vercel keeps them through the /s/:id rewrite) answers one cacheable
// 301 to the canonical /s/<shareId>, with no read and no render. That keeps a
// single CDN key per run, which is what §4.3.9's "else 400" protects, without
// turning every Facebook click-through into an error page. A missing,
// invalid or conflicting `id` is still a 400. The card (E11) stays strict.

import { queryOf } from '../server/http.mjs';
import { buildBaseDeps } from '../server/config.mjs';
import { ensureSchema } from '../server/neon/migrations.mjs';
import { readPublicSession } from '../server/neon/queries.mjs';
import { normalizeSessionId32 } from '../server/neon/rows.mjs';
import { renderSharePage } from '../server/share/render-page.mjs';

export const SHARE_PAGE_QUERY = Object.freeze(['id']);
export const CANONICAL_REDIRECT_CACHE = 'public, s-maxage=300';

// The canonical page path for a request whose `id` is one valid share id
// (every copy the same), else null.
export function canonicalSharePath(req) {
  let ids;
  if (req?.query && typeof req.query === 'object') {
    const raw = req.query.id;
    ids = raw === undefined ? [] : (Array.isArray(raw) ? raw : [raw]).map(String);
  } else {
    ids = new URL(String(req?.url ?? '/'), 'http://local').searchParams.getAll('id');
  }
  if (!ids.length || ids.some((id) => id !== ids[0])) return null;
  const sessionId32 = normalizeSessionId32(ids[0]);
  return sessionId32 ? `/s/${sessionId32.slice(2)}` : null;
}

const cache = {};

export async function buildDeps(env = process.env, overrides = {}) {
  return buildBaseDeps(env, overrides, cache);
}

// Pure request → { status, body: html, headers }.
export async function sharePageRequest({ query = {} } = {}, deps) {
  const sessionId32 = normalizeSessionId32(query.id);
  let page;
  if (!sessionId32) {
    page = renderSharePage({ session: null, status: 400 });
  } else if (!deps?.db) {
    page = renderSharePage({ session: null, status: 503 });
  } else {
    await ensureSchema(deps.db);
    const session = await readPublicSession(deps.db, sessionId32);
    page = renderSharePage({ session, status: session ? 200 : 404 });
  }
  return { status: page.status, body: page.html, headers: page.headers };
}

function sendHtml(res, { status, body, headers }, method) {
  res.statusCode = status;
  for (const [key, value] of Object.entries(headers ?? {})) res.setHeader(key, value);
  if (!Object.keys(headers ?? {}).some((key) => key.toLowerCase() === 'content-type')) res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(method === 'HEAD' ? undefined : body);
}

function logInternal(error) {
  // Error name and code only: messages can embed connection strings (§4.1).
  const code = typeof error?.code === 'string' || typeof error?.code === 'number' ? error.code : 'none';
  console.error('[share-page] internal-error', error?.name ?? 'Error', code);
}

// A30 seam. The adapter is the E10 one: GET and HEAD, the declared query
// only, and every answer (errors included) is an HTML page with generic tags.
export function createHandler(depsFactory) {
  if (typeof depsFactory !== 'function') throw new TypeError('createHandler needs a deps factory');
  return async function handler(req, res) {
    const method = String(req?.method ?? 'GET').toUpperCase();
    try {
      if (method !== 'GET' && method !== 'HEAD') {
        const page = renderSharePage({ session: null, status: 400 });
        sendHtml(res, { status: 405, body: page.html, headers: { ...page.headers, Allow: 'GET, HEAD' } }, method);
        return;
      }
      const checked = queryOf(req, SHARE_PAGE_QUERY);
      const canonical = checked.ok ? null : canonicalSharePath(req);
      if (canonical) {
        res.statusCode = 301;
        res.setHeader('Location', canonical);
        res.setHeader('Cache-Control', CANONICAL_REDIRECT_CACHE);
        res.end();
        return;
      }
      if (!checked.ok) {
        const page = renderSharePage({ session: null, status: 400 });
        sendHtml(res, { status: 400, body: page.html, headers: page.headers }, method);
        return;
      }
      const deps = await depsFactory();
      sendHtml(res, await sharePageRequest({ method, query: checked.query }, deps), method);
    } catch (error) {
      logInternal(error);
      const page = renderSharePage({ session: null, status: 503 });
      sendHtml(res, { status: 500, body: page.html, headers: page.headers }, method);
    }
  };
}

export default createHandler(() => buildDeps());
