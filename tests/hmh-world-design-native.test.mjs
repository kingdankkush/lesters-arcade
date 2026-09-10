import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorldDesignAppearance, resolveWorldDesignSprite } from '../apps/hmh-reboot/src/world-design-native-assets.mjs';
import { exposedWaterEdges, clipHorizontalWaterLine } from '../apps/hmh-reboot/src/world-design-water.mjs';
import { readFileSync } from 'node:fs';
import { LEVEL_ONE_WORLD } from '../apps/hmh-reboot/src/level-one-world.mjs';
import { buildWorldDesignPlacements, WORLD_DESIGN_ASSETS } from '../apps/hmh-reboot/src/world-design-layout.mjs';

test('native world art corrects camera projection and grounds the bridge once', () => {
  const frame = { frame: { w: 800, h: 320 }, anchor: { x: .5, y: .58 }, runtimeScale: .9, projectionY: Math.SQRT2 };
  const result = resolveWorldDesignSprite({ frame, placement: { x: 4750, y: 975, groundZ: 0, scale: 1 }, groundZ: 16, zoom: .5 });
  assert.equal(result.groundZ, 0);
  assert.equal(result.scaleX, .45);
  assert.equal(result.scaleY, .45 * Math.SQRT2);
  assert.equal(resolveWorldDesignSprite({ frame, placement: {}, groundZ: 32, zoom: 1 }).groundZ, 32);
});

test('a malformed native pack cannot suppress visible fallback blockers', () => {
  assert.throws(() => createWorldDesignAppearance({ pipeline: 'wrong' }, []), /world design/i);
});

const rect = (id, minX, minY, maxX, maxY) => ({ id, kind: 'water', area: { type: 'rect', minX, minY, maxX, maxY }, waterLevel: 4 });
test('joining water surfaces expose only the outer shoreline', () => {
  const edges = exposedWaterEdges([rect('river', 0, 0, 10, 30), rect('lake', 5, 20, 20, 40)]);
  const length = edges.reduce((sum, e) => sum + Math.hypot(e.b.x-e.a.x, e.b.y-e.a.y), 0);
  assert.equal(length, 120);
  assert.equal(edges.some(e => e.a.x === 10 && e.b.x === 10 && (e.a.y+e.b.y)/2 > 20), false);
  assert.equal(edges.some(e => e.a.y === 20 && e.b.y === 20 && (e.a.x+e.b.x)/2 < 10), false);
});
test('polygon water shimmer clips to shore even in a concave inlet', () => {
  const points = [{x:0,y:0},{x:20,y:0},{x:20,y:20},{x:15,y:20},{x:15,y:5},{x:5,y:5},{x:5,y:20},{x:0,y:20}];
  assert.deepEqual(clipHorizontalWaterLine(points, 10), [[0,5],[15,20]]);
});

const metadata=JSON.parse(readFileSync(new URL('../apps/portal/assets/generated/hmh-world-design/world-design.json',import.meta.url),'utf8'));
const textures=tier=>metadata.tiers[tier].pages.map(p=>({source:{width:p.width,height:p.height}}));
test('all delivered runtime views pass the same desktop and mobile loader contracts',()=>{
  for(const tier of ['desktop','mobile']) {
    const assets=createWorldDesignAppearance(metadata,textures(tier),{tier});
    assert.deepEqual([...assets.keys()].sort(),Object.values(WORLD_DESIGN_ASSETS).sort());
    const result=buildWorldDesignPlacements(LEVEL_ONE_WORLD,assets);
    assert.equal(result.blockerIds.size,23);
    assert.equal(new Set(result.placements.map(p=>p.id)).size,result.placements.length);
    assert.ok(result.placements.some(p=>p.assetId===WORLD_DESIGN_ASSETS.bridge&&p.groundZ===0));
    for(const id of result.blockerIds) assert.ok(LEVEL_ONE_WORLD.collisionBlockers.some(b=>b.id===id));
  }
});
test('failed loading retains the complete visible physics fallback',()=>{
  const result=buildWorldDesignPlacements(LEVEL_ONE_WORLD,new Map());
  assert.equal(result.blockerIds.size,0);assert.equal(result.placements.length,0);
});
test('world native metadata rejects an overlap, unknown view, or decoded size change',()=>{
  for(const mutate of [m=>m.frames[1].tiers.desktop.frame={...m.frames[0].tiers.desktop.frame},m=>m.frames[0].assetId='../bad',m=>m.frames[0].tiers.desktop.projectionY=1,m=>m.tiers.desktop.pages[0].width=1024,m=>m.frames[0].nativeABPixelExact=false]) {
    const changed=structuredClone(metadata);mutate(changed);
    assert.throws(()=>createWorldDesignAppearance(changed,textures('desktop')),TypeError);
  }
});
