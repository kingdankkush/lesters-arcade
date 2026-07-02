import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const mainSource = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');

test('WO-9 imports and uses the WO-8 footprint manifest for obstacle drawing', () => {
  assert.match(mainSource, /hmh-asset-footprints\.json/);
  assert.match(mainSource, /ASSET_FOOTPRINT_BY_KEY/);
  assert.match(mainSource, /footprintTilesForAssetKey/);
  assert.match(mainSource, /resolveDrawMetricsForFootprint/);
  assert.match(mainSource, /o\.footprintTiles\s*=\s*footprint/);
});

test('WO-9 removes targetW size buckets from the runtime prop style table', () => {
  const styleBlock = mainSource.slice(mainSource.indexOf('const PROP_ROLE_STYLE'), mainSource.indexOf('const ASSET_FOOTPRINT_BY_KEY'));
  assert.equal(styleBlock.includes('targetW'), false, 'PROP_ROLE_STYLE must not define fixed target widths');
  assert.match(styleBlock, /radius/);
  assert.match(styleBlock, /ground/);
});

test('WO-9 obstacle draw width derives from footprint tiles and preserves native aspect ratio', () => {
  const metricsBlock = mainSource.slice(mainSource.indexOf('function resolveDrawMetricsForFootprint'), mainSource.indexOf('// World props that are valid'));
  assert.match(metricsBlock, /footprintW \* ISO_TILE_WIDTH/);
  assert.match(metricsBlock, /img\.naturalHeight \/ Math\.max\(1, img\.naturalWidth\)/);
  assert.match(metricsBlock, /footprintW \* 0\.5 \* \(style\.radius/);
  const renderBlock = mainSource.slice(mainSource.indexOf('function buildObstacleRenderEntries'), mainSource.indexOf('function drawRoguelikeScene'));
  assert.equal(renderBlock.includes('style.targetW'), false, 'renderer must not read fixed target width buckets');
  assert.match(renderBlock, /resolveDrawMetricsForFootprint\(img, footprint, style\)/);
});

test('WO-9 ambient fallback props no longer default to independent 118x118 square draws', () => {
  const ambientBlock = mainSource.slice(mainSource.indexOf('function drawAmbientEnvironmentProps'), mainSource.indexOf('function drawBackground'));
  assert.equal(ambientBlock.includes('const drawHeight = draw.height ?? 118'), false);
  assert.match(ambientBlock, /drawWidth \/ naturalRatio/);
});
