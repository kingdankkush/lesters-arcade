// The in-process chain for the jackpot-server keeper and cron tests: the
// 1.8.x Ranked suite (deployLocalSuite, fees on), a WeeklyJackpot with
// tCHIKUN (deployLocalJackpot), and the deployment objects the server reads
// (LITVM_DEPLOYMENT-shaped `deployment`, LITVM_JACKPOT-shaped
// `jackpotDeployment`). Chain time moves only through setChainTime.
//
// Keys: Hardhat's public test mnemonic only.

import { ethers } from 'ethers';
import { activateLocalGames, deployLocalSuite, localContracts, localWalletKeys, startLocalChain } from '../../../scripts/lib/local-chain.mjs';
import {
  attestLocalRun, deployLocalJackpot, derivedFixtureWallet, fastLocalProvider, fixtureKeyAt, launchRules, openLocalSession, reconnectWallets, setChainTime,
} from '../../../scripts/lib/local-jackpot.mjs';
import { jackpotModuleValue } from '../../../scripts/generate-litvm-jackpot.mjs';
import { boundsOf, weekIndexOf, weekStartOf } from '../../../server/jackpot/weeks.mjs';

export const HOUR = 3600;
export const DAY = 24 * HOUR;
export const TOKEN = 10n ** 18n;
export const MIN_FUND = 100n * TOKEN;

function deploymentOf(suite) {
  const addresses = suite.addresses;
  return Object.freeze({
    status: 'deployed',
    chainId: 4441,
    source: 'local-chain',
    startBlock: suite.startBlock ?? 0,
    deployer: String(suite.deployer).toLowerCase(),
    trustedVerifier: String(suite.trustedVerifier).toLowerCase(),
    relayer: String(suite.relayer).toLowerCase(),
    settlementGasReserveWei: String(suite.settlementGasReserveWei),
    addresses: Object.freeze({
      gameRegistry: addresses.gameRegistry.toLowerCase(),
      playerProfileRegistry: addresses.playerProfileRegistry.toLowerCase(),
      arcadeRankedEntry: addresses.arcadeRankedEntry.toLowerCase(),
      scoreSubmissionRegistry: addresses.scoreSubmissionRegistry.toLowerCase(),
      achievementRegistries: Object.freeze(Object.fromEntries(Object.entries(addresses.achievementRegistries).map(([slug, address]) => [slug, address.toLowerCase()]))),
    }),
  });
}

export async function bootJackpotChain({ rules = {} } = {}) {
  const chain = await startLocalChain();
  const provider = fastLocalProvider(chain);
  const wallets = reconnectWallets(chain.wallets, provider);
  const now = (await provider.getBlock('latest')).timestamp;
  // A Tuesday, so setup never straddles a Monday; the jackpot starts next week.
  await setChainTime(provider, weekStartOf(weekIndexOf(now) + 1) + DAY);
  const suite = await deployLocalSuite({ provider, wallets });
  await activateLocalGames({ provider, record: suite, developer: wallets.developer, operator: wallets.operator });
  const deployed = await deployLocalJackpot({ provider, wallets, record: suite, rules: { ...launchRules(suite), adminClearOnly: false, ...rules } });
  const all = reconnectWallets(deployed.wallets, provider);
  const funder = await derivedFixtureWallet(provider, 20);
  await (await deployed.token.connect(all.operator).mint(funder.address, 1_000_000n * TOKEN)).wait();
  const h = {
    chain,
    provider,
    wallets: all,
    funder,
    suite,
    jackpot: deployed.jackpot.connect(provider),
    token: deployed.token.connect(provider),
    record: deployed.record,
    contract: (await deployed.jackpot.getAddress()).toLowerCase(),
    W: deployed.record.instances.chikun.firstWeek,
    deployment: deploymentOf(suite),
    jackpotDeployment: jackpotModuleValue(deployed.record),
    keeperKey: fixtureKeyAt(8),
    verifierKey: localWalletKeys().verifier,
    extra: [],
  };
  h.at = (seconds) => setChainTime(provider, seconds);
  h.nextAt = (seconds) => setChainTime(provider, seconds, { mine: false });
  h.now = async () => (await provider.getBlock('latest')).timestamp;
  h.bounds = (week = h.W, extension = 0) => boundsOf(week, extension);
  h.player = async (index) => {
    while (h.extra.length <= index) h.extra.push(await derivedFixtureWallet(provider, 10 + h.extra.length));
    return h.extra[index];
  };
  // A settled Ranked Chikun run on chain (open at openAt, settle at settleAt).
  h.settle = async ({ player, sessionId, score, survivalSeconds = 120n, openAt = null, settleAt = null, kills = 0n, maxCombo = 0n, seasonId = undefined, runtimeId = undefined }) => {
    await openLocalSession({ provider, record: suite, player, sessionId, openAt });
    const { run, signature } = await attestLocalRun({ provider, record: suite, player, verifierKey: h.verifierKey, sessionId, score, survivalSeconds, ...(seasonId ? { seasonId } : {}), ...(runtimeId ? { runtimeId } : {}) });
    run.kills = BigInt(kills);
    run.maxCombo = BigInt(maxCombo);
    const signed = await attestWithFields({ provider, suite, player, verifierKey: h.verifierKey, run });
    if (settleAt !== null) await h.nextAt(settleAt);
    const receipt = await (await localContracts(suite, provider).scores.connect(all.relayer).submitVerifiedSession(signed.run, [], signed.signature)).wait();
    const block = await provider.getBlock(receipt.blockNumber);
    return { sessionId, submittedAt: block.timestamp, signature };
  };
  // The same in two steps: pay (open) during the week, publish later.
  h.open = ({ player, sessionId, openAt = null }) => openLocalSession({ provider, record: suite, player, sessionId, openAt });
  h.publish = async ({ player, sessionId, score, survivalSeconds = 120n, kills = 0n, maxCombo = 0n, settleAt = null }) => {
    const { run } = await attestLocalRun({ provider, record: suite, player, verifierKey: h.verifierKey, sessionId, score, survivalSeconds });
    run.kills = BigInt(kills);
    run.maxCombo = BigInt(maxCombo);
    const signed = await attestWithFields({ provider, suite, player, verifierKey: h.verifierKey, run });
    if (settleAt !== null) await h.nextAt(settleAt);
    const receipt = await (await localContracts(suite, provider).scores.connect(all.relayer).submitVerifiedSession(signed.run, [], signed.signature)).wait();
    return { sessionId, submittedAt: (await provider.getBlock(receipt.blockNumber)).timestamp };
  };
  h.fund = async (week, amount, from = funder) => {
    await (await deployed.token.connect(from).approve(h.contract, amount)).wait();
    return (await deployed.jackpot.connect(from).fund(week, amount)).wait();
  };
  h.close = () => chain.close();
  return h;
}

// Signs a VerifiedRun whose fields were edited after attestLocalRun.
async function attestWithFields({ provider, suite, verifierKey, run }) {
  const { scores } = localContracts(suite, provider);
  const signature = new ethers.SigningKey(verifierKey).sign(await scores.attestationDigest(run)).serialized;
  return { run, signature };
}
