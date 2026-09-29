import assert from 'node:assert/strict';
import test from 'node:test';
const tools = await import('../scripts/lib/hmh-actor-glb.mjs').catch(() => ({}));

function fixture() {
  const values = new Float32Array([
    -0.5, 0, 0, 0.5, 0, 0, 0, 1, 0,
    1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0,
    0, 1,
    0, 0, 0, 0, 0.1, 0,
  ]);
  const bin = Buffer.alloc(128); Buffer.from(values.buffer).copy(bin);
  const json = { asset: { version: '2.0' }, buffers: [{ byteLength: bin.length }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36 },
      { buffer: 0, byteOffset: 36, byteLength: 48 },
      { buffer: 0, byteOffset: 84, byteLength: 8 },
      { buffer: 0, byteOffset: 92, byteLength: 24 },
      { buffer: 0, byteOffset: 116, byteLength: 12 },
    ], accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [-0.5, 0, 0], max: [0.5, 1, 0] },
      { bufferView: 1, componentType: 5126, count: 3, type: 'VEC4' },
      { bufferView: 2, componentType: 5126, count: 2, type: 'SCALAR' },
      { bufferView: 3, componentType: 5126, count: 2, type: 'VEC3' },
      { bufferView: 4, componentType: 5121, count: 3, type: 'VEC4' },
    ], meshes: [{ primitives: [{ attributes: { POSITION: 0, WEIGHTS_0: 1, JOINTS_0: 4 } }] }],
    nodes: [{ name: 'human', mesh: 0, skin: 0 }, { name: 'root' }], skins: [{ joints: [1] }],
    animations: [{ name: 'idle', samplers: [{ input: 2, output: 3 }], channels: [{ sampler: 0, target: { node: 1, path: 'translation' } }] }],
  };
  return { json, bin };
}
function glb({ json, bin }) {
  const raw = Buffer.from(JSON.stringify(json));
  const padded = Buffer.alloc(Math.ceil(raw.length / 4) * 4, 32); raw.copy(padded);
  const out = Buffer.alloc(12 + 8 + padded.length + 8 + bin.length);
  out.writeUInt32LE(0x46546c67, 0); out.writeUInt32LE(2, 4); out.writeUInt32LE(out.length, 8);
  out.writeUInt32LE(padded.length, 12); out.writeUInt32LE(0x4e4f534a, 16); padded.copy(out, 20);
  const offset = 20 + padded.length;
  out.writeUInt32LE(bin.length, offset); out.writeUInt32LE(0x004e4942, offset + 4); bin.copy(out, offset + 8);
  return out;
}

test('runtime inspection requires an embedded GLB with actual weighted geometry and timed clips', () => {
  assert.equal(typeof tools.inspectActorGlb, 'function');
  const receipt = tools.inspectActorGlb(glb(fixture()), { requiredClips: ['idle'] });
  assert.equal(receipt.triangles, 1);
  assert.equal(receipt.vertices, 3);
  assert.equal(receipt.skinnedMeshes, 1);
  assert.equal(receipt.joints, 1);
  assert.deepEqual(receipt.clips, [{ name: 'idle', durationSeconds: 1, channels: 1 }]);
  assert.deepEqual(receipt.bounds, { min: [-0.5, 0, 0], max: [0.5, 1, 0] });
});

test('truncation and external dependencies fail instead of silently accepting a broken runtime asset', () => {
  assert.throws(() => tools.inspectActorGlb(glb(fixture()).subarray(0, 30)), /length|truncated/);
  for (const type of ['buffers', 'images']) {
    const source = fixture(); source.json[type] = [{ uri: '../private/source.png', byteLength: 1 }];
    assert.throws(() => tools.inspectActorGlb(glb(source)), /external/);
  }
});

test('missing skinning or a static/absent clip fails the pilot contract', () => {
  const absent = fixture(); delete absent.json.nodes[0].skin;
  assert.throws(() => tools.inspectActorGlb(glb(absent)), /skin/);
  const staticClip = fixture(); staticClip.bin.writeFloatLE(0, 88);
  assert.throws(() => tools.inspectActorGlb(glb(staticClip)), /duration|time/);
  assert.throws(() => tools.inspectActorGlb(glb(fixture()), { requiredClips: ['run'] }), /run/);
});

test('invalid skin weights and accessor ranges cannot pass the export gate', () => {
  const zero = fixture(); zero.bin.fill(0, 36, 52);
  assert.throws(() => tools.inspectActorGlb(glb(zero)), /weights/);
  const bounds = fixture(); bounds.json.accessors[0].count = 999999;
  assert.throws(() => tools.inspectActorGlb(glb(bounds)), /accessor/);
});

test('out-of-range joints and animation targets fail the runtime boundary', () => {
  const joint = fixture(); joint.bin[116] = 20;
  assert.throws(() => tools.inspectActorGlb(glb(joint)), /joint/);
  const target = fixture(); target.json.animations[0].channels[0].target.node = 999;
  assert.throws(() => tools.inspectActorGlb(glb(target)), /target/);
});

test('corrupt animation data cannot pass as a timed runtime clip', () => {
  const nan = fixture(); nan.bin.writeFloatLE(NaN, 92);
  assert.throws(() => tools.inspectActorGlb(glb(nan)), /sample/);
  const rotation = fixture(); rotation.json.animations[0].channels[0].target.path = 'rotation';
  assert.throws(() => tools.inspectActorGlb(glb(rotation)), /shape/);
  const negative = fixture(); negative.bin.writeFloatLE(-1, 84);
  assert.throws(() => tools.inspectActorGlb(glb(negative)), /time/);
  const repeated = fixture(); repeated.bin.writeFloatLE(0, 88);
  assert.throws(() => tools.inspectActorGlb(glb(repeated)), /time/);
  const unknown = fixture(); unknown.json.animations[0].channels[0].target.path = 'health';
  assert.throws(() => tools.inspectActorGlb(glb(unknown)), /path/);
  const interpolation = fixture(); interpolation.json.animations[0].samplers[0].interpolation = 'CUBICSPLINE';
  assert.throws(() => tools.inspectActorGlb(glb(interpolation)), /count/);
  const integerTime = fixture(); integerTime.json.accessors[2].componentType = 5125;
  assert.throws(() => tools.inspectActorGlb(glb(integerTime)), /time/);
});

test('indices and views must obey declared buffer ranges and integer shapes', () => {
  const indices = fixture(); indices.json.meshes[0].primitives[0].indices = 4;
  assert.throws(() => tools.inspectActorGlb(glb(indices)), /indices/);
  for (const field of ['byteOffset', 'byteLength', 'byteStride']) {
    const invalid = fixture(); invalid.json.bufferViews[0][field] = 0.5;
    assert.throws(() => tools.inspectActorGlb(glb(invalid)), /view/);
  }
  const outside = fixture(); outside.json.buffers[0].byteLength = 120;
  assert.throws(() => tools.inspectActorGlb(glb(outside)), /buffer/);
  const offset = fixture(); offset.json.accessors[0].byteOffset = 0.5;
  assert.throws(() => tools.inspectActorGlb(glb(offset)), /accessor/);
});
