// Projection-only environment response. The original blended pose is retained
// ungraded, so a crossfade never applies yesterday's light a second time.
const clamp=(v,max)=>Number.isFinite(v)?Math.max(0,Math.min(max,v)):0;
const colour=(c,alpha)=>`rgba(${[0,1,2].map(i=>Math.round(clamp(c?.[i],255))).join(',')},${alpha})`;
export function chikunCharacterLightStyle(rig){
 return {warmAlpha:clamp(rig?.grade?.w*.45,.15),darkAlpha:clamp(rig?.grade?.a*.42,.24),warm:rig?.grade?.W??[255,255,255],dark:rig?.grade?.D??[0,0,0],rimAlpha:clamp(rig?.rimAlpha*.55,.26),rim:rig?.rim??[255,255,255],blur:3};
}
export function createChikunCharacterLighting({makeCanvas=()=>document.createElement('canvas')}={}){
 let canvas=null,cx=null,disposed=false;
 return {
  imageFor(source,rig){
   const light=chikunCharacterLightStyle(rig);if(disposed||light.warmAlpha+light.darkAlpha<.002)return source;
   if(!canvas){canvas=makeCanvas();if(!canvas)return source;canvas.width=canvas.height=192;cx=canvas.getContext('2d');}
   cx.clearRect(0,0,192,192);cx.globalCompositeOperation='source-over';cx.drawImage(source,0,0,192,192);cx.globalCompositeOperation='source-atop';
   if(light.warmAlpha>.001){cx.fillStyle=colour(light.warm,light.warmAlpha);cx.fillRect(0,0,192,192);}
   if(light.darkAlpha>.001){cx.fillStyle=colour(light.dark,light.darkAlpha);cx.fillRect(0,0,192,192);}
   cx.globalCompositeOperation='source-over';return canvas;
  },
  draw(ctx,source,x,y,width,height,rig){
   const light=chikunCharacterLightStyle(rig);ctx.save();
   // Tiny alpha silhouette glow toward the authored upper-left key light.
   // Fixed 3px blur avoids a large full-screen shadow or filter pass.
   if(light.rimAlpha>.001){ctx.shadowColor=colour(light.rim,light.rimAlpha);ctx.shadowBlur=light.blur;ctx.shadowOffsetX=-1.5;ctx.shadowOffsetY=-1.5;}
   ctx.drawImage(this.imageFor(source,rig),x,y,width,height);ctx.restore();
  },
  dispose(){disposed=true;if(canvas)canvas.width=canvas.height=0;canvas=cx=null;},
 };
}
