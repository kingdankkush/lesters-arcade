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
