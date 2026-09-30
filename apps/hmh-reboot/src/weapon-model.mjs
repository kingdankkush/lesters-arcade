// Held 3D weapon models (2.0 weapons lane). A bounded reader for the static
// weapon GLBs in apps/portal/assets/generated/hmh-weapon-models/ and the pure
// attachment math that seats one in a hero's hand.
//
// Presentation only. This module is reached solely through the lazy
// actor-3d-pixi chunk; it reads no simulation state, draws no RNG and cannot
// change damage, fire rate, ammo, drops, collision or results. The sprite
// heroes keep the held-weapon atlas; nothing here touches them.
//
// Frames. Every weapon GLB is authored in the *grip frame* the held-weapon
// atlas pipeline established: origin at the trigger-hand palm point on the
// grip, +X forward along the bore to the muzzle, +Y left, +Z up, metres at
// hero scale. Blender's Y-up export turns that into GLB axes +X forward,
// +Y up, +Z right, so grip = (x, -z, y) of a GLB vertex. The per-hero
// `axesInSocket`/`anchorInSocket` (from the shipped held-weapon calibration)
// carry the grip frame into the hero's `pistol_prop` joint space, and the
// joint palette the hero shader already binds does the rest.
const widths = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const sizes = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 };
const requireValue = (condition, reason) => { if (!condition) throw new Error(reason); };
const integer = (n, min = 0) => Number.isSafeInteger(n) && n >= min;
const finiteArray = values => Array.isArray(values) && values.every(Number.isFinite);
const HASH = /^[a-f0-9]{64}$/u;

export const WEAPON_MODEL_PIPELINE_ID = 'hmh-weapon-models/v1';
export const WEAPON_MODEL_BASE_URL = '/assets/generated/hmh-weapon-models/';
export const WEAPON_MODEL_BUDGETS = Object.freeze({ maxBytes: 150 * 1024, maxTriangles: 3000, maxTextureSize: 512 });
export const WEAPON_MODEL_GUN_IDS = Object.freeze(['coin-blaster', 'scatter-shotgun', 'auto-miner', 'hash-rail', 'lightning-ledger', 'bear-market-burner', 'forked-standard', 'launcher-rig']);
export const WEAPON_MODEL_IDS = Object.freeze([...WEAPON_MODEL_GUN_IDS, 'litecoin-knife', 'satoshi-frag']);
export const WEAPON_MODEL_HERO_IDS = Object.freeze(['lit-commando', 'lilly', 'lit-valkyrie', 'lester-original']);
const SLOT_BY_ID = Object.freeze({ 'litecoin-knife': 'knife', 'satoshi-frag': 'grenade' });

export function weaponModelUrl(file) {
  requireValue(typeof file === 'string' && /^[a-z][a-z0-9-]*\.(glb|json)$/u.test(file), 'bounded weapon model file name');
  return `${WEAPON_MODEL_BASE_URL}${file}`;
}

function orthonormal(axes) {
  const f = axes?.forward, l = axes?.left, u = axes?.up;
  requireValue([f, l, u].every(v => finiteArray(v) && v.length === 3), 'grip axes required');
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  for (const v of [f, l, u]) requireValue(Math.abs(dot(v, v) - 1) < 1e-3, 'unit grip axis');
  requireValue(Math.abs(dot(f, l)) < 1e-3 && Math.abs(dot(f, u)) < 1e-3 && Math.abs(dot(l, u)) < 1e-3, 'orthogonal grip axes');
  // Right-handed: forward x left = up.
  const cross = [f[1] * l[2] - f[2] * l[1], f[2] * l[0] - f[0] * l[2], f[0] * l[1] - f[1] * l[0]];
  requireValue(dot(cross, u) > 0.999, 'right-handed grip frame');
}

export function validateWeaponModelManifest(manifest) {
  requireValue(manifest?.schemaVersion === 1 && manifest.pipelineId === WEAPON_MODEL_PIPELINE_ID, 'weapon model pipeline identity');
  requireValue(manifest.runtimeAuthority === 'projection-only' && manifest.settlementLive === false, 'weapon models are projection-only');
  requireValue(manifest.budgets?.maxBytes === WEAPON_MODEL_BUDGETS.maxBytes && manifest.budgets.maxTriangles === WEAPON_MODEL_BUDGETS.maxTriangles
    && manifest.budgets.maxTextureSize === WEAPON_MODEL_BUDGETS.maxTextureSize, 'weapon model budgets drift');
  const weapons = new Map();
  for (const id of WEAPON_MODEL_IDS) {
    const w = manifest.weapons?.[id];
    requireValue(w && w.file === `${id}.glb` && integer(w.bytes, 1) && w.bytes <= WEAPON_MODEL_BUDGETS.maxBytes && HASH.test(w.sha256), `weapon model entry ${id}`);
    requireValue(integer(w.triangles, 1) && w.triangles <= WEAPON_MODEL_BUDGETS.maxTriangles && integer(w.vertices, 3), `weapon model triangle budget ${id}`);
    requireValue(integer(w.texture?.width, 1) && integer(w.texture?.height, 1) && Math.max(w.texture.width, w.texture.height) <= WEAPON_MODEL_BUDGETS.maxTextureSize
      && ['image/jpeg', 'image/png'].includes(w.texture.mimeType), `weapon model texture budget ${id}`);
    requireValue(w.slot === (SLOT_BY_ID[id] ?? 'gun') && w.forward === '+X' && finiteArray(w.grip) && w.grip.every(v => v === 0)
      && finiteArray(w.muzzle) && w.muzzle.length === 3 && w.muzzle[0] > 0 && Number.isFinite(w.lengthMetres) && w.lengthMetres > 0 && w.lengthMetres <= 1.6, `weapon model frame ${id}`);
    requireValue(typeof w.standIn === 'boolean' && typeof w.castingNote === 'string' && HASH.test(w.source?.sha256) && typeof w.source.file === 'string', `weapon model provenance ${id}`);
    requireValue(Number.isFinite(w.reload?.ticks) && w.reload.ticks >= 0 && Number.isFinite(w.reload.dipRadians) && Number.isFinite(w.equip?.ticks) && typeof w.equip.twoHanded === 'boolean', `weapon model clip metadata ${id}`);
    weapons.set(id, Object.freeze({ ...w, grip: Object.freeze([...w.grip]), muzzle: Object.freeze([...w.muzzle]) }));
  }
  const heroes = new Map();
  for (const id of WEAPON_MODEL_HERO_IDS) {
    const h = manifest.heroes?.[id];
    requireValue(h && h.file === `${id}.glb` && HASH.test(h.sha256) && h.socketJoint === 'pistol_prop' && integer(h.socketJointIndex) && integer(h.socketNodeIndex), `hero socket ${id}`);
    orthonormal(h.axesInSocket);
    requireValue(finiteArray(h.anchorInSocket) && h.anchorInSocket.length === 3 && h.anchorInSocket.every(v => Math.abs(v) < 0.1), `hero grip anchor ${id}`);
    requireValue(finiteArray(h.nativePistolMuzzle) && h.nativePistolMuzzle.length === 3 && h.nativePistolMuzzle[0] > 0, `hero native muzzle ${id}`);
    heroes.set(id, Object.freeze({ ...h }));
  }
  return Object.freeze({ pipelineId: manifest.pipelineId, weaponFor: id => weapons.get(id), heroFor: id => heroes.get(id), weaponIds: WEAPON_MODEL_IDS, heroIds: WEAPON_MODEL_HERO_IDS });
}

export function decodeWeaponGlb(bytes) {
  requireValue(bytes instanceof ArrayBuffer && bytes.byteLength >= 28 && bytes.byteLength <= WEAPON_MODEL_BUDGETS.maxBytes, 'bounded weapon GLB length required');
  const view = new DataView(bytes);
  requireValue(view.getUint32(0, true) === 0x46546c67 && view.getUint32(4, true) === 2 && view.getUint32(8, true) === bytes.byteLength, 'GLB v2 required');
  let json, bin;
  for (let offset = 12; offset < bytes.byteLength;) {
    requireValue(offset + 8 <= bytes.byteLength, 'GLB chunk header');
    const length = view.getUint32(offset, true), type = view.getUint32(offset + 4, true);
    requireValue(length % 4 === 0 && offset + 8 + length <= bytes.byteLength, 'GLB chunk length');
    if (type === 0x4e4f534a) { requireValue(!json, 'duplicate JSON'); json = JSON.parse(new TextDecoder().decode(new Uint8Array(bytes, offset + 8, length))); }
    else if (type === 0x004e4942) { requireValue(!bin, 'duplicate BIN'); bin = new DataView(bytes, offset + 8, length); }
    else throw new Error('unsupported GLB chunk');
    offset += 8 + length;
  }
  requireValue(json?.asset?.version === '2.0' && bin && !json.extensionsRequired?.length && !json.skins?.length && !json.animations?.length, 'static embedded weapon GLB required');
  requireValue(json.buffers?.length === 1 && integer(json.buffers[0].byteLength, 1) && json.buffers[0].byteLength <= bin.byteLength && !json.buffers[0].uri, 'declared buffer length');
  for (const b of json.bufferViews ?? []) requireValue(b.buffer === 0 && integer(b.byteOffset ?? 0) && integer(b.byteLength, 1) && (b.byteOffset ?? 0) + b.byteLength <= json.buffers[0].byteLength && b.byteStride === undefined, 'weapon buffer view');
  const accessor = index => {
    const a = json.accessors?.[index], buffer = json.bufferViews?.[a?.bufferView], width = widths[a?.type], size = sizes[a?.componentType];
    requireValue(a && buffer && !a.sparse && width && size && integer(a.count, 1) && integer(a.byteOffset ?? 0) && !a.normalized, 'weapon accessor');
    const start = (buffer.byteOffset ?? 0) + (a.byteOffset ?? 0), end = start + a.count * width * size;
    requireValue(start % size === 0 && end <= (buffer.byteOffset ?? 0) + buffer.byteLength, 'weapon accessor range');
    const data = new Float32Array(a.count * width);
    for (let i = 0; i < data.length; i++) {
      const at = start + i * size;
      const value = a.componentType === 5126 ? bin.getFloat32(at, true) : a.componentType === 5125 ? bin.getUint32(at, true) : a.componentType === 5123 ? bin.getUint16(at, true) : bin.getUint8(at);
      requireValue(Number.isFinite(value), 'finite weapon sample'); data[i] = value;
    }
    return { ...a, width, data };
  };
  const meshNodes = (json.nodes ?? []).filter(node => node.mesh !== undefined);
  requireValue((json.nodes ?? []).length <= 4 && meshNodes.length === 1 && json.meshes?.length === 1 && json.meshes[0].primitives?.length === 1, 'one weapon mesh node required');
  const node = meshNodes[0];
  requireValue(!node.matrix && !node.translation && !node.rotation && !node.scale, 'weapon node must carry an identity transform');
  const p = json.meshes[0].primitives[0];
  requireValue((p.mode ?? 4) === 4 && !p.targets?.length, 'triangle weapon primitive');
  const position = accessor(p.attributes.POSITION), normal = accessor(p.attributes.NORMAL), uv = accessor(p.attributes.TEXCOORD_0), index = accessor(p.indices);
  requireValue(position.width === 3 && normal.width === 3 && uv.width === 2 && normal.count === position.count && uv.count === position.count
    && [position, normal, uv].every(a => a.componentType === 5126), 'weapon vertex shapes');
  requireValue(index.type === 'SCALAR' && [5121, 5123, 5125].includes(index.componentType) && index.count % 3 === 0 && index.count / 3 <= WEAPON_MODEL_BUDGETS.maxTriangles
    && index.data.every(i => integer(i) && i < position.count), 'weapon triangle indices');
  requireValue(json.images?.length === 1 && json.textures?.length === 1 && json.materials?.length === 1 && integer(json.textures[0].source) && json.textures[0].source === 0, 'one weapon texture required');
  const image = json.images[0], imageView = json.bufferViews[image.bufferView];
  requireValue(imageView && !image.uri && ['image/jpeg', 'image/png'].includes(image.mimeType), 'embedded weapon texture required');
  const start = imageView.byteOffset ?? 0;
  let width, height;
  if (image.mimeType === 'image/png') {
    requireValue(imageView.byteLength >= 24 && bin.getUint32(start, false) === 0x89504e47 && bin.getUint32(start + 12, false) === 0x49484452, 'weapon PNG header');
    width = bin.getUint32(start + 16, false); height = bin.getUint32(start + 20, false);
  } else {
    requireValue(imageView.byteLength >= 4 && bin.getUint16(start, false) === 0xffd8, 'weapon JPEG header');
    for (let at = start + 2; at + 9 <= start + imageView.byteLength;) {
      requireValue(bin.getUint8(at) === 0xff, 'weapon JPEG marker');
      const marker = bin.getUint8(at + 1);
      if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) { height = bin.getUint16(at + 5, false); width = bin.getUint16(at + 7, false); break; }
      at += 2 + bin.getUint16(at + 2, false);
    }
  }
  requireValue(integer(width, 1) && integer(height, 1) && width <= WEAPON_MODEL_BUDGETS.maxTextureSize && height <= WEAPON_MODEL_BUDGETS.maxTextureSize, 'bounded weapon texture dimensions');
  const material = json.materials[0], pbr = material.pbrMetallicRoughness ?? {};
  requireValue(pbr.baseColorTexture?.index === 0 && (pbr.baseColorTexture.texCoord ?? 0) === 0 && !material.normalTexture && !pbr.metallicRoughnessTexture, 'weapon material binding');
  const factor = pbr.baseColorFactor ?? [1, 1, 1, 1];
  requireValue(factor.length === 4 && factor.every(v => Number.isFinite(v) && v >= 0 && v <= 1), 'weapon base factor');
  const roughness = pbr.roughnessFactor ?? 1, metallic = pbr.metallicFactor ?? 1;
  requireValue([roughness, metallic].every(v => Number.isFinite(v) && v >= 0 && v <= 1), 'weapon material factors');
  const extras = node.extras ?? {};
  requireValue(finiteArray(extras.hmh_muzzle) && extras.hmh_muzzle.length === 3 && finiteArray(extras.hmh_grip) && extras.hmh_grip.length === 3, 'weapon grip/muzzle extras required');
  // Extras are recorded in the Blender grip frame (+X forward, +Y left, +Z up).
  return Object.freeze({
    positions: position.data, normals: normal.data, uvs: uv.data,
    indices: position.count > 65535 ? new Uint32Array(index.data) : new Uint16Array(index.data),
    vertexCount: position.count, triangleCount: index.count / 3,
    image: Object.freeze({ mimeType: image.mimeType, width, height, data: new Uint8Array(bytes, bin.byteOffset + start, imageView.byteLength) }),
    material: Object.freeze({ baseColorFactor: Object.freeze([...factor]), roughness, metallic }),
    muzzle: Object.freeze([...extras.hmh_muzzle]), grip: Object.freeze([...extras.hmh_grip]), weaponId: typeof extras.hmh_weapon_id === 'string' ? extras.hmh_weapon_id : null,
  });
}

// Column-major 4x4 helpers, matching actor-3d-model's palette layout.
function multiply(a, b) {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return out;
}
function invert(m) {
  const inv = new Float64Array(16);
  inv[0] = m[5] * m[10] * m[15] - m[5] * m[11] * m[14] - m[9] * m[6] * m[15] + m[9] * m[7] * m[14] + m[13] * m[6] * m[11] - m[13] * m[7] * m[10];
  inv[4] = -m[4] * m[10] * m[15] + m[4] * m[11] * m[14] + m[8] * m[6] * m[15] - m[8] * m[7] * m[14] - m[12] * m[6] * m[11] + m[12] * m[7] * m[10];
  inv[8] = m[4] * m[9] * m[15] - m[4] * m[11] * m[13] - m[8] * m[5] * m[15] + m[8] * m[7] * m[13] + m[12] * m[5] * m[11] - m[12] * m[7] * m[9];
  inv[12] = -m[4] * m[9] * m[14] + m[4] * m[10] * m[13] + m[8] * m[5] * m[14] - m[8] * m[6] * m[13] - m[12] * m[5] * m[10] + m[12] * m[6] * m[9];
  inv[1] = -m[1] * m[10] * m[15] + m[1] * m[11] * m[14] + m[9] * m[2] * m[15] - m[9] * m[3] * m[14] - m[13] * m[2] * m[11] + m[13] * m[3] * m[10];
  inv[5] = m[0] * m[10] * m[15] - m[0] * m[11] * m[14] - m[8] * m[2] * m[15] + m[8] * m[3] * m[14] + m[12] * m[2] * m[11] - m[12] * m[3] * m[10];
  inv[9] = -m[0] * m[9] * m[15] + m[0] * m[11] * m[13] + m[8] * m[1] * m[15] - m[8] * m[3] * m[13] - m[12] * m[1] * m[11] + m[12] * m[3] * m[9];
  inv[13] = m[0] * m[9] * m[14] - m[0] * m[10] * m[13] - m[8] * m[1] * m[14] + m[8] * m[2] * m[13] + m[12] * m[1] * m[10] - m[12] * m[2] * m[9];
  inv[2] = m[1] * m[6] * m[15] - m[1] * m[7] * m[14] - m[5] * m[2] * m[15] + m[5] * m[3] * m[14] + m[13] * m[2] * m[7] - m[13] * m[3] * m[6];
  inv[6] = -m[0] * m[6] * m[15] + m[0] * m[7] * m[14] + m[4] * m[2] * m[15] - m[4] * m[3] * m[14] - m[12] * m[2] * m[7] + m[12] * m[3] * m[6];
  inv[10] = m[0] * m[5] * m[15] - m[0] * m[7] * m[13] - m[4] * m[1] * m[15] + m[4] * m[3] * m[13] + m[12] * m[1] * m[7] - m[12] * m[3] * m[5];
  inv[14] = -m[0] * m[5] * m[14] + m[0] * m[6] * m[13] + m[4] * m[1] * m[14] - m[4] * m[2] * m[13] - m[12] * m[1] * m[6] + m[12] * m[2] * m[5];
  inv[3] = -m[1] * m[6] * m[11] + m[1] * m[7] * m[10] + m[5] * m[2] * m[11] - m[5] * m[3] * m[10] - m[9] * m[2] * m[7] + m[9] * m[3] * m[6];
  inv[7] = m[0] * m[6] * m[11] - m[0] * m[7] * m[10] - m[4] * m[2] * m[11] + m[4] * m[3] * m[10] + m[8] * m[2] * m[7] - m[8] * m[3] * m[6];
  inv[11] = -m[0] * m[5] * m[11] + m[0] * m[7] * m[9] + m[4] * m[1] * m[11] - m[4] * m[3] * m[9] - m[8] * m[1] * m[7] + m[8] * m[3] * m[5];
  inv[15] = m[0] * m[5] * m[10] - m[0] * m[6] * m[9] - m[4] * m[1] * m[10] + m[4] * m[2] * m[9] + m[8] * m[1] * m[6] - m[8] * m[2] * m[5];
  const det = m[0] * inv[0] + m[1] * inv[4] + m[2] * inv[8] + m[3] * inv[12];
  requireValue(Number.isFinite(det) && Math.abs(det) > 1e-12, 'invertible bind matrix');
  const out = new Float32Array(16); for (let i = 0; i < 16; i++) out[i] = inv[i] / det; return out;
}
const transformPoint = (m, [x, y, z]) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
const transformDirection = (m, [x, y, z]) => [m[0] * x + m[4] * y + m[8] * z, m[1] * x + m[5] * y + m[9] * z, m[2] * x + m[6] * y + m[10] * z];

/** Column-major grip -> socket matrix from a hero's calibration record. */
export function gripFrameMatrix(hero) {
  orthonormal(hero?.axesInSocket);
  const { forward: f, left: l, up: u } = hero.axesInSocket, a = hero.anchorInSocket;
  requireValue(finiteArray(a) && a.length === 3, 'grip anchor');
  return new Float32Array([f[0], f[1], f[2], 0, l[0], l[1], l[2], 0, u[0], u[1], u[2], 0, a[0], a[1], a[2], 1]);
}

/** GLB (Y-up export) vertex -> Blender grip frame (+X forward, +Y left, +Z up). */
export const glbToGrip = ([x, y, z]) => [x, -z, y];

/**
 * Seat a weapon in a hero's hand: pre-transform its vertices into the hero
 * mesh's bind space and bind every vertex 1.0 to the `pistol_prop` joint, so
 * the existing skinned shader and palette move it exactly like the native
 * pistol. Pure: a fresh result per call, inputs untouched.
 */
export function createWeaponAttachment(heroModel, weaponModel, hero) {
  const skin = heroModel?.skins?.[0];
  requireValue(skin && integer(hero?.socketJointIndex) && hero.socketJointIndex < skin.joints.length && skin.joints[hero.socketJointIndex] === hero.socketNodeIndex
    && heroModel.nodes[hero.socketNodeIndex]?.name === hero.socketJoint, 'hero socket joint');
  const grip = gripFrameMatrix(hero);
  const bind = invert(skin.inverseBind.subarray(hero.socketJointIndex * 16, hero.socketJointIndex * 16 + 16));
  const toBind = multiply(bind, grip);
  const count = weaponModel.vertexCount, positions = new Float32Array(count * 3), normals = new Float32Array(count * 3);
  const joints = new Float32Array(count * 4), weights = new Float32Array(count * 4);
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < count; i++) {
    const p = transformPoint(toBind, glbToGrip([weaponModel.positions[i * 3], weaponModel.positions[i * 3 + 1], weaponModel.positions[i * 3 + 2]]));
    const n = transformDirection(toBind, glbToGrip([weaponModel.normals[i * 3], weaponModel.normals[i * 3 + 1], weaponModel.normals[i * 3 + 2]]));
    const length = Math.hypot(n[0], n[1], n[2]) || 1;
    for (let axis = 0; axis < 3; axis++) {
      positions[i * 3 + axis] = p[axis]; normals[i * 3 + axis] = n[axis] / length;
      min[axis] = Math.min(min[axis], p[axis]); max[axis] = Math.max(max[axis], p[axis]);
    }
    joints[i * 4] = hero.socketJointIndex; weights[i * 4] = 1;
  }
  requireValue(finiteArray(min) && finiteArray(max), 'finite weapon attachment');
  // A per-joint envelope shaped like actor-3d-model's joint bounds: only the
  // socket joint carries the weapon, every other joint stays empty.
  const envelope = skin.joints.map((_, j) => j === hero.socketJointIndex ? { min: [...min], max: [...max] } : { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] });
  return Object.freeze({
    positions, normals, uvs: new Float32Array(weaponModel.uvs), indices: weaponModel.indices.slice(), joints, weights,
    jointIndex: hero.socketJointIndex, nodeIndex: hero.socketNodeIndex,
    muzzleSocket: Object.freeze(transformPoint(grip, weaponModel.muzzle)), gripSocket: Object.freeze(transformPoint(grip, weaponModel.grip)),
    envelope: Object.freeze(envelope),
  });
}

/** Socket-space point through the socket joint's current world matrix -> hero model space (metres, Y-up). */
export function weaponSocketToModel(socketWorld, pointInSocket) {
  requireValue(socketWorld?.length === 16 && finiteArray([...socketWorld]) && finiteArray(pointInSocket) && pointInSocket.length === 3, 'finite socket transform');
  return Object.freeze(transformPoint(socketWorld, pointInSocket));
}

/**
 * Hero model-space point -> world-unit offset from the hero's foot position,
 * using the same yaw and basis the actor shader applies (x right, glTF z to
 * ground y, glTF y to world height), so the projected point lands where the
 * drawn muzzle is.
 */
export function weaponModelToWorldOffset([x, y, z], { heading = Math.PI / 2, pixelsPerMetre = 40 } = {}) {
  requireValue(finiteArray([x, y, z, heading, pixelsPerMetre]) && pixelsPerMetre > 0, 'finite muzzle projection');
  const yaw = Math.PI / 2 - heading, cos = Math.cos(yaw), sin = Math.sin(yaw);
  return Object.freeze({ x: (x * cos + z * sin) * pixelsPerMetre, y: (-x * sin + z * cos) * pixelsPerMetre, z: y * pixelsPerMetre });
}
