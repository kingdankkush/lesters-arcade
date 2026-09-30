import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorldDesignLife} from '../apps/hmh-reboot/src/world-design-life.mjs';
import {createMissionState, MISSION_OBJECTIVES} from '../apps/hmh-reboot/src/mission-objectives.mjs';

class Graphics {
  constructor(){this.commands=[];}
  clear(){this.commands=[];return this;}
}
for(const name of ['circle','rect','roundRect','moveTo','lineTo','stroke','fill'])
  Graphics.prototype[name]=function(...args){this.commands.push([name,...args]);return this;};
class Container {constructor(){this.children=[];}addChild(...children){this.children.push(...children);}}
class Text {constructor(){this.anchor={set(){}};this.position={set(){}};this.style={};this.visible=false;}}
function draw(view,dx,dy){
  const target=MISSION_OBJECTIVES.find(row=>row.id==='ravine-winch-handle').anchor;
  const actor={x:target.x-dx,y:target.y-dy,groundZ:0},mission=createMissionState(1),before=structuredClone(mission);
  const life=createWorldDesignLife({ContainerClass:Container,GraphicsClass:Graphics,TextClass:Text});
  life.render({mission,actor,view,camera:{zoom:1},tick:10,queryGround:()=>({groundZ:0}),
    worldToScreen:p=>({x:p.x-actor.x+view.width/2,y:p.y-actor.y+view.height/2-(p.z??0)}),
    guidance:{districtId:'rugpull-ravine'}});
  assert.deepEqual(mission,before,'drawing guidance cannot change mission state');
  return {commands:life.overlay.children[1].commands,text:life.overlay.children[3].text};
}
test('overlapping edge pointers leave the tracker instruction and inline direction legible',()=>{
  for(const [view,dy,arrow] of [[{width:1440,height:900},1680,'↓'],[{width:414,height:896},1680,'↓'],[{width:900,height:420},-1680,'↑']]){
    const result=draw(view,0,dy);
    assert.ok(result.text.endsWith(arrow),'the inline bearing remains visible');
    assert.equal(result.commands.some(c=>c[0]==='moveTo'),false,JSON.stringify(view)+' pointer crosses its instruction');
    assert.ok(result.commands.some(c=>c[0]==='roundRect'),'keep the instruction panel');
  }
});
test('pointers with room beside the tracker remain visible and on-screen targets need none',()=>{
  const view={width:414,height:896};
  for(const dx of [-1680,1680]){
    const result=draw(view,dx,0);
    assert.ok(result.commands.some(c=>c[0]==='moveTo'));
    assert.ok(result.text.endsWith(dx<0?'←':'→'));
  }
  assert.equal(draw(view,0,0).commands.some(c=>c[0]==='moveTo'),false);
});
