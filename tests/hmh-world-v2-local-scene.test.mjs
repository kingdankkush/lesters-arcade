import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { InputState, createBrowserInputController } from '../apps/hmh-reboot/src/input.mjs';
import { TouchControlState } from '../apps/hmh-reboot/src/touch-controls.mjs';
import { quantizeDirection } from '../apps/hmh-reboot/src/movement.mjs';
import * as projection from '../apps/hmh-reboot/src/world-space.mjs';
import { createWorldV2Geometry } from '../apps/hmh-reboot/src/world-v2-geometry.mjs';
import { createWorldV2LocalRuntime } from '../apps/hmh-reboot/src/dev/world-v2-local-runtime.mjs';
import { createElevationSurface, createAuthoredGroundQuery } from '../apps/hmh-reboot/src/elevation.mjs';
import { createGreyboxGroundPaint } from '../apps/hmh-reboot/src/dev/greybox-ground-presentation.mjs';
import { readWorldV2LocalAccess } from '../apps/hmh-reboot/src/dev/world-v2-local-access.mjs';
import { createGreyboxPreviewLaunch } from '../apps/hmh-reboot/src/dev/greybox-preview-launch.mjs';
const sceneUrl = new URL('../apps/hmh-reboot/src/dev/world-v2-local-scene.mjs', import.meta.url);
const entryUrl = new URL('../apps/hmh-reboot/src/dev/world-v2-local-entry.mjs', import.meta.url);
const read = file => fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return { promise, resolve, reject }; };
const flush = async () => { for (let i=0;i<24;i++) await Promise.resolve(); };
const residencyModule=await import('../apps/hmh-reboot/src/dev/greybox-prop-residency.mjs').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
const active = new Set();
afterEach(() => { for (const f of active) f.close(); active.clear(); });

class Element {
  constructor(tag='DIV') { this.tagName=tag; this.listeners=new Map(); this.children=[]; this.dataset={}; this.style={}; this.disabled=false; this.hidden=false; this.textContent=''; this.value='mweb-meadows'; }
  addEventListener(type,fn,options) { if(options?.signal?.aborted)return; const set=this.listeners.get(type)??new Set(); set.add(fn); this.listeners.set(type,set); options?.signal?.addEventListener('abort',()=>set.delete(fn),{once:true}); }
  removeEventListener(type,fn) { this.listeners.get(type)?.delete(fn); }
  emit(type, extra={}) { const e={type,target:this,currentTarget:this,preventDefault(){},stopPropagation(){},...extra}; for(const fn of [...(this.listeners.get(type)??[])])fn(e); }
  appendChild(item) { item.parentNode=this; this.children.push(item); return item; }
  append(...items) { items.forEach(item=>this.appendChild(item)); }
  remove() { if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(item=>item!==this); this.parentNode=null; }
  setAttribute(name,value) { this[name]=value; }
  removeAttribute(name) { delete this[name]; }
  focus() { if(this.ownerDocument)this.ownerDocument.activeElement=this; } setPointerCapture() {} releasePointerCapture() {}
  getBoundingClientRect() { return {left:0,top:96,width:1000,height:700,right:1000,bottom:796}; }
  count() { return [...this.listeners.values()].reduce((n,set)=>n+set.size,0); }
}
const vector = () => ({x:0,y:0,set(x,y=x){this.x=x;this.y=y;}});
class Display extends Element {
  constructor() { super(); this.position=vector(); this.scale=vector(); this.destroyed=false; this.visible=true; this.sortableChildren=false; }
  addChild(...items) { this.append(...items); return items[0]; }
  getChildIndex(item){return this.children.indexOf(item);}
  addChildAt(item,index){item.remove();item.parentNode=this;this.children.splice(index,0,item);return item;}
  destroy(options) { this.destroyed=true; if(options?.children)for(const child of this.children)child.destroy?.(options); this.remove(); }
  clear(){return this;} poly(){return this;} fill(){return this;} stroke(){return this;} moveTo(){return this;} lineTo(){return this;} closePath(){return this;}
}
function worldFixture() {
  const bounds={minX:0,minY:0,maxX:2000,maxY:1000};
  const baseSurface=createElevationSurface({id:'floor',area:{type:'rect',...bounds},visibleTerrainId:'floor'});
  return {mapId:'visual-overhaul-greybox-v1',officialRun:false,rankedEligible:false,rulesVersion:null,bounds,spawn:{x:500,y:500},baseSurface,
    surfaces:[],collisionBlockers:[],roads:[],sites:[],pieces:[],arenas:[],areas:[
      {id:'mweb-meadows',name:'MWEB Meadows',center:{x:500,y:500},bounds:{minX:0,minY:0,maxX:1000,maxY:1000}},
      {id:'silver-coast',name:'Silver Coast',center:{x:1500,y:500},bounds:{minX:1000,minY:0,maxX:2000,maxY:1000}},
    ]};
}
function fixture({appGate,decodeGate,navGates=[],metadataFailure=null,partialInit=false,testWorld=worldFixture()}={}) {
  const source=read(sceneUrl); assert.ok(source.includes('export function mountGreyboxPlaytest'), 'actual private Pixi scene required');
  const root=new Element(), stage=new Element(), start=new Element('BUTTON'), pause=new Element('BUTTON'), close=new Element('BUTTON'), inspect=new Element('BUTTON'), select=new Element('SELECT');
  const nodes={'[data-stage]':stage,'[data-start]':start,'[data-pause]':pause,'[data-close]':close,'[data-inspect]':inspect,'[data-area-select]':select,
    '[data-relay-task]':new Element(),'[data-status]':new Element(),'[data-area-name]':new Element(),'[data-position]':new Element(),'[data-nav]':new Element(),'[data-stick]':new Element('BUTTON'),'[data-stick-knob]':new Element()};
  root.querySelector=selector=>nodes[selector]; root.querySelectorAll=selector=>selector==='button'?[start,pause,close,inspect,nodes['[data-stick]']]:[];
  const document=new Element(); document.hidden=false; document.visibilityState='visible'; document.createElement=tag=>new Element(tag.toUpperCase());
  const window=new Element(); window.devicePixelRatio=1; window.innerWidth=1000; window.innerHeight=900; window.matchMedia=()=>({matches:false});
  root.ownerDocument=document;
  for(const node of Object.values(nodes))node.ownerDocument=document;
  let now=0,nextFrame=0,appDestroys=0,textureCreates=0,textureDestroys=0,draws=0,initDone=false;
  const frames=new Map(), runtimes=[], images=[], graphics=[], poses=[], layers=[];
  const relayPlan=Object.freeze({id:'local-meadows-relay',operate:Object.freeze({x:600,y:400}),lamp:Object.freeze({x:600,y:336,z:66}),ringRadius:72,fillTicks:30,blockerId:'fixture-equipment'});
  class Graphic extends Display { constructor(){super();graphics.push(this);} circle(x,y,r){this.lastCircle={x,y,r};return this;} fill(value){this.lastFill=value;return this;} }
  class Application {
    constructor(){this.stage=new Display();this.canvas=new Element('CANVAS');this.canvas.ownerDocument=document;this.ticker={stop(){}};this.screen={width:1000,height:700};}
    async init(){if(partialInit){initDone=true;this.renderer={type:1,resize(){},render(){draws++;}};}await(appGate?.promise??Promise.resolve()); initDone=true;this.renderer={type:1,resize(){},render(){draws++;}};}
    render(){draws++;}
    destroy(){assert.equal(initDone,true,'never destroy an unresolved Pixi renderer');appDestroys++;this.canvas.remove();this.stage.destroy({children:true});}
  }
  class Image {
    constructor(){this.naturalWidth=this.naturalHeight=1024;images.push(this);}
    decode(){return decodeGate?.promise??Promise.resolve();}
    removeAttribute(name){delete this[name];}
  }
  class Texture {
    static from(){textureCreates++;return {source:{width:1024,height:1024},destroy(){textureDestroys++;}};}
  }
  function createRuntime({geometry,relayPlan:receivedPlan}) {
    const gate=navGates[runtimes.length], records=[];
    let phase='preparing',tick=0,disposed=0;
    const actor=Object.freeze({x:geometry.inspectionStart.x,y:geometry.inspectionStart.y,groundZ:0,vx:0,vy:0,heading:0,legDirection:0,torsoDirection:0,locomotion:'idle'});
    const ready=(gate?.promise??Promise.resolve()).then(()=>{if(phase!=='disposed')phase='ready';});
    const runtime={ready,records,geometry,relayPlan:receivedPlan,relay:{committed:false,progressTicks:0,completionTick:null,eligible:false,operating:false,commitTick:-1},start(){assert.equal(phase,'ready');phase='active';},pause(){if(phase==='active')phase='paused';},resume(){if(phase==='paused')phase='active';},
      dispose(){if(phase!=='disposed'){disposed++;phase='disposed';}},get disposed(){return disposed;},
      advance(delta,input){assert.equal(phase,'active');records.push({delta,input});tick++;return {steps:1,alpha:1};},
      snapshot(){return Object.freeze({phase,tick,actor,previousActor:actor,relay:runtime.relay,nav:phase==='preparing'||phase==='disposed'?null:{columns:34,rows:17,walkableCells:578,gridBytes:1156,flowBytes:2890},lastStep:{contacts:0,traversalAllowed:true}});},
      navigationAt(){return Object.freeze({returnDistance:0});}};
    runtimes.push(runtime);return runtime;
  }
  const imports={createAreaArt:()=>{throw new Error('area art must not be constructed without a plan');},createAreaArtTextureCache:()=>({dispose(){},snapshot:()=>null}),createRugpullWoodsArtPlan:()=>null,createMwebMeadowsArtPlan:()=>null,createHashwoodRiverArtPlan:()=>null,createHalvingFarmsArtPlan:()=>null,createLitecoinCityArtPlan:()=>null,createWorldRoadsArtPlan:()=>null,Application,Container:Display,Graphics:Graphic,Sprite:Display,Texture,Rectangle:class{},
    createGreyboxWorld:()=>testWorld,createGreyboxGroundPaint,createWorldV2Geometry,createWorldV2LocalRuntime:createRuntime,
    createGreyboxPropResidency:residencyModule.createGreyboxPropResidency,
    createLocalMeadowsRelayPlan:world=>{assert.equal(world,testWorld);return relayPlan;},
    InputState,createBrowserInputController,TouchControlState,quantizeDirection,...projection,createAuthoredGroundQuery,
    PRODUCTION_HERO_ASSETS:{'lit-commando':{actorId:'lit-commando',metadataUrl:'/human.json',imageUrl:'/human.webp'}},PRODUCTION_HERO_RUNTIME_SCALE:.58,
    createProductionHeroAtlasIndex:()=>({}),createProductionHeroDisplay:()=>({container:new Display(),artSource:'packed-textured-blend',applyPose(pose){poses.push(pose);},setLayerVisible(layer,visible){layers.push({layer,visible});}})};
  const allowed=new Set(['pixi.js','./greybox-world-v1.mjs','./greybox-ground-presentation.mjs','../world-v2-geometry.mjs','./world-v2-local-runtime.mjs',
    '../input.mjs','../touch-controls.mjs','../world-space.mjs','../elevation.mjs','../production-hero-atlas.mjs','../production-hero-assets.mjs','./greybox-prop-residency.mjs','./world-v2-local-relay.mjs','../movement.mjs','../world-v2-area-art.mjs','../world-v2-area-plans/rugpull-woods.mjs','../world-v2-area-plans/mweb-meadows.mjs','../world-v2-area-plans/halving-farms.mjs','../world-v2-area-plans/litecoin-city.mjs','../world-v2-area-plans/world-roads.mjs','../world-v2-area-plans/hashwood-river.mjs']);
  const executable=source.replace(/^import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?\s*$/gm,(_line,names,specifier)=>{
    assert.ok(allowed.has(specifier),specifier);for(const name of names.split(',').map(x=>x.trim()).filter(Boolean))assert.ok(Object.hasOwn(imports,name),name);return '';
  }).replace('export function mountGreyboxPlaytest','function mountGreyboxPlaytest');
  assert.doesNotMatch(executable,/^import\b/m,'only the explicitly listed dependency seams may be substituted');
  const context={...imports,window,document,Image,AbortController,performance:{now:()=>now},
    fetch:async()=>{if(metadataFailure)throw Error(metadataFailure);return {ok:true,json:async()=>({})};},
    requestAnimationFrame:callback=>{const id=++nextFrame;frames.set(id,callback);return id;},cancelAnimationFrame:id=>frames.delete(id),console};
  vm.createContext(context);vm.runInContext(executable,context);const handle=context.mountGreyboxPlaytest(root);
  const result={root,nodes,window,document,runtimes,images,graphics,handle,frames,poses,layers,relayPlan,
    focusToolbar(selector){const node=nodes[selector];node.focus();root.emit('focusin',{target:node});},
    key(code){let stopped=false;const target=document.activeElement??root;root.emit('keydown',{target,code,stopPropagation(){stopped=true;}});if(!stopped)window.emit('keydown',{target,code});},
    async frame(delta=16){now+=delta;const pending=[...frames.values()];frames.clear();for(const callback of pending)callback(now);await flush();},
    get appDestroys(){return appDestroys;},get textureCreates(){return textureCreates;},get textureDestroys(){return textureDestroys;},get draws(){return draws;},
    close(){handle.dispose();}};
  active.add(result);return result;
}

test('Pixi scene mount is synchronous and waits for actual async boundaries before play',async()=>{
  const nav=deferred(),f=fixture({navGates:[nav]});assert.equal(typeof f.handle.dispose,'function');
  await flush();assert.equal(f.nodes['[data-start]'].disabled,true);assert.equal(f.frames.size,0);assert.equal(f.draws,0);
  nav.resolve();await f.handle.ready;assert.equal(f.nodes['[data-start]'].disabled,false);assert.equal(f.frames.size,0);assert.equal(f.runtimes[0].records.length,0);
  f.nodes['[data-start]'].emit('click');assert.equal(f.frames.size,1);assert.equal(f.handle.snapshot().runtime.phase,'active');
});
test('disposing during Pixi init destroys the late renderer once without a canvas or animation',async()=>{
  for(const partialInit of [false,true]){const pending=deferred(),f=fixture({appGate:pending,partialInit});f.close();f.close();assert.equal(f.appDestroys,0);
    if(partialInit)pending.reject(Error('late partial init rejection'));else pending.resolve();
    await f.handle.ready;assert.equal(f.appDestroys,1);assert.equal(f.textureCreates,0);assert.equal(f.frames.size,0);assert.equal(f.nodes['[data-stage]'].children.length,0);}
});
test('late human decode and navigation cannot revive a disposed mount',async()=>{
  for(const type of ['decode','nav']){const pending=deferred(),f=fixture(type==='decode'?{decodeGate:pending}:{navGates:[pending]});await flush();f.close();pending.resolve();await f.handle.ready;
    assert.equal(f.frames.size,0);assert.equal(f.textureCreates,0);assert.equal(f.appDestroys,1);assert.equal(f.handle.snapshot().disposed,true);}
});
test('init atlas and navigation failures are retained and acquired resources are cleaned',async()=>{
  for(const boundary of ['metadata','decode','nav','init','partial-init']){const pending=deferred();
    const f=fixture(boundary==='metadata'?{metadataFailure:'failure witness'}:boundary==='decode'?{decodeGate:pending}:boundary==='nav'?{navGates:[pending]}:{appGate:pending,partialInit:boundary==='partial-init'});
    const rejection=assert.rejects(f.handle.ready,/failure witness/);if(boundary!=='metadata')pending.reject(Error('failure witness'));await rejection;await flush();
    assert.equal(f.frames.size,0);assert.equal(f.runtimes[0].disposed,1);assert.equal(f.appDestroys,boundary==='init'?0:1);assert.match(f.handle.snapshot().failure,/failure witness/);}
});
test('native keyboard input reaches movement and explicit pause/resume drops input and wall time',async()=>{
  const f=fixture();await f.handle.ready;f.nodes['[data-start]'].emit('click');f.window.emit('keydown',{code:'KeyD'});await f.frame();await f.frame();
  assert.equal(f.runtimes[0].records.at(-1).input.move.x,1);f.nodes['[data-pause]'].emit('click');const count=f.runtimes[0].records.length;
  await f.frame(5000);assert.equal(f.frames.size,0);assert.equal(f.runtimes[0].records.length,count);f.nodes['[data-pause]'].emit('click');await f.frame(5000);await f.frame();
  assert.ok(f.runtimes[0].records.slice(count).every(record=>record.delta<100));assert.equal(f.runtimes[0].records.at(-1).input.move.x,0);
});
test('toolbar focus releases held movement and Resume returns keyboard control to the canvas',async()=>{
  const f=fixture();await f.handle.ready;f.nodes['[data-start]'].emit('click');
  f.focusToolbar('[data-pause]');f.nodes['[data-pause]'].emit('click');f.nodes['[data-pause]'].emit('click');
  assert.equal(f.document.activeElement?.tagName,'CANVAS','Resume must restore canvas focus');
  f.key('KeyD');await f.frame();await f.frame();assert.equal(f.runtimes[0].records.at(-1).input.move.x,1);
  f.focusToolbar('[data-area-select]');f.key('ArrowDown');await f.frame();assert.equal(f.runtimes[0].records.at(-1).input.move.x,0,'entering toolbar clears an already held movement key');
  assert.equal(f.runtimes[0].records.at(-1).input.move.y,0,'select arrow must not steer the actor');
});
test('blur hidden and cancelled pointer pause and require an explicit resume',async()=>{
  for(const reason of ['blur','hidden','pointercancel']){const f=fixture();await f.handle.ready;f.nodes['[data-start]'].emit('click');
    if(reason==='hidden'){f.document.hidden=true;f.document.visibilityState='hidden';f.document.emit('visibilitychange');}
    else if(reason==='blur')f.window.emit('blur');else f.nodes['[data-stick]'].emit('pointercancel',{pointerId:9});
    assert.equal(f.frames.size,0);assert.equal(f.handle.snapshot().runtime.phase,'paused');f.document.hidden=false;f.document.visibilityState='visible';f.document.emit('visibilitychange');f.window.emit('focus');await f.frame(1000);assert.equal(f.frames.size,0);}
});
test('touch movement uses the real stick and loss of capture releases and pauses',async()=>{
  const f=fixture();await f.handle.ready;f.nodes['[data-start]'].emit('click');const stick=f.nodes['[data-stick]'];
  stick.emit('pointerdown',{pointerId:4,clientX:100,clientY:600});stick.emit('pointermove',{pointerId:4,clientX:160,clientY:600});await f.frame();await f.frame();
  assert.ok(f.runtimes[0].records.at(-1).input.move.x>.5);stick.emit('lostpointercapture',{pointerId:4});assert.equal(f.frames.size,0);assert.equal(f.handle.snapshot().runtime.phase,'paused');
});
test('idempotent close removes canvas handlers and RAF; stale controls cannot resurrect',async()=>{
  const f=fixture();await f.handle.ready;f.nodes['[data-start]'].emit('click');await f.frame();f.close();f.close();
  assert.equal(f.appDestroys,1);assert.equal(f.textureDestroys,1);assert.equal(f.frames.size,0);assert.equal(f.nodes['[data-stage]'].children.length,0);assert.equal(f.window.count(),0);assert.equal(f.document.count(),0);
  f.nodes['[data-start]'].emit('click');f.nodes['[data-pause]'].emit('click');f.nodes['[data-inspect]'].emit('click');await f.frame();assert.equal(f.runtimes.length,1);assert.equal(f.frames.size,0);
});
test('authored inspection replacement discards a stale pending runtime and rejects unknown selection',async()=>{
  const stale=deferred(),f=fixture({navGates:[null,stale]});await f.handle.ready;f.nodes['[data-area-select]'].value='silver-coast';f.nodes['[data-inspect]'].emit('click');await flush();
  assert.equal(f.runtimes[0].disposed,1);assert.equal(f.runtimes[1].geometry.inspectionStart.x,1500);
  f.nodes['[data-area-select]'].value='mweb-meadows';f.nodes['[data-inspect]'].emit('click');await flush();stale.resolve();await flush();
  assert.equal(f.runtimes[1].disposed,1);assert.equal(f.handle.snapshot().runtime.actor.x,500);assert.equal(f.handle.snapshot().inspectionJumps,2);
  f.nodes['[data-area-select]'].value='external-position';f.nodes['[data-inspect]'].emit('click');await flush();assert.equal(f.runtimes.length,3);assert.equal(f.handle.snapshot().runtime.actor.x,500);
});

function residencyWorld(){
  const base=worldFixture(),bounds={minX:0,minY:0,maxX:12000,maxY:1000};
  return {...base,bounds,baseSurface:createElevationSurface({id:'floor',area:{type:'rect',...bounds},visibleTerrainId:'floor'}),
    areas:[base.areas[0],{...base.areas[1],center:{x:10500,y:500},bounds:{minX:10000,minY:0,maxX:12000,maxY:1000}}],
    pieces:[500,10500].map((x,i)=>({id:`test-prop-${i}`,areaId:base.areas[i].id,kind:'mass',blocker:{},visible:{bounds:{minX:x-20,maxX:x+20,minY:350,maxY:400},height:80}}))};
}
test('actual private scene owns only nearby props and releases and recreates exact Graphics on return',async()=>{
  const f=fixture({testWorld:residencyWorld()});await f.handle.ready;
  let state=f.handle.snapshot().propResidency;assert.ok(state,'actual scene prop residency observation required');
  assert.deepEqual(Array.from(state.residentIds),['test-prop-0']);assert.equal(state.liveCount,1);
  const initial=f.graphics.find(g=>g.label==='local-prop-test-prop-0');assert.ok(initial);
  f.nodes['[data-area-select]'].value='silver-coast';f.nodes['[data-inspect]'].emit('click');await flush();
  state=f.handle.snapshot().propResidency;assert.deepEqual(Array.from(state.residentIds),['test-prop-1']);assert.equal(initial.destroyed,true);
  f.nodes['[data-area-select]'].value='mweb-meadows';f.nodes['[data-inspect]'].emit('click');await flush();
  state=f.handle.snapshot().propResidency;assert.equal(state.createdCount,3);assert.equal(state.destroyedCount,2);assert.equal(state.peakCount,1);
  assert.equal(f.graphics.filter(g=>g.label==='local-prop-test-prop-0'&&!g.destroyed).length,1);
  f.close();state=f.handle.snapshot().propResidency;assert.equal(state.liveCount,0);assert.equal(state.createdCount,state.destroyedCount);
});
test('late Pixi readiness after disposal cannot allocate a single prop display',async()=>{
  const gate=deferred(),f=fixture({appGate:gate,testWorld:residencyWorld()});f.close();gate.resolve();await f.handle.ready;
  const state=f.handle.snapshot().propResidency;assert.ok(state,'actual scene prop residency observation required');
  assert.equal(state.disposed,true);assert.equal(state.createdCount,0);assert.equal(state.liveCount,0);
  assert.equal(f.graphics.filter(g=>String(g.label).startsWith('local-prop-')).length,0);
});
test('revisited same-depth props keep authored paint order across a retained long solid',async()=>{
  const world=residencyWorld();world.pieces.splice(1,0,{id:'retained-solid',areaId:null,kind:'mass',blocker:{},visible:{bounds:{minX:800,maxX:10800,minY:350,maxY:400},height:80}});
  const f=fixture({testWorld:world});await f.handle.ready;
  assert.ok(f.handle.snapshot().propResidency,'actual scene prop residency observation required');
  const retained=f.graphics.find(g=>g.label==='local-prop-retained-solid');assert.ok(retained);
  f.nodes['[data-area-select]'].value='silver-coast';f.nodes['[data-inspect]'].emit('click');await flush();
  assert.equal(retained.destroyed,false);f.nodes['[data-area-select]'].value='mweb-meadows';f.nodes['[data-inspect]'].emit('click');await flush();
  const newNear=f.graphics.filter(g=>g.label==='local-prop-test-prop-0'&&!g.destroyed);assert.equal(newNear.length,1);
  assert.equal(newNear[0].zIndex,retained.zIndex,'keep exact same ground-depth key');
  const children=retained.parentNode.children;assert.ok(children.indexOf(newNear[0])<children.indexOf(retained),'authored tie order survives eviction and return');f.close();
});

function entryFixture({url='http://127.0.0.1:8793/dist/hmh-world-v2-local/index.html?mode=free&world=world-v2-local',embedded=false,load}={}){
  const source=read(entryUrl);assert.ok(source.includes('createGreyboxPreviewLaunch'),'actual gated local entry required');
  const root=new Element(),window=new Element(),document={querySelector:()=>root};let loads=0,reloads=0;
  window.self=window;window.top=embedded?{}:window;window.location={href:url,reload(){reloads++;}};
  const executable=source.replace(/^import \{ readWorldV2LocalAccess \} from '.\/world-v2-local-access.mjs';\s*$/m,'').replace(/^import \{ createGreyboxPreviewLaunch \} from '.\/greybox-preview-launch.mjs';\s*$/m,'')
    .replace("import('./world-v2-local-scene.mjs')",'__load()');
  assert.doesNotMatch(executable,/^import\b/m);
  vm.runInNewContext(executable,{window,document,location:window.location,readWorldV2LocalAccess,createGreyboxPreviewLaunch,console,__load(){loads++;return load?.()??Promise.resolve({mountGreyboxPlaytest(){return {ready:Promise.resolve(),dispose(){},snapshot(){return {};}};}});}});
  return {root,window,get loads(){return loads;},get reloads(){return reloads;}};
}
test('entry denies remote Ranked duplicate and embedded links without a scene import',async()=>{
  for(const options of [{url:'https://lestersarcade.io/'},{url:'http://localhost/dist/hmh-world-v2-local/index.html?mode=ranked&world=world-v2-local'},
    {url:'http://localhost/dist/hmh-world-v2-local/index.html?mode=free&world=world-v2-local&mode=free'},{embedded:true}]){
    const f=entryFixture(options);await flush();assert.equal(f.loads,0);assert.equal(f.root.dataset.worldState,'denied');}
});
test('entry pagehide abandons a pending import and persisted return reloads once',async()=>{
  const pending=deferred();let mounts=0;const f=entryFixture({load:()=>pending.promise});await flush();f.window.emit('pagehide');
  pending.resolve({mountGreyboxPlaytest(){mounts++;throw Error('abandoned mount');}});await flush();assert.equal(mounts,0);assert.equal(f.root.dataset.worldState,'disposed');
  f.window.emit('pageshow',{persisted:false});assert.equal(f.reloads,0);f.window.emit('pageshow',{persisted:true});f.window.emit('pageshow',{persisted:true});assert.equal(f.reloads,1);
});
test('presentation previous actor is the last admitted tick through catch-up and is immutable',async()=>{
  const runtime=createWorldV2LocalRuntime({geometry:createWorldV2Geometry(worldFixture()),scheduleYield:async()=>{}});await runtime.ready;runtime.start();
  try{runtime.advance(1000/60*4,{move:{x:1,y:0}});const view=runtime.snapshot();assert.ok(view.previousActor,'previous admitted tick projection required');
    assert.equal(view.tick,4);assert.ok(view.previousActor.x<view.actor.x);assert.ok(Math.abs(view.actor.x-view.previousActor.x-view.actor.vx/60)<1e-9);
    assert.throws(()=>{view.previousActor.x=0;},TypeError);const x=view.previousActor.x;runtime.advance(1000/60,{move:{x:1,y:0}});assert.equal(view.previousActor.x,x);
  }finally{runtime.dispose();}
});

test('the playable scene binds one relay and presents reach, press and completion without an action button',async()=>{
  const f=fixture();await f.handle.ready;
  assert.equal(f.runtimes[0].relayPlan,f.relayPlan,'the actual scene must pass its local plan to the runtime');
  assert.match(f.root.innerHTML,/data-relay-task/);assert.match(f.nodes['[data-relay-task]'].textContent,/Restore the Meadows relay/);
  const ring=f.graphics.find(g=>g.label==='local-relay-ring'),lamp=f.graphics.find(g=>g.label==='local-relay-lamp');assert.ok(ring&&lamp,'actual owned relay cues required');
  assert.deepEqual(ring.lastCircle,{x:600,y:400,r:72});
  f.nodes['[data-start]'].emit('click');f.runtimes[0].relay={...f.runtimes[0].relay,eligible:true};await f.frame();
  assert.match(f.nodes['[data-relay-task]'].textContent,/stay nearby/i);
  f.runtimes[0].relay={...f.runtimes[0].relay,committed:true,progressTicks:1,operating:true,commitTick:1};await f.frame();
  assert.equal(f.poses.at(-1).action,'interact');assert.equal(f.poses.at(-1).torsoDirection,7,'side approach faces the equipment');assert.equal(f.poses.at(-1).legDirection,0,'gameplay leg direction is unchanged');assert.equal(f.poses.at(-1).actionTick,f.runtimes[0].snapshot().tick-1);
  assert.deepEqual(f.layers.at(-1),{layer:'weapon',visible:false});assert.match(f.nodes['[data-relay-task]'].textContent,/starting/i);
  f.runtimes[0].relay={...f.runtimes[0].relay,operating:false,eligible:false,progressTicks:30,completionTick:3};await f.frame();
  assert.equal(f.poses.at(-1).action,'aim');assert.deepEqual(f.layers.at(-1),{layer:'weapon',visible:true});
  assert.match(f.nodes['[data-relay-task]'].textContent,/restored.*no rewards/i);assert.equal(lamp.lastFill,'#b8ef9c');
  f.nodes['[data-pause]'].emit('click');const poseCount=f.poses.length;await f.frame(1000);assert.equal(f.poses.length,poseCount);
});
test('inspection replacement resets only the temporary relay and close releases its actual graphics',async()=>{
  const f=fixture();await f.handle.ready;f.runtimes[0].relay={...f.runtimes[0].relay,completionTick:41,progressTicks:30};
  f.nodes['[data-area-select]'].value='silver-coast';f.nodes['[data-inspect]'].emit('click');await flush();
  assert.equal(f.runtimes[0].disposed,1);assert.equal(f.runtimes[1].relayPlan,f.relayPlan);
  assert.equal(f.runtimes[1].snapshot().relay.completionTick,null);assert.match(f.nodes['[data-relay-task]'].textContent,/Restore/);
  const cues=f.graphics.filter(g=>['local-relay-ring','local-relay-lamp'].includes(g.label));assert.equal(cues.length,2);
  f.close();assert.ok(cues.every(g=>g.destroyed));assert.equal(f.frames.size,0);
});

test('area art plans mount through the scene seams and every plan disposes with the scene',async()=>{
  const {createGreyboxWorld}=await import('../apps/hmh-reboot/src/dev/greybox-world-v1.mjs');
  const {createRugpullWoodsArtPlan}=await import('../apps/hmh-reboot/src/world-v2-area-plans/rugpull-woods.mjs');
  const {createMwebMeadowsArtPlan}=await import('../apps/hmh-reboot/src/world-v2-area-plans/mweb-meadows.mjs');
  const {createHalvingFarmsArtPlan}=await import('../apps/hmh-reboot/src/world-v2-area-plans/halving-farms.mjs');
  const {createLitecoinCityArtPlan}=await import('../apps/hmh-reboot/src/world-v2-area-plans/litecoin-city.mjs');
  const {createWorldRoadsArtPlan}=await import('../apps/hmh-reboot/src/world-v2-area-plans/world-roads.mjs');
  const world=createGreyboxWorld(),before=JSON.stringify(world);
  const plans=[createRugpullWoodsArtPlan(world),createMwebMeadowsArtPlan(world),createHalvingFarmsArtPlan(world),createLitecoinCityArtPlan(world),createWorldRoadsArtPlan(world)];
  assert.deepEqual(plans.map(plan=>plan.areaId),['rugpull-woods','mweb-meadows','halving-farms','litecoin-city','world-roads']);
  assert.ok(plans.every(plan=>Object.isFrozen(plan)&&plan.runtimeAuthority==='projection-only'&&plan.artAccepted===false));
  assert.equal(JSON.stringify(world),before,'art planning does not mutate the gameplay world');
  const source=read(sceneUrl);
  for(const seam of ['art.paintSurface({target:ground,surface,vertices:command.vertices})','art.createSolid(piece)','art.mount(depthLayer,ground)','art.update(camera,view,render)','art.dispose()','textureCache?.dispose()','areaArt:Object.freeze(arts.map(art=>art.snapshot()))'])assert.ok(source.includes(seam),seam);
  assert.ok(source.includes("{areaArt=true}"),'area art stays behind a presentation switch');
  assert.ok(!source.includes('woods-art'),'the old Woods module is retired');
});
