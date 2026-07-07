import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { HMH_WO90_PLACEHOLDER_REDO } from '../apps/portal/assets/generated/hmh-wo90-placeholder-redo/hmh-wo90-placeholder-redo.mjs';
import { HMH_PICKUP_ICON_PACK } from '../apps/portal/assets/generated/hmh-pickup-icons/hmh-pickup-icons-manifest.mjs';
import { HMH_VFX_UI_CHROME_PACK } from '../apps/portal/assets/generated/hmh-vfx-ui-chrome/hmh-vfx-ui-chrome-manifest.mjs';
import { HMH_LEVEL_ONE_AUTHORED_STAMP_ART } from '../apps/portal/assets/generated/hmh-level-one-authored-stamp-art/hmh-level-one-authored-stamp-art-manifest.mjs';
import { HMH_ACHIEVEMENT_ATLAS } from '../apps/portal/assets/generated/hmh-achievement-atlas/hmh-achievement-atlas-manifest.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function repoPath(rel) {
  return path.resolve(ROOT, rel);
}

test('WO-90 certifies all placeholder redo packs and contact sheets', () => {
  const cert = HMH_WO90_PLACEHOLDER_REDO;
  assert.equal(cert.id, 'hmh-wo90-placeholder-redo-v1');
  assert.equal(cert.status, 'certified-regenerated-and-integrated');
  assert.equal(cert.packs.length, 4);
  assert.equal(cert.packs.every((pack) => pack.verdict === 'approved-runtime-ready'), true);
  for (const pack of cert.packs) {
    assert.equal(existsSync(repoPath(pack.contactSheet)), true, `${pack.id} contact sheet exists`);
  }
  assert.equal(existsSync(repoPath('docs/game-design/hmh-wo90-placeholder-redo.md')), true);
});

test('WO-90 certification counts match generated runtime manifests', () => {
  const byId = Object.fromEntries(HMH_WO90_PLACEHOLDER_REDO.packs.map((pack) => [pack.id, pack]));
  assert.equal(byId['pickup-icons'].assetCount, HMH_PICKUP_ICON_PACK.assetCount);
  assert.equal(byId['vfx-ui-chrome'].assetCount, HMH_VFX_UI_CHROME_PACK.assetCount);
  assert.equal(byId['authored-stamp-art'].assetCount, HMH_LEVEL_ONE_AUTHORED_STAMP_ART.assetCount);
  assert.equal(HMH_ACHIEVEMENT_ATLAS.achievementCount, 57);
  assert.equal(HMH_ACHIEVEMENT_ATLAS.tierCount, 6);
  assert.equal(HMH_ACHIEVEMENT_ATLAS.unlockTypeCount, 15);
  assert.equal(byId['achievement-atlas'].assetCount, HMH_ACHIEVEMENT_ATLAS.achievementCount + HMH_ACHIEVEMENT_ATLAS.tierCount + HMH_ACHIEVEMENT_ATLAS.unlockTypeCount);
});

test('WO-90 source policy keeps regenerated packs repo-owned and secret-free', () => {
  assert.match(HMH_WO90_PLACEHOLDER_REDO.sourcePolicy, /Repo-owned generated pixel art/);
  assert.equal(HMH_WO90_PLACEHOLDER_REDO.generatorCommands.includes('npm run assets:hmh:pickup-icons'), true);
  assert.equal(HMH_WO90_PLACEHOLDER_REDO.generatorCommands.includes('npm run assets:hmh:achievement-atlas'), true);
});
