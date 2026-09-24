// Phase 2 rehearsal: soulbound NFT definitions, the relayer as minter, backfill, index (rehearsal slice;
// guide §5.6 phase 2 and §5.14 item 6; contract A20, A32, §6.6, §8.5).
//
//   node scripts/rehearse-nft-phase2.mjs [--out <path>]
//
// Runs ONLY on the local stack (in-process Hardhat chain 4441, PGlite, public fixture keys). It walks
// phase 2 exactly as the owner will, through the real operator CLIs:
//   1. one Ranked run settled end to end (the rehearsal driver), so achievement_unlocks has real rows;
//   2. labelled test setup: platinum and mythic achievements are not earnable in a short run, so two
//      unlock rows are inserted for that session: one the owner APPROVES in phase 2 although the
//      phase-1 catalog proposed it nft:false, and one the phase-1 catalog proposed nft:true that the
//      owner does NOT approve;
//   3. scripts/define-nft-achievements.mjs --include-relayer-minter (planNftDefinitions, from the
//      operator key over a loopback RPC) defines the approved subset, then setMinter(relayer, true);
//   4. scripts/backfill-nft-mints.mjs --broadcast --resync (the relayer key) rewrites the stored nft
//      flags from the approved catalog and mints: only the approved id mints, whatever the stored flag;
//   5. the E12 index cron stamps token_id, mint_tx_hash and minted_at;
//   6. E6 shows the tokenId and the catalog's nft flag: through the handler with the committed
//      (phase-1) catalog, and through E6's query (readPublicProfile) with the approved catalog, as the
//      handler will once phase 2 commits it; tokenURI is
//      https://lestersarcade.io/achievements/<slug>/<id>.json;
//   7. a second backfill mints nothing (the stamped row is no longer planned, and mintFor returns false
//      for the duplicate when forced).
// The "approved" catalog is injected into both CLIs (their importCatalog seam) in place of editing
// apps/portal/src/achievements/*.mjs, which is what phase 2 will do for real.

import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ethers } from 'ethers';

import * as achievements from '../apps/portal/src/achievements/index.mjs';
import { localWalletKeys } from './lib/local-chain.mjs';
import { jsonRpcProvider, startLocalStack, writeLocalAddressModule } from './lib/local-stack.mjs';
import { startRpcProxy } from './lib/local-http.mjs';
import { rankedContracts, runRankedE2E } from './lib/rehearsal-driver.mjs';
import { DEFINE_CONFIRM, runDefineCli } from './define-nft-achievements.mjs';
import { BACKFILL_CONFIRM, broadcastBackfillMints, loadNftIdsByGame, planBackfillMints, readUnmintedUnlocks, runBackfillCli } from './backfill-nft-mints.mjs';
import { readPublicProfile } from '../server/neon/queries.mjs';

export const PHASE2_REPORT_SCHEMA = 'lesters-nft-phase2-rehearsal-v1';
export const PHASE2_GAME = 'lester-blaster';
export const PHASE2_TEST_SETUP = Object.freeze({
  label: 'labelled test setup: platinum and mythic achievements are not earnable in a short run, so these two unlock rows are inserted for the settled session',
  // nft:false in the phase-1 catalog; the owner approves it in phase 2 (A20: the backfill follows the approved catalog).
  approvedAdded: 'marathon-wallet',
  // nft:true in the phase-1 catalog (a proposal); the owner does not approve it.
  droppedFromPhase1: 'arcade-legend-500',
});
export const TOKEN_URI_BASE = 'https://lestersarcade.io/achievements/';

// The phase-2 approved subset: the phase-1 proposal for every game, with one id dropped and one
// added for `gameId`.
export function approvedSubset(phase1ByGame, { gameId, add, drop }) {
  const out = {};
  for (const [game, ids] of Object.entries(phase1ByGame)) {
    const next = game === gameId ? [...ids.filter((id) => id !== drop), add] : [...ids];
    out[game] = Object.freeze(next);
  }
  return Object.freeze(out);
}

// A catalog module whose nft flags are the approved subset (what phase 2 commits to the catalog).
export function approvedCatalogModule(approvedByGame) {
  return Object.freeze({
    ACHIEVEMENT_GAME_IDS: achievements.ACHIEVEMENT_GAME_IDS,
    catalogFor: achievements.catalogFor,
    nftAchievementIds: (gameId) => [...(approvedByGame[gameId] ?? [])],
  });
}

export async function rehearseNftPhase2({ stack, log = () => {}, gameId = PHASE2_GAME, setup = PHASE2_TEST_SETUP } = {}) {
  const steps = [];
  const step = (id, ok, detail = {}) => {
    steps.push({ id, ok: Boolean(ok), ...detail });
    log(`[phase 2] ${id}: ${ok ? 'ok' : 'FAILED'}`);
    return Boolean(ok);
  };
  const report = { schema: PHASE2_REPORT_SCHEMA, gameId, setup, steps, ok: false };
  const keys = localWalletKeys();
  const relayer = stack.record.relayer.toLowerCase();
  const contracts = rankedContracts(stack.deployment, stack.chain.provider);
  const collection = contracts.collection(gameId);
  const tmp = mkdtempSync(join(tmpdir(), 'lesters-phase2-'));
  const rpc = await startRpcProxy(stack);
  const providerFactory = (url) => jsonRpcProvider(url);
  try {
    // 1. One settled run.
    const e2e = await runRankedE2E({
      target: 'local', transport: 'in-process', api: stack.api, chain: stack.driverChain(), wallets: { player: stack.wallets.player1 },
      cronSecret: stack.cronSecret(), domain: '127.0.0.1', local: stack.localControls, games: [gameId], negatives: false,
    });
    const run = e2e.games[gameId];
    if (!step('settled-run', e2e.ok, { sessionId32: run.sessionId32 ?? null, earned: run.settle?.achievements ?? [] })) return report;
    const sessionId32 = run.sessionId32;
    const player = e2e.player;

    // 2. Labelled test setup rows, and the approved subset.
    const phase1 = await loadNftIdsByGame();
    const approved = approvedSubset(phase1, { gameId, add: setup.approvedAdded, drop: setup.droppedFromPhase1 });
    const added = achievements.achievementById(gameId, setup.approvedAdded);
    const dropped = achievements.achievementById(gameId, setup.droppedFromPhase1);
    step('phase1-proposal', added && dropped && added.nft === false && dropped.nft === true && phase1[gameId].includes(dropped.id) && !phase1[gameId].includes(added.id),
      { approvedAdded: { id: added?.id, tier: added?.tier, phase1Nft: added?.nft }, droppedFromPhase1: { id: dropped?.id, tier: dropped?.tier, phase1Nft: dropped?.nft } });
    for (const entry of [{ row: added, nft: false }, { row: dropped, nft: true }]) {
      // eslint-disable-next-line no-await-in-loop
      await stack.db.query(
        `INSERT INTO achievement_unlocks (wallet, game_id, achievement_id, session_id32, tier, nft, unlocked_at)
         VALUES ($1, $2, $3, $4, $5, $6::boolean, now())`,
        [player, gameId, entry.row.id, sessionId32, entry.row.tier, entry.nft ? 'true' : 'false'],
      );
    }
    step('test-setup-rows', true, { label: setup.label, inserted: [added.id, dropped.id] });

    // 3. Define the approved subset and allow the relayer to mint, through the operator CLI.
    const modulePath = writeLocalAddressModule(stack.record, tmp);
    const catalog = approvedCatalogModule(approved);
    const importCatalog = async () => catalog;
    const cliLog = (line) => log(`  ${line}`);
    const defineDry = await runDefineCli({ argv: ['--include-relayer-minter', '--deployment', modulePath], env: {}, log: cliLog, importCatalog, providerFactory });
    const defineExit = await runDefineCli({
      argv: ['--broadcast', '--include-relayer-minter', '--deployment', modulePath, '--rpc', rpc.url, '--key-env', 'REHEARSAL_OPERATOR_KEY'],
      env: { LITVM_DEFINE_CONFIRM: DEFINE_CONFIRM, REHEARSAL_OPERATOR_KEY: keys.operator }, log: cliLog, importCatalog, providerFactory,
    });
    const definedIds = {};
    let definitionsOk = defineDry === 0 && defineExit === 0;
    for (const game of achievements.ACHIEVEMENT_GAME_IDS) {
      const registry = contracts.collection(game);
      // eslint-disable-next-line no-await-in-loop
      const onChain = (await registry.achievementIds()).map((id) => id.toLowerCase());
      definedIds[game] = onChain.length;
      definitionsOk &&= onChain.length === approved[game].length && approved[game].every((id) => onChain.includes(ethers.id(id)));
      // eslint-disable-next-line no-await-in-loop
      definitionsOk &&= await registry.minters(relayer);
    }
    step('define-approved-subset', definitionsOk && !(await collection.getAchievement(ethers.id(dropped.id))).exists, { definedPerGame: definedIds, relayerMinter: true });

    // 4. Backfill with the relayer (the CLI resyncs the stored flags from the approved catalog first).
    const before = await readUnmintedUnlocks(stack.db);
    const plan = planBackfillMints({ unlockRows: before, deployment: stack.deployment, nftIdsByGame: approved });
    step('backfill-plan', plan.length === 1 && plan[0].achievementId32 === ethers.id(added.id) && plan[0].player === player && plan[0].sessionId32 === sessionId32,
      { planned: plan.length, candidates: before.length, storedNftTrueRows: before.filter((row) => row.nft === true).map((row) => row.achievement_id) });
    const backfillDry = await runBackfillCli({ argv: ['--resync', '--deployment', modulePath], env: {}, log: cliLog, db: stack.db, importCatalog, providerFactory });
    const relayerNonce = () => stack.chain.provider.getTransactionCount(relayer, 'latest');
    const nonceBefore = await relayerNonce();
    const backfillExit = await runBackfillCli({
      argv: ['--broadcast', '--resync', '--deployment', modulePath, '--rpc', rpc.url, '--key-env', 'REHEARSAL_RELAYER_KEY'],
      env: { LITVM_BACKFILL_CONFIRM: BACKFILL_CONFIRM, REHEARSAL_RELAYER_KEY: keys.relayer }, log: cliLog, db: stack.db, importCatalog, providerFactory,
    });
    const nonceAfter = await relayerNonce();
    const flags = Object.fromEntries((await stack.db.query('SELECT achievement_id, nft FROM achievement_unlocks WHERE wallet = $1 AND game_id = $2', [player, gameId])).map((row) => [row.achievement_id, row.nft]));
    step('resync-flags', flags[added.id] === true && flags[dropped.id] === false && Object.entries(flags).every(([id, nft]) => nft === approved[gameId].includes(id)), { stored: { [added.id]: flags[added.id], [dropped.id]: flags[dropped.id] } });
    const tokenId = (await collection.tokenIdFor(player, ethers.id(added.id))).toString();
    step('backfill-mint', backfillDry === 0 && backfillExit === 0 && nonceAfter === nonceBefore + 1
      && await collection.hasUnlocked(player, ethers.id(added.id)) && !(await collection.hasUnlocked(player, ethers.id(dropped.id))), { tokenId, relayerTransactions: nonceAfter - nonceBefore });

    // 5. The index cron stamps the row.
    const cron = await stack.api('GET', '/api/cron/index-chain', { headers: { authorization: `Bearer ${stack.cronSecret()}` } });
    const [stamped] = await stack.db.query(
      `SELECT token_id, mint_tx_hash, to_char(minted_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS minted_at
         FROM achievement_unlocks WHERE wallet = $1 AND game_id = $2 AND achievement_id = $3`,
      [player, gameId, added.id],
    );
    const [droppedRow] = await stack.db.query('SELECT token_id FROM achievement_unlocks WHERE wallet = $1 AND game_id = $2 AND achievement_id = $3', [player, gameId, dropped.id]);
    step('index-stamps-token', cron.status === 200 && cron.body.achievements === 1 && stamped?.token_id === tokenId && /^0x[0-9a-f]{64}$/.test(String(stamped?.mint_tx_hash)) && Boolean(stamped?.minted_at) && droppedRow?.token_id === null,
      { cron: { status: cron.status, achievements: cron.body?.achievements ?? null }, tokenId: stamped?.token_id ?? null, mintTxHash: stamped?.mint_tx_hash ?? null, mintedAt: stamped?.minted_at ?? null });

    // 6. E6 shows the token and the catalog's flag; tokenURI.
    //    The E6 handler loads the COMMITTED catalog (still the phase-1 proposal here, since this
    //    rehearsal injects the approved one instead of editing apps/portal/src/achievements), so through
    //    the handler the flags are the phase-1 ones. E6's own query, given the approved catalog (what
    //    the phase-2 catalog commit makes the handler load), must then show the approved flags.
    const profile = await stack.api('GET', `/api/profile?wallet=${player}`);
    const shownIn = (body, id) => body?.achievements?.find((item) => item.id === id && item.gameId === gameId) ?? null;
    const addedShown = shownIn(profile.body, added.id);
    const droppedShown = shownIn(profile.body, dropped.id);
    step('profile-token', profile.status === 200 && addedShown?.tokenId === tokenId && addedShown?.mintTxHash === stamped?.mint_tx_hash
      && addedShown?.nft === added.nft && droppedShown?.tokenId === null && droppedShown?.nft === dropped.nft,
    { [added.id]: { tokenId: addedShown?.tokenId ?? null, nft: addedShown?.nft ?? null }, [dropped.id]: { tokenId: droppedShown?.tokenId ?? null, nft: droppedShown?.nft ?? null }, catalog: 'committed (phase-1 proposal)', note: 'nft comes from the server catalog (A20), never the stored flag; the resync set the stored flags the other way round' });
    const approvedView = await readPublicProfile(stack.db, player, { nowMs: stack.nowMs(), catalog });
    const addedApproved = shownIn(approvedView, added.id);
    const droppedApproved = shownIn(approvedView, dropped.id);
    step('profile-approved-catalog', addedApproved?.nft === true && addedApproved?.tokenId === tokenId && droppedApproved?.nft === false && droppedApproved?.tokenId === null
      && approvedView.achievements.filter((item) => item.gameId === gameId).every((item) => item.nft === approved[gameId].includes(item.id)),
    { [added.id]: { tokenId: addedApproved?.tokenId ?? null, nft: addedApproved?.nft ?? null }, [dropped.id]: { tokenId: droppedApproved?.tokenId ?? null, nft: droppedApproved?.nft ?? null }, catalog: 'approved (phase 2)', note: 'readPublicProfile (E6\'s query) with the approved catalog, as the handler reads it once phase 2 commits the catalog' });
    const tokenUri = await collection.tokenURI(tokenId);
    step('token-uri', tokenUri === `${TOKEN_URI_BASE}${gameId}/${added.id}.json`, { tokenUri });

    // 7. A second backfill mints nothing.
    const secondNonce = await relayerNonce();
    const again = planBackfillMints({ unlockRows: await readUnmintedUnlocks(stack.db), deployment: stack.deployment, nftIdsByGame: approved });
    const secondExit = await runBackfillCli({
      argv: ['--broadcast', '--deployment', modulePath, '--rpc', rpc.url, '--key-env', 'REHEARSAL_RELAYER_KEY'],
      env: { LITVM_BACKFILL_CONFIRM: BACKFILL_CONFIRM, REHEARSAL_RELAYER_KEY: keys.relayer }, log: cliLog, db: stack.db, importCatalog, providerFactory,
    });
    const forced = await broadcastBackfillMints({ plan, signer: stack.wallets.relayer });
    step('second-backfill-mints-nothing', again.length === 0 && secondExit === 0 && forced.every((item) => item.skipped && !item.minted) && (await relayerNonce()) === secondNonce,
      { plannedAfterIndex: again.length, forcedDuplicate: forced.map((item) => ({ skipped: item.skipped, tokenId: item.tokenId })) });

    report.player = player;
    report.sessionId32 = sessionId32;
    report.approved = approved;
    report.tokenId = tokenId;
    report.ok = steps.every((entry) => entry.ok);
    return report;
  } catch (error) {
    step('unexpected-error', false, { detail: `${error?.name ?? 'Error'}: ${error?.shortMessage ?? error?.message ?? error}` });
    return report;
  } finally {
    await rpc.close();
    rmSync(tmp, { recursive: true, force: true });
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const argv = process.argv.slice(2);
  const outIndex = argv.indexOf('--out');
  const unknown = argv.filter((arg, index) => !(arg === '--out' || index === outIndex + 1));
  if (unknown.length || (outIndex >= 0 && !argv[outIndex + 1])) {
    console.error('usage: node scripts/rehearse-nft-phase2.mjs [--out <path>]');
    process.exitCode = 2;
  } else {
    const stack = await startLocalStack();
    try {
      const report = await rehearseNftPhase2({ stack, log: console.log });
      if (outIndex >= 0) {
        const out = resolve(argv[outIndex + 1]);
        mkdirSync(dirname(out), { recursive: true });
        writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
        console.log(`report written to ${out}`);
      }
      console.log(`phase 2 rehearsal: ${report.ok ? 'PASS' : 'FAIL'}`);
      process.exitCode = report.ok ? 0 : 1;
    } finally {
      await stack.close();
    }
  }
}
