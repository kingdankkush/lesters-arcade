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
  ['AchievementRegistry.sol', ['is ERC721', 'error Soulbound', 'function mintFor', 'onlyMinter', 'function revoke', 'function locked', '0xb45a3c0e', 'event AchievementUnlocked', 'function tokenIdFor']],
  ['ArcadeRankedEntry.sol', ['function openSession', 'payable', 'nonReentrant', 'entryFeeWei', 'function isPaid', 'event RankedSessionOpened', 'event RevenueRouted', 'function setPlatformVaults', 'function setEntryFeeEnabled']],
  ['ScoreSubmissionRegistry.sol', ['function submitVerifiedSession', 'VERIFIED_RUN_TYPEHASH', 'is EIP712', 'ECDSA.recover', 'function attestationDigest', 'relayers', 'isPaid', 'mintFor', 'bestScore', 'bestSeasonScore', 'MAX_ACHIEVEMENTS_PER_SESSION = 32']],
  ['IGameRegistry.sol', ['function getGame', 'entryFeeWei']],
  ['IArcadeRankedEntry.sol', ['function isPaid']],
  ['IAchievementMinter.sol', ['function mintFor']],
]);

// Signals that must NOT be present in the live sources (old unverified / ERC-20 design).
const forbiddenSignals = new Map([
  ['GameRegistry.sol', ['entryFeeMicroUsdc']],
  ['ScoreSubmissionRegistry.sol', ['function submitSession(', 'entryFeeMicroUsdc', 'SECP256K1_HALF_ORDER']],
  ['AchievementRegistry.sol', ['function unlockFor', 'onlyLedger']],
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

console.log("Lester's Arcade contract structure check passed (2026-09 native-fee set).");
