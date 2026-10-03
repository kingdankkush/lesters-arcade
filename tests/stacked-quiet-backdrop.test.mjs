import test from 'node:test';
import assert from 'node:assert/strict';
import {createQuietBackdrop} from '../apps/stacked/src/render/quiet-backdrop.mjs';
import {Container as PixiContainer,Graphics as PixiGraphics} from 'pixi.js';
class Node{constructor(){this.children=[];this.scale={set(){}};this.position={set(){}};}addChild(...items){this.children.push(...items);}destroy(){this.destroyed=true;}}
class Graphics extends Node{rect(){return this;}circle(){return this;}fill(){return this;}}
test('unsupported-GPU backdrop is bounded, still, respects Off and closes once',()=>{
 const layer=new Node(),view=createQuietBackdrop({layer,Container:Node,Graphics});
 const settings={video:{effectsIntensity:.7},accessibility:{reduceMotion:true}};
 const info=view.draw({width:414,height:896,settings});
 assert.equal(layer.children.length,1);assert.equal(view.resources.actualNodeCount(),6);
 assert.equal(info.available,false);assert.equal(info.signals.available,false);
 assert.equal(info.sceneName,'Quiet nebula');
 for(let i=0;i<1000;i++)assert.equal(view.draw({width:896,height:414,settings}),info);
 assert.equal(view.resources.actualNodeCount(),6);
 settings.video.effectsIntensity=0;view.draw({width:414,height:896,settings});assert.equal(layer.children[0].visible,false);
 view.destroy();view.destroy();assert.equal(view.resources.actualNodeCount(),0);
});
test('real Pixi releases every owned fallback geometry context',()=>{
 const layer=new PixiContainer(),view=createQuietBackdrop({layer,Container:PixiContainer,Graphics:PixiGraphics});
 const contexts=view.resources.root.children.map(child=>child.context);
 assert.equal(contexts.length,5);assert.ok(contexts.every(context=>!context.destroyed));
 view.destroy();assert.ok(contexts.every(context=>context.destroyed));layer.destroy();
});
