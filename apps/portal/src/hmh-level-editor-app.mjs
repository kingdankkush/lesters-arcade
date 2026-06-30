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
const state = {
  draft: loadDraft(),
  selectedGroupId: 'ground-tiles',
  selectedAsset: null,
  selectedMarkerTool: null,
  camera: { x: 0, y: 0, zoom: 1 },
  dragging: false,
  dragStart: null,
};

const els = {
  canvas: document.getElementById('editorCanvas'),
  groupTabs: document.getElementById('groupTabs'),
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.draft));
  els.saveStatus.textContent = `Autosaved ${new Date().toLocaleTimeString()}`;
  renderSidebars();
}

function groupColor(groupId) {
  return palette.groups.find((group) => group.id === groupId)?.color ?? '#94a3b8';
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

function drawPlacement(item) {
  const color = groupColor(item.groupId) || '#e2e8f0';
  drawDiamond(item.x, item.y, `${color}99`, true);
  const p = isoToScreen(item.x, item.y);
  ctx.fillStyle = '#fff';
  ctx.font = `${Math.max(9, 11 * state.camera.zoom)}px ui-monospace, monospace`;
  const label = String(item.label || item.assetKey || item.id).split('/').pop().slice(0, 10);
  ctx.fillText(label, p.x - 24, p.y - 20);
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
    btn.onclick = () => { state.selectedGroupId = group.id; state.selectedAsset = null; state.selectedMarkerTool = null; renderPalette(); };
    els.groupTabs.appendChild(btn);
  }
  els.assetList.innerHTML = '';
  const assets = palette.assets.filter((asset) => asset.groupId === state.selectedGroupId).slice(0, 180);
  for (const asset of assets) {
    const btn = document.createElement('button');
    btn.className = `asset ${state.selectedAsset?.assetKey === asset.assetKey ? 'active' : ''}`;
    const labelWrap = document.createElement('span');
    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    swatch.style.background = groupColor(asset.groupId);
    labelWrap.appendChild(swatch);
    labelWrap.append(` ${asset.label}`);
    const small = document.createElement('small');
    small.textContent = asset.assetKey;
    labelWrap.appendChild(small);
    const kind = document.createElement('span');
    kind.textContent = asset.markerType ? 'marker' : asset.layer ?? 'asset';
    btn.append(labelWrap, kind);
    btn.onclick = () => { state.selectedAsset = asset; state.selectedMarkerTool = null; els.activeLayer.value = activeLayerForAsset(asset); renderPalette(); renderMarkerTools(); };
    els.assetList.appendChild(btn);
  }
}

function renderMarkerTools() {
  els.markerTools.innerHTML = '';
  for (const tool of palette.markerTools) {
    const btn = document.createElement('button');
    btn.textContent = `${tool.icon} ${tool.label}`;
    btn.className = state.selectedMarkerTool?.type === tool.type ? 'active' : '';
    btn.onclick = () => { state.selectedMarkerTool = tool; state.selectedAsset = null; els.activeLayer.value = tool.groupId === 'barriers-collision' ? 'barriers' : (tool.groupId === 'objectives-extraction' || tool.groupId === 'player-spawns' ? 'objectives' : 'enemies'); renderPalette(); renderMarkerTools(); };
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
  state.draft = normalizeHmhLevelDraft({
    ...state.draft,
    placements: state.draft.placements.filter((item) => item.id !== id),
    markers: state.draft.markers.filter((item) => item.id !== id),
  });
  saveDraft();
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
      id: `${tool.type}-${Date.now().toString(36)}`,
      type: tool.type,
      label: tool.label,
      x: tile.x,
      y: tile.y,
      primary: tool.primary === true,
      enemyId: tool.enemyId ?? state.selectedAsset?.enemyId ?? null,
      spawnAtSeconds: tool.spawnAtSeconds ?? null,
      appearsAtSeconds: tool.appearsAtSeconds ?? null,
    };
    state.draft = normalizeHmhLevelDraft({ ...state.draft, markers: [...state.draft.markers, marker] });
  } else if (state.selectedAsset) {
    const asset = state.selectedAsset;
    const layer = activeLayerForAsset(asset);
    const placement = {
      id: `placement-${Date.now().toString(36)}`,
      layer,
      groupId: asset.groupId,
      assetKey: asset.assetKey,
      label: asset.label,
      x: tile.x,
      y: tile.y,
      solid: layer === 'barriers' || asset.groupId === 'barriers-collision',
      shape: layer === 'barriers' ? 'rect' : null,
      width: layer === 'barriers' ? 2 : null,
      height: layer === 'barriers' ? 1 : null,
    };
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

els.canvas.addEventListener('mousedown', (event) => {
  state.dragging = true;
  state.dragStart = { ...canvasPoint(event), camX: state.camera.x, camY: state.camera.y };
});
els.canvas.addEventListener('mousemove', (event) => {
  if (!state.dragging || state.selectedAsset || state.selectedMarkerTool) return;
  const p = canvasPoint(event);
  state.camera.x = state.dragStart.camX + p.x - state.dragStart.x;
  state.camera.y = state.dragStart.camY + p.y - state.dragStart.y;
});
els.canvas.addEventListener('mouseup', (event) => {
  const p = canvasPoint(event);
  const moved = state.dragStart ? Math.hypot(p.x - state.dragStart.x, p.y - state.dragStart.y) : 0;
  state.dragging = false;
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
els.newDraftBtn.onclick = () => {
  state.draft = normalizeHmhLevelDraft(createBlankHmhLevelDraft({ levelId: els.levelId.value, title: els.levelTitle.value || 'HMH Authored Level Draft' }));
  saveDraft();
  setValidationOutput();
};
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
  state.draft = normalizeHmhLevelDraft(JSON.parse(text));
  saveDraft();
  setValidationOutput();
};

renderPalette();
renderMarkerTools();
renderSidebars();
setValidationOutput();
requestAnimationFrame(renderCanvas);
