import { BOARD_VISIBLE_ROWS, CELL_PX, STACKED_FRAME_SIZES } from '../../../portal/src/stacked-contracts.mjs';

export const BOARD_LAYER_ORDER = Object.freeze(['wellFrame','stackLayer','garbageWarnLayer','ghostLayer','activeLayer','effectLayer','hudLayer']);
const COLORS = Object.freeze({ I:0x32d9ff, J:0x5688ff, L:0xffa447, O:0xffd84d, S:0x60e889, T:0xb66cff, Z:0xff6078, garbage:0x718092 });
const LOCKED_KIND_BY_ID = Object.freeze([null,'I','J','L','O','S','T','Z','garbage']);
const WELL_X = Object.freeze({ wide: 96, tall: 0 });

export function boardCellToAuthored({ x, y, frame }) {
  return Object.freeze({ x: WELL_X[frame] + x * CELL_PX, y: (BOARD_VISIBLE_ROWS - 1 - y) * CELL_PX, visible: y >= 0 && y < BOARD_VISIBLE_ROWS && x >= 0 && x < 10 });
}

function drawMino(graphic, { x, y, kind, alpha = 1, size = CELL_PX - 2 }) {
  graphic.clear().roundRect(1, 1, size, size, 5).fill({ color: COLORS[kind] ?? 0xa8bdca, alpha }).stroke({ color: 0xffffff, alpha: alpha * 0.32, width: 1 });
  graphic.position.set(x, y);
  graphic.__stackedKind = kind;
  graphic.__stackedColor = COLORS[kind] ?? 0xa8bdca;
  graphic.visible = true;
}

function createPool(Graphics) {
  const all=[]; let used=0;
  return {
    begin() { used=0; },
    acquire(parent) { const visual=all[used] ?? (()=>{const value=new Graphics(); all.push(value); parent.addChild(value); return value;})(); used++; visual.visible=true; return visual; },
    end() { for (let index=used; index<all.length; index++) all[index].visible=false; },
    reset() { used=0; for (const visual of all) visual.visible=false; },
    stats() { return { allocated: all.length, free: all.length-used }; },
    destroy() { for (const visual of all) visual.destroy?.(); all.length=0; used=0; },
  };
}

export function createStackedBoardView({ index, cells = 10, rows = 24, frame, geometry, Container, Graphics, Text, onFrameReleased = () => {}, onPresent = () => {} }) {
  if (!STACKED_FRAME_SIZES[frame] || cells !== 10 || rows !== 24) throw new RangeError('board view requires a 10x24 board and a known frame');
  if (!geometry?.PIECE_CELLS || typeof geometry.cellsFor !== 'function' || typeof geometry.collides !== 'function') throw new TypeError('board view requires canonical PIECE_CELLS, cellsFor and collides geometry');
  const kinds = Object.freeze(Object.keys(geometry.PIECE_CELLS));
  const root = new Container();
  const layers = Object.fromEntries(BOARD_LAYER_ORDER.map(name => [name, name === 'wellFrame' ? new Graphics() : new Container()]));
  root.addChild(...BOARD_LAYER_ORDER.map(name => layers[name]));
  let currentFrame = frame;
  const drawWellFrame = () => {
    const wellX = WELL_X[currentFrame];
    layers.wellFrame.clear().rect(wellX, 0, 320, 640).fill({ color: 0x071321, alpha: 1 }).stroke({ color: 0x35f2ff, alpha: 0.82, width: 2 });
    for (let column=1; column<10; column++) layers.wellFrame.rect(wellX+column*CELL_PX,0,1,640).fill({color:0x35f2ff,alpha:0.075});
    for (let row=1; row<BOARD_VISIBLE_ROWS; row++) layers.wellFrame.rect(wellX,row*CELL_PX,320,1).fill({color:0x35f2ff,alpha:0.075});
  };
  drawWellFrame();
  const stackPool=createPool(Graphics), activePool=createPool(Graphics), ghostPool=createPool(Graphics), previewPool=createPool(Graphics), trailPool=createPool(Graphics);
  const pools=[stackPool, activePool, ghostPool, previewPool, trailPool];
  let destroyed=false; let layout={ x:0,y:0,scale:1,visible:true }; let last=Object.freeze({ boardIndex:index, activeVisuals:0, poolAllocated:0, poolFree:0, lockedVisible:0, bufferClipped:0, trails:0 });
  let lastModel=null;

  const normalizePiece = piece => typeof piece === 'string' ? { kind:piece,rotation:0,x:0,y:0 } : piece;
  const pieceCells = piece => {
    const normalized=normalizePiece(piece);
    if (!normalized || !kinds.includes(normalized.kind) || !Number.isInteger(normalized.rotation ?? 0)) return [];
    const rotation=(normalized.rotation??0)&3;
    return geometry.cellsFor(normalized.kind,rotation,normalized.x??0,normalized.y??0);
  };

  const renderPiece = (piece, pool, parent, alpha) => {
    pool.begin(); let used=0;
    const normalized=normalizePiece(piece);
    for (const [x,y] of pieceCells(normalized)) {
      const point=boardCellToAuthored({ x, y, frame:currentFrame });
      if (!point.visible) continue;
      drawMino(pool.acquire(parent), { ...point, kind:normalized.kind, alpha }); used++;
    }
    pool.end(); return used;
  };
  const renderPreview = (piece, originX, originY, scale=0.55) => {
    const normalized=normalizePiece(piece);
    let used=0; for (const [x,y] of pieceCells(normalized)) { const visual=previewPool.acquire(layers.hudLayer); drawMino(visual,{ x:originX+x*CELL_PX*scale,y:originY-y*CELL_PX*scale,kind:normalized.kind,size:(CELL_PX-2)*scale }); used++; } return used;
  };
  const ghostFor = (board, active) => {
    const normalized=normalizePiece(active);
    if (pieceCells(normalized).length !== 4) return null;
    let y=normalized.y;
    while (!geometry.collides(board,geometry.cellsFor(normalized.kind,(normalized.rotation??0)&3,normalized.x,y-1))) y--;
    return { ...normalized, y };
  };
  const setModel = model => {
    if (destroyed) throw new Error('board view is destroyed');
    if (!Array.isArray(model?.board) || model.board.length !== cells*rows) throw new TypeError('snapshot board must be an ordinary 240-cell array');
    lastModel=model;
    stackPool.begin();
    let lockedVisible=0, bufferClipped=0;
    for (let position=0; position<model.board.length; position++) { const cell=model.board[position]; if (!cell) continue; const y=Math.floor(position/cells); if (y>=BOARD_VISIBLE_ROWS) { bufferClipped++; continue; } const kind=LOCKED_KIND_BY_ID[Number(cell)]; if(!kind)continue; const point=boardCellToAuthored({x:position%cells,y,frame:currentFrame}); drawMino(stackPool.acquire(layers.stackLayer),{...point,kind}); lockedVisible++; }
    const activeVisuals=renderPiece(model.active,activePool,layers.activeLayer,1);
    const ghostVisuals=renderPiece(ghostFor(model.board,model.active),ghostPool,layers.ghostLayer,0.24);
    previewPool.begin(); let previews=0;
    if (currentFrame==='wide') { previews+=renderPreview(model.hold,8,80); for (let i=0;i<Math.min(5,model.queue?.length??0);i++) previews+=renderPreview(model.queue[i],416,82+i*92,0.48); }
    else { previews+=renderPreview(model.hold,8,770,0.45); for (let i=0;i<Math.min(3,model.queue?.length??0);i++) previews+=renderPreview(model.queue[i],140+i*58,770,0.4); }
    const label = layers.hudLayer.children.find(child => child.__statsLabel) ?? (()=>{ const text=new Text({text:'',style:{fill:'#f5f7ff',fontFamily:'system-ui, sans-serif',fontSize:18,fontWeight:'700'}}); text.__statsLabel=true; layers.hudLayer.addChild(text); return text; })();
    label.text=`SCORE ${model.score??0}\nLEVEL ${model.level??model.startLevel??1}\nLINES ${model.lines??0}`; label.position.set(currentFrame==='wide'?408:8,currentFrame==='wide'?520:650);
    previewPool.end();
    trailPool.begin(); let trails=0;
    if (model.active) for (let step=1;step<=2;step++) for (const [x,y] of pieceCells(model.active)) { const point=boardCellToAuthored({x,y:y+step,frame:currentFrame}); if(point.visible){ drawMino(trailPool.acquire(layers.effectLayer),{...point,kind:model.active.kind,alpha:0.06,size:CELL_PX-5}); trails++; } }
    stackPool.end(); trailPool.end();
    const totals=pools.reduce((sum,pool)=>{const value=pool.stats();sum.allocated+=value.allocated;sum.free+=value.free;return sum;},{allocated:0,free:0});
    last=Object.freeze({boardIndex:index,activeVisuals,ghostVisuals,previewVisuals:previews,lockedVisible,bufferClipped,trails,poolAllocated:totals.allocated,poolFree:totals.free});
    return last;
  };
  const present = model => { const result=setModel(model); onPresent(result); onFrameReleased(result); return result; };
  const setFrame = nextFrame => { if(!STACKED_FRAME_SIZES[nextFrame])throw new RangeError('unknown board frame'); if(nextFrame===currentFrame)return last; currentFrame=nextFrame; drawWellFrame(); return lastModel?setModel(lastModel):last; };
  const resize = slot => { layout={...slot}; root.visible=slot.visible; root.scale.set(slot.scale,slot.scale); root.position.set(slot.x,slot.y); };
  const applyShake = (dx,dy) => root.position.set(layout.x+dx,layout.y+dy);
  const reset = () => { lastModel=null; for (const pool of pools) pool.reset(); last=Object.freeze({...last,activeVisuals:0,ghostVisuals:0,previewVisuals:0,lockedVisible:0,bufferClipped:0,trails:0,poolFree:pools.reduce((n,p)=>n+p.stats().free,0)}); };
  const destroy = () => { if (destroyed) return; destroyed=true; lastModel=null; for(const pool of pools)pool.destroy(); root.destroy?.({children:true}); };
  return Object.freeze({ root, layers:Object.freeze(layers), setFrame, setModel, present, setZone:()=>{}, applyShake, resize, reset, stats:()=>last, destroy });
}

export const createBoardView = createStackedBoardView;
