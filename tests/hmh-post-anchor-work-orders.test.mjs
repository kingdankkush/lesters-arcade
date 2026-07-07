import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  HMH_DEVICE_QA_STATUS,
  HMH_WO77_MICRO_SCENE_LIBRARY,
  HMH_WO78_DRAW_OVER_LAYER_PLAN,
  HMH_WO79_AMBIENT_MOTION_PLAN,
  HMH_WO80_WEAR_VARIANCE_PLAN,
  HMH_WO81_ANIMATION_PRINCIPLES_GATES,
  HMH_WO82_HERO_POLISH_PLAN,
  HMH_WO83_TOP5_ENEMY_REDESIGN_BRIEFS,
  HMH_WO84_BOSS_SPECTACLE_PLAN,
  HMH_WO85_PAINTERLY_GROUND_PLAN,
  HMH_WO86_AUDIO_BAKEOFF,
  HMH_WO87_FULL_SFX_INVENTORY,
  HMH_WO88_SCORE_PLAN,
  HMH_WO89_AV_SYNC_POLISH,
  HMH_WO90_PLACEHOLDER_REDO_CENSUS,
  HMH_WO91_NOIR_DISTRICT_RATIONALIZATION,
  buildPostAnchorWorkOrderReport,
} from '../apps/portal/src/hmh-post-anchor-work-orders.mjs';
import {
  renderPostAnchorWorkOrderMarkdown,
  writePostAnchorWorkOrderReport,
} from '../scripts/hmh-post-anchor-work-orders.mjs';

function repoPath(path) {
  return fileURLToPath(new URL(`../${path}`, import.meta.url));
}

function repoText(path) {
  return readFileSync(repoPath(path), 'utf8');
}

test('post-anchor report covers every preserved work order after WO-76', () => {
  const report = buildPostAnchorWorkOrderReport();
  assert.equal(report.status.anchorSet, 'WO-76 APPROVED_10_OF_10');
  for (const key of ['wo91', 'wo90', 'wo81', 'wo83', 'wo77', 'wo78', 'wo79', 'wo85', 'wo80', 'wo82', 'wo84', 'wo86', 'wo87', 'wo88', 'wo89', 'deviceQa']) {
    assert.ok(report[key], `${key} exists`);
  }
});

test('WO-91 district rationalization is decided and maps old districts to noir zones', () => {
  assert.equal(HMH_WO91_NOIR_DISTRICT_RATIONALIZATION.length >= 6, true);
  assert.equal(HMH_WO91_NOIR_DISTRICT_RATIONALIZATION.every((row) => row.ruling === 'approved'), true);
  assert.equal(HMH_WO91_NOIR_DISTRICT_RATIONALIZATION.some((row) => row.oldDistrict === 'financial-core' && row.noirZone === 'bank-and-exchange-canyon'), true);
});

test('WO-90 placeholder census covers the script-drawn packs and routes replacements to approved anchors', () => {
  assert.deepEqual(HMH_WO90_PLACEHOLDER_REDO_CENSUS.map((row) => row.script).sort(), [
    'generate-hmh-achievement-atlas.py',
    'generate-hmh-level-one-authored-stamp-art.py',
    'generate-hmh-pickup-icons.py',
    'generate-hmh-vfx-ui-chrome.py',
  ]);
  assert.equal(HMH_WO90_PLACEHOLDER_REDO_CENSUS.every((row) => row.replacementAnchor && row.action.includes('redo')), true);
});

test('WO-81 animation principles add explicit anticipation/smear/impact/follow-through/loop-bob gates', () => {
  assert.deepEqual(HMH_WO81_ANIMATION_PRINCIPLES_GATES.map((row) => row.gate), ['anticipation', 'smear', 'impact', 'follow-through', 'loop-bob']);
  assert.equal(HMH_WO81_ANIMATION_PRINCIPLES_GATES.every((row) => row.acceptance.length > 20), true);
});

test('WO-83, WO-82, and WO-84 route enemies/heroes/bosses through approved anchor references', () => {
  assert.equal(HMH_WO83_TOP5_ENEMY_REDESIGN_BRIEFS.length, 5);
  assert.equal(HMH_WO83_TOP5_ENEMY_REDESIGN_BRIEFS[0].anchor, 'highest-spawn-enemy-redesign');
  assert.equal(HMH_WO82_HERO_POLISH_PLAN.some((row) => row.hero === 'Lit Commando' && row.anchor === 'lit-commando-idle-key-pose'), true);
  assert.equal(HMH_WO84_BOSS_SPECTACLE_PLAN.every((row) => row.anchor === 'major-boss-key-pose' && row.beats.length >= 5), true);
});

test('WO-77/78/79/85/80 define authored micro-scenes, draw-over, motion, ground, and wear production rules', () => {
  assert.equal(HMH_WO77_MICRO_SCENE_LIBRARY.length, 20);
  assert.equal(new Set(HMH_WO77_MICRO_SCENE_LIBRARY.map((row) => row.id)).size, 20);
  assert.equal(HMH_WO78_DRAW_OVER_LAYER_PLAN.elements.some((row) => row.element === 'awnings'), true);
  assert.equal(HMH_WO79_AMBIENT_MOTION_PLAN.reducedMotion.includes('disable non-critical loops'), true);
  assert.equal(HMH_WO85_PAINTERLY_GROUND_PLAN.anchor, 'wet-asphalt-ground-family');
  assert.equal(HMH_WO80_WEAR_VARIANCE_PLAN.variants.length >= 4, true);
});

test('WO-86/87/88/89 define audio bakeoff, SFX inventory, score layers, and AV sync acceptance', () => {
  assert.match(HMH_WO86_AUDIO_BAKEOFF.verdict, /WebAudio/);
  assert.equal(HMH_WO87_FULL_SFX_INVENTORY.some((row) => row.status === 'needs-candidate'), true);
  assert.equal(HMH_WO88_SCORE_PLAN.stems.length >= 5, true);
  assert.match(HMH_WO89_AV_SYNC_POLISH.acceptance, /balanced SFX\/music/);
});

test('real-device QA remains explicitly blocked on this host with desktop fallback gates', () => {
  assert.equal(HMH_DEVICE_QA_STATUS.status, 'blocked-on-this-host');
  assert.equal(HMH_DEVICE_QA_STATUS.blockers.length >= 3, true);
  assert.match(HMH_DEVICE_QA_STATUS.desktopFallback, /smoke:portal:interactions/);
});

test('post-anchor work-order report writer creates markdown and JSON artifacts', () => {
  const { report, jsonPath, mdPath } = writePostAnchorWorkOrderReport();
  assert.equal(report.wo77.length, 20);
  assert.equal(existsSync(jsonPath), true);
  assert.equal(existsSync(mdPath), true);
  const markdown = renderPostAnchorWorkOrderMarkdown(report);
  assert.match(markdown, /WO-91 Noir district rationalization/);
  assert.match(markdown, /WO-89 AV sync polish/);
  const writtenMarkdown = repoText('docs/game-design/hard-money-heroes-post-anchor-work-orders.md');
  assert.match(writtenMarkdown, /Real-device QA/);
});
