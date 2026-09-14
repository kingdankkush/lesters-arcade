// Measured source bounds, not gameplay geometry. Transparent frames use alpha
// bounds; the STACKED matte uses luminance >14 inside each existing atlas window.
// Each turn keeps its source aspect ratio and shares a 100%-tall silhouette.
export const CABINET_FRAMING = Object.freeze({
  'hard-money-heroes-arcade-cabinet-rotation': [
    [512,560,57,25,454,558], [512,560,24,18,488,558],
    [512,560,103,18,408,558], [512,560,83,80,428,558],
    [512,560,118,81,393,558], [512,560,48,51,464,558],
  ],
  'chikun-cabinet': [
    [400,531,61,59,331,440], [400,531,12,66,355,460],
    [400,531,55,57,281,440], [400,531,74,102,311,442],
    [400,531,105,92,318,431], [400,531,57,93,363,451],
  ],
  'stacked-cabinet': [
    [424,512,76,12,347,491], [424,512,36,8,381,512],
    [424,512,60,8,367,487], [424,512,88,8,333,474],
    [424,512,55,0,367,483], [424,512,45,0,382,481],
  ],
});

export function cabinetFramePresentation(id, index) {
  const frame = CABINET_FRAMING[id]?.[index];
  if (!frame) return null;
  const [width,height,left,top,right,bottom] = frame;
  const visibleHeight = bottom-top;
  return { width: width/visibleHeight*100, height: height/visibleHeight*100,
    left: 50-(left+right)/2/visibleHeight*100, top: -top/visibleHeight*100 };
}
