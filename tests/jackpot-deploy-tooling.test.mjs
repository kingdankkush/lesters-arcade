// Jackpot tooling (design §A.18, runbook E2-E4, E8 and the emergency stops): the two-phase deploy script, the
// generated litvm-jackpot.mjs module and its record, the operator CLI and the keeper-key generator. Every
// chain action runs on the in-process chain (chainId 4441, offline) behind a loopback JSON-RPC bridge;
// fixture keys are the PUBLIC Hardhat test keys, passed through environment variables or files under the
// OS temp directory, and no output may contain one.
import test, { after, afterEach, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ethers } from 'ethers';
import { activateLocalGames, deployLocalSuite, loadArtifact, localWalletKeys, serveJsonRpc, startLocalChain } from '../scripts/lib/local-chain.mjs';
import { deployLocalJackpot, deployMockToken, derivedFixtureWallet, fastLocalProvider, fixtureKeyAt, jackpotAt, reconnectWallets, setChainTime, tokenAt, weekIndexOf, weekKeyOf, weekStartOf } from '../scripts/lib/local-jackpot.mjs';
import { writeLitvmAddressModule } from '../scripts/generate-litvm-addresses.mjs';
import {
  JACKPOT_MODULE_BANNER,
  checkLitvmJackpotModule,
  jackpotModuleValue,
  normalizeJackpotRecord,
  readJackpotRecord,
  renderLitvmJackpotModule,
  runGenerateJackpotCli,
  writeJackpotRecord,
  writeLitvmJackpotModule,
} from '../scripts/generate-litvm-jackpot.mjs';
import { DEPLOY_JACKPOT_CONFIRM, TOKEN_ACCEPTANCE_CHECKLIST, runDeployJackpotCli } from '../scripts/deploy-weekly-jackpot.mjs';
import { JACKPOT_ACTIONS, SET_KEEPER_REMINDER, runJackpotCli } from '../scripts/jackpot-actions.mjs';
import { runKeeperKeyCli } from '../scripts/jackpot-keeper-key.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const TOKEN = 10n ** 18n;
const HOUR = 3600;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const keys = localWalletKeys();
const FUNDER_KEY = fixtureKeyAt(20);
const SECRETS = [keys.operator, keys.developer, keys.attacker, keys.player1, FUNDER_KEY];
const ENV = { JACKPOT_TEST_OPERATOR_KEY: keys.operator, JACKPOT_TEST_ATTACKER_KEY: keys.attacker, JACKPOT_TEST_FUNDER_KEY: FUNDER_KEY };

let chain;
let provider;
let wallets;
let suite;
let bridge;
let dir;
let suiteModule;
let local; // a jackpot deployed with deployLocalJackpot, for the operator CLI
let localModule;
let W;
let funder;
let snapshotId;

const mined = async (promise) => (await promise).wait();
const at = (seconds) => setChainTime(provider, seconds);

function assertNoSecret(text, label) {
  for (const secret of SECRETS) {
    assert.equal(String(text).includes(secret), false, `${label} must not contain a key`);
    assert.equal(String(text).toLowerCase().includes(secret.slice(2).toLowerCase()), false, `${label} must not contain a key (without 0x)`);
  }
}

// Runs a CLI in process against the in-process chain (a fresh fast provider per run; the CLI destroys it).
async function runCli(cli, argv, env = ENV) {
  const lines = [];
  const code = await cli({ argv, env, log: (line) => lines.push(String(line)), providerFactory: () => fastLocalProvider(chain) });
  const output = lines.join('\n');
  assertNoSecret(output, `${argv[0]} output`);
  return { code, output, lines };
}

const deployArgs = (extra = []) => [
  '--game', 'chikun', '--first-week', 'next', '--admin', wallets.developer.address, '--keeper', local.wallets.keeper.address,
  '--residual', wallets.developer.address, '--rules', 'launch', '--rpc', bridge.url, '--deployment', suiteModule, ...extra,
];
const actions = (action, extra = []) => [action, ...extra, '--rpc', bridge.url, '--deployment', localModule];
const operatorNonce = () => provider.getTransactionCount(wallets.operator.address, 'latest');

before(async () => {
  chain = await startLocalChain();
  provider = fastLocalProvider(chain);
  wallets = reconnectWallets(chain.wallets, provider);
  await at(weekStartOf(weekIndexOf(await chain.latestTimestamp()) + 1) + DAY);
  suite = await deployLocalSuite({ provider, wallets });
  await activateLocalGames({ provider, record: suite, developer: wallets.developer, operator: wallets.operator });
  dir = mkdtempSync(join(tmpdir(), 'jackpot-tooling-'));
  suiteModule = writeLitvmAddressModule({ root, mode: 'deployed', record: suite, outPath: join(dir, 'litvm-addresses.mjs') }).path;
  bridge = await serveJsonRpc(chain.eip1193);
  local = await deployLocalJackpot({ provider, wallets, record: suite });
  W = local.record.instances.chikun.firstWeek;
  localModule = writeLitvmJackpotModule({ root, record: local.record, outPath: join(dir, 'litvm-jackpot.local.mjs') }).path;
  funder = await derivedFixtureWallet(provider, 20);
});

beforeEach(async () => {
  snapshotId = await chain.snapshot();
});

afterEach(async () => {
  await chain.revert(snapshotId);
});

after(async () => {
  await bridge?.close();
  await chain?.close();
  if (dir) rmSync(dir, { recursive: true, force: true });
});

test('deploy dry run prints a manifest and sends nothing', async () => {
  const [nonceBefore, blockBefore] = [await operatorNonce(), await provider.getBlockNumber()];
  const pending = await provider.getTransactionCount(wallets.operator.address, 'pending');
  const { code, lines } = await runCli(runDeployJackpotCli, deployArgs(['--json']));
  assert.equal(code, 0);
  const manifest = JSON.parse(lines.join('\n'));
  assert.equal(manifest.dryRun, true);
  assert.equal(manifest.chainId, 4441);
  assert.equal(manifest.operator, wallets.operator.address.toLowerCase());
  const current = weekIndexOf(await chain.latestTimestamp());
  assert.deepEqual(manifest.currentWeek, { index: current, key: weekKeyOf(current) });
  assert.equal(manifest.firstWeek.index, current + 1);
  assert.equal(manifest.token.deploy, true);
  assert.equal(manifest.token.predictedAddress, ethers.getCreateAddress({ from: wallets.operator.address, nonce: pending }).toLowerCase());
  assert.equal(manifest.jackpot.predictedAddress, ethers.getCreateAddress({ from: wallets.operator.address, nonce: pending + 1 }).toLowerCase());
  assert.equal(manifest.token.constructorArgs.minter, wallets.operator.address.toLowerCase());
  // eth_call of each creation code: the constructors execute and return the runtime.
  const runtimeBytes = (name) => JSON.parse(readFileSync(join(root, 'contracts', 'artifacts', `${name}.json`), 'utf8')).evm.deployedBytecode.object.length / 2;
  assert.deepEqual([manifest.token.creationCall.ok, manifest.token.creationCall.runtimeBytes], [true, runtimeBytes('TestChikunToken')]);
  assert.deepEqual([manifest.jackpot.creationCall.ok, manifest.jackpot.creationCall.runtimeBytes], [true, runtimeBytes('WeeklyJackpot')]);
  assert.match(manifest.token.gasEstimate, /^\d+$/);
  assert.match(manifest.jackpot.gasEstimate, /^\d+$/);
  assert.equal(BigInt(manifest.totalGasEstimate), BigInt(manifest.token.gasEstimate) + BigInt(manifest.jackpot.gasEstimate));
  const args = manifest.jackpot.constructorArgs;
  assert.deepEqual([args.gameId, args.token, args.scoreRegistry, args.rankedEntry, args.firstWeek, args.operator, args.admin, args.keeper, args.residualRecipient], [
    ethers.id('chikun'), manifest.token.predictedAddress, suite.addresses.scoreSubmissionRegistry.toLowerCase(), suite.addresses.arcadeRankedEntry.toLowerCase(),
    current + 1, wallets.operator.address.toLowerCase(), wallets.developer.address.toLowerCase(), local.wallets.keeper.address.toLowerCase(), wallets.developer.address.toLowerCase(),
  ]);
  // --rules launch: design §A.5.
  assert.deepEqual(args.rules, {
    fromWeek: current + 1, maxSurvivalSeconds: 3599, adminClearOnly: true, minPaidWei: '100000000000000000', maxPrizeWei: '0',
    minFundWei: '100000000000000000000', maxScore: '0', seasonId: ethers.id('chikun-season-preview-1'), altSeasonId: ethers.ZeroHash,
  });
  assert.equal(manifest.confirm, DEPLOY_JACKPOT_CONFIRM);
  assert.deepEqual([await operatorNonce(), await provider.getBlockNumber()], [nonceBefore, blockBefore], 'nothing was sent or mined');
  // The human manifest, through the real HTTP JSON-RPC path.
  const human = [];
  assert.equal(await runDeployJackpotCli({ argv: deployArgs(), env: ENV, log: (line) => human.push(line) }), 0);
  const text = human.join('\n');
  assert.match(text, /^DRY RUN: deploy the Chikun Weekly Jackpot on chain 4441\. Nothing was signed or sent\./);
  assert.match(text, new RegExp(`--broadcast --confirm ${DEPLOY_JACKPOT_CONFIRM}`));
  assert.match(text, /creation eth_call ok/);
  // --token skips the tCHIKUN deploy and lists the token acceptance checklist.
  const mock = await deployMockToken('BlacklistToken', [], wallets.operator);
  const withToken = await runCli(runDeployJackpotCli, deployArgs(['--token', await mock.getAddress(), '--json']));
  const tokenManifest = JSON.parse(withToken.lines.join('\n'));
  const nonce = await provider.getTransactionCount(wallets.operator.address, 'pending');
  assert.equal(tokenManifest.token.deploy, false);
  assert.equal(tokenManifest.token.symbol, 'BLKMOCK');
  assert.equal(tokenManifest.token.acceptanceChecklist.length, 10);
  assert.equal(TOKEN_ACCEPTANCE_CHECKLIST.length, 10);
  assert.equal(tokenManifest.jackpot.predictedAddress, ethers.getCreateAddress({ from: wallets.operator.address, nonce }).toLowerCase());
});

test('deploy refuses a current or past first week and an overlapping retire-previous', async () => {
  const current = weekIndexOf(await chain.latestTimestamp());
  const refuse = async (argv, pattern) => {
    const { code, output } = await runCli(runDeployJackpotCli, argv);
    assert.equal(code, 2, output);
    assert.match(output, pattern);
  };
  const withWeek = (week, extra = []) => deployArgs(extra).map((arg, index, all) => (all[index - 1] === '--first-week' ? week : arg));
  await refuse(withWeek('current'), /--first-week current is refused/);
  await refuse(withWeek(weekKeyOf(current)), /is not after the current week/);
  await refuse(withWeek(weekKeyOf(current - 3)), /is not after the current week/);
  await refuse(withWeek('2026-W54'), /no such ISO week/);
  await refuse(withWeek('soon'), /must be next or a future YYYY-Www/);
  await refuse(['--first-week', 'next', '--admin', wallets.developer.address, '--keeper', wallets.developer.address, '--residual', wallets.developer.address, '--deployment', suiteModule], /honoured only with a loopback --rpc/);
  await refuse(['--first-week', 'next', '--admin', wallets.developer.address, '--keeper', wallets.developer.address, '--residual', wallets.developer.address, '--rpc', 'https://liteforge.rpc.caldera.xyz/http'], /--rpc is honoured only for a loopback RPC/);
  await refuse(deployArgs(['--game', 'stacked']).slice(2), /--game must be chikun/);
  await refuse(deployArgs(['--retire-previous']), /--retire-previous needs an existing jackpot record/);
  // An existing record: deploying again needs --retire-previous, a scheduled end, and a later first week.
  const recordPath = join(dir, 'existing.jackpot.json');
  writeJackpotRecord({ record: local.record, recordPath });
  await refuse(deployArgs(['--record', recordPath]), /already exists .* --retire-previous/);
  await refuse(deployArgs(['--record', recordPath, '--retire-previous']), /has no scheduled end/);
  await at(weekStartOf(W) + HOUR);
  await mined(local.jackpot.connect(wallets.operator).scheduleEnd(W + 2));
  await refuse(withWeek(weekKeyOf(W + 2), ['--record', recordPath, '--retire-previous']), /must be after the previous instance's end/);
  const ok = await runCli(runDeployJackpotCli, withWeek(weekKeyOf(W + 3), ['--record', recordPath, '--retire-previous', '--json']));
  assert.equal(ok.code, 0, ok.output);
  const manifest = JSON.parse(ok.lines.join('\n'));
  assert.deepEqual(manifest.retirePrevious, { address: local.record.instances.chikun.address, endAfterWeek: W + 2, endAfterWeekKey: weekKeyOf(W + 2), firstWeek: W });
});

test('deploy broadcast needs the confirm phrase and the operator key', async () => {
  const recordPath = join(dir, 'broadcast.jackpot.json');
  const modulePath = join(dir, 'broadcast.litvm-jackpot.mjs');
  rmSync(recordPath, { force: true });
  rmSync(modulePath, { force: true });
  const nonceBefore = await operatorNonce();
  const blockedRun = async (extra, pattern, env = {}) => {
    const { code, output } = await runCli(runDeployJackpotCli, deployArgs(extra), env);
    assert.equal(code, 2, output);
    assert.match(output, pattern);
  };
  // Guards run before the key is read (the env holds no key at all here).
  await blockedRun(['--broadcast'], /add --confirm DEPLOY_WEEKLY_JACKPOT_4441/);
  await blockedRun(['--broadcast', '--confirm', 'DEPLOY'], /add --confirm DEPLOY_WEEKLY_JACKPOT_4441/);
  await blockedRun(['--broadcast', '--confirm', DEPLOY_JACKPOT_CONFIRM, '--key-env', 'JACKPOT_TEST_OPERATOR_KEY'], /must name --record and --module/, ENV);
  const broadcast = ['--broadcast', '--confirm', DEPLOY_JACKPOT_CONFIRM, '--record', recordPath, '--module', modulePath];
  await blockedRun([...broadcast, '--key-env', 'JACKPOT_TEST_MISSING_KEY'], /environment variable JACKPOT_TEST_MISSING_KEY is not set/, ENV);
  await blockedRun([...broadcast, '--key-env', 'JACKPOT_TEST_ATTACKER_KEY'], /the key is for 0x[0-9a-fA-F]{40}, but the operator is/, ENV);
  assert.equal(await operatorNonce(), nonceBefore, 'nothing was sent');
  assert.equal(existsSync(recordPath) || existsSync(modulePath), false, 'nothing was written');
  // The operator key from a key file (the vault shape), and the broadcast goes through.
  const keyFile = join(dir, 'operator-keys.json');
  writeFileSync(keyFile, JSON.stringify({ keys: { operator: { address: wallets.operator.address, privateKey: keys.operator } } }));
  const { code, output } = await runCli(runDeployJackpotCli, deployArgs([...broadcast, '--key-file', keyFile, '--key-field', 'keys.operator']), {});
  assert.equal(code, 0, output);
  assert.match(output, /deployed TestChikunToken 0x[0-9a-f]{40}/);
  assert.match(output, /deployed WeeklyJackpot 0x[0-9a-f]{40}/);
  assert.equal(await operatorNonce(), nonceBefore + 2);
  const record = readJackpotRecord({ recordPath });
  const instance = record.instances.chikun;
  const jackpot = jackpotAt(instance.address, provider);
  assert.equal(instance.address, ethers.getCreateAddress({ from: wallets.operator.address, nonce: nonceBefore + 1 }).toLowerCase());
  assert.equal(String(await jackpot.admin()).toLowerCase(), instance.admin);
  assert.equal(String(await jackpot.keeper()).toLowerCase(), instance.keeper);
  assert.equal(String(await jackpot.residualRecipient()).toLowerCase(), instance.residualRecipient);
  assert.equal(String(await jackpot.token()).toLowerCase(), instance.token.address);
  assert.equal(Number(await jackpot.firstWeek()), instance.firstWeek);
  assert.equal(await jackpot.gameId(), ethers.id('chikun'));
  assert.deepEqual([instance.token.symbol, instance.token.decimals, instance.token.testnet], ['tCHIKUN', 18, true]);
  assert.equal(String(await tokenAt(instance.token.address, provider).minter()).toLowerCase(), wallets.operator.address.toLowerCase());
  assert.equal((await provider.getTransactionReceipt(instance.deployTx)).blockNumber, instance.startBlock);
  assert.equal(instance.rules.adminClearOnly, true);
  const { LITVM_JACKPOT } = await import(`${pathToFileURL(modulePath).href}?broadcast`);
  assert.equal(LITVM_JACKPOT.status, 'deployed');
  assert.equal(LITVM_JACKPOT.instances.chikun.address, instance.address);
  assert.deepEqual(LITVM_JACKPOT.instances.chikun.retired, []);

  // Migration (design §A.19): schedule-end on it, then a second deploy with --retire-previous.
  await at(weekStartOf(instance.firstWeek) + HOUR);
  await mined(jackpot.connect(wallets.operator).scheduleEnd(instance.firstWeek + 1));
  const second = await runCli(runDeployJackpotCli, deployArgs([...broadcast, '--retire-previous', '--key-env', 'JACKPOT_TEST_OPERATOR_KEY']).map((arg, index, all) => (all[index - 1] === '--first-week' ? weekKeyOf(instance.firstWeek + 2) : arg)));
  assert.equal(second.code, 0, second.output);
  const migrated = readJackpotRecord({ recordPath });
  assert.notEqual(migrated.instances.chikun.address, instance.address);
  assert.deepEqual(migrated.instances.chikun.retired, [{ address: instance.address, token: instance.token, startBlock: instance.startBlock, firstWeek: instance.firstWeek, endAfterWeek: instance.firstWeek + 1 }]);
  const { LITVM_JACKPOT: after } = await import(`${pathToFileURL(modulePath).href}?migrated`);
  assert.deepEqual(after.instances.chikun.retired.map((entry) => [entry.address, entry.endAfterWeek]), [[instance.address, instance.firstWeek + 1]]);
});

test('the record and generated module round-trip and --check detects drift', async () => {
  const record = local.record;
  assert.deepEqual(normalizeJackpotRecord(record), record, 'normalization is idempotent');
  const recordPath = join(dir, 'roundtrip.jackpot.json');
  const modulePath = join(dir, 'roundtrip.litvm-jackpot.mjs');
  writeJackpotRecord({ record, recordPath });
  assert.deepEqual(readJackpotRecord({ recordPath }), record);
  const written = writeLitvmJackpotModule({ record, outPath: modulePath });
  assert.equal(written.status, 'deployed');
  const text = readFileSync(modulePath, 'utf8');
  assert.equal(text.split('\n')[0], JACKPOT_MODULE_BANNER);
  assert.equal(text, renderLitvmJackpotModule(record), 'deterministic');
  assert.doesNotMatch(text, /0x[0-9a-f]*[A-F][0-9a-fA-F]*/, 'lowercase addresses');
  assert.match(text, /name: 'Lester\\'s Arcade Test CHIKUN \(no value\)'/, "the apostrophe is escaped");
  const { LITVM_JACKPOT } = await import(pathToFileURL(modulePath).href);
  assert.deepEqual(JSON.parse(JSON.stringify(LITVM_JACKPOT)), jackpotModuleValue(record));
  assert.ok(Object.isFrozen(LITVM_JACKPOT) && Object.isFrozen(LITVM_JACKPOT.instances.chikun.token) && Object.isFrozen(LITVM_JACKPOT.instances.chikun.retired));
  assert.deepEqual(Object.keys(LITVM_JACKPOT.instances.chikun), ['address', 'startBlock', 'firstWeek', 'admin', 'keeper', 'residualRecipient', 'token', 'retired']);
  assert.deepEqual(Object.keys(LITVM_JACKPOT.instances.chikun.token), ['address', 'symbol', 'decimals', 'name', 'testnet']);
  // --check against the record, then drift.
  const lines = [];
  const cli = (argv) => runGenerateJackpotCli({ argv, log: (line) => lines.push(line), error: (line) => lines.push(line) });
  assert.equal(cli(['--check', '--record', recordPath, '--out', modulePath]), 0);
  writeFileSync(modulePath, text.replace(record.instances.chikun.address, `0x${'ab'.repeat(20)}`));
  assert.equal(cli(['--check', '--record', recordPath, '--out', modulePath]), 1);
  assert.match(lines.at(-1), /out of date for status 'deployed'/);
  assert.equal(cli(['--record', recordPath, '--out', modulePath]), 0);
  assert.equal(cli(['--check', '--record', recordPath, '--out', modulePath]), 0);
  assert.equal(cli(['--check', '--undeployed', '--out', modulePath]), 1, 'the deployed file is not the undeployed module');
  assert.equal(cli(['--bogus']), 2);
  // Validation rejects impossible records.
  assert.throws(() => normalizeJackpotRecord({ ...record, chainId: 1 }), /chainId must be 4441/);
  const overlapping = structuredClone(record);
  overlapping.instances.chikun.retired = [{ address: `0x${'12'.repeat(20)}`, token: record.instances.chikun.token, startBlock: 1, firstWeek: 2, endAfterWeek: record.instances.chikun.firstWeek }];
  assert.throws(() => normalizeJackpotRecord(overlapping), /must be after retired/);
  const renamed = structuredClone(record);
  renamed.instances.chikun.token.name = "bad'\nname";
  assert.throws(() => normalizeJackpotRecord(renamed), /printable ASCII/);
  // The undeployed module.
  const undeployed = renderLitvmJackpotModule();
  assert.match(undeployed, /status: 'undeployed'/);
  assert.deepEqual(jackpotModuleValue(null).instances.chikun.retired, []);
  assert.equal(jackpotModuleValue(null).instances.chikun.address, null);
});

test('the committed module is undeployed or consistent with the jackpot record', async () => {
  const { LITVM_JACKPOT } = await import('../apps/portal/src/generated/litvm-jackpot.mjs');
  const record = readJackpotRecord();
  const check = checkLitvmJackpotModule();
  assert.equal(check.ok, true, 'run node scripts/generate-litvm-jackpot.mjs');
  assert.equal(LITVM_JACKPOT.chainId, 4441);
  assert.deepEqual(Object.keys(LITVM_JACKPOT), ['status', 'chainId', 'instances']);
  assert.deepEqual(Object.keys(LITVM_JACKPOT.instances), ['chikun']);
  if (record) {
    assert.equal(LITVM_JACKPOT.status, 'deployed');
    assert.deepEqual(JSON.parse(JSON.stringify(LITVM_JACKPOT)), jackpotModuleValue(record));
  } else {
    assert.equal(LITVM_JACKPOT.status, 'undeployed');
    assert.equal(readFileSync(join(root, 'apps', 'portal', 'src', 'generated', 'litvm-jackpot.mjs'), 'utf8'), renderLitvmJackpotModule());
    const chikun = LITVM_JACKPOT.instances.chikun;
    assert.deepEqual([chikun.address, chikun.startBlock, chikun.firstWeek, chikun.admin, chikun.keeper, chikun.residualRecipient, chikun.token.address], [null, null, null, null, null, null, null]);
    assert.deepEqual(chikun.retired, []);
  }
  // The generated Ranked module is untouched by the jackpot (a separate file).
  const ranked = readFileSync(join(root, 'apps', 'portal', 'src', 'generated', 'litvm-addresses.mjs'), 'utf8');
  assert.doesNotMatch(ranked, /jackpot/i);
});

test('jackpot actions dry-run by default and act only with the phrase', async () => {
  const jackpot = local.jackpot;
  const token = local.token;
  const operator = wallets.operator.address;
  const blockBefore = await provider.getBlockNumber();
  // status works on the undeployed module and on a deployed one.
  const undeployedModule = join(dir, 'undeployed.litvm-jackpot.mjs');
  writeFileSync(undeployedModule, renderLitvmJackpotModule());
  const undeployed = await runCli(runJackpotCli, ['status', '--rpc', bridge.url, '--deployment', undeployedModule]);
  assert.equal(undeployed.code, 0);
  assert.match(undeployed.output, /jackpot module undeployed/);
  const status = await runCli(runJackpotCli, actions('status', ['--json']));
  assert.equal(status.code, 0);
  const snapshot = JSON.parse(status.lines.join('\n'));
  assert.equal(snapshot.roles.operator, operator.toLowerCase());
  assert.equal(snapshot.roles.admin, wallets.developer.address.toLowerCase());
  assert.equal(snapshot.roles.keeper, local.wallets.keeper.address.toLowerCase());
  assert.deepEqual(snapshot.paused, { admin: false, operator: false, any: false });
  assert.equal(snapshot.currentWeek.index, W - 1);
  assert.equal(snapshot.liabilities, '0');
  assert.equal(snapshot.rules.epochs.length, 1);
  assert.ok(BigInt(snapshot.keeperBalanceWei) > 0n);
  const human = await runCli(runJackpotCli, actions('status'));
  assert.match(human.output, /roles: operator .* keeper .* residual recipient/);
  assert.match(human.output, /paused: admin false · operator false/);
  assert.match(human.output, /liabilities 0\.0 tCHIKUN/);
  assert.match(human.output, /keeper balance/);

  // Each action: a dry run sends nothing; a broadcast needs the phrase; the wrong key is refused.
  const cases = [
    ['mint-test', ['--to', wallets.player1.address, '--amount', '1000'], 'minter', async () => assert.equal(await token.balanceOf(wallets.player1.address), 1000n * TOKEN)],
    ['set-keeper', [wallets.player2.address], 'operator', async () => assert.equal(await jackpot.keeper(), wallets.player2.address)],
    ['schedule-rules', ['--from-week', 'next', '--admin-clear-only', 'false', '--max-prize', '500'], 'operator', async () => {
      const rules = await jackpot.rulesFor(W);
      assert.deepEqual([rules.adminClearOnly, rules.maxPrizeWei, rules.minFundWei], [false, 500n * TOKEN, 100n * TOKEN]);
    }],
    ['force-admin', [wallets.player1.address], 'operator', async () => assert.equal(await jackpot.admin(), wallets.player1.address)],
    ['operator-pause', [], 'operator', async () => assert.equal(await jackpot.operatorPaused(), true)],
    ['schedule-end', [weekKeyOf(W + 1)], 'operator', async () => assert.equal(Number(await jackpot.endAfterWeek()), W + 1)],
  ];
  for (const [action, args, role, verify] of cases) {
    const phrase = JACKPOT_ACTIONS[action].confirm;
    const dry = await runCli(runJackpotCli, actions(action, args));
    assert.equal(dry.code, 0, dry.output);
    assert.match(dry.output, new RegExp(`DRY RUN: ${action} would send 1 transaction`));
    assert.match(dry.output, new RegExp(`--confirm ${phrase}`));
    const noPhrase = await runCli(runJackpotCli, actions(action, [...args, '--broadcast', '--key-env', 'JACKPOT_TEST_OPERATOR_KEY']));
    assert.equal(noPhrase.code, 2);
    assert.match(noPhrase.output, new RegExp(`needs --confirm ${phrase}`));
    const wrongKey = await runCli(runJackpotCli, actions(action, [...args, '--broadcast', '--confirm', phrase, '--key-env', 'JACKPOT_TEST_ATTACKER_KEY']));
    assert.equal(wrongKey.code, 2, wrongKey.output);
    assert.match(wrongKey.output, new RegExp(`is not the (jackpot operator|tCHIKUN minter)`), `${action} checks the ${role}`);
    assert.equal(await provider.getBlockNumber(), blockBefore, `${action}: nothing was sent before the right key`);
    const sent = await runCli(runJackpotCli, actions(action, [...args, '--broadcast', '--confirm', phrase, '--key-env', 'JACKPOT_TEST_OPERATOR_KEY']));
    assert.equal(sent.code, 0, sent.output);
    assert.match(sent.output, /Sent 1 transaction/);
    if (action === 'set-keeper') assert.ok(sent.output.includes(SET_KEEPER_REMINDER), 'set-keeper reminds to block the outgoing keeper');
    await verify();
    const blockNow = await provider.getBlockNumber();
    assert.equal(blockNow, blockBefore + 1);
    await chain.revert(snapshotId);
    snapshotId = await chain.snapshot();
  }
  // The rest need chain history: the unpause and cancel-end twins, finalize, sweep, residue and refunds.
  const operatorRun = (action, args = []) => runCli(runJackpotCli, actions(action, [...args, '--broadcast', '--confirm', JACKPOT_ACTIONS[action].confirm, '--key-env', 'JACKPOT_TEST_OPERATOR_KEY']));
  assert.equal((await operatorRun('operator-pause')).code, 0);
  assert.equal((await operatorRun('operator-unpause')).code, 0);
  assert.equal(await jackpot.operatorPaused(), false);
  const idle = await runCli(runJackpotCli, actions('operator-unpause'));
  assert.match(idle.output, /would send 0 transaction/);
  await at(weekStartOf(W) + HOUR);
  await mined(token.connect(wallets.operator).mint(funder.address, 10_000n * TOKEN));
  await mined(token.connect(funder).approve(await jackpot.getAddress(), 10_000n * TOKEN));
  await mined(jackpot.connect(funder).fund(W, 300n * TOKEN));
  await mined(jackpot.connect(funder).fund(W + 3, 200n * TOKEN));
  assert.equal((await operatorRun('schedule-end', [weekKeyOf(W + 2)])).code, 0);
  assert.equal((await operatorRun('cancel-end')).code, 0);
  assert.equal(Number(await jackpot.endAfterWeek()), 0);
  assert.equal((await operatorRun('schedule-end', [weekKeyOf(W + 1)])).code, 0);
  // sweep-stray: only the balance above liabilities.
  await mined(token.connect(funder).transfer(await jackpot.getAddress(), 9n * TOKEN));
  const sweepDry = await runCli(runJackpotCli, actions('sweep-stray', [await token.getAddress()]));
  assert.match(sweepDry.output, /sweeps 9000000000000000000 base units/);
  assert.equal((await runCli(runJackpotCli, actions('sweep-stray', [await token.getAddress(), '--broadcast', '--confirm', 'RECOVER_JACKPOT_4441', '--key-env', 'JACKPOT_TEST_ATTACKER_KEY']))).code, 2);
  assert.equal((await operatorRun('sweep-stray', [await token.getAddress()])).code, 0);
  assert.equal(await token.balanceOf(await jackpot.getAddress()), 500n * TOKEN);
  // finalize from any key: W rolls into W + 1, then W + 1 (the last week) rolls into the residue.
  await at(weekStartOf(W + 1) + DAY + HOUR);
  const finalizeDry = await runCli(runJackpotCli, actions('finalize', [weekKeyOf(W)]));
  assert.match(finalizeDry.output, /would succeed now/);
  const anyKey = await runCli(runJackpotCli, actions('finalize', [weekKeyOf(W), '--broadcast', '--confirm', 'FINALIZE_JACKPOT_4441', '--key-env', 'JACKPOT_TEST_ATTACKER_KEY']));
  assert.equal(anyKey.code, 0, anyKey.output);
  assert.equal((await jackpot.potOf(W + 1)).carriedIn, 300n * TOKEN);
  const early = await runCli(runJackpotCli, actions('finalize', [weekKeyOf(W + 1)]));
  assert.match(early.output, /would revert now: PAYOUT_NOT_DUE/);
  await at(weekStartOf(W + 2) + DAY + HOUR);
  assert.equal((await runCli(runJackpotCli, actions('finalize', [weekKeyOf(W + 1), '--broadcast', '--confirm', 'FINALIZE_JACKPOT_4441', '--key-env', 'JACKPOT_TEST_FUNDER_KEY']))).code, 0);
  assert.equal(await jackpot.residual(), 300n * TOKEN);
  // refund-after-end: only the funder's own key.
  const notFunder = await runCli(runJackpotCli, actions('refund-after-end', [weekKeyOf(W + 3), '--broadcast', '--confirm', 'REFUND_JACKPOT_4441', '--key-env', 'JACKPOT_TEST_ATTACKER_KEY']));
  assert.equal(notFunder.code, 2);
  assert.match(notFunder.output, /funded nothing/);
  const refund = await runCli(runJackpotCli, actions('refund-after-end', [weekKeyOf(W + 3), '--broadcast', '--confirm', 'REFUND_JACKPOT_4441', '--key-env', 'JACKPOT_TEST_FUNDER_KEY']));
  assert.equal(refund.code, 0, refund.output);
  assert.equal(await jackpot.fundedBy(W + 3, funder.address), 0n);
  // recover-residual: 30 days after the deposit, to the residual recipient.
  const tooEarly = await runCli(runJackpotCli, actions('recover-residual'));
  assert.equal(tooEarly.code, 2);
  assert.match(tooEarly.output, /TOO_EARLY/);
  await at(Number(await jackpot.residualAvailableAt()));
  const recipientBefore = await token.balanceOf(wallets.developer.address);
  assert.equal((await operatorRun('recover-residual')).code, 0);
  assert.equal(await token.balanceOf(wallets.developer.address), recipientBefore + 300n * TOKEN);
  // The phrase alone does not unlock an undeployed module, and a non-loopback override is refused.
  const refused = await runCli(runJackpotCli, ['set-keeper', operator, '--rpc', bridge.url, '--deployment', undeployedModule, '--broadcast', '--confirm', 'SET_JACKPOT_KEEPER_4441', '--key-env', 'JACKPOT_TEST_OPERATOR_KEY']);
  assert.equal(refused.code, 2);
  assert.match(refused.output, /module is 'undeployed'/);
  const remote = await runCli(runJackpotCli, ['status', '--rpc', 'https://liteforge.rpc.caldera.xyz/http', '--deployment', localModule]);
  assert.equal(remote.code, 2);
  assert.match(remote.output, /honoured only for a loopback RPC/);
  const help = await runCli(runJackpotCli, ['transfer-admin']);
  assert.equal(help.code, 2, 'there is no operator transfer-admin action');
  assert.equal(Object.keys(JACKPOT_ACTIONS).includes('transfer-admin'), false);
});

test('fund approves the exact amount and credits the chosen week', async () => {
  const jackpot = local.jackpot;
  const token = local.token;
  const address = await jackpot.getAddress();
  await mined(token.connect(wallets.operator).mint(funder.address, 1_000n * TOKEN));
  await at(weekStartOf(W) + HOUR);
  const dry = await runCli(runJackpotCli, actions('fund', ['--week', 'current', '--amount', '150', '--from', funder.address]));
  assert.equal(dry.code, 0, dry.output);
  assert.match(dry.output, /DRY RUN: fund would send 2 transaction/);
  assert.match(dry.output, new RegExp(`approve\\(${address}, 150000000000000000000\\)`, 'i'));
  assert.match(dry.output, new RegExp(`fund\\(${W}, 150000000000000000000\\) \\[${weekKeyOf(W)}\\]`));
  const refuse = async (args, pattern) => {
    const { code, output } = await runCli(runJackpotCli, actions('fund', args));
    assert.equal(code, 2, output);
    assert.match(output, pattern);
  };
  await refuse(['--week', 'current', '--amount', '99'], /below the week's minFundWei/);
  await refuse(['--week', weekKeyOf(W + 9), '--amount', '150'], /cannot be funded now/);
  await refuse(['--week', weekKeyOf(W - 1), '--amount', '150'], /cannot be funded now/);
  await refuse(['--week', 'current', '--amount', '-5'], /positive decimal token amount/);
  const receiptsBefore = await provider.getTransactionCount(funder.address, 'latest');
  const sent = await runCli(runJackpotCli, actions('fund', ['--week', weekKeyOf(W + 1), '--amount', '150.5', '--broadcast', '--confirm', 'FUND_JACKPOT_4441', '--key-env', 'JACKPOT_TEST_FUNDER_KEY']));
  assert.equal(sent.code, 0, sent.output);
  assert.match(sent.output, /Sent 2 transaction/);
  assert.equal(await provider.getTransactionCount(funder.address, 'latest'), receiptsBefore + 2, 'approve + fund');
  assert.equal(await token.allowance(funder.address, address), 0n, 'the exact amount was approved and spent');
  assert.equal((await jackpot.potOf(W + 1)).funded, 150_500_000_000_000_000_000n);
  assert.equal(await jackpot.fundedBy(W + 1, funder.address), 150_500_000_000_000_000_000n);
  assert.equal((await jackpot.potOf(W)).funded, 0n);
  const current = await runCli(runJackpotCli, actions('fund', ['--week', 'current', '--amount', '100', '--broadcast', '--confirm', 'FUND_JACKPOT_4441', '--key-env', 'JACKPOT_TEST_FUNDER_KEY']));
  assert.equal(current.code, 0, current.output);
  assert.equal((await jackpot.potOf(W)).funded, 100n * TOKEN);
  const poor = await runCli(runJackpotCli, actions('fund', ['--week', 'current', '--amount', '5000', '--broadcast', '--confirm', 'FUND_JACKPOT_4441', '--key-env', 'JACKPOT_TEST_FUNDER_KEY']));
  assert.equal(poor.code, 2);
  assert.match(poor.output, /holds less than the amount/);
});

test('keeper key generator writes a new file, prints only the address, and never overwrites', async () => {
  const keyDir = mkdtempSync(join(tmpdir(), 'jackpot-keeper-key-'));
  try {
    const out = join(keyDir, 'jackpot-keeper.json');
    const lines = [];
    assert.equal(runKeeperKeyCli({ argv: ['--out', out], log: (line) => lines.push(line) }), 0);
    const file = JSON.parse(readFileSync(out, 'utf8'));
    assert.deepEqual(Object.keys(file), ['address', 'privateKey']);
    assert.match(file.privateKey, /^0x[0-9a-f]{64}$/);
    assert.equal(new ethers.Wallet(file.privateKey).address, file.address);
    const text = lines.join('\n');
    assert.ok(text.includes(`Keeper address: ${file.address}`));
    assert.equal(text.includes(file.privateKey), false);
    assert.equal(text.toLowerCase().includes(file.privateKey.slice(2)), false);
    if (process.platform !== 'win32') assert.equal(statSync(out).mode & 0o777, 0o600);
    const before = readFileSync(out, 'utf8');
    const again = [];
    assert.equal(runKeeperKeyCli({ argv: ['--out', out], log: (line) => again.push(line) }), 2);
    assert.match(again.join('\n'), /already exists; a keeper key file is never overwritten/);
    assert.equal(readFileSync(out, 'utf8'), before, 'unchanged');
    assert.equal(runKeeperKeyCli({ argv: [], log: () => {} }), 2);
    assert.equal(runKeeperKeyCli({ argv: ['--out', join(keyDir, 'missing', 'key.json')], log: () => {} }), 2);
    const inRepo = [];
    assert.equal(runKeeperKeyCli({ argv: ['--out', join(root, 'contracts', 'keeper.json')], log: (line) => inRepo.push(line) }), 2);
    assert.match(inRepo.join('\n'), /inside the repository/);
    assert.equal(existsSync(join(root, 'contracts', 'keeper.json')), false);
    // As a real process: stdout carries the address and nothing else secret.
    const second = join(keyDir, 'second.json');
    const child = await new Promise((resolveRun, rejectRun) => {
      const proc = spawn(process.execPath, [join(root, 'scripts', 'jackpot-keeper-key.mjs'), '--out', second], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', (chunk) => { stdout += chunk; });
      proc.stderr.on('data', (chunk) => { stderr += chunk; });
      proc.on('error', rejectRun);
      proc.on('close', (code) => resolveRun({ code, stdout, stderr }));
    });
    assert.equal(child.code, 0, child.stderr);
    const generated = JSON.parse(readFileSync(second, 'utf8'));
    assert.ok(child.stdout.includes(generated.address));
    assert.equal(child.stdout.toLowerCase().includes(generated.privateKey.slice(2)), false);
    assert.equal(child.stderr, '');
    assert.notEqual(generated.address, file.address, 'a fresh random key each time');
  } finally {
    rmSync(keyDir, { recursive: true, force: true });
  }
});
