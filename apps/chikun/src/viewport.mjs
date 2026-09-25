// Stock view (Weekly Jackpot design §B.4, AC2): the landscape camera is never wider than the stock
// 1,280 view, so a CSS-widened frame letterboxes (main.mjs sets object-fit: contain) and shows open sky,
// not more of the course. The stock 16:9 frame and every portrait size are unchanged. The draw loop
// also skips obstacles more than CHIKUN_DRAW_MARGIN_PX past the view (chikunForkInView). Not flag-gated.
export const CHIKUN_STOCK_VIEW_WIDTH = 1280;
export const CHIKUN_DRAW_MARGIN_PX = 40;

// Camera projection only: canonical coordinates, input ticks and scores stay
// identical when the player rotates a phone or enters fullscreen.
export function buildChikunViewport(cssWidth, cssHeight, dpr = 1) {
  const height = 720;
  const width = Math.min(CHIKUN_STOCK_VIEW_WIDTH, height * Math.max(1, cssWidth) / Math.max(1, cssHeight));
  const portrait = width < height;
  const density = Math.min(2, Math.max(.5, cssHeight / height * Math.min(2, dpr)));
  return Object.freeze({ width, height, portrait, left: portrait ? 280 - width * .26 : 0,
    density, pixelWidth: Math.round(width * density), pixelHeight: Math.round(height * density) });
}

// Whether the draw loop may draw an obstacle: not beyond the view's right edge plus the margin.
export function chikunForkInView(fork, view) {
  return !(fork.x > view.left + view.width + CHIKUN_DRAW_MARGIN_PX);
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
