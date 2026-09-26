// Static world bake. Projection only: nothing here reads or writes simulation,
// collision, RNG, progression or evidence state.
//
// renderWorldProductionArt used to re-project every route node, surface and
// blocker, rebuild every ground Graphics and re-place every tile and strip
// sprite on every frame, although the ground only ever moves with the camera.
// This draws the static pass once around the camera, into a view enlarged by
// a margin, and afterwards only translates it. The static layers are grouped
// into GPU-transformed render groups, so a translation costs one matrix and
// no geometry, and the stage's per-frame instruction rebuild skips them. Only
// the animated pass (water shimmer, landmarks, interactions, particles,
// lighting, vignette) draws every frame, in screen space as before.
//
// Exactness: worldToScreen is a translation of the bake projection for a
// fixed zoom, so every baked vertex lands where the per-frame renderer put
// it. The world-locked terrain tile pattern ignores camera.groundZ while the
// geometry does not, so the pattern phase is corrected when the camera
// changes height. Anything else that alters the static output (zoom, view,
// textures, fallback blockers, the town fallback, a caller key such as the
// decal set) re-bakes. While the zoom animates, the bake has no margin, so an
// animated zoom costs what every frame used to.

export const STATIC_WORLD_BAKE_MARGIN = 320;

// Pools whose tiles anchor their texture to the camera (createTerrainSpritePlacer).
const CAMERA_ANCHORED_POOLS = ['terrainSprites', 'surfaceSprites', 'rampSprites', 'roadSprites', 'pathSprites'];

export function createStaticWorldBake({
  worldProduction,
  world,
  render,
  ContainerClass,
  GraphicsClass,
  extraLayers = [],
  margin = STATIC_WORLD_BAKE_MARGIN,
}) {
  if (!worldProduction?.root || !world || typeof render !== 'function') throw new TypeError('static world bake inputs are required');
  const { root, layers } = worldProduction;
  const animated = new Set([layers.landmarks, layers.interactions, layers.particles, layers.lighting, layers.vignette, worldProduction.depthFeatureRoot]);
  // One static cue target per water-surface boundary, with the animated
  // shimmer of each water surface between them, so the cue draw order is
  // exactly the single-layer order.
  const cues = [worldProduction.surfaceCues];
  const shimmers = [];
  for (const surface of world.surfaces) {
    if (!surface.kind.includes('water')) continue;
    shimmers.push(Object.assign(new GraphicsClass(), { label: `world-water-shimmer-${shimmers.length}` }));
    cues.push(Object.assign(new GraphicsClass(), { label: `world-surface-cues-${cues.length}` }));
  }
  const groups = [];
  let run = [];
  const closeRun = () => {
    if (run.length === 0) return;
    const group = new ContainerClass();
    group.label = `world-static-${groups.length}`;
    root.addChildAt(group, root.getChildIndex(run[0]));
    for (const member of run) group.addChild(member);
    group.isRenderGroup = true;
    groups.push(group);
    run = [];
  };
  for (const child of [...root.children]) {
    if (animated.has(child)) { closeRun(); continue; }
    run.push(child);
    if (child === worldProduction.surfaceCues) {
      closeRun();
      let at = root.getChildIndex(groups.at(-1)) + 1;
      for (let index = 0; index < shimmers.length; index += 1) {
        root.addChildAt(shimmers[index], at++);
        root.addChildAt(cues[index + 1], at++);
      }
    }
  }
  closeRun();
  const moved = [...groups, ...cues.slice(1), worldProduction.depthFeatureRoot, ...extraLayers].filter(Boolean);
  const tiled = CAMERA_ANCHORED_POOLS.map((name) => worldProduction[name]).filter(Boolean);

  let bake = null;
  let bakes = 0;
  let lastZoom = null;
  const offset = { x: 0, y: 0 };
  // Everything the static pass reads besides the camera position. The tile
  // registry bumps its version whenever a texture or the manifest arrives.
  // Filled into one reused array every frame; a caller that already holds the
  // blocker ids joined with ',' passes them as nativeBlockerKey.
  const frameKey = [];
  const keyFor = (args, extraKey) => {
    frameKey.length = 0;
    frameKey.push(args.world, args.camera.zoom, args.view.width, args.view.height, args.performanceProfile,
      worldProduction.groundFallback?.draw, layers.townBlockers.visible,
      args.nativeBlockerKey ?? [...(args.nativeBlockerIds ?? [])].join(','), extraKey,
      args.terrainTiles, args.terrainTiles?.version);
    return frameKey;
  };
  // The camera-anchored tile origin the per-frame placer would use.
  const tileOrigin = (camera, view) => ({ x: view.width / 2 - camera.x * camera.zoom, y: view.height / 2 - camera.y * camera.zoom });
  const locate = ({ camera, view, worldToScreen }) => {
    const probe = { x: bake.camera.x, y: bake.camera.y, z: 0 };
    const now = worldToScreen(probe, camera, view);
    const then = worldToScreen(probe, bake.camera, bake.view);
    offset.x = now.x - then.x;
    offset.y = now.y - then.y;
    return Math.abs(offset.x + bake.margin) <= bake.margin && Math.abs(offset.y + bake.margin) <= bake.margin;
  };

  return Object.freeze({
    groups,
    cues,
    shimmers,
    offset,
    /** Static passes drawn so far (telemetry and tests). */
    get bakes() { return bakes; },
    /**
     * One frame: re-bake when needed, translate the baked layers, then draw the
     * animated pass. `onBake(bakeCamera, bakeView)` draws caller-owned static
     * layers (decals) with the bake projection; they move with the bake.
     * Returns the animated pass report.
     */
    render(args, onBake = null, extraKey = null) {
      const { camera, view } = args;
      const key = keyFor(args, extraKey);
      let same = bake !== null && key.length === bake.key.length;
      for (let index = 0; same && index < key.length; index += 1) same = Object.is(key[index], bake.key[index]);
      if (!same || !locate(args)) {
        const pad = lastZoom === null || camera.zoom === lastZoom ? margin : 0;
        bake = {
          key: key.slice(),
          margin: pad,
          camera: { ...camera },
          view: { width: view.width + pad * 2, height: view.height + pad * 2 },
          phase: { x: 0, y: 0 },
        };
        bakes += 1;
        render({ ...args, camera: bake.camera, view: bake.view, pass: 'static', cues });
        onBake?.(bake.camera, bake.view);
        locate(args);
      }
      lastZoom = camera.zoom;
      for (const layer of moved) layer.position.set(offset.x, offset.y);
      const now = tileOrigin(camera, view);
      const then = tileOrigin(bake.camera, bake.view);
      const phaseX = now.x - then.x - offset.x;
      const phaseY = now.y - then.y - offset.y;
      if (Math.abs(phaseX - bake.phase.x) > 1e-6 || Math.abs(phaseY - bake.phase.y) > 1e-6) {
        for (const pool of tiled) {
          for (const sprite of pool.children) {
            sprite.tilePosition?.set(sprite.tilePosition.x + phaseX - bake.phase.x, sprite.tilePosition.y + phaseY - bake.phase.y);
          }
        }
        bake.phase = { x: phaseX, y: phaseY };
      }
      return render({ ...args, pass: 'dynamic', shimmers });
    },
  });
}
