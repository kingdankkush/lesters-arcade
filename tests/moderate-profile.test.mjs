import assert from 'node:assert/strict';
import test from 'node:test';

import { HIDE_CACHE_NOTE, parseModerationArgs, runModerateProfile } from '../scripts/moderate-profile.mjs';
import { runNeonMigrate } from '../scripts/neon-migrate.mjs';
import { readLeaderboard } from '../server/neon/queries.mjs';
import { createPgliteClient, seedVerifiedSession, seedWalletProfile } from './helpers/pglite-client.mjs';

/**
 * Contract A29, §3.1, §11 rule 13 and runbook checkpoint O2: the owner's
 * moderation and migration scripts are dry runs by default, need a confirm
 * phrase to write, and never print the database URL.
 */

const WALLET = `0x${'c4'.repeat(20)}`;
const OTHER = `0x${'d5'.repeat(20)}`;
const PASSWORD = `npg_${'Kx9'.repeat(8)}`;
const NEON_URL = `postgresql://owner:${PASSWORD}@ep-owner-db-9.eu-central-1.aws.neon.tech/neondb?sslmode=require`;

function recorder() {
  const lines = [];
  return { lines, out: (line) => lines.push(String(line)), text: () => lines.join('\n') };
}

test('moderate-profile is a dry run by default and needs the confirm phrase to write', async () => {
  const db = createPgliteClient();
  try {
    await seedWalletProfile(db, { wallet: WALLET, displayName: 'Lit Pilot' });
    const dry = recorder();
    assert.equal((await runModerateProfile({ argv: ['--wallet', WALLET, '--hide'], db, out: dry.out })).exitCode, 0);
    assert.match(dry.text(), /dry run: would set hidden = true\. Re-run with --apply --confirm HIDE_PROFILE/);
    assert.match(dry.text(), /display name "Lit Pilot"/);
    assert.equal((await db.query('SELECT hidden FROM wallet_profiles WHERE wallet = $1', [WALLET]))[0].hidden, false, 'a dry run writes nothing');

    const unconfirmed = recorder();
    assert.equal((await runModerateProfile({ argv: ['--wallet', WALLET, '--hide', '--apply'], db, out: unconfirmed.out })).exitCode, 2);
    assert.match(unconfirmed.text(), /--apply needs --confirm HIDE_PROFILE/);
    assert.equal((await runModerateProfile({ argv: ['--wallet', WALLET, '--hide', '--apply', '--confirm', 'EXCLUDE_WALLET'], db, out: () => {} })).exitCode, 2, 'another action\'s phrase does not work');
    assert.equal((await db.query('SELECT hidden FROM wallet_profiles WHERE wallet = $1', [WALLET]))[0].hidden, false);
  } finally {
    await db.close();
  }
});

test('--hide and --unhide toggle the owner flag and explain share-card caching', async () => {
  const db = createPgliteClient();
  try {
    await seedWalletProfile(db, { wallet: WALLET, displayName: 'Lit Pilot' });
    const hide = recorder();
    const result = await runModerateProfile({ argv: [`--wallet=${WALLET.toUpperCase().replace('0X', '0x')}`, '--hide', '--apply', '--confirm=HIDE_PROFILE'], db, out: hide.out });
    assert.deepEqual(result, { exitCode: 0, changed: true });
    assert.match(hide.text(), /applied: hidden = true/);
    for (const line of HIDE_CACHE_NOTE) assert.ok(hide.lines.includes(line));
    assert.match(hide.text(), /within an hour \(s-maxage=3600\)/);
    assert.match(hide.text(), /purge/);
    const [row] = await db.query('SELECT hidden, board_excluded, display_name FROM wallet_profiles WHERE wallet = $1', [WALLET]);
    assert.deepEqual(row, { hidden: true, board_excluded: false, display_name: 'Lit Pilot' });
    const unhide = recorder();
    assert.deepEqual(await runModerateProfile({ argv: ['--wallet', WALLET, '--unhide', '--apply', '--confirm', 'UNHIDE_PROFILE'], db, out: unhide.out }), { exitCode: 0, changed: true });
    assert.equal(unhide.lines.some((line) => line.includes('purge')), false);
    assert.equal((await db.query('SELECT hidden FROM wallet_profiles WHERE wallet = $1', [WALLET]))[0].hidden, false);
  } finally {
    await db.close();
  }
});

test('--exclude removes a wallet from every board and --include restores it', async () => {
  const db = createPgliteClient();
  try {
    await seedVerifiedSession(db, { wallet: WALLET, score: 9000 });
    await seedVerifiedSession(db, { wallet: OTHER, score: 10 });
    const board = () => readLeaderboard(db, { gameId: 'chikun', seasonId: 'chikun-season-preview-1', period: 'all-time' });
    const exclude = recorder();
    assert.deepEqual(await runModerateProfile({ argv: ['--wallet', WALLET, '--exclude', '--apply', '--confirm', 'EXCLUDE_WALLET'], db, out: exclude.out }), { exitCode: 0, changed: true });
    assert.match(exclude.text(), /no profile row yet, 1 confirmed runs, board_excluded = false/);
    assert.deepEqual((await board()).rows.map((row) => [row.rank, row.wallet]), [[1, OTHER]]);
    const [row] = await db.query('SELECT hidden, board_excluded FROM wallet_profiles WHERE wallet = $1', [WALLET]);
    assert.deepEqual(row, { hidden: false, board_excluded: true });
    assert.deepEqual(await runModerateProfile({ argv: ['--wallet', WALLET, '--include', '--apply', '--confirm', 'INCLUDE_WALLET'], db, out: () => {} }), { exitCode: 0, changed: true });
    assert.deepEqual((await board()).rows.map((entry) => entry.wallet), [WALLET, OTHER]);
  } finally {
    await db.close();
  }
});

test('moderation usage errors and the database URL never leak', async () => {
  for (const argv of [[], ['--hide'], ['--wallet', '0x12', '--hide'], ['--wallet', WALLET], ['--wallet', WALLET, '--hide', '--exclude'], ['--wallet', WALLET, '--hide', '--force']]) {
    const log = recorder();
    assert.equal((await runModerateProfile({ argv, env: {}, out: log.out })).exitCode, 2, argv.join(' '));
    assert.match(log.text(), /usage: node scripts\/moderate-profile\.mjs/);
  }
  assert.deepEqual(parseModerationArgs(['--wallet', WALLET, '--exclude']), { ok: true, wallet: WALLET, action: 'exclude', apply: false, confirm: null });
  const missing = recorder();
  assert.equal((await runModerateProfile({ argv: ['--wallet', WALLET, '--hide'], env: {}, out: missing.out })).exitCode, 2);
  assert.match(missing.text(), /NEON_DATABASE_URL is not set/);
  const failing = recorder();
  const fetchImpl = async () => ({ ok: false, status: 500, json: async () => ({ message: `password authentication failed for ${NEON_URL}`, code: '28P01' }) });
  assert.equal((await runModerateProfile({ argv: ['--wallet', WALLET, '--hide'], env: { NEON_DATABASE_URL: NEON_URL }, fetchImpl, out: failing.out })).exitCode, 1);
  assert.equal(failing.text().includes(PASSWORD), false);
  assert.equal(failing.text().includes('ep-owner-db-9'), false);
  assert.match(failing.text(), /moderation failed \(28P01\)/);
});

test('neon-migrate applies versions once and never prints the URL', async () => {
  const db = createPgliteClient();
  try {
    const first = recorder();
    assert.deepEqual(await runNeonMigrate({ db, out: first.out }), { exitCode: 0, version: 1, applied: [1] });
    assert.deepEqual(first.lines, ['applied migrations: 1', 'schema version: 1']);
    const second = recorder();
    assert.deepEqual(await runNeonMigrate({ db, out: second.out }), { exitCode: 0, version: 1, applied: [] });
    assert.deepEqual(second.lines, ['no migrations to apply', 'schema version: 1']);
  } finally {
    await db.close();
  }
  const missing = recorder();
  assert.equal((await runNeonMigrate({ env: {}, out: missing.out })).exitCode, 2);
  const invalid = recorder();
  assert.equal((await runNeonMigrate({ env: { NEON_DATABASE_URL: `mysql://root:${PASSWORD}@db/x` }, out: invalid.out })).exitCode, 2);
  assert.equal(invalid.text().includes(PASSWORD), false);
  const failing = recorder();
  const fetchImpl = async () => ({ ok: false, status: 500, json: async () => ({ message: `connection to ${NEON_URL} failed`, code: '08006' }) });
  assert.equal((await runNeonMigrate({ env: { NEON_DATABASE_URL: NEON_URL }, fetchImpl, out: failing.out })).exitCode, 1);
  assert.deepEqual(failing.lines, ['migration failed (08006)']);
});
