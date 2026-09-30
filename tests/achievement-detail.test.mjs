import assert from 'node:assert/strict';
import test from 'node:test';
const load = () => import('../apps/portal/src/achievements/detail-view.mjs');
const row = Object.freeze({id:'first-flight',gameId:'chikun',title:'First Flight',gameTitle:'Chikun’s Escape',tier:'bronze',description:'Finish a verified flight.',image:'/badge.webp',unlocked:true,unlockedAt:'2026-09-29T12:00:00.000Z',rarity:{label:'Rare',percentage:5}});
function setup(reduced=false){
 const listeners=new Map(),nodes=[];
 const make=tag=>{
  const events=new Map(),node={tag,children:[],attributes:{},style:{},isConnected:true,open:false,
   append(...items){this.children.push(...items);},setAttribute(k,v){this.attributes[k]=String(v);},
   addEventListener(k,fn){events.set(k,fn);},removeEventListener(k,fn){if(events.get(k)===fn)events.delete(k);},
   fire(k,event={}){events.get(k)?.({preventDefault(){},...event});},
   showModal(){this.open=true;},close(){this.open=false;this.fire('close');},
   focus(){documentRef.activeElement=this;},remove(){this.isConnected=false;},
   setPointerCapture(id){this.captured=id;},hasPointerCapture(id){return this.captured===id;},releasePointerCapture(){this.captured=null;},
  };nodes.push(node);return node;
 };
 const documentRef={hidden:false,activeElement:null,createElement:make,body:make('body'),addEventListener:(k,fn)=>listeners.set(k,fn),removeEventListener:(k,fn)=>{if(listeners.get(k)===fn)listeners.delete(k);}};
 const media={matches:reduced,addEventListener:(k,fn)=>listeners.set('media:'+k,fn),removeEventListener:(k,fn)=>{if(listeners.get('media:'+k)===fn)listeners.delete('media:'+k);}};
 const windowRef={matchMedia:()=>media,addEventListener:(k,fn)=>listeners.set('window:'+k,fn),removeEventListener:(k,fn)=>{if(listeners.get('window:'+k)===fn)listeners.delete('window:'+k);}};
 return{documentRef,windowRef,nodes,listeners,media,find:cls=>nodes.find(n=>n.className===cls)};
}
test('detail opens one labelled native dialog with factual text and no requests',async()=>{
 const {createAchievementDetail}=await load(),env=setup(),view=createAchievementDetail(env);
 view.open(row);const dialog=env.find('achievement-detail'),allText=env.nodes.map(n=>n.textContent).join(' ');
 assert.equal(dialog.open,true);assert.equal(dialog.attributes['aria-labelledby'],'achievement-detail-title');
 assert.equal(dialog.attributes['aria-describedby'],'achievement-detail-requirement');
 assert.equal(env.find('achievement-detail-status').textContent,'Earned');
 assert.match(env.find('achievement-detail-rarity').textContent,/Rare.*5%/);
 assert.match(allText,/First Flight/);assert.match(allText,/Finish a verified flight/);assert.match(allText,/Earned/);assert.doesNotMatch(allText,/mint|NFT|settled|100% complete/i);
 view.open({...row,title:'Updated title'});assert.equal(env.nodes.filter(n=>n.tag==='dialog').length,1);view.dispose();
});
test('drag is bounded to 35 degrees and only the captured primary pointer can move it',async()=>{
 const {createAchievementDetail}=await load(),env=setup(),view=createAchievementDetail(env);view.open(row);
 const stage=env.find('achievement-detail-stage'),art=env.find('achievement-detail-art');
 stage.fire('pointerdown',{pointerId:7,isPrimary:true,button:0,clientX:100,clientY:100});
 stage.fire('pointermove',{pointerId:8,clientX:10000,clientY:-10000});assert.match(art.style.transform,/rotateX\(0deg\).*rotateY\(0deg\)/);
 stage.fire('pointermove',{pointerId:7,clientX:10000,clientY:-10000});assert.match(art.style.transform,/rotateX\(35deg\).*rotateY\(35deg\)/);
 stage.fire('pointerup',{pointerId:7});assert.match(art.style.transform,/rotateX\(0deg\).*rotateY\(0deg\)/);assert.equal(stage.captured,null);view.dispose();
});
test('keyboard arrows rotate and Home resets while Escape remains a native dialog action',async()=>{
 const {createAchievementDetail}=await load(),env=setup(),view=createAchievementDetail(env);view.open(row);
 const stage=env.find('achievement-detail-stage'),art=env.find('achievement-detail-art');let prevented=false;
 stage.fire('keydown',{key:'ArrowRight',preventDefault(){prevented=true;}});assert.equal(prevented,true);assert.match(art.style.transform,/rotateY\(5deg\)/);
 stage.fire('keydown',{key:'Home'});assert.match(art.style.transform,/rotateY\(0deg\)/);
 prevented=false;stage.fire('keydown',{key:'Escape',preventDefault(){prevented=true;}});assert.equal(prevented,false);view.dispose();
});
test('reduced motion starts static and changing the preference cancels a drag',async()=>{
 const {createAchievementDetail}=await load(),env=setup(true),view=createAchievementDetail(env);view.open(row);
 const stage=env.find('achievement-detail-stage'),art=env.find('achievement-detail-art');
 stage.fire('pointerdown',{pointerId:1,isPrimary:true,button:0,clientX:0,clientY:0});stage.fire('pointermove',{pointerId:1,clientX:90,clientY:20});stage.fire('keydown',{key:'ArrowLeft'});
 assert.match(art.style.transform,/rotateX\(0deg\).*rotateY\(0deg\)/);
 env.media.matches=false;env.listeners.get('media:change')();stage.fire('keydown',{key:'ArrowLeft'});assert.match(art.style.transform,/rotateY\(-5deg\)/);
 env.media.matches=true;env.listeners.get('media:change')();assert.match(art.style.transform,/rotateY\(0deg\)/);view.dispose();
});
test('cancelled pointers, focus loss and backgrounding reset the presentation',async()=>{
 const {createAchievementDetail}=await load(),env=setup(),view=createAchievementDetail(env);view.open(row);
 const stage=env.find('achievement-detail-stage'),art=env.find('achievement-detail-art');
 for(const cancel of [()=>stage.fire('pointercancel',{pointerId:3}),()=>env.listeners.get('window:blur')(),()=>{env.documentRef.hidden=true;env.listeners.get('visibilitychange')();}]){
  stage.fire('pointerdown',{pointerId:3,isPrimary:true,button:0,clientX:0,clientY:0});stage.fire('pointermove',{pointerId:3,clientX:40,clientY:20});cancel();
  assert.match(art.style.transform,/rotateX\(0deg\).*rotateY\(0deg\)/);assert.equal(stage.captured,null);env.documentRef.hidden=false;
 }view.dispose();
});
test('closing restores current caller focus once; disposal suppresses focus and removes listeners',async()=>{
 const {createAchievementDetail}=await load(),env=setup(),view=createAchievementDetail(env);let returned=0;
 view.open(row,{returnFocus:()=>returned++});env.find('achievement-detail-close').fire('click');assert.equal(returned,1);
 view.open(row,{returnFocus:()=>returned++});view.dispose();assert.equal(returned,1);assert.equal(env.find('achievement-detail').isConnected,false);assert.equal(env.listeners.size,0);
 assert.throws(()=>view.open(row),/disposed/);view.dispose();
});
test('locked, early and unavailable records stay truthful and text remains literal',async()=>{
 const {createAchievementDetail}=await load(),env=setup(),view=createAchievementDetail(env);
 view.open({...row,title:'<img onerror=alert(1)>',unlocked:false,unlockedAt:null,rarity:{label:'Early',percentage:null,unlockedPlayers:2}});
 const text=env.nodes.map(n=>n.textContent).join(' ');assert.match(text,/To earn/);assert.match(text,/Early.*2/);assert.doesNotMatch(text,/null%|undefined|2026-09/);
 assert.ok(env.nodes.some(n=>n.textContent==='<img onerror=alert(1)>'));assert.equal(env.nodes.filter(n=>n.tag==='script').length,0);view.dispose();
});
test('a queued close from the previous badge cannot restore focus away from a newly opened badge',async()=>{
 const {createAchievementDetail}=await load(),env=setup(),view=createAchievementDetail(env);let oldFocus=0,newFocus=0;
 view.open(row,{returnFocus:()=>oldFocus++});const dialog=env.find('achievement-detail');
 dialog.open=false; // Native close queues its event rather than dispatching inline.
 view.open({...row,title:'Next badge'},{returnFocus:()=>newFocus++});dialog.fire('close');
 assert.equal(dialog.open,true);assert.equal(newFocus,0);assert.equal(oldFocus,0);
 dialog.open=false;dialog.fire('close');assert.equal(newFocus,1);view.dispose();
});

test('a primary touch release closes even when the browser omits its compatibility click',async()=>{
 const {createAchievementDetail}=await load(),env=setup(),view=createAchievementDetail(env);let restored=0,prevented=false;
 view.open(row,{returnFocus:()=>restored++});const button=env.find('achievement-detail-close');button.getBoundingClientRect=()=>({left:0,right:100,top:0,bottom:50});
 button.fire('pointerdown',{pointerType:'touch',pointerId:4,isPrimary:true,button:0,clientX:20,clientY:20,preventDefault(){prevented=true;}});
 button.fire('pointerup',{pointerType:'touch',pointerId:4,clientX:20,clientY:20});
 assert.equal(env.find('achievement-detail').open,false);assert.equal(restored,1);assert.equal(prevented,true);
 button.fire('click');assert.equal(restored,1,'a later compatibility click cannot close twice');view.dispose();
});
test('close touch ignores cancellation, movement, other fingers and release outside its bounds',async()=>{
 const {createAchievementDetail}=await load();
 for(const kind of ['cancel','move','other-finger','outside','nonprimary']){
  const env=setup(),view=createAchievementDetail(env);view.open(row);const button=env.find('achievement-detail-close');button.getBoundingClientRect=()=>({left:0,right:100,top:0,bottom:50});
  button.fire('pointerdown',{pointerType:'touch',pointerId:4,isPrimary:kind!=='nonprimary',button:0,clientX:20,clientY:20});
  if(kind==='cancel')button.fire('pointercancel',{pointerId:4});
  if(kind==='move')button.fire('pointermove',{pointerId:4,clientX:70,clientY:20});
  button.fire('pointerup',{pointerType:'touch',pointerId:kind==='other-finger'?5:4,clientX:kind==='outside'?105:20,clientY:20});
  assert.equal(env.find('achievement-detail').open,true,kind);view.dispose();
 }
});
