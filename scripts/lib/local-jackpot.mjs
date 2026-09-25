// Local Chikun Weekly Jackpot on the in-process chain (design §A.18; jackpot-contracts slice).
//
// deployLocalJackpot() deploys TestChikunToken (or uses a given token, for example a mock) and a
// WeeklyJackpot that reads the local Ranked suite, AFTER deployLocalSuite() and without touching the parity
// region of tests/local-deploy-harness.test.mjs. It returns { jackpot, token, record, wallets }, where
// `record` has the shape of contracts/deployment-record.jackpot.json (design §A.18). A second deploy on the
// same chain (another token, `retirePrevious`) gives the rehearsal its R9 and retired[] paths.
//
// Fixture wallets: `keeper` and `player3` derive from the PUBLIC Hardhat test mnemonic at indexes 8 and 9
// (LOCAL_WALLET_ROLES, pinned by tests/local-deploy-harness.test.mjs, is unchanged) and are funded with
// hardhat_setBalance. The admin defaults to wallets.developer, as in production, where the admin wallet
// is also the Chikun developer wallet; the residual recipient defaults to the admin (design §H.1).
//
// Chain time: setChainTime() uses evm_setNextBlockTimestamp (+ evm_mine by default), never the wall clock.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ethers } from 'ethers';
import { HARDHAT_TEST_MNEMONIC, LOCAL_CHAIN_ID, LOCAL_WALLET_BALANCE_WEI, loadArtifact, localContracts } from './local-chain.mjs';
import {
  CHIKUN_SEASON_ID32,
  LAUNCH_MIN_PAID_WEI,
  buildJackpotRecord,
  launchRulesFor,
  normalizeJackpotRecord,
  normalizeRules,
  weekIndexOf,
} from '../generate-litvm-jackpot.mjs';

export {
  CHIKUN_GAME_ID32,
  CHIKUN_SEASON,
  CHIKUN_SEASON_ID32,
  weekBoundsOf,
  weekIndexOf,
  weekIndexOfKey,
  weekKeyOf,
  weekStartOf,
} from '../generate-litvm-jackpot.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));

export const JACKPOT_FIXTURE_INDEXES = Object.freeze({ keeper: 8, player3: 9 });
export const MOCK_TOKEN_NAMES = Object.freeze(['FeeOnTransferToken', 'BlacklistToken', 'ReentrantToken', 'MaxTxToken', 'SenderFeeToken', 'DoubleEntryToken', 'DoubleEntrySecondary', 'MockRankedReaders']);
export const JACKPOT_ARTIFACT_NAMES = Object.freeze(['WeeklyJackpot', 'TestChikunToken']);

let accountsNode = null;
// Private key of the Hardhat test mnemonic account at `index` (public fixture keys, never real).
export function fixtureKeyAt(index) {
  accountsNode ??= ethers.HDNodeWallet.fromMnemonic(ethers.Mnemonic.fromPhrase(HARDHAT_TEST_MNEMONIC), "m/44'/60'/0'/0");
  return accountsNode.deriveChild(index).privateKey;
}

// ethers queues every JSON-RPC request behind a setTimeout, and on Windows a timer fires on the ~15.6 ms
// system tick, so each call to the in-process chain costs ~15 ms instead of ~1 ms. This provider sends
// each request straight to the EIP-1193 node (same chain, same errors).
class DirectLocalProvider extends ethers.BrowserProvider {
  #nextId = 1;

  constructor(eip1193) {
    super(eip1193, LOCAL_CHAIN_ID, { staticNetwork: true, cacheTimeout: -1, pollingInterval: 20 });
  }

  async send(method, params = []) {
    const payload = { method, params, id: this.#nextId++, jsonrpc: '2.0' };
    const [response] = await this._send(payload);
    if ('error' in response) throw this.getRpcError(payload, response);
    return response.result;
  }
}

// A fast ethers provider over the same in-process chain (see DirectLocalProvider). Long Hardhat test
// files use it to stay under 60 s; reconnect signers with reconnectWallets() or wallet.connect(it).
export function fastLocalProvider(chain) {
  return new DirectLocalProvider(chain.eip1193);
}

// Every wallet of `wallets` connected to `provider` (same keys).
export function reconnectWallets(wallets, provider) {
  return Object.freeze(Object.fromEntries(Object.entries(wallets).map(([role, wallet]) => [role, wallet.connect(provider)])));
}

let jackpotKeys = null;
export function jackpotFixtureKeys() {
  jackpotKeys ??= Object.freeze(Object.fromEntries(Object.entries(JACKPOT_FIXTURE_INDEXES).map(([role, index]) => [role, fixtureKeyAt(index)])));
  return jackpotKeys;
}

function rpc(target) {
  if (typeof target?.send === 'function') return (method, params = []) => target.send(method, params);
  if (typeof target?.request === 'function') return (method, params = []) => target.request(method, params);
  throw new Error('need a local chain (startLocalChain()) or an ethers provider');
}

// A funded wallet derived from the Hardhat mnemonic at `index` (for extra players, decoys, funders).
export async function derivedFixtureWallet(provider, index, { balanceWei = LOCAL_WALLET_BALANCE_WEI } = {}) {
  const wallet = new ethers.Wallet(fixtureKeyAt(index), provider);
  await rpc(provider)('hardhat_setBalance', [wallet.address, ethers.toQuantity(BigInt(balanceWei))]);
  return wallet;
}

// The named jackpot fixture wallets { keeper, player3 }, funded.
export async function jackpotFixtureWallets(provider, { balanceWei = LOCAL_WALLET_BALANCE_WEI } = {}) {
  const wallets = {};
  for (const [role, index] of Object.entries(JACKPOT_FIXTURE_INDEXES)) {
    // eslint-disable-next-line no-await-in-loop
    wallets[role] = await derivedFixtureWallet(provider, index, { balanceWei });
  }
  return Object.freeze(wallets);
}

// Design §A.5 recommended launch rules. With a local suite record, minPaidWei is Chikun's flat entry fee
// from the record (0.1 zkLTC in contracts/deploy-config.testnet.json), never fee + reserve (J17).
export function launchRules(record = null, { fromWeek = 0 } = {}) {
  const chikun = record?.games?.find?.((game) => game.slug === 'chikun');
  return launchRulesFor({ fromWeek, minPaidWei: chikun?.entryFeeWei !== undefined ? BigInt(chikun.entryFeeWei) : LAUNCH_MIN_PAID_WEI });
}

// Sets the chain clock: the next block gets exactly `isoOrSeconds` (ISO string, unix seconds, or a Date).
// With mine (default) that block is mined now, so views read the new time; without it, the next
// transaction lands in a block with exactly that timestamp.
export async function setChainTime(chain, isoOrSeconds, { mine = true } = {}) {
  let seconds;
  if (isoOrSeconds instanceof Date) seconds = Math.floor(isoOrSeconds.getTime() / 1000);
  else if (typeof isoOrSeconds === 'string' && !/^\d+$/.test(isoOrSeconds)) seconds = Math.floor(Date.parse(isoOrSeconds) / 1000);
  else seconds = Number(isoOrSeconds);
  if (!Number.isSafeInteger(seconds) || seconds <= 0) throw new Error(`setChainTime: not a time: ${isoOrSeconds}`);
  const send = rpc(chain);
  await send('evm_setNextBlockTimestamp', [seconds]);
  if (mine) await send('evm_mine', []);
  return seconds;
}

// The latest block timestamp (seconds).
export async function chainTime(chainOrProvider) {
  const provider = chainOrProvider.provider && !chainOrProvider.getBlock ? chainOrProvider.provider : chainOrProvider;
  return (await provider.getBlock('latest')).timestamp;
}

let mockCache = null;
// ABI + bytecode of a committed test mock (tests/fixtures/contract-mocks, `compile-contracts.mjs --mocks`).
export function loadMockArtifact(name) {
  if (!MOCK_TOKEN_NAMES.includes(name)) throw new Error(`unknown mock ${name}`);
  mockCache ??= new Map();
  if (!mockCache.has(name)) {
    const artifact = JSON.parse(readFileSync(join(root, 'tests', 'fixtures', 'contract-mocks', `${name}.json`), 'utf8'));
    mockCache.set(name, Object.freeze({ abi: artifact.abi, bytecode: `0x${artifact.evm.bytecode.object}` }));
  }
  return mockCache.get(name);
}

// Deploys a mock token (for example 'BlacklistToken') from `signer`.
export async function deployMockToken(name, args, signer) {
  const artifact = loadMockArtifact(name);
  const contract = await new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer).deploy(...args);
  await contract.waitForDeployment();
  return contract;
}

// The WeeklyJackpot contract at `address`, connected to `runner`.
export function jackpotAt(address, runner) {
  return new ethers.Contract(address, loadArtifact('WeeklyJackpot').abi, runner);
}

// An ERC-20 (the TestChikunToken ABI, which is a superset of IERC20 + metadata) at `address`.
export function tokenAt(address, runner) {
  return new ethers.Contract(address, loadArtifact('TestChikunToken').abi, runner);
}

async function deployArtifact(name, args, signer) {
  const artifact = loadArtifact(name);
  const contract = await new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer).deploy(...args);
  await contract.waitForDeployment();
  return contract;
}

// Deploys the jackpot (and tCHIKUN unless `token` is given) onto the in-process chain, after
// deployLocalSuite(). `record` is the local Ranked suite record. `retirePrevious` is a previous jackpot
// record whose instance has a scheduled end: it moves into retired[] and firstWeek must be after its end.
export async function deployLocalJackpot({
  provider,
  wallets,
  record,
  firstWeek = null,
  rules = null,
  token = null,
  residualRecipient = null,
  keeper = null,
  admin = null,
  tokenTestnet = true,
  retirePrevious = null,
  game = 'chikun',
} = {}) {
  if (!provider || !wallets?.operator) throw new Error('deployLocalJackpot needs { provider, wallets.operator }');
  if (!record?.addresses?.scoreSubmissionRegistry || !record?.addresses?.arcadeRankedEntry) throw new Error('deployLocalJackpot needs the local suite record (deployLocalSuite)');
  const signer = wallets.operator.provider ? wallets.operator : wallets.operator.connect(provider);
  const operator = await signer.getAddress();
  const fixtures = await jackpotFixtureWallets(provider);
  const gameId = record.games?.find?.((entry) => entry.slug === game)?.gameId ?? ethers.id(game);
  const latest = await provider.getBlock('latest');
  const current = weekIndexOf(latest.timestamp);
  const first = Number(firstWeek ?? current + 1);

  let previousEndAfterWeek = null;
  if (retirePrevious) {
    const previous = normalizeJackpotRecord(retirePrevious).instances.chikun;
    previousEndAfterWeek = Number(await jackpotAt(previous.address, provider).endAfterWeek());
    if (previousEndAfterWeek === 0) throw new Error('retirePrevious: the previous instance has no scheduled end');
    if (first <= previousEndAfterWeek) throw new Error(`retirePrevious: firstWeek ${first} must be after the previous endAfterWeek ${previousEndAfterWeek}`);
  }

  const initialRules = normalizeRules(rules ?? launchRules(record), { fromWeek: first });
  const adminAddress = ethers.getAddress(admin ?? wallets.developer?.address ?? operator);
  const keeperAddress = keeper === false ? ethers.ZeroAddress : ethers.getAddress(keeper ?? fixtures.keeper.address);
  const residualAddress = ethers.getAddress(residualRecipient ?? adminAddress);

  let tokenContract;
  let tokenDeployTx = null;
  if (token) {
    tokenContract = tokenAt(typeof token === 'string' ? token : await token.getAddress(), signer);
  } else {
    tokenContract = await deployArtifact('TestChikunToken', [operator], signer);
    tokenDeployTx = tokenContract.deploymentTransaction().hash;
  }
  const tokenAddress = await tokenContract.getAddress();
  const jackpot = await deployArtifact('WeeklyJackpot', [
    gameId,
    tokenAddress,
    record.addresses.scoreSubmissionRegistry,
    record.addresses.arcadeRankedEntry,
    first,
    operator,
    adminAddress,
    keeperAddress,
    residualAddress,
    initialRules,
  ], signer);
  const receipt = await jackpot.deploymentTransaction().wait();
  const readToken = tokenAt(tokenAddress, provider);
  const instance = {
    game,
    gameId,
    address: await jackpot.getAddress(),
    token: {
      address: tokenAddress,
      name: await readToken.name(),
      symbol: await readToken.symbol(),
      decimals: Number(await readToken.decimals()),
      testnet: tokenTestnet,
      deployTx: tokenDeployTx,
    },
    startBlock: receipt.blockNumber,
    deployTx: receipt.hash,
    firstWeek: first,
    operator,
    admin: adminAddress,
    keeper: keeperAddress === ethers.ZeroAddress ? null : keeperAddress,
    residualRecipient: residualAddress,
    scoreRegistry: record.addresses.scoreSubmissionRegistry,
    rankedEntry: record.addresses.arcadeRankedEntry,
    rules: initialRules,
  };
  const jackpotRecord = buildJackpotRecord({
    instance,
    previous: retirePrevious,
    previousEndAfterWeek,
    deployedAt: new Date(latest.timestamp * 1000).toISOString(),
    network: 'LitVM LiteForge (local in-process chain)',
  });
  return { jackpot, token: tokenContract, record: jackpotRecord, wallets: Object.freeze({ ...wallets, ...fixtures }) };
}

function gameIdOf(record, game) {
  return record.games?.find?.((entry) => entry.slug === game)?.gameId ?? ethers.id(game);
}

// Opens a paid Ranked session from `player` (at exactly `openAt` when given) and returns its block time.
export async function openLocalSession({ provider, record, player, sessionId, game = 'chikun', openAt = null, amountWei = null }) {
  const gameId = gameIdOf(record, game);
  const { rankedEntry } = localContracts(record, provider);
  const value = amountWei ?? (await rankedEntry.quoteEntry(gameId)).totalWei;
  if (openAt !== null) await setChainTime(provider, openAt, { mine: false });
  const receipt = await (await rankedEntry.connect(player).openSession(sessionId, gameId, { value })).wait();
  return (await provider.getBlock(receipt.blockNumber)).timestamp;
}

// A verifier-signed VerifiedRun for `sessionId` (what the settle path relays), without sending it.
export async function attestLocalRun({
  provider,
  record,
  player,
  verifierKey,
  sessionId,
  score = 1000n,
  survivalSeconds = 120n,
  seasonId = CHIKUN_SEASON_ID32,
  runtimeId = ethers.id('chikun:canvas-runtime-v7'),
  game = 'chikun',
  deadline = null,
}) {
  const { scores } = localContracts(record, provider);
  const run = {
    sessionId,
    gameId: gameIdOf(record, game),
    player: await player.getAddress(),
    score: BigInt(score),
    kills: 0n,
    maxCombo: 0n,
    survivalSeconds: BigInt(survivalSeconds),
    bossId: ethers.ZeroHash,
    envelopeHash: ethers.id(`envelope:${sessionId}`),
    runtimeId,
    seasonId,
    deadline: BigInt(deadline ?? 2 ** 40),
    achievementsHash: ethers.keccak256('0x'),
  };
  const signature = new ethers.SigningKey(verifierKey).sign(await scores.attestationDigest(run)).serialized;
  return { run, signature };
}

// Opens a paid Ranked session and settles a verifier-attested run for it on the local suite, the way the
// server's settle path does (the relayer submits). Chain times are optional: `openAt` / `settleAt` put the
// openSession / submitVerifiedSession transactions at exactly those timestamps. `open: false` settles
// without a paid session (only possible while the game's entry fee is 0). Returns the facts the jackpot
// reads: { sessionId, player, openedAt, submittedAt }.
export async function settleLocalRun({
  provider,
  record,
  player,
  relayer,
  verifierKey,
  sessionId = ethers.hexlify(ethers.randomBytes(32)),
  game = 'chikun',
  openAt = null,
  settleAt = null,
  amountWei = null,
  open = true,
  ...runFields
} = {}) {
  const openedAt = open ? await openLocalSession({ provider, record, player, sessionId, game, openAt, amountWei }) : null;
  const { run, signature } = await attestLocalRun({ provider, record, player, verifierKey, sessionId, game, ...runFields });
  if (settleAt !== null) await setChainTime(provider, settleAt, { mine: false });
  const { scores } = localContracts(record, provider);
  const receipt = await (await scores.connect(relayer).submitVerifiedSession(run, [], signature)).wait();
  const submittedAt = (await provider.getBlock(receipt.blockNumber)).timestamp;
  return { sessionId, player: run.player, openedAt, submittedAt };
}
