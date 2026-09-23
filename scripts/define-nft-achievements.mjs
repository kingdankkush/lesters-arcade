// Phase 2 only (contract A20, §8.5): define the owner-approved NFT achievements on each game's
// soulbound collection, and optionally allow the relayer to mint (backfill). WRITTEN, NEVER RUN in the
// pre-deployment work: the collections deploy empty (D15) and phase 1 defines nothing.
//
// Dry run (default): loads the catalog with a dynamic import of apps/portal/src/achievements/index.mjs
// (nftAchievementIds + catalogFor) and prints the ordered calls. No key is read.
//
//   node scripts/define-nft-achievements.mjs [--include-relayer-minter]
//
// Broadcast needs ALL of: --broadcast, LITVM_DEFINE_CONFIRM=DEFINE_NFT_ACHIEVEMENTS_4441, a DEPLOYED
// address module, chain 4441, and the operator key from an environment variable NAME the operator
// gives (or a key file field), read inside the process and never printed:
//
//   LITVM_DEFINE_CONFIRM=DEFINE_NFT_ACHIEVEMENTS_4441 \
//     node scripts/define-nft-achievements.mjs --broadcast --key-env <NAME> [--include-relayer-minter]
//
// Options: --rpc <url> (default RPC_URL or the LiteForge RPC), --deployment <module.mjs> (default the
// committed generated module; the rehearsal points it at a local chain). Re-running is safe: calls
// whose on-chain state already matches are skipped.
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ethers } from 'ethers';
import { flagValue, hasFlag, readSecret } from './lib/key-source.mjs';
import { LITVM_GAME_SLUGS, loadLitvmDeployment } from './generate-litvm-addresses.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

export const DEFINE_CONFIRM = 'DEFINE_NFT_ACHIEVEMENTS_4441';
export const DEFAULT_RPC_URL = 'https://liteforge.rpc.caldera.xyz/http';
const ACHIEVEMENT_ID_RE = /^[a-z0-9][a-z0-9-]{1,63}$/;
const CATEGORY_RE = /^[a-z-]{2,24}$/;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

let achievementAbi = null;
export function achievementRegistryInterface() {
  achievementAbi ??= JSON.parse(readFileSync(join(root, 'contracts', 'artifacts', 'AchievementRegistry.json'), 'utf8')).abi;
  return new ethers.Interface(achievementAbi);
}

// Pure: the ordered calls, grouped per collection in game order (lester-blaster, chikun, stacked),
// catalog order within a game: defineAchievement(ethers.id(id), gameId32, title, category, '<id>.json'),
// then, when includeRelayerMinter, setMinter(relayer, true) on that collection.
export function planNftDefinitions({ catalog, deployment, relayer = null, includeRelayerMinter = false } = {}) {
  if (!Array.isArray(catalog)) throw new Error('catalog must be an array of { gameId, id, title, category }');
  const registries = deployment?.addresses?.achievementRegistries ?? {};
  if (includeRelayerMinter && !(typeof relayer === 'string' && ADDRESS_RE.test(relayer))) throw new Error('includeRelayerMinter needs the relayer address');
  const byGame = new Map(LITVM_GAME_SLUGS.map((gameId) => [gameId, []]));
  const seen = new Set();
  for (const entry of catalog) {
    const { gameId, id, title, category } = entry ?? {};
    if (!byGame.has(gameId)) throw new Error(`unknown gameId ${JSON.stringify(gameId)} in the catalog`);
    if (typeof id !== 'string' || !ACHIEVEMENT_ID_RE.test(id)) throw new Error(`invalid achievement id ${JSON.stringify(id)}`);
    if (typeof title !== 'string' || title.length === 0 || title.length > 40) throw new Error(`achievement ${id} needs a title of 1 to 40 characters`);
    if (typeof category !== 'string' || !CATEGORY_RE.test(category)) throw new Error(`achievement ${id} has an invalid category`);
    const key = `${gameId}:${id}`;
    if (seen.has(key)) throw new Error(`duplicate achievement ${key}`);
    seen.add(key);
    byGame.get(gameId).push({ gameId, id, title, category });
  }
  const iface = achievementRegistryInterface();
  const calls = [];
  for (const [gameId, entries] of byGame) {
    if (entries.length === 0 && !includeRelayerMinter) continue;
    const to = registries[gameId];
    if (typeof to !== 'string' || !ADDRESS_RE.test(to)) throw new Error(`the address module has no collection address for ${gameId}`);
    const gameId32 = ethers.id(gameId);
    for (const entry of entries) {
      const args = [ethers.id(entry.id), gameId32, entry.title, entry.category, `${entry.id}.json`];
      calls.push({ gameId, achievementId: entry.id, contract: 'AchievementRegistry', to: to.toLowerCase(), method: 'defineAchievement', args, data: iface.encodeFunctionData('defineAchievement', args) });
    }
    if (includeRelayerMinter) {
      const args = [ethers.getAddress(relayer), true];
      calls.push({ gameId, achievementId: null, contract: 'AchievementRegistry', to: to.toLowerCase(), method: 'setMinter', args, data: iface.encodeFunctionData('setMinter', args) });
    }
  }
  return calls;
}

// The NFT-flagged catalog entries, from the achievements registry module (dynamic import: that
// module is created by the achievements slice).
export async function loadNftCatalog(importCatalog = () => import('../apps/portal/src/achievements/index.mjs')) {
  let registry;
  try {
    registry = await importCatalog();
  } catch (error) {
    throw new Error(`the achievements catalog (apps/portal/src/achievements/index.mjs) could not be loaded: ${error?.code ?? error?.message ?? error}`);
  }
  const { nftAchievementIds, catalogFor } = registry;
  if (typeof nftAchievementIds !== 'function' || typeof catalogFor !== 'function') throw new Error('the achievements catalog must export nftAchievementIds and catalogFor');
  const gameIds = Array.isArray(registry.ACHIEVEMENT_GAME_IDS) ? registry.ACHIEVEMENT_GAME_IDS : LITVM_GAME_SLUGS;
  const catalog = [];
  for (const gameId of gameIds) {
    const nft = new Set(nftAchievementIds(gameId));
    for (const entry of catalogFor(gameId)) {
      if (nft.has(entry.id)) catalog.push({ gameId, id: entry.id, title: entry.title, category: entry.category });
    }
  }
  return catalog;
}

// Sends the planned calls from `signer` (the operator), skipping calls already reflected on chain.
export async function broadcastNftDefinitions({ calls, signer, log = () => {} }) {
  const iface = achievementRegistryInterface();
  const operator = (await signer.getAddress()).toLowerCase();
  for (const to of new Set(calls.map((call) => call.to))) {
    const collection = new ethers.Contract(to, iface, signer);
    const onChainOperator = String(await collection.operator()).toLowerCase();
    if (onChainOperator !== operator) throw new Error(`the signer is not the operator of the collection at ${to}`);
  }
  const results = [];
  for (const call of calls) {
    const collection = new ethers.Contract(call.to, iface, signer);
    if (call.method === 'defineAchievement') {
      const existing = await collection.getAchievement(call.args[0]);
      if (existing.exists && existing.gameId === call.args[1] && existing.title === call.args[2] && existing.category === call.args[3] && existing.tokenUriPath === call.args[4]) {
        log(`skip ${call.gameId}/${call.achievementId}: already defined`);
        results.push({ ...call, skipped: true, txHash: null });
        continue;
      }
    } else if (call.method === 'setMinter') {
      if ((await collection.minters(call.args[0])) === call.args[1]) {
        log(`skip ${call.gameId} setMinter: already set`);
        results.push({ ...call, skipped: true, txHash: null });
        continue;
      }
    }
    const tx = await signer.sendTransaction({ to: call.to, data: call.data });
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new Error(`${call.method} for ${call.gameId}/${call.achievementId ?? 'relayer'} failed in ${tx.hash}`);
    log(`sent ${call.method} ${call.gameId}/${call.achievementId ?? 'relayer'}: ${tx.hash}`);
    results.push({ ...call, skipped: false, txHash: tx.hash });
  }
  return results;
}

// CLI body, injectable for tests. Returns a process exit code.
export async function runDefineCli({ argv = process.argv.slice(2), env = process.env, log = console.log, importCatalog, providerFactory = (url) => new ethers.JsonRpcProvider(url, 4441, { staticNetwork: true }) } = {}) {
  const broadcast = hasFlag(argv, '--broadcast');
  const includeRelayerMinter = hasFlag(argv, '--include-relayer-minter');
  if (broadcast && env.LITVM_DEFINE_CONFIRM !== DEFINE_CONFIRM) {
    log(`Broadcast blocked. Set LITVM_DEFINE_CONFIRM=${DEFINE_CONFIRM} after reviewing the dry run.`);
    return 2;
  }
  const deployment = await loadLitvmDeployment(flagValue(argv, '--deployment'));
  if (broadcast && deployment.status !== 'deployed') {
    log(`Broadcast blocked: the address module is '${deployment.status}', not 'deployed'. Run the deploy (runbook step 3) and regenerate it first.`);
    return 2;
  }
  const catalog = await loadNftCatalog(importCatalog);
  const calls = planNftDefinitions({ catalog, deployment, relayer: deployment.relayer, includeRelayerMinter });
  log(`Planned ${calls.length} call(s) on chain ${deployment.chainId} (address module: ${deployment.status}):`);
  for (const call of calls) {
    log(`  ${call.gameId} ${call.to} ${call.method}(${call.method === 'defineAchievement' ? `${call.achievementId} -> ${call.args[4]}` : `${call.args[0]}, true`}) calldata ${ethers.keccak256(call.data)}`);
  }
  if (!broadcast) {
    log('DRY RUN ONLY. Nothing was signed or sent. Broadcast needs --broadcast, LITVM_DEFINE_CONFIRM and the operator key (--key-env <NAME>).');
    return 0;
  }
  const provider = providerFactory(flagValue(argv, '--rpc') ?? env.RPC_URL ?? DEFAULT_RPC_URL);
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== deployment.chainId) {
    log(`Broadcast blocked: the RPC is on chain ${network.chainId}, expected ${deployment.chainId}.`);
    return 2;
  }
  const signer = new ethers.Wallet(readSecret({ env, argv, label: 'operator key' }), provider);
  log(`Operator ${signer.address}. Sending…`);
  await broadcastNftDefinitions({ calls, signer, log });
  log('Done. Every collection now holds the approved definitions.');
  return 0;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMain) {
  try {
    process.exitCode = await runDefineCli();
  } catch (error) {
    console.error(`define-nft-achievements: ${error?.shortMessage ?? error?.message ?? error}`);
    process.exitCode = 1;
  }
}
