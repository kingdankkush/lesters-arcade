import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from '../benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs';
import {startPortalStaticServer} from './hmh-reboot-portal-e2e.mjs';
const root=path.resolve(import.meta.dirname,'..'),out=process.env.STACKED_PARTICLE_EVIDENCE_DIR||path.join(root,'.tmp/stacked-particles');
await mkdir(out,{recursive:true});
const fixture=await build({entryPoints:[path.join(root,'scripts/stacked-particles-qa-entry.mjs')],write:false,bundle:true,format:'esm',external:['pixi.js'],platform:'browser'});
const {server,origin}=await startPortalStaticServer({rootDir:path.join(root,'apps/portal')});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const reports=[];
try{
 for(const [name,width,height,mobile] of [['desktop',1440,900,false],['phone',390,700,true],['small-phone',320,568,true],['landscape',844,330,true]]){
  const context=await browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/particle-qa.js',r=>r.fulfill({contentType:'text/javascript',body:fixture.outputFiles[0].text}));
  await page.route('**/particle-qa.html',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#stackedStage{width:100%;height:100%;margin:0;overflow:hidden;background:#07131e}canvas{display:block}</style><script type="importmap">{"imports":{"pixi.js":"/dist/stacked/stacked-pixi-v1.js"}}</script><div id="stackedStage"></div><script type="module" src="/particle-qa.js"></script>'}));
  await page.goto(origin+'/particle-qa.html');await page.waitForFunction(()=>window.particleQa);
  const scenes=[];
  for(const event of ['move','rotate','drop','lock',1,2,3,4]){
   const state=await page.evaluate(event=>window.particleQa.scene(event),event);
   assert.ok(Number(state.gameplayParticles)>0);if(mobile)assert.equal(state.visualizerMode,'living');
   await page.screenshot({path:path.join(out,`${name}-${event}.png`)});scenes.push({event,...state});
  }
  const combo=await page.evaluate(()=>window.particleQa.scene(4,{combo:6}));assert.equal(combo.clearTier,'4');
  await page.screenshot({path:path.join(out,`${name}-combo.png`)});
  const bounded=await page.evaluate(()=>window.particleQa.soak());assert.ok(Number(bounded.gameplayParticles)<=Number(bounded.particleCapacity));
  const expired=await page.evaluate(()=>window.particleQa.after(2000));assert.equal(expired.gameplayParticles,'0');
  const reduced=await page.evaluate(()=>window.particleQa.scene(4,{reduced:true}));assert.equal(reduced.gameplayParticles,'0');
  await page.screenshot({path:path.join(out,`${name}-reduced-motion.png`)});
  await page.evaluate(()=>window.particleQa.destroy());assert.deepEqual(errors,[]);
  reports.push({name,scenes,combo,bounded,expired,reduced,errors});await context.close();
 }
}finally{await writeFile(path.join(out,'verification.json'),JSON.stringify({syntheticPresentationFixture:true,physicalDeviceCertification:false,reports},null,2));await browser.close();server.close();}
console.log(JSON.stringify({viewports:reports.length,allEvents:true,boundedAfter3000Clears:true,errors:reports.flatMap(r=>r.errors)}));
