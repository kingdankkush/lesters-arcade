import assert from 'node:assert/strict';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import * as seedApi from '../api/ranked-seed.mjs';
import { issueSessionToken } from '../apps/portal/src/server-session.mjs';
import { deriveRankedSeed } from '../apps/portal/src/session-seed.mjs';
import { seedTicketMacInput } from '../server/verify/seed-ticket.mjs';
import {
  countTicketsBefore, countWalletTickets, logSeedTicket, logSeedTicketInBackground, pruneTickets, readSessionTickets, settleTicketLogs,
} from '../server/jackpot/ticket-log.mjs';
import { MIN_PRUNE_DAYS, parseJackpotOpsArgs, runJackpotOps } from '../scripts/jackpot-ops.mjs';
import { migrate } from '../server/neon/migrations.mjs';
import { casAction, casWeekStatus, createAction, ensureWeekRow, readAction, readCandidate, readWeekRow, upsertCandidate } from '../server/jackpot/store.mjs';
import { weekIndexOfKey } from '../server/jackpot/weeks.mjs';
import { createPgliteClient } from './helpers/pglite-client.mjs';
import { invoke } from './helpers/fake-http.mjs';
import { createCatalogDouble, createVerifyDouble, fixtureEnv, SETTLE_SESSION_VALUE } from './helpers/settle-fixtures.mjs';

/**
 * jackpot-server AC9 (design §C.4 "Seed tickets"): E15 logs every issued
 * ticket to seed_ticket_log with one best-effort background call. The row is
 * written, and a database failure, a missing table or a hung insert still
 * answers 200 with the very same ticket, at once. The seed tests in
 * tests/server-settle-core.test.mjs run unchanged. AC17: scripts/jackpot-ops.mjs
 * is a dry run by default, needs each command's confirm phrase, refuses while
 * the schema is behind and never rescreens an admin-reviewed session.
 */

const REGISTRY = '0xc5c5949a02fac9a4115df182672c0f8ceb0eaf55';
const DEPLOYED = Object.freeze({
  status: 'deployed', chainId: 4441, startBlock: 10, settlementGasReserveWei: '2000000000000000',
  addresses: Object.freeze({
    gameRegistry: '0xcb0b695ebee650afcce93f566259cb477b19bf23', playerProfileRegistry: '0x3eb9e9f2620940496a2b8ed6f7384e6687587c94',
    arcadeRankedEntry: '0x10cd09e694e2b2cd70d37f8cdddcda3ef1208190', scoreSubmissionRegistry: REGISTRY,
    achievementRegistries: Object.freeze({ 'lester-blaster': '0xc1a383cb7521978f429424443fdd69bdd71ff737', chikun: '0xf6cd1cf7e1accaea93accdfb911034b3e8eb6f93', stacked: '0x5430f8c142ca7ec8971a447cc09ae63f8860a8a7' }),
  }),
});
const NOW = Date.parse('2026-09-30T12:00:00.000Z');
const PLAYER = `0x${'a3'.repeat(20)}`;
const SESSION = 'game-session-4f1c2d3e-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
const BODY = Object.freeze({ gameId: 'chikun', sessionId: SESSION, seasonId: 'chikun-season-preview-1', buildHash: 'site-1.8.1:game-1.8.1:cabinet-0.9.0' });
// A fixed salt, so two requests issue the identical ticket.
const FIXED_CRYPTO = Object.freeze({ createHmac, timingSafeEqual, randomUUID, randomBytes: (size) => Buffer.alloc(size, 0x5a) });

function bearer(wallet = PLAYER) {
  const { token } = issueSessionToken({ createHmac, timingSafeEqual }, { secret: SETTLE_SESSION_VALUE, wallet, nowMs: NOW, audience: 'lestersarcade:development' });
  return `Bearer ${token}`;
}

function seedHandler(db) {
  return seedApi.createHandler(async () => {
    const deps = await seedApi.buildDeps(fixtureEnv({ registry: REGISTRY }), { db, deployment: DEPLOYED, nowMs: NOW, crypto: FIXED_CRYPTO });
    deps.verify = createVerifyDouble();
    deps.catalog = createCatalogDouble();
    return deps;
  });
}

const post = (db) => invoke(seedHandler(db), { method: 'POST', url: '/api/ranked-seed', headers: { authorization: bearer(), 'x-forwarded-for': '203.0.113.7' }, body: { ...BODY } });

// A client that fails (or hangs until released) only the seed_ticket_log insert.
const hung = [];
function breakTicketLog(db, mode) {
  return {
    schemaKey: `${db.schemaKey}:${mode}`,
    query(sql, params) {
      if (/INSERT INTO seed_ticket_log/.test(sql)) {
        if (mode === 'hang') return new Promise((resolve) => { hung.push(() => resolve([])); });
        if (mode === 'missing') return Promise.reject(Object.assign(new Error('relation "seed_ticket_log" does not exist'), { code: '42P01' }));
        return Promise.reject(Object.assign(new Error(`connection to postgresql://owner:hunter2@db/neondb failed`), { code: '57P01', name: 'NeonDbError' }));
      }
      return db.query(sql, params);
    },
  };
}

async function captureErrors(run) {
  const logged = [];
  const original = console.error;
  console.error = (...args) => logged.push(args);
  try {
    return { result: await run(), logged };
  } finally {
    console.error = original;
  }
}

test('seed ticket logging never changes the seed response', async () => {
  const db = createPgliteClient();
  try {
    const first = await post(db);
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.deepEqual(Object.keys(first.body).sort(), ['ok', 'seed', 'seedTicket'], 'the E15 body is unchanged');
    await settleTicketLogs();
    const [row] = await readSessionTickets(db, { wallet: PLAYER, sessionHandle: SESSION });
    const { seedTicket, seed } = first.body;
    assert.deepEqual(
      [row.mac, row.wallet, row.sessionHandle, row.gameId, row.seasonId, row.buildHash, row.salt, row.issuedAtSeconds, row.weekKey],
      [seedTicket.mac, PLAYER, SESSION, 'chikun', BODY.seasonId, BODY.buildHash, seedTicket.salt, seedTicket.issuedAt, '2026-W40'],
      'the row is the ticket as issued',
    );
    // The logged row is enough to re-check the ticket (the screen's provenance check).
    const mac = createHmac('sha256', SETTLE_SESSION_VALUE).update(seedTicketMacInput({ sessionId: SESSION, wallet: PLAYER, gameId: 'chikun', seasonId: BODY.seasonId, buildHash: BODY.buildHash, salt: row.salt, issuedAt: row.issuedAtSeconds }), 'utf8').digest('hex');
    assert.equal(mac, row.mac);
    assert.equal(seed, await deriveRankedSeed({ sessionId: SESSION, wallet: PLAYER, gameId: 'chikun', seasonId: BODY.seasonId, buildHash: BODY.buildHash, salt: row.salt }));
    assert.equal(await countWalletTickets(db, { wallet: PLAYER, weekKey: '2026-W40' }), 1);

    // A database failure, a missing table and a hung insert: 200 and the same ticket, never an error body.
    for (const mode of ['fail', 'missing', 'hang']) {
      const started = Date.now();
      const { result, logged } = await captureErrors(() => post(breakTicketLog(db, mode)));
      assert.equal(result.status, 200, mode);
      assert.deepEqual(result.body, first.body, `${mode}: the very same ticket`);
      assert.ok(Date.now() - started < 5_000, `${mode}: answered without waiting for the log`);
      if (mode !== 'hang') {
        const settled = await captureErrors(() => settleTicketLogs());
        const lines = [...logged, ...settled.logged];
        if (mode === 'missing') assert.deepEqual(lines, [], 'a missing table is a silent no-op');
        else {
          assert.deepEqual(lines, [['[ranked-seed:ticket-log]', 'NeonDbError', '57P01']], 'logged as name and code only');
          assert.doesNotMatch(JSON.stringify(lines), /hunter2|postgresql/);
        }
      }
    }
    for (const release of hung.splice(0)) release();
    await settleTicketLogs();
    assert.equal((await db.query('SELECT count(*)::int AS n FROM seed_ticket_log')).at(0).n, 1, 'the duplicate ticket did not add a row');
  } finally {
    await db.close();
  }
});

test('the ticket log is best effort, validated and prunable', async () => {
  const db = createPgliteClient();
  try {
    // Before migration 3 the table is missing: a no-op, not an error.
    assert.deepEqual(await logSeedTicket(db, { wallet: PLAYER, sessionId: SESSION, gameId: 'chikun', seasonId: BODY.seasonId, buildHash: BODY.buildHash, seedTicket: { mac: 'ab'.repeat(32), salt: 'cd'.repeat(16), issuedAt: NOW / 1000 } }), { logged: false, reason: 'missing-table' });
    const post1 = await post(db);
    assert.equal(post1.status, 200);
    await settleTicketLogs();
    for (const bad of [
      { wallet: 'nope' }, { sessionId: 'game-session-x' }, { gameId: 'Chikun' }, { seedTicket: { mac: 'zz', salt: 'cd'.repeat(16), issuedAt: 1 } },
      { seedTicket: { mac: 'ab'.repeat(32), salt: 'cd'.repeat(16), issuedAt: -1 } }, { seasonId: '' }, { buildHash: 'x'.repeat(121) },
    ]) {
      const entry = { wallet: PLAYER, sessionId: SESSION, gameId: 'chikun', seasonId: BODY.seasonId, buildHash: BODY.buildHash, seedTicket: { mac: 'ef'.repeat(32), salt: 'cd'.repeat(16), issuedAt: NOW / 1000 }, ...bad };
      assert.deepEqual(await logSeedTicket(db, entry), { logged: false, reason: 'invalid' }, JSON.stringify(bad));
    }
    // The background call never rejects, even for a client that throws synchronously.
    const thrower = { query() { throw Object.assign(new Error('boom'), { code: 'XX000' }); } };
    const { result, logged } = await captureErrors(() => logSeedTicketInBackground(thrower, { wallet: PLAYER, sessionId: SESSION, gameId: 'chikun', seasonId: BODY.seasonId, buildHash: BODY.buildHash, seedTicket: { mac: 'ef'.repeat(32), salt: 'cd'.repeat(16), issuedAt: NOW / 1000 } }));
    assert.deepEqual(result, { logged: false, reason: 'error' });
    assert.deepEqual(logged, [['[ranked-seed:ticket-log]', 'Error', 'XX000']]);
    assert.deepEqual(await logSeedTicketInBackground(null, {}), { logged: false, reason: 'no-database' });

    assert.equal(await countTicketsBefore(db, { beforeIso: '2026-10-01T00:00:00Z' }), 1);
    assert.equal(await pruneTickets(db, { beforeIso: '2026-09-01T00:00:00Z' }), 0);
    assert.equal(await pruneTickets(db, { beforeIso: '2026-10-01T00:00:00Z' }), 1);
    assert.equal(await countWalletTickets(db, { wallet: PLAYER, weekKey: '2026-W40' }), 0);

    // Where the Vercel runtime exposes a request context, the insert is handed to its waitUntil, so a
    // function frozen after the response still finishes it (the promise is never awaited on the path).
    const CONTEXT = Symbol.for('@vercel/request-context');
    const registered = [];
    const entry = (mac) => ({ wallet: PLAYER, sessionId: SESSION, gameId: 'chikun', seasonId: BODY.seasonId, buildHash: BODY.buildHash, seedTicket: { mac, salt: 'cd'.repeat(16), issuedAt: NOW / 1000 } });
    globalThis[CONTEXT] = { get: () => ({ waitUntil: (promise) => { registered.push(promise); } }) };
    try {
      const background = logSeedTicketInBackground(db, entry('9a'.repeat(32)));
      assert.deepEqual([registered.length, registered[0] === background], [1, true]);
      assert.deepEqual(await background, { logged: true });
    } finally {
      delete globalThis[CONTEXT];
    }
    // A context that throws is plain fire and forget.
    globalThis[CONTEXT] = { get: () => { throw new Error('no context'); } };
    try {
      assert.deepEqual(await logSeedTicketInBackground(db, entry('9b'.repeat(32))), { logged: true });
    } finally {
      delete globalThis[CONTEXT];
    }
  } finally {
    await db.close();
  }
});

test('the settle path gains exactly one best-effort call', () => {
  const source = readFileSync(new URL('../server/settle/seed.mjs', import.meta.url), 'utf8');
  assert.equal((source.match(/logSeedTicketInBackground\(/g) ?? []).length, 1, 'one call');
  assert.doesNotMatch(source, /await\s+logSeedTicket/, 'never awaited');
  const call = source.indexOf('logSeedTicketInBackground(db');
  assert.ok(call > source.indexOf('await issueSeedTicket('), 'after issueSeedTicket succeeds');
  assert.ok(source.lastIndexOf('try {', call) > source.indexOf('await issueSeedTicket('), 'inside its own try/catch');
});

test('jackpot ops: dry runs, confirm phrases, the schema guard and the admin lock', async () => {
  const db = createPgliteClient();
  const lines = [];
  const ops = (argv) => runJackpotOps({ argv, db, out: (line) => lines.push(line), nowMs: NOW });
  const CONTRACT = `0x${'ab12'.repeat(10)}`;
  const TOKEN = { address: `0x${'7e'.repeat(20)}`, symbol: 'tCHIKUN', decimals: 18, testnet: true };
  const FAILED_WEEK = '2026-W39';
  const REVIEW_WEEK = '2026-W40';
  const session = (byte) => `0x${byte.repeat(32)}`;
  try {
    // Argument checks never touch the database.
    for (const argv of [[], ['nope'], ['requeue'], ['requeue', '--week', '2026-40'], ['rescreen', '--session', '0x12'], ['prune-tickets', '--older-than', '30d'], ['prune-tickets', '--older-than', '60'], ['status', '--apply']]) {
      assert.equal(parseJackpotOpsArgs(argv).ok, false, JSON.stringify(argv));
    }
    assert.equal(MIN_PRUNE_DAYS, 60);
    assert.deepEqual((await ops(['requeue', '--week', FAILED_WEEK, '--apply', '--confirm', 'WRONG'])).exitCode, 2);
    assert.match(lines.at(-1), /--apply needs --confirm REQUEUE_JACKPOT; nothing was written\./);
    assert.equal((await runJackpotOps({ argv: ['status'], env: {}, out: (line) => lines.push(line) })).exitCode, 2, 'no NEON_DATABASE_URL');

    // The schema guard: an unmigrated database is never read or written.
    assert.deepEqual(await ops(['status']), { exitCode: 1, changed: false });
    assert.match(lines.at(-1), /^schema not migrated \(version 0 of 3\)/);
    await migrate(db);

    // A failed week with a dead finalize, and a review week with two candidates.
    await ensureWeekRow(db, { contract: CONTRACT, weekIndex: weekIndexOfKey(FAILED_WEEK), token: TOKEN });
    assert.equal(await casWeekStatus(db, { contract: CONTRACT, weekKey: FAILED_WEEK, from: 'open', to: 'failed' }), true);
    const { action } = await createAction(db, { contract: CONTRACT, weekIndex: weekIndexOfKey(FAILED_WEEK), kind: 'finalize' });
    assert.equal(await casAction(db, { id: action.id, from: 'pending', to: 'dead', set: { last_error: 'rpc-timeout' } }), true);
    await ensureWeekRow(db, { contract: CONTRACT, weekIndex: weekIndexOfKey(REVIEW_WEEK), token: TOKEN });
    assert.equal(await casWeekStatus(db, { contract: CONTRACT, weekKey: REVIEW_WEEK, from: 'open', to: 'review' }), true);
    for (const [byte, score] of [['c1', 900], ['c2', 800]]) {
      await upsertCandidate(db, { contract: CONTRACT, weekKey: REVIEW_WEEK, sessionId32: session(byte), wallet: `0x${byte.repeat(20)}`, score, source: 'keeper' });
    }
    await db.query("UPDATE jackpot_candidates SET screen = 'hold', screen_codes = 'H3', review = 'flagged', admin_reviewed = true WHERE session_id32 = $1", [session('c1')]);
    await db.query("UPDATE jackpot_candidates SET screen = 'pass', review = 'cleared' WHERE session_id32 = $1", [session('c2')]);

    lines.length = 0;
    assert.deepEqual(await ops(['status']), { exitCode: 0, changed: false });
    assert.ok(lines.some((line) => line.startsWith(`${REVIEW_WEEK} ${CONTRACT.slice(0, 10)}… review`)), lines.join('\n'));
    assert.ok(lines.some((line) => line.includes(`${FAILED_WEEK}`) && line.includes('failed') && line.includes('dead 1')), lines.join('\n'));

    // requeue: a dry run changes nothing; the phrase moves the dead action and the failed week.
    assert.deepEqual(await ops(['requeue', '--week', FAILED_WEEK]), { exitCode: 0, changed: false });
    assert.equal((await readAction(db, action.id)).status, 'dead');
    assert.deepEqual(await ops(['requeue', '--week', FAILED_WEEK, '--apply', '--confirm', 'REQUEUE_JACKPOT']), { exitCode: 0, changed: true });
    assert.equal((await readAction(db, action.id)).status, 'pending');
    assert.equal((await readWeekRow(db, { contract: CONTRACT, weekKey: FAILED_WEEK })).status, 'selecting');

    // rescreen: never an admin-reviewed session; a dry run first; the phrase resets the screen.
    lines.length = 0;
    assert.deepEqual(await ops(['rescreen', '--session', session('c1'), '--apply', '--confirm', 'RESCREEN_JACKPOT']), { exitCode: 1, changed: false });
    assert.match(lines.join('\n'), /Refusing: the admin reviewed or disqualified this session/);
    assert.equal((await readCandidate(db, { contract: CONTRACT, sessionId32: session('c1') })).screen, 'hold');
    assert.deepEqual(await ops(['rescreen', '--session', session('c2')]), { exitCode: 0, changed: false });
    assert.equal((await readCandidate(db, { contract: CONTRACT, sessionId32: session('c2') })).screen, 'pass');
    assert.deepEqual(await ops(['rescreen', '--session', session('c2'), '--apply', '--confirm', 'RESCREEN_JACKPOT']), { exitCode: 0, changed: true });
    assert.equal((await readCandidate(db, { contract: CONTRACT, sessionId32: session('c2') })).screen, 'pending');
    assert.equal((await db.query('SELECT count(*)::int AS n FROM jackpot_actions WHERE session_id32 IS NOT NULL'))[0].n, 0, 'a rescreen creates no clear or flag itself');
    assert.equal((await ops(['rescreen', '--session', session('d9')])).exitCode, 1, 'not a candidate');

    // prune-tickets: counts first, deletes only with the phrase.
    await db.query(`INSERT INTO seed_ticket_log (mac, wallet, session_handle, game_id, season_id, build_hash, salt, week_key, issued_at)
      VALUES ($1, $2, $3, 'chikun', 'chikun-season-preview-1', 'site-1', $5, '2026-W27', $4::timestamptz)`, ['ab'.repeat(32), PLAYER, SESSION, new Date(NOW - 61 * 86_400_000).toISOString(), 'cd'.repeat(16)]);
    const before = await countTicketsBefore(db, { beforeIso: new Date(NOW - 60 * 86_400_000).toISOString() });
    assert.equal(before, 1, 'the 61-day-old row');
    lines.length = 0;
    assert.deepEqual(await ops(['prune-tickets', '--older-than', '60d']), { exitCode: 0, changed: false });
    assert.match(lines[0], new RegExp(`^seed_ticket_log: ${before} row\\(s\\) issued before`));
    assert.equal(await countTicketsBefore(db, { beforeIso: new Date(NOW - 60 * 86_400_000).toISOString() }), before);
    assert.equal((await ops(['prune-tickets', '--older-than', '60d', '--apply', '--confirm', 'PRUNE_TICKET_LOG'])).exitCode, 0);
    assert.equal(await countTicketsBefore(db, { beforeIso: new Date(NOW - 60 * 86_400_000).toISOString() }), 0);
    assert.doesNotMatch(lines.join('\n'), /postgres|npg_|NEON_DATABASE_URL=/);
  } finally {
    await db.close();
  }
});
