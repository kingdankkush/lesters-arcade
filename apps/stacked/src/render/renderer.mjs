import {createPresentationAtmosphere} from './living-journey-loader.mjs';
import { computeLayout } from '../../../portal/src/stacked-layout.mjs';
import { createStackedBoardView } from './board-view.mjs';
import { createLayerStack } from './layers.mjs';
import { applyRootFit, fitRootToViewport } from './root-fit.mjs';
import { STACKED_EPOCHS } from './atmosphere.mjs';
import { createQuietBackdrop } from './quiet-backdrop.mjs';
import { createGameplayFeedback } from './gameplay-feedback.mjs';
import { createBoardFeedback } from './board-feedback.mjs';
import { createBoardParticles, mobilePresentation } from './gameplay-particles.mjs';
import { createBoardPiecePresentation } from './piece-presentation.mjs';
import { createBoardPulse } from './board-pulse.mjs';
import { piecePaletteFor, sceneGradeFor } from './cosmetic-palettes.mjs';
import { createActiveInterpolation } from './active-interpolation.mjs';
import { createBoardMotionView } from './board-motion.mjs';
import { PIECE_COLORS } from './board-view.mjs';
import { createVisualizerGovernor, deviceStartTier } from './visualizer-governor.mjs';

export function createStackedRenderer({ app, stageElement, geometry, Container, Graphics, Text, onFrameReleased = () => {}, startTier = deviceStartTier, createAtmosphere = createQuietBackdrop, isMobile = () => mobilePresentation({width:globalThis.innerWidth,coarsePointer:globalThis.matchMedia?.('(pointer: coarse)').matches}) }) {
  const tree = createLayerStack({ stage: app.stage, Container, Graphics });
  let atmosphere=null, particles=null, pieceFx=null, mobile=null, atmosphereFactory=createAtmosphere;
  const board = createStackedBoardView({ index: 0, cells: 10, rows: 24, frame: 'wide', geometry, Container, Graphics, Text, onFrameReleased });
  tree.boardSlots[0].addChild(board.root);
  const feedback = createGameplayFeedback(), accents = createBoardFeedback({board, Graphics, Text});
  // Music-reactive board: frame ring and active-piece halo (owner direction 2026-09-16).
  const pulse = createBoardPulse({ board, Graphics, geometry });
  // Sub-tick travel of the active piece between the tick snapshots gameplay() sees (projection only).
  const interpolation = createActiveInterpolation({ geometry });
  // Lock-thud spring, trauma shake and cleared-row squash on the board container (projection only).
  const motion = createBoardMotionView({ board, Graphics, geometry });
  // FPS watchdog: caps the music-scene tier (full -> standard -> calm) before it touches resolution.
  const governor = createVisualizerGovernor({ startTier: typeof startTier === 'function' ? startTier() : startTier });
  const baseResolution = app.renderer.resolution;
  let renderScale = 1;
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
      atmosphere=createPresentationAtmosphere(atmosphereFactory,{layer:tree.layers.layerParticleFar,sceneLayer:tree.layers.layerBackdrop,renderer:app.renderer,Container,Graphics,Text,mobile},{fallback:createQuietBackdrop,onFallback:error=>{atmosphereFactory=createQuietBackdrop;stageElement.dataset.livingJourneyStatus='fallback';stageElement.dataset.livingJourneyReason=String(error?.message??'unsupported graphics');}});
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
  const destroy = () => { if(disposed)return; disposed=true; app.renderer.off('resize',resize); atmosphere?.destroy(); particles?.destroy(); pieceFx?.destroy(); pulse.destroy(); motion.destroy(); board.destroy(); tree.stackedRoot.destroy({children:true}); };
  app.renderer.on('resize',resize);
  resize();
  return Object.freeze({
    present, resize, destroy, board, tree,
    resetEffects:()=>{ particles.reset(); pieceFx?.reset(); motion.reset(); interpolation.reset(); board.setActiveOffset(0,0); },
    audio: (frame, now) => atmosphere?.audio(frame, now),
    nextScene: () => atmosphere?.nextScene(),
    gameplay(before, snapshot, now, settings) { interpolation.step(before, snapshot); feedback.update(snapshot, now, settings.accessibility.reduceMotion); particles.step(before,snapshot,now,settings); pieceFx?.step(before,snapshot,now,settings); motion.step(before,snapshot,now,settings); },
    get mobile() { return mobile; },
    // alpha = accumulator / TICK_MS from the frame loop (0..1); callers that omit it render the tick state.
    frame(snapshot, now, settings, alpha = 1) {
      const fit = fitRootToViewport({ widthPx: app.canvas.width / app.renderer.resolution, heightPx: app.canvas.height / app.renderer.resolution });
      const response=feedback.update(snapshot, now, settings.accessibility.reduceMotion);
      governor.sample(now);
      if (governor.resolutionScale !== renderScale) { renderScale = governor.resolutionScale; app.renderer.resolution = baseResolution * renderScale; resize(); }
      const scene = governor.cap(settings);
      stageElement.dataset.visualizerTier = governor.tier;
      stageElement.dataset.renderScale = String(renderScale);
      const zone=STACKED_EPOCHS[Math.max(0,[0,10800,25200,43200,64800,90000].findLastIndex(tick=>snapshot.tick>=tick))];
      const info = atmosphere ? atmosphere.draw({ now, tick: snapshot.tick, lines: snapshot.lines, width: fit.logicalWidth, height: fit.logicalHeight, settings: scene, feedback:response }) : {...zone,particles:0,available:false,phase:'off',generation:0,mode:'gameplay',visualizerName:'Gameplay effects',organisms:0,scene:'off',sceneName:'Off',sceneTransitions:0,signals:null,palette:null};
      stageElement.dataset.visualizerPhase = info.phase;
      stageElement.dataset.visualizerGeneration = String(info.generation);
      stageElement.dataset.visualizerMode = info.mode;
      stageElement.dataset.visualizerScene = info.scene;
      stageElement.dataset.sceneTransitions = String(info.sceneTransitions);
      if(info.journeyVersion){stageElement.dataset.journeyDistance=String(info.journeyDistance);stageElement.dataset.portalRadius=String(info.portalRadius);}
      stageElement.dataset.feedback = response.labelAge < 2.2 ? response.label : '';
      board.layers.ghostLayer.visible = settings.video.ghostPiece;
      board.setGridLines(settings.video.gridLines);
      board.setColorblindPieces(settings.accessibility.colorblindPieces);
      // Unlockable looks (contract §7.9): piece palette and backdrop grade, presentation only.
      board.setPalette(piecePaletteFor(settings));
      tree.layers.layerBackdrop.tint = tree.layers.layerParticleFar.tint = sceneGradeFor(settings);
      board.layers.effectLayer.visible = !settings.accessibility.reduceMotion;
      board.setTrails(false);
      // Active-piece travel toward this tick's cell; whole-tick steps under reduced motion.
      const travel = interpolation.offset(snapshot, alpha, !settings.accessibility.reduceMotion);
      board.setActiveOffset(travel.x, travel.y);
      const sparks=particles.draw(now,settings);
      stageElement.dataset.gameplayParticles=String(sparks.count);
      stageElement.dataset.particleEvent=sparks.lastEvent;
      stageElement.dataset.clearTier=String(sparks.clearTier);
      stageElement.dataset.lockGlows=String(sparks.glows.filter(g=>g.active).length);
      stageElement.dataset.visualizerParticles=String(info.particles);
      stageElement.dataset.visualizerOrganisms=String(info.organisms);
      stageElement.dataset.particlesEmitted=String(sparks.emitted);
      const fx=pieceFx?pieceFx.draw(now,settings,response.danger):{count:0,lastEvent:''};
      stageElement.dataset.pieceFx=String(fx.count);
      stageElement.dataset.pieceFxEvent=fx.lastEvent;
      const moved=motion.draw(now,settings,piecePaletteFor(settings)??PIECE_COLORS);
      stageElement.dataset.pieceFxShake=moved.y.toFixed(2);
      stageElement.dataset.boardTrauma=moved.trauma.toFixed(2);
      stageElement.dataset.rowSquash=String(moved.squashing);
      accents.draw(response, info.color, settings);
      const beatFrame=pulse.draw({ settings, signals: info.signals ?? undefined, palette: info.palette ?? undefined, snapshot });
      stageElement.dataset.boardPulse=beatFrame.enabled?beatFrame.frame.toFixed(3):'0';
      present(snapshot); return info;
    },
  });
}
