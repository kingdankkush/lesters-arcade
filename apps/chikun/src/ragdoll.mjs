// Cosmetic fixed-step joint solver. It has no access to the run or score owner.
export const RAGDOLL_SECONDS=6;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const hash=n=>{let x=Math.imul(n^0x9e3779b9,2246822519)>>>0;x^=x>>>13;return (Math.imul(x,3266489917)>>>0)/4294967296;};
export function planChikunDeath({kind='pipe',tick=0,index=0,reduceMotion=false,gore=true}={}){
 const sever=kind==='drone'?'head':(['pipe','tree','fork'].includes(kind)&&hash(tick+index*31)<.48?'limbs':'none');
 return Object.freeze({duration:reduceMotion?0:RAGDOLL_SECONDS,sever:gore?sever:'none',blood:gore?(reduceMotion?0:42):0,kind});
}
export function createChikunRagdoll({x=280,y=360,velocityY=0,speed=2.4,kind='pipe',tick=0,index=0,grounded=false,reduceMotion=false,gore=true}={}){
 const plan=planChikunDeath({kind,tick,index,reduceMotion,gore});
 const offsets=grounded?[[0,-8],[0,-42],[-14,-7],[14,-7],[-10,22],[10,22]]:[[0,0],[39,-3],[22,12],[23,-12],[-38,9],[-38,-8]];
 const names=['torso','head','armL','armR','legL','legR'];
 const nodes=offsets.map(([dx,dy],i)=>({name:names[i],x:x+dx,y:y+dy,px:x+dx-speed*(.4+hash(tick+i)*1.1),py:y+dy-velocityY*.7+2.4+hash(tick+i+20)*2,radius:i===0?16:i===1?13:8,angle:grounded?-Math.PI/2:0,spin:(hash(tick+i+37)-.5)*.18}));
 const links=nodes.slice(1).map((n,i)=>({a:0,b:i+1,length:Math.hypot(offsets[i+1][0],offsets[i+1][1]),active:!(plan.sever==='head'&&i===0)&&!(plan.sever==='limbs'&&(i===2||i===4))}));
 const blood=Array.from({length:plan.blood},(_,i)=>({x,y,vx:(hash(tick+i*7)-.35)*8,vy:-hash(tick+i*13+3)*7-1,life:1.2+hash(i+91)*3,size:1+hash(i+51)*2.8,age:0}));
 let age=0,accumulator=0,dead=false;
 function step(dt){
  if(dead||age>=plan.duration)return;dt=clamp(dt,0,.1);age=Math.min(plan.duration,age+dt);accumulator+=dt;
  while(accumulator>=1/60){
   accumulator-=1/60;
   for(const n of nodes){const vx=(n.x-n.px)*.988,vy=(n.y-n.py)*.99;n.px=n.x;n.py=n.y;n.x+=vx;n.y+=vy+.19;n.angle+=n.spin;n.spin*=.996;}
   for(let pass=0;pass<5;pass++){
    for(const link of links)if(link.active){const a=nodes[link.a],b=nodes[link.b],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,k=(d-link.length)/d*.48;a.x+=dx*k;a.y+=dy*k;b.x-=dx*k;b.y-=dy*k;}
    for(const n of nodes){if(n.y+n.radius>690){n.y=690-n.radius;const vx=n.x-n.px,vy=n.y-n.py;n.px=n.x-vx*.74;n.py=n.y+Math.abs(vy)*.22;n.spin*=.76;}n.x=clamp(n.x,25,1255);}
   }
   for(const p of blood){p.age+=1/60;if(p.age>p.life)continue;p.x+=p.vx;p.y+=p.vy;p.vy+=.16;p.vx*=.99;if(p.y>688){p.y=688;p.vx*=.68;p.vy=0;}}
  }
 }
 return {plan,nodes,links,blood,step,get age(){return age;},get active(){return !dead&&age<plan.duration;},dispose(){dead=true;nodes.length=links.length=blood.length=0;}};
}
const art=new Map();
export function loadRagdollArt(){if(typeof Image==='undefined'||art.size)return Promise.resolve();return Promise.allSettled(['torso','head','armL','armR','legL','legR'].map(async name=>{const img=new Image();img.src='/assets/generated/chikun-ragdoll-v1/'+name+'.webp';try{await img.decode();art.set(name,img);}catch{}}));}
export function drawChikunRagdoll(ctx,doll){
 if(!doll?.nodes.length)return;
 const fade=doll.age>5?Math.max(0,6-doll.age):1;ctx.save();ctx.globalAlpha=fade;
 for(const p of doll.blood){if(p.age>=p.life)continue;ctx.fillStyle=p.y>=688?'#781c29':'#bd293c';ctx.beginPath();ctx.ellipse(p.x,p.y,p.size*(p.y>=688?2.3:1),p.size*(p.y>=688?.45:1),0,0,Math.PI*2);ctx.fill();}
 for(const n of [...doll.nodes].reverse()){
  const img=art.get(n.name);ctx.save();ctx.translate(n.x,n.y);ctx.rotate(n.angle);
  if(img){const width=n.name==='torso'?52:n.name==='head'?35:42;ctx.drawImage(img,-width/2,-width*img.naturalHeight/img.naturalWidth/2,width,width*img.naturalHeight/img.naturalWidth);}
  else {ctx.fillStyle=n.name==='head'?'#c99741':n.name.startsWith('leg')?'#202b38':'#c6b592';ctx.beginPath();ctx.ellipse(0,0,n.radius*1.35,n.radius,0,0,Math.PI*2);ctx.fill();}
  if(doll.plan.sever!=='none'&&n.name==='head'){ctx.fillStyle='#8e2031';ctx.fillRect(-15,-4,4,8);}
  ctx.restore();
 }
 ctx.restore();
}
