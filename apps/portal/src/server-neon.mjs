// Minimal Neon (Vercel Postgres) client over the Neon HTTP SQL endpoint.
// No dependency: a fetch POST to https://<host>/sql with the connection
// string in a header. Used only by the api/ functions; fails closed when
// NEON_DATABASE_URL is absent so local and preview builds stay database-free.

export function neonEndpointFor(connectionString) {
  const url = new URL(String(connectionString));
  if (!/^postgres(ql)?:$/.test(url.protocol) || !url.hostname) throw new TypeError('NEON_DATABASE_URL must be a postgres connection string');
  return `https://${url.hostname}/sql`;
}

// Identifies the database for the per-process schema memo (contract A34):
// host plus database name, never the user or password.
export function neonSchemaKeyFor(connectionString) {
  const url = new URL(String(connectionString));
  return `neon:${url.hostname}${url.pathname || '/'}`;
}

export function createNeonClient({ connectionString, fetchImpl = globalThis.fetch } = {}) {
  if (!connectionString) return null;
  const endpoint = neonEndpointFor(connectionString);
  if (typeof fetchImpl !== 'function') throw new TypeError('fetch is required');
  return Object.freeze({
    schemaKey: neonSchemaKeyFor(connectionString),
    async query(sql, params = []) {
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'Neon-Connection-String': connectionString, 'Neon-Raw-Text-Output': 'false', 'Neon-Array-Mode': 'false' },
        body: JSON.stringify({ query: sql, params }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        const error = new Error(`neon ${response.status}: ${body?.message ?? 'query failed'}`);
        // The SQLSTATE lets migrate() retry catalog races (A34).
        if (/^[0-9A-Z]{5}$/.test(String(body?.code ?? ''))) error.code = body.code;
        throw error;
      }
      return body?.rows ?? [];
    },
  });
}

export const PROFILE_SCHEMA_SQL = `CREATE TABLE IF NOT EXISTS arcade_profiles (
  wallet TEXT PRIMARY KEY,
  document JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`;

export async function ensureProfileSchema(client) {
  await client.query(PROFILE_SCHEMA_SQL);
}

export async function readProfile(client, wallet) {
  const rows = await client.query('SELECT wallet, document, updated_at FROM arcade_profiles WHERE wallet = $1', [wallet]);
  return rows[0] ?? null;
}

export async function writeProfile(client, wallet, document) {
  const rows = await client.query(
    'INSERT INTO arcade_profiles (wallet, document, updated_at) VALUES ($1, $2::jsonb, now()) ON CONFLICT (wallet) DO UPDATE SET document = EXCLUDED.document, updated_at = now() RETURNING wallet, updated_at',
    [wallet, JSON.stringify(document)],
  );
  return rows[0] ?? null;
}
