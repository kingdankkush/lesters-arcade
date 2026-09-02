function finite(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function arcadeMusicVolume(value, fallback = 0.7) {
  return Math.min(1, Math.max(0, finite(value, finite(fallback, 0.7))));
}

export function musicSeekSeconds({ fraction = 0, durationSeconds = 0 } = {}) {
  const duration = Math.max(0, finite(durationSeconds, 0));
  const progress = Math.min(1, Math.max(0, finite(fraction, 0)));
  return duration * progress;
}

export function shouldShowArcadeMusicPlayer({
  appStep = 'wallet-splash',
  gameplayPaused = false,
  pendingBegin = false,
  levelUpPaused = false,
} = {}) {
  if (appStep !== 'gameplay') return true;
  return Boolean(gameplayPaused && !pendingBegin && !levelUpPaused);
}
