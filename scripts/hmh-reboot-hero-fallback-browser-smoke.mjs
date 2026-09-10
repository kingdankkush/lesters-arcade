import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '../benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs';
import { createPrototypeHumanoidDescriptor, measureMinimumPrototypeBodyHeight } from '../apps/hmh-reboot/src/prototype-actor-art.mjs';
const origin = process.env.HMH_REBOOT_ORIGIN ?? 'http://127.0.0.1:8791';
const metadataUrl = `${origin}/assets/generated/hmh-reboot-production-heroes/lit-commando/lit-commando-production-pilot-atlas.json`;
const response = await fetch(metadataUrl); assert.equal(response.status, 200);
const original = await response.json();
const bodyHeight = measureMinimumPrototypeBodyHeight(createPrototypeHumanoidDescriptor({ radius: 24, bodyColor: 0x49ddff, weapon: true }));
const output = new URL('../.hermes/evidence/hmh-textured-fallback/', import.meta.url);
await mkdir(output, {recursive:true});
const results=[];
for (const profile of [{name:'desktop',width:1440,height:900,touch:false},{name:'portrait',width:390,height:844,touch:true}]) {
  for (const fault of ['missing-frame','unapproved-native-weapon']) {
    const browser=await chromium.launch({executablePath:String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`,headless:true,args:['--enable-gpu','--ignore-gpu-blocklist']});
    try {
      const page=await browser.newPage({viewport:{width:profile.width,height:profile.height},hasTouch:profile.touch,isMobile:profile.touch,deviceScaleFactor:1});
      const errors=[];page.on('pageerror',error=>errors.push(error.message));
      page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
      const fixture=structuredClone(original);
      if(fault==='missing-frame')fixture.frames.pop();else fixture.nativeWeaponIds=['hash-rail'];
      await page.route(metadataUrl,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(fixture)}));
      await page.goto(`${origin}/hmh-reboot/?telemetry=1&evidenceSafe=1&productionPilot=1&productionHero=lit-commando`,{waitUntil:'networkidle'});
      await page.waitForFunction(()=>{const d=document.querySelector('#hmhRebootStage')?.dataset;return d?.actorArtSource==='pixi-graybox'&&d.actorArtFallbackReason&&Number(d.simulationTick)>30;});
      const read=()=>page.locator('#hmhRebootStage').evaluate(el=>({art:el.dataset.actorArt,reason:el.dataset.actorArtFallbackReason,tick:Number(el.dataset.simulationTick),x:Number(el.dataset.actorX),y:Number(el.dataset.actorY),zoom:Number(el.dataset.cameraZoom)}));
      const before=await read();assert.equal(before.art,'prototype-human-graybox');assert.match(before.reason,fault==='missing-frame'?/648/:/unapproved native/);
      await page.locator('canvas').focus();
      let cdp;
      if(profile.touch){
        const box=await page.locator('[data-hmh-control="move"]').boundingBox();assert.ok(box);
        cdp=await page.context().newCDPSession(page);
        const x=box.x+box.width/2,y=box.y+box.height/2;
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:77}]});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+box.width*.3,y,id:77}]});
      }else await page.keyboard.down('d');
      await page.waitForTimeout(500);
      const after=await read();
      if(cdp)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await page.keyboard.up('d');
      assert.ok(after.tick>before.tick+2);
      const moved=Math.hypot(after.x-before.x,after.y-before.y);assert.ok(moved>1,`${profile.name} fallback did not move`);
      const ratio=bodyHeight*after.zoom/profile.height,rounding=bodyHeight*.0005/profile.height;
      assert.ok(ratio+rounding>=.12,`fallback body lower bound below 12%: ${ratio}`);
      const screenshot=new URL(`${profile.name}-${fault}.png`,output);
      await page.screenshot({path:fileURLToPath(screenshot),fullPage:true});
      assert.deepEqual(errors,[]);
      results.push({profile:profile.name,injectedMetadataFault:fault,before,after,moved,bodyHeight,conservativeViewportRatio:ratio,uncaughtErrors:errors});
      await writeFile(new URL('report.json',output),JSON.stringify({expectedCases:4,cases:results},null,2));
    }finally{await browser.close();}
  }
}
assert.equal(results.length,4);
console.log(JSON.stringify({passed:true,expectedCases:4,cases:results},null,2));
