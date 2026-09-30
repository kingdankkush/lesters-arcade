import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { inspectActorGlb } from '../scripts/lib/hmh-actor-glb.mjs';
const directory = new URL('../apps/portal/assets/generated/hmh-actor-3d-pilot/', import.meta.url);
const manifest = (() => { try { return JSON.parse(readFileSync(new URL('manifest.json', directory))); } catch { return {}; } })();

test('the optional GLB pilot assets are source-bound, embedded, weighted and genuinely animated', () => {
  assert.equal(manifest.classification, 'unapproved-runtime-character-pilot');
  assert.equal(manifest.activeRuntimeIntegration, false);
  assert.equal(manifest.cameraDegreesFromVertical, 55);
  assert.deepEqual(Object.keys(manifest.actors).sort(), ['bagholder-rusher', 'lit-commando', 'the-liquidator']);
  for (const [actorId, actor] of Object.entries(manifest.actors)) {
    const bytes = readFileSync(new URL(actor.file, directory));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), actor.sha256);
    const inspected = inspectActorGlb(bytes, { requiredClips: actor.requiredClips });
    assert.deepEqual(inspected, actor.inspection, actorId);
    assert.equal(inspected.joints, actorId === 'lit-commando' ? 22 : 19);
    assert.equal(inspected.clips.length, actorId === 'lit-commando' ? 9 : 6);
    assert.ok(inspected.images.every(image => image.width <= 1024 && image.height <= 1024));
    assert.match(actor.sourceSha256, /^[0-9a-f]{64}$/);
  }
});

test('offline imported poses match asset digests and preserve native foot grounding', () => {
  assert.ok(manifest.actors);
  for (const [actorId, actor] of Object.entries(manifest.actors)) {
    const receipt = JSON.parse(readFileSync(new URL(`../docs/2.0/receipts/${actorId}-glb-reimport.json`, import.meta.url)));
    assert.equal(receipt.glbSha256, actor.sha256);
    if (actorId === 'the-liquidator') {
      assert.equal(receipt.completed,true);assert.equal(receipt.poses.length,30);
      assert.deepEqual(receipt.poses.map(p=>p.id).sort(),actor.requiredClips.flatMap(c=>[0,.25,.5,.75,1].map(f=>c+'-'+f)).sort());
      for(const pose of receipt.poses){assert.ok(pose.maximumSymmetricVertexDistanceMetres<=.0005);assert.ok(pose.footDifferenceMetres<=.0002);}
      continue;
    }
    assert.equal(receipt.verification, 'offline-Blender-reimport-not-runtime');
    assert.equal(receipt.cameraDegreesFromVertical, 55);
    assert.deepEqual(receipt.clips.map(clip => clip.name).sort(), [...actor.requiredClips].sort());
    if (actorId === 'bagholder-rusher') for (const clip of receipt.clips) {
      assert.ok(Math.abs(clip.minimumWorldZ) < 0.0002);
      assert.ok(Math.abs(clip.maximumMinimumWorldZ) < 0.0002);
    }
  }
});

for (const [actorId,joints,sourceSha256] of [
  ['lilly',24,'5f9152e713f7c4f79e96d1f1a4415dd1fb96a2685d3d14f22a65e895c8e7d6b2'],
  ['lit-valkyrie',22,'f090f2e2a387f8ee3c2666bed1af22344f6ec82b1695bc62f1d18f1cfb8268ec'],
  ['lester-original',22,'ed1278ea131927f9849fb62f265512a8547186fb9b9c06b08da78fb438eacc96'],
]) test(`${actorId} retains its source identity, rig and all nine native clips within the shared model limits`, () => {
  const lilly=JSON.parse(readFileSync(new URL(`${actorId}-manifest.json`,directory))).actors[actorId];
  const bytes=readFileSync(new URL(lilly.file,directory));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),lilly.sha256);
  assert.equal(lilly.sourceSha256,sourceSha256);
  const actual=inspectActorGlb(bytes,{requiredClips:lilly.requiredClips});assert.deepEqual(actual,lilly.inspection);
  assert.equal(actual.joints,joints);assert.equal(actual.clips.length,9);assert.ok(actual.triangles<=30000&&actual.vertices<=30000&&actual.bytes<=8*1024*1024);
  assert.ok(actual.images.every(image=>image.width<=1024&&image.height<=1024));
  const receipt=JSON.parse(readFileSync(new URL(`../docs/2.0/receipts/${actorId}-glb-reimport.json`,import.meta.url)));
  assert.equal(receipt.glbSha256,lilly.sha256);assert.equal(receipt.clips.length,9);assert.ok(receipt.clips.every(clip=>clip.samples.length===5));
});
