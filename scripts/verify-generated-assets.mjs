import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const reportPath = path.resolve(root, 'apps/portal/assets/generated/sliced/asset-slice-report.json');

function fail(message) {
  throw new Error(`Generated asset verification failed: ${message}`);
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function readPngSize(filePath) {
  const png = readFileSync(filePath);
  const signature = png.subarray(0, 8).toString('hex');
  if (signature !== '89504e470d0a1a0a') {
    fail(`${path.relative(root, filePath)} is not a PNG`);
  }
  return [png.readUInt32BE(16), png.readUInt32BE(20)];
}

function includesOutput(report, fragment) {
  return report.assets.some((asset) => asset.output.includes(fragment));
}

if (!existsSync(reportPath)) {
  fail(`missing report ${path.relative(root, reportPath)}`);
}

const report = readJson(reportPath);
if (!Array.isArray(report.assets)) fail('report.assets must be an array');
if (report.generatedCount !== report.assets.length) {
  fail(`generatedCount ${report.generatedCount} does not match assets.length ${report.assets.length}`);
}
if (report.generatedCount < 70) fail(`expected at least 70 generated slices, got ${report.generatedCount}`);

const requiredFragments = [
  '/lester-idle.png',
  '/lester-run-1.png',
  '/lester-shoot.png',
  '/enemy-goblin-attack.png',
  '/enemy-wisp-hit.png',
  '/enemy-bruiser-ko.png',
  '/icon-weapon-settler.png',
  '/icon-weapon-health.png',
  '/badge-first-run.png',
  '/level1-underchain-street.png',
];

for (const fragment of requiredFragments) {
  if (!includesOutput(report, fragment)) fail(`missing required slice ${fragment}`);
}

const categoryCounts = {
  lester: 0,
  enemies: 0,
  icons: 0,
  badges: 0,
  level1Parallax: 0,
};

for (const asset of report.assets) {
  if (!asset.output || !Array.isArray(asset.size) || asset.size.length !== 2) {
    fail(`asset entry is missing output/size: ${JSON.stringify(asset)}`);
  }

  const assetPath = path.resolve(root, asset.output);
  if (!existsSync(assetPath)) fail(`missing ${asset.output}`);
  if (statSync(assetPath).size <= 0) fail(`${asset.output} is empty`);

  const [width, height] = readPngSize(assetPath);
  if (width !== asset.size[0] || height !== asset.size[1]) {
    fail(`${asset.output} dimensions ${width}x${height} do not match report ${asset.size.join('x')}`);
  }

  const output = asset.output.replaceAll('\\', '/');
  if (output.includes('/lester-')) categoryCounts.lester += 1;
  if (output.includes('/enemy-')) categoryCounts.enemies += 1;
  if (output.includes('/icon-weapon-')) categoryCounts.icons += 1;
  if (output.includes('/badge-')) categoryCounts.badges += 1;
  if (output.includes('/level1-underchain-')) categoryCounts.level1Parallax += 1;
}

if (categoryCounts.lester < 8) fail(`expected Lester animation coverage, got ${categoryCounts.lester}`);
if (categoryCounts.enemies < 16) fail(`expected enemy sprite coverage, got ${categoryCounts.enemies}`);
if (categoryCounts.icons < 10) fail(`expected weapon/pickup icons, got ${categoryCounts.icons}`);
if (categoryCounts.badges < 6) fail(`expected achievement badges, got ${categoryCounts.badges}`);
if (categoryCounts.level1Parallax < 4) fail(`expected Level 1 parallax layers, got ${categoryCounts.level1Parallax}`);

console.log(`Generated sliced asset verification passed: ${report.generatedCount} PNGs (${Object.entries(categoryCounts).map(([key, value]) => `${key}=${value}`).join(', ')}).`);
