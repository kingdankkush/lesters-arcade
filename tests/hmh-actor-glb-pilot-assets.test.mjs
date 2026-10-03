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
    // The Commando carries the nine native clips plus the authored clip library.
    assert.equal(inspected.clips.length, actorId === 'lit-commando' ? 9 + actor.clipLibrary.libraryClips : actorId === 'bagholder-rusher' ? 7 : 6);
    if(actorId === 'bagholder-rusher')assert.deepEqual(actor.deathVariants.clips,['death','death-side']);
    if (actorId === 'lit-commando') assert.equal(actor.clipLibrary.libraryClips, 71);
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
    if (actorId === 'lit-commando') {
      assert.ok(receipt.clips.filter(clip => !clip.library).every(clip => clip.samples.length === 5));
      assert.ok(receipt.clips.filter(clip => clip.library).every(clip => clip.samples.length === 3));
      assert.equal(receipt.clips.filter(clip => clip.library).length, actor.clipLibrary.libraryClips);
    }
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
]) test(`${actorId} retains its source identity, rig, all nine native clips and the authored library within the shared model limits`, () => {
  const lilly=JSON.parse(readFileSync(new URL(`${actorId}-manifest.json`,directory))).actors[actorId];
  const bytes=readFileSync(new URL(lilly.file,directory));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),lilly.sha256);
  assert.equal(lilly.sourceSha256,sourceSha256);
  const actual=inspectActorGlb(bytes,{requiredClips:lilly.requiredClips});assert.deepEqual(actual,lilly.inspection);
  // Library clips (tests/hmh-hero-clip-library.test.mjs) add animation bytes; the hero cap moved from 8 MiB to 9,000,000 B.
  assert.equal(lilly.clipLibrary.libraryClips,71);assert.equal(lilly.requiredClips.length,9+71);
  assert.equal(actual.joints,joints);assert.equal(actual.clips.length,9+71);assert.ok(actual.triangles<=30000&&actual.vertices<=30000&&actual.bytes<=9_000_000);
  assert.ok(actual.images.every(image=>image.width<=1024&&image.height<=1024));
  const receipt=JSON.parse(readFileSync(new URL(`../docs/2.0/receipts/${actorId}-glb-reimport.json`,import.meta.url)));
  assert.equal(receipt.glbSha256,lilly.sha256);assert.equal(receipt.clips.length,9+71);
  assert.ok(receipt.clips.filter(clip=>!clip.library).every(clip=>clip.samples.length===5));
  assert.ok(receipt.clips.filter(clip=>clip.library).every(clip=>clip.samples.length===3));
});

for(const [actorId,joints,sourceSha256] of [["forkrunner", 24, "a3f56a810c4dde961c9b7d7391bd95d89603a765636a98e522395c5ba6f9dc67"], ["liquidator-agent", 22, "6a9ac0ba9ae273be91a08cc0f717b0b3190b169b53362075eb8081ac8e0645a6"], ["whale-enforcer", 19, "9e2ded2b63c852e46ea3b49349ca48f8e7fe1eb73804438ea5b306a737fefe50"], ["gas-bomber", 19, "620289a19cb8e5a025b2c614b90bc938e8db55e846924a92e41e7c679366c6f4"], ["validator-cultist", 19, "202e9ff2487d989655ee3c132e19e8d828f0522bcdadab8e87387c6259658efc"]]) test(`${actorId} keeps native source identity, six actions and bounded packed geometry`,()=>{
  const actor=JSON.parse(readFileSync(new URL(`${actorId}-manifest.json`,directory))).actors[actorId];
  const bytes=readFileSync(new URL(actor.file,directory));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),actor.sha256);assert.equal(actor.sourceSha256,sourceSha256);
  const actual=inspectActorGlb(bytes,{requiredClips:actor.requiredClips});assert.deepEqual(actual,actor.inspection);
  assert.equal(actual.joints,joints);assert.equal(actual.clips.length,6);assert.ok(actual.triangles<=30000&&actual.vertices<=30000&&actual.bytes<=8*1024*1024);
  assert.ok(actual.images.every(image=>image.width<=1024&&image.height<=1024));
  const receipt=JSON.parse(readFileSync(new URL(`../docs/2.0/receipts/${actorId}-glb-reimport.json`,import.meta.url)));
  assert.equal(receipt.glbSha256,actor.sha256);assert.equal(receipt.clips.length,6);assert.ok(receipt.clips.every(clip=>clip.samples.length===5));
});

// 2.0 enemies: source identity comes from each committed source receipt (the
// editable .blend itself lives in the source-art archive, not Git).
for (const actorId of ['rug-puller', 'pump-and-dump-bloater', 'tollkeeper', 'hodl-revenant', 'money-printer', 'oracle-marksman']) test(`${actorId} keeps its archived source identity, six actions and bounded packed geometry`, () => {
  const source = JSON.parse(readFileSync(new URL(`../apps/hmh-reboot/assets/source/models/native-enemies/${actorId}/source-receipt.json`, import.meta.url)));
  assert.equal(source.actorId, actorId); assert.equal(source.runtimeAuthority, 'projection-only'); assert.equal(source.bones, 19);
  assert.match(source.baseSha256, /^[0-9a-f]{64}$/); assert.equal(['human', 'zombie'].includes(source.identityForm), true);
  const actor = JSON.parse(readFileSync(new URL(`${actorId}-manifest.json`, directory))).actors[actorId];
  const bytes = readFileSync(new URL(actor.file, directory));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), actor.sha256); assert.equal(actor.sourceSha256, source.sourceSha256);
  const actual = inspectActorGlb(bytes, { requiredClips: actor.requiredClips }); assert.deepEqual(actual, actor.inspection);
  assert.equal(actual.joints, 19); assert.equal(actual.clips.length, 6);
  assert.ok(actual.triangles <= 25000 && actual.vertices <= 30000 && actual.bytes <= 6.5 * 1024 * 1024, `${actorId} ${actual.triangles} tri ${actual.bytes} B`);
  assert.ok(actual.images.every(image => image.width <= 1024 && image.height <= 1024));
  const receipt = JSON.parse(readFileSync(new URL(`../docs/2.0/receipts/${actorId}-glb-reimport.json`, import.meta.url)));
  assert.equal(receipt.glbSha256, actor.sha256); assert.equal(receipt.clips.length, 6); assert.ok(receipt.clips.every(clip => clip.samples.length === 5));
  assert.deepEqual(receipt.clips.map(clip => clip.name).sort(), [...actor.requiredClips].sort());
});
