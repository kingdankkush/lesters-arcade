// QA sweep 2026-10-01: the portal sends its one bridge handshake on the
// iframe's load event. The child only started listening after it had resolved
// its world context, so a handshake that arrived first was lost and the
// portal timed out waiting for READY (always reproducible for the New
// Frontier preview, whose ten-area chunk loads lazily). The child now holds
// any window message that lands before the bridge listens.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const driver = new URL('../scripts/hmh-honest-corpus/child-driver.mjs', import.meta.url).href;
function boot(search, mode) {
  const source = `import { runChild } from ${JSON.stringify(driver)};
const pad = (tick) => ({ id: 'p', index: 0, connected: true, mapping: 'standard', timestamp: tick, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) });
try {
  const result = await runChild({ seed: 7, buildHash: 'site-2.1.0:game-2.1.0:cabinet-0.6.0', seasonId: 'hmh-season-1-2026', pilot: { frame: (_s, tick) => pad(tick), chooseUpgrade: () => null }, maxFrames: 120, search: ${JSON.stringify(search)}, mode: ${JSON.stringify(mode)}, connectBeforeBoot: true });
  process.stdout.write(JSON.stringify({ ok: true, state: result.state, ready: result.outbox.some((entry) => entry.message.type === 'game:ready'), tick: result.tick }) + String.fromCharCode(10));
} catch (error) { process.stdout.write(JSON.stringify({ ok: false, error: String(error.message).slice(0, 300) }) + String.fromCharCode(10)); }
process.exit(0);`;
  return JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', source], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 240_000 }).trim().split('\n').at(-1));
}

test('a handshake that lands before the ten-area world context resolves still connects and READYs', () => {
  const result = boot('?mode=free&world=ten-area', 'free');
  assert.equal(result.ok, true, result.error);
  assert.equal(result.ready, true);
  assert.equal(result.state, 'active');
});

test('the legacy world connects the same way', () => {
  const result = boot('', 'free');
  assert.equal(result.ok, true, result.error);
  assert.equal(result.ready, true);
});
