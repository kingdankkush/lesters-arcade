"""Pack native Blender renders and author deterministic layered flight audio."""
import argparse,json,hashlib,math,wave,struct,random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--out',required=True);p.add_argument('--proof',required=True);a=p.parse_args()
source=Path(a.source);out=Path(a.out);out.mkdir(parents=True,exist_ok=True);proof=Path(a.proof);proof.mkdir(parents=True,exist_ok=True)
manifest=json.loads((source/'character.json').read_text());manifest['frameSize']=192;manifest['runtimeBytes']=0
contact=Image.new('RGB',(1200,math.ceil(len(manifest['clips'])/5)*240),(13,28,42));draw=ImageDraw.Draw(contact)
fontpath=Path('C:/Windows/Fonts/segoeui.ttf');font=ImageFont.truetype(str(fontpath),17)
for k,clip in enumerate(manifest['clips']):
 sheet=Image.new('RGBA',(manifest['columns']*192,math.ceil(clip['frames']/manifest['columns'])*192));hashes=[]
 for i in range(clip['frames']):
  path=source/'frames'/f"{clip['name']}-{i:02}.png";img=Image.open(path).convert('RGBA')
  assert img.getbbox() is not None,f'Empty render {path}'
  hashes.append(hashlib.sha256(img.tobytes()).hexdigest());img=img.resize((192,192),Image.Resampling.LANCZOS);sheet.paste(img,((i%4)*192,(i//4)*192))
  if i==5:
   px=(k%5)*240+24;py=(k//5)*240+8;contact.paste(img,(px,py),img)
 assert len(set(hashes))>=12,f'Clip is not animated: {clip["name"]}'
 path=out/clip['sheet'];sheet.save(path,'WEBP',quality=88,method=4)
 clip['sha256']=hashlib.sha256(path.read_bytes()).hexdigest();clip['bytes']=path.stat().st_size;manifest['runtimeBytes']+=clip['bytes'];clip['uniqueFrames']=len(set(hashes))
 draw.text(((k%5)*240+15,(k//5)*240+211),f"{k+1:02}  {clip['name'].replace('_',' ')}",font=font,fill=(208,227,223))
Image.open(source/'frames/cruise-04.png').save(out/'poster.webp','WEBP',quality=95)
contact.save(proof/'Chikun-Superman-Moves.png')
(out/'character.json').write_text(json.dumps(manifest,indent=2))
audio=out/'audio';audio.mkdir(exist_ok=True);sr=24000
specs={'flap':.21,'launch':.75,'coin':.46,'near':.42,'pass':.37,'streak':.9,'impact':.8,'air':8}
rng=random.Random(4812);audio_report=[]
for name,duration in specs.items():
 data=[];low=0;prev=0
 for i in range(int(sr*duration)):
  t=i/sr;u=t/duration;n=rng.uniform(-1,1);low=.86*low+.14*n;high=n-low
  if name=='flap':
   env=math.sin(math.pi*u)**2*math.exp(-u*2);v=env*(low*.72+high*.09+math.sin(math.tau*(110*t-130*t*t))*.10)
  elif name=='impact':
   env=math.exp(-t*8);v=env*(low*.55+high*.14+math.sin(math.tau*74*t)*.23)+math.sin(math.tau*413*t)*math.exp(-t*13)*.065
  elif name=='near':
   env=math.sin(math.pi*u)**2;v=low*.25*env+math.sin(math.tau*(390*t+700*t*t))*.06*env
  elif name=='air':
   v=low*.20+math.sin(math.tau*55*t)*.014+math.sin(math.tau*82.5*t)*.008
   v*=.72+.18*math.sin(math.tau*t/duration)
  else:
   freqs={'coin':[1046.5,1568,2093],'pass':[523.25,783.99],'launch':[261.63,392,523.25,783.99],'streak':[523.25,659.25,783.99,1046.5]}[name]
   v=0
   for j,f in enumerate(freqs):
    tt=t-j*.055
    if tt>=0:v+=(math.sin(math.tau*f*tt)+.20*math.sin(math.tau*f*2.003*tt))*math.exp(-tt*9)*min(1,tt/.006)*.13
  if name!='air':v*=min(1,t/.004,(duration-t)/.018)
  data.append(max(-.85,min(.85,v)))
 # Match ends of the ambient loop with a short equal-power seam.
 if name=='air':
  fade=600
  for i in range(fade):
   k=i/fade;v=data[i]*k+data[-fade+i]*(1-k);data[i]=v;data[-fade+i]=v
 pcm=struct.pack('<'+'h'*len(data),*[int(v*32767) for v in data]);path=audio/(name+'.wav')
 with wave.open(str(path),'wb') as f:f.setnchannels(1);f.setsampwidth(2);f.setframerate(sr);f.writeframes(pcm)
 audio_report.append({'cue':name,'seconds':duration,'peak':max(abs(v) for v in data),'bytes':path.stat().st_size})
(out/'audio/manifest.json').write_text(json.dumps(audio_report,indent=2))
print(json.dumps({'clips':len(manifest['clips']),'frames':sum(c['frames'] for c in manifest['clips']),'atlasBytes':manifest['runtimeBytes'],'decodedMiB':sum(c['frames']*192*192*4 for c in manifest['clips'])/1024/1024,'audio':audio_report},indent=2))
