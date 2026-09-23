// Phase 2 backfill of soulbound achievement NFTs (rehearsal slice; contract A20, §3.2, §8.5, §11 rule 13).
// WRITTEN AND REHEARSED LOCALLY, NEVER RUN against LiteForge or production Neon in the pre-deployment
// work: phase 2 starts after the owner approves the NFT subset (checkpoint O3), the catalog's `nft`
// flags are edited to match it, and scripts/define-nft-achievements.mjs --include-relayer-minter has
// defined the subset and allowed the relayer to mint.
//
//   node scripts/backfill-nft-mints.mjs [--resync]                                       # dry run
//   LITVM_BACKFILL_CONFIRM=BACKFILL_NFT_MINTS_4441 \
//     node scripts/backfill-nft-mints.mjs --broadcast [--resync] (--key-env <NAME> | --key-file <path> --key-field <field>)
//
// Rows come from Neon (NEON_DATABASE_URL, read from the environment and never printed):
// achievement_unlocks rows whose token_id is null. A row is minted when its achievement_id is in
// nftAchievementIds(gameId) of the catalog AT RUN TIME. The stored `nft` column (the phase-1
// proposal) is ignored (A20). `--resync` rewrites that column from the catalog, for display
// consistency; it is a Neon write, so it happens only with --broadcast and the confirm phrase.
//
// Minting sends mintFor(player, achievementId32, sessionId32) from the RELAYER key (a minter on each
// collection), read inside the process through scripts/lib/key-source.mjs and never printed. Each
// call is simulated first: mintFor returns false for an undefined id, a duplicate or a zero player,
// and those are skipped without a transaction, so re-running is safe. The E12 index cron then stamps
// token_id, mint_tx_hash and minted_at from the AchievementUnlocked events.
//
// Options: --rpc <url> (default RPC_URL or the LiteForge RPC; its own eth_chainId must be 4441),
// --deployment <module.mjs> (a local address module; a broadcast accepts it only with a loopback --rpc).

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ethers } from 'ethers';

import { createNeonClient } from '../apps/portal/src/server-neon.mjs';
import { LATEST_SCHEMA_VERSION, readSchemaVersion } from '../server/neon/migrations.mjs';
import { flagValue, hasFlag, readSecret, SecretSourceError } from './lib/key-source.mjs';
import { loadArtifact } from './lib/local-chain.mjs';
import { LITVM_GAME_SLUGS, loadLitvmDeployment } from './generate-litvm-addresses.mjs';
import { isLoopbackRpc, rpcChainId } from './operator-actions.mjs';

export const BACKFILL_CONFIRM = 'BACKFILL_NFT_MINTS_4441';
export const DEFAULT_RPC_URL = 'https://liteforge.rpc.caldera.xyz/http';
const ADDRESS = /^0x[0-9a-f]{40}$/;
const HEX32 = /^0x[0-9a-f]{64}$/;
const ACHIEVEMENT_ID = /^[a-z0-9][a-z0-9-]{1,63}$/;

// { gameId: [ids] } from the achievements catalog module (dynamic import: loaded at run time, so the
// phase-2 edit of the catalog's nft flags is what counts).
export async function loadNftIdsByGame(importCatalog = () => import('../apps/portal/src/achievements/index.mjs')) {
  const registry = await importCatalog();
  if (typeof registry.nftAchievementIds !== 'function') throw new Error('the achievements catalog must export nftAchievementIds');
  const gameIds = Array.isArray(registry.ACHIEVEMENT_GAME_IDS) ? registry.ACHIEVEMENT_GAME_IDS : LITVM_GAME_SLUGS;
  return Object.freeze(Object.fromEntries(gameIds.map((gameId) => [gameId, Object.freeze([...registry.nftAchievementIds(gameId)])])));
}

// Pure. achievement_unlocks rows → the mints to send, one per (collection, player, achievement), in
// row order: rows whose achievement_id is in nftIdsByGame[game_id] and whose token_id is null. The
// stored `nft` flag is ignored (contract A20).
//   → [{ registry, player, achievementId32, sessionId32 }]
export function planBackfillMints({ unlockRows = [], deployment, nftIdsByGame = {} } = {}) {
  const registries = deployment?.addresses?.achievementRegistries ?? {};
  const seen = new Set();
  const plan = [];
  for (const row of unlockRows) {
    const gameId = String(row?.game_id ?? row?.gameId ?? '');
    const achievementId = String(row?.achievement_id ?? row?.achievementId ?? '');
    const tokenId = row?.token_id ?? row?.tokenId ?? null;
    if (tokenId !== null && tokenId !== undefined && tokenId !== '') continue;
    const approved = nftIdsByGame[gameId];
    if (!Array.isArray(approved) || !approved.includes(achievementId)) continue;
    if (!ACHIEVEMENT_ID.test(achievementId)) throw new Error(`invalid achievement id in achievement_unlocks: ${JSON.stringify(achievementId)}`);
    const registry = String(registries[gameId] ?? '').toLowerCase();
    if (!ADDRESS.test(registry)) throw new Error(`the address module has no collection address for ${gameId}`);
    const player = String(row?.wallet ?? row?.player ?? '').toLowerCase();
    if (!ADDRESS.test(player)) throw new Error(`invalid wallet in achievement_unlocks for ${gameId}/${achievementId}`);
    const sessionId32 = String(row?.session_id32 ?? row?.sessionId32 ?? '').toLowerCase();
    if (!HEX32.test(sessionId32)) throw new Error(`invalid session id in achievement_unlocks for ${gameId}/${achievementId}`);
    const achievementId32 = ethers.id(achievementId);
    const key = `${registry}|${player}|${achievementId32}`;
    if (seen.has(key)) continue;
    seen.add(key);
    plan.push(Object.freeze({ registry, player, achievementId32, sessionId32 }));
  }
  return plan;
}

// achievementId32 → { gameId, id }, for readable logs.
export function achievementLabels(nftIdsByGame) {
  const labels = new Map();
  for (const [gameId, ids] of Object.entries(nftIdsByGame)) for (const id of ids) labels.set(ethers.id(id), { gameId, id });
  return labels;
}

// Every unminted unlock (A15: text and boolean columns only).
export async function readUnmintedUnlocks(db) {
  return db.query(
    `SELECT wallet, game_id, achievement_id, session_id32, nft, token_id
       FROM achievement_unlocks
      WHERE token_id IS NULL
      ORDER BY unlocked_at ASC, wallet ASC, game_id ASC, achievement_id ASC`,
  );
}

const APPROVED_SQL = 'ARRAY(SELECT jsonb_array_elements_text($2::jsonb))';

// Rows whose stored nft flag differs from the catalog, per game (dry run of the resync).
export async function countNftFlagDrift(db, nftIdsByGame) {
  const out = {};
  for (const [gameId, ids] of Object.entries(nftIdsByGame)) {
    // eslint-disable-next-line no-await-in-loop
    const rows = await db.query(
      `SELECT count(*)::int AS n FROM achievement_unlocks
        WHERE game_id = $1 AND nft IS DISTINCT FROM (achievement_id = ANY(${APPROVED_SQL}))`,
      [gameId, JSON.stringify(ids)],
    );
    out[gameId] = Number(rows[0]?.n ?? 0);
  }
  return out;
}

// Rewrites achievement_unlocks.nft from the catalog (A20: display consistency only; nothing decides a
// mint from it). → { [gameId]: rowsChanged }
export async function resyncNftFlags(db, nftIdsByGame) {
  const out = {};
  for (const [gameId, ids] of Object.entries(nftIdsByGame)) {
    // eslint-disable-next-line no-await-in-loop
    const rows = await db.query(
      `UPDATE achievement_unlocks
          SET nft = (achievement_id = ANY(${APPROVED_SQL}))
        WHERE game_id = $1 AND nft IS DISTINCT FROM (achievement_id = ANY(${APPROVED_SQL}))
        RETURNING achievement_id`,
      [gameId, JSON.stringify(ids)],
    );
    out[gameId] = rows.length;
  }
  return out;
}

function collectionAt(address, runner) {
  return new ethers.Contract(address, loadArtifact('AchievementRegistry').abi, runner);
}

// Sends the planned mints from `signer` (a minter on every collection). Each mint is simulated first;
// mintFor returns false for an undefined id, a duplicate or a zero player, and those are skipped
// without a transaction. → [{ ...mint, minted, skipped, txHash, tokenId }]
export async function broadcastBackfillMints({ plan, signer, log = () => {}, labels = new Map() }) {
  const minter = (await signer.getAddress()).toLowerCase();
  for (const registry of new Set(plan.map((mint) => mint.registry))) {
    // eslint-disable-next-line no-await-in-loop
    if (!(await collectionAt(registry, signer).minters(minter))) {
      throw new Error(`the signer is not a minter on the collection at ${registry}; run scripts/define-nft-achievements.mjs --include-relayer-minter first`);
    }
  }
  const results = [];
  for (const mint of plan) {
    const collection = collectionAt(mint.registry, signer);
    const label = labels.get(mint.achievementId32);
    const name = `${label ? `${label.gameId}/${label.id}` : mint.achievementId32} for ${mint.player}`;
    const tokenId = (await collection.tokenIdFor(mint.player, mint.achievementId32)).toString();
    // eslint-disable-next-line no-await-in-loop
    const would = await collection.mintFor.staticCall(mint.player, mint.achievementId32, mint.sessionId32);
    if (!would) {
      log(`skip ${name}: mintFor would return false (undefined, already minted, or zero player)`);
      results.push({ ...mint, minted: false, skipped: true, txHash: null, tokenId });
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    const tx = await collection.mintFor(mint.player, mint.achievementId32, mint.sessionId32);
    // eslint-disable-next-line no-await-in-loop
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new Error(`mintFor ${name} failed in ${tx.hash}`);
    log(`minted ${name}: token ${tokenId} in ${tx.hash}`);
    results.push({ ...mint, minted: true, skipped: false, txHash: tx.hash.toLowerCase(), tokenId });
  }
  return results;
}

// CLI body, injectable for tests. Returns a process exit code.
export async function runBackfillCli({
  argv = process.argv.slice(2),
  env = process.env,
  log = console.log,
  db = null,
  fetchImpl = globalThis.fetch,
  importCatalog = undefined,
  providerFactory = (url) => new ethers.JsonRpcProvider(url, 4441, { staticNetwork: true, cacheTimeout: -1 }),
  readFile = undefined,
} = {}) {
  const known = new Set(['--broadcast', '--resync', '--rpc', '--deployment', '--key-env', '--key-file', '--key-field']);
  for (const arg of argv) {
    const flag = arg.startsWith('--') ? arg.split('=')[0] : null;
    if (flag && !known.has(flag)) {
      log(`unknown argument ${flag}`);
      return 2;
    }
  }
  const broadcast = hasFlag(argv, '--broadcast');
  const resync = hasFlag(argv, '--resync');
  if (broadcast && env.LITVM_BACKFILL_CONFIRM !== BACKFILL_CONFIRM) {
    log(`Broadcast blocked. Set LITVM_BACKFILL_CONFIRM=${BACKFILL_CONFIRM} after reviewing the dry run.`);
    return 2;
  }
  const rpcUrl = flagValue(argv, '--rpc') ?? env.RPC_URL ?? DEFAULT_RPC_URL;
  const deploymentOverride = flagValue(argv, '--deployment');
  if (broadcast && deploymentOverride !== null && !isLoopbackRpc(rpcUrl)) {
    log('Broadcast blocked: --deployment is for dry runs and the local chain (a loopback --rpc). A broadcast to LiteForge always uses the committed address module.');
    return 2;
  }
  const deployment = await loadLitvmDeployment(deploymentOverride);
  if (broadcast && deployment.status !== 'deployed') {
    log(`Broadcast blocked: the address module is '${deployment.status}', not 'deployed'.`);
    return 2;
  }
  let client = db;
  if (!client) {
    const url = typeof env.NEON_DATABASE_URL === 'string' ? env.NEON_DATABASE_URL.trim() : '';
    if (!url) {
      log('NEON_DATABASE_URL is not set.');
      return 2;
    }
    try {
      client = createNeonClient({ connectionString: url, fetchImpl });
    } catch {
      log('NEON_DATABASE_URL is not a postgres connection string.');
      return 2;
    }
  }
  const version = await readSchemaVersion(client);
  if (version < LATEST_SCHEMA_VERSION) {
    log(`schema not migrated (version ${version} of ${LATEST_SCHEMA_VERSION}); run the E12 cron first. Nothing was read or written.`);
    return 1;
  }
  const nftIdsByGame = await loadNftIdsByGame(importCatalog);
  const labels = achievementLabels(nftIdsByGame);
  const rows = await readUnmintedUnlocks(client);
  const plan = planBackfillMints({ unlockRows: rows, deployment, nftIdsByGame });
  log(`Catalog NFT ids: ${Object.entries(nftIdsByGame).map(([gameId, ids]) => `${gameId} ${ids.length}`).join(', ')}.`);
  log(`${rows.length} unminted unlock row(s); ${plan.length} mint(s) planned (address module: ${deployment.status}):`);
  for (const mint of plan) {
    const label = labels.get(mint.achievementId32);
    log(`  ${label?.gameId ?? '?'}/${label?.id ?? mint.achievementId32} → ${mint.player} (session ${mint.sessionId32}) on ${mint.registry}`);
  }
  if (resync) {
    const drift = await countNftFlagDrift(client, nftIdsByGame);
    log(`nft flag resync: ${Object.entries(drift).map(([gameId, count]) => `${gameId} ${count}`).join(', ')} row(s) differ from the catalog.`);
  }
  if (!broadcast) {
    log('DRY RUN ONLY. Nothing was written or sent. Broadcast needs --broadcast, LITVM_BACKFILL_CONFIRM and the relayer key (--key-env <NAME> or --key-file <path> --key-field <field>).');
    return 0;
  }
  const provider = providerFactory(rpcUrl);
  try {
    const chainId = await rpcChainId(provider);
    if (chainId !== deployment.chainId) {
      log(`Broadcast blocked: the RPC is on chain ${chainId}, expected ${deployment.chainId}.`);
      return 2;
    }
    const signer = new ethers.Wallet(readSecret({ env, argv, label: 'relayer key', readFile }), provider);
    if (signer.address.toLowerCase() !== String(deployment.relayer).toLowerCase()) {
      log('Broadcast blocked: the key is not the deployment\'s relayer.');
      return 2;
    }
    if (resync) {
      const changed = await resyncNftFlags(client, nftIdsByGame);
      log(`nft flags resynced: ${Object.entries(changed).map(([gameId, count]) => `${gameId} ${count}`).join(', ')}.`);
    }
    log(`Relayer ${signer.address}. Minting…`);
    const results = await broadcastBackfillMints({ plan, signer, log, labels });
    log(`Done: ${results.filter((item) => item.minted).length} minted, ${results.filter((item) => item.skipped).length} skipped. The E12 index cron stamps token_id, mint_tx_hash and minted_at.`);
    return 0;
  } finally {
    provider.destroy?.();
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMain) {
  try {
    process.exitCode = await runBackfillCli();
  } catch (error) {
    // Key-source errors name the flag or file, never the value. Anything else prints its code and
    // ethers' short message only: a full message can embed the RPC or database URL (contract A31).
    const detail = error instanceof SecretSourceError ? error.message : (error?.shortMessage ?? 'see the error code');
    console.error(`backfill-nft-mints: ${error?.code ?? error?.name ?? 'error'}: ${detail}`);
    process.exitCode = 1;
  }
}
