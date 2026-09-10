import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorldDesignPacing, stepWorldDesignPacing } from '../apps/hmh-reboot/src/world-design-pacing.mjs';
import { createEncounterDirector, stepEncounterDirector } from '../apps/hmh-reboot/src/encounter-director.mjs';
import { createEnemyPopulation } from '../apps/hmh-reboot/src/enemy-simulation.mjs';
const arena={id:'clearing',anchor:{x:1000,y:2000},radius:360};
const player={x:1000,y:2000},enemy={x:1100,y:2000,active:true,health:20};
const step=(state,tick,enemies=[],position=player)=>stepWorldDesignPacing(state,{tick,player:position,enemies,arenas:[arena]});
test('a cleared fight earns one short recovery; visiting an empty arena does not suppress encounters',()=>{
  const state=createWorldDesignPacing();
  assert.equal(step(state,0).phase,'exploration');
  assert.equal(step(state,1,[enemy]).phase,'combat');
  for(let tick=2;tick<122;tick++) assert.equal(step(state,tick).recovery,false);
  assert.equal(step(state,122).recovery,true);
  assert.equal(step(state,601).recovery,true);
  assert.equal(step(state,602).recovery,false);
  step(state,603,[enemy]);
  for(let tick=604;tick<900;tick++) assert.equal(step(state,tick).recovery,false);
});
test('live pursuit resumes pressure during recovery and camera/device data cannot change pacing',()=>{
  const a=createWorldDesignPacing(),b=createWorldDesignPacing();
  for(let tick=0;tick<150;tick++) {
    const enemies=tick===0||tick===140?[enemy]:[];
    const left=step(a,tick,enemies);
    const right=stepWorldDesignPacing(b,{tick,enemies,player,arenas:[arena],viewport:{width:390},fog:true});
    assert.deepEqual(left,right);
    if(tick===140) assert.equal(left.recovery,false);
  }
});
test('the real director pauses due insertions during recovery and resumes its ordinary guarded spawn path',()=>{
  const state=createEncounterDirector(),population=createEnemyPopulation();
  const options={state,population,tick:0,districtId:'frontier-relay',player:{x:0,y:0,groundZ:0},camera:{minX:-480,maxX:480,minY:-270,maxY:270},spawnPoints:[{id:'east',regionId:'east',districtId:'frontier-relay',x:900,y:0}],queryGround:()=>({kind:'ground',groundZ:0,surfaceId:'flat'}),isBlocked:()=>false,isRouteReachable:()=>true,visualMode:'prototype'};
  const rest=stepEncounterDirector({...options,worldRecovery:true});
  assert.equal(rest.reason,'world-recovery-window');
  assert.equal(population.active.length,0);
  const resumed=stepEncounterDirector({...options,tick:state.schedule.nextSpawnTick,worldRecovery:false});
  assert.equal(resumed.inserted,true);
});
