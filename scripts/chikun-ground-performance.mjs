import {createRequire} from 'node:module';import {mkdir,writeFile} from 'node:fs/promises';
import {auditRun} from './chikun-course-audit.mjs';import {buildChikunDailyChallenge} from '../apps/portal/src/chikun-daily-challenge.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE_PATH||'C:/Users/just_/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const seed=buildChikunDailyChallenge().seed,inputs=auditRun(seed,7200).evidence.flapSteps;
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const out=process.env.CHIKUN_QA_OUTPUT||'../../outputs/qa';await mkdir(out,{recursive:true});const reports=[];
function measure(inputs){
 const original=requestAnimationFrame,perf=window.__perf={costs:[],intervals:[],longTasks:[],last:0,start:0,index:0,states:[],memory:[]};
 try{new PerformanceObserver(list=>{for(const e of list.getEntries())perf.longTasks.push(e.duration);}).observe({type:'longtask',buffered:true});}catch{}
 const post=MessagePort.prototype.postMessage;MessagePort.prototype.postMessage=function(m,...args){if(m?.type==='game:state'&&m.payload.status==='running'){perf.states.push(m.payload);if(m.payload.survivalTicks===0){perf.start=performance.now();perf.index=0;}}return post.call(this,m,...args);};
 window.requestAnimationFrame=cb=>original.call(window,time=>{
  const active=document.querySelector('[data-phase="running"]');
  if(active&&perf.start){const target=(time-perf.start)*.06;while(inputs[perf.index]<=target){document.querySelector('#chikunCanvas').dispatchEvent(new KeyboardEvent('keydown',{key:' ',code:'Space',bubbles:true}));perf.index++;}}
  const start=performance.now();cb(time);const cost=performance.now()-start;
  if(active){perf.costs.push(cost);if(perf.last)perf.intervals.push(time-perf.last);perf.last=time;if(perf.costs.length%120===0)perf.memory.push(performance.memory?.usedJSHeapSize??null);}else perf.last=0;
 });
}
const quantile=(a,p)=>{a=[...a].sort((x,y)=>x-y);return Number((a[Math.floor((a.length-1)*p)]??0).toFixed(2));};
try{
 for(const [name,width,height,cpu]of [['desktop',1440,1000,1],['portrait',390,844,4],['landscape',844,390,4]]){
  const ctx=await browser.newContext({viewport:{width,height},serviceWorkers:'block',hasTouch:width<900});const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/dist/chikun/game.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:'('+measure.toString()+')('+JSON.stringify(inputs)+');\n'+await response.text()});});
  await page.goto('http://127.0.0.1:8798/',{waitUntil:'networkidle'});await page.locator('#officialGuestEnterButton').click();await page.locator('.official-cabinet-card.playable').filter({hasText:"Chikun's Escape"}).click();await page.locator('#officialFreeModeButton').click();
  const frame=await page.locator('iframe.chikun-game-frame').elementHandle().then(h=>h.contentFrame());await frame.waitForFunction(()=>!document.querySelector('#startButton')?.disabled);const cdp=await ctx.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:cpu});
  await frame.locator('#startButton').click();console.log(name+' ordinary-clock run started');await page.waitForTimeout(45000);const p=await frame.evaluate(()=>__perf);
  const report={name,cpuThrottle:cpu,activeFrames:p.costs.length,lastState:p.states.at(-1),costMs:{p50:quantile(p.costs,.5),p95:quantile(p.costs,.95),p99:quantile(p.costs,.99)},frameIntervalMs:{p50:quantile(p.intervals,.5),p95:quantile(p.intervals,.95),p99:quantile(p.intervals,.99)},longTasks:p.longTasks,heapSamples:p.memory,errors};
  reports.push(report);await writeFile(out+'/performance.json',JSON.stringify(reports,null,2));console.log(JSON.stringify(report));await page.screenshot({path:out+'/'+name+'-ordinary-clock.png'});await ctx.close();
 }
}finally{await browser.close();}
