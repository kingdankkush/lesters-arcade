// Local presentation grade only. Never awards a score, trophy or reward.
const count=v=>Number.isFinite(v)?Math.max(0,Math.floor(v)):0;
export function deathRecapModel(run={}){
 const kills=count(run.kills),bosses=count(run.bosses),seconds=Math.floor(count(run.elapsedMs)/1000);
 return Object.freeze({grade:bosses>=2?'S':bosses>=1?'A':kills>=75?'B':kills>=20?'C':'D',
  clock:`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`,
  kills:String(kills),level:String(Math.max(1,count(run.level))),score:count(run.score).toLocaleString('en-US'),
  cause:typeof run.killer==='string'&&run.killer.trim()?`Final hit: ${run.killer}${count(run.damage)?` · ${count(run.damage)} damage`:''}.`:'Defeat source unavailable.'});
}
export function createDeathRecapView({root=null,hud=null,actions=null}={}){
 let active=false,disposed=false,standalone=false,hudWasHidden=false,complete=false;
 const sources=[];let otherDamage=0;
 const reset=()=>{if(root)root.hidden=true;if(active&&hud)hud.hidden=hudWasHidden;active=false;complete=false;if(actions)actions.hidden=true;sources.length=0;otherDamage=0;};
 return {
  observeDamage(label,damage){
   if(disposed||!Number.isFinite(damage)||damage<=0)return;
   const name=typeof label==='string'&&label.trim()?label.slice(0,80):'Unknown attack';
   const row=sources.find(s=>s.name===name);if(row)row.damage+=damage;else if(sources.length<4)sources.push({name,damage});else otherDamage+=damage;
  },
  begin(run,{standalone:local=false}={}){
   if(disposed||!root)return;
   const parts=sources.map(s=>`${s.name} ${Math.round(s.damage)}`);if(otherDamage>0)parts.push(`Other sources ${Math.round(otherDamage)}`);
   reset();standalone=local;active=true;hudWasHidden=hud?.hidden??false;if(hud)hud.hidden=true;
   const model=deathRecapModel(run);for(const [key,value]of Object.entries(model)){const field=root.querySelector(`[data-${key}]`);if(field)field.textContent=value;}
   const damageField=root.querySelector('[data-sources]');if(damageField)damageField.textContent=parts.length?'Damage taken · '+parts.join(' · '):'';
   root.dataset.phase='beat';root.hidden=false;
  },
  complete(){if(!active||disposed||complete)return;complete=true;root.dataset.phase='recap';if(actions){actions.hidden=!standalone;if(standalone)actions.focus({preventScroll:true});}},
  reset,
  dispose(){reset();disposed=true;},
 };
}
