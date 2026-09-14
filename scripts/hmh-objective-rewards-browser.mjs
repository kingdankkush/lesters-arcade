import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from '../benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs';
import {startPortalStaticServer} from './hmh-reboot-portal-e2e.mjs';
import {OBJECTIVE_REWARDS} from '../apps/hmh-reboot/src/objective-rewards.mjs';
import {WORLD_DESIGN_SITES} from '../apps/hmh-reboot/src/world-design-encounters.mjs';

const output=path.resolve(process.env.HMH_EVIDENCE??'work/qa/objectives');
await mkdir(output,{recursive:true});
const {server,origin:local}=await startPortalStaticServer({rootDir:path.resolve('apps/portal')});
const origin=process.env.HMH_REBOOT_ORIGIN??local;
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-gpu','--ignore-gpu-blocklist','--enable-webgl']});
const results=[];
try {
  for(const mobile of [false,true]) for(const siteId of ['relay-power','ravine-winch','yard-warehouse']) {
    const site=WORLD_DESIGN_SITES.find(s=>s.id===siteId), reward=OBJECTIVE_REWARDS.find(r=>r.objectiveId===siteId);
    const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},deviceScaleFactor:1,isMobile:mobile,hasTouch:mobile});
    const page=await context.newPage(),cdp=await context.newCDPSession(page),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.goto(`${origin}/hmh-reboot/index.html?evidenceSafe=1&telemetry=1&worldTour=site-${siteId}`,{waitUntil:'networkidle'});
    await page.waitForFunction(()=>document.querySelector('#hmhRebootStage')?.dataset.startupArt==='ready');
    const sample=()=>page.locator('#hmhRebootStage').evaluate(s=>({...s.dataset}));
    const before=await sample();
    assert.ok(!JSON.parse(before.worldOpenGates).includes(site.gateId));
    assert.deepEqual(JSON.parse(before.objectiveRewards),[]);
    const moveY=async target=>{
      const current=Number((await sample()).actorY),sign=Math.sign(target-current);
      if(Math.abs(target-current)<5)return;
      if(mobile){
        const box=await page.locator('[data-hmh-control="move"]').boundingBox();
        const center={x:box.x+box.width/2,y:box.y+box.height/2};
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...center,id:1}]});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:center.x,y:center.y+sign*45,id:1}]});
      }else await page.keyboard.down(sign<0?'KeyW':'KeyS');
      try{await page.waitForFunction(({target,sign})=>sign*(Number(document.querySelector('#hmhRebootStage').dataset.actorY)-target)>=-4,{target,sign},{timeout:10000});}
      finally{if(mobile)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await page.keyboard.up(sign<0?'KeyW':'KeyS');}
    };
    await moveY(site.y);
    await page.waitForFunction(id=>JSON.parse(document.querySelector('#hmhRebootStage').dataset.worldOpenGates).includes(id),site.gateId);
    await page.screenshot({path:path.join(output,`${siteId}-${mobile?'touch':'desktop'}-open.png`)});
    await moveY(reward.y+35);
    await page.waitForFunction(id=>JSON.parse(document.querySelector('#hmhRebootStage').dataset.objectiveRewards).some(([key,n])=>key===id&&n===1),reward.id);
    const collected=await sample();
    assert.equal(collected.weaponId,{'relay-power':'scatter-shotgun','ravine-winch':'hash-rail','yard-warehouse':'bear-market-burner'}[siteId]);
    await page.screenshot({path:path.join(output,`${siteId}-${mobile?'touch':'desktop'}-collected.png`)});
    await moveY(site.y+70);
    assert.equal(JSON.parse((await sample()).objectiveRewards).find(([id])=>id===reward.id)[1],1);
    await page.locator('#hmhMenuToggle').click();
    await page.waitForFunction(()=>document.querySelector('#hmhFieldMap')?.textContent.includes('collected'));
    await page.locator('#hmhFieldMap').scrollIntoViewIfNeeded();
    const map=await page.locator('#hmhFieldMap').innerText();
    assert.ok(map.includes(reward.rewardName));
    await page.screenshot({path:path.join(output,`${siteId}-${mobile?'touch':'desktop'}-map.png`)});
    assert.deepEqual(errors,[]);
    results.push({siteId,mobile,beforeY:Number(before.actorY),collectedY:Number(collected.actorY),reward:reward.rewardName,errors});
    console.log(JSON.stringify(results.at(-1)));
    await context.close();
  }
}finally{
  await writeFile(path.join(output,'report.json'),JSON.stringify({origin,results},null,2));
  await browser.close();await new Promise(resolve=>server.close(resolve));
}
