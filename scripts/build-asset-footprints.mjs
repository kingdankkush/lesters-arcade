import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { HMH_CURATED_LEVEL_KIT } from '../apps/portal/assets/generated/hmh-curated-level-kit/hmh-curated-level-kit-manifest.mjs';
import { HMH_LEVEL_ENVIRONMENT } from '../apps/portal/assets/generated/hmh-level-environment/hmh-level-environment.mjs';
import { HMH_LEVEL_ONE_POLISH_ASSETS } from '../apps/portal/assets/generated/hmh-coherent-world/level1-polish/level1-polish-manifest.mjs';
import { HMH_LEVEL_ONE_ANIMATED_POLISH_ASSETS } from '../apps/portal/assets/generated/hmh-coherent-world/level1-final-animated/level1-final-animated-manifest.mjs';
import { HMH_FINAL_WORLD_AMBIENT_ASSETS } from '../apps/portal/assets/generated/hmh-coherent-world/level-final-ambient/level-final-ambient-manifest.mjs';
import { HMH_FINAL_SETPIECE_KIT } from '../apps/portal/assets/generated/hmh-final-setpiece-kit/hmh-final-setpiece-kit-manifest.mjs';
import { SCENE_TEMPLATES } from '../apps/portal/src/scene-templates.mjs';
import { WORLD_SCALE } from '../apps/portal/src/hmh-world-scale.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const portalRoot = path.join(repoRoot, 'apps', 'portal');
const OUT_JSON = path.join(repoRoot, 'apps', 'portal', 'assets', 'hmh-asset-footprints.json');
const OUT_REPORT = path.join(repoRoot, 'docs', 'art', 'HMH_ASSET_FOOTPRINT_MISFITS.md');

// Justin approved moving ahead on WO-8: every density misfit keeps its art and
// records a manual exact-pixel footprint override. Runtime still consumes the
// rounded computed footprint in WO-8; WO-9 can prefer override.footprintTiles.
const APPROVED_MISFIT_RESOLUTION = 'manual-footprint-override';

const PLACEABLE_ROLES = new Set([
  'building', 'bigprop', 'vehicle', 'tree', 'smallprop', 'landmark', 'billboard', 'hedge', 'cactus',
  'pole', 'post', 'gate', 'log', 'edge', 'road', 'bush', 'barn', 'crop', 'fountain', 'cabinet',
  'bench', 'table', 'crate', 'lamp', 'sign', 'rock', 'boulder', 'decor', 'fence', 'wall', 'bridge',
  'water-strip', 'water', 'plant', 'ruin', 'camp', 'loot-prop', 'hazard-prop', 'landmark-building',
]);

function portalSrcToFs(src) {
  if (typeof src !== 'string' || !src.length) return null;
  if (src.startsWith('./')) return path.join(portalRoot, src.slice(2));
  if (src.startsWith('/')) return path.join(portalRoot, src.slice(1));
  return path.join(portalRoot, src);
}

function readPngSize(src) {
  const file = portalSrcToFs(src);
  if (!file) return null;
  try {
    const buf = readFileSync(file);
    if (buf.length < 24 || buf.toString('ascii', 1, 4) !== 'PNG') return null;
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  } catch {
    return null;
  }
}

function roundedHalf(value) {
  return Math.max(0.5, Math.round(value * 2) / 2);
}

function normalizedRole(asset) {
  const raw = String(asset.role ?? asset.category ?? 'smallprop').toLowerCase();
  if (raw.includes('building') || raw.includes('landmark')) return 'building';
  if (raw.includes('tree') || raw.includes('flora')) return 'tree';
  if (raw.includes('plant') || raw.includes('bush')) return 'smallprop';
  if (raw.includes('rock') || raw.includes('ruin') || raw.includes('wall')) return 'bigprop';
  if (raw.includes('sign') || raw.includes('lamp') || raw.includes('loot') || raw.includes('hazard')) return 'smallprop';
  return raw;
}

function addAsset(map, source, asset, extra = {}) {
  if (!asset) return;
  const role = normalizedRole(asset);
  if (!PLACEABLE_ROLES.has(role) && !PLACEABLE_ROLES.has(String(asset.role ?? '').toLowerCase())) return;
  if (String(asset.role ?? '').toLowerCase() === 'scenery') return;
  const key = String(asset.key ?? asset.id ?? asset.assetKey ?? asset.src ?? '').trim();
  const src = asset.src ?? (asset.assetKey ? `./assets/generated/hmh-coherent-world/${asset.assetKey}.png` : null);
  if (!key || !src) return;
  const pngSize = readPngSize(src);
  const nativeWidth = Number(asset.frameWidth ?? asset.width ?? pngSize?.width ?? 0);
  const nativeHeight = Number(asset.frameHeight ?? asset.height ?? pngSize?.height ?? 0);
  if (!nativeWidth || !nativeHeight) return;
  const mapKey = `${source}:${key}`;
  if (map.has(mapKey)) return;

  const footprintW = roundedHalf(nativeWidth / (WORLD_SCALE.tileW * WORLD_SCALE.texelDensity));
  const footprintH = roundedHalf(nativeHeight / (WORLD_SCALE.tileH * WORLD_SCALE.texelDensity));
  const impliedDensity = Number((nativeWidth / (footprintW * WORLD_SCALE.tileW)).toFixed(3));
  const minDensity = WORLD_SCALE.texelDensity * (1 - WORLD_SCALE.tolerance);
  const maxDensity = WORLD_SCALE.texelDensity * (1 + WORLD_SCALE.tolerance);
  const misfit = impliedDensity < minDensity || impliedDensity > maxDensity;
  const override = misfit
    ? {
        footprintTiles: {
          w: Number((nativeWidth / (WORLD_SCALE.tileW * WORLD_SCALE.texelDensity)).toFixed(3)),
          h: Number((nativeHeight / (WORLD_SCALE.tileH * WORLD_SCALE.texelDensity)).toFixed(3)),
        },
        reason: 'Approved exact-pixel footprint for WO-8 density misfit; preserves art while avoiding bucket scaling.',
      }
    : null;

  map.set(mapKey, {
    key: mapKey,
    runtimeKey: key,
    source,
    role,
    category: asset.category ?? null,
    src,
    nativePx: { w: nativeWidth, h: nativeHeight },
    footprintTiles: { w: footprintW, h: footprintH },
    computedDrawPx: { w: Math.round(footprintW * WORLD_SCALE.tileW), h: Math.round(footprintW * WORLD_SCALE.tileW * (nativeHeight / nativeWidth)) },
    impliedDensity,
    withinTolerance: !misfit,
    override,
    resolution: misfit ? APPROVED_MISFIT_RESOLUTION : 'computed-footprint-ok',
    notes: extra.notes ?? asset.notes ?? null,
  });
}

function collectSceneTemplateAssets() {
  const rows = [];
  for (const template of Object.values(SCENE_TEMPLATES)) {
    for (const slot of template.slots ?? []) {
      rows.push({ assetKey: slot.assetKey, key: slot.assetKey, role: slot.role, category: 'scene-template', src: `./assets/generated/hmh-coherent-world/${slot.assetKey}.png` });
    }
  }
  return rows;
}

function collectAssets() {
  const assets = new Map();

  for (const asset of HMH_CURATED_LEVEL_KIT.trimmedProps?.assets ?? []) {
    addAsset(assets, 'curated-level-kit', asset);
  }
  for (const asset of HMH_LEVEL_ENVIRONMENT.worldProps ?? []) {
    if (typeof asset.src === 'string' && asset.src.includes('/hmh-demo-wave/')) {
      addAsset(assets, 'demo-wave', asset);
    }
  }
  for (const manifest of [
    HMH_LEVEL_ONE_POLISH_ASSETS,
    HMH_LEVEL_ONE_ANIMATED_POLISH_ASSETS,
    HMH_FINAL_WORLD_AMBIENT_ASSETS,
    HMH_FINAL_SETPIECE_KIT,
  ]) {
    for (const asset of manifest.assets ?? []) addAsset(assets, 'coherent-world', asset);
  }
  for (const asset of collectSceneTemplateAssets()) {
    addAsset(assets, 'coherent-world-scene-template', asset, { notes: 'Referenced by SCENE_TEMPLATES.' });
  }

  return [...assets.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function buildManifest() {
  const assets = collectAssets();
  const misfits = assets.filter((asset) => !asset.withinTolerance);
  const bySource = assets.reduce((acc, asset) => {
    acc[asset.source] = (acc[asset.source] ?? 0) + 1;
    return acc;
  }, {});
  return {
    schemaVersion: 1,
    generatedBy: 'scripts/build-asset-footprints.mjs',
    generatedFrom: [
      'hmh-curated-level-kit.trimmedProps.assets',
      'hmh-level-environment.worldProps demo-wave entries',
      'hmh-coherent-world manifests and SCENE_TEMPLATES asset keys',
    ],
    worldScale: WORLD_SCALE,
    toleranceDensityRange: {
      min: Number((WORLD_SCALE.texelDensity * (1 - WORLD_SCALE.tolerance)).toFixed(3)),
      max: Number((WORLD_SCALE.texelDensity * (1 + WORLD_SCALE.tolerance)).toFixed(3)),
    },
    summary: {
      assetCount: assets.length,
      bySource,
      misfitCount: misfits.length,
      overrideCount: assets.filter((asset) => asset.override).length,
    },
    assets,
    MISFITS: misfits.map((asset) => ({
      key: asset.key,
      runtimeKey: asset.runtimeKey,
      source: asset.source,
      role: asset.role,
      nativePx: asset.nativePx,
      footprintTiles: asset.footprintTiles,
      impliedDensity: asset.impliedDensity,
      resolution: asset.resolution,
    })),
  };
}

function renderReport(manifest) {
  const lines = [];
  lines.push('# HMH Asset Footprint Misfit Report');
  lines.push('');
  lines.push('Generated by `scripts/build-asset-footprints.mjs`.');
  lines.push('');
  lines.push('## Scale law');
  lines.push('');
  lines.push(`- Tile: ${manifest.worldScale.tileW}×${manifest.worldScale.tileH} px at zoom 1`);
  lines.push(`- Texel density target: ${manifest.worldScale.texelDensity}`);
  lines.push(`- Tolerance: ±${Math.round(manifest.worldScale.tolerance * 100)}% (${manifest.toleranceDensityRange.min}–${manifest.toleranceDensityRange.max})`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Assets with computed footprints: ${manifest.summary.assetCount}`);
  lines.push(`- Misfits requiring Justin resolution: ${manifest.summary.misfitCount}`);
  lines.push(`- Overrides recorded: ${manifest.summary.overrideCount}`);
  for (const [source, count] of Object.entries(manifest.summary.bySource).sort()) lines.push(`- ${source}: ${count}`);
  lines.push('');
  lines.push('## Resolution options');
  lines.push('');
  lines.push('Each MISFIT needs one recorded resolution before WO-8 can be considered done:');
  lines.push('');
  lines.push('- `override`: art is fine; set a manual `override.footprintTiles` in `apps/portal/assets/hmh-asset-footprints.json`.');
  lines.push('- `rescale`: art is fine but should be nearest-neighbor-rescaled offline.');
  lines.push('- `kill`: remove from the future placeable pool without deleting the source PNG.');
  lines.push('');
  lines.push('**Approved WO-8 direction:** all current density misfits use `manual-footprint-override`, preserving the art while declaring exact-pixel footprint metadata for WO-9 runtime sizing.');
  lines.push('');
  lines.push('## MISFITS');
  lines.push('');
  if (!manifest.MISFITS.length) {
    lines.push('No computed-density misfits. All generated footprints are within the WO-7 density tolerance.');
  } else {
    lines.push('| key | source | role | native px | footprint tiles | implied density | resolution |');
    lines.push('|---|---|---:|---:|---:|---:|---|');
    for (const asset of manifest.MISFITS) {
      lines.push(`| \`${asset.runtimeKey}\` | ${asset.source} | ${asset.role} | ${asset.nativePx.w}×${asset.nativePx.h} | ${asset.footprintTiles.w}×${asset.footprintTiles.h} | ${asset.impliedDensity} | ${asset.resolution} |`);
    }
  }
  lines.push('');
  lines.push('## First 40 computed footprints');
  lines.push('');
  lines.push('| key | source | role | native px | footprint tiles | density |');
  lines.push('|---|---|---:|---:|---:|---:|');
  for (const asset of manifest.assets.slice(0, 40)) {
    lines.push(`| \`${asset.runtimeKey}\` | ${asset.source} | ${asset.role} | ${asset.nativePx.w}×${asset.nativePx.h} | ${asset.footprintTiles.w}×${asset.footprintTiles.h} | ${asset.impliedDensity} |`);
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function main() {
  const manifest = buildManifest();
  mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  mkdirSync(path.dirname(OUT_REPORT), { recursive: true });
  writeFileSync(OUT_JSON, `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(OUT_REPORT, renderReport(manifest));
  console.log(`Wrote ${path.relative(repoRoot, OUT_JSON)} (${manifest.summary.assetCount} assets, ${manifest.summary.misfitCount} misfits)`);
  console.log(`Wrote ${path.relative(repoRoot, OUT_REPORT)}`);
}

main();
