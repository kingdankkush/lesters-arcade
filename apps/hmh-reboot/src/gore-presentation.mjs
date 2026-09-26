import { feedbackUnit } from './deterministic-hash.mjs';

// A cosmetic, bounded pool. No entity, collision or random-stream references.
//
// Owner direction 2026-09-16: gunfire on flesh throws physics-driven blood
// droplets along the shot direction that land as splats; kills by certain
// weapons and environmental hazards dismember, throwing limb chunks that
// tumble, land and stay on the ground. Everything is analytic (closed-form
// ballistics from the spawn tick) and hash-seeded, so a frame is a pure
// function of (events, tick) and identical across render partitions.

export const GORE_LIMITS = Object.freeze({ marks: 48, droplets: 24, limbs: 8, fragments: 12, markLifeTicks: 480, limbLifeTicks: 480, dropletsPerImpact: 3, dropletsPerKill: 5 });
const GRAVITY = 0.32;

// Weapons that dismember on a kill regardless of projectile policy.
export const DISMEMBER_WEAPON_IDS = Object.freeze(new Set(['nuke-liquidation', 'hand-grenade']));

// Certain weapons and environmental hazards take bodies apart: anything that
// explodes (splash), the rail lane (pierce), shotgun pellets, hazards, and the
// listed weapons. Pistol and rifle rounds only bleed.
export function shouldDismember({ weaponId = null, policyType = null, hazard = false } = {}) {
  if (hazard === true) return true;
  if (policyType === 'splash' || policyType === 'pierce' || policyType === 'pellet') return true;
  return DISMEMBER_WEAPON_IDS.has(weaponId);
}

function unitDirection(direction) {
  if (!direction || !Number.isFinite(direction.x) || !Number.isFinite(direction.y)) return null;
  const length = Math.hypot(direction.x, direction.y);
  if (length < 1e-6) return null;
  return { x: direction.x / length, y: direction.y / length };
}

// Ticks until a body launched upward at vz from height h lands (h >= 0).
function landingTicks(vz, h) {
  return Math.max(1, Math.ceil((vz + Math.sqrt(vz * vz + 2 * GRAVITY * Math.max(0, h))) / GRAVITY));
}

export function createGorePresentation() {
  let marks=[], droplets=[], limbs=[];
  const clear=()=>{marks=[];droplets=[];limbs=[];};
  const pushMark=(mark)=>{marks.push(mark);if(marks.length>GORE_LIMITS.marks)marks.shift();};

  const spray=(event,groundZ,seed,count,facing,spread)=>{
    const height=Math.max(0,(event.point.z??groundZ)-groundZ);
    for(let i=0;i<count;i++){
      const unit=feedbackUnit(`${seed}:d${i}`), unit2=feedbackUnit(`${seed}:e${i}`);
      const angle=(facing?Math.atan2(facing.y,facing.x):unit2*Math.PI*2)+(unit-.5)*spread;
      const speed=(facing?4.5:2.5)+unit2*4.5, vz=2.5+unit*3.5;
      const landTick=event.tick+landingTicks(vz,height);
      const droplet={x:event.point.x,y:event.point.y,z:event.point.z??groundZ,groundZ,
        vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,vz,tick:event.tick,landTick,radius:1.4+unit*1.4,seed:`${seed}:d${i}`};
      droplets.push(droplet);if(droplets.length>GORE_LIMITS.droplets)droplets.shift();
      // The splat is registered up front at its landing point and tick; the
      // frame filter keeps it invisible until the droplet has landed.
      pushMark({x:droplet.x+droplet.vx*(landTick-event.tick),y:droplet.y+droplet.vy*(landTick-event.tick),z:groundZ,
        tick:landTick,radius:2.4+unit*2.2,kill:false,seed:droplet.seed});
    }
  };

  const add=(event,groundZ)=>{
    if(event.type!=='kill' && !(event.type==='impact' && event.surface==='flesh' && !event.shielded))return;
    if(!event.point || !Number.isFinite(groundZ))return;
    const seed=`${event.tick}:${event.point.x}:${event.point.y}`;
    const facing=unitDirection(event.direction);
    pushMark({x:event.point.x,y:event.point.y,z:groundZ,tick:event.tick,
      radius:(event.type==='kill'?13:5)+feedbackUnit(seed)*4,kill:event.type==='kill',seed});
    if(facing || (event.type==='kill' && event.dismember===true)){
      spray(event,groundZ,seed,event.type==='kill'?GORE_LIMITS.dropletsPerKill:GORE_LIMITS.dropletsPerImpact,facing,facing?.9:Math.PI*2);
    }
    if(event.type==='kill' && event.dismember===true){
      const count=2+Math.floor(feedbackUnit(`${seed}:limbs`)*3);
      const height=Math.max(0,(event.point.z??groundZ)-groundZ);
      for(let i=0;i<count;i++){
        const unit=feedbackUnit(`${seed}:l${i}`), unit2=feedbackUnit(`${seed}:m${i}`);
        const angle=(facing?Math.atan2(facing.y,facing.x)+(unit-.5)*1.6:unit*Math.PI*2);
        const speed=1.5+unit2*2.5, vz=4+unit*3;
        const flight=landingTicks(vz,height);
        limbs.push({x:event.point.x,y:event.point.y,z:event.point.z??groundZ,groundZ,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,vz,
          tick:event.tick,landTick:event.tick+flight,spin:(unit2-.5)*.6,length:7+unit*7,width:3+unit2*2.5,seed:`${seed}:l${i}`});
        if(limbs.length>GORE_LIMITS.limbs)limbs.shift();
        pushMark({x:event.point.x+Math.cos(angle)*speed*flight,y:event.point.y+Math.sin(angle)*speed*flight,z:groundZ,
          tick:event.tick+flight,radius:5+unit*4,kill:false,seed:`${seed}:ls${i}`});
      }
    }
  };
  const airborne=(body,tick)=>{
    const t=tick-body.tick;
    return {x:body.x+body.vx*t,y:body.y+body.vy*t,z:Math.max(body.groundZ,body.z+body.vz*t-GRAVITY*t*t)};
  };
  // Pools are pruned in place: the same survivors in the same order, without
  // three new arrays every frame.
  const prune=(tick)=>{
    let kept=0;
    for(const mark of marks)if(tick-mark.tick<GORE_LIMITS.markLifeTicks)marks[kept++]=mark;
    marks.length=kept;kept=0;
    for(const droplet of droplets)if(tick<droplet.landTick)droplets[kept++]=droplet;
    droplets.length=kept;kept=0;
    for(const limb of limbs)if(tick-limb.landTick<GORE_LIMITS.limbLifeTicks)limbs[kept++]=limb;
    limbs.length=kept;
  };
  const fragmentCap=(reduceMotion,particleScale)=>reduceMotion?0:Math.max(0,Math.min(GORE_LIMITS.fragments,Math.floor(GORE_LIMITS.fragments*particleScale/10)));
  const frame=(tick,{enabled=false,reduceMotion=false,particleScale=10}={})=>{
    if(!enabled){clear();return {marks:[],fragments:[],droplets:[],limbs:[]};}
    prune(tick);
    const fragments=[];
    const cap=fragmentCap(reduceMotion,particleScale);
    // Recent defeats get first call on the small fragment pool.
    for(const mark of [...marks].reverse()){
      const age=tick-mark.tick;
      if(!mark.kill || age<0 || age>32)continue;
      for(let i=0;i<3 && fragments.length<cap;i++){
        const unit=fragmentUnit(mark,i), angle=unit*Math.PI*2;
        const t=age/32, reach=(16+unit*32)*t;
        fragments.push({x:mark.x+Math.cos(angle)*reach,y:mark.y+Math.sin(angle)*reach,
          z:mark.z+Math.max(0,18+72*t-90*t*t),radius:2.2+unit*2,alpha:1-t*.65});
      }
    }
    const visibleMarks=marks.filter(mark=>tick>=mark.tick).map(mark=>({...mark,alpha:.55*Math.min(1,(GORE_LIMITS.markLifeTicks-(tick-mark.tick))/120)}));
    const airDroplets=reduceMotion?[]:droplets.filter(d=>tick>=d.tick).map(d=>({...airborne(d,tick),radius:d.radius,alpha:.95}));
    const limbFrames=limbs.filter(limb=>tick>=limb.tick).map(limb=>{
      const landed=reduceMotion||tick>=limb.landTick;
      const t=landed?limb.landTick-limb.tick:tick-limb.tick;
      const pose=airborne(limb,landed?limb.landTick:tick);
      const restAge=Math.max(0,tick-limb.landTick);
      return {x:pose.x,y:pose.y,z:landed?limb.groundZ:pose.z,rotation:limb.spin*t,length:limb.length,width:limb.width,landed,
        alpha:landed?.92*Math.min(1,(GORE_LIMITS.limbLifeTicks-restAge)/120):1};
    });
    return {marks:visibleMarks,fragments,droplets:airDroplets,limbs:limbFrames};
  };
  // The per-frame draw. It walks the pools directly with the same arithmetic
  // frame() uses, instead of building frame()'s copied mark, droplet, limb and
  // fragment objects, and projects through one reused point when the caller
  // passes projectInto. Returns how many marks and fragments frame() would
  // have listed (telemetry), in one reused object.
  const drawn={marks:0,fragments:0};
  const point={x:0,y:0,z:0},screen={x:0,y:0};
  const render=({ground,air,tick,settings,particleScale,camera,view,project,projectInto=null})=>{
    // Clearing an empty layer still forces a GPU rebuild for nothing.
    wipe(ground);wipe(air);
    drawn.marks=drawn.fragments=0;
    if(!settings.gore){clear();return drawn;}
    prune(tick);
    const reduceMotion=settings.reduceMotion;
    const at=(x,y,z)=>{point.x=x;point.y=y;point.z=z;return projectInto?projectInto(screen,point,camera,view):project(point,camera,view);};
    const visible=p=>p.x>-80 && p.y>-80 && p.x<view.width+80 && p.y<view.height+80;
    for(const mark of marks){
      if(tick<mark.tick)continue;
      drawn.marks++;
      const alpha=.55*Math.min(1,(GORE_LIMITS.markLifeTicks-(tick-mark.tick))/120);
      const p=at(mark.x,mark.y,mark.z);if(!visible(p))continue;
      const r=mark.radius*camera.zoom;
      ground.ellipse(p.x,p.y,r,r*.42).fill({color:0x571822,alpha});
      ground.ellipse(p.x+r*.6,p.y-r*.13,r*.55,r*.24).fill({color:0x7b2130,alpha:alpha*.7});
      ground.circle(p.x-r*.9,p.y+r*.22,Math.max(1,r*.16)).fill({color:0x6b1825,alpha});
    }
    for(const limb of limbs){
      if(tick<limb.tick)continue;
      const landed=reduceMotion||tick>=limb.landTick;
      const t=(landed?limb.landTick:tick)-limb.tick;
      const restAge=Math.max(0,tick-limb.landTick);
      const alpha=landed?.92*Math.min(1,(GORE_LIMITS.limbLifeTicks-restAge)/120):1;
      const layer=landed?ground:air;
      const p=at(limb.x+limb.vx*t,limb.y+limb.vy*t,landed?limb.groundZ:Math.max(limb.groundZ,limb.z+limb.vz*t-GRAVITY*t*t));
      if(!visible(p))continue;
      const rotation=limb.spin*t;
      const l=limb.length*camera.zoom, w=limb.width*camera.zoom, c=Math.cos(rotation), s=Math.sin(rotation);
      layer.poly([turnX(p.x,-l/2,-w/2,c,s),turnY(p.y,-l/2,-w/2,c,s),turnX(p.x,l/2,-w/2,c,s),turnY(p.y,l/2,-w/2,c,s),
        turnX(p.x,l/2,w/2,c,s),turnY(p.y,l/2,w/2,c,s),turnX(p.x,-l/2,w/2,c,s),turnY(p.y,-l/2,w/2,c,s)],true)
        .fill({color:0x6e1c2a,alpha}).stroke({color:0x3a1520,width:camera.zoom,alpha});
      layer.circle(turnX(p.x,l/2,0,c,s),turnY(p.y,l/2,0,c,s),Math.max(1,w*.42)).fill({color:0xe9d9c8,alpha});
    }
    if(!reduceMotion)for(const droplet of droplets){
      if(tick<droplet.tick)continue;
      const t=tick-droplet.tick;
      const p=at(droplet.x+droplet.vx*t,droplet.y+droplet.vy*t,Math.max(droplet.groundZ,droplet.z+droplet.vz*t-GRAVITY*t*t));
      if(!visible(p))continue;
      air.circle(p.x,p.y,Math.max(1,droplet.radius*camera.zoom)).fill({color:0xa3243a,alpha:.95});
    }
    // Recent defeats get first call on the small fragment pool.
    const cap=fragmentCap(reduceMotion,particleScale);
    for(let index=marks.length-1;index>=0 && drawn.fragments<cap;index--){
      const mark=marks[index], age=tick-mark.tick;
      if(!mark.kill || age<0 || age>32)continue;
      for(let i=0;i<3 && drawn.fragments<cap;i++){
        drawn.fragments++;
        const unit=fragmentUnit(mark,i), angle=unit*Math.PI*2;
        const t=age/32, reach=(16+unit*32)*t;
        const p=at(mark.x+Math.cos(angle)*reach,mark.y+Math.sin(angle)*reach,mark.z+Math.max(0,18+72*t-90*t*t));
        if(!visible(p))continue;
        const r=(2.2+unit*2)*camera.zoom, alpha=1-t*.65;
        air.poly([p.x-r,p.y,p.x+r*.5,p.y-r,p.x+r,p.y+r,p.x-r*.5,p.y+r*.6],true)
          .fill({color:0x983142,alpha}).stroke({color:0x3a1520,width:camera.zoom,alpha});
      }
    }
    return drawn;
  };
  return {add,frame,render,clear};
}

// A limb corner rotated about the limb centre (kept as one expression shape
// so the vertices match the original corner() bit for bit).
const turnX=(x,dx,dy,c,s)=>x+dx*c-dy*s;
const turnY=(y,dx,dy,c,s)=>y+dx*s+dy*c;
const wipe=(graphics)=>{if(graphics.context?.instructions?.length!==0)graphics.clear();};
// A kill mark's three fragment seeds are fixed for its life; hash them once.
const FRAGMENT_UNITS=new WeakMap();
function fragmentUnit(mark,index){
  let units=FRAGMENT_UNITS.get(mark);
  if(!units)FRAGMENT_UNITS.set(mark,units=[0,1,2].map(i=>feedbackUnit(`${mark.seed}:${i}`)));
  return units[index];
}
