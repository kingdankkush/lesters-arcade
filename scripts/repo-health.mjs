import { spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const portalAssets = path.join(root, 'apps/portal/assets');
const keepMapPath = path.join(root, 'docs/cleanup/asset-reference-map.json');
const SKIP_DIRS = new Set(['.git', 'node_modules', '.vercel', '.hermes', 'dist']);

function slash(p) {
  return p.split(path.sep).join('/');
}

function rel(abs) {
  return slash(path.relative(root, abs));
}

function humanBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

async function walkFiles(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  async function walk(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(abs);
      else if (entry.isFile()) out.push(abs);
    }
  }
  await walk(dir);
  return out;
}

function git(args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) return '';
  return result.stdout.trim();
}

const allFiles = await walkFiles(root);
const gitDir = path.join(root, '.git');
const gitFiles = await walkFiles(gitDir);
const tracked = git(['ls-files']).split('\n').filter(Boolean);
const status = git(['status', '--short', '--branch']);
const largest = allFiles
  .map((file) => ({ path: rel(file), sizeBytes: statSync(file).size }))
  .sort((a, b) => b.sizeBytes - a.sizeBytes)
  .slice(0, 20);

let keepAssets = new Set();
if (existsSync(keepMapPath)) {
  const map = JSON.parse(await readFile(keepMapPath, 'utf8'));
  for (const value of Object.values(map.referencedAssets ?? {})) {
    for (const asset of value ?? []) keepAssets.add(asset);
  }
}

const assetFiles = await walkFiles(portalAssets);
const offKeepList = keepAssets.size === 0
  ? []
  : assetFiles
    .map((file) => slash(path.relative(path.join(root, 'apps/portal'), file)))
    .filter((asset) => !keepAssets.has(asset))
    .sort()
    .slice(0, 100);

const totalBytes = allFiles.reduce((sum, file) => sum + statSync(file).size, 0);
const gitBytes = gitFiles.reduce((sum, file) => sum + statSync(file).size, 0);

console.log('Lester\'s Arcade repo health');
console.log('===========================');
console.log(`Tracked files: ${tracked.length}`);
console.log(`Working tree files (excluding .git/node_modules/.vercel/dist): ${allFiles.length}`);
console.log(`Working tree bytes (same exclusions): ${humanBytes(totalBytes)}`);
console.log(`.git bytes: ${humanBytes(gitBytes)}`);
console.log('');
console.log('Git status:');
console.log(status || '(clean)');
console.log('');
console.log('Largest files:');
for (const file of largest) console.log(`${humanBytes(file.sizeBytes).padStart(8)}  ${file.path}`);
console.log('');
if (keepAssets.size === 0) {
  console.log('Asset keep-list: docs/cleanup/asset-reference-map.json not found; run npm run repo:audit.');
} else if (offKeepList.length === 0) {
  console.log('Off-keep-list asset additions: none found.');
} else {
  console.log(`Off-keep-list asset additions/candidates (first ${offKeepList.length}):`);
  for (const asset of offKeepList) console.log(`- ${asset}`);
}
