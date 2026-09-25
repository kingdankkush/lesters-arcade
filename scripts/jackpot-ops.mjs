#!/usr/bin/env node
// Owner operations on the Chikun Weekly Jackpot mirror in Neon (design §C.6, §E E11; contract §11 rule 13).
//
//   node scripts/jackpot-ops.mjs status
//   node scripts/jackpot-ops.mjs requeue --week 2026-W40 [--contract 0x…]       [--apply --confirm REQUEUE_JACKPOT]
//   node scripts/jackpot-ops.mjs rescreen --session 0x… [--contract 0x…]        [--apply --confirm RESCREEN_JACKPOT]
//   node scripts/jackpot-ops.mjs prune-tickets --older-than 60d                 [--apply --confirm PRUNE_TICKET_LOG]
//
// status        weeks that are not finished (and the last few that are), their actions by status, the
//               admin backlog and the seed-ticket log size. Read-only.
// requeue       a failed week: its dead actions back to pending and the week back to 'selecting', from
//               where the weekly-jackpot cron re-screens, re-sends and re-decides idempotently.
// rescreen      one candidate's screen back to 'pending', so the next cron run screens it again. It never
//               touches a session the admin reviewed or disqualified (the keeper may not act on those, and
//               the rescreen creates no clear or flag for them), and only while its week is still being
//               screened (selecting, review or awaiting-admin).
// prune-tickets seed_ticket_log rows issued before the cutoff (60 days at least: the screen reads 8 weeks).
//
// The moderate-profile.mjs pattern: a dry run by default (it only SELECTs); writing needs --apply plus
// the command's confirm phrase. The script never migrates: on a database whose schema is behind it stops
// before anything else. NEON_DATABASE_URL is read from the environment only and is never printed.
// Nothing here touches the chain: every on-chain decision is the admin wallet's (owner page).

import { pathToFileURL } from 'node:url';
import { createNeonClient } from '../apps/portal/src/server-neon.mjs';
import { LATEST_SCHEMA_VERSION, readSchemaVersion } from '../server/neon/migrations.mjs';
import { isoSql } from '../server/neon/queries.mjs';
import { ACTIVE_WEEK_STATUSES } from '../server/jackpot/cron.mjs';
import { requeueWeek } from '../server/jackpot/store.mjs';
import { countTicketsBefore, pruneTickets } from '../server/jackpot/ticket-log.mjs';

export const JACKPOT_OPS_COMMANDS = Object.freeze({
  status: Object.freeze({ confirm: null }),
  requeue: Object.freeze({ confirm: 'REQUEUE_JACKPOT' }),
  rescreen: Object.freeze({ confirm: 'RESCREEN_JACKPOT' }),
  'prune-tickets': Object.freeze({ confirm: 'PRUNE_TICKET_LOG' }),
});
export const MIN_PRUNE_DAYS = 60;
export const USAGE = 'usage: node scripts/jackpot-ops.mjs status | requeue --week YYYY-Www [--contract 0x…] | rescreen --session 0x… [--contract 0x…] | prune-tickets --older-than 60d  [--apply --confirm <PHRASE>]';

const WEEK_KEY = /^[0-9]{4}-W[0-9]{2}$/;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const SESSION = /^0x[0-9a-fA-F]{64}$/;
const OPTIONS = Object.freeze({ '--week': 'week', '--contract': 'contract', '--session': 'session', '--older-than': 'olderThan', '--confirm': 'confirm' });

export function parseJackpotOpsArgs(argv = []) {
  const [command, ...rest] = argv.map(String);
  if (!Object.hasOwn(JACKPOT_OPS_COMMANDS, command ?? '')) return { ok: false, error: command ? `unknown command ${command}` : 'a command is required' };
  const options = { command, week: null, contract: null, session: null, olderThan: null, confirm: null, apply: false };
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    const [flag, inline] = arg.includes('=') ? [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)] : [arg, null];
    if (flag === '--apply' && inline === null) options.apply = true;
    else if (Object.hasOwn(OPTIONS, flag)) options[OPTIONS[flag]] = inline !== null ? inline : (rest[++i] ?? null);
    else return { ok: false, error: `unknown argument ${flag}` };
  }
  if (options.contract !== null) {
    if (!ADDRESS.test(options.contract)) return { ok: false, error: '--contract must be a 0x address' };
    options.contract = options.contract.toLowerCase();
  }
  if (command === 'status' && (options.apply || options.week || options.session || options.olderThan)) return { ok: false, error: 'status takes no options' };
  if (command === 'requeue' && !WEEK_KEY.test(String(options.week ?? ''))) return { ok: false, error: '--week must be an ISO week key like 2026-W40' };
  if (command === 'rescreen') {
    if (!SESSION.test(String(options.session ?? ''))) return { ok: false, error: '--session must be a 0x + 64 hex session id' };
    options.session = options.session.toLowerCase();
  }
  if (command === 'prune-tickets') {
    const match = /^([0-9]{1,4})d$/.exec(String(options.olderThan ?? ''));
    if (!match) return { ok: false, error: '--older-than must be a number of days like 60d' };
    options.days = Number(match[1]);
    if (options.days < MIN_PRUNE_DAYS) return { ok: false, error: `--older-than must be at least ${MIN_PRUNE_DAYS}d (the screen reads the last 8 weeks of tickets)` };
  }
  return { ok: true, ...options };
}

const short = (address) => `${String(address).slice(0, 10)}…`;

async function status(client, { out, nowMs }) {
  const weeks = await client.query(
    `SELECT contract, week_key, status, coalesce(last_error, '') AS last_error, held,
            coalesce(floor(extract(epoch FROM ($1::timestamptz - admin_waiting_since)) / 3600)::int, -1) AS waited_hours
       FROM jackpot_weeks
      WHERE status NOT IN ('paid', 'rolled', 'unfunded') OR updated_at > $1::timestamptz - interval '21 days'
      ORDER BY week_key DESC, contract ASC LIMIT 40`,
    [new Date(nowMs).toISOString()],
  );
  const actions = await client.query(
    `SELECT contract, week_key, status, count(*)::int AS n FROM jackpot_actions
      WHERE week_key IN (SELECT week_key FROM jackpot_weeks WHERE status NOT IN ('paid', 'rolled', 'unfunded') OR updated_at > $1::timestamptz - interval '21 days')
      GROUP BY contract, week_key, status ORDER BY week_key DESC, contract ASC, status ASC`,
    [new Date(nowMs).toISOString()],
  );
  const [tickets] = await client.query(`SELECT count(*)::int AS n, coalesce(${isoSql('min(issued_at)')}, '') AS oldest FROM seed_ticket_log`);
  if (weeks.length === 0) out('No jackpot weeks in the mirror yet.');
  for (const week of weeks) {
    const counts = actions.filter((row) => row.contract === week.contract && row.week_key === week.week_key).map((row) => `${row.status} ${row.n}`).join(', ') || 'no actions';
    const waited = Number(week.waited_hours) >= 0 ? `, awaiting the admin ${week.waited_hours} h${Number(week.waited_hours) >= 168 ? ' (past 7 days: apply the documented default)' : ''}` : '';
    out(`${week.week_key} ${short(week.contract)} ${week.status}${week.held ? ' (held)' : ''}${week.last_error ? ` last error ${week.last_error}` : ''}${waited}; actions: ${counts}`);
  }
  out(`seed_ticket_log: ${tickets?.n ?? 0} rows${tickets?.oldest ? `, oldest issued ${tickets.oldest}` : ''}.`);
  return { exitCode: 0, changed: false };
}

async function requeue(client, args, { out }) {
  const params = [args.week, args.contract];
  const weeks = await client.query("SELECT contract, status FROM jackpot_weeks WHERE week_key = $1 AND ($2::text IS NULL OR contract = $2) ORDER BY contract", params);
  const dead = await client.query("SELECT id, kind, coalesce(last_error, '') AS last_error FROM jackpot_actions WHERE week_key = $1 AND status = 'dead' AND ($2::text IS NULL OR contract = $2) ORDER BY id", params);
  if (weeks.length === 0) {
    out(`${args.week}: no jackpot week in the mirror${args.contract ? ` for ${args.contract}` : ''}. Nothing to requeue.`);
    return { exitCode: 1, changed: false };
  }
  for (const week of weeks) out(`${args.week} ${short(week.contract)}: status ${week.status}${week.status === 'failed' ? ' (back to selecting on apply)' : ''}.`);
  for (const action of dead) out(`dead action ${action.id} (${action.kind})${action.last_error ? `, last error ${action.last_error}` : ''}`);
  if (dead.length === 0 && !weeks.some((week) => week.status === 'failed')) {
    out('Nothing is dead or failed; nothing to requeue.');
    return { exitCode: 0, changed: false };
  }
  if (!args.apply) {
    out(`dry run: would requeue ${dead.length} dead action(s) and ${weeks.filter((week) => week.status === 'failed').length} failed week(s). Re-run with --apply --confirm REQUEUE_JACKPOT to write.`);
    return { exitCode: 0, changed: false };
  }
  const result = await requeueWeek(client, { contract: args.contract, weekKey: args.week });
  out(`applied: ${result.actions.length} action(s) back to pending, ${result.weeks.length} week(s) back to selecting. The next weekly-jackpot cron run picks them up.`);
  return { exitCode: 0, changed: result.actions.length > 0 || result.weeks.length > 0 };
}

async function rescreen(client, args, { out }) {
  const rows = await client.query(
    `SELECT c.contract, c.week_key, c.screen, c.screen_codes, c.review, c.admin_reviewed, w.status AS week_status
       FROM jackpot_candidates c LEFT JOIN jackpot_weeks w ON w.contract = c.contract AND w.week_key = c.week_key
      WHERE c.session_id32 = $1 AND ($2::text IS NULL OR c.contract = $2) ORDER BY c.contract`,
    [args.session, args.contract],
  );
  if (rows.length === 0) {
    out(`${args.session}: not a jackpot candidate${args.contract ? ` of ${args.contract}` : ''}. Nothing to rescreen.`);
    return { exitCode: 1, changed: false };
  }
  if (rows.length > 1) {
    out(`${args.session} is a candidate of ${rows.length} instances; pass --contract to choose one.`);
    return { exitCode: 2, changed: false };
  }
  const [row] = rows;
  out(`${args.session} in ${row.week_key} ${short(row.contract)}: screen ${row.screen}${row.screen_codes ? ` (${row.screen_codes})` : ''}, review ${row.review}${row.admin_reviewed ? ', reviewed by the admin' : ''}; week ${row.week_status ?? 'unknown'}.`);
  if (row.admin_reviewed === true || row.review === 'disqualified') {
    out('Refusing: the admin reviewed or disqualified this session. The admin decision is final for the keeper; a rescreen never creates a clear or flag for it.');
    return { exitCode: 1, changed: false };
  }
  if (!ACTIVE_WEEK_STATUSES.includes(row.week_status)) {
    out(`Refusing: the week is ${row.week_status ?? 'unknown'}; the cron screens only ${ACTIVE_WEEK_STATUSES.join(', ')} weeks.`);
    return { exitCode: 1, changed: false };
  }
  if (!args.apply) {
    out('dry run: would set the screen back to pending, so the next weekly-jackpot cron run screens it again. Re-run with --apply --confirm RESCREEN_JACKPOT to write.');
    return { exitCode: 0, changed: false };
  }
  // The guard repeats the refusal in the write itself (an admin decision indexed since the read wins).
  const updated = await client.query(
    `UPDATE jackpot_candidates SET screen = 'pending', screen_codes = '', features = NULL, screened_at = NULL, updated_at = now()
      WHERE contract = $1 AND session_id32 = $2 AND admin_reviewed = false AND review <> 'disqualified' RETURNING session_id32`,
    [row.contract, args.session],
  );
  out(updated.length === 1 ? 'applied: the screen is pending again.' : 'not applied: the admin reviewed or disqualified it meanwhile.');
  return { exitCode: updated.length === 1 ? 0 : 1, changed: updated.length === 1 };
}

async function pruneTicketLog(client, args, { out, nowMs }) {
  const beforeIso = new Date(nowMs - args.days * 86_400_000).toISOString();
  const count = await countTicketsBefore(client, { beforeIso });
  out(`seed_ticket_log: ${count} row(s) issued before ${beforeIso} (older than ${args.days} days).`);
  if (!args.apply) {
    out('dry run: nothing was deleted. Re-run with --apply --confirm PRUNE_TICKET_LOG to delete them.');
    return { exitCode: 0, changed: false };
  }
  const deleted = await pruneTickets(client, { beforeIso });
  out(`applied: deleted ${deleted} row(s).`);
  return { exitCode: 0, changed: deleted > 0 };
}

export async function runJackpotOps({ argv = process.argv.slice(2), env = process.env, db = null, fetchImpl = globalThis.fetch, out = console.log, nowMs = Date.now() } = {}) {
  const args = parseJackpotOpsArgs(argv);
  if (!args.ok) {
    out(args.error);
    out(USAGE);
    return { exitCode: 2 };
  }
  const phrase = JACKPOT_OPS_COMMANDS[args.command].confirm;
  if (args.apply && args.confirm !== phrase) {
    out(`--apply needs --confirm ${phrase}; nothing was written.`);
    return { exitCode: 2 };
  }
  let client = db;
  if (!client) {
    const url = typeof env.NEON_DATABASE_URL === 'string' ? env.NEON_DATABASE_URL.trim() : '';
    if (!url) {
      out('NEON_DATABASE_URL is not set.');
      return { exitCode: 2 };
    }
    try {
      client = createNeonClient({ connectionString: url, fetchImpl });
    } catch {
      out('NEON_DATABASE_URL is not a postgres connection string.');
      return { exitCode: 2 };
    }
  }
  try {
    const version = await readSchemaVersion(client);
    if (version < LATEST_SCHEMA_VERSION) {
      out(`schema not migrated (version ${version} of ${LATEST_SCHEMA_VERSION}); run the E12 cron or scripts/neon-migrate.mjs first. Nothing was read or written.`);
      return { exitCode: 1, changed: false };
    }
    const context = { out, nowMs: Number(nowMs) };
    if (args.command === 'status') return await status(client, context);
    if (args.command === 'requeue') return await requeue(client, args, context);
    if (args.command === 'rescreen') return await rescreen(client, args, context);
    return await pruneTicketLog(client, args, context);
  } catch (error) {
    out(`jackpot-ops failed (${error?.code ?? error?.name ?? 'error'})`);
    return { exitCode: 1 };
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { exitCode } = await runJackpotOps();
  process.exitCode = exitCode;
}
