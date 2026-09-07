export const LAYER_ORDER = Object.freeze(['layerBackdrop', 'layerParticleFar', 'boardRoot', 'layerParticleNear', 'layerPost', 'layerHud']);

export function createLayerStack({ stage, Container }) {
  const stackedRoot = new Container();
  const layers = Object.fromEntries(LAYER_ORDER.map(name => [name, new Container()]));
  const boardSlots = [new Container(), new Container()];
  layers.boardRoot.addChild(...boardSlots);
  boardSlots[1].visible = false;
  stackedRoot.addChild(...LAYER_ORDER.map(name => layers[name]));
  stage.addChild(stackedRoot);
  return Object.freeze({ stackedRoot, layers: Object.freeze(layers), boardSlots: Object.freeze(boardSlots) });
}

