// Versioned Neon migrations (contract §3.1, §3.2, A34).
//
// Every statement is idempotent and is sent as its own call, because the Neon
// HTTP endpoint runs one statement per request. ensureSchema() is memoized per
// process by db.schemaKey, reads the applied version first, and migrates only
// when behind. CREATE ... IF NOT EXISTS is not race-safe in Postgres, so a
// version is retried once when a concurrent creator wins the catalog race.

const MIGRATION_0001 = [
  `CREATE TABLE IF NOT EXISTS schema_migrations (
  version     INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
)`,
  `CREATE TABLE IF NOT EXISTS verified_sessions (
  session_id32      TEXT PRIMARY KEY CHECK (session_id32 ~ '^0x[0-9a-f]{64}$'),
  session_handle    TEXT NULL CHECK (session_handle IS NULL OR session_handle ~ '^game-session-[0-9a-f-]{36}$'),
  wallet            TEXT NOT NULL CHECK (wallet ~ '^0x[0-9a-f]{40}$'),
  game_id           TEXT NOT NULL CHECK (game_id IN ('lester-blaster','chikun','stacked')),
  season_id         TEXT NOT NULL CHECK (char_length(season_id) BETWEEN 1 AND 64),
  runtime_id        TEXT NOT NULL CHECK (char_length(runtime_id) BETWEEN 1 AND 96),
  build_hash        TEXT NULL CHECK (build_hash IS NULL OR char_length(build_hash) <= 128),
  seed              BIGINT NULL CHECK (seed IS NULL OR seed BETWEEN 0 AND 4294967295),
  score             BIGINT NOT NULL CHECK (score BETWEEN 0 AND 10000000000),
  kills             BIGINT NOT NULL DEFAULT 0 CHECK (kills BETWEEN 0 AND 100000),
  max_combo         BIGINT NOT NULL DEFAULT 0 CHECK (max_combo BETWEEN 0 AND 10000),
  survival_seconds  BIGINT NOT NULL DEFAULT 0 CHECK (survival_seconds BETWEEN 0 AND 86400),
  boss_id           TEXT NULL CHECK (boss_id IS NULL OR char_length(boss_id) <= 64),
  stats             JSONB NOT NULL DEFAULT '{}'::jsonb,
  envelope_hash     TEXT NOT NULL CHECK (envelope_hash ~ '^0x[0-9a-f]{64}$'),
  achievements      TEXT[] NOT NULL DEFAULT '{}',
  nft_achievements  TEXT[] NOT NULL DEFAULT '{}',
  day_key           TEXT NOT NULL CHECK (day_key ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  week_key          TEXT NOT NULL CHECK (week_key ~ '^[0-9]{4}-W[0-9]{2}$'),
  month_key         TEXT NOT NULL CHECK (month_key ~ '^[0-9]{4}-[0-9]{2}$'),
  status            TEXT NOT NULL CHECK (status IN ('pending','signed','submitted','confirmed','failed')),
  source            TEXT NOT NULL DEFAULT 'settle' CHECK (source IN ('settle','chain-index')),
  attestation       JSONB NULL,
  tx_hash           TEXT NULL CHECK (tx_hash IS NULL OR tx_hash ~ '^0x[0-9a-f]{64}$'),
  tx_nonce          BIGINT NULL,
  block_number      BIGINT NULL,
  relayer           TEXT NULL CHECK (relayer IS NULL OR relayer ~ '^0x[0-9a-f]{40}$'),
  attempts          INTEGER NOT NULL DEFAULT 0,
  last_error        TEXT NULL CHECK (last_error IS NULL OR last_error ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  infra_failures    INTEGER NOT NULL DEFAULT 0,
  resigns           INTEGER NOT NULL DEFAULT 0,
  opened_at         TIMESTAMPTZ NULL,
  entry_amount_wei  TEXT NULL CHECK (entry_amount_wei IS NULL OR entry_amount_wei ~ '^[0-9]{1,78}$'),
  client_claim      JSONB NULL,
  plausibility      JSONB NULL,
  chain_mismatch    BOOLEAN NOT NULL DEFAULT false,
  next_attempt_at   TIMESTAMPTZ NULL,
  last_checked_at   TIMESTAMPTZ NULL,
  verified_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at      TIMESTAMPTZ NULL,
  confirmed_at      TIMESTAMPTZ NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT vs_confirmed_has_time CHECK (status <> 'confirmed' OR confirmed_at IS NOT NULL),
  CONSTRAINT vs_submitted_has_tx   CHECK (status <> 'submitted' OR tx_hash IS NOT NULL)
)`,
  `CREATE INDEX IF NOT EXISTS vs_board_all   ON verified_sessions (game_id, season_id, score DESC, confirmed_at ASC) WHERE status = 'confirmed'`,
  `CREATE INDEX IF NOT EXISTS vs_board_week  ON verified_sessions (game_id, season_id, week_key,  score DESC, confirmed_at ASC) WHERE status = 'confirmed'`,
  `CREATE INDEX IF NOT EXISTS vs_board_month ON verified_sessions (game_id, season_id, month_key, score DESC, confirmed_at ASC) WHERE status = 'confirmed'`,
  `CREATE INDEX IF NOT EXISTS vs_board_day   ON verified_sessions (game_id, season_id, day_key,   score DESC, confirmed_at ASC) WHERE status = 'confirmed'`,
  `CREATE INDEX IF NOT EXISTS vs_wallet_game ON verified_sessions (wallet, game_id, verified_at DESC)`,
  `CREATE INDEX IF NOT EXISTS vs_queue       ON verified_sessions (status, next_attempt_at) WHERE status IN ('pending','signed','submitted','failed')`,
  `CREATE INDEX IF NOT EXISTS vs_tx_hash     ON verified_sessions (tx_hash) WHERE tx_hash IS NOT NULL`,
  `CREATE TABLE IF NOT EXISTS session_evidence (
  session_id32     TEXT PRIMARY KEY REFERENCES verified_sessions(session_id32) ON DELETE CASCADE,
  encoding         TEXT NOT NULL CHECK (encoding IN ('chikun-flap-evidence-v6+json','stacked-sic1+base64','hmh-run-summary-v6+json')),
  evidence         TEXT NOT NULL,
  evidence_bytes   INTEGER NOT NULL CHECK (evidence_bytes BETWEEN 1 AND 1800000),
  evidence_digest  TEXT NOT NULL CHECK (evidence_digest ~ '^0x[0-9a-f]{64}$'),
  identity         JSONB NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
)`,
  `CREATE TABLE IF NOT EXISTS wallet_profiles (
  wallet              TEXT PRIMARY KEY CHECK (wallet ~ '^0x[0-9a-f]{40}$'),
  display_name        TEXT NULL CHECK (display_name IS NULL OR char_length(display_name) BETWEEN 3 AND 18),
  handle_hash         TEXT NULL CHECK (handle_hash IS NULL OR handle_hash ~ '^0x[0-9a-f]{64}$'),
  avatar_uri          TEXT NULL CHECK (avatar_uri IS NULL OR avatar_uri ~ '^lestersarcade:avatar/[a-z0-9-]{1,32}$'),
  profile_block       BIGINT NULL,
  onchain_updated_at  TIMESTAMPTZ NULL,
  preferences         JSONB NOT NULL DEFAULT '{}'::jsonb,
  hidden              BOOLEAN NOT NULL DEFAULT false,
  name_blocked        TEXT NULL CHECK (name_blocked IS NULL OR name_blocked IN ('profanity','impersonation')),
  board_excluded      BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
)`,
  `CREATE INDEX IF NOT EXISTS wp_display_name ON wallet_profiles (lower(display_name))`,
  `CREATE TABLE IF NOT EXISTS achievement_unlocks (
  wallet          TEXT NOT NULL CHECK (wallet ~ '^0x[0-9a-f]{40}$'),
  game_id         TEXT NOT NULL CHECK (game_id IN ('lester-blaster','chikun','stacked')),
  achievement_id  TEXT NOT NULL CHECK (achievement_id ~ '^[a-z0-9][a-z0-9-]{1,63}$'),
  session_id32    TEXT NOT NULL REFERENCES verified_sessions(session_id32),
  tier            TEXT NOT NULL CHECK (tier IN ('bronze','silver','gold','platinum','diamond','mythic')),
  nft             BOOLEAN NOT NULL DEFAULT false,
  unlocked_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  token_id        TEXT NULL CHECK (token_id IS NULL OR token_id ~ '^[0-9]{1,78}$'),
  mint_tx_hash    TEXT NULL CHECK (mint_tx_hash IS NULL OR mint_tx_hash ~ '^0x[0-9a-f]{64}$'),
  minted_at       TIMESTAMPTZ NULL,
  PRIMARY KEY (wallet, game_id, achievement_id)
)`,
  `CREATE INDEX IF NOT EXISTS au_session      ON achievement_unlocks (session_id32)`,
  `CREATE INDEX IF NOT EXISTS au_nft_unminted ON achievement_unlocks (game_id, achievement_id) WHERE nft AND token_id IS NULL`,
  `CREATE TABLE IF NOT EXISTS auth_nonces (
  nonce       TEXT PRIMARY KEY CHECK (nonce ~ '^[0-9a-f]{72}$'),
  wallet      TEXT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ NOT NULL DEFAULT now()
)`,
  `CREATE INDEX IF NOT EXISTS auth_nonces_expiry ON auth_nonces (expires_at)`,
  `CREATE TABLE IF NOT EXISTS rate_limits (
  bucket        TEXT NOT NULL CHECK (char_length(bucket) <= 128),
  window_start  TIMESTAMPTZ NOT NULL,
  hits          INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, window_start)
)`,
  `CREATE TABLE IF NOT EXISTS relayer_lease (
  relayer      TEXT PRIMARY KEY CHECK (relayer ~ '^0x[0-9a-f]{40}$'),
  holder       TEXT NULL,
  lease_until  TIMESTAMPTZ NOT NULL DEFAULT 'epoch',
  next_nonce   BIGINT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
)`,
  `CREATE TABLE IF NOT EXISTS indexer_state (
  stream      TEXT PRIMARY KEY,
  last_block  BIGINT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
)`,
];

// Migration 2 (ops-health, post-launch): cron run bookkeeping for
// /api/health and the owner status page. Additive only: one new table, no
// change to any version-1 table, so the index-chain cron (or the first
// ensureSchema after the deploy) applies it safely to the live v1 database.
// last_error_code holds an allowlisted code (A31) or an error name plus a
// SQLSTATE, never raw error text (server/ops/cron-runs.mjs).
const MIGRATION_0002 = [
  `CREATE TABLE IF NOT EXISTS cron_runs (
  name             TEXT PRIMARY KEY CHECK (name ~ '^[a-z][a-z0-9-]{0,47}$'),
  last_ok_at       TIMESTAMPTZ NULL,
  last_error_at    TIMESTAMPTZ NULL,
  last_error_code  TEXT NULL CHECK (last_error_code IS NULL OR last_error_code ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$'),
  runs             INTEGER NOT NULL DEFAULT 0 CHECK (runs >= 0),
  failures         INTEGER NOT NULL DEFAULT 0 CHECK (failures >= 0),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
)`,
];

// Migration 3 (jackpot-server; Chikun Weekly Jackpot design §C.2, rev. 2):
// the jackpot mirrors, keyed by contract (J7), the rules mirror and the
// seed-ticket log, exactly the design's DDL. Additive only: seven new tables
// and their indexes, nothing that touches a version-1 or version-2 object.
// The version number lives in JACKPOT_MIGRATION_VERSION alone, so a merge
// that finds 3 taken renumbers this migration in one place.
export const JACKPOT_MIGRATION_VERSION = 3;
export const JACKPOT_MIGRATION_NAME = `${String(JACKPOT_MIGRATION_VERSION).padStart(4, '0')}_weekly_jackpot`;
export const JACKPOT_TABLES = Object.freeze(['jackpot_weeks', 'jackpot_candidates', 'jackpot_actions', 'jackpot_events', 'jackpot_wallet_flags', 'jackpot_rules', 'seed_ticket_log']);
const MIGRATION_JACKPOT = [
  `CREATE TABLE IF NOT EXISTS jackpot_weeks (
  contract         TEXT NOT NULL CHECK (contract ~ '^0x[0-9a-f]{40}$'),
  game_id          TEXT NOT NULL CHECK (game_id IN ('chikun')),
  week_key         TEXT NOT NULL CHECK (week_key ~ '^[0-9]{4}-W[0-9]{2}$'),
  week_index       INTEGER NOT NULL CHECK (week_index > 0),
  token_address    TEXT NOT NULL CHECK (token_address ~ '^0x[0-9a-f]{40}$'),
  token_symbol     TEXT NOT NULL CHECK (token_symbol ~ '^[A-Za-z0-9$]{1,16}$'),
  token_decimals   INTEGER NOT NULL CHECK (token_decimals BETWEEN 0 AND 36),
  token_testnet    BOOLEAN NOT NULL,
  starts_at        TIMESTAMPTZ NOT NULL,
  closes_at        TIMESTAMPTZ NOT NULL,
  settle_cutoff_at TIMESTAMPTZ NOT NULL,
  candidate_until  TIMESTAMPTZ NOT NULL,
  payout_at        TIMESTAMPTZ NOT NULL,
  status           TEXT NOT NULL CHECK (status IN ('open','closed','selecting','review','awaiting-admin','finalizing','paid','claim-pending','rolled','unfunded','failed')),
  funded_wei       TEXT NOT NULL DEFAULT '0' CHECK (funded_wei ~ '^[0-9]{1,78}$'),
  carried_in_wei   TEXT NOT NULL DEFAULT '0' CHECK (carried_in_wei ~ '^[0-9]{1,78}$'),
  prize_wei        TEXT NULL CHECK (prize_wei IS NULL OR prize_wei ~ '^[0-9]{1,78}$'),
  unclaimed_wei    TEXT NOT NULL DEFAULT '0' CHECK (unclaimed_wei ~ '^[0-9]{1,78}$'),
  winner           TEXT NULL CHECK (winner IS NULL OR winner ~ '^0x[0-9a-f]{40}$'),
  winning_session  TEXT NULL CHECK (winning_session IS NULL OR winning_session ~ '^0x[0-9a-f]{64}$'),
  winning_score    BIGINT NULL,
  finalize_tx_hash TEXT NULL CHECK (finalize_tx_hash IS NULL OR finalize_tx_hash ~ '^0x[0-9a-f]{64}$'),
  finalized_at     TIMESTAMPTZ NULL,
  rolled_to_week   TEXT NULL CHECK (rolled_to_week IS NULL OR rolled_to_week ~ '^[0-9]{4}-W[0-9]{2}$'),
  held             BOOLEAN NOT NULL DEFAULT false,
  extension_s      INTEGER NOT NULL DEFAULT 0 CHECK (extension_s BETWEEN 0 AND 259200),
  last_error       TEXT NULL CHECK (last_error IS NULL OR last_error ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  admin_waiting_since TIMESTAMPTZ NULL,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (contract, week_key)
)`,
  `CREATE TABLE IF NOT EXISTS jackpot_candidates (
  contract       TEXT NOT NULL CHECK (contract ~ '^0x[0-9a-f]{40}$'),
  game_id        TEXT NOT NULL CHECK (game_id IN ('chikun')),
  week_key       TEXT NOT NULL CHECK (week_key ~ '^[0-9]{4}-W[0-9]{2}$'),
  session_id32   TEXT NOT NULL CHECK (session_id32 ~ '^0x[0-9a-f]{64}$'),
  wallet         TEXT NOT NULL CHECK (wallet ~ '^0x[0-9a-f]{40}$'),
  score          BIGINT NOT NULL CHECK (score BETWEEN 0 AND 10000000000),
  submitted_at   TIMESTAMPTZ NULL,
  source         TEXT NOT NULL CHECK (source IN ('keeper','public')),
  on_chain       BOOLEAN NOT NULL DEFAULT false,
  was_listed     BOOLEAN NOT NULL DEFAULT false,
  chain_rank     INTEGER NULL CHECK (chain_rank IS NULL OR chain_rank BETWEEN 1 AND 5),
  review         TEXT NOT NULL DEFAULT 'none' CHECK (review IN ('none','cleared','flagged','disqualified')),
  review_reason  TEXT NULL CHECK (review_reason IS NULL OR review_reason ~ '^[a-z][a-z0-9-]{1,31}$'),
  admin_reviewed BOOLEAN NOT NULL DEFAULT false,
  screen         TEXT NOT NULL DEFAULT 'pending' CHECK (screen IN ('pending','pass','hold','integrity-fail','error')),
  screen_codes   TEXT NOT NULL DEFAULT '' CHECK (screen_codes ~ '^[A-Z0-9,]{0,64}$'),
  features       JSONB NULL,
  screened_at    TIMESTAMPTZ NULL,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (contract, session_id32)
)`,
  `CREATE INDEX IF NOT EXISTS jc_week ON jackpot_candidates (contract, week_key, score DESC)`,
  `CREATE TABLE IF NOT EXISTS jackpot_actions (
  id              TEXT PRIMARY KEY CHECK (id ~ '^[a-z0-9:-]{8,160}$'),
  contract        TEXT NOT NULL CHECK (contract ~ '^0x[0-9a-f]{40}$'),
  game_id         TEXT NOT NULL CHECK (game_id IN ('chikun')),
  week_key        TEXT NOT NULL CHECK (week_key ~ '^[0-9]{4}-W[0-9]{2}$'),
  kind            TEXT NOT NULL CHECK (kind IN ('submit','clear','flag','finalize')),
  session_id32    TEXT NULL CHECK (session_id32 IS NULL OR session_id32 ~ '^0x[0-9a-f]{64}$'),
  reason          TEXT NULL CHECK (reason IS NULL OR reason ~ '^[a-z][a-z0-9-]{1,31}$'),
  status          TEXT NOT NULL CHECK (status IN ('pending','signed','submitted','confirmed','skipped','failed','dead')),
  keeper          TEXT NULL CHECK (keeper IS NULL OR keeper ~ '^0x[0-9a-f]{40}$'),
  tx_hash         TEXT NULL CHECK (tx_hash IS NULL OR tx_hash ~ '^0x[0-9a-f]{64}$'),
  tx_nonce        BIGINT NULL,
  attempts        INTEGER NOT NULL DEFAULT 0,
  infra_failures  INTEGER NOT NULL DEFAULT 0,
  last_error      TEXT NULL CHECK (last_error IS NULL OR last_error ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  next_attempt_at TIMESTAMPTZ NULL,
  submitted_at    TIMESTAMPTZ NULL,
  confirmed_at    TIMESTAMPTZ NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ja_submitted_has_tx CHECK (status <> 'submitted' OR tx_hash IS NOT NULL)
)`,
  `CREATE INDEX IF NOT EXISTS ja_due ON jackpot_actions (status, next_attempt_at) WHERE status IN ('pending','signed','submitted','failed')`,
  `CREATE TABLE IF NOT EXISTS jackpot_events (
  tx_hash       TEXT NOT NULL CHECK (tx_hash ~ '^0x[0-9a-f]{64}$'),
  log_index     INTEGER NOT NULL,
  block_number  BIGINT NOT NULL,
  block_time    TIMESTAMPTZ NOT NULL,
  contract      TEXT NOT NULL CHECK (contract ~ '^0x[0-9a-f]{40}$'),
  event         TEXT NOT NULL CHECK (event ~ '^[A-Za-z]{3,32}$'),
  week_key      TEXT NULL CHECK (week_key IS NULL OR week_key ~ '^[0-9]{4}-W[0-9]{2}$'),
  session_id32  TEXT NULL CHECK (session_id32 IS NULL OR session_id32 ~ '^0x[0-9a-f]{64}$'),
  wallet        TEXT NULL CHECK (wallet IS NULL OR wallet ~ '^0x[0-9a-f]{40}$'),
  amount_wei    TEXT NULL CHECK (amount_wei IS NULL OR amount_wei ~ '^[0-9]{1,78}$'),
  reason        TEXT NULL CHECK (reason IS NULL OR reason ~ '^[a-z][a-z0-9-]{0,31}$'),
  PRIMARY KEY (tx_hash, log_index)
)`,
  `CREATE INDEX IF NOT EXISTS je_week ON jackpot_events (contract, week_key, block_number)`,
  `CREATE TABLE IF NOT EXISTS jackpot_wallet_flags (
  contract    TEXT NOT NULL CHECK (contract ~ '^0x[0-9a-f]{40}$'),
  wallet      TEXT NOT NULL CHECK (wallet ~ '^0x[0-9a-f]{40}$'),
  blocked     BOOLEAN NOT NULL DEFAULT false,
  staff_ever  BOOLEAN NOT NULL DEFAULT false,
  reason      TEXT NULL CHECK (reason IS NULL OR reason ~ '^[a-z][a-z0-9-]{0,31}$'),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (contract, wallet)
)`,
  `CREATE TABLE IF NOT EXISTS jackpot_rules (
  contract          TEXT NOT NULL CHECK (contract ~ '^0x[0-9a-f]{40}$'),
  from_week         INTEGER NOT NULL CHECK (from_week > 0),
  season_id32       TEXT NOT NULL CHECK (season_id32 ~ '^0x[0-9a-f]{64}$'),
  alt_season_id32   TEXT NULL CHECK (alt_season_id32 IS NULL OR alt_season_id32 ~ '^0x[0-9a-f]{64}$'),
  min_paid_wei      TEXT NOT NULL CHECK (min_paid_wei ~ '^[0-9]{1,78}$'),
  max_survival_s    INTEGER NOT NULL CHECK (max_survival_s >= 0),
  max_score         TEXT NOT NULL CHECK (max_score ~ '^[0-9]{1,78}$'),
  max_prize_wei     TEXT NOT NULL CHECK (max_prize_wei ~ '^[0-9]{1,78}$'),
  min_fund_wei      TEXT NOT NULL CHECK (min_fund_wei ~ '^[0-9]{1,78}$'),
  admin_clear_only  BOOLEAN NOT NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (contract, from_week)
)`,
  `CREATE TABLE IF NOT EXISTS seed_ticket_log (
  mac            TEXT PRIMARY KEY CHECK (mac ~ '^[0-9a-f]{64}$'),
  wallet         TEXT NOT NULL CHECK (wallet ~ '^0x[0-9a-f]{40}$'),
  session_handle TEXT NOT NULL CHECK (session_handle ~ '^game-session-[0-9a-f-]{36}$'),
  game_id        TEXT NOT NULL CHECK (game_id ~ '^[a-z0-9-]{1,40}$'),
  season_id      TEXT NOT NULL CHECK (length(season_id) BETWEEN 1 AND 80),
  build_hash     TEXT NOT NULL CHECK (length(build_hash) BETWEEN 1 AND 120),
  salt           TEXT NOT NULL CHECK (salt ~ '^[0-9a-f]{32}$'),
  issued_at      TIMESTAMPTZ NOT NULL,
  week_key       TEXT NOT NULL CHECK (week_key ~ '^[0-9]{4}-W[0-9]{2}$'),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
)`,
  `CREATE INDEX IF NOT EXISTS stl_session ON seed_ticket_log (wallet, session_handle)`,
  `CREATE INDEX IF NOT EXISTS stl_week ON seed_ticket_log (game_id, week_key, wallet)`,
];

export const MIGRATIONS = Object.freeze([
  Object.freeze({ version: 1, name: '0001_ranked_index', statements: Object.freeze(MIGRATION_0001) }),
  Object.freeze({ version: 2, name: '0002_cron_runs', statements: Object.freeze(MIGRATION_0002) }),
  Object.freeze({ version: JACKPOT_MIGRATION_VERSION, name: JACKPOT_MIGRATION_NAME, statements: Object.freeze(MIGRATION_JACKPOT) }),
]);

export const LATEST_SCHEMA_VERSION = MIGRATIONS.reduce((max, migration) => Math.max(max, migration.version), 0);

// Duplicate table / object and unique-violation races on the catalog.
export const MIGRATION_RETRY_SQLSTATES = Object.freeze(['42P07', '42710', '23505']);

function isMissingRelation(error) {
  return error?.code === '42P01' || /relation "?schema_migrations"? does not exist/i.test(String(error?.message ?? ''));
}

function isRetryableRace(error) {
  return MIGRATION_RETRY_SQLSTATES.includes(String(error?.code ?? ''));
}

// Applied version, treating a missing schema_migrations table as 0.
export async function readSchemaVersion(db) {
  try {
    const rows = await db.query('SELECT coalesce(max(version), 0)::int AS v FROM schema_migrations');
    return Number(rows[0]?.v ?? 0);
  } catch (error) {
    if (isMissingRelation(error)) return 0;
    throw error;
  }
}

// Applied versions in ascending order, [] when schema_migrations is missing.
// One SELECT and no DDL: the owner scripts' dry runs use it (§11 rule 13).
export async function readAppliedVersions(db) {
  try {
    const rows = await db.query('SELECT version::int AS version FROM schema_migrations ORDER BY version');
    return rows.map((row) => Number(row.version));
  } catch (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
}

async function applyVersion(db, migration) {
  for (const statement of migration.statements) await db.query(statement);
  await db.query('INSERT INTO schema_migrations (version, name) VALUES ($1::int, $2) ON CONFLICT DO NOTHING', [String(migration.version), migration.name]);
}

// Applies every missing version in order. Returns { version, applied }.
export async function migrate(db) {
  if (!db || typeof db.query !== 'function') throw new TypeError('migrate needs a database client');
  try {
    await db.query(MIGRATION_0001[0]);
  } catch (error) {
    if (!isRetryableRace(error)) throw error;
    await db.query(MIGRATION_0001[0]);
  }
  const rows = await db.query('SELECT version::int AS version FROM schema_migrations');
  const done = new Set(rows.map((row) => Number(row.version)));
  const applied = [];
  for (const migration of [...MIGRATIONS].sort((a, b) => a.version - b.version)) {
    if (done.has(migration.version)) continue;
    try {
      await applyVersion(db, migration);
    } catch (error) {
      if (!isRetryableRace(error)) throw error;
      await applyVersion(db, migration);
    }
    applied.push(migration.version);
  }
  return { version: Math.max(0, ...done, ...applied), applied };
}

const memoByKey = new Map();
const memoByClient = new WeakMap();

// Guarantees the schema exists before the first query (A34). Memoized per
// process by db.schemaKey; a failure clears the memo so the next request
// tries again. Resolves to the schema version.
export function ensureSchema(db) {
  if (!db || typeof db.query !== 'function') return Promise.reject(new TypeError('ensureSchema needs a database client'));
  const key = typeof db.schemaKey === 'string' && db.schemaKey ? db.schemaKey : null;
  const existing = key ? memoByKey.get(key) : memoByClient.get(db);
  if (existing) return existing;
  const pending = (async () => {
    const version = await readSchemaVersion(db);
    if (version >= LATEST_SCHEMA_VERSION) return version;
    return (await migrate(db)).version;
  })();
  if (key) memoByKey.set(key, pending); else memoByClient.set(db, pending);
  pending.catch(() => {
    if (key) { if (memoByKey.get(key) === pending) memoByKey.delete(key); }
    else if (memoByClient.get(db) === pending) memoByClient.delete(db);
  });
  return pending;
}
