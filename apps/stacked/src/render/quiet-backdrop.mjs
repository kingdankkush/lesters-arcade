// Low-cost unsupported-GPU scene. Static soft volumes, never legacy line art.
export function createQuietBackdrop({layer,Container,Graphics}){
 const root=new Container(),base=new Graphics().rect(-1,-1,2,2).fill(0x080a1b);
 const placements=[[-.43,-.10,.53,.36,0x172b53],[.40,.14,.45,.48,0x35245a],[-.12,.35,.54,.22,0x16444c],[.33,-.34,.34,.29,0x253447]];
 const volumes=placements.map(([_x,_y,_sx,_sy,color])=>{
  const graphic=new Graphics();for(let ring=16;ring>0;ring--)graphic.circle(0,0,ring/16).fill({color,alpha:.035});return graphic;
 });
 root.addChild(base,...volumes);layer.addChild(root);let disposed=false;
 const info={name:'Quiet nebula',visualizerName:'Quiet nebula · graphics fallback',sceneName:'Quiet nebula',phase:'still',mode:'quiet',scene:'quiet',sceneTransitions:0,sceneMix:1,particles:0,organisms:0,webs:0,generation:0,available:false,color:0x78dbe9,palette:null,signals:{available:false,time:0,bass:0,high:0,level:0,beat:0}};
 return {resources:{root,nodeCount:6,actualNodeCount:()=>disposed?0:6},audio(){},nextScene(){},
  draw({width,height,settings}){
   if(disposed)throw new Error('quiet backdrop disposed');
   const intensity=Math.max(0,Math.min(1,settings.video.effectsIntensity??.7));root.visible=intensity>0;root.alpha=intensity;
   base.scale.set(width/2,height/2);
   for(let i=0;i<volumes.length;i++){const[x,y,sx,sy]=placements[i];volumes[i].position.set(x*width,y*height);volumes[i].scale.set(sx*width,sy*height);}
   return info;
  },destroy(){if(disposed)return;disposed=true;root.destroy({children:true,context:true});}
 };
}
