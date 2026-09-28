#!/usr/bin/env node
// Owner moderation flags for one wallet (contract A29, runbook checkpoint O2).
//
//   node scripts/moderate-profile.mjs --wallet 0x… --hide      [--apply --confirm HIDE_PROFILE]
//   node scripts/moderate-profile.mjs --wallet 0x… --unhide    [--apply --confirm UNHIDE_PROFILE]
//   node scripts/moderate-profile.mjs --wallet 0x… --exclude   [--apply --confirm EXCLUDE_WALLET]
//   node scripts/moderate-profile.mjs --wallet 0x… --include   [--apply --confirm INCLUDE_WALLET]
//   node scripts/moderate-profile.mjs --wallet 0x… --hide-avatar   [--apply --confirm HIDE_AVATAR]
//   node scripts/moderate-profile.mjs --wallet 0x… --unhide-avatar [--apply --confirm UNHIDE_AVATAR]
//
// --hide / --unhide set wallet_profiles.hidden: the name and avatar disappear
// from every surface (boards, profile, session API, share page and card),
// while the wallet keeps its rank. --exclude / --include set board_excluded:
// the wallet never ranks and has no standing. --hide-avatar / --unhide-avatar
// set avatar_uploads.hidden (1.9.3 custom avatars, migration 4): the upload is
// no longer served or shown anywhere (the on-chain preset shows instead), and
// the wallet can neither replace nor delete it until it is unhidden.
//
// A dry run by default: it only SELECTs. Writing needs --apply plus the
// action's confirm phrase (contract §11 rule 13). The script never migrates:
// on a database whose schema is behind it stops before any write, and the
// migration belongs to the E12 cron (§13 step 8b) or scripts/neon-migrate.mjs.
// NEON_DATABASE_URL is read from the environment only and is never printed.

import { pathToFileURL } from 'node:url';
import { createNeonClient } from '../apps/portal/src/server-neon.mjs';
import { LATEST_SCHEMA_VERSION, readSchemaVersion } from '../server/neon/migrations.mjs';

export const MODERATION_ACTIONS = Object.freeze({
  hide: Object.freeze({ column: 'hidden', value: true, confirm: 'HIDE_PROFILE' }),
  unhide: Object.freeze({ column: 'hidden', value: false, confirm: 'UNHIDE_PROFILE' }),
  exclude: Object.freeze({ column: 'board_excluded', value: true, confirm: 'EXCLUDE_WALLET' }),
  include: Object.freeze({ column: 'board_excluded', value: false, confirm: 'INCLUDE_WALLET' }),
  'hide-avatar': Object.freeze({ table: 'avatar_uploads', column: 'hidden', value: true, confirm: 'HIDE_AVATAR' }),
  'unhide-avatar': Object.freeze({ table: 'avatar_uploads', column: 'hidden', value: false, confirm: 'UNHIDE_AVATAR' }),
});
const ACTION_FLAGS = Object.freeze(Object.keys(MODERATION_ACTIONS).map((action) => `--${action}`));

export const USAGE = 'usage: node scripts/moderate-profile.mjs --wallet 0x… (--hide | --unhide | --exclude | --include | --hide-avatar | --unhide-avatar) [--apply --confirm <PHRASE>]';

// A custom avatar's image URL is cached as immutable; reads stop naming it at once.
export const AVATAR_CACHE_NOTE = [
  'Boards, profiles and session reads stop returning the avatar within seconds; share pages within 5 minutes.',
  'The image URL itself (/api/avatar?wallet=…&v=…) is cached as immutable: purge the project\'s CDN cache',
  'in the Vercel dashboard (project Settings, Caches) or with the Vercel CLI (`vercel cache purge`) to stop serving it at once.',
];

export const HIDE_CACHE_NOTE = [
  'Cached copies expire on their own: the share card within an hour (s-maxage=3600), the share page and',
  '/api/session within 5 minutes (s-maxage=300), boards and profiles within seconds.',
  'For immediate removal, purge the project\'s CDN cache in the Vercel dashboard (project Settings, Caches)',
  'or with the Vercel CLI (`vercel cache purge`). The session\'s card URL also changes (new ?v= revision).',
];

export function parseModerationArgs(argv = []) {
  const options = { wallet: null, action: null, apply: false, confirm: null };
  const actions = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = String(argv[i]);
    const [flag, inline] = arg.includes('=') ? [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)] : [arg, null];
    const value = () => (inline !== null ? inline : argv[++i]);
    if (flag === '--wallet') options.wallet = value() ?? null;
    else if (flag === '--confirm') options.confirm = value() ?? null;
    else if (flag === '--apply' && inline === null) options.apply = true;
    else if (ACTION_FLAGS.includes(flag) && inline === null) actions.push(flag.slice(2));
    else return { ok: false, error: `unknown argument ${flag}` };
  }
  if (actions.length !== 1) return { ok: false, error: `choose exactly one of ${ACTION_FLAGS.join(', ')}` };
  if (!/^0x[0-9a-fA-F]{40}$/.test(String(options.wallet ?? ''))) return { ok: false, error: '--wallet must be a 0x address' };
  return { ok: true, wallet: options.wallet.toLowerCase(), action: actions[0], apply: options.apply, confirm: options.confirm };
}

export async function runModerateProfile({ argv = process.argv.slice(2), env = process.env, db = null, fetchImpl = globalThis.fetch, out = console.log } = {}) {
  const args = parseModerationArgs(argv);
  if (!args.ok) {
    out(args.error);
    out(USAGE);
    return { exitCode: 2 };
  }
  const plan = MODERATION_ACTIONS[args.action];
  if (args.apply && args.confirm !== plan.confirm) {
    out(`--apply needs --confirm ${plan.confirm}; nothing was written.`);
    return { exitCode: 2 };
  }
  let client = db;
  if (!client) {
    const url = typeof env.NEON_DATABASE_URL === 'string' ? env.NEON_DATABASE_URL.trim() : '';
    if (!url) {
      out('NEON_DATABASE_URL is not set.');
      return { exitCode: 2 };
    }
    try {
      client = createNeonClient({ connectionString: url, fetchImpl });
    } catch {
      out('NEON_DATABASE_URL is not a postgres connection string.');
      return { exitCode: 2 };
    }
  }
  try {
    const version = await readSchemaVersion(client);
    if (version < LATEST_SCHEMA_VERSION) {
      out(`schema not migrated (version ${version} of ${LATEST_SCHEMA_VERSION}); run the E12 cron or scripts/neon-migrate.mjs first. Nothing was written.`);
      return { exitCode: 1, changed: false };
    }
    if (plan.table === 'avatar_uploads') return await moderateAvatar(client, args, plan, out);
    const [current] = await client.query('SELECT hidden, board_excluded, display_name FROM wallet_profiles WHERE wallet = $1', [args.wallet]);
    const [runs] = await client.query("SELECT count(*)::int AS confirmed FROM verified_sessions WHERE wallet = $1 AND status = 'confirmed'", [args.wallet]);
    const before = current ? current[plan.column] === true : false;
    const label = current?.display_name ? `display name "${current.display_name}"` : (current ? 'no display name' : 'no profile row yet');
    out(`${args.wallet}: ${label}, ${runs?.confirmed ?? 0} confirmed runs, ${plan.column} = ${before}.`);
    if (!args.apply) {
      out(`dry run: would set ${plan.column} = ${plan.value}. Re-run with --apply --confirm ${plan.confirm} to write.`);
      if (args.action === 'hide') for (const line of HIDE_CACHE_NOTE) out(line);
      return { exitCode: 0, changed: false };
    }
    const [row] = await client.query(
      `INSERT INTO wallet_profiles (wallet, ${plan.column}, updated_at) VALUES ($1, $2::boolean, now())
       ON CONFLICT (wallet) DO UPDATE SET ${plan.column} = EXCLUDED.${plan.column}, updated_at = now()
       RETURNING hidden, board_excluded`,
      [args.wallet, plan.value ? 'true' : 'false'],
    );
    out(`applied: ${plan.column} = ${row?.[plan.column]} for ${args.wallet}.`);
    if (args.action === 'hide') for (const line of HIDE_CACHE_NOTE) out(line);
    return { exitCode: 0, changed: before !== plan.value };
  } catch (error) {
    out(`moderation failed (${error?.code ?? error?.name ?? 'error'})`);
    return { exitCode: 1 };
  }
}

// --hide-avatar / --unhide-avatar: flips avatar_uploads.hidden on an existing
// upload (a wallet without one has nothing to hide).
async function moderateAvatar(client, args, plan, out) {
  const [current] = await client.query('SELECT hidden, content_type, width, height FROM avatar_uploads WHERE wallet = $1', [args.wallet]);
  if (!current) {
    out(`${args.wallet}: no custom avatar uploaded; nothing to change.`);
    return { exitCode: 0, changed: false };
  }
  const before = current.hidden === true;
  out(`${args.wallet}: custom avatar ${current.content_type} ${current.width}x${current.height}, hidden = ${before}.`);
  if (!args.apply) {
    out(`dry run: would set avatar hidden = ${plan.value}. Re-run with --apply --confirm ${plan.confirm} to write.`);
    if (plan.value) for (const line of AVATAR_CACHE_NOTE) out(line);
    return { exitCode: 0, changed: false };
  }
  const [row] = await client.query(
    'UPDATE avatar_uploads SET hidden = $2::boolean, updated_at = now() WHERE wallet = $1 RETURNING hidden',
    [args.wallet, plan.value ? 'true' : 'false'],
  );
  out(`applied: avatar hidden = ${row?.hidden} for ${args.wallet}.`);
  if (plan.value) for (const line of AVATAR_CACHE_NOTE) out(line);
  return { exitCode: 0, changed: before !== plan.value };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { exitCode } = await runModerateProfile();
  process.exitCode = exitCode;
}
