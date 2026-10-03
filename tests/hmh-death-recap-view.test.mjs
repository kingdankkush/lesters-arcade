import test from 'node:test';
import assert from 'node:assert/strict';
import { deathRecapModel, createDeathRecapView } from '../apps/hmh-reboot/src/death-recap-view.mjs';

test('cosmetic grades use existing accomplishment counts without altering run values or granting rewards',()=>{
 const run=Object.freeze({kills:43,bosses:1,level:6,score:9123,elapsedMs:183000,killer:'Rug Pull Baron',damage:34});
 const before=JSON.stringify(run),model=deathRecapModel(run);
 assert.equal(model.grade,'A');assert.equal(model.clock,'3:03');assert.match(model.cause,/Rug Pull Baron/);assert.match(model.cause,/34 damage/);
 assert.equal(JSON.stringify(run),before);
 assert.deepEqual([{}, {kills:20}, {kills:75}, {bosses:1}, {bosses:2}].map(deathRecapModel).map(m=>m.grade),['D','C','B','A','S']);
 assert.equal(deathRecapModel({killer:null}).cause,'Defeat source unavailable.');
 assert.equal(deathRecapModel({kills:NaN,elapsedMs:-1}).clock,'0:00');
});

function viewFixture(){
 const fields=Object.fromEntries(['grade','cause','clock','kills','level','score','sources'].map(key=>[key,{textContent:''}]));
 const root={hidden:true,dataset:{},querySelector:s=>fields[s.slice(6,-1)]};
 const hud={hidden:false},actions={hidden:true,focus(){this.focused=true;}};
 return {root,fields,hud,actions};
}
test('death beat transitions to recap without a timer, preserves the HUD hidden state, and resets for a new session',()=>{
 const f=viewFixture(),view=createDeathRecapView(f);
 view.begin({kills:23,level:2,score:500,elapsedMs:60000},{standalone:true});
 assert.equal(f.root.hidden,false);assert.equal(f.root.dataset.phase,'beat');assert.equal(f.hud.hidden,true);assert.equal(f.actions.hidden,true);
 view.complete();assert.equal(f.root.dataset.phase,'recap');assert.equal(f.fields.grade.textContent,'C');assert.equal(f.actions.hidden,false);assert.equal(f.actions.focused,true);
 view.reset();assert.equal(f.root.hidden,true);assert.equal(f.hud.hidden,false);
 f.hud.hidden=true;view.begin({},{standalone:false});view.complete();assert.equal(f.actions.hidden,true);view.reset();assert.equal(f.hud.hidden,true);
});
test('completion cannot show a stale recap after reset/disposal or duplicate a focus action',()=>{
 const f=viewFixture(),view=createDeathRecapView(f);view.complete();assert.equal(f.root.hidden,true);
 view.begin({},{standalone:true});view.reset();view.complete();assert.equal(f.root.hidden,true);
 view.dispose();view.begin({},{standalone:true});view.complete();assert.equal(f.root.hidden,true);
});
test('damage source projection is bounded, reports only applied damage and clears across sessions',()=>{
 const f=viewFixture(),view=createDeathRecapView(f);view.observeDamage('Bagholder Rusher',12);view.observeDamage('Bagholder Rusher',8);
 for(const name of ['Boss','Steam','Grenade','Fuel','Other enemy'])view.observeDamage(name,3);
 view.observeDamage('Blocked hit',0);view.observeDamage('Invalid hit',NaN);view.begin({});
 assert.equal(f.fields.sources.textContent,'Damage taken · Bagholder Rusher 20 · Boss 3 · Steam 3 · Grenade 3 · Other sources 6');
 view.reset();view.begin({});assert.equal(f.fields.sources.textContent,'');
 view.dispose();view.observeDamage('late',10);view.begin({});assert.equal(f.root.hidden,true);
});
