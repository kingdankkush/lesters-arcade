"""Pack four native opaque silhouettes into bounded ground-obstacle alpha atlases."""
import argparse,json,hashlib
from pathlib import Path
from PIL import Image
import numpy as np
p=argparse.ArgumentParser();p.add_argument('--input',required=True);p.add_argument('--output',required=True);a=p.parse_args();source=Path(a.input);out=Path(a.output);out.mkdir(parents=True,exist_ok=True)
names=['rock','log','thorn','crate'];atlas=Image.new('RGBA',(1024,512));frames=[]
for i,name in enumerate(names):
 image=Image.open(source/(name+'.png')).convert('RGBA');bbox=image.getchannel('A').getbbox()
 if not bbox:raise ValueError('empty native silhouette')
 # Each exact same rectangle is applied at runtime. A tight crop makes the
 # model readable while keeping its former floor anchor and drawn extent.
 frame=image.crop(bbox).resize((512,256),Image.Resampling.LANCZOS);atlas.paste(frame,((i%2)*512,(i//2)*256));frames.append({'name':name,'alphaBounds':list(bbox)})
tiers={}
for tier,size in [('medium',(1024,512)),('low',(512,256))]:
 pixels=np.asarray(atlas.resize(size,Image.Resampling.LANCZOS)).copy();pixels[pixels[:,:,3]==0,:3]=0
 file=out/('ground-'+tier+'.webp');Image.fromarray(pixels).save(file,'WEBP',quality=94,method=6,exact=True)
 tiers[tier]={'file':file.name,'width':size[0],'height':size[1],'frameWidth':size[0]//2,'frameHeight':size[1]//2,'decodedBytes':size[0]*size[1]*4,'bytes':file.stat().st_size,'sha256':hashlib.sha256(file.read_bytes()).hexdigest()}
receipt={'schema':'chikun-ground-obstacle-kit-v1','names':names,'tiers':tiers,'native':json.loads((source/'native-receipt.json').read_text()),'crops':frames}
(out/'manifest.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(tiers))
