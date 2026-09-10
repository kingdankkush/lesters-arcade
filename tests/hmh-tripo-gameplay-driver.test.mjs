import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('..', import.meta.url));

function checkOutputPath(candidate) {
  const program = `import importlib.util\nfrom pathlib import Path\ns=importlib.util.spec_from_file_location('driver',Path('scripts/run-hmh-tripo-gameplay-pilot.py'));m=importlib.util.module_from_spec(s);s.loader.exec_module(m)\nm.validate_output_isolation(Path(${JSON.stringify(candidate)}))\nprint('ISOLATED')`;
  return spawnSync(process.env.PYTHON ?? 'python', ['-c', program], { cwd: root, encoding: 'utf8' });
}

for (const candidate of ['apps/portal', 'apps/portal/assets/generated', '.tmp', '.tmp/../apps/portal', '../escaped']) {
  test(`packed pilot rejects unsafe output ${candidate}`, () => {
    const result = checkOutputPath(candidate);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /output-root must be a strict child of/);
  });
}

test('packed pilot permits a new isolated output without creating it', () => {
  const result = checkOutputPath('.tmp/test-tripo-output-never-created');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /ISOLATED/);
});

test('packed pilot help needs no Blender or browser process', () => {
  const result = spawnSync(process.env.PYTHON ?? 'python', ['scripts/run-hmh-tripo-gameplay-pilot.py', '--help'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /--actor-id/);
  assert.match(result.stdout, /--output-root/);
});

test('authored action polish supplies bounded recoil, breath and distinct planted follow-through', () => {
  const program = `from pathlib import Path
import importlib.util,math
path=Path('scripts/hmh_textured_action_polish.py')
assert path.is_file(), 'authored source action-polish policy is missing'
s=importlib.util.spec_from_file_location('polish',path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
f=m.pose_offsets_degrees
assert f('HMH_Aim',0)==f('HMH_Aim',1)
assert f('HMH_Aim',0)!=f('HMH_Aim',.5)
assert f('HMH_PistolFire',0)['forearm.R'][0]>0
assert f('HMH_PistolFire',0)!=f('HMH_PistolFire',1)
for action in ['HMH_Melee','HMH_Grenade']:
 assert f(action,0)!=f(action,1)
 assert f(action,0)['shin.R'][0]<0
for action in m.POLISHED_ACTIONS:
 for t in [0,.25,.5,.75,1]:
  for bone,angles in f(action,t).items():
   assert bone not in ('weapon_socket','grenade_prop','grenade_release','pistol_prop','knife_prop')
   assert len(angles)==3 and all(math.isfinite(v) and abs(v)<=15 for v in angles)
assert f('HMH_Run',.5)=={}
for invalid in [-.1,1.1,float('nan')]:
 try:f('HMH_Aim',invalid)
 except ValueError:pass
 else:raise AssertionError('invalid action progress accepted')
`;
  const result = spawnSync(process.env.PYTHON ?? 'python', ['-c', program], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

test('native action-polish entrypoint exposes its source and output contract without Blender', () => {
  const result = spawnSync(process.env.PYTHON ?? 'python', ['scripts/hmh-blender/polish-hmh-textured-actions.py', '--help'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  for (const flag of ['--source', '--output', '--actor-id']) assert.ok(result.stdout.includes(flag));
});

test('source pose grounding measures the actual pelvis response and rejects a flat response', () => {
  const program = `from pathlib import Path
import importlib.util,types
s=importlib.util.spec_from_file_location('polish',Path('scripts/hmh_textured_action_polish.py'));m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
assert callable(getattr(m,'ground_by_measured_response',None)), 'measured source-grounding correction is missing'
pelvis=types.SimpleNamespace(location=types.SimpleNamespace(y=0.0))
updates=[]
before,after=m.ground_by_measured_response(pelvis,lambda:.05+2*pelvis.location.y,lambda:updates.append(True))
assert abs(before-.05)<1e-9 and abs(after)<.0025
assert abs(pelvis.location.y+.025)<1e-9 and len(updates)>=2
pelvis.location.y=0
try:m.ground_by_measured_response(pelvis,lambda:.05,lambda:None)
except (ValueError,RuntimeError):pass
else:raise AssertionError('a zero-response pelvis was accepted')
assert pelvis.location.y==0
`;
  const result = spawnSync(process.env.PYTHON ?? 'python', ['-c', program], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

test('native source stays source-only while runtime references only derived art', () => {
  const runtime = readFileSync(new URL('../apps/hmh-reboot/src/production-hero-atlas.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(runtime, /\.blend|\.glb/i);
  assert.match(runtime, /lit-commando-production-pilot-atlas\.webp/);
  const portalEntry = readFileSync(new URL('../apps/portal/index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(portalEntry, /source\/models|\.blend|\.glb/i);
});

test('native scene preparation refuses overwrites and publication paths before loading Blender', () => {
  const program = `import importlib.util\nfrom pathlib import Path\nimport tempfile\ns=importlib.util.spec_from_file_location('prepare',Path('scripts/hmh-blender/prepare-hmh-textured-gameplay-source.py'));m=importlib.util.module_from_spec(s);s.loader.exec_module(m)\nwith tempfile.TemporaryDirectory(dir='.tmp') as d:\n p=Path(d);source=p/'original.blend';template=p/'template.blend';source.write_bytes(b'original');template.write_bytes(b'template')\n output=p/'derived.blend'\n assert m.validate_paths(source,template,output)[2]==output.resolve()\n for unsafe in [source,template,Path('apps/portal/source.blend'),Path('../escaped.blend'),p/'wrong.glb']:\n  try:m.validate_paths(source,template,unsafe)\n  except (ValueError,FileExistsError):pass\n  else:raise AssertionError(str(unsafe))\n assert source.read_bytes()==b'original' and template.read_bytes()==b'template' and not output.exists()\nprint('SOURCE_PRESERVED')`;
  const result = spawnSync(process.env.PYTHON ?? 'python', ['-c', program], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /SOURCE_PRESERVED/);
});

test('untrusted native scenes disable embedded scripts before any dependency inspection', () => {
  const program = `import ast
from pathlib import Path
for name in ['inspect-hmh-packed-hero-source.py','prepare-hmh-textured-gameplay-source.py']:
 tree=ast.parse((Path('scripts/hmh-blender')/name).read_text())
 calls=[node for node in ast.walk(tree) if isinstance(node,ast.Call) and isinstance(node.func,ast.Attribute) and node.func.attr=='open_mainfile']
 assert calls, f'{name}: missing native open witness'
 for call in calls:
  flags={item.arg:item.value for item in call.keywords}
  assert isinstance(flags.get('use_scripts'),ast.Constant) and flags['use_scripts'].value is False, f'{name}: scripts were not explicitly disabled'
`;
  const result = spawnSync(process.env.PYTHON ?? 'python', ['-c', program], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

test('the real render command disables autoexec before opening a native scene', () => {
  const program = `from pathlib import Path
import importlib.util,json,sys,tempfile
sys.path.insert(0,str(Path('scripts').resolve()))
s=importlib.util.spec_from_file_location('runner',Path('scripts/run-hmh-production-hero-pilot.py'));m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class Capture(Exception):pass
def capture(command,label):raise Capture(command)
m.run_checked=capture
manifest=json.loads(Path('apps/hmh-reboot/assets/source/blender/hmh-production-heroes.json').read_text());pilot=manifest['pilots'][0]
with tempfile.TemporaryDirectory(dir='.tmp') as d:
 p=Path(d);source=p/'native.blend'
 try:m.process_pilot(manifest,pilot,source,p,{},'5.1.2',p/'manifest.json',p/'out')
 except Capture as e:command=e.args[0]
 else:raise AssertionError('render command was not reached')
 assert '--disable-autoexec' in command, command
 assert command.index('--disable-autoexec')<command.index(str(source)),command
 assert '--python-exit-code' in command and command[command.index('--python-exit-code')+1]=='1'
`;
  const result = spawnSync(process.env.PYTHON ?? 'python', ['-c', program], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

test('native preparation never replaces a preserved receipt', () => {
  const program = `import importlib.util
from pathlib import Path
import tempfile
s=importlib.util.spec_from_file_location('prepare',Path('scripts/hmh-blender/prepare-hmh-textured-gameplay-source.py'));m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
with tempfile.TemporaryDirectory(dir='.tmp') as d:
 p=Path(d);a=p/'a.blend';b=p/'b.blend';a.write_bytes(b'a');b.write_bytes(b'b')
 report=p/'new.preparation.json';report.write_text('preserved')
 try:m.validate_paths(a,b,p/'new.blend')
 except FileExistsError:pass
 else:raise AssertionError('pre-existing receipt would be overwritten')
 assert report.read_text()=='preserved'
`;
  const result = spawnSync(process.env.PYTHON ?? 'python', ['-c', program], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

test('gameplay atlas excludes source-only grenade flight but keeps the held prop', () => {
  const program = `import ast\nfrom pathlib import Path\nsource=ast.parse(Path('scripts/hmh-blender/export-hmh-production-hero-pilot.py').read_text())\nfunction=next(n for n in source.body if isinstance(n,ast.FunctionDef) and n.name=='is_actor_atlas_mesh')\nnamespace={}\nexec(compile(ast.Module(body=[function],type_ignores=[]),'<real-export-policy>','exec'),namespace)\nclass Object(dict):type='MESH'\ncheck=namespace['is_actor_atlas_mesh']\nfor actor in ['lit-commando','lit-valkyrie','lilly','lester-original']:\n for role in ['coin-blaster','litecoin-knife','satoshi-frag-held',None]:\n  assert check(Object(hmh_actor_id=actor,hmh_prop_role=role),actor)\n assert not check(Object(hmh_actor_id=actor,hmh_prop_role='satoshi-frag-released'),actor)\n assert not check(Object(hmh_actor_id='other'),actor)\nprint('ONE_AUTHORITATIVE_PROJECTILE')`;
  const result = spawnSync(process.env.PYTHON ?? 'python', ['-c', program], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /ONE_AUTHORITATIVE_PROJECTILE/);
});
