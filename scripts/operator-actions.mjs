// Operator actions on the hardened LitVM contracts (contract §8.6, §11 rule 13, §13 runbook and stops).
//
//   node scripts/operator-actions.mjs <action> [args] [options]
//
// Every action but `status` is a DRY RUN unless --broadcast and --confirm <PHRASE> are both given; the
// dry run reads the chain and prints the exact calls. A broadcast also needs a DEPLOYED address module
// and the operator key, read inside the process from --key-env <NAME> or --key-file <path> --key-field
// <field> and never printed. The signer must be the on-chain operator of every contract it touches.
//
// Actions:
//   status                      read-only: operator nonce and balances, quoteEntry, entryFeeEnabled,
//                               playable and devWalletConfirmed per game, relayers(relayer), trustedVerifier
//   activate                    setPlayable(id, true) for each game whose dev wallet is confirmed  ACTIVATE_GAMES_4441
//   pause-games                 setPlayable(id, false) for each playable game (on-chain stop)      PAUSE_GAMES_4441
//   fees-on                     setEntryFeeEnabled(true)                                           FEES_ON_4441
//   fees-off                    setEntryFeeEnabled(false). NOT A STOP: see the warning below        FEES_OFF_4441
//   reserve <wei>               setSettlementGasReserve(wei)                                       SET_RESERVE_4441
//   relayer-off                 setRelayer(relayer, false) on the score registry                   RELAYER_OFF_4441
//   rotate-verifier <address>   setTrustedVerifier(address) on the score registry                  ROTATE_VERIFIER_4441
//
// Options: --rpc <url> (default RPC_URL, else the LiteForge RPC), --deployment <module.mjs> (default the
// committed generated module), --relayer <address> (relayer-off; default the module's relayer), --json.
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ethers } from 'ethers';
import { flagValue, hasFlag, readSecret } from './lib/key-source.mjs';
import { LITVM_GAME_SLUGS, loadLitvmDeployment } from './generate-litvm-addresses.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

export const DEFAULT_RPC_URL = 'https://liteforge.rpc.caldera.xyz/http';
export const FEES_OFF_WARNING = 'fees-off is NOT an emergency stop. setEntryFeeEnabled(false) makes openSession free: with the RANKED_MIN_PAID_WEI check such sessions are never relayed (Ranked becomes unusable), and without it Ranked would be free while the relayer pays gas. To stop Ranked: SETTLEMENT_PAUSED=true plus a redeploy of the current release, and/or `pause-games`.';

export const OPERATOR_ACTIONS = Object.freeze({
  status: Object.freeze({ confirm: null, usage: 'status', summary: 'read-only contract and wallet state' }),
  activate: Object.freeze({ confirm: 'ACTIVATE_GAMES_4441', usage: 'activate', summary: 'setPlayable(id, true) for each game whose dev wallet is confirmed' }),
  'pause-games': Object.freeze({ confirm: 'PAUSE_GAMES_4441', usage: 'pause-games', summary: 'setPlayable(id, false) for each playable game (the on-chain stop)' }),
  'fees-on': Object.freeze({ confirm: 'FEES_ON_4441', usage: 'fees-on', summary: 'setEntryFeeEnabled(true)' }),
  'fees-off': Object.freeze({ confirm: 'FEES_OFF_4441', usage: 'fees-off', summary: 'setEntryFeeEnabled(false) (never a stop)' }),
  reserve: Object.freeze({ confirm: 'SET_RESERVE_4441', usage: 'reserve <wei>', summary: 'setSettlementGasReserve(wei)' }),
  'relayer-off': Object.freeze({ confirm: 'RELAYER_OFF_4441', usage: 'relayer-off [--relayer <address>]', summary: 'setRelayer(relayer, false) on the score registry' }),
  'rotate-verifier': Object.freeze({ confirm: 'ROTATE_VERIFIER_4441', usage: 'rotate-verifier <address>', summary: 'setTrustedVerifier(address) on the score registry' }),
});

export function operatorHelp() {
  const rows = Object.entries(OPERATOR_ACTIONS).map(([name, action]) => `  ${action.usage.padEnd(36)} ${action.summary}${action.confirm ? `  [--confirm ${action.confirm}]` : ''}`);
  return [
    'usage: node scripts/operator-actions.mjs <action> [args] [--rpc <url>] [--deployment <module.mjs>]',
    '       [--broadcast --confirm <PHRASE> (--key-env <NAME> | --key-file <path> --key-field <field>)]',
    '',
    'Actions (dry run unless --broadcast and the confirm phrase are given):',
    ...rows,
    '',
    `WARNING: ${FEES_OFF_WARNING}`,
  ].join('\n');
}

let abiCache = null;
function abis() {
  abiCache ??= Object.fromEntries(['GameRegistry', 'ArcadeRankedEntry', 'ScoreSubmissionRegistry'].map((name) => [
    name,
    JSON.parse(readFileSync(join(root, 'contracts', 'artifacts', `${name}.json`), 'utf8')).abi,
  ]));
  return abiCache;
}

function contracts(deployment, runner) {
  const { GameRegistry, ArcadeRankedEntry, ScoreSubmissionRegistry } = abis();
  return {
    gameRegistry: new ethers.Contract(deployment.addresses.gameRegistry, GameRegistry, runner),
    rankedEntry: new ethers.Contract(deployment.addresses.arcadeRankedEntry, ArcadeRankedEntry, runner),
    scores: new ethers.Contract(deployment.addresses.scoreSubmissionRegistry, ScoreSubmissionRegistry, runner),
  };
}

const TARGETS = Object.freeze({ gameRegistry: 'GameRegistry', rankedEntry: 'ArcadeRankedEntry', scores: 'ScoreSubmissionRegistry' });

async function hasCode(provider, address) {
  const code = await provider.getCode(address);
  return Boolean(code) && code !== '0x';
}

// Read-only snapshot. Works before the deploy too (contracts then report deployed:false).
export async function readOperatorStatus({ provider, deployment, relayer = deployment.relayer }) {
  const network = await provider.getNetwork();
  const operator = deployment.deployer;
  const balance = async (address) => (await provider.getBalance(address)).toString();
  const status = {
    chainId: Number(network.chainId),
    addressModule: deployment.status,
    blockNumber: await provider.getBlockNumber(),
    operator: {
      address: operator,
      nonce: await provider.getTransactionCount(operator, 'latest'),
      pendingNonce: await provider.getTransactionCount(operator, 'pending'),
      balanceWei: await balance(operator),
    },
    relayer: { address: relayer.toLowerCase(), balanceWei: await balance(relayer), allowed: null },
    verifier: { address: deployment.trustedVerifier, balanceWei: await balance(deployment.trustedVerifier) },
    code: {},
    deployed: false,
    onChainOperators: {},
    trustedVerifier: null,
    entryFeeEnabled: null,
    settlementGasReserveWei: null,
    games: [],
  };
  for (const key of ['gameRegistry', 'playerProfileRegistry', 'arcadeRankedEntry', 'scoreSubmissionRegistry']) {
    status.code[key] = await hasCode(provider, deployment.addresses[key]);
  }
  status.deployed = status.code.gameRegistry && status.code.arcadeRankedEntry && status.code.scoreSubmissionRegistry;
  if (!status.deployed) return status;
  const { gameRegistry, rankedEntry, scores } = contracts(deployment, provider);
  for (const [key, contract] of Object.entries({ gameRegistry, rankedEntry, scores })) status.onChainOperators[key] = String(await contract.operator()).toLowerCase();
  status.relayer.allowed = await scores.relayers(relayer);
  status.trustedVerifier = String(await scores.trustedVerifier()).toLowerCase();
  status.entryFeeEnabled = await rankedEntry.entryFeeEnabled();
  status.settlementGasReserveWei = (await rankedEntry.settlementGasReserveWei()).toString();
  for (const gameId of LITVM_GAME_SLUGS) {
    const game = await gameRegistry.getGame(ethers.id(gameId));
    const row = { gameId, exists: game.exists, devWalletConfirmed: game.devWalletConfirmed, playable: game.playable, quote: null };
    if (game.exists) {
      const [entryFeeWei, settlementGasReserveWei, totalWei] = await rankedEntry.quoteEntry(ethers.id(gameId));
      row.quote = { entryFeeWei: entryFeeWei.toString(), settlementGasReserveWei: settlementGasReserveWei.toString(), totalWei: totalWei.toString() };
    }
    status.games.push(row);
  }
  return status;
}

function call(target, contract, method, args, extra = {}) {
  return { target, contract: TARGETS[target], to: contract.target.toLowerCase(), method, args, data: contract.interface.encodeFunctionData(method, args), ...extra };
}

// Reads the chain and returns the calls an action would send (no-ops are left out, with a note).
export async function planOperatorAction({ action, args = [], deployment, provider, relayer = deployment.relayer }) {
  const spec = OPERATOR_ACTIONS[action];
  if (!spec || action === 'status') throw new Error(`unknown action ${JSON.stringify(action)}\n${operatorHelp()}`);
  const { gameRegistry, rankedEntry, scores } = contracts(deployment, provider);
  if (!(await hasCode(provider, deployment.addresses.gameRegistry))) throw new Error(`no contract code at the GameRegistry address ${deployment.addresses.gameRegistry}: the contracts are not deployed on this chain`);
  const calls = [];
  const notes = [];
  if (action === 'activate' || action === 'pause-games') {
    const playable = action === 'activate';
    for (const gameId of LITVM_GAME_SLUGS) {
      const gameId32 = ethers.id(gameId);
      const game = await gameRegistry.getGame(gameId32);
      if (!game.exists) notes.push(`${gameId}: not registered, skipped`);
      else if (playable && !game.devWalletConfirmed) notes.push(`${gameId}: dev wallet not confirmed yet (owner page, runbook step 4), skipped`);
      else if (game.playable === playable) notes.push(`${gameId}: already ${playable ? 'playable' : 'paused'}`);
      else calls.push(call('gameRegistry', gameRegistry, 'setPlayable', [gameId32, playable], { gameId }));
    }
  } else if (action === 'fees-on' || action === 'fees-off') {
    const enabled = action === 'fees-on';
    if (!enabled) notes.push(`WARNING: ${FEES_OFF_WARNING}`);
    if ((await rankedEntry.entryFeeEnabled()) === enabled) notes.push(`entry fees already ${enabled ? 'enabled' : 'disabled'}`);
    else calls.push(call('rankedEntry', rankedEntry, 'setEntryFeeEnabled', [enabled]));
  } else if (action === 'reserve') {
    const wei = String(args[0] ?? '');
    if (!/^(0|[1-9]\d*)$/.test(wei)) throw new Error('reserve needs a decimal wei amount, for example: reserve 100000000000000');
    if (BigInt(wei) > 10n ** 18n) throw new Error('refusing a settlement reserve above 1 zkLTC');
    if (BigInt(wei) > 0n && (await rankedEntry.relayerVault()) === ethers.ZeroAddress) throw new Error('the relayer vault is unset, so a non-zero reserve would revert (RELAYER_VAULT_UNSET)');
    if ((await rankedEntry.settlementGasReserveWei()).toString() === wei) notes.push(`reserve already ${wei} wei`);
    else calls.push(call('rankedEntry', rankedEntry, 'setSettlementGasReserve', [BigInt(wei)]));
  } else if (action === 'relayer-off') {
    if (!ethers.isAddress(relayer)) throw new Error('relayer-off needs a relayer address');
    if (!(await scores.relayers(relayer))) notes.push(`relayer ${relayer} is already not allowed`);
    else calls.push(call('scores', scores, 'setRelayer', [ethers.getAddress(relayer), false]));
  } else if (action === 'rotate-verifier') {
    const next = String(args[0] ?? '');
    if (!/^0x[0-9a-fA-F]{40}$/.test(next) || /^0x0{40}$/.test(next)) throw new Error('rotate-verifier needs the new verifier address (0x…, not zero)');
    if (String(await scores.trustedVerifier()).toLowerCase() === next.toLowerCase()) notes.push(`trusted verifier is already ${next}`);
    else calls.push(call('scores', scores, 'setTrustedVerifier', [ethers.getAddress(next)]));
  }
  return { action, confirm: spec.confirm, calls, notes };
}

// Dry run unless `broadcast`; a broadcast needs the confirm phrase, a deployed module and the operator.
export async function runOperatorAction({ action, args = [], deployment, provider, signer = null, broadcast = false, confirm = null, relayer = deployment?.relayer, log = () => {} }) {
  const spec = OPERATOR_ACTIONS[action];
  if (!spec) throw new Error(`unknown action ${JSON.stringify(action)}\n${operatorHelp()}`);
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== deployment.chainId) throw new Error(`the RPC is on chain ${network.chainId}, expected ${deployment.chainId}`);
  if (action === 'status') return { action, status: await readOperatorStatus({ provider, deployment, relayer }) };
  if (broadcast) {
    if (confirm !== spec.confirm) throw new Error(`broadcast blocked: ${action} needs --confirm ${spec.confirm}`);
    if (deployment.status !== 'deployed') throw new Error(`broadcast blocked: the address module is '${deployment.status}', not 'deployed'`);
    if (!signer) throw new Error('broadcast blocked: no operator signer');
  }
  const plan = await planOperatorAction({ action, args, deployment, provider, relayer });
  for (const note of plan.notes) log(note);
  if (!broadcast) return { action, dryRun: true, plan, receipts: [] };
  const signerAddress = (await signer.getAddress()).toLowerCase();
  const targets = contracts(deployment, provider);
  for (const target of new Set(plan.calls.map((entry) => entry.target))) {
    const onChain = String(await targets[target].operator()).toLowerCase();
    if (onChain !== signerAddress) throw new Error(`broadcast blocked: the signer is not the operator of ${TARGETS[target]} (${onChain})`);
  }
  const receipts = [];
  for (const entry of plan.calls) {
    const tx = await signer.sendTransaction({ to: entry.to, data: entry.data });
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new Error(`${entry.method} failed in ${tx.hash}`);
    log(`sent ${entry.contract}.${entry.method}${entry.gameId ? ` (${entry.gameId})` : ''}: ${tx.hash}`);
    receipts.push({ method: entry.method, gameId: entry.gameId ?? null, txHash: tx.hash, blockNumber: receipt.blockNumber });
  }
  return { action, dryRun: false, plan, receipts };
}

const toJson = (value) => JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? item.toString() : item), 2);

function printPlan(result, log) {
  if (result.dryRun) log(`DRY RUN: ${result.action} would send ${result.plan.calls.length} transaction(s). Nothing was signed or sent.`);
  for (const entry of result.plan.calls) {
    log(`  ${entry.contract} ${entry.to} ${entry.method}(${entry.args.map((arg) => String(arg)).join(', ')})${entry.gameId ? ` [${entry.gameId}]` : ''}`);
  }
  if (result.dryRun && result.plan.calls.length > 0) log(`To send: add --broadcast --confirm ${result.plan.confirm} and the operator key (--key-env <NAME> or --key-file <path> --key-field <field>).`);
  if (!result.dryRun) log(`Sent ${result.receipts.length} transaction(s).`);
}

// CLI body, injectable for tests. Returns an exit code.
export async function runOperatorCli({ argv = process.argv.slice(2), env = process.env, log = console.log, providerFactory = (url) => new ethers.JsonRpcProvider(url, 4441, { staticNetwork: true, cacheTimeout: -1 }) } = {}) {
  const [action, ...rest] = argv;
  if (!action || action === '--help' || action === 'help' || !OPERATOR_ACTIONS[action]) {
    log(operatorHelp());
    return action && action !== '--help' && action !== 'help' ? 2 : 0;
  }
  const positional = [];
  for (let index = 0; index < rest.length; index += 1) {
    if (rest[index].startsWith('--')) {
      if (!['--broadcast', '--json'].includes(rest[index]) && !rest[index].includes('=')) index += 1;
      continue;
    }
    positional.push(rest[index]);
  }
  const broadcast = hasFlag(argv, '--broadcast');
  const confirm = flagValue(argv, '--confirm');
  const deployment = await loadLitvmDeployment(flagValue(argv, '--deployment'));
  if (action === 'fees-off') log(`WARNING: ${FEES_OFF_WARNING}`);
  if (broadcast) {
    // All guards before the key is read.
    if (confirm !== OPERATOR_ACTIONS[action].confirm) {
      log(`Broadcast blocked: ${action} needs --confirm ${OPERATOR_ACTIONS[action].confirm}.`);
      return 2;
    }
    if (deployment.status !== 'deployed') {
      log(`Broadcast blocked: the address module is '${deployment.status}', not 'deployed'.`);
      return 2;
    }
  }
  const provider = providerFactory(flagValue(argv, '--rpc') ?? env.RPC_URL ?? DEFAULT_RPC_URL);
  const signer = broadcast && action !== 'status' ? new ethers.Wallet(readSecret({ env, argv, label: 'operator key' }), provider) : null;
  if (signer) log(`Operator signer ${signer.address}.`);
  const result = await runOperatorAction({ action, args: positional, deployment, provider, signer, broadcast, confirm, relayer: flagValue(argv, '--relayer') ?? deployment.relayer, log });
  if (action === 'status') {
    if (hasFlag(argv, '--json')) log(toJson(result.status));
    else {
      const s = result.status;
      log(`chain ${s.chainId} · block ${s.blockNumber} · address module ${s.addressModule} · contracts ${s.deployed ? 'deployed' : 'NOT deployed'}`);
      log(`operator ${s.operator.address} nonce ${s.operator.nonce} (pending ${s.operator.pendingNonce}) balance ${ethers.formatEther(s.operator.balanceWei)} zkLTC`);
      log(`relayer ${s.relayer.address} balance ${ethers.formatEther(s.relayer.balanceWei)} zkLTC allowed ${s.relayer.allowed}`);
      log(`verifier ${s.verifier.address} balance ${ethers.formatEther(s.verifier.balanceWei)} zkLTC · on-chain trustedVerifier ${s.trustedVerifier}`);
      log(`entryFeeEnabled ${s.entryFeeEnabled} · settlementGasReserveWei ${s.settlementGasReserveWei}`);
      for (const game of s.games) log(`  ${game.gameId}: exists ${game.exists} devWalletConfirmed ${game.devWalletConfirmed} playable ${game.playable} quote ${game.quote ? `${game.quote.totalWei} wei` : 'n/a'}`);
    }
    return 0;
  }
  printPlan(result, log);
  return 0;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMain) {
  try {
    process.exitCode = await runOperatorCli();
  } catch (error) {
    console.error(`operator-actions: ${error?.shortMessage ?? error?.message ?? error}`);
    process.exitCode = 1;
  }
}
