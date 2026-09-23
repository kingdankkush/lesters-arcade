#!/usr/bin/env node
// Owner moderation flags for one wallet (contract A29, runbook checkpoint O2).
//
//   node scripts/moderate-profile.mjs --wallet 0x… --hide      [--apply --confirm HIDE_PROFILE]
//   node scripts/moderate-profile.mjs --wallet 0x… --unhide    [--apply --confirm UNHIDE_PROFILE]
//   node scripts/moderate-profile.mjs --wallet 0x… --exclude   [--apply --confirm EXCLUDE_WALLET]
//   node scripts/moderate-profile.mjs --wallet 0x… --include   [--apply --confirm INCLUDE_WALLET]
//
// --hide / --unhide set wallet_profiles.hidden: the name and avatar disappear
// from every surface (boards, profile, session API, share page and card),
// while the wallet keeps its rank. --exclude / --include set board_excluded:
// the wallet never ranks and has no standing.
//
// A dry run by default. Writing needs --apply plus the action's confirm
// phrase (contract §11 rule 13). NEON_DATABASE_URL is read from the
// environment only and is never printed.

import { pathToFileURL } from 'node:url';
import { createNeonClient } from '../apps/portal/src/server-neon.mjs';
import { ensureSchema } from '../server/neon/migrations.mjs';

export const MODERATION_ACTIONS = Object.freeze({
  hide: Object.freeze({ column: 'hidden', value: true, confirm: 'HIDE_PROFILE' }),
  unhide: Object.freeze({ column: 'hidden', value: false, confirm: 'UNHIDE_PROFILE' }),
  exclude: Object.freeze({ column: 'board_excluded', value: true, confirm: 'EXCLUDE_WALLET' }),
  include: Object.freeze({ column: 'board_excluded', value: false, confirm: 'INCLUDE_WALLET' }),
});

export const USAGE = 'usage: node scripts/moderate-profile.mjs --wallet 0x… (--hide | --unhide | --exclude | --include) [--apply --confirm <PHRASE>]';

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
    else if (['--hide', '--unhide', '--exclude', '--include'].includes(flag) && inline === null) actions.push(flag.slice(2));
    else return { ok: false, error: `unknown argument ${flag}` };
  }
  if (actions.length !== 1) return { ok: false, error: 'choose exactly one of --hide, --unhide, --exclude, --include' };
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
    await ensureSchema(client);
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { exitCode } = await runModerateProfile();
  process.exitCode = exitCode;
}
