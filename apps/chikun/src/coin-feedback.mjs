// Small detached presentation plans. Neither the simulation nor replay imports this module.
export const isChikunCoinFeedbackEnabled = params => params?.get?.('coinFeedback') === 'positive-v1';

export function createChikunCoinFeedback() {
  let previousCoins = 0, previousTick = 0, pickupTick = -Infinity, streak = 0;
  const reset = (coins = 0, tick = 0) => {
    previousCoins = Number.isSafeInteger(coins) && coins >= 0 ? coins : 0;
    previousTick = Number.isSafeInteger(tick) && tick >= 0 ? tick : 0;
    pickupTick = -Infinity; streak = 0;
  };
  return Object.freeze({
    reset,
    observe(snapshot) {
      const coins = snapshot?.coinsCollected, tick = snapshot?.tick, x = snapshot?.chikun?.x, y = snapshot?.chikun?.y;
      if (!Number.isSafeInteger(coins) || coins < 0 || !Number.isSafeInteger(tick) || tick < 0 || !Number.isFinite(x) || !Number.isFinite(y)) return null;
      if (coins < previousCoins || tick < previousTick) { reset(coins, tick); return null; }
      previousTick = tick;
      const delta = coins - previousCoins; if (!delta) return null;
      previousCoins = coins;
      streak = tick - pickupTick > 150 ? 0 : Math.min(6, streak + 1);
      pickupTick = tick;
      return Object.freeze({ x, y, tick, coins: delta, pitch: 2 ** (streak / 12), shake: 0, flash: 0 });
    },
  });
}

// CSS pixels, independent of backing-store DPR. Respect object-fit:contain and the portrait crop.
export function chikunCoinOriginToFrame(point, view, canvasRect, frameRect) {
  const scale = Math.min(canvasRect.width / view.width, canvasRect.height / view.height);
  return { x: canvasRect.left - frameRect.left + (canvasRect.width - view.width * scale) / 2 + (point.x - view.left) * scale,
    y: canvasRect.top - frameRect.top + (canvasRect.height - view.height * scale) / 2 + point.y * scale };
}

export function sampleChikunCoinFlight(from, to, progress) {
  const t = Math.max(0, Math.min(1, progress)), inverse = 1 - t;
  const controlY = Math.min(from.y, to.y) - 48;
  return Object.freeze({ x: from.x * inverse * inverse + from.x * 2 * inverse * t + to.x * t * t,
    y: from.y * inverse * inverse + controlY * 2 * inverse * t + to.y * t * t,
    size: 20 - 10 * t, visible: t < 1 });
}
