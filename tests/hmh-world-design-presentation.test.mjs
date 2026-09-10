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
