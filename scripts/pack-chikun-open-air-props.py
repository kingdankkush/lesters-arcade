"""Pack native Blender renders; no generated substitute art enters the runtime."""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
FRAMES=ROOT.parent/'open-air-prop-frames'
OUT=ROOT/'apps/portal/assets/generated/chikun-open-air-v1'
SOURCE=ROOT/'apps/chikun/assets/source/open-air'
OUT.mkdir(parents=True,exist_ok=True)
tree=Image.open(FRAMES/'tree.png').convert('RGBA')
tree.save(OUT/'tree.webp',quality=91,method=6)
sheet=Image.new('RGBA',(1024,256))
for i in range(8):
    frame=Image.open(FRAMES/('drone-%02d.png'%(i+1))).convert('RGBA').resize((256,128),Image.Resampling.LANCZOS)
    sheet.paste(frame,((i%4)*256,(i//4)*128))
sheet.save(OUT/'drone.webp',quality=94,method=6)
manifest={'version':'chikun-open-air-v1','source':'Blender 5.1 native geometry','shapeRecipe':'apps/chikun/assets/obstacle-shapes.json','assets':[]}
for name,frames,w,h,cols,fps in [('tree',1,512,768,1,0),('drone',8,256,128,4,24)]:
    p=OUT/(name+'.webp')
    manifest['assets'].append({'name':name,'file':p.name,'frames':frames,'width':w,'height':h,'columns':cols,'fps':fps,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
manifest['runtimeBytes']=sum(a['bytes'] for a in manifest['assets'])
manifest['sourceFiles']=[{'file':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(SOURCE.glob('*.blend'))]
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
(SOURCE/'provenance.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'runtimeBytes':manifest['runtimeBytes'],'assets':len(manifest['assets'])}))
