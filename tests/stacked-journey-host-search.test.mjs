import test from 'node:test';
import assert from 'node:assert/strict';
import {createStackedHost} from '../apps/portal/src/stacked-host.mjs';
import {defaultStackedSettings} from '../apps/portal/src/stacked-player-settings.mjs';
function fixture(search,currentSearch){
  const globals=['document','window','location','MessageChannel','requestAnimationFrame','cancelAnimationFrame'],before=globals.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]);
  class Port{postMessage(){}close(){}start(){}}
  class Channel{constructor(){this.port1=new Port();this.port2=new Port();}}
  Object.assign(globalThis,{document:{documentElement:{dataset:{}},createElement:()=>({setAttribute(){},addEventListener(){},remove(){}})},window:{localStorage:{}},location:{origin:'http://localhost',search:currentSearch},MessageChannel:Channel,requestAnimationFrame:()=>1,cancelAnimationFrame(){}});
  let host;
  try{host=createStackedHost({search,mount:{replaceChildren(){}},session:{sessionId:'free-preview',seed:7,buildHash:1,seasonId:1,leaderboardEligible:false},settings:defaultStackedSettings()});return host.frame.src;}
  finally{host?.destroy();for(const[key,descriptor]of before)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
}
test('the explicit boot query survives arcade navigation clearing the visible URL',()=>{
  assert.equal(fixture('?livingJourney=living-v1',''),'/stacked/index.html?livingJourney=living-v1&stackedTutorial=tutorial-v1');
});
test('an invalid or duplicate boot query cannot adopt a later valid visible URL',()=>{
  for(const search of['?livingJourney=bad','?livingJourney=living-v1&livingJourney=living-v1'])assert.equal(fixture(search,'?livingJourney=living-v1'),'/stacked/index.html?livingJourney=off&stackedTutorial=tutorial-v1');
});
