import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile,stat,mkdir,writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath,pathToFileURL } from 'node:url';
import { PORTAL_GAMES,portalPageMeta } from '../apps/portal/src/portal-content.mjs';
import { CABINET_FRAMING } from '../apps/portal/src/cabinet-presentation.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const portal=path.join(root,'apps/portal');
const output=path.resolve(process.env.PORTAL_DISCOVERY_EVIDENCE ?? path.join(root,'work/qa/portal-discovery'));
await mkdir(output,{recursive:true});
const {chromium}=await import(pathToFileURL(path.join(root,'benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs')));
const config=JSON.parse(await readFile(path.join(root,'vercel.json'),'utf8'));
const exactRoutes=new Map(config.rewrites.filter(rule=>!/[()*:]/.test(rule.source)).map(rule=>[rule.source,rule.destination]));
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp4':'video/mp4','.mp3':'audio/mpeg','.txt':'text/plain','.xml':'application/xml'};
let server;
let origin=process.env.PORTAL_DISCOVERY_ORIGIN;
if(!origin){
  server=createServer(async(req,res)=>{try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    let file=path.resolve(portal,'.'+(exactRoutes.get(pathname) ?? pathname));
    if(!file.startsWith(portal+path.sep) && file!==portal)throw Error('outside portal');
    try{if((await stat(file)).isDirectory())file=path.join(file,'index.html');await stat(file);}
    catch{if(!path.extname(pathname))file=path.join(portal,'index.html');}
    const bytes=await readFile(file);
    res.writeHead(200,{'content-type':mime[path.extname(file)]??'application/octet-stream','cache-control':'no-store'});res.end(bytes);
  }catch{res.writeHead(404);res.end('Not found');}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  origin='http://127.0.0.1:'+server.address().port;
}
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const report={origin,checks:[],accessibility:[],failures:[]};
async function check(id,fn){try{const detail=await fn();report.checks.push({id,ok:true,detail});console.log('PASS '+id);}catch(error){report.failures.push({id,error:String(error.stack??error)});console.error('FAIL '+id+': '+error.message);}}
const axePath=process.env.PORTAL_AXE_PATH;
async function accessibility(page,id){
  if(!axePath || !existsSync(axePath))return;
  await page.addScriptTag({path:axePath});
  const result=await page.evaluate(async()=>{const result=await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return result.violations.map(v=>({id:v.id,impact:v.impact,description:v.description,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}));});
  report.accessibility.push({id,violations:result});
  assert.deepEqual(result,[],id+' accessibility violations');
}
async function settled(page){await page.waitForFunction(()=>document.querySelector('#portalStructuredData') && document.querySelector('#officialApp')?.dataset.step);await page.evaluate(()=>document.fonts.ready);}
async function loadVisibleArt(page){await page.evaluate(async()=>{for(const img of document.querySelectorAll('img[loading="lazy"]')){if(img.getClientRects().length)img.loading='eager';}await Promise.all([...document.images].filter(img=>img.getClientRects().length).map(img=>img.decode().catch(()=>{})));});}
try {
  for(const width of [320,390,768,1024,1440]){
    const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce',serviceWorkers:'block'});
    const errors=[],missing=[],media=[];
    page.on('pageerror',e=>errors.push(String(e)));
    page.on('response',res=>{if(res.status()>=400 && new URL(res.url()).origin===origin)missing.push(res.url());});
    page.on('request',req=>{if(/\.mp4(?:\?|$)/.test(req.url()))media.push(req.url());});
    await check('home-'+width,async()=>{
      await page.goto(origin+'/');await settled(page);await loadVisibleArt(page);
      await page.evaluate(()=>scrollTo(0,0));
      assert.equal(await page.title(),portalPageMeta('/').title);
      assert.equal(await page.locator('h1:visible').count(),1);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no horizontal overflow');
      assert.equal(media.length,0,'reduced motion does not download decorative movies');
      const duplicates=await page.evaluate(()=>{const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);return ids.filter((id,i)=>ids.indexOf(id)!==i);});
      assert.deepEqual(duplicates,[]);
      const primary=await page.locator('#officialGuestEnterButton').boundingBox();
      assert.ok(primary.y+primary.height<850,'primary action is on the first screen');
      const music=await page.locator('#arcadeMusicPlayer').boundingBox();
      const home=await page.locator('#officialWalletSplash').boundingBox();
      assert.ok(music.y>=home.y+home.height,'jukebox never covers discovery content');
      await page.screenshot({path:path.join(output,'home-'+width+'-first.png')});
      await page.screenshot({path:path.join(output,'home-'+width+'.png'),fullPage:true});
      if([390,1440].includes(width))await accessibility(page,'home-'+width);
      return {primary,musicY:music.y,mediaRequests:media.length};
    });
    await check('catalog-'+width,async()=>{
      await page.locator('#officialGuestEnterButton').focus();await page.keyboard.press('Enter');await page.waitForURL('**/games');
      assert.equal(await page.title(),portalPageMeta('/games').title);
      await page.waitForFunction(()=>[...document.querySelectorAll('.normalized-cabinet canvas')].every(e=>e.dataset.ready==='true'));
      await page.locator('.official-cabinet-card.playable img').evaluateAll(images=>Promise.all(images.map(img=>img.decode())));
      assert.equal(await page.locator('.official-cabinet-card.playable').count(),3);
      const bounds=await page.evaluate(({games,framing})=>games.map(game=>{
        const card=document.querySelector('[data-game-slug="'+game.slug+'"]');
        const media=card.querySelector('.cabinet-card-media').getBoundingClientRect();
        const frames=[...card.querySelectorAll('.cabinet-rotation-frame')].map((image,index)=>{
          const rect=image.getBoundingClientRect(),[w,h,x,y,right,bottom]=framing[game.sprite][index];
          return {height:(bottom-y)/h*rect.height,top:rect.top+y/h*rect.height-media.top,bottom:rect.top+bottom/h*rect.height-media.top};
        });return {slug:game.slug,frames};
      }),{games:PORTAL_GAMES,framing:CABINET_FRAMING});
      const reference=bounds[0].frames[0];
      for(const game of bounds)for(const frame of game.frames){assert.ok(Math.abs(frame.height-reference.height)<.1,'equal visible cabinet heights');assert.ok(Math.abs(frame.bottom-reference.bottom)<.1,'equal cabinet grounding');}
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      await page.screenshot({path:path.join(output,'catalog-'+width+'.png'),fullPage:true});
      if([390,1440].includes(width))await accessibility(page,'catalog-'+width);
      return bounds;
    });
    if(width===1440) {
      for(const game of PORTAL_GAMES)await check('game-entry-'+game.slug,async()=>{
        await page.goto(origin+'/games');await settled(page);
        await page.locator('[data-game-slug="'+game.slug+'"]').click();await page.waitForURL('**/play/'+game.slug);
        assert.equal(await page.locator('#officialModeTitle').textContent(),game.title);
        assert.equal(await page.title(),portalPageMeta('/games/'+game.slug).title);
        assert.ok(await page.locator('#portalGameDetails').innerText().then(text=>text.includes(game.controls)));
        assert.equal(await page.locator('#officialFreeModeButton').isEnabled(),true);
        assert.equal(await page.locator('#officialRankedModeButton').getAttribute('data-needs-wallet'),'true');
        await accessibility(page,'detail-'+game.slug);
        await page.screenshot({path:path.join(output,'detail-'+game.slug+'.png'),fullPage:true});
        await page.goBack();assert.equal(new URL(page.url()).pathname,'/games');await page.waitForFunction(()=>document.title.startsWith('Browse Games'));
      });
    }
    await check('clean-browser-'+width,()=>{assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);return {errors,missing};});
    await page.close();
  }
  await check('readable-without-javascript',async()=>{
    const page=await browser.newPage({javaScriptEnabled:false,serviceWorkers:'block'});
    for(const url of ['/','/games',...PORTAL_GAMES.map(game=>'/games/'+game.slug)]){
      const response=await page.goto(origin+url);assert.equal(response.status(),200);
      assert.equal(await page.title(),portalPageMeta(url).title);
      assert.equal(await page.locator('h1:visible').count(),1);
      const text=await page.locator('body').innerText();
      if(url==='/games')for(const game of PORTAL_GAMES)assert.ok(text.includes(game.title));
      if(url.startsWith('/games/'))assert.ok(text.includes(PORTAL_GAMES.find(g=>url.endsWith(g.slug)).controls));
      const schema=JSON.parse(await page.locator('#portalStructuredData').textContent());assert.equal(schema['@context'],'https://schema.org');
    }
    await page.close();
  });
  await check('film-controls-and-navigation',async()=>{
    const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce',serviceWorkers:'block'});
    await page.goto(origin+'/');await settled(page);
    const toggle=page.locator('[data-video-toggle="splashLoopVideo"]');
    await toggle.click();await page.waitForFunction(()=>document.querySelector('#splashLoopVideo').currentTime>0);
    assert.equal(await toggle.getAttribute('aria-pressed'),'true');
    await toggle.click();assert.equal(await page.locator('#splashLoopVideo').evaluate(e=>e.paused),true);
    await toggle.click();await page.locator('#officialGuestEnterButton').click();
    await page.waitForFunction(()=>document.querySelector('#splashLoopVideo').paused);
    await page.locator('.official-nav-tab[href="/profile"]').click();await page.waitForURL('**/profile');
    assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'),'noindex, follow');
    await page.locator('.portal-brand').click();await page.waitForURL(origin+'/');
    await page.locator('[data-open-jukebox]').click();
    assert.equal(await page.locator('#arcadeMusicPlayer').getAttribute('data-expanded'),'true');
    assert.equal(await page.locator('#arcadeMusicPlayButton').evaluate(e=>e===document.activeElement),true);
    await page.close();
  });
} finally {
  await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  await browser.close();await new Promise(resolve=>server?server.close(resolve):resolve());
}
if(report.failures.length)process.exitCode=1;
console.log(JSON.stringify({checks:report.checks.length,failures:report.failures.length,accessibility:report.accessibility.length,output}));
