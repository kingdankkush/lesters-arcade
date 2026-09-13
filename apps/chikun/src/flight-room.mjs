import { CHIKUN_CLIPS, sampleChikunFrame } from './character.mjs';
import { createChikunWorld } from './world.mjs';
import { createChikunAudio } from './audio.mjs';
const canvas=document.querySelector('#stage'),ctx=canvas.getContext('2d',{alpha:false}),world=createChikunWorld(),audio=createChikunAudio();
const names=Object.keys(CHIKUN_CLIPS),images=new Map(),buttons=new Map();
let clip='idle_hover',age=0,last=0,clock=0,disposed=false,paused=matchMedia('(prefers-reduced-motion: reduce)').matches;
const motion=document.querySelector('#motion'),time=document.querySelector('#time');
function sync(){motion.textContent=paused?'Play animation':'Pause animation';motion.setAttribute('aria-pressed',String(paused));}
for(const [i,name] of names.entries()){
  const b=document.createElement('button');b.innerHTML=`<span>${String(i+1).padStart(2,'0')}</span>${name.replaceAll('_',' ')}`;b.setAttribute('aria-pressed',String(name===clip));b.addEventListener('click',()=>{clip=name;age=0;document.querySelector('#clipLabel').textContent=name.replaceAll('_',' ');document.querySelector('.caption span:last-child').textContent=`${String(i+1).padStart(2,'0')} / 30`;for(const [n,btn]of buttons)btn.setAttribute('aria-pressed',String(n===name));});buttons.set(name,b);document.querySelector('#clips').append(b);
}
const queue=[...names];Promise.allSettled(Array.from({length:3},async()=>{while(queue.length&&!disposed){const n=queue.shift(),img=new Image();img.src='/assets/generated/chikun-flight-v1/'+n+'.webp';try{await img.decode();images.set(n,img);}catch{}}}));
motion.addEventListener('click',()=>{paused=!paused;sync();});sync();
time.addEventListener('input',()=>{clock=Number(time.value);});
document.querySelector('#sound').addEventListener('click',async()=>{await audio.unlock();audio.play('flap');setTimeout(()=>audio.play('coin'),250);setTimeout(()=>audio.play('near'),750);setTimeout(()=>audio.play('streak'),1200);});
function frame(now){
 if(disposed)return;const dt=last?Math.min(.05,(now-last)/1000):0;last=now;
 if(!paused&&document.visibilityState!=='hidden')age+=dt;
 world.draw(ctx,{tick:clock*60},{reduced:false});
 const img=images.get(clip);
 if(img){const s=sampleChikunFrame(clip,paused?age:age%(CHIKUN_CLIPS[clip].loop?10000:1.1));ctx.save();ctx.translate(825,365);ctx.shadowColor='#05182e44';ctx.shadowBlur=30;ctx.drawImage(img,s.frame%4*192,Math.floor(s.frame/4)*192,192,192,-220,-220,440,440);ctx.restore();}
 requestAnimationFrame(frame);
}
addEventListener('pagehide',()=>{disposed=true;world.dispose();audio.dispose();images.clear();});requestAnimationFrame(frame);
