#!/usr/bin/env node
// Operator recovery for dead-lettered Ranked settlements (contract §3.3,
// §13 emergency stop 6; guide D10).
//
//   NEON_DATABASE_URL=… node scripts/requeue-dead-letters.mjs --all-dead                  (dry run)
//   NEON_DATABASE_URL=… node scripts/requeue-dead-letters.mjs --session 0x… [--session 0x…]
//   NEON_DATABASE_URL=… node scripts/requeue-dead-letters.mjs --all-dead --apply --confirm REQUEUE_DEAD_LETTERS
//   node scripts/requeue-dead-letters.mjs --all-dead --key-file <path> [--key-field <field>]
//
// A dry run by default (§11 rule 13): it lists the chosen dead letters
// (failed rows with no next attempt) and writes nothing. With --apply plus
// the confirm phrase it moves them back to failed with attempts = 0,
// infra_failures = 0 and next_attempt_at = now(), so the settle-retry cron
// picks them up on its next run. verified_at is never changed, so a dead
// letter verified more than 7 days ago is listed as stale and not requeued
// (the stale rule would dead-letter it again at once).
//
// The connection string is read inside the process through
// scripts/lib/key-source.mjs (§11 rule 13): --key-env <NAME> (default
// NEON_DATABASE_URL), or --key-file <path> [--key-field <field>]. It is never
// printed; errors print a code or the name of the source only.

import { pathToFileURL } from 'node:url';
import { createNeonClient } from '../apps/portal/src/server-neon.mjs';
import { isStaleVerifiedAt, listDeadLetters, requeueDeadLetters } from '../server/settle/store.mjs';
import { readSecret, SecretSourceError } from './lib/key-source.mjs';

export const REQUEUE_CONFIRM = 'REQUEUE_DEAD_LETTERS';
export const REQUEUE_USAGE = `usage: node scripts/requeue-dead-letters.mjs (--session 0x<64 hex> [--session …] | --all-dead) [--apply --confirm ${REQUEUE_CONFIRM}] [--key-env NAME | --key-file <path> [--key-field <field>]]`;
export const DEFAULT_NEON_ENV = 'NEON_DATABASE_URL';
const SESSION_ID32 = /^0x[0-9a-f]{64}$/;
const KEY_FLAGS = new Set(['--key-env', '--key-file', '--key-field']);

export function parseRequeueArgs(argv = []) {
  const options = { sessions: [], allDead: false, apply: false, confirm: null, keyArgs: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = String(argv[index]);
    const [flag, inline] = arg.includes('=') ? [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)] : [arg, null];
    if (flag === '--all-dead' && inline === null) options.allDead = true;
    else if (flag === '--apply' && inline === null) options.apply = true;
    else if (flag === '--confirm') options.confirm = (inline !== null ? inline : argv[++index]) ?? null;
    else if (KEY_FLAGS.has(flag)) {
      // Handed to key-source as given: the value is a NAME, a path or a field.
      const value = inline !== null ? inline : argv[++index];
      if (value === undefined || String(value).startsWith('--')) return { ok: false, error: `${flag} needs a value` };
      options.keyArgs.push(flag, String(value));
    }
    else if (flag === '--session') {
      const value = String((inline !== null ? inline : argv[++index]) ?? '').trim().toLowerCase();
      if (!SESSION_ID32.test(value)) return { ok: false, error: '--session needs a session key (0x + 64 hex)' };
      options.sessions.push(value);
    } else {
      return { ok: false, error: `unknown argument ${flag}` };
    }
  }
  if (options.allDead === (options.sessions.length > 0)) return { ok: false, error: 'choose --session 0x… (one or more) or --all-dead' };
  return { ok: true, ...options, sessions: [...new Set(options.sessions)] };
}

export async function runRequeueDeadLetters({ argv = process.argv.slice(2), env = process.env, db = null, fetchImpl = globalThis.fetch, out = console.log, nowMs = Date.now, readFile = null } = {}) {
  const args = parseRequeueArgs(argv);
  if (!args.ok) {
    out(args.error);
    out(REQUEUE_USAGE);
    return { exitCode: 2 };
  }
  if (args.apply && args.confirm !== REQUEUE_CONFIRM) {
    out(`--apply needs --confirm ${REQUEUE_CONFIRM}; nothing was requeued.`);
    return { exitCode: 2 };
  }
  let client = db;
  if (!client) {
    const keyArgs = args.keyArgs.includes('--key-env') || args.keyArgs.includes('--key-file') ? args.keyArgs : [...args.keyArgs, '--key-env', DEFAULT_NEON_ENV];
    let url;
    try {
      url = readSecret({ env, argv: keyArgs, shape: 'secret', label: 'Neon connection string', ...(readFile ? { readFile } : {}) });
    } catch (error) {
      // key-source messages name the flag, the variable or the file, never the value.
      out(`${error instanceof SecretSourceError ? error.message : 'the Neon connection string could not be read'}; nothing was requeued.`);
      return { exitCode: 2 };
    }
    try {
      client = createNeonClient({ connectionString: url, fetchImpl });
    } catch {
      out('the Neon connection string is not a postgres connection string; nothing was requeued.');
      return { exitCode: 2 };
    }
  }
  const now = typeof nowMs === 'function' ? nowMs() : Number(nowMs);
  try {
    const dead = await listDeadLetters(client, { sessionIds: args.allDead ? null : args.sessions });
    const missing = args.allDead ? [] : args.sessions.filter((id) => !dead.some((row) => row.sessionId32 === id));
    for (const id of missing) out(`not a dead letter (skipped): ${id}`);
    for (const row of dead) out(`dead letter ${row.sessionId32} ${row.gameId} last_error=${row.lastError ?? 'none'} attempts=${row.attempts} verified_at=${row.verifiedAt}`);
    const stale = dead.filter((row) => isStaleVerifiedAt(row.verifiedAt, now)).map((row) => row.sessionId32);
    for (const id of stale) out(`stale, not requeued (verified more than 7 days ago; the stale rule would dead-letter it again): ${id}`);
    const found = dead.map((row) => row.sessionId32).filter((id) => !stale.includes(id));
    if (!found.length) {
      out('no dead letters to requeue');
      return { exitCode: 0, found: [], stale, requeued: [] };
    }
    if (!args.apply) {
      out(`dry run: nothing was requeued. Re-run with --apply --confirm ${REQUEUE_CONFIRM} to requeue ${found.length}.`);
      return { exitCode: 0, found, stale, requeued: [] };
    }
    const requeued = await requeueDeadLetters(client, { sessionIds: found, nowMs: now });
    out(`requeued ${requeued.length}: ${requeued.join(', ')}`);
    out('the settle-retry cron picks them up on its next run');
    return { exitCode: 0, found, stale, requeued };
  } catch (error) {
    // Error code only: a driver message could echo connection details.
    out(`requeue failed (${error?.code ?? error?.name ?? 'error'})`);
    return { exitCode: 1 };
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { exitCode } = await runRequeueDeadLetters();
  process.exitCode = exitCode;
}
