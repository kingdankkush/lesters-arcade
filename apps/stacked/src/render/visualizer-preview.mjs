import { createMusicWorld } from './music-worlds.mjs';
import { createLivingField } from './living-field.mjs';
// A small, explicitly labelled motion preview reuses the actual world geometry.
export function createVisualizerPreview(canvas) {
  const context=canvas?.getContext('2d'), world=createMusicWorld(), living=createLivingField();
  return {
    draw(now, settings, info) {
      if(!context)return;
      const reduced=settings.accessibility.reduceMotion, intensity=settings.video.effectsIntensity??.7;
      const mode=settings.video.visualizer==='journey'?info.mode:settings.video.visualizer;
      const data=mode==='living'?living.update({now,width:800,height:260,lines:0,reducedMotion:reduced,reducedEffects:true,bass:.25}):world.update({mode,time:now*.001,width:800,height:260,reducedMotion:reduced,minimal:true,bass:.25,high:.15});
      context.clearRect(0,0,800,260); context.strokeStyle='#78dbdf'; context.fillStyle='#b8f6ff'; context.lineWidth=mode==='spectrum'?3:1.5;
      context.globalAlpha=intensity*.7;
      context.beginPath();
      for(let i=0;i<data.count;i++) if(data.connected[i]) {context.moveTo(data.x[i-1]+400,data.y[i-1]+130);context.lineTo(data.x[i]+400,data.y[i]+130);}
      context.stroke(); context.globalAlpha=intensity;
      for(let i=0;i<data.count;i++) context.fillRect(data.x[i]+399,data.y[i]+129,2,2);
      context.globalAlpha=1;
      context.fillStyle='#102536';context.fillRect(363,24,74,210);context.strokeStyle='#517b8b';context.strokeRect(363,24,74,210);
    },
  };
}
