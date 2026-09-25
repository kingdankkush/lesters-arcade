import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Pins the 2026-09-16 native-fee / EIP-712 / soulbound contract set. The June 2026 ERC-20 design is
// archived under contracts/archive/2026-06-legacy and must never reappear under contracts/src.
const root = fileURLToPath(new URL('..', import.meta.url));
const requiredContracts = [
  'contracts/src/PlayerProfileRegistry.sol',
  'contracts/src/GameRegistry.sol',
  'contracts/src/AchievementRegistry.sol',
  'contracts/src/ArcadeRankedEntry.sol',
  'contracts/src/ScoreSubmissionRegistry.sol',
  'contracts/src/interfaces/IGameRegistry.sol',
  'contracts/src/interfaces/IArcadeRankedEntry.sol',
  'contracts/src/interfaces/IAchievementMinter.sol',
];

const requiredSignals = new Map([
  ['PlayerProfileRegistry.sol', ['event ProfileCreated', 'function registerProfile', 'mapping(address => Profile)']],
  ['GameRegistry.sol', ['event GameRegistered', 'function registerGame', 'devWallet', 'entryFeeWei', 'function setEntryFee', 'event EntryFeeUpdated', 'function acceptOperator']],
  // One soulbound collection per game: name/symbol are constructor args, not hard-coded.
  ['AchievementRegistry.sol', ['is ERC721', 'error Soulbound', 'function mintFor', 'onlyMinter', 'function revoke', 'function locked', '0xb45a3c0e', 'event AchievementUnlocked', 'function tokenIdFor', 'string memory name_, string memory symbol_', 'ERC721(name_, symbol_)']],
  // Fee = flat entryFeeWei + operator-set settlementGasReserveWei (forwarded to relayerVault), exact msg.value.
  ['ArcadeRankedEntry.sol', ['function openSession', 'payable', 'nonReentrant', 'entryFeeWei', 'function isPaid', 'event RankedSessionOpened', 'event RevenueRouted', 'function setPlatformVaults', 'function setEntryFeeEnabled', 'uint256 public settlementGasReserveWei', 'address public relayerVault', 'function setSettlementGasReserve(uint256', 'function setRelayerVault(address', 'event SettlementGasReserveUpdated', 'event RelayerVaultUpdated', 'event SettlementReserveForwarded', 'msg.value == game.entryFeeWei + reserveWei', 'function quoteEntry(bytes32 gameId)']],
  // Per-game achievement routing + relayer allow-list (public getter relayers(address)).
  ['ScoreSubmissionRegistry.sol', ['function submitVerifiedSession', 'VERIFIED_RUN_TYPEHASH', 'is EIP712', 'ECDSA.recover', 'function attestationDigest', 'mapping(address => bool) public relayers', 'isPaid', 'mintFor', 'bestScore', 'bestSeasonScore', 'MAX_ACHIEVEMENTS_PER_SESSION = 32', 'mapping(bytes32 => address) public achievementRegistryByGame', 'function setAchievementRegistry(bytes32 gameId, address', 'achievementRegistryByGame[gameId]']],
  ['IGameRegistry.sol', ['function getGame', 'entryFeeWei']],
  ['IArcadeRankedEntry.sol', ['function isPaid']],
  ['IAchievementMinter.sol', ['function mintFor']],
]);

// Signals that must NOT be present in the live sources (old unverified / ERC-20 design).
const forbiddenSignals = new Map([
  ['GameRegistry.sol', ['entryFeeMicroUsdc']],
  ['ScoreSubmissionRegistry.sol', ['function submitSession(', 'entryFeeMicroUsdc', 'SECP256K1_HALF_ORDER', 'address public achievementRegistry;', 'function setAchievementRegistry(address']],
  ['AchievementRegistry.sol', ['function unlockFor', 'onlyLedger', 'ERC721("Lester\'s Arcade Achievements"']],
  ['ArcadeRankedEntry.sol', ['msg.value == game.entryFeeWei,']],
]);

const archivedLegacyFiles = [
  'ArcadePaymentRouter.sol',
  'PaymentRouter.sol',
  'SessionLedger.sol',
  'TournamentPool.sol',
  'interfaces/IERC20.sol',
];

for (const relative of requiredContracts) {
  const filePath = join(root, relative);
  const content = readFileSync(filePath, 'utf8');
  const contractName = relative.split('/').at(-1);
  const signals = requiredSignals.get(contractName) ?? [];

  for (const signal of signals) {
    if (!content.includes(signal)) {
      throw new Error(`${contractName} is missing required signal: ${signal}`);
    }
  }
  for (const signal of forbiddenSignals.get(contractName) ?? []) {
    if (content.includes(signal)) {
      throw new Error(`${contractName} still contains retired signal: ${signal}`);
    }
  }

  if (!content.includes('// SPDX-License-Identifier: MIT')) {
    throw new Error(`${contractName} missing SPDX license`);
  }

  if (!content.includes('pragma solidity')) {
    throw new Error(`${contractName} missing Solidity pragma`);
  }
}

for (const legacy of archivedLegacyFiles) {
  const livePath = join(root, 'contracts/src', legacy);
  if (existsSync(livePath)) {
    throw new Error(`Legacy June 2026 contract must not live under contracts/src: ${legacy}`);
  }
  const archivedPath = join(root, 'contracts/archive/2026-06-legacy', legacy);
  if (!existsSync(archivedPath)) {
    throw new Error(`Archived legacy contract missing: contracts/archive/2026-06-legacy/${legacy}`);
  }
}

if (!existsSync(join(root, 'contracts/archive/2026-06-legacy/README.md'))) {
  throw new Error('contracts/archive/2026-06-legacy/README.md is required to document the archived design.');
}

// Chikun Weekly Jackpot (design docs/game-design/chikun-weekly-jackpot-design-20260924.md §A). A new contract
// that only READS the deployed 1.8.x registries; checked in its own block so the lists above stay as they are.
const jackpotSignals = new Map([
  ['contracts/src/WeeklyJackpot.sol', [
    'is ReentrancyGuard', 'using SafeERC20 for IERC20', 'IERC20 public immutable token', 'uint64 public immutable firstWeek',
    'function submitCandidate', 'function checkEligibility', 'function finalize', 'trySafeTransfer', 'nonReentrant',
    'function claim', 'function recycleUnclaimed', 'function refundAfterEnd', 'function recoverResidual', 'function sweepStray',
    'residualRecipient', 'function nominateResidualRecipient', 'function acceptResidualRecipient', '"LIABILITIES_BREACHED"',
    'mapping(address => bool) public staffEver', 'mapping(bytes32 => bool) public adminReviewed', 'mapping(bytes32 => bool) public wasListed',
    'function forceAdmin', 'function operatorPause', '"OPERATOR_LOCK"', 'function adminSubmit', 'function reinstate',
    'function scheduleRules', 'function rulesFor', 'RELIST_MARGIN = 2 hours', 'MAX_FUND_AHEAD_WEEKS = 8', 'MAX_PENDING_EPOCHS = 8',
    '"Only platform operator"', '"Only pending operator"',
  ]],
  ['contracts/src/TestChikunToken.sol', ['is ERC20', 'ERC20("Lester\'s Arcade Test CHIKUN (no value)", "tCHIKUN")', 'function mint', 'onlyMinter', '10_000_000e18', 'function transferMinter', 'function acceptMinter']],
  ['contracts/src/interfaces/IRankedReaders.sol', ['interface IRankedScoreReader', 'interface IRankedEntryReader', 'function getSession(bytes32', 'function getPaidSession(bytes32']],
]);
const jackpotForbidden = ['selfdestruct', 'delegatecall', 'receive()', 'fallback()', 'payable', 'function setToken'];

for (const [relative, signals] of jackpotSignals) {
  const content = readFileSync(join(root, relative), 'utf8');
  for (const signal of signals) {
    if (!content.includes(signal)) throw new Error(`${relative} is missing required signal: ${signal}`);
  }
  if (!content.includes('// SPDX-License-Identifier: MIT') || !content.includes('pragma solidity ^0.8.24;')) {
    throw new Error(`${relative} needs the MIT SPDX line and pragma solidity ^0.8.24`);
  }
}
const jackpotSource = readFileSync(join(root, 'contracts/src/WeeklyJackpot.sol'), 'utf8').replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '');
for (const signal of jackpotForbidden) {
  if (jackpotSource.includes(signal)) throw new Error(`WeeklyJackpot.sol must not contain ${signal} (no native value, no upgrade path, immutable token)`);
}
// Design §A.12: each of these nine carries nonReentrant in its own header (one signal for the file is not enough).
export const JACKPOT_NON_REENTRANT = Object.freeze(['fund', 'submitCandidate', 'adminSubmit', 'finalize', 'claim', 'recycleUnclaimed', 'refundAfterEnd', 'recoverResidual', 'sweepStray']);
export function jackpotReentrancyProblems(source) {
  const problems = [];
  for (const name of JACKPOT_NON_REENTRANT) {
    const header = new RegExp(`function ${name}\\([^)]*\\)([^{;]*)\\{`).exec(source);
    if (!header) problems.push(`function ${name} is missing`);
    else if (!/\bexternal\b/.test(header[1]) || !/\bnonReentrant\b/.test(header[1])) problems.push(`function ${name} must be external nonReentrant (design §A.12)`);
  }
  return problems;
}
const reentrancyProblems = jackpotReentrancyProblems(jackpotSource);
if (reentrancyProblems.length) throw new Error(`WeeklyJackpot.sol: ${reentrancyProblems.join('; ')}`);

// The read interfaces repeat the deployed struct field orders exactly (the calls are ABI-decoded).
function structFields(source, name) {
  const match = new RegExp(`struct ${name} \{([^}]*)\}`).exec(source);
  if (!match) throw new Error(`struct ${name} not found`);
  return match[1].split(';').map((field) => field.replace(/\/\/[^\n]*/g, '').trim().replace(/\s+/g, ' ')).filter(Boolean);
}
const readers = readFileSync(join(root, 'contracts/src/interfaces/IRankedReaders.sol'), 'utf8');
for (const [name, deployedFile] of [['ScoreRecord', 'ScoreSubmissionRegistry.sol'], ['PaidSession', 'ArcadeRankedEntry.sol']]) {
  const deployed = structFields(readFileSync(join(root, 'contracts/src', deployedFile), 'utf8'), name);
  if (JSON.stringify(structFields(readers, name)) !== JSON.stringify(deployed)) {
    throw new Error(`IRankedReaders.sol ${name} must repeat the field order of ${deployedFile} exactly`);
  }
}
// Test-only mocks never live under contracts/src.
for (const mock of ['FeeOnTransferToken.sol', 'BlacklistToken.sol', 'ReentrantToken.sol', 'MaxTxToken.sol', 'SenderFeeToken.sol', 'DoubleEntryToken.sol', 'MockRankedReaders.sol', 'MetadataToken.sol']) {
  if (existsSync(join(root, 'contracts/src', mock))) throw new Error(`Test mock ${mock} must stay under contracts/test/mocks`);
}

console.log("Lester's Arcade contract structure check passed (2026-09 native-fee set).");
