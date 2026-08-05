// Real-browser check that the synthesised cues actually decode and are
// reachable at the URLs the child will request. The visual gate screenshots
// the canvas and cannot see audio at all.
import assert from 'node:assert/strict';
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
console.log(JSON.stringify({ status: 'PASS', httpFailures: failures, report }, null, 2));
await browser.close();
