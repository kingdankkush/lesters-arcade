"""Pack registered native poses into bounded, guttered phone/full WebP sheets."""
import argparse,hashlib,json
from pathlib import Path
from PIL import Image,ImageDraw
p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--output',required=True)
opt=p.parse_args();source=Path(opt.source);out=Path(opt.output);out.mkdir(parents=True,exist_ok=True)
native=json.loads((source/'native-receipt.json').read_text());manifest={'schema':'chikun-sky-kit-v1','frames':8,'columns':4,'fps':12,'assets':{}}
board=Image.new('RGB',(1024,660),'#314650');draw=ImageDraw.Draw(board)
for row,asset in enumerate(native['assets']):
 name=asset['name'];poses=[Image.open(source/f'{name}-{i}.png').convert('RGBA') for i in range(8)]
 bounds=[pose.getchannel('A').point(lambda a:255 if a>4 else 0).getbbox() for pose in poses]
 if any(not b or b[0]<=1 or b[1]<=1 or b[2]>=poses[0].width-1 or b[3]>=poses[0].height-1 for b in bounds):raise ValueError(name+' native framing clips a pose')
 crop=(max(0,min(b[0] for b in bounds)-2),max(0,min(b[1] for b in bounds)-2),min(poses[0].width,max(b[2] for b in bounds)+2),min(poses[0].height,max(b[3] for b in bounds)+2));poses=[pose.crop(crop) for pose in poses]
 tiers={}
 for tier in ['low','medium']:
  fw=128 if tier=='low' else 256 if name=='plane' else 192;fh=48 if tier=='low' and name=='plane' else 64 if tier=='low' else 96
  scale=min((fw-4)/poses[0].width,(fh-4)/poses[0].height);size=(round(poses[0].width*scale),round(poses[0].height*scale));atlas=Image.new('RGBA',(fw*4,fh*2))
  for i,pose in enumerate(poses):atlas.paste(pose.resize(size,Image.Resampling.LANCZOS),((i%4)*fw+(fw-size[0])//2,(i//4)*fh+(fh-size[1])//2))
  file=name+'-'+tier+'.webp';path=out/file;atlas.save(path,'WEBP',quality=94,method=6)
  decoded=Image.open(path).convert('RGBA');hashes=[hashlib.sha256(decoded.crop(((i%4)*fw,(i//4)*fh,(i%4+1)*fw,(i//4+1)*fh)).tobytes()).hexdigest() for i in range(8)]
  if len(set(hashes))!=8:raise ValueError(name+' '+tier+' contains duplicate compressed poses')
  tiers[tier]={'file':file,'width':atlas.width,'height':atlas.height,'frameWidth':fw,'frameHeight':fh,'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'poseHashes':hashes}
  if tier=='medium':
   for i in [0,1,2,3]:
    pose=decoded.crop((i*fw,0,(i+1)*fw,fh));pose.thumbnail((244,128));board.paste(pose,(i*256+6,row*220+36),pose)
 draw.text((8,row*220+12),name+' | actual full-tier poses',fill='white')
 manifest['assets'][name]={'sourceSha256':asset['sourceSha256'],'sourceUnchanged':asset['sourceUnchanged'],'registration':{'commonCrop':crop,'gutter':2,'sourceWidth':512,'sourceHeight':256},'tiers':tiers}
for tier,cap in [('low',1),('medium',2)]:
 used=sum(a['tiers'][tier]['width']*a['tiers'][tier]['height']*4 for a in manifest['assets'].values())
 if used>cap*1024*1024:raise ValueError('Sky kit exceeds '+tier+' cap')
(out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');board.save(source/'sky-contact-sheet.png')
print(json.dumps({'encodedBytes':sum(t['bytes'] for a in manifest['assets'].values() for t in a['tiers'].values()),'decoded':{tier:sum(a['tiers'][tier]['width']*a['tiers'][tier]['height']*4 for a in manifest['assets'].values()) for tier in ['low','medium']}}))
