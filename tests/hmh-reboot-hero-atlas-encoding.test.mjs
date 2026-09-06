import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const prelude = String.raw`
import hashlib, importlib.util, json, sys, tempfile
from pathlib import Path
from PIL import Image
root = Path(sys.argv[1])
sys.path.insert(0, str(root / 'scripts'))
spec = importlib.util.spec_from_file_location('hero_pilot', root / 'scripts/run-hmh-production-hero-pilot.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
image = Image.new('RGBA', (8, 4))
for y in range(4):
    for x in range(8):
        image.putpixel((x, y), ((x*31+7)%256, (y*63+11)%256, (x*17+y*19+23)%256, [0, 64, 128, 255][y]))
`;
function run(body) {
  const program = `${prelude}\nwith tempfile.TemporaryDirectory(prefix='hmh-atlas-encoding-') as directory:\n    output = Path(directory)\n${body.split('\n').map(line => '    ' + line).join('\n')}`;
  const result = spawnSync(process.env.PYTHON ?? 'python', ['-c', program, root], { encoding: 'utf8', timeout: 30_000 });
  assert.equal(result.status, 0, `${result.error?.message ?? ''}\n${result.stderr}\n${result.stdout}`);
}

test('PNG encoding retains the exact established compressor bytes', () => run(String.raw`
legacy = output / 'legacy.png'
current = output / 'current.png'
image.save(legacy, optimize=False, compress_level=9)
module._save_atlas_image(image, current)
assert current.read_bytes() == legacy.read_bytes()
assert Image.open(current).convert('RGBA').tobytes() == image.tobytes()
`));

test('lossless exact WebP preserves all RGBA including colored alpha-zero pixels', () => run(String.raw`
for suffix in ['webp', 'WEBP']:
    path = output / ('hero.' + suffix)
    module._save_atlas_image(image, path)
    with Image.open(path) as decoded:
        assert decoded.format == 'WEBP'
        assert decoded.size == image.size
        assert decoded.convert('RGBA').tobytes() == image.tobytes()
`));

test('unsupported atlas extension fails without creating a misleading output', () => run(String.raw`
for suffix in ['jpg', 'atlas', '']:
    path = output / ('hero.' + suffix)
    try:
        module._save_atlas_image(image, path)
    except ValueError as error:
        assert 'Unsupported atlas suffix' in str(error)
    else:
        raise AssertionError('unsupported format accepted')
    assert not path.exists()
`));

test('real atlas builder keeps metadata, packing and decoded pixels identical across encodings', () => run(String.raw`
manifest = json.loads((root / 'apps/hmh-reboot/assets/source/blender/hmh-production-heroes.json').read_text())
pilot = manifest['pilots'][0]
manifest['directions'] = ['south']
pilot['layers'] = ['lower-body']
pilot['clips'] = {'lower-body': {'idle': {'frames': 1, 'fps': 10, 'loop': True}}}
frames = module.expected_frames(manifest, pilot)
assert len(frames) == 1
record = {'id': frames[0]['id'], 'bbox': [0, 0, 8, 4], 'image': image, 'opaquePixels': 24, 'decodedHash': hashlib.sha256(image.tobytes()).hexdigest()}
analysis = {'records': [record]}
reports = []
for suffix in ['png', 'webp']:
    pilot['output']['atlas'] = 'hero.' + suffix
    pilot['output']['metadata'] = 'hero-' + suffix + '.json'
    atlas, metadata, dimensions = module.build_atlas(manifest, pilot, analysis, output)
    data = json.loads(metadata.read_text())
    assert data.pop('image') == './hero.' + suffix
    with Image.open(atlas) as decoded:
        assert decoded.size == (dimensions['width'], dimensions['height'])
        pixels = decoded.convert('RGBA').tobytes()
    reports.append((data, pixels))
assert reports[0] == reports[1]
`));
