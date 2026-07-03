import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildWave3ArtMatrixMarkdown, buildWave3ArtMatrixReport } from '../apps/portal/src/wave3-art-matrix.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outputDir = join(repoRoot, 'docs', 'game-design');
mkdirSync(outputDir, { recursive: true });

const report = buildWave3ArtMatrixReport();
const jsonPath = join(outputDir, 'hard-money-heroes-wave3-art-matrix.json');
const mdPath = join(outputDir, 'hard-money-heroes-wave3-art-matrix.md');
writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(mdPath, buildWave3ArtMatrixMarkdown(report));

const failedGates = report.gates.filter((gate) => gate.status !== 'pass');
console.log('Wave 3 art matrix report written:');
console.log(`- ${jsonPath}`);
console.log(`- ${mdPath}`);
console.log(`Hero cells: ${report.heroes.summary.completeCells}/${report.heroes.summary.totalCells}`);
console.log(`Enemy readability cells: ${report.enemies.summary.completeStateCells}/${report.enemies.summary.totalStateCells}`);
if (failedGates.length) {
  console.error(`Failed gates: ${failedGates.map((gate) => gate.id).join(', ')}`);
  process.exitCode = 1;
}
