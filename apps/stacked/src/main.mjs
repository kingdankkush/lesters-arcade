import { Application, Container, Graphics, Text } from 'pixi.js';
import { PIECE_CELLS, cellsFor, collides } from '../../portal/src/stacked-sim.mjs';
import { createStackedRenderer } from './render/renderer.mjs';

const stageElement = document.querySelector('#stackedStage');
const statusElement = document.querySelector('#stackedStatus');

if (!(stageElement instanceof HTMLElement) || !(statusElement instanceof HTMLElement)) {
  throw new Error('STACKED shell is missing its required stage or status element');
}

async function boot() {
  const app = new Application();
  await app.init({ resizeTo: stageElement, background: '#05070f', antialias: true, autoDensity: true, preference:'webgl', powerPreference:'high-performance' });
  app.ticker.stop();
  app.canvas.tabIndex=0;
  app.canvas.setAttribute('aria-label','STACKED render-only board preview');
  stageElement.replaceChildren(app.canvas,statusElement);
  const renderer=createStackedRenderer({app,stageElement,geometry:Object.freeze({PIECE_CELLS,cellsFor,collides}),Container,Graphics,Text});
  // Presentation-only fixture: it cannot produce input, results, Ranked writes, profile writes or evidence.
  const board=Array.from({length:240},()=>0);
  for(let x=0;x<10;x++){if(x!==4)board[x]=x%7+1;}
  for(let x=0;x<10;x++){if(x<2||x>6)board[10+x]=(x+2)%7+1;}
  board[9]=8;
  const renderOnlyFixture=Object.freeze({board:Object.freeze(board),active:Object.freeze({kind:'T',rotation:1,x:3,y:15}),queue:Object.freeze(['I','O','S','Z','J']),hold:'L',score:0,level:1,lines:0});
  renderer.present(renderOnlyFixture);
  stageElement.dataset.assetsReady = 'true';
  stageElement.dataset.simulationTick = '0';
  stageElement.dataset.fixture='render-only';
  statusElement.textContent = 'STACKED board renderer loaded with a render-only QA fixture. Awaiting parent runtime; gameplay is not connected.';
}

boot().catch((error) => {
  statusElement.textContent = `STACKED renderer failed to load: ${error.message}`;
  throw error;
});
