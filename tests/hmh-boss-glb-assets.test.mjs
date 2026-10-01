// Slice HMH-BOSSES-2-4 models: the three district boss runtime GLBs are
// source-bound, decoded by the actual runtime loader, inside the boss budget,
// carry all ten clips, have Blender re-import receipts with grounded feet, keep
// their editable sources out of Git with archive receipts, and register with
// the 3D controller by the boss modules' target ids.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { inspectActorGlb } from '../scripts/lib/hmh-actor-glb.mjs';
import { decodeActor3dGlb } from '../apps/hmh-reboot/src/actor-3d-model.mjs';
import { ACTOR3D_BOSS_CLIPS, ACTOR3D_BOSS_IDS, ACTOR3D_ENEMY_IDS, createActor3dPresentationEntries, createDistrictBoss3dEntries } from '../apps/hmh-reboot/src/actor-3d-controller.mjs';

const directory = new URL('../apps/portal/assets/generated/hmh-actor-3d-pilot/', import.meta.url);
const BOSSES = ['boss-rug-pull-baron', 'boss-51-foreman', 'boss-lockkeeper'];
const CLIPS = ['idle', 'run', 'tell', 'attack', 'attack-2', 'super-tell', 'super', 'hit', 'stagger', 'death'];

for (const id of BOSSES) {
  test(`${id}: runtime GLB matches its manifest, decodes in the runtime loader and fits the boss budget`, () => {
    const manifest = JSON.parse(readFileSync(new URL(`${id}-manifest.json`, directory)));
    assert.equal(manifest.classification, 'unapproved-runtime-boss-export');
    assert.equal(manifest.activeRuntimeIntegration, false);
    assert.equal(manifest.simulationAuthority, 'none');
    const actor = manifest.actors[id];
    const bytes = readFileSync(new URL(actor.file, directory));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), actor.sha256);
    assert.ok(bytes.length <= 8_500_000, `${bytes.length} bytes`);
    const inspected = inspectActorGlb(bytes, { requiredClips: CLIPS });
    assert.deepEqual(inspected, actor.inspection);
    assert.ok(inspected.triangles <= 30_000 && inspected.vertices <= 30_000);
    assert.equal(inspected.joints, 19);
    assert.deepEqual(inspected.clips.map((clip) => clip.name).sort(), [...CLIPS].sort());
    assert.ok(inspected.images.every((image) => image.format === 'png' && image.width <= 1024 && image.height <= 1024));
    const model = decodeActor3dGlb(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    assert.ok(model.primitives.length >= 1 && model.primitives.length <= 6);
    for (const clip of CLIPS) assert.ok(model.clips.has(clip), clip);
    assert.ok(actor.heroHeightRatio > 1 && actor.heroHeightRatio < 1.3, 'larger than the hero, still human scale');
    assert.match(actor.ownerSourceSha256, /^[0-9a-f]{64}$/);
  });

  test(`${id}: Blender re-import receipt is bound to the bytes and every clip keeps the feet grounded`, () => {
    const actor = JSON.parse(readFileSync(new URL(`${id}-manifest.json`, directory))).actors[id];
    const receipt = JSON.parse(readFileSync(new URL(`../docs/2.0/receipts/${id}-glb-reimport.json`, import.meta.url)));
    assert.equal(receipt.glbSha256, actor.sha256);
    assert.equal(receipt.verification, 'offline-Blender-reimport-not-runtime');
    assert.equal(receipt.cameraDegreesFromVertical, 55);
    assert.deepEqual(receipt.clips.map((clip) => clip.name).sort(), [...CLIPS].sort());
    for (const clip of receipt.clips) {
      assert.equal(clip.samples.length, 5);
      for (const sample of clip.samples) assert.ok(Math.abs(sample.nativeBodyMinimumZ) <= 0.002, `${clip.name} foot`);
    }
    assert.ok(receipt.maximumNativeFootResidualMetres <= 0.002);
  });

  test(`${id}: the editable source stays out of Git with source and archive receipts`, () => {
    const base = new URL(`../apps/hmh-reboot/assets/source/models/native-enemies/${id}/`, import.meta.url);
    const source = JSON.parse(readFileSync(new URL('source-receipt.json', base)));
    const archive = JSON.parse(readFileSync(new URL('archive-receipt.json', base)));
    const manifest = JSON.parse(readFileSync(new URL(`${id}-manifest.json`, directory))).actors[id];
    assert.equal(source.actorId, id);
    assert.equal(source.boss, true);
    assert.equal(source.bones, 19);
    assert.deepEqual(Object.keys(source.clipActions).sort(), [...CLIPS].sort());
    assert.equal(source.ownerSourceUnchanged, true);
    assert.equal(archive.sourceInGit, false);
    assert.equal(archive.archivedSha256, source.sourceSha256);
    assert.equal(manifest.sourceSha256, source.sourceSha256);
    assert.equal(existsSync(new URL(source.source, base)), false, 'no .blend beside the receipts');
    // Git-free: the repository ignores the editable source, so it can never be committed.
    const ignored = readFileSync(new URL('../.gitignore', import.meta.url), 'utf8');
    assert.ok(ignored.split(/\r?\n/).includes(`/apps/hmh-reboot/assets/source/models/native-enemies/${id}/*.blend`), `${id} .blend is gitignored`);
  });
}

test('the 3D controller registers the three bosses by the boss modules\' target ids, ahead of ordinary enemies', () => {
  assert.deepEqual([...ACTOR3D_BOSS_IDS], BOSSES);
  assert.deepEqual([...ACTOR3D_BOSS_CLIPS], CLIPS);
  for (const id of BOSSES) assert.equal(ACTOR3D_ENEMY_IDS.includes(id), false, 'bosses are not ordinary enemies');
  const pixi = readFileSync(new URL('../apps/hmh-reboot/src/actor-3d-pixi.mjs', import.meta.url), 'utf8');
  assert.match(pixi, /ACTOR3D_ENEMY_IDS\.includes\(id\) \|\| ACTOR3D_BOSS_IDS\.includes\(id\)/);
  const original = { renderable: true };
  const rows = BOSSES.map((actorId, index) => ({ id: actorId, actorId, active: true, visible: true, alpha: 1, x: 100 * index, y: 0, z: 0,
    pose: { state: CLIPS[index * 3], direction: 2, phaseTick: 90 }, originals: [original] }));
  const entries = createDistrictBoss3dEntries([...rows, { ...rows[0], actorId: 'not-a-boss' }, { ...rows[1], visible: false }, { ...rows[2], pose: { state: 'dance', direction: 2, tick: 1 } }], 40);
  assert.deepEqual(entries.map((entry) => entry.descriptor.id), ['boss:boss-51-foreman', 'boss:boss-lockkeeper', 'boss:boss-rug-pull-baron']);
  const baron = entries.find((entry) => entry.descriptor.actorId === 'boss-rug-pull-baron').descriptor;
  assert.equal(baron.clip, 'idle');
  assert.equal(baron.clipTimeSeconds, 0.5, 'loop clips wrap at one second');
  assert.equal(entries.find((entry) => entry.descriptor.actorId === 'boss-51-foreman').descriptor.clipTimeSeconds, 1, 'one-shot clips clamp');
  assert.equal(baron.heading, Math.PI / 2);
  const hero = { actorId: 'lit-commando', weaponId: 'coin-blaster', action: 'idle', actionTick: 0, x: 0, y: 0, z: 0, heading: 0, bodyHeight: 84, originals: [] };
  const enemy = { id: 'e1', actorId: 'tollkeeper', active: true, visible: true, alpha: 1, x: 5, y: 0, z: 0, pose: { state: 'run', direction: 0, tick: 3 }, originals: [] };
  const frame = createActor3dPresentationEntries(hero, [enemy], null, 8, hero, rows);
  assert.deepEqual(frame.map((entry) => entry.descriptor.id), ['hero', 'boss:boss-51-foreman', 'boss:boss-lockkeeper', 'boss:boss-rug-pull-baron', 'enemy:e1']);
  assert.deepEqual(createActor3dPresentationEntries(hero, [enemy], null, 8, hero).map((entry) => entry.descriptor.id), ['hero', 'enemy:e1'], 'no district bosses, unchanged frame');
  assert.equal(createActor3dPresentationEntries(hero, [enemy], null, 2, hero, rows).length, 2, 'the quality cap still holds');
});
