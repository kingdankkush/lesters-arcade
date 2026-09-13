import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from '../benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs';
import {startPortalStaticServer} from './hmh-reboot-portal-e2e.mjs';

const profileId=process.env.HMH_PROFILE??'mobile';
const cpu=Number(process.env.HMH_CPU??1), scenario=process.env.HMH_SCENARIO??'opening';
const recordCpu=process.env.HMH_CPU_PROFILE!=='0';
const output=path.resolve(process.env.HMH_EVIDENCE??`.tmp/mobile-performance/${profileId}-${scenario}-${cpu}`);
await mkdir(output,{recursive:true});
const mobile=profileId!=='desktop';
const viewport=profileId==='landscape'?{width:844,height:390}:mobile?{width:390,height:844}:{width:1440,height:900};
const {server,origin}=await startPortalStaticServer({rootDir:path.resolve('apps/portal')});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-gpu','--ignore-gpu-blocklist','--enable-webgl']});
try{
  const context=await browser.newContext({viewport,deviceScaleFactor:mobile?3:1,hasTouch:mobile,isMobile:mobile});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const cdp=await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:cpu});
  await page.addInitScript(()=>{
    globalThis.__frames=[];globalThis.__longTasks=[];let previous=0;
    const frame=now=>{if(previous)globalThis.__frames.push(now-previous);previous=now;requestAnimationFrame(frame);};requestAnimationFrame(frame);
    new PerformanceObserver(list=>{for(const e of list.getEntries())globalThis.__longTasks.push(e.duration);}).observe({entryTypes:['longtask']});
  });
  const query=scenario==='pressure'?'&endurancePressurePilot=1':scenario==='hazard'?'&worldTour=hazard&director=1&boss=1':'';
  await page.goto(`${origin}/hmh-reboot/index.html?evidenceSafe=1&telemetry=1${query}`,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>Number(document.querySelector('#hmhRebootStage')?.dataset.simulationTick)>=120,null,{timeout:60000});
  const sample=()=>page.locator('#hmhRebootStage').evaluate(s=>({...s.dataset}));
  await page.waitForTimeout(3000);
  const before=await sample();
  if(recordCpu){await cdp.send('Profiler.enable');await cdp.send('Profiler.start');}
  await page.evaluate(()=>{__frames.length=0;__longTasks.length=0;});
  let touchStart=null,held=null,release=null;
  if(mobile){
    const b=await page.locator('[data-hmh-control="move"]').boundingBox();
    touchStart={x:b.x+b.width/2,y:b.y+b.height/2};
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...touchStart,id:1}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:touchStart.x+45,y:touchStart.y,id:1}]});
  }else await page.keyboard.down('KeyD');
  await page.waitForTimeout(5000);held=await sample();
  if(mobile)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await page.keyboard.up('KeyD');
  await page.waitForTimeout(400);release=await sample();
  await page.waitForTimeout(4600);
  const after=await sample(),profile=recordCpu?(await cdp.send('Profiler.stop')).profile:{nodes:[],samples:[],timeDeltas:[]};
  const timing=await page.evaluate(()=>{
    const times=__frames.slice(1).sort((a,b)=>a-b),p=q=>times[Math.floor((times.length-1)*q)];
    return {frames:times.length,meanMs:times.reduce((a,b)=>a+b,0)/times.length,p50Ms:p(.5),p95Ms:p(.95),p99Ms:p(.99),maxMs:times.at(-1),longTasks:__longTasks};
  });
  const count=new Map();for(let i=0;i<(profile.samples??[]).length;i++)count.set(profile.samples[i],(count.get(profile.samples[i])??0)+profile.timeDeltas[i]);
  const hottest=profile.nodes.map(n=>({...n.callFrame,selfMs:(count.get(n.id)??0)/1000})).sort((a,b)=>b.selfMs-a.selfMs).slice(0,40);
  const result={profileId,cpu,recordCpu,scenario,viewport,timing,before,held,release,after,errors,hottest};
  await writeFile(path.join(output,'report.json'),JSON.stringify(result,null,2));
  await writeFile(path.join(output,'profile.cpuprofile'),JSON.stringify(profile));
  await page.screenshot({path:path.join(output,'gameplay.png')});
  console.log(JSON.stringify({profileId,cpu,scenario,timing,beforeTick:before.simulationTick,afterTick:after.simulationTick,enemies:after.enemyCount,droppedMs:after.simulationDroppedMs,errors,hottest:hottest.slice(0,12)},null,2));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
