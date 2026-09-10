import argparse,hashlib,json
from pathlib import Path
from PIL import Image

def audit(root):
 m=json.loads((root/'world-design.json').read_text(encoding='utf-8'));frames=0;total=0
 assert m['pipeline']=='hmh-world-design/v1' and len(m['frames'])==17
 for tier,limit in [('desktop',16777216),('mobile',4194304)]:
  pages=m['tiers'][tier]['pages'];assert len(pages)==1
  p=pages[0];path=root/p['image'];assert path.parent==root
  assert hashlib.sha256(path.read_bytes()).hexdigest()==p['sha256']
  im=Image.open(path).convert('RGBA');assert im.size==(p['width'],p['height'])
  assert im.width*im.height*4<=limit
  assert hashlib.sha256(im.tobytes()).hexdigest()==p['decodedRgbaSha256']
  seen=set()
  for f in m['frames']:
   entry=f['tiers'][tier];r=entry['frame'];crop=im.crop((r['x'],r['y'],r['x']+r['w'],r['y']+r['h']))
   digest=hashlib.sha256(crop.tobytes()).hexdigest()
   assert digest==entry['decodedRgbaSha256'] and digest not in seen
   seen.add(digest);assert crop.getchannel('A').getbbox() is not None
   frames+=1
  total+=path.stat().st_size
 return {'status':'pass','sourceModels':17,'tierFramesVerified':frames,'runtimeAtlasBytes':total,'desktopDecodedBytes':16777216,'mobileDecodedBytes':4194304}
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--asset-root',type=Path,required=True);a=p.parse_args();print(json.dumps(audit(a.asset_root)))
