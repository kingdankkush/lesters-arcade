// E10 GET /s/<shareId> → /api/share-page?id=<shareId>
// (contract §4.2, §4.3.9, §7.5, A5, A29, A30; security review S6, S13, S14).
//
// Server-renders the public page of one verified Ranked run with its OG and
// Twitter tags, reading the same public record as E9 (readPublicSession):
// pending runs are not public and read as 404, hidden profiles show the short
// wallet, client claims never leave Neon. Only `id` is accepted: any other
// parameter (fbclid and utm_* included), or a missing, invalid or conflicting
// `id`, is a 400 page with no read (§4.1 invalid-query, §4.3.9), so a varying
// query can neither force reads nor split the CDN key.
// Cache: confirmed public, s-maxage=300, stale-while-revalidate=86400; other
// statuses public, s-maxage=15; 404 public, s-maxage=30; errors no-store.

import { queryOf } from '../server/http.mjs';
import { buildBaseDeps } from '../server/config.mjs';
import { ensureSchema } from '../server/neon/migrations.mjs';
import { readPublicSession } from '../server/neon/queries.mjs';
import { normalizeSessionId32 } from '../server/neon/rows.mjs';
import { renderSharePage } from '../server/share/render-page.mjs';

export const SHARE_PAGE_QUERY = Object.freeze(['id']);

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
