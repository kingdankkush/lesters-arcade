import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '../benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs';
import {startPortalStaticServer} from './hmh-reboot-portal-e2e.mjs';
import {signatureFromPng,compareSignatures} from './hmh-reboot-visual-regression.mjs';
const root=fileURLToPath(new URL('..',import.meta.url)),out=path.join(root,'outputs/music-worlds-browser');
await mkdir(out,{recursive:true});
const fixture=await build({entryPoints:[path.join(root,'scripts/stacked-visualizer-qa-entry.mjs')],write:false,bundle:true,format:'esm',external:['pixi.js'],platform:'browser'});
const {server,origin}=await startPortalStaticServer({rootDir:path.join(root,'apps/portal')});
const browser=await chromium.launch({executablePath:process.env.STACKED_BROWSER_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const reports=[];
try {
  for(const [name,width,height] of [['desktop',1440,900],['phone',390,680],['small-phone',320,600],['landscape',844,390]]) {
    const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/.tmp/worlds.js',r=>r.fulfill({contentType:'text/javascript',body:fixture.outputFiles[0].text}));
    await page.route('**/worlds.html',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><style>html,body,#stackedStage{width:100%;height:100%;margin:0;overflow:hidden;background:#07131e}canvas{display:block}</style><script type="importmap">{"imports":{"pixi.js":"/dist/stacked/stacked-pixi-v1.js"}}</script><div id="stackedStage"></div><script type="module" src="/.tmp/worlds.js"></script>'}));
    await page.goto(origin+'/worlds.html');await page.waitForFunction(()=>window.visualizerQa);
    const signatures=[],scenes=[];let now=1000;
    for(const mode of ['living','aurora','orbit','spectrum']) {
      await page.evaluate(mode=>window.visualizerQa.mode(mode),mode);
      now+=2500;
      const info=await page.evaluate(now=>window.visualizerQa.present(now),now);assert.equal(info.mode,mode);
      const image=await page.screenshot({path:path.join(out,`${name}-${mode}.png`)});signatures.push(signatureFromPng(image));
      await page.evaluate(()=>window.visualizerQa.clear(4));now+=16;await page.evaluate(now=>window.visualizerQa.present(now),now);
      now+=160;const burst=await page.evaluate(now=>window.visualizerQa.present(now),now);assert.equal(burst.phase,'burst');
      await page.screenshot({path:path.join(out,`${name}-${mode}-clear.png`)});
      scenes.push({mode,particles:info.particles,phase:burst.phase});
    }
    const differences=signatures.slice(1).map((s,i)=>compareSignatures(signatures[i],s));
    assert(differences.every(d=>d.meanDelta>0),JSON.stringify(differences));
    await page.evaluate(()=>{window.visualizerQa.mode('journey');window.visualizerQa.minimal(true);});
    for(const [zone,tick] of [0,10800,25200,43200,64800,90000].entries()) {
      await page.evaluate(tick=>window.visualizerQa.zone(tick+151),tick);now+=2500;
      const info=await page.evaluate(now=>window.visualizerQa.present(now),now);assert(info.particles<=72);
      await page.screenshot({path:path.join(out,`${name}-zone-${zone}-minimal.png`)});
    }
    await page.evaluate(()=>window.visualizerQa.reduced(true));now+=3000;await page.evaluate(now=>window.visualizerQa.present(now),now);
    const still=await page.screenshot({path:path.join(out,`${name}-reduced-motion.png`)});now+=2000;
    const reduced=await page.evaluate(now=>window.visualizerQa.present(now,.9),now);
    const after=await page.screenshot();assert.equal(reduced.phase,'still');assert.deepEqual(after,still,'reduced-motion frame must be pixel-identical despite changing audio/time');
    await page.evaluate(()=>window.visualizerQa.destroy());assert.deepEqual(errors,[]);
    reports.push({name,scenes,differences,allSixZones:true,reducedMotionPixelIdentical:true,errors});await page.close();
  }
} finally {await writeFile(path.join(out,'verification.json'),JSON.stringify({syntheticPresentationFixture:true,reports},null,2));await browser.close();server.close();}
console.log(JSON.stringify(reports));
