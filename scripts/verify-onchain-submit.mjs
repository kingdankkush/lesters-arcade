// Lester's Arcade — post-deploy on-chain smoke test.
//
// Submits a REAL ranked session to the freshly deployed ScoreSubmissionRegistry
// from your wallet (pays a tiny amount of zkLTC gas), then reads it back via the
// public RPC to prove the full player-signed write -> read pipeline works.
//
// Usage (after npm run contracts:deploy):
//   DEPLOYER_PRIVATE_KEY=0x... node scripts/verify-onchain-submit.mjs
//
// Reads the deployed address from contracts/deployment-record.json.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ethers } from 'ethers';

const root = fileURLToPath(new URL('..', import.meta.url));
const RPC_URL = process.env.RPC_URL || 'https://liteforge.rpc.caldera.xyz/http';
const CHAIN_ID = 4441;
const KEY = process.env.DEPLOYER_PRIVATE_KEY;

if (!KEY) {
  console.error('ERROR: DEPLOYER_PRIVATE_KEY env var is required.');
  process.exit(1);
}

const record = JSON.parse(readFileSync(join(root, 'contracts', 'deployment-record.json'), 'utf8'));
const SCORE = record.addresses.scoreSubmissionRegistry;
console.log('ScoreSubmissionRegistry:', SCORE);

const ABI = [
  'function submitSession(bytes32 sessionId, bytes32 gameId, uint256 score, uint64 kills, uint64 maxCombo, uint64 survivalSeconds, bytes32 bossId, bytes32[] achievements) external',
  'function totalSessions() external view returns (uint256)',
  'function getSession(bytes32 sessionId) external view returns (tuple(bytes32 sessionId, address player, bytes32 gameId, uint256 score, uint64 kills, uint64 maxCombo, uint64 survivalSeconds, bytes32 bossId, uint64 submittedAt, bool exists))',
  'function getPlayerSessions(address player, uint256 offset, uint256 limit) external view returns (tuple(bytes32 sessionId, address player, bytes32 gameId, uint256 score, uint64 kills, uint64 maxCombo, uint64 survivalSeconds, bytes32 bossId, uint64 submittedAt, bool exists)[])',
];

const provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID);
const wallet = new ethers.Wallet(KEY, provider);
const contract = new ethers.Contract(SCORE, ABI, wallet);

const sessionId = ethers.id('verify-' + Date.now());
const gameId = ethers.id('lester-blaster');

console.log('Submitting test session as', wallet.address, '...');
const tx = await contract.submitSession(sessionId, gameId, 13370n, 42n, 9n, 318n, ethers.ZeroHash, [ethers.id('first-blood')]);
console.log('  tx:', tx.hash);
const receipt = await tx.wait();
console.log('  mined in block', receipt.blockNumber, '| gas used', receipt.gasUsed.toString());

const total = await contract.totalSessions();
console.log('totalSessions now:', total.toString());

const rec = await contract.getSession(sessionId);
console.log('read-back session: score=%s kills=%s maxCombo=%s survival=%s exists=%s',
  rec.score.toString(), rec.kills.toString(), rec.maxCombo.toString(), rec.survivalSeconds.toString(), rec.exists);

const mine = await contract.getPlayerSessions(wallet.address, 0, 10);
console.log('player session count (first page):', mine.length);

if (rec.exists && rec.score === 13370n) {
  console.log('\n✓ PIPELINE VERIFIED: player-signed write + read-back works on LitVM.');
  console.log('  Explorer:', `https://liteforge.explorer.caldera.xyz/tx/${tx.hash}`);
} else {
  console.error('\n✗ Read-back mismatch — investigate.');
  process.exit(1);
}
