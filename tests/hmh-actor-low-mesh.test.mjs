import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {decodeActor3dGlb,evaluateActor3dPose} from '../apps/hmh-reboot/src/actor-3d-model.mjs';
const directory=new URL('../apps/portal/assets/generated/hmh-actor-3d-pilot/',import.meta.url);
const lowDirectory=process.env.HMH_LOW_MESH_DIR ? pathToFileURL(path.resolve(process.env.HMH_LOW_MESH_DIR)+path.sep) : new URL('low/',directory);
const bytes=raw=>raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength);
const bounds=(primitive,palette)=>{
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let v=0;v<primitive.positions.length/3;v++) {
    const point=[0,0,0];
    for(let w=0;w<4;w++) {
      const weight=primitive.weights[v*4+w],at=primitive.joints[v*4+w]*16;
      for(let axis=0;axis<3;axis++) point[axis]+=weight*(palette[at+axis]*primitive.positions[v*3]+palette[at+4+axis]*primitive.positions[v*3+1]+palette[at+8+axis]*primitive.positions[v*3+2]+palette[at+12+axis]);
    }
    for(let axis=0;axis<3;axis++) {min[axis]=Math.min(min[axis],point[axis]);max[axis]=Math.max(max[axis],point[axis]);}
  }
  return {min,max};
};
for(const hero of ['lit-commando','lilly','lit-valkyrie','lester-original']) test(`${hero} genuine low mesh keeps exact rig/80 clips and bounded animated silhouette`,()=>{
  const high=decodeActor3dGlb(bytes(readFileSync(new URL(`${hero}.glb`,directory))));
  const low=decodeActor3dGlb(bytes(gunzipSync(readFileSync(new URL(`${hero}.glb.gz`,lowDirectory)))));
  const triangles=asset=>asset.primitives.reduce((count,p)=>count+p.indices.length/3,0);
  const vertices=asset=>asset.primitives.reduce((count,p)=>count+p.positions.length/3,0);
  assert.ok(triangles(low)<triangles(high)*.6,'triangles must genuinely shrink by at least 40%');
  assert.ok(vertices(low)<vertices(high)*.75,'vertex allocation must genuinely shrink');
  assert.deepEqual(low.nodes,high.nodes);assert.deepEqual(low.skins,high.skins);assert.deepEqual(low.clips,high.clips);assert.equal(low.clips.size,80);
  assert.deepEqual(low.primitives.map(p=>[p.nodeName,p.skin,p.material]),high.primitives.map(p=>[p.nodeName,p.skin,p.material]));
  for(const p of low.primitives) for(let v=0;v<p.positions.length/3;v++) {
    let total=0;for(let w=0;w<4;w++) {const weight=p.weights[v*4+w];assert.ok(weight>=0&&weight<=1);assert.ok(p.joints[v*4+w]<low.skins[p.skin].joints.length);total+=weight;}
    assert.ok(Math.abs(total-1)<.002,'four influences remain normalized');
    assert.ok(Math.abs(Math.hypot(...p.normals.subarray(v*3,v*3+3))-1)<.01,'unit normals');
    assert.ok(Number.isFinite(p.uvs[v*2])&&Number.isFinite(p.uvs[v*2+1]));
  }
  for(const clip of low.clips.keys()) for(const time of [0,.25,.5,.75,1]) {
    const highPose=evaluateActor3dPose(high,clip,time),lowPose=evaluateActor3dPose(low,clip,time);assert.deepEqual(lowPose,highPose);
    for(let i=0;i<high.primitives.length;i++) {
      const h=bounds(high.primitives[i],highPose[high.primitives[i].skin]),l=bounds(low.primitives[i],lowPose[low.primitives[i].skin]);
      const scale=Math.max(...h.max.map((value,axis)=>value-h.min[axis]),.1);
      for(let axis=0;axis<3;axis++) for(const side of ['min','max']) assert.ok(Math.abs(h[side][axis]-l[side][axis])<=scale*.035,`${hero}/${clip}/${time}/${high.primitives[i].nodeName} ${side}${axis}: ${h[side][axis]} -> ${l[side][axis]}, limit ${scale*.035}`);
    }
  }
});
