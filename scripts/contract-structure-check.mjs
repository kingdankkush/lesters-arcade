import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const requiredContracts = [
  'contracts/src/PlayerProfileRegistry.sol',
  'contracts/src/GameRegistry.sol',
  'contracts/src/ArcadePaymentRouter.sol',
  'contracts/src/ScoreSubmissionRegistry.sol',
  'contracts/src/AchievementRegistry.sol',
  'contracts/src/TournamentPool.sol',
  'contracts/src/LestersArcadeCore.sol',
];

const requiredSignals = new Map([
  ['PlayerProfileRegistry.sol', ['event ProfileCreated', 'function createProfile', 'mapping(address => PlayerProfile)']],
  ['GameRegistry.sol', ['event GameRegistered', 'function registerGame', 'revenueSplitBps']],
  ['ArcadePaymentRouter.sol', ['event PaidSessionStarted', 'function startPaidSession', 'IERC20Like']],
  ['ScoreSubmissionRegistry.sol', ['event ScoreSubmitted', 'function submitScore', 'trustedVerifier']],
  ['AchievementRegistry.sol', ['event AchievementUnlocked', 'function unlockAchievement']],
  ['TournamentPool.sol', ['event TournamentCreated', 'function createTournament']],
  ['LestersArcadeCore.sol', ['contract LestersArcadeCore', 'PlayerProfileRegistry', 'ArcadePaymentRouter']],
]);

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

  if (!content.includes('// SPDX-License-Identifier: MIT')) {
    throw new Error(`${contractName} missing SPDX license`);
  }

  if (!content.includes('pragma solidity ^0.8.24;')) {
    throw new Error(`${contractName} missing Solidity pragma`);
  }
}

console.log('Lester\'s Arcade contract structure check passed.');
