"""Pack locally authored Blender PNGs into bounded phone/desktop alpha WebPs."""
import argparse,hashlib,json
from pathlib import Path
from PIL import Image,ImageDraw
p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--output',required=True);o=p.parse_args();source=Path(o.source);out=Path(o.output);out.mkdir(parents=True,exist_ok=True)
native=json.loads((source/'native-receipt.json').read_text());assets={};board=Image.new('RGB',(1000,620),'#193345');draw=ImageDraw.Draw(board)
for i,row in enumerate(native['assets']):
 name=row['name'];frames=row.get('frames',1);columns=4 if frames>1 else 1;poses=[Image.open(source/(name+('-'+str(f) if frames>1 else '')+'.png')).convert('RGBA') for f in range(frames)];boxes=[im.getchannel('A').point(lambda a:255 if a>5 else 0).getbbox() for im in poses];bounds=(min(b[0] for b in boxes),min(b[1] for b in boxes),max(b[2] for b in boxes),max(b[3] for b in boxes));poses=[im.crop(bounds) for im in poses];img=poses[0];tiers={}
 for tier,scale in [('low',.5),('medium',1)]:
  size=(int(img.width*scale),int(img.height*scale));sheet=Image.new('RGBA',(size[0]*columns,size[1]*(frames//columns)))
  for f,pose in enumerate(poses):sheet.paste(pose.resize(size,Image.Resampling.LANCZOS),((f%columns)*size[0],(f//columns)*size[1]))
  file=name+'-'+tier+'.webp';path=out/file;sheet.save(path,'WEBP',quality=91,method=6);tiers[tier]={'file':file,'width':sheet.width,'height':sheet.height,'frameWidth':size[0],'frameHeight':size[1],'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
 assets[name]={'frames':frames,'columns':columns,'fps':12,'tiers':tiers,'sourceSha256':row['sourceSha256']};thumb=img.copy();thumb.thumbnail((285,260));x=(i%3)*330+24;y=(i//3)*310+38;board.paste(thumb,(x+(285-thumb.width)//2,y),thumb);draw.text((x,y-24),name+(' 8 native frames' if frames>1 else ''),fill='#ffffff')
 if frames>1:
  preview=[im.resize((im.width*2,im.height*2)) for im in poses];preview[0].save(source/(name+'-loop.webp'),save_all=True,append_images=preview[1:],duration=83,loop=0,quality=85)
meta={'schema':'chikun-obstacle-kit-v1','source':'Authored native Blender geometry, no downloaded or generated paid art','assets':assets}
(out/'manifest.json').write_text(json.dumps(meta,indent=2)+'\n');board.save(source/'contact-sheet.png');print(json.dumps({'assets':len(assets),'encodedBytes':sum(t['bytes'] for a in assets.values() for t in a['tiers'].values()),'mediumDecodedBytes':sum(a['tiers']['medium']['width']*a['tiers']['medium']['height']*4 for a in assets.values()),'lowDecodedBytes':sum(a['tiers']['low']['width']*a['tiers']['low']['height']*4 for a in assets.values())}))
