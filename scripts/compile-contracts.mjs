import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import solc from 'solc';

const root = fileURLToPath(new URL('..', import.meta.url));
const contractFiles = [
  'contracts/src/PlayerProfileRegistry.sol',
  'contracts/src/GameRegistry.sol',
  'contracts/src/ArcadePaymentRouter.sol',
  'contracts/src/ScoreSubmissionRegistry.sol',
  'contracts/src/SessionLedger.sol',
  'contracts/src/PaymentRouter.sol',
  'contracts/src/AchievementRegistry.sol',
  'contracts/src/TournamentPool.sol',
  'contracts/src/LestersArcadeCore.sol',
  'contracts/src/interfaces/IERC20.sol',
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
        '*': ['abi', 'evm.bytecode.object'],
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
for (const [sourcePath, contracts] of Object.entries(output.contracts ?? {})) {
  for (const [contractName, artifact] of Object.entries(contracts)) {
    const target = join(artifactDir, `${contractName}.json`);
    writeFileSync(target, JSON.stringify({ sourcePath, contractName, ...artifact }, null, 2));
    artifactCount += 1;
  }
}

console.log(`Compiled ${artifactCount} Lester's Arcade contract artifact(s).`);
