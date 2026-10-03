import test from 'node:test';
import assert from 'node:assert/strict';
import { GraphicsContext } from 'pixi.js';
import { renderLiquidatorTelegraph } from '../apps/hmh-reboot/src/liquidator-telegraph-renderer.mjs';

class Recorder {
  calls = [];
  poly(...args) { this.calls.push(['poly', ...args]); return this; }
  cut() { this.calls.push(['cut']); return this; }
  circle(...args) { this.calls.push(['circle', ...args]); return this; }
  moveTo() { return this; } lineTo() { return this; }
  fill(style) { this.calls.push(['fill', style]); return this; }
  stroke(style) { this.calls.push(['stroke', style]); return this; }
}
const projection = ({x,y,z}) => ({x:x+13, y:y*.6-z});
const pending = (geometry) => ({attackId:'charge', geometry, groundZ:20, tellStartTick:100, resolveTick:160});
const draw = (geometry,tick,extra={}) => {
  const graphics = new Recorder();
  const event = pending(geometry), before = JSON.stringify(event);
  renderLiquidatorTelegraph({graphics,pending:event,tick,worldToScreen:projection,...extra});
  assert.equal(JSON.stringify(event),before,'render must not mutate the strike');
  return graphics.calls;
};

test('real Pixi paths retain both the soft rim and the strong boundary', () => {
  for (const geometry of [
    {type:'lane',origin:{x:0,y:0},target:{x:120,y:0},width:40},
    {type:'ring',center:{x:0,y:0},innerRadius:40,outerRadius:80},
  ]) {
    const graphics = new GraphicsContext();
    renderLiquidatorTelegraph({ graphics, pending:pending(geometry), tick:130, worldToScreen:projection });
    const strokes = graphics.instructions.filter(i=>i.action==='stroke');
    assert.ok(strokes.some(i=>i.data.style.width===8));
    assert.ok(strokes.some(i=>i.data.style.width===2.5));
    for (const instruction of strokes) assert.ok(instruction.data.path.instructions.some(i=>i.action==='poly'), 'empty consumed path');
    if (geometry.type==='ring') {
      assert.equal(graphics.instructions.filter(i=>i.action==='fill').length,1,'one fill replaces a page of annular segment instructions');
      assert.ok(graphics.instructions.find(i=>i.action==='fill').data.hole.instructions.some(i=>i.action==='poly'));
      assert.equal(graphics.instructions.length,5);
    }
    graphics.destroy();
  }
});

test('lanes show endpoint capsule danger and safe sectors cut the red floor out', () => {
  const shape={type:'lane',origin:{x:0,y:0},target:{x:120,y:0},width:40};
  const points=draw(shape,130).find(([op])=>op==='poly')[1];
  const xs=points.filter((_,i)=>i%2===0);
  assert.equal(Math.min(...xs),-7); assert.equal(Math.max(...xs),153);
  const graphics=new GraphicsContext();
  renderLiquidatorTelegraph({graphics,pending:pending({type:'safe-zones',zones:[{x:50,y:50}],radius:20}),tick:130,worldToScreen:projection,floor:{minX:0,minY:0,maxX:100,maxY:100}});
  const firstFill=graphics.instructions.find(i=>i.action==='fill');
  assert.ok(firstFill.data.hole.instructions.some(i=>i.action==='poly'),'danger cleared before green safe fill');
  graphics.destroy();
});

test('textured danger keeps a full stable boundary while its interior fills before the strike', () => {
  const shape = {type:'lane',origin:{x:0,y:0},target:{x:120,y:0},width:40};
  const texture = {};
  const early = draw(shape,100,{dangerTexture:texture});
  const late = draw(shape,160,{dangerTexture:texture});
  assert.equal(early.filter(([op])=>op==='poly').length,4);
  assert.deepEqual(early[0],late[0],'danger boundary never shrinks during windup');
  const span = (calls) => Math.max(...calls.filter(([op])=>op==='poly').at(-1)[1].filter((_,i)=>i%2===0))-Math.min(...calls.filter(([op])=>op==='poly').at(-1)[1].filter((_,i)=>i%2===0));
  assert.ok(span(late) > span(early));
  assert.equal(late.find(([op])=>op==='fill')[1].texture,texture);
  assert.ok(late.some(([op,style])=>op==='stroke' && style.width>=7 && style.alpha<.2),'soft broad rim');
});

test('circle danger follows ground projection and elevation instead of a screen-space circle', () => {
  const calls = draw({type:'circle',center:{x:100,y:200},radius:60},130);
  assert.equal(calls.some(([op])=>op==='circle'),false);
  const points = calls.find(([op])=>op==='poly')[1];
  const xs=points.filter((_,i)=>i%2===0),ys=points.filter((_,i)=>i%2===1);
  assert.equal(Math.min(...xs),53); assert.equal(Math.max(...xs),173);
  assert.equal(Math.min(...ys),64); assert.equal(Math.max(...ys),136);
});

test('ring danger never fills its safe hole and reduced flash caps fill intensity', () => {
  const shape={type:'ring',center:{x:0,y:0},innerRadius:40,outerRadius:80};
  const calls=draw(shape,160,{reduceFlash:true});
  assert.ok(calls.some(([op])=>op==='poly'));
  assert.equal(calls.filter(([op])=>op==='cut').length,1);
  for (const [op, points] of calls.filter(([op])=>op==='poly')) {
    assert.equal(op,'poly');
    for(let i=0;i<points.length;i+=2) assert.ok(Math.hypot(points[i]-13,(points[i+1]+20)/.6)>=40-1e-8);
  }
  assert.ok(calls.filter(([op])=>op==='fill').every(([,style])=>style.alpha<=.22));
});
