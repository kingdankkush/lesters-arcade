// Real-game binding for the ten-area area-art plans. main.mjs imports this
// module lazily (unranked Free `world=ten-area` only) after the world layers
// exist; nothing here is on the initial static path. It reads
// `world.artPlans.districts[id].artTarget` / `world.artPlans.roads` hooks, loads
// each plan module, paints ground into one camera-transformed container below
// the decal layer, and attaches props/solids to the shared depth RenderLayer.
// Projection only: no collision, navigation, spawning, RNG or result changes.
import { createAreaArt, createAreaArtTextureCache } from './world-v2-area-art.mjs';

export const AREA_ART_BINDING_ID = 'world-v2-area-art-binding/v1';

export async function bindWorldV2AreaArt({ world, host, depthLayer, before = null, loadTexture, unloadTexture, resolution = 'full', worldToScreen, ContainerClass, depthKey = y => y, signal, fetchImpl, createControlTexture, terrainFieldSize = null } = {}) {
  const plans = world?.artPlans, authored = plans?.authored;
  if (!plans?.districts || !authored?.pieces || typeof host?.addChild !== 'function' || typeof depthLayer?.attach !== 'function' || typeof worldToScreen !== 'function' || typeof ContainerClass !== 'function') throw new TypeError('area art binding requires the ten-area world, host container, depth RenderLayer, projection and Container class');
  // Districts without an authored plan still get their brief ground pair, and
  // the closed masses between districts get rock faces; both come from the
  // generic terrain module, imported here so the runtime world table (initial
  // bundle) never grows.
  const terrainModule = () => import('./world-v2-area-plans/district-terrain.mjs');
  const hooks = [...Object.entries(plans.districts).map(([areaId, district]) => district.artTarget?.kind === 'area-art-plan' ? { areaId, load: district.artTarget.load } : { areaId, load: () => terrainModule().then(m => authored => m.createDistrictTerrainArtPlan(authored, areaId)) }), ...(plans.roads?.kind === 'area-art-plan' ? [{ areaId: plans.roads.planId, load: plans.roads.load }] : []), { areaId: 'world-masses', load: () => terrainModule().then(m => m.createWorldMassesArtPlan) }];
  if (!hooks.length) return null;
  const root = new ContainerClass(); root.label = 'world-v2-area-art';
  const ground = new ContainerClass(); ground.label = 'world-v2-area-art-ground';
  // Static ground (terrain, roads, decals, fog) in its own render group: the
  // per-frame camera move of the root no longer re-walks every ground child.
  if ('isRenderGroup' in ground) ground.isRenderGroup = true;
  const depth = new ContainerClass(); depth.label = 'world-v2-area-art-depth';
  root.addChild(ground, depth);
  const cache = createAreaArtTextureCache({ loadTexture, unloadTexture });
  const arts = [], blockerIds = new Set();
  let disposed = false, mounted = false;
  function dispose() {
    if (disposed) return; disposed = true;
    for (const art of arts) { try { art.dispose(); } catch {} }
    cache.dispose();
    root.parent?.removeChild(root);
    if (!root.destroyed) root.destroy({ children: true });
  }
  try {
    for (const hook of hooks) {
      const factory = await hook.load();
      if (disposed || signal?.aborted) { dispose(); return null; }
      const plan = typeof factory === 'function' ? factory(authored) : null;
      if (!plan) continue;
      arts.push(createAreaArt({ world: authored, areaId: hook.areaId, plan, textureCache: cache, signal, resolution, fetchImpl, ...(createControlTexture ? { createControlTexture } : {}), terrainFieldSize }));
    }
    for (const art of arts) { await art.ready; await new Promise(resolve => setTimeout(resolve, 0)); }
    if (disposed || signal?.aborted) { dispose(); return null; }
    for (const art of arts) art.paintGround(ground);
    // Water, decks, ramps and bridges over every ground and road.
    for (const art of arts) art.paintSurfaces?.(ground);
    for (const art of arts) { art.mount(depthLayer, ground, { host: depth, depthKey }); for (const id of art.mountSolids(authored.pieces)) blockerIds.add(id); }
    if (before && before.parent === host) host.addChildAt(root, host.getChildIndex(before)); else host.addChild(root);
    mounted = true;
  } catch (error) { dispose(); throw error; }
  const artCamera = { x: 0, y: 0, zoom: 1, groundZ: 0, shakeX: 0, shakeY: 0 };
  const update = (camera, view, actor = null) => {
    if (disposed || !camera || !view) return 0;
    const origin = worldToScreen({ x: 0, y: 0, z: 0 }, camera, view);
    root.position.set(origin.x, origin.y); root.scale.set(camera.zoom);
    let visible = 0;
    artCamera.x = camera.x; artCamera.y = camera.y; artCamera.zoom = camera.zoom; artCamera.groundZ = camera.groundZ ?? 0; artCamera.shakeX = camera.shakeX ?? 0; artCamera.shakeY = camera.shakeY ?? 0;
    for (const art of arts) visible += art.update(artCamera, view, actor);
    return visible;
  };
  return Object.freeze({ id: AREA_ART_BINDING_ID, root, blockerIds, update, dispose, snapshot: () => Object.freeze({ id: AREA_ART_BINDING_ID, disposed, mounted, resolution, plans: arts.map(art => art.snapshot()), textureCache: cache.snapshot(), blockerIds: [...blockerIds].sort(), runtimeAuthority: 'projection-only' }) });
}
