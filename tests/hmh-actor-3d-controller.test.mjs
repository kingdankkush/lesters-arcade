import assert from 'node:assert/strict';
import test from 'node:test';
const module = await import('../apps/hmh-reboot/src/actor-3d-controller.mjs').catch(() => ({}));
const camera = { x: 0, y: 0, groundZ: 0, zoom: 1, shakeX: 0, shakeY: 0 }, view = { width: 800, height: 600 };
const entry = (id, y = 10) => ({ descriptor: { id, actorId: id === 'hero' ? 'lit-commando' : 'bagholder-rusher', x: 10, y, z: 0, heading: 0, clip: 'idle', clipTimeSeconds: 0 }, originals: [{ renderable: true }] });
const renderer = (depth = true) => ({ context: { webGLVersion: 2 }, gl: { MAX_VERTEX_UNIFORM_VECTORS: 0, DEPTH_BITS: 1, FRAMEBUFFER_BINDING: 2,
  getContextAttributes: () => ({ depth }), getParameter: value => value === 0 ? 256 : value === 2 ? null : 24, isContextLost: () => false } });
const canvas = () => { const events = new Map(); return { addEventListener: (name, fn) => events.set(name, fn), removeEventListener: name => events.delete(name), events }; };
const backend = () => ({ created: [], removed: [], disposed: 0, frames: [], createDisplay(id) { const display = { id }; this.created.push(display); return display; },
  beginFrame(frame) { this.frames.push(frame); }, renderActor() {}, removeDisplay(display) { this.removed.push(display); }, dispose() { this.disposed++; } });

test('unsupported depth contexts fall back before assets or shader code are loaded', async () => {
  assert.equal(typeof module.createActor3dPilotController, 'function'); let loads = 0; const reports = [];
  const controller = module.createActor3dPilotController({ renderer: renderer(false), canvas: canvas(), onTelemetry: report => reports.push(report), backendFactory: () => { loads++; return backend(); } });
  await controller.start(); assert.equal(controller.status, 'fallback'); assert.equal(loads, 0);
  assert.equal(reports.at(-1).reason, 'unsupported');
  const actor = entry('hero'); controller.update([actor], camera, view); assert.equal(actor.originals[0].renderable, true);
});

test('support checks the canvas depth through Pixi and restores a startup offscreen target', async () => {
  for (const rootDepth of [24, 0]) {
    const gpu = renderer(), surface = canvas(), offscreen = {}, bindings = []; let current = offscreen;
    gpu.gl.getParameter = value => value === 0 ? 256 : value === 2 ? current === surface ? null : offscreen : current === surface ? rootDepth : 0;
    gpu.renderTarget = { renderSurface: offscreen, bind(target, clear) { assert.equal(clear, false); current = target; this.renderSurface = target; bindings.push(target); } };
    let loads = 0; const controller = module.createActor3dPilotController({ renderer: gpu, canvas: surface, backendFactory: () => { loads++; return backend(); } });
    await controller.start(); assert.equal(controller.status, rootDepth ? 'ready' : 'fallback'); assert.equal(loads, rootDepth ? 1 : 0);
    assert.deepEqual(bindings, [surface, offscreen]); assert.equal(current, offscreen); controller.dispose();
  }
});

test('failed prior-target restoration refuses support before hiding originals or loading the backend', async () => {
  const gpu = renderer(), surface = canvas(), offscreen = {}; let current = offscreen, loads = 0;
  gpu.gl.getParameter = value => value === 0 ? 256 : value === 2 ? current === surface ? null : offscreen : current === surface ? 24 : 0;
  gpu.renderTarget = { renderSurface: offscreen, bind(target) { if (target === offscreen) throw new Error('prior surface unavailable'); current = target; this.renderSurface = target; } };
  const controller = module.createActor3dPilotController({ renderer: gpu, canvas: surface, backendFactory: () => { loads++; return backend(); } });
  const hero = entry('hero'); await controller.start(); assert.equal(controller.status, 'fallback'); assert.equal(loads, 0);
  assert.equal(controller.update([hero], camera, view), false); assert.equal(hero.originals[0].renderable, true);
});

test('only successfully rendered originals hide, then restore on removal, context loss and disposal', async () => {
  const gpu = backend(), surface = canvas(), attached = [], controller = module.createActor3dPilotController({ renderer: renderer(), canvas: surface,
    attachDisplay: display => attached.push(display), backendFactory: () => gpu });
  await controller.start(); const hero = entry('hero'), enemy = entry('enemy', 11), before = JSON.stringify([hero.descriptor, enemy.descriptor]);
  assert.equal(controller.update([hero, enemy], camera, view), true);
  assert.equal(controller.ownsOriginal(enemy.originals[0], 'enemy'), true);
  assert.equal(controller.ownsOriginal(enemy.originals[0], 'retired-owner'), false);
  assert.equal(hero.originals[0].renderable, false); assert.equal(enemy.originals[0].renderable, false); assert.equal(attached.length, 2);
  assert.equal(JSON.stringify([hero.descriptor, enemy.descriptor]), before); assert.ok(Object.isFrozen(gpu.frames[0]));
  assert.ok(gpu.frames[0].every(p => Object.isFrozen(p) && !p.originals));
  controller.update([hero], camera, view); assert.equal(enemy.originals[0].renderable, true); assert.equal(gpu.removed.length, 1);
  assert.equal(controller.ownsOriginal(enemy.originals[0], 'enemy'), false);
  surface.events.get('webglcontextlost')(); assert.equal(controller.status, 'fallback'); assert.equal(hero.originals[0].renderable, true);
  assert.equal(gpu.disposed, 1); controller.dispose(); assert.equal(gpu.disposed, 1); assert.equal(surface.events.size, 0);
});

test('a draw preparation failure restores every original and releases displays exactly once', async () => {
  const gpu = backend(), controller = module.createActor3dPilotController({ renderer: renderer(), canvas: canvas(), backendFactory: () => gpu });
  await controller.start(); const hero = entry('hero'); controller.update([hero], camera, view);
  gpu.renderActor = () => { throw new Error('shader preparation'); };
  assert.equal(controller.update([hero], camera, view), false); assert.equal(controller.status, 'fallback');
  assert.equal(hero.originals[0].renderable, true); assert.equal(gpu.disposed, 1); assert.equal(gpu.removed.length, 1);
});

test('disposed pending loads cannot attach displays or hide originals', async () => {
  let finish; const gpu = backend(), controller = module.createActor3dPilotController({ renderer: renderer(), canvas: canvas(),
    backendFactory: () => new Promise(resolve => { finish = resolve; }) });
  const pending = controller.start(); await Promise.resolve(); controller.dispose(); finish(gpu); await pending;
  const hero = entry('hero'); assert.equal(controller.update([hero], camera, view), false);
  assert.equal(hero.originals[0].renderable, true); assert.equal(gpu.disposed, 1);
});

test('the medium tier rejects an oversized direct frame without mutating its originals', async () => {
  const controller = module.createActor3dPilotController({ renderer: renderer(), canvas: canvas(), backendFactory: () => backend() }); await controller.start();
  const actors = Array.from({length:25},(_,i)=>entry('enemy-'+i)); assert.equal(controller.update(actors, camera, view), false);
  assert.equal(controller.status, 'fallback'); assert.ok(actors.every(a => a.originals[0].renderable));
});

test('ranked depth bands preserve painter order even at tied/adjacent ground Y and extreme local mesh depth', () => {
  assert.equal(typeof module.actor3dDepthBands, 'function');
  for (const depths of [[1, 1], [1, 1 + Number.EPSILON], [-10000, 14000]]) {
    const bands = module.actor3dDepthBands([{ id: 'a', depth: depths[0] }, { id: 'b', depth: depths[1] }], new Map([['a', 0], ['b', 1]]));
    assert.ok(bands.get('b').center + bands.get('b').halfWidth < bands.get('a').center - bands.get('a').halfWidth);
    assert.ok([...bands.values()].every(b => b.center - b.halfWidth > -1 && b.center + b.halfWidth < 1));
  }
});

test('game presentation selects only the reviewed identity/weapon/clips and preserves copied phase clocks', () => {
  assert.equal(typeof module.createActor3dPresentationEntries, 'function');
  const hero = { actorId: 'lit-commando', weaponId: 'coin-blaster', x: 1, y: 2, z: 3, heading: 0,
    action: 'aim', actionTick: 120, moving: true, bodyHeight: 84, originals: [] };
  const enemy = { actorId:'bagholder-rusher',active:true,visible:true,alpha:1,id: 'bag-1', x: 4, y: 5, z: 6, pose: { state: 'tell', direction: 2, tick: 200, phaseTick: 10 }, originals: [] };
  const before = JSON.stringify([hero, enemy]); const frame = module.createActor3dPresentationEntries(hero, enemy);
  assert.equal(frame[0].descriptor.clip, 'run'); assert.equal(frame[0].descriptor.clipTimeSeconds, 0);
  assert.equal(frame[0].descriptor.pixelsPerMetre, 40); assert.equal(frame[1].descriptor.clip, 'tell');
  assert.equal(frame[1].descriptor.clipTimeSeconds, 10 / 60); assert.equal(frame[1].descriptor.heading, 0);
  assert.equal(JSON.stringify([hero, enemy]), before);
  assert.equal(module.createActor3dPresentationEntries({ ...hero, weaponId: 'hash-rail' }, enemy).length, 1);
  assert.equal(module.createActor3dPresentationEntries({ ...hero, action: 'interact' }, null).length, 0);
  assert.equal(module.createActor3dPresentationEntries({ ...hero, actorId: 'unapproved-hero' }, null).length, 0);
});

test('actor lifetime tracking stays bounded when a long run replaces the projected enemy repeatedly', () => {
  assert.equal(typeof module.createActor3dDepthRegistry, 'function');
  const registry = module.createActor3dDepthRegistry(); registry.add('hero');
  for (let i = 0; i < 1000; i++) {
    registry.add(`enemy-${i}`); assert.equal(registry.size, 2);
    const bands = registry.frame([{ id: 'hero', depth: 10 }, { id: `enemy-${i}`, depth: 10 }]);
    assert.ok(bands.get(`enemy-${i}`).center < bands.get('hero').center);
    registry.remove(`enemy-${i}`); assert.equal(registry.size, 1);
  }
  registry.clear(); assert.equal(registry.size, 0);
});

test('pending load disposal aborts the backend resource request', async () => {
  let signal;
  const controller = module.createActor3dPilotController({ renderer: renderer(), canvas: canvas(),
    backendFactory: options => { signal = options.signal; return backend(); } });
  await controller.start(); assert.equal(signal?.aborted, false); controller.dispose(); assert.equal(signal.aborted, true);
});


test('Liquidator keeps priority alongside eligible rushers and restores its fading sprite', async () => {
  const hero={actorId:'lit-commando',weaponId:'coin-blaster',x:0,y:0,z:0,heading:0,action:'idle',actionTick:0,bodyHeight:84,originals:[{renderable:true}]};
  const enemy={actorId:'bagholder-rusher',active:true,visible:true,alpha:1,id:'rusher',x:1,y:1,z:0,pose:{state:'run',direction:2,tick:4},originals:[{renderable:true}]};
  const boss={active:true,visible:true,alpha:1,x:2,y:3,z:0,bodyHeight:84,pose:{state:'hit',direction:4,phaseTick:4},original:{renderable:true}};
  const before=JSON.stringify([hero,enemy,boss]);
  const frame=module.createActor3dPresentationEntries(hero,enemy,boss);
  assert.deepEqual(frame.map(e=>e.descriptor.actorId),['lit-commando','the-liquidator','bagholder-rusher']);
  assert.equal(frame[1].descriptor.heading,Math.PI);assert.equal(frame[1].descriptor.clipTimeSeconds,4/60);
  assert.equal(JSON.stringify([hero,enemy,boss]),before);
  const gpu=backend(),surface=canvas(),controller=module.createActor3dPilotController({renderer:renderer(),canvas:surface,backendFactory:()=>gpu});
  await controller.start();controller.updateGame(hero,enemy,camera,view,boss);
  assert.equal(boss.original.renderable,false);assert.equal(enemy.originals[0].renderable,false);
  controller.updateGame(hero,enemy,camera,view,{...boss,alpha:.5});
  assert.equal(boss.original.renderable,true);assert.equal(enemy.originals[0].renderable,false);
  assert.equal(controller.status,'ready');assert.equal(gpu.frames.at(-1).length,2);
  controller.updateGame(hero,enemy,camera,view,boss);surface.events.get('webglcontextlost')();
  assert.equal(boss.original.renderable,true);assert.equal(hero.originals[0].renderable,true);controller.dispose();
});


test('quality caps select the closest exact visible opaque rushers independent of input order', () => {
  assert.deepEqual(module.ACTOR3D_QUALITY_LIMITS,{low:8,medium:24,high:64});
  const hero={actorId:'lit-commando',weaponId:'coin-blaster',x:0,y:0,z:0,heading:0,action:'idle',actionTick:0,originals:[]};
  const boss={active:true,visible:true,alpha:1,x:100,y:100,z:0,bodyHeight:84,pose:{state:'idle',direction:0,tick:0},original:{renderable:true}};
  const enemies=Array.from({length:80},(_,i)=>({id:String(i).padStart(2,'0'),actorId:'bagholder-rusher',active:true,visible:true,alpha:1,x:Math.floor(i/2),y:0,z:0,pose:{state:'run',direction:2,tick:4},originals:[{renderable:true}]}));
  const bad=[{...enemies[0],id:'wrong',actorId:'short-seller'},{...enemies[0],id:'hidden',visible:false},{...enemies[0],id:'faded',alpha:.5},{...enemies[0],id:'dead',active:false}];
  const before=JSON.stringify([hero,boss,enemies,bad]);
  for(const maxActors of [8,24,64]){
    const selected=module.createActor3dPresentationEntries(hero,[...bad,...enemies],boss,maxActors);
    assert.equal(selected.length,maxActors);assert.deepEqual(selected.slice(0,2).map(x=>x.descriptor.id),['hero','boss:liquidator']);
    assert.deepEqual(selected.slice(2).map(x=>x.descriptor.id),enemies.slice(0,maxActors-2).map(x=>'enemy:'+x.id));
    assert.deepEqual(module.createActor3dPresentationEntries(hero,[...enemies,...bad].reverse(),boss,maxActors),selected);
  }
  assert.equal(JSON.stringify([hero,boss,enemies,bad]),before);
});

test('changing crowded selections restores excess sprites and context loss releases every selected display', async () => {
  let options;const gpu=backend(),surface=canvas(),controller=module.createActor3dPilotController({qualityTier:'low',renderer:renderer(),canvas:surface,backendFactory:o=>{options=o;return gpu;}});
  const enemies=Array.from({length:20},(_,i)=>({id:'crowd-'+i,actorId:'bagholder-rusher',active:true,visible:true,alpha:1,x:i*10,y:0,z:0,pose:{state:'idle',direction:0,tick:0},originals:[{renderable:i!==19}]}));
  await controller.start();assert.equal(options.maxActors,8);
  controller.updateGame(null,enemies,camera,view);assert.equal(gpu.frames.at(-1).length,8);
  assert.ok(enemies.slice(0,8).every(e=>!e.originals[0].renderable));assert.ok(enemies.slice(8,19).every(e=>e.originals[0].renderable));
  controller.updateGame(null,enemies,{...camera,x:190},view);
  assert.ok(enemies.slice(0,12).every(e=>e.originals[0].renderable));assert.ok(enemies.slice(12).every(e=>!e.originals[0].renderable));
  assert.equal(gpu.removed.length,8);assert.equal(gpu.created.length-gpu.removed.length,8);
  surface.events.get('webglcontextlost')();assert.ok(enemies.slice(0,19).every(e=>e.originals[0].renderable));assert.equal(enemies[19].originals[0].renderable,false);
  assert.equal(gpu.created.length,gpu.removed.length);assert.equal(gpu.disposed,1);controller.dispose();assert.equal(gpu.disposed,1);
});

test('high-tier depth ownership remains bounded and nonoverlapping for sixty-four actors', () => {
  const registry=module.createActor3dDepthRegistry(64),frame=Array.from({length:64},(_,i)=>({id:'actor-'+i,depth:10}));
  for(const actor of frame)registry.add(actor.id);assert.equal(registry.size,64);assert.throws(()=>registry.add('overflow'));
  const bands=registry.frame(frame);
  for(let i=1;i<frame.length;i++)assert.ok(bands.get(frame[i].id).center+bands.get(frame[i].id).halfWidth<bands.get(frame[i-1].id).center-bands.get(frame[i-1].id).halfWidth);
  registry.remove(frame[0].id);registry.add('replacement');assert.equal(registry.size,64);registry.clear();assert.equal(registry.size,0);
});


test('malformed crowd selection restores prior sprites before falling back', async () => {
  const gpu=backend(),controller=module.createActor3dPilotController({renderer:renderer(),canvas:canvas(),backendFactory:()=>gpu});
  const enemy={id:'rusher',actorId:'bagholder-rusher',active:true,visible:true,alpha:1,x:0,y:0,z:0,pose:{state:'idle',direction:0,tick:0},originals:[{renderable:true}]};
  await controller.start();controller.updateGame(null,[enemy],camera,view);assert.equal(enemy.originals[0].renderable,false);
  const badBoss={active:true,visible:true,alpha:1,x:0,y:0,z:0,bodyHeight:84,pose:{state:'idle',direction:9,tick:0},original:{renderable:true}};
  assert.equal(controller.updateGame(null,[enemy],camera,view,badBoss),false);assert.equal(controller.status,'fallback');
  assert.equal(enemy.originals[0].renderable,true);assert.equal(badBoss.original.renderable,true);assert.equal(gpu.disposed,1);controller.dispose();
});


for (const heroActorId of ['lilly', 'lit-valkyrie', 'lester-original']) test(`selected ${heroActorId} uses its own hero identity and only that hero loads`, async () => {
  const gpu=backend(); let options;
  const controller=module.createActor3dPilotController({renderer:renderer(),canvas:canvas(),heroActorId,backendFactory:value=>{options=value;return gpu;}});
  const original={renderable:true}, hero={actorId:heroActorId,weaponId:'coin-blaster',x:0,y:0,z:0,heading:0,action:'run',actionTick:15,bodyHeight:84,originals:[original]};
  await controller.start();assert.equal(options.heroActorId,heroActorId);
  assert.equal(controller.updateGame(hero,[],camera,view),true);
  assert.equal(gpu.frames.at(-1)[0].actorId,heroActorId);assert.equal(gpu.frames.at(-1)[0].clip,'run');assert.equal(original.renderable,false);
  const foreign={renderable:true};controller.updateGame({...hero,actorId:'lit-commando',originals:[foreign]},[],camera,view);
  assert.equal(gpu.frames.at(-1).length,0);assert.equal(original.renderable,true);assert.equal(foreign.renderable,true);controller.dispose();
});

test('unsupported heroes retain their sprite without allocating another hero model', async () => {
  let options;const gpu=backend(),controller=module.createActor3dPilotController({renderer:renderer(),canvas:canvas(),heroActorId:'unapproved-hero',backendFactory:value=>{options=value;return gpu;}});
  await controller.start();assert.equal(options.heroActorId,null);controller.dispose();
});

test('equipped body and weapon colours survive detached 3D projection and restore after a hit flash', async () => {
  const gpu=backend(), controller=module.createActor3dPilotController({renderer:renderer(),canvas:canvas(),backendFactory:()=>gpu});
  const hero={actorId:'lit-commando',weaponId:'coin-blaster',x:0,y:0,z:0,heading:0,action:'idle',actionTick:0,bodyHeight:84,
    bodyTint:0x55aacc,weaponTint:0xeebb55,originals:[{renderable:true}]};
  await controller.start();controller.updateGame(hero,[],camera,view);
  const equipped=gpu.frames.at(-1)[0];assert.equal(equipped.bodyTint,0x55aacc);assert.equal(equipped.weaponTint,0xeebb55);
  controller.updateGame({...hero,bodyTint:0xffaaaa,weaponTint:0xffaaaa},[],camera,view);
  const hit=gpu.frames.at(-1)[0];assert.equal(hit.bodyTint,0xffaaaa);assert.equal(hit.weaponTint,0xffaaaa);
  controller.updateGame(hero,[],camera,view);assert.equal(gpu.frames.at(-1)[0].weaponTint,0xeebb55);
  hero.bodyTint=0;assert.equal(equipped.bodyTint,0x55aacc);assert.ok(Object.isFrozen(equipped));controller.dispose();
});


test('all exact native enemy identities retain sprites until ready and after removal', async () => {
  const gpu=backend(), ready=new Set(['lit-commando','bagholder-rusher']), requested=[];
  gpu.prepareActor=id=>{requested.push(id);return ready.has(id);};
  const controller=module.createActor3dPilotController({renderer:renderer(),canvas:canvas(),backendFactory:()=>gpu});
  const enemies=module.ACTOR3D_ENEMY_IDS.map((actorId,i)=>({id:actorId,actorId,active:true,visible:true,alpha:1,x:i,y:0,z:0,pose:{state:'run',direction:2,tick:4},originals:[{renderable:true}]}));
  await controller.start();controller.updateGame(null,enemies,camera,view);
  assert.deepEqual(gpu.frames.at(-1).map(p=>p.actorId),['bagholder-rusher']);
  assert.ok(enemies.slice(1).every(e=>e.originals[0].renderable));
  for(const id of module.ACTOR3D_ENEMY_IDS)ready.add(id);
  controller.updateGame(null,enemies,camera,view);
  assert.deepEqual(gpu.frames.at(-1).map(p=>p.actorId),module.ACTOR3D_ENEMY_IDS);
  assert.ok(enemies.every(e=>!e.originals[0].renderable));
  controller.updateGame(null,[{...enemies[0],actorId:'unknown-zombie'}],camera,view);
  assert.equal(gpu.frames.at(-1).length,0);assert.ok(enemies.every(e=>e.originals[0].renderable));
  assert.ok(!requested.includes('unknown-zombie'));controller.dispose();
});

test('actual optional backend serializes archetype loads, isolates failure and closes late decoded images', async () => {
  const {readFileSync}=await import('node:fs'),vm=await import('node:vm');
  const source=readFileSync(new URL('../apps/hmh-reboot/src/actor-3d-pixi.mjs',import.meta.url),'utf8');
  const code=source.slice(source.indexOf('export async function createActor3dPixiBackend')).replace('export ','');
  const urls=[],closed=[],textures=[];let waitingResolve,hold=false;
  const context=vm.createContext({Blob,Promise,vertex:'',fragment:'',ACTOR3D_ENEMY_IDS:module.ACTOR3D_ENEMY_IDS,
    createActor3dDepthRegistry:module.createActor3dDepthRegistry,State:class{},
    GlProgram:{from:()=>({destroy(){}})},RenderTexture:{create:()=>({destroy(){}})},
    Texture:{from:bitmap=>{const t={source:{},destroy(){textures.push(bitmap.id);}};return t;}},
    Shader:class{destroy(){}},decodeActor3dGlb:()=>({images:[{data:new Uint8Array([1]),mimeType:'image/png'}],primitives:[]}),createActor3dJointBounds:()=>[],
  });vm.runInContext(code,context);
  const render={texture:{bind(){}},shader:{bind(){},resetState(){}},gl:{NO_ERROR:0,getError:()=>0,getParameter:()=>({}),getProgramParameter:()=>true}};
  let imageId=0;
  const gpu=await context.createActor3dPixiBackend({renderer:render,heroActorId:null,
    fetchAsset:async url=>{urls.push(url);if(url.includes('validator-cultist'))throw Error('missing optional model');return {ok:true,arrayBuffer:async()=>new ArrayBuffer(1)};},
    decodeImage:async()=>{const id=++imageId;if(hold)return new Promise(resolve=>{waitingResolve=()=>resolve({id,close(){closed.push(id);}});});return {id,close(){closed.push(id);}};},
  });
  assert.equal(urls.length,2);assert.equal(gpu.prepareActor('bagholder-rusher'),true);
  assert.equal(gpu.prepareActor('validator-cultist'),false);
  for(let i=0;i<12;i++)await Promise.resolve();
  assert.equal(gpu.prepareActor('validator-cultist'),false);assert.equal(gpu.prepareActor('bagholder-rusher'),true);
  assert.equal(urls.filter(x=>x.includes('validator-cultist')).length,1);
  hold=true;assert.equal(gpu.prepareActor('forkrunner'),false);assert.equal(gpu.prepareActor('forkrunner'),false);assert.equal(gpu.prepareActor('gas-bomber'),false);
  for(let i=0;i<12&&!waitingResolve;i++)await Promise.resolve();
  assert.equal(typeof waitingResolve,'function');assert.equal(urls.filter(x=>x.includes('forkrunner')).length,1);assert.ok(!urls.some(x=>x.includes('gas-bomber')));
  gpu.dispose();waitingResolve();for(let i=0;i<20;i++)await Promise.resolve();
  assert.deepEqual(closed.sort(),[1,2,3]);assert.deepEqual(textures.sort(),[1,2]);
  assert.ok(!urls.some(x=>x.includes('gas-bomber')));assert.equal(gpu.prepareActor('forkrunner'),false);gpu.dispose();
});
