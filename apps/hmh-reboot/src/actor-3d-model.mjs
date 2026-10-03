// Bounded embedded-GLB reader for the two reviewed character pilots. It is
// presentation-only and intentionally does not support a general glTF scene.
const widths = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const sizes = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 };
const integer = (n, min = 0) => Number.isSafeInteger(n) && n >= min;
const requireValue = (condition, reason) => { if (!condition) throw new Error(reason); };
const finiteArray = values => values.every(Number.isFinite);
const identity = () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

export function decodeActor3dGlb(bytes) {
  requireValue(bytes instanceof ArrayBuffer && bytes.byteLength >= 28 && bytes.byteLength <= 16_777_216, 'bounded GLB length required');
  const view = new DataView(bytes);
  requireValue(view.getUint32(0, true) === 0x46546c67 && view.getUint32(4, true) === 2, 'GLB v2 required');
  requireValue(view.getUint32(8, true) === bytes.byteLength, 'GLB length mismatch');
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
  requireValue(json?.asset?.version === '2.0' && bin && (json.extensionsRequired ?? []).every(name=>name==='EXT_texture_webp'), 'embedded uncompressed pilot required');
  requireValue(json.buffers?.length === 1 && integer(json.buffers[0].byteLength, 1) && json.buffers[0].byteLength <= bin.byteLength, 'declared buffer length');
  requireValue([...json.buffers, ...json.images ?? []].every(item => !item.uri), 'external dependencies forbidden');
  for (const buffer of json.bufferViews ?? []) {
    requireValue(buffer.buffer === 0 && integer(buffer.byteOffset ?? 0) && integer(buffer.byteLength, 1)
      && (buffer.byteStride === undefined || integer(buffer.byteStride, 1))
      && (buffer.byteOffset ?? 0) + buffer.byteLength <= json.buffers[0].byteLength, 'invalid buffer view');
  }
  const cache = new Map();
  const accessor = index => {
    if (cache.has(index)) return cache.get(index);
    const a = json.accessors?.[index], buffer = json.bufferViews?.[a?.bufferView];
    const width = widths[a?.type], size = sizes[a?.componentType];
    requireValue(a && buffer && !a.sparse && width && size && integer(a.count, 1) && integer(a.byteOffset ?? 0), 'unsupported accessor');
    const stride = buffer.byteStride ?? width * size, start = (buffer.byteOffset ?? 0) + (a.byteOffset ?? 0);
    const end = start + (a.count - 1) * stride + width * size;
    requireValue(integer(end) && start % size === 0 && stride >= width * size && end <= (buffer.byteOffset ?? 0) + buffer.byteLength, 'accessor range');
    const data = new Float32Array(a.count * width);
    for (let row = 0; row < a.count; row++) for (let c = 0; c < width; c++) {
      const at = start + row * stride + c * size;
      let value = a.componentType === 5126 ? bin.getFloat32(at, true) : a.componentType === 5125 ? bin.getUint32(at, true)
        : a.componentType === 5123 ? bin.getUint16(at, true) : bin.getUint8(at);
      if (a.normalized && a.componentType !== 5126) value /= a.componentType === 5121 ? 255 : 65535;
      requireValue(Number.isFinite(value), 'nonfinite accessor sample'); data[row * width + c] = value;
    }
    const result = { ...a, width, data }; cache.set(index, result); return result;
  };
  const nodes = (json.nodes ?? []).map(node => ({ name: node.name ?? '', children: node.children ?? [],
    translation: node.translation ?? [0, 0, 0], rotation: node.rotation ?? [0, 0, 0, 1], scale: node.scale ?? [1, 1, 1], matrix: node.matrix }));
  requireValue(nodes.length > 0 && nodes.length <= 256, 'bounded node count');
  const parents = new Int16Array(nodes.length).fill(-1), order = [], visiting = new Uint8Array(nodes.length);
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    requireValue(n.translation.length === 3 && n.rotation.length === 4 && n.scale.length === 3
      && finiteArray([...n.translation, ...n.rotation, ...n.scale]) && (!n.matrix || n.matrix.length === 16 && finiteArray(n.matrix)), 'finite node transform required');
    for (const child of n.children) { requireValue(integer(child) && child < nodes.length && parents[child] === -1, 'node parent boundary'); parents[child] = i; }
  }
  const visit = i => {
    requireValue(visiting[i] !== 1, 'node cycle'); if (visiting[i] === 2) return;
    visiting[i] = 1; if (parents[i] >= 0) visit(parents[i]); visiting[i] = 2; order.push(i);
  };
  for (let i = 0; i < nodes.length; i++) visit(i);
  const skins = (json.skins ?? []).map(skin => {
    requireValue(skin.joints?.length > 0 && skin.joints.length <= 32 && skin.joints.every(j => integer(j) && j < nodes.length), 'bounded skin joints');
    const bind = accessor(skin.inverseBindMatrices);
    requireValue(bind.type === 'MAT4' && bind.componentType === 5126 && bind.count === skin.joints.length, 'inverse bind matrices required');
    return { joints: skin.joints, inverseBind: bind.data };
  });
  requireValue(skins.length === 1, 'pilot requires one skin');
  const primitives = [];
  let vertexCount = 0, triangleCount = 0;
  for (let nodeIndex = 0; nodeIndex < (json.nodes ?? []).length; nodeIndex++) {
    const node = json.nodes[nodeIndex]; if (node.mesh === undefined) continue;
    requireValue(skins[node.skin], 'skinned pilot mesh required');
    for (const p of json.meshes[node.mesh]?.primitives ?? []) {
      requireValue((p.mode ?? 4) === 4 && !p.targets?.length, 'bounded triangle skin required');
      const position = accessor(p.attributes.POSITION), normal = accessor(p.attributes.NORMAL), uv = accessor(p.attributes.TEXCOORD_0);
      const joint = accessor(p.attributes.JOINTS_0), weight = accessor(p.attributes.WEIGHTS_0), index = accessor(p.indices);
      requireValue(position.width === 3 && normal.width === 3 && uv.width === 2 && joint.width === 4 && weight.width === 4
        && [normal, uv, joint, weight].every(a => a.count === position.count)
        && [position, normal, uv, weight].every(a => a.componentType === 5126 && !a.normalized), 'pilot vertex shapes');
      requireValue(index.type === 'SCALAR' && [5121, 5123, 5125].includes(index.componentType) && !index.normalized
        && index.count % 3 === 0 && index.data.every(i => integer(i) && i < position.count), 'pilot triangle indices');
      requireValue([5121, 5123].includes(joint.componentType) && !joint.normalized && joint.data.every(j => integer(j) && j < skins[node.skin].joints.length), 'joint indices');
      for (let i = 0; i < weight.count; i++) {
        const sum = weight.data[i * 4] + weight.data[i * 4 + 1] + weight.data[i * 4 + 2] + weight.data[i * 4 + 3];
        requireValue(Math.abs(sum - 1) < .002 && weight.data.subarray(i * 4, i * 4 + 4).every(w => w >= 0 && w <= 1), 'normalized skin weights');
      }
      const tangent = p.attributes.TANGENT === undefined ? null : accessor(p.attributes.TANGENT);
      requireValue(!tangent || tangent.width === 4 && tangent.count === position.count && tangent.componentType === 5126 && !tangent.normalized, 'pilot tangent shape');
      requireValue(integer(p.material) && json.materials?.[p.material], 'pilot material required');
      vertexCount += position.count; triangleCount += index.count / 3;
      primitives.push({ skin: node.skin, material: p.material, nodeName: node.name ?? '', positions: position.data, normals: normal.data, uvs: uv.data,
        joints: joint.data, weights: weight.data, indices: position.count > 65535 ? new Uint32Array(index.data) : new Uint16Array(index.data),
        tangents: tangent?.data ?? null });
    }
  }
  requireValue(primitives.length > 0 && primitives.length <= 6 && vertexCount <= 30000 && triangleCount <= 30000, 'bounded pilot geometry');
  const clips = new Map();
  for (const animation of json.animations ?? []) {
    requireValue(animation.name && !clips.has(animation.name), 'unique clip name'); let duration = 0;
    const tracks = animation.channels.map(channel => {
      const sampler = animation.samplers[channel.sampler], input = accessor(sampler.input), output = accessor(sampler.output);
      const path = channel.target.path, width = path === 'rotation' ? 4 : 3;
      requireValue(['rotation', 'translation', 'scale'].includes(path) && integer(channel.target.node) && nodes[channel.target.node], 'clip target');
      requireValue(['LINEAR', 'STEP'].includes(sampler.interpolation ?? 'LINEAR') && input.type === 'SCALAR' && input.componentType === 5126
        && input.count >= 2 && output.componentType === 5126 && output.width === width && output.count === input.count, 'bounded clip shape');
      requireValue(input.data.every((time, i) => time >= 0 && (!i || time > input.data[i - 1])), 'clip time');
      duration = Math.max(duration, input.data.at(-1));
      return { node: channel.target.node, path, width, time: input.data, value: output.data, interpolation: sampler.interpolation ?? 'LINEAR' };
    });
    requireValue(duration > 0, 'clip duration'); clips.set(animation.name, { duration, tracks });
  }
  requireValue(clips.size > 0 && clips.size <= 128, 'bounded clip count');
  let pixels = 0;
  requireValue(json.images?.length > 0 && json.images.length <= 12, 'bounded pilot texture count');
  const images = json.images.map(image => {
    const buffer = json.bufferViews[image.bufferView]; requireValue(buffer && ['image/png','image/webp'].includes(image.mimeType), 'embedded pilot image required');
    const start = buffer.byteOffset ?? 0;
    let width, height;
    if (image.mimeType === 'image/png') {
      requireValue(buffer.byteLength >= 24 && bin.getUint32(start, false) === 0x89504e47 && bin.getUint32(start + 4, false) === 0x0d0a1a0a
        && bin.getUint32(start + 12, false) === 0x49484452, 'pilot texture header');
      width = bin.getUint32(start + 16, false); height = bin.getUint32(start + 20, false);
    } else {
      requireValue(buffer.byteLength >= 25 && bin.getUint32(start,false) === 0x52494646 && bin.getUint32(start+8,false) === 0x57454250
        && bin.getUint32(start+4,true)+8 === buffer.byteLength
        && bin.getUint32(start+16,true)+20+(bin.getUint32(start+16,true)&1) === buffer.byteLength, 'pilot WebP header');
      const kind = bin.getUint32(start+12,false);
      // Our generated tier uses one static frame. Reject extended containers:
      // their canvas header alone cannot bound the embedded frame allocation.
      if (kind === 0x5650384c) { // VP8L: lossless packed dimensions.
        requireValue(bin.getUint8(start+20) === 0x2f && (bin.getUint32(start+21,true)>>>29) === 0, 'pilot lossless WebP header');
        const bits = bin.getUint32(start+21,true);
        width = (bits&0x3fff)+1; height = ((bits>>>14)&0x3fff)+1;
      } else {
        requireValue(kind === 0x56503820 && buffer.byteLength >= 30 && (bin.getUint8(start+20)&1) === 0 && bin.getUint8(start+23) === 0x9d
          && bin.getUint8(start+24) === 1 && bin.getUint8(start+25) === 0x2a, 'pilot lossy WebP header');
        width = bin.getUint16(start+26,true)&0x3fff; height = bin.getUint16(start+28,true)&0x3fff;
      }
    }
    pixels += width * height;
    requireValue(width > 0 && height > 0 && width <= 1024 && height <= 1024 && pixels <= 6_000_000, 'bounded pilot texture dimensions');
    return { mimeType: image.mimeType, width, height, data: new Uint8Array(bytes, bin.byteOffset + (buffer.byteOffset ?? 0), buffer.byteLength) };
  });
  requireValue(json.textures?.length > 0 && json.textures.length <= 12, 'bounded pilot texture bindings');
  const textures = json.textures.map(texture => ({...texture,source:texture.extensions?.EXT_texture_webp?.source ?? texture.source}));
  for (const texture of textures) requireValue(integer(texture.source) && images[texture.source], 'pilot texture image reference');
  for (const material of json.materials) {
    const pbr = material.pbrMetallicRoughness ?? {}, factor = pbr.baseColorFactor ?? [1, 1, 1, 1];
    requireValue(factor.length === 4 && factor.every(value => Number.isFinite(value) && value >= 0 && value <= 1)
      && [pbr.roughnessFactor ?? 1, pbr.metallicFactor ?? 1].every(value => Number.isFinite(value) && value >= 0 && value <= 1), 'pilot material factors');
    for (const info of [pbr.baseColorTexture, pbr.metallicRoughnessTexture, material.normalTexture]) {
      if (info === undefined) continue;
      requireValue(integer(info.index) && json.textures[info.index] && (info.texCoord ?? 0) === 0 && !info.extensions?.KHR_texture_transform, 'pilot material texture reference');
    }
  }
  return { nodes, parents, order, skins, primitives, clips, images, materials: json.materials ?? [], textures };
}

export function createActor3dPoseWorkspace(asset) {
  return { transforms: asset.nodes.map(() => ({ translation: new Float32Array(3), rotation: new Float32Array(4), scale: new Float32Array(3) })),
    local: asset.nodes.map(identity), world: asset.nodes.map(identity), palettes: asset.skins.map(skin => new Float32Array(skin.joints.length * 16)) };
}

function multiply(out, a, b) {
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
}
function compose(out, { translation: t, rotation: q, scale: s }) {
  const [x, y, z, w] = q, xx = 2 * x * x, yy = 2 * y * y, zz = 2 * z * z;
  const xy = 2 * x * y, xz = 2 * x * z, yz = 2 * y * z, wx = 2 * w * x, wy = 2 * w * y, wz = 2 * w * z;
  out.set([(1 - yy - zz) * s[0], (xy + wz) * s[0], (xz - wy) * s[0], 0,
    (xy - wz) * s[1], (1 - xx - zz) * s[1], (yz + wx) * s[1], 0,
    (xz + wy) * s[2], (yz - wx) * s[2], (1 - xx - yy) * s[2], 0, t[0], t[1], t[2], 1]);
}
function sample(track, time, out) {
  let lo = 0, hi = track.time.length - 1;
  while (lo + 1 < hi) { const mid = (lo + hi) >>> 1; if (track.time[mid] <= time) lo = mid; else hi = mid; }
  const fraction = track.interpolation === 'STEP' ? 0 : Math.max(0, Math.min(1, (time - track.time[lo]) / (track.time[hi] - track.time[lo])));
  const a = lo * track.width, b = hi * track.width;
  if (track.path !== 'rotation') { for (let i = 0; i < track.width; i++) out[i] = track.value[a + i] + (track.value[b + i] - track.value[a + i]) * fraction; return; }
  let dot = 0; for (let i = 0; i < 4; i++) dot += track.value[a + i] * track.value[b + i];
  const sign = dot < 0 ? -1 : 1; dot = Math.min(1, Math.abs(dot));
  const angle = Math.acos(dot), sine = Math.sin(angle);
  const first = sine > 1e-6 ? Math.sin((1 - fraction) * angle) / sine : 1 - fraction;
  const second = sine > 1e-6 ? Math.sin(fraction * angle) / sine : fraction;
  let norm = 0;
  for (let i = 0; i < 4; i++) { out[i] = first * track.value[a + i] + second * track.value[b + i] * sign; norm += out[i] * out[i]; }
  norm = Math.sqrt(norm); requireValue(norm > 0, 'rotation norm'); for (let i = 0; i < 4; i++) out[i] /= norm;
}

function samplePose(asset, clipName, timeSeconds, workspace) {
  const clip = asset.clips.get(clipName); requireValue(clip, 'unknown actor clip');
  requireValue(Number.isFinite(timeSeconds) && timeSeconds >= 0, 'finite pose time required');
  const time = Math.min(timeSeconds, clip.duration);
  for (let i = 0; i < asset.nodes.length; i++) for (const field of ['translation', 'rotation', 'scale']) workspace.transforms[i][field].set(asset.nodes[i][field]);
  for (const track of clip.tracks) sample(track, time, workspace.transforms[track.node][track.path]);
}

function finishPose(asset, workspace) {
  for (const i of asset.order) {
    if (asset.nodes[i].matrix) workspace.local[i].set(asset.nodes[i].matrix); else compose(workspace.local[i], workspace.transforms[i]);
    if (asset.parents[i] < 0) workspace.world[i].set(workspace.local[i]); else multiply(workspace.world[i], workspace.world[asset.parents[i]], workspace.local[i]);
  }
  for (let i = 0; i < asset.skins.length; i++) {
    const skin = asset.skins[i];
    for (let j = 0; j < skin.joints.length; j++) multiply(workspace.palettes[i].subarray(j * 16, j * 16 + 16), workspace.world[skin.joints[j]], skin.inverseBind.subarray(j * 16, j * 16 + 16));
  }
  return workspace.palettes;
}

export function evaluateActor3dPose(asset, clipName, timeSeconds, workspace = createActor3dPoseWorkspace(asset)) {
  samplePose(asset, clipName, timeSeconds, workspace);
  return finishPose(asset, workspace);
}

// One bounded snapshot per display, allocated once. Blend local joint TRS,
// never skinning matrices: matrix lerps shrink limbs during large rotations.
export function createActor3dTransitionState(asset) {
  return { clip:null, lastTick:null, startTick:0, duration:0,
    source:asset.nodes.map(() => ({translation:new Float32Array(3),rotation:new Float32Array(4),scale:new Float32Array(3)})) };
}

export function evaluateActor3dTransitionPose(asset, clipName, timeSeconds, tick, blendTicks, workspace, state) {
  requireValue(Number.isFinite(tick) && tick >= 0 && Number.isInteger(blendTicks) && blendTicks >= 0 && blendTicks <= 12,'bounded transition clock');
  const reset=state.lastTick === null || tick < state.lastTick || tick-state.lastTick > 30;
  if (reset) { state.clip=clipName; state.duration=0; }
  else if (state.clip !== clipName) {
    for(let i=0;i<asset.nodes.length;i++) {
      const source=state.source[i], drawn=workspace.transforms[i];
      source.translation.set(drawn.translation); source.rotation.set(drawn.rotation); source.scale.set(drawn.scale);
    }
    state.clip=clipName; state.startTick=tick; state.duration=blendTicks;
  }
  state.lastTick=tick;
  samplePose(asset,clipName,timeSeconds,workspace);
  const fraction=state.duration ? Math.min(1,(tick-state.startTick)/state.duration) : 1;
  if (fraction < 1) for(let i=0;i<asset.nodes.length;i++) {
    const from=state.source[i], to=workspace.transforms[i];
    for(let axis=0;axis<3;axis++) {
      to.translation[axis]=from.translation[axis]+(to.translation[axis]-from.translation[axis])*fraction;
      to.scale[axis]=from.scale[axis]+(to.scale[axis]-from.scale[axis])*fraction;
    }
    let dot=0; for(let axis=0;axis<4;axis++) dot+=from.rotation[axis]*to.rotation[axis];
    const sign=dot<0 ? -1 : 1, angle=Math.acos(Math.min(1,Math.abs(dot))), sine=Math.sin(angle);
    const first=sine>1e-6 ? Math.sin((1-fraction)*angle)/sine : 1-fraction;
    const second=sine>1e-6 ? Math.sin(fraction*angle)/sine : fraction;
    let norm=0;
    for(let axis=0;axis<4;axis++) { to.rotation[axis]=first*from.rotation[axis]+second*to.rotation[axis]*sign; norm+=to.rotation[axis]**2; }
    norm=Math.sqrt(norm); requireValue(norm>0,'transition rotation norm');
    for(let axis=0;axis<4;axis++) to.rotation[axis]/=norm;
  }
  return finishPose(asset,workspace);
}

export function projectActor3dPoint([x, y, z], { heading = Math.PI / 2, pixelsPerMetre = 40 } = {}) {
  requireValue(finiteArray([x, y, z, heading, pixelsPerMetre]) && pixelsPerMetre > 0, 'finite projection required');
  const yaw = Math.PI / 2 - heading, rotatedX = x * Math.cos(yaw) + z * Math.sin(yaw), rotatedZ = -x * Math.sin(yaw) + z * Math.cos(yaw);
  const angle = 55 * Math.PI / 180, compensatedY = y / Math.tan(angle);
  return { x: rotatedX * pixelsPerMetre, y: (Math.cos(angle) * rotatedZ - Math.sin(angle) * compensatedY) / Math.cos(angle) * pixelsPerMetre };
}

// Every weighted vertex is a convex combination of joint-transformed points.
// The union of transformed joint envelopes therefore conservatively contains
// the animated primitive without scanning its vertices each rendered frame.
export function createActor3dJointBounds(asset) {
  return asset.primitives.map(primitive => {
    const bounds = asset.skins[primitive.skin].joints.map(() => ({ min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }));
    for (let i = 0; i < primitive.positions.length / 3; i++) for (let w = 0; w < 4; w++) {
      if (primitive.weights[i * 4 + w] <= 0) continue;
      const bound = bounds[primitive.joints[i * 4 + w]];
      for (let axis = 0; axis < 3; axis++) {
        const value = primitive.positions[i * 3 + axis];
        bound.min[axis] = Math.min(bound.min[axis], value); bound.max[axis] = Math.max(bound.max[axis], value);
      }
    }
    return bounds;
  });
}

export function projectActor3dBounds(envelopes, palette, options) {
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (let joint = 0; joint < envelopes.length; joint++) {
    const envelope = envelopes[joint]; if (!Number.isFinite(envelope.min[0])) continue;
    for (let corner = 0; corner < 8; corner++) {
      const x = (corner & 1 ? envelope.max : envelope.min)[0], y = (corner & 2 ? envelope.max : envelope.min)[1], z = (corner & 4 ? envelope.max : envelope.min)[2], at = joint * 16;
      const point = projectActor3dPoint([palette[at] * x + palette[at + 4] * y + palette[at + 8] * z + palette[at + 12],
        palette[at + 1] * x + palette[at + 5] * y + palette[at + 9] * z + palette[at + 13],
        palette[at + 2] * x + palette[at + 6] * y + palette[at + 10] * z + palette[at + 14]], options);
      bounds.minX = Math.min(bounds.minX, point.x); bounds.maxX = Math.max(bounds.maxX, point.x);
      bounds.minY = Math.min(bounds.minY, point.y); bounds.maxY = Math.max(bounds.maxY, point.y);
    }
  }
  requireValue(finiteArray(Object.values(bounds)), 'finite primitive bounds required'); return bounds;
}
