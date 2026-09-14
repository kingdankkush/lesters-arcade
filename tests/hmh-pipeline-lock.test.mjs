import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
test('pipeline lock process probes preserve live owners and release exited owners',()=>{
 const run=spawnSync('python',['tests/hmh-pipeline-lock.test.py'],{encoding:'utf8',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});
 assert.equal(run.status,0,run.stdout+run.stderr);
 assert.match(run.stderr,/Ran 3 tests/);
 assert.match(run.stderr,/\nOK\s*$/);
});
