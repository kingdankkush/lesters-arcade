// Drives the real Chikun child through one full lap of the seven-region loop
// (farmland → forest → town → city → industrial → suburbs → coast → farmland)
// in headless Chrome and screenshots each region plus the coast→farmland blend.
// Env: CHIKUN_PORTAL_ORIGIN (static portal), PLAYWRIGHT_PACKAGE_PATH,
// CHROME_EXECUTABLE_PATH, CHIKUN_REGIONS_OUTPUT (evidence directory).
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {REGION_SCHEDULE,REGION_LEAD_TICKS,REGION_LOOP_TICKS,REGION_BLEND_TICKS} from '../apps/portal/src/chikun-course-regions.mjs';
import {coursePilot} from './chikun-course-pilot.mjs';

async function loadPlaywright(){
 try{return await import('playwright');}
 catch{
  if(!process.env.PLAYWRIGHT_PACKAGE_PATH)throw new Error('Set PLAYWRIGHT_PACKAGE_PATH to Playwright when it is not installed at the repository root.');
  return createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE_PATH);
 }
}
const {chromium}=await loadPlaywright();
const origin=process.env.CHIKUN_PORTAL_ORIGIN??'http://127.0.0.1:8791';
const out=path.resolve(process.env.CHIKUN_REGIONS_OUTPUT??fileURLToPath(new URL('../.hermes/evidence/chikun-regions-20260916/',import.meta.url)));
const chromePath=process.env.CHROME_EXECUTABLE_PATH??String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`;
await mkdir(out,{recursive:true});

// Deterministic clock injected ahead of the child bundle: frames only advance
// through __advance(frames, hz), so every screenshot lands on an exact tick.
function flightClock(){
 let now=1000,id=0;const callbacks=new Map();window.__messages=[];
 window.requestAnimationFrame=fn=>{callbacks.set(++id,fn);return id;};window.cancelAnimationFrame=id=>callbacks.delete(id);performance.now=()=>now;
 window.__advance=(frames,hz=60)=>{for(let i=0;i<frames;i++){now+=1000/hz;const batch=[...callbacks.values()];callbacks.clear();for(const fn of batch)fn(now);}};
 const post=MessagePort.prototype.postMessage;MessagePort.prototype.postMessage=function(m,...args){if(m?.protocol==='chikun-bridge/v1')__messages.push(structuredClone(m));return post.call(this,m,...args);};
}
// Runs inside the child frame: two fixed steps per frame, pilot decides per frame.
function driveTo({targetTick}){
 const pilot=globalThis.__chikunCoursePilot;
 if(typeof pilot!=='function')throw new Error('course pilot was not injected');
 const canvas=document.querySelector('#chikunCanvas');const started=Date.now();let frames=0;
 for(;;){
  const s=__CHIKUN_QA__.peek();
  if(!s||s.terminal||s.tick>=targetTick)break;
  if(pilot(s))canvas.dispatchEvent(new KeyboardEvent('keydown',{code:'Space',key:' ',bubbles:true,cancelable:true}));
  __advance(1,30);frames++;
 }
 const s=__CHIKUN_QA__.peek(),r=__CHIKUN_QA__.region();
 return {tick:s.tick,terminal:s.terminal,terminalReason:s.terminalReason,score:s.score,forksPassed:s.forksPassed,region:s.region,terrain:s.terrain,speed:s.difficulty.speedMultiplier,level:s.difficulty.level,
  scenery:{region:r.region.id,next:r.next.id,blend:Number(r.blend.toFixed(3)),loop:r.loop},readout:document.querySelector('#routeReadout')?.textContent,frames,msPerFrame:Number(((Date.now()-started)/Math.max(1,frames)).toFixed(2))};
}

const stops=[
 ...REGION_SCHEDULE.map((seg,i)=>({name:`${String(i+1).padStart(2,'0')}-${seg.id}`,tick:REGION_LEAD_TICKS+seg.startTick+Math.floor(seg.ticks/2),expectRegion:seg.id})),
 {name:'08-coast-to-farmland-blend',tick:REGION_LEAD_TICKS+REGION_LOOP_TICKS-Math.floor(REGION_BLEND_TICKS/2),expectRegion:'coast',expectBlend:true},
 {name:'09-farmland-lap-2',tick:REGION_LEAD_TICKS+REGION_LOOP_TICKS+Math.floor(REGION_SCHEDULE[0].ticks/2),expectRegion:'farmland',expectLoop:1},
];
const browser=await chromium.launch({executablePath:chromePath,headless:true});
const issues=[],report=[];
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1,serviceWorkers:'block'});
 const page=await context.newPage();
 page.on('pageerror',e=>issues.push('pageerror: '+e.message));
 page.on('console',m=>{if(m.type()==='error')issues.push('console: '+m.text());});
 await page.addInitScript(()=>{globalThis.__CHIKUN_QA__={};});
 await page.route('**/dist/chikun/game.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:'('+flightClock.toString()+')();\n'+await response.text()});});
 await page.goto(origin,{waitUntil:'networkidle'});
 await page.locator('#officialGuestEnterButton').click();
 await page.locator('.official-cabinet-card.playable').filter({hasText:"Chikun's Escape"}).click();
 await page.locator('#officialFreeModeButton').click();
 const node=page.locator('iframe.chikun-game-frame');await node.waitFor({state:'visible',timeout:15_000});
 const frame=await node.elementHandle().then(h=>h.contentFrame());
 await frame.locator('#startButton').waitFor({state:'visible',timeout:15_000});
 await frame.waitForFunction(()=>!document.querySelector('#startButton').disabled,null,{polling:50,timeout:30_000});
 assert.equal(await frame.evaluate(()=>typeof __advance),'function','the deterministic clock was injected ahead of the child bundle');
 await frame.evaluate(()=>__advance(2));
 const tease=await frame.locator('#modeTease').innerText();
 assert.match(tease,/Daily Challenge — coming soon/i,'Free Mode start screen teases the daily challenge');
 assert.doesNotMatch(tease,/reward|wallet/i,'Free Mode carries no reward or wallet copy');
 await node.screenshot({path:path.join(out,'00-free-mode-start.png')});
 await frame.locator('#startButton').click({force:true});
 await frame.waitForFunction(()=>typeof __CHIKUN_QA__.peek==='function'&&__CHIKUN_QA__.peek()?.tick>=0,null,{polling:50});
 const pilotSource=coursePilot.toString();
 let pilotInjected=false;
 for(const stop of stops){
  if(!pilotInjected){await frame.addScriptTag({content:`window.__chikunCoursePilot=${pilotSource};`});pilotInjected=true;}
  const stat=await frame.evaluate(driveTo,{targetTick:stop.tick}).catch(async error=>{throw new Error(`${stop.name}: ${error.message}`);});
  await frame.evaluate(()=>__advance(1,60));
  const file=path.join(out,stop.name+'.png');await node.screenshot({path:file});
  assert.equal(stat.terminal,false,`${stop.name}: the pilot crashed (${stat.terminalReason}) at tick ${stat.tick}`);
  assert.equal(stat.scenery.region,stop.expectRegion,`${stop.name}: scenery region`);
  assert.equal(stat.region.toLowerCase(),stop.expectRegion,`${stop.name}: snapshot region`);
  if(stop.expectBlend)assert.ok(stat.scenery.blend>.3&&stat.scenery.blend<.7&&stat.scenery.next==='farmland',`${stop.name}: mid-blend into farmland`);
  else assert.equal(stat.scenery.blend,0,`${stop.name}: settled scenery`);
  if(stop.expectLoop!==undefined)assert.equal(stat.scenery.loop,stop.expectLoop,`${stop.name}: lap`);
  assert.match(stat.readout??'',new RegExp(stop.expectRegion,'i'));
  report.push({name:path.basename(file),...stat});
  console.log(JSON.stringify({stop:stop.name,...stat}));
 }
 const laps=report.map(r=>r.speed);
 for(let i=1;i<laps.length;i++)assert.ok(laps[i]>laps[i-1],'speed keeps climbing through the loop');
 assert.ok(report.at(-1).score>report.at(-2).score,'score keeps counting through the loop');
 assert.ok(report.every(r=>r.msPerFrame<40),`frame cost stays sane: ${JSON.stringify(report.map(r=>r.msPerFrame))}`);
 assert.deepEqual(issues,[],`browser issues:\n${issues.join('\n')}`);
 await writeFile(path.join(out,'index.json'),JSON.stringify({status:'PASS',origin,viewport:'1440x1000',stops:report},null,1)+'\n');
 console.log(JSON.stringify({status:'PASS',out,stops:report.length}));
}catch(error){
 console.error(JSON.stringify({status:'FAIL',issues,report},null,2));
 throw error;
}finally{await browser.close();}
