// Native Blender clips are presentation only. The canonical flight never reads this module.
const names = ['idle_hover','idle_breathe','idle_look','idle_ready','takeoff','flap_power','flap_soft','rise_fast','rise_soft','apex','glide','glide_fast','fall_soft','fall_fast','dive','brake','recover','bank_up','bank_down','gust','near_miss_high','near_miss_low','collect','streak','celebrate','hit_front','hit_ceiling','hit_ground','death_tumble','death_fall'];
const loops = new Set([...names.slice(0,4),'rise_fast','rise_soft','glide','glide_fast','fall_soft','fall_fast','dive']);
export const CHIKUN_CLIPS = Object.freeze(Object.fromEntries(names.map(name => [name,Object.freeze({name,frames:16,fps:24,loop:loops.has(name)})])));
export const CHIKUN_CHARACTERS = Object.freeze({ 'chikun-original': Object.freeze({id:'chikun-original',name:'Chikun',base:'/assets/generated/chikun-flight-v1/',frameSize:192,columns:4}) });
const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
export function sampleChikunFrame(name,seconds=0) {
  const clip=CHIKUN_CLIPS[name] ?? CHIKUN_CLIPS.idle_hover;
  const time=Number.isFinite(seconds) ? Math.max(0,seconds)*clip.fps : 0;
  const position=clip.loop ? time%clip.frames : Math.min(clip.frames-1,time);
  const frame=Math.floor(position);
  return {frame,next:clip.loop ? (frame+1)%clip.frames : Math.min(clip.frames-1,frame+1),mix:position-frame};
}
export function selectChikunAnimation(snapshot={}, options={}) {
  const {phase='running',terminalAge=0,flapAge=Infinity,flapVelocity=0,event='',eventAge=Infinity,idleTime=0}=options;
  if (phase==='ready' || phase==='waiting') return names[Math.floor(idleTime/4)%4];
  if (snapshot.terminal) {
    if(snapshot.terminalReason==='run-complete') return 'celebrate';
    if(terminalAge<.28) return snapshot.terminalReason==='ceiling' ? 'hit_ceiling' : snapshot.terminalReason==='ground' ? 'hit_ground' : 'hit_front';
    return terminalAge<.95 ? 'death_tumble' : 'death_fall';
  }
  if(eventAge<.55 && CHIKUN_CLIPS[event]) return event;
  if((snapshot.tick??0)<30) return 'takeoff';
  if(flapAge<.12 && flapVelocity>3) return 'brake';
  if(flapAge<.28 && flapVelocity>3) return 'recover';
  if(flapAge<.4) return flapVelocity>0 ? 'flap_power' : 'flap_soft';
  const bird=snapshot.chikun??{};const v=bird.velocityY??0;
  const next=snapshot.forks?.find(f=>!f.passed && f.x>bird.x && f.x-bird.x<100);
  if(next && bird.y<next.gapTop+65 && v<0) return 'bank_down';
  if(next && bird.y>next.gapBottom-65 && v>0) return 'bank_up';
  if(snapshot.tick>480 && snapshot.tick%480<22) return 'gust';
  if(v<-2.6)return 'rise_fast';
  if(v<-1.2)return 'rise_soft';
  if(v<-.4)return snapshot.difficulty?.level>3 ? 'glide_fast' : 'glide';
  if(v<.45)return 'apex';
  if(v<2)return 'fall_soft';
  if(v<4)return 'fall_fast';
  return 'dive';
}

export function createChikunCharacter({characterId='chikun-original'}={}) {
  const character=CHIKUN_CHARACTERS[characterId]??CHIKUN_CHARACTERS['chikun-original'];
  const images=new Map();let closed=false;let current='idle_hover',previous=null,age=0,blend=1,lastTick=-1;
  const poster=new Image();poster.src=character.base+'poster.webp';
  const priority=['idle_hover','takeoff','flap_power','flap_soft','rise_fast','rise_soft','apex','glide','fall_soft','fall_fast','dive','hit_front','hit_ground','death_tumble','death_fall',...names];
  const queue=[...new Set(priority)];
  const ready=Promise.allSettled(Array.from({length:3},async()=>{
    while(queue.length&&!closed){
      const name=queue.shift();const img=new Image();img.src=character.base+name+'.webp';
      try{await img.decode();if(!closed)images.set(name,img);}catch{/* Owner poster remains available when an atlas cannot load. */}
    }
  }));
  function paint(ctx,name,seconds,size,alpha=1) {
    const img=images.get(name);if(!img)return false;
    const sample=sampleChikunFrame(name,seconds);const px=character.frameSize;
    const draw=(frame,a)=>{ctx.globalAlpha=a*alpha;ctx.drawImage(img,(frame%4)*px,Math.floor(frame/4)*px,px,px,-size/2,-size/2,size,size);};
    draw(sample.frame,1);
    if(sample.mix>.02 && sample.next!==sample.frame)draw(sample.next,sample.mix);
    return true;
  }
  return {
    ready,
    get loaded(){return images.size;},
    draw(ctx,snapshot,dt,options={}) {
      if(closed)return false;
      const reduced=options.reduceMotion===true;
      const clip=selectChikunAnimation(snapshot,options);
      const rewound=(snapshot.tick??0)<lastTick;
      if(rewound || options.seek){previous=null;current=clip;age=(snapshot.tick??0)/60;blend=1;}
      else if(clip!==current){previous={name:current,age};current=clip;age=0;blend=0;}
      lastTick=snapshot.tick??0;
      age+=Math.max(0,Math.min(.1,dt));blend=clamp(blend+dt/(reduced?.001:.10),0,1);
      const hero=options.phase==='ready'||options.phase==='waiting';
      const size=hero?310:148;
      const x=hero?300:snapshot.chikun.x;const y=hero?380:snapshot.chikun.y;
      ctx.save();ctx.translate(x,y);
      const velocity=snapshot.chikun.velocityY??0;
      // Follow velocity gently. Rig motion does not displace the collision center.
      ctx.rotate(hero?-.08:clamp(velocity*.025,-.10,.15));
      let painted=false;
      if(previous && blend<1)painted=paint(ctx,previous.name,previous.age,size,1-blend);
      painted=paint(ctx,current,reduced?0:age,size,previous?blend:1)||painted;
      if(!painted && poster.complete && poster.naturalWidth){ctx.globalAlpha=1;ctx.drawImage(poster,-size/2,-size/2,size,size);painted=true;}
      ctx.restore();
      return painted;
    },
    dispose(){closed=true;images.clear();poster.src='';},
  };
}
