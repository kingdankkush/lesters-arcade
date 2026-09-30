// Explicit local-only navigation preview. There is no score/session/bridge SDK.
import { createGreyboxWorld } from './greybox-world-v1.mjs';
import { createGreyboxNavigator,createGreyboxStepClock } from './greybox-navigation.mjs';
import { PRODUCTION_HERO_ASSETS,PRODUCTION_HERO_RUNTIME_SCALE } from '../production-hero-assets.mjs';
import { createProductionHeroAtlasIndex,resolveProductionHeroPose } from '../production-hero-atlas.mjs';
const asset=PRODUCTION_HERO_ASSETS['lit-commando'];
const contains=(b,p)=>p.x>=b.minX&&p.x<=b.maxX&&p.y>=b.minY&&p.y<=b.maxY;
const vectors={ArrowUp:[0,-1],KeyW:[0,-1],ArrowDown:[0,1],KeyS:[0,1],ArrowLeft:[-1,0],KeyA:[-1,0],ArrowRight:[1,0],KeyD:[1,0]};
export function mountGreyboxPlaytest(root){
  const world=createGreyboxWorld(),navigator=createGreyboxNavigator(world),controller=new AbortController();
  let disposed=false,frameId=null,image=new Image(),atlas=null,width=1,height=1,renderFrames=0,visiblePieces=0,nativeEvents=0,planView=false;
  const keys=new Set(),pointers=new Map(),cleanups=[];
  root.innerHTML='<header><div><strong>HMH · TEN-AREA GREYBOX</strong><span>Local Free navigation · No score</span></div><div class="inspection"><label>Inspection jump <select aria-label="Inspection jump"></select></label><button class="jump" aria-label="Inspect selected area">Jump</button></div></header><div class="stage"><canvas aria-label="Playable ten-area greybox" tabindex="0"></canvas><div class="area-label" aria-live="polite"></div><button class="view-toggle" aria-label="Toggle area plan">Area plan</button><output class="position"></output></div><footer><div class="instructions"><b>Walk the world</b><span>WASD / arrows or hold a direction. Roads connect all ten areas.</span><small>Combat, missions, cover and climbing are staged markers. Inspection jumps are separate from walking.</small></div><div class="directions" aria-label="Touch movement"><button data-direction="up" aria-label="Move up">↑</button><button data-direction="left" aria-label="Move left">←</button><button data-direction="down" aria-label="Move down">↓</button><button data-direction="right" aria-label="Move right">→</button></div></footer>';
  const canvas=root.querySelector('canvas'),context=canvas.getContext('2d'),select=root.querySelector('select'),areaLabel=root.querySelector('.area-label'),position=root.querySelector('.position');
  if(!context)throw new Error('Canvas2D unavailable for local greybox preview');
  for(const area of world.areas){const option=document.createElement('option');option.value=area.id;option.textContent=area.name;select.append(option);}select.value='mweb-meadows';
  const on=(target,type,handler,options)=>{target.addEventListener(type,handler,options);cleanups.push(()=>target.removeEventListener(type,handler,options));};
  const input=()=>{let x=0,y=0;for(const code of keys){x+=vectors[code][0];y+=vectors[code][1];}for(const v of pointers.values()){x+=v[0];y+=v[1];}return{x:Math.max(-1,Math.min(1,x)),y:Math.max(-1,Math.min(1,y))};};
  const clock=createGreyboxStepClock(()=>navigator.step(input()));
  const clearInput=()=>{keys.clear();pointers.clear();for(const button of root.querySelectorAll('[data-direction]'))button.removeAttribute('data-held');clock.pause();};
  on(window,'keydown',event=>{if(!vectors[event.code]||['INPUT','SELECT','TEXTAREA','BUTTON'].includes(event.target?.tagName))return;event.preventDefault();keys.add(event.code);nativeEvents++;});
  on(window,'keyup',event=>{if(!vectors[event.code])return;event.preventDefault();keys.delete(event.code);nativeEvents++;});
  on(window,'blur',clearInput);on(document,'visibilitychange',()=>{if(document.hidden)clearInput();});
  const directionVectors={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
  for(const button of root.querySelectorAll('[data-direction]')){
    on(button,'pointerdown',event=>{event.preventDefault();button.setPointerCapture(event.pointerId);pointers.set(event.pointerId,directionVectors[button.dataset.direction]);button.dataset.held='true';nativeEvents++;});
    const release=event=>{pointers.delete(event.pointerId);button.removeAttribute('data-held');nativeEvents++;};
    on(button,'pointerup',release);on(button,'pointercancel',release);on(button,'lostpointercapture',release);
  }
  on(root.querySelector('.jump'),'click',()=>{clearInput();navigator.inspectArea(select.value);canvas.focus({preventScroll:true});});
  on(root.querySelector('.view-toggle'),'click',event=>{planView=!planView;event.currentTarget.textContent=planView?'Walk view':'Area plan';canvas.focus({preventScroll:true});});
  function resize(){if(disposed)return;const box=canvas.getBoundingClientRect();width=Math.max(1,box.width);height=Math.max(1,box.height);const dpr=window.devicePixelRatio||1;canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);context.setTransform(dpr,0,0,dpr,0,0);}
  on(window,'resize',resize);resize();
  const polygon=(vertices,fill,stroke=null)=>{context.beginPath();vertices.forEach((p,i)=>{if(i===0)context.moveTo(p.x,p.y);else context.lineTo(p.x,p.y);});context.closePath();context.fillStyle=fill;context.fill();if(stroke){context.strokeStyle=stroke;context.lineWidth=2;context.stroke();}};
  const points=area=>area.type==='polygon'?area.vertices:[{x:area.minX,y:area.minY},{x:area.maxX,y:area.minY},{x:area.maxX,y:area.maxY},{x:area.minX,y:area.maxY}];
  function draw(now){
    if(disposed)return;clock.advance(now);const view=navigator.view(),area=world.areas.find(area=>contains(area.bounds,view)),scale=planView?Math.min(width/4600,height/4600):Math.max(.35,Math.min(1,height/740)),centre=planView&&area?area.center:view,camera={x:centre.x-width/(2*scale),y:centre.y-height/(2*scale)};
    context.clearRect(0,0,width,height);context.fillStyle='#283032';context.fillRect(0,0,width,height);
    context.save();context.scale(scale,scale);context.translate(-camera.x,-camera.y);
    for(const surface of world.surfaces)polygon(points(surface.area),surface.priority===15?'#949b97':surface.kind==='ramp'?'#d1d4cb':surface.groundZ>0?'#d9ded5':'#bcc4bb');
    const left=camera.x,right=camera.x+width/scale,top=camera.y,bottom=camera.y+height/scale;
    visiblePieces=0;
    for(const piece of world.pieces){const b=piece.visible.bounds;if(b.maxX<left||b.minX>right||b.maxY<top||b.minY>bottom)continue;visiblePieces++;
      if(piece.blocker){const vertices=piece.visible.vertices??points({type:'rect',...b});const fill=piece.kind==='cover-short'?'#737e79':piece.kind==='cover-tall'?'#4e5c59':'#465254';polygon(vertices,fill,'#e4e9df');
        if(piece.kind.startsWith('cover-')&&!planView){context.fillStyle='#fff8dd';context.font='18px system-ui';context.textAlign='center';context.fillText(piece.kind==='cover-short'?'LOW':'TALL',(b.minX+b.maxX)/2,(b.minY+b.maxY)/2+6);}}
      else if(piece.visible.annotation){context.strokeStyle='#b77831';context.lineWidth=4;context.setLineDash([8,8]);context.strokeRect(b.minX,b.minY,b.maxX-b.minX,b.maxY-b.minY);context.setLineDash([]);}
    }
    for(const arena of world.arenas){const b={minX:arena.center.x-arena.width/2,minY:arena.center.y-arena.depth/2,maxX:arena.center.x+arena.width/2,maxY:arena.center.y+arena.depth/2};if(b.maxX<left||b.minX>right||b.maxY<top||b.minY>bottom)continue;context.strokeStyle='#4d666c';context.lineWidth=3;context.setLineDash([24,18]);context.strokeRect(b.minX,b.minY,arena.width,arena.depth);context.setLineDash([]);if(arena.bossId){context.fillStyle='#495b60';context.font='22px system-ui';context.textAlign='center';context.fillText(`${arena.bossId} · staged court`,arena.center.x,arena.center.y+150);}}
    for(const site of world.sites){if(!['objective','secret','landmark-view','arena-exit','height-option'].includes(site.kind)||site.x<left||site.x>right||site.y<top||site.y>bottom)continue;context.strokeStyle=site.kind==='arena-exit'?'#185d47':'#734c24';context.lineWidth=3;context.strokeRect(site.x-30,site.y-30,60,60);context.fillStyle=context.strokeStyle;context.font='17px system-ui';context.textAlign='center';context.fillText(site.kind==='landmark-view'?world.areas.find(area=>area.id===site.areaId).landmark:site.kind,site.x,site.y+54);}
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    for(const frame of resolveProductionHeroPose(atlas,{simulationTick:reduced?0:view.tick,locomotion:view.locomotion,legDirection:view.legDirection,torsoDirection:view.torsoDirection,action:'aim'})){
      const density=PRODUCTION_HERO_RUNTIME_SCALE*160/(frame.sourceSize?.h??160);
      context.drawImage(image,frame.frame.x,frame.frame.y,frame.frame.w,frame.frame.h,view.x+(frame.trim.x-frame.pivot.x)*density,view.y-view.groundZ*.35+(frame.trim.y-frame.pivot.y)*density,frame.frame.w*density,frame.frame.h*density);
    }
    context.restore();
    // Presentation-only overview; its actor pointer never feeds back to motion.
    const mapWidth=Math.min(200,width*.38),mapHeight=mapWidth*.7,mx=12,my=height-mapHeight-12,ratio=mapWidth/20000;
    context.fillStyle='#152022e8';context.fillRect(mx-4,my-4,mapWidth+8,mapHeight+8);
    context.strokeStyle='#bbc8ba';context.lineWidth=2;for(const road of world.roads){context.beginPath();road.points.forEach((p,i)=>{if(i===0)context.moveTo(mx+p.x*ratio,my+p.y*ratio);else context.lineTo(mx+p.x*ratio,my+p.y*ratio);});context.stroke();}
    for(const area of world.areas){context.fillStyle='#81938a';context.fillRect(mx+area.bounds.minX*ratio,my+area.bounds.minY*ratio,4000*ratio,4000*ratio);context.fillStyle='#e4eee3';context.font='10px system-ui';context.textAlign='center';context.fillText(String(area.tier),mx+area.center.x*ratio,my+area.center.y*ratio+3);}
    context.fillStyle='#ffe271';context.beginPath();context.arc(mx+view.x*ratio,my+view.y*ratio,4,0,Math.PI*2);context.fill();
    areaLabel.textContent=area?`${area.name} · Tier${area.tier}${planView?' · Area plan':''}`:'Connecting road';position.textContent=`${Math.round(view.x)},${Math.round(view.y)} · z${Math.round(view.groundZ)}`;
    renderFrames++;frameId=requestAnimationFrame(draw);
  }
  const snapshot=()=>Object.freeze({mapId:world.mapId,view:navigator.view(),assetsReady:Boolean(atlas&&image?.complete&&image.naturalWidth),disposed,renderFrames,visiblePieces,width,height,nativeEvents,heldKeys:keys.size,heldPointers:pointers.size,planView,previewOnly:true});
  const dispose=()=>{if(disposed)return;disposed=true;clearInput();controller.abort();if(frameId!==null)cancelAnimationFrame(frameId);frameId=null;for(const cleanup of cleanups.splice(0))cleanup();image.src='';atlas=null;root.dataset.preview='disposed';};
  const ready=(async()=>{
    try{
      const response=await fetch(asset.metadataUrl,{signal:controller.signal});if(!response.ok)throw new Error(`Approved human atlas metadata HTTP${response.status}`);
      const metadata=await response.json();if(disposed)return;
      atlas=createProductionHeroAtlasIndex(metadata,asset);image.src=asset.imageUrl;await image.decode();if(disposed)return;
      frameId=requestAnimationFrame(draw);root.dataset.preview='ready';
    }catch(error){if(disposed)return;dispose();root.dataset.preview='failed';throw error;}
  })();
  return Object.freeze({ready,dispose,snapshot});
}
