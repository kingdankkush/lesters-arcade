// 2.1 collision-art lane: in the ten-area world every drawn card that reads as
// something you cannot walk through stands on a collision blocker, and every
// blocker is drawn (docs/2.0/slices/WORLD-COLLISION-ART.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Texture, TextureSource, Container } from 'pixi.js';
import {
  auditTenAreaCollisionArt, collectTenAreaCards, loadKitManifest, propBlockerRows, propBlockerModuleSource, PROP_BLOCKER_MODULE,
  COVERAGE_MINIMUM, MISMATCH_TOLERANCE,
} from '../scripts/audit-ten-area-collision-art.mjs';
import { CARD_COLLISION_CLASSES, CARD_GROUND_EXTENTS, cardBlocks } from '../apps/hmh-reboot/src/world-v2-area-plans/card-footprints.mjs';
import { cardGroundPixels, createPlacementGuard, seatSolidCardY } from '../apps/hmh-reboot/src/world-v2-area-art-schema.mjs';
import { PROP_BLOCKER_COUNT } from '../apps/hmh-reboot/src/dev/greybox-prop-blockers.mjs';
import { createGreyboxWorld } from '../apps/hmh-reboot/src/dev/greybox-world-v1.mjs';
import { createAreaArt, createAreaArtTextureCache } from '../apps/hmh-reboot/src/world-v2-area-art.mjs';
import { createLitecoinCityArtPlan } from '../apps/hmh-reboot/src/world-v2-area-plans/litecoin-city.mjs';
import { createMwebMeadowsArtPlan } from '../apps/hmh-reboot/src/world-v2-area-plans/mweb-meadows.mjs';

const kit = loadKitManifest();
const audit = await auditTenAreaCollisionArt({ kit });

test('every blocking-class card stands on a blocker under at least 70% of its footprint, within 24 units', () => {
  assert.equal(COVERAGE_MINIMUM, 0.7);
  assert.equal(MISMATCH_TOLERANCE, 24);
  assert.ok(audit.cards.blocking >= 1400, `${audit.cards.blocking} blocking cards audited`);
  const walkOver = audit.findings.filter(f => f.type === 'walk-over' || f.type === 'overhang');
  assert.deepEqual(walkOver.map(f => `${f.type} ${f.id} ${f.coverage} ${f.overhang}`), []);
  for (const card of audit.cardResults) {
    assert.ok(card.coverage >= COVERAGE_MINIMUM, `${card.id} ${card.coverage}`);
    assert.ok(card.overhang <= MISMATCH_TOLERANCE, `${card.id} ${card.overhang}`);
  }
});

test('every blocker has drawn art over at least 70% of it and reaches no more than 24 units past it', () => {
  const invisible = audit.findings.filter(f => f.type === 'invisible-wall' || f.type === 'blocker-overhang');
  assert.deepEqual(invisible.map(f => `${f.type} ${f.id} ${f.coverage} ${f.overhang}`), []);
  assert.equal(audit.blockerResults.length, audit.world.blockers);
  for (const blocker of audit.blockerResults) assert.ok(blocker.coverage >= COVERAGE_MINIMUM, blocker.id);
  assert.deepEqual(audit.findings, [], 'no finding of any kind, including unclassified kit sources');
});

test('the card footprint table is the manifest footprint clipped to the painted bounds', () => {
  const items = kit.items.filter(item => item.class !== 'pickups');
  assert.deepEqual(Object.keys(CARD_GROUND_EXTENTS).sort(), items.map(item => item.assetId).sort());
  for (const item of items) {
    const g = cardGroundPixels(item), h = item.alphaBounds.h;
    [g.left, g.right, g.back, g.front].forEach((value, i) => assert.ok(Math.abs(value / h - CARD_GROUND_EXTENTS[item.assetId][i]) <= 6e-5, `${item.assetId}[${i}]`));
    assert.ok(g.front <= item.alphaBounds.y + item.alphaBounds.h - item.anchor.y * item.frame.h + 1e-9, `${item.assetId} paints its front`);
    assert.ok(CARD_COLLISION_CLASSES[item.assetId], `${item.assetId} has a collision class`);
  }
  // Policy: buildings, vehicles, containers always; barriers from knee height; trees, rocks and props above 1.2 m.
  assert.equal(cardBlocks('b2-62', 10), true);
  assert.equal(cardBlocks('b1-45', 40), true);
  assert.equal(cardBlocks('b2-49', 32), true);
  assert.equal(cardBlocks('b2-49', 22), false, 'a headstone slab is walk-over debris');
  assert.equal(cardBlocks('b2-72', 300), true);
  assert.equal(cardBlocks('b2-74', 48), false);
  assert.equal(cardBlocks('b1-09', 60), false, 'iris never blocks');
  assert.equal(cardBlocks('b2-61', 46), false, 'a motorcycle is clutter');
});

test('the generated prop-blocker module is current and every row is a frozen authored solid', async () => {
  const collected = await collectTenAreaCards({ kit });
  const expected = propBlockerModuleSource(propBlockerRows(collected));
  assert.equal(readFileSync(PROP_BLOCKER_MODULE, 'utf8').replace(/\r\n/g, '\n'), expected, 'run node scripts/audit-ten-area-collision-art.mjs --write-prop-blockers');
  const world = createGreyboxWorld(), props = world.pieces.filter(piece => piece.visible.artPlanId);
  assert.equal(props.length, PROP_BLOCKER_COUNT);
  assert.ok(PROP_BLOCKER_COUNT >= 400);
  for (const piece of props) {
    assert.equal(piece.kind, 'prop-solid');
    assert.equal(piece.visible.areaId, null, 'prop blockers never count toward an area layout budget');
    assert.equal(piece.blocker.minZ, 0);
    assert.ok(piece.blocker.maxZ > 0);
    assert.equal(piece.blocker.combatCover, piece.blocker.coverKind !== 'none');
  }
  // Placement guards and terrain see only layout solids (no prop blocker, no
  // edge guard), so the plans the colliders were generated from never move
  // because of them.
  const guard = createPlacementGuard({ world }), edgeGuards = world.pieces.filter(piece => piece.kind === 'edge-guard');
  assert.ok(edgeGuards.length >= 20);
  assert.equal(guard.counts.blockers, world.pieces.filter(piece => piece.blocker).length - props.length - edgeGuards.length);
});

// Headless textures sized like the real files (as the renderer tests do).
const sizeFor = url => { const file = url.split('/').at(-1); if(file.startsWith('native-timber-screens'))return file.includes('@0.5x')?[256,128]:[512,256]; if (file.startsWith('tripo-props-hd-')) return file.includes('@0.5x') ? [1024, 1024] : [2048, 2048]; if (file.endsWith('-fringe.png')) return [512, 128]; if (file === 'ground-details.webp') return [256, 256]; return [512, 512]; };
const loadTexture = async url => { const [width, height] = sizeFor(url); return new Texture({ source: new TextureSource({ width, height }) }); };

test('the renderer claims every prop collider its plan draws and seats solid cards inside their colliders', async () => {
  const world = createGreyboxWorld();
  const city = createAreaArt({ world, areaId: 'litecoin-city', plan: createLitecoinCityArtPlan(world), kit, textureCache: createAreaArtTextureCache({ loadTexture }) });
  await city.ready;
  const claimed = new Set(city.mountSolids(world.pieces));
  const cityProps = world.pieces.filter(piece => piece.visible.artPlanId === 'litecoin-city');
  assert.ok(cityProps.length >= 40);
  for (const piece of cityProps) assert.ok(claimed.has(piece.blocker.id), `${piece.id} is drawn by its card, not a greybox slab`);
  assert.ok(!world.pieces.some(piece => piece.visible.artPlanId && piece.visible.artPlanId !== 'litecoin-city' && claimed.has(piece.blocker.id)), 'only its own plan claims a prop collider');
  city.dispose();

  const meadows = createAreaArt({ world, areaId: 'mweb-meadows', plan: createMwebMeadowsArtPlan(world), kit, textureCache: createAreaArtTextureCache({ loadTexture }) });
  await meadows.ready;
  const home = world.pieces.find(piece => piece.id === 'mweb-meadows-garden-home'), node = meadows.createSolid(home);
  const sprite = node.children.find(child => child.texture && child.anchor), item = kit.items.find(entry => entry.assetId === 'b2-62');
  const b = home.visible.bounds, unitsPerPixel = (b.maxX - b.minX) / item.alphaBounds.w;
  assert.ok(Math.abs(sprite.y - seatSolidCardY(item, b, unitsPerPixel)) < 1e-6);
  const front = sprite.y + cardGroundPixels(item).front * unitsPerPixel;
  assert.ok(Math.abs(front - b.maxY) < 1e-6, 'the painted footprint front sits on the collider front edge');
  assert.ok(sprite.y < b.maxY, 'the farmhouse no longer straddles its front wall');
  meadows.dispose();
});

test('the wall-walk evidence spawn stands the hero only on a clear point and never inside a collider', async () => {
  const { createWorldV2RuntimeWorld, createWorldV2GroundQuery } = await import('../apps/hmh-reboot/src/world-v2-runtime-world.mjs');
  const { createWorldV2Gameplay } = await import('../apps/hmh-reboot/src/world-v2-gameplay.mjs');
  const { createWorldV2Combat } = await import('../apps/hmh-reboot/src/world-v2-combat.mjs');
  const world = createWorldV2RuntimeWorld(), combat = createWorldV2Combat({ world, gameplay: createWorldV2Gameplay(world), queryGround: createWorldV2GroundQuery(world) });
  const home = world.blockers.find(blocker => blocker.id === 'mweb-meadows-garden-home').bounds;
  const outside = { x: (home.minX + home.maxX) / 2, y: home.maxY + 90 };
  assert.deepEqual(combat.evidenceSpawn(`at:${outside.x},${outside.y}`, world.player.spawn), { id: 'evidence-at', ...outside, walk: { x: 0, y: 0 } });
  assert.equal(combat.evidenceSpawn(`at:${outside.x},${home.maxY - 20}`, world.player.spawn), null, 'inside the farmhouse collider');
  const car = world.collisionBlockers.find(blocker => blocker.id.startsWith('prop-litecoin-city-b2-54-'));
  const v = car.shape.vertices;
  assert.equal(combat.evidenceSpawn(`at:${(v[0].x + v[2].x) / 2},${(v[0].y + v[2].y) / 2}`, world.player.spawn), null, 'inside a parked pickup');
  for (const bad of ['at:1,2,3', 'at:x,4', 'at:']) assert.equal(combat.evidenceSpawn(bad, world.player.spawn), null, bad);
});
