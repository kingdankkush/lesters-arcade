import { STACKED_FRAME_SIZES } from './stacked-contracts.mjs';

const freezeSlots = slots => Object.freeze(slots.map(slot => Object.freeze(slot)));
const integerScale = value => Math.max(1, Math.floor(value));

export function layoutMatch({ viewportWidth, viewportHeight, boardCount, opponentMini = false, safeArea = {} }) {
  if (!Number.isFinite(viewportWidth) || viewportWidth <= 0 || !Number.isFinite(viewportHeight) || viewportHeight <= 0) throw new TypeError('viewport dimensions must be positive finite numbers');
  if (!Number.isInteger(boardCount) || boardCount < 1 || boardCount > 2) throw new RangeError('boardCount must be 1 or 2');
  const insets = { top:safeArea.top??0, right:safeArea.right??0, bottom:safeArea.bottom??0, left:safeArea.left??0 };
  if (Object.values(insets).some(value => !Number.isInteger(value) || value < 0)) throw new TypeError('safe-area insets must be non-negative integers');
  const usableWidth=viewportWidth-insets.left-insets.right, usableHeight=viewportHeight-insets.top-insets.bottom;
  if (usableWidth <= 0 || usableHeight <= 0) throw new RangeError('safe area must leave a positive viewport');
  const portrait = usableWidth < usableHeight;
  if (boardCount === 2 && portrait && !opponentMini) throw new RangeError('two full boards require a landscape viewport');
  const frame = portrait ? 'tall' : 'wide';
  const size = STACKED_FRAME_SIZES[frame];
  let scale;
  if (portrait) scale = integerScale(Math.min(usableHeight * 0.72 / size.height, usableWidth * 0.94 / size.width));
  else if (boardCount === 2) {
    const gutter = Math.round(usableWidth * 0.04);
    scale = integerScale(Math.min(usableHeight * 0.90 / size.height, (usableWidth * 0.92 - gutter) / (2 * size.width)));
  } else scale = integerScale(Math.min(usableHeight * 0.90 / size.height, usableWidth * 0.90 / size.width));

  if (boardCount === 1) return freezeSlots([{ slot: 0, frame, x: insets.left+Math.round((usableWidth-size.width*scale)/2), y:insets.top+Math.round((usableHeight-size.height*scale)/2), scale, visible: true }]);
  if (portrait) {
    const own = { slot: 0, frame, x:insets.left+Math.round((usableWidth-size.width*scale)/2), y:insets.top+Math.round((usableHeight-size.height*scale)/2), scale, visible: true };
    const miniScale = Math.max(1, Math.floor(scale * 0.34));
    return freezeSlots([own, { slot: 1, frame, x:Math.max(insets.left,insets.left+usableWidth-size.width*miniScale-12), y:insets.top+12, scale:miniScale, visible:true }]);
  }
  const gutter = Math.round(usableWidth * 0.04);
  const totalWidth = size.width * scale * 2 + gutter;
  const startX = insets.left+Math.round((usableWidth-totalWidth)/2);
  const y = insets.top+Math.round((usableHeight-size.height*scale)/2);
  return freezeSlots([
    { slot: 0, frame, x: startX, y, scale, visible: true },
    { slot: 1, frame, x: startX + size.width * scale + gutter, y, scale, visible: true },
  ]);
}

export const computeLayout = layoutMatch;

export function computeBoardRects(slots) {
  return Object.freeze(slots.map(slot => Object.freeze({
    slot: slot.slot, x: slot.x, y: slot.y,
    width: STACKED_FRAME_SIZES[slot.frame].width * slot.scale,
    height: STACKED_FRAME_SIZES[slot.frame].height * slot.scale,
    visible: slot.visible,
  })));
}
