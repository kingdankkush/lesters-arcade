#!/usr/bin/env node
// Applies the versioned Neon migrations (contract §3.1, A34).
//
//   NEON_DATABASE_URL=… node scripts/neon-migrate.mjs                                    (dry run)
//   NEON_DATABASE_URL=… node scripts/neon-migrate.mjs --apply --confirm APPLY_MIGRATIONS
//
// A dry run by default (§11 rule 13): it reads schema_migrations with one
// SELECT, lists the pending versions and writes nothing. Applying needs
// --apply plus the confirm phrase. The connection string is read from the
// environment only and is never printed; the output is versions only. In
// production the migration step is the E12 cron call (§13 step 8b), because
// the database URL lives only in Vercel.

import { pathToFileURL } from 'node:url';
import { createNeonClient } from '../apps/portal/src/server-neon.mjs';
import { MIGRATIONS, migrate, readAppliedVersions } from '../server/neon/migrations.mjs';

export const APPLY_MIGRATIONS_CONFIRM = 'APPLY_MIGRATIONS';
export const NEON_MIGRATE_USAGE = `usage: node scripts/neon-migrate.mjs [--apply --confirm ${APPLY_MIGRATIONS_CONFIRM}]`;

export function parseNeonMigrateArgs(argv = []) {
  const options = { apply: false, confirm: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = String(argv[i]);
    const [flag, inline] = arg.includes('=') ? [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)] : [arg, null];
    if (flag === '--apply' && inline === null) options.apply = true;
    else if (flag === '--confirm') options.confirm = (inline !== null ? inline : argv[++i]) ?? null;
    else return { ok: false, error: `unknown argument ${flag}` };
  }
  return { ok: true, ...options };
}

export async function runNeonMigrate({ argv = process.argv.slice(2), env = process.env, db = null, fetchImpl = globalThis.fetch, out = console.log } = {}) {
  const args = parseNeonMigrateArgs(argv);
  if (!args.ok) {
    out(args.error);
    out(NEON_MIGRATE_USAGE);
    return { exitCode: 2 };
  }
  if (args.apply && args.confirm !== APPLY_MIGRATIONS_CONFIRM) {
    out(`--apply needs --confirm ${APPLY_MIGRATIONS_CONFIRM}; nothing was migrated.`);
    return { exitCode: 2 };
  }
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
    if (!args.apply) {
      const done = new Set(await readAppliedVersions(client));
      const pending = MIGRATIONS.filter((migration) => !done.has(migration.version)).map((migration) => migration.version);
      const version = Math.max(0, ...done);
      out(pending.length ? `pending migrations: ${pending.join(', ')}` : 'no migrations to apply');
      out(`schema version: ${version}`);
      if (pending.length) out(`dry run: nothing was migrated. Re-run with --apply --confirm ${APPLY_MIGRATIONS_CONFIRM} to apply.`);
      return { exitCode: 0, version, pending, applied: [] };
    }
    const result = await migrate(client);
    out(result.applied.length ? `applied migrations: ${result.applied.join(', ')}` : 'no migrations to apply');
    out(`schema version: ${result.version}`);
    return { exitCode: 0, version: result.version, pending: [], applied: result.applied };
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
