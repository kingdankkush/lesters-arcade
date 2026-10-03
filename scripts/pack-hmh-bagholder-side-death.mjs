// Append only native animation streams; preserve the original runtime art and
// every legacy clip/accessor byte. This does not rebuild geometry/textures.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { inspectActorGlb } from './lib/hmh-actor-glb.mjs';
const root=new URL('../',import.meta.url),args=process.argv.slice(2);
const option=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
const scratch=new URL(option('--directory','.tmp/hmh-bagholder-side-death-02/') .replace(/\/?$/,'/'),root);
if(!scratch.pathname.startsWith(new URL('.tmp/',root).pathname))throw Error('Scratch output must stay in worktree');
const hash=b=>createHash('sha256').update(b).digest('hex');
const unpack=bytes=>{const length=bytes.readUInt32LE(12);return{json:JSON.parse(bytes.subarray(20,20+length)),bin:bytes.subarray(28+length)};};
const runtime=new URL('apps/portal/assets/generated/hmh-actor-3d-pilot/bagholder-rusher.glb',root);
const original=new URL('original-runtime.glb',scratch);
if(!existsSync(original))writeFileSync(original,readFileSync(runtime));
const oldBytes=readFileSync(original),base=unpack(oldBytes),native=unpack(readFileSync(new URL('side-source.glb',scratch)));
assert.equal(hash(oldBytes),'cb5b557b3aff2018af5bb88352219ec86212e35404a3cd442904bc161aa78d33','Use the immutable pre-variation runtime base');
const nodeMap=native.json.nodes.map(node=>{
  const match=base.json.nodes.findIndex(old=>old.name===node.name);
  assert.ok(match>=0,'Native source joint identity: '+node.name);
  for(const key of ['translation','rotation','scale','matrix'])assert.deepEqual(node[key],base.json.nodes[match][key],node.name+' rest transform');
  return match;
});
for(let i=0;i<native.json.nodes.length;i++)assert.deepEqual((native.json.nodes[i].children??[]).map(n=>nodeMap[n]),base.json.nodes[nodeMap[i]].children??[],'Native source hierarchy');
const json=structuredClone(base.json),pieces=[base.bin],accessors=new Map(),views=new Map();
let offset=base.bin.length;
function copyAccessor(index){
  if(accessors.has(index))return accessors.get(index);
  const accessor=structuredClone(native.json.accessors[index]);
  if(!views.has(accessor.bufferView)){
    const view=structuredClone(native.json.bufferViews[accessor.bufferView]),oldIndex=accessor.bufferView;
    const padding=(-offset)&3;if(padding){pieces.push(Buffer.alloc(padding));offset+=padding;}
    const data=native.bin.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength);
    pieces.push(data);view.byteOffset=offset;offset+=data.length;
    views.set(oldIndex,json.bufferViews.length);json.bufferViews.push(view);
  }
  accessor.bufferView=views.get(accessor.bufferView);
  accessors.set(index,json.accessors.length);json.accessors.push(accessor);return accessors.get(index);
}
const animation=structuredClone(native.json.animations.find(clip=>clip.name==='death-side'));
assert.ok(animation,'New authored native clip missing');
for(const sampler of animation.samplers){sampler.input=copyAccessor(sampler.input);sampler.output=copyAccessor(sampler.output);}
for(const channel of animation.channels)channel.target.node=nodeMap[channel.target.node];
json.animations.push(animation);json.buffers[0].byteLength=offset;
const binary=Buffer.concat(pieces),encoded=Buffer.from(JSON.stringify(json));
const jsonChunk=Buffer.alloc((encoded.length+3)&~3,32);encoded.copy(jsonChunk);
const binChunk=Buffer.alloc((binary.length+3)&~3);binary.copy(binChunk);
const bytes=Buffer.alloc(28+jsonChunk.length+binChunk.length);
bytes.writeUInt32LE(0x46546c67,0);bytes.writeUInt32LE(2,4);bytes.writeUInt32LE(bytes.length,8);
bytes.writeUInt32LE(jsonChunk.length,12);bytes.writeUInt32LE(0x4e4f534a,16);jsonChunk.copy(bytes,20);
bytes.writeUInt32LE(binChunk.length,20+jsonChunk.length);bytes.writeUInt32LE(0x004e4942,24+jsonChunk.length);binChunk.copy(bytes,28+jsonChunk.length);
for(const key of ['nodes','skins','meshes','materials','textures','images','samplers','scenes'])assert.deepEqual(json[key],base.json[key],key+' is preserved');
assert.deepEqual(json.animations.slice(0,-1),base.json.animations,'Legacy animation metadata unchanged');
assert.ok(binary.subarray(0,base.bin.length).equals(base.bin),'Legacy binary streams unchanged');
const proof=JSON.parse(readFileSync(new URL('source-proof.json',scratch)));
const requiredClips=[...base.json.animations.map(a=>a.name),'death-side'];
const inspection=inspectActorGlb(bytes,{requiredClips});
const receipt={schema:1,actorId:'bagholder-rusher',authority:'presentation-only',sourceSha256:proof.sourceSha256,sourceUnchanged:proof.sourceUnchanged,
  nativeAction:proof.nativeAction,authoringScriptSha256:proof.authoringScriptSha256,packerSha256:hash(readFileSync(new URL(import.meta.url))),
  glbSha256:hash(bytes),originalGlbSha256:hash(oldBytes),originalBinSha256:hash(base.bin),originalBinBytes:base.bin.length,
  originalClipBytesUnchanged:true,geometryRigTexturesUnchanged:true,assetDeltaBytes:bytes.length-oldBytes.length,
  variant:'death-side',durationSeconds:1,requiredClips,inspection,sourceProof:proof};
assert.ok(receipt.assetDeltaBytes<40000,'Animation exceeds bounded slice budget');
writeFileSync(new URL('bagholder-rusher.glb',scratch),bytes);
writeFileSync(new URL('bagholder-rusher-deaths.json',scratch),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({bytes:bytes.length,delta:receipt.assetDeltaBytes,hash:receipt.glbSha256,triangles:inspection.triangles,clips:inspection.clips.map(c=>c.name)}));
if(args.includes('--publish')){
  const reimportPath=new URL('.tmp/hmh-actor-3d-pilot/bagholder-rusher-reimport.json',root);
  const reimport=JSON.parse(readFileSync(reimportPath));
  assert.equal(reimport.glbSha256,receipt.glbSha256,'Native reimport must match this candidate');
  assert.deepEqual(reimport.clips.map(c=>c.name).sort(),[...requiredClips].sort());
  for(const clip of reimport.clips){assert.equal(clip.samples.length,5);assert.ok(Math.abs(clip.minimumWorldZ)<.0002 && Math.abs(clip.maximumMinimumWorldZ)<.0002);}
  assert.equal(hash(readFileSync(new URL(proof.source,root))),proof.sourceSha256,'Immutable native source unchanged at publish');
  const manifestPath=new URL('apps/portal/assets/generated/hmh-actor-3d-pilot/manifest.json',root);
  const manifest=JSON.parse(readFileSync(manifestPath));
  manifest.actors['bagholder-rusher']={...manifest.actors['bagholder-rusher'],sha256:receipt.glbSha256,requiredClips,inspection,
    deathVariants:{manifest:'bagholder-rusher-deaths.json',clips:['death','death-side'],selection:'stable-presentation-identity-fnv1a'}};
  writeFileSync(runtime,bytes);
  writeFileSync(new URL('bagholder-rusher-deaths.json',runtime),JSON.stringify(receipt,null,2)+'\n');
  writeFileSync(new URL('docs/2.0/receipts/bagholder-rusher-glb-reimport.json',root),readFileSync(reimportPath));
  writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
}
