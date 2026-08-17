import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const child = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
const parent = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');

test('M3/M5 projected controls are consumed by the live input, aim, touch, and restart paths', () => {
  assert.match(child, /new InputState\(\{ keyboardBindings: settings\.keyboardBindings \}\)/);
  assert.match(child, /mapGamepadSnapshot\(gamepad, \{\s*deadzone: settings\.gamepadDeadzone/);
  assert.match(child, /sensitivity: settings\.gamepadSensitivity/);
  assert.match(child, /aimMagnetism: settings\.aimAssistStrength/);
  assert.match(child, /sensitivity: settings\.touchSensitivity/);
  assert.match(child, /controlScale: settings\.touchScale/);
  assert.match(child, /leftHanded: Boolean\(settings\.touchLeftHanded\)/);
});

test('U9/X2 projected accessibility and audio settings have real runtime consumers', () => {
  assert.match(child, /combatAudio\.setBusLevels\(settings\)/);
  assert.match(child, /style\.fontSize = `\$\{\(settings\.hudScale \?\? 1\) \* 100\}%`/);
  assert.match(child, /captionCriticalAudio/);
  assert.match(child, /event\.type === 'tell'.*boss-phase/s);
  assert.match(child, /Critical audio: Liquidator warning/);
});

test('critical audio captions update the live region without crashing the active ticker', () => {
  assert.match(child, /const setAccessibleCombatStatus = \(message\) => \{.*combatStatusElement\.value = message/s);
});

test('HUD scale tuning reads the normalized accessibility settings domain', () => {
  assert.match(parent, /\{ domain: 'accessibility', key: 'hudScale', label: 'HUD scale'/);
  assert.doesNotMatch(parent, /\{ domain: 'display', key: 'hudScale'/);
});

test('M4 child-originated settings persist in the parent without changing ranked bindings', () => {
  assert.match(parent, /mergeHmhRuntimeSettings/);
  assert.match(parent, /rankedActive: Boolean\(hmhRebootActive && currentSession\?\.mode === 'ranked'\)/);
  assert.match(parent, /onSettings: acceptHmhRebootSettings/);
  assert.match(parent, /localStorage\.setItem\('hmh-settings'/);
});
