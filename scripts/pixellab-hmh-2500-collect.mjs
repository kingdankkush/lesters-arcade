#!/usr/bin/env node
// Pixellab 2,500-image queue specification + collection script.
//
// Run:
//   node scripts/pixellab-hmh-2500-collect.mjs --queue=pixellab-hmh-2500-queue.json
//
// When Pixellab API is connected, this script:
// 1. Reads the queue JSON (categories + prompts + counts)
// 2. Submits batches to Pixellab (respecting rate limits)
// 3. Polls for completion
// 4. Downloads finished images to the canonical asset tree
// 5. Runs quality-gate validation (dimensions, alpha, frame consistency)
// 6. Updates the manifest assembly files (pixellab-hmh-characters.mjs, etc.)
//
// Before Pixellab API is connected, this script can generate a dry-run manifest
// (via --dry-run) that documents every prompt and its target path.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

const { values: args, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    queue: { type: 'string', default: 'scripts/pixellab-hmh-2500-queue.json' },
    'dry-run': { type: 'boolean', default: false },
    'start-at': { type: 'string', default: null },
    limit: { type: 'string', default: '0' },
  },
  allowPositionals: true,
});

const queuePath = args.queue;

// Default style suffix applied to every prompt (Pixellab-friendly pixel-art defaults).
const STYLE_SUFFIX = [
  'top-down 2d pixel art',
  'transparent background',
  'clean edges, no watermark, no text overlay',
  'consistent sprite-sheet framing',
  'litecoin silver and blue palette accent',
].join(', ');

// Build the canonical asset path for a given queue entry.
function canonicalPath(entry) {
  return join(
    'apps/portal/assets/generated/pixellab',
    entry.category,
    ...(entry.subcategory ?? []),
    entry.filename + '.png',
  );
}

async function main() {
  let queue;
  try {
    queue = JSON.parse(readFileSync(queuePath, 'utf8'));
  } catch (err) {
    console.error(`Could not read queue at ${queuePath}: ${err.message}`);
    console.error('Run --dry-run against the default queue (not yet generated) or create one.');
    process.exit(1);
  }

  const total = queue.entries?.length ?? 0;
  console.log(`Queue loaded: ${total} entries.`);

  if (args['dry-run']) {
    let skipped = 0;
    let emitted = 0;
    for (const entry of queue.entries ?? []) {
      const path = canonicalPath(entry);
      const exists = existsSync(path);
      console.log(`${exists ? '[SKIP]' : '[WANT]'} ${path}`);
      console.log(`       prompt: ${entry.prompt} [${STYLE_SUFFIX}]`);
      if (exists) skipped++;
      else emitted++;
    }
    console.log(`\nDry-run summary: ${emitted} to generate, ${skipped} already present.`);
    return;
  }

  // Placeholder for the real Pixellab API integration.
  // When Pixellab is wired in, this section calls the Pixellab queue/collect MCP.
  console.log('Live Pixellab API is not yet connected.');
  console.log('To generate, implement the following in this script:');
  console.log('  1. const pixellab = await createPixellabClient();  // MCP/HTTP');
  console.log('  2. for (const entry of queue.entries) {');
  console.log('       const job = await pixellab.queue({ prompt: entry.prompt + ", " + STYLE_SUFFIX, ...entry.options });');
  console.log('       const result = await pixellab.collect(job.id, { outputPath: canonicalPath(entry) });');
  console.log('     }');
  console.log('  3. Run quality validation (PNG-24, alpha, frame consistency).');
  console.log('  4. Update the manifest assembly files under scripts/pixellab-compile-manifests.mjs.');
}

main().catch((err) => {
  console.error('collect.mjs error:', err);
  process.exit(1);
});
