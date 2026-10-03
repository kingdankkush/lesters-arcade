"""Append static native facade variations within the existing obstacle budget."""
import argparse,hashlib,json
from pathlib import Path
from PIL import Image,ImageDraw
p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--output',required=True)
opt=p.parse_args();source=Path(opt.source);out=Path(opt.output)
manifest=json.loads((out/'manifest.json').read_text());native=json.loads((source/'native-receipt.json').read_text())
board=Image.new('RGB',(960,580),'#21313e');draw=ImageDraw.Draw(board)
for row_index,row in enumerate(native['assets']):
 name=row['name'];poses=[Image.open(source/(name+'-'+str(i)+'.png')).convert('RGBA') for i in range(3)]
 bounds=[pose.getchannel('A').point(lambda a:255 if a>5 else 0).getbbox() for pose in poses]
 crop=(min(b[0] for b in bounds),min(b[1] for b in bounds),max(b[2] for b in bounds),max(b[3] for b in bounds))
 poses=[pose.crop(crop) for pose in poses];scale=min(192/poses[0].width,384/poses[0].height)
 size=(max(8,round(poses[0].width*scale)),max(8,round(poses[0].height*scale)));tiers={}
 for tier,factor in [('low',.5),('medium',1)]:
  dims=(max(8,round(size[0]*factor)),max(8,round(size[1]*factor)))
  atlas=Image.new('RGBA',(dims[0]*3,dims[1]))
  for i,pose in enumerate(poses):atlas.paste(pose.resize(dims,Image.Resampling.LANCZOS),(i*dims[0],0))
  file=name+'-'+tier+'.webp';path=out/file;atlas.save(path,'WEBP',quality=92,method=6)
  tiers[tier]={'file':file,'width':atlas.width,'height':atlas.height,'frameWidth':dims[0],'frameHeight':dims[1],'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
 manifest['assets'][name]={'frames':3,'columns':3,'fps':12,'variation':'static-designs','tiers':tiers,'sourceSha256':row['sourceSha256']}
 for i,pose in enumerate(poses):
  pose.thumbnail((100,165));x=row_index*320+i*104+8;board.paste(pose,(x+(100-pose.width)//2,35),pose)
  draw.text((x,210),name+' '+str(i+1),fill='white')
 # Runtime-sized second row is the actual medium art, not just a source render.
 medium=Image.open(out/(name+'-medium.webp')).convert('RGBA');fw=tiers['medium']['frameWidth']
 for i in range(3):
  pose=medium.crop((i*fw,0,(i+1)*fw,medium.height));pose.thumbnail((100,165));x=row_index*320+i*104+8
  board.paste(pose,(x+(100-pose.width)//2,305),pose);draw.text((x,490),'runtime',fill='white')
for tier,cap in [('low',4),('medium',12)]:
 used=sum(a['tiers'][tier]['width']*a['tiers'][tier]['height']*4 for a in manifest['assets'].values())
 if used>cap*1024*1024:raise ValueError('Obstacle kit exceeds '+tier+' decoded cap: '+str(used))
(out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');board.save(source/'facade-contact-sheet.png')
print(json.dumps({'assets':len(manifest['assets']),'encodedBytes':sum(t['bytes'] for a in manifest['assets'].values() for t in a['tiers'].values()),'mediumDecodedBytes':sum(a['tiers']['medium']['width']*a['tiers']['medium']['height']*4 for a in manifest['assets'].values()),'lowDecodedBytes':sum(a['tiers']['low']['width']*a['tiers']['low']['height']*4 for a in manifest['assets'].values())}))
