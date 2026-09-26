import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from '../benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs';
import {startPortalStaticServer} from './hmh-reboot-portal-e2e.mjs';
import {OBJECTIVE_REWARDS} from '../apps/hmh-reboot/src/objective-rewards.mjs';
import {WORLD_DESIGN_SITES, WORLD_DESIGN_COURTS} from '../apps/hmh-reboot/src/world-design-encounters.mjs';
import {MISSION_OBJECTIVES} from '../apps/hmh-reboot/src/mission-objectives.mjs';

// Walks every gated destination from discovery (task prompt on approach) to
// unlock (gate segments removed) to pickup (registry count 1) and back out of
// the court, on desktop keyboard and on a touch joystick. The route is
// site -> court centre through the gate side, so it never crosses a rail.
// HMH_SITES limits the run, e.g. HMH_SITES=crossing-pump,mining-valve.
const output=path.resolve(process.env.HMH_EVIDENCE??'work/qa/objectives');
await mkdir(output,{recursive:true});
const {server,origin:local}=await startPortalStaticServer({rootDir:path.resolve('apps/portal')});
const origin=process.env.HMH_REBOOT_ORIGIN??local;
const siteIds=(process.env.HMH_SITES??'relay-power,ravine-winch,yard-warehouse,crossing-pump,hashwood-shrine,mining-valve').split(',');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-gpu','--ignore-gpu-blocklist','--enable-webgl']});
const results=[];
const firstClearWeapons={'relay-power':'scatter-shotgun','ravine-winch':'hash-rail','yard-warehouse':'bear-market-burner'};
try {
  for(const mobile of [false,true]) for(const siteId of siteIds) {
    const site=WORLD_DESIGN_SITES.find(s=>s.id===siteId), court=WORLD_DESIGN_COURTS.find(c=>c.gateId===site.gateId);
    const rewards=OBJECTIVE_REWARDS.filter(r=>r.objectiveId===siteId), profile=mobile?'touch':'desktop';
    const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},deviceScaleFactor:1,isMobile:mobile,hasTouch:mobile});
    const page=await context.newPage(),cdp=await context.newCDPSession(page),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.goto(`${origin}/hmh-reboot/index.html?evidenceSafe=1&telemetry=1&worldTour=site-${siteId}`,{waitUntil:'networkidle'});
    await page.waitForFunction(()=>document.querySelector('#hmhRebootStage')?.dataset.startupArt==='ready');
    const stage=page.locator('#hmhRebootStage');
    const sample=()=>stage.evaluate(s=>({...s.dataset}));
    const shot=name=>page.screenshot({path:path.join(output,`${siteId}-${profile}-${name}.png`)});
    const before=await sample();
    assert.ok(!JSON.parse(before.worldOpenGates).includes(site.gateId));
    assert.deepEqual(JSON.parse(before.objectiveRewards),[]);
    await shot('approach');
    const move=async (axis,target)=>{
      const key=axis==='y'?['KeyW','KeyS']:['KeyA','KeyD'], read=`actor${axis.toUpperCase()}`;
      const current=Number((await sample())[read]),sign=Math.sign(target-current);
      if(Math.abs(target-current)<5)return;
      if(mobile){
        const box=await page.locator('[data-hmh-control="move"]').boundingBox();
        const center={x:box.x+box.width/2,y:box.y+box.height/2};
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...center,id:1}]});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:center.x+(axis==='x'?sign*45:0),y:center.y+(axis==='y'?sign*45:0),id:1}]});
      }else await page.keyboard.down(sign<0?key[0]:key[1]);
      try{await page.waitForFunction(({target,sign,read})=>sign*(Number(document.querySelector('#hmhRebootStage').dataset[read])-target)>=-4,{target,sign,read},{timeout:10000});}
      finally{if(mobile)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await page.keyboard.up(sign<0?key[0]:key[1]);}
    };
    const fire=async ms=>{
      if(mobile){
        const box=await page.locator('[data-hmh-control="aim"]').boundingBox();
        const center={x:box.x+box.width/2,y:box.y+box.height/2};
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...center,id:2}]});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:center.x+45,y:center.y,id:2}]});
        await page.waitForTimeout(ms);
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      }else{
        const box=await stage.boundingBox();
        await page.mouse.move(box.x+box.width/2+120,box.y+box.height/2);
        await page.mouse.down();await page.waitForTimeout(ms);await page.mouse.up();
      }
    };
    // S1.4 mission core: the Winch Handle opens the winch; fetch it first.
    const needs=MISSION_OBJECTIVES.find(row=>row.id===siteId)?.requires;
    if(needs){
      const item=MISSION_OBJECTIVES.find(row=>row.id===needs).anchor;
      await move('y',item.y);await move('x',item.x);
      await page.waitForFunction(id=>JSON.parse(document.querySelector('#hmhRebootStage').dataset.missionCompleted??'[]').includes(id),needs);
      await move('x',site.x);await move('y',site.y+(siteId==='crossing-pump'?-100:100));
    }
    // Approach: the operate spot is a straight walk along one axis from the
    // tour spawn. The hero stops on it: a quick node commits on arrival, a
    // channel fills while the hero stands still (released keys or stick).
    await move('y',site.y);
    await page.waitForFunction(id=>JSON.parse(document.querySelector('#hmhRebootStage').dataset.worldOpenGates).includes(id),site.gateId,{timeout:15000});
    // Step off the prop's line (it stands 46 units along the facing).
    await move('y',site.y+60);
    await shot('open');
    if(siteId==='mining-valve'){
      // The trap vents across the mouth for warning + duration = 240 ticks.
      await page.waitForTimeout(4600);
      await shot('steam-spent');
    }
    let ammoBefore=8;
    if(siteId==='crossing-pump'){
      await fire(500);
      await page.waitForFunction(()=>Number(document.querySelector('#hmhRebootStage').dataset.weaponAmmo)<8);
      // Pointer aim keeps auto-fire alive for a short idle window; let it lapse
      // so the clip reading is stable before the station is compared.
      await page.waitForTimeout(1200);
      ammoBefore=Number((await sample()).weaponAmmo);
    }
    // Into the court: through the gate side first, then to the centre.
    const entry={south:['y',court.y+35],west:['x',court.x-35],east:['x',court.x+35]}[court.gateSide];
    if(entry[0]==='y'){await move('x',court.x);await move('y',entry[1]);}
    else{await move('y',court.y);await move('x',entry[1]);}
    const expected=siteId==='hashwood-shrine'?['reward:hashwood-scrypt']:rewards.map(r=>r.id);
    await page.waitForFunction(ids=>{const counts=JSON.parse(document.querySelector('#hmhRebootStage').dataset.objectiveRewards);return ids.every(id=>counts.some(([key,n])=>key===id&&n===1));},expected);
    const collected=await sample(), counts=Object.fromEntries(JSON.parse(collected.objectiveRewards));
    if(firstClearWeapons[siteId]) assert.equal(collected.weaponId,firstClearWeapons[siteId]);
    if(siteId==='crossing-pump'){
      assert.equal(collected.collectibleLast,'coin-blaster-cache','the haven station is an ammo refill');
      assert.ok(Number(collected.weaponAmmo)>ammoBefore,`ammo station refilled the pistol clip (${ammoBefore} -> ${collected.weaponAmmo})`);
    }
    if(siteId==='hashwood-shrine'){
      assert.equal(Number(collected.handGrenades),4,'Scrypt Cache added one grenade');
      assert.equal(counts['reward:hashwood-sanctuary'],undefined,'a full-health hero leaves the medkit in the haven');
      assert.equal(Number(collected.playerHealth),100);
    }
    if(siteId==='mining-valve'){
      assert.ok(collected.collectibleActive.split(',').includes('berserk-candle'),'Double Damage is active');
      assert.equal(collected.collectibleDamageMultiplier,'2');
      assert.equal(Number(collected.playerHealth),100,'waiting out the steam costs no health');
    }
    await shot('collected');
    // Safe return: back out through the same gate to the machinery.
    if(entry[0]==='y'){await move('y',site.y);await move('x',site.x);}
    else{await move('x',site.x);await move('y',site.y);}
    const returned=await sample();
    for(const id of expected) assert.equal(JSON.parse(returned.objectiveRewards).find(([key])=>key===id)[1],1,'no duplicate collection on the way out');
    await page.locator('#hmhMenuToggle').click();
    await page.waitForFunction(names=>{const text=document.querySelector('#hmhFieldMap')?.textContent??'';return names.every(n=>text.includes(n))&&/collected|restocks in/.test(text);},rewards.map(r=>r.name));
    await page.locator('#hmhFieldMap').scrollIntoViewIfNeeded();
    const map=await page.locator('#hmhFieldMap').innerText();
    for(const r of rewards) assert.ok(map.includes(r.rewardName),`${r.rewardName} on the field map`);
    if(siteId==='hashwood-shrine') assert.match(map,/Health \+30 · reward available/);
    await shot('map');
    assert.deepEqual(errors,[]);
    results.push({siteId,mobile,gateId:site.gateId,ammoBefore,ammoAfter:Number(collected.weaponAmmo),beforeY:Number(before.actorY),collectedX:Number(collected.actorX),collectedY:Number(collected.actorY),returnedX:Number(returned.actorX),returnedY:Number(returned.actorY),rewards:counts,health:Number(collected.playerHealth),errors});
    console.log(JSON.stringify(results.at(-1)));
    await context.close();
  }
}finally{
  await writeFile(path.join(output,'report.json'),JSON.stringify({origin,results},null,2));
  await browser.close();await new Promise(resolve=>server.close(resolve));
}
