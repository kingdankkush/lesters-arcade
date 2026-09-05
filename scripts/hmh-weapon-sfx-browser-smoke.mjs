// Real-browser check that the synthesised cues actually decode and are
// reachable at the URLs the child will request. The visual gate screenshots
// the canvas and cannot see audio at all.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '../benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs';

const origin = process.env.HMH_REBOOT_ORIGIN ?? 'http://127.0.0.1:8791';
const browser = await chromium.launch({
  executablePath: String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`,
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
const failures = [];
page.on('response', (response) => {
  if (response.url().includes('/audio/sfx/hmh-') && !response.ok()) {
    failures.push(`${response.status()} ${response.url()}`);
  }
});
await page.goto(`${origin}/hmh-reboot/`, { waitUntil: 'networkidle' });

const cues = [
  'hmh-fire-coin-blaster', 'hmh-fire-scatter-shotgun', 'hmh-fire-auto-miner',
  'hmh-fire-launcher-rig', 'hmh-weapon-reload', 'hmh-weapon-empty',
];
const report = await page.evaluate(async (ids) => {
  const out = {};
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  for (const id of ids) {
    const url = `../assets/audio/sfx/${id}.wav`;
    try {
      const res = await fetch(new URL(url, location.href));
      const buf = await res.arrayBuffer();
      const decoded = await ctx.decodeAudioData(buf);
      // Peak amplitude proves the cue is not silence.
      const data = decoded.getChannelData(0);
      let peak = 0;
      for (let i = 0; i < data.length; i += 1) peak = Math.max(peak, Math.abs(data[i]));
      out[id] = { ok: res.ok, ms: Math.round(decoded.duration * 1000), rate: decoded.sampleRate, peak: Number(peak.toFixed(3)) };
    } catch (error) {
      out[id] = { error: String(error) };
    }
  }
  return out;
}, cues);

assert.deepEqual(failures, [], 'weapon SFX failed to load');
for (const [cueId, entry] of Object.entries(report)) {
  assert.ok(!entry.error, `${cueId}: ${entry.error}`);
  assert.ok(entry.ok, `${cueId} did not return 200`);
  assert.ok(entry.ms >= 40 && entry.ms <= 2_500, `${cueId} decoded to ${entry.ms}ms`);
  // A silent cue would still load and still pass every static test.
  assert.ok(entry.peak > 0.2, `${cueId} decoded near-silent at peak ${entry.peak}`);
  // The defect this gate exists for: the browser resamples 22.05 kHz to its
  // device rate and reconstruction overshoots between samples. A cue authored
  // at 0.92 decoded at 1.082 and clipped. Nothing may exceed full scale.
  assert.ok(entry.peak < 1.0, `${cueId} decodes at ${entry.peak}, which clips`);
}
// Cycle 074 (S-2): the decode check above fetches the WAVs through a raw
// AudioContext and never touches combatAudio.play(), which is exactly how the
// twelve unregistered cues stayed silent in production for a month while this
// gate passed. Fire the real weapons in the real child and read the registry
// refusal counter the child exposes beside its voice count.
const evidenceDir = new URL(`${process.env.HMH_EVIDENCE_DIR ?? '../.tmp/evidence-weapon-sfx-smoke'}/`, import.meta.url);
await mkdir(evidenceDir, { recursive: true });
const game = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const gameErrors = [];
game.on('pageerror', (error) => gameErrors.push(error.message));
game.on('console', (message) => { if (message.type() === 'error') gameErrors.push(`console: ${message.text()}`); });
// debugGrid=1 is what publishes the evidence dataset on #hmhRebootStage.
await game.goto(`${origin}/hmh-reboot/index.html?debugGrid=1&evidenceSafe=1&weaponPilot=1`, { waitUntil: 'networkidle' });
await game.waitForFunction(() => document.querySelector('#hmhRebootStage')?.dataset.weaponId === 'coin-blaster', null, { timeout: 30_000 });
await game.locator('canvas').focus();
await game.waitForFunction(() => document.querySelector('#hmhRebootStage')?.dataset.lastWeaponFire === 'coin-blaster', null, { timeout: 30_000 });

const stageState = () => game.locator('#hmhRebootStage').evaluate((stage) => ({
  weaponId: stage.dataset.weaponId,
  lastWeaponFire: stage.dataset.lastWeaponFire,
  audioVoices: Number(stage.dataset.audioVoices),
  audioUnknownCues: stage.dataset.audioUnknownCues,
}));
const holdKey = async (key, ms = 120) => {
  await game.keyboard.down(key);
  await game.waitForTimeout(ms);
  await game.keyboard.up(key);
};
const fired = { 'coin-blaster': await stageState() };
for (const [digit, weaponId] of [['Digit2', 'scatter-shotgun'], ['Digit3', 'auto-miner'], ['Digit4', 'launcher-rig']]) {
  await holdKey(digit);
  await holdKey('Space', 180);
  await game.waitForFunction((expected) => document.querySelector('#hmhRebootStage')?.dataset.lastWeaponFire === expected, weaponId, { timeout: 10_000 });
  fired[weaponId] = await stageState();
}
// Auto-miner at a 47 ms cooldown is the densest weapon cue stream; hold it and
// watch the voice pool from inside the frame loop so the sample cannot miss the
// short-lived voices between two dataset reads.
await holdKey('Digit3');
await game.keyboard.down('Space');
const voiceWindow = await game.evaluate(() => new Promise((resolve) => {
  const stage = document.querySelector('#hmhRebootStage');
  let frames = 0;
  let maxVoices = 0;
  const tick = () => {
    maxVoices = Math.max(maxVoices, Number(stage.dataset.audioVoices));
    frames += 1;
    if (frames < 45) requestAnimationFrame(tick);
    else resolve({ frames, maxVoices, unknownCues: stage.dataset.audioUnknownCues });
  };
  requestAnimationFrame(tick);
}));
await game.keyboard.up('Space');
await game.screenshot({ path: fileURLToPath(new URL('weapon-cues-routed.png', evidenceDir)) });
const routed = { fired, voiceWindow, errors: gameErrors };

for (const [weaponId, state] of Object.entries(fired)) {
  assert.equal(state.lastWeaponFire, weaponId, `${weaponId} did not fire`);
  assert.equal(state.audioUnknownCues, '0', `${weaponId}: the child refused ${state.audioUnknownCues} cue(s) at the registry gate`);
}
assert.equal(voiceWindow.unknownCues, '0', 'registry refusals during the auto-miner hold');
assert.ok(voiceWindow.maxVoices >= 1, 'weapon fire must occupy at least one voice');
assert.ok(voiceWindow.maxVoices <= 16, `voice pool exceeded the child cap: ${voiceWindow.maxVoices}`);
assert.deepEqual(gameErrors, []);
await game.close();

console.log(JSON.stringify({ status: 'PASS', httpFailures: failures, report, routed }, null, 2));
await browser.close();
