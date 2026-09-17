// Native Blender clips are presentation only. Canonical flight never reads this module.
export const GROUND_CLIPS = Object.freeze(['walk','run','jump','hurdle_jump','high_jump','jump_flight','land','land_roll','land_slide','ground_impact','idle']);
// One-shot hits per obstacle family (2026-09-16 sheet pass); the prone 'impact' stays the generic fallback.
export const CHIKUN_HIT_CLIPS = Object.freeze(['hit_tree','hit_storm','hit_drone','hit_bird','hit_wall']);
export const CHIKUN_HIT_FAMILIES = Object.freeze({
  tree:'hit_tree',willow:'hit_tree',cherry:'hit_tree',maple:'hit_tree',oak:'hit_tree',forest:'hit_tree',canopy:'hit_tree',
  storm:'hit_storm',drone:'hit_drone',plane:'hit_drone',hawk:'hit_bird',eagle:'hit_bird',pelican:'hit_bird',
  pipe:'hit_wall',town:'hit_wall',crate:'hit_wall',hurdle:'hit_wall',
});
const names = [...GROUND_CLIPS,'ready','takeoff','cruise','accelerate','climb','crest','descend','dive','brake','recover','squeeze','dodge_high','dodge_low','collect','barrel_roll','impact','tumble','fall','reverse_roll','corkscrew','victory_twirl','steep_climb','steep_dive',...CHIKUN_HIT_CLIPS];
export const CHIKUN_FLOURISHES = Object.freeze(['barrel_roll','reverse_roll','corkscrew','victory_twirl']);
export const milestoneFlourish = cleared => CHIKUN_FLOURISHES[Math.max(0,Math.floor(cleared/5)-1)%CHIKUN_FLOURISHES.length];
const loops = new Set(['ready','cruise','climb','descend','dive','squeeze','walk','run','idle','steep_climb','steep_dive']);
export const CHIKUN_CLIPS = Object.freeze({
  ...Object.fromEntries(names.map(name => [name,Object.freeze({name,frames:24,fps:30,loop:loops.has(name),sheet:name})])),
  // The landing approach is jump_flight played backwards (prone to upright), so no extra atlas is shipped.
  flare:Object.freeze({name:'flare',frames:24,fps:30,loop:false,sheet:'jump_flight',reverse:true}),
});
export const CHIKUN_CHARACTERS = Object.freeze({ 'chikun-original': Object.freeze({id:'chikun-original',name:'Chikun',base:'/assets/generated/chikun-flight-v3/',frameSize:192,columns:4}) });
// Ground speed multiplier at which the gait changes from a brisk walk to a sprint.
export const CHIKUN_RUN_SPEED = 1.15;
// Vertical speed (px per tick, negative is up) past which the flight pitch reads as steep.
// A flap sets -4.8 and decays by .12 per tick; free fall tops out at 7.
export const CHIKUN_STEEP_CLIMB_VELOCITY = -2.4;
export const CHIKUN_STEEP_DIVE_VELOCITY = 5.6;
// The clip a collision plays before the ragdoll takes over. Grounded hits always stagger.
export function chikunHitClip(snapshot={}) {
  const bird=snapshot.chikun??{},motion=bird.locomotion;
  if(motion && (bird.y??0)>610 && motion!=='flight') return 'ground_impact';
  return CHIKUN_HIT_FAMILIES[snapshot.impact?.kind??snapshot.terminalReason] ?? 'impact';
}
const FLAP_CLIPS = new Set(['accelerate','brake','recover']);
const LAUNCH_CLIPS = new Set(['jump','hurdle_jump','high_jump','jump_flight','takeoff']);
const REACTION_CLIPS = new Set(['collect','dodge_high','dodge_low']);
const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
// Per-transition crossfade lengths. A hit reads on the frame it happens, control
// edges stay crisp, and ground contact or a gait change settles more slowly.
export function chikunBlendSeconds(from='',to='') {
  if(to==='impact'||to==='ground_impact'||to==='tumble'||CHIKUN_HIT_CLIPS.includes(to)) return 0;
  if(FLAP_CLIPS.has(to)||LAUNCH_CLIPS.has(to)) return .06;
  if(REACTION_CLIPS.has(to)||CHIKUN_FLOURISHES.includes(to)) return .09;
  if(to.startsWith('land')) return .18;
  if(to==='flare') return .14;
  if((from==='walk'&&to==='run')||(from==='run'&&to==='walk')) return .24;
  if(to==='fall') return .2;
  if(to==='idle') return .2;
  return .12;
}
export function sampleChikunFrame(name,seconds=0) {
  const clip=CHIKUN_CLIPS[name] ?? CHIKUN_CLIPS.cruise;
  const time=Number.isFinite(seconds) ? Math.max(0,seconds)*clip.fps : 0;
  const position=clip.loop ? time%clip.frames : Math.min(clip.frames-1,time);
  if(clip.reverse){const pos=clip.frames-1-position,frame=Math.ceil(pos);return {frame,next:Math.max(0,frame-1),mix:frame-pos};}
  const frame=Math.floor(position);
  return {frame,next:clip.loop ? (frame+1)%clip.frames : Math.min(clip.frames-1,frame+1),mix:position-frame};
}
// Fixed steps until the feet meet the floor, or Infinity while not descending.
export function chikunTicksToGround(bird={}) {
  const v=bird.velocityY??0;
  return v>1.2 ? Math.max(0,(660-(bird.y??660))/v) : Infinity;
}
function gapBelow(forks,scroll,ticks) {
  const reach=280+40+scroll*Math.min(ticks,30);
  return forks.some(o=>o.family==='gap'&&o.x<reach&&o.x+o.width>240);
}
export function selectChikunAnimation(snapshot={}, options={}) {
  const {phase='running',terminalAge=0,flapAge=Infinity,flapVelocity=0,event='',eventAge=Infinity}=options;
  const bird=snapshot.chikun??{},v=bird.velocityY??0,tick=snapshot.tick??0,motion=bird.locomotion;
  const speed=snapshot.difficulty?.speedMultiplier??1,gait=speed<CHIKUN_RUN_SPEED?'walk':'run';
  // On the ground before the run starts he waits hands-in-pockets; the legacy sky mode hovers.
  if (phase==='ready' || phase==='waiting') return motion ? 'idle' : 'ready';
  if (snapshot.terminal) {
    if(snapshot.terminalReason==='run-complete') return terminalAge<.8?'victory_twirl':'collect';
    // A pit or waterfall swallows Chikun without a hit: tumble straight into the drop.
    if(motion && !snapshot.impact) return terminalAge<.7 ? 'tumble' : 'fall';
    const hit=chikunHitClip(snapshot);
    // Standing hits stagger back on the ground instead of the prone flight impact.
    if(hit==='ground_impact') return hit;
    // A family hit is a full .8 s one-shot into the drop; the generic impact keeps its tumble beat.
    if(hit!=='impact') return terminalAge<.8 ? hit : 'fall';
    return terminalAge<.24 ? 'impact' : terminalAge<.95 ? 'tumble' : 'fall';
  }
  const motionAge=(tick-(bird.motionTick??0))/60,forks=snapshot.forks??[];
  if(motion==='run'){
    if(bird.motionTick>0 && motionAge<.6) return ['land','land_roll','land_slide'][bird.landingVariant??0];
    return gait;
  }
  if(motion==='jump'){
    // The jump reads what it is for: a long jump over a gap, a high jump into a fly-over, a hurdle otherwise.
    // The obstacle is judged where it stood at take-off so the clip never swaps mid-air as the course scrolls.
    const back=2.4*speed*Math.max(0,tick-(bird.motionTick??tick));
    const ahead=forks.find(o=>o.x+back+o.width>250 && o.x+back<580);
    if(ahead?.family==='gap') return 'jump';
    if(ahead) return ahead.height>=120 ? 'high_jump' : 'hurdle_jump';
    return ['jump','hurdle_jump','high_jump'][bird.jumpVariant??0];
  }
  // Running off an edge keeps the legs pumping for a beat before the drop registers.
  if(motion==='fall') return motionAge<.2 ? gait : 'dive';
  if(motion==='flight'){
    // Every flap resets motionTick, so the jump-to-flight roll only plays for the flap that left a jump.
    const launched=options.launchTick===undefined || options.launchTick===bird.motionTick;
    if(launched && motionAge<.36 && bird.y>510) return 'jump_flight';
    // Level out from prone to upright before the feet touch, unless a gap is below.
    const ticks=chikunTicksToGround(bird);
    if(ticks<=16 && !gapBelow(forks,2.4*speed,ticks)) return 'flare';
  }
  if(!motion&&tick<24) return 'takeoff';
  // A deliberate roll keeps its longitudinal heading and completes a full turn.
  if(CHIKUN_FLOURISHES.includes(event) && eventAge<.8) return event;
  // Tap response wins over incidental coin/dodge flourishes.
  if(flapAge<.15 && flapVelocity>3) return 'brake';
  if(flapAge<.28 && flapVelocity>3) return 'recover';
  if(flapAge<.24) return 'accelerate';
  if(eventAge<.42 && CHIKUN_CLIPS[event]) return event;
  const passage=forks.find(f=>!f.passed && f.x+(f.width??0)>bird.x-45 && f.x-bird.x<110);
  if(passage){
    if(!passage.kind || passage.kind==='gate') return 'squeeze';
    if(passage.route==='ground' || (passage.family==='sky' && bird.y>(passage.y??0))) return 'squeeze';
  }
  // Altitude bands: soaring high floats through a longer descend; skimming low commits to the dive sooner.
  const high=(bird.y??360)<220,low=(bird.y??360)>540;
  if(v<CHIKUN_STEEP_CLIMB_VELOCITY)return 'steep_climb';
  if(v<-1.2)return 'climb';
  if(v<-.25)return 'crest';
  if(v<.8)return 'cruise';
  if(v<(high?4.6:low?2.6:3.8))return 'descend';
  // A long free fall past the dive band commits to the streamlined plunge.
  if(v>=CHIKUN_STEEP_DIVE_VELOCITY && (bird.y??360)<600)return 'steep_dive';
  return 'dive';
}
// Damped spring for squash, lean and recoil. Sub-stepped so a long frame cannot overshoot.
function spring(s,delta,k,z) {
  let t=delta;
  while(t>0){const h=Math.min(t,1/120);t-=h;s.v+=(-k*s.x-2*z*Math.sqrt(k)*s.v)*h;s.x+=s.v*h;}
}
export function createChikunCharacter({characterId='chikun-original',onProgress=()=>{}}={}) {
  const character=CHIKUN_CHARACTERS[characterId]??CHIKUN_CHARACTERS['chikun-original'];
  const images=new Map();let closed=false,current='ready',age=0,blend=1,blendSeconds=.12,lastTick=-1,lastFlapAge=Infinity,tilt=0,hasComposite=false,airVelocity=0,lastMotion='',launchTick=-1;
  const squash={x:0,v:0},lean={x:0,v:0},recoil={x:0,v:0};
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
  function retainPose(seconds) {
    oldCtx.clearRect(0,0,192,192);oldCtx.drawImage(composite,0,0);blend=0;blendSeconds=seconds;
  }
  function settle(){squash.x=squash.v=lean.x=lean.v=recoil.x=recoil.v=0;}
  // Secondary motion on a clip edge. Positive squash is wider and shorter; negative is a stretch.
  function impulse(from,to) {
    if(to.startsWith('land')){squash.x=.06+.09*clamp(airVelocity/7,0,1);squash.v=0;}
    else if(LAUNCH_CLIPS.has(to)&&to!=='takeoff'){squash.x=-.09;squash.v=0;}
    else if(to==='impact'||to==='ground_impact'||CHIKUN_HIT_CLIPS.includes(to)){squash.x=to==='hit_wall'?.24:.16;squash.v=0;recoil.x=-14;recoil.v=0;}
    else if(to==='dodge_high'){lean.x=-.16;lean.v=0;}
    else if(to==='dodge_low'){lean.x=.16;lean.v=0;}
    else if(from==='walk'&&to==='run'){squash.x=-.04;}
  }
  return {
    ready,retry:load,
    get renderable(){return images.size>0||poster.naturalWidth>0;},
    get complete(){return finished&&images.size===names.length;},
    get loaded(){return images.size;},
    get clip(){return current;},
    draw(ctx,snapshot,dt,options={}) {
      if(closed)return false;
      const reduced=options.reduceMotion===true,delta=clamp(dt,0,.1);
      const tick=snapshot.tick??0,bird=snapshot.chikun??{},rewound=tick<lastTick,flapAge=options.flapAge??Infinity,motion=bird.locomotion;
      if(rewound || options.seek)launchTick=-1;
      else if(motion==='flight' && lastMotion==='jump')launchTick=bird.motionTick;
      lastMotion=motion;
      const requested=CHIKUN_CLIPS[options.previewClip] ? options.previewClip : selectChikunAnimation(snapshot,{...options,launchTick});
      const clip=reduced && (CHIKUN_FLOURISHES.includes(requested)||requested==='tumble') ? 'cruise' : requested;
      const retrigger=flapAge<lastFlapAge && ['accelerate','brake'].includes(clip);
      if(rewound || options.seek){current=clip;age=CHIKUN_CLIPS[clip].loop?tick/60:0;blend=1;hasComposite=false;settle();}
      else if(clip!==current || retrigger){if(hasComposite)retainPose(chikunBlendSeconds(current,clip));if(!reduced)impulse(current,clip);current=clip;age=0;}
      // Every flap kicks a stretch even when the clip is unchanged, so rapid taps still read.
      if(!reduced && flapAge<lastFlapAge && (motion==='flight'||!motion))squash.x=Math.min(squash.x,-.07);
      if(motion==='jump'||motion==='flight'||motion==='fall')airVelocity=bird.velocityY??0;
      lastTick=tick;lastFlapAge=flapAge;
      age+=delta;blend=clamp(blend+(blendSeconds>0&&!reduced?delta/blendSeconds:1),0,1);
      spring(squash,delta,420,.5);spring(lean,delta,260,.6);spring(recoil,delta,300,.8);
      // Retain the last blended pose when interrupted. Additive premultiplied
      // weights preserve opacity across transparent feather and sleeve edges.
      mixCtx.clearRect(0,0,192,192);mixCtx.globalCompositeOperation='lighter';
      const img=images.get(CHIKUN_CLIPS[current].sheet)??images.get('cruise')??images.values().next().value,incoming=hasComposite?blend:1;
      if(hasComposite && blend<1){mixCtx.globalAlpha=1-blend;mixCtx.drawImage(outgoing,0,0);}
      let seconds=age;
      const motionAge=(tick-(bird.motionTick??0))/60,speed=snapshot.difficulty?.speedMultiplier??1;
      if(GROUND_CLIPS.includes(current)){seconds=['run','walk'].includes(current)?tick/60*speed:current==='idle'?age:motionAge*(current==='jump_flight'?2.22:current.startsWith('land')?1.33:.85);}
      if(CHIKUN_HIT_CLIPS.includes(current))seconds=options.terminalAge??0;
      if(current==='flare')seconds=clamp(1-chikunTicksToGround(bird)/16,0,1)*11/30;
      if(current==='brake')seconds=flapAge/.15*.4;
      if(current==='recover')seconds=(flapAge-.15)/.13*.8;
      if(current==='accelerate')seconds=flapAge/.24*.8;
      if(current==='takeoff')seconds=tick/24*.8;
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
      const size=options.previewClip?440:hero?(options.menuPosition?.size??340):grounded?150:166,x=hero?(options.menuPosition?.x??300):bird.x,y=hero?(options.menuPosition?.y??380):bird.y-(grounded?18:0);
      // Procedural layer: pitch from vertical speed, gait lean and step bob, soaring sway, spring squash and recoil.
      let target=0,bob=0,sway=0;
      if(!hero&&!reduced&&!options.previewClip){
        const v=bird.velocityY??0;
        if(grounded){
          target=clamp(-.035*(speed-1),-.06,0);
          if(current==='walk'||current==='run')bob=-Math.abs(Math.sin(tick*speed*Math.PI/24))*(current==='run'?5:3);
        }
        else if(motion==='fall')target=.34;
        else if(current!=='flare'){
          target=clamp(v*.018,-.08,.11);
          if(bird.y<220&&flapAge>.4)sway=Math.sin(age*4.2)*.02;
          if(bird.y>540&&motion==='flight')target+=.03;
        }
      }
      tilt+=(target-tilt)*(1-Math.exp(-delta*15));
      const sx=1+squash.x,sy=1-squash.x,anchor=grounded?size*.35:0;
      ctx.save();ctx.translate(x+recoil.x,y+bob);ctx.rotate(tilt+sway+lean.x);
      ctx.translate(0,anchor);ctx.scale(sx,sy);ctx.translate(0,-anchor);
      ctx.drawImage(composite,-size/2,-size/2,size,size);ctx.restore();
      return true;
    },
    dispose(){closed=true;images.clear();poster.src='';composite.width=outgoing.width=0;},
  };
}
