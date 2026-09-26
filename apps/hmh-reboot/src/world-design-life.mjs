import { WORLD_DESIGN_SITES, WORLD_DESIGN_EXPLORATION_PATHS } from './world-design-encounters.mjs';
import { worldDesignHazardPhase } from './world-design-interactions.mjs';
import { WORLD_HAZARD_RULES, worldHazardPhase, worldHazardField } from './world-hazards.mjs';
import { buildCoverBreakPresentation } from './cover-break-presentation.mjs';
import { missionPresentation } from './mission-objectives.mjs';
import { selectMissionTrack, missionClaimableStations } from './mission-guidance.mjs';
import { OBJECTIVE_REWARDS, objectiveRewardState } from './objective-rewards.mjs';
import { MISSION_PALETTE } from './mission-palette.mjs';

// Package §3.3 performance caps: rings and beams on screen.
export const MISSION_RING_CAP = 6;
export const MISSION_BEAM_CAP = Object.freeze({ desktop: 4, mobile: 3 });
// Screen bands the pill and chevrons keep clear of (the cockpit above, the
// controls hint or touch controls below), matching the old site prompt.
export const missionSafeBand = (view) => view.height <= 520 ? { top: 118, bottom: 140 }
  : view.width < 600 ? { top: 266, bottom: view.height - 240 } : { top: 185, bottom: view.height - 95 };

export function buildWorldDesignCampfires({placements,worldToScreen,queryGround,camera,view,tick,particleBudget=0,reduceMotion=false,reduceFlash=false}) {
  const fires=[],embers=[],budget=Math.min(12,Math.max(0,Math.floor(particleBudget)));
  for(const p of placements) {
    if(p.assetId!=='campfire-ring')continue;
    const q=worldToScreen({x:p.x,y:p.y,z:queryGround(p.x,p.y).groundZ},camera,view);
    if(q.x < -90 || q.x>view.width+90 || q.y < -90 || q.y>view.height+110)continue;
    const phase=p.x*.013+p.y*.017;
    const flicker=reduceMotion?0:Math.sin(tick/9+phase),lean=reduceMotion?0:Math.sin(tick/23+phase)*3;
    fires.push({...q,radius:52*camera.zoom,alpha:reduceMotion||reduceFlash?.10:.10+Math.sin(tick/19+phase)*.015,
      flameHeight:(23+flicker*4)*camera.zoom,flameWidth:(7-flicker)*camera.zoom,flameLean:lean*camera.zoom});
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

// A polyline arc, so the renderer needs only moveTo and lineTo.
function arcPath(graphics, x, y, radius, from, to, segments = 24) {
  const steps = Math.max(2, Math.ceil(segments * Math.abs(to - from) / (Math.PI * 2)));
  graphics.moveTo(x + Math.cos(from) * radius, y + Math.sin(from) * radius);
  for (let index = 1; index <= steps; index += 1) {
    const angle = from + (to - from) * index / steps;
    graphics.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
  }
  return graphics;
}

// A status lamp pairs a shape with a colour: red X missing, amber ! ready,
// green check done (package §3.3).
function drawLamp(graphics, x, y, z, lamp) {
  const colour = MISSION_PALETTE.lamp[lamp];
  graphics.circle(x, y, 8 * z).fill({ color: MISSION_PALETTE.panel, alpha: 0.85 }).stroke({ color: colour, width: 2 * z });
  if (lamp === 'missing') {
    graphics.moveTo(x - 3.5 * z, y - 3.5 * z).lineTo(x + 3.5 * z, y + 3.5 * z).moveTo(x + 3.5 * z, y - 3.5 * z).lineTo(x - 3.5 * z, y + 3.5 * z).stroke({ color: colour, width: 2 * z });
  } else if (lamp === 'ready') {
    graphics.moveTo(x, y - 4.5 * z).lineTo(x, y + z).stroke({ color: colour, width: 2 * z });
    graphics.circle(x, y + 3.5 * z, 1.2 * z).fill({ color: colour });
  } else {
    graphics.moveTo(x - 3.5 * z, y).lineTo(x - z, y + 3 * z).lineTo(x + 4 * z, y - 3.5 * z).stroke({ color: colour, width: 2 * z });
  }
}

// The tracked node's chevron on the edge of the safe band, pointing at it.
export function missionChevron({ target, view, band }) {
  if (target.x >= 32 && target.x <= view.width - 32 && target.y >= band.top && target.y <= band.bottom) return null;
  const cx = view.width / 2;
  const cy = (band.top + band.bottom) / 2;
  const dx = target.x - cx;
  const dy = target.y - cy;
  const scale = Math.min(dx ? Math.abs((view.width / 2 - 36) / dx) : Infinity, dy ? Math.abs(((band.bottom - band.top) / 2 - 16) / dy) : Infinity);
  return { x: cx + dx * scale, y: cy + dy * scale, angle: Math.atan2(dy, dx) };
}

// Priority-4 stations (package §3.3) from the canonical collectible state:
// a reward whose machine is done, that is available at this tick, and that
// the hero could take now. canCollect is the collection step's own capacity
// check, given the same (effect, placement) pair stepCollectibles gives it.
// Read only; the per-run entry index is cached on the frozen entries list.
const collectibleIndex = new WeakMap();
export function missionGuidanceStations(mission, { collectibles = null, canCollect = null } = {}, tick) {
  if (!collectibles) return [];
  let entries = collectibleIndex.get(collectibles.entries);
  if (!entries) collectibleIndex.set(collectibles.entries, entries = new Map(collectibles.entries.map((entry) => [entry.placement.id, entry])));
  return missionClaimableStations({
    mission,
    // The Liquidator Vault's owner is the boss unlock, not a mission row.
    unlocked: collectibles.unlockedObjectives ?? null,
    rewards: OBJECTIVE_REWARDS,
    rewardState: (id) => objectiveRewardState(collectibles, id, { tick }).state,
    canClaim: (reward) => {
      const entry = entries.get(reward.id);
      return Boolean(entry) && (!canCollect || canCollect(entry.effect, entry.placement));
    },
  });
}

export function createWorldDesignLife({ContainerClass,GraphicsClass,TextClass}) {
  const ground=new GraphicsClass(), effects=new GraphicsClass(), pill=new GraphicsClass(), overlay=new ContainerClass();
  const prompt=new TextClass({text:'',style:{fontFamily:'system-ui',fontSize:13,fontWeight:'700',fill:0xeef6e9,stroke:{color:0x12211e,width:4},align:'center'}});
  const tracker=new TextClass({text:'',style:{fontFamily:'system-ui',fontSize:13,fontWeight:'700',fill:MISSION_PALETTE.mechanism.ring,align:'center'}});
  const needs=new TextClass({text:'',style:{fontFamily:'system-ui',fontSize:12,fontWeight:'700',fill:0xeef6e9,stroke:{color:0x12211e,width:4},align:'center'}});
  const bossNote=new TextClass({text:'',style:{fontFamily:'system-ui',fontSize:12,fontWeight:'800',fill:MISSION_PALETTE.boss.spikes,stroke:{color:MISSION_PALETTE.boss.band,width:4},align:'center',letterSpacing:1}});
  prompt.anchor.set(.5,1); tracker.anchor.set(.5,.5); needs.anchor.set(.5,0); bossNote.anchor.set(.5,0);
  overlay.addChild(effects,pill,prompt,tracker,needs,bossNote);
  ground.label='world-interaction-ground'; overlay.label='world-interaction-prompts';
  let lastPrompt='', lastTracker='', lastNeeds='', lastTrack=null, lastBossNote='';
  const lastWarned=new Map();
  const render=({mission,destructibleState,actor,camera,view,worldToScreen,queryGround,tick,reduceMotion=false,reduceFlash=false,particleBudget=10,campfirePlacements=[],hazards=[],announce=null,guidance=null,bossArena=null,mobile=false})=>{
    ground.clear(); effects.clear(); pill.clear(); prompt.visible=false; tracker.visible=false; needs.visible=false; bossNote.visible=false;
    if(!mission||!actor) return {visibleSites:0,particles:0,hazardTelegraphs:[],beams:0,trackedId:null,trackerText:''};
    const project=(x,y,z=0)=>worldToScreen({x,y,z},camera,view);
    const z=camera.zoom;
    const onScreen=(p,margin=180)=>p.x>=-margin*z&&p.x<=view.width+margin*z&&p.y>=-margin*z&&p.y<=view.height+margin*z;
    // Rings inside a live boss arena are hidden for the whole fight.
    const hidden=(x,y)=>Boolean(bossArena)&&Math.hypot(x-bossArena.x,y-bossArena.y)<=bossArena.radius;
    let visibleSites=0,particles=0,beams=0;
    const dot=(x,y,r,color,alpha)=>effects.circle(x,y,r).fill({color,alpha});
    const ivory=MISSION_PALETTE.mechanism.ring, outline=MISSION_PALETTE.mechanism.outline;
    const presentation=missionPresentation(mission);
    // Machine rings, nearest first, at most six on screen. A secret's pry spot
    // shows nothing until the hero kneels there.
    // Boss zones (S1.5): the Closing Bell shows from the start (a red lamp and
    // "Opens at M:SS" until it is ready, "SETTLED" once the Dark Pool owns the
    // fight) and hides while a fight is live; a retreat ring shows only while
    // it is armed, inside the sealed floor.
    const bossZoneShown=zone=>zone.bossZone.kind==='trigger'?['waiting','settled','ready','held','filling'].includes(zone.state):['ready','held','filling'].includes(zone.state);
    const rings=presentation.zones
      .filter(zone=>zone.state!=='done'&&(zone.kind!=='pry'||zone.state==='filling')&&(zone.bossZone?bossZoneShown(zone):!hidden(zone.x,zone.y)))
      .map(zone=>({zone,p:project(zone.x,zone.y,queryGround(zone.x,zone.y).groundZ),d:Math.hypot(actor.x-zone.x,actor.y-zone.y)}))
      .filter(entry=>onScreen(entry.p))
      .sort((a,b)=>a.d-b.d||(a.zone.zoneId<b.zone.zoneId?-1:1))
      .slice(0,MISSION_RING_CAP);
    let nearestLocked=null,bossNoteAt=null;
    for(const {zone,p,d} of rings) {
      visibleSites++;
      const r=zone.ringRadius*z;
      if(zone.bossZone?.kind==='trigger') {
        // A dark band with bone-white spikes (never red or pink), a lamp, and
        // one line under the ring.
        const {band,spikes}=MISSION_PALETTE.boss;
        const settled=zone.state==='settled';
        ground.circle(p.x,p.y,r).stroke({color:band,width:9*z,alpha:settled?.45:.85}).stroke({color:spikes,width:1.5*z,alpha:settled?.4:.9});
        for(let spike=0;spike<12;spike++){const a=spike*Math.PI/6,tx=-Math.sin(a),ty=Math.cos(a),bx=p.x+Math.cos(a)*r,by=p.y+Math.sin(a)*r;
          ground.moveTo(bx+tx*4*z,by+ty*4*z).lineTo(bx+Math.cos(a)*9*z,by+Math.sin(a)*9*z).lineTo(bx-tx*4*z,by-ty*4*z).stroke({color:spikes,width:1.5*z,alpha:settled?.35:.85});}
        if(zone.progress>0) arcPath(ground,p.x,p.y,r+5*z,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.min(1,zone.progress),32).stroke({color:spikes,width:4*z,alpha:1});
        // A bell glyph.
        effects.moveTo(p.x-6*z,p.y+4*z).lineTo(p.x-4*z,p.y-4*z).lineTo(p.x+4*z,p.y-4*z).lineTo(p.x+6*z,p.y+4*z).lineTo(p.x-6*z,p.y+4*z).stroke({color:spikes,width:2*z});
        effects.circle(p.x,p.y+6*z,1.6*z).fill({color:spikes});
        if(!settled) drawLamp(effects,p.x+r*.72,p.y-r*.72,z,zone.state==='waiting'?'missing':'ready');
        const readyAt=Math.max(0,zone.readyAt??0),minutes=Math.floor(readyAt/3600),seconds=Math.floor(readyAt/60)%60;
        const text=settled?'SETTLED':zone.state==='waiting'?`Opens at ${minutes}:${String(seconds).padStart(2,'0')}`:'';
        if(text&&(!bossNoteAt||d<bossNoteAt.d)) bossNoteAt={text,p,r,d};
        continue;
      }
      if(zone.state==='locked') {
        // Grey ring, padlock, red X; the label names the missing item.
        ground.circle(p.x,p.y,r).stroke({color:outline,width:5*z,alpha:.5}).stroke({color:MISSION_PALETTE.locked.ring,width:2.5*z,alpha:.85});
        effects.roundRect(p.x-7*z,p.y-4*z,14*z,11*z,2*z).fill({color:MISSION_PALETTE.locked.ring,alpha:.95});
        arcPath(effects,p.x,p.y-4*z,5*z,Math.PI,Math.PI*2,8).stroke({color:MISSION_PALETTE.locked.ring,width:2*z});
        drawLamp(effects,p.x+r*.72,p.y-r*.72,z,'missing');
        if(!nearestLocked||d<nearestLocked.d) nearestLocked={zone,p,d};
        continue;
      }
      // Ivory dashed ring over a dark outline, with four hazard chevrons.
      ground.circle(p.x,p.y,r).stroke({color:outline,width:5*z,alpha:.45});
      for(let dash=0;dash<16;dash+=2) arcPath(ground,p.x,p.y,r,dash*Math.PI/8,(dash+1)*Math.PI/8,3).stroke({color:ivory,width:2.5*z,alpha:zone.state==='filling'?1:.8});
      for(let side=0;side<4;side++) {
        const a=side*Math.PI/2+Math.PI/4,cx=p.x+Math.cos(a)*(r+7*z),cy=p.y+Math.sin(a)*(r+7*z),tx=-Math.sin(a),ty=Math.cos(a);
        ground.moveTo(cx+tx*5*z-Math.cos(a)*4*z,cy+ty*5*z-Math.sin(a)*4*z).lineTo(cx,cy).lineTo(cx-tx*5*z-Math.cos(a)*4*z,cy-ty*5*z-Math.sin(a)*4*z).stroke({color:ivory,width:2*z,alpha:.7});
      }
      // The fill, as an arc from twelve o'clock; a hit pause dims it
      // (reduceFlash keeps it steady).
      if(zone.progress>0) arcPath(ground,p.x,p.y,r+3*z,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.min(1,zone.progress),32).stroke({color:ivory,width:4*z,alpha:zone.paused&&!reduceFlash?.55:1});
      // Glyph: a cog for a machine, a pry bar for a seal.
      if(zone.kind==='pry') effects.moveTo(p.x-6*z,p.y+6*z).lineTo(p.x+6*z,p.y-6*z).stroke({color:ivory,width:2.5*z});
      else {
        effects.circle(p.x,p.y,5*z).stroke({color:ivory,width:2*z});
        for(let spoke=0;spoke<6;spoke++){const a=spoke*Math.PI/3;effects.moveTo(p.x+Math.cos(a)*5*z,p.y+Math.sin(a)*5*z).lineTo(p.x+Math.cos(a)*8*z,p.y+Math.sin(a)*8*z).stroke({color:ivory,width:2*z});}
      }
      drawLamp(effects,p.x+r*.72,p.y-r*.72,z,'ready');
    }
    if(bossNoteAt&&bossNoteAt.d<700) {
      if(lastBossNote!==bossNoteAt.text){bossNote.text=bossNoteAt.text;lastBossNote=bossNoteAt.text;}
      bossNote.position.set(bossNoteAt.p.x,bossNoteAt.p.y+bossNoteAt.r+10*z);bossNote.visible=true;
    }
    if(nearestLocked&&nearestLocked.d<400) {
      const text=`Needs ${mission.rowsById.get(nearestLocked.zone.requires)?.name??'an item'}`;
      if(lastNeeds!==text){needs.text=text;lastNeeds=text;}
      needs.position.set(nearestLocked.p.x,nearestLocked.p.y+nearestLocked.zone.ringRadius*z+6*z);needs.visible=true;
    }
    // Items: an ivory ring, a key glyph and a beam (at most 4, 3 on a phone;
    // reduceMotion holds the beam still).
    const beamCap=mobile?MISSION_BEAM_CAP.mobile:MISSION_BEAM_CAP.desktop;
    for(const row of mission.objectives) {
      if(row.mode!=='touch'||mission.completed.has(row.id)||hidden(row.anchor.x,row.anchor.y)) continue;
      const p=project(row.anchor.x,row.anchor.y,queryGround(row.anchor.x,row.anchor.y).groundZ);
      if(!onScreen(p,260)) continue;
      ground.circle(p.x,p.y,row.ringRadius*z).stroke({color:outline,width:5*z,alpha:.45}).stroke({color:ivory,width:2.5*z,alpha:.9});
      effects.circle(p.x-4*z,p.y,4*z).stroke({color:ivory,width:2*z});
      effects.moveTo(p.x,p.y).lineTo(p.x+9*z,p.y).lineTo(p.x+9*z,p.y+4*z).stroke({color:ivory,width:2*z});
      if(beams<beamCap) {
        const sway=reduceMotion?0:Math.sin(tick/40)*.08;
        effects.moveTo(p.x,p.y).lineTo(p.x,p.y-150*z).stroke({color:ivory,width:3*z,alpha:.32+sway});
        beams++;
      }
    }
    for(const site of WORLD_DESIGN_SITES) {
      const groundZ=queryGround(site.x,site.y).groundZ,p=project(site.x,site.y,groundZ);
      if(!onScreen(p,260)) continue;
      if(mission.completed.has(site.id)&&!hidden(site.x,site.y)) {
        drawLamp(effects,p.x,p.y-24*z,z,'done');
        // Powered machinery keeps a small fixed light; motion is optional.
        if(!reduceMotion && particles<particleBudget && ['generator','pump'].includes(site.kind)) {
          for(let i=0;i<3&&particles<particleBudget;i++) {
            const phase=((tick+i*43)%150)/150;
            dot(p.x+(Math.sin(phase*3+i)*11+phase*15)*z,p.y-(30+phase*65)*z,(3+phase*9)*z,0xb8cbc2,(1-phase)*.12);particles++;
          }
        }
      }
      if(site.hazard) {
        const phase=worldDesignHazardPhase(mission,site,tick),h=site.hazard,hp=project(h.x,h.y,queryGround(h.x,h.y).groundZ);
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
    // The tracker pill: one line, hidden while a boss bar shows; compact
    // landscape keeps only the glyph, the distance and the arrow. A chevron
    // on the edge of the safe band points at the tracked node off screen.
    const track=guidance?selectMissionTrack(mission,{player:actor,districtId:guidance.districtId,stations:missionGuidanceStations(mission,guidance,tick),previous:lastTrack,bossBarVisible:guidance.bossBarVisible}):null;
    lastTrack=track;
    if(track) {
      const band=missionSafeBand(view),compact=view.height<=520;
      const text=compact?track.compactText:track.text;
      if(lastTracker!==text){tracker.text=text;lastTracker=text;}
      tracker.style.fontSize=compact||view.width<600?11:13;
      const width=Math.min(view.width-32,(compact?96:Math.max(160,text.length*(view.width<600?6.2:7.2)))+30);
      const y=compact?band.top+11:band.bottom-16;
      pill.roundRect(view.width/2-width/2,y-12,width,24,12).fill({color:MISSION_PALETTE.panel,alpha:.82}).stroke({color:outline,width:2});
      pill.circle(view.width/2-width/2+13,y,4.5).fill({color:track.glyph==='station'?MISSION_PALETTE.lamp.done:ivory});
      tracker.position.set(view.width/2+7,y);tracker.visible=true;
      const chevron=missionChevron({target:project(track.x,track.y,queryGround(track.x,track.y).groundZ),view,band});
      if(chevron) {
        const {x,y:cy,angle:a}=chevron,size=10;
        pill.moveTo(x+Math.cos(a)*size,cy+Math.sin(a)*size).lineTo(x+Math.cos(a+2.5)*size,cy+Math.sin(a+2.5)*size).lineTo(x+Math.cos(a-2.5)*size,cy+Math.sin(a-2.5)*size).lineTo(x+Math.cos(a)*size,cy+Math.sin(a)*size)
          .fill({color:ivory,alpha:.9}).stroke({color:outline,width:2});
      }
    }
    // Authored hazard telegraphs: every stroke is a function of (hazard, tick,
    // actor position); the production-art ring and particle field stay as
    // they are, this only adds the danger phase on top.
    const hazardTelegraphs=[];
    for(const hazard of hazards) {
      const rule=WORLD_HAZARD_RULES[hazard.kind]; if(!rule) continue;
      const a=hazard.anchor,hp=project(a.x,a.y,queryGround(a.x,a.y).groundZ),z=camera.zoom,r=(rule.radius??rule.halfLength)*z,rock=hazard.kind==='rockfall';
      if(hp.x < -260*z || hp.x > view.width+260*z || hp.y < -260*z || hp.y > view.height+260*z) continue;
      // The plate is the damage circle itself, so the warning covers exactly
      // the ground the hit test covers (worldToScreen is a plain top-down projection).
      const plate=(scale=1)=>ground.circle(hp.x,hp.y,r*scale);
      if(rule.periodTicks) {
        const ph=worldHazardPhase(hazard,tick),since=tick%rule.periodTicks,flash=tick>=rule.periodTicks&&since<8?1-since/8:0;
        if(ph.phase==='warning') {
          hazardTelegraphs.push(hazard.id);
          // One caption per cycle, and only when the hero is close enough to be under it.
          if(announce && Math.hypot(actor.x-a.x,actor.y-a.y)*z<r*1.6 && lastWarned.get(hazard.id)!==ph.cycle) {
            lastWarned.set(hazard.id,ph.cycle);
            announce(rock?'Rockfall warning: move clear.':'Liquidation grid charging: move clear.');
          }
          if(rock) {
            // The ring collapses from 1.4r to r while three slab shadows swell.
            plate(1.4-.4*ph.progress).stroke({color:0xffcd86,width:3*z,alpha:.35+.55*ph.progress});
            for(let i=0;i<3;i++) ground.circle(hp.x+Math.cos(i*2.1+.6)*46*z,hp.y+Math.sin(i*2.1+.6)*28*z,(9+19*ph.progress)*z).fill({color:0x0d1214,alpha:.14+.36*ph.progress});
          // The grid's blink accelerates through the charge; reduceFlash holds it steady.
          } else plate().stroke({color:0x7ee0ff,width:2*z,alpha:!reduceFlash&&Math.floor(ph.progress*ph.progress*14)%2?.18:.7});
        }
        if(flash>0) {
          hazardTelegraphs.push(`${hazard.id}:impact`);
          // Under reduceFlash the impact keeps a steady stroke instead of a plate-wide fill.
          if(reduceFlash) plate().stroke({color:rock?0xffcd86:0x7ee0ff,width:3*z,alpha:.7});
          else plate().fill({color:rock?0xf1e6d2:0x7ee0ff,alpha:.5*flash});
          if(!reduceMotion) for(let i=0;i<6&&particles<particleBudget;i++) {
            dot(hp.x+Math.cos(i*1.05)*(80-60*flash)*z,hp.y-(50-40*flash)*z+Math.sin(i*1.05)*12*z,(4+6*flash)*z,rock?0xcbbfae:0x9fe9ff,.5*flash);particles++;
          }
        }
      } else if(rule.speedMultiplier!==undefined) {
        ground.circle(hp.x,hp.y,r).fill({color:0x7bd98a,alpha:.07}).stroke({color:0x9de7a5,width:2*z,alpha:.28});
      } else if(rule.push!==undefined) {
        // Chevrons scroll with the tick along the belt axis, inside the capsule.
        const {x:ax,y:ay}=rule.axis,offset=reduceMotion?0:(tick*2.5)%48;
        for(let s=-rule.halfLength+offset;s<rule.halfLength;s+=48) {
          const cx=hp.x+s*ax*z,cy=hp.y+s*ay*z;
          ground.moveTo(cx-(ax*10+ay*18)*z,cy-(ay*10-ax*18)*z).lineTo(cx+ax*6*z,cy+ay*6*z).lineTo(cx-(ax*10-ay*18)*z,cy-(ay*10+ax*18)*z).stroke({color:0xffd27a,width:2*z,alpha:.32});
        }
      }
    }
    if(hazards.length && worldHazardField(hazards,{x:actor.x,y:actor.y,groundZ:actor.groundZ??0}).speed<1) {
      // The bed is slowing the hero right now: a green wash, not a sprite change.
      const p=project(actor.x,actor.y,actor.groundZ??0);
      effects.circle(p.x,p.y-18*camera.zoom,24*camera.zoom).fill({color:0x7bd98a,alpha:.16});
      hazardTelegraphs.push('hero-slow');
    }
    const cover=buildCoverBreakPresentation({state:destructibleState,tick,project,zoom:camera.zoom,view,reduceMotion,particleBudget:Math.max(0,particleBudget-particles)});
    for(const w of cover.warnings){
      ground.circle(w.x,w.y,w.radius).fill({color:0xff9838,alpha:.07}).stroke({color:0xffc070,width:2*camera.zoom,alpha:.8});
      ground.circle(w.x,w.y,w.radius*(reduceMotion?1:w.progress)).stroke({color:0xffb15e,width:3*camera.zoom,alpha:.6});
      effects.moveTo(w.x,w.y-35*camera.zoom).lineTo(w.x,w.y-23*camera.zoom).stroke({color:0xffdc99,width:3*camera.zoom});
      dot(w.x,w.y-17*camera.zoom,2*camera.zoom,0xffdc99,1);
    }
    for(const s of cover.supplies){
      ground.ellipse(s.x,s.y,s.radius,s.radius*.45).stroke({color:s.color,width:2*camera.zoom,alpha:.8});
      effects.moveTo(s.x-5*camera.zoom,s.y-38*camera.zoom).lineTo(s.x,s.y-32*camera.zoom).lineTo(s.x+5*camera.zoom,s.y-38*camera.zoom).stroke({color:s.color,width:2*camera.zoom,alpha:.9});
    }
    for(const d of cover.dust)ground.ellipse(d.x,d.y,d.radius,d.radius*.55).fill({color:0xab9271,alpha:d.alpha});
    for(const c of cover.chips){
      const dx=Math.cos(c.rotation)*c.size,dy=Math.sin(c.rotation)*c.size;
      effects.poly([c.x-dx,c.y-dy,c.x+dy,c.y-dx,c.x+dx,c.y+dy,c.x-dy,c.y+dx]).fill({color:c.color,alpha:c.alpha});
    }
    particles+=cover.chips.length;
    const campfires=buildWorldDesignCampfires({placements:campfirePlacements,worldToScreen,queryGround,camera,view,tick,reduceMotion,reduceFlash,particleBudget:Math.max(0,particleBudget-particles)});
    for(const f of campfires.fires) {
      ground.circle(f.x,f.y,f.radius).fill({color:0xff9845,alpha:f.alpha*.4});
      ground.circle(f.x,f.y,f.radius*.55).fill({color:0xffbd6e,alpha:f.alpha});
      for(const [scale,color,alpha] of [[1,0xff853c,.78],[.58,0xffdf8b,.92]]) {
        const w=f.flameWidth*scale,h=f.flameHeight*scale,lean=f.flameLean*scale,y=f.y-3*camera.zoom;
        effects.moveTo(f.x-w,y).bezierCurveTo(f.x-w*1.3,y-h*.45,f.x+lean-w*.4,y-h*.7,f.x+lean,y-h)
          .bezierCurveTo(f.x+lean+w*.1,y-h*.5,f.x+w*1.5,y-h*.3,f.x+w,y).closePath().fill({color,alpha});
      }
    }
    for(const e of campfires.embers)dot(e.x,e.y,e.radius,0xffc277,e.alpha);
    // The latest found secret's lore, or a broken cover's note, for 8 seconds.
    let secretNotice=null;
    for(const row of mission.objectives) if(row.objectiveClass==='secret'&&mission.completed.has(row.id)&&(!secretNotice||mission.completed.get(row.id)>secretNotice.tick)) secretNotice={text:row.lore,tick:mission.completed.get(row.id)};
    const notice=(destructibleState?.lastNotice?.tick??-1)>(secretNotice?.tick??-1)?destructibleState.lastNotice:secretNotice;
    if(notice && tick-notice.tick<480) {
      const text=notice.text;
      if(lastPrompt!==text){prompt.text=text;lastPrompt=text;}
      prompt.style.fontSize=view.width<600?11:13;
      prompt.style.wordWrap=true;prompt.style.wordWrapWidth=Math.min(430,view.width-48);
      prompt.position.set(view.width/2,view.height<500?145:view.width<600?280:190);prompt.visible=true;
    }
    return {visibleSites,particles:particles+campfires.embers.length,campfireLights:campfires.fires.length,campfireEmbers:campfires.embers.length,hazardTelegraphs,beams,trackedId:track?.id??null,trackerText:track?lastTracker:''};
  };
  return {ground,overlay,render};
}
