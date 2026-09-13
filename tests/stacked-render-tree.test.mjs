import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createLayerStack, LAYER_ORDER } from '../apps/stacked/src/render/layers.mjs';
import { boardCellToAuthored, createStackedBoardView } from '../apps/stacked/src/render/board-view.mjs';
import { PIECE_CELLS, cellsFor, collides, createStackedRuntime } from '../apps/portal/src/stacked-sim.mjs';
import { CELL_PX } from '../apps/portal/src/stacked-contracts.mjs';

class Node {
  constructor() { this.children=[]; this.visible=true; this.position={ x:0,y:0,set:(x,y)=>{this.position.x=x;this.position.y=y;} }; this.scale={ x:1,y:1,set:(x,y=x)=>{this.scale.x=x;this.scale.y=y;} }; }
  addChild(...children) { this.children.push(...children); return children.at(-1); }
  removeChildren() { return this.children.splice(0); }
  destroy(options = {}) { this.destroyed=true; if (options.children) { for (const child of this.children) child.destroy?.({ children: true }); this.children=[]; } }
}
class Graphics extends Node { clear(){return this;} rect(){return this;} roundRect(){return this;} fill(){return this;} stroke(){return this;} }
class Text extends Node { constructor({ text='' }={}) { super(); this.text=text; this.anchor={set(){}}; } }

const constructors = { Container: Node, Graphics, Text };
const canonicalGeometry = Object.freeze({ PIECE_CELLS, cellsFor, collides });
const visibleFootprint = layer => layer.children
  .filter(child => child.visible && child.__stackedKind)
  .map(child => [child.position.x, child.position.y])
  .sort((left, right) => left[0] - right[0] || left[1] - right[1]);
const snapshot = () => ({
  board: Array.from({ length: 240 }, () => 0),
  active: { kind: 'T', rotation: 0, x: 3, y: 17 },
  queue: ['I','O','S','Z','J'], hold: 'L', score: 1200, level: 3, lines: 8,
});

test('one stage child owns six ordered layers and a hidden second-board seam', () => {
  const stage = new Node();
  const tree = createLayerStack({ stage, ...constructors });
  assert.equal(stage.children.length, 1);
  assert.equal(stage.children[0], tree.stackedRoot);
  assert.deepEqual(tree.stackedRoot.children, LAYER_ORDER.map(name => tree.layers[name]));
  assert.equal(tree.boardSlots.length, 2);
  assert.equal(tree.boardSlots[1].visible, false);
  assert.equal(tree.boardSlots[1].children.length, 0);
  assert.equal(Object.isFrozen(LAYER_ORDER), true);
});

test('board maps y-up rows, clips buffer rows, pools visuals and never mutates snapshots', () => {
  const view = createStackedBoardView({ index: 0, rows: 24, cells: 10, frame: 'wide', geometry: canonicalGeometry, ...constructors });
  assert.deepEqual(boardCellToAuthored({ x: 0, y: 0, frame: 'wide' }), { x: 96, y: 608, visible: true });
  assert.equal(boardCellToAuthored({ x: 0, y: 20, frame: 'wide' }).visible, false);
  const model = snapshot(); model.board[0] = 1; model.board[239] = 2;
  const before = JSON.stringify(model);
  const first = view.setModel(model);
  assert.equal(JSON.stringify(model), before);
  assert.equal(first.lockedVisible, 1);
  assert.equal(first.bufferClipped, 1);
  const allocated = first.poolAllocated;
  model.board[0] = 0;
  const second = view.setModel(model);
  assert.equal(second.poolAllocated, allocated);
  assert(second.poolFree >= 1);
  assert.equal(view.layers.ghostLayer.children.length > 0, true);
  assert.equal(view.layers.hudLayer.children.length > 0, true);
});

test('board callbacks, frame-released stats, reset and disposal are honest', () => {
  const releases=[]; const presents=[];
  const view = createStackedBoardView({ index: 1, rows: 24, cells: 10, frame: 'tall', geometry: canonicalGeometry, ...constructors,
    onFrameReleased: stats => releases.push(stats), onPresent: stats => presents.push(stats) });
  const stats = view.present(snapshot());
  assert.equal(Object.isFrozen(stats), true);
  assert.equal(releases.length, 1); assert.equal(presents.length, 1);
  view.resize({ x: 11, y: 12, scale: 2, visible: true });
  view.applyShake(3, -2);
  assert.deepEqual([view.root.position.x, view.root.position.y], [14,10]);
  view.reset();
  assert.equal(view.stats().activeVisuals, 0);
  view.destroy();
  assert.throws(() => view.present(snapshot()), /destroyed/u);
});

test('reset invalidates the previous snapshot across a frame change', () => {
  const view = createStackedBoardView({ index: 0, rows: 24, cells: 10, frame: 'wide', geometry: canonicalGeometry, ...constructors });
  view.present(snapshot());
  view.reset();
  view.setFrame('tall');
  assert.equal(view.stats().activeVisuals, 0, 'resize must not resurrect the previous run');
  assert.equal(view.stats().ghostVisuals, 0);
  assert.equal(view.layers.activeLayer.children.some(child => child.visible), false);
  assert.equal(view.layers.hudLayer.children.some(child => child.visible && child.__stackedKind), false);
  view.destroy();
});

test('destroy disposes every owned descendant, including frame and HUD text', () => {
  const view = createStackedBoardView({ index: 0, rows: 24, cells: 10, frame: 'wide', geometry: canonicalGeometry, ...constructors });
  view.present(snapshot());
  const descendants = [];
  const collect = node => { descendants.push(node); node.children.forEach(collect); };
  collect(view.root);
  view.destroy();
  assert(descendants.every(node => node.destroyed === true), 'detached frame, layer and Text nodes must not escape destruction');
  assert.doesNotThrow(() => view.destroy(), 'disposal remains idempotent');
});

test('raw canonical runtime snapshots drive active rotation and collision-derived ghost geometry', () => {
  const runtime = createStackedRuntime({ seed: 0x51a2 });
  runtime.step(16);
  const model = runtime.snapshot();
  assert.equal(Object.hasOwn(model.active, 'cells'), false, 'canonical snapshots do not carry renderer-shaped cells');
  assert.equal(Object.hasOwn(model, 'ghost'), false, 'canonical snapshots do not carry a renderer-shaped ghost');
  const before = JSON.stringify(model);
  const view = createStackedBoardView({ index: 0, rows: 24, cells: 10, frame: 'wide', geometry: canonicalGeometry, ...constructors });
  const stats = view.present(model);
  const expectedActive = cellsFor(model.active.kind, model.active.rotation, model.active.x, model.active.y)
    .filter(([, y]) => y < 20)
    .map(([x, y]) => {
      const point = boardCellToAuthored({ x, y, frame: 'wide' });
      return [point.x, point.y];
    })
    .sort((left, right) => left[0] - right[0] || left[1] - right[1]);
  let ghostY = model.active.y;
  while (!collides(model.board, cellsFor(model.active.kind, model.active.rotation, model.active.x, ghostY - 1))) ghostY--;
  const expectedGhost = cellsFor(model.active.kind, model.active.rotation, model.active.x, ghostY)
    .map(([x, y]) => {
      const point = boardCellToAuthored({ x, y, frame: 'wide' });
      return [point.x, point.y];
    })
    .sort((left, right) => left[0] - right[0] || left[1] - right[1]);
  assert.deepEqual(visibleFootprint(view.layers.activeLayer), expectedActive);
  assert.deepEqual(visibleFootprint(view.layers.ghostLayer), expectedGhost);
  assert.equal(stats.ghostVisuals, 4);
  assert.equal(JSON.stringify(model), before, 'projection must not mutate a canonical runtime snapshot');
});

test('every canonical kind and rotation reaches active, ghost, hold and queue projection', () => {
  const view = createStackedBoardView({ index: 0, rows: 24, cells: 10, frame: 'wide', geometry: canonicalGeometry, ...constructors });
  const board = Array.from({ length: 240 }, () => 0);
  for (const kind of Object.keys(PIECE_CELLS)) {
    for (let rotation = 0; rotation < 4; rotation++) {
      board.fill(0);
      board['IJLOSTZ'.indexOf(kind)] = 'IJLOSTZ'.indexOf(kind) + 1;
      const model = {
        board,
        active: { kind, rotation, x: 3, y: 12 },
        hold: { kind, rotation },
        queue: [{ kind, rotation }],
        score: 0,
        level: 1,
        lines: 0,
      };
      view.present(model);
      const expectedActive = cellsFor(kind, rotation, 3, 12)
        .map(([x, y]) => {
          const point = boardCellToAuthored({ x, y, frame: 'wide' });
          return [point.x, point.y];
        })
        .sort((left, right) => left[0] - right[0] || left[1] - right[1]);
      assert.deepEqual(visibleFootprint(view.layers.activeLayer), expectedActive, `${kind} rotation ${rotation} active footprint`);
      let ghostY = 12;
      while (!collides(board, cellsFor(kind, rotation, 3, ghostY - 1))) ghostY--;
      const expectedGhost = cellsFor(kind, rotation, 3, ghostY)
        .map(([x, y]) => {
          const point = boardCellToAuthored({ x, y, frame: 'wide' });
          return [point.x, point.y];
        })
        .sort((left, right) => left[0] - right[0] || left[1] - right[1]);
      assert.deepEqual(visibleFootprint(view.layers.ghostLayer), expectedGhost, `${kind} rotation ${rotation} ghost footprint`);
      const previews=view.layers.hudLayer.children.filter(child => child.visible && child.__stackedKind === kind);
      assert.equal(previews.length, 8, `${kind} rotation ${rotation} hold/queue identity`);
      const expectedHold=PIECE_CELLS[kind][rotation].map(([x,y])=>[8+x*CELL_PX*0.55,80-y*CELL_PX*0.55]);
      const expectedQueue=PIECE_CELLS[kind][rotation].map(([x,y])=>[416+x*CELL_PX*0.48,82-y*CELL_PX*0.48]);
      assert.deepEqual(previews.slice(0,4).map(child=>[child.position.x,child.position.y]),expectedHold,`${kind} rotation ${rotation} hold footprint`);
      assert.deepEqual(previews.slice(4).map(child=>[child.position.x,child.position.y]),expectedQueue,`${kind} rotation ${rotation} queue footprint`);
      const identityVisuals=[
        view.layers.stackLayer.children.find(child=>child.visible&&child.__stackedKind===kind),
        view.layers.activeLayer.children.find(child=>child.visible),
        view.layers.ghostLayer.children.find(child=>child.visible),
        previews[0],
      ];
      assert.equal(identityVisuals.every(visual=>visual?.__stackedKind===kind),true,`${kind} identity must agree across locked/active/ghost/preview`);
      assert.equal(new Set(identityVisuals.map(visual=>visual.__stackedColor)).size,1,`${kind} color must agree across locked/active/ghost/preview`);
    }
  }
});

test('locked ids 1..7 map to I,J,L,O,S,T,Z and 8 maps to garbage without modulo aliases', () => {
  const view = createStackedBoardView({ index: 0, rows: 24, cells: 10, frame: 'wide', geometry: canonicalGeometry, ...constructors });
  const board = Array.from({ length: 240 }, () => 0);
  for (let id = 1; id <= 8; id++) board[id - 1] = id;
  const stats = view.present({ board, active: null, hold: null, queue: [] });
  assert.equal(stats.lockedVisible, 8);
  assert.deepEqual(
    view.layers.stackLayer.children.filter(child => child.visible).map(child => child.__stackedKind),
    ['I', 'J', 'L', 'O', 'S', 'T', 'Z', 'garbage'],
  );
});

test('render modules preserve the projection firewall and forbidden singleton rules', async () => {
  for (const path of ['../apps/stacked/src/render/layers.mjs','../apps/stacked/src/render/board-view.mjs']) {
    const source = await readFile(new URL(path, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /stacked-sim|app\.screen|window\.innerWidth|devicePixelRatio|boardIndex\s*===\s*0|sortableChildren/u);
  }
});
