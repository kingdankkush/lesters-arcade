// Loaded on the first actual defeat. Shared native frames and a fixed sprite
// pool keep the cosmetic count independent of renderer quality and timing.
export async function createSilverDropPresentation({Assets,Container,Graphics,Sprite,Texture,Rectangle}) {
  const atlas=await Assets.load('/assets/generated/hmh-silver-coin/silver-coin.png');
  const frames=Array.from({length:12},(_,i)=>new Texture({source:atlas.source,frame:new Rectangle(i%6*96,Math.floor(i/6)*96,96,96)}));
  const container=new Container(),shadow=new Graphics();container.addChild(shadow);
  const sprites=Array.from({length:64},()=>{const s=new Sprite({texture:frames[0]});s.anchor.set(.5,.8);s.visible=false;container.addChild(s);return s;});
  let destroyed=false;
  const destroy=()=>{
    if(destroyed)return;
    destroyed=true;
    container.destroy({children:true});
    for(const frame of frames)frame.destroy(false);
  };
  return {container,destroy,render({state,tick,camera,view,worldToScreen,queryGround,reduceMotion}) {
    if(destroyed)return 0;
    shadow.clear();let count=0;
    for(const drop of state.drops){
      if(!drop.active)continue;
      const p=worldToScreen({x:drop.x,y:drop.y,z:queryGround(drop.x,drop.y).groundZ},camera,view);
      if(p.x < -40||p.x>view.width+40||p.y < -40||p.y>view.height+40)continue;
      const sprite=sprites[count++];sprite.visible=true;
      sprite.texture=frames[reduceMotion?0:Math.floor((tick-drop.tick)/7)%12];
      const size=(drop.value>1?36:29)*camera.zoom;sprite.width=size;sprite.height=size;
      sprite.position.set(p.x,p.y-(reduceMotion?0:Math.sin((tick-drop.tick)/14)*2*camera.zoom));
      shadow.ellipse(p.x,p.y+2*camera.zoom,9*camera.zoom,4*camera.zoom).fill({color:0x071018,alpha:.28});
    }
    for(let i=count;i<sprites.length;i++)sprites[i].visible=false;
    return count;
  }};
}
