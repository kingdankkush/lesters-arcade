import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  JACKPOT_MIGRATION_NAME, JACKPOT_MIGRATION_VERSION, JACKPOT_TABLES, LATEST_SCHEMA_VERSION, MIGRATIONS, ensureSchema, migrate, readSchemaVersion,
} from '../server/neon/migrations.mjs';
import { ACTION_KINDS, actionId } from '../server/jackpot/store.mjs';
import { createPgliteClient, randomHex32 } from './helpers/pglite-client.mjs';

/**
 * jackpot-server AC1 (design §C.2): migration 3 is exactly the design's DDL,
 * it applies to fresh, version-1 and version-2 databases and is idempotent,
 * and the action id format passes its own CHECK for every kind.
 */

const CONTRACT = `0x${'1a2b3c4d'.repeat(5)}`;
const TOKEN = `0x${'7e'.repeat(20)}`;
const WALLET = `0x${'c4'.repeat(20)}`;
const INDEXES = ['jc_week', 'ja_due', 'je_week', 'stl_session', 'stl_week'];

async function withDb(run) {
  const db = createPgliteClient();
  try {
    await run(db);
  } finally {
    await db.close();
  }
}

async function tableNames(db) {
  return (await db.query("SELECT table_name::text AS name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1")).map((row) => row.name);
}

// The ```sql block of design §C.2, split at each CREATE, `--` comments
// dropped and whitespace collapsed (as the migration-1 test reads contract §3.2).
function designDdlStatements() {
  const doc = readFileSync(new URL('../docs/game-design/chikun-weekly-jackpot-design-20260924.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const section = doc.indexOf('### C.2 Neon migration 3');
  assert.ok(section >= 0, 'the design has a §C.2 migration section');
  const open = doc.indexOf('```sql\n', section);
  const close = doc.indexOf('\n```', open + 7);
  assert.ok(open > section && close > open, 'the §C.2 section has a sql block');
  return doc.slice(open + 7, close)
    .replace(/(^|\s)--\s.*$/gm, '')
    .split(/\n(?=CREATE )/)
    .map((statement) => statement.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

const normalize = (statement) => String(statement).replace(/\s+/g, ' ').trim();

test('migration 3 is exactly the design §C.2 DDL', () => {
  const expected = designDdlStatements();
  assert.equal(expected.length, 12, 'seven tables and five indexes');
  const migration = MIGRATIONS.find((entry) => entry.version === JACKPOT_MIGRATION_VERSION);
  assert.equal(JACKPOT_MIGRATION_VERSION, 3);
  assert.equal(migration.name, '0003_weekly_jackpot');
  assert.equal(JACKPOT_MIGRATION_NAME, '0003_weekly_jackpot');
  assert.equal(LATEST_SCHEMA_VERSION, 3);
  assert.deepEqual(migration.statements.map(normalize), expected);
  for (const statement of migration.statements) {
    assert.match(statement, /^CREATE (TABLE|INDEX) IF NOT EXISTS /, 'additive and idempotent');
    assert.doesNotMatch(statement, /\b(ALTER|DROP|UPDATE|DELETE|TRUNCATE|RENAME)\b/i, 'migration 3 never changes an older object');
  }
  assert.deepEqual(JACKPOT_TABLES, ['jackpot_weeks', 'jackpot_candidates', 'jackpot_actions', 'jackpot_events', 'jackpot_wallet_flags', 'jackpot_rules', 'seed_ticket_log']);
});

async function insertOneRowEach(db) {
  const session = randomHex32();
  await db.query(
    `INSERT INTO jackpot_weeks (contract, game_id, week_key, week_index, token_address, token_symbol, token_decimals, token_testnet,
        starts_at, closes_at, settle_cutoff_at, candidate_until, payout_at, status, funded_wei)
     VALUES ($1, 'chikun', '2026-W40', 2961, $2, 'tCHIKUN', 18, true, '2026-09-28T00:00:00Z', '2026-10-05T00:00:00Z',
        '2026-10-05T06:00:00Z', '2026-10-05T12:00:00Z', '2026-10-06T00:00:00Z', 'claim-pending', '10000000000000000000000')`,
    [CONTRACT, TOKEN],
  );
  await db.query(
    `INSERT INTO jackpot_candidates (contract, game_id, week_key, session_id32, wallet, score, source, on_chain, was_listed, chain_rank, review, review_reason, screen, screen_codes, features)
     VALUES ($1, 'chikun', '2026-W40', $2, $3, 48213, 'public', true, true, 1, 'flagged', 'screen-hold', 'hold', 'H2,H9', '{"survivalSeconds":1200}')`,
    [CONTRACT, session, WALLET],
  );
  await db.query(
    `INSERT INTO jackpot_events (tx_hash, log_index, block_number, block_time, contract, event, week_key, session_id32, wallet, amount_wei, reason)
     VALUES ($1, 0, 54400000, '2026-10-05T01:00:00Z', $2, 'Flagged', '2026-W40', $3, $4, NULL, 'screen-hold')`,
    [randomHex32(), CONTRACT, session, WALLET],
  );
  await db.query("INSERT INTO jackpot_wallet_flags (contract, wallet, blocked, staff_ever, reason) VALUES ($1, $2, true, false, 'funder')", [CONTRACT, WALLET]);
  await db.query(
    `INSERT INTO jackpot_rules (contract, from_week, season_id32, alt_season_id32, min_paid_wei, max_survival_s, max_score, max_prize_wei, min_fund_wei, admin_clear_only)
     VALUES ($1, 2961, $2, NULL, '100000000000000000', 3599, '0', '0', '100000000000000000000', true)`,
    [CONTRACT, randomHex32()],
  );
  await db.query(
    `INSERT INTO seed_ticket_log (mac, wallet, session_handle, game_id, season_id, build_hash, salt, issued_at, week_key)
     VALUES ($1, $2, 'game-session-0f0e0d0c-0b0a-4908-8706-050403020100', 'chikun', 'chikun-season-preview-1', 'site-1.8.1:game-1.8.1:cabinet-0.9.0', $3, '2026-09-30T12:00:00Z', '2026-W40')`,
    ['ab'.repeat(32), WALLET, 'cd'.repeat(16)],
  );
  return session;
}

test('jackpot migration applies to fresh and older databases, is idempotent, and accepts every action id kind', async () => {
  // Fresh.
  await withDb(async (db) => {
    assert.deepEqual(await migrate(db), { version: 3, applied: [1, 2, 3] });
    const tables = await tableNames(db);
    for (const table of JACKPOT_TABLES) assert.ok(tables.includes(table), table);
    const indexes = (await db.query("SELECT indexname::text AS name FROM pg_indexes WHERE schemaname = 'public'")).map((row) => row.name);
    for (const index of INDEXES) assert.ok(indexes.includes(index), index);
    const constraints = (await db.query("SELECT conname::text AS name FROM pg_constraint WHERE conrelid = 'jackpot_actions'::regclass")).map((row) => row.name);
    assert.ok(constraints.includes('ja_submitted_has_tx'));
    assert.deepEqual(await migrate(db), { version: 3, applied: [] }, 'applying twice is a no-op');
    for (const statement of MIGRATIONS[2].statements) await db.query(statement);
    assert.equal(await readSchemaVersion(db), 3);

    const session = await insertOneRowEach(db);
    // One real action id of every kind, with and without a session.
    const ids = [];
    for (const kind of ACTION_KINDS) {
      for (const sessionId32 of [session, null]) {
        const id = actionId({ contract: CONTRACT, weekIndex: 2961, kind, sessionId32 });
        ids.push(id);
        await db.query(
          "INSERT INTO jackpot_actions (id, contract, game_id, week_key, kind, session_id32, reason, status) VALUES ($1, $2, 'chikun', '2026-W40', $3, $4, $5, 'pending')",
          [id, CONTRACT, kind, sessionId32, kind === 'flag' ? 'screen-hold' : null],
        );
      }
    }
    assert.equal(ids[0], `chikun:1a2b3c4d:2961:submit:${session}`);
    assert.equal(ids[7], 'chikun:1a2b3c4d:2961:finalize:-');
    assert.ok(ids.every((id) => id.length <= 160 && /^[a-z0-9:-]{8,160}$/.test(id)));
    assert.equal((await db.query('SELECT count(*)::int AS n FROM jackpot_actions')).at(0).n, 8);
    for (const table of JACKPOT_TABLES) {
      assert.equal((await db.query(`SELECT count(*)::int AS n FROM ${table}`)).at(0).n > 0, true, `a row in ${table}`);
    }

    // The CHECKs reject what revision 1 got wrong, and malformed rows.
    const rejects = async (sql, params, label) => assert.rejects(db.query(sql, params), (error) => error.code === '23514', label);
    await rejects("INSERT INTO jackpot_actions (id, contract, game_id, week_key, kind, status) VALUES ('chikun:2026-W40:finalize', $1, 'chikun', '2026-W40', 'finalize', 'pending')", [CONTRACT], 'a week-key id (capital W) fails the id CHECK');
    await rejects("INSERT INTO jackpot_actions (id, contract, game_id, week_key, kind, status) VALUES ('chikun:1a2b3c4d:2961:finalize:x', $1, 'chikun', '2026-W40', 'finalize', 'submitted')", [CONTRACT], 'submitted needs a tx hash');
    await rejects("UPDATE jackpot_weeks SET status = 'closing'", [], 'unknown week status');
    await rejects("UPDATE jackpot_candidates SET screen_codes = 'h2; drop'", [], 'screen codes are H-codes only');
    await rejects("UPDATE jackpot_weeks SET extension_s = 259201", [], 'extension capped at 72 h');
    await rejects("UPDATE jackpot_weeks SET last_error = 'Some RPC https://x'", [], 'last_error is a code');
    await rejects("UPDATE jackpot_candidates SET score = 10000000001", [], 'score bound');
    await rejects("UPDATE seed_ticket_log SET session_handle = 'not-a-handle'", [], 'session handle shape');
  });

  // Version 1 (the live schema before 1.8.1) and version 2 (live today).
  for (const upTo of [1, 2]) {
    await withDb(async (db) => {
      for (const migration of MIGRATIONS.filter((entry) => entry.version <= upTo)) {
        for (const statement of migration.statements) await db.query(statement);
        await db.query('INSERT INTO schema_migrations (version, name) VALUES ($1::int, $2)', [String(migration.version), migration.name]);
      }
      assert.equal(await readSchemaVersion(db), upTo);
      const expected = upTo === 1 ? [2, 3] : [3];
      assert.deepEqual(await ensureSchema(db), 3);
      assert.deepEqual((await db.query('SELECT version::int AS v FROM schema_migrations ORDER BY 1')).map((row) => row.v), [1, 2, 3]);
      const tables = await tableNames(db);
      for (const table of JACKPOT_TABLES) assert.ok(tables.includes(table), `${table} after upgrading v${upTo} (${expected.join(', ')})`);
      await insertOneRowEach(db);
    });
  }
});
