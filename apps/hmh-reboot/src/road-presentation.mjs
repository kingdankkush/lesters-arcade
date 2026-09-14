// Rounded road corners stay inside the authored traversal corridor.
export function roundedRoadNodes(nodes,width){
 if(nodes.length<3)return nodes;
 const result=[nodes[0]];
 for(let i=1;i<nodes.length-1;i++){
  const a=nodes[i-1],b=nodes[i],c=nodes[i+1],inLength=Math.hypot(b.x-a.x,b.y-a.y),outLength=Math.hypot(c.x-b.x,c.y-b.y);
  if(!inLength||!outLength){result.push(b);continue;}
  const ux=(b.x-a.x)/inLength,uy=(b.y-a.y)/inLength,vx=(c.x-b.x)/outLength,vy=(c.y-b.y)/outLength;
  if(ux*vx+uy*vy<-.85){result.push(b);continue;}
  const radius=Math.min(width*.28,inLength*.2,outLength*.2),start={x:b.x-ux*radius,y:b.y-uy*radius},end={x:b.x+vx*radius,y:b.y+vy*radius};
  for(let j=0;j<=4;j++){const t=j/4,u=1-t;result.push({x:u*u*start.x+2*u*t*b.x+t*t*end.x,y:u*u*start.y+2*u*t*b.y+t*t*end.y});}
 }
 result.push(nodes.at(-1));return result;
}
