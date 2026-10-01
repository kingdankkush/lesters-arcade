import { ARCADE_CABINETS_3D, ARCADE_CABINET_FRAME } from '../assets/generated/arcade-cabinets-3d/arcade-cabinets-3d-manifest.mjs';

// Measured source bounds, not gameplay geometry. Each turntable shares one
// camera, so every frame of a cabinet uses the union of its alpha bounds over
// the whole turn: the cabinet keeps one size and one ground line as it spins,
// and all three cabinets share a 100%-tall silhouette in the catalog.
export const CABINET_FRAMING = Object.freeze(Object.fromEntries(Object.values(ARCADE_CABINETS_3D).map((sprite) => {
  const [left, top, right, bottom] = sprite.bounds;
  const frame = Object.freeze([ARCADE_CABINET_FRAME.width, ARCADE_CABINET_FRAME.height, left, top, right, bottom]);
  return [sprite.id, Object.freeze(sprite.frames.map(() => frame))];
})));

export function cabinetFramePresentation(id, index) {
  const frame = CABINET_FRAMING[id]?.[index];
  if (!frame) return null;
  const [width,height,left,top,right,bottom] = frame;
  const visibleHeight = bottom-top;
  return { width: width/visibleHeight*100, height: height/visibleHeight*100,
    left: 50-(left+right)/2/visibleHeight*100, top: -top/visibleHeight*100 };
}
