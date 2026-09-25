import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { inspect } from 'node:util';
import { ethers } from 'ethers';

import * as retryCronApi from '../api/cron/settle-retry.mjs';
import { LITVM_JACKPOT } from '../apps/portal/src/generated/litvm-jackpot.mjs';
import { DEFAULT_JACKPOT_MAX_TX_FEE_WEI, JACKPOT_ENV_NAMES, buildBaseDeps, readJackpotConfig, readServerConfig } from '../server/config.mjs';
import { createPgliteClient } from './helpers/pglite-client.mjs';
import { invoke } from './helpers/fake-http.mjs';
import { createCatalogDouble, createVerifyDouble, fixtureEnv, SETTLE_CRON_VALUE } from './helpers/settle-fixtures.mjs';

/**
 * jackpot-server AC2 (design §C.1): config.jackpot is a separate frozen part.
 * The keeper key lives only in a closure, JACKPOT_CONTRACT_ADDRESS is checked
 * against the statically imported LITVM_JACKPOT (overridable only through
 * the jackpotDeployment seam), and no jackpot variable ever changes
 * settlementReady or missing, so /api/settle and settle-retry cannot 503
 * because of the jackpot.
 */

// Public fixture keys only (Hardhat's mnemonic is not used here; these are
// arbitrary test scalars that no wallet funds).
const KEEPER_KEY = `0x${'5d'.repeat(32)}`;
const REGISTRY = '0xc5c5949a02fac9a4115df182672c0f8ceb0eaf55';
const JACKPOT = `0x${'ab12'.repeat(10)}`;
const DEPLOYED = Object.freeze({
  status: 'deployed', chainId: 4441, startBlock: 10, settlementGasReserveWei: '2000000000000000',
  addresses: Object.freeze({
    gameRegistry: '0xcb0b695ebee650afcce93f566259cb477b19bf23', playerProfileRegistry: '0x3eb9e9f2620940496a2b8ed6f7384e6687587c94',
    arcadeRankedEntry: '0x10cd09e694e2b2cd70d37f8cdddcda3ef1208190', scoreSubmissionRegistry: REGISTRY,
    achievementRegistries: Object.freeze({ 'lester-blaster': '0xc1a383cb7521978f429424443fdd69bdd71ff737', chikun: '0xf6cd1cf7e1accaea93accdfb911034b3e8eb6f93', stacked: '0x5430f8c142ca7ec8971a447cc09ae63f8860a8a7' }),
  }),
});

function jackpotDeploymentFixture({ address = JACKPOT, status = 'deployed' } = {}) {
  return Object.freeze({
    status,
    chainId: 4441,
    instances: Object.freeze({
      chikun: Object.freeze({
        address, startBlock: 100, firstWeek: 2961, admin: `0x${'07'.repeat(20)}`, keeper: new ethers.Wallet(KEEPER_KEY).address.toLowerCase(), residualRecipient: `0x${'07'.repeat(20)}`,
        token: Object.freeze({ address: `0x${'7e'.repeat(20)}`, symbol: 'tCHIKUN', decimals: 18, name: "Lester's Arcade Test CHIKUN (no value)", testnet: true }),
        retired: Object.freeze([]),
      }),
    }),
  });
}

const settlementEnv = (extra = {}) => fixtureEnv({ registry: REGISTRY, extra });

test('jackpot variables never change settlement readiness', async () => {
  const base = readServerConfig(settlementEnv(), { deployment: DEPLOYED });
  assert.equal(base.settlementReady, true, JSON.stringify(base.missing));
  const variants = [
    {},
    { JACKPOT_KEEPER_PRIVATE_KEY: KEEPER_KEY },
    { JACKPOT_KEEPER_PRIVATE_KEY: 'not-a-key' },
    { JACKPOT_CONTRACT_ADDRESS: 'nope' },
    { JACKPOT_CONTRACT_ADDRESS: `0x${'99'.repeat(20)}`, JACKPOT_KEEPER_PRIVATE_KEY: KEEPER_KEY },
    { JACKPOT_PAUSED: 'true', JACKPOT_UI_HIDDEN: 'true', JACKPOT_MAX_TX_FEE_WEI: '-1', JACKPOT_ADMIN_WALLET: 'garbage' },
  ];
  for (const extra of variants) {
    for (const jackpotDeployment of [null, jackpotDeploymentFixture(), jackpotDeploymentFixture({ status: 'undeployed' })]) {
      const config = readServerConfig(settlementEnv(extra), { deployment: DEPLOYED, jackpotDeployment });
      assert.equal(config.settlementReady, true, `settlementReady with ${JSON.stringify(extra)}`);
      assert.deepEqual([...config.missing], [], 'missing never names a jackpot variable');
    }
  }
  // Nothing jackpot-shaped reaches `missing` when settlement is broken either.
  const broken = readServerConfig({ VERCEL_ENV: 'development' }, { deployment: DEPLOYED, jackpotDeployment: jackpotDeploymentFixture() });
  assert.equal(broken.missing.some((name) => /JACKPOT|jackpot/.test(name)), false);
  for (const name of JACKPOT_ENV_NAMES) assert.equal(broken.missing.includes(name), false, name);

  // A missing keeper key leaves the settle-retry cron (and /api/settle's gate) untouched.
  const db = createPgliteClient();
  try {
    for (const extra of [{}, { JACKPOT_KEEPER_PRIVATE_KEY: 'broken', JACKPOT_CONTRACT_ADDRESS: 'broken' }]) {
      const handler = retryCronApi.createHandler(async () => {
        const deps = await retryCronApi.buildDeps(settlementEnv(extra), { db, deployment: DEPLOYED, provider: {}, nowMs: Date.parse('2026-10-01T12:00:00Z') });
        deps.verify = createVerifyDouble();
        deps.catalog = createCatalogDouble();
        return deps;
      });
      const response = await invoke(handler, { url: '/api/cron/settle-retry', headers: { authorization: `Bearer ${SETTLE_CRON_VALUE}` } });
      assert.deepEqual([response.status, response.body.ok], [200, true], JSON.stringify(response.body));
    }
  } finally {
    await db.close();
  }
});

test('config.jackpot readiness follows the keeper key, the address check and the deployment', () => {
  const ready = readServerConfig(settlementEnv({ JACKPOT_KEEPER_PRIVATE_KEY: KEEPER_KEY, JACKPOT_CONTRACT_ADDRESS: JACKPOT.toUpperCase().replace('0X', '0x') }), { deployment: DEPLOYED, jackpotDeployment: jackpotDeploymentFixture() });
  assert.equal(ready.jackpot.ready, true, JSON.stringify(ready.jackpot.missing));
  assert.deepEqual([ready.jackpot.contract.address, ready.jackpot.contract.matchesDeployment], [JACKPOT, true]);
  assert.equal(ready.jackpot.maxTxFeeWei, DEFAULT_JACKPOT_MAX_TX_FEE_WEI);
  assert.equal(DEFAULT_JACKPOT_MAX_TX_FEE_WEI, '10000000000000000', '0.01 zkLTC');
  assert.equal(Object.isFrozen(ready.jackpot), true);

  // The committed module is undeployed, so without the seam nothing is ready.
  assert.equal(LITVM_JACKPOT.status, 'undeployed');
  const committed = readServerConfig(settlementEnv({ JACKPOT_KEEPER_PRIVATE_KEY: KEEPER_KEY, JACKPOT_CONTRACT_ADDRESS: JACKPOT }), { deployment: DEPLOYED });
  assert.equal(committed.jackpot.ready, false);
  assert.ok(committed.jackpot.missing.includes('jackpot-not-deployed'));
  assert.equal(committed.jackpot.deployment, LITVM_JACKPOT);

  const mismatch = readServerConfig(settlementEnv({ JACKPOT_KEEPER_PRIVATE_KEY: KEEPER_KEY, JACKPOT_CONTRACT_ADDRESS: `0x${'99'.repeat(20)}` }), { deployment: DEPLOYED, jackpotDeployment: jackpotDeploymentFixture() });
  assert.deepEqual([mismatch.jackpot.ready, mismatch.jackpot.contract.matchesDeployment], [false, false]);
  assert.ok(mismatch.jackpot.missing.includes('jackpot-address-mismatch'));
  const noKey = readServerConfig(settlementEnv({ JACKPOT_CONTRACT_ADDRESS: JACKPOT }), { deployment: DEPLOYED, jackpotDeployment: jackpotDeploymentFixture() });
  assert.deepEqual([noKey.jackpot.ready, noKey.jackpot.keeper.configured, noKey.jackpot.keeper.address(ethers)], [false, false, null]);
  assert.throws(() => noKey.jackpot.keeper.createWallet(ethers, null), /keeper-not-configured/);

  const flags = readJackpotConfig({ JACKPOT_PAUSED: 'true', JACKPOT_UI_HIDDEN: 'true', JACKPOT_MAX_TX_FEE_WEI: '5000', JACKPOT_ADMIN_WALLET: `0x${'AB'.repeat(20)}` });
  assert.deepEqual([flags.paused, flags.uiHidden, flags.maxTxFeeWei, flags.adminWallet.address, flags.adminWallet.invalid], [true, true, '5000', `0x${'ab'.repeat(20)}`, false]);
  const lockedOut = readJackpotConfig({ JACKPOT_ADMIN_WALLET: 'not-an-address', JACKPOT_PAUSED: 'TRUE', JACKPOT_MAX_TX_FEE_WEI: '0' });
  assert.deepEqual([lockedOut.adminWallet.configured, lockedOut.adminWallet.address, lockedOut.adminWallet.invalid, lockedOut.paused, lockedOut.maxTxFeeWei], [true, null, true, false, DEFAULT_JACKPOT_MAX_TX_FEE_WEI]);
});

test('config redacts the keeper key everywhere', async () => {
  const env = settlementEnv({ JACKPOT_KEEPER_PRIVATE_KEY: KEEPER_KEY, JACKPOT_CONTRACT_ADDRESS: JACKPOT });
  const config = readServerConfig(env, { deployment: DEPLOYED, jackpotDeployment: jackpotDeploymentFixture() });
  const outputs = [
    inspect(config, { depth: 10, showHidden: true }),
    inspect(config.jackpot, { depth: 10, showHidden: true }),
    inspect({ nested: { config } }, { depth: 10, showHidden: true }),
    String(config),
    String(config.jackpot),
    JSON.stringify(config),
    JSON.stringify(config.jackpot),
    JSON.stringify({ config }),
  ];
  for (const output of outputs) {
    for (const secret of [KEEPER_KEY, KEEPER_KEY.slice(2), env.RANKED_RELAYER_PRIVATE_KEY, env.RANKED_VERIFIER_PRIVATE_KEY]) assert.equal(output.includes(secret), false, `a key leaked into ${output.slice(0, 80)}`);
  }
  assert.match(JSON.stringify(config), /"jackpot":\{"ready":true/, 'the redacted summary carries the jackpot part');
  const walk = (value, depth = 0) => {
    if (depth > 6 || value === null || typeof value !== 'object') return;
    for (const key of Reflect.ownKeys(value)) {
      const item = value[key];
      if (typeof item === 'string') assert.equal(item.includes(KEEPER_KEY.slice(2)), false, `key under ${String(key)}`);
      else walk(item, depth + 1);
    }
  };
  walk(config);
  // Only the closures reach the key.
  const wallet = config.jackpot.keeper.createWallet(ethers, null);
  assert.equal(wallet.address, new ethers.Wallet(KEEPER_KEY).address);
  assert.equal(config.jackpot.keeper.address(ethers), wallet.address.toLowerCase());

  // buildBaseDeps passes the seam to the config only (index deps keep their keys).
  const deps = await buildBaseDeps(env, { db: null, deployment: DEPLOYED, jackpotDeployment: jackpotDeploymentFixture() }, {});
  assert.equal(deps.config.jackpot.ready, true);
  assert.deepEqual(Object.keys(deps).sort(), ['config', 'crypto', 'db', 'deployment', 'fetchImpl', 'nowMs', 'provider']);
});

test('LITVM_JACKPOT is imported statically so the Vercel tracer bundles it', () => {
  const source = readFileSync(new URL('../server/config.mjs', import.meta.url), 'utf8');
  assert.match(source, /^import \{ LITVM_JACKPOT \} from '\.\.\/apps\/portal\/src\/generated\/litvm-jackpot\.mjs';$/m);
  assert.doesNotMatch(source, /import\(\s*['"][^'"]*litvm-jackpot/, 'never a dynamic import');
});
