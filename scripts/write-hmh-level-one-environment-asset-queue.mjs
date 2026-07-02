import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { buildLevelOneEnvironmentAssetQueue } from '../apps/portal/src/hmh-level-one-quality.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = join(scriptDir, '..');
const outputPath = join(root, 'scripts', 'pixellab-hmh-level-one-environment-queue.json');
const prioritiesArg = process.argv.find((arg) => arg.startsWith('--priorities='));
const priorities = prioritiesArg
  ? prioritiesArg.slice('--priorities='.length).split(',').map((value) => value.trim()).filter(Boolean)
  : ['P0'];

const queue = buildLevelOneEnvironmentAssetQueue({ priorities });
writeFileSync(outputPath, `${JSON.stringify(queue, null, 2)}\n`);
console.log(`Wrote ${queue.jobs.length} Level 1 environment PixelLab jobs to ${outputPath}`);
