import assert from 'node:assert/strict';
import test from 'node:test';
import {createStackedBoardView} from '../apps/stacked/src/render/board-view.mjs';
import {PIECE_CELLS,cellsFor,collides} from '../apps/portal/src/stacked-sim.mjs';
class Node { constructor(){this.children=[];this.visible=true;this.position={x:0,y:0,set:(x,y)=>Object.assign(this.position,{x,y})};this.scale={set(){}};} addChild(...nodes){this.children.push(...nodes);return nodes.at(-1);} destroy(){} }
class Graphics extends Node {clear(){this.fills=[];this.strokes=[];this.paints=[];return this;}rect(...bounds){this.bounds=bounds;return this;}roundRect(...bounds){this.bounds=bounds;return this;}fill(style){this.fills??=[];this.fills.push(style);this.paints??=[];this.paints.push({bounds:this.bounds,style});return this;}stroke(style){this.strokes??=[];this.strokes.push(style);return this;} }
class Text extends Node {constructor(){super();this.anchor={set(){}};} }
const make=ghostOutline=>createStackedBoardView({index:0,frame:'wide',ghostOutline,geometry:{PIECE_CELLS,cellsFor,collides},Container:Node,Graphics,Text});
const model=()=>({board:Array(240).fill(0),active:{kind:'T',rotation:0,x:3,y:17},queue:['I','O','S','Z','J'],hold:'L'});
const shown=layer=>layer.children.filter(n=>n.visible&&n.__stackedKind);
const body=cell=>cell.paints.find(p=>p.bounds[0]===0&&p.bounds[1]===0)?.style;
const bloom=cell=>cell.paints.find(p=>p.bounds[0]===-2&&p.bounds[1]===-2)?.style;
test('optional local ghost is hollow with a strong edge while active and locked pieces stay solid',()=>{
 const view=make(true),snapshot=model();snapshot.board[0]=1;const before=JSON.stringify(snapshot);view.present(snapshot);
 assert.equal(shown(view.layers.ghostLayer).length,4);assert.equal(shown(view.layers.activeLayer).length,4);assert.equal(shown(view.layers.stackLayer).length,1);
 for(const cell of shown(view.layers.ghostLayer)){assert.equal(body(cell),undefined,'outline has no solid jewel body');assert.equal(bloom(cell),undefined,'outline has no filled bloom');assert.equal(cell.fills.length,1);assert.ok(cell.fills[0].alpha<=.12);assert.ok(cell.strokes[0].alpha>=.75);assert.ok(cell.strokes[0].width>=2);}
 for(const layer of [view.layers.activeLayer,view.layers.stackLayer])for(const cell of shown(layer)){assert.equal(body(cell).alpha,1,'solid body stays opaque');assert.ok(bloom(cell).alpha>0&&bloom(cell).alpha<.1,'soft radiance is distinct from the body');}
 assert.equal(JSON.stringify(snapshot),before);view.destroy();
});
test('default solo ghost retains translucent landing bodies under its new jewel radiance',()=>{
 const view=make(undefined);view.present(model());assert.equal(shown(view.layers.ghostLayer).length,4);for(const cell of shown(view.layers.ghostLayer)){assert.equal(body(cell).alpha,.24);assert.ok(bloom(cell).alpha>0&&bloom(cell).alpha<body(cell).alpha);assert.ok(cell.strokes[0].alpha>0&&cell.strokes[0].alpha<.24);assert.ok(cell.strokes[0].width>=1);}for(const cell of shown(view.layers.activeLayer))assert.equal(body(cell).alpha,1);view.destroy();
});
test('outline keeps the same canonical landing cells and pooled visuals across repeated presentation',()=>{
 const solid=make(false),outline=make(true);
 const m=model();m.board[3]=1;m.board[4]=1;Object.freeze(m.board);Object.freeze(m.active);Object.freeze(m.queue);Object.freeze(m);const before=JSON.stringify(m);solid.present(m);outline.present(m);
 const positions=view=>shown(view.layers.ghostLayer).map(n=>[n.position.x,n.position.y]);assert.equal(positions(outline).length,4);assert.equal(positions(solid).length,4);assert.deepEqual(positions(outline),positions(solid));
 const allocated=outline.stats().poolAllocated;outline.present(m);assert.equal(outline.stats().poolAllocated,allocated);assert.equal(JSON.stringify(m),before);solid.destroy();outline.destroy();
});
