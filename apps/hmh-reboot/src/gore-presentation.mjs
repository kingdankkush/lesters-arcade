import { feedbackUnit } from './deterministic-hash.mjs';

// A cosmetic, bounded pool. No entity, collision or random-stream references.
export function createGorePresentation() {
  let marks=[];
  const clear=()=>{marks=[];};
  const add=(event,groundZ)=>{
    if(event.type!=='kill' && !(event.type==='impact' && event.surface==='flesh' && !event.shielded))return;
    if(!event.point || !Number.isFinite(groundZ))return;
    const seed=`${event.tick}:${event.point.x}:${event.point.y}`;
    marks.push({x:event.point.x,y:event.point.y,z:groundZ,tick:event.tick,
      radius:(event.type==='kill'?13:5)+feedbackUnit(seed)*4,kill:event.type==='kill',seed});
    if(marks.length>48)marks.shift();
  };
  const frame=(tick,{enabled=false,reduceMotion=false,particleScale=10}={})=>{
    if(!enabled){clear();return {marks:[],fragments:[]};}
    marks=marks.filter(mark=>tick>=mark.tick && tick-mark.tick<480);
    const fragments=[];
    const cap=reduceMotion?0:Math.max(0,Math.min(12,Math.floor(12*particleScale/10)));
    // Recent defeats get first call on the small fragment pool.
    for(const mark of [...marks].reverse()){
      const age=tick-mark.tick;
      if(!mark.kill || age>32)continue;
      for(let i=0;i<3 && fragments.length<cap;i++){
        const unit=feedbackUnit(`${mark.seed}:${i}`), angle=unit*Math.PI*2;
        const t=age/32, reach=(16+unit*32)*t;
        fragments.push({x:mark.x+Math.cos(angle)*reach,y:mark.y+Math.sin(angle)*reach,
          z:mark.z+Math.max(0,18+72*t-90*t*t),radius:2.2+unit*2,alpha:1-t*.65});
      }
    }
    return {marks:marks.map(mark=>({...mark,alpha:.55*Math.min(1,(480-(tick-mark.tick))/120)})),fragments};
  };
  const render=({ground,air,tick,settings,particleScale,camera,view,project})=>{
    ground.clear();air.clear();
    const result=frame(tick,{enabled:settings.gore,reduceMotion:settings.reduceMotion,particleScale});
    const visible=p=>p.x>-80 && p.y>-80 && p.x<view.width+80 && p.y<view.height+80;
    for(const mark of result.marks){
      const p=project(mark,camera,view);if(!visible(p))continue;
      const r=mark.radius*camera.zoom;
      ground.ellipse(p.x,p.y,r,r*.42).fill({color:0x571822,alpha:mark.alpha});
      ground.ellipse(p.x+r*.6,p.y-r*.13,r*.55,r*.24).fill({color:0x7b2130,alpha:mark.alpha*.7});
      ground.circle(p.x-r*.9,p.y+r*.22,Math.max(1,r*.16)).fill({color:0x6b1825,alpha:mark.alpha});
    }
    for(const fragment of result.fragments){
      const p=project(fragment,camera,view);if(!visible(p))continue;
      const r=fragment.radius*camera.zoom;
      air.poly([p.x-r,p.y,p.x+r*.5,p.y-r,p.x+r,p.y+r,p.x-r*.5,p.y+r*.6],true)
        .fill({color:0x983142,alpha:fragment.alpha}).stroke({color:0x3a1520,width:camera.zoom,alpha:fragment.alpha});
    }
    return result;
  };
  return {add,frame,render,clear};
}
