// Native Blender clips are presentation only. Canonical flight never reads this module.
const names = ['ready','takeoff','cruise','accelerate','climb','crest','descend','dive','brake','recover','squeeze','dodge_high','dodge_low','collect','barrel_roll','impact','tumble','fall'];
const loops = new Set(['ready','cruise','climb','descend','dive','squeeze']);
export const CHIKUN_CLIPS = Object.freeze(Object.fromEntries(names.map(name => [name,Object.freeze({name,frames:24,fps:30,loop:loops.has(name)})])));
export const CHIKUN_CHARACTERS = Object.freeze({ 'chikun-original': Object.freeze({id:'chikun-original',name:'Chikun',base:'/assets/generated/chikun-flight-v2/',frameSize:192,columns:4}) });
const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
export function sampleChikunFrame(name,seconds=0) {
  const clip=CHIKUN_CLIPS[name] ?? CHIKUN_CLIPS.cruise;
  const time=Number.isFinite(seconds) ? Math.max(0,seconds)*clip.fps : 0;
  const position=clip.loop ? time%clip.frames : Math.min(clip.frames-1,time);
  const frame=Math.floor(position);
  return {frame,next:clip.loop ? (frame+1)%clip.frames : Math.min(clip.frames-1,frame+1),mix:position-frame};
}
export function selectChikunAnimation(snapshot={}, options={}) {
  const {phase='running',terminalAge=0,flapAge=Infinity,flapVelocity=0,event='',eventAge=Infinity}=options;
  if (phase==='ready' || phase==='waiting') return 'ready';
  if (snapshot.terminal) {
    if(snapshot.terminalReason==='run-complete') return 'collect';
    return terminalAge<.24 ? 'impact' : terminalAge<.95 ? 'tumble' : 'fall';
  }
  if((snapshot.tick??0)<24) return 'takeoff';
  // A deliberate roll keeps its longitudinal heading and completes a full turn.
  if(event==='barrel_roll' && eventAge<.8) return 'barrel_roll';
  // Tap response wins over incidental coin/dodge flourishes.
  if(flapAge<.15 && flapVelocity>3) return 'brake';
  if(flapAge<.28 && flapVelocity>3) return 'recover';
  if(flapAge<.24) return 'accelerate';
  if(eventAge<.42 && CHIKUN_CLIPS[event]) return event;
  const bird=snapshot.chikun??{},v=bird.velocityY??0;
  const opening=snapshot.forks?.find(f=>!f.passed && f.x+(f.width??0)>bird.x-45 && f.x-bird.x<110);
  if(opening) return 'squeeze';
  if(v<-1.2)return 'climb';
  if(v<-.25)return 'crest';
  if(v<.8)return 'cruise';
  if(v<3.8)return 'descend';
  return 'dive';
}
export function createChikunCharacter({characterId='chikun-original'}={}) {
  const character=CHIKUN_CHARACTERS[characterId]??CHIKUN_CHARACTERS['chikun-original'];
  const images=new Map();let closed=false,current='ready',age=0,blend=1,lastTick=-1,lastFlapAge=Infinity,tilt=0,hasComposite=false;
  const poster=new Image();poster.src=character.base+'poster.webp';
  const composite=document.createElement('canvas'),outgoing=document.createElement('canvas');
  composite.width=composite.height=outgoing.width=outgoing.height=character.frameSize;
  const mixCtx=composite.getContext('2d'),oldCtx=outgoing.getContext('2d');
  const queue=[...names];
  const ready=Promise.allSettled(Array.from({length:3},async()=>{
    while(queue.length&&!closed){
      const name=queue.shift(),img=new Image();img.src=character.base+name+'.webp';
      try{await img.decode();if(!closed)images.set(name,img);}catch{/* Owner poster remains available during an atlas failure. */}
    }
  }));
  function retainPose() {
    oldCtx.clearRect(0,0,192,192);oldCtx.drawImage(composite,0,0);blend=0;
  }
  return {
    ready,
    get loaded(){return images.size;},
    draw(ctx,snapshot,dt,options={}) {
      if(closed)return false;
      const reduced=options.reduceMotion===true,delta=clamp(dt,0,.1);
      const requested=CHIKUN_CLIPS[options.previewClip] ? options.previewClip : selectChikunAnimation(snapshot,options);
      const clip=reduced && requested==='barrel_roll' ? 'cruise' : requested;
      const rewound=(snapshot.tick??0)<lastTick,flapAge=options.flapAge??Infinity;
      const retrigger=flapAge<lastFlapAge && ['accelerate','brake'].includes(clip);
      if(rewound || options.seek){current=clip;age=CHIKUN_CLIPS[clip].loop?(snapshot.tick??0)/60:0;blend=1;hasComposite=false;}
      else if(clip!==current || retrigger){if(hasComposite)retainPose();current=clip;age=0;}
      lastTick=snapshot.tick??0;lastFlapAge=flapAge;
      age+=delta;blend=clamp(blend+delta/(reduced?.001:.12),0,1);
      // Retain the last blended pose when interrupted. Additive premultiplied
      // weights preserve opacity across transparent feather and sleeve edges.
      mixCtx.clearRect(0,0,192,192);mixCtx.globalCompositeOperation='lighter';
      const img=images.get(current),incoming=hasComposite?blend:1;
      if(hasComposite && blend<1){mixCtx.globalAlpha=1-blend;mixCtx.drawImage(outgoing,0,0);}
      let seconds=age;
      if(current==='brake')seconds=flapAge/.15*.4;
      if(current==='recover')seconds=(flapAge-.15)/.13*.8;
      if(current==='accelerate')seconds=flapAge/.24*.8;
      if(current==='takeoff')seconds=(snapshot.tick??0)/24*.8;
      if(current==='impact')seconds=(options.terminalAge??0)/.24*.4;
      if(current==='tumble')seconds=((options.terminalAge??.24)-.24)/.71*.8;
      if(options.event===current)seconds=(options.eventAge??0)*(current==='barrel_roll'?1:.8/.42);
      if(Number.isFinite(options.previewTime))seconds=options.previewTime;
      if(img){
        const s=sampleChikunFrame(current,reduced?0:seconds),px=character.frameSize;
        const paint=(frame,alpha)=>{mixCtx.globalAlpha=alpha*incoming;mixCtx.drawImage(img,(frame%4)*px,Math.floor(frame/4)*px,px,px,0,0,px,px);};
        paint(s.frame,1-s.mix);if(s.mix>0)paint(s.next,s.mix);
      }else if(poster.complete&&poster.naturalWidth){mixCtx.globalAlpha=incoming;mixCtx.drawImage(poster,0,0,192,192);}
      else return false;
      mixCtx.globalAlpha=1;mixCtx.globalCompositeOperation='source-over';hasComposite=true;
      const hero=options.phase==='ready'||options.phase==='waiting';
      const size=options.previewClip?440:hero?340:166,x=hero?300:snapshot.chikun.x,y=hero?380:snapshot.chikun.y;
      const target=hero||reduced?0:clamp((snapshot.chikun.velocityY??0)*.018,-.08,.11);
      tilt+=(target-tilt)*(1-Math.exp(-delta*15));
      ctx.save();ctx.translate(x,y);ctx.rotate(tilt);ctx.drawImage(composite,-size/2,-size/2,size,size);ctx.restore();
      return true;
    },
    dispose(){closed=true;images.clear();poster.src='';composite.width=outgoing.width=0;},
  };
}
