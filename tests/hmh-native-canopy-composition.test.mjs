import test from 'node:test';
import assert from 'node:assert/strict';
import {LEVEL_ONE_WORLD as world} from '../apps/hmh-reboot/src/level-one-world.mjs';
import {buildWorldDesignPlacements,WORLD_DESIGN_ASSETS} from '../apps/hmh-reboot/src/world-design-layout.mjs';
const assets=new Map(Object.values(WORLD_DESIGN_ASSETS).map(id=>[id,{}]));
test('native Hashwood banks vary their silhouette and retain continuous grounded coverage',()=>{
  const plan=buildWorldDesignPlacements(world,assets);
  assert.deepEqual(plan,buildWorldDesignPlacements(world,assets));
  for(const feature of world.blockers.filter(b=>b.districtId==='hashwood'&&b.visualKind==='dense-trees'&&b.shape.type==='capsule')){
    const props=plan.placements.filter(p=>p.collisionBlockerId===feature.id);
    const brush=props.filter(p=>p.assetId===WORLD_DESIGN_ASSETS.hedge);
    const trees=props.filter(p=>p.assetId===WORLD_DESIGN_ASSETS.conifer);
    assert.ok(new Set(brush.map(p=>p.scale)).size>=3,'undergrowth must not repeat one uniform height');
    const {a,b,radius}=feature.shape,dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
    for(const p of props){
      const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(length*length)));
      assert.ok(Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy)<=radius,'all roots remain inside the visible physical bank');
    }
    for(let d=0;d<=length;d+=12){
      const x=a.x+dx*d/length,y=a.y+dy*d/length;
      assert.ok(brush.some(p=>Math.hypot(x-p.x,y-p.y)<=p.scale*.5),'a collision bank must never become visually empty');
    }
    assert.ok(trees.length<=Math.ceil(Math.ceil(length/92)/2)+1,'composition must not increase the tree draw budget');
  }
});
