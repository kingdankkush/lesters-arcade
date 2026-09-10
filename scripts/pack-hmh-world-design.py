"""Pack audited native Blender frames. No source-model edits or runtime GLBs."""
import argparse,hashlib,json,math
from pathlib import Path
from PIL import Image

def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def build(root,out):
    ab=json.loads((root/'ab-progress.json').read_text())
    checks={r['id']:r for r in ab['rows']}
    selected={'52':90,'53':90,'54':0,'55':90,'62':90,'63':0,'64':0,'65':0,'72':90,'73':0,'74':90,'75':90,'80':90}
    reports=[]
    for folder in sorted((root/'a').iterdir()):
        r=json.loads((folder/'report.json').read_text())
        if 'ld2' in r['id'] and r['yawDegrees']!=selected[r['id'].split('-')[2]]: continue
        check=checks[r['id']]
        assert check['pixelExact'] and check['sourceAndProjectionReportExact']
        assert sha(folder/'frame.png')==r['frameSha256']==check['frameSha256A']
        assert check['sourceSha256']==r['sourceSha256']
        reports.append((folder,r,check))
    assert len(reports)==17
    metadata={'pipeline':'hmh-world-design/v1','assetCount':17,'nativeRenderer':'Blender 5.1.2 EEVEE','tiers':{},'frames':[]}
    frames={}
    for folder,r,check in reports:
        frames[r['assetKey']]={'assetId':r['assetKey'],'sourceModelSha256':r['sourceSha256'],'yawDegrees':r['yawDegrees'],'nativeABPixelExact':True,'nativeFrameSha256A':check['frameSha256A'],'nativeFrameSha256B':check['frameSha256B'],'nativeHelperSha256':r['nativeHelperSha256'],'rendererSha256':r['rendererSha256'],'sourceDimensions':r['normalizedDimensions'],'sourceNormalization':r['sourceNormalization'],'tiers':{}}
    out.mkdir(parents=True,exist_ok=True)
    for tier,factor,size in [('desktop',1,2048),('mobile',.5,1024)]:
        atlas=Image.new('RGBA',(size,size));x=y=row=0
        for folder,r,check in sorted(reports,key=lambda v:-v[1]['alphaBounds']['h']):
            im=Image.open(folder/'frame.png').convert('RGBA')
            a=r['alphaBounds'];anchor=r['anchorPixels']
            crop=(max(0,math.floor(min(a['x'],anchor['x']))-4),max(0,math.floor(min(a['y'],anchor['y']))-4),min(im.width,math.ceil(max(a['x']+a['w'],anchor['x']))+4),min(im.height,math.ceil(max(a['y']+a['h'],anchor['y']))+4))
            im=im.crop(crop)
            if factor!=1: im=im.resize((math.ceil(im.width*factor),math.ceil(im.height*factor)),Image.Resampling.LANCZOS)
            if x+im.width>size: x=0;y+=row+4;row=0
            assert y+im.height<=size,'atlas overflow'
            atlas.paste(im,(x,y));w,h=im.size
            ax=(anchor['x']-crop[0])*factor;ay=(anchor['y']-crop[1])*factor
            frames[r['assetKey']]['tiers'][tier]={'frame':{'x':x,'y':y,'w':w,'h':h},'anchor':{'x':ax/w,'y':ay/h},'alphaBounds':{'x':0,'y':0,'w':w,'h':h},'runtimeScale':r['orthoScale']/r['width']/r['sourceNormalization']/factor,'projectionY':math.sqrt(2),'sampling':'native' if factor==1 else 'native-desktop-lanczos-2x-reduction','decodedRgbaSha256':hashlib.sha256(im.tobytes()).hexdigest(),'sourceCrop':list(crop)}
            x+=w+4;row=max(row,h)
        dest=out/f'world-design-{tier}.webp'
        atlas.save(dest,lossless=True,exact=True,method=6)
        decoded=Image.open(dest).convert('RGBA')
        assert decoded.tobytes()==atlas.tobytes()
        metadata['tiers'][tier]={'pages':[{'image':dest.name,'width':size,'height':size,'lossless':True,'exact':True,'sha256':sha(dest),'decodedRgbaSha256':hashlib.sha256(decoded.tobytes()).hexdigest(),'bytes':dest.stat().st_size}],'decodedBytes':size*size*4}
    metadata['frames']=list(frames.values())
    (out/'world-design.json').write_text(json.dumps(metadata,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'assets':17,'tiers':metadata['tiers']}))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--renders',type=Path,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args();build(a.renders,a.out)
