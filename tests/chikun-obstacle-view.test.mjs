import test from 'node:test';
import assert from 'node:assert/strict';
const switches=await import('../apps/portal/src/chikun-presentation-switch.mjs').catch(()=>({}));
const bootstrap=await import('../apps/chikun/src/obstacle-loop-bootstrap.mjs').catch(()=>({}));
const viewModule=await import('../apps/chikun/src/obstacle-loop-view.mjs').catch(()=>({}));
const metadata=()=>({schema:'chikun-obstacle-loop-v1',actor:'eagle',frames:8,columns:4,fps:12,tiers:{low:{file:'eagle-low.webp',frameWidth:128,frameHeight:64,width:512,height:128},medium:{file:'eagle-medium.webp',frameWidth:192,frameHeight:96,width:768,height:192},high:{file:'eagle-high.webp',frameWidth:256,frameHeight:128,width:1024,height:256}}});
const response=()=>({ok:true,text:async()=>JSON.stringify(metadata())});
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return{promise,resolve};};
test('obstacle and quality query switches are exact, unique and cosmetic-only',()=>{
 assert.equal(typeof switches.chikunPresentationSuffix,'function');
 for(const query of ['', '?obstacleLoops=1','?obstacleLoops=eagle-v1x','?obstacleLoops=eagle-v1&obstacleLoops=eagle-v1'])assert.equal(switches.chikunPresentationSuffix(query),'');
 assert.equal(switches.chikunPresentationSuffix('?obstacleLoops=eagle-v1&obstacleQuality=low&seed=secret&replay=x'),'?obstacleLoops=eagle-v1&obstacleQuality=low');
 assert.equal(switches.chikunPresentationSuffix('?obstacleLoops=eagle-v1&obstacleQuality=low&obstacleQuality=high'),'?obstacleLoops=eagle-v1');
 assert.equal(switches.chikunPresentationSuffix('?coinFeedback=positive-v1&obstacleLoops=eagle-v1&obstacleQuality=high'),'?coinFeedback=positive-v1&obstacleLoops=eagle-v1&obstacleQuality=high');
});
test('normal play animates the eagle and an explicit opt-out survives the cabinet boundary',()=>{
 assert.equal(switches.chikunObstaclePresentationOptions('').enabled,true);
 assert.deepEqual(switches.chikunObstaclePresentationOptions('',2),{enabled:true,tier:'medium'});
 const forwarded=switches.chikunPresentationSuffix('?obstacleLoops=off&seed=private');
 assert.equal(forwarded,'?obstacleLoops=off');
 assert.equal(switches.chikunObstaclePresentationOptions(forwarded).enabled,false);
});
test('disabled obstacle presentation starts no module, metadata or texture request',async()=>{
 let calls=0;const optional=bootstrap.startChikunObstaclePresentation({enabled:false,loadModule:()=>{calls++;},fetchRef:()=>{calls++;}});
 assert.equal(await optional.ready,false);assert.equal(optional.draw({}, {},0,false,0,0,0,0),false);assert.equal(calls,0);optional.dispose();
});
test('one bounded view draws only its registered eagle and restores static fallback after disposal',async()=>{
 const draws=[],urls=[];class Image{naturalWidth=768;naturalHeight=192;set src(v){urls.push(v);}async decode(){}}
 const view=viewModule.createChikunObstacleLoopView({metadata:metadata(),tier:'medium',ImageClass:Image});
 const obstacle=Object.freeze({variant:'eagle',family:'sky',x:30,y:20,width:100,height:70});const ctx={drawImage:(...args)=>draws.push(args)};
 assert.equal(view.draw(ctx,obstacle,5,false,30,10,100,70),false);assert.equal(await view.ready,true);
 assert.equal(view.draw(ctx,obstacle,20,false,30,10,100,70),true);assert.deepEqual(draws[0].slice(1),[0,96,192,96,30,10,100,70]);
 assert.equal(view.draw(ctx,{...obstacle,variant:'hawk'},20,false,30,10,100,70),false);assert.equal(view.draw(ctx,{...obstacle,family:'tree'},20,false,30,10,100,70),false);
 view.draw(ctx,obstacle,500,true,30,10,100,70);assert.deepEqual(draws.at(-1).slice(1,5),[0,0,192,96]);
 assert.equal(urls.filter(url=>url.endsWith('.webp')).length,1);view.dispose();view.dispose();assert.equal(view.draw(ctx,obstacle,5,false,30,10,100,70),false);assert.equal(urls.at(-1),'');
});
test('optional startup fetches only same-origin metadata and owns factory before its asynchronous ready',async()=>{
 const statuses=[],requests=[];let disposed=0;const gate=deferred();
 const optional=bootstrap.startChikunObstaclePresentation({enabled:true,tier:'low',onStatus:value=>statuses.push(value),fetchRef:async(url,options)=>{requests.push({url,options});return response();},loadModule:async()=>({createChikunObstacleLoopView:({tier})=>{assert.equal(tier,'low');return{ready:gate.promise,dispose:()=>disposed++,draw:()=>true};}})});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(requests.length,1);assert.equal(requests[0].url,'/assets/generated/chikun-obstacle-loop-v1/manifest.json');assert.equal(requests[0].options.credentials,'same-origin');assert.equal(optional.draw(),false);
 gate.resolve(true);assert.equal(await optional.ready,true);assert.equal(optional.draw(),true);optional.dispose();assert.equal(disposed,1);assert.equal(optional.draw(),false);assert.deepEqual(statuses,['loading','ready']);
});
test('disposal during import prevents fetch or factory creation',async()=>{
 const gate=deferred();let fetches=0,factories=0;const statuses=[];
 const optional=bootstrap.startChikunObstaclePresentation({enabled:true,loadModule:()=>gate.promise,fetchRef:()=>{fetches++;return response();},onStatus:v=>statuses.push(v)});
 optional.dispose();gate.resolve({createChikunObstacleLoopView:()=>{factories++;}});assert.equal(await optional.ready,false);assert.equal(fetches,0);assert.equal(factories,0);assert.deepEqual(statuses,['loading']);
});
test('disposal aborts metadata and settles readiness even when fetch ignores abort',async()=>{
 const gate=deferred();let signal;const statuses=[];const optional=bootstrap.startChikunObstaclePresentation({enabled:true,loadModule:async()=>({}),fetchRef:(_,options)=>{signal=options.signal;return gate.promise;},onStatus:v=>statuses.push(v)});
 await new Promise(resolve=>setImmediate(resolve));optional.dispose();assert.equal(signal.aborted,true);assert.equal(await optional.ready,false);gate.resolve(response());await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(statuses,['loading']);
});
test('disposal during texture readiness releases the owned view and never resumes drawing',async()=>{
 const gate=deferred();let disposed=0;const statuses=[];
 const optional=bootstrap.startChikunObstaclePresentation({enabled:true,fetchRef:async()=>response(),loadModule:async()=>({createChikunObstacleLoopView:()=>({ready:gate.promise,dispose:()=>disposed++,draw:()=>true})}),onStatus:v=>statuses.push(v)});
 await new Promise(resolve=>setImmediate(resolve));optional.dispose();assert.equal(await optional.ready,false);gate.resolve(true);await new Promise(resolve=>setImmediate(resolve));assert.equal(disposed,1);assert.equal(optional.draw(),false);assert.deepEqual(statuses,['loading']);
});
test('download, invalid metadata and factory failures are ordinary static fallback',async()=>{
 for(const mode of ['download','metadata','factory','not-ready']){let disposeCalls=0;const statuses=[];
 const optional=bootstrap.startChikunObstaclePresentation({enabled:true,fetchRef:async()=>mode==='download'?{ok:false}:mode==='metadata'?{ok:true,text:async()=>'{invalid'}:response(),loadModule:async()=>({createChikunObstacleLoopView:()=>{if(mode==='factory')throw Error('failed constructor');return{ready:Promise.resolve(false),dispose:()=>disposeCalls++,draw:()=>true};}}),onStatus:v=>statuses.push(v)});
 assert.equal(await optional.ready,false);assert.equal(optional.draw(),false);assert.deepEqual(statuses,['loading','fallback']);assert.equal(disposeCalls,mode==='not-ready'?1:0);optional.dispose();}
});
test('a bounded startup timeout aborts downloads and releases any owned view',async()=>{
 let timeout,cleared=false,disposed=0;const gate=deferred(),statuses=[];
 const optional=bootstrap.startChikunObstaclePresentation({enabled:true,fetchRef:async()=>response(),loadModule:async()=>({createChikunObstacleLoopView:()=>({ready:gate.promise,dispose:()=>disposed++,draw:()=>true})}),onStatus:v=>statuses.push(v),setTimeoutRef:callback=>{timeout=callback;return 17;},clearTimeoutRef:id=>{assert.equal(id,17);cleared=true;}});
 await new Promise(resolve=>setImmediate(resolve));timeout();assert.equal(await optional.ready,false);assert.equal(disposed,1);assert.equal(cleared,true);assert.deepEqual(statuses,['loading','fallback']);optional.dispose();
});
