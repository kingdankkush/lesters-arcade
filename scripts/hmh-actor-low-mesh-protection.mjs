// Offline protection mask from the accepted rig's actual animated extrema.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {decodeActor3dGlb,evaluateActor3dPose} from '../apps/hmh-reboot/src/actor-3d-model.mjs';
const root=new URL('../',import.meta.url), out=new URL('.tmp/hmh-low-mesh/',root);mkdirSync(out,{recursive:true});
for(const hero of ['lit-commando','lilly','lit-valkyrie','lester-original']) {
  const raw=readFileSync(new URL(`apps/portal/assets/generated/hmh-actor-3d-pilot/${hero}.glb`,root));
  const asset=decodeActor3dGlb(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength));
  const masks=asset.primitives.map(()=>new Set());
  for(const clip of asset.clips.keys()) for(const time of [0,.25,.5,.75,1]) {
    const palettes=evaluateActor3dPose(asset,clip,time);
    for(let p=0;p<asset.primitives.length;p++) {
      const primitive=asset.primitives[p], palette=palettes[primitive.skin], min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity],minimum=[0,0,0],maximum=[0,0,0];
      for(let v=0;v<primitive.positions.length/3;v++) {
        const point=[0,0,0];
        for(let w=0;w<4;w++) {const weight=primitive.weights[v*4+w],at=primitive.joints[v*4+w]*16;
          for(let axis=0;axis<3;axis++) point[axis]+=weight*(palette[at+axis]*primitive.positions[v*3]+palette[at+4+axis]*primitive.positions[v*3+1]+palette[at+8+axis]*primitive.positions[v*3+2]+palette[at+12+axis]);}
        for(let axis=0;axis<3;axis++) {if(point[axis]<min[axis]){min[axis]=point[axis];minimum[axis]=v;}if(point[axis]>max[axis]){max[axis]=point[axis];maximum[axis]=v;}}
      }
      for(const v of [...minimum,...maximum]) masks[p].add(v);
    }
  }
  const meshes=Object.fromEntries(asset.primitives.map((p,i)=>[p.nodeName,{vertices:p.positions.length/3,protected:[...masks[i]].sort((a,b)=>a-b).map(index=>({index,position:Array.from(p.positions.subarray(index*3,index*3+3))}))}]));
  writeFileSync(new URL(`${hero}-protection.json`,out),JSON.stringify({sourceSha256:createHash('sha256').update(raw).digest('hex'),meshes}));
  console.log(hero,Object.fromEntries(Object.entries(meshes).map(([name,row])=>[name,row.protected.length])));
}
