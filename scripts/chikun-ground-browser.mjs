import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE_PATH||'C:/Users/just_/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const origin=process.env.CHIKUN_PORTAL_ORIGIN||'http://127.0.0.1:8798';
const out=path.resolve(process.env.CHIKUN_QA_OUTPUT||'../../outputs/browser');await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const reports=[];
async function capture(page,options){const session=await page.context().newCDPSession(page);const {data}=await session.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(options.path,Buffer.from(data,'base64'));await session.detach();}
function flightClock(){
 let now=1000,id=0;const callbacks=new Map();window.__messages=[];
 window.requestAnimationFrame=fn=>{callbacks.set(++id,fn);return id;};window.cancelAnimationFrame=id=>callbacks.delete(id);performance.now=()=>now;
 window.__advance=(ticks,hz=60)=>{for(let i=0;i<ticks;i++){now+=1000/hz;const batch=[...callbacks.values()];callbacks.clear();for(const fn of batch)fn(now);}};
 const post=MessagePort.prototype.postMessage;MessagePort.prototype.postMessage=function(m,...args){if(m?.protocol==='chikun-bridge/v1')__messages.push(structuredClone(m));return post.call(this,m,...args);};
}
try{
 for(const [name,width,height] of [['desktop',1440,1000],['portrait',390,844],['landscape',844,390]]){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,hasTouch:name!=='desktop',serviceWorkers:'block'});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/dist/chikun/game.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:'('+flightClock.toString()+')();\n'+await response.text()});});
  await page.goto(origin,{waitUntil:'networkidle'});await page.locator('#officialGuestEnterButton').click();await page.locator('.official-cabinet-card.playable').filter({hasText:"Chikun's Escape"}).click();await page.locator('#officialFreeModeButton').click();
  const node=page.locator('iframe.chikun-game-frame');await node.waitFor();const frame=await node.elementHandle().then(h=>h.contentFrame());
  await frame.locator('#startButton').waitFor({state:'visible'});await frame.waitForFunction(()=>!document.querySelector('#startButton').disabled,null,{polling:50});await frame.evaluate(()=>__advance(2));
  await capture(page,{path:path.join(out,name+'-start.png')});
  await frame.locator('#startButton').click({force:true});await frame.evaluate(()=>__advance(90));await capture(page,{path:path.join(out,name+'-running.png')});
  // One real input latched across high refresh frames, then a second enters flight.
  await frame.locator('#chikunCanvas').press('Space');await frame.evaluate(()=>__advance(8,240));await capture(page,{path:path.join(out,name+'-jump.png')});
  await frame.locator('#chikunCanvas').press('Space');await frame.evaluate(()=>__advance(20));await capture(page,{path:path.join(out,name+'-takeoff.png')});
  await frame.locator('#pauseButton').click({force:true});const paused=await frame.evaluate(()=>__messages.filter(m=>m.type==='game:state').at(-1).payload.survivalTicks);await frame.evaluate(()=>__advance(120));
  assert.equal(await frame.evaluate(()=>__messages.filter(m=>m.type==='game:state').at(-1).payload.survivalTicks),paused);
  await frame.locator('#resumeButton').click({force:true});await frame.evaluate(()=>__advance(550));
  const result=await frame.evaluate(()=>__messages.find(m=>m.type==='game:result')?.payload);assert.ok(result,'canonical result received');assert.equal(result.evidence.version,'chikun-flap-evidence-v3');assert.equal(result.evidence.flapSteps.length,2);
  await capture(page,{path:path.join(out,name+'-ragdoll.png')});await frame.evaluate(()=>__advance(370));await frame.locator('#watchReplayButton').waitFor({state:'visible'});await capture(page,{path:path.join(out,name+'-result.png')});
  await frame.locator('#watchReplayButton').click({force:true});await frame.evaluate(()=>__advance(45));await frame.locator('#replayTimeline').press('End');const after=await frame.evaluate(()=>__messages.filter(m=>m.type==='game:result').length);assert.equal(after,1,'replay never submits scores');
  await frame.locator('#restartButton').click({force:true});await frame.waitForFunction(()=>__messages.filter(m=>m.type==='game:state'&&m.payload.status==='running').length>1,null,{polling:50});await frame.evaluate(()=>__advance(1050));assert.equal(await frame.evaluate(()=>__messages.filter(m=>m.type==='game:result').length),2,'retry has a fresh result');
  assert.deepEqual(errors,[]);reports.push({name,result:result.finalState,inputs:result.evidence.flapSteps,errors});await context.close();
 }
 await writeFile(path.join(out,'browser-report.json'),JSON.stringify(reports,null,2));console.log(JSON.stringify(reports,null,2));
}finally{await browser.close();}


