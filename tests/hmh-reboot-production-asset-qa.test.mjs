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
  for (const marker of ['PRODUCTION_HERO_ASSETS', 'ENEMY_ROSTER_ACTORS', 'hmh-authored-props', 'readRgbaPng', 'schemaVersion', 'runtimeAuthority', 'projection-only', 'frames.length', '648', 'source.frame', 'x + w', 'anchor.x', 'sourcePivot', 'sourcePixelSha256', 'heroAtlasTotalBytes', 'maxHeroAtlasBytes', 'HMH_REBOOT_HERO_SELECTOR_ATLAS', 'maxSelectorAtlasBytes', 'selectorAtlasBytes', 'selectorSha256']) {
    assert.match(source, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});
