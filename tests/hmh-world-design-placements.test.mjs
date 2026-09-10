import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LEVEL_ONE_WORLD as world, createLevelOneGroundQuery } from '../apps/hmh-reboot/src/level-one-world.mjs';
import { createCollisionBody, createStaticBlocker, resolveSweptCircleMotion } from '../apps/hmh-reboot/src/collision.mjs';
import { resolveSweptTraversalPath } from '../apps/hmh-reboot/src/elevation.mjs';

const plan = JSON.parse(readFileSync(new URL('../docs/hmh-reboot/world-design/LEVEL-ONE-PLACEMENT-REQUESTS.json',import.meta.url),'utf8'));
const proposed = plan.placements.filter(row => row.proposalSnapshot?.collisionPolicy === 'proposed-solid' && row.collisionPolicy === 'canonical-blocker');
const additions = plan.placements.filter(row => proposed.includes(row) || row.blockerId?.startsWith('relay-abandoned-'));
const nodes = new Map(world.routeGraph.nodes.map(row => [row.id,row]));
const queryGround = createLevelOneGroundQuery();
const solid = row => createStaticBlocker({id:row.id,shape:row.shape,visibleAssetId:row.id,minZ:0,maxZ:row.height});

test('batch-qualified asset requests stay separate from existing gameplay and reserve-model IDs', () => {
  assert.equal(plan.batch2Decisions.length,40);
  assert.equal(new Set(plan.placements.map(row=>row.id)).size,plan.placements.length);
  for (const row of plan.placements) {
    assert.equal(row.runtimeAdopted,true);
    assert.ok(['canonical-blocker','visual-only-thin-fixture'].includes(row.collisionPolicy));
    assert.ok(row.integrationDependencies.length);
    if (!row.source) { assert.ok(row.existingArtId); continue; }
    const source = row.source;
    assert.match(source.assetKey,/^hmh-ld2-\d{2}-[a-z0-9-]+$/);
    assert.equal(source.existingGameAssetId,source.assetKey,'adopted sources keep their batch-qualified runtime binding');
    assert.equal(source.proposedGameAssetId,source.assetKey);
    assert.match(source.glb.replaceAll('\\','/'),/\/delivery\/HMH-Level-Design-Batch-2-Models\/GLB\//);
    const verified = plan.batch2Decisions.find(asset=>asset.assetKey===source.assetKey);
    assert.ok(verified);
    assert.equal(source.glbSha256,verified.glbSha256);
    assert.equal(source.blenderSha256,verified.blenderSha256);
  }
});

test('existing collision-backed requests match the authoritative footprint and ground exactly', () => {
  for (const row of plan.placements.filter(row=>row.collisionPolicy==='canonical-blocker')) {
    const blocker = world.blockers.find(item=>item.id===row.blockerId);
    assert.ok(blocker,row.id);
    assert.deepEqual(row.shape,blocker.shape,row.id);
    assert.deepEqual(row.anchor,blocker.anchor,row.id);
    assert.equal(queryGround(row.anchor.x,row.anchor.y).groundZ,row.ground.z,row.id);
  }
  const relocation = plan.companionChanges.find(row=>row.id==='camp:relay-picket');
  const arena=world.encounterArenas.find(row=>row.id==='relay-training-yard');
  assert.deepEqual(relocation.after,{...arena.anchor,radius:arena.radius});
});

test('new solid reservations leave spawn, full arena circles, POIs and enemy spawn anchors clear', () => {
  for (const row of additions) {
    const radius=Math.hypot(row.footprint.width,row.footprint.depth)/2;
    const discs=[{id:'protected-spawn',anchor:world.player.spawn,radius:560},...world.encounterArenas,
      ...world.pointsOfInterest.map(poi=>({...poi,radius:80})),
      ...world.spawnPoints.map(point=>({id:point.id,anchor:point,radius:24}))];
    for (const disc of discs) {
      const clearance=Math.hypot(row.anchor.x-disc.anchor.x,row.anchor.y-disc.anchor.y)-radius-disc.radius;
      assert.ok(clearance>=24,`${row.id} too near ${disc.id}: ${clearance.toFixed(2)}`);
    }
  }
});

test('adopted new solid lots remain disjoint from every other body on dry flat ground', () => {
  assert.equal(proposed.length,8,'every approved solid lot is checked');
  for (const row of proposed) {
    const body=createCollisionBody({id:'reservation',kind:'player',radius:Math.hypot(row.footprint.width,row.footprint.depth)/2+24,minZ:0,maxZ:42});
    for (const blocker of world.collisionBlockers.filter(blocker=>blocker.id!==row.blockerId)) {
      const result=resolveSweptCircleMotion({body,start:{...row.anchor,z:0},delta:{x:0,y:0},blockers:[blocker],bounds:world.bounds});
      assert.equal(result.depenetrations.length,0,`${row.id} conflicts with ${blocker.id}`);
      assert.ok(Math.hypot(result.position.x-row.anchor.x,result.position.y-row.anchor.y)<1e-6,`${row.id} reaches world boundary`);
    }
    for (const point of [row.anchor,...row.shape.vertices]) {
      const ground=queryGround(point.x,point.y);
      assert.equal(ground.groundZ,0,row.id);
      assert.equal(ground.deepWater,false,row.id);
    }
  }
});

test('new structures keep their footprints and a 24-unit margin outside full route ribbons', () => {
  const paths=[...world.routes.map(route=>({id:route.id,width:route.width,points:route.nodeIds.map(id=>nodes.get(id))})),...plan.groundMaterialRequests];
  for (const path of paths) for (const row of additions) {
    const body=createCollisionBody({id:'route-ribbon',kind:'player',radius:path.width/2+24,minZ:0,maxZ:42});
    for(let i=1;i<path.points.length;i++) {
      const start=path.points[i-1],end=path.points[i];
      const result=resolveSweptCircleMotion({body,start:{...start,z:0},delta:{x:end.x-start.x,y:end.y-start.y},blockers:[solid(row)]});
      assert.equal(result.contacts.length+result.depenetrations.length,0,`${row.id} enters ${path.id}`);
    }
  }
});

test('ground requests remain flat, traversable ribbons with no raised slab or interaction semantics', () => {
  for (const path of plan.groundMaterialRequests) {
    assert.equal(path.collisionPolicy,'visual-only-ground');
    assert.equal(path.groundZ,0);
    const body=createCollisionBody({id:'ground-ribbon',kind:'player',radius:path.width/2+24,minZ:0,maxZ:42});
    for(let i=1;i<path.points.length;i++) {
      const start=path.points[i-1],end=path.points[i];
      const result=resolveSweptCircleMotion({body,start:{...start,z:0},delta:{x:end.x-start.x,y:end.y-start.y},blockers:world.collisionBlockers,bounds:world.bounds});
      assert.equal(result.contacts.length+result.depenetrations.length,0,path.id);
      assert.ok(resolveSweptTraversalPath({start,end,queryGround,maxSampleDistance:4}).allowed,path.id);
    }
  }
});

test('Hashwood canopy variation retains its continuous visible physical bank', () => {
  for (const row of plan.placements.filter(row=>row.canopyLobes)) {
    assert.equal(row.collisionPolicy,'canonical-blocker');
    assert.equal(row.continuousRootBankRequired,true);
    assert.equal(row.visualHeightDoesNotChangeCollision,true);
    assert.ok(new Set(row.canopyLobes.map(lobe=>lobe.height)).size>=3);
    assert.ok(new Set(row.canopyLobes.map(lobe=>lobe.radius)).size>=3);
    assert.equal(row.canopyLobes[0].x,row.shape.a.x);
    assert.equal(row.canopyLobes.at(-1).x,row.shape.b.x);
  }
});
