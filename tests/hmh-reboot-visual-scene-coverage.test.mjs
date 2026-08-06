import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { VISUAL_SCENES } from '../scripts/hmh-reboot-visual-regression.mjs';
import { LEVEL_ONE_WORLD } from '../apps/hmh-reboot/src/level-one-world.mjs';
import { buildAuthoredPointOfInterestPlacements } from '../apps/hmh-reboot/src/authored-prop-atlas.mjs';

const repoUrl = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const mainSource = readFileSync(repoUrl('apps/hmh-reboot/src/main.mjs'), 'utf8');

// P5. The A1-A7 asset waves added 29 world props, and the pinned scenes did
// not move for most of them -- the trees, the water dressing and the whole
// camp kit came back "unchanged" because they land outside every scene camera.
// They were verified by rendered montage and atlas metrics, which is real
// evidence, but it means the regression gate was not watching them: a later
// change could break them silently.
const REQUIRED_COVERAGE = Object.freeze({
  'hashwood-camp-desktop': 'camp-hashwood',
  'crossing-water-desktop': 'crossing-water',
});

test('every scene has a unique id and a viewport', () => {
  const ids = VISUAL_SCENES.map((scene) => scene.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate scene id');
  for (const scene of VISUAL_SCENES) {
    assert.ok(scene.viewport.width > 0 && scene.viewport.height > 0, `${scene.id} viewport`);
    assert.ok(Number.isInteger(scene.tick) && scene.tick > 0, `${scene.id} tick`);
    assert.match(scene.query, /evidenceSafe=1/, `${scene.id} must render the evidence-safe build`);
  }
});

test('the camp kit and water dressing each have a pinned scene', () => {
  const byId = new Map(VISUAL_SCENES.map((scene) => [scene.id, scene]));
  for (const [sceneId, tour] of Object.entries(REQUIRED_COVERAGE)) {
    const scene = byId.get(sceneId);
    assert.ok(scene, `${sceneId} is missing from VISUAL_SCENES`);
    assert.ok(scene.query.includes(`worldTour=${tour}`), `${sceneId} does not target worldTour=${tour}`);
  }
});

// A scene whose worldTour id has no spawn silently falls back to the default
// player spawn, which would quietly re-shoot the opening frame under a new
// name and look like coverage while adding none.
test('every worldTour a scene requests has a spawn in the runtime', () => {
  const collectibleTours = new Set(buildAuthoredPointOfInterestPlacements(LEVEL_ONE_WORLD.pointsOfInterest).map((placement) => `collectible-${placement.pointOfInterestId}`));
  for (const scene of VISUAL_SCENES) {
    const match = /worldTour=([a-z0-9-]+)/.exec(scene.query);
    if (!match) continue;
    const tour = match[1];
    if (collectibleTours.has(tour)) {
      assert.match(mainSource, /`collectible-\$\{placement\.pointOfInterestId\}`/, 'runtime collectible-tour generator is missing');
      continue;
    }
    assert.ok(
      new RegExp(`(^|\\s|,)['"]?${tour}['"]?:`, 'm').test(mainSource),
      `worldTour=${tour} has no spawn entry, so ${scene.id} would silently re-shoot the default spawn`,
    );
  }
});

test('every scene has an accepted baseline committed', () => {
  for (const scene of VISUAL_SCENES) {
    const path = `docs/testing/VISUAL_BASELINES/hmh-reboot/${scene.id}.json`;
    assert.ok(existsSync(repoUrl(path)), `${scene.id} has no committed baseline at ${path}`);
    const baseline = JSON.parse(readFileSync(repoUrl(path), 'utf8'));
    assert.ok(Array.isArray(baseline.signature) && baseline.signature.length > 0, `${scene.id} baseline is empty`);
  }
});
