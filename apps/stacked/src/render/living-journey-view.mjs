import { createLivingJourney } from './living-journey.mjs';
import { createStackedAtmosphere } from './atmosphere.mjs';
import { LIVING_FIELD_CAPACITY } from './living-field.mjs';
const GLYPHS=Object.freeze(['Ł','0','1','2','3','4','5','6','7','8','9','A','B','F','カ','リ']);
const NAMES=Object.freeze({living:'Living field',aurora:'Aurora',orbit:'Orbit',spectrum:'Spectrum',tunnel:'Energy tunnel',particles:'Particle drift',horizon:'Synthwave horizon',matrix:'Litecoin Matrix'});
const SCENES=new Set(['tunnel','particles','horizon']);
export function createLivingJourneyView({layer,Container,Graphics,Text,mobile=false,createAtmosphere=createStackedAtmosphere}) {
  const journey=createLivingJourney(),root=new Container();
  const slots=[];const pointCapacity=mobile?432:LIVING_FIELD_CAPACITY,glyphCount=mobile?96:192;
  let disposed=false,audioFrame=null,audioAt=-Infinity,activeIndex=0,previousPortal=false;
  const clean=()=>{
    const contexts=new Set();const visit=node=>{if(node instanceof Graphics&&node.context)contexts.add(node.context);for(const child of node.children??[])visit(child);};visit(root);
    let firstError;const attempt=fn=>{try{fn();}catch(error){firstError??=error;}};
    for(const slot of slots)if(slot.base)attempt(()=>slot.base.destroy());
    attempt(()=>root.destroy({children:true}));
    for(const context of contexts)if(!context.destroyed)attempt(()=>context.destroy());
    if(firstError)throw firstError;
  };
  try {
  const makeSlot=()=>{
    const container=new Container(),world=new Container(),backdrop=new Container(),rain=new Container();container.addChild(backdrop,world,rain);
    const projection={x:new Float32Array(pointCapacity),y:new Float32Array(pointCapacity)};
    const project=(shapes,{mode,perOrganism,width,height})=>{
      const groupSize=mode==='living'?perOrganism:Math.max(8,Math.floor(shapes.count/6));
      const focal=Math.min(width,height)*.5;
      for(let index=0;index<shapes.count;index++){
        const group=Math.floor(index/groupSize),depth=60+((group*61-journey.state.distance)%360+360)%360;
        const scale=focal/(depth+focal*.5);
        projection.x[index]=shapes.x[index]*scale;projection.y[index]=shapes.y[index]*scale;
      }
      return projection;
    };
    const slot={container,world,backdrop,rain,projection,base:null,glyphs:[],settings:{video:{},accessibility:{}}};
    root.addChild(container);slots.push(slot);
    slot.base=createAtmosphere({layer:world,sceneLayer:backdrop,Graphics,mobile,project});
    const glyphs=Array.from({length:glyphCount},(_,index)=>{const glyph=new Text({text:GLYPHS[(index*7)%GLYPHS.length],style:{fontFamily:'monospace',fontSize:18,fill:0xffffff}});glyph.anchor?.set?.(.5);rain.addChild(glyph);return glyph;});
    slot.glyphs=glyphs;return slot;
  };
  makeSlot();makeSlot();
  // Own each mask before drawing: drawing can fail after allocating its context.
  const makeMask=draw=>{const node=new Graphics();root.addChild(node);return draw(node);};
  const disc=makeMask(node=>node.circle(0,0,1).fill(0x030c14));
  const aperture=makeMask(node=>node.circle(0,0,1).fill(0xffffff));
  const ring=makeMask(node=>node.circle(0,0,1).stroke({width:.008,color:0xa8edce,alpha:.5}));
  root.addChild(slots[0].container,disc,slots[1].container,aperture,ring);slots[1].container.mask=aperture;
  const points=[];
  const collect=node=>{if(!(node instanceof Text))points.push(node);for(const child of node.children??[])collect(child);};
  for(const slot of slots){collect(slot.world);collect(slot.backdrop);}
  const allGlyphs=slots.flatMap(slot=>slot.glyphs);
  const actualNodeCount=()=>{let count=0;const visit=node=>{count++;for(const child of node.children??[])visit(child);};visit(root);return count;};
  const info={journeyVersion:'living-v1',name:'LIVING JOURNEY',visualizerName:'Living journey',sceneName:'Living field',palette:{color:0x69cba4,accent:0xc8e4df,deep:0x16382d},signals:{time:0,bass:0,high:0,level:.08,beat:0,available:false},particles:0,organisms:0,webs:0,available:false,generation:0,phase:'ambient',mode:'living',scene:'living',sceneTransitions:0,sceneMix:1};
  const drawSlot=(slot,mode,args)=>{
    Object.assign(slot.settings.video,args.settings.video);Object.assign(slot.settings.accessibility,args.settings.accessibility);
    slot.settings.video.visualizer=SCENES.has(mode)?'living':mode==='matrix'?'living':mode;
    slot.settings.video.scene=SCENES.has(mode)?mode:'off';
    slot.world.visible=slot.backdrop.visible=mode!=='matrix';slot.rain.visible=mode==='matrix';
    // Matrix owns this slot's pixels. Keep the hidden particle pool allocated
    // for the next portal, but do not recalculate its geometry every frame.
    const baseInfo=slot.base.draw({...args,settings:slot.settings,geometryVisible:mode!=='matrix'});
    const columns=mobile?12:24,rows=glyphCount/columns;
    const curtain=journey.state.reason==='halving'&&journey.state.mix<1?Math.sin(journey.state.mix*Math.PI)*.22:0;
    for(let index=0;index<glyphCount;index++){
      const glyph=slot.glyphs[index];glyph.visible=mode==='matrix'&&index<(args.settings.video.reducedEffects?glyphCount/2:glyphCount);
      if(!glyph.visible)continue;
      const column=index%columns,row=Math.floor(index/columns),depth=60+((row*45-journey.state.distance)%360+360)%360;
      const perspective=180/(depth+90),side=column<columns/2?-1:1;
      glyph.position.set(((column+.5)/columns-.5)*args.width*(1+curtain)*perspective+side*curtain*args.width*.12,
        (((row+.5)/rows+journey.state.distance*.009+column*.037)%1-.5)*args.height);
      // Staggered silver heads lead soft green tails. The journey distance
      // freezes under reduced motion, including glyph changes and luminance.
      const phase=((journey.state.distance*.035+column*.381)%rows+rows)%rows;
      const age=(row-phase+rows)%rows,head=age<1;
      glyph.scale.set(Math.min(2,perspective));
      glyph.alpha=(.14+.50*Math.exp(-age*.55))*args.settings.video.effectsIntensity;
      glyph.tint=head?0xe4fff0:0x72dba4;
      const code=Math.floor(journey.state.distance*.12+column*.7+row*3);
      const text=GLYPHS[(index*7+code)%GLYPHS.length];if(glyph.text!==text)glyph.text=text;
    }
    return baseInfo;
  };
  layer.addChild(root);
  return{
    state:journey.state,
    resources:{root,get incoming(){return slots[1-activeIndex].container;},aperture,points,glyphs:allGlyphs,pointCapacity:pointCapacity*2,nodeCount:actualNodeCount(),actualNodeCount},
    audio(frame,now){if(disposed)return;audioFrame=frame;audioAt=now;for(const slot of slots)slot.base.audio(frame,now);},
    nextScene(){for(const slot of slots)slot.base.nextScene?.();},
    draw(args){
      if(disposed)throw new Error('living journey disposed');
      // Fixed-world preferences remain usable alongside the automatic journey.
      if(args.settings.video.visualizer && args.settings.video.visualizer!=='journey') {
        root.visible=args.settings.video.effectsIntensity>0;root.alpha=1;
        previousPortal=false;activeIndex=0;
        slots[0].container.visible=true;slots[0].container.mask=null;
        slots[0].world.visible=slots[0].backdrop.visible=true;slots[0].rain.visible=false;
        slots[1].container.visible=false;
        for(const node of[disc,aperture,ring])node.visible=false;
        return slots[0].base.draw(args);
      }
      const available=args.settings.video.audioReactive&&audioFrame?.available&&args.now-audioAt<500;
      const state=journey.update({now:args.now,bpm:available?audioFrame.bpm/10:120,lines:args.lines,combo:args.feedback?.combo,danger:args.feedback?.danger,reducedMotion:args.settings.accessibility.reduceMotion});
      root.visible=args.settings.video.effectsIntensity>0;root.alpha=state.brightness/.18;
      const portal=state.mix<1,from=portal?state.from:state.to;
      // Retain the arriving pool at completion, including its fade/organisms.
      // Reusing the old pool would reset the newly visible world's brightness.
      if(!portal&&previousPortal)activeIndex=1-activeIndex;
      const outgoing=slots[activeIndex],incoming=slots[1-activeIndex];
      outgoing.container.mask=null;
      if(portal&&!previousPortal) {
        incoming.container.mask=aperture;
        root.addChild(outgoing.container,disc,incoming.container,aperture,ring);
      }
      outgoing.container.visible=true;incoming.container.visible=portal;
      const first=drawSlot(outgoing,from,args),second=portal?drawSlot(incoming,state.to,args):first;
      previousPortal=portal;
      const radius=Math.min(args.width,args.height)*state.portalRadius;
      for(const node of[disc,aperture,ring]){node.visible=portal;node.scale.set(radius);node.position.set(0,-args.height*.06);}
      ring.alpha=.3*args.settings.video.effectsIntensity;
      const chosen=state.scene===state.to?second:first;
      Object.assign(info,chosen,{journeyVersion:'living-v1',visualizerName:'Living journey',mode:state.scene,scene:state.scene,sceneName:NAMES[state.scene],phase:state.phase,sceneTransitions:state.transitionCount,sceneMix:state.mix,journeyDistance:state.distance,portalRadius:state.portalRadius,available:!!available});
      if(state.scene==='matrix'){info.particles=glyphCount*(args.settings.video.reducedEffects ? .5 : 1);info.organisms=0;info.webs=0;}
      return info;
    },
    destroy(){if(disposed)return;disposed=true;clean();},
  };
  } catch(error) {
    try{clean();}catch(cleanupError){if(error&&typeof error==='object')error.cleanupError=cleanupError;}
    throw error;
  }
}
