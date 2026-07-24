import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scriptPath = path.join(root, 'scripts', 'hmh-reboot-production-asset-qa.mjs');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

test('active reboot production asset QA is fail-closed and owns complete atlas budgets', () => {
  assert.equal(packageJson.scripts['assets:qa:hmh-reboot'], 'node scripts/hmh-reboot-production-asset-qa.mjs');
  assert.ok(fs.existsSync(scriptPath), 'missing active reboot asset QA script');
  const source = fs.readFileSync(scriptPath, 'utf8');
  for (const marker of ['PRODUCTION_HERO_ASSETS', 'readRgbaPng', 'schemaVersion', 'runtimeAuthority', 'projection-only', 'frames.length', '168', 'source.frame', 'x + w', 'anchor.x', 'sourcePivot', 'atlasTotalBytes', 'maxAtlasBytes']) {
    assert.match(source, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});
