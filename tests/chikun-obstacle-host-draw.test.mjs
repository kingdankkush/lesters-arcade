import test from 'node:test';
import assert from 'node:assert/strict';
import {createChikunHost} from '../apps/portal/src/chikun-host.mjs';
import {readFileSync} from 'node:fs';
import {parse} from 'acorn';
import {loadGroundArt,drawGroundObstacle} from '../apps/chikun/src/ground-world.mjs';
test('real Chikun host forwards captured cosmetic options and strips all gameplay and replay queries',()=>{
 const mount={replaceChildren(){}},documentRef={documentElement:{dataset:{}},createElement:()=>({dataset:{},setAttribute(){},addEventListener(){}})};
 for(const [search,suffix]of [['?obstacleLoops=off&seed=9','?obstacleLoops=off'],['?obstacleLoops=eagle-v1&obstacleQuality=medium&seed=9&replay=private','?obstacleLoops=eagle-v1&obstacleQuality=medium'],['?obstacleLoops=eagle-v1&obstacleLoops=eagle-v1','']]){
  const host=createChikunHost({mount,documentRef,search,expectedOrigin:'http://127.0.0.1:8799',bridgeFactory:()=>({destroy(){}}),setTimeoutRef:()=>1,clearTimeoutRef(){}});
  const iframe=host.mountSession({});assert.equal(iframe.src,'http://127.0.0.1:8799/chikun/index.html'+suffix);host.destroy();
 }
});
test('portal passes its boot-captured search into the actual Chikun host call',()=>{
 const source=readFileSync(new URL('../apps/portal/main.js',import.meta.url),'utf8'),ast=parse(source,{ecmaVersion:'latest',sourceType:'module'});const calls=[];
 const visit=node=>{if(!node||typeof node!=='object')return;if(node.type==='CallExpression'&&node.callee.type==='Identifier'&&node.callee.name==='createChikunHost')calls.push(node);for(const value of Object.values(node))if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);};visit(ast);
 assert.equal(calls.length,1);assert.ok(calls[0].arguments[0].properties.some(prop=>prop.key.name==='search'&&prop.value.type==='Identifier'&&prop.value.name==='bootRuntimeSearch'));
});
test('actual ground drawing selects only the optional sheet while static fallback keeps exact destination',async()=>{
 const previous=globalThis.Image;class Image{async decode(){}}globalThis.Image=Image;
 try{await loadGroundArt();}finally{globalThis.Image=previous;}
 const obstacle=Object.freeze({variant:'eagle',family:'sky',kind:'eagle',x:40,y:260,width:90,height:70,coin:Object.freeze({collected:true})}),draws=[],calls=[];
 const ctx={drawImage:(...args)=>draws.push(args)};
 const view={draw:(...args)=>{calls.push(args);return true;}};
 drawGroundObstacle(ctx,obstacle,20,false,view);assert.equal(calls.length,1);assert.equal(calls[0][1],obstacle);assert.deepEqual(calls[0].slice(2),[20,false,40,218,90,70]);assert.equal(draws.length,0);
 drawGroundObstacle(ctx,obstacle,20,true,{draw:()=>false});assert.equal(draws.length,1);assert.deepEqual(draws[0].slice(1),[40,218,90,70]);
});
