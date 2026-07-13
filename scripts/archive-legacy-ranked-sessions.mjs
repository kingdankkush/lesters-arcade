import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ethers } from 'ethers';

const root = fileURLToPath(new URL('..', import.meta.url));
const config = JSON.parse(readFileSync(path.join(root, 'contracts', 'deploy-config.testnet.json'), 'utf8'));
const address = config.oldDeployment.scoreSubmissionRegistry;
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || config.rpcUrl, config.chainId);
const network = await provider.getNetwork();
if (Number(network.chainId) !== config.chainId) throw new Error(`Wrong chain ${network.chainId}`);

const abi = [
  'function totalSessions() view returns (uint256)',
  'function getRecentSessions(uint256 offset,uint256 limit) view returns ((bytes32 sessionId,address player,bytes32 gameId,uint256 score,uint64 kills,uint64 maxCombo,uint64 survivalSeconds,bytes32 bossId,uint64 submittedAt,bool exists)[])',
];
const contract = new ethers.Contract(address, abi, provider);
const total = Number(await contract.totalSessions());
if (total !== config.oldDeployment.expectedScoreRows) throw new Error(`Expected ${config.oldDeployment.expectedScoreRows} rows; RPC returned ${total}`);
const rows = await contract.getRecentSessions(0, total);
const blockNumber = await provider.getBlockNumber();
const records = rows.map((row) => ({
  sessionId: row.sessionId,
  player: row.player.toLowerCase(),
  gameId: row.gameId,
  score: row.score.toString(),
  kills: Number(row.kills),
  maxCombo: Number(row.maxCombo),
  survivalSeconds: Number(row.survivalSeconds),
  bossId: row.bossId,
  submittedAt: Number(row.submittedAt),
  exists: Boolean(row.exists),
  provenance: 'legacy-unverified-testnet-beta',
}));
const archive = {
  schemaVersion: 1,
  network: config.network,
  chainId: config.chainId,
  contractAddress: address,
  retrievalBlock: blockNumber,
  rpcClass: 'public LitVM LiteForge RPC',
  recordCount: records.length,
  disposition: 'archived read-only; not eligible for verified leaderboard migration',
  records,
};
const canonical = `${JSON.stringify(archive, null, 2)}\n`;
const output = {
  ...archive,
  sha256: createHash('sha256').update(canonical).digest('hex'),
};
const dir = path.join(root, 'docs', 'web3', 'archives');
mkdirSync(dir, { recursive: true });
const outPath = path.join(dir, 'litvm-score-registry-2026-06-22-legacy-13.json');
writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Archived ${records.length} legacy rows at block ${blockNumber}: ${outPath}`);
console.log(`SHA-256: ${output.sha256}`);
