import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {decodeActor3dGlb,evaluateActor3dPose} from '../apps/hmh-reboot/src/actor-3d-model.mjs';
import {loadActor3dBytes} from '../apps/hmh-reboot/src/actor-3d-download.mjs';
import {ACTOR3D_LOW_ASSETS} from '../apps/hmh-reboot/src/actor-3d-texture-tiers.mjs';
const directory=new URL('../apps/portal/assets/generated/hmh-actor-3d-pilot/',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('low/manifest.json',directory),'utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const buffer=bytes=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);

for(const [hero,row] of Object.entries(manifest.actors)) test(`${hero} low download is under 1.5 MB with identical geometry, rig and all 80 clip poses`,()=>{
  const original=readFileSync(new URL(`${hero}.glb`,directory)),packed=readFileSync(new URL(`low/${row.file}`,directory)),raw=gunzipSync(packed);
  assert.equal(sha(original),row.sourceSha256); assert.equal(sha(packed),row.sha256); assert.equal(sha(raw),row.glbSha256);
  assert.equal(packed.length,row.compressedBytes); assert.equal(raw.length,row.glbBytes); assert.ok(packed.length<=1_500_000);
  assert.deepEqual(ACTOR3D_LOW_ASSETS[hero],{file:row.file,compressedBytes:row.compressedBytes,glbBytes:row.glbBytes});
  const high=decodeActor3dGlb(buffer(original)),low=decodeActor3dGlb(buffer(raw));
  assert.deepEqual(low.primitives,high.primitives); assert.deepEqual(low.nodes,high.nodes); assert.deepEqual(low.skins,high.skins);
  assert.deepEqual(low.clips,high.clips); assert.equal(low.clips.size,80);
  for(const clip of low.clips.keys()) for(const t of [0,.5,1]) assert.deepEqual(evaluateActor3dPose(low,clip,t),evaluateActor3dPose(high,clip,t));
  assert.deepEqual(low.images.map(image=>[image.width,image.height]),row.images.map(image=>image.size));
  assert.ok(low.images.every(image=>image.mimeType==='image/webp'&&image.width<=512&&image.height<=512));
});

test('WebP validation rejects corrupt sizes, oversized frames and unsupported extended containers before browser decode',()=>{
  const raw=gunzipSync(readFileSync(new URL('low/lit-commando.glb.gz',directory)));
  const jsonLength=raw.readUInt32LE(12),json=JSON.parse(raw.subarray(20,20+jsonLength));
  const start=28+jsonLength+json.bufferViews[json.images[0].bufferView].byteOffset;
  for(const mutate of [
    bytes=>bytes.writeUInt32LE(1,start+4),
    bytes=>bytes.writeUInt16LE(2048,start+26),
    bytes=>{bytes.write('VP8X',start+12);bytes[start+20]=0;bytes.fill(0,start+24,start+30);},
    bytes=>bytes.writeUInt32LE(1,start+16)
  ]) {
    const changed=Buffer.from(raw);mutate(changed);
    assert.throws(()=>decodeActor3dGlb(buffer(changed)),/pilot.*(WebP|texture)/);
  }
});

test('bounded gzip loader handles compressed and HTTP-decoded bytes; unsupported and damaged assets retain the classic path',async()=>{
  const bytes=new Uint8Array(64);new DataView(bytes.buffer).setUint32(0,0x46546c67,true);
  const packed=gzipSync(bytes),registry={hero:{file:'hero.glb.gz',compressedBytes:packed.length,glbBytes:64}};
  for(const input of [packed,bytes]) {
    const calls=[];
    const result=await loadActor3dBytes('hero',{qualityTier:'low',registry,fetchAsset:async url=>{calls.push(url);return new Response(input);}});
    assert.deepEqual(new Uint8Array(result),bytes);assert.equal(calls.length,1);
  }
  for(const options of [{Decompress:null},{invalid:true},{registry:{hero:{...registry.hero,glbBytes:32}}}]) {
    const calls=[];
    const result=await loadActor3dBytes('hero',{qualityTier:'low',registry,...options,fetchAsset:async url=>{calls.push(url);return new Response(url.endsWith('.gz')?options.invalid?new Uint8Array([1,2,3]):packed:bytes);}});
    assert.deepEqual(new Uint8Array(result),bytes);assert.ok(calls.at(-1).endsWith('/hero.glb'));
  }
});

test('aborted reads cancel their owned reader and do not trigger a classic retry',async()=>{
  const abort=new AbortController();let canceled=0,calls=0;
  const stream=new ReadableStream({pull(controller){abort.abort();controller.enqueue(new Uint8Array([1]));},cancel(){canceled++;}});
  await assert.rejects(loadActor3dBytes('hero',{qualityTier:'low',registry:{hero:{file:'hero.glb.gz',compressedBytes:1,glbBytes:64}},signal:abort.signal,fetchAsset:async()=>{calls++;return new Response(stream);}}),{name:'AbortError'});
  assert.equal(calls,1);assert.equal(canceled,1);
});
