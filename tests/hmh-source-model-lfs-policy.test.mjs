import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  LFS_MODEL_EXTENSIONS,
  LFS_MODEL_RULES,
  LFS_POINTER_FIRST_LINE,
  MAX_TEXTURE_DIMENSION,
  SOURCE_MODEL_MAX_BYTES,
  SOURCE_MODEL_ROOT,
  evaluateSourceModelFile,
  isLfsPointer,
  missingLfsRules,
  readPngDimensions,
  runOfflineCheck,
} from '../scripts/hmh-source-model-lfs-check.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readRepo = (relative) => readFileSync(path.join(root, relative), 'utf8');

const EXPECTED_RULES = [
  'apps/hmh-reboot/assets/source/models/**/*.glb filter=lfs diff=lfs merge=lfs -text',
  'apps/hmh-reboot/assets/source/models/**/*.fbx filter=lfs diff=lfs merge=lfs -text',
  'apps/hmh-reboot/assets/source/models/**/*.bin filter=lfs diff=lfs merge=lfs -text',
  'apps/hmh-reboot/assets/source/models/**/*.png filter=lfs diff=lfs merge=lfs -text',
  'apps/hmh-reboot/assets/source/models/**/*.jpg filter=lfs diff=lfs merge=lfs -text',
  'apps/hmh-reboot/assets/source/models/**/*.jpeg filter=lfs diff=lfs merge=lfs -text',
];

function gitAvailable() {
  const probe = spawnSync('git', ['--version'], { cwd: root, encoding: 'utf8' });
  return probe.status === 0;
}

function gitLfsAvailable() {
  const probe = spawnSync('git', ['lfs', 'version'], { cwd: root, encoding: 'utf8' });
  return probe.status === 0;
}

test('P-5 the six source-model LFS rules are written into .gitattributes verbatim', () => {
  assert.deepEqual([...LFS_MODEL_RULES], EXPECTED_RULES);
  assert.deepEqual([...LFS_MODEL_EXTENSIONS], ['glb', 'fbx', 'bin', 'png', 'jpg', 'jpeg']);
  assert.equal(SOURCE_MODEL_ROOT, 'apps/hmh-reboot/assets/source/models');
  const gitattributes = readRepo('.gitattributes');
  const lines = gitattributes.split(/\r?\n/);
  for (const rule of EXPECTED_RULES) {
    assert.ok(lines.includes(rule), `.gitattributes is missing the exact line: ${rule}`);
  }
  assert.deepEqual(missingLfsRules(gitattributes), []);
  assert.deepEqual(missingLfsRules('* text=auto eol=lf\n*.png binary\n'), EXPECTED_RULES);
  // The generic `*.png binary` macro at the top of the file must not win over
  // the LFS rule for model textures: gitattributes resolves later lines last.
  const pngMacro = lines.indexOf('*.png binary');
  const pngRule = lines.indexOf(EXPECTED_RULES[3]);
  assert.ok(pngMacro >= 0 && pngRule > pngMacro, 'the LFS png rule must come after the binary macro so it overrides it');
});

test('P-5 git check-attr resolves filter=lfs for a probe path under every model extension', (t) => {
  if (!gitAvailable()) {
    t.skip('git is not available on this host; the check-attr proof cannot run');
    return;
  }
  for (const extension of LFS_MODEL_EXTENSIONS) {
    const probe = `${SOURCE_MODEL_ROOT}/probe/probe.${extension}`;
    const result = spawnSync('git', ['check-attr', 'filter', 'diff', 'merge', 'text', '--', probe], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, `git check-attr failed for ${probe}: ${result.stderr}`);
    assert.match(result.stdout, /: filter: lfs/, `${probe} does not resolve filter=lfs:\n${result.stdout}`);
    assert.match(result.stdout, /: diff: lfs/, `${probe} does not resolve diff=lfs`);
    assert.match(result.stdout, /: merge: lfs/, `${probe} does not resolve merge=lfs`);
    assert.match(result.stdout, /: text: unset/, `${probe} must be -text so Git never autodetects a binary as text`);
  }
  // A file outside the models root keeps the repository's existing behaviour.
  const outside = spawnSync('git', ['check-attr', 'filter', '--', 'apps/hmh-reboot/assets/source/blender/probe.png'], { cwd: root, encoding: 'utf8' });
  assert.match(outside.stdout, /: filter: unspecified/, 'the LFS rule leaked outside the models root');
});

test('P-5 pointer detection, the per-file cap and the texture cap are pure and exact', () => {
  assert.equal(LFS_POINTER_FIRST_LINE, 'version https://git-lfs.github.com/spec/v1');
  assert.equal(isLfsPointer(Buffer.from('version https://git-lfs.github.com/spec/v1\noid sha256:0123\nsize 42\n')), true);
  assert.equal(isLfsPointer(Buffer.from([0x67, 0x6c, 0x54, 0x46, 0x02, 0x00, 0x00, 0x00, 0x2a, 0x00, 0x00, 0x00])), false);
  assert.equal(isLfsPointer(Buffer.alloc(0)), false);

  assert.equal(SOURCE_MODEL_MAX_BYTES, 40 * 1024 * 1024);
  assert.equal(SOURCE_MODEL_MAX_BYTES, 41_943_040);
  assert.equal(MAX_TEXTURE_DIMENSION, 2048);

  const atCap = evaluateSourceModelFile({ path: `${SOURCE_MODEL_ROOT}/lester.glb`, sizeBytes: SOURCE_MODEL_MAX_BYTES });
  assert.deepEqual(atCap.problems, []);
  const overCap = evaluateSourceModelFile({ path: `${SOURCE_MODEL_ROOT}/lester.glb`, sizeBytes: SOURCE_MODEL_MAX_BYTES + 1 });
  assert.equal(overCap.problems.length, 1);
  assert.match(overCap.problems[0], /40 MB/);
  assert.match(overCap.problems[0], /41,943,041/);

  // PNG IHDR: 8-byte signature, 4-byte length, 'IHDR', then width and height
  // as big-endian uint32 at byte offsets 16 and 20.
  const png = (width, height) => {
    const bytes = Buffer.alloc(33, 0);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes, 0);
    bytes.writeUInt32BE(13, 8);
    bytes.write('IHDR', 12, 'ascii');
    bytes.writeUInt32BE(width, 16);
    bytes.writeUInt32BE(height, 20);
    return bytes;
  };
  assert.deepEqual(readPngDimensions(png(2048, 1024)), { width: 2048, height: 1024 });
  assert.equal(readPngDimensions(Buffer.from('not a png at all, just text')), null);
  const okTexture = evaluateSourceModelFile({ path: `${SOURCE_MODEL_ROOT}/lester/albedo.png`, sizeBytes: 1024, pngDimensions: readPngDimensions(png(2048, 2048)) });
  assert.deepEqual(okTexture.problems, []);
  const tooLarge = evaluateSourceModelFile({ path: `${SOURCE_MODEL_ROOT}/lester/albedo.png`, sizeBytes: 1024, pngDimensions: readPngDimensions(png(2049, 16)) });
  assert.equal(tooLarge.problems.length, 1);
  assert.match(tooLarge.problems[0], /2049x16/);
  assert.match(tooLarge.problems[0], /2048/);
});

test('P-5 the offline checker passes honestly on a repository with zero tracked models', async (t) => {
  if (!gitAvailable()) {
    t.skip('git is not available on this host; the offline checker cannot run');
    return;
  }
  const report = await runOfflineCheck({ root });
  assert.equal(report.ok, true, JSON.stringify(report, null, 2));
  assert.deepEqual(report.missingRules, []);
  assert.equal(report.checkAttr.every((entry) => entry.filter === 'lfs'), true, JSON.stringify(report.checkAttr));
  assert.equal(typeof report.trackedModels, 'number');
  assert.equal(report.lfsAvailable, gitLfsAvailable());
  if (!report.lfsAvailable) assert.match(report.notes.join('\n'), /git-lfs/i);
  for (const model of report.models) {
    assert.equal(model.problems.length, 0, `${model.path}: ${model.problems.join('; ')}`);
    assert.equal(model.pointerInHead, true, `${model.path} is committed as a raw blob, not an LFS pointer`);
  }
});

test('P-5 the checker is an npm script, is syntax-gated, and the docs carry the policy instead of the placeholder', () => {
  const packageJson = JSON.parse(readRepo('package.json'));
  assert.equal(packageJson.scripts['assets:hmh:models:lfs-check'], 'node scripts/hmh-source-model-lfs-check.mjs');
  const syntaxCheck = readRepo('scripts/syntax-check.mjs');
  assert.ok(syntaxCheck.includes('"scripts/hmh-source-model-lfs-check.mjs"'), 'the checker is not parsed by npm run check');
  assert.ok(syntaxCheck.includes('"tests/hmh-source-model-lfs-policy.test.mjs"'), 'this test file is not parsed by npm run check');
  for (const doc of ['docs/hmh-reboot/EXTERNAL-MODEL-PIPELINE.md', 'docs/hmh-reboot/BLENDER-ATLAS-PIPELINE.md']) {
    const text = readRepo(doc);
    assert.doesNotMatch(text, /no LFS rule/, `${doc} still carries the pre-P-5 placeholder`);
    assert.doesNotMatch(text, /Task P-5 must land/, `${doc} still defers to an unlanded P-5`);
    for (const needle of ['git lfs ls-files', '40 MB', '2048', 'npm run assets:hmh:models:lfs-check', 'filter=lfs diff=lfs merge=lfs -text']) {
      assert.ok(text.includes(needle), `${doc} does not document ${needle}`);
    }
  }
  const pipelineDoc = readRepo('docs/hmh-reboot/EXTERNAL-MODEL-PIPELINE.md');
  assert.match(pipelineDoc, /--clean-clone/);
  assert.match(pipelineDoc, /GIT_LFS_SKIP_SMUDGE=1/);
});
