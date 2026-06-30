import {
  createBlankHmhLevelDraft,
  normalizeHmhLevelDraft,
  validateHmhLevelDraft,
  createHermesHandoffReport,
  createHmhLevelExportBundle,
  hmhLevelDraftFileName,
} from './hmh-level-editor-schema.mjs';
import { buildHmhEditorAssetPalette } from './hmh-level-editor-assets.mjs';

const STORAGE_KEY = 'hmh-level-builder-draft-v1';
const EDITOR_COMMAND_LABELS = Object.freeze(['Export JSON', 'Hermes Handoff']);
const palette = buildHmhEditorAssetPalette();
const imageCache = new Map();
let editorIdCounter = 0;
const state = {
  draft: loadDraft(),
  selectedGroupId: 'ground-tiles',
  selectedAsset: null,
  selectedMarkerTool: null,
  paletteSearch: '',
  camera: { x: 0, y: 0, zoom: 1 },
  dragging: false,
  painting: false,
  lastPaintTileKey: null,
  undoStack: [],
  dragStart: null,
};

const els = {
  canvas: document.getElementById('editorCanvas'),
  groupTabs: document.getElementById('groupTabs'),
  assetSearch: document.getElementById('assetSearch'),
  assetCount: document.getElementById('assetCount'),
  selectedAssetPreview: document.getElementById('selectedAssetPreview'),
  assetList: document.getElementById('assetList'),
  markerTools: document.getElementById('markerTools'),
  activeLayer: document.getElementById('activeLayer'),
  levelId: document.getElementById('levelId'),
  levelTitle: document.getElementById('levelTitle'),
  saveStatus: document.getElementById('saveStatus'),
  validationStatus: document.getElementById('validationStatus'),
  placementStats: document.getElementById('placementStats'),
  placementList: document.getElementById('placementList'),
  jsonOutput: document.getElementById('jsonOutput'),
  newDraftBtn: document.getElementById('newDraftBtn'),
  undoBtn: document.getElementById('undoBtn'),
  validateBtn: document.getElementById('validateBtn'),
  exportBtn: document.getElementById('exportBtn'),
  handoffBtn: document.getElementById('handoffBtn'),
  importBtn: document.getElementById('importBtn'),
  importInput: document.getElementById('importInput'),
};
const ctx = els.canvas.getContext('2d');

function loadDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalizeHmhLevelDraft(JSON.parse(raw));
  } catch (error) {
    console.warn('Failed to load HMH level draft', error);
  }
  return normalizeHmhLevelDraft(createBlankHmhLevelDraft({ title: 'Level 1 Hand Layout' }));
}

function saveDraft() {
  state.draft = normalizeHmhLevelDraft({ ...state.draft, levelId: els.levelId.value, title: els.levelTitle.value });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.draft));
    els.saveStatus.textContent = `Autosaved ${new Date().toLocaleTimeString()}`;
  } catch (error) {
    console.warn('HMH level editor autosave unavailable; use Export JSON to save your map.', error);
    els.saveStatus.textContent = 'Autosave unavailable — use Export JSON';
  }
  renderSidebars();
}

function nextEditorId(prefix) {
  editorIdCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${editorIdCounter.toString(36)}`;
}

function groupColor(groupId) {
  return palette.groups.find((group) => group.id === groupId)?.color ?? '#94a3b8';
}

function assetByKey(assetKey, groupId = null) {
  return palette.assets.find((asset) => asset.assetKey === assetKey && (!groupId || asset.groupId === groupId))
    ?? palette.assets.find((asset) => asset.assetKey === assetKey)
    ?? null;
}

function imageForAsset(assetLike = {}) {
  const src = assetLike.src;
  if (!src) return null;
  if (imageCache.has(src)) return imageCache.get(src);
  const image = new Image();
  image.decoding = 'async';
  image.onload = () => {};
  image.src = src;
  imageCache.set(src, image);
  return image;
}

function firstFrameMeta(item = {}) {
  return {
    frameWidth: Number(item.frameWidth || item.imageWidth || item.width || 96),
    frameHeight: Number(item.frameHeight || item.imageHeight || item.height || 96),
  };
}

function activeLayerForAsset(asset) {
  if (asset?.layer) return asset.layer;
  if (asset?.groupId === 'ground-tiles') return 'ground';
  if (asset?.groupId === 'roads-paths') return 'roads-paths';
  if (asset?.groupId === 'water-tiles') return 'water';
  if (asset?.groupId?.includes('boss') || asset?.groupId === 'enemies') return 'enemies';
  if (asset?.groupId === 'objectives-extraction' || asset?.groupId === 'player-spawns') return 'objectives';
  if (asset?.groupId === 'barriers-collision') return 'barriers';
  return els.activeLayer.value || 'props';
}

function assetMatchesSearch(asset, query) {
  if (!query) return true;
  const haystack = [asset.label, asset.assetKey, asset.role, asset.source, asset.layer, asset.groupId].filter(Boolean).join(' ').toLowerCase();
  return haystack.includes(query);
}

function filterAssetsForActiveGroup() {
  const query = state.paletteSearch.trim().toLowerCase();
  const pool = query ? palette.assets : palette.assets.filter((asset) => asset.groupId === state.selectedGroupId);
  return pool.filter((asset) => assetMatchesSearch(asset, query));
}

function renderSelectedAssetPreview() {
  const selected = state.selectedAsset;
  const tool = state.selectedMarkerTool;
  const thumb = document.createElement('span');
  thumb.className = 'selected-preview-thumb';
  const details = document.createElement('span');
  const title = document.createElement('strong');
  const meta = document.createElement('small');
  const hint = document.createElement('small');

  if (selected) {
    if (selected.src) {
      const img = document.createElement('img');
      img.src = selected.src;
      img.alt = selected.label;
      thumb.appendChild(img);
    } else {
      thumb.textContent = '◆';
    }
    title.textContent = selected.label;
    meta.textContent = selected.assetKey;
    hint.textContent = 'Click or drag on the map to place this asset.';
  } else if (tool) {
    thumb.textContent = tool.icon ?? '◎';
    title.textContent = tool.label;
    meta.textContent = tool.type;
    hint.textContent = 'Click the map to place this marker.';
  } else {
    thumb.textContent = '＋';
    title.textContent = 'Select an asset or marker';
    meta.textContent = 'Generated sprites appear below as draggable cards.';
    hint.textContent = 'Use search when the library gets long.';
  }
  details.append(title, meta, hint);
  els.selectedAssetPreview.replaceChildren(thumb, details);
}

function isoToScreen(x, y) {
  const tileW = 64 * state.camera.zoom;
  const tileH = 32 * state.camera.zoom;
  return {
    x: els.canvas.width / 2 + (x - y) * tileW / 2 + state.camera.x,
    y: 80 + (x + y) * tileH / 2 + state.camera.y,
  };
}

function screenToIso(px, py) {
  const tileW = 64 * state.camera.zoom;
  const tileH = 32 * state.camera.zoom;
  const sx = px - els.canvas.width / 2 - state.camera.x;
  const sy = py - 80 - state.camera.y;
  return {
    x: Math.round((sx / (tileW / 2) + sy / (tileH / 2)) / 2),
    y: Math.round((sy / (tileH / 2) - sx / (tileW / 2)) / 2),
  };
}

function drawDiamond(x, y, color, fill = true) {
  const p = isoToScreen(x, y);
  const w = 32 * state.camera.zoom;
  const h = 16 * state.camera.zoom;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y - h);
  ctx.lineTo(p.x + w, p.y);
  ctx.lineTo(p.x, p.y + h);
  ctx.lineTo(p.x - w, p.y);
  ctx.closePath();
  if (fill) { ctx.fillStyle = color; ctx.fill(); }
  ctx.strokeStyle = 'rgba(255,255,255,.18)';
  ctx.stroke();
}

function drawGrid() {
  const width = Math.min(96, state.draft.grid.width ?? 96);
  const height = Math.min(64, state.draft.grid.height ?? 64);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      drawDiamond(x, y, (x + y) % 2 === 0 ? 'rgba(30,41,59,.38)' : 'rgba(15,23,42,.38)', true);
    }
  }
}

function drawPlacementImage(item, asset) {
  const image = imageForAsset(item.src ? item : asset);
  if (!image || !image.complete || !image.naturalWidth) return false;
  const p = isoToScreen(item.x, item.y);
  const { frameWidth, frameHeight } = firstFrameMeta(item.src ? item : asset);
  const zoomScale = Math.max(0.45, Math.min(1.25, state.camera.zoom));
  const drawW = Math.max(24, frameWidth * zoomScale * (item.scale || 1));
  const drawH = Math.max(24, frameHeight * zoomScale * (item.scale || 1));
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, 0, 0, frameWidth, frameHeight, p.x - drawW / 2, p.y - drawH + 12, drawW, drawH);
  ctx.restore();
  return true;
}

function drawPlacement(item) {
  const asset = assetByKey(item.assetKey, item.groupId);
  const color = groupColor(item.groupId) || '#e2e8f0';
  drawDiamond(item.x, item.y, `${color}55`, true);
  const drewImage = drawPlacementImage(item, asset);
  const p = isoToScreen(item.x, item.y);
  if (!drewImage) {
    ctx.fillStyle = '#fff';
    ctx.font = `${Math.max(9, 11 * state.camera.zoom)}px ui-monospace, monospace`;
    const label = String(item.label || item.assetKey || item.id).split('/').pop().slice(0, 10);
    ctx.fillText(label, p.x - 24, p.y - 20);
  }
  if (item.solid || item.layer === 'barriers') {
    ctx.strokeStyle = '#ff5c5c';
    ctx.lineWidth = 2;
    ctx.strokeRect(p.x - 28, p.y - 18, 56, 36);
  }
}

function drawMarker(marker) {
  const tool = palette.markerTools.find((candidate) => candidate.type === marker.type);
  const p = isoToScreen(marker.x, marker.y);
  ctx.save();
  ctx.fillStyle = groupColor(tool?.groupId) || '#ffd166';
  ctx.beginPath(); ctx.arc(p.x, p.y - 12, 12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#020617'; ctx.font = 'bold 14px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(tool?.icon ?? '•', p.x, p.y - 12);
  ctx.fillStyle = '#fff'; ctx.font = '11px ui-monospace, monospace';
  ctx.fillText(marker.label || marker.type, p.x, p.y - 30);
  ctx.restore();
}

function renderCanvas() {
  ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
  drawGrid();
  for (const placement of state.draft.placements) drawPlacement(placement);
  for (const marker of state.draft.markers) drawMarker(marker);
  requestAnimationFrame(renderCanvas);
}

function renderPalette() {
  els.groupTabs.innerHTML = '';
  for (const group of palette.groups) {
    const btn = document.createElement('button');
    btn.textContent = group.label;
    btn.className = group.id === state.selectedGroupId ? 'active' : '';
    btn.onclick = () => { state.selectedGroupId = group.id; state.selectedAsset = null; state.selectedMarkerTool = null; renderPalette(); renderSelectedAssetPreview(); };
    els.groupTabs.appendChild(btn);
  }
  els.assetList.innerHTML = '';
  const allGroupAssets = filterAssetsForActiveGroup();
  const assets = allGroupAssets.slice(0, 180);
  els.assetCount.textContent = `${assets.length}/${allGroupAssets.length}`;
  for (const asset of assets) {
    const btn = document.createElement('button');
    btn.className = `asset ${state.selectedAsset?.assetKey === asset.assetKey ? 'active' : ''}`;
    btn.draggable = true;
    btn.title = `Drag ${asset.label} onto the map`;

    const thumb = document.createElement('span');
    thumb.className = `asset-thumb ${asset.src ? '' : 'placeholder'}`.trim();
    thumb.style.borderColor = groupColor(asset.groupId);
    if (asset.src) {
      const img = document.createElement('img');
      img.src = asset.src;
      img.alt = asset.label;
      img.loading = 'lazy';
      img.decoding = 'async';
      thumb.appendChild(img);
      imageForAsset(asset);
    } else {
      thumb.textContent = asset.markerType ? '◎' : '◆';
      thumb.style.background = groupColor(asset.groupId);
    }

    const labelWrap = document.createElement('span');
    labelWrap.className = 'asset-label';
    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    swatch.style.background = groupColor(asset.groupId);
    const title = document.createElement('span');
    title.textContent = asset.label;
    labelWrap.append(swatch, title);

    const small = document.createElement('small');
    small.textContent = asset.assetKey;
    const kind = document.createElement('small');
    kind.textContent = asset.animated ? 'animated sprite' : (asset.markerType ? 'marker' : asset.layer ?? 'asset');
    btn.append(thumb, labelWrap, small, kind);
    btn.onclick = () => { state.selectedAsset = asset; state.selectedMarkerTool = null; els.activeLayer.value = activeLayerForAsset(asset); renderPalette(); renderMarkerTools(); renderSelectedAssetPreview(); };
    btn.addEventListener('dragstart', (event) => {
      state.selectedAsset = asset;
      state.selectedMarkerTool = null;
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData('application/x-hmh-asset-key', asset.assetKey);
      event.dataTransfer.setData('text/plain', asset.assetKey);
      els.activeLayer.value = activeLayerForAsset(asset);
      renderSelectedAssetPreview();
    });
    els.assetList.appendChild(btn);
  }
  if (!assets.length) {
    const empty = document.createElement('p');
    empty.className = 'stats';
    empty.textContent = 'No assets match this search in the active group.';
    els.assetList.appendChild(empty);
  }
}

function renderMarkerTools() {
  els.markerTools.innerHTML = '';
  for (const tool of palette.markerTools) {
    const btn = document.createElement('button');
    btn.textContent = `${tool.icon} ${tool.label}`;
    btn.className = state.selectedMarkerTool?.type === tool.type ? 'active' : '';
    btn.onclick = () => { state.selectedMarkerTool = tool; state.selectedAsset = null; els.activeLayer.value = tool.groupId === 'barriers-collision' ? 'barriers' : (tool.groupId === 'objectives-extraction' || tool.groupId === 'player-spawns' ? 'objectives' : 'enemies'); renderPalette(); renderMarkerTools(); renderSelectedAssetPreview(); };
    els.markerTools.appendChild(btn);
  }
}

function renderSidebars() {
  els.levelId.value = state.draft.levelId;
  els.levelTitle.value = state.draft.title;
  const report = validateHmhLevelDraft(state.draft);
  els.placementStats.textContent = `Placements: ${state.draft.placements.length} | Markers: ${state.draft.markers.length} | Barriers: ${report.counts.barriers}`;
  els.placementList.innerHTML = '';
  [...state.draft.markers, ...state.draft.placements].slice(-24).reverse().forEach((item) => {
    const row = document.createElement('div');
    row.className = 'placement-row';
    const label = document.createElement('span');
    label.textContent = `${item.type || item.layer}: ${item.label || item.assetKey || item.id}`;
    row.appendChild(label);
    const del = document.createElement('button');
    del.textContent = 'Delete';
    del.onclick = () => deleteById(item.id);
    row.appendChild(del);
    els.placementList.appendChild(row);
  });
}

function setValidationOutput() {
  const report = validateHmhLevelDraft(state.draft);
  els.validationStatus.className = `stats status ${report.valid ? 'good' : 'bad'}`;
  els.validationStatus.textContent = `${report.valid ? 'Ready for Hermes scan' : 'Needs markers before runtime use'} | Errors: ${report.errors.join(', ') || 'none'} | Warnings: ${report.warnings.join(', ') || 'none'}`;
}

function deleteById(id) {
  state.undoStack = state.undoStack.filter((action) => action.id !== id);
  state.draft = normalizeHmhLevelDraft({
    ...state.draft,
    placements: state.draft.placements.filter((item) => item.id !== id),
    markers: state.draft.markers.filter((item) => item.id !== id),
  });
  saveDraft();
}

function undoLastPlacement() {
  const lastAction = state.undoStack.pop();
  if (!lastAction) return;
  state.draft = normalizeHmhLevelDraft({
    ...state.draft,
    markers: lastAction.kind === 'marker' ? state.draft.markers.filter((item) => item.id !== lastAction.id) : state.draft.markers,
    placements: lastAction.kind === 'placement' ? state.draft.placements.filter((item) => item.id !== lastAction.id) : state.draft.placements,
  });
  saveDraft();
  setValidationOutput();
}

function nearestId(tile) {
  const combined = [...state.draft.markers, ...state.draft.placements];
  let best = null;
  for (const item of combined) {
    const d = Math.hypot((item.x ?? 0) - tile.x, (item.y ?? 0) - tile.y);
    if (d <= 2 && (!best || d < best.d)) best = { id: item.id, d };
  }
  return best?.id ?? null;
}

function placeAt(tile) {
  if (state.selectedMarkerTool) {
    const tool = state.selectedMarkerTool;
    const marker = {
      id: nextEditorId(tool.type),
      type: tool.type,
      label: tool.label,
      x: tile.x,
      y: tile.y,
      primary: tool.primary === true,
      enemyId: tool.enemyId ?? state.selectedAsset?.enemyId ?? null,
      spawnAtSeconds: tool.spawnAtSeconds ?? null,
      appearsAtSeconds: tool.appearsAtSeconds ?? null,
    };
    state.undoStack.push({ kind: 'marker', id: marker.id });
    state.draft = normalizeHmhLevelDraft({ ...state.draft, markers: [...state.draft.markers, marker] });
  } else if (state.selectedAsset) {
    const asset = state.selectedAsset;
    const layer = activeLayerForAsset(asset);
    const placement = {
      id: nextEditorId('placement'),
      layer,
      groupId: asset.groupId,
      assetKey: asset.assetKey,
      src: asset.src ?? null,
      label: asset.label,
      x: tile.x,
      y: tile.y,
      imageWidth: asset.width ?? null,
      imageHeight: asset.height ?? null,
      frameWidth: asset.frameWidth ?? asset.width ?? null,
      frameHeight: asset.frameHeight ?? asset.height ?? null,
      frames: asset.frames ?? null,
      animated: Boolean(asset.animated),
      solid: layer === 'barriers' || asset.groupId === 'barriers-collision',
      shape: layer === 'barriers' ? 'rect' : null,
      width: layer === 'barriers' ? 2 : null,
      height: layer === 'barriers' ? 1 : null,
    };
    state.undoStack.push({ kind: 'placement', id: placement.id });
    state.draft = normalizeHmhLevelDraft({ ...state.draft, placements: [...state.draft.placements, placement] });
  }
  saveDraft();
}

function canvasPoint(event) {
  const rect = els.canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (els.canvas.width / rect.width),
    y: (event.clientY - rect.top) * (els.canvas.height / rect.height),
  };
}

function paintAtPointer(event) {
  const p = canvasPoint(event);
  const tile = screenToIso(p.x, p.y);
  const tileKey = `${tile.x},${tile.y}`;
  if (tileKey === state.lastPaintTileKey) return;
  state.lastPaintTileKey = tileKey;
  placeAt(tile);
}

els.canvas.addEventListener('mousedown', (event) => {
  state.dragging = true;
  state.dragStart = { ...canvasPoint(event), camX: state.camera.x, camY: state.camera.y };
  state.lastPaintTileKey = null;
  state.painting = Boolean(state.selectedAsset && !event.shiftKey);
  if (state.painting) paintAtPointer(event);
});
els.canvas.addEventListener('mousemove', (event) => {
  if (!state.dragging) return;
  if (state.painting) {
    paintAtPointer(event);
    return;
  }
  if (state.selectedAsset || state.selectedMarkerTool) return;
  const p = canvasPoint(event);
  state.camera.x = state.dragStart.camX + p.x - state.dragStart.x;
  state.camera.y = state.dragStart.camY + p.y - state.dragStart.y;
});
els.canvas.addEventListener('mouseup', (event) => {
  const p = canvasPoint(event);
  const moved = state.dragStart ? Math.hypot(p.x - state.dragStart.x, p.y - state.dragStart.y) : 0;
  const wasPainting = state.painting;
  state.dragging = false;
  state.painting = false;
  state.lastPaintTileKey = null;
  if (wasPainting) return;
  if (moved > 4 && !state.selectedAsset && !state.selectedMarkerTool) return;
  const tile = screenToIso(p.x, p.y);
  if (event.shiftKey) {
    const id = nearestId(tile);
    if (id) deleteById(id);
    return;
  }
  placeAt(tile);
});
els.canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  state.camera.zoom = Math.max(0.4, Math.min(2.2, state.camera.zoom + (event.deltaY > 0 ? -0.08 : 0.08)));
}, { passive: false });

els.canvas.addEventListener('dragover', (event) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'copy';
});
els.canvas.addEventListener('drop', (event) => {
  event.preventDefault();
  const assetKey = event.dataTransfer.getData('application/x-hmh-asset-key') || event.dataTransfer.getData('text/plain');
  const asset = assetByKey(assetKey);
  if (!asset) return;
  state.selectedAsset = asset;
  state.selectedMarkerTool = null;
  els.activeLayer.value = activeLayerForAsset(asset);
  const p = canvasPoint(event);
  placeAt(screenToIso(p.x, p.y));
  renderPalette();
  renderMarkerTools();
});

function downloadJsonFile(fileName, payload) {
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  els.saveStatus.textContent = `Downloaded ${fileName}`;
}

els.levelId.addEventListener('change', saveDraft);
els.levelTitle.addEventListener('input', saveDraft);
els.assetSearch.addEventListener('input', () => {
  state.paletteSearch = els.assetSearch.value;
  renderPalette();
});
els.newDraftBtn.onclick = () => {
  state.undoStack = [];
  state.draft = normalizeHmhLevelDraft(createBlankHmhLevelDraft({ levelId: els.levelId.value, title: els.levelTitle.value || 'HMH Authored Level Draft' }));
  saveDraft();
  setValidationOutput();
};
els.undoBtn.onclick = undoLastPlacement;
els.validateBtn.onclick = setValidationOutput;
els.exportBtn.onclick = () => {
  const bundle = createHmhLevelExportBundle(state.draft);
  els.jsonOutput.value = JSON.stringify(bundle.payload, null, 2);
  downloadJsonFile(bundle.fileName, bundle.payload);
  saveDraft();
};
els.handoffBtn.onclick = () => {
  const report = createHermesHandoffReport(state.draft);
  els.jsonOutput.value = JSON.stringify(report, null, 2);
  downloadJsonFile(hmhLevelDraftFileName(state.draft, 'handoff'), report);
};
els.importBtn.onclick = () => els.importInput.click();
els.importInput.onchange = async () => {
  const file = els.importInput.files?.[0];
  if (!file) return;
  const text = await file.text();
  state.undoStack = [];
  state.draft = normalizeHmhLevelDraft(JSON.parse(text));
  saveDraft();
  setValidationOutput();
};

renderPalette();
renderMarkerTools();
renderSelectedAssetPreview();
renderSidebars();
setValidationOutput();
requestAnimationFrame(renderCanvas);
