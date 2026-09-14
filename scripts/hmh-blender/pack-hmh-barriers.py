"""Package proven native renders for browser delivery; source remains editable."""
import json,hashlib
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[2];RAW=ROOT/'work/barrier-frames';OUT=ROOT/'apps/portal/assets/generated/hmh-barriers';OUT.mkdir(parents=True,exist_ok=True)
data=json.loads((RAW/'source.json').read_text());data['tiers']={};sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
for row in data['frames']:
    a=Image.open(RAW/'A'/row['file']).convert('RGBA');b=Image.open(RAW/'B'/row['file']).convert('RGBA')
    assert a.tobytes()==b.tobytes(),row['file']+' repeat render changed pixels'
    assert a.getbbox() and a.getbbox()[0]>1 and a.getbbox()[1]>1 and a.getbbox()[2]<255 and a.getbbox()[3]<255,row['file']+' clipped'
    row['nativeABPixelExact']=True;row['nativeRgbaSha256']=hashlib.sha256(a.tobytes()).hexdigest()
for tier,size in [('desktop',256),('mobile',128)]:
    sheet=Image.new('RGBA',(size*4,size*7));frames=[]
    for i,row in enumerate(data['frames']):
        im=Image.open(RAW/'A'/row['file']).convert('RGBA')
        if size!=256:im=im.resize((size,size),Image.Resampling.LANCZOS)
        x=i%4*size;y=i//4*size;sheet.paste(im,(x,y))
        frames.append({'assetId':row['assetId'],'frame':{'x':x,'y':y,'w':size,'h':size},'anchor':row['anchor'],'runtimeScale':8/size,'projectionY':row['projectionY']})
    target=OUT/f'barriers-{tier}.webp';sheet.save(target,lossless=True,method=6,exact=True)
    assert Image.open(target).convert('RGBA').tobytes()==sheet.tobytes()
    data['tiers'][tier]={'image':target.name,'sha256':sha(target),'bytes':target.stat().st_size,'width':sheet.width,'height':sheet.height,'frames':frames}
data['packerSha256']=sha(Path(__file__))
(OUT/'manifest.json').write_text(json.dumps(data,indent=2)+'\n')
print('NATIVE_BARRIERS_PACKED',[(k,v['bytes']) for k,v in data['tiers'].items()])
