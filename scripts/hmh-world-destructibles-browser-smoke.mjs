import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '../benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs';
import { startPortalStaticServer } from './hmh-reboot-portal-e2e.mjs';
import { WORLD_DESTRUCTIBLES } from '../apps/hmh-reboot/src/world-destructibles.mjs';

const evidence=path.resolve('.tmp/hmh-world-destructibles-browser');await mkdir(evidence,{recursive:true});
const {server,origin}=await startPortalStaticServer({rootDir:path.resolve('apps/portal')});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-gpu','--ignore-gpu-blocklist','--enable-webgl']});
const report=[];
const sample=page=>page.locator('#hmhRebootStage').evaluate(s=>({...s.dataset}));
try{
  for(const d of WORLD_DESTRUCTIBLES.filter(d=>!process.env.HMH_COVER_ID||d.id===process.env.HMH_COVER_ID)){
    const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1}),errors=[];
    page.on('pageerror',error=>{errors.push(error.message);console.error(error.stack);});
    page.on('response',response=>{if(response.status()>=400)console.error(response.status(),response.url());});
    await page.goto(`${origin}/hmh-reboot/index.html?evidenceSafe=1&telemetry=1&worldTour=cover-${d.id}`,{waitUntil:'networkidle'});
    await page.waitForFunction(()=>document.querySelector('#hmhRebootStage')?.dataset.heroMotionStatus==='ready').catch(async error=>{
      console.error(await sample(page));console.error(await page.locator('body').textContent());await page.screenshot({path:path.join(evidence,`${d.id}-failed.png`)});throw error;
    });
    await page.locator('canvas').focus();
    const before=await sample(page);assert.ok(!JSON.parse(before.worldDestructiblesBroken).includes(d.id));
    const zoom=Number(before.cameraZoom);
    await page.mouse.move(Number(before.actorScreenX)+(d.anchor.x-Number(before.actorX))*zoom,Number(before.actorScreenY)+(d.anchor.y-Number(before.actorY))*zoom-20*zoom);
    await page.screenshot({path:path.join(evidence,`${d.id}-intact.png`)});
    // Mouse intent expires when left idle, returning to automatic targeting.
    // Track the cache as the camera follows recoil and nearby combat.
    for(let i=0;i<100;i++){
      const state=await sample(page);if(JSON.parse(state.worldDestructiblesBroken).includes(d.id))break;
      const z=Number(state.cameraZoom);
      await page.mouse.move(Number(state.actorScreenX)+(d.anchor.x-Number(state.actorX))*z+(i%2)*.1,Number(state.actorScreenY)+(d.anchor.y-Number(state.actorY))*z);
      await page.waitForTimeout(200);
    }
    const broken=await sample(page);
    assert.ok(JSON.parse(broken.worldDestructiblesBroken).includes(d.id),`cover did not break: ${JSON.stringify(broken)}`);
    assert.ok(JSON.parse(broken.worldOpenGates).includes(d.id));assert.ok(!JSON.parse(broken.worldSuppliesCollected).includes(d.id));
    await page.screenshot({path:path.join(evidence,`${d.id}-broken.png`)});
    // Combat knockback can move the player sideways during the shooting step.
    // Walk toward the actual supply instead of assuming the starting column.
    const keys=['KeyW','KeyA','KeyS','KeyD'];
    try {
      for(let i=0;i<120;i++){
        const state=await sample(page);if(JSON.parse(state.worldSuppliesCollected).includes(d.id))break;
        const dx=d.supply.x-Number(state.actorX),dy=d.supply.y-Number(state.actorY);
        const active=new Set([...(Math.abs(dx)>8?[dx>0?'KeyD':'KeyA']:[]),...(Math.abs(dy)>8?[dy>0?'KeyS':'KeyW']:[])]);
        for(const key of keys)await page.keyboard[active.has(key)?'down':'up'](key);
        await page.waitForTimeout(100);
      }
    } finally {for(const key of keys)await page.keyboard.up(key);}
    const collected=await sample(page);
    await writeFile(path.join(evidence,`${d.id}-state.json`),JSON.stringify({before,broken,collected},null,2));
    assert.equal(JSON.parse(collected.worldSuppliesCollected).filter(id=>id===d.id).length,1,`supply not collected: ${JSON.stringify(collected)}`);
    assert.equal(Number(collected.audioUnknownCues),0);assert.deepEqual(errors,[]);
    await page.screenshot({path:path.join(evidence,`${d.id}-collected.png`)});
    report.push({id:d.id,before,broken,collected,errors});await page.close();
    console.log(`${d.id}: shoot, break, open passage and collect passed`);
  }
  await writeFile(path.join(evidence,'report.json'),JSON.stringify({status:'pass',cases:report},null,2)+'\n');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
