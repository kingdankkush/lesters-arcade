import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '../benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs';
import { startPortalStaticServer } from './hmh-reboot-portal-e2e.mjs';
const root = fileURLToPath(new URL('..', import.meta.url));
const out = path.join(root, 'outputs/living-visualizer-browser');
await mkdir(out, { recursive: true });
await build({ entryPoints: [path.join(root, 'scripts/stacked-visualizer-qa-entry.mjs')], outfile: path.join(root, 'apps/portal/.tmp/visualizer-qa.js'), bundle: true, format: 'esm', external: ['pixi.js'], platform: 'browser' });
const { server, origin } = await startPortalStaticServer({ rootDir: path.join(root, 'apps/portal') });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const reports = [];
try {
  for (const [name, width, height] of [['desktop',1440,900],['mobile',390,680],['small-mobile',320,600]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/visualizer-qa.html', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><style>html,body,#stackedStage{width:100%;height:100%;margin:0;overflow:hidden;background:radial-gradient(ellipse at center,#132535,#03080f);color:#eef8ff;font-family:system-ui}canvas{display:block}p{position:absolute;top:0;left:12px;font-size:10px;color:#8faebf}</style><script type="importmap">{"imports":{"pixi.js":"/dist/stacked/stacked-pixi-v1.js"}}</script></head><body><div id="stackedStage"></div><p>LOCAL VISUAL QA · SYNTHETIC LINE-CLEAR EVENTS</p><script type="module" src="/.tmp/visualizer-qa.js"></script></body></html>` }));
    await page.goto(origin + '/visualizer-qa.html');
    await page.waitForFunction(() => window.visualizerQa).catch(error => { throw new Error(`${error.message}: ${errors.join('; ')}`); });
    const sample = async (label, now, expected) => {
      const result = await page.evaluate(time => window.visualizerQa.present(time), now);
      assert.equal(result.phase, expected);
      await page.screenshot({ path: path.join(out, `${name}-${label}.png`) });
      return result;
    };
    await sample('swimming', 2000, 'swimming');
    await page.evaluate(() => window.visualizerQa.clear(1));
    await sample('clear-start', 2100, 'burst');
    await sample('particle-burst', 2340, 'burst');
    await sample('reforming', 2950, 'reforming');
    const formed = await sample('new-organisms', 4400, 'swimming');
    assert.equal(formed.generation, 1);
    await page.evaluate(() => window.visualizerQa.clear(4));
    await sample('quad-start', 4600, 'burst');
    await sample('quad-burst', 4840, 'burst');
    await page.evaluate(() => window.visualizerQa.reduced(true));
    await sample('reduced-motion', 4900, 'still');
    await page.evaluate(() => window.visualizerQa.destroy());
    assert.deepEqual(errors, []);
    reports.push({ name, errors, singleClear: true, quadClear: true, reform: true, reducedMotion: true, destroyedCleanly: true });
    await page.close();
  }
} finally {
  await writeFile(path.join(out, 'verification.json'), JSON.stringify({ renderFixture: true, reports }, null, 2));
  await browser.close(); server.close();
}
console.log(JSON.stringify(reports));
