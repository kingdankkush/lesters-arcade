import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
function python(body){
  const r=spawnSync('python',['-c',`import sys,json,math\nsys.path.insert(0,'scripts')\nfrom hmh_sfx_metrics import analyse,decode\n${body}`],{cwd:root,encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout.trim());
}
test('spectral measurement identifies known sub and midrange tones',()=>{
  const r=python("print(json.dumps([analyse([.5*math.sin(2*math.pi*f*i/44100) for i in range(44100)],44100) for f in [60,440]]))");
  assert.ok(r[0].bands.sub20_100>.95);assert.ok(Math.abs(r[1].centroidHz-440)<5);
});
for(const [weapon,transient,sub,punch,tail] of [
  ['coin-blaster',3,.04,.25,190],['auto-miner',3,.03,.25,120],
  ['scatter-shotgun',1.5,.20,.20,420],['launcher-rig',1,.20,.20,470],['hash-rail',3,.15,.15,360],
])test(`${weapon} has a separate crack, audible body and controlled tail in its actual PCM`,()=>{
  const m=python(`s,r=decode('apps/portal/assets/audio/sfx/hmh-fire-${weapon}.wav')\nprint(json.dumps(analyse(s,r)))`);
  assert.ok(m.transientMinusBodyDb>=transient,JSON.stringify(m));
  assert.ok(m.bands.sub20_100>=sub&&m.bands.sub20_100<.70,JSON.stringify(m));
  assert.ok(m.bands.punch100_250>=punch,JSON.stringify(m));
  assert.ok(m.tail30dbMs<=tail,JSON.stringify(m));
  assert.ok(m.body15to75Rms>=.12,JSON.stringify(m));
  assert.ok(m.peak<=.781&&Math.abs(m.dcMean)<.008);
});
