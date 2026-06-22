// Lester's Arcade — Version Tracking System
//
// Every deploy of Lester's Arcade + Hard Money Heroes carries a siteVersion and
// gameVersion. Game session data records both so leaderboards can be scoped to the
// current deploy: when a new version ships, the global Scores page shows only scores
// from that version forward (old scores are retained historically but filtered out).
//
// This module is the single source of truth for version numbers. Bump these on every
// deploy that changes gameplay, balance, or the site itself.

export const SITE_VERSION = '1.0.0';
export const GAME_VERSION = '1.0.0';

// Combined version label for display in UI (HUD, footer, game-over screen).
export const VERSION_LABEL = `v${SITE_VERSION}`;

// Returns the current version snapshot for embedding in session data.
export function getVersionSnapshot() {
  return Object.freeze({
    siteVersion: SITE_VERSION,
    gameVersion: GAME_VERSION,
    recordedAt: new Date().toISOString(),
  });
}

// Check whether a session's version matches the current deploy. Used by the
// leaderboard engine to filter out scores from older versions.
export function isCurrentVersion(sessionVersion, { currentSiteVersion = SITE_VERSION } = {}) {
  if (!sessionVersion) return false;
  return sessionVersion.siteVersion === currentSiteVersion;
}

// Validates the version tracking invariants (called during npm test).
export function validateVersionTracking() {
  const errors = [];
  if (!SITE_VERSION.match(/^\d+\.\d+\.\d+$/)) errors.push('SITE_VERSION must be semver');
  if (!GAME_VERSION.match(/^\d+\.\d+\.\d+$/)) errors.push('GAME_VERSION must be semver');
  const snap = getVersionSnapshot();
  if (snap.siteVersion !== SITE_VERSION) errors.push('snapshot siteVersion mismatch');
  if (snap.gameVersion !== GAME_VERSION) errors.push('snapshot gameVersion mismatch');
  if (!isCurrentVersion(snap)) errors.push('current version should be detected as current');
  if (isCurrentVersion({ siteVersion: '0.0.1' })) errors.push('old version should not be current');
  return { ok: errors.length === 0, errors };
}
