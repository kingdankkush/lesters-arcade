export const AUTHORED_PROP_PIPELINE_ID = 'hmh-reboot-authored-props-v1';
export const AUTHORED_PROP_ATLAS_IMAGE_URL = '/assets/generated/hmh-reboot-authored-props/hmh-authored-props-atlas.png';
export const AUTHORED_PROP_ATLAS_METADATA_URL = '/assets/generated/hmh-reboot-authored-props/hmh-authored-props-atlas.json';
export const AUTHORED_PROP_ITEM_ROOT = '/assets/generated/hmh-reboot-authored-props/items';

export const AUTHORED_PROP_ASSETS = Object.freeze({
  weapons: Object.freeze(['coin-blaster', 'scatter-shotgun', 'auto-miner', 'launcher-rig']),
  pickups: Object.freeze(['bonus-life', 'hash-rail-core', 'time-dilation', 'berserk-candle', 'nuke-liquidation']),
  powerUps: Object.freeze(['proof-of-work', 'diamond-hands', 'gas-optimization', 'cold-storage', 'block-reward', 'validator-training', 'compound-interest', 'hardened-wallet']),
  worldProps: Object.freeze(['relay-console', 'salvage-crate', 'proof-pylon', 'bridge-bollard', 'hashwood-stump', 'crystal-cluster', 'ore-cart', 'loader-barrel', 'rugpull-barricade', 'warning-beacon', 'liquidation-terminal', 'fuel-drum']),
});

const DISTRICTS = Object.freeze([
  Object.freeze({ id: 'frontier-relay', minX: 0, maxX: 1_800, propIds: ['relay-console', 'salvage-crate', 'fuel-drum'] }),
  Object.freeze({ id: 'rugpull-ravine', minX: 1_800, maxX: 3_800, propIds: ['rugpull-barricade', 'salvage-crate', 'warning-beacon'] }),
  Object.freeze({ id: 'liquidity-crossing', minX: 3_800, maxX: 6_000, propIds: ['proof-pylon', 'bridge-bollard'] }),
  Object.freeze({ id: 'hashwood', minX: 6_000, maxX: 8_000, propIds: ['hashwood-stump', 'crystal-cluster'] }),
  Object.freeze({ id: 'mining-camp', minX: 8_000, maxX: 10_000, propIds: ['ore-cart', 'loader-barrel', 'crystal-cluster'] }),
  Object.freeze({ id: 'liquidation-yard', minX: 10_000, maxX: 12_000, propIds: ['liquidation-terminal', 'fuel-drum', 'warning-beacon'] }),
]);

const DISTRICT_LANDMARKS = Object.freeze([
  Object.freeze({ id: 'frontier-relay', x: 780, y: 2_400, propIds: ['relay-console', 'salvage-crate', 'fuel-drum'] }),
  Object.freeze({ id: 'rugpull-ravine', x: 3_050, y: 1_500, propIds: ['rugpull-barricade', 'salvage-crate', 'warning-beacon'] }),
  Object.freeze({ id: 'liquidity-crossing', x: 4_700, y: 2_400, propIds: ['proof-pylon', 'bridge-bollard'] }),
  Object.freeze({ id: 'hashwood', x: 7_000, y: 900, propIds: ['hashwood-stump', 'crystal-cluster'] }),
  Object.freeze({ id: 'mining-camp', x: 9_200, y: 1_600, propIds: ['ore-cart', 'loader-barrel', 'crystal-cluster'] }),
  Object.freeze({ id: 'liquidation-yard', x: 11_000, y: 800, propIds: ['liquidation-terminal', 'fuel-drum', 'warning-beacon'] }),
]);
const LANDMARK_OFFSETS = Object.freeze([
  Object.freeze({ x: -350, y: -350, scale: 1.6 }),
  Object.freeze({ x: 350, y: 350, scale: 1.4 }),
  Object.freeze({ x: -350, y: 350, scale: 1.8 }),
  Object.freeze({ x: 350, y: -350, scale: 1.5 }),
  Object.freeze({ x: -420, y: -260, scale: 1.9 }),
  Object.freeze({ x: 420, y: 260, scale: 1.4 }),
  Object.freeze({ x: -100, y: -100, scale: 1.3, mobileOnly: true }),
  Object.freeze({ x: 100, y: 100, scale: 1.3, mobileOnly: true }),
]);

function freezeDeep(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezeDeep(child);
  return Object.freeze(value);
}

function seededUnit(seed, key) {
  let hash = (Number(seed) >>> 0) ^ 0x811c9dc5;
  for (const character of String(key)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  hash ^= hash << 13;
  hash ^= hash >>> 17;
  hash ^= hash << 5;
  return (hash >>> 0) / 0x1_0000_0000;
}

export function authoredPropItemUrl(assetId) {
  if (![...AUTHORED_PROP_ASSETS.weapons, ...AUTHORED_PROP_ASSETS.pickups, ...AUTHORED_PROP_ASSETS.powerUps, ...AUTHORED_PROP_ASSETS.worldProps].includes(assetId)) {
    throw new TypeError(`unknown authored prop ${String(assetId)}`);
  }
  return `${AUTHORED_PROP_ITEM_ROOT}/${assetId}.png`;
}

export function buildAuthoredWorldPropPlacements({ worldId, seed, countPerDistrict = 8 } = {}) {
  if (worldId !== 'forked-frontier') throw new TypeError(`unsupported authored prop world ${String(worldId)}`);
  if (!Number.isInteger(countPerDistrict) || countPerDistrict < 0 || countPerDistrict > 24) throw new TypeError('countPerDistrict must be an integer from 0 to 24');
  const placements = [];
  for (const district of DISTRICTS) {
    for (let index = 0; index < countPerDistrict; index += 1) {
      const key = `${worldId}:${district.id}:${index}`;
      const assetId = district.propIds[index % district.propIds.length];
      // Dressing lives toward district shoulders, leaving the authored route
      // and arenas readable. It is projection-only and never becomes collision.
      const north = index % 2 === 0;
      const x = district.minX + 220 + seededUnit(seed, `${key}:x`) * Math.max(1, district.maxX - district.minX - 440);
      const y = north
        ? 420 + seededUnit(seed, `${key}:y`) * 1_050
        : 3_330 + seededUnit(seed, `${key}:y`) * 1_050;
      placements.push(freezeDeep({
        id: `dressing:${district.id}:${String(index).padStart(2, '0')}`,
        assetId,
        category: 'world-prop',
        districtId: district.id,
        x: Number(x.toFixed(3)),
        y: Number(y.toFixed(3)),
        runtimeAuthority: 'projection-only',
      }));
    }
  }
  return Object.freeze(placements);
}

export function buildAuthoredDistrictLandmarkPlacements({ worldId } = {}) {
  if (worldId !== 'forked-frontier') throw new TypeError(`unsupported authored landmark world ${String(worldId)}`);
  const placements = [];
  for (const district of DISTRICT_LANDMARKS) {
    for (let index = 0; index < LANDMARK_OFFSETS.length; index += 1) {
      const offset = LANDMARK_OFFSETS[index];
      placements.push(freezeDeep({
        id: `landmark:${district.id}:${String(index).padStart(2, '0')}`,
        assetId: district.propIds[index % district.propIds.length],
        category: 'district-landmark',
        districtId: district.id,
        x: district.x + offset.x,
        y: district.y + offset.y,
        scale: offset.scale,
        mobileOnly: offset.mobileOnly === true,
        anchorDistance: Number(Math.hypot(offset.x, offset.y).toFixed(3)),
        runtimeAuthority: 'projection-only',
      }));
    }
  }
  return Object.freeze(placements);
}

const POINT_OF_INTEREST_ASSET_BY_ID = Object.freeze({
  'relay-cache': 'bonus-life',
  'relay-armory': 'coin-blaster',
  'ravine-salvage': 'scatter-shotgun',
  'ravine-overlook-cache': 'time-dilation',
  'crossing-fuel-depot': 'nuke-liquidation',
  'crossing-bank-cache': 'hash-rail-core',
  'hashwood-shrine': 'berserk-candle',
  'mining-control-room': 'auto-miner',
  'yard-extraction-console': 'launcher-rig',
});

export function buildAuthoredPointOfInterestPlacements(pointsOfInterest) {
  if (!Array.isArray(pointsOfInterest) || pointsOfInterest.length !== 9) throw new TypeError('nine authored level-one points of interest are required');
  return freezeDeep(pointsOfInterest.map((pointOfInterest) => {
    const assetId = POINT_OF_INTEREST_ASSET_BY_ID[pointOfInterest.id];
    if (!assetId) throw new TypeError(`unsupported point of interest ${String(pointOfInterest.id)}`);
    if (![pointOfInterest.anchor?.x, pointOfInterest.anchor?.y].every(Number.isFinite)) throw new TypeError(`invalid point of interest anchor ${pointOfInterest.id}`);
    return {
      id: `poi:${pointOfInterest.id}`,
      pointOfInterestId: pointOfInterest.id,
      assetId,
      category: 'point-of-interest',
      districtId: pointOfInterest.districtId,
      hook: pointOfInterest.hook,
      x: pointOfInterest.anchor.x,
      y: pointOfInterest.anchor.y,
      runtimeAuthority: 'projection-only',
    };
  }));
}

export function createAuthoredPropAtlasIndex(metadata) {
  if (metadata?.schemaVersion !== 1 || metadata.pipelineId !== AUTHORED_PROP_PIPELINE_ID) throw new TypeError('invalid authored prop atlas metadata');
  if (metadata.classification !== 'production-art' || metadata.runtimeAuthority !== 'projection-only') throw new TypeError('authored prop atlas authority drifted');
  if (!Array.isArray(metadata.frames) || metadata.frames.length !== 29) throw new TypeError('authored prop atlas requires 29 certified assets');
  const frameById = new Map();
  for (const frame of metadata.frames) {
    if (frameById.has(frame.assetId)) throw new TypeError(`duplicate authored prop ${frame.assetId}`);
    if (![frame.frame?.x, frame.frame?.y, frame.frame?.w, frame.frame?.h].every(Number.isFinite) || frame.frame.w <= 0 || frame.frame.h <= 0) throw new TypeError(`invalid authored prop frame ${frame.assetId}`);
    if (![frame.anchor?.x, frame.anchor?.y].every(Number.isFinite)) throw new TypeError(`invalid authored prop anchor ${frame.assetId}`);
    if (!frame.sourcePixelSha256 || frame.sourcePixelSha256.length !== 64) throw new TypeError(`authored prop provenance missing for ${frame.assetId}`);
    frameById.set(frame.assetId, Object.freeze({ ...frame, frame: Object.freeze({ ...frame.frame }), anchor: Object.freeze({ ...frame.anchor }) }));
  }
  for (const assetId of [...AUTHORED_PROP_ASSETS.weapons, ...AUTHORED_PROP_ASSETS.pickups, ...AUTHORED_PROP_ASSETS.powerUps, ...AUTHORED_PROP_ASSETS.worldProps]) {
    if (!frameById.has(assetId)) throw new TypeError(`authored prop atlas is missing ${assetId}`);
  }
  return Object.freeze({ pipelineId: metadata.pipelineId, runtimeAuthority: metadata.runtimeAuthority, frameById, frameFor(assetId) { return frameById.get(assetId); } });
}

export function createAuthoredHeldWeaponDisplay({ index, atlasTexture, ContainerClass, SpriteClass, TextureClass, RectangleClass } = {}) {
  if (!index?.frameById || !atlasTexture?.source) throw new TypeError('authored weapon index and texture are required');
  const container = new ContainerClass();
  container.label = 'authored-held-weapon';
  container.visible = false;
  const textures = new Map();
  for (const assetId of AUTHORED_PROP_ASSETS.weapons) {
    const frame = index.frameFor(assetId);
    textures.set(assetId, new TextureClass({ source: atlasTexture.source, frame: new RectangleClass(frame.frame.x, frame.frame.y, frame.frame.w, frame.frame.h) }));
  }
  const sprite = new SpriteClass({ texture: textures.get(AUTHORED_PROP_ASSETS.weapons[0]) });
  sprite.label = 'authored-held-weapon-sprite';
  sprite.anchor.set(0.5, 0.5);
  container.addChild(sprite);
  container.applyWeapon = ({ weaponId, screen, aimScreen, cameraZoom = 1 } = {}) => {
    const frame = index.frameFor(weaponId);
    const texture = textures.get(weaponId);
    if (!frame || !texture || !screen || !aimScreen) {
      container.visible = false;
      return null;
    }
    container.visible = true;
    sprite.texture = texture;
    const angle = Math.atan2(aimScreen.y - screen.y, aimScreen.x - screen.x);
    container.position.set(screen.x + Math.cos(angle) * 20 * cameraZoom, screen.y + Math.sin(angle) * 20 * cameraZoom);
    container.rotation = angle;
    container.scale.set(frame.runtimeScale * 0.72 * cameraZoom);
    container.productionAssetId = weaponId;
    return frame;
  };
  return Object.freeze({ container, sprite });
}

export function createAuthoredPropDisplay({ index, atlasTexture, placements, ContainerClass, SpriteClass, TextureClass, RectangleClass } = {}) {
  if (!index?.frameById || !atlasTexture?.source) throw new TypeError('authored prop index and texture are required');
  for (const [value, name] of [[ContainerClass, 'ContainerClass'], [SpriteClass, 'SpriteClass'], [TextureClass, 'TextureClass'], [RectangleClass, 'RectangleClass']]) {
    if (typeof value !== 'function') throw new TypeError(`${name} is required`);
  }
  const container = new ContainerClass();
  container.label = 'authored-prop-atlas';
  container.sortableChildren = true;
  const textureById = new Map();
  const entries = placements.map((placement) => {
    const frame = index.frameFor(placement.assetId);
    if (!frame) throw new RangeError(`missing authored prop frame ${placement.assetId}`);
    let texture = textureById.get(frame.assetId);
    if (!texture) {
      texture = new TextureClass({ source: atlasTexture.source, frame: new RectangleClass(frame.frame.x, frame.frame.y, frame.frame.w, frame.frame.h) });
      textureById.set(frame.assetId, texture);
    }
    const sprite = new SpriteClass({ texture });
    sprite.label = `authored-prop-${placement.id}`;
    sprite.anchor.set(frame.anchor.x, frame.anchor.y);
    sprite.productionAssetId = frame.assetId;
    container.addChild(sprite);
    return { placement, frame, sprite };
  });

  const render = ({ camera, view, worldToScreen, queryGround, tick = 0, cullMargin = 160 } = {}) => {
    let visibleCount = 0;
    const visibleByCategory = {};
    let onscreenCount = 0;
    const onscreenByCategory = {};
    for (const entry of entries) {
      if (entry.placement.mobileOnly && view.width > 600) {
        entry.sprite.visible = false;
        continue;
      }
      const ground = queryGround(entry.placement.x, entry.placement.y);
      const pickupBob = entry.placement.category === 'pickup'
        ? 8 + Math.sin((tick + seededUnit(0, entry.placement.id) * 60) / 16) * 5
        : 0;
      const screen = worldToScreen({ x: entry.placement.x, y: entry.placement.y, z: ground.groundZ + pickupBob }, camera, view);
      const visible = screen.x >= -cullMargin && screen.x <= view.width + cullMargin && screen.y >= -cullMargin && screen.y <= view.height + cullMargin;
      entry.sprite.visible = visible;
      if (!visible) continue;
      visibleCount += 1;
      visibleByCategory[entry.placement.category] = (visibleByCategory[entry.placement.category] ?? 0) + 1;
      const onscreen = screen.x >= 0 && screen.x <= view.width && screen.y >= 0 && screen.y <= view.height;
      if (onscreen) {
        onscreenCount += 1;
        onscreenByCategory[entry.placement.category] = (onscreenByCategory[entry.placement.category] ?? 0) + 1;
      }
      entry.sprite.position.set(screen.x, screen.y);
      entry.sprite.scale.set(entry.frame.runtimeScale * (entry.placement.scale ?? 1) * camera.zoom);
      entry.sprite.zIndex = screen.y;
    }
    return Object.freeze({
      placementCount: entries.length,
      visibleCount,
      visibleByCategory: Object.freeze(visibleByCategory),
      onscreenCount,
      onscreenByCategory: Object.freeze(onscreenByCategory),
    });
  };
  return Object.freeze({ container, entries: Object.freeze(entries), render });
}
