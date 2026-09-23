import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ethers } from 'ethers';

import * as achievements from '../apps/portal/src/achievements/index.mjs';
import { startLocalStack, writeLocalAddressModule } from '../scripts/lib/local-stack.mjs';
import { localWalletKeys } from '../scripts/lib/local-chain.mjs';
import {
  achievementLabels, BACKFILL_CONFIRM, countNftFlagDrift, loadNftIdsByGame, planBackfillMints, resyncNftFlags, runBackfillCli,
} from '../scripts/backfill-nft-mints.mjs';
import { approvedCatalogModule, approvedSubset, PHASE2_GAME, PHASE2_TEST_SETUP, rehearseNftPhase2 } from '../scripts/rehearse-nft-phase2.mjs';
import { createPgliteClient, seedVerifiedSession } from './helpers/pglite-client.mjs';
import { migrate } from '../server/neon/migrations.mjs';
import { renderLitvmAddressModule, resolveDeploymentInput } from '../scripts/generate-litvm-addresses.mjs';

/**
 * Rehearsal slice, acceptance 5: phase 2 (soulbound NFTs) rehearsed on the local stack after one
 * settled run. The backfill follows the owner-approved catalog at run time, never the stored phase-1
 * `nft` flag (contract A20): one row approved in phase 2 although phase 1 proposed it nft:false, and
 * one proposed nft:true that is not approved (labelled test setup: platinum and mythic achievements
 * are not earnable in a short run). The definitions and the backfill go through the real operator
 * CLIs over a loopback JSON-RPC proxy with public fixture keys; nothing touches LiteForge or Neon.
 */

const REGISTRIES = Object.freeze({ 'lester-blaster': `0x${'a1'.repeat(20)}`, chikun: `0x${'b2'.repeat(20)}`, stacked: `0x${'c3'.repeat(20)}` });
const DEPLOYMENT = Object.freeze({ status: 'deployed', addresses: { achievementRegistries: REGISTRIES } });
const WALLET_A = `0x${'0a'.repeat(20)}`;
const WALLET_B = `0x${'0B'.repeat(20)}`;
const SESSION = `0x${'5e'.repeat(32)}`;

test('planBackfillMints follows the approved catalog, never the stored nft flag', () => {
  const approved = { 'lester-blaster': ['marathon-wallet', 'two-fifty-ranked-runs'], chikun: ['chikun-combo-40'], stacked: [] };
  const rows = [
    { wallet: WALLET_A, game_id: 'lester-blaster', achievement_id: 'marathon-wallet', session_id32: SESSION, nft: false, token_id: null },   // approved, stored false: mints
    { wallet: WALLET_A, game_id: 'lester-blaster', achievement_id: 'arcade-legend-500', session_id32: SESSION, nft: true, token_id: null },  // stored true, not approved: skipped
    { wallet: WALLET_A, game_id: 'lester-blaster', achievement_id: 'two-fifty-ranked-runs', session_id32: SESSION, nft: true, token_id: '12' }, // already minted: skipped
    { wallet: WALLET_B, game_id: 'chikun', achievement_id: 'chikun-combo-40', session_id32: SESSION.toUpperCase().replace('0X', '0x'), nft: true, token_id: null },
    { wallet: WALLET_B, game_id: 'chikun', achievement_id: 'chikun-combo-40', session_id32: SESSION, nft: true, token_id: null },            // duplicate: once
    { wallet: WALLET_B, game_id: 'stacked', achievement_id: 'stacked-lines-1000', session_id32: SESSION, nft: true, token_id: null },          // stacked approves none
    { wallet: WALLET_B, game_id: 'unknown-game', achievement_id: 'x-y', session_id32: SESSION, nft: true, token_id: null },
  ];
  const plan = planBackfillMints({ unlockRows: rows, deployment: DEPLOYMENT, nftIdsByGame: approved });
  assert.deepEqual(plan, [
    { registry: REGISTRIES['lester-blaster'], player: WALLET_A, achievementId32: ethers.id('marathon-wallet'), sessionId32: SESSION },
    { registry: REGISTRIES.chikun, player: WALLET_B.toLowerCase(), achievementId32: ethers.id('chikun-combo-40'), sessionId32: SESSION },
  ]);
  for (const mint of plan) assert.deepEqual(Object.keys(mint), ['registry', 'player', 'achievementId32', 'sessionId32']);
  assert.deepEqual(planBackfillMints({ unlockRows: rows, deployment: DEPLOYMENT, nftIdsByGame: {} }), [], 'an empty approval mints nothing, whatever the stored flags say');
  assert.throws(() => planBackfillMints({ unlockRows: rows.slice(0, 1), deployment: { addresses: { achievementRegistries: {} } }, nftIdsByGame: approved }), /no collection address/);
  assert.throws(() => planBackfillMints({ unlockRows: [{ ...rows[0], wallet: 'nope' }], deployment: DEPLOYMENT, nftIdsByGame: approved }), /invalid wallet/);
  assert.deepEqual(achievementLabels(approved).get(ethers.id('marathon-wallet')), { gameId: 'lester-blaster', id: 'marathon-wallet' });
});

test('the approved subset and catalog seam, and the resync rewrites stored flags from the catalog only', async () => {
  const phase1 = await loadNftIdsByGame();
  for (const gameId of achievements.ACHIEVEMENT_GAME_IDS) assert.deepEqual(phase1[gameId], achievements.nftAchievementIds(gameId), `${gameId}: the catalog at run time`);
  const approved = approvedSubset(phase1, { gameId: PHASE2_GAME, add: PHASE2_TEST_SETUP.approvedAdded, drop: PHASE2_TEST_SETUP.droppedFromPhase1 });
  assert.equal(approved[PHASE2_GAME].includes(PHASE2_TEST_SETUP.approvedAdded), true);
  assert.equal(approved[PHASE2_GAME].includes(PHASE2_TEST_SETUP.droppedFromPhase1), false);
  assert.deepEqual(approved.chikun, phase1.chikun);
  assert.deepEqual((await loadNftIdsByGame(async () => approvedCatalogModule(approved)))[PHASE2_GAME], approved[PHASE2_GAME], 'the injected phase-2 catalog');
  // Test setup: the two labelled mythic rows are not earnable in a short run.
  for (const id of [PHASE2_TEST_SETUP.approvedAdded, PHASE2_TEST_SETUP.droppedFromPhase1]) assert.equal(achievements.achievementById(PHASE2_GAME, id).tier, 'mythic', id);

  const db = createPgliteClient();
  try {
    await migrate(db);
    const session = await seedVerifiedSession(db, { wallet: WALLET_A, gameId: PHASE2_GAME, score: 1000 });
    for (const [id, nft] of [[PHASE2_TEST_SETUP.approvedAdded, false], [PHASE2_TEST_SETUP.droppedFromPhase1, true], ['first-blood', false]]) {
      // eslint-disable-next-line no-await-in-loop
      await db.query("INSERT INTO achievement_unlocks (wallet, game_id, achievement_id, session_id32, tier, nft) VALUES ($1, $2, $3, $4, 'bronze', $5::boolean)", [WALLET_A, PHASE2_GAME, id, session.sessionId32, nft ? 'true' : 'false']);
    }
    assert.deepEqual(await countNftFlagDrift(db, approved), { 'lester-blaster': 2, chikun: 0, stacked: 0 });
    assert.deepEqual(await resyncNftFlags(db, approved), { 'lester-blaster': 2, chikun: 0, stacked: 0 });
    const flags = Object.fromEntries((await db.query('SELECT achievement_id, nft FROM achievement_unlocks')).map((row) => [row.achievement_id, row.nft]));
    assert.deepEqual(flags, { [PHASE2_TEST_SETUP.approvedAdded]: true, [PHASE2_TEST_SETUP.droppedFromPhase1]: false, 'first-blood': false });
    assert.deepEqual(await resyncNftFlags(db, approved), { 'lester-blaster': 0, chikun: 0, stacked: 0 }, 'idempotent');
  } finally {
    await db.close();
  }
});

test('the backfill CLI is a dry run by default and refuses to broadcast without every guard', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'lesters-backfill-cli-'));
  const db = createPgliteClient();
  const record = {
    chainId: 4441, deployedAt: '2026-09-23T00:00:00.000Z', startBlock: 1, deployer: `0x${'11'.repeat(20)}`, trustedVerifier: `0x${'22'.repeat(20)}`, relayer: `0x${'33'.repeat(20)}`,
    settlementGasReserveWei: '2000000000000000',
    addresses: { gameRegistry: `0x${'44'.repeat(20)}`, playerProfileRegistry: `0x${'55'.repeat(20)}`, arcadeRankedEntry: `0x${'66'.repeat(20)}`, scoreSubmissionRegistry: `0x${'77'.repeat(20)}`, achievementRegistries: REGISTRIES },
  };
  const module = writeLocalAddressModule(record, dir);
  const noProvider = () => { throw new Error('no chain access in a refused or dry run'); };
  const refusingReadFile = () => { throw new Error('no key file may be read'); };
  const run = async (argv, env = {}, options = {}) => {
    const logs = [];
    const exit = await runBackfillCli({ argv, env, log: (line) => logs.push(line), db, providerFactory: noProvider, readFile: refusingReadFile, ...options });
    return { exit, text: logs.join('\n') };
  };
  try {
    let result = await run(['--broadcast']);
    assert.deepEqual([result.exit, /LITVM_BACKFILL_CONFIRM=BACKFILL_NFT_MINTS_4441/.test(result.text)], [2, true], 'no confirm phrase');
    result = await run(['--broadcast', '--deployment', module, '--rpc', 'https://liteforge.rpc.caldera.xyz/http'], { LITVM_BACKFILL_CONFIRM: BACKFILL_CONFIRM });
    assert.deepEqual([result.exit, /loopback/.test(result.text)], [2, true], 'a local address module never reaches LiteForge');
    const predicted = join(dir, 'predicted-addresses.mjs');
    writeFileSync(predicted, renderLitvmAddressModule(resolveDeploymentInput({ mode: 'predicted' })), 'utf8');
    result = await run(['--broadcast', '--deployment', predicted, '--rpc', 'http://127.0.0.1:9'], { LITVM_BACKFILL_CONFIRM: BACKFILL_CONFIRM });
    assert.deepEqual([result.exit, /'predicted', not 'deployed'/.test(result.text)], [2, true], 'a predicted address module (before runbook step 3) never broadcasts');
    result = await run(['--frobnicate']);
    assert.equal(result.exit, 2);
    result = await runBackfillCli({ argv: [], env: {}, log: () => {}, db: null });
    assert.equal(result, 2, 'no NEON_DATABASE_URL');
    result = await run(['--deployment', module]);
    assert.deepEqual([result.exit, /schema not migrated/.test(result.text)], [1, true], 'the backfill never migrates');
    await migrate(db);
    const session = await seedVerifiedSession(db, { wallet: WALLET_A, gameId: 'chikun', score: 1000 });
    await db.query("INSERT INTO achievement_unlocks (wallet, game_id, achievement_id, session_id32, tier, nft) VALUES ($1, 'chikun', 'chikun-combo-40', $2, 'platinum', 'false')", [WALLET_A, session.sessionId32]);
    result = await run(['--deployment', module, '--resync']);
    assert.equal(result.exit, 0);
    assert.match(result.text, /1 mint\(s\) planned/);
    assert.match(result.text, /chikun\/chikun-combo-40/);
    assert.match(result.text, /nft flag resync: lester-blaster 0, chikun 1, stacked 0/);
    assert.match(result.text, /DRY RUN ONLY/);
    const [row] = await db.query("SELECT nft FROM achievement_unlocks WHERE achievement_id = 'chikun-combo-40'");
    assert.equal(row.nft, false, 'a dry run writes nothing, not even the resync');
    assert.doesNotMatch(result.text, /postgres|pglite/i, 'the database URL is never printed');
  } finally {
    await db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

const state = { stack: null };
before(async () => { state.stack = await startLocalStack(); });
after(async () => { await state.stack?.close(); });

test('phase 2 on the local stack: define the approved subset, setMinter(relayer), backfill, index, E6, tokenURI, no second mint', async () => {
  const { stack } = state;
  const logs = [];
  const report = await rehearseNftPhase2({ stack, log: (line) => logs.push(line) });
  const steps = Object.fromEntries(report.steps.map((step) => [step.id, step]));
  assert.equal(report.ok, true, JSON.stringify(report.steps.filter((step) => !step.ok)));
  assert.deepEqual(report.steps.map((step) => step.id), ['settled-run', 'phase1-proposal', 'test-setup-rows', 'define-approved-subset', 'backfill-plan', 'resync-flags', 'backfill-mint', 'index-stamps-token', 'profile-token', 'token-uri', 'second-backfill-mints-nothing']);
  const { approvedAdded: added, droppedFromPhase1: dropped } = PHASE2_TEST_SETUP;
  const player = stack.wallets.player1.address.toLowerCase();
  assert.equal(report.player, player);

  // 2-3. The approved subset is defined on every collection and the relayer may mint.
  assert.deepEqual(steps['define-approved-subset'].definedPerGame, { 'lester-blaster': 3, chikun: 5, stacked: 5 });
  // 3. Only the approved id mints: the stored flag of the dropped one said true, the added one said false.
  assert.deepEqual(steps['backfill-plan'].planned, 1);
  assert.ok(steps['backfill-plan'].storedNftTrueRows.includes(dropped));
  assert.equal(steps['backfill-mint'].relayerTransactions, 1);
  // 4. The index cron stamps the row.
  const [row] = await stack.db.query('SELECT token_id, mint_tx_hash, minted_at IS NOT NULL AS minted FROM achievement_unlocks WHERE wallet = $1 AND achievement_id = $2', [player, added]);
  assert.deepEqual([row.token_id, row.minted], [report.tokenId, true]);
  assert.match(row.mint_tx_hash, /^0x[0-9a-f]{64}$/);
  const tokenId = BigInt(ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(['address', 'bytes32'], [player, ethers.id(added)]))).toString();
  assert.equal(report.tokenId, tokenId, 'tokenIdFor = uint256(keccak256(abi.encode(wallet, id32)))');
  // 5. E6: the token, and the catalog's flag (not the resynced stored one).
  const profile = await stack.api('GET', `/api/profile?wallet=${player}`);
  const shown = Object.fromEntries(profile.body.achievements.filter((item) => item.gameId === PHASE2_GAME).map((item) => [item.id, item]));
  assert.deepEqual([shown[added].tokenId, shown[added].nft], [tokenId, achievements.achievementById(PHASE2_GAME, added).nft]);
  assert.deepEqual([shown[dropped].tokenId, shown[dropped].nft], [null, achievements.achievementById(PHASE2_GAME, dropped).nft]);
  // 6. tokenURI.
  assert.equal(steps['token-uri'].tokenUri, `https://lestersarcade.io/achievements/lester-blaster/${added}.json`);
  // 7. Nothing mints twice.
  assert.deepEqual([steps['second-backfill-mints-nothing'].plannedAfterIndex, steps['second-backfill-mints-nothing'].forcedDuplicate.every((item) => item.skipped)], [0, true]);

  // The keys stay inside the CLIs.
  const keys = localWalletKeys();
  const text = `${logs.join('\n')}\n${JSON.stringify(report)}`;
  for (const secret of [keys.operator, keys.relayer, keys.operator.slice(2), keys.relayer.slice(2)]) assert.equal(text.includes(secret), false);
});

test('the phase-2 CLIs never print the keys they read', async () => {
  // A key file under the OS temp directory, read through key-source.mjs by the backfill CLI.
  const dir = mkdtempSync(join(tmpdir(), 'lesters-backfill-key-'));
  try {
    const keyFile = join(dir, 'keys.json');
    writeFileSync(keyFile, JSON.stringify({ relayer: { address: 'x', privateKey: localWalletKeys().player2 } }), 'utf8');
    const { stack } = state;
    const module = writeLocalAddressModule(stack.record, dir);
    const logs = [];
    const exit = await runBackfillCli({
      argv: ['--broadcast', '--deployment', module, '--rpc', 'http://127.0.0.1:9', '--key-file', keyFile, '--key-field', 'relayer'],
      env: { LITVM_BACKFILL_CONFIRM: BACKFILL_CONFIRM }, log: (line) => logs.push(line), db: stack.db,
      providerFactory: () => ({ send: async () => '0x1159', destroy() {} }),
    });
    assert.equal(exit, 2, 'a key that is not the deployment relayer is refused');
    assert.match(logs.join('\n'), /not the deployment's relayer/);
    assert.equal(logs.join('\n').includes(localWalletKeys().player2.slice(2)), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
