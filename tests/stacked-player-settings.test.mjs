import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultStackedSettings, readStackedSettings, saveStackedSettings } from '../apps/portal/src/stacked-player-settings.mjs';
import { validateStackedBridgeMessage, validateStackedBridgeSettings } from '../apps/portal/src/stacked-bridge-protocol.mjs';
test('settings survive reload, preserve safe defaults and never recover unaccepted input timing', () => {
  let raw;
  const storage = {setItem:(k,v)=>{raw=v;},getItem:()=>raw};
  const settings = defaultStackedSettings();
  settings.accessibility.reduceMotion = true; settings.video.gridLines = false; settings.handling.arrMs = 1;
  assert.equal(saveStackedSettings(storage, settings), true);
  const restored = readStackedSettings(storage);
  assert.equal(restored.accessibility.reduceMotion, true); assert.equal(restored.video.gridLines, false);
  assert.equal(restored.handling.arrMs, 33); assert.equal(validateStackedBridgeSettings(restored), true);
  assert.equal(saveStackedSettings({setItem(){throw Error('quota');}}, settings), false);
});
test('preference requests accept only bounded projection choices', () => {
  const m = {protocol:'stacked-bridge/v1', type:'game:preferences-request', sessionId:'test-session', messageId:'game-1', payload:{reduceMotion:true,reducedEffects:false,audioReactive:true,ghostPiece:true,gridLines:true,sfxEnabled:true}};
  assert.equal(validateStackedBridgeMessage(m).ok, true);
  assert.equal(validateStackedBridgeMessage({...m,payload:{...m.payload,startLevel:15}}).ok, false);
});
