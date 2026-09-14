// Native Blender clips are presentation only. Canonical flight never reads this module.
export const GROUND_CLIPS = Object.freeze(['walk','run','jump','hurdle_jump','high_jump','jump_flight','land','land_roll','land_slide','ground_impact']);
const names = [...GROUND_CLIPS,'ready','takeoff','cruise','accelerate','climb','crest','descend','dive','brake','recover','squeeze','dodge_high','dodge_low','collect','barrel_roll','impact','tumble','fall','reverse_roll','corkscrew','victory_twirl'];
export const CHIKUN_FLOURISHES = Object.freeze(['barrel_roll','reverse_roll','corkscrew','victory_twirl']);
export const milestoneFlourish = cleared => CHIKUN_FLOURISHES[Math.max(0,Math.floor(cleared/5)-1)%CHIKUN_FLOURISHES.length];
const loops = new Set(['ready','cruise','climb','descend','dive','squeeze','walk','run']);
export const CHIKUN_CLIPS = Object.freeze(Object.fromEntries(names.map(name => [name,Object.freeze({name,frames:24,fps:30,loop:loops.has(name)})])));
export const CHIKUN_CHARACTERS = Object.freeze({ 'chikun-original': Object.freeze({id:'chikun-original',name:'Chikun',base:'/assets/generated/chikun-flight-v3/',frameSize:192,columns:4}) });
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
  if (phase==='ready' || phase==='waiting') return snapshot.chikun?.locomotion ? 'walk' : 'ready';
  if (snapshot.terminal) {
    if(snapshot.terminalReason==='run-complete') return terminalAge<.8?'victory_twirl':'collect';
    return terminalAge<.24 ? 'impact' : terminalAge<.95 ? 'tumble' : 'fall';
  }
  const motion=snapshot.chikun?.locomotion,motionAge=((snapshot.tick??0)-(snapshot.chikun?.motionTick??0))/60;
  if(motion==='run')return (snapshot.chikun.motionTick>0 && motionAge<.6) ? ['land','land_roll','land_slide'][snapshot.chikun.landingVariant??0] : 'run';
  if(motion==='jump')return ['jump','hurdle_jump','high_jump'][snapshot.chikun.jumpVariant??0];
  if(motion==='flight' && motionAge<.36 && snapshot.chikun.y>510)return 'jump_flight';
  if(motion==='fall')return 'dive';
  if(!motion&&(snapshot.tick??0)<24) return 'takeoff';
  // A deliberate roll keeps its longitudinal heading and completes a full turn.
  if(CHIKUN_FLOURISHES.includes(event) && eventAge<.8) return event;
  // Tap response wins over incidental coin/dodge flourishes.
  if(flapAge<.15 && flapVelocity>3) return 'brake';
  if(flapAge<.28 && flapVelocity>3) return 'recover';
  if(flapAge<.24) return 'accelerate';
  if(eventAge<.42 && CHIKUN_CLIPS[event]) return event;
  const bird=snapshot.chikun??{},v=bird.velocityY??0;
  const opening=snapshot.forks?.find(f=>(!f.kind || f.kind==='gate') && !f.passed && f.x+(f.width??0)>bird.x-45 && f.x-bird.x<110);
  if(opening) return 'squeeze';
  if(v<-1.2)return 'climb';
  if(v<-.25)return 'crest';
  if(v<.8)return 'cruise';
  if(v<3.8)return 'descend';
  return 'dive';
}
export function createChikunCharacter({characterId='chikun-original',onProgress=()=>{}}={}) {
  const character=CHIKUN_CHARACTERS[characterId]??CHIKUN_CHARACTERS['chikun-original'];
  const images=new Map();let closed=false,current='ready',age=0,blend=1,lastTick=-1,lastFlapAge=Infinity,tilt=0,hasComposite=false;
  const poster=new Image();
  const composite=document.createElement('canvas'),outgoing=document.createElement('canvas');
  composite.width=composite.height=outgoing.width=outgoing.height=character.frameSize;
  const mixCtx=composite.getContext('2d'),oldCtx=outgoing.getContext('2d');
  let loading=null,finished=false;
  async function decode(img,url) {
    let timer;img.src=url;
    try {await Promise.race([img.decode(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Image timeout')),12000);})]);}
    catch(error){img.src='';throw error;}
    finally{clearTimeout(timer);}
  }
  function load() {
    if(loading)return loading;
    finished=false;
    const queue=names.filter(name=>!images.has(name));
    loading=Promise.allSettled([
      decode(poster,character.base+'poster.webp'),
      ...Array.from({length:3},async()=>{
        while(queue.length&&!closed){
          const name=queue.shift(),img=new Image();
          try{await decode(img,(GROUND_CLIPS.includes(name)?'/assets/generated/chikun-ground-motion-v1/':character.base)+name+'.webp');if(!closed)images.set(name,img);}catch{/* A loaded pose remains available when one clip fails. */}
          if(!closed)onProgress(images.size,names.length);
        }
      }),
    ]).then(()=>{finished=true;loading=null;return !closed&&(images.size>0||poster.naturalWidth>0);});
    return loading;
  }
  const ready=load();
  function retainPose() {
    oldCtx.clearRect(0,0,192,192);oldCtx.drawImage(composite,0,0);blend=0;
  }
  return {
    ready,retry:load,
    get renderable(){return images.size>0||poster.naturalWidth>0;},
    get complete(){return finished&&images.size===names.length;},
    get loaded(){return images.size;},
    draw(ctx,snapshot,dt,options={}) {
      if(closed)return false;
      const reduced=options.reduceMotion===true,delta=clamp(dt,0,.1);
      const requested=CHIKUN_CLIPS[options.previewClip] ? options.previewClip : selectChikunAnimation(snapshot,options);
      const clip=reduced && (CHIKUN_FLOURISHES.includes(requested)||requested==='tumble') ? 'cruise' : requested;
      const rewound=(snapshot.tick??0)<lastTick,flapAge=options.flapAge??Infinity;
      const retrigger=flapAge<lastFlapAge && ['accelerate','brake'].includes(clip);
      if(rewound || options.seek){current=clip;age=CHIKUN_CLIPS[clip].loop?(snapshot.tick??0)/60:0;blend=1;hasComposite=false;}
      else if(clip!==current || retrigger){if(hasComposite)retainPose();current=clip;age=0;}
      lastTick=snapshot.tick??0;lastFlapAge=flapAge;
      age+=delta;blend=clamp(blend+delta/(reduced?.001:.12),0,1);
      // Retain the last blended pose when interrupted. Additive premultiplied
      // weights preserve opacity across transparent feather and sleeve edges.
      mixCtx.clearRect(0,0,192,192);mixCtx.globalCompositeOperation='lighter';
      const img=images.get(current)??images.get('cruise')??images.values().next().value,incoming=hasComposite?blend:1;
      if(hasComposite && blend<1){mixCtx.globalAlpha=1-blend;mixCtx.drawImage(outgoing,0,0);}
      let seconds=age;
      if(GROUND_CLIPS.includes(current)){const motionAge=((snapshot.tick??0)-(snapshot.chikun?.motionTick??0))/60;seconds=['run','walk'].includes(current)?(snapshot.tick??0)/60*(snapshot.difficulty?.speedMultiplier??1):motionAge*(current==='jump_flight'?2.22:current.startsWith('land')?1.33:.85);}
      if(current==='brake')seconds=flapAge/.15*.4;
      if(current==='recover')seconds=(flapAge-.15)/.13*.8;
      if(current==='accelerate')seconds=flapAge/.24*.8;
      if(current==='takeoff')seconds=(snapshot.tick??0)/24*.8;
      if(current==='impact')seconds=(options.terminalAge??0)/.24*.4;
      if(current==='tumble')seconds=((options.terminalAge??.24)-.24)/.71*.8;
      if(options.event===current)seconds=(options.eventAge??0)*(CHIKUN_FLOURISHES.includes(current)?1:.8/.42);
      if(current==='victory_twirl'&&snapshot.terminal)seconds=options.terminalAge??0;
      if(Number.isFinite(options.previewTime))seconds=options.previewTime;
      if(img){
        const s=sampleChikunFrame(current,reduced?0:seconds),px=character.frameSize;
        const paint=(frame,alpha)=>{mixCtx.globalAlpha=alpha*incoming;mixCtx.drawImage(img,(frame%4)*px,Math.floor(frame/4)*px,px,px,0,0,px,px);};
        paint(s.frame,1-s.mix);if(s.mix>0)paint(s.next,s.mix);
      }else if(poster.complete&&poster.naturalWidth){mixCtx.globalAlpha=incoming;mixCtx.drawImage(poster,0,0,192,192);}
      else return false;
      mixCtx.globalAlpha=1;mixCtx.globalCompositeOperation='source-over';hasComposite=true;
      const hero=options.phase==='ready'||options.phase==='waiting';
      const grounded=GROUND_CLIPS.includes(current)&&current!=='jump_flight';
      const size=options.previewClip?440:hero?(options.menuPosition?.size??340):grounded?150:166,x=hero?(options.menuPosition?.x??300):snapshot.chikun.x,y=hero?(options.menuPosition?.y??380):snapshot.chikun.y-(grounded?18:0);
      const target=hero||reduced?0:clamp((snapshot.chikun.velocityY??0)*.018,-.08,.11);
      tilt+=(target-tilt)*(1-Math.exp(-delta*15));
      ctx.save();ctx.translate(x,y);ctx.rotate(tilt);ctx.drawImage(composite,-size/2,-size/2,size,size);ctx.restore();
      return true;
    },
    dispose(){closed=true;images.clear();poster.src='';composite.width=outgoing.width=0;},
  };
}
