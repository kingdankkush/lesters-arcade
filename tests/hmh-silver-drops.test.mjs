import test from 'node:test';
import assert from 'node:assert/strict';
import {createSilverDropState,addSilverDrop,stepSilverDrops,silverDropAccounting} from '../apps/hmh-reboot/src/silver-drops.mjs';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

test('silver conserves value across pooling, collection and expiry without a score or XP channel',()=>{
  const s=createSilverDropState();
  for(let i=1;i<=250;i++)addSilverDrop(s,{sequence:i,tick:1,x:i,y:0,value:1});
  assert.equal(s.drops.length,64);
  assert.equal(s.drops.filter(d=>d.active).length,64);
  assert.equal(silverDropAccounting(s).active,250);
  stepSilverDrops(s,{tick:2,player:{x:50,y:0},canReach:()=>true});
  const partial=silverDropAccounting(s);
  assert.ok(partial.collected>0);
  stepSilverDrops(s,{tick:1801,player:{x:10000,y:0},canReach:()=>true});
  const final=silverDropAccounting(s);
  assert.equal(final.dropped,final.collected+final.expired);
  assert.equal(final.active,0);
  assert.equal(Object.hasOwn(s,'score'),false);
  assert.equal(Object.hasOwn(s,'xp'),false);
});
test('duplicate and older defeat sequences cannot duplicate silver',()=>{
  const s=createSilverDropState();
  const drop={sequence:2,tick:1,x:0,y:0,value:10};
  assert.equal(addSilverDrop(s,drop),true);
  assert.equal(addSilverDrop(s,drop),false);
  assert.equal(addSilverDrop(s,{...drop,sequence:1}),false);
  assert.equal(silverDropAccounting(s).dropped,10);
});
test('walls and pause prevent collection or advancing expiry, while restart is empty',()=>{
  const s=createSilverDropState();addSilverDrop(s,{sequence:1,tick:1,x:0,y:0,value:1});
  assert.equal(stepSilverDrops(s,{tick:2,player:{x:0,y:0},canReach:()=>false}),0);
  assert.equal(silverDropAccounting(s).active,1);
  assert.equal(stepSilverDrops(s,{tick:3,player:{x:0,y:0},canReach:()=>true}),1);
  assert.equal(stepSilverDrops(s,{tick:4,player:{x:0,y:0},canReach:()=>true}),0);
  assert.throws(()=>stepSilverDrops(s,{tick:4,player:{x:0,y:0}}),/monotonic/);
  assert.deepEqual(silverDropAccounting(createSilverDropState()),{dropped:0,collected:0,expired:0,active:0});
});

test('native silver atlas is bounded and bound to the actual editable source and recipe',()=>{
  const root=new URL('../',import.meta.url),dir=new URL('apps/portal/assets/generated/hmh-silver-coin/',root);
  const m=JSON.parse(readFileSync(new URL('manifest.json',dir)));
  const image=readFileSync(new URL(m.image,dir));
  const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
  assert.equal(image.readUInt32BE(16),576);assert.equal(image.readUInt32BE(20),192);
  assert.ok(image.length<=100*1024);
  assert.equal(sha(image),m.imageSha256);
  assert.equal(sha(readFileSync(new URL(m.source,root))),m.sourceSha256);
  assert.equal(sha(readFileSync(new URL(m.recipe,root))),m.recipeSha256);
  assert.equal(m.scoreXpAuthority,'none');
});
