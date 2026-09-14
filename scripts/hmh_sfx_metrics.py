"""Measure transient, body, tail and spectral energy in actual mono PCM cues."""
import argparse,cmath,functools,json,math,struct,wave
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

@functools.lru_cache(None)
def twiddles(size): return [cmath.exp(-2j*math.pi*k/size) for k in range(size//2)]
def fft(values):
    n=len(values);out=[complex(v) for v in values];j=0
    for i in range(1,n):
        bit=n>>1
        while j&bit:j^=bit;bit>>=1
        j^=bit
        if i<j:out[i],out[j]=out[j],out[i]
    size=2
    while size<=n:
        weights=twiddles(size);half=size//2
        for start in range(0,n,size):
            for k in range(half):
                a=out[start+k];b=out[start+k+half]*weights[k]
                out[start+k]=a+b;out[start+k+half]=a-b
        size*=2
    return out
def rms(values):return math.sqrt(sum(v*v for v in values)/max(1,len(values)))
def db(value):return 20*math.log10(max(1e-12,value))
def analyse(samples,rate):
    if not samples:raise ValueError('empty PCM')
    n=4096;window=[.5-.5*math.cos(2*math.pi*i/(n-1)) for i in range(n)]
    energy=[0.]*(n//2+1)
    # Centered windows include the onset; no transient falls under the first
    # Hann window's zero edge, including cues shorter than one FFT block.
    for start in range(-n//2,len(samples),n//2):
        spectrum=fft([(samples[start+i] if 0<=start+i<len(samples) else 0)*window[i] for i in range(n)])
        for i in range(len(energy)):energy[i]+=abs(spectrum[i])**2
    bands={name:sum(e for i,e in enumerate(energy) if lo<=i*rate/n<hi) for name,lo,hi in [
        ('sub20_100',20,100),('punch100_250',100,250),('lowMid250_1k',250,1000),('presence1k_4k',1000,4000),('air4k',4000,rate/2+1)]}
    total=sum(energy) or 1
    transient=rms(samples[:round(rate*.008)]);body=rms(samples[round(rate*.015):round(rate*.075)])
    hop=max(1,round(rate*.001));envelope=[rms(samples[i:i+hop]) for i in range(0,len(samples),hop)]
    threshold=max(envelope)*10**(-30/20)
    last=max(i for i,v in enumerate(envelope) if v>=threshold)
    peak=max(map(abs,samples));full=rms(samples);time_energy=sum(v*v for v in samples) or 1
    result={'peak':peak,'rms':full,'dcMean':sum(samples)/len(samples),'crestDb':db(peak/full),
        'durationMs':len(samples)/rate*1000,'body15to75Rms':body,'transientMinusBodyDb':db(transient/body) if body else 0,
        'tail30dbMs':(last+1)*hop/rate*1000,'lateEnergyFrac':sum(v*v for v in samples[round(rate*.120):])/time_energy,
        'centroidHz':sum(i*rate/n*e for i,e in enumerate(energy))/total,
        'bands':{name:value/total for name,value in bands.items()}}
    return {key:{k:round(v,6) for k,v in value.items()} if isinstance(value,dict) else round(value,6) for key,value in result.items()}
def decode(file):
    with wave.open(str(file),'rb') as wav:
        if wav.getnchannels()!=1 or wav.getsampwidth()!=2:raise ValueError('Expected mono 16-bit PCM')
        rate=wav.getframerate();raw=wav.readframes(wav.getnframes())
    return [v/32768 for (v,) in struct.iter_unpack('<h',raw)],rate
def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--output',required=True);args=parser.parse_args()
    manifest=json.loads((ROOT/'apps/portal/assets/audio/sfx/hmh-weapon-sfx-manifest.json').read_text())
    cues={}
    for cue_id,cue in manifest['cues'].items():
        samples,rate=decode(ROOT/'apps/portal'/cue['src']);cues[cue_id]=analyse(samples,rate)
    output=(ROOT/args.output).resolve();output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps({'schema':1,'measurement':'actual-mono-pcm','fftSize':4096,'hop':2048,'cues':cues},indent=2)+'\n')
    print(output)
if __name__=='__main__':main()
