import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import test from 'node:test';
const NEW_ENEMY_IDS = ['tollkeeper', 'money-printer', 'pump-and-dump-bloater', 'hodl-revenant', 'rug-puller', 'oracle-marksman'];
const model = await import('../apps/hmh-reboot/src/actor-3d-model.mjs').catch(() => ({}));

// A one-joint rig isolates transition correctness from export and texture costs.
const transitionRig = () => {
  const identity = new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
  const track = (path, values) => ({node:0,path,width:path==='rotation'?4:3,time:new Float32Array([0,1]),value:new Float32Array([...values,...values]),interpolation:'LINEAR'});
  return {nodes:[{translation:[0,0,0],rotation:[0,0,0,1],scale:[1,1,1]}],order:[0],parents:[-1],skins:[{joints:[0],inverseBind:identity}],clips:new Map([
    ['idle',{duration:1,tracks:[]}],
    ['run',{duration:1,tracks:[track('translation',[8,0,0]),track('rotation',[0,0,1,0])]}],
    ['cover',{duration:1,tracks:[track('translation',[4,-2,0]),track('rotation',[0,0,0,-1])]}],
  ])};
};

test('native transition samples interpolate joint TRS, remain orthonormal and finish exactly', () => {
  const asset=transitionRig(), pose=model.createActor3dPoseWorkspace(asset), state=model.createActor3dTransitionState(asset);
  const sample=(clip,tick,blend=4)=>model.evaluateActor3dTransitionPose(asset,clip,.5,tick,blend,pose,state)[0];
  sample('idle',10); assert.equal(sample('run',11)[12],0);
  const mid=sample('run',13); assert.equal(mid[12],4);
  assert.ok(Math.abs(Math.hypot(mid[0],mid[1],mid[2])-1)<1e-6,'rotation blending must not collapse a joint');
  assert.equal(sample('run',15)[12],8);
  assert.deepEqual(Array.from(sample('run',16)),Array.from(model.evaluateActor3dPose(asset,'run',.5)[0]));
});

test('native transitions freeze on repeated ticks, retarget from the drawn pose and reset on rollback or long gaps', () => {
  const asset=transitionRig(), original=JSON.stringify(asset.nodes), pose=model.createActor3dPoseWorkspace(asset), state=model.createActor3dTransitionState(asset);
  const sample=(clip,tick,blend=4)=>Array.from(model.evaluateActor3dTransitionPose(asset,clip,.5,tick,blend,pose,state)[0]);
  sample('idle',10); sample('run',11); const mid=sample('run',13);
  assert.deepEqual(sample('run',13),mid,'paused render must not advance');
  assert.deepEqual(sample('cover',13),mid,'retargeting must begin from the currently drawn pose');
  assert.equal(sample('cover',15)[12],4);
  assert.deepEqual(sample('idle',2),Array.from(model.evaluateActor3dPose(asset,'idle',.5)[0]));
  assert.deepEqual(sample('run',50),Array.from(model.evaluateActor3dPose(asset,'run',.5)[0]));
  assert.equal(JSON.stringify(asset.nodes),original,'asset bind transforms remain immutable');
});

test('zero-duration priority transitions interrupt immediately and quaternion sign aliases take the short path', () => {
  const asset=transitionRig(), pose=model.createActor3dPoseWorkspace(asset), state=model.createActor3dTransitionState(asset);
  const sample=(clip,tick,blend=4)=>model.evaluateActor3dTransitionPose(asset,clip,.5,tick,blend,pose,state)[0];
  sample('idle',10); sample('cover',11); const mid=sample('cover',13);
  assert.equal(mid[0],1); assert.equal(mid[5],1,'q and -q must represent the same rotation throughout');
  assert.deepEqual(Array.from(sample('run',14,0)),Array.from(model.evaluateActor3dPose(asset,'run',.5)[0]));
});
const bytesFor = id => {
  const bytes = readFileSync(new URL(`../apps/portal/assets/generated/hmh-actor-3d-pilot/${id}.glb`, import.meta.url));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
};
const hash = buffer => createHash('sha256').update(new Uint8Array(buffer)).digest('hex');
const changeJson = (bytes, change) => {
  const old = new DataView(bytes), length = old.getUint32(12, true), bin = new Uint8Array(bytes, 28 + length);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(bytes, 20, length))); change(json);
  const encoded = new TextEncoder().encode(JSON.stringify(json)), padded = (encoded.length + 3) & ~3;
  const result = new ArrayBuffer(28 + padded + bin.length), view = new DataView(result);
  view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, result.byteLength, true);
  view.setUint32(12, padded, true); view.setUint32(16, 0x4e4f534a, true);
  new Uint8Array(result, 20, padded).fill(32); new Uint8Array(result, 20, encoded.length).set(encoded);
  view.setUint32(20 + padded, bin.length, true); view.setUint32(24 + padded, 0x004e4942, true); new Uint8Array(result, 28 + padded).set(bin);
  return result;
};

test('the bounded runtime loader reads real weighted geometry and clips from the embedded heroes and enemy', () => {
  assert.equal(typeof model.decodeActor3dGlb, 'function');
  for (const [id, joints, clips] of [['lit-commando', 22, 80], ['lilly', 24, 80], ['lit-valkyrie', 22, 80], ['lester-original', 22, 80], ['bagholder-rusher', 19, 7], ['forkrunner', 24, 6], ['liquidator-agent', 22, 6], ['whale-enforcer', 19, 6], ['gas-bomber', 19, 6], ['validator-cultist', 19, 6], ...NEW_ENEMY_IDS.map(id => [id, 19, 6])]) {
    const bytes = bytesFor(id), before = hash(bytes);
    const asset = model.decodeActor3dGlb(bytes);
    assert.equal(asset.skins[0].joints.length, joints);
    assert.equal(asset.clips.size, clips);
    if (id === 'bagholder-rusher') assert.ok(asset.clips.has('death-side'), 'the seventh clip is the authored side fall');
    assert.ok(asset.primitives.length >= 2);
    assert.ok(asset.primitives.every(p => p.positions.length > 0 && p.joints.length === p.weights.length));
    assert.equal(hash(bytes), before);
  }
});

test('clip palettes are deterministic, vary with real poses and never mutate source bytes or draw RNG', () => {
  const bytes = bytesFor('bagholder-rusher'), before = hash(bytes);
  const asset = model.decodeActor3dGlb(bytes);
  const random = Math.random; Math.random = () => { throw new Error('presentation must not draw RNG'); };
  try {
    const first = model.evaluateActor3dPose(asset, 'run', .25);
    const second = model.evaluateActor3dPose(asset, 'run', .25);
    assert.deepEqual(first, second);
    assert.notDeepEqual(first, model.evaluateActor3dPose(asset, 'run', .5));
    assert.equal(first.length, 1);
    assert.equal(first[0].length, 19 * 16);
    assert.equal(hash(bytes), before);
  } finally { Math.random = random; }
});

test('camera calibration preserves one-metre X/Y/Z rulers through the current world-foot projection', () => {
  assert.equal(typeof model.projectActor3dPoint, 'function');
  // glTF is Y-up and +Z maps to the current world ground Y.
  const options = { heading: Math.PI / 2, pixelsPerMetre: 40 };
  const origin = model.projectActor3dPoint([0, 0, 0], options);
  const x = model.projectActor3dPoint([1, 0, 0], options);
  const y = model.projectActor3dPoint([0, 0, 1], options);
  const z = model.projectActor3dPoint([0, 1, 0], options);
  assert.deepEqual(origin, { x: 0, y: 0 });
  assert.ok(Math.abs(x.x - 40) < 1e-9 && Math.abs(x.y) < 1e-9);
  assert.ok(Math.abs(y.y - 40) < 1e-9 && Math.abs(y.x) < 1e-9);
  assert.ok(Math.abs(z.y + 40) < 1e-9 && Math.abs(z.x) < 1e-9);
});

test('invalid clip requests and nonfinite pose clocks fail before rendering', () => {
  const asset = model.decodeActor3dGlb(bytesFor('bagholder-rusher'));
  assert.throws(() => model.evaluateActor3dPose(asset, 'private-action', .25), /clip/);
  assert.throws(() => model.evaluateActor3dPose(asset, 'run', NaN), /time/);
});

test('corrupt animation samples and mismatched GLB lengths fail the bounded runtime loader', () => {
  const invalid = bytesFor('bagholder-rusher'), view = new DataView(invalid);
  const jsonLength = view.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(invalid, 20, jsonLength)));
  const output = json.accessors[json.animations[0].samplers[0].output];
  const buffer = json.bufferViews[output.bufferView];
  view.setFloat32(28 + jsonLength + (buffer.byteOffset ?? 0) + (output.byteOffset ?? 0), NaN, true);
  assert.throws(() => model.decodeActor3dGlb(invalid), /finite/);
  const length = bytesFor('bagholder-rusher'); new DataView(length).setUint32(8, 12, true);
  assert.throws(() => model.decodeActor3dGlb(length), /length/);
});

test('CPU skinning independently reproduces the offline Blender reimport bounds for every clip', () => {
  for (const id of ['lit-commando', 'lilly', 'lit-valkyrie', 'lester-original', 'bagholder-rusher', 'forkrunner', 'liquidator-agent', 'whale-enforcer', 'gas-bomber', 'validator-cultist', ...NEW_ENEMY_IDS]) {
    const asset = model.decodeActor3dGlb(bytesFor(id));
    const receipt = JSON.parse(readFileSync(new URL(`../docs/2.0/receipts/${id}-glb-reimport.json`, import.meta.url)));
    for (const clip of receipt.clips) for (const sample of clip.samples) {
      const palettes = model.evaluateActor3dPose(asset, clip.name, (sample.frame - 1) / 24);
      const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
      for (const primitive of asset.primitives) for (let i = 0; i < primitive.positions.length / 3; i++) {
        const position = primitive.positions.subarray(i * 3, i * 3 + 3), point = [0, 0, 0];
        for (let w = 0; w < 4; w++) {
          const weight = primitive.weights[i * 4 + w], at = primitive.joints[i * 4 + w] * 16;
          for (let axis = 0; axis < 3; axis++) point[axis] += weight * (palettes[primitive.skin][at + axis] * position[0]
            + palettes[primitive.skin][at + 4 + axis] * position[1] + palettes[primitive.skin][at + 8 + axis] * position[2]
            + palettes[primitive.skin][at + 12 + axis]);
        }
        // Independent receipt uses Blender Z-up; glTF X,Y,Z = Blender X,Z,-Y.
        const blender = [point[0], -point[2], point[1]];
        for (let axis = 0; axis < 3; axis++) { min[axis] = Math.min(min[axis], blender[axis]); max[axis] = Math.max(max[axis], blender[axis]); }
      }
      for (let axis = 0; axis < 3; axis++) {
        assert.ok(Math.abs(min[axis] - sample.min[axis]) < 2e-5, `${id}/${clip.name}/${sample.frame} min${axis}: ${min[axis]} != ${sample.min[axis]}`);
        assert.ok(Math.abs(max[axis] - sample.max[axis]) < 2e-5, `${id}/${clip.name}/${sample.frame} max${axis}: ${max[axis]} != ${sample.max[axis]}`);
      }
    }
  }
});

test('per-primitive animated bounds contain all projected weighted vertices at every sampled heading', () => {
  assert.equal(typeof model.createActor3dJointBounds, 'function');
  assert.equal(typeof model.projectActor3dBounds, 'function');
  const asset = model.decodeActor3dGlb(bytesFor('bagholder-rusher'));
  const envelopes = model.createActor3dJointBounds(asset);
  for (const [name] of asset.clips) for (const time of [0, .5, 1]) for (const heading of [0, 1.4, 3.1, 4.8]) {
    const palettes = model.evaluateActor3dPose(asset, name, time), options = { heading, pixelsPerMetre: 40 };
    for (let p = 0; p < asset.primitives.length; p++) {
      const primitive = asset.primitives[p], palette = palettes[primitive.skin];
      const bounds = model.projectActor3dBounds(envelopes[p], palette, options);
      for (let i = 0; i < primitive.positions.length / 3; i++) {
        const position = primitive.positions.subarray(i * 3, i * 3 + 3), point = [0, 0, 0];
        for (let w = 0; w < 4; w++) {
          const weight = primitive.weights[i * 4 + w], at = primitive.joints[i * 4 + w] * 16;
          for (let axis = 0; axis < 3; axis++) point[axis] += weight * (palette[at + axis] * position[0]
            + palette[at + 4 + axis] * position[1] + palette[at + 8 + axis] * position[2] + palette[at + 12 + axis]);
        }
        const screen = model.projectActor3dPoint(point, options);
        assert.ok(screen.x >= bounds.minX - .001 && screen.x <= bounds.maxX + .001 && screen.y >= bounds.minY - .001 && screen.y <= bounds.maxY + .001);
      }
    }
  }
});

test('invalid geometry formats and oversized embedded textures fail before browser decode/GPU upload', () => {
  const geometry = changeJson(bytesFor('bagholder-rusher'), json => {
    json.accessors[json.meshes[0].primitives[0].attributes.POSITION].componentType = 5125;
  });
  assert.throws(() => model.decodeActor3dGlb(geometry), /vertex/);
  const image = bytesFor('bagholder-rusher'), view = new DataView(image), length = view.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(image, 20, length)));
  view.setUint32(28 + length + (json.bufferViews[json.images[0].bufferView].byteOffset ?? 0) + 16, 4096, false);
  assert.throws(() => model.decodeActor3dGlb(image), /texture/);
});

const addTangent = json => {
  const primitive = json.meshes[0].primitives[0], tangent = structuredClone(json.accessors[primitive.attributes.WEIGHTS_0]);
  primitive.attributes.TANGENT = json.accessors.length; json.accessors.push(tangent); return tangent;
};
for (const [name, change, message] of [
  ['tangent count', json => addTangent(json).count--, /tangent/],
  ['tangent shape', json => addTangent(json).type = 'VEC3', /tangent/],
  ['tangent component', json => addTangent(json).componentType = 5125, /tangent/],
  ['normalized position', json => json.accessors[json.meshes[0].primitives[0].attributes.POSITION].normalized = true, /vertex/],
  ['material texture reference', json => json.materials[0].pbrMetallicRoughness.baseColorTexture.index = 999, /texture/],
  ['texture image reference', json => json.textures[0].source = 999, /texture/],
]) test(`the bounded reader rejects corrupt ${name} before upload`, () => {
  assert.throws(() => model.decodeActor3dGlb(changeJson(bytesFor('lit-commando'), change)), message);
});
