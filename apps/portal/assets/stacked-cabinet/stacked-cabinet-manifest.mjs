const atlas = './assets/stacked-cabinet/stacked-cabinet-turnaround-v1.png';
// Equal-size, centered view windows keep the cabinet grounded as it turns.
// One atlas is decoded once by the existing cabinet renderer; no animation JS.
export const STACKED_CABINET_SPRITE = Object.freeze({
  id: 'stacked-cabinet',
  className: 'stacked-cabinet-rotator',
  frameDurationMs: 600,
  frames: Object.freeze([
    [70, 0, 'front'],
    [530, 0, 'front-right'],
    [1052, 0, 'back-right'],
    [70, 512, 'back'],
    [541, 512, 'back-left'],
    [1078, 512, 'front-left'],
  ].map(([x, y, view], index) => Object.freeze({
    src: `${atlas}#frame=${x},${y},424,512,1536,1024`,
    view,
    durationMs: 600,
    rest: index === 0,
  }))),
});
