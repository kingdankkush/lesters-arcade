// Wallet login session (owner decision 2026-09-16). The browser posts the
// SIWE challenge it had the wallet sign; the server re-derives the message,
// recovers the signer, and returns an HMAC session token used for profile
// sync writes. Fails closed without SESSION_SECRET. Nothing here touches the
// chain and no private data is stored.

import { createHmac, timingSafeEqual } from 'node:crypto';
import { ethers } from 'ethers';
import { issueSessionToken, verifySiweLogin } from '../apps/portal/src/server-session.mjs';

const crypto = { createHmac, timingSafeEqual };
const DEFAULT_DOMAINS = ['lestersarcade.io', 'www.lestersarcade.io', 'localhost', '127.0.0.1'];

export function readSessionConfig(env = process.env) {
  const secret = env.SESSION_SECRET ?? '';
  const allowedDomains = String(env.SESSION_ALLOWED_DOMAINS ?? '').split(',').map((value) => value.trim()).filter(Boolean);
  return Object.freeze({ configured: secret.length >= 32, secret, allowedDomains: allowedDomains.length ? allowedDomains : DEFAULT_DOMAINS });
}

export async function sessionRequest(body, { env = process.env, now = () => Date.now() } = {}) {
  const config = readSessionConfig(env);
  if (!config.configured) return { status: 503, body: { ok: false, error: 'session-not-configured' } };
  if (!body || typeof body !== 'object') return { status: 400, body: { ok: false, error: 'invalid-body' } };
  const login = verifySiweLogin(ethers, { challenge: body.challenge, signature: body.signature, allowedDomains: config.allowedDomains, nowMs: now() });
  if (!login.ok) return { status: 401, body: { ok: false, error: login.error } };
  const session = issueSessionToken(crypto, { secret: config.secret, wallet: login.wallet, nowMs: now() });
  return { status: 200, body: { ok: true, wallet: login.wallet, token: session.token, expiresAt: session.expiresAt } };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); res.status(405).json({ ok: false, error: 'method-not-allowed' }); return; }
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { res.status(400).json({ ok: false, error: 'invalid-json' }); return; } }
  const result = await sessionRequest(body);
  res.setHeader('Cache-Control', 'no-store');
  res.status(result.status).json(result.body);
}
