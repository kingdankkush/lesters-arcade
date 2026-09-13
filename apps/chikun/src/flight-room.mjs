import { CHIKUN_CLIPS, createChikunCharacter } from './character.mjs';
import { createChikunWorld } from './world.mjs';
import { createChikunAudio } from './audio.mjs';
const canvas=document.querySelector('#stage'),ctx=canvas.getContext('2d',{alpha:false}),world=createChikunWorld(),audio=createChikunAudio(),character=createChikunCharacter();
const names=Object.keys(CHIKUN_CLIPS),buttons=new Map();
let clip='cruise',age=0,last=0,clock=0,disposed=false,paused=matchMedia('(prefers-reduced-motion: reduce)').matches;
const motion=document.querySelector('#motion'),time=document.querySelector('#time');
function sync(){motion.textContent=paused?'Play animation':'Pause animation';motion.setAttribute('aria-pressed',String(paused));}
function label(){document.querySelector('#clipLabel').textContent=clip.replaceAll('_',' ');document.querySelector('.caption span:last-child').textContent=`${String(names.indexOf(clip)+1).padStart(2,'0')} / ${names.length}`;}
for(const [i,name] of names.entries()){
  const b=document.createElement('button');b.innerHTML=`<span>${String(i+1).padStart(2,'0')}</span>${name.replaceAll('_',' ')}`;b.setAttribute('aria-pressed',String(name===clip));b.addEventListener('click',()=>{clip=name;age=0;label();for(const [n,btn]of buttons)btn.setAttribute('aria-pressed',String(n===name));});buttons.set(name,b);document.querySelector('#clips').append(b);
}
label();motion.addEventListener('click',()=>{paused=!paused;sync();});sync();
time.addEventListener('input',()=>{clock=Number(time.value);});
document.querySelector('#sound').addEventListener('click',async()=>{await audio.unlock();audio.play('flap');setTimeout(()=>audio.play('coin'),250);setTimeout(()=>audio.play('near'),750);setTimeout(()=>audio.play('streak'),1200);});
function frame(now){
 if(disposed)return;const dt=last?Math.min(.05,(now-last)/1000):0;last=now;
 if(!paused&&document.visibilityState!=='hidden')age+=dt;
 world.draw(ctx,{tick:clock*60},{reduced:false});
 character.draw(ctx,{tick:0,chikun:{x:825,y:365,velocityY:0}},dt,{previewClip:clip,previewTime:age%(CHIKUN_CLIPS[clip].loop?10000:1.1)});
 requestAnimationFrame(frame);
}
addEventListener('pagehide',()=>{disposed=true;world.dispose();audio.dispose();character.dispose();});requestAnimationFrame(frame);
