import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const reportPath = path.resolve(root, 'apps/portal/assets/generated/sliced/asset-slice-report.json');
const lesterManifestPath = path.resolve(root, 'apps/portal/assets/lester-production/lester-production-sprite-manifest.json');
const cabinetManifestPath = path.resolve(root, 'apps/portal/assets/hard-money-heroes/cabinet/hmh-cabinet-sprite-manifest.json');
const playlistManifestPath = path.resolve(root, 'apps/portal/assets/audio/playlist/arcade-playlist-manifest.json');
const pixelLabLesterCalibrationManifestPath = path.resolve(root, 'apps/portal/assets/generated/pixellab-calibration/lester-hero-6d6e53e2/manifest.json');
const pixelLabLesterCalibrationRuntimePath = path.resolve(root, 'apps/portal/assets/generated/pixellab-calibration/lester-hero-6d6e53e2/runtime-manifest.mjs');

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

function validateLesterProductionSprites() {
  if (!existsSync(lesterManifestPath)) {
    fail(`missing production Lester manifest ${path.relative(root, lesterManifestPath)}`);
  }
  const manifest = readJson(lesterManifestPath);
  if (manifest.character !== 'Lester') fail('production Lester manifest has wrong character');
  if (manifest.frameGrid?.columns !== 5 || manifest.frameGrid?.rows !== 5) fail('production Lester manifest must describe a 5x5 source grid');
  const animations = manifest.animations ?? {};
  const stills = manifest.stills ?? {};
  let productionFrameCount = 0;

  for (const state of ['idle', 'walk', 'run', 'jump']) {
    const animation = animations[state];
    if (!animation) fail(`missing production Lester animation ${state}`);
    if (!Array.isArray(animation.frames) || animation.frames.length !== 25) {
      fail(`production Lester ${state} expected 25 frames, got ${animation?.frames?.length ?? 0}`);
    }
    if (!animation.source || !existsSync(path.resolve(root, animation.source))) fail(`missing production Lester source for ${state}`);
    for (const frame of animation.frames) {
      const framePath = path.resolve(root, frame.src);
      if (!existsSync(framePath)) fail(`missing production Lester frame ${frame.src}`);
      if (statSync(framePath).size <= 0) fail(`production Lester frame ${frame.src} is empty`);
      const [width, height] = readPngSize(framePath);
      if (width !== frame.size[0] || height !== frame.size[1]) {
        fail(`production Lester frame ${frame.src} dimensions ${width}x${height} do not match report ${frame.size.join('x')}`);
      }
      productionFrameCount += 1;
    }
  }

  for (const pose of ['facing', 'leftSideProfile', 'rightSideProfile', 'facingShotgun', 'leftSideShotgun', 'rightSideShotgun']) {
    const still = stills[pose];
    if (!still) fail(`missing production Lester still ${pose}`);
    const stillPath = path.resolve(root, still.src);
    if (!existsSync(stillPath)) fail(`missing production Lester still file ${still.src}`);
    if (statSync(stillPath).size <= 0) fail(`production Lester still ${still.src} is empty`);
    const [width, height] = readPngSize(stillPath);
    if (width !== still.size[0] || height !== still.size[1]) {
      fail(`production Lester still ${still.src} dimensions ${width}x${height} do not match manifest ${still.size.join('x')}`);
    }
  }

  return { productionFrameCount, stillCount: Object.keys(stills).length };
}

function resolvePortalAsset(src) {
  const cleanSrc = String(src).split('?')[0];
  return path.resolve(root, 'apps/portal', cleanSrc.replace(/^\.\//, ''));
}

function validateHardMoneyHeroesCabinetSprites() {
  if (!existsSync(cabinetManifestPath)) {
    fail(`missing Hard Money Heroes cabinet manifest ${path.relative(root, cabinetManifestPath)}`);
  }
  const manifest = readJson(cabinetManifestPath);
  if (manifest.id !== 'hard-money-heroes-arcade-cabinet-rotation') fail('cabinet manifest has wrong id');
  if (!existsSync(resolvePortalAsset(manifest.source))) fail(`missing cabinet source ${manifest.source}`);
  if (!Array.isArray(manifest.frames) || manifest.frames.length !== 6) {
    fail(`cabinet rotation expected 6 frames, got ${manifest.frames?.length ?? 0}`);
  }
  for (const frame of manifest.frames) {
    const framePath = resolvePortalAsset(frame.src);
    if (!existsSync(framePath)) fail(`missing cabinet rotation frame ${frame.src}`);
    if (statSync(framePath).size <= 0) fail(`cabinet rotation frame ${frame.src} is empty`);
    const [width, height] = readPngSize(framePath);
    if (width !== frame.width || height !== frame.height) {
      fail(`cabinet frame ${frame.src} dimensions ${width}x${height} do not match manifest ${frame.width}x${frame.height}`);
    }
    if (width !== manifest.canvas?.width || height !== manifest.canvas?.height) {
      fail(`cabinet frame ${frame.src} should match shared canvas ${manifest.canvas?.width}x${manifest.canvas?.height}`);
    }
  }
  return { frameCount: manifest.frames.length, loopDurationMs: manifest.loopDurationMs };
}

function validateArcadePlaylistMusic() {
  if (!existsSync(playlistManifestPath)) {
    fail(`missing arcade playlist manifest ${path.relative(root, playlistManifestPath)}`);
  }
  const manifest = readJson(playlistManifestPath);
  if (manifest.id !== 'lesters-arcade-custom-mp3-playlist-v1') fail('arcade playlist manifest has wrong id');
  if (!Array.isArray(manifest.tracks) || manifest.tracks.length < 20) {
    fail(`arcade playlist expected at least 20 tracks, got ${manifest.tracks?.length ?? 0}`);
  }
  if (manifest.tracks.length !== manifest.defaultQueue?.length) {
    fail(`playlist track count (${manifest.tracks.length}) must match defaultQueue length (${manifest.defaultQueue?.length ?? 0})`);
  }
  const hmhQueue = manifest.gameQueues?.hardMoneyHeroes ?? [];
  if (hmhQueue[0] !== 'hard-money-heroes-16-bit-arcade-music' || hmhQueue[1] !== 'hard-money-heroes-16-bit-arcade-music-alt') {
    fail('Hard Money Heroes queue must start with the two Hard Money Heroes tracks');
  }
  let totalBytes = 0;
  for (const track of manifest.tracks) {
    if (!track.id || !track.title || !track.src?.endsWith('.mp3')) fail(`invalid playlist track entry ${JSON.stringify(track)}`);
    if (typeof track.durationSeconds !== 'number' || track.durationSeconds <= 30) fail(`track ${track.id} has invalid duration`);
    const trackPath = resolvePortalAsset(track.src);
    if (!existsSync(trackPath)) fail(`missing playlist MP3 ${track.src}`);
    const size = statSync(trackPath).size;
    if (size <= 0) fail(`playlist MP3 ${track.src} is empty`);
    totalBytes += size;
  }
  return { trackCount: manifest.tracks.length, totalBytes };
}

function validatePixelLabLesterCalibration() {
  if (!existsSync(pixelLabLesterCalibrationManifestPath)) {
    fail(`missing PixelLab Lester calibration manifest ${path.relative(root, pixelLabLesterCalibrationManifestPath)}`);
  }
  if (!existsSync(pixelLabLesterCalibrationRuntimePath)) {
    fail(`missing PixelLab Lester runtime manifest ${path.relative(root, pixelLabLesterCalibrationRuntimePath)}`);
  }

  const manifest = readJson(pixelLabLesterCalibrationManifestPath);
  if (manifest.source !== 'PixelLab MCP/API') fail('PixelLab calibration manifest has wrong source');
  if (manifest.pack !== 'calibration-lester-hero-idle-run-shoot') fail('PixelLab calibration manifest has wrong pack id');
  if (!manifest.character_id) fail('PixelLab calibration manifest is missing character_id');
  if (!Array.isArray(manifest.rotations) || manifest.rotations.length !== 8) {
    fail(`PixelLab Lester calibration expected 8 rotations, got ${manifest.rotations?.length ?? 0}`);
  }
  const requiredDirections = new Set(['south', 'east', 'north', 'west', 'south-east', 'north-east', 'north-west', 'south-west']);
  for (const rotation of manifest.rotations) {
    if (!requiredDirections.delete(rotation.direction)) fail(`unexpected or duplicate PixelLab rotation ${rotation.direction}`);
    const rotationPath = path.resolve(root, rotation.local_path);
    if (!existsSync(rotationPath)) fail(`missing PixelLab rotation ${rotation.local_path}`);
    if (statSync(rotationPath).size <= 0) fail(`PixelLab rotation ${rotation.local_path} is empty`);
    const [width, height] = readPngSize(rotationPath);
    if (width !== rotation.image?.width || height !== rotation.image?.height) {
      fail(`PixelLab rotation ${rotation.local_path} dimensions ${width}x${height} do not match manifest ${rotation.image?.width}x${rotation.image?.height}`);
    }
  }
  if (requiredDirections.size) fail(`missing PixelLab rotations: ${Array.from(requiredDirections).join(', ')}`);

  const expectedAnimationFrames = new Map([
    ['shoot-blaster', 9],
    ['idle-combat-ready', 8],
    ['run-side-scroll', 6],
  ]);
  let frameCount = 0;
  for (const [slug, expectedCount] of expectedAnimationFrames.entries()) {
    const animation = manifest.animations?.find((entry) => entry.slug === slug);
    if (!animation) fail(`missing PixelLab animation ${slug}`);
    if (animation.direction !== 'east') fail(`PixelLab animation ${slug} should be east-facing`);
    if (!Array.isArray(animation.frames) || animation.frames.length !== expectedCount) {
      fail(`PixelLab animation ${slug} expected ${expectedCount} frames, got ${animation?.frames?.length ?? 0}`);
    }
    for (const frame of animation.frames) {
      const framePath = path.resolve(root, frame.local_path);
      if (!existsSync(framePath)) fail(`missing PixelLab frame ${frame.local_path}`);
      if (statSync(framePath).size <= 0) fail(`PixelLab frame ${frame.local_path} is empty`);
      const [width, height] = readPngSize(framePath);
      if (width !== frame.image?.width || height !== frame.image?.height) {
        fail(`PixelLab frame ${frame.local_path} dimensions ${width}x${height} do not match manifest ${frame.image?.width}x${frame.image?.height}`);
      }
      frameCount += 1;
    }
    if (animation.review_gif && !existsSync(path.resolve(root, animation.review_gif))) fail(`missing PixelLab review GIF ${animation.review_gif}`);
  }

  const runtime = readFileSync(pixelLabLesterCalibrationRuntimePath, 'utf8');
  for (const marker of ['HMH_PIXELLAB_LESTER_CALIBRATION_MANIFEST', 'status: \'calibration-review\'', 'animations: Object.freeze']) {
    if (!runtime.includes(marker)) fail(`PixelLab runtime manifest missing marker ${marker}`);
  }

  return { rotations: manifest.rotations.length, frameCount };
}

const lesterProduction = validateLesterProductionSprites();
const hmhCabinet = validateHardMoneyHeroesCabinetSprites();
const arcadePlaylist = validateArcadePlaylistMusic();
const pixelLabLesterCalibration = validatePixelLabLesterCalibration();

console.log(`Generated sliced asset verification passed: ${report.generatedCount} PNGs (${Object.entries(categoryCounts).map(([key, value]) => `${key}=${value}`).join(', ')}); production Lester=${lesterProduction.productionFrameCount} frames/${lesterProduction.stillCount} stills; PixelLab Lester calibration=${pixelLabLesterCalibration.frameCount} frames/${pixelLabLesterCalibration.rotations} rotations; HMH cabinet=${hmhCabinet.frameCount} frames/${hmhCabinet.loopDurationMs}ms loop; arcade playlist=${arcadePlaylist.trackCount} MP3s/${Math.round(arcadePlaylist.totalBytes / 1024 / 1024)}MB.`);
