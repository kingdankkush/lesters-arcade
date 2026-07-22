import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('standalone child HTML exposes only the reboot shell and bundled module', async () => {
  const html = await read('../apps/portal/hmh-reboot/index.html');
  assert.match(html, /id="hmhRebootStage"/);
  assert.match(html, /id="hmhRebootStatus"/);
  assert.match(html, /src="\.\.\/dist\/hmh-reboot\/game\.js"/);
  assert.match(html, /href="\.\/styles\.css"/);
  assert.doesNotMatch(html, /wallet|ethereum|contract/i);
});

test('child runtime uses Pixi and the validated bridge without wallet or settlement authority', async () => {
  const source = await read('../apps/hmh-reboot/src/main.mjs');
  assert.match(source, /from 'pixi\.js'/);
  assert.match(source, /createHmhChildBridge/);
  assert.match(source, /window\.location\.origin/);
  assert.doesNotMatch(source, /window\.ethereum|privateKey|settleRun|walletConnector/);
  assert.match(
    source,
    /message\.type === 'portal:restart'[\s\S]*?elapsedMs = 0[\s\S]*?app\.ticker\.start\(\)[\s\S]*?statePayload\('running'\)/,
    'restart must resume the ticker before reporting running state',
  );
});

test('production build emits a dedicated HMH reboot entry', async () => {
  const build = await read('../build.mjs');
  assert.match(build, /'hmh-reboot\/game'/);
  assert.match(build, /apps[\\/]hmh-reboot[\\/]src[\\/]main\.mjs|hmh-reboot.*main\.mjs/s);
});

test('same-origin framing is allowed while arbitrary framing remains blocked', async () => {
  const vercel = JSON.parse(await read('../vercel.json'));
  const csp = vercel.headers.flatMap((rule) => rule.headers).find((header) => header.key === 'Content-Security-Policy')?.value ?? '';
  assert.match(csp, /frame-ancestors 'self'/);
  assert.doesNotMatch(csp, /frame-ancestors 'none'/);
});

test('portal main integrates the reboot host at the official combat mount', async () => {
  const source = await read('../apps/portal/main.js');
  assert.match(source, /createHmhRebootHost/);
  assert.match(source, /mountHmhRebootSession/);
  assert.match(source, /officialCombatMount/);
  assert.match(source, /window\.location\.origin/);
  assert.match(source, /function drawCombatScene[\s\S]*?if \(hmhRebootActive\)[\s\S]*?requestAnimationFrame\(drawCombatScene\)/);
});

test('portal frame fills the active gameplay viewport without a fixed 72vh dead zone', async () => {
  const css = await read('../apps/portal/styles.css');
  assert.match(css, /\.hmh-reboot-frame[\s\S]*?min-height:\s*calc\(100dvh\s*-\s*\d+px\)/);
});

test('built child bundle exists after the project build', async () => {
  const bundle = new URL('../apps/portal/dist/hmh-reboot/game.js', import.meta.url);
  const info = await stat(bundle);
  assert.ok(info.size > 100_000);
});
