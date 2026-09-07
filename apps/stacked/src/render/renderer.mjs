import { computeLayout } from '../../../portal/src/stacked-layout.mjs';
import { createStackedBoardView } from './board-view.mjs';
import { createLayerStack } from './layers.mjs';
import { applyRootFit, fitRootToViewport } from './root-fit.mjs';

export function createStackedRenderer({ app, stageElement, geometry, Container, Graphics, Text, onFrameReleased = () => {} }) {
  const tree = createLayerStack({ stage: app.stage, Container, Graphics });
  const board = createStackedBoardView({ index: 0, cells: 10, rows: 24, frame: 'wide', geometry, Container, Graphics, Text, onFrameReleased });
  tree.boardSlots[0].addChild(board.root);
  const sharedHud = new Text({ text: 'RENDER-ONLY QA SCENE · AWAITING PARENT RUNTIME', style: { fill:'#9db4c8', fontFamily:'system-ui, sans-serif', fontSize:18, fontWeight:'700' } });
  sharedHud.anchor?.set?.(0.5);
  sharedHud.text='STACKED / RENDER-ONLY / PARENT PENDING';
  tree.layers.layerHud.addChild(sharedHud);
  let disposed=false;
  let hasPresented=false;

  const resize = () => {
    if (disposed) return;
    const fit=fitRootToViewport({ widthPx:app.renderer.width/app.renderer.resolution, heightPx:app.renderer.height/app.renderer.resolution });
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
  const destroy = () => { if(disposed)return; disposed=true; app.renderer.off('resize',resize); board.destroy(); tree.stackedRoot.destroy({children:true}); };
  app.renderer.on('resize',resize);
  resize();
  return Object.freeze({ present, resize, destroy, board, tree });
}
