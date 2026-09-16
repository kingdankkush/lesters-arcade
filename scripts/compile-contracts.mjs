import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import solc from 'solc';

const root = fileURLToPath(new URL('..', import.meta.url));
// 2026-09-16 native-fee / EIP-712 / soulbound contract set. The June 2026 ERC-20 design lives in
// contracts/archive/2026-06-legacy and is intentionally NOT compiled.
const contractFiles = [
  'contracts/src/PlayerProfileRegistry.sol',
  'contracts/src/GameRegistry.sol',
  'contracts/src/ArcadeRankedEntry.sol',
  'contracts/src/AchievementRegistry.sol',
  'contracts/src/ScoreSubmissionRegistry.sol',
  'contracts/src/LestersArcadeCore.sol',
  'contracts/src/interfaces/IGameRegistry.sol',
  'contracts/src/interfaces/IArcadeRankedEntry.sol',
  'contracts/src/interfaces/IAchievementMinter.sol',
];

const sources = Object.fromEntries(
  contractFiles.map((relativePath) => [
    relativePath,
    { content: readFileSync(join(root, relativePath), 'utf8') },
  ]),
);

const input = {
  language: 'Solidity',
  sources,
  settings: {
    optimizer: {
      enabled: true,
      runs: 200,
    },
    outputSelection: {
      '*': {
        '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'],
      },
    },
  },
};

function findImports(importPath) {
  const normalized = importPath.startsWith('./') ? importPath.slice(2) : importPath;
  const candidates = importPath.startsWith('@openzeppelin/')
    ? [join(root, 'node_modules', importPath)]
    : [join(root, 'contracts/src', normalized), join(root, 'node_modules', importPath)];

  for (const candidate of candidates) {
    try {
      return { contents: readFileSync(candidate, 'utf8') };
    } catch {
      // Try the next import candidate.
    }
  }

  return { error: `Import not found: ${importPath}` };
}

const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
const errors = output.errors ?? [];
const blockingErrors = errors.filter((entry) => entry.severity === 'error');

for (const entry of errors) {
  const prefix = entry.severity === 'error' ? 'ERROR' : 'WARN';
  console.log(`${prefix}: ${entry.formattedMessage.trim()}`);
}

if (blockingErrors.length > 0) {
  process.exitCode = 1;
  throw new Error(`Solidity compile failed with ${blockingErrors.length} error(s).`);
}

const artifactDir = join(root, 'contracts/artifacts');
mkdirSync(artifactDir, { recursive: true });

let artifactCount = 0;
const summary = [];
for (const [sourcePath, contracts] of Object.entries(output.contracts ?? {})) {
  // Only persist artifacts for our own sources; OpenZeppelin dependencies are compiled in but not emitted.
  if (!sourcePath.startsWith('contracts/src/')) continue;
  for (const [contractName, artifact] of Object.entries(contracts)) {
    const target = join(artifactDir, `${contractName}.json`);
    writeFileSync(target, JSON.stringify({ sourcePath, contractName, ...artifact }, null, 2));
    artifactCount += 1;
    const bytecodeBytes = (artifact.evm?.bytecode?.object ?? '').length / 2;
    const deployedBytes = (artifact.evm?.deployedBytecode?.object ?? '').length / 2;
    summary.push({ contractName, sourcePath, initCodeBytes: bytecodeBytes, runtimeBytes: deployedBytes });
  }
}

for (const row of summary) {
  const kind = row.initCodeBytes === 0 ? 'interface/abstract' : `init ${row.initCodeBytes} B, runtime ${row.runtimeBytes} B`;
  console.log(`  ${row.contractName.padEnd(26)} ${kind}`);
}
console.log(`Compiled ${artifactCount} Lester's Arcade contract artifact(s).`);
