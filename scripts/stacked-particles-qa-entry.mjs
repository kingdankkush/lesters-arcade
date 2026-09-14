// Synthetic presentation fixture; excluded from the production build.
import {Application,Container,Graphics,Text} from 'pixi.js';
import {createStackedRenderer} from '../apps/stacked/src/render/renderer.mjs';
import {PIECE_CELLS,cellsFor,collides,createStackedRuntime} from '../apps/portal/src/stacked-sim.mjs';
import {defaultStackedSettings} from '../apps/portal/src/stacked-player-settings.mjs';
const app=new Application(),stage=document.querySelector('#stackedStage');
await app.init({resizeTo:stage,resolution:1,backgroundAlpha:0,preference:'webgl'});app.ticker.stop();stage.append(app.canvas);
const renderer=createStackedRenderer({app,stageElement:stage,geometry:{PIECE_CELLS,cellsFor,collides},Container,Graphics,Text});
const settings=defaultStackedSettings();settings.video.effectsIntensity=1;
const fresh=()=>({...structuredClone(createStackedRuntime({seed:45}).snapshot()),tick:1,active:{kind:'I',rotation:1,x:4,y:12},piecesSpawned:1});
let snapshot=fresh(),now=1000;
window.particleQa={
  scene(kind,{minimal=false,reduced=false,combo=0}={}) {
    renderer.resetEffects();settings.video.reducedEffects=minimal;settings.accessibility.reduceMotion=reduced;now+=3000;
    const before=fresh();
    if(typeof kind==='number') for(let y=0;y<kind;y++) for(let x=0;x<10;x++) if(x!==5)before.board[y*10+x]=(x+y)%7+1;
    renderer.frame(before,now,settings);
    snapshot={...before,tick:2,board:[...before.board],active:{...before.active}};
    if(typeof kind==='number') {snapshot.lines=kind;snapshot.piecesLocked=1;snapshot.piecesSpawned=2;snapshot.comboCount=combo;snapshot.score=kind*kind*300;snapshot.board.fill(0);snapshot.active={kind:'T',rotation:0,x:3,y:18};}
    else if(kind==='rotate')snapshot.active.rotation=0;
    else if(kind==='move')snapshot.active.x=5;
    else if(kind==='drop')snapshot.active.y=10;
    else if(kind==='lock'){snapshot.piecesLocked=1;snapshot.piecesSpawned=2;snapshot.hardDropCells=12;for(let y=0;y<4;y++)snapshot.board[y*10+5]=1;snapshot.active={kind:'T',rotation:0,x:3,y:18};}
    renderer.gameplay(before,snapshot,now,settings);now+=85;renderer.frame(snapshot,now,settings);
    return {...stage.dataset};
  },
  after(ms) {now+=ms;renderer.frame(snapshot,now,settings);return {...stage.dataset};},
  soak() {for(let i=0;i<3000;i++){const before=snapshot;snapshot={...before,tick:before.tick+1,lines:before.lines+4,piecesLocked:before.piecesLocked+1};now+=16.67;renderer.gameplay(before,snapshot,now,settings);renderer.frame(snapshot,now,settings);}return {...stage.dataset};},
  destroy(){renderer.destroy();app.destroy(true,{children:true});},
};
renderer.frame(snapshot,now,settings);
