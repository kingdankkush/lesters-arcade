import test from 'node:test';
import assert from 'node:assert/strict';
import {buildWorldDecals,drawWorldDecals,MAX_WORLD_DECALS} from '../apps/hmh-reboot/src/world-decals.mjs';
import {LEVEL_ONE_WORLD as world} from '../apps/hmh-reboot/src/level-one-world.mjs';
test('the yard gets concrete fractures and industrial spills within the existing decal budget',()=>{
 const decals=buildWorldDecals({world});
 assert.ok(decals.some(d=>d.kind==='concrete-crack'&&d.districtId==='liquidation-yard'));
 assert.ok(decals.some(d=>d.kind==='oil-stain'&&d.districtId==='liquidation-yard'));
 assert.ok(decals.length<=MAX_WORLD_DECALS);
 assert.ok(decals.filter(d=>d.kind==='concrete-crack').every(d=>d.runtimeAuthority==='projection-only'));
});
test('wheel scuffs follow the direction of their authored road',()=>{
 const points=[];
 const target={moveTo(x,y){points.push({x,y});return this;},lineTo(x,y){points.push({x,y});return this;},stroke(){return this;},ellipse(){return this;},fill(){return this;}};
 drawWorldDecals({target,decals:[{kind:'tire-rut',x:100,y:100,radius:10,rotation:Math.PI/2}],camera:{zoom:1},view:{width:400,height:400},project:p=>p});
 assert.equal(points.length,2);
 assert.ok(Math.abs(points[0].x-points[1].x)<1e-6);
 assert.ok(points[1].y-points[0].y>70);
});
