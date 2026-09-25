// The seed-ticket log (design §C.2 seed_ticket_log, §C.4 "Seed tickets",
// rev. 2).
//
// server/settle/seed.mjs calls logSeedTicketInBackground() once, right after
// issueSeedTicket succeeds. It is best effort by construction:
//   - it never throws and never rejects (every failure is logged with
//     logSafeError: the error name and code only);
//   - it is never awaited on the live Ranked path, so a slow insert or a
//     database failure can change neither the response nor its timing;
//   - a missing table (a database still at migration 2) is a silent no-op;
//   - where the Vercel runtime exposes a request context, the insert is
//     registered with its waitUntil, so a frozen function does not drop it.
//
// The log serves the screen's seed-provenance check (the MAC recomputed with
// SESSION_SECRET, the seed re-derived, issuedAt against openedAt), H10 (no
// row), S11 (tickets per settled run, seed shopping) and the ticket-to-pay
// delay. `jackpot-ops prune-tickets --older-than 60d` deletes old rows.

import { periodKeyFor } from '../../apps/portal/src/leaderboard-engine.mjs';
import { isoSql } from '../neon/queries.mjs';
import { logSafeError } from '../settle/errors.mjs';

const MAC = /^[0-9a-f]{64}$/;
const SALT = /^[0-9a-f]{32}$/;
const WALLET = /^0x[0-9a-f]{40}$/;
const HANDLE = /^game-session-[0-9a-f-]{36}$/;
const GAME = /^[a-z0-9-]{1,40}$/;
const pending = new Set();

function isMissingTable(error) {
  return error?.code === '42P01' || /relation "?seed_ticket_log"? does not exist/i.test(String(error?.message ?? ''));
}

// → { logged: boolean, reason? }. Throws on a database failure other than a
// missing table (the background wrapper catches it).
export async function logSeedTicket(db, { wallet, sessionId, gameId, seasonId, buildHash, seedTicket } = {}) {
  if (!db || typeof db.query !== 'function') return { logged: false, reason: 'no-database' };
  const who = String(wallet ?? '').toLowerCase();
  const ticket = seedTicket ?? {};
  const issuedAt = Number(ticket.issuedAt);
  if (!WALLET.test(who) || !HANDLE.test(String(sessionId ?? '')) || !GAME.test(String(gameId ?? '')) || !MAC.test(String(ticket.mac ?? ''))
    || !SALT.test(String(ticket.salt ?? '')) || !Number.isSafeInteger(issuedAt) || issuedAt < 0
    || typeof seasonId !== 'string' || !seasonId || seasonId.length > 80 || typeof buildHash !== 'string' || !buildHash || buildHash.length > 120) {
    return { logged: false, reason: 'invalid' };
  }
  try {
    const rows = await db.query(
      `INSERT INTO seed_ticket_log (mac, wallet, session_handle, game_id, season_id, build_hash, salt, issued_at, week_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, to_timestamp($8::double precision), $9)
       ON CONFLICT (mac) DO NOTHING RETURNING mac`,
      [ticket.mac, who, String(sessionId), String(gameId), seasonId, buildHash, ticket.salt, String(issuedAt), periodKeyFor('weekly', issuedAt * 1000)],
    );
    return { logged: rows.length === 1 };
  } catch (error) {
    if (isMissingTable(error)) return { logged: false, reason: 'missing-table' };
    throw error;
  }
}

function requestContextWaitUntil(promise) {
  try {
    const context = globalThis[Symbol.for('@vercel/request-context')]?.get?.();
    if (typeof context?.waitUntil === 'function') context.waitUntil(promise);
  } catch {
    // No request context (tests, local stacks): plain fire and forget.
  }
}

// The one call server/settle/seed.mjs makes. Returns a promise that always
// resolves ({ logged, reason? }); callers do not await it.
export function logSeedTicketInBackground(db, entry) {
  let promise;
  try {
    promise = Promise.resolve()
      .then(() => logSeedTicket(db, entry))
      .catch((error) => {
        logSafeError('ranked-seed:ticket-log', error);
        return { logged: false, reason: 'error' };
      });
  } catch (error) {
    logSafeError('ranked-seed:ticket-log', error);
    promise = Promise.resolve({ logged: false, reason: 'error' });
  }
  pending.add(promise);
  promise.finally(() => pending.delete(promise));
  requestContextWaitUntil(promise);
  return promise;
}

// Resolves once every background log started so far has finished (tests and
// the local rehearsal).
export function settleTicketLogs() {
  return Promise.allSettled([...pending]);
}

export function ticketRowFrom(raw) {
  return Object.freeze({
    mac: raw.mac,
    wallet: raw.wallet,
    sessionHandle: raw.session_handle,
    gameId: raw.game_id,
    seasonId: raw.season_id,
    buildHash: raw.build_hash,
    salt: raw.salt,
    issuedAt: raw.issued_at,
    issuedAtSeconds: Math.floor(Date.parse(raw.issued_at) / 1000),
    weekKey: raw.week_key,
  });
}

// Every logged ticket of one session identity (a client may ask twice).
export async function readSessionTickets(db, { wallet, sessionHandle, gameId = 'chikun', seasonId = null, buildHash = null }) {
  const rows = await db.query(
    `SELECT mac, wallet, session_handle, game_id, season_id, build_hash, salt, ${isoSql('issued_at')} AS issued_at, week_key
     FROM seed_ticket_log
     WHERE wallet = $1 AND session_handle = $2 AND game_id = $3
       AND ($4::text IS NULL OR season_id = $4) AND ($5::text IS NULL OR build_hash = $5)
     ORDER BY issued_at ASC, mac ASC`,
    [String(wallet).toLowerCase(), String(sessionHandle), String(gameId), seasonId, buildHash],
  );
  return rows.map(ticketRowFrom);
}

// Tickets issued to a wallet for a game in one week (S11).
export async function countWalletTickets(db, { wallet, gameId = 'chikun', weekKey }) {
  const rows = await db.query('SELECT count(*)::int AS n FROM seed_ticket_log WHERE game_id = $1 AND week_key = $2 AND wallet = $3', [String(gameId), String(weekKey), String(wallet).toLowerCase()]);
  return Number(rows[0]?.n ?? 0);
}

// jackpot-ops prune-tickets: rows issued before the cutoff. → deleted count.
export async function pruneTickets(db, { beforeIso }) {
  const rows = await db.query('DELETE FROM seed_ticket_log WHERE issued_at < $1::timestamptz RETURNING mac', [String(beforeIso)]);
  return rows.length;
}

export async function countTicketsBefore(db, { beforeIso }) {
  const rows = await db.query('SELECT count(*)::int AS n FROM seed_ticket_log WHERE issued_at < $1::timestamptz', [String(beforeIso)]);
  return Number(rows[0]?.n ?? 0);
}
