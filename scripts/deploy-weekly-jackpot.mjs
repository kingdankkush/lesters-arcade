// Deploys the Chikun Weekly Jackpot (design §A.18, §A.19; runbook steps E3 and E4). Two phases:
//
//   node scripts/deploy-weekly-jackpot.mjs --game chikun --first-week next --admin <addr> --keeper <addr> \
//        --residual <addr> --rules launch                                   # DRY RUN (default): a manifest
//   … --broadcast --confirm DEPLOY_WEEKLY_JACKPOT_4441 --key-file <path> --key-field keys.operator
//
// The dry run reads the chain and prints a manifest: the predicted addresses (CREATE from the operator's
// pending nonce), the constructor arguments, gas estimates, and a read-only eth_call of each creation code,
// which proves the constructor executes on the target chain (LitVM osaka support is UNVERIFIED). Nothing
// is signed or sent. The broadcast deploys TestChikunToken (tCHIKUN, minter = the operator) unless --token
// names an existing token, then WeeklyJackpot; it reads the immutables and roles back, writes
// contracts/deployment-record.jackpot.json and regenerates apps/portal/src/generated/litvm-jackpot.mjs.
//
// Guards (contract §11 rules 8, 9 and 13):
// - The operator is LITVM_DEPLOYMENT.deployer (the Ranked operator); the key, read in this process only
//   through scripts/lib/key-source.mjs (--key-env <NAME> | --key-file <path> --key-field <field>), must be
//   that address, and must also be the on-chain operator of the score registry. It is never printed.
// - The Ranked registries must hold code, and the Chikun game must be registered. The 1.8.x contracts are
//   only read, never changed: the jackpot is a new contract.
// - --first-week accepts `next` or a future YYYY-Www only (`current` and past weeks are refused; the
//   constructor enforces firstWeek > currentWeek too).
// - When a jackpot record already exists, --retire-previous is required: the previous instance moves into
//   retired[] and needs a scheduled end with firstWeek > its endAfterWeek (read from chain).
// - --rpc, --deployment (a LITVM_DEPLOYMENT module), --record and --module are honoured only with a
//   loopback --rpc (the in-process chain); a loopback broadcast must name --record and --module, so a local
//   run never overwrites the committed record or module. Against LiteForge the committed files are used.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ethers } from 'ethers';
import { SecretSourceError, flagValue, hasFlag, readSecret } from './lib/key-source.mjs';
import { loadLitvmDeployment } from './generate-litvm-addresses.mjs';
import { isLoopbackRpc, rpcChainId } from './operator-actions.mjs';
import {
  CHIKUN_GAME_ID32,
  JACKPOT_CHAIN_ID,
  buildJackpotRecord,
  launchRulesFor,
  loadContractArtifact as loadArtifact,
  normalizeRules,
  readJackpotRecord,
  rulesFromChain,
  rulesToJson,
  weekIndexOf,
  weekIndexOfKey,
  weekKeyOf,
  weekStartOf,
  writeJackpotRecord,
  writeLitvmJackpotModule,
} from './generate-litvm-jackpot.mjs';

export const DEPLOY_JACKPOT_CONFIRM = 'DEPLOY_WEEKLY_JACKPOT_4441';
export const DEFAULT_RPC_URL = 'https://liteforge.rpc.caldera.xyz/http';

// Design §A.11: the owner signs off on these before any real token is plugged in (--token).
export const TOKEN_ACCEPTANCE_CHECKLIST = Object.freeze([
  'decimals() read and noted (display only; the contract is decimals-agnostic)',
  'fee-on-transfer or recipient-side tax: fund credits the received amount, but the winner receives prize minus the tax',
  'fees charged to the sender on outgoing transfers: reject the token or exempt the jackpot (the last claims would revert)',
  'blacklist or pause: handled by the pull claim; the residual recipient must not be blacklisted (it can nominate a successor)',
  'max-transaction, max-wallet, cooldown, trading-not-enabled and anti-bot gates: the jackpot must be exempt, and the prize cap must be at most the max-transaction amount',
  'double entry points (a second address moving the same balance): sweepStray blocks the drain, but list the token as unsupported',
  'rebasing: unsupported (a negative rebase breaks balance >= liabilities)',
  'upgradeable proxy or owner mint/blacklist powers: a trust note on the rules page',
  'ERC-777-style callbacks: covered by nonReentrant',
  'gas-griefing transfers can block finalize: vetted tokens only',
]);

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export class DeployBlocked extends Error {
  constructor(message) {
    super(message);
    this.name = 'DeployBlocked';
  }
}

function blocked(message) {
  throw new DeployBlocked(message);
}

function address(value, flag) {
  if (typeof value !== 'string' || !ADDRESS_RE.test(value) || /^0x0{40}$/.test(value)) blocked(`${flag} must be a non-zero 0x address`);
  return ethers.getAddress(value);
}

async function hasCode(provider, target) {
  const code = await provider.getCode(target);
  return Boolean(code) && code !== '0x';
}

const artifactFactory = (name) => {
  const artifact = loadArtifact(name);
  return new ethers.ContractFactory(artifact.abi, artifact.bytecode);
};

// Parses and validates the flags (no chain access). Throws DeployBlocked on a bad flag.
export function parseDeployArgs(argv) {
  const known = new Set(['--game', '--first-week', '--admin', '--keeper', '--residual', '--rules', '--token', '--retire-previous', '--token-testnet', '--rpc', '--deployment', '--record', '--module', '--broadcast', '--confirm', '--key-env', '--key-file', '--key-field', '--json']);
  const booleans = new Set(['--retire-previous', '--token-testnet', '--broadcast', '--json']);
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index].split('=')[0];
    if (!known.has(flag)) blocked(`unknown option ${argv[index]}`);
    if (!booleans.has(flag) && !argv[index].includes('=')) index += 1;
  }
  const game = flagValue(argv, '--game') ?? 'chikun';
  if (game !== 'chikun') blocked('--game must be chikun (one instance per game and token; only Chikun has a jackpot)');
  const firstWeek = flagValue(argv, '--first-week');
  if (!firstWeek) blocked('--first-week next|<YYYY-Www> is required');
  if (firstWeek === 'current') blocked('--first-week current is refused: sessions opened before the contract, its rules and its block list existed must never win (design §A.2). Use next or a future week.');
  if (firstWeek !== 'next' && !/^\d{4}-W\d{2}$/.test(firstWeek)) blocked('--first-week must be next or a future YYYY-Www');
  const rpc = flagValue(argv, '--rpc');
  const loopback = rpc !== null && isLoopbackRpc(rpc);
  if (rpc !== null && !loopback) blocked('--rpc is honoured only for a loopback RPC (the local chain); against LiteForge the default RPC is used');
  for (const flag of ['--deployment', '--record', '--module']) {
    if (flagValue(argv, flag) !== null && !loopback) blocked(`${flag} is honoured only with a loopback --rpc; against LiteForge the committed files are used`);
  }
  const token = flagValue(argv, '--token');
  return {
    game,
    firstWeek,
    admin: address(flagValue(argv, '--admin'), '--admin'),
    keeper: address(flagValue(argv, '--keeper'), '--keeper'),
    residual: address(flagValue(argv, '--residual'), '--residual'),
    rules: flagValue(argv, '--rules') ?? 'launch',
    token: token === null ? null : address(token, '--token'),
    tokenTestnet: hasFlag(argv, '--token-testnet'),
    retirePrevious: hasFlag(argv, '--retire-previous'),
    rpc: rpc ?? DEFAULT_RPC_URL,
    loopback,
    deploymentModule: flagValue(argv, '--deployment'),
    recordPath: flagValue(argv, '--record'),
    modulePath: flagValue(argv, '--module'),
    broadcast: hasFlag(argv, '--broadcast'),
    confirm: flagValue(argv, '--confirm'),
    json: hasFlag(argv, '--json'),
  };
}

// The first week index for `next` or a YYYY-Www key, refused unless it is after the current week.
export function resolveFirstWeek(spec, currentWeek) {
  let index;
  try {
    index = spec === 'next' ? currentWeek + 1 : weekIndexOfKey(spec);
  } catch (error) {
    blocked(`--first-week ${spec}: ${error.message}`);
  }
  if (index <= currentWeek) blocked(`--first-week ${spec} (${weekKeyOf(index)}) is not after the current week ${weekKeyOf(currentWeek)}`);
  return index;
}

// Launch rules (design §A.5) or a JSON rules file; fromWeek is always the first week.
export function resolveRules(spec, firstWeek, readFile) {
  if (spec === 'launch') return launchRulesFor({ fromWeek: firstWeek });
  let json;
  try {
    json = JSON.parse(readFile(spec));
  } catch (error) {
    blocked(`--rules ${spec}: ${error?.code ?? 'not valid JSON'}`);
  }
  try {
    return normalizeRules(json, { fromWeek: firstWeek });
  } catch (error) {
    blocked(`--rules ${spec}: ${error.message}`);
  }
  return null;
}

async function tokenFacts(provider, tokenAddress) {
  const erc20 = new ethers.Contract(tokenAddress, loadArtifact('TestChikunToken').abi, provider);
  const read = async (method) => { try { return await erc20[method](); } catch { return null; } };
  const [name, symbol, decimals] = await Promise.all([read('name'), read('symbol'), read('decimals')]);
  return { name, symbol, decimals: decimals === null ? null : Number(decimals) };
}

async function creationFacts(provider, from, data) {
  const facts = { gasEstimate: null, creationCall: null };
  try {
    facts.gasEstimate = (await provider.estimateGas({ from, data })).toString();
  } catch (error) {
    facts.gasEstimate = `failed: ${error?.shortMessage ?? error?.message ?? error}`;
  }
  try {
    const runtime = await provider.call({ from, data });
    facts.creationCall = { ok: runtime !== '0x', runtimeBytes: (runtime.length - 2) / 2, runtimeCodeHash: ethers.keccak256(runtime) };
  } catch (error) {
    facts.creationCall = { ok: false, error: error?.shortMessage ?? error?.message ?? String(error) };
  }
  return facts;
}

// Reads the chain and returns the dry-run manifest. Nothing is signed or sent.
const readText = (path) => readFileSync(path, 'utf8');

export async function planJackpotDeploy({ provider, deployment, options, previousRecord = null, readFile = readText }) {
  const chainId = await rpcChainId(provider);
  if (chainId !== JACKPOT_CHAIN_ID) blocked(`the RPC is on chain ${chainId}, expected ${JACKPOT_CHAIN_ID}`);
  if (deployment.status !== 'deployed') blocked(`the Ranked address module is '${deployment.status}': the jackpot reads the deployed 1.8.x registries, so they must be deployed first`);
  const operator = ethers.getAddress(deployment.deployer);
  const suite = {
    gameRegistry: ethers.getAddress(deployment.addresses.gameRegistry),
    arcadeRankedEntry: ethers.getAddress(deployment.addresses.arcadeRankedEntry),
    scoreSubmissionRegistry: ethers.getAddress(deployment.addresses.scoreSubmissionRegistry),
  };
  for (const [key, target] of Object.entries(suite)) {
    if (!(await hasCode(provider, target))) blocked(`no contract code at ${key} ${target}: the Ranked suite is not deployed on this chain`);
  }
  const scores = new ethers.Contract(suite.scoreSubmissionRegistry, loadArtifact('ScoreSubmissionRegistry').abi, provider);
  const registry = new ethers.Contract(suite.gameRegistry, loadArtifact('GameRegistry').abi, provider);
  const rankedEntry = new ethers.Contract(suite.arcadeRankedEntry, loadArtifact('ArcadeRankedEntry').abi, provider);
  const game = await registry.getGame(CHIKUN_GAME_ID32);
  if (!game.exists) blocked('the Chikun game is not registered in the GameRegistry');
  const onChainOperator = ethers.getAddress(await scores.operator());
  const latest = await provider.getBlock('latest');
  const currentWeek = weekIndexOf(latest.timestamp);
  const firstWeek = resolveFirstWeek(options.firstWeek, currentWeek);
  const rules = resolveRules(options.rules, firstWeek, readFile);

  let previous = null;
  const priorInstance = previousRecord?.instances?.chikun ?? null;
  if (priorInstance && !options.retirePrevious) blocked(`a jackpot instance already exists (${priorInstance.address}); deploying another needs --retire-previous after schedule-end on it (design §A.19)`);
  if (options.retirePrevious) {
    if (!priorInstance) blocked('--retire-previous needs an existing jackpot record');
    if (!(await hasCode(provider, priorInstance.address))) blocked(`no contract code at the previous instance ${priorInstance.address}`);
    const prior = new ethers.Contract(priorInstance.address, loadArtifact('WeeklyJackpot').abi, provider);
    const endAfterWeek = Number(await prior.endAfterWeek());
    if (endAfterWeek === 0) blocked(`the previous instance ${priorInstance.address} has no scheduled end: run jackpot-actions schedule-end on it first`);
    if (firstWeek <= endAfterWeek) blocked(`--first-week ${weekKeyOf(firstWeek)} must be after the previous instance's end ${weekKeyOf(endAfterWeek)}, so no session can win on both`);
    previous = { address: priorInstance.address.toLowerCase(), endAfterWeek, endAfterWeekKey: weekKeyOf(endAfterWeek), firstWeek: priorInstance.firstWeek };
  }

  const pendingNonce = await provider.getTransactionCount(operator, 'pending');
  const deployToken = options.token === null;
  let tokenSection;
  if (deployToken) {
    const tx = await artifactFactory('TestChikunToken').getDeployTransaction(operator);
    tokenSection = {
      deploy: true,
      contract: 'TestChikunToken',
      nonce: pendingNonce,
      predictedAddress: ethers.getCreateAddress({ from: operator, nonce: pendingNonce }).toLowerCase(),
      constructorArgs: { minter: operator.toLowerCase() },
      name: "Lester's Arcade Test CHIKUN (no value)",
      symbol: 'tCHIKUN',
      decimals: 18,
      testnet: true,
      ...(await creationFacts(provider, operator, tx.data)),
    };
  } else {
    if (!(await hasCode(provider, options.token))) blocked(`no contract code at --token ${options.token}`);
    tokenSection = { deploy: false, address: options.token.toLowerCase(), ...(await tokenFacts(provider, options.token)), testnet: options.tokenTestnet, acceptanceChecklist: TOKEN_ACCEPTANCE_CHECKLIST.map((item, index) => ({ item: index + 1, check: item, ownerSignOff: 'required' })) };
  }
  const tokenAddress = ethers.getAddress(deployToken ? tokenSection.predictedAddress : options.token);
  const jackpotNonce = pendingNonce + (deployToken ? 1 : 0);
  const constructorArgs = [CHIKUN_GAME_ID32, tokenAddress, suite.scoreSubmissionRegistry, suite.arcadeRankedEntry, firstWeek, operator, options.admin, options.keeper, options.residual, rules];
  const jackpotTx = await artifactFactory('WeeklyJackpot').getDeployTransaction(...constructorArgs);
  const jackpotSection = {
    contract: 'WeeklyJackpot',
    nonce: jackpotNonce,
    predictedAddress: ethers.getCreateAddress({ from: operator, nonce: jackpotNonce }).toLowerCase(),
    constructorArgs: {
      gameId: CHIKUN_GAME_ID32,
      token: tokenAddress.toLowerCase(),
      scoreRegistry: suite.scoreSubmissionRegistry.toLowerCase(),
      rankedEntry: suite.arcadeRankedEntry.toLowerCase(),
      firstWeek,
      operator: operator.toLowerCase(),
      admin: options.admin.toLowerCase(),
      keeper: options.keeper.toLowerCase(),
      residualRecipient: options.residual.toLowerCase(),
      rules: rulesToJson(rules),
    },
    ...(await creationFacts(provider, operator, jackpotTx.data)),
  };
  const warnings = [];
  if (game.entryFeeWei !== rules.minPaidWei) warnings.push(`the Chikun entry fee on chain is ${game.entryFeeWei} wei but minPaidWei is ${rules.minPaidWei} (J17: keep them coupled)`);
  if (!game.playable) warnings.push('the Chikun game is not playable on chain');
  if (onChainOperator !== operator) warnings.push(`the score registry's on-chain operator is ${onChainOperator}, not the module's ${operator}: a broadcast is refused`);
  for (const [role, value] of [['admin', options.admin], ['keeper', options.keeper], ['residual recipient', options.residual]]) {
    if (value === operator) warnings.push(`the ${role} is the operator`);
  }
  if (options.keeper === options.admin) warnings.push('the keeper is the admin');
  if (!jackpotSection.creationCall?.ok || (deployToken && !tokenSection.creationCall?.ok)) warnings.push('an eth_call of a creation code failed: the bytecode does not deploy on this chain as is');
  const [quote, balance, feeData] = await Promise.all([
    rankedEntry.quoteEntry(CHIKUN_GAME_ID32).then((row) => row.totalWei.toString()).catch(() => null),
    provider.getBalance(operator),
    provider.getFeeData().catch(() => ({})),
  ]);
  const gas = [deployToken ? tokenSection.gasEstimate : '0', jackpotSection.gasEstimate].reduce((sum, value) => sum + (/^\d+$/.test(String(value)) ? BigInt(value) : 0n), 0n);
  const gasPrice = feeData.maxFeePerGas ?? feeData.gasPrice ?? null;
  return {
    action: 'deploy-weekly-jackpot',
    dryRun: true,
    chainId,
    game: 'chikun',
    gameId: CHIKUN_GAME_ID32,
    operator: operator.toLowerCase(),
    operatorOnChain: onChainOperator.toLowerCase(),
    operatorNonce: { pending: pendingNonce },
    operatorBalanceWei: balance.toString(),
    ranked: {
      scoreSubmissionRegistry: suite.scoreSubmissionRegistry.toLowerCase(),
      arcadeRankedEntry: suite.arcadeRankedEntry.toLowerCase(),
      gameRegistry: suite.gameRegistry.toLowerCase(),
      chikunRegistered: game.exists,
      chikunPlayable: game.playable,
      chikunEntryFeeWei: game.entryFeeWei.toString(),
      chikunQuoteTotalWei: quote,
    },
    currentWeek: { index: currentWeek, key: weekKeyOf(currentWeek) },
    firstWeek: { index: firstWeek, key: weekKeyOf(firstWeek), startsAt: new Date(weekStartOf(firstWeek) * 1000).toISOString() },
    token: tokenSection,
    jackpot: jackpotSection,
    retirePrevious: previous,
    totalGasEstimate: gas.toString(),
    estimatedCostWei: gasPrice === null ? null : (gas * gasPrice).toString(),
    warnings,
    confirm: DEPLOY_JACKPOT_CONFIRM,
  };
}

// Sends the deployment planned in `manifest` from `signer` (the operator), verifies it, and returns the
// jackpot record (not yet written).
export async function broadcastJackpotDeploy({ provider, signer, manifest, options, previousRecord = null, readFile = readText, log = () => {} }) {
  const signerAddress = (await signer.getAddress()).toLowerCase();
  if (signerAddress !== manifest.operator) blocked(`the key is for ${signerAddress}, but the operator is ${manifest.operator}. Nothing was sent.`);
  if (signerAddress !== manifest.operatorOnChain) blocked(`the key is not the score registry's on-chain operator ${manifest.operatorOnChain}. Nothing was sent.`);
  const rules = resolveRules(options.rules, manifest.firstWeek.index, readFile);
  let tokenAddress = manifest.token.deploy ? null : ethers.getAddress(manifest.token.address);
  let tokenDeployTx = null;
  if (manifest.token.deploy) {
    const contract = await artifactFactory('TestChikunToken').connect(signer).deploy(signer.address, { nonce: manifest.token.nonce });
    const receipt = await contract.deploymentTransaction().wait();
    tokenAddress = await contract.getAddress();
    tokenDeployTx = receipt.hash;
    if (tokenAddress.toLowerCase() !== manifest.token.predictedAddress) blocked(`tCHIKUN landed at ${tokenAddress}, not the predicted ${manifest.token.predictedAddress}`);
    log(`deployed TestChikunToken ${tokenAddress.toLowerCase()} (${receipt.hash})`);
  }
  const args = manifest.jackpot.constructorArgs;
  const contract = await artifactFactory('WeeklyJackpot').connect(signer).deploy(
    args.gameId, tokenAddress, args.scoreRegistry, args.rankedEntry, args.firstWeek, args.operator, args.admin, args.keeper, args.residualRecipient, rules,
    { nonce: manifest.jackpot.nonce },
  );
  const receipt = await contract.deploymentTransaction().wait();
  const jackpotAddress = (await contract.getAddress()).toLowerCase();
  if (jackpotAddress !== manifest.jackpot.predictedAddress) blocked(`WeeklyJackpot landed at ${jackpotAddress}, not the predicted ${manifest.jackpot.predictedAddress}`);
  log(`deployed WeeklyJackpot ${jackpotAddress} (${receipt.hash})`);

  // Read the immutables and roles back before writing anything.
  const jackpot = new ethers.Contract(jackpotAddress, loadArtifact('WeeklyJackpot').abi, provider);
  const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
  const checks = {
    gameId: same(await jackpot.gameId(), args.gameId),
    token: same(await jackpot.token(), tokenAddress),
    scoreRegistry: same(await jackpot.scoreRegistry(), args.scoreRegistry),
    rankedEntry: same(await jackpot.rankedEntry(), args.rankedEntry),
    firstWeek: Number(await jackpot.firstWeek()) === args.firstWeek,
    operator: same(await jackpot.operator(), args.operator),
    admin: same(await jackpot.admin(), args.admin),
    keeper: same(await jackpot.keeper(), args.keeper),
    residualRecipient: same(await jackpot.residualRecipient(), args.residualRecipient),
    rulesCount: (await jackpot.rulesCount()) === 1n,
    rules: JSON.stringify(rulesToJson(rulesFromChain(await jackpot.rulesAt(0)))) === JSON.stringify(args.rules),
    staffEver: (await jackpot.staffEver(args.operator)) && (await jackpot.staffEver(args.admin)) && (await jackpot.staffEver(args.keeper)),
  };
  const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([key]) => key);
  if (failed.length) blocked(`read-back mismatch after deploy: ${failed.join(', ')}; the record was not written`);
  const facts = await tokenFacts(provider, tokenAddress);
  if (manifest.token.deploy) {
    const minter = await new ethers.Contract(tokenAddress, loadArtifact('TestChikunToken').abi, provider).minter();
    if (!same(minter, args.operator)) blocked('tCHIKUN minter read-back mismatch; the record was not written');
  }
  const previousEndAfterWeek = manifest.retirePrevious?.endAfterWeek ?? null;
  const record = buildJackpotRecord({
    instance: {
      game: 'chikun',
      gameId: args.gameId,
      address: jackpotAddress,
      token: { address: tokenAddress, name: facts.name, symbol: facts.symbol, decimals: facts.decimals, testnet: manifest.token.deploy ? true : manifest.token.testnet, deployTx: tokenDeployTx },
      startBlock: receipt.blockNumber,
      deployTx: receipt.hash,
      firstWeek: args.firstWeek,
      operator: args.operator,
      admin: args.admin,
      keeper: args.keeper,
      residualRecipient: args.residualRecipient,
      scoreRegistry: args.scoreRegistry,
      rankedEntry: args.rankedEntry,
      rules,
    },
    previous: manifest.retirePrevious ? previousRecord : null,
    previousEndAfterWeek,
    deployedAt: new Date((await provider.getBlock(receipt.blockNumber)).timestamp * 1000).toISOString(),
  });
  return { record, jackpotAddress, tokenAddress: tokenAddress.toLowerCase(), receipts: { token: tokenDeployTx, jackpot: receipt.hash } };
}

const toJson = (value) => JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? item.toString() : item), 2);

function printManifest(manifest, log) {
  log(`DRY RUN: deploy the Chikun Weekly Jackpot on chain ${manifest.chainId}. Nothing was signed or sent.`);
  log(`operator ${manifest.operator} (pending nonce ${manifest.operatorNonce.pending}, balance ${ethers.formatEther(manifest.operatorBalanceWei)} zkLTC)`);
  log(`current week ${manifest.currentWeek.key} (${manifest.currentWeek.index}); first week ${manifest.firstWeek.key} (${manifest.firstWeek.index}) from ${manifest.firstWeek.startsAt}`);
  if (manifest.token.deploy) {
    log(`1. TestChikunToken (tCHIKUN) at ${manifest.token.predictedAddress} (nonce ${manifest.token.nonce}); minter ${manifest.token.constructorArgs.minter}; gas ${manifest.token.gasEstimate}; creation eth_call ${manifest.token.creationCall?.ok ? `ok (${manifest.token.creationCall.runtimeBytes} B runtime)` : `FAILED ${manifest.token.creationCall?.error ?? ''}`}`);
  } else {
    log(`1. existing token ${manifest.token.address} (${manifest.token.symbol ?? '?'}, ${manifest.token.decimals ?? '?'} decimals): owner sign-off required on the ${TOKEN_ACCEPTANCE_CHECKLIST.length}-item token acceptance checklist (design §A.11)`);
  }
  const args = manifest.jackpot.constructorArgs;
  log(`2. WeeklyJackpot at ${manifest.jackpot.predictedAddress} (nonce ${manifest.jackpot.nonce}); gas ${manifest.jackpot.gasEstimate}; creation eth_call ${manifest.jackpot.creationCall?.ok ? `ok (${manifest.jackpot.creationCall.runtimeBytes} B runtime)` : `FAILED ${manifest.jackpot.creationCall?.error ?? ''}`}`);
  log(`   admin ${args.admin} · keeper ${args.keeper} · residual ${args.residualRecipient} · operator ${args.operator}`);
  log(`   rules: minPaidWei ${args.rules.minPaidWei}, minFundWei ${args.rules.minFundWei}, maxPrizeWei ${args.rules.maxPrizeWei}, maxSurvivalSeconds ${args.rules.maxSurvivalSeconds}, maxScore ${args.rules.maxScore}, adminClearOnly ${args.rules.adminClearOnly}, season ${args.rules.seasonId}`);
  if (manifest.retirePrevious) log(`   retires ${manifest.retirePrevious.address} (ends after ${manifest.retirePrevious.endAfterWeekKey})`);
  log(`total gas ${manifest.totalGasEstimate}${manifest.estimatedCostWei ? ` (about ${ethers.formatEther(manifest.estimatedCostWei)} zkLTC at the current fee)` : ''}`);
  for (const warning of manifest.warnings) log(`WARNING: ${warning}`);
  log(`To send: add --broadcast --confirm ${DEPLOY_JACKPOT_CONFIRM} and the operator key (--key-env <NAME> or --key-file <path> --key-field <field>).`);
}

// CLI body, injectable for tests. Returns an exit code.
export async function runDeployJackpotCli({
  argv = process.argv.slice(2),
  env = process.env,
  log = console.log,
  providerFactory = (url) => new ethers.JsonRpcProvider(url, JACKPOT_CHAIN_ID, { staticNetwork: true, cacheTimeout: -1 }),
  readFile = readText,
} = {}) {
  let options;
  try {
    options = parseDeployArgs(argv);
  } catch (error) {
    if (!(error instanceof DeployBlocked) && !(error instanceof SecretSourceError)) throw error;
    log(`Blocked: ${error.message}`);
    return 2;
  }
  const read = readFile;
  if (options.broadcast) {
    // Every guard before the key is read.
    if (options.confirm !== DEPLOY_JACKPOT_CONFIRM) {
      log(`Broadcast blocked: add --confirm ${DEPLOY_JACKPOT_CONFIRM} after the dry-run manifest is approved.`);
      return 2;
    }
    if (options.loopback && (options.recordPath === null || options.modulePath === null)) {
      log('Broadcast blocked: a loopback broadcast must name --record and --module, so the committed record and module are never overwritten with local-chain addresses.');
      return 2;
    }
  }
  const provider = providerFactory(options.rpc);
  try {
    const deployment = await loadLitvmDeployment(options.deploymentModule);
    const previousRecord = options.loopback && options.recordPath === null ? null : readJackpotRecord({ recordPath: options.recordPath });
    const manifest = await planJackpotDeploy({ provider, deployment, options, previousRecord, readFile: read });
    if (!options.broadcast) {
      if (options.json) log(toJson(manifest));
      else printManifest(manifest, log);
      return 0;
    }
    const key = readSecret({ env, argv, label: 'operator key' });
    const signer = new ethers.Wallet(key, provider);
    log(`Operator signer ${signer.address}.`);
    const result = await broadcastJackpotDeploy({ provider, signer, manifest, options, previousRecord, readFile: read, log });
    const written = writeJackpotRecord({ record: result.record, recordPath: options.recordPath });
    const module = writeLitvmJackpotModule({ record: result.record, outPath: options.modulePath });
    log(`Wrote ${options.recordPath ?? 'contracts/deployment-record.jackpot.json'} and ${options.modulePath ?? module.relativePath} (status '${module.status}').`);
    if (options.json) log(toJson({ jackpot: result.jackpotAddress, token: result.tokenAddress, receipts: result.receipts, record: written.path }));
    log('Next (runbook E5): block the role and test wallets from the owner page; JACKPOT_LIVE stays false.');
    return 0;
  } catch (error) {
    if (error instanceof DeployBlocked || error instanceof SecretSourceError) {
      log(`Blocked: ${error.message}`);
      return 2;
    }
    throw error;
  } finally {
    provider.destroy?.();
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMain) {
  try {
    process.exitCode = await runDeployJackpotCli();
  } catch (error) {
    console.error(`deploy-weekly-jackpot: ${error?.shortMessage ?? error?.message ?? error}`);
    process.exitCode = 1;
  }
}
