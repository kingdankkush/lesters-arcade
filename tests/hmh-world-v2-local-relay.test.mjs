import assert from 'node:assert/strict';
import test from 'node:test';
import { createGreyboxWorld } from '../apps/hmh-reboot/src/dev/greybox-world-v1.mjs';
import { createWorldV2Geometry } from '../apps/hmh-reboot/src/world-v2-geometry.mjs';
import { createWorldV2LocalRuntime } from '../apps/hmh-reboot/src/dev/world-v2-local-runtime.mjs';
import { createCollisionBody,createStaticBlocker,resolveSweptCircleMotion } from '../apps/hmh-reboot/src/collision.mjs';
import { traceHeightAwareLineOfSight } from '../apps/hmh-reboot/src/elevation.mjs';
import { createMissionState,stepMissionObjectives,MISSION_RULES } from '../apps/hmh-reboot/src/mission-objectives.mjs';
import { FIXED_STEP_MS } from '../apps/hmh-reboot/src/simulation.mjs';
const module=await import('../apps/hmh-reboot/src/dev/world-v2-local-relay.mjs').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return{};throw error;});
const makePlan=(world=createGreyboxWorld())=>{assert.equal(typeof module.createLocalMeadowsRelayPlan,'function');return module.createLocalMeadowsRelayPlan(world);};
const create=(plan,geometry)=>{assert.equal(typeof module.createLocalRelay,'function');return module.createLocalRelay({plan,geometry});};
const still={x:0,y:0},moving={x:1,y:0};
function setup(extraBlockers=[]){
 const world=createGreyboxWorld(),plan=makePlan(world);
 const bounds={minX:12800,minY:6000,maxX:13300,maxY:6500};
 const geometry=createWorldV2Geometry({...world,bounds,areas:[{id:'mweb-meadows',name:'Relay local fixture',bounds}],roads:[],sites:[],
   spawn:{x:plan.operate.x,y:plan.operate.y+60},collisionBlockers:[world.collisionBlockers.find(b=>b.id===plan.blockerId),...extraBlockers]});
 return {world,plan,geometry,relay:create(plan,geometry)};
}
const player=(plan,dx=0,dy=0,z=0)=>({x:plan.operate.x+dx,y:plan.operate.y+dy,groundZ:z});
function oracle(plan){return createMissionState(0,{objectives:[{id:plan.id,objectiveClass:'switch',districtId:'private-meadows',name:'Local relay',
 task:'Restore the relay',kind:'generator',mode:'quick',clip:'press',fillTicks:30,ringRadius:72,anchor:plan.operate,
 operate:{...plan.operate,facing:'north'},propBlockerId:null,requires:null,xpPerLevel:0,effects:[]}],bossZones:[],prisoners:[]});}
function oracleStep(state,{tick,player,move,geometry}){return stepMissionObjectives(state,{tick,player,move,queryGround:geometry.queryGround,
 lineClear:(from,to)=>traceHeightAwareLineOfSight({from:{x:from.x,y:from.y,z:from.groundZ+24},to:{x:to.x,y:to.y,z:to.groundZ+24},blockers:geometry.collisionBlockers}).clear});}

test('one inert Meadows marker and clear approach are bound to the existing equipment south face',()=>{
 const world=createGreyboxWorld(),plan=makePlan(world),piece=world.pieces.find(p=>p.id==='mweb-meadows-relay-equipment');
 const b=piece.visible.bounds,site=world.sites.find(s=>s.id==='mweb-meadows-objective');
 assert.deepEqual(plan.operate,{x:(b.minX+b.maxX)/2,y:b.maxY+64});assert.deepEqual(plan.operate,{x:13020,y:6209});
 assert.deepEqual(plan.lamp,{x:13020,y:6145,z:66});assert.ok(Object.isFrozen(plan.lamp));
 assert.equal(plan.blockerId,piece.blocker.id);assert.equal(plan.siteId,site.id);assert.equal(site.runtimeEffect,'none');
 assert.deepEqual({x:site.x,y:site.y},plan.operate);assert.deepEqual(site.approach,{x:13020,y:6400});
 assert.equal(plan.officialRun,false);assert.equal(plan.rankedEligible,false);assert.deepEqual(plan.rewards,[]);
 assert.ok(Object.isFrozen(plan)&&Object.isFrozen(plan.operate)&&Object.isFrozen(plan.rewards));
 const sweep=resolveSweptCircleMotion({body:createCollisionBody({id:'relay-player',radius:24,minZ:0,maxZ:56}),
  start:{...site.approach,z:0},delta:{x:site.x-site.approach.x,y:site.y-site.approach.y},blockers:world.collisionBlockers,
  bounds:{...world.bounds,visibleBoundaryId:'local-world-edge'}});
 assert.deepEqual(sweep.contacts,[]);assert.equal(sweep.position.x,site.x);assert.equal(sweep.position.y,site.y);
});

test('local quick relay matches the real mission oracle every tick while moving and while pressing',()=>{
 for(const move of [still,moving]){
  const {plan,geometry,relay}=setup(),state=oracle(plan),at=player(plan),events=[];
  assert.equal(MISSION_RULES.quick.commitTicks,12);assert.equal(MISSION_RULES.quick.ringRadius,72);assert.equal(MISSION_RULES.heightBand,8);
  for(let tick=0;tick<70;tick++){
   const input={tick,player:at,move};relay.step(input);events.push(...oracleStep(state,{...input,geometry}).events);
   const expected=state.zoneState.get(plan.id),actual=relay.snapshot();
   assert.equal(actual.progressTicks,expected.progress);assert.equal(actual.committed,expected.committed);assert.equal(actual.commitTick,expected.commitTick);
   assert.equal(actual.completionTick,state.completed.get(plan.id)??null);assert.equal(actual.operating,Boolean(state.operating));
  }
  assert.equal(relay.snapshot().completionTick,40);assert.equal(events.length,1);assert.deepEqual(events[0].effects,[]);assert.equal(events[0].xpPerLevel,0);
 }
});

test('departure at11 resets commitment; departure after12 preserves exactly-once completion',()=>{
 for(const dwell of [11,12]){
  const {plan,geometry,relay}=setup(),state=oracle(plan);
  for(let tick=0;tick<100;tick++){
   const at=player(plan,0,tick<dwell||tick>=60?0:150),input={tick,player:at,move:moving};
   relay.step(input);oracleStep(state,{...input,geometry});
   const got=relay.snapshot(),z=state.zoneState.get(plan.id);
   assert.equal(got.progressTicks,z.progress);assert.equal(got.completionTick,state.completed.get(plan.id)??null);
   if(tick===dwell&&dwell===11){assert.equal(got.insideTicks,0);assert.equal(got.committed,false);}
  }
  assert.equal(relay.snapshot().completionTick,dwell===12?40:null);
 }
});

test('actual blocker LOS and exact radius/height boundaries gate consecutive eligible ticks',()=>{
 const barrier=createStaticBlocker({id:'temporary-test-wall',visibleAssetId:'test-wall',minZ:0,maxZ:100,
  shape:{type:'polygon',vertices:[{x:12900,y:6230},{x:13200,y:6230},{x:13200,y:6240},{x:12900,y:6240}]}});
 for(const [name,dx,dy,z,blocked,eligible]of [['wall',0,55,0,true,false],['above',0,0,8.01,false,false],['outside',72.01,0,0,false,false],['height-edge',0,0,8,false,true],['ring-edge',72,0,0,false,true]]){
  const {plan,geometry,relay}=setup(blocked?[barrier]:[]),state=oracle(plan);
  for(let tick=0;tick<12;tick++){const input={tick,player:player(plan,dx,dy,z),move:still};relay.step(input);oracleStep(state,{...input,geometry});}
  assert.equal(relay.snapshot().committed,eligible,name);assert.equal(relay.snapshot().committed,state.zoneState.get(plan.id).committed,name);
 }
});

test('completed and disposed state cannot progress twice or escape through mutable snapshots',()=>{
 const {plan,relay}=setup();for(let tick=0;tick<50;tick++)relay.step({tick,player:player(plan),move:still});
 const saved=relay.snapshot();assert.ok(Object.isFrozen(saved));assert.throws(()=>{saved.progressTicks=999;},TypeError);
 assert.throws(()=>relay.step({tick:49,player:player(plan),move:still}),/tick/);
 assert.throws(()=>relay.step({tick:50.5,player:player(plan),move:still}),/tick/);
 relay.dispose();relay.dispose();const closed=relay.snapshot();relay.step({tick:100,player:player(plan),move:still});assert.deepEqual(relay.snapshot(),closed);
 assert.equal(closed.completionTick,40);assert.equal(closed.disposed,true);
});

test('real local runtime commits on admitted60Hz ticks and pauses without advancing the relay',async()=>{
 const {plan,geometry}=setup(),runtime=createWorldV2LocalRuntime({geometry,relayPlan:plan,scheduleYield:async()=>{}});
 try{
  await runtime.ready;assert.equal(runtime.snapshot().relay.committed,false);runtime.start();
  for(let i=0;i<11;i++)runtime.advance(FIXED_STEP_MS,{move:still});
  assert.equal(runtime.snapshot().relay.committed,false);runtime.pause();const paused=runtime.snapshot();runtime.advance(1000,{move:still});assert.deepEqual(runtime.snapshot(),paused);
  runtime.resume();runtime.advance(FIXED_STEP_MS,{move:still});assert.equal(runtime.snapshot().relay.committed,true);
  for(let i=0;i<29;i++)runtime.advance(FIXED_STEP_MS,{move:still});assert.equal(runtime.snapshot().relay.completionTick,41);
  runtime.dispose();assert.equal(runtime.snapshot().phase,'disposed');assert.equal(runtime.snapshot().relay.disposed,true);
 }finally{runtime.dispose();}
});

test('relay ticks and actual motion are identical across1/2/4-step frame partitions',async()=>{
 const records=[];
 for(const partition of [1,2,4]){
  const {plan,geometry}=setup(),runtime=createWorldV2LocalRuntime({geometry,relayPlan:plan,scheduleYield:async()=>{}});
  try{await runtime.ready;runtime.start();for(let i=0;i<60;i+=partition)runtime.advance(FIXED_STEP_MS*partition,{move:still});const s=runtime.snapshot();records.push({tick:s.tick,actor:s.actor,relay:s.relay});}
  finally{runtime.dispose();}
 }
 assert.deepEqual(records[1],records[0]);assert.deepEqual(records[2],records[0]);
});

test('ordinary local movement remains unchanged and arbitrary reward or canonical plans are rejected',async()=>{
 const {plan,geometry}=setup();const off=createWorldV2LocalRuntime({geometry,scheduleYield:async()=>{}}),on=createWorldV2LocalRuntime({geometry,relayPlan:plan,scheduleYield:async()=>{}});
 try{
  await Promise.all([off.ready,on.ready]);off.start();on.start();
  for(let i=0;i<45;i++){off.advance(FIXED_STEP_MS,{move:moving});on.advance(FIXED_STEP_MS,{move:moving});assert.deepEqual(on.snapshot().actor,off.snapshot().actor);}
  assert.equal(off.snapshot().relay,null);
  for(const change of [{officialRun:true},{rankedEligible:true},{rewards:[{xp:1}]},{fillTicks:1},{id:'relay-power'}])
   assert.throws(()=>create(Object.freeze({...plan,...change}),geometry),/local|relay|plan|reward/);
 }finally{off.dispose();on.dispose();}
});
