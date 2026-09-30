// QA witness reads actual Pixi canvas overlay bounds; it never changes displays.
export function collectMeadowsCanvasHudRects(nodes) {
  const rectangles = [], errors = [];
  for (const [index, node] of nodes.entries()) {
    if (!node?.visible || node.destroyed || node.renderable === false) continue;
    try {
      const { x, y, width, height } = node.getBounds();
      if (![x, y, width, height].every(Number.isFinite)) throw new Error('nonfinite canvas guidance bounds');
      if (width > 0 && height > 0) rectangles.push({ id: 'canvas-guidance-' + index, text: typeof node.text === 'string' ? node.text : '', x, y, width, height });
    } catch (error) { errors.push(String(error?.message ?? error)); }
  }
  return { rectangles, errors };
}

import { freezeDeep } from './value-guards.mjs';
export const MEADOWS_PROJECTION_ADAPTER = Object.freeze({ cameraPitchFromVerticalDegrees: 55, zPrewarp: 1 / Math.tan(55 * Math.PI / 180), spriteYScale: 1 / Math.cos(55 * Math.PI / 180), handedness: 'worldY=-BlenderY' });
export function resolveMeadowsTargetCameraZoom({ baseZoom, mobile = false, enabled = false } = {}) {
  if (!Number.isFinite(baseZoom) || baseZoom <= 0) throw new TypeError('Meadows art target: positive finite camera zoom required');
  return enabled ? baseZoom * (mobile ? 0.35 : 0.50) : baseZoom;
}
const ROOT = '/assets/generated/hmh-art-target/';
const HASH = /^[a-f0-9]{64}$/;
const IDS = ['art-target-meadows-tree-oak', 'art-target-meadows-house'];
const failure = message => { throw new TypeError(`Meadows art target: ${message}`); };

export function createMeadowsArtTargetPlan(world) {
  const bindings = [['relay-hedgerow', IDS[0], 350, 90, 162], ['relay-abandoned-farmhouse', IDS[1], 223, 254, 260]].map(([id, assetId, width, depth, height]) => {
    const blocker = world?.blockers?.find(entry => entry.id === id);
    const vertices = blocker?.shape?.vertices;
    if (blocker?.shape?.type !== 'polygon' || vertices.length !== 4 || blocker.maxZ !== height || Math.max(...vertices.map(p => p.x)) - Math.min(...vertices.map(p => p.x)) !== width || Math.max(...vertices.map(p => p.y)) - Math.min(...vertices.map(p => p.y)) !== depth) failure(`existing blocker geometry changed: ${id}`);
    return { id: `art-target:${id}`, assetId, collisionBlockerId: id, x: blocker.anchor.x, y: blocker.anchor.y, groundZ: 0, scale: 1, category: 'environment', maxZ: blocker.maxZ, footprint: structuredClone(blocker.shape) };
  });
  return freezeDeep({ runtimeAuthority: 'projection-only', ownerAccepted: false, bindings, ground: [{ x: 120, y: 1000, width: 640, height: 480, page: 0 }, { x: 120, y: 1480, width: 640, height: 480, page: 1 }], quietLane: { minX: 580, maxX: 740, minY: 1510, maxY: 1900 } });
}

export function replaceMeadowsArtPlacements(placements, plan) {
  const ids = new Set(plan.bindings.map(binding => binding.collisionBlockerId));
  return Object.freeze([...placements.filter(placement => !ids.has(placement.collisionBlockerId)), ...plan.bindings]);
}

function hasDisclosedMixedVegetationStudy(metadata) {
  const study = metadata.mixedVegetationStudy;
  if (study?.schema !== 'hmh-mixed-vegetation-study/v1' || study.nativeComplete !== true || study.artAccepted !== false || study.runtimeAdmission !== false || study.visibleBarrierAccepted !== false) return false;
  const sourceHashes = {
    oak: '63c8da08bfcd68b4d078ffd6be1b4ef3d15f91c0f6aabb3b38790c4bb5f0c17c',
    shrub: '61cc66284f586d05ca11607ebcd4a4639365da4d000b08c394e79b6101ed93cf',
    fern: '4fc71c6927acd1b8f4e7b5efa02ae045edc307c5bf790e5d4e864f15449b8041',
  };
  if (!Object.entries(sourceHashes).every(([kind, expected]) => {
    const source = study.sources?.[kind];
    return source?.sourceSha256 === expected && HASH.test(source.beforeDataSha256) && source.afterDataSha256 === source.beforeDataSha256;
  })) return false;
  const material = study.materialStudy;
  const copiedMaterials = material?.oakMaterialCopyOnly === true ||
    (metadata.calibrationPreview === true && study.calibrationPreview === true && material?.allChangesObjectLinked === true);
  return copiedMaterials && material.originalTextureBytesPreserved === true && material.shaderFidelityToOriginal === false &&
    [study.nativeReceiptSha256, study.actualPixelsSha256, study.inputManifestSha256].every(hash => HASH.test(hash));
}

export function validateMeadowsArtMetadata(metadata, tier) {
  if (metadata?.schema !== 'hmh-meadows-art-target/v1' || metadata.runtimeAuthority !== 'projection-only' || metadata.ownerAccepted !== false) failure('projection-only candidate authority required');
  const adapter = metadata.projectionAdapter;
  if (!adapter || adapter.handedness !== MEADOWS_PROJECTION_ADAPTER.handedness || !['cameraPitchFromVerticalDegrees', 'zPrewarp', 'spriteYScale'].every(key => Number.isFinite(adapter[key]) && Math.abs(adapter[key] - MEADOWS_PROJECTION_ADAPTER[key]) < 1e-12)) failure('measured 55 degree camera projection contract required');
  if (metadata.palette !== 'muted-environment') failure('reserved cue palette must remain separate');
  const oak = metadata.sources?.oak, reuse = metadata.sourceReuse;
  const localOak = oak?.method === 'local-blender-authored';
  const preservedOwnerOak = oak?.method === 'existing-owner-tree55-uniform-placement' && oak.ownerSourceSha256 === '63c8da08bfcd68b4d078ffd6be1b4ef3d15f91c0f6aabb3b38790c4bb5f0c17c' && reuse?.sourceSha256 === oak.ownerSourceSha256 && reuse.geometryUvMaterialTexturePreserved === true && reuse.sharedMeshMaterialImageData === true && reuse.completeProducerIntegrity?.sharedDataIdentityConfirmed === true && HASH.test(reuse.completeProducerIntegrity.afterCompleteProducerDigest);
  const mixedOwnerStudy = oak?.method === 'existing-owner-mixed-vegetation-study' && hasDisclosedMixedVegetationStudy(metadata);
  if ((!localOak && !preservedOwnerOak && !mixedOwnerStudy) || metadata.sources?.house?.method !== 'existing-owner-model' || ![oak?.sha256, metadata.sources?.house?.sha256].every(hash => HASH.test(hash))) failure('preserved source provenance required');
  const selected = metadata.tiers?.[tier], pages = selected?.pages;
  if (!Array.isArray(pages) || pages.length !== 3) failure('three target pages required');
  let decodedBytes = 0, encodedBytes = 0;
  for (const page of pages) {
    if (!/^[a-z0-9-]+\.webp$/.test(page.image) || !HASH.test(page.sha256) || ![page.width, page.height, page.bytes].every(value => Number.isInteger(value) && value > 0) || page.width > 2048 || page.height > 2048) failure('invalid page URL, provenance or extent');
    decodedBytes += page.width * page.height * 4; encodedBytes += page.bytes;
  }
  if (selected.frames?.length !== 2) failure('complete target frame pair required');
  for (const [index, frame] of selected.frames.entries()) {
    const rectangle = frame.frame, page = pages[frame.page];
    if (frame.assetId !== IDS[index] || frame.page !== 2 || !rectangle || ![rectangle.x, rectangle.y, rectangle.w, rectangle.h].every(Number.isInteger) || rectangle.x < 0 || rectangle.y < 0 || rectangle.w < 1 || rectangle.h < 1 || rectangle.x + rectangle.w > page.width || rectangle.y + rectangle.h > page.height) failure('frame identity or bounds invalid');
    const alpha = frame.alphaBounds;
    if (alpha && (![alpha.x, alpha.y, alpha.w, alpha.h].every(Number.isInteger) || alpha.x < 0 || alpha.y < 0 || alpha.w < 1 || alpha.h < 1 || alpha.x + alpha.w > rectangle.w || alpha.y + alpha.h > rectangle.h)) failure('measured painted alpha bounds invalid');
    if (!Number.isFinite(frame.runtimeScale) || frame.runtimeScale <= 0 || !Number.isFinite(frame.projectionY) || Math.abs(frame.projectionY - MEADOWS_PROJECTION_ADAPTER.spriteYScale) >= 1e-12 || ![frame.anchor?.x, frame.anchor?.y].every(value => Number.isFinite(value) && value >= 0 && value <= 1)) failure('frame projection invalid');
  }
  const [a, b] = selected.frames.map(frame => frame.frame);
  if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) failure('overlapping target frames');
  return { pages, frames: selected.frames, decodedBytes, encodedBytes };
}

export async function loadMeadowsArtTarget({ enabled = false, world, mobile = false, fetchImpl = fetch, loadTexture, unloadTexture = async () => {}, isDisposed = () => false, onCleanupReport = () => {} } = {}) {
  if (!enabled || isDisposed()) return null;
  const loaded = [], appearance = new Map();
  let disposePromise = null, groundLayer = null, disposed = false;
  const getCleanupStatus = () => freezeDeep({ disposed, ok: disposed && loaded.every(entry => entry.released), ownedResourceUrls: loaded.filter(entry => !entry.released).map(entry => entry.url), failedResources: loaded.filter(entry => entry.error !== undefined).map(entry => ({ url: entry.url, attempts: entry.attempts, error: entry.error })) });
  const dispose = () => {
    disposed = true;
    groundLayer?.container?.parent?.removeChild(groundLayer.container);
    groundLayer?.container?.destroy?.({ children: true });
    groundLayer = null;
    appearance.clear();
    if (disposePromise) return disposePromise;
    const pending = loaded.filter(entry => !entry.released);
    if (!pending.length) return Promise.resolve(getCleanupStatus());
    disposePromise = (async () => {
      const results = await Promise.allSettled(pending.map(async entry => { entry.attempts = (entry.attempts ?? 0) + 1; await unloadTexture(entry.url); }));
      results.forEach((result, index) => {
        const entry = pending[index];
        if (result.status === 'fulfilled') { entry.released = true; delete entry.error; }
        else entry.error = String(result.reason?.message ?? result.reason);
      });
      const report = getCleanupStatus();
      // Failed pages stay owned and explicit; a later dispose retries only them.
      try { onCleanupReport({ ...report, retry: dispose }); }
      catch (error) { console.warn('[HMH] Meadows cleanup report callback failed', error); }
      return report;
    })().finally(() => { disposePromise = null; });
    return disposePromise;
  };
  try {
    const plan = createMeadowsArtTargetPlan(world);
    const response = await fetchImpl(ROOT + 'manifest.json', { credentials: 'same-origin' });
    if (!response.ok) failure(`metadata HTTP ${response.status}`);
    const metadata = await response.json(), selected = validateMeadowsArtMetadata(metadata, mobile ? 'mobile' : 'desktop');
    if (isDisposed()) return null;
    for (const page of selected.pages) {
      const url = ROOT + page.image, texture = await loadTexture(url);
      loaded.push({ url, texture });
      if (isDisposed()) { await dispose(); return null; }
      if (texture?.source?.pixelWidth !== page.width || texture.source.pixelHeight !== page.height) failure('decoded page size mismatch');
    }
    for (const frame of selected.frames) appearance.set(frame.assetId, { sourceAssetId: frame.assetId, texture: loaded[frame.page].texture, frame: { ...frame, category: 'environment' } });
    const createGround = ({ ContainerClass, SpriteClass, target, before }) => {
      if (disposed || groundLayer) failure('ground layer already created or disposed');
      const container = new ContainerClass(); container.label = 'meadows-art-target-ground';
      const sprites = [];
      try {
        for (const piece of plan.ground) { const sprite = new SpriteClass({ texture: loaded[piece.page].texture }); sprite.anchor.set(0, 0); container.addChild(sprite); sprites.push(sprite); }
        target.addChildAt(container, target.getChildIndex(before));
        groundLayer = { container, sprites };
        return groundLayer;
      } catch (error) { container.destroy?.({ children: true }); throw error; }
    };
    const renderGround = ({ camera, view, worldToScreen }) => {
      if (!groundLayer || disposed) return;
      for (const [index, piece] of plan.ground.entries()) {
        const sprite = groundLayer.sprites[index], point = worldToScreen({ x: piece.x, y: piece.y, z: 0 }, camera, view);
        sprite.position.set(point.x, point.y); sprite.width = piece.width * camera.zoom; sprite.height = piece.height * camera.zoom;
        sprite.visible = point.x + sprite.width >= 0 && point.x <= view.width && point.y + sprite.height >= 0 && point.y <= view.height;
      }
    };
    return { plan, appearance, collectCanvasHud: collectMeadowsCanvasHudRects, resolveCameraZoom: baseZoom => resolveMeadowsTargetCameraZoom({ baseZoom, mobile, enabled: true }), encodedBytes: selected.encodedBytes, decodedBytes: selected.decodedBytes, replacePlacements: placements => replaceMeadowsArtPlacements(placements, plan), createGround, renderGround, getCleanupStatus, dispose };
  } catch (error) { await dispose(); const surfaced = error instanceof Error ? error : new Error(String(error)); surfaced.artTargetCleanup = { getStatus: getCleanupStatus, retry: dispose }; throw surfaced; }
}
