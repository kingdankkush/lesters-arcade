// Camera projection only: canonical coordinates, input ticks and scores stay
// identical when the player rotates a phone or enters fullscreen.
export function buildChikunViewport(cssWidth, cssHeight, dpr = 1) {
  const height = 720;
  const width = height * Math.max(1, cssWidth) / Math.max(1, cssHeight);
  const portrait = width < height;
  const density = Math.min(2, Math.max(.5, cssHeight / height * Math.min(2, dpr)));
  return Object.freeze({ width, height, portrait, left: portrait ? 280 - width * .26 : 0,
    density, pixelWidth: Math.round(width * density), pixelHeight: Math.round(height * density) });
}

// Portrait "<KIND> AHEAD" preview. It names the next obstacle once it is within
// CHIKUN_PREVIEW_PX of Chikun (the intermediate player's look-ahead), or within
// CHIKUN_PREVIEW_TICKS of arriving at high speed, and never before the landscape
// screen would show it: a phone never gets more warning than landscape play.
// scripts/lib/chikun-bots.mjs models it for the difficulty harness.
export const CHIKUN_PREVIEW_PX = 360;
export const CHIKUN_PREVIEW_TICKS = 50;
export function upcomingChikunObstacle(obstacles, view, speedMultiplier=1) {
  if (!view.portrait) return null;
  const next = obstacles.find(obstacle => !obstacle.passed && obstacle.x + obstacle.width > 250);
  const lead = Math.min(1000, Math.max(CHIKUN_PREVIEW_PX, 2.4 * speedMultiplier * CHIKUN_PREVIEW_TICKS));
  return next && next.x > view.left + view.width && next.x < 280 + lead ? next : null;
}
