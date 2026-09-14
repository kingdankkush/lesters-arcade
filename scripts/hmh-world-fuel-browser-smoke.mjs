import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from '../benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs';
import {startPortalStaticServer} from './hmh-reboot-portal-e2e.mjs';
import {WORLD_EXPLOSIVE_ZONES} from '../apps/hmh-reboot/src/world-destructibles.mjs';

const output=path.resolve('.tmp/hmh-fuel-browser');await mkdir(output,{recursive:true});
const {server,origin}=await startPortalStaticServer({rootDir:path.resolve('apps/portal')});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-gpu','--ignore-gpu-blocklist','--enable-webgl']});
const results=[];
try {
  for(const zone of WORLD_EXPLOSIVE_ZONES){
    const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    const url=`${origin}/hmh-reboot/?evidenceSafe=1&telemetry=1&worldTour=fuel-${zone.id}`;
    await page.goto(url,{waitUntil:'networkidle'});
    await page.waitForFunction(()=>document.querySelector('#hmhRebootStage')?.dataset.heroMotionStatus==='ready');
    const sample=()=>page.locator('#hmhRebootStage').evaluate(s=>({...s.dataset}));
    const before=await sample();assert.deepEqual(JSON.parse(before.worldFuelExploded),[]);
    const snapshots=[];
    for(let i=0;i<150;i++){
      const state=await sample();snapshots.push({tick:state.simulationTick,broken:state.worldDestructiblesBroken,exploded:state.worldFuelExploded});
      if(JSON.parse(state.worldFuelExploded).filter(id=>id.startsWith(zone.id)).length===3)break;
      const z=Number(state.cameraZoom);
      await page.mouse.move(Number(state.actorScreenX)+(zone.anchor.x-40-Number(state.actorX))*z+(i%2)*.1,Number(state.actorScreenY)+(zone.anchor.y-Number(state.actorY))*z);
      await page.waitForTimeout(120);
    }
    const after=await sample();
    await writeFile(path.join(output,`${zone.id}.json`),JSON.stringify({before,after,snapshots,errors},null,2));
    assert.equal(JSON.parse(after.worldFuelExploded).filter(id=>id.startsWith(zone.id)).length,3,zone.id);
    assert.equal(Number(after.audioUnknownCues),0);assert.deepEqual(errors,[]);
    await page.screenshot({path:path.join(output,`${zone.id}.png`)});
    await page.reload({waitUntil:'networkidle'});
    await page.waitForFunction(()=>document.querySelector('#hmhRebootStage')?.dataset.heroMotionStatus==='ready');
    const restarted=await sample();assert.deepEqual(JSON.parse(restarted.worldFuelExploded),[]);
    results.push({id:zone.id,chainExplosions:3,restartClears:true,errors});await page.close();
    console.log(`${zone.id}: chain and fresh-run reset passed`);
  }
  await writeFile(path.join(output,'report.json'),JSON.stringify({status:'pass',results},null,2));
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
