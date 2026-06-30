import { HMH_LEVEL_EDITOR_GENERATED_MANIFESTS } from './hmh-level-editor-generated-library.mjs';

export const HMH_LEVEL_EDITOR_ASSET_GROUPS = Object.freeze([
  Object.freeze({ id: 'ground-tiles', label: 'Ground Tiles', color: '#8fd16a' }),
  Object.freeze({ id: 'water-tiles', label: 'Water Tiles', color: '#4cc9f0' }),
  Object.freeze({ id: 'roads-paths', label: 'Roads / Paths', color: '#d0a15d' }),
  Object.freeze({ id: 'trees', label: 'Trees', color: '#2ea44f' }),
  Object.freeze({ id: 'plants-bushes', label: 'Plants / Bushes', color: '#78c850' }),
  Object.freeze({ id: 'buildings', label: 'Buildings', color: '#d78b4c' }),
  Object.freeze({ id: 'barriers-collision', label: 'Barriers / Collision', color: '#ff5c5c' }),
  Object.freeze({ id: 'player-spawns', label: 'Player Spawns', color: '#38bdf8' }),
  Object.freeze({ id: 'enemies', label: 'Enemies', color: '#ff8f3d' }),
  Object.freeze({ id: 'mini-bosses', label: 'Mini Bosses', color: '#ff3d81' }),
  Object.freeze({ id: 'bosses', label: 'Bosses', color: '#c77dff' }),
  Object.freeze({ id: 'characters', label: 'Characters / Heroes', color: '#60a5fa' }),
  Object.freeze({ id: 'vfx-fx', label: 'VFX / FX', color: '#facc15' }),
  Object.freeze({ id: 'objectives-extraction', label: 'Objectives / Extraction', color: '#ffd166' }),
]);

export const HMH_LEVEL_EDITOR_MARKER_TOOLS = Object.freeze([
  Object.freeze({ type: 'player-spawn', label: 'Primary Player Spawn', groupId: 'player-spawns', icon: '★', primary: true }),
  Object.freeze({ type: 'player-spawn-candidate', label: 'Alternate Player Spawn', groupId: 'player-spawns', icon: '☆', primary: false }),
  Object.freeze({ type: 'player-start', label: 'Legacy Player Start', groupId: 'player-spawns', icon: '★', primary: true }),
  Object.freeze({ type: 'enemy-spawn', label: 'Enemy Spawn', groupId: 'enemies', icon: '◇' }),
  Object.freeze({ type: 'mini-boss', label: 'Mini Boss', groupId: 'mini-bosses', icon: '◆' }),
  Object.freeze({ type: 'boss', label: 'Boss @ 6:00', groupId: 'bosses', icon: '☠', spawnAtSeconds: 360 }),
  Object.freeze({ type: 'extraction-helicopter', label: 'Helicopter Extraction @ 8:00', groupId: 'objectives-extraction', icon: '⌂', appearsAtSeconds: 480 }),
  Object.freeze({ type: 'barrier-rect', label: 'Draw Barrier Rect', groupId: 'barriers-collision', icon: '▭' }),
  Object.freeze({ type: 'boundary-line', label: 'Boundary Line', groupId: 'barriers-collision', icon: '╱' }),
  Object.freeze({ type: 'note', label: 'Design Note', groupId: 'objectives-extraction', icon: '✎' }),
]);

const ENEMY_ASSETS = Object.freeze([
  Object.freeze({ assetKey: 'enemy/claim-jumper', label: 'Claim Jumper', groupId: 'enemies', markerType: 'enemy-spawn', enemyId: 'claim-jumper' }),
  Object.freeze({ assetKey: 'enemy/rug-rat', label: 'Rug Rat', groupId: 'enemies', markerType: 'enemy-spawn', enemyId: 'rug-rat' }),
  Object.freeze({ assetKey: 'enemy/scam-cult-zealot', label: 'Scam Cult Zealot', groupId: 'enemies', markerType: 'enemy-spawn', enemyId: 'scam-cult-zealot' }),
  Object.freeze({ assetKey: 'enemy/fud-goblin-cave', label: 'FUD Goblin Cave', groupId: 'enemies', markerType: 'enemy-spawn', enemyId: 'fud-goblin-cave' }),
  Object.freeze({ assetKey: 'enemy/wild-boar', label: 'Wild Boar', groupId: 'enemies', markerType: 'enemy-spawn', enemyId: 'wild-boar' }),
]);

const MINI_BOSS_ASSETS = Object.freeze([
  Object.freeze({ assetKey: 'mini-boss/claim-jumper-sheriff', label: 'Claim-Jumper Sheriff', groupId: 'mini-bosses', markerType: 'mini-boss', enemyId: 'claim-jumper-sheriff' }),
  Object.freeze({ assetKey: 'mini-boss/coyote-pack-runner', label: 'Cave Warren Alpha', groupId: 'mini-bosses', markerType: 'mini-boss', enemyId: 'coyote-pack-runner' }),
  Object.freeze({ assetKey: 'mini-boss/rattlesnake', label: 'Sandbar Apex', groupId: 'mini-bosses', markerType: 'mini-boss', enemyId: 'rattlesnake' }),
]);

const OBJECTIVE_ASSETS = Object.freeze([
  Object.freeze({ assetKey: 'objective/player-spawn-primary', label: 'Primary Player Spawn', groupId: 'player-spawns', markerType: 'player-spawn', primary: true }),
  Object.freeze({ assetKey: 'objective/player-spawn-candidate', label: 'Alternate Player Spawn', groupId: 'player-spawns', markerType: 'player-spawn-candidate', primary: false }),
  Object.freeze({ assetKey: 'objective/player-start', label: 'Legacy Player Start', groupId: 'player-spawns', markerType: 'player-start', primary: true }),
  Object.freeze({ assetKey: 'objective/extraction-helicopter', label: 'Helicopter Extraction', groupId: 'objectives-extraction', markerType: 'extraction-helicopter' }),
  Object.freeze({ assetKey: 'objective/boss-trigger', label: 'Boss Trigger', groupId: 'bosses', markerType: 'boss', enemyId: 'rug-pull-baron' }),
  Object.freeze({ assetKey: 'collision/barrier-rect', label: 'Invisible Barrier', groupId: 'barriers-collision', markerType: 'barrier-rect' }),
]);

function assetList(manifest, source = '') {
  const out = [];
  if (Array.isArray(manifest?.assets)) out.push(...manifest.assets);
  if (Array.isArray(manifest?.actors)) {
    for (const actor of manifest.actors) {
      if (actor.src || actor.path) out.push(actor);
    }
  }
  if (manifest?.contactSheet) {
    out.push({
      key: `${source}/lester-calibration-contact-sheet`,
      label: manifest.label ?? 'PixelLab Lester calibration contact sheet',
      role: 'hero calibration contact sheet',
      src: manifest.contactSheet,
      width: 512,
      height: 512,
    });
  }
  if (manifest?.rotations && typeof manifest.rotations === 'object') {
    for (const [direction, src] of Object.entries(manifest.rotations)) {
      out.push({
        key: `${source}/lester-calibration-rotation-${direction}`,
        label: `Lester calibration ${direction}`,
        role: 'hero rotation',
        src,
        width: 96,
        height: 96,
      });
    }
  }
  if (manifest?.animations && typeof manifest.animations === 'object') {
    for (const [animationId, animation] of Object.entries(manifest.animations)) {
      const firstFrame = Array.isArray(animation.frames) ? animation.frames[0] : null;
      if (!firstFrame) continue;
      out.push({
        key: `${source}/lester-calibration-${animationId}-${animation.direction ?? 'east'}`,
        label: `Lester ${animation.sourceName ?? animationId}`,
        role: 'hero animation frame',
        src: firstFrame,
        animated: true,
        frames: animation.frameCount,
        width: 96,
        height: 96,
        frameWidth: 96,
        frameHeight: 96,
      });
    }
  }
  return out;
}

function classifyAsset(asset = {}, source = '') {
  const key = String(asset.key ?? asset.assetKey ?? asset.id ?? '');
  const label = asset.label ?? asset.name ?? key.split('/').pop() ?? key;
  const role = String(asset.role ?? asset.category ?? asset.type ?? '').toLowerCase();
  const haystack = `${key} ${label} ${role} ${source}`.toLowerCase();
  let groupId = 'plants-bushes';
  let layer = 'props';
  if (/vfx|muzzle|spark|explosion|impact|shell|blood|gore|fx|ambient|particle/.test(haystack)) { groupId = 'vfx-fx'; layer = 'props'; }
  else if (/hero|lester|lilly|commando|valkyrie|character|calibration|player/.test(haystack)) { groupId = 'characters'; layer = 'props'; }
  else if (/boss|baron|ngmi|miner|validator|exploiter|whale|obfuscator|51%|enemy|goblin|boar|rat|zealot|jumper|rattlesnake|coyote/.test(haystack)) { groupId = /boss|baron|ngmi|miner|validator|exploiter|whale|obfuscator|51%/.test(haystack) ? 'bosses' : 'enemies'; layer = 'enemies'; }
  else if (/water|river|lake|shore|oasis|pond|runoff|harbor|canal/.test(haystack)) { groupId = 'water-tiles'; layer = 'water'; }
  else if (/ground|sand|grass|pavement|road|path|asphalt|dirt|street|tile|rooftop|roof|rail|bridge|glass|train|grate/.test(haystack)) { groupId = /road|path|street|asphalt|dirt|rail|bridge/.test(haystack) ? 'roads-paths' : 'ground-tiles'; layer = groupId === 'ground-tiles' ? 'ground' : 'roads-paths'; }
  else if (/tree|pine|oak|forest|trunk/.test(haystack)) groupId = 'trees';
  else if (/bush|plant|reed|flower|cactus|crop|corn|wheat|flora/.test(haystack)) groupId = 'plants-bushes';
  else if (/building|town|saloon|front|store|house|barn|silo|warehouse|bank|facade|city|fountain|billboard|container|crane|penthouse|launch|express|monument|streetlight/.test(haystack)) groupId = 'buildings';
  else if (/wall|fence|barrier|cliff|boulder|rock|gate|edge|gap/.test(haystack)) groupId = 'barriers-collision';
  return Object.freeze({
    assetKey: key,
    label,
    groupId,
    layer,
    src: asset.src ?? asset.path ?? null,
    source,
    role: asset.role ?? null,
    width: asset.width ?? asset.frameWidth ?? null,
    height: asset.height ?? asset.frameHeight ?? null,
    frames: asset.frames ?? asset.frameCount ?? null,
    frameWidth: asset.frameWidth ?? asset.width ?? null,
    frameHeight: asset.frameHeight ?? asset.height ?? null,
    sheetWidth: asset.sheetWidth ?? null,
    frameMs: asset.frameMs ?? null,
    animated: Boolean(asset.animated || asset.frames || asset.frameCount || asset.animation),
  });
}

function pushManifest(out, manifest, source) {
  for (const asset of assetList(manifest, source)) {
    const normalized = classifyAsset(asset, source);
    if (normalized.assetKey) out.push(normalized);
  }
}

export function buildHmhEditorAssetPalette() {
  const assets = [];
  for (const entry of HMH_LEVEL_EDITOR_GENERATED_MANIFESTS) {
    pushManifest(assets, entry.manifest, entry.source);
  }
  for (const item of ENEMY_ASSETS) assets.push(item);
  for (const item of MINI_BOSS_ASSETS) assets.push(item);
  for (const item of OBJECTIVE_ASSETS) assets.push(item);

  const seen = new Set();
  const deduped = assets.filter((asset) => {
    const key = `${asset.groupId}:${asset.assetKey}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return Object.freeze({
    groups: HMH_LEVEL_EDITOR_ASSET_GROUPS,
    markerTools: HMH_LEVEL_EDITOR_MARKER_TOOLS,
    assets: Object.freeze(deduped),
  });
}
