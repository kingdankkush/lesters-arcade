import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  buildAuthoredTownPlacements,
  createAuthoredPropAtlasIndex,
} from '../apps/hmh-reboot/src/authored-prop-atlas.mjs';
import { LEVEL_ONE_WORLD } from '../apps/hmh-reboot/src/level-one-world.mjs';

const manifestUrl = new URL('../apps/hmh-reboot/assets/source/blender/hmh-authored-props.json', import.meta.url);
const metadataUrl = new URL('../apps/portal/assets/generated/hmh-reboot-authored-props/hmh-authored-props-atlas.json', import.meta.url);
const worldArtUrl = new URL('../apps/hmh-reboot/src/world-production-art.mjs', import.meta.url);
const mainUrl = new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url);
const loadJson = async (url) => JSON.parse(await readFile(url, 'utf8'));
const loadPlacements = async () => buildAuthoredTownPlacements({
  worldId: LEVEL_ONE_WORLD.id,
  index: createAuthoredPropAtlasIndex(await loadJson(metadataUrl)),
});

const TOWN_KIT_IDS = new Set([
  'awning-shopfront', 'ruined-tenement', 'corrugated-lean-to', 'market-stall',
  'water-tower', 'fuel-pump-island', 'town-billboard', 'porch-stoop',
  'chain-fence-gate', 'streetlamp', 'mailbox', 'stacked-crates',
]);
const TALL_ASSETS = new Set(['awning-shopfront', 'ruined-tenement', 'water-tower', 'fuel-pump-island', 'town-billboard', 'streetlamp']);

test('W2 defines three intentional liquidation-yard blocks with street and alley grammar', async () => {
  const { townBlocks } = await loadJson(manifestUrl);
  assert.deepEqual(townBlocks.map((block) => block.id), [
    'yard:north-commercial',
    'yard:south-market',
    'yard:east-residential',
  ]);
  for (const block of townBlocks) {
    assert.equal(block.districtId, 'liquidation-yard');
    assert.ok(block.streetClearance >= 192);
    assert.ok(block.alleyClearance >= 144);
    assert.ok(block.placementIds.length >= 4);
  }
});

test('W2 town placement is deterministic, projection-only, complete, and canonically blocked', async () => {
  const first = await loadPlacements();
  const second = await loadPlacements();
  assert.deepEqual(first, second);
  assert.ok(first.length >= 18);
  assert.deepEqual(new Set(first.map((placement) => placement.assetId)), TOWN_KIT_IDS);
  assert.ok(first.every((placement) => placement.runtimeAuthority === 'projection-only'));
  assert.ok(first.every((placement) => placement.districtId === 'liquidation-yard'));
  assert.equal(first.filter((placement) => placement.collisionPolicy === 'canonical-blocker').length, 7);
  assert.equal(first.filter((placement) => placement.collisionPolicy === 'visual-only').length, 11);
  assert.ok(first.every((placement) => placement.collisionPolicy === 'canonical-blocker' ? Boolean(placement.collisionBlockerId) : placement.collisionBlockerId == null));

  const blockerIds = new Set(LEVEL_ONE_WORLD.collisionBlockers.map((blocker) => blocker.id));
  for (const placement of first.filter((placement) => placement.collisionBlockerId)) {
    assert.ok(blockerIds.has(placement.collisionBlockerId), `${placement.id} references missing blocker ${placement.collisionBlockerId}`);
  }
});

test('W2 preserves boss breathing room and spawn readability', async () => {
  const placements = await loadPlacements();
  const arena = LEVEL_ONE_WORLD.encounterArenas.find((candidate) => candidate.id === 'liquidator-arena');
  for (const placement of placements.filter((candidate) => candidate.collisionBlockerId)) {
    const distance = Math.hypot(placement.x - arena.anchor.x, placement.y - arena.anchor.y);
    assert.ok(distance >= arena.radius + 140, `${placement.id} crowds the boss arena`);
  }
  const yardSpawns = LEVEL_ONE_WORLD.spawnPoints.filter((spawn) => spawn.districtId === 'liquidation-yard');
  for (const placement of placements.filter((candidate) => TALL_ASSETS.has(candidate.assetId))) {
    for (const spawn of yardSpawns) {
      assert.ok(Math.hypot(placement.x - spawn.x, placement.y - spawn.y) >= 260, `${placement.id} covers ${spawn.id}`);
    }
  }
});

test('W2 keeps visible collision fallback until authored town sprites attach', async () => {
  const [worldArt, main] = await Promise.all([
    readFile(worldArtUrl, 'utf8'),
    readFile(mainUrl, 'utf8'),
  ]);
  assert.match(worldArt, /'townBlockers'/, 'town fallback needs a dedicated production-art layer');
  assert.match(worldArt, /feature\.id\.startsWith\('town-'\) \? layers\.townBlockers : layers\.blockers/);
  assert.doesNotMatch(worldArt, /feature\.id\.startsWith\('town-'\)\) continue/);
  const attachment = main.indexOf('authoredPropLayer.addChild(display.container)');
  const handoff = main.indexOf('worldProduction.layers.townBlockers.visible = false');
  assert.ok(attachment >= 0 && handoff > attachment, 'town collision fallback may hide only after authored display attachment');
});
