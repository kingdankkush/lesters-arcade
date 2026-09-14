import { resolveWorldDesignSprite } from './world-design-native-assets.mjs';
import { worldDesignPropPresentation } from './world-design-life.mjs';
import { createWorldDesignSpatialIndex } from './world-design-spatial.mjs';
import { freezeDeep } from './value-guards.mjs';
import { seededUnit } from './deterministic-hash.mjs';
import { AUTHORED_PROP_ASSETS, resolveAuthoredLandmarkSignal } from './authored-prop-layout.mjs';

export function createAuthoredHeldWeaponDisplay({ index, atlasTexture, ContainerClass, SpriteClass, TextureClass, RectangleClass } = {}) {
  if (!index?.frameById || !atlasTexture?.source) throw new TypeError('authored weapon index and texture are required');
  let container = null;
  let sprite = null;
  let destroyed = false;
  const textures = new Map();
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    sprite?.destroy?.();
    container?.destroy?.({ children: true });
    for (const texture of textures.values()) texture.destroy?.(false);
    textures.clear();
  };
  try {
    container = new ContainerClass();
    container.label = 'authored-held-weapon';
    container.visible = false;
    for (const assetId of AUTHORED_PROP_ASSETS.weapons) {
      const frame = index.frameFor(assetId);
      if (!frame) throw new RangeError(`missing authored weapon frame ${assetId}`);
      textures.set(assetId, new TextureClass({ source: atlasTexture.source, frame: new RectangleClass(frame.frame.x, frame.frame.y, frame.frame.w, frame.frame.h) }));
    }
    sprite = new SpriteClass({ texture: textures.get(AUTHORED_PROP_ASSETS.weapons[0]) });
    sprite.label = 'authored-held-weapon-sprite';
    sprite.anchor.set(0.5, 0.5);
    container.addChild(sprite);
    // reloadDip is the reload-presentation pose ({ dy, rotation } in body
    // units) for the shotgun / MG / rail / launcher props, which have no
    // native reload frame either. Its rotation is authored for a muzzle
    // pointing screen-left and is mirrored when the aim points right, so
    // the muzzle always tilts toward the ground. Omitted, the placement is
    // exactly the pinned one.
    container.applyWeapon = ({ weaponId, screen, aimScreen, cameraZoom = 1, reloadDip = null } = {}) => {
      const assetId = weaponId;
      const frame = index.frameFor(assetId);
      const texture = textures.get(assetId);
      if (!frame || !texture || !screen || !aimScreen) {
        container.visible = false;
        return null;
      }
      container.visible = true;
      sprite.texture = texture;
      const angle = Math.atan2(aimScreen.y - screen.y, aimScreen.x - screen.x);
      const dipDy = reloadDip ? (Number(reloadDip.dy) || 0) * cameraZoom : 0;
      const dipRotation = reloadDip ? (Number(reloadDip.rotation) || 0) * (Math.cos(angle) < 0 ? 1 : -1) : 0;
      container.position.set(screen.x + Math.cos(angle) * 20 * cameraZoom, screen.y + Math.sin(angle) * 20 * cameraZoom + dipDy);
      container.rotation = angle + dipRotation;
      container.scale.set(frame.runtimeScale * 0.72 * cameraZoom);
      container.productionAssetId = weaponId;
      return frame;
    };
    return Object.freeze({ container, sprite, destroy });
  } catch (error) {
    destroy();
    throw error;
  }
}

export function createAuthoredPropDisplay({ index, atlasTexture, renderAssets = new Map(), placements, depthLayer = null, ContainerClass, SpriteClass, TextureClass, RectangleClass, GraphicsClass, staticWorld = false } = {}) {
  if (!index?.frameById || !atlasTexture?.source) throw new TypeError('authored prop index and texture are required');
  for (const [value, name] of [[ContainerClass, 'ContainerClass'], [SpriteClass, 'SpriteClass'], [TextureClass, 'TextureClass'], [RectangleClass, 'RectangleClass'], [GraphicsClass, 'GraphicsClass']]) {
    if (typeof value !== 'function') throw new TypeError(`${name} is required`);
  }
  const container = new ContainerClass();
  container.label = 'authored-prop-atlas';
  container.sortableChildren = true;
  const effects = new GraphicsClass();
  effects.label = 'authored-landmark-signals';
  effects.zIndex = -1_000_000;
  container.addChild(effects);
  const textureById = new Map();
  const ownedSprites = new Set();
  let destroyed = false;
  const destroyResources = () => {
    if (destroyed) return;
    destroyed = true;
    for (const sprite of ownedSprites) {
      depthLayer?.detach(sprite);
      sprite.parent?.removeChild(sprite);
      sprite.destroy?.();
    }
    ownedSprites.clear();
    container.destroy?.({ children: true });
    for (const texture of textureById.values()) texture.destroy?.(false);
    textureById.clear();
  };
  const createEntry = (placement) => {
    let sprite = null;
    let createdTexture = null;
    let createdTextureId = null;
    try {
      const nativeAsset = renderAssets.get(placement.assetId);
      if (nativeAsset && !nativeAsset.texture?.source) throw new TypeError('native prop texture is required');
      const frame = nativeAsset?.frame ?? index.frameFor(placement.assetId);
      if (!frame) throw new RangeError(`missing authored prop frame ${placement.assetId}`);
      let texture = textureById.get(frame.assetId);
      if (!texture) {
        texture = new TextureClass({ source: (nativeAsset?.texture ?? atlasTexture).source, frame: new RectangleClass(frame.frame.x, frame.frame.y, frame.frame.w, frame.frame.h) });
        textureById.set(frame.assetId, texture);
        createdTexture = texture;
        createdTextureId = frame.assetId;
      }
      sprite = new SpriteClass({ texture });
      ownedSprites.add(sprite);
      sprite.label = `authored-prop-${placement.id}`;
      sprite.anchor.set(frame.anchor.x, frame.anchor.y);
      sprite.productionAssetId = placement.assetId;
      sprite.sourceModelAssetId = nativeAsset?.sourceAssetId ?? null;
      container.addChild(sprite);
      if (placement.occlusion !== 'deck') depthLayer?.attach(sprite);
      return { placement, frame, sprite };
    } catch (error) {
      if (sprite) {
        depthLayer?.detach(sprite);
        sprite.parent?.removeChild(sprite);
        ownedSprites.delete(sprite);
        sprite.destroy?.();
      }
      if (createdTexture) {
        textureById.delete(createdTextureId);
        createdTexture.destroy?.(false);
      }
      throw error;
    }
  };
  let entries;
  try {
    entries = placements.map(createEntry);
  } catch (error) {
    destroyResources();
    throw error;
  }
  let spatial=null,previousCandidates=[];
  const addPlacement = (placement) => {
    if (!placement || typeof placement.id !== 'string' || entries.some((entry) => entry.placement.id === placement.id)) throw new TypeError('unique authored prop placement is required');
    const entry = createEntry(freezeDeep({ ...placement }));
    entries.push(entry);
    spatial=null;
    return Object.freeze({ placementId: placement.id, assetId: placement.assetId });
  };
  const removePlacement = (placementId) => {
    const entryIndex = entries.findIndex((entry) => entry.placement.id === placementId);
    if (entryIndex < 0) return false;
    const [entry] = entries.splice(entryIndex, 1);
    spatial=null;
    depthLayer?.detach(entry.sprite);
    container.removeChild(entry.sprite);
    ownedSprites.delete(entry.sprite);
    entry.sprite.destroy?.();
    return true;
  };

  const render = ({ camera, view, worldToScreen, queryGround, tick = 0, cullMargin = 160, hiddenPlacementIds = null, reduceMotion = false, contactShadows = null, focusPoints = [] } = {}) => {
    effects.clear();
    let visibleCount = 0;
    const visibleByCategory = {};
    let onscreenCount = 0;
    let nativeOnscreenCount = 0;
    const nativeOnscreenAssetIds = new Set();
    const onscreenByCategory = {};
    let signalVisibleCount = 0;
    let animatedSignalVisibleCount = 0;
    let signalOnscreenCount = 0;
    let animatedSignalOnscreenCount = 0;
    let candidates=entries;
    if(staticWorld) {
      if(!spatial) {
        const rectangles=entries.map(entry=>{
          entry.sprite.visible=false;
          entry.staticGround=queryGround(entry.placement.x,entry.placement.y);
          const p=resolveWorldDesignSprite({frame:entry.frame,placement:entry.placement,groundZ:entry.staticGround.groundZ,zoom:1});
          const w=entry.frame.frame.w*p.scaleX,h=entry.frame.frame.h*p.scaleY;
          const x=entry.placement.x,y=entry.placement.y-p.groundZ;
          return {left:x-entry.frame.anchor.x*w-8,right:x+(1-entry.frame.anchor.x)*w+8,top:y-entry.frame.anchor.y*h-21,bottom:y+(1-entry.frame.anchor.y)*h+8};
        });
        spatial=createWorldDesignSpatialIndex(rectangles);
      }
      const origin=worldToScreen({x:0,y:0,z:0},camera,view),z=camera.zoom;
      candidates=spatial.query({left:(-cullMargin-origin.x)/z,right:(view.width+cullMargin-origin.x)/z,top:(-cullMargin-origin.y)/z,bottom:(view.height+cullMargin-origin.y)/z}).map(i=>entries[i]);
      for(const entry of previousCandidates) entry.sprite.visible=false;
      previousCandidates=candidates;
    }
    for (const entry of candidates) {
      if (hiddenPlacementIds?.has(entry.placement.id)) {
        entry.sprite.visible = false;
        continue;
      }
      if (entry.placement.mobileOnly && view.width > 600) {
        entry.sprite.visible = false;
        continue;
      }
      const ground = staticWorld?entry.staticGround:queryGround(entry.placement.x, entry.placement.y);
      const pickupBob = entry.placement.category === 'pickup'
        ? 8 + Math.sin((tick + seededUnit(0, entry.placement.id) * 60) / 16) * 5
        : 0;
      const projection = resolveWorldDesignSprite({ frame: entry.frame, placement: entry.placement, groundZ: ground.groundZ, zoom: camera.zoom });
      const screen = worldToScreen({ x: entry.placement.x, y: entry.placement.y, z: projection.groundZ + pickupBob }, camera, view);
      const width = entry.frame.frame.w * projection.scaleX;
      const height = entry.frame.frame.h * projection.scaleY;
      const bounds = { left: screen.x - entry.frame.anchor.x * width, right: screen.x + (1-entry.frame.anchor.x)*width, top: screen.y-entry.frame.anchor.y*height, bottom: screen.y+(1-entry.frame.anchor.y)*height };
      // Large buildings and bridge ramps must remain visible while any painted
      // portion overlaps the viewport, even when their ground anchor is outside.
      const visible = bounds.right >= -cullMargin && bounds.left <= view.width+cullMargin && bounds.bottom >= -cullMargin && bounds.top <= view.height+cullMargin;
      entry.sprite.visible = visible;
      if (!visible) continue;
      visibleCount += 1;
      visibleByCategory[entry.placement.category] = (visibleByCategory[entry.placement.category] ?? 0) + 1;
      const onscreen = bounds.right >= 0 && bounds.left <= view.width && bounds.bottom >= 0 && bounds.top <= view.height;
      if (onscreen) {
        onscreenCount += 1;
        if (entry.sprite.sourceModelAssetId) {
          nativeOnscreenCount += 1;
          nativeOnscreenAssetIds.add(entry.sprite.sourceModelAssetId);
        }
        onscreenByCategory[entry.placement.category] = (onscreenByCategory[entry.placement.category] ?? 0) + 1;
      }
      entry.sprite.position.set(screen.x, screen.y);
      const spriteScale = entry.frame.runtimeScale * (entry.placement.scale ?? 1) * camera.zoom;
      const painted = entry.frame.alphaBounds ?? entry.frame.frame;
      entry.sprite.scale.set(projection.scaleX, projection.scaleY);
      const life=worldDesignPropPresentation({placement:entry.placement,bounds,focusPoints,tick,reduceMotion});
      entry.sprite.alpha = life.alpha;
      entry.sprite.skew?.set(life.skewX,0);
      entry.sprite.zIndex = entry.placement.y;
      if (contactShadows) {
        // The shadow belongs to the ground point, not the sprite: a bobbing
        // pickup rises off a shadow that stays where it will land.
        const groundScreen = pickupBob
          ? worldToScreen({ x: entry.placement.x, y: entry.placement.y, z: ground.groundZ }, camera, view)
          : screen;
        const spriteWidth = painted.w * spriteScale;
        // A tall prop stands on a base much narrower than its sprite: a relay
        // mast is 100 px wide at the top and a few px wide where it meets the
        // ground. Sprite aspect is the footprint signal the atlas actually
        // carries, so lean silhouettes get a lean shadow.
        const footprintPx = spriteWidth * 0.5 * Math.min(1, Math.max(0.42, painted.w / painted.h));
        contactShadows.place({
          placementId: entry.placement.id,
          x: groundScreen.x,
          y: groundScreen.y,
          footprintPx,
          lift: pickupBob,
          // A wide base sits in a pool of occlusion; a crate does not.
          ao: footprintPx * 2 >= 96,
        });
      }
      const signal = resolveAuthoredLandmarkSignal({ placement: entry.placement, tick, reduceMotion });
      if (signal) {
        const signalX = screen.x;
        const signalY = screen.y - painted.h * spriteScale * 0.58;
        const radius = Math.max(7, painted.w * spriteScale * signal.radiusScale);
        effects.circle(signalX, signalY, radius)
          .stroke({ color: signal.color, width: Math.max(1.5, 2.4 * camera.zoom), alpha: signal.alpha });
        effects.circle(signalX, signalY, Math.max(2, radius * 0.11))
          .fill({ color: signal.color, alpha: Math.min(0.82, signal.alpha + 0.22) });
        signalVisibleCount += 1;
        if (signal.animated) animatedSignalVisibleCount += 1;
        if (onscreen) signalOnscreenCount += 1;
        if (signal.animated && onscreen) animatedSignalOnscreenCount += 1;
      }
    }
    return Object.freeze({
      placementCount: entries.length,
      candidateCount: candidates.length,
      visibleCount,
      visibleByCategory: Object.freeze(visibleByCategory),
      onscreenCount,
      nativeOnscreenCount,
      nativeOnscreenAssetIds: Object.freeze([...nativeOnscreenAssetIds].sort()),
      onscreenByCategory: Object.freeze(onscreenByCategory),
      signalVisibleCount,
      animatedSignalVisibleCount,
      signalOnscreenCount,
      animatedSignalOnscreenCount,
    });
  };
  return Object.freeze({
    container,
    effects,
    get entries() { return Object.freeze([...entries]); },
    addPlacement,
    removePlacement,
    render,
    destroy: destroyResources,
  });
}
