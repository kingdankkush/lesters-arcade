import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const VERCEL_CONFIG = fileURLToPath(new URL('../vercel.json', import.meta.url));
const PYTHON_REQUIREMENTS = fileURLToPath(new URL('../requirements-vercel.txt', import.meta.url));
// The selector runner's `--check` branch runs inside `npm run test:release` on the
// Vercel image (CPython 3.12 + Pillow 11.3, no Blender, no .git).
const SELECTOR_BUILDER = fileURLToPath(new URL('../scripts/run-hmh-hero-selector-render.py', import.meta.url));
const VERCELIGNORE = fileURLToPath(new URL('../.vercelignore', import.meta.url));

const vercelConfig = JSON.parse(readFileSync(VERCEL_CONFIG, 'utf8'));

const nonEmptyLines = (path) => readFileSync(path, 'utf8')
  .split(/\r?\n/u)
  .map((line) => line.trim())
  .filter(Boolean);


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


test('selector runner uses a Pillow 11 compatible alpha byte API and keeps --check Blender-free', () => {
  const builder = readFileSync(SELECTOR_BUILDER, 'utf8');
  assert.doesNotMatch(builder, /get_flattened_data/u);
  assert.match(builder, /for value in alpha\.tobytes\(\)/u);
  assert.match(builder, /if args\.check:\n\s+check\(manifest_path\)\n\s+return/u, '--check must return before any Blender launch or lock');
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
