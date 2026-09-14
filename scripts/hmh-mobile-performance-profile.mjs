import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import {chromium} from '../benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs';
import {startPortalStaticServer} from './hmh-reboot-portal-e2e.mjs';

const profileId=process.env.HMH_PROFILE??'mobile';
const cpu=Number(process.env.HMH_CPU??1), scenario=process.env.HMH_SCENARIO??'opening';
const telemetry=process.env.HMH_TELEMETRY==='1';
const recordCpu=process.env.HMH_CPU_PROFILE==='1';
const sampleMs=Number(process.env.HMH_SAMPLE_SECONDS??10)*1000;
assert.ok(Number.isFinite(sampleMs)&&sampleMs>=10000&&sampleMs<=900000,'sample must be 10–900 active seconds');
assert.ok(['desktop','mobile','landscape'].includes(profileId),'unsupported profile');
assert.ok(['opening','pressure','hazard'].includes(scenario),'unsupported scenario');
assert.ok(Number.isFinite(cpu)&&cpu>=1&&cpu<=6,'CPU throttle must be 1–6');
const output=path.resolve(process.env.HMH_EVIDENCE??`.tmp/mobile-performance/${profileId}-${scenario}-${cpu}`);
await mkdir(output,{recursive:true});
const mobile=profileId!=='desktop';
const phone=process.env.HMH_PHONE==='xs-max'?{width:414,height:896}:{width:390,height:844};
const viewport=profileId==='landscape'?{width:844,height:390}:mobile?phone:{width:1440,height:900};
const {server,origin:localOrigin}=await startPortalStaticServer({rootDir:path.resolve('apps/portal')});
const origin=process.env.HMH_COMPARE_ORIGIN||localOrigin;
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-gpu','--ignore-gpu-blocklist','--enable-webgl']});
try{
  const context=await browser.newContext({viewport,deviceScaleFactor:mobile?3:1,hasTouch:mobile,isMobile:mobile});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const cdp=await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:cpu});
  await page.addInitScript(()=>{
    globalThis.__simulationSteps=0;new MutationObserver(records=>{for(const r of records)if(r.attributeName==='data-simulation-frame-steps')globalThis.__simulationSteps+=Number(r.target.getAttribute(r.attributeName));}).observe(document,{subtree:true,attributes:true,attributeFilter:['data-simulation-frame-steps']});
    globalThis.__frames=[];globalThis.__longTasks=[];globalThis.__activeMs=0;globalThis.__upgradePicks=0;let previous=0,previousActive=false;
    const frame=now=>{
      const panel=document.querySelector('#hmhUpgradePanel');
      const active=(!document.querySelector('#hmhRebootStage')?.dataset.simulationState || document.querySelector('#hmhRebootStage').dataset.simulationState==='active') && document.querySelector('#hmhStartup')?.hidden && document.querySelector('#hmhPausePanel')?.hidden && document.querySelector('#hmhRebootStage')?.dataset.startupArt==='ready' && (!panel || panel.hidden);
      if(previous&&active&&previousActive){if(globalThis.__frames.length<180000)globalThis.__frames.push(now-previous);globalThis.__activeMs+=now-previous;}
      // Benchmark automation uses the normal upgrade button and excludes the
      // paused menu interval. A level-up must not inflate combat performance.
      if(panel&&!panel.hidden){panel.querySelector('.hmh-upgrade-choice')?.click();globalThis.__upgradePicks++;}
      previous=now;previousActive=active;requestAnimationFrame(frame);
    };requestAnimationFrame(frame);
    new PerformanceObserver(list=>{for(const e of list.getEntries())if(previousActive && globalThis.__longTasks.length<10000)globalThis.__longTasks.push(e.duration);}).observe({entryTypes:['longtask']});
  });
  const query=scenario==='pressure'?'&endurancePressurePilot=1':scenario==='hazard'?'&worldTour=hazard&director=1&boss=1':'';
  await page.goto(`${origin}/hmh-reboot/index.html?evidenceSafe=1${telemetry?'&telemetry=1':''}${query}`,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>globalThis.__simulationSteps>=120,null,{timeout:60000});
  const sample=()=>page.locator('#hmhRebootStage').evaluate(s=>({...s.dataset,observedSimulationSteps:Number(s.dataset.simulationStepsTotal??globalThis.__simulationSteps),score:document.querySelector('#hmhRunScore').textContent,level:document.querySelector('#hmhRunLevel').textContent,xp:document.querySelector('#hmhRunXp').textContent}));
  await page.waitForTimeout(3000);
  const before=await sample();
  const heapBefore=await cdp.send('Runtime.getHeapUsage');
  if(recordCpu){await cdp.send('Profiler.enable');await cdp.send('Profiler.start');}
  await page.evaluate(()=>{__frames.length=0;__longTasks.length=0;__activeMs=0;__upgradePicks=0;});
  const measureFor=async ms=>{const target=await page.evaluate(ms=>__activeMs+ms,ms);await page.waitForFunction(target=>__activeMs>=target,target,{timeout:Math.max(60000,sampleMs*4)});};
  let touchStart=null,held=null,release=null;
  if(mobile){
    const b=await page.locator('[data-hmh-control="move"]').boundingBox();
    touchStart={x:b.x+b.width/2,y:b.y+b.height/2};
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...touchStart,id:1}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:touchStart.x+45,y:touchStart.y,id:1}]});
  }else await page.keyboard.down('KeyD');
  await measureFor(5000);held=await sample();
  if(mobile)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await page.keyboard.up('KeyD');
  await measureFor(400);release=await sample();
  await measureFor(sampleMs-5400);
  const after=await sample(),profile=recordCpu?(await cdp.send('Profiler.stop')).profile:{nodes:[],samples:[],timeDeltas:[]};
  const heapAfter=await cdp.send('Runtime.getHeapUsage');
  const timing=await page.evaluate(()=>{
    const times=__frames.slice(1).sort((a,b)=>a-b),p=q=>times[Math.floor((times.length-1)*q)];
    return {frames:times.length,activeMs:__activeMs,upgradePicks:__upgradePicks,meanMs:times.reduce((a,b)=>a+b,0)/times.length,p50Ms:p(.5),p95Ms:p(.95),p99Ms:p(.99),maxMs:times.at(-1),longTasks:__longTasks};
  });
  const count=new Map();for(let i=0;i<(profile.samples??[]).length;i++)count.set(profile.samples[i],(count.get(profile.samples[i])??0)+profile.timeDeltas[i]);
  const hottest=profile.nodes.map(n=>({...n.callFrame,selfMs:(count.get(n.id)??0)/1000})).sort((a,b)=>b.selfMs-a.selfMs).slice(0,40);
  const result={schema:'hmh-active-performance-v2',deviceAcceptance:false,origin,profileId,cpu,recordCpu,telemetry,sampleMs,scenario,viewport,timing,simulationSteps:Number(after.observedSimulationSteps)-Number(before.observedSimulationSteps),simulationDroppedMs:Number(after.simulationDroppedMs)-Number(before.simulationDroppedMs),heapBefore,heapAfter,before,held,release,after,errors,hottest};
  await writeFile(path.join(output,'report.json'),JSON.stringify(result,null,2));
  await writeFile(path.join(output,'profile.cpuprofile'),JSON.stringify(profile));
  await page.screenshot({path:path.join(output,'gameplay.png')});
  console.log(JSON.stringify({profileId,cpu,scenario,timing,beforeTick:before.observedSimulationSteps,afterTick:after.observedSimulationSteps,enemies:after.enemyCount,droppedMs:after.simulationDroppedMs,errors,hottest:hottest.slice(0,12)},null,2));
  assert.deepEqual(errors,[]);
  assert.ok(timing.activeMs>=sampleMs,'the full requested active gameplay window must be measured');
  assert.ok(Number(after.observedSimulationSteps)-Number(before.observedSimulationSteps)>=450,'simulation must keep advancing during measurement');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
