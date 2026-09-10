import assert from 'node:assert/strict';
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(path.join(root, 'apps/hmh-reboot/assets/source/blender/hmh-enemy-roster.json'), 'utf8'));
const actor = manifest.actors.find((a) => a.actorId === 'bagholder-rusher');
const qaUrl = new URL('../scripts/hmh-enemy-source-qa.mjs', import.meta.url);

if (process.env.HMH_POINTER_ARCHIVE_CHILD !== '1') {
  test('no-Git pointer-only archive runs the actual native enemy child suite with zero skips', { concurrency: false }, async () => {
    const { spawnSync } = await import('node:child_process');
    const archive = mkdtempSync(path.join(tmpdir(), 'hmh-native-pointer-archive-'));
    try {
      cpSync(root, archive, {
        recursive: true,
        filter(source) {
          const relative = path.relative(root, source);
          if (relative === '') return true;
          if (['.git', '.tmp', 'node_modules'].includes(relative.split(path.sep)[0])) return false;
          return lstatSync(source).isDirectory() || /\.(?:js|json|mjs|py)$/.test(relative);
        },
      });
      assert.equal(existsSync(path.join(archive, '.git')), false, 'regression archive must not contain Git metadata');
      const source = actor.sourceModel;
      const sourcePath = path.join(archive, source.path);
      mkdirSync(path.dirname(sourcePath), { recursive: true });
      writeFileSync(sourcePath, `version https://git-lfs.github.com/spec/v1\noid sha256:${source.sourceSha256}\nsize ${source.sourceBytes}\n`);
      const env = { ...process.env, HMH_POINTER_ARCHIVE_CHILD: '1' };
      delete env.NODE_TEST_CONTEXT;
      const run = spawnSync(process.execPath, ['--test', '--test-reporter=tap', 'tests/hmh-native-enemy-source.test.mjs'], {
        cwd: archive, encoding: 'utf8', env,
      });
      const output = `${run.stdout}${run.stderr}`;
      assert.equal(run.status, 0, output);
      for (const expected of ['1..9', '# tests 9', '# pass 9', '# fail 0', '# cancelled 0', '# skipped 0', '# todo 0']) {
        assert.match(run.stdout, new RegExp(`(?:^|\\n)${expected.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}(?:\\r?\\n|$)`), output);
      }
    } finally {
      rmSync(archive, { recursive: true, force: true });
    }
  });
}

test('native enemy Python contracts participate in the normal Node test runner', async () => {
  const { spawnSync } = await import('node:child_process');
  const run = spawnSync('python', ['tests/hmh-native-enemy-pipeline.test.py'], {
    cwd: root, encoding: 'utf8', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
  });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stderr, /Ran 28 tests/);
  assert.match(run.stderr, /\nOK\s*$/);
  const syntax = readFileSync(path.join(root, 'scripts/syntax-check.mjs'), 'utf8');
  for (const file of ['scripts/hmh_native_enemy.py', 'scripts/hmh-enemy-source-qa.mjs', 'scripts/hmh-blender/export-hmh-native-enemy.py', 'scripts/hmh-blender/hmh_native_enemy_projection.py', 'scripts/hmh-blender/hmh_native_enemy_semantics.py', 'tests/hmh-native-enemy-pipeline.test.py', 'tests/hmh-native-enemy-source.test.mjs']) {
    assert.ok(syntax.includes(`"${file}"`), `${file} must be in the syntax/source allowlist`);
  }
});

test('native provenance document is validated even when its mutable hash is recomputed', async () => {
  const { createHash } = await import('node:crypto');
  const { validateNativeEnemySource } = await qa();
  const original = JSON.parse(readFileSync(path.join(root, actor.sourceModel.provenance.path)));
  for (const mutate of [
    p => { p.schemaVersion = 999; }, p => { p.actorId = 'forkrunner'; },
    p => { p.sourceKind = 'invented'; }, p => { p.sourceRebuilt = true; },
    p => { p.privatePacketOutputs['source.blend'].sha256 = '0'.repeat(64); },
    p => { p.privatePacketOutputs['source.blend'].bytes = 1; },
    p => { p.sourcePreservation.sha256 = '0'.repeat(64); },
    p => { p.nativeVerification.originalMeshTopologyUvMaterialImagesSkinRestBonesActionsPreserved = false; },
    p => { p.nativeVerification.originalPackedTexturePixelsDecoded = false; },
    p => { p.nativeVerification.actions.pop(); },
    p => { p.projectionAdditions.nativeActionsUnmodified = false; },
  ]) {
    const bad = structuredClone(original); mutate(bad);
    const bytes = Buffer.from(JSON.stringify(bad));
    const a = structuredClone(actor);
    a.sourceModel.provenance.sha256 = createHash('sha256').update(bytes).digest('hex');
    assert.throws(() => validateNativeEnemySource(a, root,
      p => p === path.join(root, a.sourceModel.provenance.path) ? bytes : readFileSync(p)));
  }
});

test('native source QA rejects a state-to-action permutation with the same action set', async () => {
  const { validateNativeEnemySource } = await qa();
  const bad = structuredClone(actor);
  [bad.clipActions.hit, bad.clipActions.tell] = [bad.clipActions.tell, bad.clipActions.hit];
  assert.throws(() => validateNativeEnemySource(bad, root), /state.*action|action.*binding/i);
});

test('native source QA rejects a rehashed proof with reduced semantic coverage', async () => {
  const { createHash } = await import('node:crypto');
  const { validateNativeEnemySource } = await qa();
  const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  const hashBytes = (value) => createHash('sha256').update(value).digest('hex');
  const proof = JSON.parse(readFileSync(path.join(root, actor.sourceModel.preservation.path)));
  const rig = actor.armature;
  for (const side of ['source', 'derivative']) {
    proof[side] = { objects: { [rig]: proof[side].objects[rig] }, materials: {}, images: {}, actions: {} };
  }
  proof.sourceSemanticsSha256 = digest(proof.source);
  proof.derivativeSemanticsSha256 = proof.sourceSemanticsSha256;
  const proofBytes = Buffer.from(JSON.stringify(proof));
  const bad = structuredClone(actor);
  bad.sourceModel.preservation.sha256 = hashBytes(proofBytes);
  const provenance = JSON.parse(readFileSync(path.join(root, actor.sourceModel.provenance.path)));
  provenance.sourcePreservation = bad.sourceModel.preservation;
  const provenanceBytes = Buffer.from(JSON.stringify(provenance));
  bad.sourceModel.provenance.sha256 = hashBytes(provenanceBytes);
  const reads = new Map([
    [path.join(root, bad.sourceModel.preservation.path), proofBytes],
    [path.join(root, bad.sourceModel.provenance.path), provenanceBytes],
  ]);
  assert.throws(() => validateNativeEnemySource(bad, root, (file) => reads.get(file) ?? readFileSync(file)),
    /semantic.*inventory|semantic.*digest/i);
});

test('new native provenance is portable while retaining historical lineage', () => {
  const provenance = readFileSync(path.join(root, actor.sourceModel.provenance.path), 'utf8');
  assert.doesNotMatch(provenance, /[A-Z]:[\\\\/]/i);
  const p = JSON.parse(provenance);
  assert.equal(p.privatePacketOutputs['source.blend'].sha256, actor.sourceModel.sourceSha256);
});

async function qa() {
  const { existsSync } = await import('node:fs');
  assert.ok(existsSync(qaUrl), 'owning enemy QA must validate source and artifact provenance');
  return import(qaUrl.href);
}

test('native source QA accepts real source and only its exact pointer through actual intake', async () => {
  const { validateNativeEnemySource } = await qa();
  assert.ok(['source-original', 'lfs-pointer'].includes(validateNativeEnemySource(actor, root).kind));
  const source = actor.sourceModel;
  const pointer = Buffer.from(`version https://git-lfs.github.com/spec/v1\noid sha256:${source.sourceSha256}\nsize ${source.sourceBytes}\n`);
  const read = (p) => p === path.join(root, source.path) ? pointer : readFileSync(p);
  assert.equal(validateNativeEnemySource(actor, root, read).kind, 'lfs-pointer');
  for (const bytes of [Buffer.from(pointer.toString().replace(source.sourceSha256, '0'.repeat(64))), Buffer.from(pointer.toString().replace(`size ${source.sourceBytes}`, 'size 1')), Buffer.concat([pointer, Buffer.from('extra\n')])]) {
    assert.throws(() => validateNativeEnemySource(actor, root, (p) => p === path.join(root, source.path) ? bytes : readFileSync(p)), /source|pointer|identity/i);
  }
});

test('native artifact QA rejects stale procedural metadata, validates generated candidate, and pins bounds', async () => {
  const { validateNativeEnemyArtifact } = await qa();
  const old = JSON.parse(readFileSync(path.join(root, 'apps/portal/assets/generated/hmh-reboot-enemy-roster/bagholder-rusher/bagholder-rusher-roster-atlas.json')));
  delete old.sourceModel;
  assert.throws(() => validateNativeEnemyArtifact(actor, old), /native|source|pose/i);
  const candidate = path.resolve(process.env.HMH_ENEMY_CANDIDATE_ROOT ?? path.join(root, 'apps/portal/assets/generated/hmh-reboot-enemy-roster'));
  const metadata = JSON.parse(readFileSync(path.join(candidate, 'bagholder-rusher/bagholder-rusher-roster-atlas.json')));
  assert.equal(validateNativeEnemyArtifact(actor, metadata).frameCount, 152);
  for (const mutate of [m => { m.poseAuthoring.module = 'fake-legacy-pose.py'; }, m => { m.sourceModel.sourceSha256 = '0'.repeat(64); }, m => { m.frames.pop(); }, m => { m.frames[0].fps = 99; }]) {
    const bad = structuredClone(metadata); mutate(bad);
    assert.throws(() => validateNativeEnemyArtifact(actor, bad));
  }
});

test('runtime native index rejects stale procedural and foreign native sources for lazy fallback', async () => {
  const { createEnemyRosterAtlasIndex } = await import('../apps/hmh-reboot/src/enemy-roster-atlas.mjs');
  const artifactRoot = path.resolve(process.env.HMH_ENEMY_CANDIDATE_ROOT ?? path.join(root, 'apps/portal/assets/generated/hmh-reboot-enemy-roster'));
  const metadata = JSON.parse(readFileSync(path.join(artifactRoot, 'bagholder-rusher/bagholder-rusher-roster-atlas.json')));
  for (const mutate of [m => { delete m.sourceModel; }, m => { m.sourceModel.sourceSha256 = '0'.repeat(64); }, m => { m.poseAuthoring.mode = 'procedural'; }]) {
    const bad = structuredClone(metadata); mutate(bad);
    assert.throws(() => createEnemyRosterAtlasIndex(bad, actor.actorId), /native source/);
  }
});

test('native QA policy distinguishes packed cold opens from procedural source rebuilds', async () => {
  const { validateEnemySourceModes } = await qa();
  const candidate = path.resolve(process.env.HMH_ENEMY_CANDIDATE_ROOT ?? path.join(root, 'apps/portal/assets/generated/hmh-reboot-enemy-roster'));
  const metrics = JSON.parse(readFileSync(path.join(candidate, 'hmh-enemy-roster-metrics.json')));
  validateEnemySourceModes(manifest, metrics);
  for (const mutate of [m => { m.reproducibilityPolicy.coldSceneRebuild = true; }, m => { m.nativeSource.observed.maxChangedVisiblePixels = 9; }, m => { m.reproducibilityPolicy.sourceModes.forkrunner = 'independent-native-cold-opens'; }]) {
    const bad = structuredClone(metrics); mutate(bad);
    assert.throws(() => validateEnemySourceModes(manifest, bad));
  }
});
