import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createGreyboxWorld } from '../apps/hmh-reboot/src/dev/greybox-world-v1.mjs';
import { createWorldV2RuntimeWorld } from '../apps/hmh-reboot/src/world-v2-runtime-world.mjs';
import { validateAreaArtPlan, createPlacementGuard, pointInPolygon, MEADOW_DETAIL_FRAMES } from '../apps/hmh-reboot/src/world-v2-area-art-schema.mjs';
import { cardBlocks } from '../apps/hmh-reboot/src/world-v2-area-plans/card-footprints.mjs';
import { collectTenAreaCards } from '../scripts/audit-ten-area-collision-art.mjs';

const kit = JSON.parse(fs.readFileSync(new URL('../apps/portal/assets/generated/hmh-reboot-tripo-props-hd/hmh-tripo-props-hd.json', import.meta.url)));
const world = createGreyboxWorld(), runtime = createWorldV2RuntimeWorld(), before = JSON.stringify(world);
const plans = [];
const centreRows = plan => [...plan.props,...plan.ground.decals].filter(p=>p.id.startsWith(`${plan.areaId}-centre-`));
for (const district of Object.values(runtime.artPlans.districts)) {
  const factory = await district.artTarget.load();
  plans.push(factory(world));
}

test('every district has authored near-centre pockets using its already loaded kit pages', () => {
  for (const plan of plans) {
    const area = world.areas.find(a => a.id === plan.areaId);
    const rows = centreRows(plan);
    assert.ok(rows.length >= 8, `${area.id}: ${rows.length} centre dressing instances`);
    assert.ok(rows.some(p => Math.abs(p.x-area.center.x)<500 && Math.abs(p.y-area.center.y)<400), `${area.id}: visible from centre`);
    validateAreaArtPlan(plan, kit);
  }
});

test('spawn has planted garden pockets in the first screen while combat and routes remain open', () => {
  const plan = plans.find(p => p.areaId === 'mweb-meadows');
  const rows = centreRows(plan);
  assert.ok(rows.filter(p => Math.hypot(p.x-world.spawn.x,p.y-world.spawn.y)<560).length >= 18);
  for (const plan of plans) {
    const guard = createPlacementGuard({world, areaId:plan.areaId, spawnClearance:150, routeClearance:74, siteClearance:150});
    const arrivalGuard = createPlacementGuard({world:{...world,sites:world.sites.filter(s=>s.id!=='mweb-meadows-area')},areaId:'mweb-meadows',spawnClearance:60,routeClearance:20,siteClearance:150});
    for (const p of centreRows(plan)) {
      assert.equal(cardBlocks(p.source,p.height),false,`${p.id} cannot add a collider`);
      if(p.id.startsWith('mweb-meadows-centre-arrival-')) {
        const frame=MEADOW_DETAIL_FRAMES[p.source],half=frame.w*frame.scale*p.scale/2;
        for(const [dx,dy] of [[-half,-half],[half,-half],[half,half],[-half,half]]) assert.ok(arrivalGuard.clear(p.x+dx,p.y+dy),`${p.id} full frame clears collision, water, road, route and objective`);
      }
      else if ((p.groundZ??0)>0) assert.ok(world.pieces.some(s=>s.blocker && s.visible.height===p.groundZ && pointInPolygon(p.x,p.y,s.blocker.shape.vertices)),`${p.id} roots on its authored ledge`);
      else assert.ok(guard.clear(p.x,p.y,10),`${p.id} avoids water, routes and sites`);
    }
  }
  assert.equal(JSON.stringify(world),before,'presentation leaves authored geometry byte-identical');
});

test('Meadows arrival pockets use soft native ground patches rather than thorn cages and white slab flowers', () => {
  const plan = plans.find(p=>p.areaId==='mweb-meadows');
  const rows = centreRows(plan);
  assert.ok(rows.length >= 18);
  assert.ok(rows.every(p=>p.source.startsWith('detail:meadow-')));
  assert.ok(rows.every(p=>p.scale<=1),'patch footprint is at most 82 world units; the native low-height ground mesh preserves hero visibility');
  const summary = validateAreaArtPlan(plan,kit);
  assert.equal(summary.nativeMeadowDetails,true);
  assert.ok(summary.budget.tileDecodedBytes<=8*1024*1024);
  for(const other of plans.filter(p=>p!==plan)) assert.equal(validateAreaArtPlan(other,kit).nativeMeadowDetails,false);
});

test('Meadows low foliage actually reads inside the normal portrait phone arrival view', () => {
  const plan = plans.find(p=>p.areaId==='mweb-meadows');
  // Captured normal Lilly camera: 414x896 CSS pixels at zoom 1.7655.
  // Keep this acceptance below the HUD and above touch controls, rather than
  // calling plants 300 world units to either side a phone-visible composition.
  const rows = centreRows(plan).filter(p=>Math.abs(p.x-world.spawn.x)<112 && Math.abs(p.y-world.spawn.y)<205);
  assert.ok(rows.length>=12, `${rows.length} native patches in the phone playfield`);
  for(const p of rows) {
    const frame=MEADOW_DETAIL_FRAMES[p.source];
    assert.ok(frame.w*frame.scale*p.scale>=60, `${p.id}: native patch is readable, not twice reduced to a tiny tuft`);
  }
  for(const [name,accept] of [
    ['relay verge',p=>p.x>world.spawn.x && p.y<world.spawn.y],
    ['southwest bed',p=>p.x<world.spawn.x && p.y>world.spawn.y],
    ['southeast bed',p=>p.x>world.spawn.x && p.y>world.spawn.y],
  ]) assert.ok(rows.filter(accept).length>=2, `${name} has authored clustered planting`);
});

test('City roof buildings occupy separate footprints rather than clipping through each other', async () => {
  const {cards} = await collectTenAreaCards();
  const buildings = cards.filter(c=>c.planId==='litecoin-city' && c.collisionClass==='building' && c.groundZ>0);
  const overlaps = [];
  for (let i=0;i<buildings.length;i++) for(let j=i+1;j<buildings.length;j++) {
    const a=buildings[i],b=buildings[j],f=a.paintedFootprint,g=b.paintedFootprint;
    if(a.groundZ===b.groundZ && f.maxX>g.minX && f.minX<g.maxX && f.maxY>g.minY && f.minY<g.maxY) overlaps.push([a.id,b.id]);
  }
  assert.deepEqual(overlaps,[]);
});
