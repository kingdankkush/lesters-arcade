// Opt-in terrain subset streaming. Existing world/rules remain fully resident.
import { createAreaTextureLeases } from './area-texture-leases.mjs';
import { profileTextureUrl } from './runtime-performance.mjs';
import { DISTRICT_TERRAIN_MATERIAL, SURFACE_TERRAIN_MATERIAL, TERRAIN_MATERIAL_IDS, TERRAIN_OVERLAY_IDS,
  terrainTileAsset, terrainFringeAsset, terrainOverlayAsset, terrainManifestUrl, validateTerrainManifest } from './terrain-tile-atlas.mjs';
let nextScope = 0;
const finite = value => Number.isFinite(value);
const intersects = (a, b) => a.maxX >= b.minX && a.minX <= b.maxX && a.maxY >= b.minY && a.minY <= b.maxY;
function bounds(area) {
  if (area?.type === 'polygon') return { minX: Math.min(...area.vertices.map(p => p.x)), maxX: Math.max(...area.vertices.map(p => p.x)), minY: Math.min(...area.vertices.map(p => p.y)), maxY: Math.max(...area.vertices.map(p => p.y)) };
  if (!area || !['minX', 'maxX', 'minY', 'maxY'].every(key => finite(area[key])) || area.maxX < area.minX || area.maxY < area.minY) throw new TypeError('finite presentation area bounds required');
  return { minX: area.minX, maxX: area.maxX, minY: area.minY, maxY: area.maxY };
}
export function selectTerrainAreas({ areas, camera, view, retainedAreaIds = [], prefetchScreens = 1.5, retainScreens = 2 } = {}) {
  if (!Array.isArray(areas) || !camera || ![camera.x, camera.y, camera.groundZ ?? 0, camera.zoom, view?.width, view?.height, prefetchScreens, retainScreens].every(finite)
    || camera.zoom <= 0 || view.width <= 0 || view.height <= 0 || prefetchScreens < 0 || retainScreens < prefetchScreens) throw new TypeError('finite detached camera/view and ordered screen margins required');
  const held = new Set(retainedAreaIds), selected = [];
  for (const area of areas) {
    const margin = held.has(area.id) ? retainScreens : prefetchScreens;
    const x = (.5 + margin) * view.width / camera.zoom, y = (.5 + margin) * view.height / camera.zoom;
    // Inverse of the existing ground-plane projection; no simulation query.
    const centreY = camera.y - (camera.groundZ ?? 0);
    if (intersects(bounds(area.area), { minX: camera.x - x, maxX: camera.x + x, minY: centreY - y, maxY: centreY + y })) selected.push(area.id);
  }
  return selected.sort();
}
export function createOwnedProfileTextureLoader({ Assets, profile, scope } = {}) {
  if (!Assets?.cache || typeof Assets.load !== 'function' || typeof Assets.unload !== 'function' || !/^[a-zA-Z0-9-]+$/.test(scope)) throw new TypeError('owned Pixi loader/cache and scope required');
  const owned = url => `${url}${url.includes('?') ? '&' : '?'}hmhAreaLease=${scope}`;
  const request = async url => {
    if (Assets.cache.has(url)) throw new Error('terrain resource cache ownership collision');
    const texture = await Assets.load(url);
    const source = texture.source;
    const resource = Object.freeze({ texture, source, url, decodedBytes: source?.pixelWidth * source?.pixelHeight * 4 });
    if (Assets.cache.get(url) !== texture) {
      const error = new Error('terrain resource cache ownership changed during load');
      error.resource = resource; throw error;
    }
    return resource;
  };
  return Object.freeze({
    async load(page, { signal } = {}) {
      if (signal?.aborted) throw new Error('terrain request cancelled before load');
      const full = owned(page.url), variant = profileTextureUrl(full, profile);
      if (variant === full) return request(full);
      try { return await request(variant); }
      catch (error) {
        if (/ownership/.test(String(error?.message))) throw error;
        if (signal?.aborted) throw error;
        return request(full);
      }
      // Pixi Assets has no AbortSignal load API. The lease layer logically
      // cancels in-flight work, charges it until settled, then unloads it.
    },
    async unload(resource) {
      if (Assets.cache.get(resource.url) !== resource.texture || !resource.source || resource.texture.source !== resource.source) throw new Error('terrain source unload ownership mismatch');
      await Assets.unload(resource.url);
      if (Assets.cache.has(resource.url) || resource.texture.destroyed !== true || resource.source.destroyed !== true) throw new Error('terrain source unload incomplete');
    },
  });
}
export function detachTerrainPage({ page, resource, registry, worldProduction, bake } = {}) {
  const source = resource.source ?? resource.texture?.source;
  if (!source) throw new Error('owned terrain source required for detachment');
  registry.unregister(page.kind, page.materialId ?? page.overlayId, resource.texture);
  bake.invalidate();
  const walk = container => {
    for (const child of [...(container?.children ?? [])]) {
      if (child.texture?.source === source) { container.removeChild(child); child.destroy(); }
      else walk(child);
    }
  };
  walk(worldProduction.root);
}
function pagesFromManifest(manifest) {
  validateTerrainManifest(manifest);
  const page = (id, kind, binding, url, width, height) => {
    if (![width, height].every(value => Number.isSafeInteger(value) && value > 0 && value <= 2048)) throw new TypeError('bounded terrain page dimensions required');
    return { id, kind, ...binding, url, reservedDecodedBytes: width * height * 4 };
  };
  return [...TERRAIN_MATERIAL_IDS.flatMap(id => {
    const tile = manifest.materials.find(value => value.id === id), fringe = manifest.fringes?.find(value => value.id === id);
    if (!tile || !fringe) throw new TypeError('complete terrain page dimensions required');
    return [page(`tile:${id}`, 'tile', { materialId: id }, terrainTileAsset(id).imageUrl, tile.size, tile.size),
      page(`fringe:${id}`, 'fringe', { materialId: id }, terrainFringeAsset(id).imageUrl, fringe.width, fringe.height)];
  }), ...TERRAIN_OVERLAY_IDS.map(id => {
    const overlay = manifest.overlays.find(value => value.id === id);
    return page(`overlay:${id}`, 'overlay', { overlayId: id }, terrainOverlayAsset(id).imageUrl, overlay.width, overlay.height);
  })];
}
function areaPages(world) {
  return world.districts.map(district => {
    const area = bounds(district.area), materials = new Set([DISTRICT_TERRAIN_MATERIAL[district.id], 'road', 'packed-earth']);
    const overlays = new Set(['road-shoulder']);
    for (const surface of world.surfaces) {
      const material = SURFACE_TERRAIN_MATERIAL[surface.kind];
      if (!material || !intersects(area, bounds(surface.area))) continue;
      materials.add(material);
      if (surface.kind.includes('water')) overlays.add('shore-band');
      if (surface.kind === 'shallow-water') overlays.add('shallows-band');
      if (surface.kind === 'ramp' || surface.kind === 'ledge') { overlays.add('scree-skirt'); overlays.add('rock-face'); }
    }
    if (world.blockers.some(blocker => blocker.districtId === district.id && blocker.visualKind === 'cliff')) overlays.add('rock-face');
    const pages = [...materials].flatMap(id => [`tile:${id}`, `fringe:${id}`]);
    pages.push(...[...overlays].map(id => `overlay:${id}`));
    return Object.freeze({ id: district.id, area: Object.freeze(area), pages: Object.freeze(pages), requiredTileIds: Object.freeze([...materials].map(id => `tile:${id}`)) });
  });
}
export async function createTerrainAreaStreaming({ world, registry, worldProduction, bake, Assets, profile, signal, fetchImpl = fetch, onError = () => {} } = {}) {
  const response = await fetchImpl(terrainManifestUrl(), { credentials: 'same-origin', signal });
  if (!response.ok) throw new Error(`terrain stream manifest HTTP ${response.status}`);
  const manifest = await response.json();
  if (signal?.aborted) throw new Error('terrain stream boot cancelled');
  const pages = pagesFromManifest(manifest), areas = areaPages(world);
  registry.setManifest(manifest);
  const loader = createOwnedProfileTextureLoader({ Assets, profile, scope: `hmh-terrain-${++nextScope}` });
  const leases = createAreaTextureLeases({ pages, load: loader.load, unload: loader.unload,
    publish(page, resource) {
      if (page.kind === 'tile') registry.register(page.materialId, resource.texture);
      else if (page.kind === 'fringe') registry.registerFringe(page.materialId, resource.texture);
      else registry.registerOverlay(page.overlayId, resource.texture);
    },
    detach: (page, resource) => detachTerrainPage({ page, resource, registry, worldProduction, bake }), onError });
  let interested = [], required = [], key = null, pinned = { pageCount: 0, decodedRgbaEstimateBytes: 0 };
  const snapshot = () => {
    const state = leases.snapshot(), ready = new Set(state.readyPages);
    return { ...state, scope: 'existing six-district terrain subset; props/actors remain pinned',
      ready: key !== null && interested.length > 0 && required.every(id => ready.has(id)), requiredTileIds: [...required], pinnedPropPages: { ...pinned },
      accounting: 'RGBA pixel estimates and full-size pending reservations; excludes mipmaps/driver/GPU peak/decode scratch/process heap' };
  };
  return Object.freeze({
    update({ camera, view }) {
      const selected = selectTerrainAreas({ areas, camera, view, retainedAreaIds: interested });
      const next = selected.join('|');
      if (next === key) return;
      key = next; interested = selected;
      const wanted = areas.filter(area => selected.includes(area.id));
      required = [...new Set(wanted.flatMap(area => area.requiredTileIds))].sort();
      leases.setAreas(wanted);
    },
    setPinnedTextures(textures) {
      const sources = [...new Set(textures.filter(Boolean).map(texture => texture.source))];
      pinned = { pageCount: sources.length, decodedRgbaEstimateBytes: sources.reduce((sum, source) => sum + source.pixelWidth * source.pixelHeight * 4, 0) };
    },
    snapshot, idle: leases.idle, dispose: leases.dispose,
  });
}
