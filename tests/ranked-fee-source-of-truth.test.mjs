// Ranked fee single source of truth (owner decision 2026-09-26): a 0.01 zkLTC entry plus the 0.002 zkLTC
// settlement reserve is 0.012 zkLTC per run, lowered from 0.1 + 0.002 = 0.102 (the LiteForge faucet gives
// 0.05 zkLTC per request). The wei pair in arcade-core.mjs is the one place the numbers live; every string
// a player, a crawler, the settle floor or a deploy reads must agree with it, so a later fee change is one
// edit plus the on-chain GameRegistry.setEntryFee. The runtime price itself stays quote-driven
// (ArcadeRankedEntry.quoteEntry replaces the reserve and total rows once the chain answers).
//
// Release order (contract A27): the server with the lower settle floor ships FIRST, because runs paid at
// the old 0.102 still clear a 0.012 floor, while a 0.012 run would be refused (402 entry-underpaid) by a
// server still on the 0.102 floor. The pre-deploy session sends the three setEntryFee transactions only
// after that release is live.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  RANKED_ENTRY_FEE_WEI, RANKED_ENTRY_FEE_ZKLTC, RANKED_SETTLEMENT_GAS_RESERVE_WEI, RANKED_SETTLEMENT_GAS_RESERVE_ZKLTC,
  RANKED_ENTRY_TOTAL_WEI, RANKED_ENTRY_TOTAL_ZKLTC, formatZkLtcAmount, formatZkLtcWei, rankedEntryTotalWei,
} from '../apps/portal/src/arcade-core.mjs';
import { JACKPOT_LEGAL_DRAFT, PORTAL_GAMES, RANKED_LAUNCH_TERMS } from '../apps/portal/src/portal-content.mjs';
import { walletErrorAction } from '../apps/portal/src/wallet-auth.mjs';
import { DEFAULT_MIN_PAID_WEI } from '../server/config.mjs';
import { LAUNCH_MIN_PAID_WEI } from '../scripts/generate-litvm-jackpot.mjs';
import { MIN_PAID_WEI as REHEARSAL_MIN_PAID_WEI } from '../scripts/lib/rehearsal-driver.mjs';
import { MIN_PAID_WEI as LIVE_E2E_MIN_PAID_WEI } from '../scripts/ranked-live-browser-e2e.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const deployConfig = JSON.parse(read('contracts/deploy-config.testnet.json'));
const toWei = (decimal) => {
  const [whole, fraction = ''] = decimal.split('.');
  return BigInt(whole) * 10n ** 18n + BigInt((fraction + '0'.repeat(18)).slice(0, 18));
};

test('the client fee constants are 0.01 + 0.002 = 0.012 zkLTC and every string derives from the wei pair', () => {
  assert.equal(RANKED_ENTRY_FEE_WEI, '10000000000000000');
  assert.equal(RANKED_SETTLEMENT_GAS_RESERVE_WEI, '2000000000000000');
  assert.equal(RANKED_ENTRY_TOTAL_WEI, rankedEntryTotalWei());
  assert.equal(BigInt(RANKED_ENTRY_TOTAL_WEI), BigInt(RANKED_ENTRY_FEE_WEI) + BigInt(RANKED_SETTLEMENT_GAS_RESERVE_WEI));
  assert.deepEqual([RANKED_ENTRY_FEE_ZKLTC, RANKED_SETTLEMENT_GAS_RESERVE_ZKLTC, RANKED_ENTRY_TOTAL_ZKLTC], ['0.01', '0.002', '0.012']);
  for (const [wei, decimal] of [
    [RANKED_ENTRY_FEE_WEI, RANKED_ENTRY_FEE_ZKLTC],
    [RANKED_SETTLEMENT_GAS_RESERVE_WEI, RANKED_SETTLEMENT_GAS_RESERVE_ZKLTC],
    [RANKED_ENTRY_TOTAL_WEI, RANKED_ENTRY_TOTAL_ZKLTC],
  ]) {
    assert.equal(formatZkLtcAmount(wei), decimal);
    assert.equal(toWei(decimal).toString(), wei, 'the decimal round-trips to the wei');
    assert.equal(formatZkLtcWei(wei), `${decimal} zkLTC`);
  }
  assert.equal(formatZkLtcAmount('0'), '0');
  assert.equal(formatZkLtcAmount('1000000000000000000'), '1');
  assert.equal(formatZkLtcAmount('102000000000000000'), '0.102', 'the previous price still formats');
});

test('deploy-config.testnet.json registers the same fee and reserve for every game', () => {
  assert.deepEqual(deployConfig.games.map((game) => game.slug).sort(), PORTAL_GAMES.map((game) => game.id).sort());
  for (const game of deployConfig.games) assert.equal(game.entryFeeWei, RANKED_ENTRY_FEE_WEI, `${game.slug} entryFeeWei`);
  assert.equal(deployConfig.settlementGasReserveWei, RANKED_SETTLEMENT_GAS_RESERVE_WEI);
  assert.match(deployConfig._recipients, /flat 0\.01 zkLTC entry fee/);
});

test('the settle floor (A27) is the deploy-config fee plus reserve, so this server ships before setEntryFee', () => {
  const [{ entryFeeWei }] = deployConfig.games;
  assert.equal(BigInt(DEFAULT_MIN_PAID_WEI), BigInt(entryFeeWei) + BigInt(deployConfig.settlementGasReserveWei));
  assert.equal(DEFAULT_MIN_PAID_WEI, RANKED_ENTRY_TOTAL_WEI);
  // Runs paid at the previous 0.102 zkLTC price still clear the new floor; the reverse order would not.
  assert.ok(102_000_000_000_000_000n >= BigInt(DEFAULT_MIN_PAID_WEI));
  assert.equal(REHEARSAL_MIN_PAID_WEI, BigInt(DEFAULT_MIN_PAID_WEI), 'scripts/lib/rehearsal-driver.mjs follows the floor');
  assert.equal(LIVE_E2E_MIN_PAID_WEI, BigInt(DEFAULT_MIN_PAID_WEI), 'scripts/ranked-live-browser-e2e.mjs follows the floor');
});

test('the public launch terms and the jackpot legal draft quote the derived strings', () => {
  assert.deepEqual(
    [RANKED_LAUNCH_TERMS.feeZkLtc, RANKED_LAUNCH_TERMS.reserveZkLtc, RANKED_LAUNCH_TERMS.totalZkLtc],
    [RANKED_ENTRY_FEE_ZKLTC, RANKED_SETTLEMENT_GAS_RESERVE_ZKLTC, RANKED_ENTRY_TOTAL_ZKLTC],
  );
  const entry = JACKPOT_LEGAL_DRAFT.items.find(([lead]) => lead === 'Entry.');
  assert.equal(entry[1], `Only Ranked runs count (${RANKED_ENTRY_TOTAL_ZKLTC} testnet zkLTC per run). Free Mode is always free but is not eligible.`);
});

test('index.html and every generated discover page carry the derived fee rows as static fallbacks', () => {
  const rows = (html) => ({
    fee: html.match(/<strong id="rankedEntryFee">([^<]*)<\/strong>/)?.[1],
    reserve: html.match(/<strong id="rankedEntryReserve">([^<]*)<\/strong>/)?.[1],
    total: html.match(/<strong id="rankedEntryTotal">([^<]*)<\/strong>/)?.[1],
  });
  const expected = {
    fee: formatZkLtcWei(RANKED_ENTRY_FEE_WEI),
    reserve: formatZkLtcWei(RANKED_SETTLEMENT_GAS_RESERVE_WEI),
    total: formatZkLtcWei(RANKED_ENTRY_TOTAL_WEI),
  };
  for (const page of ['apps/portal/index.html', 'apps/portal/discover/games.html', ...PORTAL_GAMES.map((game) => `apps/portal/discover/${game.slug}.html`)]) {
    const html = read(page);
    assert.deepEqual(rows(html), expected, page);
    assert.doesNotMatch(html, /0\.102|0\.1 zkLTC/, `${page} keeps no trace of the 0.1 zkLTC price`);
  }
  for (const page of ['apps/portal/trust.html', 'apps/portal/llms.txt', 'apps/portal/manifest.webmanifest', 'apps/portal/jackpot/chikun.html']) {
    assert.doesNotMatch(read(page), /0\.102|0\.1 zkLTC/, `${page} keeps no trace of the 0.1 zkLTC price`);
  }
});

test('the insufficient-funds fallback names the derived total when no quote is known', () => {
  assert.equal(walletErrorAction({ kind: 'insufficient-funds' }).message, `You need about ${RANKED_ENTRY_TOTAL_ZKLTC} zkLTC. Balance unknown.`);
});

test('the jackpot launch rules couple minPaidWei to the flat fee (J17) for any future instance', () => {
  // Pots are funded only by $CHIKUN deposits; the fee never flows into them. The coupling is eligibility:
  // the deployed testnet epoch (contracts/deployment-record.jackpot.json) still carries minPaidWei 0.1 zkLTC,
  // so no 0.012 run qualifies there. The jackpot is on hold until mainnet (owner decision 2026-09-26), whose
  // instance must be deployed with minPaidWei equal to the fee in force then (or rescheduled on a Monday).
  assert.equal(LAUNCH_MIN_PAID_WEI, BigInt(RANKED_ENTRY_FEE_WEI));
  const deployed = JSON.parse(read('contracts/deployment-record.jackpot.json'));
  const deployedMinPaid = JSON.stringify(deployed).match(/"minPaidWei":"(\d+)"/)?.[1];
  assert.equal(deployedMinPaid, '100000000000000000', 'the deployed epoch is a record of what is on chain, not a mirror of the fee');
  assert.ok(BigInt(RANKED_ENTRY_TOTAL_WEI) < BigInt(deployedMinPaid), 'a 0.012 run does not qualify on the deployed instance');
});
