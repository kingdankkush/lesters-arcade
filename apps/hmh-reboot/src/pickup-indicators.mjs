// Persistent pickup landmarks use only presentation inputs. Hidden or collected
// items never advertise themselves, and reduced motion keeps a steady marker.
export function pickupIndicators({state,tick,camera,view,worldToScreen,queryGround,reduceMotion=false}) {
  const markers=[];
  for (const {placement:p,effect} of state?.entries ?? []) {
    if(state.collectedIds.has(p.id) || tick < p.availableTick) continue;
    const q=worldToScreen({x:p.x,y:p.y,z:queryGround(p.x,p.y).groundZ},camera,view);
    if(q.x < -70 || q.x > view.width+70 || q.y < -100 || q.y > view.height+100) continue;
    const phase=(tick%180)/180*Math.PI*2+p.x*.01+p.y*.013;
    markers.push({id:p.id,x:q.x,y:q.y,color:effect.kind==='weapon-cache'?0x72ddeb:effect.kind==='heal'?0x99e7a5:0xf2c56e,
      radius:24*camera.zoom,beamHeight:56*camera.zoom,pulse:reduceMotion?1:1+Math.sin(phase)*.09,
      sparks:reduceMotion?[]:[0,1].map(i=>{const f=((tick+i*52)%120)/120;return {x:q.x+Math.sin(phase+i*3)*12*camera.zoom,y:q.y-(12+f*42)*camera.zoom,alpha:(1-f)*.55};})});
    if(markers.length===13) break;
  }
  return markers;
}

export function drawPickupIndicators(graphics,markers,zoom) {
  graphics.clear();
  for(const m of markers) {
    const r=m.radius*m.pulse;
    graphics.ellipse(m.x,m.y,r*1.4,r*.55).fill({color:m.color,alpha:.08});
    graphics.ellipse(m.x,m.y,r,r*.4).stroke({color:m.color,width:1.6,alpha:.78});
    graphics.moveTo(m.x,m.y-8*zoom).lineTo(m.x,m.y-m.beamHeight).stroke({color:m.color,width:8*zoom,alpha:.08});
    graphics.moveTo(m.x-5*zoom,m.y-m.beamHeight-4*zoom).lineTo(m.x,m.y-m.beamHeight+1*zoom).lineTo(m.x+5*zoom,m.y-m.beamHeight-4*zoom).stroke({color:m.color,width:1.8,alpha:.9});
    for(const s of m.sparks) graphics.circle(s.x,s.y,1.3*zoom).fill({color:m.color,alpha:s.alpha});
  }
}
