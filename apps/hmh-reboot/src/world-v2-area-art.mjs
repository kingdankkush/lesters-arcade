// Generic area-art renderer for the ten-area world. Consumes a frozen plan
// (see world-v2-area-art-schema.mjs) plus the HD prop kit manifest and paints
// ground materials, worn trails, road ribbons, kit cards and decorated solids.
// Projection only: it reads the authored world and never writes collision,
// navigation, spawning, RNG, progression or results. Mountable from the
// private scene and from the real game's area hook with the same factory.
import { Container, Graphics, Sprite, Texture, Matrix, Rectangle } from 'pixi.js';
import { createGreyboxPropResidency } from './dev/greybox-prop-residency.mjs';
import { AREA_ART_KIT_ROOT, AREA_ART_KIT_MANIFEST, AREA_ART_TILE_ROOT, AREA_ART_DETAIL_ROOT, AREA_ART_DETAIL_PAGE, AREA_ART_MATERIALS, ROAD_RECIPES, FOLIAGE_TINT_RULES, validateAreaArtPlan, resolveKitItem, ribbonPolygon, offsetPolygon, polygonBounds, rectVertices } from './world-v2-area-art-schema.mjs';
export { validateAreaArtPlan, createPlacementGuard, AREA_ART_SCHEMA, AREA_ART_MATERIALS } from './world-v2-area-art-schema.mjs';

export const AREA_ART_ID = 'world-v2-area-art/v1';
const SHADOW_TINT = 0x03070b;
// Shared key from the screen upper left: contact shadows lean down-right.
const SHADOW_LEAN = Object.freeze({ x: 0.1, y: 0.05 });
const DETAIL_FRAMES = Object.freeze({ 'detail:grass': { x: 0, y: 0, w: 180, h: 122, anchor: { x: 0.53, y: 0.73 }, scale: 0.34 }, 'detail:aggregate': { x: 0, y: 160, w: 224, h: 96, anchor: { x: 0.5, y: 0.5 }, scale: 0.42 } });

export function multiplyTint(a, b) {
  const channel = shift => Math.round(((a >> shift & 255) * (b >> shift & 255)) / 255);
  return channel(16) << 16 | channel(8) << 8 | channel(0);
}

// Reference-counted texture ownership shared between several plans (Woods and
// Meadows both read the plants page). Every acquired URL is released on dispose.
export function createAreaArtTextureCache({ loadTexture } = {}) {
  const load = typeof loadTexture === 'function' ? loadTexture : defaultLoadTexture;
  const entries = new Map();
  let disposed = false;
  async function acquire(url) {
    if (disposed) throw new Error('texture cache disposed');
    let entry = entries.get(url);
    if (!entry) { entry = { count: 0, promise: load(url) }; entries.set(url, entry); }
    entry.count++;
    try { return await entry.promise; }
    catch (error) { release(url); throw error; }
  }
  function release(url) {
    const entry = entries.get(url);
    if (!entry) return;
    entry.count--;
    if (entry.count > 0) return;
    entries.delete(url);
    entry.promise.then(texture => destroyTexture(texture), () => {});
  }
  const decodedBytes = async () => { let total = 0; for (const entry of entries.values()) { try { const t = await entry.promise; total += t.source.pixelWidth * t.source.pixelHeight * 4; } catch {} } return total; };
  return Object.freeze({ acquire, release, decodedBytes, snapshot: () => Object.freeze({ disposed, urls: Object.freeze([...entries.keys()].sort()), references: [...entries.values()].reduce((n, e) => n + e.count, 0) }), dispose() { disposed = true; for (const url of [...entries.keys()]) { const entry = entries.get(url); entries.delete(url); entry.promise.then(texture => destroyTexture(texture), () => {}); } } });
}
async function defaultLoadTexture(url) {
  const image = new Image();
  image.src = url;
  await image.decode();
  const texture = Texture.from(image, true);
  texture.areaArtImage = image;
  return texture;
}
function destroyTexture(texture) {
  if (!texture || texture.destroyed) return;
  const image = texture.areaArtImage;
  texture.destroy(true);
  image?.removeAttribute?.('src');
}

export function createAreaArt({ world, areaId, plan, kit = null, loadTexture, textureCache = null, container = null, signal, resolution = 'full', fetchImpl = typeof fetch === 'function' ? fetch : null } = {}) {
  if (!world || typeof areaId !== 'string' || !plan) throw new TypeError('world, areaId and plan required');
  if (plan.areaId !== areaId) throw new TypeError(`plan ${plan.areaId} does not dress ${areaId}`);
  if (!['full', 'half'].includes(resolution)) throw new TypeError('resolution must be full or half');
  const cache = textureCache ?? createAreaArtTextureCache({ loadTexture });
  const ownsCache = !textureCache;
  const ratio = resolution === 'half' ? 0.5 : 1;
  let disposed = false, mounted = false, summary = null, manifest = kit, residency = null, depthLayer = container, groundLayer = null, shadowLayer = null;
  const owned = [], painted = [], frames = new Map(), tiles = new Map(), live = new Map();
  let detailTexture = null, pageTextures = new Map();
  const acquire = async url => { const texture = await cache.acquire(url); owned.push(url); if (disposed) { cache.release(url); owned.pop(); return null; } return texture; };

  const ready = (async () => {
    try {
      if (!manifest) {
        if (!fetchImpl) throw new Error('kit manifest fetch unavailable');
        const response = await fetchImpl(AREA_ART_KIT_ROOT + AREA_ART_KIT_MANIFEST, { signal, credentials: 'same-origin' });
        if (!response.ok) throw new Error(`area art kit manifest HTTP ${response.status}`);
        manifest = await response.json();
      }
      if (disposed) return;
      summary = validateAreaArtPlan(plan, manifest);
      const jobs = [];
      for (const image of summary.pages) {
        const page = manifest.pages.find(entry => entry.image === image);
        const file = ratio === 0.5 ? page.halfRes.image : page.image;
        jobs.push(acquire(AREA_ART_KIT_ROOT + file).then(texture => {
          if (!texture) return;
          const expected = { width: page.width * ratio, height: page.height * ratio };
          if (texture.source.pixelWidth !== expected.width || texture.source.pixelHeight !== expected.height) throw new Error(`kit page ${file} decoded ${texture.source.pixelWidth}x${texture.source.pixelHeight}, expected ${expected.width}x${expected.height}`);
          pageTextures.set(image, texture);
        }));
      }
      for (const tile of summary.tiles) {
        jobs.push(acquire(`${AREA_ART_TILE_ROOT}${tile}.png`).then(texture => { if (texture) { texture.source.style.addressMode = 'repeat'; texture.source.style.update(); tiles.set(tile, texture); } }));
        jobs.push(acquire(`${AREA_ART_TILE_ROOT}${tile}-fringe.png`).then(texture => { if (texture) { texture.source.style.addressMode = 'repeat'; texture.source.style.update(); tiles.set(`${tile}-fringe`, texture); } }));
      }
      if (summary.detailPage) jobs.push(acquire(AREA_ART_DETAIL_ROOT + AREA_ART_DETAIL_PAGE).then(texture => { detailTexture = texture; }));
      const results = await Promise.allSettled(jobs);
      const failure = results.find(result => result.status === 'rejected');
      if (failure) throw failure.reason;
    } catch (error) { if (!disposed) { dispose(); } throw error; }
  })();

  const frameFor = assetId => {
    let entry = frames.get(assetId);
    if (entry) return entry;
    const item = resolveKitItem(manifest, assetId), page = pageTextures.get(item.pageImage);
    if (!page) throw new Error(`kit page for ${assetId} is not resident`);
    const f = item.frame;
    const texture = new Texture({ source: page.source, frame: new Rectangle(f.x * ratio, f.y * ratio, f.w * ratio, f.h * ratio) });
    entry = { item, texture, alphaHeight: item.alphaBounds.h * ratio, alphaWidth: item.alphaBounds.w * ratio, anchor: item.anchor };
    frames.set(assetId, entry);
    return entry;
  };
  const tintFor = (assetId, tint = 0xffffff) => FOLIAGE_TINT_RULES[assetId] ? multiplyTint(tint, FOLIAGE_TINT_RULES[assetId]) : tint;

  // A kit card standing on the ground at (x, y - groundZ), `height` world units
  // tall from its painted base to its painted top. Returns { node, width }.
  function card(assetId, { x, y, height, groundZ = 0, tint = 0xffffff, flip = false, widthScale = null }) {
    const entry = frameFor(assetId), scale = widthScale ?? height / entry.alphaHeight;
    const sprite = new Sprite({ texture: entry.texture });
    sprite.anchor.set(entry.anchor.x, entry.anchor.y);
    sprite.position.set(x, y - groundZ);
    sprite.scale.set(flip ? -scale : scale, widthScale ? height / entry.alphaHeight : scale);
    sprite.tint = tintFor(assetId, tint);
    return { node: sprite, width: entry.alphaWidth * Math.abs(sprite.scale.x), height: entry.alphaHeight * Math.abs(sprite.scale.y) };
  }
  function contactShadow(target, { x, y, width, depth, alpha = 0.34, ao = false }) {
    const g = new Graphics(), rx = Math.max(6, width * 0.5 * 1.1), ry = Math.max(3, (depth ?? width * 0.42) * 0.5);
    const cx = x + rx * SHADOW_LEAN.x, cy = y + ry * SHADOW_LEAN.y;
    if (ao) g.ellipse(cx, cy, rx * 1.45, ry * 1.45).fill({ color: SHADOW_TINT, alpha: alpha * 0.22 });
    g.ellipse(cx, cy, rx, ry).fill({ color: SHADOW_TINT, alpha: alpha * 0.34 });
    g.ellipse(cx, cy, rx * 0.72, ry * 0.72).fill({ color: SHADOW_TINT, alpha: alpha * 0.36 });
    g.ellipse(cx, cy, rx * 0.42, ry * 0.42).fill({ color: SHADOW_TINT, alpha: alpha * 0.4 });
    target.addChild(g);
    return g;
  }

  // ---- ground ----
  function materialFill(g, vertices, materialId, { tint = 0xffffff, alpha = 1 } = {}) {
    const m = AREA_ART_MATERIALS[materialId], texture = tiles.get(m.tile);
    const flat = vertices.flatMap(p => [p.x, p.y]);
    g.poly(flat).fill({ color: multiplyTint(m.base, tint), alpha });
    if (texture) g.poly(flat).fill({ texture, textureSpace: 'global', matrix: new Matrix().scale(m.scale, m.scale), color: multiplyTint(m.tint, tint), alpha: m.alpha * alpha });
  }
  // Fringe strips along every edge, outward by `feather`, using the tile's own
  // 512x128 gradient so the edge dissolves with the material's grain.
  function fringe(g, vertices, materialId, feather, { tint = 0xffffff, alpha = 1 } = {}) {
    const m = AREA_ART_MATERIALS[materialId], texture = tiles.get(`${m.tile}-fringe`);
    if (!texture) return;
    const outer = offsetPolygon(vertices, feather), n = vertices.length;
    for (let i = 0; i < n; i++) {
      const a = vertices[i], b = vertices[(i + 1) % n], oa = outer[i], ob = outer[(i + 1) % n];
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
      const nx = oa.x - a.x, ny = oa.y - a.y, nlen = Math.hypot(nx, ny) || 1;
      const s = m.scale, matrix = new Matrix(ux * s, uy * s, nx / nlen * (feather / 128), ny / nlen * (feather / 128), a.x, a.y);
      g.poly([a.x, a.y, b.x, b.y, ob.x, ob.y, oa.x, oa.y]).fill({ color: multiplyTint(m.base, tint), alpha: alpha * 0.55, texture, matrix });
      g.poly([a.x, a.y, b.x, b.y, ob.x, ob.y, oa.x, oa.y]).fill({ texture, matrix, color: multiplyTint(m.tint, tint), alpha: m.alpha * alpha });
    }
  }
  function paintZone(target, zone) {
    const g = new Graphics();
    fringe(g, zone.vertices, zone.material, zone.feather, zone);
    materialFill(g, zone.vertices, zone.material, zone);
    target.addChild(g); painted.push(g);
  }
  function paintTrails(target, trails) {
    if (!trails.length) return;
    const mask = new Graphics(), halo = new Graphics(), core = new Graphics();
    const boxes = [];
    for (const trail of trails) {
      const wide = ribbonPolygon(trail.points, trail.width + trail.halo * 2);
      mask.poly(wide.flatMap(p => [p.x, p.y])).fill(0xffffff);
      for (const p of trail.points) mask.circle(p.x, p.y, trail.width / 2 + trail.halo).fill(0xffffff);
      boxes.push(polygonBounds(wide));
    }
    const b = { minX: Math.min(...boxes.map(x => x.minX)), minY: Math.min(...boxes.map(x => x.minY)), maxX: Math.max(...boxes.map(x => x.maxX)), maxY: Math.max(...boxes.map(x => x.maxY)) };
    materialFill(halo, rectVertices(b), trails[0].material, { alpha: 0.42 });
    halo.mask = mask;
    for (const trail of trails) {
      materialFill(core, ribbonPolygon(trail.points, trail.width), trail.material);
      for (const p of trail.points.slice(1, -1)) { const m = AREA_ART_MATERIALS[trail.material]; core.circle(p.x, p.y, trail.width / 2).fill({ texture: tiles.get(m.tile), textureSpace: 'global', matrix: new Matrix().scale(m.scale, m.scale), color: m.tint, alpha: 1 }); }
    }
    target.addChild(halo, mask, core); painted.push(halo, mask, core);
  }
  function offsetPolyline(points, distance) {
    if (points.length < 2) return points;
    const ribbon = ribbonPolygon(points, Math.abs(distance) * 2);
    return distance >= 0 ? ribbon.slice(0, points.length) : ribbon.slice(points.length).reverse();
  }
  function paintRoad(target, road) {
    const recipe = ROAD_RECIPES[road.kind], g = new Graphics();
    const haloWidth = road.width + recipe.shoulderWidth * 2 + recipe.haloWidth * 2;
    materialFill(g, ribbonPolygon(road.points, haloWidth), recipe.shoulder, { alpha: recipe.haloAlpha * 0.5 });
    materialFill(g, ribbonPolygon(road.points, road.width + recipe.shoulderWidth * 2 + recipe.haloWidth), recipe.shoulder, { alpha: recipe.haloAlpha });
    materialFill(g, ribbonPolygon(road.points, road.width + recipe.shoulderWidth * 2), recipe.shoulder);
    materialFill(g, ribbonPolygon(road.points, road.width), recipe.core);
    const wear = new Graphics();
    if (recipe.tracks > 0) for (const side of [-0.22, 0.22]) wear.poly(ribbonPolygon(offsetPolyline(road.points, road.width * side), road.width * 0.13).flatMap(p => [p.x, p.y])).fill({ color: 0x1a1d1c, alpha: recipe.tracks });
    if (recipe.ruts) for (const side of [-0.18, 0.18]) wear.poly(ribbonPolygon(offsetPolyline(road.points, road.width * side), Math.max(10, road.width * 0.05)).flatMap(p => [p.x, p.y])).fill({ color: 0x2b2216, alpha: 0.26 });
    target.addChild(g, wear); painted.push(g, wear);
    if (recipe.cracks && road.cracks.length) for (const crack of road.cracks) {
      const { node } = card('b2-47', { x: crack.x, y: crack.y, height: road.width * 0.24 * crack.scale, tint: 0xb9bcb8, flip: crack.flip });
      node.alpha = 0.58; target.addChild(node); painted.push(node);
    }
  }
  function paintDecals(target, decals) {
    if (!decals.length || !detailTexture) return;
    const textures = new Map();
    for (const decal of decals) {
      const spec = DETAIL_FRAMES[decal.source];
      let texture = textures.get(decal.source);
      if (!texture) { texture = new Texture({ source: detailTexture.source, frame: new Rectangle(spec.x, spec.y, spec.w, spec.h) }); textures.set(decal.source, texture); painted.push({ removeFromParent() {}, destroy: () => texture.destroy(false) }); }
      const sprite = new Sprite({ texture });
      sprite.anchor.set(spec.anchor.x, spec.anchor.y); sprite.position.set(decal.x, decal.y);
      sprite.scale.set((decal.flip ? -1 : 1) * spec.scale * decal.scale, spec.scale * decal.scale); sprite.rotation = decal.rotation; sprite.alpha = decal.alpha; sprite.tint = decal.tint;
      target.addChild(sprite); painted.push(sprite);
    }
  }
  function paintAreaGround(target) {
    if (summary.base) { const g = new Graphics(); materialFill(g, rectVertices(summary.bounds), summary.base.material, summary.base); target.addChild(g); painted.push(g); }
    for (const zone of summary.zones) paintZone(target, zone);
    paintTrails(target, summary.trails);
    paintDecals(target, summary.decals);
  }
  const claimsSurface = surfaceId => Boolean(summary) && (summary.base?.surfaceId === surfaceId || summary.roads.some(road => road.surfaceIds.includes(surfaceId)));
  // Scene hook: the ground painter walks surfaces in priority order and hands
  // each one here first. Area floors paint the whole area; a road paints once,
  // on its first authored segment, and claims its remaining segments/joins.
  function paintSurface({ target, surface }) {
    if (disposed || !summary || !claimsSurface(surface.id)) return false;
    groundLayer = target;
    if (summary.base?.surfaceId === surface.id) { paintAreaGround(target); return true; }
    const road = summary.roads.find(entry => entry.surfaceIds[0] === surface.id);
    if (road) paintRoad(target, road);
    return true;
  }
  function paintGround(target) { if (disposed || !summary) return; groundLayer = target; paintAreaGround(target); for (const road of summary.roads) paintRoad(target, road); }

  // ---- solids ----
  function createSolid(piece) {
    if (disposed || !summary) return null;
    const solid = summary.solids.find(entry => entry.pieceId === piece.id);
    if (!solid) return null;
    const b = piece.visible.bounds, w = b.maxX - b.minX, d = b.maxY - b.minY, h = solid.height ?? piece.visible.height, cx = (b.minX + b.maxX) / 2;
    const vertices = piece.visible.vertices ?? rectVertices(b), roof = vertices.map(p => ({ x: p.x, y: p.y - h }));
    const node = new Container(); node.areaArtDecorated = true;
    const timber = multiplyTint(0x6b5c48, solid.tint), dark = multiplyTint(0x3f3629, solid.tint), pale = multiplyTint(0xd8d5c6, solid.tint);
    if (solid.style !== 'hedge' && solid.style !== 'pickets') contactShadow(node, { x: cx, y: b.maxY - d * 0.5, width: w, depth: d + 8, alpha: 0.3, ao: true });
    if (solid.massAlpha > 0) {
      const mass = new Graphics();
      const faceMaterial = solid.style === 'bank' ? 'earth' : 'dirt';
      for (let i = 0; i < vertices.length; i++) { const j = (i + 1) % vertices.length; materialFill(mass, [vertices[i], vertices[j], roof[j], roof[i]], faceMaterial, { tint: solid.style === 'bank' ? 0x8d8a78 : 0x6a6558 }); }
      materialFill(mass, roof, solid.roof ?? (solid.style === 'bank' ? 'forest' : 'earth'), { tint: solid.tint });
      mass.alpha = solid.massAlpha; node.addChild(mass);
    }
    if (solid.style === 'card') {
      const entry = frameFor(solid.card.source);
      const scale = solid.card.fit === 'width' ? w / entry.alphaWidth : solid.card.fit === 'depth' ? d / entry.alphaWidth : (h + d * 0.45) / entry.alphaHeight;
      const { node: sprite } = card(solid.card.source, { x: cx, y: b.maxY, height: entry.alphaHeight * scale, groundZ: solid.card.lift, tint: solid.tint });
      node.addChild(sprite);
    } else if (solid.style === 'hedge') {
      const vertical = d > w, length = vertical ? d : w, spacing = solid.spacing || 120, count = Math.max(1, Math.ceil(length / spacing)), step = length / count;
      for (let i = 0; i < count; i++) {
        const x = vertical ? cx : b.minX + (i + 0.5) * step, y = vertical ? b.minY + (i + 1) * step : b.maxY;
        const entry = frameFor(solid.card.source), widthScale = (vertical ? Math.max(w, step * 0.9) : step * 1.12) / entry.alphaWidth;
        const { node: sprite } = card(solid.card.source, { x, y: Math.min(y, b.maxY), height: h + (vertical ? step * 0.35 : 0), tint: solid.tint, flip: i % 2 === 1, widthScale });
        contactShadow(node, { x, y: Math.min(y, b.maxY) - 4, width: vertical ? w : step, depth: vertical ? step * 0.4 : 30, alpha: 0.28 });
        node.addChild(sprite);
      }
    } else if (solid.style === 'stakes') {
      const g = new Graphics(), vertical = d > w, length = vertical ? d : w, step = solid.spacing || 26, count = Math.max(2, Math.round(length / step));
      if (vertical) g.poly([{ x: cx - w / 2, y: b.minY - h }, { x: cx + w / 2, y: b.minY - h }, { x: cx + w / 2, y: b.maxY - h }, { x: cx - w / 2, y: b.maxY - h }].flatMap(p => [p.x, p.y])).fill({ color: dark });
      for (let i = 0; i < count; i++) {
        const t = (i + 0.5) / count, wobble = ((i * 7) % 5) - 2, postW = (vertical ? w : step * 0.92) + wobble * 0.5, top = h + wobble * 2;
        const x = vertical ? cx : b.minX + t * length, y = vertical ? b.minY + t * length + step * 0.5 : b.maxY;
        g.rect(x - postW / 2, y - top, postW, top).fill({ color: i % 3 === 1 ? multiplyTint(timber, 0xe6dccf) : timber });
        g.rect(x - postW / 2, y - top, postW * 0.28, top).fill({ color: dark, alpha: 0.35 });
        g.poly([x - postW / 2, y - top, x, y - top - postW * 0.55, x + postW / 2, y - top]).fill({ color: multiplyTint(timber, 0xf0ebe0) });
      }
      if (!vertical) g.rect(b.minX, b.maxY - h * 0.62, w, 6).fill({ color: dark, alpha: 0.55 });
      node.addChild(g);
    } else if (solid.style === 'crates') {
      const g = new Graphics(), box = Math.min(64, Math.max(40, d * 0.7)), cols = Math.max(1, Math.floor(w / box)), start = cx - cols * box / 2;
      const drawBox = (x, y, size, height, tint) => { g.rect(x, y - height, size, height).fill({ color: tint }); g.poly([x, y - height, x + size, y - height, x + size - 6, y - height - size * 0.3, x - 6, y - height - size * 0.3]).fill({ color: multiplyTint(tint, 0xf2ede4) }); g.rect(x, y - height, size, height).stroke({ color: dark, width: 2, alpha: 0.6 }); g.rect(x + size * 0.12, y - height * 0.6, size * 0.76, 4).fill({ color: dark, alpha: 0.35 }); };
      for (let i = 0; i < cols; i++) drawBox(start + i * box, b.maxY, box - 4, Math.min(h, box * 0.7), i % 2 ? timber : multiplyTint(timber, 0xd9cdb6));
      for (let i = 0; i < Math.max(0, cols - 1); i += 2) drawBox(start + i * box + box * 0.5, b.maxY - Math.min(h, box * 0.7) - 2, box - 8, Math.max(12, h - Math.min(h, box * 0.7) - 4), multiplyTint(timber, 0xe8e0d0));
      node.addChild(g);
    } else if (solid.style === 'pickets') {
      const g = new Graphics(), vertical = d > w, length = vertical ? d : w, step = solid.spacing || 16, count = Math.max(2, Math.round(length / step)), slat = step * 0.5;
      const railY = vertical ? null : b.maxY;
      if (!vertical) { g.rect(b.minX, railY - h * 0.72, w, 4).fill({ color: pale, alpha: 0.9 }); g.rect(b.minX, railY - h * 0.3, w, 4).fill({ color: pale, alpha: 0.9 }); }
      for (let i = 0; i < count; i++) {
        const t = (i + 0.5) / count, x = vertical ? cx : b.minX + t * length, y = vertical ? b.minY + t * length + step * 0.4 : b.maxY, top = h - ((i * 5) % 3);
        g.rect(x - slat / 2, y - top, slat, top).fill({ color: i % 4 === 2 ? multiplyTint(pale, 0xd8d3c8) : pale });
        g.poly([x - slat / 2, y - top, x, y - top - slat * 0.7, x + slat / 2, y - top]).fill({ color: pale });
        g.rect(x - slat / 2, y - top, slat * 0.3, top).fill({ color: dark, alpha: 0.22 });
        if (vertical && i % 2 === 0) g.rect(x - w / 2, y - top * 0.5, w, 3).fill({ color: pale, alpha: 0.8 });
      }
      node.addChild(g);
    }
    return node;
  }

  // ---- props via viewport residency ----
  function createProp(record) {
    const prop = summary.props[record.ordinal], node = new Container();
    const { node: sprite, width } = card(prop.source, prop);
    if (prop.shadow) contactShadow(node, { x: prop.x, y: prop.y - prop.groundZ, width: Math.min(width, prop.height * 1.6), alpha: prop.height > 150 ? 0.36 : 0.26, ao: prop.height > 150 });
    node.addChild(sprite); node.label = record.id; node.zIndex = prop.y;
    depthLayer.addChild(node); live.set(record.id, { node, prop, width });
    return node;
  }
  function mount(layer = depthLayer, ground = groundLayer) {
    if (disposed || mounted || !summary) return;
    if (!layer) throw new TypeError('depth layer container required to mount area art');
    mounted = true; depthLayer = layer; groundLayer = ground;
    residency = createGreyboxPropResidency({
      catalog: summary.props.map(prop => { const entry = frameFor(prop.source), width = entry.alphaWidth * (prop.height / entry.alphaHeight); return { id: prop.id, areaId: summary.roadsPlan ? null : summary.areaId, bounds: { left: prop.x - width * 0.6, right: prop.x + width * 0.6, top: prop.y - prop.groundZ - prop.height * 1.1, bottom: prop.y - prop.groundZ + width * 0.3 } }; }),
      create: createProp, setVisible: (node, value) => { node.visible = value; }, destroy: node => { live.delete(node.label); node.destroy({ children: true }); },
    });
  }
  function update(camera, view, actor = null) {
    if (!residency || disposed) return 0;
    const visible = residency.update({ camera, view });
    if (actor) for (const { node, prop, width } of live.values()) node.alpha = prop.fade && Math.abs(actor.x - prop.x) < width * 0.42 && actor.y < prop.y && actor.y > prop.y - prop.height - prop.groundZ ? 0.38 : 1;
    return visible;
  }
  function dispose() {
    if (disposed) return; disposed = true;
    try { residency?.dispose(); } catch {}
    for (const node of painted) { try { node.removeFromParent?.(); node.destroy?.({ children: true }); } catch {} } painted.length = 0;
    for (const entry of frames.values()) entry.texture.destroy(false); frames.clear(); live.clear();
    for (const url of owned) cache.release(url); owned.length = 0; tiles.clear(); pageTextures.clear(); detailTexture = null;
    if (ownsCache) cache.dispose();
  }
  const snapshot = () => Object.freeze({ artId: AREA_ART_ID, areaId, resolution, disposed, mounted, pages: summary?.pages ?? null, tiles: summary?.tiles ?? null, counts: summary?.counts ?? null, budget: summary?.budget ?? null, ownedUrls: Object.freeze([...owned].sort()), painted: painted.length, residency: residency?.snapshot() ?? null, runtimeAuthority: 'projection-only' });
  return Object.freeze({ artId: AREA_ART_ID, ready, plan, get summary() { return summary; }, claimsSurface, paintSurface, paintGround, createSolid, mount, update, dispose, snapshot, textureCache: cache });
}
