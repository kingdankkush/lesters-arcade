import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWorldDesignCampfires } from '../apps/hmh-reboot/src/world-design-life.mjs';
const fires=Array.from({length:20},(_,i)=>({id:`fire-${i}`,assetId:'campfire-ring',x:100+i*10,y:100}));
const options={placements:fires,worldToScreen:p=>p,queryGround:()=>({groundZ:0}),camera:{zoom:1},view:{width:600,height:400},tick:42,particleBudget:5};
test('campfires have grounded warm light and bounded moving embers with deterministic projection',()=>{
 const result=buildWorldDesignCampfires(options);assert.equal(result.fires.length,4);assert.equal(result.embers.length,5);assert.ok(result.fires.every(f=>f.radius>20&&f.alpha<.2));
 assert.deepEqual(result,buildWorldDesignCampfires(options));assert.notDeepEqual(result.embers,buildWorldDesignCampfires({...options,tick:72}).embers);
 assert.equal(buildWorldDesignCampfires({...options,reduceMotion:true}).embers.length,0);
 assert.equal(buildWorldDesignCampfires({...options,particleBudget:0}).embers.length,0);
 assert.equal(buildWorldDesignCampfires({...options,worldToScreen:()=>({x:-500,y:-500})}).fires.length,0);
 assert.equal(fires[0].x,100);
});
