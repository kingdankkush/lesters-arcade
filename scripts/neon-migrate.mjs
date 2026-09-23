#!/usr/bin/env node
// Applies the versioned Neon migrations (contract §3.1, A34).
//
//   NEON_DATABASE_URL=… node scripts/neon-migrate.mjs
//
// The connection string is read from the environment only and is never
// printed; the output is the applied versions and the schema version. In
// production the migration step is the E12 cron call (§13 step 8b), because
// the database URL lives only in Vercel.

import { pathToFileURL } from 'node:url';
import { createNeonClient } from '../apps/portal/src/server-neon.mjs';
import { migrate } from '../server/neon/migrations.mjs';

export async function runNeonMigrate({ env = process.env, db = null, fetchImpl = globalThis.fetch, out = console.log } = {}) {
  let client = db;
  if (!client) {
    const url = typeof env.NEON_DATABASE_URL === 'string' ? env.NEON_DATABASE_URL.trim() : '';
    if (!url) {
      out('NEON_DATABASE_URL is not set; nothing was migrated.');
      return { exitCode: 2 };
    }
    try {
      client = createNeonClient({ connectionString: url, fetchImpl });
    } catch {
      out('NEON_DATABASE_URL is not a postgres connection string; nothing was migrated.');
      return { exitCode: 2 };
    }
  }
  try {
    const result = await migrate(client);
    out(result.applied.length ? `applied migrations: ${result.applied.join(', ')}` : 'no migrations to apply');
    out(`schema version: ${result.version}`);
    return { exitCode: 0, version: result.version, applied: result.applied };
  } catch (error) {
    // Error code only: a driver message could echo connection details.
    out(`migration failed (${error?.code ?? error?.name ?? 'error'})`);
    return { exitCode: 1 };
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { exitCode } = await runNeonMigrate();
  process.exitCode = exitCode;
}
