import test from 'node:test';
import assert from 'node:assert/strict';
const load=()=>import('../apps/stacked/src/tutorial-host.mjs');
function fixture(options={}){
 const writes=[],states=[],messages=[],listeners=new Map();let destroyCount=0,mountCount=0,exit;
 const button={hidden:true,disabled:false,focus(){this.focused=true;},addEventListener(k,f){listeners.set(k,f);},removeEventListener(k){listeners.delete(k);}};
 const storage={getItem:()=> 'skipped',setItem:(...args)=>writes.push(args)};
 return{args:{search:'?stackedTutorial=tutorial-v1',mode:'free',button,overlay:{},storage,onActive:s=>states.push(s),onStatus:s=>messages.push(s),load:async()=>({mountTutorial(args){mountCount++;exit=args.onExit;return{destroy(){destroyCount++;}};}}),...options},button,writes,states,messages,listeners,get mounts(){return mountCount;},get destroys(){return destroyCount;},close(done){exit(done);}};
}
test('disabled, duplicate, unknown and Ranked tutorial switches leave the entry untouched',async()=>{
 const {createTutorialEntry}=await load();
 for(const options of[{search:'?stackedTutorial=off'},{search:'?stackedTutorial=bad'},{search:'?stackedTutorial=tutorial-v1&stackedTutorial=tutorial-v1'},{mode:'ranked'}]){
  const f=fixture(options);assert.equal(createTutorialEntry(f.args),null);assert.equal(f.button.hidden,true);assert.equal(f.mounts,0);assert.equal(f.listeners.size,0);
 }
});
test('seen users load only on request, close writes only onboarding status and returns focus',async()=>{
 const {createTutorialEntry}=await load(),f=fixture({search:''}),c=createTutorialEntry(f.args);assert.equal(f.mounts,0);assert.equal(f.button.hidden,false);
 await c.open();assert.equal(c.active,true);assert.equal(f.mounts,1);f.close(true);assert.deepEqual(f.writes,[['lestersarcade:stacked:tutorial-v1','completed']]);assert.equal(c.active,false);assert.equal(f.button.focused,true);assert.deepEqual(f.states,[true,false]);c.destroy();
});
test('first entry opens once; a skipped lesson is remembered separately from completion',async()=>{
 const {createTutorialEntry}=await load(),f=fixture();f.args.storage.getItem=()=>null;const c=createTutorialEntry(f.args);
 await new Promise(r=>setImmediate(r));assert.equal(f.mounts,1);await c.open();assert.equal(f.mounts,1);f.close(false);assert.equal(f.writes[0][1],'skipped');c.destroy();
});
test('closing the cabinet during a pending import prevents late UI and storage writes',async()=>{
 const {createTutorialEntry}=await load();let resolve;const f=fixture({load:()=>new Promise(r=>resolve=r)}),c=createTutorialEntry(f.args);const pending=c.open();c.destroy();await pending;
 resolve({mountTutorial(){throw Error('late attach');}});await new Promise(r=>setImmediate(r));assert.equal(f.mounts,0);assert.equal(f.writes.length,0);assert.equal(f.listeners.size,0);
});
test('unavailable imports and timeouts restore Start without marking tutorial seen',async()=>{
 const {createTutorialEntry}=await load();for(const loader of[()=>Promise.reject(Error('offline')),()=>new Promise(()=>{})]){
  const f=fixture({load:loader,timeoutMs:1}),c=createTutorialEntry(f.args);await c.open();assert.equal(c.active,false);assert.equal(f.button.disabled,false);assert.equal(f.writes.length,0);assert.match(f.messages.at(-1),/still start/);c.destroy();
 }
});
test('running sessions cannot open training and failed storage cannot block completion',async()=>{
 const {createTutorialEntry}=await load(),f=fixture({canOpen:()=>false}),c=createTutorialEntry(f.args);await c.open();assert.equal(c.active,false);assert.equal(f.mounts,0);c.destroy();
 const g=fixture();g.args.storage={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};const d=createTutorialEntry(g.args);await new Promise(r=>setImmediate(r));g.close(true);assert.equal(d.active,false);assert.equal(g.button.disabled,false);d.destroy();
});
