import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {CHIKUN_CLIPS} from '../apps/chikun/src/character.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE_PATH||'playwright');
const origin=process.env.CHIKUN_PORTAL_ORIGIN||'http://127.0.0.1:8794';
const out=path.resolve(process.env.CHIKUN_QA_OUTPUT||'.tmp/chikun-polish');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const results=[],errors=[];
const watch=page=>page.on('pageerror',e=>errors.push(e.message));
async function enter(page) {
 await page.goto(origin,{waitUntil:'networkidle'});
 await page.locator('#officialGuestEnterButton').click();
 await page.locator('.official-cabinet-card.playable').filter({hasText:"Chikun's Escape"}).click();
 await page.locator('#officialFreeModeButton').click();
 return (await (await page.waitForSelector('iframe.chikun-game-frame')).contentFrame());
}
try {
 for(const [name,viewport] of [['desktop',{width:1440,height:1000}],['phone',{width:390,height:844}]]) {
  const page=await browser.newPage({viewport,serviceWorkers:'block',reducedMotion:'reduce'});watch(page);
  await page.addInitScript(()=>{
   window.__drawnClips=[];
   const draw=CanvasRenderingContext2D.prototype.drawImage;
   CanvasRenderingContext2D.prototype.drawImage=function(img,...args){
    if(img?.src?.includes('/chikun-flight-v3/')&&!img.src.endsWith('poster.webp'))window.__drawnClips.push(img.src.split('/').at(-1));
    if(window.__drawnClips.length>1000)window.__drawnClips.shift();
    return draw.call(this,img,...args);
   };
  });
  await page.goto(origin+'/chikun/flight-room.html',{waitUntil:'networkidle'});
  assert.equal(await page.locator('#clips button').count(),21);
  const samples=[];
  for(const clip of Object.keys(CHIKUN_CLIPS)) {
   await page.locator('#clips button').filter({hasText:clip.replaceAll('_',' ')}).click();
   await page.locator('#pose').fill('12');
   await page.waitForFunction(name=>window.__drawnClips.includes(name+'.webp'),clip);
   samples.push(clip);
  }
  await page.waitForTimeout(200);
  await page.screenshot({path:path.join(out,`flight-room-${name}.png`),fullPage:true});
  const frozen=await page.locator('#stage').screenshot();
  await page.waitForTimeout(250);
  assert.deepEqual(await page.locator('#stage').screenshot(),frozen,'reduced-motion Flight Room remains paused');
  assert.equal(await page.locator('body').evaluate(e=>e.scrollWidth<=innerWidth),true,'no horizontal overflow');
  results.push({name,clipsReviewed:samples,pausedPixelsStable:true});await page.close();
 }
 const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,serviceWorkers:'block'});watch(page);
 let failImages=true;
 await page.route('**/assets/generated/chikun-flight-v3/*.webp',route=>failImages?route.abort('failed'):route.continue());
 const frame=await enter(page);
 await frame.locator('#startButton').filter({hasText:'Retry character download'}).waitFor();
 assert.match(await frame.locator('#assetStatus').textContent(),/could not load/);
 await frame.locator('#chikunCanvas').focus();
 await page.keyboard.press('Space');
 assert.notEqual(await frame.locator('#gameShell').getAttribute('data-phase'),'running','missing character cannot start a run');
 await frame.locator('#startButton').filter({hasText:'Retry character download'}).waitFor();
 failImages=false;
 await frame.locator('#startButton').click();
 await frame.locator('#startButton').filter({hasText:'Tap to Escape'}).waitFor();
 await frame.waitForFunction(()=>document.querySelector('#assetStatus').hidden);
 await page.screenshot({path:path.join(out,'download-recovered-phone.png')});
 await frame.locator('#startButton').click();
 await frame.locator('#restartButton').waitFor({state:'visible'});
 const score=await frame.locator('#resultScore').textContent();
 assert.match(await frame.locator('#resultStats').textContent(),/ground|obstacle|ceiling/i);
 await frame.locator('#watchReplayButton').click();
 await frame.locator('#replaySpeed').selectOption('2');
 await frame.locator('#replayTimeline').focus();
 await page.keyboard.press('Home');
 assert.match(await frame.locator('#replayTime').textContent(),/^0\.0/);
 await page.keyboard.press('End');
 assert.equal(await frame.locator('#replayTimeline').getAttribute('aria-valuenow'),'100');
 assert.equal(await frame.locator('#resultScore').textContent(),score,'replay speed/seeking cannot change result');
 await page.screenshot({path:path.join(out,'replay-phone.png')});
 await frame.locator('#restartButton').click();
 await frame.locator('#pauseButton').click();
 assert.equal(await frame.locator('#resumeButton').evaluate(e=>e===document.activeElement),true);
 results.push({failureRecovery:true,missingHeroBlocksLaunch:true,replaySpeedAndKeyboardSeek:true,resultUnchanged:true,pauseFocus:true});
 await page.close();assert.deepEqual(errors,[]);
}finally{await browser.close();await writeFile(path.join(out,'report.json'),JSON.stringify({origin,results,errors},null,2));}
console.log(JSON.stringify({origin,results,errors},null,2));
