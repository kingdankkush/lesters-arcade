import test from 'node:test';
import assert from 'node:assert/strict';
import { Container, RenderLayer } from 'pixi.js';
import { createWorldDepthLayer, worldDepthKey } from '../apps/hmh-reboot/src/world-depth.mjs';

test('an actor north of a building renders behind it and south renders in front',()=>{
  const layer=createWorldDepthLayer(RenderLayer),props=new Container(),actors=new Container();
  const house=new Container(),hero=new Container();props.addChild(house);actors.addChild(hero);
  house.zIndex=worldDepthKey(1700);hero.zIndex=worldDepthKey(1500);
  layer.attach(house,hero);layer.sortRenderLayerChildren();
  assert.deepEqual(layer.renderLayerChildren,[hero,house]);
  hero.zIndex=worldDepthKey(1900);layer.sortRenderLayerChildren();
  assert.deepEqual(layer.renderLayerChildren,[house,hero]);
  assert.equal(house.parent,props);assert.equal(hero.parent,actors,'sorting cannot change gameplay-owned scene hierarchy');
});
test('elevation and camera movement do not reverse world depth',()=>{
  assert.equal(worldDepthKey(1500),1500);
  assert.ok(worldDepthKey(1500,.1)>worldDepthKey(1500));
  assert.throws(()=>worldDepthKey(NaN),TypeError);
});
