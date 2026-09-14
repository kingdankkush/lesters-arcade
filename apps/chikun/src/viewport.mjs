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

export function upcomingChikunObstacle(obstacles, view, speedMultiplier=1) {
  if (!view.portrait) return null;
  const next = obstacles.find(obstacle => !obstacle.passed && obstacle.x + obstacle.width > 250);
  return next && next.x > view.left + view.width && next.x < Math.max(1050,280+2.4*speedMultiplier*180) ? next : null;
}
