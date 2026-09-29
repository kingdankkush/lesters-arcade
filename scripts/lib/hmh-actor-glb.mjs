// Offline runtime export inspection: embedded dependencies, real skinning and
// timed animation. This deliberately does not certify likeness or GPU speed.
import { readImageDimensions, estimateTextureBytes } from './hmh-perf-analysis.mjs';
const sizes = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const components = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const fail = message => { throw new Error(message); };
const integer = (value, minimum = 0) => Number.isSafeInteger(value) && value >= minimum;

export function inspectActorGlb(bytes, { requiredClips = [] } = {}) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 20) fail('truncated GLB');
  if (bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2) fail('GLB v2 required');
  if (bytes.readUInt32LE(8) !== bytes.length) fail('GLB length mismatch');
  let json, bin;
  for (let cursor = 12; cursor < bytes.length;) {
    if (cursor + 8 > bytes.length) fail('truncated GLB chunk');
    const length = bytes.readUInt32LE(cursor), type = bytes.readUInt32LE(cursor + 4);
    if (length % 4 || cursor + 8 + length > bytes.length) fail('truncated GLB chunk length');
    const chunk = bytes.subarray(cursor + 8, cursor + 8 + length);
    if (type === 0x4e4f534a) { if (json) fail('duplicate JSON'); json = JSON.parse(chunk.toString('utf8')); }
    else if (type === 0x004e4942) { if (bin) fail('duplicate BIN'); bin = chunk; }
    cursor += 8 + length;
  }
  if (!json || !bin || json.asset?.version !== '2.0') fail('embedded glTF 2.0 required');
  for (const dependency of [...json.buffers ?? [], ...json.images ?? []]) {
    if (dependency.uri) fail('external dependency forbidden in runtime actor GLB');
  }
  const bufferLength = json.buffers?.[0]?.byteLength;
  if (json.buffers?.length !== 1 || !integer(bufferLength, 1) || bufferLength > bin.length) fail('embedded buffer length');
  for (const view of json.bufferViews ?? []) {
    const offset = view.byteOffset ?? 0;
    if (view.buffer !== 0 || !integer(offset) || !integer(view.byteLength, 1)
      || (view.byteStride !== undefined && !integer(view.byteStride, 1))) fail('invalid buffer view integers');
    if (!integer(offset + view.byteLength) || offset + view.byteLength > bufferLength) fail('view exceeds declared buffer');
  }
  const accessor = index => {
    const a = json.accessors?.[index], v = json.bufferViews?.[a?.bufferView];
    const width = components[a?.type], size = sizes[a?.componentType];
    if (!a || !v || !width || !size || a.sparse || !integer(a.count, 1) || !integer(a.byteOffset ?? 0)) fail('unsupported accessor');
    const stride = v.byteStride ?? width * size, offset = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
    const end = offset + (a.count - 1) * stride + width * size;
    if (!integer(end) || stride < width * size || offset % size || end > bufferLength || end > (v.byteOffset ?? 0) + v.byteLength) fail('accessor range exceeds buffer');
    const value = (row, column) => {
      const at = offset + row * stride + column * size;
      const raw = a.componentType === 5126 ? bin.readFloatLE(at) : a.componentType === 5121 ? bin.readUInt8(at)
        : a.componentType === 5123 ? bin.readUInt16LE(at) : a.componentType === 5125 ? bin.readUInt32LE(at)
          : a.componentType === 5120 ? bin.readInt8(at) : bin.readInt16LE(at);
      return a.normalized && a.componentType !== 5126 ? raw / (a.componentType === 5121 ? 255 : a.componentType === 5123 ? 65535 : 1) : raw;
    };
    return { ...a, width, value };
  };
  // Validate even unused accessors so a corrupt exporter cannot hide bad ranges.
  for (let i = 0; i < (json.accessors?.length ?? 0); i++) accessor(i);
  let vertices = 0, triangles = 0, skinnedMeshes = 0;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const node of json.nodes ?? []) {
    if (node.mesh === undefined) continue;
    const skin = json.skins?.[node.skin];
    if (!skin?.joints?.length) fail('every actor mesh must have a skin');
    if (skin.joints.some(joint => !Number.isInteger(joint) || !json.nodes[joint])) fail('invalid skin joint');
    skinnedMeshes++;
    if (!json.meshes?.[node.mesh]?.primitives?.length) fail('actor mesh primitives missing');
    for (const p of json.meshes?.[node.mesh]?.primitives ?? []) {
      if ((p.mode ?? 4) !== 4) fail('triangle geometry required');
      const position = accessor(p.attributes?.POSITION), weights = accessor(p.attributes?.WEIGHTS_0);
      const joints = accessor(p.attributes?.JOINTS_0);
      if (position.width !== 3 || weights.width !== 4 || joints.width !== 4 || weights.count !== position.count || joints.count !== position.count) fail('skin attribute count');
      if (![5121, 5123].includes(joints.componentType) || joints.normalized) fail('joint integer attributes required');
      vertices += position.count;
      const indices = p.indices === undefined ? null : accessor(p.indices);
      if (indices && (indices.type !== 'SCALAR' || ![5121, 5123, 5125].includes(indices.componentType) || indices.normalized)) fail('unsigned SCALAR indices required');
      const count = indices?.count ?? position.count;
      if (indices) for (let i = 0; i < count; i++) {
        const index = indices.value(i, 0);
        if (!Number.isInteger(index) || index < 0 || index >= position.count) fail('geometry index out of range');
      }
      if (count % 3) fail('triangle index count'); triangles += count / 3;
      for (let row = 0; row < position.count; row++) {
        let sum = 0;
        for (let c = 0; c < 4; c++) {
          const w = weights.value(row, c), joint = joints.value(row, c);
          if (!Number.isInteger(joint) || joint >= skin.joints.length) fail('joint out of range');
          if (!Number.isFinite(w) || w < 0 || w > 1) fail('invalid weights'); sum += w;
        }
        if (Math.abs(sum - 1) > 0.002) fail('weights must be normalized');
        for (let c = 0; c < 3; c++) { const v = position.value(row, c); if (!Number.isFinite(v)) fail('non-finite geometry'); min[c] = Math.min(min[c], v); max[c] = Math.max(max[c], v); }
      }
    }
  }
  if (!skinnedMeshes || !vertices || !triangles) fail('skinned actor geometry required');
  const clips = (json.animations ?? []).map(animation => {
    let durationSeconds = 0;
    if (!animation.name || !animation.channels?.length) fail('named animated clip required');
    for (const channel of animation.channels) {
      const sampler = animation.samplers?.[channel.sampler], input = accessor(sampler?.input), output = accessor(sampler?.output);
      if (!Number.isInteger(channel.target?.node) || !json.nodes[channel.target.node]) fail('animation target missing');
      const path = channel.target.path, interpolation = sampler.interpolation ?? 'LINEAR';
      if (!['translation', 'rotation', 'scale', 'weights'].includes(path)) fail('invalid animation target path');
      if (!['LINEAR', 'STEP', 'CUBICSPLINE'].includes(interpolation)) fail('invalid animation interpolation');
      if (input.type !== 'SCALAR' || input.componentType !== 5126 || input.normalized || input.count < 2) fail('FLOAT scalar animation time required');
      const expectedShape = path === 'rotation' ? 'VEC4' : path === 'weights' ? 'SCALAR' : 'VEC3';
      if (output.type !== expectedShape || output.componentType !== 5126 || output.normalized) fail('FLOAT animation output shape required');
      let factor = interpolation === 'CUBICSPLINE' ? 3 : 1;
      if (path === 'weights') {
        const mesh = json.meshes?.[json.nodes[channel.target.node].mesh], targets = mesh?.primitives?.[0]?.targets?.length;
        if (!integer(targets, 1)) fail('animation weights target missing');
        factor *= targets;
      }
      if (output.count !== input.count * factor) fail('animation output sample count mismatch');
      for (let row = 0; row < output.count; row++) for (let c = 0; c < output.width; c++) {
        if (!Number.isFinite(output.value(row, c))) fail('non-finite animation sample');
      }
      let previous = -Infinity;
      for (let i = 0; i < input.count; i++) { const t = input.value(i, 0); if (!Number.isFinite(t) || t < 0 || t <= previous) fail('invalid animation time'); previous = t; }
      durationSeconds = Math.max(durationSeconds, previous - input.value(0, 0));
    }
    if (!(durationSeconds > 0)) fail('clip duration must be positive');
    return { name: animation.name, durationSeconds, channels: animation.channels.length };
  }).sort((a, b) => a.name.localeCompare(b.name));
  if (new Set(clips.map(clip => clip.name)).size !== clips.length) fail('duplicate clip names');
  for (const name of requiredClips) if (!clips.some(clip => clip.name === name)) fail(`missing required clip ${name}`);
  const images = (json.images ?? []).map(image => {
    const view = json.bufferViews?.[image.bufferView];
    if (!view || view.buffer !== 0 || (view.byteOffset ?? 0) + view.byteLength > bin.length) fail('embedded image range');
    const dimensions = readImageDimensions(bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength));
    if (!dimensions?.width || !dimensions.height) fail('embedded image dimensions');
    return { name: image.name ?? '', ...dimensions, bytes: view.byteLength };
  });
  return { bytes: bytes.length, vertices, triangles, skinnedMeshes,
    joints: new Set((json.skins ?? []).flatMap(skin => skin.joints)).size,
    clips, bounds: { min, max }, embeddedImages: images.length, images,
    textureBytesRgba8: images.reduce((sum, image) => sum + estimateTextureBytes(image), 0),
    textureBytesRgba8Mipmaps: images.reduce((sum, image) => sum + estimateTextureBytes({ ...image, mipmaps: true }), 0) };
}
