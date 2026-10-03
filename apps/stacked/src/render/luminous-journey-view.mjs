import {Geometry,GlProgram,Mesh,Shader,Texture,UniformGroup} from 'pixi.js';
import {createLuminousJourneyState} from './luminous-journey-state.mjs';

const vertex=`#version 300 es
precision highp float;
in vec2 aPosition;
uniform mat3 uProjectionMatrix;uniform mat3 uWorldTransformMatrix;uniform mat3 uTransformMatrix;
uniform vec4 uColor;uniform vec4 uWorldColorAlpha;out vec2 vUV;out vec4 vColor;
void main(){vUV=aPosition*.5+.5;vColor=uColor*uWorldColorAlpha;vec3 p=uProjectionMatrix*uWorldTransformMatrix*uTransformMatrix*vec3(aPosition,1.);gl_Position=vec4(p.xy,0.,1.);}`;

// One full-screen mesh, no line objects, post passes, texture uploads or raymarch
// targets. Fields are intentionally low-frequency; the bright board owns focus.
const fragment=`#version 300 es
precision highp float;
in vec2 vUV;in vec4 vColor;out vec4 outColor;
uniform vec4 uClock;uniform vec4 uAudio;uniform vec4 uScene;uniform vec4 uPolicy;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
float cloud(vec2 p){float f=0.,a=.5;for(int i=0;i<4;i++){if(float(i)>=uPolicy.y)break;f+=a*noise(p);p=mat2(1.6,-1.2,1.2,1.6)*p+3.1;a*=.5;}return f;}
vec3 palette(float t){return .5+.5*cos(6.28318*(vec3(.08,.28,.51)+t*vec3(.7,.8,.5)));}
vec3 nebula(vec2 p,float time){float n=cloud(p*1.9+vec2(time*.024,0));float m=cloud(p*3.1+vec2(0,time*.018));vec3 col=mix(vec3(.018,.014,.065),vec3(.10,.035,.22),n);col+=vec3(.02,.23,.29)*pow(m*n,2.)*2.;return col;}
float stars(vec2 p,float travel){float result=0.;for(int i=0;i<3;i++){float layer=float(i)+1.;vec2 q=p*(18.+layer*13.);q.y+=travel*layer*.7;vec2 id=floor(q),f=fract(q)-.5;float h=hash(id+layer*19.);float star=pow(max(0.,1.-length(f)*9.),5.);result+=star*step(.955,h)*(.3+layer*.14);}return result;}
vec3 fluid(vec2 p,float time){vec2 q=p*1.5;float n=cloud(q+vec2(time*.06,-time*.025));float m=cloud(q*1.7+vec2(n*3.,time*.04));float vein=pow(max(0.,1.-abs(sin((m+n)*8.+time*.09))),5.);vec3 col=mix(vec3(.025,.02,.08),vec3(.04,.14,.21),m);return col+palette(m*.8+.15)*vein*.32+vec3(.03,.07,.10)*n;}
vec3 aurora(vec2 p,float time){vec3 col=nebula(p,time)*.65;for(int i=0;i<3;i++){float k=float(i);float x=p.x+k*.42;float y=.18*sin(x*2.1+time*.13+k)+.12*sin(x*4.7-time*.08)-.13+k*.17;float d=abs(p.y-y);float ribs=.55+.45*pow(.5+.5*sin(x*29.+cloud(vec2(x*2.,time*.03))*11.),2.);float curtain=exp(-d*(p.y<y?3.5:14.))*ribs*(.4+.6*cloud(vec2(x*3.,p.y*4.+time*.07)));col+=mix(vec3(.04,.42,.34),vec3(.25,.09,.45),k*.35)*curtain*.48;}return col+stars(p,uClock.y)*.4;}
vec3 cosmos(vec2 p,float time,float particles){vec3 col=nebula(p,time)+stars(p,uClock.y)*(1.+particles*.6);vec2 q=(p-vec2(1.05,-.05))/.57;float r2=dot(q,q);
if(particles<.5){float ring=exp(-abs(length(q*vec2(.72,2.8))-1.4)*18.);col+=vec3(.36,.19,.48)*ring*.48;
if(r2<1.){vec3 n=vec3(q,sqrt(max(0.,1.-r2)));float light=max(0.,dot(n,normalize(vec3(-.8,-.5,.7))));float gas=cloud(vec2(q.x*1.7+time*.02,q.y*7.+time*.025));vec3 surface=mix(vec3(.13,.07,.25),vec3(.34,.18,.38),gas);col=surface*(.12+light*.7)+vec3(.04,.17,.25)*pow(1.-n.z,3.)*.5;}
col+=vec3(.04,.14,.22)*exp(-abs(sqrt(r2)-1.)*24.)*.35;}else{col+=vec3(.08,.13,.22)*exp(-dot(p,p)*2.);}
return col;}
vec3 spectrum(vec2 p,float time){vec3 col=nebula(p,time)*.6;for(int i=0;i<5;i++){float k=float(i),y=sin(p.x*(1.4+k*.15)+time*.16+k*.6)*(.28+uAudio.x*.15);float d=abs(p.y-y-k*.055+.11);col+=palette(k*.13+.14)*exp(-d*(18.+k*3.))*.24;}return col;}
vec3 tunnel(vec2 p,float time){float r=max(.045,length(p)),angle=atan(p.y,p.x);float depth=.7/r+uClock.y*.75;float swirl=angle+time*.08+sin(depth*.08)*.4;float bands=pow(max(0.,1.-abs(sin(depth*2.))),8.);float filaments=pow(max(0.,1.-abs(sin(swirl*5.+depth*.25))),12.);float mist=cloud(vec2(swirl*2.,depth*.2));vec3 col=vec3(.014,.012,.035)+palette(depth*.055+swirl*.06)*(bands*.16+filaments*.22)*smoothstep(.04,.22,r);col+=vec3(.10,.035,.18)*mist*.4;return col;}
vec3 horizon(vec2 p,float time){vec3 col=mix(vec3(.07,.025,.14),vec3(.014,.04,.08),smoothstep(-.3,.8,p.y));float mountain=.12+cloud(vec2(p.x*3.,.6))*.25;float below=smoothstep(mountain-.015,mountain+.015,p.y);float mist=cloud(vec2(p.x*2.,p.y*4.-time*.02));col=mix(col,vec3(.025,.025,.09)+vec3(.09,.055,.13)*mist,below);float sun=length(p-vec2(.32,-.13));col+=vec3(.45,.17,.14)*exp(-sun*sun*26.)*.5;return col+stars(p,0.)*(1.-below)*.55;}
vec3 matrixRain(vec2 p,float time){vec2 q=p*vec2(20.,17.);float column=floor(q.x),speed=.5+hash(vec2(column,8.));q.y+=time*speed;vec2 id=floor(q),f=fract(q);float value=hash(id);vec2 bit=floor(f*vec2(3.,5.));float lit=step(.51,hash(bit+value*81.));float shape=step(.12,f.x)*step(f.x,.82)*step(.12,f.y)*step(f.y,.88)*lit;float head=fract(id.y*.13+column*.21+time*.04);float tail=pow(1.-head,4.);vec3 col=vec3(.005,.025,.018)+vec3(.015,.10,.06)*cloud(p*3.);return col+mix(vec3(.08,.42,.22),vec3(.55,.75,.67),step(.93,tail))*shape*tail*.5;}
vec3 scene(float mode,vec2 p,float t){if(mode<.5)return fluid(p,t);if(mode<1.5)return aurora(p,t);if(mode<2.5)return cosmos(p,t,0.);if(mode<3.5)return spectrum(p,t);if(mode<4.5)return tunnel(p,t);if(mode<5.5)return cosmos(p,t,1.);if(mode<6.5)return horizon(p,t);return matrixRain(p,t);}
void main(){vec2 p=(vUV-.5)*vec2(uClock.w,1.)*2.;vec3 col=scene(uScene.x,p,uClock.x);
if(uScene.z<.999&&abs(uScene.x-uScene.y)>.1){float radius=uScene.z*3.;float d=length(p*vec2(.65,1.));float portal=1.-smoothstep(radius-.10,radius+.10,d);col=mix(col,scene(uScene.y,p,uClock.x),portal);col+=vec3(.15,.30,.34)*exp(-abs(d-radius)*42.)*.35;}
float vignette=1.-smoothstep(.4,2.1,length(p*vec2(.55,1.)))*.55;
col*=vignette*(.70+uAudio.z*.25+uAudio.w*.15);
col=1.-exp(-col*4.2);col*=uPolicy.x;
outColor=vec4(col*vColor.rgb*vColor.a,vColor.a);}`;

const NAMES=['Prismatic flow','Aurora curtains','Nebula orbit','Spectral ribbons','Warp tunnel','Stellar drift','Dusk horizon','Digital rain'];
export function createLivingJourneyView({layer,renderer,mobile=false}){
  const model=createLuminousJourneyState();let disposed=false,geometry,program,shader,mesh;
  const vectors={uClock:new Float32Array(4),uAudio:new Float32Array(4),uScene:new Float32Array(4),uPolicy:new Float32Array([.7,0,0,0])};
  const info={name:NAMES[0],journeyVersion:'luminous-v2',visualizerName:'Luminous journey',sceneName:NAMES[0],phase:'ambient',mode:'living',scene:'living',sceneTransitions:0,sceneMix:1,particles:0,organisms:0,webs:0,available:false,signals:{time:0,bass:0,high:0,level:0,beat:0,available:false},palette:{color:0x78dbe9,accent:0xd5adff,deep:0x12152d},color:0x78dbe9,generation:0};
  const destroy=()=>{if(disposed)return;disposed=true;let firstError;
    // GlProgram.from owns a process-cache entry, shared across resize rebuilds.
    // Destroying it creates another named GPU program in the renderer cache on
    // every mobile/desktop transition. The renderer releases its GPU programs
    // with the application; each view releases only its own resources here.
    for(const release of[()=>mesh?.destroy(),()=>shader?.destroy(),()=>geometry?.destroy(true)])try{release();}catch(error){firstError??=error;}
    if(firstError)throw firstError;
  };
  try{
    geometry=new Geometry({attributes:{aPosition:{buffer:new Float32Array([-1,-1,1,-1,1,1,-1,1]),format:'float32x2'}},indexBuffer:new Uint16Array([0,1,2,0,2,3])});
    program=GlProgram.from({vertex,fragment,name:'stacked-luminous-journey-v2'});
    const uniforms=new UniformGroup(Object.fromEntries(Object.entries(vectors).map(([key,value])=>[key,{value,type:'vec4<f32>'}])));
    shader=new Shader({glProgram:program,resources:{visualUniforms:uniforms}});
    // Compile before attaching. Constructor fallback handles unsupported GPUs.
    if(renderer){
      if(!renderer.gl)throw new Error('Luminous journey requires WebGL');
      try{renderer.shader.bind(shader,true);const data=renderer.shader._getProgramData(program);
        if(!renderer.gl.getProgramParameter(data.program,renderer.gl.LINK_STATUS))throw new Error('Luminous journey shader did not link');
      }finally{renderer.shader.resetState();}
    }
    mesh=new Mesh({geometry,shader,texture:Texture.WHITE});layer.addChild(mesh);
    return {resources:{root:mesh,nodeCount:1,actualNodeCount:()=>disposed?0:1},state:model.frame,
      audio:(frame,now)=>{if(!disposed)model.audio(frame,now);},nextScene:()=>model.nextScene(),destroy,
      draw(args){if(disposed)throw new Error('luminous journey disposed');const f=model.update(args);mesh.visible=f.visible;
        mesh.scale.set(args.width/2,args.height/2);
        vectors.uClock.set([f.time,f.distance,f.phase,f.aspect]);vectors.uAudio.set([f.bass,f.high,f.energy,f.beat]);
        vectors.uScene.set([f.from,f.to,f.mix,0]);vectors.uPolicy[0]=args.settings.video.effectsIntensity;vectors.uPolicy[1]=mobile||args.settings.video.reducedEffects?2:4;
        uniforms.update();Object.assign(info,{name:NAMES[f.mix>=.5?f.to:f.from],sceneName:NAMES[f.mix>=.5?f.to:f.from],mode:f.mode,scene:f.mode,sceneTransitions:f.transitions,sceneMix:f.mix,journeyDistance:f.distance,portalRadius:f.mix<1?f.mix*3:0,phase:f.mix<1?'portal':'ambient',available:f.available});
        Object.assign(info.signals,{time:f.time,bass:f.bass,high:f.high,level:f.energy,beat:f.beat,available:f.available});return info;
      }
    };
  }catch(error){try{destroy();}catch(cleanupError){error.cleanupError=cleanupError;}throw error;}
}
