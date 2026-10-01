import { Application, Container, Graphics, Sprite, Texture, Rectangle } from 'pixi.js';
import { createGreyboxWorld } from './greybox-world-v1.mjs';
import { createGreyboxGroundPaint } from './greybox-ground-presentation.mjs';
import { createGreyboxPropResidency } from './greybox-prop-residency.mjs';
import { createWorldV2Geometry } from '../world-v2-geometry.mjs';
import { createWorldV2LocalRuntime } from './world-v2-local-runtime.mjs';
import { createLocalMeadowsRelayPlan } from './world-v2-local-relay.mjs';
import { createAreaArt, createAreaArtTextureCache } from '../world-v2-area-art.mjs';
import { createRugpullWoodsArtPlan } from '../world-v2-area-plans/rugpull-woods.mjs';
import { createMwebMeadowsArtPlan } from '../world-v2-area-plans/mweb-meadows.mjs';
import { createHalvingFarmsArtPlan } from '../world-v2-area-plans/halving-farms.mjs';
import { createWorldRoadsArtPlan } from '../world-v2-area-plans/world-roads.mjs';
import { quantizeDirection } from '../movement.mjs';
import { InputState, createBrowserInputController } from '../input.mjs';
import { TouchControlState } from '../touch-controls.mjs';
import { createCameraState, followCameraTarget, worldToScreen, interpolateStep } from '../world-space.mjs';
import { createAuthoredGroundQuery } from '../elevation.mjs';
import { PRODUCTION_HERO_ASSETS, PRODUCTION_HERO_RUNTIME_SCALE } from '../production-hero-assets.mjs';
import { createProductionHeroAtlasIndex, createProductionHeroDisplay } from '../production-hero-atlas.mjs';

const asset=PRODUCTION_HERO_ASSETS['lit-commando'];
const points=area=>area.type==='polygon'?area.vertices:[{x:area.minX,y:area.minY},{x:area.maxX,y:area.minY},{x:area.maxX,y:area.maxY},{x:area.minX,y:area.maxY}];

// Match the existing launch lifetime's synchronous mount contract. Every async
// resource is owned here; no default game, parent session or legacy hooks load.
// Area art is a presentation switch (default on, like the Meadows art target);
// disabling it leaves the flat greybox and loads no kit page or tile.
export function mountGreyboxPlaytest(root,{areaArt=true}={}){
  const authored=createGreyboxWorld(),abort=new AbortController(),input=new InputState(),touch=new TouchControlState({stickRadius:64});
  const relayPlan=createLocalMeadowsRelayPlan(authored);
  const textureCache=areaArt?createAreaArtTextureCache():null;
  const arts=areaArt?[['rugpull-woods',createRugpullWoodsArtPlan],['mweb-meadows',createMwebMeadowsArtPlan],['halving-farms',createHalvingFarmsArtPlan],['world-roads',createWorldRoadsArtPlan]].flatMap(([areaId,make])=>{const plan=make(authored);return plan?[createAreaArt({world:authored,areaId,plan,textureCache,signal:abort.signal,resolution:window.innerWidth<768?'half':'full'})]:[];}):[];
  let geometry=createWorldV2Geometry(authored),runtime=createWorldV2LocalRuntime({geometry,relayPlan});
  let disposed=false,failure=null,initialized=false,initSettled=false,appDestroyed=false,atlasTexture=null,image=null,hero=null,inputController=null;
  let frameId=null,lastTime=null,generation=0,inspectionJumps=0,renderFrames=0,nativeEvents=0,navWaitMs=null,width=1,height=1,shown=false;
  let camera=null,worldLayer=null,depthLayer=null,visiblePieces=0,relayRing=null,relayLamp=null,relayCueKey=null;
  const cleanupErrors=[],propOrder=new WeakMap(),app=new Application();
  const solidPieces=authored.pieces.filter(piece=>piece.blocker),piecesById=new Map(solidPieces.map(piece=>[piece.id,piece]));
  const propResidency=createGreyboxPropResidency({catalog:solidPieces.map(piece=>({id:piece.id,areaId:piece.areaId??null,
    bounds:{left:piece.visible.bounds.minX,right:piece.visible.bounds.maxX,top:piece.visible.bounds.minY-piece.visible.height,bottom:piece.visible.bounds.maxY}})),
    create:drawSolid,setVisible:(graphic,visible)=>{graphic.visible=visible;},destroy:graphic=>{if(!graphic.destroyed)graphic.destroy({children:true});}});
  const startedAt=performance.now();
  root.innerHTML='<header class="world-header"><div class="world-title"><strong>HMH · LOCAL FREE WORLD TEST</strong><span>Greybox routes · Meadows, Woods, Farms and road art · No score or rewards</span></div><div class="world-tools"><label>Inspection jump<select data-area-select aria-label="Inspection jump"></select></label><button data-inspect>Inspect</button><button data-start>Begin</button><button data-pause>Pause</button><button data-close>Close</button></div></header><section class="world-stage" data-stage aria-label="Local world"><div class="world-badge"><span data-area-name></span><output data-position></output></div><p class="world-status" data-status role="status" aria-live="polite">Preparing human art and navigation…</p></section><footer class="world-footer"><div class="world-instructions"><b>Walk with WASD / arrows or the movement stick.</b><span data-relay-task role="status" aria-live="polite">Restore the Meadows relay.</span><small>Other objectives, combat and climbing are staged. Inspection jumps reset the relay.</small><output data-nav>Building static return-to-inspection navigation…</output></div><button class="world-stick" data-stick aria-label="Movement stick"><span data-stick-knob></span></button></footer>';
  const stage=root.querySelector('[data-stage]'),start=root.querySelector('[data-start]'),pauseButton=root.querySelector('[data-pause]'),closeButton=root.querySelector('[data-close]');
  const inspect=root.querySelector('[data-inspect]'),select=root.querySelector('[data-area-select]'),status=root.querySelector('[data-status]');
  const areaName=root.querySelector('[data-area-name]'),position=root.querySelector('[data-position]'),navLabel=root.querySelector('[data-nav]'),relayTask=root.querySelector('[data-relay-task]');
  const stick=root.querySelector('[data-stick]'),knob=root.querySelector('[data-stick-knob]');
  start.disabled=true;pauseButton.disabled=true;inspect.disabled=true;stick.disabled=true;
  for(const area of authored.areas){const option=document.createElement('option');option.value=area.id;option.textContent=area.name;select.appendChild(option);}select.value='mweb-meadows';
  const on=(target,type,fn,options={})=>target.addEventListener(type,fn,{...options,signal:abort.signal});
  const safe=action=>{try{action();}catch(error){cleanupErrors.push(String(error?.message??error));}};
  const stopFrame=()=>{if(frameId!==null)cancelAnimationFrame(frameId);frameId=null;lastTime=null;};
  const clearInput=reason=>{touch.cancelAll();input.reset(reason,performance.now());knob.style.transform='translate(0,0)';};
  function destroyApp(){
    if(!initSettled||appDestroyed)return;appDestroyed=true;
    if(app.renderer){
      const renderer=app.renderer,ownedStage=app.stage;
      try{app.destroy(true,{children:true,texture:true,textureSource:false});}
      catch(error){
        // A plugin may have failed part-way through init. Retain that cleanup
        // error, then release any still-owned resources the plugin walk missed.
        cleanupErrors.push(String(error?.message??error));
        safe(()=>app.ticker?.destroy());safe(()=>app._cancelResize?.());
        if(app.queueResize)safe(()=>window.removeEventListener('resize',app.queueResize));
        if(ownedStage&&!ownedStage.destroyed)safe(()=>ownedStage.destroy({children:true,texture:true,textureSource:false}));
        if(renderer&&!renderer.destroyed)safe(()=>renderer.destroy(true));
      }
    }else if(app.stage&&!app.stage.destroyed)safe(()=>app.stage.destroy({children:true}));
  }
  function dispose(){
    if(disposed){safe(()=>propResidency.dispose());return;}disposed=true;generation++;stopFrame();abort.abort();clearInput('local-world-disposed');
    safe(()=>inputController?.destroy());inputController=null;runtime.dispose();safe(()=>propResidency.dispose());for(const art of arts)safe(()=>art.dispose());safe(()=>textureCache?.dispose());destroyApp();
    if(atlasTexture){safe(()=>atlasTexture.destroy(true));atlasTexture=null;}
    if(image){image.removeAttribute('src');image=null;}hero=null;
    for(const button of root.querySelectorAll('button'))button.disabled=true;
    root.dataset.worldState='disposed';status.hidden=false;status.textContent='Local test closed. Reload this page to open a fresh scene.';
  }
  function fail(error){if(disposed)return;failure=String(error?.message??error);dispose();root.dataset.worldState='failed';status.textContent=`Local world could not open: ${failure}. Reload to retry.`;}
  function pause(reason='Paused'){
    if(disposed)return;runtime.pause();stopFrame();clearInput(reason);pauseButton.textContent='Resume';
    if(runtime.snapshot().phase==='paused'){root.dataset.worldState='paused';status.hidden=false;status.textContent=`${reason}. Select Resume when ready.`;}
  }
  const syncTouch=()=>{const state=touch.snapshot();input.setTouch(state,performance.now());knob.style.transform=`translate(${state.moveX*45}%,${state.moveY*45}%)`;};
  on(stick,'pointerdown',event=>{if(disposed||runtime.snapshot().phase!=='active'||touch.pointers.has(event.pointerId))return;event.preventDefault();
    try{stick.setPointerCapture(event.pointerId);}catch{}touch.beginStick(event.pointerId,'move',{x:event.clientX,y:event.clientY});syncTouch();nativeEvents++;});
  on(stick,'pointermove',event=>{if(touch.movePointer(event.pointerId,{x:event.clientX,y:event.clientY})){event.preventDefault();syncTouch();nativeEvents++;}});
  on(stick,'pointerup',event=>{if(touch.endPointer(event.pointerId)){syncTouch();nativeEvents++;}});
  on(stick,'pointercancel',()=>pause('Touch cancelled'));
  on(stick,'lostpointercapture',event=>{if(touch.pointers.has(event.pointerId))pause('Movement contact lost');});
  on(stick,'touchend',event=>{if(event.touches?.length===0&&touch.endAllPointers())syncTouch();});
  on(stick,'touchcancel',()=>pause('Touch cancelled'));
  on(window,'blur',()=>pause('Focus lost'));on(document,'visibilitychange',()=>{if(document.hidden)pause('Tab hidden');});
  on(window,'keydown',event=>{if(event.code==='Escape'){event.preventDefault();pause('Paused');}if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code))nativeEvents++;});
  // The production controller owns window-level keys. A select/button retains
  // normal keyboard semantics instead of also steering the actor.
  on(root,'keydown',event=>{if(['SELECT','BUTTON'].includes(event.target?.tagName)&&event.code!=='Escape')event.stopPropagation();});
  on(root,'focusin',event=>{if([start,pauseButton,closeButton,inspect,select].includes(event.target))clearInput('toolbar-focus');});
  on(closeButton,'click',dispose);
  function begin(){
    if(disposed||document.hidden)return;
    const phase=runtime.snapshot().phase;
    if(phase!=='ready'&&phase!=='paused')return;
    clearInput('explicit-start');phase==='ready'?runtime.start():runtime.resume();
    start.disabled=true;pauseButton.disabled=false;pauseButton.textContent='Pause';stick.disabled=false;status.hidden=true;root.dataset.worldState='active';
    app.canvas.focus({preventScroll:true});
    stopFrame();frameId=requestAnimationFrame(frame);
  }
  on(start,'click',begin);on(pauseButton,'click',()=>{if(runtime.snapshot().phase==='active')pause();else begin();});
  function setCamera(){const actor=runtime.snapshot().actor;camera=createCameraState({x:actor.x,y:actor.y,groundZ:actor.groundZ,bounds:geometry.bounds,
    zoom:Math.max(.65,Math.min(1,height/760)),smoothTime:.1,lookAheadSeconds:.35,maxLookAhead:64,deadZone:{width:160,height:90}});}
  function resize(){
    if(disposed||!initialized)return;const box=stage.getBoundingClientRect();width=Math.max(1,box.width);height=Math.max(1,box.height);app.renderer.resize(width,height);
    if(camera)camera.zoom=Math.max(.65,Math.min(1,height/760));if(shown&&!document.hidden)draw(1,1/60);
  }
  on(window,'resize',resize);if(window.visualViewport)on(window.visualViewport,'resize',resize);
  const polygon=(graphic,vertices,color,stroke=null)=>{graphic.poly(vertices.flatMap(point=>[point.x,point.y])).fill(color);if(stroke)graphic.stroke({color:stroke,width:2});};
  function drawSolid(record){
    const piece=piecesById.get(record.id),b=piece.visible.bounds,vertices=piece.visible.vertices??points({type:'rect',...b}),height=piece.visible.height;
    let graphic=null;for(const art of arts){graphic=art.createSolid(piece);if(graphic)break;}graphic??=new Graphics();const roof=vertices.map(point=>({x:point.x,y:point.y-height}));
    try{
      if(!graphic.areaArtDecorated){
        for(let i=0;i<vertices.length;i++){const j=(i+1)%vertices.length;polygon(graphic,[vertices[i],vertices[j],roof[j],roof[i]],'#43565a');}
        polygon(graphic,roof,piece.kind==='cover-short'?'#a0aaa0':'#718582','#b8c8bf');
      }graphic.zIndex=b.maxY;graphic.label=`local-prop-${piece.id}`;propOrder.set(graphic,record.ordinal);
      // Pixi's stable numeric depth sort otherwise makes eviction/re-entry alter
      // equal-depth authored overlap. Restore the original tie order on insert.
      const next=depthLayer.children.find(child=>child.zIndex===b.maxY&&(propOrder.get(child)??Infinity)>record.ordinal);
      if(next)depthLayer.addChildAt(graphic,depthLayer.getChildIndex(next));else depthLayer.addChild(graphic);
      return graphic;
    }catch(error){graphic.destroy({children:true});throw error;}
  }
  function createWorldGraphics(){
    worldLayer=new Container();depthLayer=new Container();depthLayer.sortableChildren=true;app.stage.addChild(worldLayer);
    const ground=new Container();worldLayer.addChild(ground);worldLayer.addChild(depthLayer);
    const surfaces=[authored.baseSurface,...authored.surfaces],byId=new Map(surfaces.map(surface=>[surface.id,surface]));
    for(const command of createGreyboxGroundPaint(surfaces)){
      const surface=byId.get(command.surfaceId);if(!surface.walkable&&surface.kind!=='water')continue;
      if(arts.some(art=>art.paintSurface({target:ground,surface,vertices:command.vertices})))continue;
      const query=createAuthoredGroundQuery({baseSurface:surface});const graphic=new Graphics();
      polygon(graphic,command.vertices.map(point=>({x:point.x,y:point.y-query(point.x,point.y).groundZ})),command.fill,command.stroke);ground.addChild(graphic);
    }
    relayRing=new Graphics();relayRing.label='local-relay-ring';ground.addChild(relayRing);
    relayLamp=new Graphics();relayLamp.label='local-relay-lamp';relayLamp.zIndex=relayPlan.lamp.y+.01;depthLayer.addChild(relayLamp);
    depthLayer.addChild(hero.container);for(const art of arts)art.mount(depthLayer,ground);
  }
  function drawRelay(state){
    const relay=state.relay,done=relay.completionTick!==null;
    const key=done?'done':relay.committed?'starting':relay.eligible?'in-reach':'waiting';
    if(key===relayCueKey)return;relayCueKey=key;
    const color=done?'#b8ef9c':relay.committed?'#f4d984':relay.eligible?'#f5e5ae':'#92aea1';
    const groundZ=geometry.queryGround(relayPlan.operate.x,relayPlan.operate.y).groundZ;
    relayRing.clear().circle(relayPlan.operate.x,relayPlan.operate.y-groundZ,relayPlan.ringRadius)
      .fill({color,alpha:done?.08:.14}).stroke({color,width:2});
    const lamp=relayPlan.lamp,lampGround=geometry.queryGround(lamp.x,lamp.y).groundZ;
    relayLamp.clear().circle(lamp.x,lamp.y-lampGround-lamp.z,8).fill(color).stroke({color:'#24372f',width:2});
    const text=done?'Relay restored. Local test complete — no rewards.':relay.committed?'Relay starting…':relay.eligible
      ?'Relay switch in reach — stay nearby to activate.':'Restore the Meadows relay — east of the entry green.';
    if(relayTask.textContent!==text)relayTask.textContent=text;
  }
  function draw(alpha=1,dtSeconds=1/60){
    if(disposed||!shown||document.hidden)return;
    const state=runtime.snapshot(),actor=state.actor,previous=state.previousActor??actor;
    const view={width,height},render={...actor,x:interpolateStep(previous.x,actor.x,alpha),y:interpolateStep(previous.y,actor.y,alpha),
      groundZ:interpolateStep(previous.groundZ,actor.groundZ,alpha)};
    followCameraTarget(camera,render,view,{dtSeconds:Math.max(.001,Math.min(.1,dtSeconds)),maxDeadZoneFraction:.25});
    const origin=worldToScreen({x:0,y:0,z:0},camera,view);worldLayer.position.set(origin.x,origin.y);worldLayer.scale.set(camera.zoom);
    hero.container.position.set(render.x,render.y-render.groundZ);hero.container.zIndex=render.y;
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches,operating=state.relay.operating;
    const torsoDirection=operating?quantizeDirection({x:relayPlan.lamp.x-actor.x,y:relayPlan.lamp.y-actor.y},8):actor.torsoDirection;
    hero.applyPose({simulationTick:reduced?0:state.tick,action:operating?'interact':'aim',actionTick:operating&&!reduced?Math.max(0,state.tick-state.relay.commitTick):0,
      locomotion:actor.locomotion,legDirection:actor.legDirection,torsoDirection});
    hero.setLayerVisible('weapon',!operating);drawRelay(state);
    visiblePieces=propResidency.update({camera,view});for(const art of arts)art.update(camera,view,render);
    areaName.textContent=geometry.getAreaAt(actor.x,actor.y)?.name??'Connecting road';position.textContent=`${Math.round(actor.x)}, ${Math.round(actor.y)} · height ${Math.round(actor.groundZ)}`;
    app.render();renderFrames++;
  }
  function frame(now){
    frameId=null;if(disposed||runtime.snapshot().phase!=='active'||document.hidden)return;
    try{
      const delta=lastTime===null?0:Math.max(0,now-lastTime);lastTime=now;
      const actor=runtime.snapshot().actor,read=input.snapshot({actor:{...actor,z:actor.groundZ},camera,viewport:{width,height},nowMs:performance.now()});
      if(read.actions.pause){pause();return;}
      const actions={move:read.actions.move,aim:read.actions.aim.active?read.actions.aim:{...read.actions.move,active:Math.hypot(read.actions.move.x,read.actions.move.y)>.001}};
      const result=runtime.advance(delta,actions);draw(result.alpha,delta/1000);
      if(!disposed&&runtime.snapshot().phase==='active')frameId=requestAnimationFrame(frame);
    }catch(error){fail(error);}
  }
  function navigationReady(){
    const nav=runtime.snapshot().nav;start.disabled=false;pauseButton.disabled=true;pauseButton.textContent='Pause';inspect.disabled=false;stick.disabled=true;
    status.hidden=false;status.textContent='Ready. Select Begin to walk this local world.';
    navLabel.textContent=`${(nav.columns*nav.rows).toLocaleString('en-US')} navigation cells · static return-to-inspection route`;
    root.dataset.worldState='ready';setCamera();draw();
  }
  on(inspect,'click',()=>{
    if(disposed||!shown)return;const area=authored.areas.find(value=>value.id===select.value);
    if(!area){status.hidden=false;status.textContent='Choose an authored area from the inspection list.';return;}
    let nextGeometry,nextRuntime;
    try{nextGeometry=createWorldV2Geometry({...authored,spawn:area.center});nextRuntime=createWorldV2LocalRuntime({geometry:nextGeometry,relayPlan});}
    catch(error){status.hidden=false;status.textContent=`Inspection unavailable: ${error.message}`;return;}
    pause('Preparing inspection');runtime.dispose();runtime=nextRuntime;geometry=nextGeometry;inspectionJumps++;const current=++generation,beginAt=performance.now();
    start.disabled=true;pauseButton.disabled=true;stick.disabled=true;status.textContent=`Preparing ${area.name} inspection…`;root.dataset.worldState='preparing';
    nextRuntime.ready.then(()=>{if(disposed||current!==generation)return;navWaitMs=performance.now()-beginAt;navigationReady();})
      .catch(error=>{if(!disposed&&current===generation)fail(error);});
  });

  const initTask=(async()=>{
    try{const box=stage.getBoundingClientRect();await app.init({width:Math.max(1,box.width),height:Math.max(1,box.height),background:'#283234',antialias:true,
      resolution:Math.min(2,window.devicePixelRatio||1),autoDensity:true,autoStart:false,sharedTicker:false,preference:'webgl'});initialized=true;app.ticker.stop();}
    finally{initSettled=true;if(disposed)destroyApp();}
  })();
  const atlasTask=(async()=>{
    image=new Image();image.src=asset.imageUrl;
    const [response]=await Promise.all([fetch(asset.metadataUrl,{signal:abort.signal,credentials:'same-origin'}),image.decode()]);
    if(!response.ok)throw Error(`Human atlas metadata HTTP ${response.status}`);
    const metadata=await response.json();if(disposed)return null;return createProductionHeroAtlasIndex(metadata,asset);
  })();
  const ready=(async()=>{
    try{
      const [,,atlas]=await Promise.all([initTask,runtime.ready,atlasTask,...arts.map(art=>art.ready)]);if(disposed)return;
      navWaitMs=performance.now()-startedAt;
      atlasTexture=Texture.from(image,true);hero=createProductionHeroDisplay({index:atlas,atlasTexture,ContainerClass:Container,SpriteClass:Sprite,TextureClass:Texture,RectangleClass:Rectangle});
      createWorldGraphics();resize();stage.appendChild(app.canvas);app.canvas.setAttribute('aria-label','Playable local Free world');app.canvas.tabIndex=0;
      // BrowserInputController uses client coordinates; this canvas begins below
      // the toolbar, so translate only its pointer projection into local pixels.
      const setPointer=input.setPointer.bind(input);input.setPointer=(value,at)=>{const box=app.canvas.getBoundingClientRect();return setPointer({...value,screenX:value.screenX-box.left,screenY:value.screenY-box.top},at);};
      inputController=createBrowserInputController({input,target:app.canvas,windowRef:window,documentRef:document});
      on(app.canvas,'pointercancel',()=>pause('Pointer cancelled'));on(app.canvas,'touchcancel',()=>pause('Touch cancelled'));
      shown=true;navigationReady();
    }catch(error){if(disposed)return;fail(error);throw error;}
  })();
  return Object.freeze({ready,dispose,snapshot:()=>Object.freeze({disposed,failure,cleanupErrors:Object.freeze([...cleanupErrors]),inspectionJumps,renderFrames,nativeEvents,navWaitMs,
    frameScheduled:frameId!==null,width,height,visiblePieces,assetsReady:Boolean(hero&&atlasTexture),rendererType:appDestroyed?null:app.renderer?.type??null,
    heroArtSource:hero?.artSource??null,heroFrameIds:hero?.container.frameIds??'',bodyScale:PRODUCTION_HERO_RUNTIME_SCALE,cameraZoom:camera?.zoom??null,
    heldKeys:input.keys.size,heldPointers:touch.pointers.size,areaArt:Object.freeze(arts.map(art=>art.snapshot())),textureCache:textureCache?.snapshot()??null,propResidency:propResidency.snapshot(),runtime:runtime.snapshot()})});
}
