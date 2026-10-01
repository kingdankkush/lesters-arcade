#!/usr/bin/env node
// Ten-area collision-to-art audit (2.1 COLLISION-ART lane).
//
// Every drawn card that reads as something you cannot walk through (a
// building, structure, vehicle, barrier, wall, container, large prop, big rock
// or tree trunk taller than about 1.2 m) is projected to its painted ground
// footprint from the HD kit manifest (`groundFootprintPixels`, frame anchor and
// the card's placement scale) and checked against the authored collision
// blockers. Findings:
//   walk-over        a blocking-class card with less than 70% of its footprint
//                    under a blocker (the hero walks over the art);
//   overhang         a blocking-class card whose painted footprint reaches more
//                    than 24 units past the blocker under it;
//   invisible-wall   a blocker with less than 70% of its area under drawn art;
//   blocker-overhang a decorated blocker reaching more than 24 units past its
//                    art (a strip of invisible wall).
// Grass, flowers, shrubs, ferns, low debris, motorcycles, rails, floors and
// overhead gantries are exempt by policy (they never block).
//
// Pure data: plans are created from the authored greybox world exactly as the
// real-game binding does; nothing here touches Pixi, the network or rules.
// CLI: node scripts/audit-ten-area-collision-art.mjs [--out DIR] [--no-png]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { createGreyboxWorld } from '../apps/hmh-reboot/src/dev/greybox-world-v1.mjs';
import { createWorldV2RuntimeWorld } from '../apps/hmh-reboot/src/world-v2-runtime-world.mjs';
import { validateAreaArtPlan, cardGroundPixels, seatCardAnchorY, seatSolidCardY } from '../apps/hmh-reboot/src/world-v2-area-art-schema.mjs';
import { createWorldMassesArtPlan } from '../apps/hmh-reboot/src/world-v2-area-plans/district-terrain.mjs';
import { CARD_BLOCKING_HEIGHT, CARD_COLLISION_CLASSES, cardBlocks, cardCollisionClass, trunkHalfWidth } from '../apps/hmh-reboot/src/world-v2-area-plans/card-footprints.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const KIT_MANIFEST_PATH = path.join(ROOT, 'apps/portal/assets/generated/hmh-reboot-tripo-props-hd/hmh-tripo-props-hd.json');
export const DEFAULT_RECEIPT_DIR = path.join(ROOT, 'docs/2.0/receipts/collision-art-20261001');
export const BLOCKING_HEIGHT = CARD_BLOCKING_HEIGHT;
export const COVERAGE_MINIMUM = 0.7;
export const MISMATCH_TOLERANCE = 24;
const SAMPLE = 8;

export { CARD_COLLISION_CLASSES as COLLISION_ART_CLASSES };
const collisionClassFor = cardCollisionClass;

export function loadKitManifest(file = KIT_MANIFEST_PATH) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

// ---- geometry ----
const pointInPolygon = (x, y, v) => {
  let inside = false;
  for (let i = 0, j = v.length - 1; i < v.length; j = i++) {
    if ((v[i].y > y) !== (v[j].y > y) && x < (v[j].x - v[i].x) * (y - v[i].y) / (v[j].y - v[i].y) + v[i].x) inside = !inside;
  }
  return inside;
};
const segDistance = (x, y, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / l)) : 0;
  return Math.hypot(x - (a.x + dx * t), y - (a.y + dy * t));
};
const edgeDistance = (x, y, v) => { let best = Infinity; for (let i = 0; i < v.length; i++) best = Math.min(best, segDistance(x, y, v[i], v[(i + 1) % v.length])); return best; };
const boundsOf = (v) => ({ minX: Math.min(...v.map(p => p.x)), minY: Math.min(...v.map(p => p.y)), maxX: Math.max(...v.map(p => p.x)), maxY: Math.max(...v.map(p => p.y)) });
const rect = (minX, minY, maxX, maxY) => [{ x: minX, y: minY }, { x: maxX, y: minY }, { x: maxX, y: maxY }, { x: minX, y: maxY }];
const round = (n) => Math.round(n * 100) / 100;

function shapeVertices(shape) {
  if (shape.type === 'polygon') return shape.vertices;
  if (shape.type === 'circle') return Array.from({ length: 16 }, (_, i) => ({ x: shape.x + Math.cos(i / 16 * Math.PI * 2) * shape.radius, y: shape.y + Math.sin(i / 16 * Math.PI * 2) * shape.radius }));
  return null;
}

// Spatial index over polygons for "is this point inside any of them".
function createPolygonIndex(rows) {
  const cell = 256, cells = new Map();
  rows.forEach((row, i) => {
    const b = row.bounds;
    for (let y = Math.floor(b.minY / cell); y <= Math.floor(b.maxY / cell); y++) for (let x = Math.floor(b.minX / cell); x <= Math.floor(b.maxX / cell); x++) {
      const key = `${x}:${y}`; if (!cells.has(key)) cells.set(key, []); cells.get(key).push(i);
    }
  });
  const near = (x, y) => cells.get(`${Math.floor(x / cell)}:${Math.floor(y / cell)}`) ?? [];
  const containing = (x, y) => near(x, y).filter(i => { const b = rows[i].bounds; return x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY && pointInPolygon(x, y, rows[i].vertices); });
  const inside = (x, y) => containing(x, y).length > 0;
  // Distance to the nearest polygon edge among polygons within `reach`.
  const distance = (x, y, reach = 400) => {
    let best = Infinity;
    const seen = new Set();
    for (let gy = Math.floor((y - reach) / cell); gy <= Math.floor((y + reach) / cell); gy++) for (let gx = Math.floor((x - reach) / cell); gx <= Math.floor((x + reach) / cell); gx++) {
      for (const i of cells.get(`${gx}:${gy}`) ?? []) { if (seen.has(i)) continue; seen.add(i); best = Math.min(best, edgeDistance(x, y, rows[i].vertices)); }
    }
    return best;
  };
  return { rows, containing, inside, distance };
}

function samplePolygon(vertices, step = SAMPLE) {
  const b = boundsOf(vertices), points = [];
  for (let y = b.minY + step / 2; y < b.maxY; y += step) for (let x = b.minX + step / 2; x < b.maxX; x += step) if (pointInPolygon(x, y, vertices)) points.push({ x, y });
  if (!points.length) points.push({ x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 });
  return points;
}

// ---- card projection ----
// A card with frame-pixel scale (sx, sy), anchored at world (x, y): its
// painted ground footprint and its screen silhouette laid on the ground plane.
export function projectCard(item, { x, y, sx, sy = sx, flip = false, groundZ = 0 }) {
  const ax = item.anchor.x * item.frame.w, ay = item.anchor.y * item.frame.h;
  const map = (px, py) => ({ x: x + (flip ? -(px - ax) : px - ax) * sx, y: y + (py - ay) * sy });
  const g = cardGroundPixels(item), ax0 = item.anchor.x * item.frame.w, ay0 = item.anchor.y * item.frame.h;
  const footprint = boundsOf([map(g.left + ax0, g.back + ay0), map(g.right + ax0, g.front + ay0)]);
  const a = item.alphaBounds, corners = [map(a.x, a.y), map(a.x + a.w, a.y + a.h)];
  const silhouette = { minX: Math.min(corners[0].x, corners[1].x), maxX: Math.max(corners[0].x, corners[1].x), minY: Math.min(corners[0].y, corners[1].y) - groundZ, maxY: Math.max(corners[0].y, corners[1].y) - groundZ };
  return { footprint, silhouette, width: a.w * sx, height: a.h * sy };
}

// Blocking footprint: the painted footprint, or a trunk/pole square at the anchor.
function blockingFootprint(kind, card, at, height) {
  if (kind === 'tree' || kind === 'pole') {
    // The trunk square stops where the card stops painting ground.
    const t = trunkHalfWidth(kind, height);
    return { minX: at.x - t, minY: at.y - t, maxX: at.x + t, maxY: Math.min(at.y + t, card.footprint.maxY) };
  }
  return card.footprint;
}

// Every drawn card in the ten-area world: plan props and decorated solids.
export async function collectTenAreaCards({ authored = createGreyboxWorld(), kit = loadKitManifest() } = {}) {
  const runtime = createWorldV2RuntimeWorld({ authored });
  const items = new Map(kit.items.map(item => [item.assetId, item]));
  const pieceById = new Map(authored.pieces.map(piece => [piece.id, piece]));
  const plans = [];
  for (const [areaId, district] of Object.entries(runtime.artPlans.districts)) {
    if (district.artTarget?.kind !== 'area-art-plan') throw new Error(`${areaId} has no area-art plan`);
    plans.push({ planId: areaId, plan: (await district.artTarget.load())(authored) });
  }
  plans.push({ planId: 'world-roads', plan: (await runtime.artPlans.roads.load())(authored) });
  plans.push({ planId: 'world-masses', plan: createWorldMassesArtPlan(authored) });
  const cards = [], solidStyles = new Map();
  for (const { planId, plan } of plans) {
    const summary = validateAreaArtPlan(plan, kit);
    for (const prop of summary.props) {
      const item = items.get(prop.source), kind = collisionClassFor(prop.source);
      const s = prop.height / item.alphaBounds.h;
      const card = projectCard(item, { x: prop.x, y: prop.y, sx: s, flip: prop.flip, groundZ: prop.groundZ });
      cards.push({ id: prop.id, planId, kind: 'prop', rawX: prop.x, rawY: prop.y, source: prop.source, name: item.name, collisionClass: kind, blocks: cardBlocks(prop.source, prop.height), x: round(prop.x), y: round(prop.y), height: round(prop.height), groundZ: prop.groundZ, flip: prop.flip, footprint: blockingFootprint(kind, card, prop, prop.height), paintedFootprint: card.footprint, silhouette: card.silhouette });
    }
    for (const solid of summary.solids) {
      const piece = pieceById.get(solid.pieceId);
      if (!piece?.blocker) continue;
      solidStyles.set(piece.blocker.id, { planId, style: solid.style, massAlpha: solid.massAlpha, source: solid.card?.source ?? null });
      if (!solid.card) continue;
      const item = items.get(solid.card.source), b = piece.visible.bounds, w = b.maxX - b.minX, d = b.maxY - b.minY, h = solid.height ?? piece.visible.height, cx = (b.minX + b.maxX) / 2;
      const kind = collisionClassFor(solid.card.source);
      if (solid.style === 'card') {
        const s = solid.card.fit === 'width' ? w / item.alphaBounds.w : solid.card.fit === 'depth' ? d / item.alphaBounds.w : (h + d * 0.45) / item.alphaBounds.h;
        const anchorY = seatSolidCardY(item, b, s), card = projectCard(item, { x: cx, y: anchorY, sx: s, groundZ: solid.card.lift });
        cards.push({ id: `solid:${piece.id}`, planId, kind: 'solid-card', pieceId: piece.id, source: solid.card.source, name: item.name, collisionClass: kind, blocks: true, fit: solid.card.fit, x: round(cx), y: round(anchorY), height: round(item.alphaBounds.h * s), footprint: blockingFootprint(kind, card, { x: cx, y: anchorY }, item.alphaBounds.h * s), paintedFootprint: card.footprint, silhouette: card.silhouette, massAlpha: solid.massAlpha });
      } else if (solid.style === 'hedge') {
        const vertical = d > w, length = vertical ? d : w, spacing = solid.spacing || 120, count = Math.max(1, Math.ceil(length / spacing)), step = length / count;
        for (let i = 0; i < count; i++) {
          const x = vertical ? cx : b.minX + (i + 0.5) * step, y = Math.min(vertical ? b.minY + (i + 1) * step : b.maxY, b.maxY);
          const sx = (vertical ? Math.max(w, step * 0.9) : step * 1.12) / item.alphaBounds.w, sy = (h + (vertical ? step * 0.35 : 0)) / item.alphaBounds.h;
          const card = projectCard(item, { x, y: seatCardAnchorY(item, y, sy), sx, sy, flip: i % 2 === 1 });
          cards.push({ id: `solid:${piece.id}:${i}`, planId, kind: 'solid-hedge', pieceId: piece.id, source: solid.card.source, name: item.name, collisionClass: kind, blocks: true, x: round(x), y: round(y), height: round(item.alphaBounds.h * sy), footprint: card.footprint, paintedFootprint: card.footprint, silhouette: card.silhouette, massAlpha: solid.massAlpha });
        }
      }
    }
  }
  return { authored, runtime, kit, plans, cards, solidStyles };
}

// Art coverage of a blocker: the decorated solid's own art, a prop card bound
// to it, or (for any blocker no plan claims) the production slab drawn from
// its own shape.
function blockerArt(blocker, piece, solidStyles, cardsByPiece, cardsByBlocker) {
  const style = solidStyles.get(blocker.id);
  if (piece?.visible?.artPlanId) return { kind: 'prop-card', regions: (cardsByBlocker.get(blocker.id) ?? []).map(card => card.silhouette), full: false };
  if (!style) return { kind: 'production-slab', regions: [], full: true };
  if (['mass', 'bank', 'stakes', 'crates', 'pickets'].includes(style.style)) return { kind: `solid-${style.style}`, regions: [], full: true };
  const regions = (cardsByPiece.get(piece.id) ?? []).map(card => card.silhouette);
  return { kind: `solid-${style.style}`, regions, full: style.massAlpha >= 0.3 };
}

export async function auditTenAreaCollisionArt(options = {}) {
  const collected = await collectTenAreaCards(options);
  const { authored, runtime, cards, solidStyles } = collected;
  const pieceByBlockerId = new Map(authored.pieces.filter(piece => piece.blocker).map(piece => [piece.blocker.id, piece]));
  const blockerRows = runtime.collisionBlockers.map(blocker => { const vertices = shapeVertices(blocker.shape); return { id: blocker.id, vertices, bounds: boundsOf(vertices), blocker }; });
  const index = createPolygonIndex(blockerRows);
  const findings = [];
  const cardResults = [];
  const cardsByPiece = new Map(), cardsByBlocker = new Map();
  for (const card of cards) if (card.pieceId) { if (!cardsByPiece.has(card.pieceId)) cardsByPiece.set(card.pieceId, []); cardsByPiece.get(card.pieceId).push(card); }
  // Blocking-class cards against the blockers.
  for (const card of cards) {
    if (!card.blocks) continue;
    const f = card.footprint, samples = samplePolygon(rect(f.minX, f.minY, f.maxX, f.maxY));
    let covered = 0, overhang = 0;
    const under = new Set();
    for (const p of samples) {
      const hits = index.containing(p.x, p.y);
      if (hits.length) { covered++; for (const i of hits) under.add(blockerRows[i].id); } else overhang = Math.max(overhang, Math.min(index.distance(p.x, p.y), 9999));
    }
    const coverage = covered / samples.length;
    const result = { id: card.id, planId: card.planId, kind: card.kind, source: card.source, name: card.name, collisionClass: card.collisionClass, x: card.x, y: card.y, height: card.height, groundZ: card.groundZ ?? 0, footprint: mapBounds(f), coverage: round(coverage), overhang: round(overhang), blockerIds: [...under].sort() };
    cardResults.push(result);
    if (coverage < COVERAGE_MINIMUM) findings.push({ type: 'walk-over', ...result });
    else if (overhang > MISMATCH_TOLERANCE) findings.push({ type: 'overhang', ...result });
  }
  // A prop blocker's art is the plan card it was authored under (same plan,
  // source and anchor to 0.1 unit), exactly as the area-art binding claims it.
  const propKey = (planId, source, x, y) => `${planId}:${source}:${Math.round(x * 10)}:${Math.round(y * 10)}`;
  const propCards = new Map(cards.filter(card => card.kind === 'prop').map(card => [propKey(card.planId, card.source, card.rawX, card.rawY), card]));
  for (const piece of authored.pieces) {
    const art = piece.visible?.artProp, card = art && propCards.get(propKey(piece.visible.artPlanId, art.source, art.x, art.y));
    if (card) cardsByBlocker.set(piece.blocker.id, [card]);
  }
  // Blockers against their art.
  const blockerResults = [];
  for (const row of blockerRows) {
    const piece = pieceByBlockerId.get(row.id) ?? null;
    const art = blockerArt(row.blocker, piece, solidStyles, cardsByPiece, cardsByBlocker);
    const record = { id: row.id, areaId: piece?.visible?.areaId ?? null, artPlanId: piece?.visible?.artPlanId ?? null, art: art.kind, bounds: mapBounds(row.bounds), maxZ: Number.isFinite(row.blocker.maxZ) ? row.blocker.maxZ : null, combatCover: row.blocker.combatCover, coverKind: row.blocker.coverKind };
    if (art.full) { blockerResults.push({ ...record, coverage: 1, overhang: 0 }); continue; }
    const samples = samplePolygon(row.vertices);
    let covered = 0, overhang = 0;
    for (const p of samples) {
      const inArt = art.regions.some(r => p.x >= r.minX && p.x <= r.maxX && p.y >= r.minY && p.y <= r.maxY);
      if (inArt) covered++;
      else overhang = Math.max(overhang, Math.min(...art.regions.map(r => Math.hypot(Math.max(r.minX - p.x, 0, p.x - r.maxX), Math.max(r.minY - p.y, 0, p.y - r.maxY))), 9999));
    }
    const result = { ...record, coverage: round(covered / samples.length), overhang: round(overhang) };
    blockerResults.push(result);
    if (result.coverage < COVERAGE_MINIMUM) findings.push({ type: 'invisible-wall', ...result });
    else if (result.overhang > MISMATCH_TOLERANCE) findings.push({ type: 'blocker-overhang', ...result });
  }
  const unclassified = [...new Set(cards.filter(card => card.collisionClass === 'unclassified').map(card => card.source))].sort();
  for (const source of unclassified) findings.push({ type: 'unclassified-source', source });
  const counts = {};
  for (const finding of findings) counts[finding.type] = (counts[finding.type] ?? 0) + 1;
  const areaOf = (x, y) => runtime.districts.find(d => x >= d.area.minX && x <= d.area.maxX && y >= d.area.minY && y <= d.area.maxY)?.id ?? null;
  for (const finding of findings) if (finding.x !== undefined) finding.areaId = areaOf(finding.x, finding.y); else if (finding.bounds) finding.areaId ??= areaOf((finding.bounds.minX + finding.bounds.maxX) / 2, (finding.bounds.minY + finding.bounds.maxY) / 2);
  return {
    schema: 'hmh-ten-area-collision-art-audit/v1',
    world: { id: runtime.id, version: runtime.version, blockers: runtime.collisionBlockers.length, pieces: authored.pieces.length },
    policy: { blockingHeight: BLOCKING_HEIGHT, coverageMinimum: COVERAGE_MINIMUM, mismatchTolerance: MISMATCH_TOLERANCE, sampleStep: SAMPLE, classes: CARD_COLLISION_CLASSES },
    cards: { total: cards.length, blocking: cardResults.length, exempt: cards.length - cardResults.length },
    counts,
    findings: findings.sort((a, b) => (a.type < b.type ? -1 : a.type > b.type ? 1 : (a.id ?? a.source) < (b.id ?? b.source) ? -1 : 1)),
    cardResults,
    blockerResults,
    _collected: collected,
  };
}
const mapBounds = (b) => ({ minX: round(b.minX), minY: round(b.minY), maxX: round(b.maxX), maxY: round(b.maxY) });

// ---- overlay PNGs ----
export async function writeOverlays(audit, outDir, { scale = 0.2 } = {}) {
  const { PNG } = await import('pngjs');
  const { runtime, cards } = audit._collected;
  const written = [];
  const findingIds = new Map(audit.findings.filter(f => f.id).map(f => [f.id, f.type]));
  for (const district of runtime.districts) {
    const margin = 240, b = { minX: district.area.minX - margin, minY: district.area.minY - margin, maxX: district.area.maxX + margin, maxY: district.area.maxY + margin };
    const W = Math.round((b.maxX - b.minX) * scale), H = Math.round((b.maxY - b.minY) * scale);
    const png = new PNG({ width: W, height: H });
    const set = (px, py, [r, g, bl], a = 1) => { if (px < 0 || py < 0 || px >= W || py >= H) return; const o = (py * W + px) * 4; png.data[o] = Math.round(png.data[o] * (1 - a) + r * a); png.data[o + 1] = Math.round(png.data[o + 1] * (1 - a) + g * a); png.data[o + 2] = Math.round(png.data[o + 2] * (1 - a) + bl * a); png.data[o + 3] = 255; };
    const queryGround = runtime.surfaces && audit._collected.authored.queryGround;
    for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
      const x = b.minX + (px + 0.5) / scale, y = b.minY + (py + 0.5) / scale, g = queryGround(x, y);
      set(px, py, !g.walkable ? (g.deepWater ? [70, 96, 120] : [92, 92, 92]) : [222, 220, 206]);
    }
    const toPx = (x, y) => [Math.floor((x - b.minX) * scale), Math.floor((y - b.minY) * scale)];
    const fillPoly = (vertices, colour, alpha) => {
      const bb = boundsOf(vertices), [x0, y0] = toPx(bb.minX, bb.minY), [x1, y1] = toPx(bb.maxX, bb.maxY);
      for (let py = Math.max(0, y0); py <= Math.min(H - 1, y1); py++) for (let px = Math.max(0, x0); px <= Math.min(W - 1, x1); px++) {
        const x = b.minX + (px + 0.5) / scale, y = b.minY + (py + 0.5) / scale;
        if (pointInPolygon(x, y, vertices)) set(px, py, colour, alpha);
      }
    };
    const strokeRect = (r, colour, width = 1) => {
      const [x0, y0] = toPx(r.minX, r.minY), [x1, y1] = toPx(r.maxX, r.maxY);
      for (let w = 0; w < width; w++) {
        for (let px = x0; px <= x1; px++) { set(px, y0 + w, colour); set(px, y1 - w, colour); }
        for (let py = y0; py <= y1; py++) { set(x0 + w, py, colour); set(x1 - w, py, colour); }
      }
    };
    const blockerFinding = new Map(audit.findings.filter(f => f.type === 'invisible-wall' || f.type === 'blocker-overhang').map(f => [f.id, f.type]));
    for (const blocker of runtime.collisionBlockers) {
      const vertices = shapeVertices(blocker.shape), bb = boundsOf(vertices);
      if (bb.maxX < b.minX || bb.minX > b.maxX || bb.maxY < b.minY || bb.minY > b.maxY) continue;
      const type = blockerFinding.get(blocker.id);
      fillPoly(vertices, type === 'invisible-wall' ? [214, 40, 200] : type ? [230, 140, 30] : [40, 60, 150], type ? 0.75 : 0.45);
    }
    for (const card of cards) {
      if (!card.blocks) continue;
      const f = card.footprint;
      if (f.maxX < b.minX || f.minX > b.maxX || f.maxY < b.minY || f.minY > b.maxY) continue;
      const type = findingIds.get(card.id);
      strokeRect(f, type === 'walk-over' ? [220, 20, 20] : type === 'overhang' ? [240, 150, 0] : [20, 150, 40], type ? 2 : 1);
    }
    const file = path.join(outDir, `overlay-${district.id}.png`);
    writeFileSync(file, PNG.sync.write(png));
    written.push(path.relative(ROOT, file).replaceAll('\\', '/'));
  }
  return written;
}

// ---- prop blockers ----
// Ground-level blocking prop cards that no authored blocker (other than prop
// blockers themselves) covers: each gets a collider equal to its blocking
// footprint. Computed without prop blockers, so regeneration is idempotent.
export const PROP_BLOCKER_MODULE = path.join(ROOT, 'apps/hmh-reboot/src/dev/greybox-prop-blockers.mjs');
const COVER_CLASSES = new Set(['vehicle', 'container']);
export function propCover(source, height) {
  const kind = collisionClassFor(source);
  // Vehicles, containers and hard barriers stop shots; guardrails, hedgerows,
  // trees, rocks and props only stop bodies.
  if (COVER_CLASSES.has(kind) || ['b2-49', 'b1-17', 'b1-18'].includes(source)) return height > 80 ? 'tall' : 'short';
  return 'none';
}
export function propBlockerRows(collected) {
  const { authored, cards } = collected;
  const rows = authored.pieces.filter(piece => piece.blocker && !piece.visible.artPlanId).map(piece => { const vertices = piece.blocker.shape.vertices; return { id: piece.id, vertices, bounds: boundsOf(vertices) }; });
  const index = createPolygonIndex(rows);
  const out = [];
  for (const card of cards) {
    if (card.kind !== 'prop' || !card.blocks || (card.groundZ ?? 0) > 0) continue;
    const f = card.footprint, samples = samplePolygon(rect(f.minX, f.minY, f.maxX, f.maxY));
    let covered = 0, overhang = 0;
    for (const p of samples) if (index.inside(p.x, p.y)) covered++; else overhang = Math.max(overhang, index.distance(p.x, p.y));
    if (covered / samples.length >= COVERAGE_MINIMUM && overhang <= MISMATCH_TOLERANCE) continue;
    const bounds = { minX: Math.floor(f.minX), minY: Math.floor(f.minY), maxX: Math.ceil(f.maxX), maxY: Math.ceil(f.maxY) };
    out.push({ planId: card.planId, source: card.source, x: Math.round(card.rawX * 10) / 10, y: Math.round(card.rawY * 10) / 10, bounds, height: Math.max(1, Math.round(card.height)), coverKind: propCover(card.source, card.height) });
  }
  return out.sort((a, b) => (a.planId < b.planId ? -1 : a.planId > b.planId ? 1 : a.y - b.y || a.x - b.x));
}
export function propBlockerModuleSource(rows) {
  const plans = [...new Set(rows.map(row => row.planId))].sort();
  const cover = { none: 0, short: 1, tall: 2 };
  const lines = rows.map(row => `[${plans.indexOf(row.planId)},'${row.source}',${row.x},${row.y},${row.bounds.minX},${row.bounds.minY},${row.bounds.maxX},${row.bounds.maxY},${row.height},${cover[row.coverKind]}]`);
  return `// GENERATED by \`node scripts/audit-ten-area-collision-art.mjs --write-prop-blockers\`; do not edit.
// Authored collision for the ten-area world's blocking prop cards (2.1
// collision-art lane, docs/2.0/slices/WORLD-COLLISION-ART.md). Each row is the
// collider under one ground-level kit card a plan draws on open walkable
// ground: a car, barrier, transformer, kiosk, container, big rock, log pile or
// tree trunk. The collider is the card's painted ground footprint (a trunk or
// pole square for trees and poles), so the hero meets the art, not air.
// Placement guards ignore these pieces (they stand under the plan's own
// cards), and the area-art binding claims them so no greybox slab is drawn.
// Row: [plan, source, anchorX, anchorY, minX, minY, maxX, maxY, height, cover]
// cover: 0 none, 1 short (stops shots, crouch), 2 tall.
import { createGreyboxPiece } from './greybox-kit.mjs';

export const PROP_BLOCKER_PLANS = Object.freeze(${JSON.stringify(plans)});
const COVER = ['none', 'short', 'tall'];
const ROWS = [
${lines.map(line => `  ${line},`).join('\n')}
];
export const PROP_BLOCKER_COUNT = ROWS.length;
export const propBlockerId = (planId, source, x, y) => \`prop-\${planId}-\${source}-\${Math.round(x)}-\${Math.round(y)}\`;

export function authorPropBlockers(pieces) {
  for (const [plan, source, x, y, minX, minY, maxX, maxY, height, cover] of ROWS) {
    const planId = PROP_BLOCKER_PLANS[plan], coverKind = COVER[cover];
    pieces.push(createGreyboxPiece({ id: propBlockerId(planId, source, x, y), kind: 'prop-solid', bounds: { minX, minY, maxX, maxY }, height, artPlanId: planId, artProp: { source, x, y }, combatCover: coverKind !== 'none', coverKind }));
  }
}
`;
}

export function auditReport(audit) {
  const { _collected, ...rest } = audit;
  return rest;
}

async function main() {
  const args = process.argv.slice(2);
  const outIndex = args.indexOf('--out');
  const outDir = outIndex >= 0 ? path.resolve(args[outIndex + 1]) : DEFAULT_RECEIPT_DIR;
  const label = args.includes('--label') ? args[args.indexOf('--label') + 1] : 'audit';
  if (args.includes('--write-prop-blockers')) {
    const rows = propBlockerRows(await collectTenAreaCards());
    writeFileSync(PROP_BLOCKER_MODULE, propBlockerModuleSource(rows));
    console.log(`wrote ${rows.length} prop blockers to ${path.relative(ROOT, PROP_BLOCKER_MODULE)}`);
    return;
  }
  mkdirSync(outDir, { recursive: true });
  const audit = await auditTenAreaCollisionArt();
  const overlays = args.includes('--no-png') ? [] : await writeOverlays(audit, outDir);
  const report = { ...auditReport(audit), overlays };
  writeFileSync(path.join(outDir, `${label}.json`), `${JSON.stringify(report, null, 1)}\n`);
  console.log(JSON.stringify({ world: report.world, cards: report.cards, counts: report.counts, overlays: overlays.length }, null, 1));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
