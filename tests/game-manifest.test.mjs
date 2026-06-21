import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  validateGameManifest,
  manifestChecksum,
  createGameRegistry,
  ARCADE_SDK_VERSION,
  REQUIRED_ASPECTS,
} from '../apps/portal/src/game-manifest.mjs';

// A minimal valid manifest the tests mutate per-case.
function baseManifest(overrides = {}) {
  return {
    id: 'sample-game',
    name: 'Sample Game',
    version: '1.0.0',
    sdkVersion: '1.0.0',
    status: 'playable',
    aspectSupport: ['9:16', '16:9'],
    controlScheme: 'twin-stick',
    capabilities: ['leaderboard'],
    rankedEligible: false,
    entry: './main.js',
    ...overrides,
  };
}

test('validateGameManifest accepts a well-formed manifest and freezes it', () => {
  const { valid, errors, manifest } = validateGameManifest(baseManifest());
  assert.equal(valid, true);
  assert.deepEqual(errors, []);
  assert.equal(Object.isFrozen(manifest), true);
  assert.equal(manifest.id, 'sample-game');
  assert.equal(manifest.description, ''); // default applied
});

test('validateGameManifest rejects non-objects and bad ids', () => {
  assert.equal(validateGameManifest(null).valid, false);
  assert.equal(validateGameManifest('nope').valid, false);
  assert.equal(validateGameManifest(baseManifest({ id: 'UPPER' })).valid, false);
  assert.equal(validateGameManifest(baseManifest({ id: 'ab' })).valid, false); // too short
  assert.equal(validateGameManifest(baseManifest({ id: 'has space' })).valid, false);
});

test('validateGameManifest enforces semver on version + sdkVersion', () => {
  assert.equal(validateGameManifest(baseManifest({ version: '1.0' })).valid, false);
  assert.equal(validateGameManifest(baseManifest({ sdkVersion: 'v1' })).valid, false);
});

test('validateGameManifest rejects an incompatible SDK major', () => {
  const res = validateGameManifest(baseManifest({ sdkVersion: '2.0.0' }));
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('incompatible')));
});

test('validateGameManifest requires both mandatory aspect ratios', () => {
  for (const aspects of [['16:9'], ['9:16'], [], ['4:3']]) {
    const res = validateGameManifest(baseManifest({ aspectSupport: aspects }));
    assert.equal(res.valid, false, `aspects ${JSON.stringify(aspects)} should fail`);
  }
  // Extra aspects are fine as long as the required ones are present.
  assert.equal(validateGameManifest(baseManifest({ aspectSupport: ['9:16', '16:9', '4:3'] })).valid, true);
});

test('validateGameManifest validates control scheme + capabilities', () => {
  assert.equal(validateGameManifest(baseManifest({ controlScheme: 'mind-control' })).valid, false);
  assert.equal(validateGameManifest(baseManifest({ capabilities: ['leaderboard', 'bogus'] })).valid, false);
});

test('rankedEligible requires ranked + leaderboard capabilities', () => {
  // ranked eligible but missing capabilities -> invalid
  assert.equal(validateGameManifest(baseManifest({ rankedEligible: true, capabilities: ['leaderboard'] })).valid, false);
  assert.equal(validateGameManifest(baseManifest({ rankedEligible: true, capabilities: [] })).valid, false);
  // ranked eligible with both -> valid
  assert.equal(
    validateGameManifest(baseManifest({ rankedEligible: true, capabilities: ['ranked', 'leaderboard'] })).valid,
    true,
  );
});

test('entry must be a same-origin relative path, not a remote URL', () => {
  assert.equal(validateGameManifest(baseManifest({ entry: '' })).valid, false);
  assert.equal(validateGameManifest(baseManifest({ entry: 'https://evil.example/x.js' })).valid, false);
  assert.equal(validateGameManifest(baseManifest({ entry: './cabinet/index.js' })).valid, true);
});

test('endpoints must be https; devWallet must be a valid address when present', () => {
  assert.equal(validateGameManifest(baseManifest({ endpoints: ['http://insecure.example'] })).valid, false);
  assert.equal(validateGameManifest(baseManifest({ endpoints: ['https://api.example'] })).valid, true);
  assert.equal(validateGameManifest(baseManifest({ devWallet: '0x1234' })).valid, false);
  assert.equal(
    validateGameManifest(baseManifest({ devWallet: '0x1e57e21e57e21e57e21e57e21e57e21e57e21e57' })).valid,
    true,
  );
});

test('manifestChecksum is deterministic and changes when a field changes', () => {
  const a = validateGameManifest(baseManifest()).manifest;
  const b = validateGameManifest(baseManifest()).manifest;
  assert.equal(manifestChecksum(a), manifestChecksum(b));
  const c = validateGameManifest(baseManifest({ version: '1.0.1' })).manifest;
  assert.notEqual(manifestChecksum(a), manifestChecksum(c));
  assert.match(manifestChecksum(a), /^m_[0-9a-f]{8}$/);
});

test('createGameRegistry registers valid manifests and rejects invalid/duplicate', () => {
  const reg = createGameRegistry();
  const ok = reg.register(baseManifest());
  assert.equal(ok.ok, true);
  assert.equal(reg.size(), 1);
  assert.equal(reg.has('sample-game'), true);

  // duplicate id rejected
  const dupe = reg.register(baseManifest());
  assert.equal(dupe.ok, false);
  assert.ok(dupe.errors.some((e) => e.includes('duplicate')));

  // invalid rejected, recorded in rejections, not added
  const bad = reg.register(baseManifest({ id: 'X' }));
  assert.equal(bad.ok, false);
  assert.equal(reg.size(), 1);
  assert.equal(reg.rejections().length, 2);
});

test('registry.cabinets() renders coming-soon as locked roadmap cards, drops disabled', () => {
  const reg = createGameRegistry();
  reg.register(baseManifest({ id: 'playable-one', status: 'playable' }));
  reg.register(baseManifest({ id: 'soon-one', status: 'coming-soon' }));
  reg.register(baseManifest({ id: 'dead-one', status: 'disabled' }));

  const cabinets = reg.cabinets();
  const ids = cabinets.map((c) => c.id);
  assert.ok(ids.includes('playable-one'));
  assert.ok(ids.includes('soon-one'));
  assert.ok(!ids.includes('dead-one')); // disabled never shown

  const soon = cabinets.find((c) => c.id === 'soon-one');
  assert.equal(soon.locked, true);
  const playable = cabinets.find((c) => c.id === 'playable-one');
  assert.equal(playable.locked, false);
  // playable sorts before coming-soon
  assert.ok(ids.indexOf('playable-one') < ids.indexOf('soon-one'));
});

test('the real Hard Money Heroes manifest on disk is valid against the schema', () => {
  const manifestPath = fileURLToPath(
    new URL('../apps/portal/games/hard-money-heroes/game.manifest.json', import.meta.url),
  );
  const raw = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const { valid, errors, manifest } = validateGameManifest(raw);
  assert.equal(valid, true, `HMH manifest should be valid, got: ${errors.join('; ')}`);
  assert.equal(manifest.id, 'hard-money-heroes');
  assert.equal(manifest.rankedEligible, true);
  assert.equal(manifest.sdkVersion, ARCADE_SDK_VERSION);
  for (const aspect of REQUIRED_ASPECTS) assert.ok(manifest.aspectSupport.includes(aspect));
});
