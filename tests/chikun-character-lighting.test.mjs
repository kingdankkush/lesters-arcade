import test from 'node:test';
import assert from 'node:assert/strict';
import {createChikunCharacterLighting,chikunCharacterLightStyle} from '../apps/chikun/src/character-lighting.mjs';
test('character follows a restrained environment grade and bounded local rim',()=>{
 const style=chikunCharacterLightStyle({grade:{W:[236,142,66],w:.3,D:[16,24,58],a:.52},rim:[170,200,255],rimAlpha:.45});
 assert.ok(style.warmAlpha<=.15&&style.darkAlpha<=.24);assert.ok(style.rimAlpha<=.26);assert.equal(style.blur,3);
 assert.equal(chikunCharacterLightStyle(null).rimAlpha,0);
});
test('light layer owns one bounded canvas and never recolours the retained pose',()=>{
 const calls=[];const cx={clearRect(...a){calls.push(['clear',...a]);},drawImage(...a){calls.push(['draw',...a]);},fillRect(...a){calls.push(['fill',...a]);}};let made=0;
 const lighting=createChikunCharacterLighting({makeCanvas:()=>{made++;return {width:0,height:0,getContext:()=>cx};}}),source=Object.freeze({width:192,height:192});
 const rig={grade:{W:[255,184,160],w:.18,D:[16,24,58],a:.52},rim:[170,200,255],rimAlpha:.45};
 const first=lighting.imageFor(source,rig);assert.notEqual(first,source);assert.equal(first.width,192);assert.equal(first.height,192);assert.equal(lighting.imageFor(source,rig),first);assert.equal(made,1);assert.ok(calls.some(c=>c[0]==='draw'&&c[1]===source));assert.deepEqual(source,{width:192,height:192});
 assert.equal(lighting.imageFor(source,null),source);lighting.dispose();assert.equal(first.width,0);assert.equal(first.height,0);
});
