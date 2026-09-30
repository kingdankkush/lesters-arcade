"""One common crop and fixed transparent gutter for existing Chikun models."""
import hashlib,json
from pathlib import Path
from PIL import Image
ACTORS={'eagle','hawk','pelican','shiba'}
TIERS={'low':128,'medium':192,'high':256}
def pack_obstacle_loop(files,output,actor):
 output=Path(output)
 if actor not in ACTORS or len(files)!=8 or output.exists():raise ValueError('Invalid actor/frame count or output already exists')
 images=[];boxes=[];sources=[]
 for file in files:
  file=Path(file)
  with Image.open(file) as opened:
   if opened.size!=(512,256):raise ValueError('Expected fixed512x256render frame')
   image=opened.convert('RGBA')
  box=image.getchannel('A').getbbox()
  if not box or box[0]<2 or box[1]<2 or box[2]>510 or box[3]>254:raise ValueError('Empty or clipped native frame')
  images.append(image);boxes.append(box);raw=file.read_bytes();sources.append({'file':file.name,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()})
 common=(min(b[0]for b in boxes),min(b[1]for b in boxes),max(b[2]for b in boxes),max(b[3]for b in boxes))
 result={'schema':'chikun-obstacle-loop-v1','actor':actor,'frames':8,'columns':4,'fps':12,'registration':{'commonCrop':common,'sourceWidth':512,'sourceHeight':256,'gutter':2},'sources':sources,'tiers':{}}
 output.mkdir(parents=True)
 for tier,width in TIERS.items():
  height=width//2;scale=min((width-4)/(common[2]-common[0]),(height-4)/(common[3]-common[1]));size=(max(1,round((common[2]-common[0])*scale)),max(1,round((common[3]-common[1])*scale)));offset=((width-size[0])//2,(height-size[1])//2)
  sheet=Image.new('RGBA',(width*4,height*2))
  for index,image in enumerate(images):
   cell=Image.new('RGBA',(width,height));crop=image.crop(common).resize(size,Image.Resampling.LANCZOS);cell.paste(crop,offset);sheet.paste(cell,((index%4)*width,(index//4)*height))
  name=f'{actor}-{tier}.webp';file=output/name;sheet.save(file,format='WEBP',lossless=True,method=6,exact=True);raw=file.read_bytes()
  if len(raw)>65536:raise ValueError('Runtime obstacle sheet exceeds64KiBprototype budget')
  result['tiers'][tier]={'file':name,'frameWidth':width,'frameHeight':height,'width':width*4,'height':height*2,'decodedBytes':width*4*height*2*4,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'registration':{'cropSize':size,'offset':offset}}
 (output/'manifest.json').write_bytes((json.dumps(result,indent=2)+'\n').encode())
 return result
