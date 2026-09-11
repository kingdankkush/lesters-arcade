import test from 'node:test';
import assert from 'node:assert/strict';
import { worldDesignPropPresentation, prepareWorldDesignEnemyPose, worldDesignFootstep } from '../apps/hmh-reboot/src/world-design-life.mjs';

test('an enemy outside the animation budget keeps a real pose, and refreshes as soon as prioritized',()=>{
  let calls=0;
  const marker={applyPose:p=>({frame:++calls,state:p.state})};
  const first=prepareWorldDesignEnemyPose(marker,false,{state:'walk'});
  assert.equal(first.frame,1,'new bodies require an initial real pose even when the animation budget is full');
  assert.equal(prepareWorldDesignEnemyPose(marker,false,{state:'walk'}),first);
  assert.equal(calls,1);
  assert.equal(prepareWorldDesignEnemyPose(marker,true,{state:'attack'}).state,'attack');
  assert.equal(calls,2);
});
test('budget-limited enemies still show attack tells, hits, changed facing and phase immediately',()=>{
  const poses=[];
  const marker={applyPose:pose=>{const displayed={...pose};poses.push(displayed);return displayed;}};
  const first={state:'run',tick:100,direction:0,phase:'market-open',phaseTick:9};
  prepareWorldDesignEnemyPose(marker,false,first);
  assert.equal(prepareWorldDesignEnemyPose(marker,false,{...first,tick:101,phaseTick:10}),poses[0]);
  for(const change of [{state:'tell',phaseTick:0},{state:'attack',phaseTick:0},{state:'hit'}, {direction:4}, {phase:'margin-call'}, {elite:true}]) {
    Object.assign(first,change);first.tick++;
    const displayed=prepareWorldDesignEnemyPose(marker,false,first);
    for(const [key,value] of Object.entries(change))assert.equal(displayed[key],value,key);
  }
  assert.equal(poses.length,7,'each semantic transition refreshes exactly once');
  assert.equal(prepareWorldDesignEnemyPose(marker,false,{...first,tick:120,phaseTick:1}),poses.at(-1));
});
test('a repeated attack refreshes its starting pose even if render frames skipped the intervening state',()=>{
  let calls=0;const marker={applyPose:pose=>({frame:++calls,...pose})};
  const old={state:'attack',tick:100,direction:2,phaseTick:0};
  const first=prepareWorldDesignEnemyPose(marker,false,old);
  assert.equal(prepareWorldDesignEnemyPose(marker,false,{...old,tick:112,phaseTick:12}),first);
  const restarted=prepareWorldDesignEnemyPose(marker,false,{...old,tick:160,phaseTick:0});
  assert.equal(restarted.frame,2);
  assert.equal(restarted.phaseTick,0);
  assert.equal(prepareWorldDesignEnemyPose(marker,false,{...old,tick:161,phaseTick:1}),restarted);
});
test('foreground fades only when a body is concealed; reduced motion still preserves visibility',()=>{
  const options={placement:{assetId:'conifer-tree',x:4,y:5},bounds:{left:0,top:0,right:100,bottom:200},focusPoints:[{x:50,y:150}],tick:100};
  assert.equal(worldDesignPropPresentation(options).alpha,.38);
  assert.equal(worldDesignPropPresentation({...options,reduceMotion:true}).skewX,0);
  assert.equal(worldDesignPropPresentation({...options,focusPoints:[{x:120,y:150}]}).alpha,1);
  assert.equal(worldDesignPropPresentation({...options,placement:{...options.placement,occlusion:'deck'}}).alpha,1);
});
test('footsteps distinguish timber decks, elevated stone/metal, roads and woodland with existing licensed cues',()=>{
  const world={routes:[{width:100,points:[{x:0,y:0},{x:100,y:0}]}]};
  assert.equal(worldDesignFootstep(world,{kind:'bridge'},{x:0,y:0}).rate,.83);
  assert.equal(worldDesignFootstep(world,{groundZ:64},{x:0,y:0}).rate,1.2);
  assert.equal(worldDesignFootstep(world,{kind:'ground'},{x:50,y:0}).cue,'footstep-road');
  assert.equal(worldDesignFootstep(world,{kind:'ground'},{x:6900,y:4200}).rate,.77);
});
