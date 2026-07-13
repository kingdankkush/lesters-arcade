import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SITE_VERSION, GAME_VERSION, VERSION_LABEL, getVersionSnapshot, isCurrentVersion, validateVersionTracking } from '../apps/portal/src/version-tracking.mjs';

describe('version-tracking', () => {
  it('exports valid semver versions', () => {
    assert.match(SITE_VERSION, /^\d+\.\d+\.\d+$/);
    assert.match(GAME_VERSION, /^\d+\.\d+\.\d+$/);
    assert.equal(SITE_VERSION, '1.2.0');
    assert.equal(GAME_VERSION, '1.2.0');
  });

  it('getVersionSnapshot returns a frozen object with both versions', () => {
    const snap = getVersionSnapshot();
    assert.equal(snap.siteVersion, SITE_VERSION);
    assert.equal(snap.gameVersion, GAME_VERSION);
    assert.ok(snap.recordedAt);
    assert.equal(Object.isFrozen(snap), true);
  });

  it('isCurrentVersion detects matching and non-matching versions', () => {
    const snap = getVersionSnapshot();
    assert.equal(isCurrentVersion(snap), true);
    assert.equal(isCurrentVersion({ siteVersion: '0.0.1' }), false);
    assert.equal(isCurrentVersion(null), false);
    assert.equal(isCurrentVersion(undefined), false);
  });

  it('VERSION_LABEL is a display-friendly string', () => {
    assert.ok(VERSION_LABEL.startsWith('v'));
  });

  it('validateVersionTracking passes all invariants', () => {
    const result = validateVersionTracking();
    assert.ok(result.ok, result.errors.join(', '));
  });
});
