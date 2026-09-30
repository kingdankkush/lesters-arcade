import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { localVersusAllowed } from '../apps/stacked/src/local-access.mjs';

const entry = readFileSync(new URL('../apps/stacked/src/local-entry.mjs', import.meta.url), 'utf8');
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve=yes; reject=no; }); return {promise, resolve, reject}; };
const flush = async () => { for(let i=0;i<12;i++) await Promise.resolve(); };
function fixture({search='?stackedLocal=local-v1&mode=free', topLevel=true, load}={}) {
  const listeners = new Map(), noticeCopy={textContent:'Preparing'}, notice={hidden:false}, body={dataset:{}};
  const document={body,querySelector:selector=>({'#noticeCopy':noticeCopy,'#notice':notice})[selector]};
  let loads=0,reloads=0;
  const window={document,location:{search,reload(){reloads++;}},
    addEventListener(type,fn){let set=listeners.get(type);if(!set)listeners.set(type,set=new Set());set.add(fn);},
    removeEventListener(type,fn){listeners.get(type)?.delete(fn);}};
  window.top=topLevel?window:{};
  const emit=(type,details={})=>{for(const fn of [...(listeners.get(type)??[])])fn({type,...details});};
  // Execute the real entry. Only the two import bindings are supplied by the
  // fixture; the entry's gate, promise chain, event listeners and cleanup run.
  const importLine="import { localVersusAllowed } from './local-access.mjs';";
  const dynamic="import('./local-app.mjs')";
  assert.equal(entry.split(importLine).length,2);assert.equal(entry.split(dynamic).length,2);
  const executable=entry.replace(importLine,'').replace(dynamic,'__loadLocalApp()').replace('export function startLocalStackedEntry','function startLocalStackedEntry');
  vm.runInNewContext(executable,{window,document,location:window.location,localVersusAllowed,Promise,
    __loadLocalApp(){loads++;return load?.()??Promise.resolve({mountLocalStacked(){}});}});
  return {emit,body,notice,noticeCopy,get loads(){return loads;},get reloads(){return reloads;}};
}

test('local entry denies Ranked duplicate and embedded requests before loading',async()=>{
  for(const options of [{search:'?mode=ranked&stackedLocal=local-v1'}, {search:'?mode=free&stackedLocal=local-v1&mode=free'}, {topLevel:false}]){
    const f=fixture(options);await flush();assert.equal(f.loads,0);assert.equal(f.body.dataset.localState,'denied');
  }
});
test('local entry mounts once and pagehide destroys the handle once',async()=>{
  let mounts=0,destroys=0;
  const f=fixture({load:()=>Promise.resolve({mountLocalStacked(){mounts++;return {destroy(){destroys++;}};}})});
  await flush();assert.equal(f.loads,1);assert.equal(mounts,1);f.emit('pagehide');f.emit('pagehide');await flush();assert.equal(destroys,1);
});
test('pagehide during module loading prevents a late mount',async()=>{
  const pending=deferred();let mounts=0;
  const f=fixture({load:()=>pending.promise});await flush();assert.equal(f.loads,1);f.emit('pagehide');
  pending.resolve({mountLocalStacked(){mounts++;}});await flush();assert.equal(mounts,0);
});
test('pagehide during mounting destroys the late handle without revival',async()=>{
  const pending=deferred();let mounts=0,destroys=0;
  const f=fixture({load:()=>Promise.resolve({mountLocalStacked(){mounts++;return pending.promise;}})});
  await flush();assert.equal(mounts,1);f.emit('pagehide');pending.resolve({destroy(){destroys++;}});await flush();f.emit('pagehide');assert.equal(destroys,1);
});
test('late load or mount failures after pagehide cannot rewrite the abandoned page',async()=>{
  for(const mounting of [false,true]){
    const pending=deferred();
    const f=fixture({load:()=>mounting?Promise.resolve({mountLocalStacked:()=>pending.promise}):pending.promise});
    await flush();f.emit('pagehide');pending.reject(new Error('late failure'));await flush();
    assert.notEqual(f.body.dataset.localState,'error');assert.equal(f.noticeCopy.textContent,'Preparing');
  }
});
test('active load or mount failures retain the retry notice',async()=>{
  for(const mounting of [false,true]){
    const f=fixture({load:()=>mounting?Promise.resolve({mountLocalStacked(){throw Error('mount failure');}}):Promise.reject(Error('load failure'))});
    await flush();assert.equal(f.body.dataset.localState,'error');assert.equal(f.notice.hidden,false);assert.match(f.noticeCopy.textContent,/Reload/);
  }
});
test('only an abandoned persisted pageshow reloads once for a fresh playable mount',async()=>{
  const pending=deferred(),f=fixture({load:()=>pending.promise});await flush();
  f.emit('pageshow',{persisted:true});assert.equal(f.reloads,0);
  f.emit('pagehide');f.emit('pageshow',{persisted:false});assert.equal(f.reloads,0);
  f.emit('pageshow',{persisted:true});f.emit('pageshow',{persisted:true});assert.equal(f.reloads,1);
  pending.resolve({mountLocalStacked(){throw Error('abandoned mount');}});await flush();assert.notEqual(f.body.dataset.localState,'error');
});
