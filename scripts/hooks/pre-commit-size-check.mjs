import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_ADDED_FILES = 300;

function git(args) {
  return spawnSync('git', args, { cwd: root, encoding: 'utf8' });
}

if (process.env.ALLOW_LARGE_COMMIT === '1') process.exit(0);

const addedResult = git(['diff', '--cached', '--name-only', '--diff-filter=A', '-z']);
if (addedResult.status !== 0) {
  console.error(addedResult.stderr || addedResult.stdout);
  process.exit(1);
}

const added = addedResult.stdout.split('\0').filter(Boolean);
const tooLarge = [];
for (const rel of added) {
  const abs = path.join(root, rel);
  if (!existsSync(abs)) continue;
  const sizeResult = git(['cat-file', '-s', `:${rel}`]);
  const size = Number.parseInt(sizeResult.stdout, 10);
  if (Number.isFinite(size) && size > MAX_FILE_BYTES) tooLarge.push({ rel, size });
}

if (added.length > MAX_ADDED_FILES || tooLarge.length > 0) {
  console.error('Large commit guard failed.');
  console.error(`Added files: ${added.length} (limit ${MAX_ADDED_FILES}).`);
  if (tooLarge.length > 0) {
    console.error(`Files over ${MAX_FILE_BYTES} bytes:`);
    for (const file of tooLarge) console.error(`- ${file.rel} (${file.size} bytes)`);
  }
  console.error('If this is intentional after review, rerun commit with ALLOW_LARGE_COMMIT=1.');
  process.exit(1);
}
