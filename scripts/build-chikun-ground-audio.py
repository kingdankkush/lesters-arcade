"""Reproducible synthetic action/ambience cues; no third-party samples."""
from pathlib import Path
import math,random,struct,wave,json,hashlib
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'apps/portal/assets/generated/chikun-ground-audio-v1';OUT.mkdir(exist_ok=True);rate=24000
durations={'step':.095,'jump':.24,'land':.26,'wood':.42,'splash':.65,'drone':.55,'gore':.32,'menu':.09,'water':4,'forest':4,'industry':4}
report=[]
for number,(name,duration) in enumerate(durations.items()):
 rng=random.Random(140926+number);data=[];low=0
 for i in range(int(rate*duration)):
  t=i/rate;u=t/duration;n=rng.uniform(-1,1);low=.90*low+.10*n
  if name=='step':v=(low*.19+math.sin(math.tau*115*t)*.07)*math.exp(-t*40)
  elif name=='jump':v=(math.sin(math.tau*(190*t+650*t*t))*.07+low*.12)*math.sin(math.pi*u)**2
  elif name=='land':v=(math.sin(math.tau*(83*t-80*t*t))*.15+low*.3)*math.exp(-t*16)
  elif name=='wood':v=(math.sin(math.tau*149*t)*.15+math.sin(math.tau*347*t)*.08+low*.25)*math.exp(-t*10)
  elif name=='splash':v=(low*.45+(n-low)*.045)*math.sin(math.pi*u)*math.exp(-t*3)
  elif name=='drone':v=(math.sin(math.tau*93*t)+math.sin(math.tau*187*t))*.06*(.65+.35*math.sin(math.tau*21*t))*math.sin(math.pi*u)
  elif name=='gore':v=(low*.40+math.sin(math.tau*(82*t-140*t*t))*.10)*math.exp(-t*12)
  elif name=='menu':v=math.sin(math.tau*660*t)*.05*math.sin(math.pi*u)
  elif name=='water':v=(low*.12+(n-low)*.008)*(.75+.12*math.sin(math.tau*t/4))
  elif name=='forest':v=low*.08+math.sin(math.tau*1450*t)*.003*(.5+.5*math.sin(math.tau*t*2))
  else:v=low*.035+math.sin(math.tau*60*t)*.011+math.sin(math.tau*90*t)*.004
  if duration<1:v*=min(1,t/.003,(duration-t)/.018)
  data.append(max(-.6,min(.6,v)))
 if duration==4:
  fade=480
  for i in range(fade):k=i/fade;v=data[i]*k+data[-fade+i]*(1-k);data[i]=data[-fade+i]=v
 path=OUT/(name+'.wav')
 with wave.open(str(path),'wb') as f:f.setnchannels(1);f.setsampwidth(2);f.setframerate(rate);f.writeframes(struct.pack('<'+'h'*len(data),*[int(v*32767) for v in data]))
 report.append({'name':name,'duration':duration,'peak':max(abs(x) for x in data),'rms':math.sqrt(sum(x*x for x in data)/len(data)),'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
(OUT/'manifest.json').write_text(json.dumps({'source':'Original deterministic synthesis','sampleRate':rate,'cues':report},indent=2));print(len(report))
