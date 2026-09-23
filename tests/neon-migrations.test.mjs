import assert from 'node:assert/strict';
import test from 'node:test';

import { LATEST_SCHEMA_VERSION, MIGRATIONS, ensureSchema, migrate, readSchemaVersion } from '../server/neon/migrations.mjs';
import { createPgliteClient, randomHex32 } from './helpers/pglite-client.mjs';

/**
 * Contract §3.1-§3.3 and A34: migration 1 is the whole Neon schema, applying
 * it twice is a no-op, the CHECK constraints reject malformed rows, and the
 * settle slice's single-statement insert is atomic across the session, its
 * evidence and its achievement unlocks.
 */

const TABLES = ['schema_migrations', 'verified_sessions', 'session_evidence', 'wallet_profiles', 'achievement_unlocks', 'auth_nonces', 'rate_limits', 'relayer_lease', 'indexer_state'];
const INDEXES = ['vs_board_all', 'vs_board_week', 'vs_board_month', 'vs_board_day', 'vs_wallet_game', 'vs_queue', 'vs_tx_hash', 'wp_display_name', 'au_session', 'au_nft_unminted', 'auth_nonces_expiry'];
const REVISION_2_COLUMNS = ['infra_failures', 'resigns', 'opened_at', 'entry_amount_wei', 'client_claim', 'plausibility', 'chain_mismatch'];

test('migration 1 creates every table, index and constraint', async () => {
  const db = createPgliteClient();
  try {
    assert.equal(MIGRATIONS[0].version, 1);
    assert.equal(MIGRATIONS[0].name, '0001_ranked_index');
    assert.equal(await readSchemaVersion(db), 0, 'a missing schema_migrations table reads as version 0');
    const result = await migrate(db);
    assert.deepEqual(result, { version: 1, applied: [1] });
    const tables = (await db.query("SELECT table_name::text AS name FROM information_schema.tables WHERE table_schema = 'public'")).map((row) => row.name);
    for (const table of TABLES) assert.ok(tables.includes(table), `table ${table}`);
    assert.equal(tables.includes('arcade_profiles'), false, 'D4 clean slate: the legacy profile table is gone');
    const indexes = (await db.query("SELECT indexname::text AS name FROM pg_indexes WHERE schemaname = 'public'")).map((row) => row.name);
    for (const index of INDEXES) assert.ok(indexes.includes(index), `index ${index}`);
    const constraints = (await db.query("SELECT conname::text AS name FROM pg_constraint WHERE conrelid = 'verified_sessions'::regclass")).map((row) => row.name);
    for (const name of ['vs_confirmed_has_time', 'vs_submitted_has_tx']) assert.ok(constraints.includes(name), `constraint ${name}`);
    const columns = (await db.query("SELECT column_name::text AS name FROM information_schema.columns WHERE table_name = 'verified_sessions'")).map((row) => row.name);
    for (const column of REVISION_2_COLUMNS) assert.ok(columns.includes(column), `revision-2 column ${column}`);
    for (const column of ['last_error', 'next_attempt_at', 'last_checked_at', 'source', 'attestation']) assert.ok(columns.includes(column), column);
    const wpColumns = (await db.query("SELECT column_name::text AS name FROM information_schema.columns WHERE table_name = 'wallet_profiles'")).map((row) => row.name);
    for (const column of ['name_blocked', 'board_excluded', 'hidden', 'preferences', 'profile_block']) assert.ok(wpColumns.includes(column), column);
  } finally {
    await db.close();
  }
});

test('migrate is idempotent and records the version', async () => {
  const db = createPgliteClient();
  try {
    assert.deepEqual(await migrate(db), { version: 1, applied: [1] });
    assert.deepEqual(await migrate(db), { version: 1, applied: [] }, 'applying twice is a no-op');
    const rows = await db.query('SELECT version::int AS version, name FROM schema_migrations ORDER BY version');
    assert.deepEqual(rows, [{ version: 1, name: '0001_ranked_index' }]);
    assert.equal(await readSchemaVersion(db), LATEST_SCHEMA_VERSION);
    assert.equal(await ensureSchema(db), 1);
  } finally {
    await db.close();
  }
});

test('ensureSchema migrates only when behind, memoizes per schemaKey and forgets failures', async () => {
  const db = createPgliteClient();
  const statements = [];
  const spy = { schemaKey: db.schemaKey, async query(sql, params) { statements.push(sql.trim().split(/\s+/).slice(0, 2).join(' ')); return db.query(sql, params); } };
  try {
    assert.equal(await ensureSchema(spy), 1);
    const firstRun = statements.length;
    assert.ok(statements.some((sql) => sql.startsWith('CREATE TABLE')), 'the first call migrates');
    assert.equal(await ensureSchema(spy), 1);
    assert.equal(statements.length, firstRun, 'the memo hits for the same schemaKey');

    // A second client on the same database (new process) only checks the version.
    const fresh = [];
    const other = { schemaKey: `${db.schemaKey}:other-process`, async query(sql, params) { fresh.push(sql); return db.query(sql, params); } };
    assert.equal(await ensureSchema(other), 1);
    assert.equal(fresh.length, 1, 'an up-to-date database needs one version read and no DDL');

    let fail = true;
    const flaky = { schemaKey: `flaky:${db.schemaKey}`, async query(sql, params) { if (fail) throw Object.assign(new Error('boom'), { code: '08006' }); return db.query(sql, params); } };
    await assert.rejects(ensureSchema(flaky), /boom/);
    fail = false;
    assert.equal(await ensureSchema(flaky), 1, 'a failure clears the memo');
  } finally {
    await db.close();
  }
});

test('migrate retries a version once when a concurrent creator wins the catalog race', async () => {
  const db = createPgliteClient();
  let raced = false;
  const racing = {
    schemaKey: db.schemaKey,
    async query(sql, params) {
      if (!raced && sql.includes('CREATE TABLE IF NOT EXISTS verified_sessions')) {
        raced = true;
        await db.query(sql, params);
        throw Object.assign(new Error('duplicate key value violates unique constraint "pg_type_typname_nsp_index"'), { code: '23505' });
      }
      return db.query(sql, params);
    },
  };
  try {
    assert.deepEqual(await migrate(racing), { version: 1, applied: [1] });
    assert.equal(raced, true);
    const fresh = createPgliteClient();
    let attempts = 0;
    const failing = {
      async query(sql, params) {
        if (sql.includes('CREATE INDEX IF NOT EXISTS vs_board_all')) { attempts += 1; throw Object.assign(new Error('permission denied'), { code: '42501' }); }
        return fresh.query(sql, params);
      },
    };
    await assert.rejects(migrate(failing), /permission denied/);
    assert.equal(attempts, 1, 'other errors are never retried');
    await fresh.close();
  } finally {
    await db.close();
  }
});

async function insertSession(db, overrides = {}) {
  const values = {
    session_id32: randomHex32(), wallet: `0x${'ab'.repeat(20)}`, game_id: 'chikun', status: 'pending', score: '10',
    envelope_hash: randomHex32(), day_key: '2026-09-23', week_key: '2026-W39', month_key: '2026-09', confirmed_at: null, tx_hash: null,
    ...overrides,
  };
  return db.query(
    `INSERT INTO verified_sessions (session_id32, wallet, game_id, season_id, runtime_id, score, envelope_hash, day_key, week_key, month_key, status, confirmed_at, tx_hash)
     VALUES ($1,$2,$3,'chikun-season-preview-1','chikun:canvas-runtime-v7',$4::bigint,$5,$6,$7,$8,$9,$10::timestamptz,$11)`,
    [values.session_id32, values.wallet, values.game_id, values.score, values.envelope_hash, values.day_key, values.week_key, values.month_key, values.status, values.confirmed_at, values.tx_hash],
  );
}

test('constraints reject malformed ids, statuses and scores', async () => {
  const db = createPgliteClient();
  try {
    await migrate(db);
    await insertSession(db);
    const rejects = async (overrides, label) => {
      await assert.rejects(insertSession(db, overrides), (error) => error.code === '23514' || error.code === '23502', label);
    };
    await rejects({ session_id32: `0x${'A'.repeat(64)}` }, 'uppercase session id');
    await rejects({ session_id32: 'game-session-1' }, 'handle as session id');
    await rejects({ wallet: `0x${'AB'.repeat(20)}` }, 'checksummed wallet');
    await rejects({ game_id: 'tetris' }, 'unknown game');
    await rejects({ status: 'done' }, 'unknown status');
    await rejects({ score: '10000000001' }, 'score above the contract MAX_SCORE');
    await rejects({ score: '-1' }, 'negative score');
    await rejects({ week_key: '2026-39' }, 'malformed week key');
    await rejects({ status: 'confirmed' }, 'confirmed without confirmed_at');
    await rejects({ status: 'submitted' }, 'submitted without tx_hash');
    await rejects({ envelope_hash: 'abc' }, 'malformed envelope hash');
    await assert.rejects(
      db.query("UPDATE verified_sessions SET last_error = 'Error: connect ECONNREFUSED https://rpc.example/key'"),
      (error) => error.code === '23514',
      'last_error only takes allowlisted codes',
    );
    await db.query("UPDATE verified_sessions SET last_error = 'rpc-timeout'");
    await assert.rejects(
      db.query("INSERT INTO wallet_profiles (wallet, display_name) VALUES ($1, 'ab')", [`0x${'cd'.repeat(20)}`]),
      (error) => error.code === '23514',
      'display names are 3-18 characters',
    );
    await assert.rejects(
      db.query("INSERT INTO wallet_profiles (wallet, avatar_uri) VALUES ($1, 'https://evil.example/x.png')", [`0x${'cd'.repeat(20)}`]),
      (error) => error.code === '23514',
      'avatars are lestersarcade:avatar ids only',
    );
    await assert.rejects(
      db.query("INSERT INTO wallet_profiles (wallet, name_blocked) VALUES ($1, 'spam')", [`0x${'cd'.repeat(20)}`]),
      (error) => error.code === '23514',
      'name_blocked is profanity or impersonation',
    );
  } finally {
    await db.close();
  }
});

// The exact §3.3 statement the settle slice runs.
const SETTLE_INSERT_SQL = `WITH s AS (
  INSERT INTO verified_sessions (session_id32, session_handle, wallet, game_id, season_id, runtime_id, build_hash, seed,
      score, kills, max_combo, survival_seconds, boss_id, stats, envelope_hash, achievements, nft_achievements,
      day_key, week_key, month_key, status, verified_at, opened_at, entry_amount_wei, client_claim, plausibility)
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8::bigint,$9::bigint,$10::bigint,$11::bigint,$12::bigint,$13,$14::jsonb,$15,
          ARRAY(SELECT jsonb_array_elements_text($16::jsonb)), ARRAY(SELECT jsonb_array_elements_text($17::jsonb)),
          $18,$19,$20,'pending',$21::timestamptz,$28::timestamptz,$29,$30::jsonb,$31::jsonb)
  ON CONFLICT (session_id32) DO NOTHING
  RETURNING session_id32, wallet, game_id
), e AS (
  INSERT INTO session_evidence (session_id32, encoding, evidence, evidence_bytes, evidence_digest, identity)
  SELECT session_id32, $22, $23, $24::int, $25, $26::jsonb FROM s
  RETURNING session_id32
), u AS (
  INSERT INTO achievement_unlocks (wallet, game_id, achievement_id, session_id32, tier, nft, unlocked_at)
  SELECT s.wallet, s.game_id, a.id, s.session_id32, a.tier, a.nft, $21::timestamptz
  FROM s CROSS JOIN jsonb_to_recordset($27::jsonb) AS a(id text, tier text, nft boolean)
  ON CONFLICT (wallet, game_id, achievement_id) DO NOTHING
  RETURNING achievement_id
)
SELECT (SELECT count(*)::int FROM s) AS inserted,
       (SELECT coalesce(array_to_json(array_agg(achievement_id)), '[]'::json)::text FROM u) AS unlocked;`;

function settleParams({ sessionId32 = randomHex32(), wallet = `0x${'ab'.repeat(20)}`, evidenceBytes = '42', unlocks = [{ id: 'chikun-first-flight', tier: 'bronze', nft: false }, { id: 'chikun-coast-legend', tier: 'platinum', nft: true }] } = {}) {
  return [
    sessionId32, 'game-session-3f0c1d2e-4b5a-4c6d-8e7f-0123456789ab', wallet, 'chikun', 'chikun-season-preview-1', 'chikun:canvas-runtime-v7',
    'site-1.7.0:game-1.7.0:cabinet-0.9.0', '305419896', '19475', '88', '12', '240', null,
    JSON.stringify({ score: 19475, forksPassed: 88 }), randomHex32(), JSON.stringify(unlocks.map((unlock) => unlock.id)), JSON.stringify(unlocks.filter((unlock) => unlock.nft).map((unlock) => unlock.id)),
    '2026-09-23', '2026-W39', '2026-09', '2026-09-23T10:05:00.000Z',
    'chikun-flap-evidence-v6+json', '{"version":"chikun-flap-evidence-v6"}', evidenceBytes, randomHex32(), JSON.stringify({ version: 'lesters-canonical-session-v1' }),
    JSON.stringify(unlocks), '2026-09-23T10:00:00.000Z', '100100000000000000', JSON.stringify({ score: 19475 }), null,
  ];
}

test('the settle insert CTE is atomic across session, evidence and unlocks', async () => {
  const db = createPgliteClient();
  try {
    await migrate(db);
    const params = settleParams();
    assert.equal(params.length, 31);
    assert.ok(params.every((value) => value === null || typeof value === 'string'), 'A15: string or null parameters only');
    const [first] = await db.query(SETTLE_INSERT_SQL, params);
    assert.equal(first.inserted, 1);
    assert.deepEqual(JSON.parse(first.unlocked).sort(), ['chikun-coast-legend', 'chikun-first-flight']);
    const [session] = await db.query('SELECT status, array_to_json(achievements)::text AS achievements, array_to_json(nft_achievements)::text AS nft, opened_at IS NOT NULL AS opened, client_claim::text AS claim FROM verified_sessions WHERE session_id32 = $1', [params[0]]);
    assert.equal(session.status, 'pending');
    assert.deepEqual(JSON.parse(session.nft), ['chikun-coast-legend']);
    assert.equal(session.opened, true);
    assert.deepEqual(JSON.parse(session.claim), { score: 19475 });
    assert.equal((await db.query('SELECT count(*)::int AS n FROM session_evidence WHERE session_id32 = $1', [params[0]]))[0].n, 1);

    const [again] = await db.query(SETTLE_INSERT_SQL, params);
    assert.equal(again.inserted, 0, 'a duplicate session inserts nothing (idempotent path)');
    assert.deepEqual(JSON.parse(again.unlocked), []);

    // A later session of the same wallet records only achievements that are new.
    const second = settleParams({ unlocks: [{ id: 'chikun-first-flight', tier: 'bronze', nft: false }, { id: 'chikun-near-miss-10', tier: 'silver', nft: false }] });
    const [later] = await db.query(SETTLE_INSERT_SQL, second);
    assert.deepEqual(JSON.parse(later.unlocked), ['chikun-near-miss-10'], 'achievement_unlocks is the authority for first earned');

    // Evidence that violates its CHECK aborts the whole statement: no session row and no unlocks.
    const bad = settleParams({ evidenceBytes: '0', wallet: `0x${'cd'.repeat(20)}` });
    await assert.rejects(db.query(SETTLE_INSERT_SQL, bad), (error) => error.code === '23514');
    assert.equal((await db.query('SELECT count(*)::int AS n FROM verified_sessions WHERE session_id32 = $1', [bad[0]]))[0].n, 0);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM achievement_unlocks WHERE wallet = $1', [`0x${'cd'.repeat(20)}`]))[0].n, 0);

    // An unlock with an invalid tier rolls back the session and its evidence too.
    const badTier = settleParams({ wallet: `0x${'ef'.repeat(20)}`, unlocks: [{ id: 'chikun-first-flight', tier: 'legendary', nft: false }] });
    await assert.rejects(db.query(SETTLE_INSERT_SQL, badTier), (error) => error.code === '23514');
    assert.equal((await db.query('SELECT count(*)::int AS n FROM session_evidence WHERE session_id32 = $1', [badTier[0]]))[0].n, 0);
  } finally {
    await db.close();
  }
});
