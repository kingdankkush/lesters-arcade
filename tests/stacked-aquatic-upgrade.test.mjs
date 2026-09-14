import test from 'node:test';
import assert from 'node:assert/strict';
import { AQUATIC_SPECIES, createLivingField } from '../apps/stacked/src/render/living-field.mjs';
import { createGameplayParticles } from '../apps/stacked/src/render/gameplay-particles.mjs';
import { defaultStackedSettings } from '../apps/portal/src/stacked-player-settings.mjs';
import {cellsFor,collides} from '../apps/portal/src/stacked-sim.mjs';
test('nine distinct aquatic forms remain visible and music responsive on phones',()=>{
 assert.equal(new Set(AQUATIC_SPECIES).size,9);
 const field=createLivingField({mobile:true}), args={now:0,width:620,height:1000};
 const state=field.update(args), before=Array.from(state.x);
 assert.equal(state.organisms,9);assert.equal(state.count,432);
 assert.equal(new Set(Array.from({length:9},(_,i)=>Array.from(state.y.slice(i*48,i*48+48)).map(y=>Math.round(y-state.y[i*48])).join(','))).size,9);
 field.update({...args,now:500,bass:1,beat:1});assert.notDeepEqual(Array.from(state.x),before);
 assert.ok(state.x.slice(0,state.count).some(x=>Math.abs(x)>240));
});
test('default blocks are clean, without the added dot pattern',()=>assert.equal(defaultStackedSettings().accessibility.colorblindPieces,false));
test('a committed lock retains its matching colored footprint for exactly one second',()=>{
 const geometry={cellsFor,collides}, settings=defaultStackedSettings(), p=createGameplayParticles({geometry,mobile:true});
 const before={tick:1,board:Array(240).fill(0),active:{kind:'T',rotation:0,x:3,y:14},lines:0,piecesLocked:0,piecesSpawned:1,holdsUsed:0,hardDropCells:0};
 const cells=cellsFor('T',0,3,-1), board=[...before.board];for(const[x,y]of cells)board[y*10+x]=6;
 p.step(before,{...before,tick:2,board,piecesLocked:1,piecesSpawned:2},100,settings);
 const glow=p.state.glows.find(g=>g.born===100);assert.ok(glow);assert.equal(glow.color,0xb66cff);assert.deepEqual(glow.cells,cells);
 assert.equal(p.update(1099,settings).glows.filter(g=>g.active).length,1);
 assert.equal(p.update(1100,settings).glows.filter(g=>g.active).length,0);
});
