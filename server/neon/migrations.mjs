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

export const MIGRATIONS = Object.freeze([
  Object.freeze({ version: 1, name: '0001_ranked_index', statements: Object.freeze(MIGRATION_0001) }),
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
