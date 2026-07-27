import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const VERCEL_CONFIG = fileURLToPath(new URL('../vercel.json', import.meta.url));
const PYTHON_REQUIREMENTS = fileURLToPath(new URL('../requirements-vercel.txt', import.meta.url));

test('Vercel installs the pinned Pillow dependency required by asset provenance checks', () => {
  const config = JSON.parse(readFileSync(VERCEL_CONFIG, 'utf8'));
  const requirements = readFileSync(PYTHON_REQUIREMENTS, 'utf8')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);

  assert.deepEqual(requirements, ['Pillow==12.2.0']);
  assert.match(
    config.installCommand,
    /^npm install && uv pip install --system --no-cache -r requirements-vercel\.txt$/u,
  );
});
