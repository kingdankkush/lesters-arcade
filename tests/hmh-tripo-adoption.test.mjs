import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const prelude = String.raw`
import copy, importlib.util, sys
from pathlib import Path
sys.path.insert(0,str(Path('scripts').resolve()))
path=Path('scripts/hmh_tripo_adoption.py')
assert path.is_file(), 'verified native adoption boundary is not implemented'
spec=importlib.util.spec_from_file_location('adopter',path)
adopter=importlib.util.module_from_spec(spec);spec.loader.exec_module(adopter)
ids=[f'{i:02d}' for i in range(1,57)]
scripts={name:'a'*64 for name in ['intakeAndPacker','nativeRenderer','orchestrator']}
def fixture():
    # Deliberately synthetic policy-only fixture. No native files or public art
    # are created here; the disk-backed adopter must independently verify both.
    return {'pipelineId':'hmh-tripo-static-props/v1','status':'pass','classification':'native-render-candidate',
      'runtimeAuthority':'projection-only','rosterScope':'full-56-candidate','fullRosterComplete':True,
      'canonicalAdoption':False,'certified':False,'settlementLive':False,'selectedIds':ids[:],
      'sourceModelsUnchanged':True,'sourceModelSha256Before':{key:'f'*64 for key in ids},
      'sourceModelSha256After':{key:'f'*64 for key in ids},'scriptSha256':scripts.copy(),
      'comparison':{'exact':True,'frameCount':56,'changedFrames':[],
       'frames':[{'sourceId':key,'exact':True,'firstDecodedRgbaSha256':'b'*64,'secondDecodedRgbaSha256':'b'*64} for key in ids]},
      'processes':[{'label':f'{phase}-{key}','started':True,'returnCode':0,
       'command':['blender','--background','--factory-startup','--disable-autoexec','--python-exit-code','1','--python','export.py','--','--source-id',key],
       'stdoutLog':f'blender-{phase}-{key}.stdout.log','stderrLog':f'blender-{phase}-{key}.stderr.log','stdoutSha256':'a'*64,'stderrSha256':'a'*64}
       for phase in ['a','b'] for key in ids]}
def rejected(value):
    try: adopter.validate_receipt(value,scripts)
    except ValueError: return
    raise AssertionError('invalid native adoption receipt was accepted')
`;
function run(code) {
  const p = spawnSync(process.env.PYTHON || 'python', ['-B', '-c', prelude + '\n' + code], { cwd: root, encoding: 'utf8' });
  assert.equal(p.status, 0, p.stdout + p.stderr);
}
test('native adoption accepts a complete policy fixture without treating it as native file proof', () => run(`adopter.validate_receipt(fixture(),scripts)`));
test('native adoption rejects partial and failed rosters', () => run(String.raw`
for field,value in [('status','failed'),('fullRosterComplete',False),('rosterScope','subset-visual-review-only'),('runtimeAuthority','simulation'),('settlementLive',True)]:
    r=fixture();r[field]=value;rejected(r)
r=fixture();r['selectedIds'].pop();rejected(r)
`));
test('native adoption rejects changed pixels, source drift and stale producers', () => run(String.raw`
r=fixture();r['comparison']['exact']=False;rejected(r)
r=fixture();r['comparison']['frames'][0]['secondDecodedRgbaSha256']='c'*64;rejected(r)
r=fixture();r['comparison']['frames'].pop();rejected(r)
r=fixture();r['sourceModelSha256After']['01']='e'*64;rejected(r)
r=fixture();r['scriptSha256']['nativeRenderer']='e'*64;rejected(r)
`));
test('native adoption rejects missing, mis-owned and unsafe native processes', () => run(String.raw`
r=fixture();r['processes'].pop();rejected(r)
r=fixture();r['processes'][0]['returnCode']=1;rejected(r)
r=fixture();r['processes'][0]['command'].remove('--disable-autoexec');rejected(r)
r=fixture();r['processes'][0]['command'][-1]='02';rejected(r)
r=fixture();r['processes'][0]['stderrLog']='../outside.log';rejected(r)
`));
