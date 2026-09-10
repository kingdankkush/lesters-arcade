import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));

// Frozen from the completed 256px A passes, in production expected-frame order.
// These fixtures deliberately prove impossibility, not an invented successful fit.
const realPackingDimensions = {
"lester-original": [
"79x32 68x40 54x46 68x40 79x32 68x40 54x46 68x40 95x116 95x116 72x132 72x132 54x132 54x133 87x121 86x121 95x114 95x114 72x125 72x125 54x132 54x132 87x125 86x125",
"82x127 91x120 94x114 87x119 94x114 91x120 81x134 64x134 112x109 142x108 112x110 64x134 146x121 112x129 88x126 128x104 88x126 112x129 154x101 128x114 59x128 74x117 59x129 128x114",
"82x105 91x116 94x115 87x111 94x115 91x116 81x111 64x128 112x117 141x106 112x118 63x128 146x90 112x118 88x132 128x126 88x131 112x119 153x105 128x105 59x131 74x134 59x131 128x104",
"86x125 84x127 86x125 89x126 74x139 78x139 76x139 72x139 128x128 140x126 135x127 128x128 144x106 152x101 148x103 142x106 86x111 84x110 87x114 89x116 74x118 78x114 76x120 72x125",
"128x98 140x93 135x101 128x110 144x107 152x107 148x107 142x107 95x119 95x118 94x127 94x125 95x117 59x136 60x133 49x141 49x140 66x134 71x133 69x130 100x133 92x133 63x133 98x119",
"97x118 119x114 114x116 93x120 95x117 95x117 94x119 94x118 95x115 59x130 60x130 49x131 49x131 66x128 71x133 69x134 100x129 93x129 63x134 98x120 97x122 119x111 114x114 93x124",
"95x118 95x120 94x121 94x122 95x120 58x134 54x135 53x136 55x137 54x135 72x133 80x130 86x130 87x131 82x131 99x119 105x116 108x114 109x114 106x116 95x117 95x118 94x119 94x118",
"95x118 58x130 54x130 53x130 55x130 54x130 73x132 80x132 86x132 87x131 82x131 99x120 105x120 108x118 109x118 106x118 95x116 96x111 121x114 132x104 125x77 117x70 72x133 70x129",
"92x116 103x120 113x112 117x103 54x133 54x133 56x117 64x129 73x131 78x125 86x121 89x119 106x122 111x130 106x126 102x119 95x114 96x119 121x122 132x116 125x104 118x98 72x126 70x125",
"92x115 103x98 112x97 116x101 54x133 54x130 56x110 64x96 73x107 78x115 86x125 89x125 105x112 110x85 106x89 101x99 93x99 93x100 101x92 104x93 81x94 80x95 91x96 91x95",
"93x93 93x92 101x96 104x95 81x102 80x102 91x108 91x106 92x99 92x99 92x99 104x94 106x95 103x93 78x95 78x95 79x95 90x95 87x94 91x95 92x92 92x91 93x92 104x95",
"106x94 103x96 78x101 78x101 79x102 90x106 87x104 91x106 95x104 103x99 108x102 119x95 82x94 92x89 95x94 96x83 95x91 103x79 109x95 119x87 82x104 92x97 95x112 95x106",
"96x92 94x83 93x88 92x94 72x107 78x99 75x104 71x109 63x115 74x113 71x114 68x115 88x110 88x114 90x112 92x108 96x109 94x114 93x114 92x113 72x121 78x123 75x122 71x122",
"63x118 74x114 71x115 68x116 89x106 88x100 90x101 92x103 95x94 72x109 113x81 113x94 93x96 90x87 72x101 106x77 106x83 87x89 78x92 64x98 69x89 73x82 78x93 92x96",
"76x99 95x84 93x79 92x96 95x94 72x99 113x80 114x86 93x94 90x105 72x100 106x93 107x96 87x105 78x115 64x111 69x99 73x102 78x114 92x111 76x119 95x99 93x104 91x113",
"94x107 84x114 93x105 101x99 103x111 92x95 90x101 85x93 87x103 92x122 79x95 68x96 85x95 75x96 71x119 96x95 67x93 88x94 104x96 103x99 94x96 84x99 93x103 101x103",
"103x96 93x114 90x112 86x119 87x122 92x114 79x124 68x120 85x125 75x126 71x124 96x120 67x121 88x119 104x114 103x121 98x113 92x114 96x121 98x116 97x99 95x92 88x124 80x123",
"74x122 80x116 85x102 86x96 54x125 58x124 71x117 81x110 89x93 90x86 86x113 88x108 97x102 104x93 104x80 102x75 98x103 92x105 96x89 98x77 97x79 95x81 88x120 80x115",
"74x85 80x76 86x79 86x79 54x127 58x121 71x99 81x77 89x71 90x78 86x122 88x124 97x118 104x95 104x75 102x75 6x21 7x21 22x19 21x19 29x18 28x19 22x23 21x23",
"6x26 7x27 22x22 21x23 29x17 28x17 22x18 21x17 7x21 8x20 7x21 22x19 21x19 22x19 28x18 27x19 28x18 22x23 23x23 21x23 7x27 8x28 7x27 22x24",
"21x23 22x24 28x16 27x16 28x17 22x18 23x17 21x17 18x25 18x26 17x26 17x26 10x28 12x29 12x29 12x27 22x26 20x26 22x26 25x25 27x23 25x24 26x23 26x22",
"18x19 18x21 17x19 17x20 10x18 12x17 12x18 12x18 22x15 20x16 22x16 24x16 27x19 25x20 26x20 26x20 25x13 30x17 6x22 10x17 25x14 25x24 15x26 24x17",
"20x15 25x24 14x31 14x27 33x9 33x9 13x31 13x31 29x19 26x16 28x18 13x32 25x25 30x9 6x21 10x24 25x25 25x15 15x12 24x17 20x21 25x15 14x10 14x11",
"33x9 33x11 13x10 13x8 29x8 26x16 28x11 13x9 10x8 8x12 8x10 1x1 1x1 8x8 8x13 8x10 1x1 1x1 9x8 8x12 7x10 1x1 1x1 11x9",
"8x11 9x12 1x1 1x1 10x12 8x12 8x12 1x1 1x1 8x13 8x12 8x13 1x1 1x1 9x12 8x11 7x13 1x1 1x1 11x11 8x12 9x11 1x1 1x1",
"20x26 21x25 21x21 19x20 15x18 17x17 12x30 11x28 12x26 14x23 21x19 24x18 18x27 19x26 24x25 28x20 29x20 29x20 24x25 27x25 29x20 29x20 25x22 25x23",
"20x22 21x21 21x20 19x21 15x25 16x25 12x19 11x18 12x18 14x21 21x22 24x20 18x17 19x14 24x15 28x14 29x12 29x11 24x18 27x17 29x14 29x11 25x10 25x10"
].join(" "),
"lilly": [
"79x32 68x40 54x46 68x40 79x32 68x40 54x46 68x40 72x109 72x109 73x112 73x112 53x121 53x121 52x118 53x118 72x112 72x112 73x110 73x111 53x117 53x118 52x117 53x117",
"65x110 70x102 70x113 66x129 70x114 71x103 61x120 53x117 117x102 146x102 117x103 54x118 120x113 78x119 115x109 153x81 115x108 78x119 124x98 97x110 61x122 87x107 62x123 96x112",
"65x105 70x111 70x116 66x108 70x118 71x112 61x104 52x117 117x102 146x87 117x103 53x117 120x87 78x109 115x114 153x108 115x114 78x109 124x96 97x94 61x123 87x123 62x122 96x92",
"67x106 66x110 67x107 69x106 58x118 60x118 57x118 53x118 98x117 112x114 105x116 96x117 111x106 120x100 115x102 109x106 67x113 66x112 67x114 69x117 58x113 59x111 57x114 53x118",
"98x96 112x93 105x99 96x106 111x96 120x98 115x97 109x96 72x103 72x104 72x104 72x102 72x105 61x114 62x114 48x117 52x117 67x113 35x121 37x121 53x119 46x120 44x121 65x116",
"63x116 81x111 77x113 61x118 72x109 72x110 72x111 72x110 72x112 61x120 62x122 47x120 52x119 67x119 35x125 37x126 53x121 46x121 44x126 65x116 64x118 81x112 77x114 61x118",
"72x102 72x104 72x103 72x103 72x101 60x114 54x117 53x117 56x117 55x116 36x121 40x121 44x120 45x120 42x120 66x116 72x114 75x111 76x111 73x113 72x109 72x112 72x111 72x108",
"72x110 60x117 54x122 53x126 56x115 55x118 36x123 40x126 44x128 45x121 42x123 66x115 72x120 75x118 76x115 73x114 72x108 81x104 105x101 119x88 124x67 120x69 73x113 76x110",
"86x95 93x69 89x84 86x95 54x121 51x115 45x92 43x73 47x92 52x102 51x118 62x115 86x99 103x72 112x72 111x81 72x111 81x114 105x108 122x96 127x74 124x63 73x111 76x113",
"86x115 96x116 95x105 92x97 54x119 51x122 45x117 44x120 47x113 52x105 51x118 62x121 86x112 102x111 110x97 110x87 104x142 102x144 99x149 98x151 87x158 87x158 85x162 84x161",
"104x160 102x159 99x160 98x158 87x160 87x161 85x156 84x157 104x145 102x146 102x144 99x151 96x152 96x151 87x158 84x158 84x158 83x161 84x160 86x160 104x159 102x157 102x158 99x159",
"96x159 96x159 87x161 84x161 84x161 83x158 84x158 86x157 104x146 100x152 102x151 96x156 88x157 84x154 89x160 93x150 104x158 100x150 102x159 96x156 88x162 84x161 89x159 93x164",
"105x139 99x128 96x132 99x139 97x147 77x139 75x143 94x147 66x157 80x152 76x154 65x158 76x162 92x158 88x159 74x163 105x162 100x166 96x164 99x162 97x161 77x165 75x164 94x160",
"66x160 80x157 76x158 65x158 75x154 92x146 88x148 74x153 104x140 101x136 100x126 99x130 101x140 97x145 83x151 85x124 88x127 94x147 75x154 71x165 72x131 73x132 74x156 83x161",
"84x165 99x131 92x140 81x162 105x161 101x159 100x150 99x152 101x161 97x162 83x152 85x165 87x167 94x160 75x163 71x148 72x169 73x169 74x161 83x156 84x145 99x155 92x158 81x155",
"105x146 101x150 99x146 99x139 101x146 97x151 83x159 75x154 81x144 94x151 75x157 67x161 80x158 69x150 70x157 87x160 85x158 87x155 92x154 85x159 105x158 101x152 98x158 99x160",
"101x157 97x160 82x152 75x160 81x165 94x159 75x162 67x154 80x161 69x165 70x162 87x159 84x158 87x158 92x157 85x159 105x148 107x146 136x138 159x117 168x86 163x82 97x153 87x146",
"108x119 122x98 129x111 130x121 63x157 66x147 82x110 91x97 89x123 88x136 74x158 89x148 117x118 138x95 146x103 145x119 105x156 107x154 137x140 159x117 168x105 163x99 97x158 87x163",
"108x164 122x154 129x135 130x127 63x162 66x167 82x168 91x164 89x150 89x141 74x161 89x163 117x157 138x151 146x129 145x112 7x22 7x21 22x19 22x19 28x18 28x18 22x23 21x24",
"7x26 7x27 22x23 22x23 28x16 28x17 22x18 21x18 7x22 7x21 7x22 22x19 21x19 21x19 28x18 28x19 28x18 23x23 23x23 22x23 7x26 7x27 7x27 22x23",
"21x23 21x23 28x17 28x17 28x16 23x18 22x17 22x18 16x27 15x28 15x28 14x27 11x28 13x30 13x29 14x28 23x25 21x26 22x25 24x25 25x23 23x24 24x23 25x22",
"16x20 15x22 15x20 14x20 11x19 13x19 13x18 14x17 22x18 21x18 22x18 24x17 25x21 23x22 24x21 25x21 23x9 30x15 5x21 7x17 23x10 28x20 20x25 25x16",
"22x14 27x20 20x28 9x28 34x9 33x9 19x29 9x31 25x23 25x17 27x19 10x32 22x27 32x12 5x22 7x25 23x27 28x18 20x10 25x18 22x22 27x18 19x9 9x11",
"34x9 33x12 18x10 9x6 25x5 25x16 27x11 10x7 11x7 7x12 8x9 1x1 1x1 8x7 8x13 8x9 1x1 1x1 10x8 8x13 8x10 1x1 1x1 12x8",
"7x12 9x11 1x1 1x1 11x11 7x11 8x12 1x1 1x1 8x13 8x11 8x13 1x1 1x1 10x12 8x11 8x13 1x1 1x1 12x10 7x12 9x11 1x1 1x1",
"17x28 12x29 17x29 22x23 18x19 15x20 11x30 12x30 22x24 26x16 25x18 22x19 18x28 21x25 26x14 29x12 30x18 30x20 23x25 21x23 20x11 20x14 23x22 25x23",
"17x23 12x22 17x15 22x15 18x21 15x23 11x21 12x22 22x20 26x14 25x15 22x17 18x18 21x22 26x25 29x18 30x7 31x8 23x20 21x25 20x27 20x21 23x16 25x14"
].join(" ")
};

for (const [actor, dimensions] of Object.entries(realPackingDimensions)) {
  test(`${actor} real 648-frame fixture fails with a mathematical area witness`, () => run(`
dimensions = ${JSON.stringify(dimensions)}
records = [{'id':str(i), 'bbox':(0,0,*map(int,token.split('x')))} for i,token in enumerate(dimensions.split())]
assert len(records) == 648
assert sum(r['bbox'][2]*r['bbox'][3] for r in records) > 2048*2048
try:
    module.shelf_pack(records, 2, 2048)
except RuntimeError as error:
    assert 'Atlas area impossible' in str(error), str(error)
    assert 'cropArea=' in str(error) and 'paddedArea=' in str(error), str(error)
else:
    raise AssertionError('impossible real atlas accepted')
`));
}

test('shelf-fit placement and encoded atlas bytes retain the established layout', () => run(String.raw`
records = [{'id':rid,'bbox':(0,0,w,h)} for rid,w,h in [('b',501,400),('a',501,400),('c',200,100)]]
size, placements = module.shelf_pack(records,2,2048)
expected = {'a':(2,2,501,400), 'b':(505,2,501,400), 'c':(2,404,200,100)}
assert size == 1024 and placements == expected
for suffix in ['png','webp']:
    atlases = []
    for name, layout in [('legacy',expected),('current',placements)]:
        atlas = Image.new('RGBA',(size,size))
        for index,rid in enumerate(sorted(layout)):
            x,y,w,h = layout[rid]
            atlas.paste(Image.new('RGBA',(w,h),(index+20,80,90,255)),(x,y))
        path = output / (name+'.'+suffix)
        module._save_atlas_image(atlas,path)
        atlases.append(path.read_bytes())
    assert atlases[0] == atlases[1]
`));

test('packing preserves dimensions, bounds, padding, non-overlap and input-order determinism', () => run(String.raw`
import random
rng = random.Random(710)
records = [{'id':str(i),'bbox':(0,0,rng.randint(1,70),rng.randint(1,90))} for i in range(150)]
original = json.dumps(records)
first = module.shelf_pack(records,2,2048)
for _ in range(5):
    shuffled = list(records); rng.shuffle(shuffled)
    assert module.shelf_pack(shuffled,2,2048) == first
assert json.dumps(records) == original
size, placements = first
assert set(placements) == {r['id'] for r in records}
for i,record in enumerate(records):
    x,y,w,h = placements[record['id']]
    assert (w,h) == tuple(record['bbox'][2:])
    assert x>=2 and y>=2 and x+w+2<=size and y+h+2<=size
    for other in records[i+1:]:
        xx,yy,ww,hh = placements[other['id']]
        assert x+w+2<=xx or xx+ww+2<=x or y+h+2<=yy or yy+hh+2<=y
`));

test('oversized single rectangles never escape the approved atlas bounds', () => run(String.raw`
for width,height in [(1021,10),(10,1021),(2045,1)]:
    try:
        module.shelf_pack([{'id':'oversized','bbox':(0,0,width,height)}],2,1024 if max(width,height)<2045 else 2048)
    except RuntimeError as error:
        assert 'Rectangle exceeds atlas bounds' in str(error),str(error)
    else:
        raise AssertionError('out-of-bounds rectangle accepted')
`));

test('impossible padded area is distinguished from a layout search failure', () => run(String.raw`
# Fits by unpadded area, cannot fit the established 2px border and spacing.
records = [{'id':str(i),'bbox':(0,0,510,510)} for i in range(4)]
try:
    module.shelf_pack(records,2,1024)
except RuntimeError as error:
    assert 'Atlas area impossible' in str(error),str(error)
else:
    raise AssertionError('padding was weakened to fit')
# Small area is necessary, not sufficient: two 600px squares cannot share this bin.
records = [{'id':str(i),'bbox':(0,0,600,600)} for i in range(2)]
try:
    module.shelf_pack(records,2,1024)
except RuntimeError as error:
    assert 'Atlas area impossible' not in str(error),str(error)
else:
    raise AssertionError('geometrically impossible layout accepted')
`));
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
  const program = `${prelude}\nscratch = root / '.tmp/team/packing/test-tmp'\nscratch.mkdir(parents=True, exist_ok=True)\nwith tempfile.TemporaryDirectory(prefix='hmh-atlas-encoding-', dir=scratch) as directory:\n    output = Path(directory)\n${body.split('\n').map(line => '    ' + line).join('\n')}`;
  const result = spawnSync(process.env.PYTHON ?? 'python', ['-B', '-c', program, root], { encoding: 'utf8', timeout: 30_000 });
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
pilot = json.loads(json.dumps(manifest['pilots'][0]))
manifest['directions'] = ['south']
pilot['frameSize'] = [8, 4]
pilot['sourcePivot'] = [4, 3]
pilot['layers'] = ['lower-body']
pilot['clips'] = {'lower-body': {'idle': {'frames': 1, 'fps': 10, 'loop': True}}}
frames = module.expected_frames(manifest, pilot)
assert len(frames) == 1
record = {**frames[0], 'bbox': [0, 0, 8, 4], 'image': image, 'opaquePixels': 24, 'decodedHash': hashlib.sha256(image.tobytes()).hexdigest()}
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

test('decoded image QA counts released null cells but still rejects blank body art', () => run(String.raw`
import subprocess
atlas=Image.new('RGBA',(4,1),(0,0,0,0));atlas.putpixel((0,0),(255,50,30,255))
image_path=output/'fixture.png';metadata_path=output/'fixture.json';atlas.save(image_path)
def frame(layer,state,index,x):
    return {'id':f'fixture__{layer}__{state}__east__{index:03d}','layer':layer,'state':state,'direction':'east','frameIndex':index,'frame':{'x':x,'y':0,'w':1,'h':1},'orig':{'w':1,'h':1},'trim':{'x':0,'y':0,'w':1,'h':1},'opaquePixels':int(x==0)}
frames=[frame('lower-body','idle',0,0),frame('weapon','grenade',3,1),frame('weapon','grenade',4,2)]
for f in frames[1:]:f['visibility']='source-prop-released'
metadata={'schemaVersion':2,'frames':frames}
def check():
    metadata_path.write_text(json.dumps(metadata))
    return subprocess.run([sys.executable,str(root/'scripts/hmh-hero-atlas-image-report.py'),'--image',str(image_path),'--metadata',str(metadata_path)],capture_output=True,text=True)
result=check()
assert result.returncode==0,result.stderr
report=json.loads(result.stdout)
assert report['intentionalHiddenFrameCount']==2 and report['illegalDuplicateGroups']==0
frames[1]['visibility']='ignore-blank'
assert check().returncode!=0
frames[1]['visibility']='source-prop-released'
frames[0]['opaquePixels']=0;frames[0]['frame']['x']=3
assert check().returncode!=0, 'unannotated blank body was accepted'
`));

test('full pipeline counts visible animation separately from complete frame coverage', () => run(String.raw`
count=getattr(module,'expected_visible_animated_count',None)
assert callable(count), 'pipeline visible-frame count helper is missing'
manifest=json.loads((root/'apps/hmh-reboot/assets/source/blender/hmh-production-heroes.json').read_text())
pilot=manifest['pilots'][0]
frames=module.expected_frames(manifest,pilot)
assert len(frames)==648 and count(frames)==640
pilot['releasedWeaponFrameIndices']=[3,4]
frames=module.expected_frames(manifest,pilot)
assert len(frames)==648 and count(frames)==624
source=(root/'scripts/run-hmh-production-hero-pilot.py').read_text()
assert 'expected_animated_frames = expected_visible_animated_count(frames)' in source
`));

test('native grenade visibility declares only the two released-prop frames', () => run(String.raw`
manifest = json.loads((root / 'apps/hmh-reboot/assets/source/blender/hmh-production-heroes.json').read_text())
pilot = manifest['pilots'][0]
pilot['releasedWeaponFrameIndices'] = [3, 4]
frames = module.expected_frames(manifest, pilot)
hidden = [frame for frame in frames if frame.get('visibility') == 'source-prop-released']
assert len(hidden) == 16, 'eight directions each require two explicit released-prop frames'
assert all(frame['layer'] == 'weapon' and frame['state'] == 'grenade' and frame['frameIndex'] in [3, 4] for frame in hidden)
for bad in [[0, 3, 4], [3], [3, 4, 5], ['3', 4]]:
    pilot['releasedWeaponFrameIndices'] = bad
    try:
        module.expected_frames(manifest, pilot)
    except (ValueError, TypeError):
        pass
    else:
        raise AssertionError('invalid release visibility contract accepted: ' + repr(bad))
`));

test('released-prop zero frames roundtrip losslessly while unexpected empty or visible frames fail', () => run(String.raw`
manifest = json.loads((root / 'apps/hmh-reboot/assets/source/blender/hmh-production-heroes.json').read_text())
manifest['directions'] = ['south']
pilot = manifest['pilots'][0]
pilot.update(frameSize=[8, 4], sourcePivot=[4, 3], compactTrim=True, layers=['weapon'], releasedWeaponFrameIndices=[3, 4])
pilot['clips'] = {'weapon': {'grenade': {'frames': 5, 'fps': 10, 'loop': False}}}
pilot['output'].update(atlas='release.webp', metadata='release.json')
frames = module.expected_frames(manifest, pilot)
for frame in frames:
    im = Image.new('RGBA', (8, 4))
    if frame['frameIndex'] < 3:
        for y in [1, 2]:
            for x in [2, 3, 4]:
                im.putpixel((x,y),(60 + frame['frameIndex']*40,90,110,255))
    im.save(output / frame['filename'])
analysis = module.analyze_frame_set(output, frames, (8,4), (4,3), 12)
assert len(analysis['records']) == 5
assert len(analysis['intentionalHiddenFrames']) == 2
assert analysis['uniqueAnimatedFrameCount'] == 3
assert analysis['empty'] == []
atlas, metadata, sizes = module.build_atlas(manifest, pilot, analysis, output)
data = json.loads(metadata.read_text())
assert sizes['reconstructedFrames'] == 5 and sizes['reconstructionPixelDifferences'] == 0
hidden = [frame for frame in data['frames'] if frame.get('visibility') == 'source-prop-released']
assert len(hidden) == 2 and all(frame['opaquePixels'] == 0 for frame in hidden)
with Image.open(atlas) as decoded:
    for frame in hidden:
        rect = frame['frame']
        assert rect['w'] == rect['h'] == 1
        assert decoded.convert('RGBA').getpixel((rect['x'],rect['y'])) == (0,0,0,0)
unmarked = [{key:value for key,value in frame.items() if key != 'visibility'} for frame in frames]
try:
    module.analyze_frame_set(output, unmarked, (8,4), (4,3), 12)
except RuntimeError as error:
    assert 'empty=' in str(error)
else:
    raise AssertionError('unexplained empty frames accepted')
im = Image.new('RGBA', (8,4));im.putpixel((4,2),(50,80,90,255));im.save(output / frames[3]['filename'])
try:
    module.analyze_frame_set(output, frames, (8,4), (4,3), 12)
except RuntimeError as error:
    assert 'released' in str(error)
else:
    raise AssertionError('a declared released prop remained visible')
`));

test('frame QA counts alpha correctly without the newer Pillow flattened-data API', () => run(String.raw`
newer_api = getattr(Image.Image, 'get_flattened_data', None)
if newer_api is not None:
    delattr(Image.Image, 'get_flattened_data')
try:
    frame = {'id': 'compat__lower-body__idle__south__000', 'filename': 'cell.png', 'layer': 'lower-body', 'state': 'idle', 'direction': 'south', 'frameIndex': 0}
    cell = Image.new('RGBA', (8, 4), (17, 19, 23, 0))
    cell.putpixel((2, 1), (10, 20, 30, 255))
    cell.save(output / frame['filename'])
    report = module.analyze_frame_set(output, [frame], (8, 4), (4, 3), 12)
    assert report['records'][0]['opaquePixels'] == 1
    assert report['uniqueAnimatedFrameCount'] == 1
    assert report['empty'] == [] and report['cornerFailures'] == []
finally:
    if newer_api is not None:
        Image.Image.get_flattened_data = newer_api
`));

test('premultiplied comparison preserves exact drift metrics on the deployment Pillow API', () => run(String.raw`
newer_api = getattr(Image.Image, 'get_flattened_data', None)
if newer_api is not None:
    delattr(Image.Image, 'get_flattened_data')
try:
    a, b = output / 'a', output / 'b'
    a.mkdir(); b.mkdir()
    frame = {'id': 'compat', 'filename': 'cell.png'}
    cell = Image.new('RGBA', (8, 4), (17, 19, 23, 0))
    cell.putpixel((2, 1), (10, 20, 30, 255)); cell.save(a / 'cell.png')
    cell.putpixel((0, 0), (200, 210, 220, 0)); cell.save(b / 'cell.png')
    assert module.compare_premultiplied(a, b, [frame]) == {'maxChangedVisiblePixels': 0, 'maxChannelDelta': 0, 'maxTotalChannelDelta': 0, 'worstFrameId': 'compat'}
    cell.putpixel((2, 1), (11, 20, 30, 255)); cell.save(b / 'cell.png')
    assert module.compare_premultiplied(a, b, [frame]) == {'maxChangedVisiblePixels': 1, 'maxChannelDelta': 1, 'maxTotalChannelDelta': 1, 'worstFrameId': 'compat'}
finally:
    if newer_api is not None:
        Image.Image.get_flattened_data = newer_api
`));
