import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function path(relative) { return fileURLToPath(new URL(relative, import.meta.url)); }
function text(relative) { return readFileSync(path(relative), 'utf8'); }

test('Chikun ships a standalone sandbox child shell and bundle entry', () => {
  for (const relative of [
    '../apps/portal/chikun/index.html',
    '../apps/portal/chikun/game.css',
    '../apps/chikun/src/main.mjs',
  ]) assert.equal(existsSync(path(relative)), true, `${relative} must exist`);

  const html = text('../apps/portal/chikun/index.html');
  assert.match(html, /<canvas[^>]+id="chikunCanvas"/);
  assert.match(html, /\.\.\/dist\/chikun\/game\.js/);
  assert.match(html, /aria-live="polite"/);

  const source = text('../apps/chikun/src/main.mjs');
  assert.match(source, /createChikunRuntime/);
  assert.match(source, /buildChikunReplayClaim/);
  assert.match(source, /validateChikunConnectMessage/);
  assert.match(source, /requestAnimationFrame/);
  assert.match(source, /visibilitychange/);

  const build = text('../build.mjs');
  assert.match(build, /'chikun\/game': chikunEntry/);
  assert.match(build, /outdir, 'chikun\/game\.js'/);
});

test('Chikun runtime uses production sprites and gives Free/Ranked distinct visual themes', () => {
  const source = text('../apps/chikun/src/main.mjs');
  assert.match(source, /chikun-coast\.webp/);
  assert.match(source, /chikun-fall\.webp/);
  assert.match(source, /mode === 'ranked'/);
  assert.match(source, /forksPassed/);
  assert.match(source, /coinsCollected/);
  assert.match(source, /game:result/);
  assert.doesNotMatch(source, /Math\.random\(/, 'canonical or player-visible runtime must not use unseeded randomness');
});
