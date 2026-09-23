import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createChikunRuntime,flapTicksOf} from '../apps/portal/src/chikun-cabinet.mjs';
import {buildChikunDailyChallenge} from '../apps/portal/src/chikun-daily-challenge.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE_PATH||'playwright');
const origin=process.env.CHIKUN_PORTAL_ORIGIN||'http://127.0.0.1:8794';
const out=path.resolve(process.env.CHIKUN_QA_OUTPUT||'../open-air-browser');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const viewport=process.env.CHIKUN_VIEWPORT==='mobile'?{width:390,height:844}:{width:1440,height:1000};
const context=await browser.newContext({viewport,hasTouch:viewport.width<500,deviceScaleFactor:viewport.width<500?2:1,serviceWorkers:'block',...(process.env.CHIKUN_BROWSER_STORAGE_STATE?{storageState:process.env.CHIKUN_BROWSER_STORAGE_STATE,extraHTTPHeaders:{'x-vercel-skip-toolbar':'1'}}:{})});
const page=await context.newPage();
const issues=[];
page.on('pageerror',e=>issues.push(e.message));
page.on('console',message=>{if(message.type()==='error')issues.push(message.text());});
// Exercise the actual child loop at 240 Hz. Only this test controls its clock;
// production has no test hooks, changed physics, or supplied score results.
function installFlightClock(){
 if(!location.pathname.includes('/chikun/'))return;
 let time=1000,serial=0;const callbacks=new Map();
 window.requestAnimationFrame=cb=>{callbacks.set(++serial,cb);return serial;};
 window.cancelAnimationFrame=id=>callbacks.delete(id);
 performance.now=()=>time;
 window.__flightTestAdvance=(delta)=>{time+=delta;const batch=[...callbacks.values()];callbacks.clear();batch.forEach(cb=>cb(time));};
 window.__flightTestMessages=[];
 const post=MessagePort.prototype.postMessage;
 MessagePort.prototype.postMessage=function(message,...args){if(message?.protocol==='chikun-bridge/v1')window.__flightTestMessages.push(structuredClone(message));return post.call(this,message,...args);};
}
await page.route('**/dist/chikun/game.js', async route=>{
 const response=await route.fetch();
 await route.fulfill({response,body:'('+installFlightClock.toString()+')();\n'+await response.text()});
});
try {
 await page.goto(origin,{waitUntil:'networkidle'});
 await page.locator('#officialGuestEnterButton').click();
 await page.locator('.official-cabinet-card.playable').filter({hasText:"Chikun's Escape"}).click();
 await page.locator('#officialFreeModeButton').click();
 const node=page.locator('iframe.chikun-game-frame');await node.waitFor();
 const frame=await node.elementHandle().then(h=>h.contentFrame());
 await frame.locator('#startButton').waitFor();
 await frame.waitForFunction(()=>document.querySelector('#liveStatus').textContent.includes('Ready for Free Mode.'),null,{polling:50});
 const playfield=await frame.locator('#chikunCanvas').boundingBox();
 await page.screenshot({path:path.join(out,'start.png')});
 if(playfield.width<viewport.width*.97) console.log(JSON.stringify({playfield,containers:await page.locator('.official-app,.gameplay-view,.official-combat-mount,iframe.chikun-game-frame').evaluateAll(els=>els.filter(e=>e.getBoundingClientRect().width).map(e=>({class:e.className,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height,display:getComputedStyle(e).display,padding:getComputedStyle(e).padding})))}));
 assert.ok(Math.abs(playfield.width/playfield.height-(viewport.width<500?9/16:16/9))<.01,'playfield fits the requested orientation');
 assert.ok(playfield.width>=viewport.width*.97,'game uses the full available width');
 await page.screenshot({path:path.join(out,'start.png')});
 await frame.locator('#startButton').click({force:true});
 await frame.evaluate(()=>{for(let i=0;i<950;i++)__flightTestAdvance(1000/240);});
 const first=await frame.evaluate(()=>__flightTestMessages.find(m=>m.type==='game:result')?.payload);
 assert.ok(first,'first flight must finish');
 assert.ok(flapTicksOf(first.evidence).includes(0),'a launch tap must survive multiple 240 Hz frames before the first 60 Hz simulation step');
 await page.waitForFunction(()=>{const a=document.querySelector('#arcadeMusicAudio');return !a.paused && a.currentTime>0;},null,{timeout:15000});
 const firstTrack=await page.locator('#arcadeMusicAudio').getAttribute('data-track-id');
 await frame.locator('#restartButton').click({force:true});
 await page.waitForFunction(previous=>{const a=document.querySelector('#arcadeMusicAudio');return a.dataset.trackId!==previous&&!a.paused&&a.currentTime>0;},firstTrack,{timeout:15000}).catch(async error=>{console.log(JSON.stringify({audio:await page.locator('#arcadeMusicAudio').evaluate(a=>({track:a.dataset.trackId,paused:a.paused,time:a.currentTime,error:a.error?.message,src:a.currentSrc})),messages:await frame.evaluate(()=>__flightTestMessages.slice(-4)),issues}));throw error;});
 const secondTrack=await page.locator('#arcadeMusicAudio').getAttribute('data-track-id');
 const seed=buildChikunDailyChallenge().seed;
 const pilot=createChikunRuntime({seed,maxTicks:216000});
 const samples=[];
 let lastCapture=-1;
 for(let tick=0;tick<2100&&!pilot.terminal;tick++) {
  const snap=pilot.snapshot();
  const next=snap.forks.find(f=>!f.passed && f.x+f.width>snap.chikun.x-snap.chikun.radius);
  const target=next?.gapCenter??360;
  const flap=tick===0||snap.chikun.y>target+38||(snap.chikun.velocityY>3.8&&snap.chikun.y>target+26);
  if(flap && tick>0)await page.keyboard.press('Space');
  pilot.step({flap});
  await frame.evaluate(()=>__flightTestAdvance(1000/60+.000001));
  if(next && next.kind!=='gate' && next.x<(viewport.width<500?480:650) && next.x>420 && lastCapture!==next.index) {
   lastCapture=next.index;samples.push({tick,kind:next.kind,x:next.x});
   await page.screenshot({path:path.join(out,`flight-${next.kind}-${next.index}.png`)});
  }
 }
 const state=await frame.evaluate(()=>__flightTestMessages.filter(m=>m.type==='game:state').at(-1)?.payload);
 assert.ok(state.forksPassed>=5,`flight should clear a varied course: ${JSON.stringify(state)}`);
 assert.ok(samples.some(s=>s.kind==='tree')&&samples.some(s=>s.kind==='drone'));
 await frame.locator('#pauseButton').click({force:true});
 await page.waitForFunction(()=>document.documentElement.dataset.gameplayPaused==='true');
 if(viewport.width>=500){
  await frame.locator('#pauseFullscreenButton').click({force:true});
  await frame.waitForFunction(()=>Boolean(document.fullscreenElement),null,{polling:50});
  await frame.evaluate(()=>__flightTestAdvance(0));
  await page.screenshot({path:path.join(out,'fullscreen.png')});
  await frame.locator('#pauseFullscreenButton').click({force:true});
  await frame.waitForFunction(()=>!document.fullscreenElement,null,{polling:50});
 }
 if(viewport.width<500){
  await page.setViewportSize({width:844,height:390});
  await page.waitForTimeout(150);
  await frame.evaluate(()=>__flightTestAdvance(0));
  const landscape=await frame.locator('#chikunCanvas').boundingBox();
  assert.ok(Math.abs(landscape.width/landscape.height-16/9)<.01,'rotating the same run gives a 16:9 landscape view');
  assert.equal(await frame.locator('#pauseOverlay').isVisible(),true);
  await page.screenshot({path:path.join(out,'rotated-landscape.png')});
  await page.setViewportSize(viewport);
  await page.waitForTimeout(150);
 }
 const pausedTrack=await page.locator('#arcadeMusicAudio').getAttribute('data-track-id');
 await frame.locator('#pauseMusicButton').click({force:true});
 await page.locator('#arcadeMusicPlayer[data-expanded="true"]').waitFor({state:'visible'});
 const bounds=await page.locator('#arcadeMusicPlayer').boundingBox();
 assert.ok(bounds.x>=0&&bounds.x+bounds.width<=viewport.width+1,'music player fits the viewport');
 await page.screenshot({path:path.join(out,'pause-music.png')});
 await page.locator('#arcadeMusicMuteButton').click();
 assert.equal(await page.locator('#arcadeMusicAudio').evaluate(a=>a.muted),true);
 await page.locator('#arcadeMusicMuteButton').click();
 await page.locator('#arcadeMusicExpandButton').click();
 await page.locator('#arcadeMusicPlayer[data-expanded="false"]').waitFor({state:'attached'});
 await page.waitForTimeout(150);
 const resumeRect=await frame.locator('#resumeButton').boundingBox();
 const resumeHit=await page.evaluate(r=>document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.outerHTML,resumeRect);
 assert.equal(await page.locator('#combatMenuPanel').isVisible(),false,'shared music must not open the legacy combat menu over Chikun');
 await frame.locator('#resumeButton').click({force:true});
 await page.waitForTimeout(50);
 if(!await frame.locator('#pauseOverlay').evaluate(el=>el.classList.contains('is-hidden'))) {
   await page.screenshot({path:path.join(out,'resume-failure.png')});
   console.log(JSON.stringify({resumeRect,resumeHit,messages:await frame.evaluate(()=>__flightTestMessages.slice(-8)),issues}));
 }
 assert.equal(await frame.locator('#pauseOverlay').evaluate(el=>el.classList.contains('is-hidden')),true,'resume closes the pause menu');
 assert.equal(await page.locator('#arcadeMusicAudio').getAttribute('data-track-id'),pausedTrack,'resume preserves the selected song');
 await frame.evaluate(()=>{for(let i=0;i<700;i++)__flightTestAdvance(1000/60+.000001);});
 const completed=await frame.evaluate(()=>__flightTestMessages.filter(m=>m.type==='game:result'));
 assert.equal(completed.length,2,'the second flight must produce its own terminal result');
 const result=completed.at(-1).payload;
 assert.ok(result.forksPassed>=5);
 assert.equal(result.evidence.version,'chikun-flap-evidence-v2');
 assert.equal(result.evidence.seed,seed);
 const report={status:'PASS',origin,viewport,playfield,rotation:viewport.width<500?'portrait-landscape-portrait':'fullscreen-enter-exit',highRefreshHz:240,firstTrack,secondTrack,passes:result.forksPassed,coins:result.coinsCollected,terminalReason:result.finalState.terminalReason,samples,issues};
 assert.deepEqual(issues,[]);
 await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
