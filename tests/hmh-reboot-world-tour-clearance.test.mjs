import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createWorldTourSpawns } from '../apps/hmh-reboot/src/world-tour-spawns.mjs';
import { LEVEL_ONE_WORLD } from '../apps/hmh-reboot/src/level-one-world.mjs';
import { buildAuthoredDistrictLandmarkPlacements, buildAuthoredPointOfInterestPlacements } from '../apps/hmh-reboot/src/authored-prop-atlas.mjs';
import { WORLD_DESIGN_SITES } from '../apps/hmh-reboot/src/world-design-encounters.mjs';

// Execute the actual runtime's static view table, including its real POI expansion.
// Keeping this source-bound avoids a test-only duplicate of the tour coordinates.
function runtimeTourViews() {
  return createWorldTourSpawns(buildAuthoredPointOfInterestPlacements(LEVEL_ONE_WORLD.pointsOfInterest));
}

const landmarks = buildAuthoredDistrictLandmarkPlacements({ worldId: LEVEL_ONE_WORLD.id });
const metadata = JSON.parse(readFileSync(new URL('../apps/portal/assets/generated/hmh-reboot-authored-props/hmh-authored-props-atlas.json', import.meta.url), 'utf8'));
const frameById = new Map(metadata.frames.map(frame => [frame.assetId, frame]));

// Hashwood is flat here: at zoom1 its world x/y deltas are screen-pixel deltas.
// Use emitted frame dimensions, pivot and runtimeScale, not a guessed landmark radius.
function spriteBounds(placement) {
  const frame = frameById.get(placement.assetId);
  const scale = frame.runtimeScale * (placement.scale ?? 1);
  const left = placement.x - frame.frame.w * scale * frame.anchor.x;
  const top = placement.y - frame.frame.h * scale * frame.anchor.y;
  return { left, top, right: left + frame.frame.w * scale, bottom: top + frame.frame.h * scale };
}
const overlaps = (a,b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

test('Hashwood tour places the full hero and foot disc clear of landmark sprites', () => {
  const spawn = runtimeTourViews().hashwood;
  const hero = {left:spawn.x-48,right:spawn.x+48,top:spawn.y-160,bottom:spawn.y+LEVEL_ONE_WORLD.player.radius};
  for(const landmark of landmarks.filter(row => row.districtId === 'hashwood')) {
    assert.equal(overlaps(hero, spriteBounds(landmark)), false, `${landmark.id} overlaps the tour hero body/spawn disc`);
  }
});

test('Hashwood tour keeps a readable view of the beacon without changing canonical spawn', () => {
  const spawn = runtimeTourViews().hashwood;
  const beacon = landmarks.find(row => row.assetId === 'hashwood-beacon-setpiece');
  const bounds = spriteBounds(beacon);
  const frame = {left:spawn.x-720,right:spawn.x+720,top:spawn.y-450+140,bottom:spawn.y+450};
  assert.ok(bounds.left >= frame.left && bounds.right <= frame.right && bounds.top >= frame.top && bounds.bottom <= frame.bottom, 'beacon must remain fully visible below the desktop cockpit');
  assert.deepEqual(LEVEL_ONE_WORLD.player.spawn, {x:800,y:2400}, 'only evidence-tour framing may move');
  assert.equal(LEVEL_ONE_WORLD.player.protectedSpawnRadius, 560);
});
