"""Render/check face-level hero busts with immutable source and pixel receipts."""
import argparse
import hashlib
import importlib.util
import io
import json
import subprocess
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CONFIG = 'apps/hmh-reboot/assets/source/blender/hmh-hero-portrait-render.json'
OUT = ROOT / 'apps/portal/assets/generated/hmh-hero-portraits'
META = OUT / 'portraits.json'
MODULE = ROOT / 'apps/portal/src/generated/hmh-hero-portraits.mjs'
BLENDER = Path('D:/Apps/Blender/blender.exe')
EXPORTER = 'scripts/hmh-blender/export-hmh-hero-portraits.py'
def digest(data): return hashlib.sha256(data).hexdigest()
def load(path): return json.loads(path.read_text(encoding='utf-8'))
spec = importlib.util.spec_from_file_location('legacy_selector',ROOT / 'scripts/run-hmh-hero-selector-render.py')
legacy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(legacy)

def sources(config):
    result = {}
    for file in [CONFIG, config['sourceManifest'], EXPORTER, 'scripts/hmh-hero-portraits.py',
                 'scripts/hmh-blender/export-hmh-production-hero-pilot.py', 'scripts/run-hmh-hero-selector-render.py']:
        result[file] = digest((ROOT / file).read_bytes())
    for pilot in load(ROOT / config['sourceManifest'])['pilots']:
        source = pilot['sourceModel']
        result[source['path']] = legacy.verified_source_sha(ROOT / source['path'],{'sha256':source['sourceSha256'],'bytes':source['sourceBytes']})
    return result

def module_bytes(meta):
    return ('// Native gameplay-source bust portraits; projection only.\nexport const HMH_HERO_PORTRAITS = Object.freeze(' + json.dumps(meta['atlas'],separators=(',',':')) + ');\n').encode()

def verify(config):
    meta=load(META)
    assert meta['sources']==sources(config),'portrait source provenance changed'
    assert MODULE.read_bytes()==module_bytes(meta),'portrait module drift'
    assert len(meta['atlas']['heroes'])==4
    total=0
    for hero in meta['atlas']['heroes'].values():
        data=(ROOT / 'apps/portal' / hero['image'].lstrip('/')).read_bytes()
        assert len(data)==hero['imageBytes'] and digest(data)==hero['imageSha256']
        assert len(data)<=min(524288,config['maxBytesPerAtlas'])
        decoded=Image.open(io.BytesIO(data)).convert('RGBA')
        assert decoded.size==(config['frameSize']*5,config['frameSize'])
        assert digest(decoded.tobytes())==hero['pixelSha256']
        assert len(hero['frames'])==8
        total+=len(data)
    assert total<=min(2097152,config['maxTotalBytes'])
    print(json.dumps({'status':'pass','heroes':4,'totalBytes':total,'sourcesUnchanged':True}))

def main():
    parser=argparse.ArgumentParser(); parser.add_argument('--check',action='store_true'); args=parser.parse_args()
    config=load(ROOT / CONFIG)
    if args.check: return verify(config)
    before=sources(config)
    pilots=load(ROOT / config['sourceManifest'])['pilots']
    runs=ROOT / '.tmp/hero-portraits'
    runs.mkdir(parents=True,exist_ok=True)
    drift=[]; heroes={}; size=config['frameSize']
    for pilot in pilots:
        actor=pilot['actorId']; source=ROOT / pilot['sourceModel']['path']
        assert source.stat().st_size==pilot['sourceModel']['sourceBytes'],'materialized source required'
        for run in ['a','b']:
            with (runs / f'{actor}-{run}.log').open('w',encoding='utf-8') as log:
                subprocess.run([str(BLENDER),'--background','--disable-autoexec',str(source),'--python',str(ROOT / EXPORTER),'--',actor,str(runs / run)],cwd=ROOT,stdout=log,stderr=subprocess.STDOUT,check=True)
            print(f'{actor}: render {run} complete',flush=True)
        atlas=Image.new('RGBA',(size*5,size))
        for index in range(5):
            a=Image.open(runs / 'a' / f'{actor}-{index}.png').convert('RGBA')
            b=Image.open(runs / 'b' / f'{actor}-{index}.png').convert('RGBA')
            diff=legacy.compare_premultiplied(a,b)
            drift.append({'actor':actor,'frame':index,**diff})
            assert diff['changed']<=8 and diff['maxDelta']<=2 and diff['totalDelta']<=32,drift[-1]
            bounds=a.getchannel('A').getbbox()
            assert bounds and bounds[1]>1 and bounds[3]==size,'head needs clearance and torso must meet crop edge'
            atlas.paste(a,(index*size,0))
        # Normalize only invisible RGB. Preserve every channel of every pixel
        # with nonzero alpha, then encode the resulting RGBA exactly.
        atlas.putdata([pixel if pixel[3] else (0,0,0,0) for pixel in atlas.getdata()])
        stream=io.BytesIO(); atlas.save(stream,format='WEBP',lossless=True,exact=True,quality=100,method=6)
        data=stream.getvalue(); assert len(data)<=config['maxBytesPerAtlas'],(actor,len(data))
        OUT.mkdir(parents=True,exist_ok=True)
        image=f'/assets/generated/hmh-hero-portraits/{actor}.webp'
        (OUT / f'{actor}.webp').write_bytes(data)
        heroes['lester' if actor=='lester-original' else actor]={'actorId':actor,'image':image,'imageBytes':len(data),'imageSha256':digest(data),'pixelSha256':digest(atlas.tobytes()),'frames':[f'{image}#frame={i*size},0,{size},{size},{5*size},{size}' for i in config['playOrder']],'frameDurationMs':config['frameDurationMs']}
    assert sources(config)==before,'source changed while rendering'
    meta={'pipelineId':config['pipelineId'],'sources':before,'drift':drift,'atlas':{'directions':['south','portrait-right','portrait-rightmost','portrait-right','south','portrait-left','portrait-leftmost','portrait-left'],'restDirection':'south','heroes':heroes}}
    META.write_text(json.dumps(meta,indent=2)+'\n',encoding='utf-8',newline='\n')
    MODULE.write_bytes(module_bytes(meta))
    verify(config)

if __name__=='__main__': main()
