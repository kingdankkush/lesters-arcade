#!/usr/bin/env node
// Operator recovery for dead-lettered Ranked settlements (contract §3.3,
// §13 emergency stop 6; guide D10).
//
//   NEON_DATABASE_URL=… node scripts/requeue-dead-letters.mjs --all-dead                  (dry run)
//   NEON_DATABASE_URL=… node scripts/requeue-dead-letters.mjs --session 0x… [--session 0x…]
//   NEON_DATABASE_URL=… node scripts/requeue-dead-letters.mjs --all-dead --apply --confirm REQUEUE_DEAD_LETTERS
//
// A dry run by default (§11 rule 13): it lists the chosen dead letters
// (failed rows with no next attempt) and writes nothing. With --apply plus
// the confirm phrase it moves them back to failed with attempts = 0,
// infra_failures = 0 and next_attempt_at = now(), so the settle-retry cron
// picks them up on its next run. The connection string is read from the
// environment only and is never printed; errors print a code only.

import { pathToFileURL } from 'node:url';
import { createNeonClient } from '../apps/portal/src/server-neon.mjs';
import { listDeadLetters, requeueDeadLetters } from '../server/settle/store.mjs';

export const REQUEUE_CONFIRM = 'REQUEUE_DEAD_LETTERS';
export const REQUEUE_USAGE = `usage: node scripts/requeue-dead-letters.mjs (--session 0x<64 hex> [--session …] | --all-dead) [--apply --confirm ${REQUEUE_CONFIRM}]`;
const SESSION_ID32 = /^0x[0-9a-f]{64}$/;

export function parseRequeueArgs(argv = []) {
  const options = { sessions: [], allDead: false, apply: false, confirm: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = String(argv[index]);
    const [flag, inline] = arg.includes('=') ? [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)] : [arg, null];
    if (flag === '--all-dead' && inline === null) options.allDead = true;
    else if (flag === '--apply' && inline === null) options.apply = true;
    else if (flag === '--confirm') options.confirm = (inline !== null ? inline : argv[++index]) ?? null;
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

export async function runRequeueDeadLetters({ argv = process.argv.slice(2), env = process.env, db = null, fetchImpl = globalThis.fetch, out = console.log, nowMs = Date.now } = {}) {
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
    const url = typeof env.NEON_DATABASE_URL === 'string' ? env.NEON_DATABASE_URL.trim() : '';
    if (!url) {
      out('NEON_DATABASE_URL is not set; nothing was requeued.');
      return { exitCode: 2 };
    }
    try {
      client = createNeonClient({ connectionString: url, fetchImpl });
    } catch {
      out('NEON_DATABASE_URL is not a postgres connection string; nothing was requeued.');
      return { exitCode: 2 };
    }
  }
  try {
    const dead = await listDeadLetters(client, { sessionIds: args.allDead ? null : args.sessions });
    const missing = args.allDead ? [] : args.sessions.filter((id) => !dead.some((row) => row.sessionId32 === id));
    for (const id of missing) out(`not a dead letter (skipped): ${id}`);
    for (const row of dead) out(`dead letter ${row.sessionId32} ${row.gameId} last_error=${row.lastError ?? 'none'} attempts=${row.attempts} verified_at=${row.verifiedAt}`);
    if (!dead.length) {
      out('no dead letters to requeue');
      return { exitCode: 0, found: [], requeued: [] };
    }
    const found = dead.map((row) => row.sessionId32);
    if (!args.apply) {
      out(`dry run: nothing was requeued. Re-run with --apply --confirm ${REQUEUE_CONFIRM} to requeue ${found.length}.`);
      return { exitCode: 0, found, requeued: [] };
    }
    const requeued = await requeueDeadLetters(client, { sessionIds: found, nowMs: typeof nowMs === 'function' ? nowMs() : Number(nowMs) });
    out(`requeued ${requeued.length}: ${requeued.join(', ')}`);
    out('the settle-retry cron picks them up on its next run');
    return { exitCode: 0, found, requeued };
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
