import { freezeDeep } from './value-guards.mjs';
export const AUTHORED_PROP_PIPELINE_ID = 'hmh-reboot-authored-props-v1';
export const AUTHORED_PROP_ATLAS_IMAGE_URL = '/assets/generated/hmh-reboot-authored-props/hmh-authored-props-atlas.png';
export const AUTHORED_PROP_ATLAS_METADATA_URL = '/assets/generated/hmh-reboot-authored-props/hmh-authored-props-atlas.json';
export const AUTHORED_PROP_ITEM_ROOT = '/assets/generated/hmh-reboot-authored-props/items';

export const AUTHORED_PROP_ASSETS = Object.freeze({
  weapons: Object.freeze('coin-blaster scatter-shotgun auto-miner launcher-rig'.split(' ')),
  pickups: Object.freeze('bonus-life hash-rail-core time-dilation berserk-candle nuke-liquidation'.split(' ')),
  powerUps: Object.freeze('proof-of-work diamond-hands gas-optimization cold-storage block-reward validator-training compound-interest hardened-wallet hot-wallet layer-two precision-ledger hard-fork-rounds'.split(' ')),

});

// Cycle 038: trees, boulders, wrecked cars, fencing and a shack join the
// district dressing. Hashwood carries a denser per-district count so it reads
// as an actual forest rather than a district with two stumps.
// Density targets from ART-DIRECTION-GAMEWORLD.md: hashwood leads the map,
// every biome reads dressed, and prop mixes carry the biome's identity
// (forest organic, ravine rocky, crossing wet, camp industrial, yard
// wrecked). Order sets the mix ratio.
// Cycle 050 (A2): undergrowth joins every district's mix. Placement is a strict
// round robin over propIds, so an id past index countOverride-1 is never
// placed — every list below stays at or under its countOverride, and the
// undergrowth-props test fails if any of these stops being reached.
// Counts are deliberately unchanged here: this slice adds variety to the mix,
// and W1 is where density goes up.
const DISTRICTS = Object.freeze([
  Object.freeze({ id: 'frontier-relay', minX: 0, maxX: 1_800, propIds: ['relay-console', 'watchtower', 'salvage-crate', 'ruined-wall', 'fuel-drum', 'dead-pine', 'granite-boulder', 'hashwood-pine', 'scrub-bush', 'canopy-edge-tree'], countOverride: 11 }),
  Object.freeze({ id: 'rugpull-ravine', minX: 1_800, maxX: 3_800, propIds: ['rugpull-barricade', 'granite-boulder', 'dead-pine', 'warning-beacon', 'moss-boulder', 'salvage-crate', 'wrecked-sedan', 'rock-spire', 'thorn-bramble', 'hanging-vines', 'scrub-bush', 'rope-bridge-anchor'], countOverride: 20 }),
  // driftwood-log stays atlas-only until its polish pass (root ball does not
  // read from the 55-degree camera yet) — same hold-out policy as Cycle 038.
  // balanced-boulder (A3) joins it under the same policy. Three passes could
  // not stop it reading as a mushroom: a cap on a pedestal reads as a stalk
  // and head no matter how the proportions are traded, and it measures 1.13
  // h/w — comfortably past the ratio gate while still looking wrong, which is
  // exactly why these get inspected by eye as well as measured. Per the
  // driftwood-log lesson: re-concept it (a boulder wedged in a cleft, or one
  // split by a fracture, rather than perched on a plinth), do not iterate.
  // A4: the water district now reads as water. Generic rock (moss-boulder,
  // granite-boulder), the industrial chain-fence and a duplicated
  // reed-cluster gave way to the new water dressing; all four are still
  // placed in districts where they belong. Count unchanged at the
  // ceiling -- W1 owns density.
  Object.freeze({ id: 'liquidity-crossing', minX: 3_800, maxX: 6_000, propIds: ['reed-cluster', 'proof-pylon', 'wetland-hummock', 'bridge-bollard', 'water-grass', 'submerged-log', 'lily-pads', 'stepping-stones', 'bridge-pier', 'bridge-truss', 'plank-deck-broken', 'handrail-post', 'bridge-warning-sign', 'cliff-face', 'rock-shelf', 'dock-post'], countOverride: 20 }),
  Object.freeze({ id: 'hashwood', minX: 6_000, maxX: 8_000, propIds: ['hashwood-pine', 'hashwood-tree', 'moss-boulder', 'hashwood-stump', 'hashwood-pine', 'dead-pine', 'crystal-cluster', 'fern-cluster', 'grass-tuft', 'flowering-weeds', 'rock-shelf', 'birch-cluster', 'canopy-edge-tree', 'sapling-thicket', 'fallen-trunk'], countOverride: 18 }),
  Object.freeze({ id: 'mining-camp', minX: 8_000, maxX: 10_000, propIds: ['ore-cart', 'ore-conveyor', 'loader-barrel', 'miners-shack', 'crystal-cluster', 'cargo-container', 'ruined-wall', 'flowering-weeds', 'ore-vein-rock', 'scree-pile', 'burned-snag'], countOverride: 12 }),
  Object.freeze({ id: 'liquidation-yard', minX: 10_000, maxX: 12_000, propIds: ['cargo-container', 'liquidation-terminal', 'wrecked-sedan', 'fuel-drum', 'ruined-wall', 'warning-beacon', 'cargo-container', 'chain-fence', 'thorn-bramble', 'scrub-bush', 'scree-pile'], countOverride: 12 }),
]);

const DISTRICT_LANDMARKS = Object.freeze([
  Object.freeze({ id: 'frontier-relay', x: 780, y: 2_400, setpieceId:'relay-tower-setpiece', propIds: ['relay-console', 'salvage-crate', 'fuel-drum'] }),
  Object.freeze({ id: 'rugpull-ravine', x: 3_050, y: 1_500, setpieceId:'forked-spire-setpiece', propIds: ['rugpull-barricade', 'salvage-crate', 'warning-beacon'] }),
  Object.freeze({ id: 'liquidity-crossing', x: 4_700, y: 2_400, setpieceId:'proof-bridge-setpiece', propIds: ['proof-pylon', 'bridge-bollard'] }),
  Object.freeze({ id: 'hashwood', x: 7_000, y: 900, setpieceId:'hashwood-beacon-setpiece', propIds: ['hashwood-stump', 'crystal-cluster'] }),
  Object.freeze({ id: 'mining-camp', x: 9_200, y: 1_600, setpieceId:'mining-headframe-setpiece', propIds: ['ore-cart', 'loader-barrel', 'crystal-cluster'] }),
  Object.freeze({ id: 'liquidation-yard', x: 11_000, y: 800, setpieceId:'liquidation-tower-setpiece', propIds: ['liquidation-terminal', 'fuel-drum', 'warning-beacon'] }),
]);
const LANDMARK_OFFSETS = Object.freeze([
  Object.freeze({ x: -350, y: -350, scale: 1.6 }),
  Object.freeze({ x: 350, y: 350, scale: 1.4 }),
  Object.freeze({ x: -350, y: 350, scale: 1.8 }),
  Object.freeze({ x: 350, y: -350, scale: 1.5 }),
  Object.freeze({ x: -420, y: -260, scale: 1.9 }),
  Object.freeze({ x: 420, y: 260, scale: 1.4 }),

]);
const LANDMARK_SIGNAL_KITS = Object.freeze({
  'relay-console': Object.freeze({ id: 'relay-scan', color: 0x5cffe2, periodTicks: 96, radiusScale: 0.3 }),
  'proof-pylon': Object.freeze({ id: 'proof-pulse', color: 0x8feaff, periodTicks: 72, radiusScale: 0.26 }),
  'warning-beacon': Object.freeze({ id: 'warning-sweep', color: 0xffb34d, periodTicks: 54, radiusScale: 0.22 }),
  'crystal-cluster': Object.freeze({ id: 'crystal-shimmer', color: 0x7dff8c, periodTicks: 108, radiusScale: 0.34 }),
  'liquidation-terminal': Object.freeze({ id: 'margin-signal', color: 0xff5d8f, periodTicks: 84, radiusScale: 0.28 }),
});


export function buildAuthoredTownPlacements({ worldId, index } = {}) {
  if (worldId !== 'forked-frontier' || !index?.frameById) throw new TypeError('town index');
  const placements = [];
  for (const frame of index.frameById.values()) {
    for (const placement of frame.townPlacements ?? []) placements.push(Object.freeze({
      ...placement, id: `town:${placement.id}`, assetId: frame.assetId,
      runtimeAuthority: 'projection-only',
    }));
  }
  return Object.freeze(placements);
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

export const AUTHORED_PROP_ASSET_IDS = Object.freeze([
  ...AUTHORED_PROP_ASSETS.weapons,
  ...AUTHORED_PROP_ASSETS.pickups,
  ...AUTHORED_PROP_ASSETS.powerUps,

]);
export const AUTHORED_PROP_ASSET_COUNT = AUTHORED_PROP_ASSET_IDS.length;
const PROP_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const isPropId = (value) => typeof value === 'string' && PROP_ID.test(value);
const isTownId = (value) => typeof value === 'string' && /^[a-z0-9:-]+$/.test(value);

export function authoredPropItemUrl(assetId) {
  if (!isPropId(assetId)) throw new TypeError(`bad prop ${String(assetId)}`);
  return `${AUTHORED_PROP_ITEM_ROOT}/${assetId}.png`;
}

// W1 density. Waves A1-A4 grew the world-prop library from 26 to 49 while
// deliberately holding these counts flat, so the world kept placing the same
// 75 items. These are the counts that put the library on screen. The placement
// helper caps a district at 24; hashwood leads the map per the art direction.
export const AUTHORED_DRESSING_DENSITY = Object.freeze({
  'frontier-relay': 20,
  'rugpull-ravine': 20,
  'liquidity-crossing': 20,
  hashwood: 24,
  'mining-camp': 22,
  'liquidation-yard': 22,
});

// W3 enemy hangouts. Enemies spawned on open ground, so an encounter read as
// figures appearing on a lawn rather than as a place someone lives. Each
// encampment is pinned to an encounter arena that already exists, offset to
// the arena's edge so the fighting floor stays clear.
//
// Dressing only: these carry no collision, no spawn timing and no AI. The
// arena anchors and radii are the world contract's, not new geometry.
export const AUTHORED_CAMP_KIT = Object.freeze([
  Object.freeze({
    id: 'camp:relay-picket', districtId: 'frontier-relay', arenaId: 'relay-training-yard',
    x: 1_400, y: 3_000, radius: 360,
    propIds: Object.freeze(['watch-platform', 'sandbag-nest', 'campfire-ring', 'bedroll-cluster']),
  }),
  Object.freeze({
    id: 'camp:ravine-ambush', districtId: 'rugpull-ravine', arenaId: 'ravine-ambush-bowl',
    x: 2_700, y: 2_700, radius: 420,
    propIds: Object.freeze(['faction-banner', 'scrap-barricade', 'campfire-ring', 'sandbag-nest']),
  }),
  Object.freeze({
    id: 'camp:hashwood-hunters', districtId: 'hashwood', arenaId: 'hashwood-clearing-arena',
    x: 7_150, y: 2_500, radius: 460,
    propIds: Object.freeze(['campfire-ring', 'bedroll-cluster', 'watch-platform', 'faction-banner']),
  }),
  Object.freeze({
    id: 'camp:mining-crew', districtId: 'mining-camp', arenaId: 'mining-yard-arena',
    x: 8_850, y: 3_050, radius: 500,
    propIds: Object.freeze(['scrap-barricade', 'sandbag-nest', 'watch-platform', 'bedroll-cluster']),
  }),
  Object.freeze({
    id: 'camp:yard-holdouts', districtId: 'liquidation-yard', arenaId: 'liquidator-arena',
    x: 11_000, y: 2_400, radius: 620,
    propIds: Object.freeze(['faction-banner', 'scrap-barricade', 'sandbag-nest', 'campfire-ring']),
  }),
]);

// Encampment props ring the arena edge. Kept outside the fighting floor so a
// camp frames an encounter instead of cluttering it.
const CAMP_EDGE_INSET = 0.82;

export function buildAuthoredEncampmentPlacements({ worldId } = {}) {
  if (worldId !== 'forked-frontier') throw new TypeError(`unsupported authored camp world ${String(worldId)}`);
  const placements = [];
  for (const camp of AUTHORED_CAMP_KIT) {
    camp.propIds.forEach((assetId, index) => {
      // Fixed angular slots so the ring is even and fully deterministic.
      const angle = (index / camp.propIds.length) * Math.PI * 2 + Math.PI / camp.propIds.length;
      const distance = camp.radius * CAMP_EDGE_INSET;
      placements.push(freezeDeep({
        id: `${camp.id}:${String(index).padStart(2, '0')}`,
        assetId,
        campId: camp.id,
        arenaId: camp.arenaId,
        category: 'encampment',
        districtId: camp.districtId,
        x: Number((camp.x + Math.cos(angle) * distance).toFixed(3)),
        y: Number((camp.y + Math.sin(angle) * distance).toFixed(3)),
        runtimeAuthority: 'projection-only',
      }));
    });
  }
  return Object.freeze(placements);
}

// Satellites per anchor, cycled deterministically. Mixed group sizes are what
// keep clusters from reading as a repeated stamp.
const CLUSTER_SATELLITES = Object.freeze([2, 1, 3, 1, 2, 2, 1, 3]);
const SATELLITE_MIN_RADIUS = 60;
const SATELLITE_MAX_RADIUS = 300;

export function buildAuthoredWorldPropPlacements({ worldId, seed, countPerDistrict = 8 } = {}) {
  if (worldId !== 'forked-frontier') throw new TypeError(`unsupported authored prop world ${String(worldId)}`);
  if (!Number.isInteger(countPerDistrict) || countPerDistrict < 0 || countPerDistrict > 24) throw new TypeError('countPerDistrict must be an integer from 0 to 24');
  const placements = [];
  for (const district of DISTRICTS) {
    const districtCount = Math.min(24, AUTHORED_DRESSING_DENSITY[district.id] ?? district.countOverride ?? countPerDistrict);
    // Anchor plus satellites rather than scattered singles: the art
    // direction's composition rule. An anchor is placed in the shoulder band,
    // then its satellites are offset around it, so the eye reads a few groups
    // instead of evenly spread confetti.
    let index = 0;
    let clusterIndex = 0;
    while (index < districtCount) {
      const anchorIndex = index;
      const clusterId = `cluster:${district.id}:${String(clusterIndex).padStart(2, '0')}`;
      const anchorKey = `${worldId}:${district.id}:${anchorIndex}`;
      // Alternate shoulders by CLUSTER, not by item, so a group stays on one
      // side of the route instead of being split across the map.
      const north = clusterIndex % 2 === 0;
      const anchorX = district.minX + 260 + seededUnit(seed, `${anchorKey}:x`) * Math.max(1, district.maxX - district.minX - 520);
      const anchorY = north
        ? 460 + seededUnit(seed, `${anchorKey}:y`) * 900
        : 3_380 + seededUnit(seed, `${anchorKey}:y`) * 900;
      const satellites = Math.min(
        CLUSTER_SATELLITES[clusterIndex % CLUSTER_SATELLITES.length],
        districtCount - index - 1,
      );
      for (let member = 0; member <= satellites; member += 1) {
        const memberIndex = anchorIndex + member;
        const key = `${worldId}:${district.id}:${memberIndex}`;
        const assetId = district.propIds[memberIndex % district.propIds.length];
        let x = anchorX;
        let y = anchorY;
        if (member > 0) {
          const angle = seededUnit(seed, `${key}:angle`) * Math.PI * 2;
          const radius = SATELLITE_MIN_RADIUS
            + seededUnit(seed, `${key}:radius`) * (SATELLITE_MAX_RADIUS - SATELLITE_MIN_RADIUS);
          x = anchorX + Math.cos(angle) * radius;
          y = anchorY + Math.sin(angle) * radius;
        }
        // Dressing lives toward district shoulders, leaving the authored route
        // and arenas readable. Satellite offsets are clamped back into the
        // shoulder band so a denser pass cannot push dressing into the
        // corridor. It is projection-only and never becomes collision.
        x = Math.min(district.maxX - 120, Math.max(district.minX + 120, x));
        y = north
          ? Math.min(1_640, Math.max(300, y))
          : Math.min(4_500, Math.max(3_160, y));
        placements.push(freezeDeep({
          id: `dressing:${district.id}:${String(memberIndex).padStart(2, '0')}`,
          assetId,
          clusterId,
          clusterRole: member === 0 ? 'anchor' : 'satellite',
          category: 'world-prop',
          districtId: district.id,
          x: Number(x.toFixed(3)),
          y: Number(y.toFixed(3)),
          runtimeAuthority: 'projection-only',
        }));
      }
      index += satellites + 1;
      clusterIndex += 1;
    }
  }
  return Object.freeze(placements);
}

export function buildAuthoredDistrictLandmarkPlacements({ worldId } = {}) {
  if (worldId !== 'forked-frontier') throw new TypeError(`unsupported authored landmark world ${String(worldId)}`);
  const placements = [];
  for (const district of DISTRICT_LANDMARKS) {
    placements.push(freezeDeep({ id:`landmark:${district.id}:setpiece`, assetId:district.setpieceId, category:'district-landmark', districtId:district.id, x:district.x, y:district.y, scale:1, mobileOnly:false, anchorDistance:0, runtimeAuthority:'projection-only' }));
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

export function resolveAuthoredLandmarkSignal({ placement, tick, reduceMotion = false } = {}) {
  if (placement?.category !== 'district-landmark' || placement.runtimeAuthority !== 'projection-only') return null;
  if (!Number.isInteger(tick) || tick < 0) return null;
  const kit = LANDMARK_SIGNAL_KITS[placement.assetId];
  if (!kit) return null;
  const phaseOffset = seededUnit(0x484d4821, placement.id) * Math.PI * 2;
  const pulse = reduceMotion
    ? 0.5
    : (Math.sin((tick / kit.periodTicks) * Math.PI * 2 + phaseOffset) + 1) / 2;
  return freezeDeep({
    id: kit.id,
    color: kit.color,
    pulse: Number(pulse.toFixed(6)),
    alpha: Number((0.16 + pulse * 0.34).toFixed(6)),
    radiusScale: Number((kit.radiusScale * (0.88 + pulse * 0.12)).toFixed(6)),
    animated: !reduceMotion,
    runtimeAuthority: 'projection-only',
  });
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
  'yard-medbay-cache': 'bonus-life',
});

export function buildAuthoredPointOfInterestPlacements(pointsOfInterest) {
  if (!Array.isArray(pointsOfInterest) || pointsOfInterest.length !== 10) throw new TypeError('ten authored level-one points of interest are required');
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
  if (metadata?.schemaVersion !== 1 || metadata.pipelineId !== AUTHORED_PROP_PIPELINE_ID) throw new TypeError('invalid prop atlas');
  if (metadata.classification !== 'production-art' || metadata.runtimeAuthority !== 'projection-only') throw new TypeError('prop authority drift');
  // Derived from the declared roster rather than a literal: a hard-coded 29
  // meant every added prop broke this guard with a message naming the old
  // count, which reads as corruption rather than as "the roster grew".
  if (!Array.isArray(metadata.frames) || metadata.assetCount !== metadata.frames.length) throw new TypeError('bad prop count');
  const atlasWidth=metadata.atlasSize?.width, atlasHeight=metadata.atlasSize?.height;
  if (![atlasWidth,atlasHeight].every(Number.isInteger) || atlasWidth<=0 || atlasHeight<=0) throw new TypeError('bad atlas size');
  const frameById = new Map();
  for (const frame of metadata.frames) {
    if (!isPropId(frame.assetId)) throw new TypeError('bad prop id');
    if (frameById.has(frame.assetId)) throw new TypeError('duplicate prop');
    const {x,y,w,h}=frame.frame??{};
    if (![x,y,w,h].every(Number.isInteger) || x<0 || y<0 || w<=0 || h<=0 || x+w>atlasWidth || y+h>atlasHeight) throw new TypeError('bad frame');
    // A ground anchor outside the crop means the pivot math ran against the
    // wrong frame size; a sprite would draw detached from its authored ground
    // point. Fail closed (review finding, Cycle 039).
    const anchor=[frame.anchor?.x,frame.anchor?.y];
    if (!anchor.every(Number.isFinite) || anchor.some((value)=>value<0||value>1)) throw new TypeError('bad anchor');
    if (!/^[a-f0-9]{64}$/.test(frame.sourcePixelSha256)) throw new TypeError('bad hash');
    if (!Array.isArray(frame.townPlacements)) throw new TypeError('bad town placements');
    for (const placement of frame.townPlacements) {
      const blocked=placement?.collisionPolicy==='canonical-blocker' && isPropId(placement.collisionBlockerId);
      const visual=placement?.collisionPolicy==='visual-only' && placement.collisionBlockerId==null;
      if (!isTownId(placement?.id) || !isTownId(placement?.blockId) || placement.districtId!=='liquidation-yard' || ![placement.x,placement.y,placement.rotation??0,placement.scale].every(Number.isFinite) || placement.scale<=0 || !(blocked||visual)) throw new TypeError('bad town placement');
    }
    frameById.set(frame.assetId, Object.freeze({ ...frame, frame: Object.freeze({ ...frame.frame }), anchor: Object.freeze({ ...frame.anchor }), townPlacements: freezeDeep([...(frame.townPlacements ?? [])]) }));
  }
  for (const assetId of AUTHORED_PROP_ASSET_IDS) {
    if (!frameById.has(assetId)) throw new TypeError(`missing ${assetId}`);
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

export function createAuthoredPropDisplay({ index, atlasTexture, placements, ContainerClass, SpriteClass, TextureClass, RectangleClass, GraphicsClass } = {}) {
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

  const render = ({ camera, view, worldToScreen, queryGround, tick = 0, cullMargin = 160, hiddenPlacementIds = null, reduceMotion = false } = {}) => {
    effects.clear();
    let visibleCount = 0;
    const visibleByCategory = {};
    let onscreenCount = 0;
    const onscreenByCategory = {};
    let signalVisibleCount = 0;
    let animatedSignalVisibleCount = 0;
    let signalOnscreenCount = 0;
    let animatedSignalOnscreenCount = 0;
    for (const entry of entries) {
      if (hiddenPlacementIds?.has(entry.placement.id)) {
        entry.sprite.visible = false;
        continue;
      }
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
      const spriteScale = entry.frame.runtimeScale * (entry.placement.scale ?? 1) * camera.zoom;
      entry.sprite.scale.set(spriteScale);
      entry.sprite.alpha = 1;
      entry.sprite.zIndex = screen.y;
      const signal = resolveAuthoredLandmarkSignal({ placement: entry.placement, tick, reduceMotion });
      if (signal) {
        const signalX = screen.x;
        const signalY = screen.y - entry.frame.frame.h * spriteScale * 0.58;
        const radius = Math.max(7, entry.frame.frame.w * spriteScale * signal.radiusScale);
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
      visibleCount,
      visibleByCategory: Object.freeze(visibleByCategory),
      onscreenCount,
      onscreenByCategory: Object.freeze(onscreenByCategory),
      signalVisibleCount,
      animatedSignalVisibleCount,
      signalOnscreenCount,
      animatedSignalOnscreenCount,
    });
  };
  return Object.freeze({ container, effects, entries: Object.freeze(entries), render });
}
