import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuthoredPropDisplay} from '../apps/hmh-reboot/src/authored-prop-display.mjs';
class Point {set(x,y=x){this.x=x;this.y=y;}}
class Container {constructor(){this.children=[];}addChild(...children){this.children.push(...children);}}
class Sprite {constructor({texture}){this.texture=texture;this.anchor=new Point();this.position=new Point();this.scale=new Point();}}
class Texture {constructor(options){Object.assign(this,options);}}
class Rectangle {constructor(x,y,width,height){Object.assign(this,{x,y,width,height});}}
class Graphics {clear(){return this;}}
function scene({painted=true,zoom=1,staticWorld=false}={}){
 const frame={assetId:'art-target-meadows-house',category:'environment',frame:{x:768,y:1536,w:768,h:768},anchor:{x:.5,y:.75},runtimeScale:.5,projectionY:2};
 if(painted)frame.alphaBounds={x:128,y:128,w:512,h:512};
 const placement={id:'test-house',assetId:frame.assetId,category:'environment',x:300,y:500,scale:1};
 const original=structuredClone({frame,placement});
 const display=createAuthoredPropDisplay({index:{frameById:new Map(),frameFor:()=>frame},atlasTexture:{source:{}},placements:[placement],ContainerClass:Container,SpriteClass:Sprite,TextureClass:Texture,RectangleClass:Rectangle,GraphicsClass:Graphics,staticWorld});
 const sprite=display.container.children.find(c=>c instanceof Sprite);
 return {draw(point){display.render({camera:{zoom},view:{width:800,height:900},queryGround:()=>({groundZ:0}),worldToScreen:p=>({x:p.x*zoom,y:(p.y-p.z)*zoom}),tick:1,focusPoints:[{x:point.x*zoom,y:point.y*zoom}],reduceMotion:true});assert.deepEqual({frame,placement},original);return sprite;}};
}
test('transparent card margins do not fade a house beside the actor',()=>{
 for(const staticWorld of [false,true])for(const zoom of [1,.5]){
  const s=scene({staticWorld,zoom});
  // Full card covers x108..492/y-76..692. Painted body covers172..428/52..564.
  for(const p of [{x:460,y:400},{x:140,y:400},{x:300,y:0},{x:300,y:640}]){
   const sprite=s.draw(p);assert.equal(sprite.visible,true);assert.equal(sprite.alpha,1,JSON.stringify({staticWorld,zoom,p}));
  }
 }
});
test('actual painted overlap still fades and recovers as focus leaves',()=>{
 for(const staticWorld of [false,true])for(const zoom of [1,.5]){
  const s=scene({staticWorld,zoom});assert.equal(s.draw({x:300,y:200}).alpha,.38);assert.equal(s.draw({x:600,y:400}).alpha,1);
 }
});
test('frames without measured alpha retain legacy full-card fading',()=>{
 const s=scene({painted:false});assert.equal(s.draw({x:460,y:400}).alpha,.38);assert.equal(s.draw({x:600,y:400}).alpha,1);
});
