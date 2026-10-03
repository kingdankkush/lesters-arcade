import assert from 'node:assert/strict';
import test from 'node:test';
import { GraphicsContext } from 'pixi.js';
import { resolveBossEdgeWarning, createBossEdgeWarning } from '../apps/hmh-reboot/src/boss-edge-warning.mjs';
import { InputState } from '../apps/hmh-reboot/src/input.mjs';
import { createCameraState, worldToScreen } from '../apps/hmh-reboot/src/world-space.mjs';

const view = { width: 414, height: 896 };
const camera = createCameraState({ x: 1000, y: 1000, zoom: .9 });
const hero = Object.freeze({ x: 1000, y: 1000, z: 0 });
const project = p => worldToScreen(p, camera, view);
const makeBoss = fields => ({ active: true, x: 1600, y: 1000, groundZ: 0, pendingAttacks: [], ...fields });
const resolve = (fields = {}) => resolveBossEdgeWarning({ boss: makeBoss(), hero, view, project, tick: 30, zoom: .9, bodyHeight: 84, insets: { top: 190, bottom: 190 }, ...fields });

test('an offscreen boss warns inside the phone HUD/control safe rectangle in all four directions', () => {
  for (const [x, y] of [[1600,1000],[400,1000],[1000,200],[1000,1800]]) {
    const row = resolve({ boss: makeBoss({ x, y }) });
    assert.ok(row.visible);
    assert.ok(row.x >= 34 && row.x <= 380);
    assert.ok(row.y >= 224 && row.y <= 672);
    const length = Math.hypot(x - hero.x,y - hero.y);
    assert.ok(Math.abs(row.directionX - (x-hero.x)/length) < 1e-9);
    assert.ok(Math.abs(row.directionY - (y-hero.y)/length) < 1e-9);
  }
});

test('uses the real locked charge origin and exact countdown, including union geometry', () => {
  const pending = Object.freeze({ attackId: 'margin-charge', tellStartTick: 0, resolveTick: 60,
    geometry: Object.freeze({ type: 'union', shapes: [Object.freeze({ type: 'charge-lane', origin: Object.freeze({ x: 400, y: 1000 }), target: Object.freeze({ x: 1000, y: 1000 }), width: 80 })] }) });
  const boss = makeBoss({ x: 1000, pendingAttacks: [pending] });
  const row = resolve({ boss });
  assert.equal(row.kind, 'charge'); assert.equal(row.directionX, -1);
  assert.equal(row.progress, .5); assert.equal(row.remainingSeconds, .5);
  assert.equal(resolve({ boss, tick: 60 }).visible, false);
});

test('a boss body still intersecting the actual viewport does not claim it is offscreen', () => {
  assert.equal(resolve({ boss: makeBoss({ x: 1240 }) }).visible, false);
  assert.equal(resolve({ boss: makeBoss({ x: 1000, y: 1550 }) }).visible, false);
  assert.equal(resolve({ boss: makeBoss({ active: false }) }).visible, false);
  assert.equal(resolve({ boss: null }).visible, false);
});

test('visible locked charge origin does not create a charge warning just because the boss moved away', () => {
  const boss = makeBoss({ pendingAttacks: [{ attackId:'charge',tellStartTick:0,resolveTick:60,
    geometry:{type:'charge-lane',origin:{x:1000,y:1000},target:{x:1100,y:1000},width:50} }] });
  assert.equal(resolve({ boss }).kind, 'boss');
});

test('invalid and occluded tiny viewports suppress safely; a scratch result is reused', () => {
  assert.equal(resolve({ view:{width:20,height:20} }).visible, false);
  assert.equal(resolve({ view:{width:NaN,height:896} }).visible, false);
  assert.equal(resolve({ boss:makeBoss({x:NaN}) }).visible, false);
  const out = {}; assert.equal(resolve({ out }),out);
});

test('projection does not modify boss, hero, camera, input aim or run state', () => {
  const boss = Object.freeze(makeBoss({ pendingAttacks:Object.freeze([]) }));
  const before = JSON.stringify({ boss,hero,camera });
  const input = new InputState(); input.setPointer({screenX:300,screenY:350},1);
  const aim = input.snapshot({actor:hero,camera,viewport:view,nowMs:1}).actions.aim;
  resolve({ boss });
  assert.equal(JSON.stringify({boss,hero,camera}),before);
  assert.deepEqual(input.snapshot({actor:hero,camera,viewport:view,nowMs:1}).actions.aim,aim);
});

class Container { constructor(){this.visible=true;this.children=[];} addChild(...rows){this.children.push(...rows);} destroy(){this.destroyed=true;} }
class Graphics extends Container {
  constructor(){super();this.calls=[];this.path=false;}
  clear(){this.calls=[];this.path=false;return this;}
  circle(...v){this.path=true;this.calls.push(['circle',...v]);return this;}
  poly(...v){this.path=true;this.calls.push(['poly',...v]);return this;}
  arc(...v){this.path=true;this.calls.push(['arc',...v]);return this;}
  fill(style){assert.ok(this.path,'fill requires a fresh path');this.path=false;this.calls.push(['fill',style]);return this;}
  stroke(style){assert.ok(this.path,'stroke requires a fresh path');this.path=false;this.calls.push(['stroke',style]);return this;}
}
class Text { constructor({text}){this.text=text;this.anchor={set(){}};this.position={set(){}};} }
test('draws consumed Pixi paths independently, reduced motion is stable, and reset/disposal clear ownership', () => {
  const messages=[];
  const warning = createBossEdgeWarning({ContainerClass:Container,GraphicsClass:Graphics,TextClass:Text,announce:m=>messages.push(m)});
  const args={boss:makeBoss(),hero,view,project,tick:30,zoom:.9,bodyHeight:84,insets:{top:190,bottom:190},reduceMotion:true};
  const row=warning.update(args); assert.ok(row.visible);
  const calls=JSON.stringify(warning.graphics.calls);
  warning.update(args); assert.equal(JSON.stringify(warning.graphics.calls),calls);
  assert.equal(messages.length,1);
  warning.reset(); assert.equal(warning.display.visible,false);
  warning.update({...args,boss:null}); assert.equal(warning.display.visible,false);
  warning.dispose(); assert.equal(warning.display.destroyed,true);
  assert.equal(warning.update(args).visible,false);
});

test('real Pixi compiles finite polygon shapes for both warning glyphs', () => {
  const warning=createBossEdgeWarning({ContainerClass:Container,GraphicsClass:GraphicsContext,TextClass:Text});
  for(const boss of [makeBoss(),makeBoss({pendingAttacks:[{attackId:'charge',tellStartTick:0,resolveTick:60,geometry:{type:'charge-lane',origin:{x:1600,y:1000}}}]})]){
    warning.update({boss,hero,view,project,tick:30,zoom:.9,bodyHeight:84});
    let polygons=0;
    for(const instruction of warning.graphics.instructions)for(const primitive of instruction.data.path.shapePath.shapePrimitives){
      if(primitive.shape.points){polygons++;assert.ok(primitive.shape.points.length >= 6);assert.ok(primitive.shape.points.every(Number.isFinite));}
    }
    assert.ok(polygons >= 3);
  }
  warning.dispose();
});

test('real HUD/touch/browser chrome extents are cached on tick, refreshed on resize/restart, and suppress tiny usable areas', () => {
  let reads=0;
  const documentRef={getElementById(){return {getBoundingClientRect(){reads++;return {height:190,bottom:200};}};}};
  const controlsRoot={querySelectorAll(){return [{getBoundingClientRect(){reads++;return {height:100,top:690};}}];}};
  const warning=createBossEdgeWarning({ContainerClass:Container,GraphicsClass:Graphics,TextClass:Text,documentRef,controlsRoot,touchEnabled:true,
    windowRef:{visualViewport:{width:414,height:850,offsetTop:0,offsetLeft:0}}});
  const args={boss:makeBoss({y:1800}),hero,view,project,tick:30,zoom:.9};
  let row=warning.update(args);assert.ok(row.visible);assert.ok(row.y+45 <= 682);assert.equal(reads,2);
  warning.update(args);assert.equal(reads,2);
  warning.update({...args,tick:90});assert.equal(reads,4);
  warning.reset();warning.update(args);assert.equal(reads,6);
  row=warning.update({...args,view:{width:414,height:300}});assert.equal(reads,8);assert.equal(row.visible,false);
  warning.dispose();
});
