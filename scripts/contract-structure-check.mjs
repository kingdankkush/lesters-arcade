import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const requiredContracts = [
  'contracts/src/PlayerProfileRegistry.sol',
  'contracts/src/GameRegistry.sol',
  'contracts/src/SessionLedger.sol',
  'contracts/src/AchievementRegistry.sol',
  'contracts/src/PaymentRouter.sol',
  'contracts/src/interfaces/IERC20.sol',
];

const requiredSignals = new Map([
  ['PlayerProfileRegistry.sol', ['event ProfileCreated', 'function registerProfile', 'mapping(address => Profile)']],
  ['GameRegistry.sol', ['event GameRegistered', 'function registerGame', 'devWallet', 'entryFeeMicroUsdc']],
  ['SessionLedger.sol', ['event SessionOpened', 'function openSession', 'DOMAIN_SEPARATOR']],
  ['AchievementRegistry.sol', ['event AchievementUnlocked', 'function unlockFor']],
  ['PaymentRouter.sol', ['event Split', 'function splitAndDisburse', 'IERC20']],
  ['IERC20.sol', ['function transfer', 'function transferFrom']],
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

  if (!content.includes('pragma solidity')) {
    throw new Error(`${contractName} missing Solidity pragma`);
  }
}

console.log('Lester\'s Arcade contract structure check passed.');
