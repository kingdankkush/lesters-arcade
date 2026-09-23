// Operator and secret tooling for the deploy session (contract §11 rule 13, §13): key source, operator
// actions on the local chain, Vercel secret piping with a fake spawn, and the live cron caller against a
// local HTTP server. Nothing here touches LiteForge, Vercel or production Neon; fixture key files live
// under the OS temp directory and every key is a public Hardhat test key.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { ethers } from 'ethers';
import { SecretSourceError, flagValue, looksLikeSecretValue, readSecret } from '../scripts/lib/key-source.mjs';
import { FEES_OFF_WARNING, OPERATOR_ACTIONS, isLoopbackRpc, operatorHelp, runOperatorAction, runOperatorCli } from '../scripts/operator-actions.mjs';
import { ENV_LS_ARGS, LEGACY_SECRET_NAMES, VERCEL_APPLY_CONFIRM, VercelListingError, defaultVercelCommand, envNamesFromLsJson, runVercelSecrets } from '../scripts/vercel-secrets.mjs';
import { cronUrl, runLiveCronCli, summarizeCronResponse } from '../scripts/live-cron.mjs';
import { deployLocalSuite, localContracts, localWalletKeys, serveJsonRpc, startLocalChain } from '../scripts/lib/local-chain.mjs';
import { deployedDeploymentInput, normalizeDeploymentInput, predictedDeploymentInput, writeLitvmAddressModule } from '../scripts/generate-litvm-addresses.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const testnetConfig = JSON.parse(readFileSync(join(root, 'contracts', 'deploy-config.testnet.json'), 'utf8'));
const keys = localWalletKeys();

let chain;
let record;
let deployment;
let dir;
let modulePath;

before(async () => {
  chain = await startLocalChain();
  record = await deployLocalSuite({ provider: chain.provider, wallets: chain.wallets });
  deployment = Object.freeze(normalizeDeploymentInput(deployedDeploymentInput(record)));
  dir = mkdtempSync(join(tmpdir(), 'operator-tooling-'));
  modulePath = writeLitvmAddressModule({ root, mode: 'deployed', record, outPath: join(dir, 'litvm-addresses.mjs') }).path;
});

after(async () => {
  await chain?.close();
  if (dir) rmSync(dir, { recursive: true, force: true });
});

// Asynchronous child process (the in-process chain keeps serving while it runs).
function runNode(args, { env = {} } = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, args, { cwd: root, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', rejectRun);
    child.on('close', (code) => resolveRun({ code, stdout, stderr }));
  });
}

function assertNoSecret(text, secrets, label) {
  for (const secret of secrets) {
    assert.equal(String(text).includes(secret), false, `${label} must not contain a secret`);
    if (secret.startsWith('0x')) assert.equal(String(text).includes(secret.slice(2)), false, `${label} must not contain a secret (no 0x)`);
  }
}

async function confirmAllDevWallets() {
  const registry = localContracts(record, chain.wallets.developer).gameRegistry;
  for (const game of record.games) await (await registry.confirmDevWallet(game.gameId)).wait();
}

test('key source reads env names and JSON fields without echoing them', () => {
  const key = keys.operator;
  const file = join(dir, 'fixture-keys.json');
  writeFileSync(file, JSON.stringify({ operator: { address: chain.wallets.operator.address, privateKey: key }, verifier: keys.verifier, nested: { relayer: { privateKey: keys.relayer } } }));
  const text = join(dir, 'fixture-key.txt');
  writeFileSync(text, `${key}\n`);

  assert.equal(readSecret({ env: { FIXTURE_KEY: key }, argv: ['--key-env', 'FIXTURE_KEY'] }), key);
  assert.equal(readSecret({ env: { FIXTURE_KEY: key }, argv: ['--key-env=FIXTURE_KEY'] }), key);
  assert.equal(readSecret({ argv: ['--key-file', file, '--key-field', 'operator'] }), key, 'an object field uses its privateKey');
  assert.equal(readSecret({ argv: ['--key-file', file, '--key-field', 'operator.privateKey'] }), key);
  assert.equal(readSecret({ argv: ['--key-file', file, '--key-field', 'verifier'] }), keys.verifier);
  assert.equal(readSecret({ argv: ['--key-file', file, '--key-field', 'nested.relayer'] }), keys.relayer);
  assert.equal(readSecret({ argv: ['--key-file', text] }), key, 'a plain-text file');
  assert.equal(flagValue(['--confirm', 'X'], '--confirm'), 'X');
  assert.equal(flagValue([], '--confirm'), null);

  const secrets = [key, keys.verifier, keys.relayer];
  const badJson = join(dir, 'bad.json');
  writeFileSync(badJson, `{ "operator": "${key}" oops`);
  const badShape = join(dir, 'bad-shape.json');
  writeFileSync(badShape, JSON.stringify({ operator: key.slice(0, 40) }));
  const failures = [
    [{ env: {}, argv: ['--key-env', 'NOT_SET'] }, /environment variable NOT_SET is not set/],
    [{ env: { SHORT: key.slice(0, 20) }, argv: ['--key-env', 'SHORT'] }, /is not 0x followed by 64 hex characters/],
    [{ argv: ['--key-file', join(dir, 'missing.json'), '--key-field', 'operator'] }, /cannot read --key-file .*missing\.json \(ENOENT\)/],
    [{ argv: ['--key-file', badJson, '--key-field', 'operator'] }, /is not valid JSON/],
    [{ argv: ['--key-file', badShape, '--key-field', 'operator'] }, /field "operator" of --key-file .* is not 0x followed by 64 hex/],
    [{ argv: ['--key-file', file, '--key-field', 'nobody'] }, /field "nobody" is not in --key-file/],
    [{ argv: ['--key-env', 'A', '--key-file', file] }, /either --key-env or --key-file/],
    [{ argv: [] }, /the key is required/],
    [{ argv: ['--key-env'] }, /--key-env needs a value/],
    [{ env: { WEAK: 'short-secret' }, argv: ['--secret-env', 'WEAK'], shape: 'secret', envFlag: '--secret-env', fileFlag: '--secret-file', fieldFlag: null }, /at least 32 printable characters/],
  ];
  for (const [options, pattern] of failures) {
    assert.throws(() => readSecret(options), (error) => {
      assert.ok(error instanceof SecretSourceError);
      assert.match(error.message, pattern);
      assertNoSecret(error.message, secrets, 'error message');
      assert.equal(error.message.includes('oops'), false, 'file contents never appear');
      return true;
    });
  }
  // A key or secret pasted where a NAME, path or field belongs is refused without being repeated.
  const bareHex = key.slice(2);
  const cronHex = 'ab'.repeat(32);
  const token = 'Zq9xR2mK7vT4wP8nL3cF6hJ1bD5sG0yA-uE';
  const pasted = [
    [{ env: {}, argv: ['--key-env', bareHex] }, /--key-env must be the NAME of an environment variable, not the key itself; the value was not printed/],
    [{ env: {}, argv: ['--key-env', key] }, /--key-env must be the NAME of an environment variable, not the key itself/],
    [{ argv: ['--key-file', bareHex] }, /--key-file must be a file path, not the key itself/],
    [{ argv: ['--key-file', key, '--key-field', 'operator'] }, /--key-file must be a file path, not the key itself/],
    [{ argv: ['--key-file', file, '--key-field', bareHex] }, /--key-field must be a field name, not the key itself/],
    [{ env: {}, argv: ['--secret-env', cronHex], shape: 'secret', envFlag: '--secret-env', fileFlag: '--secret-file', fieldFlag: null, label: 'cron secret' }, /--secret-env must be the NAME of an environment variable, not the cron secret itself/],
    [{ env: {}, argv: ['--secret-env', token], shape: 'secret', envFlag: '--secret-env', fileFlag: '--secret-file', fieldFlag: null, label: 'cron secret' }, /not the cron secret itself/],
  ];
  for (const [options, pattern] of pasted) {
    assert.throws(() => readSecret(options), (error) => {
      assert.ok(error instanceof SecretSourceError);
      assert.match(error.message, pattern);
      assertNoSecret(error.message, [key, cronHex, token], 'error message');
      return true;
    });
  }
  // Real names, paths and fields are not mistaken for secrets.
  for (const value of ['RANKED_VERIFIER_PRIVATE_KEY', 'LESTERS_ARCADE_RANKED_RELAYER_PRIVATE_KEY_2026', 'C:/Users/just_/lesters-arcade-vault/keys/cron-secret.txt', 'nested.relayer', 'operator']) {
    assert.equal(looksLikeSecretValue(value), false, value);
  }
  assert.equal(readSecret({ env: { LESTERS_ARCADE_RANKED_RELAYER_PRIVATE_KEY_2026: key }, argv: ['--key-env', 'LESTERS_ARCADE_RANKED_RELAYER_PRIVATE_KEY_2026'] }), key);

  // The key-source module itself never logs.
  assert.doesNotMatch(readFileSync(join(root, 'scripts', 'lib', 'key-source.mjs'), 'utf8'), /console\./);
});

test('operator actions dry-run by default and need the confirm phrase', async () => {
  const snapshot = await chain.snapshot();
  try {
    await confirmAllDevWallets();
    const nonce = await chain.provider.getTransactionCount(chain.wallets.operator.address);
    const dry = await runOperatorAction({ action: 'activate', deployment, provider: chain.provider, signer: chain.wallets.operator });
    assert.equal(dry.dryRun, true);
    assert.deepEqual(dry.plan.calls.map((call) => [call.method, call.gameId, call.args[1]]), [['setPlayable', 'lester-blaster', true], ['setPlayable', 'chikun', true], ['setPlayable', 'stacked', true]]);
    assert.equal(await chain.provider.getTransactionCount(chain.wallets.operator.address), nonce, 'a dry run sends nothing');
    assert.equal((await localContracts(record, chain.provider).gameRegistry.getGame(record.games[0].gameId)).playable, false);

    await assert.rejects(runOperatorAction({ action: 'activate', deployment, provider: chain.provider, signer: chain.wallets.operator, broadcast: true }), /needs --confirm ACTIVATE_GAMES_4441/);
    await assert.rejects(runOperatorAction({ action: 'activate', deployment, provider: chain.provider, signer: chain.wallets.operator, broadcast: true, confirm: 'PAUSE_GAMES_4441' }), /needs --confirm ACTIVATE_GAMES_4441/);
    const predicted = normalizeDeploymentInput({ ...deployment, status: 'predicted', source: 'predicted-from-operator-nonce-0', deployedAt: null, startBlock: null });
    await assert.rejects(runOperatorAction({ action: 'activate', deployment: predicted, provider: chain.provider, signer: chain.wallets.operator, broadcast: true, confirm: 'ACTIVATE_GAMES_4441' }), /not 'deployed'/);
    await assert.rejects(runOperatorAction({ action: 'activate', deployment, provider: chain.provider, signer: chain.wallets.attacker, broadcast: true, confirm: 'ACTIVATE_GAMES_4441' }), /signer is not the operator of GameRegistry/);
    assert.equal(await chain.provider.getTransactionCount(chain.wallets.operator.address), nonce);

    // Confirm phrases and help text.
    assert.deepEqual(Object.fromEntries(Object.entries(OPERATOR_ACTIONS).map(([name, action]) => [name, action.confirm])), {
      status: null, activate: 'ACTIVATE_GAMES_4441', 'pause-games': 'PAUSE_GAMES_4441', 'fees-on': 'FEES_ON_4441', 'fees-off': 'FEES_OFF_4441',
      reserve: 'SET_RESERVE_4441', 'relayer-off': 'RELAYER_OFF_4441', 'rotate-verifier': 'ROTATE_VERIFIER_4441',
    });
    assert.match(operatorHelp(), /fees-off is NOT an emergency stop/);
    assert.match(FEES_OFF_WARNING, /SETTLEMENT_PAUSED=true/);
    const lines = [];
    const code = await runOperatorCli({ argv: ['fees-off', '--deployment', modulePath], log: (line) => lines.push(line), providerFactory: () => chain.provider });
    assert.equal(code, 0);
    assert.match(lines.join('\n'), /fees-off is NOT an emergency stop/);
    assert.match(lines.join('\n'), /DRY RUN: fees-off would send 1 transaction/);
    const blocked = [];
    assert.equal(await runOperatorCli({ argv: ['activate', '--broadcast', '--deployment', modulePath, '--key-env', 'UNUSED'], log: (line) => blocked.push(line), providerFactory: () => chain.provider }), 2, 'no confirm phrase: stops before reading any key');
    assert.match(blocked.join('\n'), /needs --confirm ACTIVATE_GAMES_4441/);

    // status works before the deploy too (predicted module, no code yet): the operator nonce is visible.
    const before = await runOperatorAction({ action: 'status', deployment: normalizeDeploymentInput(predictedDeploymentInput(testnetConfig)), provider: chain.provider });
    assert.equal(before.status.deployed, false);
    assert.equal(before.status.operator.nonce, 0);
    assert.equal(before.status.operator.address, testnetConfig.deployer.toLowerCase());
  } finally {
    await chain.revert(snapshot);
  }
});

test('activate, pause-games, relayer-off and rotate-verifier change the local chain as named', async () => {
  const snapshot = await chain.snapshot();
  try {
    await confirmAllDevWallets();
    const act = (action, args = []) => runOperatorAction({ action, args, deployment, provider: chain.provider, signer: chain.wallets.operator, broadcast: true, confirm: OPERATOR_ACTIONS[action].confirm });
    const { gameRegistry, rankedEntry, scores } = localContracts(record, chain.provider);

    assert.equal((await act('activate')).receipts.length, 3);
    for (const game of record.games) assert.equal((await gameRegistry.getGame(game.gameId)).playable, true);
    assert.equal((await act('activate')).receipts.length, 0, 'idempotent');

    const status = (await runOperatorAction({ action: 'status', deployment, provider: chain.provider })).status;
    assert.equal(status.deployed, true);
    assert.equal(status.relayer.allowed, true);
    assert.equal(status.trustedVerifier, chain.wallets.verifier.address.toLowerCase());
    assert.equal(status.entryFeeEnabled, true);
    assert.deepEqual(status.games.map((game) => [game.gameId, game.devWalletConfirmed, game.playable, game.quote.totalWei]), record.games.map((game) => [game.slug, true, true, '100100000000000000']));
    assert.equal(status.onChainOperators.gameRegistry, chain.wallets.operator.address.toLowerCase());

    await act('pause-games');
    for (const game of record.games) assert.equal((await gameRegistry.getGame(game.gameId)).playable, false);
    await assert.rejects(rankedEntry.connect(chain.wallets.player1).openSession(ethers.id('paused-session'), record.games[0].gameId, { value: 100_100_000_000_000_000n }), (error) => error.reason === 'GAME_NOT_PLAYABLE');

    await act('fees-off');
    assert.equal(await rankedEntry.entryFeeEnabled(), false);
    await act('fees-on');
    assert.equal(await rankedEntry.entryFeeEnabled(), true);

    await act('reserve', ['200000000000000']);
    assert.equal(await rankedEntry.settlementGasReserveWei(), 200_000_000_000_000n);
    await assert.rejects(act('reserve', ['0.0002']), /decimal wei/);

    await act('relayer-off');
    assert.equal(await scores.relayers(chain.wallets.relayer.address), false);

    const nextVerifier = ethers.Wallet.createRandom().address;
    await act('rotate-verifier', [nextVerifier]);
    assert.equal(await scores.trustedVerifier(), nextVerifier);
    await assert.rejects(act('rotate-verifier', [ethers.ZeroAddress]), /new verifier address/);
  } finally {
    await chain.revert(snapshot);
  }
});

test('the operator CLI reads the key file inside the process and never prints it', async () => {
  const snapshot = await chain.snapshot();
  const bridge = await serveJsonRpc(chain.eip1193);
  try {
    await confirmAllDevWallets();
    const keyFile = join(dir, 'operator-keys.json');
    writeFileSync(keyFile, JSON.stringify({ operator: keys.operator }));
    const script = join(root, 'scripts', 'operator-actions.mjs');
    const status = await runNode([script, 'status', '--rpc', bridge.url, '--deployment', modulePath]);
    assert.equal(status.code, 0, status.stderr);
    assert.match(status.stdout, /contracts deployed/);
    assert.match(status.stdout, /lester-blaster: exists true devWalletConfirmed true playable false/);

    const activate = await runNode([script, 'activate', '--rpc', bridge.url, '--deployment', modulePath, '--key-file', keyFile, '--key-field', 'operator', '--broadcast', '--confirm', 'ACTIVATE_GAMES_4441']);
    assert.equal(activate.code, 0, activate.stderr);
    assert.match(activate.stdout, /Sent 3 transaction\(s\)/);
    assertNoSecret(activate.stdout + activate.stderr, [keys.operator], 'CLI output');
    for (const game of record.games) assert.equal((await localContracts(record, chain.provider).gameRegistry.getGame(game.gameId)).playable, true);

    // Against the committed predicted module a broadcast is refused before the key is read.
    const refused = await runNode([script, 'pause-games', '--rpc', bridge.url, '--key-file', join(dir, 'missing.json'), '--key-field', 'operator', '--broadcast', '--confirm', 'PAUSE_GAMES_4441']);
    const { LITVM_DEPLOYMENT } = await import('../apps/portal/src/generated/litvm-addresses.mjs');
    if (LITVM_DEPLOYMENT.status === 'predicted') {
      assert.equal(refused.code, 2);
      assert.match(refused.stdout, /not 'deployed'/);
    } else {
      assert.notEqual(refused.code, 0, 'the missing key file still stops the run');
    }
  } finally {
    await bridge.close();
    await chain.revert(snapshot);
  }
});

// A JSON-RPC node on another chain (default chain 1). It answers every read with zeros, so a CLI that
// trusted the static provider's 4441 would happily print this chain's state as LiteForge's.
async function serveOtherChainRpc(chainIdHex = '0x1') {
  const methods = [];
  const node = { async request({ method }) {
    methods.push(method);
    if (method === 'eth_chainId') return chainIdHex;
    return method === 'eth_getCode' || method === 'eth_call' ? '0x' : '0x0';
  } };
  return { ...(await serveJsonRpc(node)), methods };
}

test('the operator CLI asks the RPC node for its chain id and refuses any chain but 4441', async () => {
  const other = await serveOtherChainRpc('0x1');
  try {
    // status, with the real default provider factory (static network): the node's own eth_chainId decides.
    const lines = [];
    const code = await runOperatorCli({ argv: ['status', '--rpc', other.url], env: {}, log: (line) => lines.push(String(line)) });
    assert.equal(code, 2);
    assert.match(lines.join('\n'), /the RPC is on chain 1, expected 4441\. Nothing was read or sent/);
    assert.doesNotMatch(lines.join('\n'), /chain 4441 ·/, 'no status is printed under the LiteForge label');
    assert.deepEqual(other.methods, ['eth_chainId'], 'nothing but eth_chainId is read from the wrong chain');

    // A broadcast stops at the same check, before the key is read (the key variable is unset: reading it would throw).
    const broadcast = [];
    other.methods.length = 0;
    const refused = await runOperatorCli({ argv: ['activate', '--rpc', other.url, '--deployment', modulePath, '--broadcast', '--confirm', 'ACTIVATE_GAMES_4441', '--key-env', 'NOT_SET_ANYWHERE'], env: {}, log: (line) => broadcast.push(String(line)) });
    assert.equal(refused, 2);
    assert.match(broadcast.join('\n'), /the RPC is on chain 1, expected 4441/);
    assert.equal(other.methods.includes('eth_sendRawTransaction'), false);

    // The programmatic API checks the node too, not provider.getNetwork().
    const staticProvider = new ethers.JsonRpcProvider(other.url, 4441, { staticNetwork: true, cacheTimeout: -1 });
    try {
      assert.equal((await staticProvider.getNetwork()).chainId, 4441n, 'a static provider never asks the node');
      await assert.rejects(runOperatorAction({ action: 'status', deployment, provider: staticProvider }), /the RPC is on chain 1, expected 4441/);
    } finally {
      staticProvider.destroy();
    }
  } finally {
    await other.close();
  }

  // On the right chain, status prints the chain id the node reported.
  const bridge = await serveJsonRpc(chain.eip1193);
  try {
    const lines = [];
    assert.equal(await runOperatorCli({ argv: ['status', '--rpc', bridge.url, '--deployment', modulePath], env: {}, log: (line) => lines.push(String(line)) }), 0);
    assert.match(lines[0], /^chain 4441 · block \d+ · address module deployed · contracts deployed$/);
  } finally {
    await bridge.close();
  }
});

test('a --deployment override broadcasts only to a loopback RPC', async () => {
  const lines = [];
  // No --rpc and no RPC_URL: the LiteForge default. Blocked before any provider or key is touched.
  const code = await runOperatorCli({
    argv: ['activate', '--deployment', modulePath, '--broadcast', '--confirm', 'ACTIVATE_GAMES_4441', '--key-env', 'NOT_SET_ANYWHERE'],
    env: {},
    log: (line) => lines.push(String(line)),
    providerFactory: () => { throw new Error('no provider may be built'); },
  });
  assert.equal(code, 2);
  assert.match(lines.join('\n'), /--deployment is for dry runs and the local chain/);
  const viaEnv = [];
  assert.equal(await runOperatorCli({ argv: ['pause-games', '--deployment', modulePath, '--broadcast', '--confirm', 'PAUSE_GAMES_4441', '--key-env', 'X'], env: { RPC_URL: 'https://liteforge.rpc.caldera.xyz/http' }, log: (line) => viaEnv.push(String(line)), providerFactory: () => { throw new Error('no provider may be built'); } }), 2);
  assert.match(viaEnv.join('\n'), /--deployment is for dry runs/);
  for (const url of ['http://127.0.0.1:8545', 'http://localhost:8545/', 'http://[::1]:8545']) assert.equal(isLoopbackRpc(url), true, url);
  for (const url of ['https://liteforge.rpc.caldera.xyz/http', 'http://127.0.0.1.example.com/', 'not a url']) assert.equal(isLoopbackRpc(url), false, url);
});

// A fake `spawn` for the Vercel CLI: records command, args, options and stdin; answers `env ls` from a
// stateful name table and `env add` by adding the name. `env ls … --format json` answers like Vercel CLI
// 59.25 (stdout, `{ envs: [{ key, value?, type, target }] }`, sensitive values omitted, plain values
// included); `listing: 'ansi-table'` answers with the human table as FORCE_COLOR renders it (bold names).
const PLAIN_ENV_VALUE = 'https://user:plain-value-never-printed@rpc.example/x';
function fakeVercel({ production = [], preview = [], development = [], failAdd = null, listing = 'json' } = {}) {
  const tables = { production: new Set(production), preview: new Set(preview), development: new Set(development) };
  const calls = [];
  const spawnImpl = (rawCommand, rawArgs, options) => {
    const child = new EventEmitter();
    child.stdin = new PassThrough();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    // With shell:true (npx.cmd on Windows) the runner passes one command string and no args.
    const tokens = rawArgs.length ? [rawCommand, ...rawArgs] : String(rawCommand).split(' ');
    const [command, ...args] = tokens;
    const entry = { command, args, raw: { command: rawCommand, args: [...rawArgs] }, options, stdin: '' };
    calls.push(entry);
    child.stdin.on('data', (chunk) => { entry.stdin += chunk; });
    child.stdin.on('finish', () => {
      const [, sub, name, environment] = args.slice(args.indexOf('env'));
      let code = 0;
      if (sub === 'ls') {
        const table = tables[name];
        const json = args.includes('--format') && args[args.indexOf('--format') + 1] === 'json';
        if (listing === 'json' && json) {
          child.stderr.write('Vercel CLI 59.25.4\n> Retrieving project…\n');
          const envs = [...table].map((key) => (key === 'RPC_URL'
            ? { key, value: PLAIN_ENV_VALUE, type: 'plain', target: [name] }
            : { key, type: 'sensitive', target: [name] }));
          child.stdout.write(`${JSON.stringify({ envs }, null, 2)}\n`);
        } else {
          child.stdout.write(`> Environment Variables found for team/lesters-arcade\n\n name                          value      environments   created\n${[...table].map((item) => ` \x1b[1m${item}\x1b[22m${' '.repeat(Math.max(1, 30 - item.length))}\x1b[90m\x1b[3mHidden\x1b[23m\x1b[39m  ${name}  1d ago`).join('\n')}\n`);
        }
      } else if (sub === 'add') {
        if (failAdd === name) {
          code = 1;
          child.stderr.write(`Error: could not add ${name}: echo ${entry.stdin}`);
        } else tables[environment].add(name);
      }
      setImmediate(() => {
        child.stdout.end();
        child.stderr.end();
        child.emit('close', code);
      });
    });
    return child;
  };
  return { calls, spawnImpl, tables };
}

test('vercel secrets travel only over stdin and legacy names block the run', async () => {
  const keyFile = join(dir, 'vercel-keys.json');
  writeFileSync(keyFile, JSON.stringify({ verifier: keys.verifier, relayer: { address: chain.wallets.relayer.address, privateKey: keys.relayer } }));
  const cronOut = join(dir, `cron-secret-${Date.now()}.txt`);
  const base = ['--key-file', keyFile, '--deployment', modulePath, '--cron-secret-out', cronOut];
  // allowDeploymentOverride: these runs apply a --deployment module (the local chain) to a fake Vercel.
  const run = async (argv, fake, options = {}) => {
    const lines = [];
    const code = await runVercelSecrets({ argv, spawnImpl: fake.spawnImpl, log: (line) => lines.push(String(line)), allowDeploymentOverride: true, ...options });
    return { code, output: lines.join('\n') };
  };

  // Legacy names anywhere stop the run before any write; only names are printed.
  const legacy = fakeVercel({ production: ['SESSION_SECRET', 'RANKED_VERIFIER_PRIVATE_KEY', 'VERIFIER_PRIVATE_KEY'], preview: ['SCORE_REGISTRY_ADDRESS'] });
  const blocked = await run([...base, '--apply', '--confirm', VERCEL_APPLY_CONFIRM], legacy);
  assert.equal(blocked.code, 3);
  assert.match(blocked.output, /production:VERIFIER_PRIVATE_KEY, preview:SCORE_REGISTRY_ADDRESS/);
  assert.doesNotMatch(blocked.output, /Encrypted/);
  assert.doesNotMatch(blocked.output, /production:RANKED_VERIFIER_PRIVATE_KEY/, 'the new name is not mistaken for the legacy one');
  assert.equal(legacy.calls.some((call) => call.args.includes('add')), false, 'nothing written');
  assert.equal(existsSync(cronOut), false, 'no cron secret generated');
  for (const call of legacy.calls) {
    assert.deepEqual(call.args.slice(call.args.indexOf('env') + 3), [...ENV_LS_ARGS], 'every listing is --format json');
    assert.equal(call.options.env.FORCE_COLOR, '0', 'no colour codes in the child output');
  }

  // A listing that is not JSON (an old CLI, or the table with FORCE_COLOR bold names) fails closed.
  const coloured = fakeVercel({ production: ['VERIFIER_PRIVATE_KEY'], listing: 'ansi-table' });
  const unreadable = await run([...base, '--apply', '--confirm', VERCEL_APPLY_CONFIRM], coloured);
  assert.equal(unreadable.code, 1);
  assert.match(unreadable.output, /Refusing to continue: could not read the names from vercel env ls production --format json/);
  assert.equal(coloured.calls.some((call) => call.args.includes('add')), false, 'nothing written');
  assert.equal(existsSync(cronOut), false, 'no cron secret generated');
  assert.equal((await run(base, fakeVercel({ listing: 'ansi-table' }))).code, 1, 'a dry run fails closed too');

  // --apply never takes the registry address from a --deployment override (the CLI never allows it).
  const override = fakeVercel();
  const overridden = await run([...base, '--apply', '--confirm', VERCEL_APPLY_CONFIRM], override, { allowDeploymentOverride: false });
  assert.equal(overridden.code, 2);
  assert.match(overridden.output, /--deployment is for dry runs/);
  assert.equal(override.calls.length, 0);

  // Dry run: names only, nothing written.
  const dryFake = fakeVercel({ production: ['SESSION_SECRET', 'NEON_DATABASE_URL', 'RPC_URL'] });
  const dry = await run(base, dryFake);
  assert.equal(dry.code, 0);
  assert.equal(dry.output.includes('plain-value-never-printed'), false, 'listed plain values are never printed');
  assert.match(dry.output, /would set RANKED_VERIFIER_PRIVATE_KEY in production/);
  assert.match(dry.output, /would set CRON_SECRET in production/);
  assert.match(dry.output, /DRY RUN/);
  assert.equal(dryFake.calls.some((call) => call.args.includes('add')), false);
  assertNoSecret(dry.output, [keys.verifier, keys.relayer], 'dry-run output');
  assert.equal(existsSync(cronOut), false);
  const bare = await run(['--deployment', modulePath], fakeVercel());
  assert.equal(bare.code, 0, 'a dry run without --key-file still lists the names');
  assert.match(bare.output, /would set RANKED_RELAYER_PRIVATE_KEY in production \(--key-file not given/);

  // Guards before anything runs.
  const guard = fakeVercel();
  assert.equal((await run([...base, '--apply'], guard)).code, 2, 'apply needs the confirm phrase');
  const predictedModule = join(root, 'apps', 'portal', 'src', 'generated', 'litvm-addresses.mjs');
  const { LITVM_DEPLOYMENT } = await import('../apps/portal/src/generated/litvm-addresses.mjs');
  if (LITVM_DEPLOYMENT.status === 'predicted') {
    assert.equal((await run(['--key-file', keyFile, '--deployment', predictedModule, '--cron-secret-out', cronOut, '--apply', '--confirm', VERCEL_APPLY_CONFIRM], guard)).code, 2, 'apply needs a deployed module');
  }
  assert.equal(guard.calls.length, 0);
  const wrongKeys = join(dir, 'wrong-keys.json');
  writeFileSync(wrongKeys, JSON.stringify({ verifier: keys.attacker, relayer: keys.relayer }));
  await assert.rejects(run(['--key-file', wrongKeys, '--deployment', modulePath], fakeVercel()), (error) => {
    assert.match(error.message, /the verifier key \(field "verifier"\) is for 0x[0-9a-f]{40}, but the address module's trustedVerifier/);
    assertNoSecret(error.message, [keys.attacker], 'error');
    return true;
  });

  // Apply: every value only on stdin, CRON_SECRET also in the new file, SESSION_SECRET rotated.
  const fake = fakeVercel({ production: ['SESSION_SECRET', 'NEON_DATABASE_URL'], preview: ['SESSION_SECRET'] });
  let counter = 0;
  const randomBytesImpl = (size) => Buffer.alloc(size, ++counter);
  const applied = await run([...base, '--apply', '--confirm', VERCEL_APPLY_CONFIRM, '--rotate-session-secret'], fake, { randomBytesImpl });
  assert.equal(applied.code, 0, applied.output);
  const adds = fake.calls.filter((call) => call.args.includes('add'));
  assert.deepEqual(adds.map((call) => call.args.slice(call.args.indexOf('env'))), [
    ['env', 'add', 'RANKED_VERIFIER_PRIVATE_KEY', 'production', '--sensitive', '--force', '--yes'],
    ['env', 'add', 'RANKED_RELAYER_PRIVATE_KEY', 'production', '--sensitive', '--force', '--yes'],
    ['env', 'add', 'RANKED_SCORE_REGISTRY_ADDRESS', 'production', '--sensitive', '--force', '--yes'],
    ['env', 'add', 'CRON_SECRET', 'production', '--sensitive', '--force', '--yes'],
    ['env', 'add', 'SESSION_SECRET', 'production', '--sensitive', '--force', '--yes'],
  ]);
  const cronSecret = Buffer.alloc(32, 1).toString('hex');
  const sessionSecret = Buffer.alloc(32, 2).toString('hex');
  assert.deepEqual(adds.map((call) => call.stdin), [keys.verifier, keys.relayer, deployment.addresses.scoreSubmissionRegistry, cronSecret, sessionSecret]);
  const secretValues = [keys.verifier, keys.relayer, cronSecret, sessionSecret];
  for (const call of fake.calls) {
    assertNoSecret(`${call.raw.command} ${JSON.stringify(call.raw.args)} ${JSON.stringify(call.options)}`, secretValues, 'spawn command line');
    assert.deepEqual(call.options.stdio, ['pipe', 'pipe', 'pipe']);
    // Through a shell (npx.cmd on Windows) the runner passes one validated command string, no args array.
    if (call.options.shell) assert.deepEqual(call.raw.args, []);
  }
  assert.equal(readFileSync(cronOut, 'utf8').trim(), cronSecret, 'CRON_SECRET is written to the new file for live-cron');
  if (process.platform !== 'win32') assert.equal(statSync(cronOut).mode & 0o777, 0o600);
  assertNoSecret(applied.output, secretValues, 'apply output');
  assert.match(applied.output, /Verified: production has RANKED_VERIFIER_PRIVATE_KEY, RANKED_RELAYER_PRIVATE_KEY, RANKED_SCORE_REGISTRY_ADDRESS, CRON_SECRET, SESSION_SECRET and no legacy name/);
  assert.match(applied.output, /Preview SESSION_SECRET: present/);
  assert.equal([...fake.tables.preview].includes('CRON_SECRET'), false, 'production only');
  await assert.rejects(run([...base, '--apply', '--confirm', VERCEL_APPLY_CONFIRM], fakeVercel()), /already exists/, 'an existing secret file is never overwritten');

  // A failing add stops the run, and its stderr is redacted.
  const failing = fakeVercel({ failAdd: 'RANKED_RELAYER_PRIVATE_KEY' });
  const failOut = join(dir, `cron-secret-fail-${Date.now()}.txt`);
  const failed = await run(['--key-file', keyFile, '--deployment', modulePath, '--cron-secret-out', failOut, '--apply', '--confirm', VERCEL_APPLY_CONFIRM], failing);
  assert.equal(failed.code, 1);
  assert.match(failed.output, /\[redacted\]/);
  assertNoSecret(failed.output, [keys.relayer], 'failure output');

  // Helpers: the JSON listing parser fails closed and never quotes the output.
  const listingJson = JSON.stringify({ envs: [{ key: 'RANKED_VERIFIER_PRIVATE_KEY', type: 'sensitive' }, { key: 'VERIFIER_PRIVATE_KEY', type: 'encrypted' }, { key: 'RPC_URL', value: PLAIN_ENV_VALUE, type: 'plain' }] });
  assert.deepEqual([...envNamesFromLsJson(`Vercel CLI 59.25.4\n${listingJson}\n`)].sort(), ['RANKED_VERIFIER_PRIVATE_KEY', 'RPC_URL', 'VERIFIER_PRIVATE_KEY']);
  assert.deepEqual([...envNamesFromLsJson('{"envs":[]}')], []);
  const ansiTable = ' \x1b[1mVERIFIER_PRIVATE_KEY\x1b[22m  \x1b[90m\x1b[3mHidden\x1b[23m\x1b[39m  production  1d ago';
  for (const bad of [ansiTable, ' VERIFIER_PRIVATE_KEY  Encrypted  production', '', '{"envs":{}}', '{"projects":[]}', '{"envs":[{"value":"x"}]}', '{"envs":[{"key":"bad name"}]}', `{"envs":[{"key":"RPC_URL","value":"${PLAIN_ENV_VALUE}"}`]) {
    assert.throws(() => envNamesFromLsJson(bad), (error) => {
      assert.ok(error instanceof VercelListingError, JSON.stringify(bad));
      assert.equal(error.message.includes('plain-value-never-printed'), false);
      return true;
    });
  }
  assert.deepEqual(LEGACY_SECRET_NAMES, ['VERIFIER_PRIVATE_KEY', 'RELAYER_PRIVATE_KEY', 'SCORE_REGISTRY_ADDRESS']);
  assert.equal(defaultVercelCommand().baseArgs[0], 'vercel');
});

test('live cron prints only status and counts', async () => {
  const cronToken = 'fixture-cron-token-0123456789abcdef0123456789';
  const requests = [];
  const server = createServer((req, res) => {
    requests.push({ url: req.url, authorization: req.headers.authorization });
    const json = (status, body) => res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body));
    if (req.headers.authorization !== `Bearer ${cronToken}`) return json(401, { ok: false, error: 'unauthorized', detail: 'bearer mismatch for rpc https://user:pass@rpc.example' });
    if (req.url === '/api/cron/index-chain') return json(200, { ok: true, schemaVersion: 1, fromBlock: 10, toBlock: 20, scores: 2, achievements: 0, profiles: 1, skipped: 0, mismatches: 0, lagBlocks: 3, rpcUrl: 'https://user:pass@rpc.example/x', note: 'internal detail' });
    if (req.url === '/api/cron/settle-retry') return json(200, { ok: true, processed: [{ sessionId32: `0x${'ab'.repeat(32)}`, from: 'pending', to: 'confirmed', code: 'confirmed' }] });
    return json(404, { ok: false, error: 'not-found' });
  });
  await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
  const site = `http://127.0.0.1:${server.address().port}`;
  const secretFile = join(dir, 'cron-secret.txt');
  writeFileSync(secretFile, `${cronToken}\n`);
  try {
    const run = async (argv, env = {}) => {
      const lines = [];
      const code = await runLiveCronCli({ argv, env, log: (line) => lines.push(String(line)) });
      return { code, output: lines.join('\n'), lines };
    };
    const index = await run(['--site', site, '--path', '/api/cron/index-chain', '--secret-file', secretFile]);
    assert.equal(index.code, 0);
    assert.equal(index.lines.length, 1);
    assert.equal(index.output, '/api/cron/index-chain: status 200 · ok true · schemaVersion 1 · counts achievements=0 fromBlock=10 lagBlocks=3 mismatches=0 profiles=1 scores=2 skipped=0 toBlock=20');
    assert.equal(requests.at(-1).authorization, `Bearer ${cronToken}`, 'the secret travels only in the Authorization header');

    const retry = await run(['--site', site, '--path', '/api/cron/settle-retry', '--secret-env', 'FIXTURE_CRON_SECRET'], { FIXTURE_CRON_SECRET: cronToken });
    assert.equal(retry.code, 0);
    assert.match(retry.output, /counts processed=1$/);

    const wrong = await run(['--site', site, '--path', '/api/cron/index-chain', '--secret-env', 'WRONG'], { WRONG: 'x'.repeat(40) });
    assert.equal(wrong.code, 1);
    assert.match(wrong.output, /status 401 · ok false · schemaVersion n\/a · error unauthorized · counts none/);

    for (const result of [index, retry, wrong]) {
      assertNoSecret(result.output, [cronToken, 'user:pass', 'internal detail', 'bearer mismatch', 'x'.repeat(40)], 'live-cron output');
    }
    assert.equal(summarizeCronResponse(200, { ok: true, skipped: 'not-deployed', schemaVersion: 1 }).skipped, 'not-deployed');
    assert.equal(summarizeCronResponse(500, { ok: false, error: 'Error: connect ECONNREFUSED https://private-rpc' }).error, undefined, 'free text is never echoed');
    assert.throws(() => cronUrl({ site: 'http://lestersarcade.io', path: '/api/cron/index-chain' }), /https/);
    assert.throws(() => cronUrl({ site: 'https://lestersarcade.io/x', path: '/api/cron/index-chain' }), /bare origin/);
    assert.throws(() => cronUrl({ site: 'https://lestersarcade.io', path: '/api/settle' }), /\/api\/cron\//);
    assert.equal(cronUrl({ site: 'https://lestersarcade.io', path: '/api/cron/index-chain' }).href, 'https://lestersarcade.io/api/cron/index-chain');
    await assert.rejects(run(['--site', site, '--path', '/api/cron/index-chain', '--secret-env', 'SHORT'], { SHORT: 'short' }), /at least 32 printable characters/);

    // The real CLI entry point prints the one summary line.
    const cli = await runNode([join(root, 'scripts', 'live-cron.mjs'), '--site', site, '--path', '/api/cron/index-chain', '--secret-file', secretFile]);
    assert.equal(cli.code, 0, cli.stderr);
    assert.equal(cli.stdout.trim(), index.output);
    assertNoSecret(cli.stdout + cli.stderr, [cronToken], 'CLI output');
  } finally {
    await new Promise((resolveClose) => server.close(() => resolveClose()));
  }
});
