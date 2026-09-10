import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parse } from 'acorn';
import { createWeaponLoadout, stepWeaponLoadout, applyWeaponProgression } from '../apps/hmh-reboot/src/weapon-system.mjs';
import { spreadBearMarketBurnerOnDefeat, getBearMarketBurnerSnapshot } from '../apps/hmh-reboot/src/bear-market-burner.mjs';
import { resolveCombatHits } from '../apps/hmh-reboot/src/combat-events.mjs';
import { createAimState, resolveAimIntent } from '../apps/hmh-reboot/src/aim.mjs';

const source=readFileSync(new URL('../apps/hmh-reboot/src/main.mjs',import.meta.url),'utf8');
const ast=parse(source,{ecmaVersion:'latest',sourceType:'module'}), nodes=[];
function walk(n){if(!n||typeof n!=='object')return;if(n.type)nodes.push(n);for(const v of Object.values(n))if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v);}
walk(ast);
const spreadCall=nodes.find(n=>n.type==='CallExpression'&&n.callee.name==='spreadBearMarketBurnerOnDefeat');
const progression={'bear-market-burner':{branches:{volatility:3}}};
const hostile={id:'hostile',x:120,y:0,active:true}, neutral={id:'neutral',x:160,y:0,active:true}, next={id:'next-hostile',x:180,y:0,active:true};
function run(partition){
 const loadout=createWeaponLoadout({weaponIds:['coin-blaster','bear-market-burner'],activeWeaponId:'bear-market-burner'}), events=[];
 for(let frame=partition;frame<=90;frame+=partition)for(let tick=frame-partition+1;tick<=frame;tick++){
  const result=stepWeaponLoadout(loadout,{tick,fire:[6,12,18].includes(tick),direction:{x:1,y:0},channelOrigin:{x:0,y:0},channelTargets:[hostile,neutral],channelProvokesAmbient:tick===12,currentEligibleTargetIds:[hostile.id,next.id],progressionByWeapon:progression});
  events.push(...result.events);
  if(tick===6){
   assert.equal(loadout.weapons['bear-market-burner'].burnerState.burns.has('neutral'),false,'automatic contact must filter before creating a burn');
   const context={spreadBearMarketBurnerOnDefeat,weaponLoadout:loadout,tick:7,defeatedEnemy:hostile,grayboxEnemies:[hostile,neutral,next],currentAutomaticTargetIds:[hostile.id,next.id],applyWeaponProgression,progressionByWeapon:progression,traceHeightAwareLineOfSight:()=>({clear:true}),queryGround:()=>({groundZ:0}),WORLD_BLOCKERS:[]};
   const spread=vm.runInNewContext(source.slice(spreadCall.start,spreadCall.end),context);
   assert.deepEqual(spread.targetIds,[next.id],'actual main defeat-spread call must retain the current hostile and exclude the neutral');
  }
 }
 const pulses=events.filter(e=>e.type==='weapon:flame-pulse');assert.equal(pulses[0].hits[0].provokesAmbient,false);assert.equal(pulses[1].hits[0].provokesAmbient,true);
 const burns=getBearMarketBurnerSnapshot(loadout.weapons['bear-market-burner'].burnerState);
 assert.equal(burns.burns.find(b=>b.targetId===hostile.id).provokesAmbient,true,'automatic refresh must preserve manual origin');
 const hits=events.filter(e=>e.type==='burner:burn-tick').map(e=>({id:`${e.targetId}:${e.tick}`,targetId:e.targetId,sourceId:'player',weaponId:'bear-market-burner',tick:e.tick,damage:e.damage,direction:{x:0,y:0},provokesAmbient:e.provokesAmbient}));
 return {events,burns,combat:resolveCombatHits({sessionSeed:1337,targets:[hostile,neutral,next].map(t=>({...t,health:200,maxHealth:200})),hits})};
}
test('current weapon loadout and main defeat spread preserve causality at 60/30/20 Hz',()=>{const expected=run(1);assert.deepEqual(run(2),expected);assert.deepEqual(run(3),expected);});

test('the actual aim result reaches the main Burner origin flag for automatic and manual aim',()=>{
 const call=nodes.find(n=>n.type==='CallExpression'&&n.callee.name==='stepWeaponLoadout');
 const expr=call.arguments[1].properties.find(p=>p.key.name==='channelProvokesAmbient').value;
 for(const manual of [false,true]){
  const aimIntent=resolveAimIntent(createAimState(),{tick:1,actor:{x:0,y:0},input:{aim:{x:1,y:0,active:manual}},targets:[hostile],device:'touch'});
  assert.equal(vm.runInNewContext(source.slice(expr.start,expr.end),{aimIntent}),manual);
 }
});

test('the main runtime derives Burner eligibility from current actor authority before calling the weapon wrapper',()=>{
 const declaration=nodes.find(n=>n.type==='VariableDeclarator'&&n.id.name==='currentAutomaticTargetIds');
 const grayboxEnemies=[
  {id:'ordinary',active:true,health:20},
  {id:'neutral',active:true,health:20,disposition:'ambient'},
  {id:'provoked',active:true,health:20,disposition:'ambient',provoked:true},
  {id:'event',active:true,health:20,disposition:'ambient',eventHostile:true},
  {id:'inactive',active:false,health:20},
  {id:'dead',active:true,health:0},
 ];
 const eligible=vm.runInNewContext(source.slice(declaration.init.start,declaration.init.end),{grayboxEnemies});
 assert.deepEqual(Array.from(eligible),['event','ordinary','provoked']);
});
