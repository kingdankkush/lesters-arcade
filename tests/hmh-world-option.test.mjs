// The HMH mode-select world option across the 2.1.0 version gate
// (docs/2.0/slices/HMH-RANKED-V8-TEN-AREA.md): before 2.1.0 it is the New
// Frontier preview (tests/hmh-frontier-preview.test.mjs); from 2.1.0, where
// the ten-area world is Level 1 for Free and Ranked, there is no option: the
// owner retired "Play the original map (Free only)" in 2.1.1, so the portal
// never requests a world. The child still honours a direct world=legacy
// request for an unranked Free session (the visual-regression gate's URL).
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  HMH_FRONTIER_PREVIEW_COPY,
  HMH_TEN_AREA_LEVEL_ONE,
  HMH_WORLD_OPTION,
  hmhWorldOption,
  mountHmhFrontierPreviewOption,
} from '../apps/portal/src/hmh-frontier-preview.mjs';
import { HMH_FRONTIER_PREVIEW_WORLD, HMH_ORIGINAL_MAP_WORLD, createHmhRebootHost } from '../apps/portal/src/hmh-reboot-host.mjs';
import { GAME_VERSION } from '../apps/portal/src/version-tracking.mjs';
import { isHmhV8GameVersion } from '../sdk/hmh-run-v8-build.mjs';
import { HMH_TEN_AREA_LEVEL_ONE as CHILD_TEN_AREA_LEVEL_ONE, LEGACY_WORLD_VALUE, TEN_AREA_WORLD_VALUE, resolveHmhWorldSelection } from '../apps/hmh-reboot/src/world-context.mjs';

const main = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');

function node(tag) {
  return {
    tag, children: [], attrs: {}, listeners: {}, hidden: false, parentNode: null,
    setAttribute(name, value) { this.attrs[name] = String(value); },
    addEventListener(type, listener) { this.listeners[type] = listener; },
    append(...children) { for (const child of children) { child.parentNode = this; this.children.push(child); } },
    click() { return this.listeners.click?.(); },
  };
}

function host() {
  const mount = { children: [], replaceChildren(...children) { this.children = children; for (const child of children) child.contentWindow = {}; } };
  const documentRef = { createElement: () => ({ dataset: {}, listeners: new Map(), setAttribute() {}, addEventListener(type, listener) { this.listeners.set(type, listener); }, focus() {} }) };
  return createHmhRebootHost({
    mount, documentRef, expectedOrigin: 'https://arcade.test',
    bridgeFactory: () => ({ connect() {}, send() {}, destroy() {} }),
    setTimeoutRef: () => ({}), clearTimeoutRef: () => {},
  });
}
const session = (mode, rankedEligible) => ({
  sessionId: 'game-session-000000001', gameId: 'lester-blaster', mode, heroId: 'lit-commando',
  profile: { displayName: 'Guest', locale: 'en' },
  session: { seed: 7, buildHash: 'site-2.1.0:game-2.1.0:cabinet-0.6.0', seasonId: 'season-1', rankedEligible },
});

test('the portal and the child read one gate: the game version', () => {
  assert.equal(HMH_TEN_AREA_LEVEL_ONE, isHmhV8GameVersion(GAME_VERSION));
  assert.equal(CHILD_TEN_AREA_LEVEL_ONE, HMH_TEN_AREA_LEVEL_ONE);
  assert.deepEqual(HMH_WORLD_OPTION, hmhWorldOption(HMH_TEN_AREA_LEVEL_ONE));
});

test('from 2.1.0 the mode select has no world option, and mounting one is refused', () => {
  assert.equal(hmhWorldOption(true), null);
  const container = node('section');
  assert.throws(() => mountHmhFrontierPreviewOption({ documentRef: { createElement: node }, container, onStart: () => {}, option: null }), TypeError);
  assert.equal(container.children.length, 0);
  if (HMH_TEN_AREA_LEVEL_ONE) assert.equal(HMH_WORLD_OPTION, null);
  // Before 2.1.0 the slot keeps the preview.
  const preview = hmhWorldOption(false);
  assert.equal(preview.world, HMH_FRONTIER_PREVIEW_WORLD);
  assert.equal(preview.copy, HMH_FRONTIER_PREVIEW_COPY);
});

test('the host forwards a world request only for an unranked Free session, and the 2.1.0 child honours exactly it', () => {
  const embedded = host();
  const childParams = (frame) => new URL(frame.src).searchParams;
  const original = embedded.mountSession(session('free', false), { world: HMH_ORIGINAL_MAP_WORLD });
  assert.equal(original.dataset.world, 'legacy');
  assert.equal(childParams(original).toString(), 'mode=free&world=legacy');
  const selection = resolveHmhWorldSelection({ params: childParams(original), tenAreaLevelOne: true });
  assert.equal(selection.reason, 'explicit-free-legacy');
  assert.equal(selection.rankedEligible, false);
  // No request (every Ranked session, every ordinary Free start): the child's default, the ten-area Level 1.
  for (const [mode, rankedEligible, world] of [['ranked', true, HMH_ORIGINAL_MAP_WORLD], ['free', true, HMH_ORIGINAL_MAP_WORLD], ['free', false, null], ['free', false, 'forked-frontier']]) {
    const frame = embedded.mountSession(session(mode, rankedEligible), { world });
    assert.equal(frame.dataset.world, undefined, `${mode} ${rankedEligible} ${world}`);
    assert.equal(childParams(frame).has('world'), false);
    const childDefault = resolveHmhWorldSelection({ params: childParams(frame), tenAreaLevelOne: true });
    assert.equal(childDefault.worldId, 'ten-area-frontier');
    assert.equal(childDefault.rankedEligible, true);
  }
  const preview = embedded.mountSession(session('free', false), { world: HMH_FRONTIER_PREVIEW_WORLD });
  assert.equal(preview.dataset.world, TEN_AREA_WORLD_VALUE);
});

test('main.js mounts no option, requests no world and labels no original-map run from 2.1.0', () => {
  assert.match(main, /if \(HMH_WORLD_OPTION && !hmhFrontierPreviewOption && dom\.officialModeSelect\) \{/);
  assert.equal((main.match(/frontierPreview: true/g) ?? []).length, 1, 'only the unmounted option button asks for a world');
  assert.match(main, /initContext\.rankedEligible === false && HMH_WORLD_OPTION \? HMH_WORLD_OPTION\.world : null;/);
  assert.match(main, /hmhFrontierPreviewActive = !HMH_TEN_AREA_LEVEL_ONE && frame\?\.dataset\?\.world === 'ten-area';/);
  assert.doesNotMatch(main, /hmhOriginalMap|Play the original map/);
  // Only the preview (pre-2.1.0) suppresses the result and share card.
  const summary = main.slice(main.indexOf('function renderGameOverSummary()'), main.indexOf('const loopNote = el('));
  assert.match(summary, /if \(hmhFrontierPreviewActive\) appendText\(/);
});
