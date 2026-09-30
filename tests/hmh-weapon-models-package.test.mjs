// Weapon model package gate (2.0 weapons lane): every packaged GLB exists,
// matches its recorded hash and budgets, decodes through the bounded runtime
// reader with the recorded triangle count and muzzle, and the per-hero grip
// frames agree with the shipped held-weapon calibration and the runtime hero
// GLBs (which this package never modifies).
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import test from 'node:test';
import {
  WEAPON_MODEL_BUDGETS, WEAPON_MODEL_IDS, WEAPON_MODEL_HERO_IDS, WEAPON_MODEL_GUN_IDS,
  validateWeaponModelManifest, decodeWeaponGlb, gripFrameMatrix, weaponModelUrl,
} from '../apps/hmh-reboot/src/weapon-model.mjs';
import { decodeActor3dGlb } from '../apps/hmh-reboot/src/actor-3d-model.mjs';

const root = new URL('../', import.meta.url);
const packageDir = new URL('apps/portal/assets/generated/hmh-weapon-models/', root);
const receiptsDir = new URL('docs/2.0/receipts/hmh-weapon-models-20260930/', root);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const manifest = JSON.parse(readFileSync(new URL('manifest.json', packageDir), 'utf8'));
const bufferOf = bytes => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

test('the manifest validates as a projection-only candidate package with the ten cast weapons', () => {
  const index = validateWeaponModelManifest(manifest);
  assert.equal(index.pipelineId, 'hmh-weapon-models/v1');
  assert.equal(manifest.artAccepted, false);
  assert.equal(manifest.canonicalAdoption, false);
  assert.deepEqual([...index.weaponIds], [...WEAPON_MODEL_IDS]);
  assert.equal(WEAPON_MODEL_GUN_IDS.length, 8);
  for (const id of WEAPON_MODEL_IDS) assert.equal(index.weaponFor(id).file, `${id}.glb`);
  // Honest casting: the flamethrower and the war fork have no owner model.
  assert.deepEqual(WEAPON_MODEL_IDS.filter(id => index.weaponFor(id).standIn), ['bear-market-burner', 'forked-standard']);
  assert.equal(weaponModelUrl('manifest.json'), '/assets/generated/hmh-weapon-models/manifest.json');
  assert.throws(() => weaponModelUrl('../escape.glb'));
  assert.throws(() => validateWeaponModelManifest({ ...manifest, runtimeAuthority: 'simulation' }));
  assert.throws(() => validateWeaponModelManifest({ ...manifest, budgets: { ...manifest.budgets, maxBytes: 1 << 20 } }));
});

test('every packaged GLB exists, hashes and fits the byte, triangle and texture budgets through the runtime reader', () => {
  let total = 0;
  for (const id of WEAPON_MODEL_IDS) {
    const entry = manifest.weapons[id];
    const file = new URL(entry.file, packageDir);
    assert.ok(existsSync(file), `${entry.file} exists`);
    const bytes = readFileSync(file);
    assert.equal(bytes.length, entry.bytes);
    assert.equal(statSync(file).size, entry.bytes);
    assert.ok(entry.bytes <= WEAPON_MODEL_BUDGETS.maxBytes, `${id} within ${WEAPON_MODEL_BUDGETS.maxBytes} bytes`);
    assert.equal(sha256(bytes), entry.sha256);
    const model = decodeWeaponGlb(bufferOf(bytes));
    assert.equal(model.triangleCount, entry.triangles);
    assert.ok(model.triangleCount <= WEAPON_MODEL_BUDGETS.maxTriangles);
    assert.equal(model.vertexCount, entry.vertices);
    assert.equal(model.image.width, entry.texture.width);
    assert.equal(model.image.height, entry.texture.height);
    assert.ok(Math.max(model.image.width, model.image.height) <= WEAPON_MODEL_BUDGETS.maxTextureSize);
    assert.equal(model.image.mimeType, entry.texture.mimeType);
    for (let axis = 0; axis < 3; axis++) assert.ok(Math.abs(model.muzzle[axis] - entry.muzzle[axis]) < 1e-5, `${id} muzzle axis ${axis}`);
    assert.deepEqual([...model.grip], [0, 0, 0]);
    assert.equal(model.weaponId, id);
    // The muzzle is the front of the model: no GLB vertex reaches further forward in the grip frame.
    let front = -Infinity;
    for (let i = 0; i < model.vertexCount; i++) front = Math.max(front, model.positions[i * 3]);
    assert.ok(front <= entry.muzzle[0] + entry.lengthMetres * 0.03, `${id} muzzle at the front (${front} vs ${entry.muzzle[0]})`);
    total += entry.bytes;
    assert.equal(sha256(bytes), entry.sha256, 'decoding never mutates the bytes');
  }
  const summary = JSON.parse(readFileSync(new URL('pack-summary.json', receiptsDir), 'utf8'));
  assert.equal(summary.totalBytes, total);
  assert.equal(summary.manifestSha256, sha256(readFileSync(new URL('manifest.json', packageDir))));
  assert.equal(summary.contactSheetSha256, sha256(readFileSync(new URL('hmh-weapon-models-contact-sheet.png', receiptsDir))));
});

test('source provenance records the owner GLB hashes and the reader refuses tampered or oversized files', () => {
  for (const id of WEAPON_MODEL_IDS) {
    const source = manifest.weapons[id].source;
    assert.match(source.sha256, /^[a-f0-9]{64}$/);
    assert.ok(source.triangles > 400_000, 'owner sculpts are high-poly sources');
    assert.match(source.file, /\.glb$/);
  }
  const bytes = readFileSync(new URL('coin-blaster.glb', packageDir));
  const tampered = new Uint8Array(bufferOf(bytes)); tampered[8] ^= 1;
  assert.throws(() => decodeWeaponGlb(tampered.buffer), /GLB/);
  assert.throws(() => decodeWeaponGlb(new ArrayBuffer(WEAPON_MODEL_BUDGETS.maxBytes + 4)), /bounded/);
});

test('hero grip frames are orthonormal, sit inside the native pistol and name the joint the runtime heroes really carry', () => {
  const held = actor => JSON.parse(readFileSync(new URL(`apps/portal/assets/generated/hmh-held-weapons/${actor}/${actor}-held-weapons.json`, root), 'utf8'));
  for (const actor of WEAPON_MODEL_HERO_IDS) {
    const hero = manifest.heroes[actor];
    const heroBytes = readFileSync(new URL(`apps/portal/assets/generated/hmh-actor-3d-pilot/${actor}.glb`, root));
    assert.equal(sha256(heroBytes), hero.sha256, `${actor} hero GLB is the one the package was calibrated against`);
    const asset = decodeActor3dGlb(bufferOf(heroBytes));
    assert.equal(asset.nodes[hero.socketNodeIndex].name, 'pistol_prop');
    assert.equal(asset.skins[0].joints[hero.socketJointIndex], hero.socketNodeIndex);
    const calibration = held(actor);
    assert.equal(sha256(readFileSync(new URL(hero.heldWeaponManifest, root))), hero.heldWeaponManifestSha256);
    assert.deepEqual(hero.axesInSocket, calibration.pistolFrame.axesInSocket);
    assert.deepEqual(hero.anchorInSocket, calibration.pistolFrame.anchorInSocket);
    assert.ok(hero.runtimePistolAxisDeviationDegrees < 15);
    const m = gripFrameMatrix(hero);
    assert.equal(m.length, 16);
    assert.ok(Math.abs(m[15] - 1) < 1e-9);
    // The native pistol's muzzle in socket space is the grip-frame muzzle carried through the axes.
    const [f, l, u] = [hero.axesInSocket.forward, hero.axesInSocket.left, hero.axesInSocket.up], [mx, my, mz] = hero.nativePistolMuzzle;
    for (let axis = 0; axis < 3; axis++) {
      assert.ok(Math.abs(f[axis] * mx + l[axis] * my + u[axis] * mz + hero.anchorInSocket[axis] - hero.nativePistolMuzzleSocket[axis]) < 1e-5);
    }
  }
});
