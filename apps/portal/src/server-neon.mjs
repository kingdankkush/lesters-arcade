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

// The schema lives in server/neon/migrations.mjs (contract §3). The legacy
// arcade_profiles document table is no longer created or read (D4).
