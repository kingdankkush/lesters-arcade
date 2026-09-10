import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { evaluateDeclaredSourcePayload } from './hmh-source-model-lfs-check.mjs';
import { createEnemyRosterAtlasIndex } from '../apps/hmh-reboot/src/enemy-roster-atlas.mjs';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const BUDGET = Object.freeze({ maxChangedVisiblePixels: 8, maxChannelDelta: 2, maxTotalChannelDelta: 32 });
const EXPECTED_SEMANTICS_SHA256 = 'a6239d7a9802ff72c0fcbb517309df2415bd04f219df344e34d397ef8f70901c';
const EXPECTED_RAW_DERIVATIVE_SEMANTICS_SHA256 = '18018cfcef79d617d0d2208d0950dc6834d2b77e8f72e14a33eec51ea51b6707';
const EXPECTED_SEMANTIC_COUNTS = Object.freeze({ objects: 3, materials: 5, images: 10, actions: 6 });

function validateSemanticProof(proof) {
  const categories = Object.keys(EXPECTED_SEMANTIC_COUNTS).sort();
  for (const side of ['source', 'derivative']) {
    const snapshot = proof?.[side];
    assert.deepEqual(Object.keys(snapshot ?? {}).sort(), categories, `native semantic inventory: ${side}`);
    for (const [category, count] of Object.entries(EXPECTED_SEMANTIC_COUNTS)) {
      assert.equal(Object.keys(snapshot[category] ?? {}).length, count, `native semantic inventory: ${side}/${category}`);
    }
    assert.equal(proof[`${side}SemanticsSha256`], EXPECTED_SEMANTICS_SHA256, `native semantic digest: ${side}`);
  }
  assert.equal(proof.rawDerivativeSemanticsSha256, EXPECTED_RAW_DERIVATIVE_SEMANTICS_SHA256,
    'native semantic digest: raw derivative');
  assert.equal(proof.match, true, 'native semantic match');
  assert.equal(proof.savedReopened, true, 'native semantic saved/reopened proof');
  assert.equal(proof.inputHashesUnchanged, true, 'native semantic input hashes');
  assert.deepEqual(proof.differences, [], 'native semantic differences');
}

export function validateNativeEnemySource(actor, root, read = readFileSync) {
  assert.equal(actor.actorId, 'bagholder-rusher', 'native source actor');
  const source = actor.sourceModel;
  assert.equal(source?.kind, 'packed-native-enemy-blend', 'native source kind');
  assert.equal(source.path, 'apps/hmh-reboot/assets/source/models/native-enemies/bagholder-rusher/bagholder-rusher-packed.blend', 'native source-only path');
  assert.equal(source.sourceSha256, 'd71630544fb236ad3a165a3e9d3e3f7aa2f5bbd254311b6d8f9c7a1f92b85856', 'immutable native source identity');
  const result = evaluateDeclaredSourcePayload(read(path.join(root, source.path)), source);
  assert.deepEqual(result.problems, [], 'native source or exact source-only pointer identity');
  for (const item of [source.provenance, source.preservation]) {
    assert.ok(item.path.startsWith('apps/hmh-reboot/assets/source/models/native-enemies/bagholder-rusher/') && !item.path.includes('..'), 'native proof path');
    assert.equal(sha(read(path.join(root, item.path))), item.sha256, 'native source proof hash');
  }
  const provenanceBytes = read(path.join(root, source.provenance.path));
  const provenance = JSON.parse(provenanceBytes);
  assert.equal(provenance.schemaVersion, 1, 'native provenance schema');
  assert.equal(provenance.actorId, actor.actorId, 'native provenance actor');
  assert.equal(provenance.sourceKind, 'immutable-packed-native-derivative', 'native provenance kind');
  assert.equal(provenance.sourceRebuilt, false, 'native source is not rebuilt');
  const original = provenance.privatePacketOutputs?.['source.blend'];
  assert.equal(original?.sha256, source.sourceSha256, 'native provenance source identity');
  assert.equal(original?.bytes, source.sourceBytes, 'native provenance source size');
  assert.deepEqual(provenance.sourcePreservation, source.preservation, 'native preservation binding');
  const verification = provenance.nativeVerification;
  assert.equal(verification?.originalMeshTopologyUvMaterialImagesSkinRestBonesActionsPreserved, true, 'native semantic preservation claim');
  assert.equal(verification?.originalPackedTexturePixelsDecoded, true, 'native packed pixels claim');
  assert.deepEqual(verification?.actions, Object.values(actor.clipActions).sort(), 'native preserved actions');
  assert.equal(verification?.framesComparedSourceDerivative, 152, 'native original pose preservation coverage');
  assert.equal(provenance.projectionAdditions?.nativeActionsUnmodified, true, 'native actions preserved');
  assert.doesNotMatch(provenanceBytes.toString(), /[A-Z]:[\\/]/i, 'native provenance must be portable');
  const proof = JSON.parse(read(path.join(root, source.preservation.path)));
  validateSemanticProof(proof);
  const actionBindings = Object.fromEntries(Object.entries(proof.source.actions).map(([actionName, record]) => [
    record?.properties?.hmh_state, actionName,
  ]));
  assert.deepEqual(actor.clipActions, actionBindings, 'native state-to-action binding');
  return result;
}

export function validateNativeEnemyArtifact(actor, metadata) {
  assert.equal(actor.actorId, 'bagholder-rusher');
  assert.deepEqual(metadata.sourceModel, actor.sourceModel, 'native source provenance is stale');
  assert.deepEqual(metadata.poseAuthoring, actor.poseAuthoring, 'native pose provenance is stale');
  assert.equal(metadata.poseAuthoring.mode, 'preserved-native-actions');
  assert.deepEqual(metadata.poseAuthoring.sourceFrameSamples, { hit: [12, 25] }, 'native measured hit peak/recovery');
  assert.equal('module' in metadata.poseAuthoring, false, 'native poses must not claim procedural module provenance');
  assert.deepEqual(metadata.animationProfile, actor.animationProfile);
  const index = createEnemyRosterAtlasIndex(metadata, actor.actorId);
  assert.equal(index.frameCount, 152, 'native source requires every frame ID');
  for (const [state, count, fps] of [['idle', 2, 3], ['run', 6, 12], ['tell', 2, 6], ['attack', 3, 14], ['hit', 2, 12], ['death', 4, 10]]) {
    for (const direction of index.directions) {
      assert.equal(index.frameCountFor(state, direction), count);
      assert.equal(index.fpsFor(state, direction), fps);
      for (let n = 0; n < count; n += 1) {
        const f = index.frameFor(state, direction, n);
        assert.equal(f.id, `bagholder-rusher__body__${state}__${direction}__${String(n).padStart(3, '0')}`);
        assert.ok(f.frame.x >= 0 && f.frame.y >= 0 && f.frame.w > 0 && f.frame.h > 0 && f.frame.x + f.frame.w <= 2048 && f.frame.y + f.frame.h <= 2048);
      }
    }
  }
  assert.equal(new Set(metadata.frames.map((f) => f.sourcePixelSha256)).size, 152);
  return index;
}

export function validateEnemySourceModes(manifest, metrics) {
  const nativeActors = manifest.actors.filter((a) => a.sourceModel?.kind === 'packed-native-enemy-blend');
  if (!nativeActors.length) {
    assert.equal(metrics.reproducibilityPolicy.coldSceneRebuild, true);
    return;
  }
  assert.deepEqual(nativeActors.map((a) => a.actorId), ['bagholder-rusher']);
  const policy = metrics.reproducibilityPolicy;
  assert.equal(policy.coldSceneRebuild, false, 'native cold opens are not source rebuilds');
  assert.deepEqual(policy.budget, BUDGET);
  assert.deepEqual(policy.sourceModes, Object.fromEntries(manifest.actors.map((a) => [a.actorId, a.actorId === 'bagholder-rusher' ? 'independent-native-cold-opens' : 'cold-procedural-scene-rebuild'])));
  const native = metrics.nativeSource;
  assert.equal(native.actorId, 'bagholder-rusher');
  assert.deepEqual(native.sourceModel, nativeActors[0].sourceModel);
  assert.equal(native.metadataExactExceptDerivedPixelSha, true);
  for (const [key, limit] of Object.entries(BUDGET)) assert.ok(Number.isInteger(native.observed[key]) && native.observed[key] >= 0 && native.observed[key] <= limit, `native ${key} bound`);
}
