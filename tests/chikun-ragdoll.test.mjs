import test from 'node:test';import assert from 'node:assert/strict';
import {createChikunRagdoll,planChikunDeath} from '../apps/chikun/src/ragdoll.mjs';
test('drone always decapitates; pipes and trees sometimes detach limbs',()=>{
 for(let tick=0;tick<100;tick++)assert.equal(planChikunDeath({kind:'drone',tick}).sever,'head');
 for(const kind of ['pipe','tree'])assert.deepEqual(new Set(Array.from({length:100},(_,tick)=>planChikunDeath({kind,tick}).sever)),new Set(['limbs','none']));
});
test('ragdoll is bounded, settles against ground, and expires at six seconds',()=>{
 const d=createChikunRagdoll({x:280,y:630,kind:'drone',tick:100});
 assert.equal(d.links[0].active,false);assert.ok(d.blood.length<=42);
 for(let i=0;i<361;i++)d.step(1/60);
 assert.equal(d.active,false);assert.equal(d.age,6);
 for(const n of d.nodes){assert.ok(Number.isFinite(n.x+n.y));assert.ok(n.y+n.radius<=690.01);}
 const before=JSON.stringify(d.nodes);d.step(.1);assert.equal(JSON.stringify(d.nodes),before);d.dispose();assert.equal(d.nodes.length,0);
});
test('reduced motion suppresses corpse animation and gore preference suppresses blood/dismemberment',()=>{
 assert.equal(planChikunDeath({reduceMotion:true}).duration,0);const d=createChikunRagdoll({kind:'drone',gore:false});assert.equal(d.blood.length,0);assert.ok(d.links.every(x=>x.active));
});
