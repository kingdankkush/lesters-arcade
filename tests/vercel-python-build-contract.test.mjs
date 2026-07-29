import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const VERCEL_CONFIG = fileURLToPath(new URL('../vercel.json', import.meta.url));
const PYTHON_REQUIREMENTS = fileURLToPath(new URL('../requirements-vercel.txt', import.meta.url));
const SELECTOR_BUILDER = fileURLToPath(new URL('../scripts/build-hmh-reboot-hero-selector-atlas.py', import.meta.url));
const GITIGNORE = fileURLToPath(new URL('../.gitignore', import.meta.url));
const VERCELIGNORE = fileURLToPath(new URL('../.vercelignore', import.meta.url));

const vercelConfig = JSON.parse(readFileSync(VERCEL_CONFIG, 'utf8'));

const nonEmptyLines = (path) => readFileSync(path, 'utf8')
  .split(/\r?\n/u)
  .map((line) => line.trim())
  .filter(Boolean);

const isolatedTargetIsIgnored = ({ hasGitMetadata, ignoredByGit, ignoredByUpload }) => (
  hasGitMetadata ? ignoredByGit : ignoredByUpload
);

test('Vercel pins the Pillow dependency required by asset provenance checks', () => {
  assert.deepEqual(nonEmptyLines(PYTHON_REQUIREMENTS), ['Pillow==11.3.0']);
});

test('Vercel install command places Pillow in the isolated Python target', () => {
  assert.match(
    vercelConfig.installCommand,
    /^npm install && uv pip install --python "\$\(command -v python\)" --target \.vercel-python --no-cache -r requirements-vercel\.txt$/u,
  );
});

test('Vercel build command exposes the isolated Python target', () => {
  assert.equal(vercelConfig.buildCommand, 'PYTHONPATH="$PWD/.vercel-python" npm run vercel:build');
});

test('checkout and deployment archives each require their own isolated-target ignore contract', () => {
  assert.equal(isolatedTargetIsIgnored({ hasGitMetadata: true, ignoredByGit: true, ignoredByUpload: false }), true);
  assert.equal(isolatedTargetIsIgnored({ hasGitMetadata: true, ignoredByGit: false, ignoredByUpload: true }), false);
  assert.equal(isolatedTargetIsIgnored({ hasGitMetadata: false, ignoredByGit: true, ignoredByUpload: false }), false);
  assert.equal(isolatedTargetIsIgnored({ hasGitMetadata: false, ignoredByGit: false, ignoredByUpload: true }), true);

  const ignoredByGit = /^\.vercel-python\/$/mu.test(readFileSync(GITIGNORE, 'utf8'));
  const ignoredByUpload = nonEmptyLines(VERCELIGNORE).includes('.vercel-python');
  const hasGitMetadata = existsSync(fileURLToPath(new URL('../.git', import.meta.url)));
  assert.equal(isolatedTargetIsIgnored({ hasGitMetadata, ignoredByGit, ignoredByUpload }), true);
});

test('selector builder uses a Pillow 11 compatible alpha byte API', () => {
  const builder = readFileSync(SELECTOR_BUILDER, 'utf8');
  assert.doesNotMatch(builder, /get_flattened_data/u);
  assert.match(builder, /for value in alpha\.tobytes\(\)/u);
});

test('Vercel uploads exclude local evidence, temporary build state, and Blender backups', () => {
  const ignores = new Set(readFileSync(VERCELIGNORE, 'utf8')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean));

  for (const required of ['.hermes', '.tmp', '.vercel-python', '*.blend1']) {
    assert.ok(ignores.has(required), `.vercelignore must exclude ${required}`);
  }
});
