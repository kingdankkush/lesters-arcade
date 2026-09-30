// Attachment math (2.0 weapons lane): a weapon model seated on the hero's
// pistol_prop joint lands where the native pistol is, the muzzle transforms
// through a known pose to the expected point, and the world offset agrees
// with the actor projection the shader implements.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  createWeaponAttachment, decodeWeaponGlb, glbToGrip, gripFrameMatrix, validateWeaponModelManifest,
  weaponModelToWorldOffset, weaponSocketToModel,
} from '../apps/hmh-reboot/src/weapon-model.mjs';
import { decodeActor3dGlb, createActor3dPoseWorkspace, evaluateActor3dPose, projectActor3dPoint } from '../apps/hmh-reboot/src/actor-3d-model.mjs';
import { createActor3dPresentationEntries, ACTOR3D_HERO_WEAPON_IDS } from '../apps/hmh-reboot/src/actor-3d-controller.mjs';
import { createActor3dProjection } from '../apps/hmh-reboot/src/actor-3d-projection.mjs';

const root = new URL('../', import.meta.url);
const bufferOf = bytes => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
const manifest = validateWeaponModelManifest(JSON.parse(readFileSync(new URL('apps/portal/assets/generated/hmh-weapon-models/manifest.json', root), 'utf8')));
const weapon = id => decodeWeaponGlb(bufferOf(readFileSync(new URL(`apps/portal/assets/generated/hmh-weapon-models/${id}.glb`, root))));
const hero = id => decodeActor3dGlb(bufferOf(readFileSync(new URL(`apps/portal/assets/generated/hmh-actor-3d-pilot/${id}.glb`, root))));
const identityHero = { socketJoint: 'pistol_prop', socketJointIndex: 0, socketNodeIndex: 0, axesInSocket: { forward: [1, 0, 0], left: [0, 1, 0], up: [0, 0, 1] }, anchorInSocket: [0, 0, 0] };
const identity = () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

test('a known pose carries the muzzle through the socket: identity frame, then a 90-degree yaw with a translation', () => {
  const grip = gripFrameMatrix(identityHero);
  assert.deepEqual([...grip], [...identity()]);
  // GLB Y-up (x forward, y up, z right) -> grip (x forward, y left, z up).
  assert.deepEqual(glbToGrip([1, 2, 3]), [1, -3, 2]);
  const muzzle = [0.5, 0, 0.1];
  assert.deepEqual([...weaponSocketToModel(identity(), muzzle)], muzzle);
  // Column-major: rotate +90 degrees about Y (x -> -z), then translate by (1, 2, 3).
  const yaw = new Float32Array([0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 2, 3, 1]);
  const point = weaponSocketToModel(yaw, muzzle);
  assert.ok(Math.abs(point[0] - (1 + 0.1)) < 1e-6 && Math.abs(point[1] - 2) < 1e-6 && Math.abs(point[2] - (3 - 0.5)) < 1e-6);
  assert.throws(() => weaponSocketToModel(new Float32Array(16).fill(NaN), muzzle));
});

test('the world offset matches the actor projection basis for every heading and scale', () => {
  for (const heading of [0, Math.PI / 2, Math.PI, -Math.PI / 3, 2.2]) {
    for (const point of [[0.4, 0.9, 0.05], [-0.2, 1.3, 0.3], [0, 0, 0]]) {
      const offset = weaponModelToWorldOffset(point, { heading, pixelsPerMetre: 40 });
      const screen = projectActor3dPoint(point, { heading, pixelsPerMetre: 40 });
      // world -> screen subtracts height from ground y (heightToScreenY = 1).
      assert.ok(Math.abs(offset.x - screen.x) < 1e-6 && Math.abs(offset.y - offset.z - screen.y) < 1e-6, `heading ${heading}`);
    }
  }
  assert.deepEqual(weaponModelToWorldOffset([1, 0, 0], { heading: 0, pixelsPerMetre: 10 }).x < 1e-9, true);
  assert.throws(() => weaponModelToWorldOffset([1, 0, 0], { heading: 0, pixelsPerMetre: 0 }));
});

test('seated on lit-commando, every gun keeps its grip on the socket and points along the native pistol bore in the aim pose', () => {
  const asset = hero('lit-commando'), calibration = manifest.heroFor('lit-commando');
  const pose = createActor3dPoseWorkspace(asset);
  evaluateActor3dPose(asset, 'aim', 0.5, pose);
  const socketWorld = pose.world[calibration.socketNodeIndex];
  const nativeMuzzle = weaponSocketToModel(socketWorld, calibration.nativePistolMuzzleSocket);
  const handHeight = socketWorld[13];
  assert.ok(handHeight > 0.6 && handHeight < 1.8, 'the socket is at hand height in the aim pose');
  for (const id of ACTOR3D_HERO_WEAPON_IDS) {
    const model = weapon(id);
    const attachment = createWeaponAttachment(asset, model, calibration);
    assert.equal(attachment.positions.length, model.vertexCount * 3);
    assert.equal(attachment.jointIndex, calibration.socketJointIndex);
    assert.ok(attachment.joints.every((j, i) => i % 4 === 0 ? j === calibration.socketJointIndex : j === 0));
    assert.ok(attachment.weights.every((w, i) => i % 4 === 0 ? w === 1 : w === 0));
    assert.equal(attachment.envelope.length, asset.skins[0].joints.length);
    assert.ok(attachment.envelope.every((e, j) => j === calibration.socketJointIndex ? Number.isFinite(e.min[0]) : e.min[0] === Infinity));
    // The grip origin lands on the socket anchor; the muzzle is lengthMetres-ish forward of it along the native bore.
    const grip = weaponSocketToModel(socketWorld, attachment.gripSocket), muzzle = weaponSocketToModel(socketWorld, attachment.muzzleSocket);
    const anchor = weaponSocketToModel(socketWorld, calibration.anchorInSocket);
    assert.ok(Math.hypot(grip[0] - anchor[0], grip[1] - anchor[1], grip[2] - anchor[2]) < 1e-5, `${id} grip on the anchor`);
    const bore = [nativeMuzzle[0] - anchor[0], nativeMuzzle[1] - anchor[1], nativeMuzzle[2] - anchor[2]];
    const reach = [muzzle[0] - anchor[0], muzzle[1] - anchor[1], muzzle[2] - anchor[2]];
    const cosine = (bore[0] * reach[0] + bore[1] * reach[1] + bore[2] * reach[2]) / (Math.hypot(...bore) * Math.hypot(...reach));
    assert.ok(cosine > 0.9, `${id} muzzle along the native bore (cos ${cosine.toFixed(3)})`);
    assert.ok(Math.hypot(...reach) > manifest.weaponFor(id).muzzle[0] * 0.9, `${id} muzzle reach`);
    // Pre-transformed vertices skinned by the socket palette reproduce the model-space geometry.
    const palette = evaluateActor3dPose(asset, 'aim', 0.5, pose)[0], at = calibration.socketJointIndex * 16;
    const i = 0, x = attachment.positions[i], y = attachment.positions[i + 1], z = attachment.positions[i + 2];
    const skinned = [palette[at] * x + palette[at + 4] * y + palette[at + 8] * z + palette[at + 12], palette[at + 1] * x + palette[at + 5] * y + palette[at + 9] * z + palette[at + 13], palette[at + 2] * x + palette[at + 6] * y + palette[at + 10] * z + palette[at + 14]];
    const g = gripFrameMatrix(calibration), v = glbToGrip([model.positions[0], model.positions[1], model.positions[2]]);
    const direct = weaponSocketToModel(socketWorld, [g[0] * v[0] + g[4] * v[1] + g[8] * v[2] + g[12], g[1] * v[0] + g[5] * v[1] + g[9] * v[2] + g[13], g[2] * v[0] + g[6] * v[1] + g[10] * v[2] + g[14]]);
    assert.ok(Math.hypot(skinned[0] - direct[0], skinned[1] - direct[1], skinned[2] - direct[2]) < 1e-4, `${id} palette agrees with the direct socket transform`);
  }
});

test('the presentation entries carry the weapon id for every gun and the projection freezes it', () => {
  const base = { actorId: 'lilly', x: 1, y: 2, z: 0, heading: 1, action: 'aim', actionTick: 3, moving: false, bodyHeight: 84, originals: [] };
  for (const weaponId of ACTOR3D_HERO_WEAPON_IDS) {
    const [entry] = createActor3dPresentationEntries({ ...base, weaponId }, []);
    assert.equal(entry.descriptor.weaponId, weaponId);
    const projection = createActor3dProjection(entry.descriptor, { x: 0, y: 0, zoom: 1, shakeX: 0, shakeY: 0 }, { width: 800, height: 600 });
    assert.equal(projection.weaponId, weaponId);
    assert.ok(Object.isFrozen(projection));
  }
  assert.equal(createActor3dPresentationEntries({ ...base, weaponId: 'not-a-gun' }, []).length, 0);
  assert.equal(createActor3dProjection({ id: 'x', actorId: 'y', x: 0, y: 0 }, { x: 0, y: 0, zoom: 1, shakeX: 0, shakeY: 0 }, { width: 8, height: 8 }).weaponId, null);
});
