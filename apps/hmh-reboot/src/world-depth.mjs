export function worldDepthKey(y,bias=0) {
  if(!Number.isFinite(y)||!Number.isFinite(bias)) throw new TypeError('finite ground depth required');
  return y+bias;
}
export function createWorldDepthLayer(RenderLayerClass) {
  const layer=new RenderLayerClass({sortableChildren:true});
  layer.label='world-ground-depth';
  return layer;
}
