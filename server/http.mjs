// Shared HTTP helpers for every api/*.mjs function (contract §4.1, A30).
//
// Server-only code (A14): nothing here is reachable from the public web root.
// Every endpoint module builds its real req/res adapter with makeHandler(),
// so the method check, the Bearer check before the body is read, the
// unknown-query rejection, the body cap, the try/catch into 500 and the
// headers are identical everywhere, and tests exercise the production adapter
// by mounting createHandler(() => buildDeps(env, overrides)).

import { createHmac, timingSafeEqual } from 'node:crypto';
import { isIPv4, isIPv6 } from 'node:net';
import { verifySessionToken } from '../apps/portal/src/server-session.mjs';

export const HEX_WALLET = /^0x[0-9a-f]{40}$/;

function lowerHeaders(headers) {
  const out = {};
  for (const [key, value] of Object.entries(headers ?? {})) out[String(key).toLowerCase()] = Array.isArray(value) ? value.join(', ') : value;
  return out;
}

function headerOf(req, name) {
  const headers = req?.headers ?? {};
  if (typeof headers.get === 'function') return headers.get(name) ?? undefined;
  const direct = headers[name] ?? headers[name.toLowerCase()];
  if (direct !== undefined) return Array.isArray(direct) ? direct.join(', ') : direct;
  const found = Object.keys(headers).find((key) => key.toLowerCase() === name.toLowerCase());
  return found ? headers[found] : undefined;
}

function tooLarge() {
  return { ok: false, status: 413, error: 'body-too-large' };
}

function invalidJson() {
  return { ok: false, status: 400, error: 'invalid-json' };
}

function parseText(text, maxBytes) {
  if (Buffer.byteLength(text, 'utf8') > maxBytes) return tooLarge();
  if (!text.trim()) return { ok: true, body: null };
  try {
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return invalidJson();
  }
}

// Reads a JSON body with a hard size cap. The content-length header is
// checked before anything is read or parsed; when Vercel has already parsed
// the body, its serialized size is checked instead (contract A4).
export async function readJsonBody(req, { maxBytes } = {}) {
  if (!Number.isInteger(maxBytes) || maxBytes <= 0) throw new TypeError('maxBytes must be a positive integer');
  const declared = headerOf(req, 'content-length');
  if (declared !== undefined && declared !== '') {
    const length = Number(declared);
    if (Number.isFinite(length) && length > maxBytes) return tooLarge();
  }
  let parsed;
  try {
    parsed = req?.body;
  } catch {
    // Vercel's lazy body getter throws on malformed JSON.
    return invalidJson();
  }
  if (parsed !== undefined) {
    if (parsed === null) return { ok: true, body: null };
    if (typeof parsed === 'string') return parseText(parsed, maxBytes);
    if (Buffer.isBuffer(parsed) || parsed instanceof Uint8Array) return parseText(Buffer.from(parsed).toString('utf8'), maxBytes);
    let serialized;
    try {
      serialized = JSON.stringify(parsed);
    } catch {
      return invalidJson();
    }
    if (Buffer.byteLength(serialized ?? '', 'utf8') > maxBytes) return tooLarge();
    return { ok: true, body: parsed };
  }
  if (!req || typeof req[Symbol.asyncIterator] !== 'function') return { ok: true, body: null };
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk);
    total += buffer.length;
    if (total > maxBytes) return tooLarge();
    chunks.push(buffer);
  }
  return parseText(Buffer.concat(chunks).toString('utf8'), maxBytes);
}

export function sendJson(res, status, body, { cache = 'no-store', headers = {} } = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cache);
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === 'cache-control') continue;
    res.setHeader(key, value);
  }
  res.end(JSON.stringify(body));
}

export function bearerToken(req) {
  const value = headerOf(req, 'authorization');
  const match = /^Bearer\s+(\S+)\s*$/i.exec(String(value ?? ''));
  return match ? match[1] : null;
}

export function clientIp(req) {
  const forwarded = String(headerOf(req, 'x-forwarded-for') ?? '').split(',')[0].trim();
  if (forwarded) return forwarded;
  const real = String(headerOf(req, 'x-real-ip') ?? '').trim();
  return real || 'unknown';
}

function expandIpv6(address) {
  let text = address;
  // Embedded IPv4 tail (for example 64:ff9b::1.2.3.4) becomes two hextets.
  const v4 = /(\d{1,3}(?:\.\d{1,3}){3})$/.exec(text);
  if (v4 && isIPv4(v4[1])) {
    const parts = v4[1].split('.').map(Number);
    text = `${text.slice(0, -v4[1].length)}${((parts[0] << 8) | parts[1]).toString(16)}:${((parts[2] << 8) | parts[3]).toString(16)}`;
  }
  const [head, tail] = text.includes('::') ? text.split('::') : [text, null];
  const headParts = head ? head.split(':') : [];
  const tailParts = tail === null ? [] : (tail ? tail.split(':') : []);
  const missing = 8 - headParts.length - tailParts.length;
  const all = tail === null ? headParts : [...headParts, ...Array(Math.max(0, missing)).fill('0'), ...tailParts];
  return all.map((part) => part.toLowerCase().padStart(4, '0'));
}

// The value that is HMAC'd for rate-limit buckets: IPv4 and IPv4-mapped IPv6
// use the v4 address; any other IPv6 address folds to its /64 (the first four
// hextets of the expanded form), so one subscriber cannot rotate through a
// prefix to escape a limit (security review S5).
export function foldIp(ip) {
  let value = String(ip ?? '').trim().toLowerCase();
  if (value.startsWith('[') && value.includes(']')) value = value.slice(1, value.indexOf(']'));
  const zone = value.indexOf('%');
  if (zone >= 0) value = value.slice(0, zone);
  if (isIPv4(value)) return value;
  if (isIPv6(value)) {
    const hextets = expandIpv6(value);
    if (hextets.slice(0, 5).every((part) => part === '0000') && hextets[5] === 'ffff') {
      const high = parseInt(hextets[6], 16), low = parseInt(hextets[7], 16);
      return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
    }
    return `${hextets.slice(0, 4).join(':')}::/64`;
  }
  return value || 'unknown';
}

export function ipBucket(ip, secret) {
  if (typeof secret !== 'string' || !secret) throw new TypeError('ipBucket needs a secret');
  return createHmac('sha256', secret).update(foldIp(ip)).digest('hex').slice(0, 32);
}

function rawQuery(req) {
  if (req?.query && typeof req.query === 'object') return Object.entries(req.query);
  const url = new URL(String(req?.url ?? '/'), 'http://local');
  const entries = [];
  for (const [key, value] of url.searchParams) entries.push([key, value]);
  return entries;
}

// Rejects every parameter the endpoint does not declare (contract §4.1): this
// stops cache-busting renders and reads. A repeated parameter is accepted only
// when every copy carries the same value.
export function queryOf(req, allowed = []) {
  const allow = new Set(allowed);
  const query = {};
  for (const [key, raw] of rawQuery(req)) {
    if (!allow.has(key)) return { ok: false, status: 400, error: 'invalid-query' };
    const values = Array.isArray(raw) ? raw.map(String) : [String(raw ?? '')];
    const previous = Object.hasOwn(query, key) ? [query[key]] : [];
    const all = [...previous, ...values];
    if (all.some((value) => value !== all[0])) return { ok: false, status: 400, error: 'invalid-query' };
    query[key] = all[0];
  }
  return { ok: true, query };
}

export function errorBody(error, extra = {}) {
  return { ok: false, error, ...extra };
}

export function jsonResult(status, body, cache = 'no-store', headers = {}) {
  return { status, body, headers: { 'Cache-Control': cache, ...headers } };
}

// The session audience of token v2 (contract A13). Passing it to today's v1
// verifier is harmless; the settle slice makes the verifier enforce it.
export function sessionAudience(config) {
  return `lestersarcade:${config?.environment ?? 'production'}`;
}

// Verifies the Bearer token of a request against SESSION_SECRET. Returns
// { wallet, expiresAt } or null. Never throws and never logs the token.
export function verifyBearer(headers, deps) {
  const config = deps?.config;
  if (!config?.session?.configured) return null;
  const token = bearerToken({ headers });
  if (!token) return null;
  try {
    const session = verifySessionToken({ createHmac, timingSafeEqual }, {
      secret: config.session.secret(),
      token,
      nowMs: typeof deps.nowMs === 'function' ? deps.nowMs() : Date.now(),
      audience: sessionAudience(config),
    });
    if (!session || !HEX_WALLET.test(String(session.wallet ?? ''))) return null;
    return { wallet: String(session.wallet).toLowerCase(), expiresAt: session.expiresAt };
  } catch {
    return null;
  }
}

function methodSet(methods) {
  return methods ? methods.map((method) => method.toUpperCase()) : null;
}

function allowedQueryFor(query, method) {
  if (query === null) return null;
  if (Array.isArray(query)) return query;
  return query?.[method] ?? [];
}

function logInternal(label, error) {
  // Error name and code only: messages can embed connection strings or RPC
  // URLs, and deps/config objects must never reach a log (contract §4.1).
  const code = typeof error?.code === 'string' || typeof error?.code === 'number' ? error.code : 'none';
  console.error(`[${label}] internal-error`, error?.name ?? 'Error', code);
}

// Builds the createHandler(depsFactory) of an endpoint module.
//   methods   allowed HTTP methods, or null for any (stubs)
//   query     allowed query names: an array for every method, a per-method
//             object, or null to skip the check (stubs)
//   maxBytes  body cap for POST/PUT/PATCH; 0 means the body is never read
//   auth      optional async (request, deps) => null | result, run BEFORE the
//             body is read; a returned result is sent as is
//   run       async (request, deps) => { status, body, headers? }
export function makeHandler({ label = 'api', methods = ['GET'], query = [], maxBytes = 0, auth = null, run } = {}) {
  if (typeof run !== 'function') throw new TypeError('makeHandler needs run');
  const allowedMethods = methodSet(methods);
  return function createHandler(depsFactory) {
    if (typeof depsFactory !== 'function') throw new TypeError('createHandler needs a deps factory');
    return async function handler(req, res) {
      const method = String(req?.method ?? 'GET').toUpperCase();
      try {
        if (allowedMethods && !allowedMethods.includes(method)) {
          sendJson(res, 405, errorBody('method-not-allowed'), { headers: { Allow: allowedMethods.join(', ') } });
          return;
        }
        let parsedQuery = {};
        const allowedQuery = allowedQueryFor(query, method);
        if (allowedQuery) {
          const checked = queryOf(req, allowedQuery);
          if (!checked.ok) { sendJson(res, checked.status, errorBody(checked.error)); return; }
          parsedQuery = checked.query;
        } else {
          parsedQuery = Object.fromEntries(rawQuery(req).map(([key, value]) => [key, Array.isArray(value) ? String(value[0]) : String(value ?? '')]));
        }
        const deps = await depsFactory();
        const request = { method, query: parsedQuery, headers: lowerHeaders(req?.headers), body: null, ip: clientIp(req) };
        if (typeof auth === 'function') {
          const denied = await auth(request, deps);
          if (denied) { sendResult(res, denied); return; }
        }
        if (maxBytes > 0 && ['POST', 'PUT', 'PATCH'].includes(method)) {
          const read = await readJsonBody(req, { maxBytes });
          if (!read.ok) { sendJson(res, read.status, errorBody(read.error)); return; }
          request.body = read.body;
        }
        sendResult(res, await run(request, deps));
      } catch (error) {
        logInternal(label, error);
        sendJson(res, 500, errorBody('internal-error'));
      }
    };
  };
}

export function sendResult(res, result) {
  const headers = { ...(result?.headers ?? {}) };
  const cacheKey = Object.keys(headers).find((key) => key.toLowerCase() === 'cache-control');
  const cache = cacheKey ? headers[cacheKey] : 'no-store';
  if (cacheKey) delete headers[cacheKey];
  sendJson(res, result?.status ?? 500, result?.body ?? errorBody('internal-error'), { cache, headers });
}
