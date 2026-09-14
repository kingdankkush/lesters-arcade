// Render-only normalized polylines. A caller-owned point avoids per-frame garbage.
export const AQUATIC_SPECIES = Object.freeze(['Moon jelly','Squid','Manta ray','Seahorse','Nautilus','Cuttlefish','Octopus','Comb jelly','Siphonophore']);
export function aquaticPoint(species,index,count,phase,pulse,out) {
  const u=index/(count-1), a=u*Math.PI*2, half=Math.floor(count/2);
  let x=0,y=0,joined=index>0;
  const tendrils=(start,strands,spread,length)=>{
    const per=(count-start)/strands, strand=Math.min(strands-1,Math.floor((index-start)/per));
    const local=index-start-Math.ceil(strand*per), span=Math.ceil((strand+1)*per)-Math.ceil(strand*per);
    const v=local/Math.max(1,span-1);
    x=(strand/(strands-1)-.5)*spread+Math.sin(v*5-phase*1.8+strand)*(.1+v*.22)*v;
    y=.12+v*length+(Math.cos(phase+strand)*.08)*v;
    joined=local>0;
  };
  if(species===0) {
    if(index<half){const t=index/(half-1)*Math.PI;x=Math.cos(t)*(1-pulse*.12);y=-Math.sin(t)*(.65+Math.sin(phase)*.10);}
    else tendrils(half,3,1.1,1.5);
  } else if(species===1) {
    if(index<half){const t=index/(half-1)*Math.PI*2;x=Math.sin(t)*(.28+.12*(1+Math.cos(t)));y=-.65-Math.cos(t)*.8;}
    else tendrils(half,6,.7,1.25+pulse*.2);
  } else if(species===2) {
    const wing=Math.floor(count*.75);
    if(index<wing){const t=index/(wing-1)*Math.PI*2;x=Math.cos(t)*1.25;y=Math.sin(t)*.34+Math.abs(Math.cos(t))**3*Math.sin(phase)*.3;}
    else {const v=(index-wing)/(count-wing-1);x=Math.sin(v*4-phase)*v*.18;y=.22+v*1.35;joined=index>wing;}
  } else if(species===3) {
    if(index<half){const v=index/(half-1);x=Math.sin(v*5.5)*.4+(v<.2?(1-v/.2)*.45:0);y=-1+v*1.4;}
    else {const v=(index-half)/(count-half-1),t=v*Math.PI*3;x=.1+Math.cos(t)*(.46-v*.38);y=.7+Math.sin(t)*(.46-v*.38);joined=index>half;}
  } else if(species===4) {
    const shell=Math.floor(count*.75);
    if(index<shell){const v=index/(shell-1),t=v*Math.PI*5,r=.09+v*.8;x=Math.cos(t)*r;y=Math.sin(t)*r;}
    else {const v=(index-shell)/(count-shell-1);x=.65+v*.7;y=.2+Math.sin(v*12-phase)*v*.24;joined=index>shell;}
  } else if(species===5) {
    if(index<half){const t=index/(half-1)*Math.PI*2;x=Math.cos(t)*(.7+.07*Math.sin(t*8-phase*2));y=-.3+Math.sin(t)*(.65+.05*Math.cos(t*6-phase));}
    else tendrils(half,3,.9,1.2);
  } else if(species===6) {
    const head=Math.floor(count/4);
    if(index<head){const t=index/(head-1)*Math.PI*2;x=Math.cos(t)*.45;y=-.5+Math.sin(t)*.55;}
    else tendrils(head,6,1.4,1.25);
  } else if(species===7) {
    if(index<half){const t=index/(half-1)*Math.PI*2;x=Math.cos(t)*(.6+pulse*.1);y=Math.sin(t)*.9;}
    else {const per=(count-half)/3, strand=Math.floor((index-half)/per), local=(index-half)%per,v=local/Math.max(1,per-1);x=(strand-1)*.3*Math.sin(v*Math.PI);y=-.9+v*1.8;joined=local>0;}
  } else {
    const chain=Math.floor(count*.75), per=chain/3;
    if(index<chain){const bubble=Math.floor(index/per),local=index%per,t=local/(per-1)*Math.PI*2;x=Math.sin(phase+bubble*.8)*.14+Math.cos(t)*(.27+pulse*.04);y=-.8+bubble*.55+Math.sin(t)*.36;joined=local>0;}
    else {const v=(index-chain)/(count-chain-1);x=Math.sin(v*7-phase)*v*.28;y=.65+v*.8;joined=index>chain;}
  }
  out.x=x;out.y=y;out.connected=joined?1:0;return out;
}
