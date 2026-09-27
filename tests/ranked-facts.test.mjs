// The static Ranked facts (apps/portal/src/ranked-facts.mjs) against the code
// that enforces each one (ranked-onboarding brief, acceptance criterion 1).
// A retuned fee or reserve, a new faucet, another board or a changed
// achievement catalog fails here until the public copy moves with it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  FAUCET_BUDGET_BASE_FEE_WEI, FAUCET_CHIP_TEXT, FAUCET_LINK_TEXT, RANKED_ENTRY_GAS_LIMIT, RANKED_FACTS, RANKED_WORDING, entryFeeCapWei, faucetRunsClause, rankedRunsFundedBy,
} from '../apps/portal/src/ranked-facts.mjs';
import { liteForgeMaxFeePerGas } from '../apps/portal/src/liteforge-fees.mjs';
import { checkRankedReadiness, loadEthers, GAME_REGISTRY_ABI, RANKED_ENTRY_ABI, RANKED_ENTRY_GAS_UNITS, SCORE_REGISTRY_ABI } from '../apps/portal/src/litvm-chain-client.mjs';
import { LITVM_CONTRACT_ADDRESSES } from '../apps/portal/src/settlement.mjs';
import * as fee from '../apps/portal/src/ranked-fee.mjs';
import * as core from '../apps/portal/src/arcade-core.mjs';
import { LITEFORGE_FAUCET_URL } from '../apps/portal/src/wallet-config.mjs';
import {
  DEFAULT_REVENUE_SPLIT_BPS, LITVM_LITEFORGE_NETWORK, RANKED_ENTRY_FEE_WEI, RANKED_ENTRY_FEE_ZKLTC, RANKED_ENTRY_TOTAL_WEI,
  RANKED_ENTRY_TOTAL_ZKLTC, RANKED_SETTLEMENT_GAS_RESERVE_WEI, RANKED_SETTLEMENT_GAS_RESERVE_ZKLTC,
} from '../apps/portal/src/arcade-core.mjs';
import { DEFAULT_MIN_PAID_WEI } from '../server/config.mjs';
import { ACHIEVEMENT_GAME_IDS, catalogFor } from '../apps/portal/src/achievements/index.mjs';
import { DEFAULT_LEADERBOARD_PERIOD, leaderboardPeriodTabs } from '../apps/portal/src/leaderboard-view.mjs';
import { PORTAL_GAMES } from '../apps/portal/src/portal-content.mjs';

const deployConfig = JSON.parse(readFileSync(new URL('../contracts/deploy-config.testnet.json', import.meta.url), 'utf8'));
const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const WEI_PER_ZKLTC = 10n ** 18n;
const toWei = (decimal) => {
  const [whole, fraction = ''] = decimal.split('.');
  return BigInt(whole) * WEI_PER_ZKLTC + BigInt((fraction + '0'.repeat(18)).slice(0, 18));
};

test('every decimal the copy prints is the wei value it stands for', () => {
  for (const [decimal, wei] of [['entryZkLtc', 'entryWei'], ['publishZkLtc', 'publishWei'], ['totalZkLtc', 'totalWei'], ['faucetZkLtc', 'faucetWei']]) {
    assert.match(RANKED_FACTS[decimal], /^0\.\d*[1-9]$/, `${decimal} is a plain decimal without trailing zeros`);
    assert.equal(toWei(RANKED_FACTS[decimal]), BigInt(RANKED_FACTS[wei]), decimal);
  }
  assert.equal(BigInt(RANKED_FACTS.entryWei) + BigInt(RANKED_FACTS.publishWei), BigInt(RANKED_FACTS.totalWei), 'entry + publishing = total');
  assert.equal(RANKED_FACTS.faucetRuns, rankedRunsFundedBy(RANKED_FACTS.faucetWei), 'whole Ranked runs one faucet request pays for, gas room included');
  // A retuned fee that leaves one request short of two runs must force a copy review.
  assert.ok(RANKED_FACTS.faucetRuns >= 2, 'one faucet request pays for at least two Ranked runs');
  assert.equal(RANKED_FACTS.developerPercent + RANKED_FACTS.arcadePercent, 100);
  assert.ok(Object.isFrozen(RANKED_FACTS) && Object.isFrozen(RANKED_WORDING));
});

test('the owner-approved price: 0.01 entry + 0.002 publishing = 0.012 zkLTC per run', () => {
  assert.deepEqual([RANKED_FACTS.entryZkLtc, RANKED_FACTS.publishZkLtc, RANKED_FACTS.totalZkLtc], ['0.01', '0.002', '0.012']);
  assert.equal(RANKED_WORDING.price, 'Ranked costs 0.012 testnet zkLTC per run: 0.01 entry + 0.002 to publish your score on chain.');
});

test('the price matches every game fee, the reserve and the split in the testnet deploy config', () => {
  assert.equal(BigInt(deployConfig.settlementGasReserveWei), BigInt(RANKED_FACTS.publishWei), 'settlementGasReserveWei');
  assert.deepEqual(deployConfig.games.map((game) => game.slug).sort(), PORTAL_GAMES.map((game) => game.id).sort());
  for (const game of deployConfig.games) {
    assert.equal(BigInt(game.entryFeeWei), BigInt(RANKED_FACTS.entryWei), `${game.slug} entryFeeWei`);
    assert.deepEqual([game.devBps, game.treasuryBps, game.platformBps, game.liquidityBps], [RANKED_FACTS.developerPercent * 100, RANKED_FACTS.arcadePercent * 100, 0, 0], `${game.slug} split`);
  }
});

test('the total is the server settle floor (contract A27, RANKED_MIN_PAID_WEI default)', () => {
  assert.equal(DEFAULT_MIN_PAID_WEI, RANKED_FACTS.totalWei);
});

test('the faucet, the chain and the explorer are the ones the wallet code uses', () => {
  assert.equal(RANKED_FACTS.faucetUrl, LITEFORGE_FAUCET_URL);
  assert.equal(RANKED_FACTS.faucetUrl, LITVM_LITEFORGE_NETWORK.faucetUrl);
  assert.equal(RANKED_FACTS.chainId, LITVM_LITEFORGE_NETWORK.chainId);
  assert.equal(RANKED_FACTS.token, LITVM_LITEFORGE_NETWORK.nativeCurrency.symbol);
  assert.equal(RANKED_FACTS.explorerUrl, LITVM_LITEFORGE_NETWORK.explorerUrl);
  assert.equal(RANKED_FACTS.networkName, `${LITVM_LITEFORGE_NETWORK.name} testnet`);
  assert.equal(RANKED_WORDING.faucet, 'Get free testnet zkLTC from the LiteForge faucet (0.05 per request, enough for about 3 Ranked runs).');
  assert.equal(FAUCET_LINK_TEXT, 'Get free zkLTC (0.05 per request)');
  assert.equal(FAUCET_CHIP_TEXT, 'Get 0.05 free zkLTC');
});

test('the boards and their resets are the hosted leaderboard tabs', () => {
  const tabs = leaderboardPeriodTabs();
  assert.deepEqual([...RANKED_FACTS.boards], tabs.map((tab) => tab.label));
  assert.equal(DEFAULT_LEADERBOARD_PERIOD, 'weekly');
  assert.equal(tabs.find((tab) => tab.id === 'weekly').resets, `Resets ${RANKED_FACTS.weeklyReset}`);
  assert.match(tabs.find((tab) => tab.id === 'monthly').resets, /^Resets on the 1st, 00:00 UTC$/);
  assert.equal(RANKED_FACTS.monthlyReset, 'the 1st of each month, 00:00 UTC');
  assert.equal(tabs.find((tab) => tab.id === 'all-time').resets, null, 'All-time never resets');
});

test('publishing retries every minute, as the settle-retry cron runs', () => {
  const cron = vercel.crons.find((entry) => entry.path === '/api/cron/settle-retry');
  assert.equal(cron?.schedule, '* * * * *');
  assert.equal(RANKED_FACTS.publishRetryMinutes, 1);
});

test('the achievement counts are the catalog entries a verified run can earn', () => {
  let total = 0;
  assert.deepEqual(Object.keys(RANKED_FACTS.achievements).sort(), [...ACHIEVEMENT_GAME_IDS].sort());
  for (const gameId of ACHIEVEMENT_GAME_IDS) {
    const available = catalogFor(gameId).filter((entry) => entry.available !== false).length;
    assert.equal(RANKED_FACTS.achievements[gameId], available, gameId);
    total += available;
  }
  assert.equal(RANKED_FACTS.achievementTotal, total);
});

test('the guide path is served by a vercel.json rewrite, like /games', () => {
  assert.equal(RANKED_FACTS.guidePath, '/how-ranked-works');
  assert.equal(RANKED_FACTS.guideUrl, `https://lestersarcade.io${RANKED_FACTS.guidePath}`);
  assert.deepEqual(vercel.rewrites.find((rewrite) => rewrite.source === RANKED_FACTS.guidePath), { source: '/how-ranked-works', destination: '/how-ranked-works.html' });
});

test('the canonical wording is plain: no jackpot, prizes, NFTs, dates or hype', () => {
  const text = [...Object.values(RANKED_WORDING), FAUCET_LINK_TEXT, FAUCET_CHIP_TEXT].join('\n');
  assert.doesNotMatch(text, /jackpot|prize|reward|\bNFTs?\b|soulbound|guarantee|earn money|real value|mainnet|20\d\d|!/i);
  assert.equal(RANKED_WORDING.free, 'Free play needs no wallet and never touches the chain.');
  assert.equal(RANKED_WORDING.value, 'Testnet zkLTC has no monetary value.');
  assert.equal(RANKED_WORDING.proof, "Ranked runs are checked by the arcade's server and published on LitVM, then appear on the leaderboards, your profile and your achievements.");
});

// fable/ranked-fee-001 made one place the source of the fee (tests/ranked-fee-source-of-truth.test.mjs). That
// place is the leaf ranked-fee.mjs, which arcade-core.mjs re-exports: the facts module reads the price from it
// and restates no fee or reserve.
test('the price comes from ranked-fee.mjs, the single source of the fee that arcade-core re-exports', () => {
  assert.deepEqual(
    [RANKED_FACTS.entryWei, RANKED_FACTS.publishWei, RANKED_FACTS.totalWei],
    [RANKED_ENTRY_FEE_WEI, RANKED_SETTLEMENT_GAS_RESERVE_WEI, RANKED_ENTRY_TOTAL_WEI],
  );
  assert.deepEqual(
    [RANKED_FACTS.entryZkLtc, RANKED_FACTS.publishZkLtc, RANKED_FACTS.totalZkLtc],
    [RANKED_ENTRY_FEE_ZKLTC, RANKED_SETTLEMENT_GAS_RESERVE_ZKLTC, RANKED_ENTRY_TOTAL_ZKLTC],
  );
  for (const name of Object.keys(fee)) assert.equal(core[name], fee[name], `arcade-core re-exports ${name} from ranked-fee.mjs`);
  assert.deepEqual([RANKED_FACTS.developerPercent * 100, RANKED_FACTS.arcadePercent * 100], [DEFAULT_REVENUE_SPLIT_BPS.dev, DEFAULT_REVENUE_SPLIT_BPS.treasury]);
  const source = readFileSync(new URL('../apps/portal/src/ranked-facts.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\b(?:entry|publish|total)(?:Wei|ZkLtc): ['`\d]/, 'no restated fee or reserve literal');
  assert.doesNotMatch(source, /\b(?:window|document|process|localStorage|fetch)\b/);
});

// owner/jackpot.mjs loads wallet-auth.mjs unbundled, and arcade-core.mjs's graph imports JSON a browser cannot
// load that way (tests/owner-jackpot-page.test.mjs): the fee, the facts and wallet-auth stay off arcade-core.
test('wallet-auth, the facts and the fee never reach arcade-core', () => {
  const importsOf = (file) => [...readFileSync(new URL(`../apps/portal/src/${file}`, import.meta.url), 'utf8').matchAll(/^\s*(?:import|export)\b[^;]*?\bfrom\s*'\.\/([^']+)'/gm)].map((match) => match[1]);
  assert.deepEqual(importsOf('ranked-fee.mjs'), [], 'ranked-fee.mjs is a leaf');
  assert.deepEqual(importsOf('ranked-facts.mjs'), ['ranked-fee.mjs']);
  const seen = new Set();
  const walk = (file) => { if (seen.has(file)) return; seen.add(file); importsOf(file).forEach(walk); };
  walk('wallet-auth.mjs');
  assert.ok(!seen.has('arcade-core.mjs'), [...seen].join(', '));
  assert.deepEqual([...seen].sort(), ['ranked-facts.mjs', 'ranked-fee.mjs', 'wallet-auth.mjs']);
});

// The faucet run count models the Ranked window's own funds check
// (litvm-chain-client.mjs checkRankedReadiness), not floor(faucet / total): the
// check also asks for the entry's gas limit at the fee cap it is sent with.
function liteForgeRpc({ balance, baseFee, ethers }) {
  const gameAbi = new ethers.Interface(GAME_REGISTRY_ABI);
  const scoreAbi = new ethers.Interface(SCORE_REGISTRY_ABI);
  const entryAbi = new ethers.Interface(RANKED_ENTRY_ABI);
  const owner = `0x${'12'.repeat(20)}`;
  const game = [ethers.id('chikun'), "Chikun's Escape", owner, 8500, 1500, 0, 0, BigInt(RANKED_FACTS.entryWei), true, true, true, 1n];
  const emptySession = [ethers.ZeroHash, ethers.ZeroAddress, ethers.ZeroHash, 0n, 0n, 0n, 0n, ethers.ZeroHash, ethers.ZeroHash, ethers.ZeroHash, 0n, false, false];
  return {
    async request({ method, params = [] }) {
      if (method === 'eth_chainId') return '0x1159';
      if (method === 'eth_blockNumber') return '0x10';
      if (method === 'eth_getCode') return '0x6000';
      if (method === 'eth_getBalance') return ethers.toQuantity(balance);
      if (method === 'eth_gasPrice') return ethers.toQuantity(baseFee);
      if (method === 'eth_maxPriorityFeePerGas') return '0x0';
      if (method === 'eth_getBlockByNumber') return { number: '0x10', hash: `0x${'aa'.repeat(32)}`, parentHash: `0x${'bb'.repeat(32)}`, timestamp: '0x1', nonce: '0x0000000000000000', difficulty: '0x0', gasLimit: '0x1c9c380', gasUsed: '0x0', miner: ethers.ZeroAddress, extraData: '0x', baseFeePerGas: ethers.toQuantity(baseFee), transactions: [] };
      if (method === 'eth_call') {
        const to = params[0].to.toLowerCase();
        if (to === LITVM_CONTRACT_ADDRESSES.gameRegistry) return gameAbi.encodeFunctionResult('getGame', [game]);
        if (to === LITVM_CONTRACT_ADDRESSES.arcadeRankedEntry) return entryAbi.encodeFunctionResult('quoteEntry', [BigInt(RANKED_FACTS.entryWei), BigInt(RANKED_FACTS.publishWei), BigInt(RANKED_FACTS.totalWei)]);
        const call = scoreAbi.parseTransaction({ data: params[0].data });
        if (call.name === 'gameRegistry') return scoreAbi.encodeFunctionResult('gameRegistry', [LITVM_CONTRACT_ADDRESSES.gameRegistry]);
        if (call.name === 'trustedVerifier') return scoreAbi.encodeFunctionResult('trustedVerifier', [`0x${'34'.repeat(20)}`]);
        if (call.name === 'getSession') return scoreAbi.encodeFunctionResult('getSession', [emptySession]);
        if (call.name === 'rankedEntry') return scoreAbi.encodeFunctionResult('rankedEntry', [LITVM_CONTRACT_ADDRESSES.arcadeRankedEntry]);
      }
      throw new Error(`LiteForge fixture does not implement ${method}`);
    },
  };
}

test('the faucet run count and the "about 0.016" amount follow the Ranked window funds check', async () => {
  assert.equal(RANKED_ENTRY_GAS_LIMIT, RANKED_ENTRY_GAS_UNITS, 'the gas limit the funds check budgets');
  for (const base of [0n, 10_000_000n, 499_999_999n, 500_000_000n, 1_500_000_000n, 1_700_000_000n, 5_000_000_000n]) {
    assert.equal(entryFeeCapWei(base), liteForgeMaxFeePerGas(base), `fee cap at ${base} wei`);
  }
  assert.equal(FAUCET_BUDGET_BASE_FEE_WEI, 1_500_000_000n, 'the copy budgets the 1.5 gwei LiteForge base fee');
  const need = BigInt(RANKED_FACTS.totalWei) + RANKED_ENTRY_GAS_UNITS * liteForgeMaxFeePerGas(FAUCET_BUDGET_BASE_FEE_WEI);
  assert.equal(BigInt(RANKED_FACTS.fundsCheckWei), need);
  assert.equal(RANKED_FACTS.fundsCheckWei, '15750000000000000', '0.012 + 250,000 gas x 15 gwei');
  assert.equal(RANKED_FACTS.fundsCheckZkLtc, '0.016', 'rounded up to 0.001 zkLTC');
  assert.ok(toWei(RANKED_FACTS.fundsCheckZkLtc) >= need && toWei(RANKED_FACTS.fundsCheckZkLtc) - need < 10n ** 15n);

  // Drive the real funds check with the balance left after each run (a run
  // burns the total plus at most the gas limit at the base fee).
  const ethers = await loadEthers();
  const spend = BigInt(RANKED_FACTS.totalWei) + RANKED_ENTRY_GAS_UNITS * FAUCET_BUDGET_BASE_FEE_WEI;
  const wallet = { async request({ method }) { if (method === 'eth_chainId') return '0x1159'; throw new Error(`the wallet must not be asked for ${method}`); } };
  const check = (balance) => checkRankedReadiness(wallet, { gameId: 'chikun', wallet: `0x${'56'.repeat(20)}`, readProvider: liteForgeRpc({ balance, baseFee: FAUCET_BUDGET_BASE_FEE_WEI, ethers }) });
  const faucet = BigInt(RANKED_FACTS.faucetWei);
  const last = await check(faucet - BigInt(RANKED_FACTS.faucetRuns - 1) * spend);
  assert.equal(last.needWei, need, 'the modal asks for the same amount');
  assert.equal(last.hasFunds, true, `run ${RANKED_FACTS.faucetRuns} is allowed`);
  const next = await check(faucet - BigInt(RANKED_FACTS.faucetRuns) * spend);
  assert.equal(next.hasFunds, false, `run ${RANKED_FACTS.faucetRuns + 1} is refused`);
  assert.equal(next.errorKind, 'insufficient-funds');

  // At the lowest base fees (the 5 gwei cap floor) a request stretches to one more run, hence "about".
  assert.equal(rankedRunsFundedBy(RANKED_FACTS.faucetWei, { baseFeeWei: 10_000_000n }), RANKED_FACTS.faucetRuns + 1);
});

test('the faucet sentence never says "1 Ranked runs" or "0 Ranked runs"', () => {
  assert.equal(faucetRunsClause(3), ', enough for about 3 Ranked runs');
  assert.equal(faucetRunsClause(1), ', enough for about 1 Ranked run');
  assert.equal(faucetRunsClause(0), '');
  // A fee above the faucet amount funds nothing.
  assert.equal(rankedRunsFundedBy(RANKED_FACTS.faucetWei, { totalWei: '60000000000000000' }), 0);
});
