import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from '../benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs';
import {startPortalStaticServer} from './hmh-reboot-portal-e2e.mjs';
const out=path.resolve('.tmp/world-camp-browser');await mkdir(out,{recursive:true});
const {server,origin}=await startPortalStaticServer({rootDir:path.resolve('apps/portal')});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-gpu','--ignore-gpu-blocklist','--enable-webgl']});
const results=[];
try {
 for(const [id,viewport,reduced] of [['desktop',{width:1440,height:900},false],['mobile',{width:390,height:844},false],['mobile-reduced',{width:390,height:844},true]]) {
  const context=await browser.newContext({viewport,hasTouch:id!=='desktop',isMobile:id!=='desktop',deviceScaleFactor:1,reducedMotion:reduced?'reduce':'no-preference'});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(origin+'/hmh-reboot/index.html?evidenceSafe=1&telemetry=1&worldTour=camp-hashwood');
  await page.waitForFunction(()=>document.querySelector('#hmhRebootStage')?.dataset.startupArt==='ready');
  const cdp=await context.newCDPSession(page);const start=Date.now();let previousKeys=[],touchActive=false;
  while(Date.now()-start<12000) {
   const p=await page.locator('#hmhRebootStage').evaluate(s=>({x:Number(s.dataset.actorX),y:Number(s.dataset.actorY)}));
   const dx=7417-p.x,dy=2867-p.y;if(Math.hypot(dx,dy)<25)break;
   const len=Math.hypot(dx,dy);
   if(id==='desktop') {
    for(const key of previousKeys)await page.keyboard.up(key);
    previousKeys=[...(Math.abs(dx)>15?[dx>0?'KeyD':'KeyA']:[]),...(Math.abs(dy)>15?[dy>0?'KeyS':'KeyW']:[])];
    for(const key of previousKeys)await page.keyboard.down(key);
   } else {
    const b=await page.locator('[data-hmh-control="move"]').boundingBox();const centre={x:b.x+b.width/2,y:b.y+b.height/2,id:1};
    if(touchActive)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[centre]});touchActive=true;
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...centre,x:centre.x+45*dx/len,y:centre.y+45*dy/len}]});
   }
   await page.waitForTimeout(120);
  }
  for(const key of previousKeys)await page.keyboard.up(key);if(touchActive)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForTimeout(800);
  const d=await page.locator('#hmhRebootStage').evaluate(s=>({...s.dataset}));
  assert.ok(Math.hypot(Number(d.actorX)-7417,Number(d.actorY)-2867)<50,`${id}: normal movement must reach camp`);
  assert.ok(Number(d.worldCampfireLights)>=1,`${id}: actual campfire is rendered`);
  assert.ok(reduced?Number(d.worldCampfireEmbers)===0:Number(d.worldCampfireEmbers)>0);
  await page.screenshot({path:path.join(out,id+'-full.png')});
  await page.keyboard.press('Escape');await page.evaluate(()=>document.querySelectorAll('.hmh-modal-layer').forEach(n=>n.style.display='none'));
  await page.locator('#hmhRebootStage canvas').screenshot({path:path.join(out,id+'-world.png')});
  assert.deepEqual(errors,[]);results.push({id,reduced,errors,actorX:d.actorX,actorY:d.actorY,lights:d.worldCampfireLights,embers:d.worldCampfireEmbers,cameraZoom:d.cameraZoom});
  await context.close();
 }
 await writeFile(path.join(out,'report.json'),JSON.stringify({status:'PASS',results},null,2));console.log(JSON.stringify(results));
}finally{await browser.close();server.close();}
