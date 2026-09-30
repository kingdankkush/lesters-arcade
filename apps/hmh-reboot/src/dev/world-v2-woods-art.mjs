// Rugpull Woods presentation. All roots, routes and set pieces use the existing
// private map; this module never adds a blocker, surface or objective.
import { Container, Graphics, Sprite, Texture, Matrix } from 'pixi.js';
import { createGreyboxPropResidency } from './greybox-prop-residency.mjs';

const AREA='rugpull-woods', ROOT='/assets/generated/hmh-reboot-tripo-props/';
const IDS=['01','03','04','13','15','17','18','48','49','50','53','55'];
const inPolygon=(x,y,vertices)=>{let inside=false;for(let i=0,j=vertices.length-1;i<vertices.length;j=i++){
  const a=vertices[i],b=vertices[j];if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;}return inside;};
const distance=(x,y,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,d=dx*dx+dy*dy,t=d?Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/d)):0;return Math.hypot(x-a.x-t*dx,y-a.y-t*dy);};

export function createWoodsArtPlan(world){
  const area=world.areas.find(a=>a.id===AREA);if(!area)return null;
  const {x:cx,y:cy}=area.center,pieces=world.pieces.filter(p=>p.visible.areaId===AREA),routes=[],seen=new Set();
  for(const route of area.inspectionRoutes)for(let i=1;i<route.points.length;i++){
    const a=route.points[i-1],b=route.points[i],key=[`${a.x},${a.y}`,`${b.x},${b.y}`].sort().join('|');
    if(!seen.has(key)){seen.add(key);routes.push({a:{...a},b:{...b},width:route.kind==='main'?58:44});}
  }
  const decor=[],banks=pieces.filter(p=>p.kind==='cliff'),solids=world.pieces.filter(p=>p.blocker);
  const blocked=(x,y)=>solids.some(p=>inPolygon(x,y,p.blocker.shape.vertices));
  const put=(source,x,y,height,tint,groundZ=0)=>decor.push({id:`woods-art-${decor.length}`,areaId:AREA,source,x,y,height,tint,groundZ,flip:decor.length%3===0});
  // Mixed ages/species grow on the actual blocked banks, not across open paths.
  for(const bank of banks){const b=bank.visible.bounds;let n=0;
    for(let y=b.minY+65;y<b.maxY;y+=155)for(let x=b.minX+65;x<b.maxX;x+=170){
      const px=x+Math.sin(n*2.7)*39,py=y+Math.cos(n*1.9)*30;n++;
      if(!inPolygon(px,py,bank.blocker.shape.vertices))continue;
      const source=['55','50','03','55','53'][n%5];put(source,px,py,source==='03'?190:250+n%4*35,source==='50'||source==='55'?0xd8d59b:0xe3dcc1,bank.visible.height);
    }
  }
  // Outer woodland roots stay in existing closed land. Road mouths remain open.
  for(let side=0;side<4;side++)for(let n=0;n<23;n++){
    const t=(n+.5)/23,drift=65+Math.sin(n*2.3+side)*28,b=area.bounds;
    const x=side===0?b.minX-drift:side===1?b.maxX+drift:b.minX+t*(b.maxX-b.minX);
    const y=side===2?b.minY-drift:side===3?b.maxY+drift:b.minY+t*(b.maxY-b.minY);
    if(x<0||y<0||x>world.bounds.maxX||y>world.bounds.maxY||!blocked(x,y))continue;
    put(n%3?'55':'50',x,y,270+n%4*28,0xd8d59b,180);
  }
  // Low, walk-through fern/shrub islands frame clear trail and camp sightlines.
  const pockets=[[-1050,-650,260,260],[-350,-500,170,200],[-200,550,180,190],[1150,-700,180,130],
    [1250,650,230,190],[-1150,850,200,160],[-900,-1600,160,130],[450,1200,260,190],
    [150,1650,230,150],[-1550,-400,160,240],[-1400,1700,160,130],[1400,-1500,160,180],
    [-330,-190,135,80],[-190,190,110,90],[180,-190,115,95],[260,190,120,90],
    [-470,200,115,125],[-450,-320,140,90],[135,380,100,125],[500,280,115,140]];
  for(let p=0;p<pockets.length;p++){const [x,y,rx,ry]=pockets[p];for(let n=0;n<13;n++){
    const a=n*2.399963+p*.37,r=Math.sqrt((n+.5)/13),px=cx+x+Math.cos(a)*rx*r,py=cy+y+Math.sin(a)*ry*r;
    if(blocked(px,py)||routes.some(s=>distance(px,py,s.a,s.b)<s.width/2+64))continue;
    put(n%3?'04':'01',px,py,n%3?33+n%4*6:48+n%3*4,n%3?0xd8d2aa:0xc2c596);
  }}
  for(const [x,y]of[[-1180,-1450],[-1570,850],[1350,1400],[-1100,1700]]){const support=solids.find(p=>inPolygon(cx+x,cy+y,p.blocker.shape.vertices));if(support)put('49',cx+x,cy+y,110,0xd6c7a7,support.visible.height);}
  return {areaId:AREA,bounds:{...area.bounds},routes,pockets:pockets.map(([x,y,rx,ry])=>({x:cx+x,y:cy+y,rx,ry})),decor,solidIds:pieces.filter(p=>p.blocker).map(p=>p.id),runtimeAuthority:'projection-only'};
}

export function createWoodsArt({world,signal}){
  const plan=createWoodsArtPlan(world);if(!plan)return null;
  let disposed=false,mounted=false,depth=null,residency=null,groundTexture=null,earthTexture=null;
  const images=[],textures=[],frames=new Map(),painted=[],live=new Map();
  const decode=async url=>{const image=new Image();images.push(image);image.src=url;await image.decode();
    if(disposed)return null;const texture=Texture.from(image,true);textures.push(texture);return texture;};
  const ready=(async()=>{
    try{
      const response=await fetch(ROOT+'hmh-tripo-props.json',{signal,credentials:'same-origin'});
      if(!response.ok)throw Error(`Woods art metadata HTTP ${response.status}`);
      const metadata=await response.json();if(disposed)return;
      if(metadata.runtimeAuthority!=='projection-only'||metadata.pipelineId!=='hmh-tripo-static-props/v1')throw Error('Woods requires the existing native prop catalogue');
      const jobs=IDS.map(async id=>{const frame=metadata.frames.find(f=>f.sourceId===id);
        if(!frame||frame.itemImage!==`tripo-${id}.webp`||frame.category!=='environment')throw Error(`Missing Woods source ${id}`);
        const texture=await decode(ROOT+'items/'+frame.itemImage);if(texture){if(texture.width!==256||texture.height!==256)throw Error('Unexpected Woods item size');frames.set(id,{frame,texture});}});
      jobs.push(decode('/assets/generated/hmh-terrain-tiles/forest-floor.png').then(t=>{groundTexture=t;}));
      jobs.push(decode('/assets/generated/hmh-terrain-tiles/packed-earth.png').then(t=>{earthTexture=t;}));
      const results=await Promise.allSettled(jobs);const error=results.find(r=>r.status==='rejected');if(error)throw error.reason;
      for(const texture of [groundTexture,earthTexture])if(texture)texture.source.style.addressMode='repeat';
    }catch(error){if(!disposed){dispose();throw error;}}
  })();
  const sprite=(id,x,y,height,tint=0xffffff,groundZ=0,flip=false)=>{
    const {frame,texture}=frames.get(id),node=new Sprite({texture}),scale=height/frame.alphaBounds.h;
    node.anchor.set(frame.anchor.x,frame.anchor.y);node.position.set(x,y-groundZ);node.scale.set(flip?-scale:scale,scale);node.tint=tint;node.zIndex=y;return node;
  };
  function paintSurface({target,surface,vertices}){
    if(disposed||!groundTexture||surface.id!==AREA+'-floor')return false;
    const g=new Graphics();g.poly(vertices.flatMap(p=>[p.x,p.y])).fill(0x68704e);
    g.poly(vertices.flatMap(p=>[p.x,p.y])).fill({texture:groundTexture,textureSpace:'global',matrix:new Matrix().scale(.72,.72),color:0xc6c1a0,alpha:.64});
    // A single textured fill through an opaque union mask eliminates per-line
    // alpha stacking, circular shoulders and seams where route segments meet.
    const mask=new Graphics(),paths=new Graphics(),b=plan.bounds;
    for(let k=0;k<plan.routes.length;k++){const {a,b,width}=plan.routes[k],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);
      if(!len)continue;const nx=-dy/len,ny=dx/len,count=Math.max(2,Math.ceil(len/70)),left=[],right=[];
      for(let i=0;i<=count;i++){const t=i/count,bend=Math.sin(Math.PI*t)*Math.sin(t*5+k*.8)*5;
        const radius=width*.5*(.94+.09*Math.sin(t*8+k));const x=a.x+dx*t+nx*bend,y=a.y+dy*t+ny*bend;
        left.push([x+nx*radius,y+ny*radius]);right.push([x-nx*radius,y-ny*radius]);}
      mask.poly([...left,...right.reverse()].flat()).fill(0xffffff);
      mask.circle(a.x,a.y,width*.5).fill(0xffffff);mask.circle(b.x,b.y,width*.5).fill(0xffffff);
    }
    paths.rect(b.minX,b.minY,b.maxX-b.minX,b.maxY-b.minY).fill({texture:earthTexture,textureSpace:'global',matrix:new Matrix().scale(.42,.42),color:0xa69b78});
    paths.mask=mask;target.addChild(g,paths,mask);painted.push(g,paths,mask);return true;
  }

  function createSolid(piece){
    if(!plan.solidIds.includes(piece.id)||disposed||!frames.size)return null;
    const b=piece.visible.bounds,w=b.maxX-b.minX,d=b.maxY-b.minY,h=piece.visible.height,cx=(b.minX+b.maxX)/2;
    const container=new Container();container.woodsDecorated=true;
    const vertices=piece.visible.vertices??[{x:b.minX,y:b.minY},{x:b.maxX,y:b.minY},{x:b.maxX,y:b.maxY},{x:b.minX,y:b.maxY}],roof=vertices.map(p=>({x:p.x,y:p.y-h}));
    const mass=new Graphics();for(let i=0;i<vertices.length;i++){const j=(i+1)%vertices.length;mass.poly([vertices[i],vertices[j],roof[j],roof[i]].flatMap(p=>[p.x,p.y])).fill(piece.kind==='cliff'?0x5c5742:0x5c5344);}
    mass.poly(roof.flatMap(p=>[p.x,p.y])).fill({texture:piece.kind==='cliff'?groundTexture:earthTexture,textureSpace:'global',color:piece.kind==='cliff'?0xb4bd8c:0xb7a382});
    container.addChild(mass);
    const name=piece.id.slice(AREA.length+1),source={'supply-tent':'13','lookout-post':'15','abandoned-store':'48','abandoned-lean-to':'13','supply-stack':'17'}[name];
    if(source){mass.alpha=.4;const node=sprite(source,cx,b.maxY,h+d*.42,0xe8dcc4);const frame=frames.get(source).frame;
      node.scale.x=w/frame.alphaBounds.w;container.addChild(node);}
    if(name==='east-palisade'||name==='south-windbreak'){
      const vertical=d>w,count=Math.ceil((vertical?d:w)/135);for(let i=0;i<count;i++){
        const x=vertical?cx:b.minX+(i+.5)*w/count,y=vertical?b.minY+(i+.5)*d/count:b.maxY;
        const node=sprite('18',x,y,h+25,0xc9b898);node.scale.x=(vertical?w:145)/frames.get('18').frame.alphaBounds.w;container.addChild(node);}
    }
    return container;
  }
  function mount(depthLayer){
    if(disposed||mounted)return;mounted=true;depth=depthLayer;
    const byId=new Map(plan.decor.map(row=>[row.id,row]));
    residency=createGreyboxPropResidency({catalog:plan.decor.map(row=>({id:row.id,areaId:AREA,bounds:{left:row.x-row.height,right:row.x+row.height,top:row.y-row.groundZ-row.height*1.5,bottom:row.y-row.groundZ+row.height*.5}})),
      create:record=>{const row=byId.get(record.id),node=sprite(row.source,row.x,row.y,row.height,row.tint,row.groundZ,row.flip);node.label=record.id;depth.addChild(node);live.set(record.id,{node,row});return node;},
      setVisible:(node,value)=>{node.visible=value;},destroy:node=>{live.delete(node.label);node.destroy();}});
  }
  function update(camera,view,actor){
    if(!residency||disposed)return;residency.update({camera,view});
    for(const {node,row}of live.values())node.alpha=row.height>160&&Math.abs(actor.x-row.x)<row.height*.55&&actor.y<row.y&&actor.y>row.y-row.height-row.groundZ ? .38 : 1;
  }
  function dispose(){
    if(disposed)return;disposed=true;residency?.dispose();
    for(const node of painted){node.removeFromParent();node.destroy();}painted.length=0;
    for(const texture of textures)texture.destroy(true);textures.length=0;frames.clear();
    for(const image of images)image.removeAttribute('src');images.length=0;
  }
  return {ready,plan,paintSurface,createSolid,mount,update,dispose,snapshot:()=>({areaId:AREA,decorations:plan.decor.length,decodedBytes:textures.reduce((n,t)=>n+t.width*t.height*4,0),residency:residency?.snapshot()??null})};
}
