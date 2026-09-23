// Phase-2 definition script (contract A20, §8.5), written but never run against LiteForge: pure plan,
// catalog loading, a local-chain define-then-mint, and the CLI's dry-run default and broadcast guards.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ethers } from 'ethers';
import {
  DEFINE_CONFIRM,
  achievementRegistryInterface,
  broadcastNftDefinitions,
  loadNftCatalog,
  planNftDefinitions,
  runDefineCli,
} from '../scripts/define-nft-achievements.mjs';
import { deployLocalSuite, localContracts, localWalletKeys, startLocalChain } from '../scripts/lib/local-chain.mjs';
import { deployedDeploymentInput, normalizeDeploymentInput, writeLitvmAddressModule } from '../scripts/generate-litvm-addresses.mjs';
import { LITVM_DEPLOYMENT } from '../apps/portal/src/generated/litvm-addresses.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const FIXTURE_CATALOG = Object.freeze([
  { gameId: 'chikun', id: 'sky-legend', title: 'Sky Legend', category: 'escape' },
  { gameId: 'lester-blaster', id: 'arcade-legend-500', title: 'Arcade Legend', category: 'dedication' },
  { gameId: 'stacked', id: 'perfect-stack', title: 'Perfect Stack', category: 'mastery' },
  { gameId: 'chikun', id: 'coin-hoarder', title: 'Coin Hoarder', category: 'collection' },
]);

let chain;
let record;
let deployment;

before(async () => {
  chain = await startLocalChain();
  record = await deployLocalSuite({ provider: chain.provider, wallets: chain.wallets });
  deployment = normalizeDeploymentInput(deployedDeploymentInput(record));
});

after(async () => {
  await chain?.close();
});

test('the plan encodes defineAchievement per collection with <id>.json paths and an optional relayer minter', () => {
  const iface = achievementRegistryInterface();
  const calls = planNftDefinitions({ catalog: FIXTURE_CATALOG, deployment });
  assert.deepEqual(calls.map((call) => `${call.gameId}/${call.achievementId}`), ['lester-blaster/arcade-legend-500', 'chikun/sky-legend', 'chikun/coin-hoarder', 'stacked/perfect-stack'], 'game order, then catalog order');
  for (const call of calls) {
    assert.equal(call.method, 'defineAchievement');
    assert.equal(call.to, deployment.addresses.achievementRegistries[call.gameId]);
    const entry = FIXTURE_CATALOG.find((item) => item.id === call.achievementId);
    assert.deepEqual(call.args, [ethers.id(entry.id), ethers.id(entry.gameId), entry.title, entry.category, `${entry.id}.json`]);
    assert.equal(call.data, iface.encodeFunctionData('defineAchievement', call.args));
  }
  const withMinter = planNftDefinitions({ catalog: FIXTURE_CATALOG, deployment, relayer: deployment.relayer, includeRelayerMinter: true });
  assert.deepEqual(withMinter.map((call) => call.method), ['defineAchievement', 'setMinter', 'defineAchievement', 'defineAchievement', 'setMinter', 'defineAchievement', 'setMinter']);
  for (const call of withMinter.filter((item) => item.method === 'setMinter')) {
    assert.deepEqual(call.args, [ethers.getAddress(deployment.relayer), true]);
  }
  assert.deepEqual(planNftDefinitions({ catalog: [], deployment }), [], 'an empty approval defines nothing');

  assert.throws(() => planNftDefinitions({ catalog: [{ gameId: 'pong', id: 'x-ray', title: 'X', category: 'misc' }], deployment }), /unknown gameId/);
  assert.throws(() => planNftDefinitions({ catalog: [{ gameId: 'chikun', id: 'Bad Id', title: 'X', category: 'misc' }], deployment }), /invalid achievement id/);
  assert.throws(() => planNftDefinitions({ catalog: [FIXTURE_CATALOG[0], FIXTURE_CATALOG[0]], deployment }), /duplicate achievement/);
  assert.throws(() => planNftDefinitions({ catalog: FIXTURE_CATALOG, deployment, includeRelayerMinter: true }), /relayer address/);
  assert.throws(() => planNftDefinitions({ catalog: FIXTURE_CATALOG, deployment: { addresses: { achievementRegistries: {} } } }), /no collection address/);
});

test('the catalog comes from nftAchievementIds and catalogFor of the achievements module', async () => {
  const fake = {
    ACHIEVEMENT_GAME_IDS: ['lester-blaster', 'chikun', 'stacked'],
    nftAchievementIds: (gameId) => ({ 'lester-blaster': ['arcade-legend-500'], chikun: ['sky-legend'], stacked: [] })[gameId],
    catalogFor: (gameId) => ({
      'lester-blaster': [{ id: 'first-blood', title: 'First Blood', category: 'combat', nft: false }, { id: 'arcade-legend-500', title: 'Arcade Legend', category: 'dedication', nft: true }],
      chikun: [{ id: 'sky-legend', title: 'Sky Legend', category: 'escape', nft: true }],
      stacked: [{ id: 'first-line', title: 'First Line', category: 'lines', nft: false }],
    })[gameId],
  };
  assert.deepEqual(await loadNftCatalog(async () => fake), [
    { gameId: 'lester-blaster', id: 'arcade-legend-500', title: 'Arcade Legend', category: 'dedication' },
    { gameId: 'chikun', id: 'sky-legend', title: 'Sky Legend', category: 'escape' },
  ]);
  await assert.rejects(loadNftCatalog(async () => { throw Object.assign(new Error('Cannot find module'), { code: 'ERR_MODULE_NOT_FOUND' }); }), /could not be loaded: ERR_MODULE_NOT_FOUND/);
  await assert.rejects(loadNftCatalog(async () => ({})), /must export nftAchievementIds and catalogFor/);
});

test('defined achievements mint from a minter and carry the collection token URI', async () => {
  const snapshot = await chain.snapshot();
  try {
    const calls = planNftDefinitions({ catalog: FIXTURE_CATALOG, deployment, relayer: deployment.relayer, includeRelayerMinter: true });
    const logs = [];
    const sent = await broadcastNftDefinitions({ calls, signer: chain.wallets.operator, log: (line) => logs.push(line) });
    assert.equal(sent.filter((call) => !call.skipped).length, calls.length);
    const again = await broadcastNftDefinitions({ calls, signer: chain.wallets.operator });
    assert.equal(again.every((call) => call.skipped), true, 're-running skips what is already on chain');
    await assert.rejects(broadcastNftDefinitions({ calls, signer: chain.wallets.attacker }), /not the operator/);

    const { achievementRegistries } = localContracts(record, chain.provider);
    const player = chain.wallets.player1.address;
    // The score registry (minter since deploy) mints a defined id; the relayer mints after setMinter.
    const scoreRegistry = await chain.impersonate(record.addresses.scoreSubmissionRegistry);
    const chikun = achievementRegistries.chikun;
    assert.equal(await chikun.connect(scoreRegistry).mintFor.staticCall(player, ethers.id('sky-legend'), ethers.id('s1')), true);
    await (await chikun.connect(scoreRegistry).mintFor(player, ethers.id('sky-legend'), ethers.id('s1'))).wait();
    const tokenId = await chikun.tokenIdFor(player, ethers.id('sky-legend'));
    assert.equal(await chikun.ownerOf(tokenId), player);
    assert.equal(await chikun.tokenURI(tokenId), `${await chikun.baseTokenUri()}sky-legend.json`);
    assert.equal(await chikun.tokenURI(tokenId), 'https://lestersarcade.io/achievements/chikun/sky-legend.json');

    const hmh = achievementRegistries['lester-blaster'].connect(chain.wallets.relayer);
    assert.equal(await hmh.minters(chain.wallets.relayer.address), true, 'phase-2 backfill minter');
    await (await hmh.mintFor(player, ethers.id('arcade-legend-500'), ethers.id('s2'))).wait();
    assert.equal(await hmh.tokenURI(await hmh.tokenIdFor(player, ethers.id('arcade-legend-500'))), 'https://lestersarcade.io/achievements/lester-blaster/arcade-legend-500.json');
    // Ids stay per collection: the Chikun id is not defined in the HMH collection.
    assert.equal(await hmh.mintFor.staticCall(player, ethers.id('sky-legend'), ethers.id('s3')), false);
  } finally {
    await chain.revert(snapshot);
  }
});

test('the CLI dry-runs by default and broadcast needs the confirm phrase, a deployed module and a key name', async () => {
  const fixtureKey = localWalletKeys().operator;
  const fakeCatalog = async () => ({ nftAchievementIds: (gameId) => (gameId === 'chikun' ? ['sky-legend'] : []), catalogFor: () => [{ id: 'sky-legend', title: 'Sky Legend', category: 'escape' }] });
  const run = async (argv, env = {}) => {
    const lines = [];
    const code = await runDefineCli({ argv, env, log: (line) => lines.push(String(line)), importCatalog: fakeCatalog, providerFactory: () => chain.provider });
    return { code, output: lines.join('\n') };
  };
  // Dry run: the committed module, no key read, nothing sent.
  const nonceBefore = await chain.provider.getTransactionCount(chain.wallets.operator.address);
  const dry = await run([]);
  assert.equal(dry.code, 0);
  assert.match(dry.output, /DRY RUN ONLY/);
  assert.match(dry.output, /chikun .* defineAchievement\(sky-legend -> sky-legend\.json\)/);
  // Broadcast without the phrase, or against the predicted module, stops before any key is read.
  const noPhrase = await run(['--broadcast', '--key-env', 'FIXTURE_OPERATOR_KEY'], { FIXTURE_OPERATOR_KEY: fixtureKey });
  assert.equal(noPhrase.code, 2);
  assert.match(noPhrase.output, new RegExp(`LITVM_DEFINE_CONFIRM=${DEFINE_CONFIRM}`));
  if (LITVM_DEPLOYMENT.status === 'predicted') {
    const predicted = await run(['--broadcast', '--key-env', 'FIXTURE_OPERATOR_KEY'], { FIXTURE_OPERATOR_KEY: fixtureKey, LITVM_DEFINE_CONFIRM: DEFINE_CONFIRM });
    assert.equal(predicted.code, 2);
    assert.match(predicted.output, /not 'deployed'/);
  }
  for (const result of [dry, noPhrase]) assert.equal(result.output.includes(fixtureKey.slice(2)), false, 'the key is never printed');
  assert.equal(await chain.provider.getTransactionCount(chain.wallets.operator.address), nonceBefore, 'nothing was sent');

  // A full broadcast against the local chain with a deployed module and the key from an env var name.
  const snapshot = await chain.snapshot();
  const dir = mkdtempSync(join(tmpdir(), 'define-nft-'));
  try {
    const modulePath = writeLitvmAddressModule({ root, mode: 'deployed', record, outPath: join(dir, 'litvm-addresses.mjs') }).path;
    const broadcast = await run(['--broadcast', '--deployment', modulePath, '--key-env', 'FIXTURE_OPERATOR_KEY'], { FIXTURE_OPERATOR_KEY: fixtureKey, LITVM_DEFINE_CONFIRM: DEFINE_CONFIRM });
    assert.equal(broadcast.code, 0, broadcast.output);
    assert.equal(broadcast.output.includes(fixtureKey.slice(2)), false, 'the key is never printed');
    const defined = await localContracts(record, chain.provider).achievementRegistries.chikun.getAchievement(ethers.id('sky-legend'));
    assert.equal(defined.exists, true);
    assert.equal(defined.tokenUriPath, 'sky-legend.json');
    const missingKey = await run(['--broadcast', '--deployment', modulePath, '--key-env', 'NOT_SET_ANYWHERE'], { LITVM_DEFINE_CONFIRM: DEFINE_CONFIRM }).catch((error) => ({ code: 'threw', output: error.message }));
    assert.equal(missingKey.code, 'threw');
    assert.match(missingKey.output, /environment variable NOT_SET_ANYWHERE is not set/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    await chain.revert(snapshot);
  }

  // The real CLI entry point, as the operator would run it: a dry run with no flags.
  const cli = spawnSync(process.execPath, [join(root, 'scripts', 'define-nft-achievements.mjs')], { cwd: root, encoding: 'utf8', env: { ...process.env, LITVM_DEFINE_CONFIRM: '' } });
  if (existsSync(join(root, 'apps', 'portal', 'src', 'achievements', 'index.mjs'))) {
    assert.equal(cli.status, 0, cli.stderr);
    assert.match(cli.stdout, /DRY RUN ONLY/);
  } else {
    // Before the achievements slice merges, the dry run explains what is missing and exits non-zero.
    assert.equal(cli.status, 1);
    assert.match(cli.stderr, /achievements catalog \(apps\/portal\/src\/achievements\/index\.mjs\) could not be loaded/);
  }
  assert.doesNotMatch(readFileSync(join(root, 'scripts', 'define-nft-achievements.mjs'), 'utf8'), /console\.(log|error)\([^\n]*(PRIVATE_KEY|privateKey|readSecret)/);
});
