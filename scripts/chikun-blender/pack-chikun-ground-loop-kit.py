"""Pack common-registered loop poses and verify distinct compressed frames."""
import argparse,hashlib,json
from pathlib import Path
from PIL import Image,ImageDraw
p=argparse.ArgumentParser();p.add_argument('--input',required=True);p.add_argument('--output',required=True);a=p.parse_args();source=Path(a.input);out=Path(a.output);out.mkdir(parents=True,exist_ok=True)
names=['shiba','hurdle'];poses=[];crops=[]
for name in names:
 row=[Image.open(source/f'{name}-{i}.png').convert('RGBA')for i in range(8)];bounds=[im.getchannel('A').point(lambda a:255 if a>4 else 0).getbbox()for im in row]
 if any(not b or b[0]<2 or b[1]<2 or b[2]>510 or b[3]>254 for b in bounds):raise ValueError(name+' clipped')
 crop=(min(b[0]for b in bounds)-2,min(b[1]for b in bounds)-2,max(b[2]for b in bounds)+2,max(b[3]for b in bounds)+2);crops.append({'name':name,'commonCrop':crop});poses.append([im.crop(crop).resize((256,128),Image.Resampling.LANCZOS)for im in row])
atlas=Image.new('RGBA',(2048,256))
for row in range(2):
 for i in range(8):atlas.paste(poses[row][i],(i*256,row*128))
tiers={};board=Image.new('RGB',(1024,320),'#34464d')
for tier,size in [('medium',(2048,256)),('low',(1024,128))]:
 file=out/f'loops-{tier}.webp';atlas.resize(size,Image.Resampling.LANCZOS).save(file,'WEBP',quality=94,method=6,exact=True);decoded=Image.open(file).convert('RGBA');fw,fh=size[0]//8,size[1]//2;hashes=[]
 for row in range(2):
  hs=[hashlib.sha256(decoded.crop((i*fw,row*fh,(i+1)*fw,(row+1)*fh)).tobytes()).hexdigest()for i in range(8)];assert len(set(hs))==8,(tier,names[row]);hashes.append(hs)
  if tier=='medium':
   for i in range(4):im=decoded.crop((i*fw,row*fh,(i+1)*fw,(row+1)*fh));board.paste(im,(i*256,row*160+24),im)
 tiers[tier]={'file':file.name,'width':size[0],'height':size[1],'frameWidth':fw,'frameHeight':fh,'bytes':file.stat().st_size,'decodedBytes':size[0]*size[1]*4,'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'poseHashes':hashes}
draw=ImageDraw.Draw(board);draw.text((6,5),'Shiba | actual compressed native poses',fill='white');draw.text((6,165),'Hurdle | fixed structure, loose hazard wrap only',fill='white');board.save(source/'loop-contact-sheet.png')
(out/'manifest.json').write_text(json.dumps({'schema':'chikun-ground-loop-kit-v1','names':names,'frames':8,'fps':12,'tiers':tiers,'crops':crops,'native':json.loads((source/'native-receipt.json').read_text())},indent=2)+'\n');print(json.dumps(tiers))
