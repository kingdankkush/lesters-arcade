import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  LFS_MODEL_EXTENSIONS,
  LFS_MODEL_RULES,
  LFS_POINTER_FIRST_LINE,
  MAX_TEXTURE_DIMENSION,
  SOURCE_MODEL_MAX_BYTES,
  SOURCE_PACKED_BLEND_MAX_BYTES,
  SOURCE_MODEL_ROOT,
  evaluateSourceModelFile,
  evaluateDeclaredSourcePayload,
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
  'apps/hmh-reboot/assets/source/models/**/*.blend filter=lfs diff=lfs merge=lfs -text',
];

test('P-5 source-model and packed Blend LFS rules are written into .gitattributes verbatim', () => {
  assert.deepEqual([...LFS_MODEL_RULES], EXPECTED_RULES);
  assert.deepEqual([...LFS_MODEL_EXTENSIONS], ['glb', 'fbx', 'bin', 'png', 'jpg', 'jpeg', 'blend']);
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

test('hash-bound native producer receipts declare byte preservation without exempting ordinary JSON', () => {
  const lines = readRepo('.gitattributes').split(/\r?\n/);
  for (const suffix of ['packed-source-inspection', 'gameplay-reproducibility']) {
    assert.ok(lines.includes(`apps/hmh-reboot/assets/source/blender/*-${suffix}.json -text`), suffix);
  }
  assert.ok(!lines.some(line => /^\*\.json\s+.*-text/.test(line)), 'ordinary JSON keeps the existing text policy');
});

test('P-5 pointer detection, the per-file cap and the texture cap are pure and exact', () => {
  assert.equal(LFS_POINTER_FIRST_LINE, 'version https://git-lfs.github.com/spec/v1');
  assert.equal(isLfsPointer(Buffer.from('version https://git-lfs.github.com/spec/v1\noid sha256:0123\nsize 42\n')), true);
  assert.equal(isLfsPointer(Buffer.from([0x67, 0x6c, 0x54, 0x46, 0x02, 0x00, 0x00, 0x00, 0x2a, 0x00, 0x00, 0x00])), false);
  assert.equal(isLfsPointer(Buffer.alloc(0)), false);

  assert.equal(SOURCE_MODEL_MAX_BYTES, 40 * 1024 * 1024);
  assert.equal(SOURCE_MODEL_MAX_BYTES, 41_943_040);
  assert.equal(SOURCE_PACKED_BLEND_MAX_BYTES, 96 * 1024 * 1024);
  assert.equal(MAX_TEXTURE_DIMENSION, 2048);

  const atCap = evaluateSourceModelFile({ path: `${SOURCE_MODEL_ROOT}/lester.glb`, sizeBytes: SOURCE_MODEL_MAX_BYTES });
  assert.deepEqual(atCap.problems, []);
  const overCap = evaluateSourceModelFile({ path: `${SOURCE_MODEL_ROOT}/lester.glb`, sizeBytes: SOURCE_MODEL_MAX_BYTES + 1 });
  assert.equal(overCap.problems.length, 1);
  assert.match(overCap.problems[0], /40 MB/);
  assert.match(overCap.problems[0], /41,943,041/);
  const packedBlend = evaluateSourceModelFile({ path: `${SOURCE_MODEL_ROOT}/commando.blend`, sizeBytes: 90_056_914 });
  assert.deepEqual(packedBlend.problems, []);
  const oversizedBlend = evaluateSourceModelFile({ path: `${SOURCE_MODEL_ROOT}/commando.blend`, sizeBytes: SOURCE_PACKED_BLEND_MAX_BYTES + 1 });
  assert.equal(oversizedBlend.problems.length, 1);
  assert.match(oversizedBlend.problems[0], /96 MB/);

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

test('packed source identity works without .git for both smudged bytes and an exact LFS pointer', () => {
  const payload = Buffer.from('packed textured source');
  const sourceSha256 = createHash('sha256').update(payload).digest('hex');
  const sourceBytes = payload.length;
  assert.deepEqual(evaluateDeclaredSourcePayload(payload, { sourceSha256, sourceBytes }), { kind: 'source-original', problems: [] });
  const pointer = Buffer.from(`version https://git-lfs.github.com/spec/v1\noid sha256:${sourceSha256}\nsize ${sourceBytes}\n`);
  assert.deepEqual(evaluateDeclaredSourcePayload(pointer, { sourceSha256, sourceBytes }), { kind: 'lfs-pointer', problems: [] });
  assert.ok(evaluateDeclaredSourcePayload(Buffer.from(`${pointer}x`), { sourceSha256: '0'.repeat(64), sourceBytes }).problems.length > 0);
});

test('declared LFS identity rejects duplicate, prefixed, and malformed pointer fields', () => {
  const sourceSha256 = 'a'.repeat(64);
  const sourceBytes = 123;
  const version = 'version https://git-lfs.github.com/spec/v1';
  const malformed = [
    `${version}\noid sha256:${'b'.repeat(64)}\nsize 123\nextra oid sha256:${sourceSha256}\n`,
    `${version}\noid sha256:${sourceSha256}\nsize 1230\n`,
    `${version}\noid sha256:${sourceSha256}\nsize 123\nsize 456\n`,
    `${version}\noid sha256:${sourceSha256}\nsize 456\nextra size 123\n`,
    `${version}\noid sha256:${sourceSha256}\nsize 123\ntrailing-content\n`,
  ];
  for (const payload of malformed) assert.ok(evaluateDeclaredSourcePayload(Buffer.from(payload), { sourceSha256, sourceBytes }).problems.length > 0, payload);
});

// The authoring CLI exercises real Git locally. Cloud unit tests execute its
// real policy logic with explicit deterministic command transcripts and actual files.
async function checkFixture({ rawHead = false, badAttribute = null, missingListing = false } = {}) {
  const scratch = mkdtempSync(path.join(tmpdir(), 'hmh-lfs-policy-unit-'));
  const model = `${SOURCE_MODEL_ROOT}/unit/packed.blend`;
  try {
    writeFileSync(path.join(scratch, '.gitattributes'), readRepo('.gitattributes'));
    mkdirSync(path.dirname(path.join(scratch, model)), { recursive: true });
    const payload = Buffer.from('unit packed source'); writeFileSync(path.join(scratch, model), payload);
    const pointer = Buffer.from(`version https://git-lfs.github.com/spec/v1\noid sha256:${createHash('sha256').update(payload).digest('hex')}\nsize ${payload.length}\n`);
    const transcript = [];
    const textCommand = (cwd, args) => {
      assert.equal(cwd, scratch); transcript.push([...args]);
      let stdout;
      if (args[0] === 'check-attr') stdout = ['filter', 'diff', 'merge', 'text'].map(attribute => `${args.at(-1)}: ${attribute}: ${attribute === badAttribute ? 'unspecified' : attribute === 'text' ? 'unset' : 'lfs'}`).join('\n');
      else if (args.join(' ') === 'lfs version') stdout = 'unit-lfs-transcript';
      else if (args[0] === 'ls-files') stdout = model;
      else if (args.join(' ') === 'lfs ls-files --name-only') stdout = missingListing ? '' : model;
      else if (args[0] === 'rev-parse') stdout = 'unit-head';
      else if (args.join(' ') === 'lfs env') stdout = 'Endpoint=https://example.invalid/unit-lfs';
      else assert.fail(`unexpected command transcript: ${args}`);
      return { status: 0, stdout, stderr: '' };
    };
    const binaryCommand = (cwd, args) => {
      assert.equal(cwd, scratch); assert.deepEqual(args, ['cat-file', '-p', `HEAD:${model}`]);
      return { status: 0, stdout: rawHead ? payload : pointer, stderr: '' };
    };
    const report = await runOfflineCheck({ root: scratch, textCommand, binaryCommand });
    assert.equal(transcript.filter(args => args[0] === 'check-attr').length, 7);
    assert.equal(report.trackedModels, 1); assert.deepEqual(report.missingRules, []);
    return report;
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}

test('the authoring checker policy validates actual source bytes with injected command transcripts and no Git dependency', async () => {
  const report = await checkFixture();
  assert.equal(report.ok, true, JSON.stringify(report)); assert.equal(report.models[0].pointerInHead, true);
  assert.equal(report.models[0].sizeBytes, Buffer.byteLength('unit packed source'));
  assert.equal(report.models[0].lfsListed, true);
});

test('the authoring checker rejects wrong filter/diff/merge/text, raw committed models and missing LFS membership', async () => {
  for (const badAttribute of ['filter', 'diff', 'merge', 'text']) {
    const report = await checkFixture({ badAttribute });
    assert.equal(report.ok, false); assert.ok(report.problems.some(problem => problem.includes(badAttribute)));
  }
  assert.equal((await checkFixture({ rawHead: true })).ok, false);
  assert.equal((await checkFixture({ missingListing: true })).ok, false);
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
