import fs from 'node:fs';
import { LEVEL_ONE_WORLD as world } from '../apps/hmh-reboot/src/level-one-world.mjs';
import { WORLD_DESIGN_NEW_LOTS, WORLD_DESIGN_ASSETS } from '../apps/hmh-reboot/src/world-design-layout.mjs';
const path='docs/hmh-reboot/world-design/LEVEL-ONE-PLACEMENT-REQUESTS.json';
const plan=JSON.parse(fs.readFileSync(path,'utf8'));
const ids={'relay:old-well':'relay-stone-well','relay:north-hedge':'relay-hedgerow','relay:bus-shelter':'relay-bus-shelter','yard:south-warehouse':'yard-brick-warehouse','yard:overturned-bus':'yard-overturned-bus','yard:east-chapel':'yard-steepled-chapel','hashwood:hollow-stump':'hashwood-hollow-stump','hashwood:root-ball':'hashwood-uprooted-root'};
for(const row of plan.placements) {
  row.proposalSnapshot ??= {collisionPolicy:row.collisionPolicy,shape:row.shape,footprint:row.footprint,height:row.height};
  if(ids[row.id]) row.blockerId=ids[row.id];
  if(row.id==='yard:dead-signal') {
    row.collisionPolicy='visual-only-thin-fixture';
    row.integrationDecision='Thin signal fixture is scenery; it creates no hidden solid or navigation rule.';
  } else {
    const b=world.blockers.find(b=>b.id===row.blockerId);if(!b) throw Error(row.id);
    row.collisionPolicy='canonical-blocker';row.shape=b.shape;row.anchor=b.anchor;row.height=b.maxZ;
    if(b.shape.type==='polygon') row.footprint={width:Math.max(...b.shape.vertices.map(p=>p.x))-Math.min(...b.shape.vertices.map(p=>p.x)),depth:Math.max(...b.shape.vertices.map(p=>p.y))-Math.min(...b.shape.vertices.map(p=>p.y))};
    const lot=WORLD_DESIGN_NEW_LOTS.find(l=>l.id===b.id);
    if(lot) row.uniformSourceScale=lot.scale;
  }
  row.runtimeAdopted=true;row.integrationOwner='codex';row.browserVerification='pending-final-candidate';
  if(row.source) row.source.existingGameAssetId=row.source.proposedGameAssetId;
  if(row.canopyLobes) row.integrationDecision='Continuous textured undergrowth follows the preserved collision capsule; repeated native conifer clusters provide height variation.';
}
for(const row of plan.groundMaterialRequests) {row.runtimeAdopted=true;row.integrationOwner='codex';}
plan.integrationStatus='paired-runtime-native-world; final candidate verification pending';
plan.nativeRuntimeManifest='apps/portal/assets/generated/hmh-world-design/world-design.json';
fs.writeFileSync(path,JSON.stringify(plan,null,2)+'\n');
console.log('Reconciled 26 placement decisions and 5 ground paths with runtime adoption.');
