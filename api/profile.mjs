// Cross-device profile sync (owner decision 2026-09-16: hosted database).
// GET  /api/profile?wallet=0x...        -> public profile document (no token)
// PUT  /api/profile  Authorization: Bearer <session token>  body: document
// Storage is Neon (Vercel Postgres) over its HTTP SQL endpoint; without
// NEON_DATABASE_URL the endpoint answers 503 and the browser stays local.

import { createHmac, timingSafeEqual } from 'node:crypto';
import { sanitizeProfileDocument, verifySessionToken } from '../apps/portal/src/server-session.mjs';
import { createNeonClient, ensureProfileSchema, readProfile, writeProfile } from '../apps/portal/src/server-neon.mjs';

const crypto = { createHmac, timingSafeEqual };
const HEX_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const MAX_BODY_BYTES = 64 * 1024;
let schemaReady = false;

export function readProfileConfig(env = process.env) {
  return Object.freeze({ databaseUrl: env.NEON_DATABASE_URL ?? '', secret: env.SESSION_SECRET ?? '' });
}

export async function profileRequest({ method, query = {}, headers = {}, body = null }, { env = process.env, fetchImpl = globalThis.fetch, now = () => Date.now(), client = null } = {}) {
  const config = readProfileConfig(env);
  const db = client ?? createNeonClient({ connectionString: config.databaseUrl, fetchImpl });
  if (!db) return { status: 503, body: { ok: false, error: 'profile-sync-not-configured' } };
  if (!schemaReady) { await ensureProfileSchema(db); schemaReady = true; }
  if (method === 'GET') {
    const wallet = String(query.wallet ?? '').toLowerCase();
    if (!HEX_ADDRESS.test(wallet)) return { status: 400, body: { ok: false, error: 'invalid-wallet' } };
    const row = await readProfile(db, wallet);
    return { status: 200, body: { ok: true, wallet, profile: row?.document ?? null, updatedAt: row?.updated_at ?? null } };
  }
  if (method === 'PUT') {
    if (config.secret.length < 32) return { status: 503, body: { ok: false, error: 'session-not-configured' } };
    const token = String(headers.authorization ?? headers.Authorization ?? '').replace(/^Bearer\s+/i, '');
    const session = verifySessionToken(crypto, { secret: config.secret, token, nowMs: now() });
    if (!session) return { status: 401, body: { ok: false, error: 'invalid-session' } };
    if (!body || typeof body !== 'object') return { status: 400, body: { ok: false, error: 'invalid-body' } };
    const document = sanitizeProfileDocument(body);
    const row = await writeProfile(db, session.wallet, document);
    return { status: 200, body: { ok: true, wallet: session.wallet, updatedAt: row?.updated_at ?? null, profile: document } };
  }
  return { status: 405, body: { ok: false, error: 'method-not-allowed' } };
}

export default async function handler(req, res) {
  let body = req.body;
  if (typeof body === 'string') {
    if (body.length > MAX_BODY_BYTES) { res.status(413).json({ ok: false, error: 'body-too-large' }); return; }
    try { body = JSON.parse(body); } catch { res.status(400).json({ ok: false, error: 'invalid-json' }); return; }
  }
  const query = req.query ?? Object.fromEntries(new URL(req.url ?? '/', 'http://local').searchParams);
  let result;
  try {
    result = await profileRequest({ method: req.method, query, headers: req.headers ?? {}, body });
  } catch (error) {
    result = { status: 502, body: { ok: false, error: 'profile-store-error', detail: String(error?.message ?? error).slice(0, 200) } };
  }
  res.setHeader('Cache-Control', 'no-store');
  if (result.status === 405) res.setHeader('Allow', 'GET, PUT');
  res.status(result.status).json(result.body);
}
