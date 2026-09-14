"""Verify decoded native enemy pixels, clip coverage and bounded uniqueness."""
import argparse,hashlib,json
from pathlib import Path
from PIL import Image
p=argparse.ArgumentParser();p.add_argument('--image',required=True);p.add_argument('--metadata',required=True);a=p.parse_args()
source=Path(a.image);meta=json.loads(Path(a.metadata).read_text());image=Image.open(source).convert('RGBA')
assert hashlib.sha256(source.read_bytes()).hexdigest()==meta['imageSha256']
assert image.size==(meta['dimensions']['width'],meta['dimensions']['height'])
counts={'idle':4,'run':12,'tell':4,'attack':6,'hit':3,'death':6}
minimum={'idle':3,'run':8,'tell':3,'attack':4,'hit':2,'death':5}
groups={}
for f in meta['frames']:
    r=f['frame'];assert r['x']>=0 and r['y']>=0 and r['x']+r['w']<=image.width and r['y']+r['h']<=image.height
    crop=image.crop((r['x'],r['y'],r['x']+r['w'],r['y']+r['h']))
    assert sum(v>8 for v in crop.getchannel('A').getdata())==f['opaquePixels']>0
    canvas=Image.new('RGBA',(f['sourceSize']['w'],f['sourceSize']['h']))
    canvas.paste(crop,(f['sourcePivot']['x']-f['pivot']['x'],f['sourcePivot']['y']-f['pivot']['y']))
    key=(f['phase'],f['state'],f['direction']);groups.setdefault(key,[]).append((f['frameIndex'],hashlib.sha256(canvas.tobytes()).hexdigest()))
for phase in meta['phases'] or [None]:
    for direction in meta['directions']:
        for state,count in counts.items():
            frames=groups[(phase,state,direction)];assert sorted(i for i,_ in frames)==list(range(count))
            assert len(set(d for _,d in frames))>=minimum[state]
alpha=image.getchannel('A').tobytes()
print(json.dumps({'width':image.width,'height':image.height,'imageBytes':source.stat().st_size,'decodedRgbaBytes':image.width*image.height*4,
 'frameCount':len(meta['frames']),'clipCount':len(groups),'transparentPixels':sum(v==0 for v in alpha),'opaquePixels':sum(v>=200 for v in alpha)}))
