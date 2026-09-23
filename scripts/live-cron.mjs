// Calls a live cron endpoint once with the cron secret (runbook step 8b, contract A24, §4.3.10-11).
//
//   node scripts/live-cron.mjs --site https://lestersarcade.io --path /api/cron/index-chain \
//        (--secret-file <path> | --secret-env <NAME>)
//
// Sends `Authorization: Bearer <secret>` (the secret is read inside the process and never printed) and
// prints ONLY the HTTP status, the response's `ok` and `schemaVersion`, the counts (numbers, array
// lengths, flat numeric maps) and a short allowlisted code (`error` / `skipped`). Anything else in the
// body is dropped, so an RPC URL or an error text is never echoed. Exit 0 only for 200 with ok:true.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { flagValue, readSecret } from './lib/key-source.mjs';

const CODE_RE = /^[a-z0-9][a-z0-9-]{0,47}$/;
const PATH_RE = /^\/api\/cron\/[a-z0-9-]+$/;
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

// https origins only, except http on the loopback host for local stacks and tests.
export function cronUrl({ site, path }) {
  let origin;
  try {
    origin = new URL(String(site));
  } catch {
    throw new Error('--site must be an origin such as https://lestersarcade.io');
  }
  if (origin.pathname !== '/' || origin.search || origin.hash || origin.username || origin.password) throw new Error('--site must be a bare origin (no path, query or credentials)');
  if (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && LOCAL_HOSTS.has(origin.hostname))) throw new Error('--site must use https (http only for 127.0.0.1 / localhost)');
  if (!PATH_RE.test(String(path ?? ''))) throw new Error('--path must be /api/cron/<name>');
  return new URL(path, origin.origin);
}

export function summarizeCronResponse(status, body) {
  const summary = { status, ok: body?.ok === true, schemaVersion: null, counts: {} };
  if (Number.isSafeInteger(body?.schemaVersion)) summary.schemaVersion = body.schemaVersion;
  for (const key of ['error', 'skipped']) {
    if (typeof body?.[key] === 'string' && CODE_RE.test(body[key])) summary[key] = body[key];
  }
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    for (const key of Object.keys(body).sort()) {
      if (['ok', 'schemaVersion'].includes(key) || !/^[A-Za-z][A-Za-z0-9]{0,40}$/.test(key)) continue;
      const value = body[key];
      if (typeof value === 'number' && Number.isFinite(value)) summary.counts[key] = value;
      else if (Array.isArray(value)) summary.counts[key] = value.length;
      else if (value && typeof value === 'object' && Object.values(value).length > 0 && Object.values(value).every((item) => typeof item === 'number' && Number.isFinite(item))) {
        for (const [inner, count] of Object.entries(value)) if (/^[A-Za-z][A-Za-z0-9-]{0,40}$/.test(inner)) summary.counts[`${key}.${inner}`] = count;
      }
    }
  }
  return summary;
}

export async function runLiveCron({ site, path, secret, fetchImpl = globalThis.fetch, timeoutMs = 60_000 }) {
  const url = cronUrl({ site, path });
  const response = await fetchImpl(url, { method: 'GET', headers: { authorization: `Bearer ${secret}`, accept: 'application/json' }, cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return summarizeCronResponse(response.status, body);
}

export function formatCronSummary(summary) {
  const parts = [`status ${summary.status}`, `ok ${summary.ok}`, `schemaVersion ${summary.schemaVersion ?? 'n/a'}`];
  if (summary.error) parts.push(`error ${summary.error}`);
  if (summary.skipped) parts.push(`skipped ${summary.skipped}`);
  const counts = Object.entries(summary.counts).map(([key, value]) => `${key}=${value}`).join(' ');
  parts.push(`counts ${counts || 'none'}`);
  return parts.join(' · ');
}

// CLI body, injectable for tests. Returns an exit code.
export async function runLiveCronCli({ argv = process.argv.slice(2), env = process.env, log = console.log, fetchImpl = globalThis.fetch } = {}) {
  const site = flagValue(argv, '--site');
  const path = flagValue(argv, '--path');
  if (!site || !path) {
    log('usage: node scripts/live-cron.mjs --site <origin> --path </api/cron/…> (--secret-file <path> | --secret-env <NAME>)');
    return 2;
  }
  cronUrl({ site, path });
  const secret = readSecret({ env, argv, shape: 'secret', envFlag: '--secret-env', fileFlag: '--secret-file', fieldFlag: null, label: 'cron secret' });
  const summary = await runLiveCron({ site, path, secret, fetchImpl });
  log(`${path}: ${formatCronSummary(summary)}`);
  return summary.status === 200 && summary.ok ? 0 : 1;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMain) {
  try {
    process.exitCode = await runLiveCronCli();
  } catch (error) {
    console.error(`live-cron: ${error?.name === 'TimeoutError' ? 'request timed out' : error?.message ?? error}`);
    process.exitCode = 1;
  }
}
