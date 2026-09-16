import { computeLayout } from '../../../portal/src/stacked-layout.mjs';
import { createStackedBoardView } from './board-view.mjs';
import { createLayerStack } from './layers.mjs';
import { applyRootFit, fitRootToViewport } from './root-fit.mjs';
import { createStackedAtmosphere, STACKED_EPOCHS } from './atmosphere.mjs';
import { createGameplayFeedback } from './gameplay-feedback.mjs';
import { createBoardFeedback } from './board-feedback.mjs';
import { createBoardParticles, mobilePresentation } from './gameplay-particles.mjs';
import { createBoardPiecePresentation } from './piece-presentation.mjs';

export function createStackedRenderer({ app, stageElement, geometry, Container, Graphics, Text, onFrameReleased = () => {}, isMobile = () => mobilePresentation({width:globalThis.innerWidth,coarsePointer:globalThis.matchMedia?.('(pointer: coarse)').matches}) }) {
  const tree = createLayerStack({ stage: app.stage, Container, Graphics });
  let atmosphere=null, particles=null, pieceFx=null, mobile=null;
  const board = createStackedBoardView({ index: 0, cells: 10, rows: 24, frame: 'wide', geometry, Container, Graphics, Text, onFrameReleased });
  tree.boardSlots[0].addChild(board.root);
  const feedback = createGameplayFeedback(), accents = createBoardFeedback({board, Graphics, Text});
  const sharedHud = new Text({ text: 'RENDER-ONLY QA SCENE · AWAITING PARENT RUNTIME', style: { fill:'#9db4c8', fontFamily:'system-ui, sans-serif', fontSize:18, fontWeight:'700' } });
  sharedHud.anchor?.set?.(0.5);
  sharedHud.text='';
  tree.layers.layerHud.addChild(sharedHud);
  let disposed=false;
  let hasPresented=false;

  const resize = () => {
    if (disposed) return;
    const nextMobile=isMobile();
    if(nextMobile!==mobile) {
      mobile=nextMobile;
      atmosphere?.destroy(); atmosphere=null;
      atmosphere=createStackedAtmosphere({layer:tree.layers.layerParticleFar,Graphics,mobile});
      particles?.destroy(); particles=createBoardParticles({board,Graphics,geometry,mobile});
      // ST-N03 piece presentation (hold, level, ledger, perfect, top-out, danger, lock thud).
      pieceFx?.destroy(); pieceFx=createBoardPiecePresentation({board,Graphics,mobile});
      stageElement.dataset.mobileGameplay=String(mobile);
      stageElement.dataset.particleCapacity=String(particles.state.capacity);
      stageElement.dataset.pieceFxCapacity=String(pieceFx.state.capacity);
    }
    const fit=fitRootToViewport({ widthPx:app.canvas.width/app.renderer.resolution, heightPx:app.canvas.height/app.renderer.resolution });
    applyRootFit(tree.stackedRoot,fit);
    const [slot]=computeLayout({ viewportWidth:fit.logicalWidth, viewportHeight:fit.logicalHeight, boardCount:1, opponentMini:false });
    board.setFrame(slot.frame);
    tree.boardSlots[0].position.set(slot.x-fit.logicalWidth/2,slot.y-fit.logicalHeight/2);
    tree.boardSlots[0].scale.set(slot.scale,slot.scale);
    sharedHud.position.set(0,-fit.logicalHeight/2+28);
    stageElement.dataset.rootScale=String(fit.scale);
    if (hasPresented) app.render();
  };
  const present = snapshot => { if(disposed)throw new Error('renderer is disposed'); const stats=board.present(snapshot); stageElement.dataset.renderedCells=String(stats.lockedVisible+stats.activeVisuals+stats.ghostVisuals); hasPresented=true; app.render(); return stats; };
  const destroy = () => { if(disposed)return; disposed=true; app.renderer.off('resize',resize); atmosphere?.destroy(); particles?.destroy(); pieceFx?.destroy(); board.destroy(); tree.stackedRoot.destroy({children:true}); };
  app.renderer.on('resize',resize);
  resize();
  return Object.freeze({
    present, resize, destroy, board, tree,
    resetEffects:()=>{ particles.reset(); pieceFx?.reset(); },
    audio: (frame, now) => atmosphere?.audio(frame, now),
    gameplay(before, snapshot, now, settings) { feedback.update(snapshot, now, settings.accessibility.reduceMotion); particles.step(before,snapshot,now,settings); pieceFx?.step(before,snapshot,now,settings); },
    get mobile() { return mobile; },
    frame(snapshot, now, settings) {
      const fit = fitRootToViewport({ widthPx: app.canvas.width / app.renderer.resolution, heightPx: app.canvas.height / app.renderer.resolution });
      const response=feedback.update(snapshot, now, settings.accessibility.reduceMotion);
      const zone=STACKED_EPOCHS[Math.max(0,[0,10800,25200,43200,64800,90000].findLastIndex(tick=>snapshot.tick>=tick))];
      const info = atmosphere ? atmosphere.draw({ now, tick: snapshot.tick, lines: snapshot.lines, width: fit.logicalWidth, height: fit.logicalHeight, settings, feedback:response }) : {...zone,particles:0,available:false,phase:'off',generation:0,mode:'gameplay',visualizerName:'Gameplay effects',organisms:0};
      stageElement.dataset.visualizerPhase = info.phase;
      stageElement.dataset.visualizerGeneration = String(info.generation);
      stageElement.dataset.visualizerMode = info.mode;
      stageElement.dataset.feedback = response.labelAge < 2.2 ? response.label : '';
      board.layers.ghostLayer.visible = settings.video.ghostPiece;
      board.setGridLines(settings.video.gridLines);
      board.setColorblindPieces(settings.accessibility.colorblindPieces);
      board.layers.effectLayer.visible = !settings.accessibility.reduceMotion;
      board.setTrails(false);
      const sparks=particles.draw(now,settings);
      stageElement.dataset.gameplayParticles=String(sparks.count);
      stageElement.dataset.particleEvent=sparks.lastEvent;
      stageElement.dataset.clearTier=String(sparks.clearTier);
      stageElement.dataset.lockGlows=String(sparks.glows.filter(g=>g.active).length);
      stageElement.dataset.visualizerParticles=String(info.particles);
      stageElement.dataset.visualizerOrganisms=String(info.organisms);
      stageElement.dataset.particlesEmitted=String(sparks.emitted);
      const fx=pieceFx?pieceFx.draw(now,settings,response.danger):{count:0,lastEvent:'',shake:0};
      stageElement.dataset.pieceFx=String(fx.count);
      stageElement.dataset.pieceFxEvent=fx.lastEvent;
      stageElement.dataset.pieceFxShake=fx.shake.toFixed(2);
      accents.draw(response, info.color, settings);
      present(snapshot); return info;
    },
  });
}
