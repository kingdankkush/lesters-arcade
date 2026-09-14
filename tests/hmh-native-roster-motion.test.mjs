import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
test('native enemy gait bends knees backward and puts the breathing offset on the vertical axis', () => {
  const script = `import sys
sys.path.insert(0, 'scripts/hmh-blender')
from hmh_native_roster_poses import native_role_pose
for kind,damage in [('gas-bomber-canister-lob-v1','canister-protective-stagger-v1'),('forkrunner-quick-fork-slash-v1','crossed-fork-guard-break-v1')]:
    for i in range(24):
        p=native_role_pose(kind,damage,'run',i,24,.1)
        assert p['rotations']['shin.L'][0] >= 0
        assert p['rotations']['shin.R'][0] >= 0
        assert p['locations']['pelvis'][2] == 0
    a=native_role_pose(kind,damage,'idle',0,2,.1)
    b=native_role_pose(kind,damage,'idle',1,2,.1)
    assert a['locations']['pelvis'][1] != b['locations']['pelvis'][1]
    assert a['locations']['pelvis'][2] == b['locations']['pelvis'][2] == 0
`;
  const result=spawnSync('python',['-c',script],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr || result.error?.message);
});
