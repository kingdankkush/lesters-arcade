import { WORLD_DESIGN_SITES, WORLD_DESIGN_EXPLORATION_PATHS } from './world-design-encounters.mjs';
import { worldDesignHazardPhase } from './world-design-interactions.mjs';

export function buildWorldDesignCampfires({placements,worldToScreen,queryGround,camera,view,tick,particleBudget=0,reduceMotion=false}) {
  const fires=[],embers=[],budget=Math.min(12,Math.max(0,Math.floor(particleBudget)));
  for(const p of placements) {
    if(p.assetId!=='campfire-ring')continue;
    const q=worldToScreen({x:p.x,y:p.y,z:queryGround(p.x,p.y).groundZ},camera,view);
    if(q.x < -90 || q.x>view.width+90 || q.y < -90 || q.y>view.height+110)continue;
    const phase=p.x*.013+p.y*.017;
    fires.push({...q,radius:52*camera.zoom,alpha:reduceMotion?.10:.10+Math.sin(tick/19+phase)*.015});
    if(!reduceMotion) for(let i=0;i<3&&embers.length<budget;i++) {
      const life=((tick+i*29+Math.floor(phase))%96)/96;
      embers.push({x:q.x+(Math.sin(phase+i*2+life*3)*10+life*8)*camera.zoom,y:q.y-(9+life*58)*camera.zoom,radius:(1.7-life)*camera.zoom,alpha:(1-life)*.8});
    }
    if(fires.length===4)break;
  }
  return {fires,embers};
}

export function prepareWorldDesignEnemyPose(marker, animate, pose) {
  const previous=marker.worldDesignPoseInput;
  // Budgeting freezes in-between frames, never attack warnings or a new pose.
  const changed=!previous || ['state','direction','phase','elite'].some(key=>pose[key]!==previous[key])
    || (Number.isFinite(pose.phaseTick)&&Number.isFinite(previous.phaseTick)&&pose.phaseTick<previous.phaseTick);
  if(animate || !marker.worldDesignLastPose || changed) {
    marker.worldDesignLastPose=marker.applyPose(pose);
    marker.worldDesignPoseInput={...pose};
  }
  marker.worldDesignPoseInput.phaseTick=pose.phaseTick;
  return marker.worldDesignLastPose;
}

// All output is projection-only. No animation changes a collider or a timer.
export function worldDesignPropPresentation({ placement, bounds, focusPoints=[], tick=0, reduceMotion=false }) {
  const organic=/tree|pine|conifer|hedge|vines|bush/.test(placement.assetId);
  const foreground=organic || /house|warehouse|chapel|duplex|tenement|canopy|well|shelter|stump|container|banner/.test(placement.assetId);
  const obscures=foreground && placement.occlusion!=='deck' && focusPoints.some(p=>p.x>bounds.left+8 && p.x<bounds.right-8 && p.y>bounds.top+8 && p.y<bounds.bottom-8);
  const phase=(placement.x*.017+placement.y*.011);
  return {alpha:obscures?.38:1,skewX:organic&&!reduceMotion?Math.sin(tick/87+phase)*.009:0};
}

export function worldDesignFootstep(world, ground, point) {
  if(ground.kind==='bridge') return {cue:'footstep-road',rate:.83,volume:.032};
  if(ground.kind==='ramp'||ground.groundZ>0) return {cue:'footstep-road',rate:1.2,volume:.03};
  const roads=[...world.routes,...WORLD_DESIGN_EXPLORATION_PATHS];
  for(const road of roads) {
    const points=road.points??road.nodeIds.map(id=>world.routeGraph.nodes.find(n=>n.id===id));
    for(let i=1;i<points.length;i++) {
      const a=points[i-1],b=points[i],dx=b.x-a.x,dy=b.y-a.y;
      const t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/(dx*dx+dy*dy||1)));
      if(Math.hypot(point.x-a.x-t*dx,point.y-a.y-t*dy)<road.width/2) return {cue:'footstep-road',rate:1.06,volume:.03};
    }
  }
  return {cue:'footstep-dirt',rate:point.x>=6000&&point.x<8000?.77:.92,volume:.022};
}

export function createWorldDesignLife({ContainerClass,GraphicsClass,TextClass}) {
  const ground=new GraphicsClass(), effects=new GraphicsClass(), overlay=new ContainerClass();
  const prompt=new TextClass({text:'',style:{fontFamily:'system-ui',fontSize:13,fontWeight:'700',fill:0xeef6e9,stroke:{color:0x12211e,width:4},align:'center'}});
  prompt.anchor.set(.5,1); overlay.addChild(effects,prompt);
  ground.label='world-interaction-ground'; overlay.label='world-interaction-prompts';
  let lastPrompt='';
  const render=({state,secretState,actor,camera,view,worldToScreen,queryGround,tick,reduceMotion=false,particleBudget=10,campfirePlacements=[]})=>{
    ground.clear(); effects.clear(); prompt.visible=false;
    if(!state||!actor) return {visibleSites:0,particles:0};
    const project=(x,y,z=0)=>worldToScreen({x,y,z},camera,view);
    let visibleSites=0,particles=0;
    const dot=(x,y,r,color,alpha)=>effects.circle(x,y,r).fill({color,alpha});
    for(const site of WORLD_DESIGN_SITES) {
      const groundZ=queryGround(site.x,site.y).groundZ,p=project(site.x,site.y,groundZ),z=camera.zoom;
      if(p.x < -180*z || p.x > view.width+180*z || p.y < -260*z || p.y > view.height+180*z) continue;
      visibleSites++;
      const done=state.completed.has(site.id),near=Math.hypot(actor.x-site.x,actor.y-site.y)<230;
      // A painted service pad, with a ring and segmented charge indicator.
      ground.roundRect(p.x-31*z,p.y-22*z,62*z,44*z,7*z).fill({color:0x142a2a,alpha:.65}).stroke({color:site.color,width:2*z,alpha:done?.45:.85});
      ground.moveTo(p.x-11*z,p.y).lineTo(p.x-2*z,p.y+9*z).lineTo(p.x+15*z,p.y-10*z).stroke({color:site.color,width:3*z,alpha:done?1:.18});
      if(!done) ground.circle(p.x,p.y,40*z).stroke({color:site.color,width:2*z,alpha:.32});
      if(state.targetId===site.id) {
        const progress=state.progress/site.holdTicks;
        ground.roundRect(p.x-36*z,p.y+31*z,72*z,5*z,2*z).fill({color:0x10221f,alpha:.95});
        ground.roundRect(p.x-36*z,p.y+31*z,Math.max(1,72*z*progress),5*z,2*z).fill({color:site.color});
      }
      if(near) {
        const actions={generator:'Restore power',winch:'Open salvage court',pump:'Start pump · supplies',shrine:'Rest · recover health',vent:'Release steam · keep clear',cache:'Open supplies'};
        const text=done?`${site.name} · complete`:state.activating.has(site.id)?`${site.name} · activating`:`${site.name}\nApproach · ${actions[site.kind].toLowerCase()}`;
        if(lastPrompt!==text) {prompt.text=text;lastPrompt=text;}
        prompt.style.fontSize=view.width<600||view.height<500?11:13;
        const safeTop=view.height<500?125:view.width<600?266:185;
        const safeBottom=view.height<500?140:Math.max(safeTop,view.height-(view.width<600?240:95));
        prompt.position.set(Math.max(view.width<600?135:160,Math.min(view.width-(view.width<600?135:160),p.x)),Math.max(safeTop,Math.min(safeBottom,p.y-64*z)));
        prompt.visible=true;
      }
      if(done) {
        ground.circle(p.x,p.y,65*z).fill({color:site.color,alpha:.06});
        // Powered machinery has a small fixed light; motion is optional.
        dot(p.x,p.y-16*z,3*z,site.color,.8);
        if(!reduceMotion && particles<particleBudget && ['generator','pump'].includes(site.kind)) {
          for(let i=0;i<3&&particles<particleBudget;i++) {
            const phase=((tick+i*43)%150)/150;
            dot(p.x+(Math.sin(phase*3+i)*11+phase*15)*z,p.y-(30+phase*65)*z,(3+phase*9)*z,0xb8cbc2,(1-phase)*.12);particles++;
          }
        }
      }
      if(site.hazard) {
        const phase=worldDesignHazardPhase(state,site,tick),h=site.hazard,hp=project(h.x,h.y,queryGround(h.x,h.y).groundZ);
        const active=phase.phase==='active',warning=phase.phase==='warning';
        if(active||warning) {
          ground.circle(hp.x,hp.y,h.radius*z).fill({color:0xffad54,alpha:active?.18:.07}).stroke({color:0x121c20,width:6*z}).stroke({color:0xffcd86,width:3*z});
          if(warning) ground.circle(hp.x,hp.y,h.radius*z*phase.progress).stroke({color:0xffdca4,width:2*z});
          // No obscuring steam blanket over actors or attack warnings.
          if(active&&!reduceMotion) for(let i=0;i<6&&particles<particleBudget;i++) {
            const phase=((tick+i*19)%90)/90;
            dot(hp.x+Math.sin(i*2.4)*55*z,hp.y-(phase*75)*z,(5+phase*12)*z,0xe6e9df,(1-phase)*.16);particles++;
          }
        }
      }
    }
    const campfires=buildWorldDesignCampfires({placements:campfirePlacements,worldToScreen,queryGround,camera,view,tick,reduceMotion,particleBudget:Math.max(0,particleBudget-particles)});
    for(const f of campfires.fires) {
      ground.circle(f.x,f.y,f.radius).fill({color:0xff9845,alpha:f.alpha*.4});
      ground.circle(f.x,f.y,f.radius*.55).fill({color:0xffbd6e,alpha:f.alpha});
      effects.circle(f.x,f.y-5*camera.zoom,5*camera.zoom).fill({color:0xffcf76,alpha:.6});
    }
    for(const e of campfires.embers)dot(e.x,e.y,e.radius,0xffc277,e.alpha);
    if(secretState?.lastNotice && tick-secretState.lastNotice.tick<480) {
      const text=secretState.lastNotice.text;
      if(lastPrompt!==text){prompt.text=text;lastPrompt=text;}
      prompt.style.fontSize=view.width<600?11:13;
      prompt.style.wordWrap=true;prompt.style.wordWrapWidth=Math.min(430,view.width-48);
      prompt.position.set(view.width/2,view.height<500?145:view.width<600?280:190);prompt.visible=true;
    }
    return {visibleSites,particles:particles+campfires.embers.length,campfireLights:campfires.fires.length,campfireEmbers:campfires.embers.length};
  };
  return {ground,overlay,render};
}
