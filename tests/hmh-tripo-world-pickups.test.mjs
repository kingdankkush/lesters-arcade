import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));

test('native prop runtime, tests and producers occur exactly once in the syntax gates', () => {
  const source = readFileSync(new URL('../scripts/syntax-check.mjs', import.meta.url), 'utf8');
  const required = {
    NODE_CHECK_FILES: [
      'apps/hmh-reboot/src/tripo-prop-appearance.mjs',
      'tests/hmh-tripo-world-pickups.test.mjs',
      'tests/hmh-tripo-prop-appearance.test.mjs',
      'tests/hmh-tripo-adoption.test.mjs',
      'tests/hmh-tripo-production-asset-qa.test.mjs',
      'scripts/hmh-tripo-production-asset-qa.mjs',
    ],
    PY_COMPILE_FILES: [
      'scripts/hmh-tripo-published-image-qa.py',
      'scripts/hmh_tripo_props.py',
      'scripts/run-hmh-tripo-props.py',
      'scripts/hmh-blender/export-hmh-tripo-props.py',
      'scripts/hmh_tripo_adoption.py',
    ],
  };
  for (const [name, paths] of Object.entries(required)) {
    const block = source.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\n\\];`));
    assert.ok(block, `missing explicit ${name} array`);
    const entries = Array.from(block[1].matchAll(/^\s*['"]([^'"]+)['"],?\s*$/gm), match => match[1]);
    for (const path of paths) {
      assert.equal(entries.filter(entry => entry === path).length, 1, `${path} must be registered exactly once`);
    }
  }
});

const prelude = String.raw`
import copy, hashlib, importlib.util, json, struct, tempfile
from pathlib import Path
from PIL import Image, ImageDraw
source = Path('scripts/hmh_tripo_props.py')
assert source.is_file(), 'native Tripo props intake/packing producer is not implemented'
spec = importlib.util.spec_from_file_location('tripo_props', source)
props = importlib.util.module_from_spec(spec)
spec.loader.exec_module(props)

def fixture(root):
    # Explicitly synthetic GLB unit fixture, never native-production evidence.
    document = json.dumps({'asset': {'version': '2.0'}, 'scenes': [{}]}).encode()
    document += b' ' * ((-len(document)) % 4)
    data = struct.pack('<4sII', b'glTF', 2, 20 + len(document)) + struct.pack('<II', len(document), 0x4e4f534a) + document
    (root / 'GLB').mkdir()
    (root / 'GLB/model.glb').write_bytes(data)
    row = {'id': '01', 'name': '01 - Unit Fixture', 'category': 'environment',
           'glb': 'GLB/model.glb', 'glb_sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data),
           'triangles': 0, 'runtime_approved': False}
    catalog = {'project': 'unit-test-fixture', 'count': 1, 'assets': [row]}
    (root / 'catalog.json').write_text(json.dumps(catalog))
    return catalog

def rejected(fn, words):
    try: fn()
    except (ValueError, TypeError) as error:
        assert any(word in str(error).lower() for word in words), str(error)
    else: raise AssertionError('invalid input accepted')
`;
function run(program) {
  const result = spawnSync(process.env.PYTHON || 'python', ['-B', '-c', prelude + program], {
    cwd: root, encoding: 'utf8', timeout: 60000,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
  });
  assert.equal(result.status, 0, result.error?.message || result.stderr || result.stdout);
}

test('Tripo intake verifies literal catalog IDs, source bytes and projection-only scope', () => run(String.raw`
with tempfile.TemporaryDirectory() as temp:
    root = Path(temp); fixture(root)
    rows = props.ingest_catalog(root, expected_count=1)
    assert len(rows) == 1 and rows[0]['id'] == '01'
    assert rows[0]['glb_sha256'] == hashlib.sha256((root/'GLB/model.glb').read_bytes()).hexdigest()
    assert rows[0]['runtime_approved'] is False
`));

test('Tripo intake rejects drifted hashes, sizes, IDs, duplicates and roster counts', () => run(String.raw`
with tempfile.TemporaryDirectory() as temp:
    root = Path(temp); good = fixture(root)
    for key, value, words in [('glb_sha256', '0'*64, ['hash']), ('bytes', 1, ['size','bytes']), ('id', '1', ['id'])]:
        changed = copy.deepcopy(good); changed['assets'][0][key] = value
        (root/'catalog.json').write_text(json.dumps(changed))
        rejected(lambda: props.ingest_catalog(root, expected_count=1), words)
    duplicate = copy.deepcopy(good); duplicate['count'] = 2; duplicate['assets'] *= 2
    (root/'catalog.json').write_text(json.dumps(duplicate))
    rejected(lambda: props.ingest_catalog(root, expected_count=2), ['duplicate'])
    (root/'catalog.json').write_text(json.dumps(good))
    rejected(lambda: props.ingest_catalog(root, expected_count=56), ['count','roster'])
`));

test('Tripo intake rejects paths outside the provided delivery and external GLB dependencies', () => run(String.raw`
with tempfile.TemporaryDirectory() as temp:
    root = Path(temp); good = fixture(root)
    for path in ['../model.glb', '/outside.glb', 'C:/outside.glb', 'GLB/../../outside.glb']:
        changed = copy.deepcopy(good); changed['assets'][0]['glb'] = path
        (root/'catalog.json').write_text(json.dumps(changed))
        rejected(lambda: props.ingest_catalog(root, expected_count=1), ['path','outside','relative'])
    document = json.dumps({'asset': {'version': '2.0'}, 'images': [{'uri':'https://example.invalid/private.png'}]}).encode()
    document += b' ' * ((-len(document)) % 4)
    data = struct.pack('<4sII', b'glTF', 2, 20+len(document)) + struct.pack('<II', len(document), 0x4e4f534a) + document
    (root/'GLB/model.glb').write_bytes(data)
    good['assets'][0].update(glb_sha256=hashlib.sha256(data).hexdigest(), bytes=len(data))
    (root/'catalog.json').write_text(json.dumps(good))
    rejected(lambda: props.ingest_catalog(root, expected_count=1), ['external','embedded','dependenc'])
`));

test('Tripo frame packing preserves exact RGBA, source identity, pivots and bounded pages', () => run(String.raw`
with tempfile.TemporaryDirectory() as temp:
    root=Path(temp); raw=root/'raw'; raw.mkdir(); rows=[]
    for ident, color in [('01',(30,90,120,255)), ('02',(240,100,40,255))]:
        image=Image.new('RGBA',(64,64),(13,15,17,0))
        ImageDraw.Draw(image).rectangle((8,12,54,50),fill=color)
        image.save(raw/f'{ident}.png')
        rows.append({'id':ident, 'name':f'{ident} - Unit Fixture', 'category':'environment',
                     'glb_sha256':ident*32, 'pivot':[32,53]})
    out=root/'out'; metadata=props.pack_frames(rows,raw,out,max_size=128,padding=2)
    assert metadata['assetCount']==2 and metadata['runtimeAuthority']=='projection-only'
    assert metadata['classification']=='native-render-candidate'
    assert len(metadata['frames'])==2 and len(metadata['pages'])>0
    for frame,row in zip(metadata['frames'],rows):
        assert frame['assetId']==f"tripo-{row['id']}" and frame['sourceModelSha256']==row['glb_sha256']
        assert all(0<=frame['anchor'][axis]<=1 for axis in ['x','y'])
        page=metadata['pages'][frame['page']]
        with Image.open(out/page['image']) as opened:
            image=opened.convert('RGBA'); assert image.width<=128 and image.height<=128
            assert hashlib.sha256(image.tobytes()).hexdigest()==page['decodedRgbaSha256']
            rect=frame['frame']; crop=image.crop((rect['x'],rect['y'],rect['x']+rect['w'],rect['y']+rect['h']))
            assert hashlib.sha256(crop.tobytes()).hexdigest()==frame['sourcePixelSha256']
            assert crop.getpixel((0,0)) == (13,15,17,0), 'colored transparency must survive WebP'
        assert hashlib.sha256((out/page['image']).read_bytes()).hexdigest()==page['sha256']
`));

test('Tripo packer rejects missing, blank, clipped, duplicate and out-of-frame pivot inputs', () => run(String.raw`
with tempfile.TemporaryDirectory() as temp:
    root=Path(temp); raw=root/'raw'; raw.mkdir()
    row={'id':'01','name':'Unit Fixture','category':'environment','glb_sha256':'a'*64,'pivot':[16,28]}
    rejected(lambda: props.pack_frames([row],raw,root/'missing'), ['missing','frame'])
    image=Image.new('RGBA',(32,32)); image.save(raw/'01.png')
    rejected(lambda: props.pack_frames([row],raw,root/'blank'), ['blank','empty','alpha'])
    image=Image.new('RGBA',(32,32),(10,20,30,255)); image.save(raw/'01.png')
    rejected(lambda: props.pack_frames([row],raw,root/'clipped'), ['clip','edge','corner'])
    image=Image.new('RGBA',(32,32)); ImageDraw.Draw(image).rectangle((7,8,22,25),fill=(20,30,40,255)); image.save(raw/'01.png')
    rejected(lambda: props.pack_frames([row,row],raw,root/'duplicate'), ['duplicate'])
    rejected(lambda: props.pack_frames([{**row,'pivot':[-1,16]}],raw,root/'pivot'), ['pivot','anchor'])
`));

test('Tripo native A/B comparison checks every decoded frame and rejects missing or changed pixels', () => run(String.raw`
with tempfile.TemporaryDirectory() as temp:
    root=Path(temp); a=root/'a';b=root/'b';a.mkdir();b.mkdir()
    image=Image.new('RGBA',(8,8)); image.putpixel((3,3),(10,20,30,255))
    for folder in [a,b]: image.save(folder/'01.png')
    result=props.compare_frames(a,b,['01']); assert result['exact'] is True and result['changedFrames']==[]
    image.putpixel((3,3),(11,20,30,255)); image.save(b/'01.png')
    result=props.compare_frames(a,b,['01']); assert result['exact'] is False and result['changedFrames']==['01']
    (b/'01.png').unlink()
    rejected(lambda: props.compare_frames(a,b,['01']), ['missing','frame'])
`));

test('native per-source camera yaw is explicit, validated and leaves the common projection recipe unchanged', () => run(String.raw`
assert callable(getattr(props, 'render_recipe_for_asset', None)), 'per-source native camera recipe is not implemented'
base={'cameraPitchDegrees':45.0,'cameraYawDegrees':0.0,'frameSize':[256,256],'sourceYawDegrees':{'13':90.0,'33':270.0}}
original=json.dumps(base,sort_keys=True)
assert props.render_recipe_for_asset(base,'13')['cameraYawDegrees']==90.0
assert props.render_recipe_for_asset(base,'33')['cameraYawDegrees']==270.0
assert props.render_recipe_for_asset(base,'01')['cameraYawDegrees']==0.0
assert props.render_recipe_for_asset(base,'33')['cameraPitchDegrees']==45.0
assert json.dumps(base,sort_keys=True)==original
for invalid in [float('nan'),45.0,'90',True]:
    bad={**base,'sourceYawDegrees':{'33':invalid}}
    rejected(lambda: props.render_recipe_for_asset(bad,'33'), ['yaw','angle'])
rejected(lambda: props.render_recipe_for_asset({**base,'sourceYawDegrees':{'3':90}},'33'), ['source','id','yaw'])
`));

test('native prop recipe matches verified Blender 5.1 and stays within its two-page raster budget', () => run(String.raw`
import sys
sys.path.insert(0, str(Path('scripts').resolve()))
spec = importlib.util.spec_from_file_location('tripo_driver', Path('scripts/run-hmh-tripo-props.py'))
driver = importlib.util.module_from_spec(spec); spec.loader.exec_module(driver)
assert callable(getattr(driver, 'build_render_recipe', None)), 'native props need one testable bounded render recipe'
recipe = driver.build_render_recipe()
assert recipe['engine'] == 'BLENDER_EEVEE', 'Blender 5.1.2 exposes BLENDER_EEVEE, not the removed NEXT name'
assert recipe['frameSize'] == [256, 256]
expected_facing_ids = ['12','13','18','20','27','33','41','44','45','52','56']
assert recipe['sourceYawDegrees'] == {key: 90 for key in expected_facing_ids}, 'reviewed source facades and pickup fronts are not selected'
assert recipe['cameraPitchDegrees'] == 45.0 and recipe['cameraPitchAxis'] == 'positive-X'
assert recipe['transparent'] is True and recipe['preserveOriginalMaterials'] is True
columns = (2048 - 4) // (recipe['frameSize'][0] + 4)
rows = (2048 - 4) // (recipe['frameSize'][1] + 4)
pages = (56 + columns*rows - 1) // (columns*rows)
assert pages <= 2 and pages*2048*2048*4 <= 32*1024*1024
`));

test('native bake isolates every source in a fresh Blender process with disjoint outputs', () => run(String.raw`
import sys
sys.path.insert(0, str(Path('scripts').resolve()))
spec = importlib.util.spec_from_file_location('tripo_driver', Path('scripts/run-hmh-tripo-props.py'))
driver = importlib.util.module_from_spec(spec); spec.loader.exec_module(driver)
assert callable(getattr(driver, 'native_render_tasks', None)), 'native sources still share cross-asset renderer state'
tasks = driver.native_render_tasks('blender.exe', Path('export.py'), Path('request.json'), Path('out'), ['01','33'])
assert len(tasks) == 4
assert [t['sourceId'] for t in tasks] == ['01','33','01','33']
assert [t['pass'] for t in tasks] == ['a','a','b','b']
assert len({str(t['raw']) for t in tasks}) == 4
assert len({str(t['report']) for t in tasks}) == 4
for task in tasks:
    command = task['command']
    for flag in ['--background','--factory-startup','--disable-autoexec','--source-id']:
        assert flag in command
    assert command[command.index('--source-id')+1] == task['sourceId']
`));

test('a failed native pass is retained without launching a duplicate failing second pass', () => run(String.raw`
import sys
from types import SimpleNamespace
from unittest.mock import patch
sys.path.insert(0, str(Path('scripts').resolve()))
spec = importlib.util.spec_from_file_location('tripo_driver', Path('scripts/run-hmh-tripo-props.py'))
driver = importlib.util.module_from_spec(spec); spec.loader.exec_module(driver)
with tempfile.TemporaryDirectory() as temp:
    scratch=Path(temp); source=scratch/'source'; source.mkdir(); (source/'catalog.json').write_text('{}')
    output=scratch/'failed-candidate'; labels=[]
    row={'id':'01', 'name':'CPU failure fixture', 'category':'environment', 'sourcePath':str(source/'never-imported.glb'), 'glb_sha256':'a'*64, 'bytes':20}
    def failed_process(command, directory, label):
        labels.append(label)
        return {'label':label, 'started':False, 'launchError':'intentional CPU fixture failure'}
    args=SimpleNamespace(source_root=str(source), output=str(output), blender='never-executed', ids=['01'])
    with patch.object(driver, 'parse_args', return_value=args), patch.object(driver.props, 'ingest_catalog', return_value=[row]), patch.object(driver, 'source_hashes', return_value={'01':'a'*64}), patch.object(driver, 'process_record', side_effect=failed_process):
        assert driver.main() == 1
    assert labels == ['a-01'], labels
    receipt=json.loads((output/'receipt.json').read_text())
    assert receipt['status']=='failed' and receipt['canonicalAdoption'] is False
    assert receipt['fullRosterComplete'] is False and not (output/'package').exists()
`));
