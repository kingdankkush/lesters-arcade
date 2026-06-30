import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  HMH_LEVEL_EDITOR_SCHEMA_VERSION,
  createBlankHmhLevelDraft,
  normalizeHmhLevelDraft,
  validateHmhLevelDraft,
  createHermesHandoffReport,
  createHmhLevelExportBundle,
  hmhLevelDraftFileName,
  HMH_LEVEL_EDITOR_DEFAULTS,
} from '../apps/portal/src/hmh-level-editor-schema.mjs';
import {
  HMH_LEVEL_EDITOR_ASSET_GROUPS,
  HMH_LEVEL_EDITOR_MARKER_TOOLS,
  buildHmhEditorAssetPalette,
} from '../apps/portal/src/hmh-level-editor-assets.mjs';
import { HMH_LEVEL_EDITOR_GENERATED_MANIFESTS } from '../apps/portal/src/hmh-level-editor-generated-library.mjs';

const editorHtmlPath = fileURLToPath(new URL('../apps/portal/editor.html', import.meta.url));
const editorJsPath = fileURLToPath(new URL('../apps/portal/src/hmh-level-editor-app.mjs', import.meta.url));

test('level editor schema captures Justin authored-level requirements and helicopter extraction flow', () => {
  assert.equal(HMH_LEVEL_EDITOR_SCHEMA_VERSION, 1);
  assert.equal(HMH_LEVEL_EDITOR_DEFAULTS.access, 'local-dev-only');
  assert.equal(HMH_LEVEL_EDITOR_DEFAULTS.replacesProceduralLevels, true);
  assert.equal(HMH_LEVEL_EDITOR_DEFAULTS.minimapPhase, 'later-after-levels-are-built');
  assert.deepEqual(HMH_LEVEL_EDITOR_DEFAULTS.timeline, {
    bossSpawnSeconds: 360,
    extractionAppearsSeconds: 480,
    extractionAlsoAppearsAfterBossDefeat: true,
  });
  assert.deepEqual(HMH_LEVEL_EDITOR_DEFAULTS.extractionSequence, {
    type: 'helicopter-cinematic',
    steps: ['fly-to-near-player', 'land', 'player-enters', 'take-off', 'fly-away-out-of-view', 'level-complete-screen', 'load-next-level-ready-screen'],
    locksPlayerControl: true,
  });
});

test('createBlankHmhLevelDraft produces a hand-authorable map with required layers and objective markers', () => {
  const draft = createBlankHmhLevelDraft({ levelId: 'level-1-crypto-wasteland', title: 'Level 1 Hand Layout' });
  assert.equal(draft.schemaVersion, HMH_LEVEL_EDITOR_SCHEMA_VERSION);
  assert.equal(draft.levelId, 'level-1-crypto-wasteland');
  assert.equal(draft.title, 'Level 1 Hand Layout');
  assert.equal(draft.grid.type, 'isometric-2to1');
  assert.equal(draft.layers.some((layer) => layer.id === 'ground'), true);
  assert.equal(draft.layers.some((layer) => layer.id === 'ground-overlays'), true);
  assert.equal(draft.layers.some((layer) => layer.id === 'barriers'), true);
  assert.equal(draft.layers.some((layer) => layer.id === 'enemies'), true);
  assert.deepEqual(draft.boundaries, []);
  assert.equal(draft.objectives.boss.spawnAtSeconds, 360);
  assert.equal(draft.objectives.extraction.appearsAtSeconds, 480);
  assert.equal(draft.objectives.extraction.sequence.type, 'helicopter-cinematic');
});

test('validateHmhLevelDraft requires player start, boss, and helicopter extraction before runtime use', () => {
  const empty = createBlankHmhLevelDraft();
  const emptyReport = validateHmhLevelDraft(empty);
  assert.equal(emptyReport.valid, false);
  assert.equal(emptyReport.errors.includes('missing-player-start'), true);
  assert.equal(emptyReport.errors.includes('missing-boss-marker'), true);
  assert.equal(emptyReport.errors.includes('missing-extraction-marker'), true);

  const playable = normalizeHmhLevelDraft({
    ...empty,
    markers: [
      { id: 'start-1', type: 'player-start', x: 4, y: 4 },
      { id: 'boss-1', type: 'boss', enemyId: 'rug-pull-baron', x: 64, y: 22, spawnAtSeconds: 360 },
      { id: 'heli-1', type: 'extraction-helicopter', x: 72, y: 28, appearsAtSeconds: 480 },
    ],
    placements: [
      { id: 'road-1', layer: 'ground', assetKey: 'final-paint/desert-road-main', x: 4, y: 5 },
      { id: 'wall-1', layer: 'barriers', shape: 'rect', x: 10, y: 10, width: 4, height: 1, solid: true },
    ],
  });
  const report = validateHmhLevelDraft(playable);
  assert.equal(report.valid, true);
  assert.deepEqual(report.errors, []);
});

test('asset palette groups existing runtime art into Justin-friendly editor categories', () => {
  const palette = buildHmhEditorAssetPalette();
  const groupIds = palette.groups.map((group) => group.id);
  for (const groupId of ['ground-tiles', 'water-tiles', 'roads-paths', 'trees', 'plants-bushes', 'buildings', 'barriers-collision', 'player-spawns', 'enemies', 'mini-bosses', 'bosses', 'objectives-extraction']) {
    assert.equal(groupIds.includes(groupId), true, `${groupId} group missing`);
  }
  assert.equal(HMH_LEVEL_EDITOR_ASSET_GROUPS.find((group) => group.id === 'trees').label, 'Trees');
  assert.equal(palette.assets.some((asset) => asset.groupId === 'ground-tiles' && asset.assetKey.includes('final-paint/')), true);
  assert.equal(palette.assets.some((asset) => asset.groupId === 'water-tiles'), true);
  assert.equal(palette.assets.some((asset) => asset.groupId === 'bosses' && asset.markerType === 'boss'), true);
});

test('asset palette preserves generated PNG preview metadata for thumbnail placement', () => {
  const palette = buildHmhEditorAssetPalette();
  const previewAssets = palette.assets.filter((asset) => asset.src && asset.src.endsWith('.png'));
  assert.ok(previewAssets.length >= 100, `expected many generated PNG assets, got ${previewAssets.length}`);
  const ground = previewAssets.find((asset) => asset.assetKey === 'final-paint/grass-handpaint-01');
  assert.equal(ground?.src, './assets/generated/hmh-level-one-ground/final-paint/grass-handpaint-01.png');
  assert.equal(ground?.width, 128);
  assert.equal(ground?.height, 64);
  const animatedTree = previewAssets.find((asset) => asset.assetKey === 'level1-final-animated/forest-wall-pine-sway');
  assert.equal(animatedTree?.animated, true);
  assert.equal(animatedTree?.frameWidth, 136);
  assert.equal(animatedTree?.frameHeight, 144);
});

test('asset palette imports the entire generated pixel-art library for placement', () => {
  assert.equal(HMH_LEVEL_EDITOR_GENERATED_MANIFESTS.length, 14);
  const sources = HMH_LEVEL_EDITOR_GENERATED_MANIFESTS.map((entry) => entry.source).sort();
  for (const requiredSource of [
    'hmh-level-three-ground/final-getaway',
    'hmh-coherent-world/level3-final-getaway',
    'hmh-coherent-world/level2-final-city',
    'hmh-final-animation-completion',
    'hmh-final-combat-vfx',
    'hmh-coherent-world/level-final-ambient',
    'pixellab-calibration/lester-hero-6d6e53e2',
  ]) {
    assert.equal(sources.includes(requiredSource), true, `${requiredSource} missing from generated library`);
  }
  const palette = buildHmhEditorAssetPalette();
  const previewAssets = palette.assets.filter((asset) => asset.src && asset.src.endsWith('.png'));
  assert.ok(previewAssets.length >= 240, `expected full pixel-art library, got ${previewAssets.length} PNG assets`);
  assert.equal(palette.assets.some((asset) => asset.source === 'hmh-coherent-world/level2-final-city' && asset.assetKey.includes('level2-final-city/')), true);
  assert.equal(palette.assets.some((asset) => asset.source === 'hmh-coherent-world/level3-final-getaway' && asset.assetKey.includes('level3-final-getaway/')), true);
  assert.equal(palette.assets.some((asset) => asset.source === 'hmh-final-combat-vfx' && asset.assetKey.includes('muzzle-flash')), true);
  assert.equal(palette.assets.some((asset) => asset.source === 'pixellab-calibration/lester-hero-6d6e53e2' && asset.assetKey.includes('lester-calibration')), true);
});

test('marker tools include player spawns, enemies, mini bosses, bosses, barriers, and helicopter extraction', () => {
  const types = HMH_LEVEL_EDITOR_MARKER_TOOLS.map((tool) => tool.type);
  for (const required of ['player-spawn', 'player-spawn-candidate', 'enemy-spawn', 'mini-boss', 'boss', 'barrier-rect', 'boundary-line', 'extraction-helicopter', 'player-start']) {
    assert.equal(types.includes(required), true, `${required} tool missing`);
  }
  assert.equal(HMH_LEVEL_EDITOR_MARKER_TOOLS.some((tool) => tool.type === 'player-spawn' && tool.primary === true), true);
});

test('player spawn markers support one primary spawn and alternate spawn candidates', () => {
  const draft = normalizeHmhLevelDraft({
    ...createBlankHmhLevelDraft({ levelId: 'level-1-crypto-wasteland' }),
    markers: [
      { id: 'spawn-primary', type: 'player-spawn', label: 'Opening Road Spawn', x: 8, y: 9, primary: true },
      { id: 'spawn-alt-forest', type: 'player-spawn-candidate', label: 'Forest Test Spawn', x: 20, y: 18 },
      { id: 'boss-1', type: 'boss', enemyId: 'rug-pull-baron', x: 50, y: 20 },
      { id: 'heli-1', type: 'extraction-helicopter', x: 60, y: 24 },
    ],
    placements: [
      { id: 'ground-1', layer: 'ground', assetKey: 'final-paint/grass-handpaint-01', x: 8, y: 9 },
      { id: 'barrier-1', layer: 'barriers', shape: 'rect', x: 8, y: 9, width: 4, height: 1, solid: true },
    ],
  });
  const validation = validateHmhLevelDraft(draft);
  assert.equal(validation.valid, true);
  assert.equal(validation.errors.includes('missing-player-start'), false);
  const report = createHermesHandoffReport(draft);
  assert.equal(report.objectives.hasPlayerStart, true);
  assert.equal(report.objectives.primaryPlayerSpawn.id, 'spawn-primary');
  assert.equal(report.objectives.playerSpawns.length, 2);
  assert.equal(report.objectives.playerSpawns.some((spawn) => spawn.id === 'spawn-alt-forest' && spawn.primary === false), true);
});

test('Hermes handoff report summarizes assets, blockers, and objective readiness', () => {
  const draft = normalizeHmhLevelDraft({
    ...createBlankHmhLevelDraft({ levelId: 'level-1-crypto-wasteland' }),
    markers: [
      { id: 'start-1', type: 'player-start', x: 4, y: 4 },
      { id: 'boss-1', type: 'boss', enemyId: 'rug-pull-baron', x: 50, y: 20 },
      { id: 'heli-1', type: 'extraction-helicopter', x: 60, y: 24 },
    ],
    boundaries: [
      { id: 'boundary-1', type: 'boundary-line', label: 'Outer map edge', points: [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 8 }], closed: false },
    ],
    placements: [
      { id: 'tree-1', layer: 'props', assetKey: 'sketch-level1/oak-tree-sway-00', groupId: 'trees', x: 12, y: 8 },
      { id: 'barrier-1', layer: 'barriers', shape: 'rect', x: 8, y: 9, width: 4, height: 1, solid: true },
    ],
  });
  const report = createHermesHandoffReport(draft);
  assert.equal(report.levelId, 'level-1-crypto-wasteland');
  assert.equal(report.validation.valid, true);
  assert.equal(report.assetUsage.totalPlacements, 2);
  assert.equal(report.assetUsage.groups.trees, 1);
  assert.equal(report.blockers.solidBarrierCount, 1);
  assert.equal(report.blockers.vectorBoundaryCount, 1);
  assert.equal(report.blockers.boundaryPointCount, 3);
  assert.equal(report.objectives.hasBoss, true);
  assert.equal(report.objectives.hasExtraction, true);
});

test('export bundle gives Justin a downloadable map file and repo path for Hermes polishing', () => {
  const draft = normalizeHmhLevelDraft({
    ...createBlankHmhLevelDraft({ levelId: 'level-1-crypto-wasteland', title: 'Forest River Test' }),
    markers: [
      { id: 'start-1', type: 'player-start', x: 4, y: 4 },
      { id: 'boss-1', type: 'boss', enemyId: 'rug-pull-baron', x: 50, y: 20 },
      { id: 'heli-1', type: 'extraction-helicopter', x: 60, y: 24 },
    ],
  });
  assert.equal(hmhLevelDraftFileName(draft), 'level-1-crypto-wasteland-forest-river-test.hmh-level.json');
  assert.equal(hmhLevelDraftFileName(draft, 'handoff'), 'level-1-crypto-wasteland-forest-river-test.hermes-handoff.json');
  const bundle = createHmhLevelExportBundle(draft);
  assert.equal(bundle.fileName, 'level-1-crypto-wasteland-forest-river-test.hmh-level.json');
  assert.equal(bundle.suggestedRepoPath, 'apps/portal/assets/levels/level-1-crypto-wasteland-forest-river-test.hmh-level.json');
  assert.equal(bundle.payload.levelId, 'level-1-crypto-wasteland');
  assert.equal(bundle.payload.hermesHandoff.validation.valid, true);
});

test('local dev-only editor page exists and dynamically loads the editor app only on localhost', () => {
  assert.equal(existsSync(editorHtmlPath), true);
  assert.equal(existsSync(editorJsPath), true);
  const html = readFileSync(editorHtmlPath, 'utf8');
  const js = readFileSync(editorJsPath, 'utf8');
  assert.equal(html.includes('Hard Money Heroes Level Builder'), true);
  assert.equal(html.includes("import('./src/hmh-level-editor-app.mjs')"), true);
  assert.equal(html.includes('LOCAL_DEV_HOSTS'), true);
  assert.equal(html.includes('LOCAL DEV TOOL'), true);
  assert.equal(html.includes('file:// cannot load the generated sprite asset library reliably'), true);
  assert.equal(html.includes('http://127.0.0.1:9944/editor.html'), true);
  assert.equal(html.includes("'::1'") && !html.includes("'::1', ''"), true);
  assert.equal(js.includes('localStorage'), true);
  assert.equal(js.includes('Export JSON'), true);
  assert.equal(js.includes('Hermes Handoff'), true);
  assert.equal(js.includes('downloadJsonFile'), true);
  assert.equal(js.includes('Autosave unavailable — use Export JSON'), true);
});

test('editor app exposes thumbnail asset cards, search, selected preview, undo, and drag/drop placement handlers', () => {
  const js = readFileSync(editorJsPath, 'utf8');
  const html = readFileSync(editorHtmlPath, 'utf8');
  assert.equal(html.includes('id="assetSearch"'), true);
  assert.equal(html.includes('id="assetCount"'), true);
  assert.equal(html.includes('id="selectedAssetPreview"'), true);
  assert.equal(html.includes('id="undoBtn"'), true);
  assert.equal(html.includes('value="ground-overlays"'), true);
  assert.equal(js.includes('asset-thumb'), true);
  assert.equal(js.includes('renderSelectedAssetPreview'), true);
  assert.equal(js.includes('filterAssetsForActiveGroup'), true);
  assert.equal(js.includes('const pool = query ? palette.assets'), true);
  assert.equal(js.includes('undoLastPlacement'), true);
  assert.equal(js.includes('nextEditorId'), true);
  assert.equal(js.includes('editorIdCounter += 1'), true);
  assert.equal(js.includes("nextEditorId('placement')"), true);
  assert.equal(js.includes('paintAtPointer'), true);
  assert.equal(js.includes('lastPaintTileKey'), true);
  assert.equal(js.includes('replaceGroundTileAt'), true);
  assert.equal(js.includes('drawGroundTileImage'), true);
  assert.equal(js.includes('drawBoundaryLine'), true);
  assert.equal(js.includes('addBoundaryPoint'), true);
  assert.equal(js.includes('handleKeyboardPan'), true);
  assert.equal(js.includes("event.key === 'ArrowLeft'"), true);
  assert.equal(js.includes('draggable = true'), true);
  assert.equal(js.includes("addEventListener('dragstart'"), true);
  assert.equal(js.includes("addEventListener('dragover'"), true);
  assert.equal(js.includes("addEventListener('drop'"), true);
  assert.equal(js.includes('drawPlacementImage'), true);
  assert.equal(js.includes('new Image()'), true);
  assert.equal(html.includes('Drag asset thumbnails onto the map'), true);
  assert.equal(html.includes('Click-drag on the map to paint'), true);
  assert.equal(html.includes('Arrow keys pan'), true);
});
