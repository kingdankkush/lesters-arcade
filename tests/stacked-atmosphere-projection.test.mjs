import test from 'node:test';
import assert from 'node:assert/strict';
import {createStackedAtmosphere} from '../apps/stacked/src/render/atmosphere.mjs';
import {defaultStackedSettings} from '../apps/portal/src/stacked-player-settings.mjs';
import {Container,Graphics} from './lib/stacked-pixi-test-fixture.mjs';
const make=project=>{const layer=new Container();return{layer,view:createStackedAtmosphere({layer,Graphics,mobile:true,project})};};
const transforms=layer=>layer.children.map(node=>[node.position.x,node.position.y,node.scale.x,node.scale.y,node.rotation,node.alpha,node.visible,node.tint]);
const frame=settings=>({now:17,tick:0,lines:0,width:900,height:700,settings});
test('default and an identity projection retain identical existing atmosphere geometry',()=>{
  const settings=defaultStackedSettings(),plain=make(),identity=make(shapes=>shapes);
  assert.deepEqual(plain.view.draw(frame(settings)),identity.view.draw(frame(settings)));
  assert.deepEqual(transforms(plain.layer),transforms(identity.layer));plain.view.destroy();identity.view.destroy();
});
test('projection affects actual dots, links and webs without changing the owned source shapes',()=>{
  let original,returned,calls=0;
  const setup=make((shapes,context)=>{calls++;assert.equal(context.width,900);assert.equal(context.height,700);assert.equal(context.mode,'living');original={x:shapes.x.slice(),y:shapes.y.slice(),shapes};returned={x:Float32Array.from(shapes.x,x=>x+123),y:Float32Array.from(shapes.y,y=>y-47)};return returned;});
  setup.view.draw(frame(defaultStackedSettings()));assert.equal(calls,1);
  assert.deepEqual(original.shapes.x,original.x);assert.deepEqual(original.shapes.y,original.y);
  const dots=setup.layer.children.filter(node=>node.commands?.some(command=>command[0]==='circle'&&command[3]===3));
  assert.equal(dots.length,432);assert.equal(dots[0].position.x,returned.x[0]);assert.equal(dots[0].position.y,returned.y[0]);
  assert.ok(setup.layer.children.filter(node=>node.commands?.[0]?.[0]==='rect').some(node=>node.visible&&node.position.x===returned.x[0]));setup.view.destroy();
});
test('undersized or non-finite projected buffers reject before any render transform writes',()=>{
  for(const result of[{x:[],y:[]},{x:new Float32Array(432).fill(NaN),y:new Float32Array(432)}]) {
    const setup=make(()=>result),before=transforms(setup.layer);
    assert.throws(()=>setup.view.draw(frame(defaultStackedSettings())),/projection/);assert.deepEqual(transforms(setup.layer),before);setup.view.destroy();
  }
});
