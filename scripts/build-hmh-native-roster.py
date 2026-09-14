"""Render two independent native-enemy passes and pack a verified private atlas."""
import argparse,hashlib,importlib.util,json,subprocess,sys
from pathlib import Path
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
CLIPS={'idle':(4,6),'run':(12,24),'tell':(4,12),'attack':(6,24),'hit':(3,12),'death':(6,12)}
# Source sampling density is independent of runtime playback. Windups and
# reactions must finish inside the existing deterministic combat windows.
PLAYBACK_FPS={'idle':6,'run':24,'tell':24,'attack':30,'hit':36,'death':12}
DIRECTIONS=['south','south-east','east','north-east','north','north-west','west','south-west']
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def module(name,path):
    spec=importlib.util.spec_from_file_location(name,ROOT/path)
    value=importlib.util.module_from_spec(spec); spec.loader.exec_module(value); return value
def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-directory',required=True); parser.add_argument('--output',required=True)
    parser.add_argument('--resume',action='store_true')
    parser.add_argument('--stable-edges',action='store_true'); args=parser.parse_args()
    source_dir=(ROOT/args.source_directory).resolve(); output=(ROOT/args.output).resolve()
    if not output.is_relative_to(ROOT/'.tmp') or (output.exists() and not args.resume): raise ValueError('Use a fresh private output or exact resume')
    output.mkdir(parents=True,exist_ok=True)
    source=json.loads((source_dir/'source-receipt.json').read_text()); actor=source['actorId']
    if sha(source_dir/source['source'])!=source['sourceSha256'] or not source['sourceUnchanged']: raise ValueError('Native source proof changed')
    exporter=ROOT/'scripts/hmh-blender'/('export-hmh-native-roster-stable.py' if args.stable_edges else 'export-hmh-native-roster.py')
    stamp={'sourceSha256':source['sourceSha256'],'exporterSha256':sha(exporter)}
    stamp_path=output/'candidate.json'
    if stamp_path.exists() and json.loads(stamp_path.read_text())!=stamp: raise ValueError('Candidate changed; create a fresh output')
    stamp_path.write_text(json.dumps(stamp,indent=2)+'\n')
    for run in ['a','b']:
        raw=output/f'run-{run}'
        if args.resume and (raw/'render-receipt.json').exists(): continue
        # Interrupted raw output is retained. Restart into another fresh
        # directory, then point this run at the complete receipt below.
        attempt=raw; number=0
        while attempt.exists():
            number+=1; attempt=output/f'run-{run}-attempt-{number}'
        with (output/f'render-{run}-{number}.log').open('w') as log:
            subprocess.run(['D:/Apps/Blender/blender.exe','--background','--factory-startup','--disable-autoexec','--python-exit-code','1',
                '--python',str(exporter),'--','--source-directory',str(source_dir),'--output',str(attempt)],cwd=ROOT,stdout=log,stderr=subprocess.STDOUT,check=True)
        if attempt!=raw:
            import shutil
            # Keep failed evidence, adopting only the completed run locally.
            retained=output/f'incomplete-{run}-{number}'; raw.rename(retained); attempt.rename(raw)
        print(f'{actor}: native pass {run} complete',flush=True)
    a=json.loads((output/'run-a/render-receipt.json').read_text()); b=json.loads((output/'run-b/render-receipt.json').read_text())
    if a!=b or a['sourceSha256']!=source['sourceSha256'] or a['exporterSha256']!=stamp['exporterSha256'] or a['blenderVersion']!='5.1.2' or not a['sourceUnchanged']:
        raise ValueError('Independent native receipts disagree')
    phases=list(source.get('phaseVisuals',{})) or [None]
    expected={(phase,state,direction,index) for phase in phases for state,(count,fps) in CLIPS.items() for direction in DIRECTIONS for index in range(count)}
    frames=a['frames']; actual={(f['phase'],f['state'],f['direction'],f['frameIndex']) for f in frames}
    if actual!=expected or len(frames)!=len(expected): raise ValueError('Native animation coverage incomplete')
    for f in frames:
        if f['fps']!=CLIPS[f['state']][1] or abs(f['groundResidual'])>.0001: raise ValueError('Native cadence or grounding drift')
    motion=module('hero_motion','scripts/build-hmh-hero-motion.py')
    repeatability=motion.premultiplied_compare(output/'run-a',output/'run-b',[dict(f,filename=f['id']+'.png') for f in frames])
    if any(repeatability[k]>v for k,v in {'maxChangedVisiblePixels':8,'maxChannelDelta':2,'maxTotalChannelDelta':32}.items()): raise ValueError(f'Native repeatability failed: {repeatability}')
    records=[]; unique={}
    for f in frames:
        image=Image.open(output/'run-a'/(f['id']+'.png')).convert('RGBA')
        if list(image.size)!=f['sourceSize']: raise ValueError('Native source size changed')
        data=np.array(image); data[data[:,:,3]==0,:3]=0; image=Image.fromarray(data)
        bbox=image.getchannel('A').getbbox()
        if not bbox or min(bbox[:2])<1 or bbox[2]>=image.width or bbox[3]>=image.height: raise ValueError('Native frame empty or clipped: '+f['id'])
        pixel_sha=hashlib.sha256(image.tobytes()).hexdigest()
        unique.setdefault((f['phase'],f['state'],f['direction']),set()).add(pixel_sha)
        records.append(dict(f,image=image,bbox=bbox,pixelSha256=pixel_sha))
    for (phase,state,direction),values in unique.items():
        if len(values)<{'idle':3,'run':8,'tell':3,'attack':4,'hit':2,'death':5}[state]: raise ValueError(f'Insufficient native action poses: {phase}/{state}/{direction}')
    packing=module('hero_packing','scripts/run-hmh-production-hero-pilot.py')
    size,placements=packing.shelf_pack(records,2,2048)
    # Enemy pages do not repeat or use mipmaps. Trim unused rows instead of
    # allocating a full square GPU page for transparent padding.
    atlas_height=min(size,((max(y+h for x,y,w,h in placements.values())+15)//16)*16)
    atlas=Image.new('RGBA',(size,atlas_height)); packed=[]
    for record in records:
        x,y,w,h=placements[record['id']]; left,top,_,_=record['bbox']; px,py=record['sourcePivot']
        atlas.paste(record['image'].crop(record['bbox']),(x,y))
        packed.append({k:v for k,v in record.items() if k not in {'image','bbox','sourcePivot','sourceSize'}}|
            {'fps':PLAYBACK_FPS[record['state']],'frame':{'x':x,'y':y,'w':w,'h':h},'pivot':{'x':px-left,'y':py-top},
             'anchor':{'x':(px-left)/w,'y':(py-top)/h},'sourcePivot':{'x':px,'y':py},
             'sourceSize':{'w':record['sourceSize'][0],'h':record['sourceSize'][1]},'rotated':False,'trimmed':True,
             'opaquePixels':int(np.count_nonzero(np.array(record['image'])[:,:,3]>8))})
    destination=output/'packed'; destination.mkdir(exist_ok=True)
    image_path=destination/f'{actor}-native-roster.webp'
    # Spend offline encoder effort to preserve every pixel within the transfer
    # budget, including all three boss phases. Runtime decoding is unchanged.
    atlas.save(image_path,format='WEBP',lossless=True,exact=True,method=6,quality=100)
    if image_path.stat().st_size>4*1024*1024: raise ValueError('Native enemy transfer cap exceeded')
    decoded=Image.open(image_path).convert('RGBA')
    for record in records:
        x,y,w,h=placements[record['id']]
        if decoded.crop((x,y,x+w,y+h)).tobytes()!=record['image'].crop(record['bbox']).tobytes(): raise ValueError('Native atlas reconstruction changed pixels')
    roster=json.loads((ROOT/'apps/hmh-reboot/assets/source/blender/hmh-enemy-roster.json').read_text())
    definition=next(item for item in roster['actors'] if item['actorId']==actor)
    metadata={'schemaVersion':1,'pipelineId':roster['pipelineId'],'classification':'production-art','runtimeAuthority':'projection-only',
        'gameplayBodyProfile':roster['gameplayBodyProfile'],'actorId':actor,'identityForm':source['identityForm'],'boss':bool(source.get('boss')),
        'silhouette':definition['silhouette'],'animationProfile':source['animationProfile'],
        'poseAuthoring':{'mode':'retargeted-native-role-actions','actions':source['clipActions'],'sourceBuilderSha256':source['builderSha256'],'playbackFps':PLAYBACK_FPS},
        'sourceModel':{'kind':'packed-native-roster-derivative','sourceSha256':source['sourceSha256'],'baseSourceSha256':source['baseSha256']},
        'image':'./'+image_path.name,'imageBytes':image_path.stat().st_size,'imageSha256':sha(image_path),'runtimeScale':.88 if source.get('boss') else .55,
        'dimensions':{'width':size,'height':atlas_height},'phases':list(source.get('phaseVisuals',{})),'directions':DIRECTIONS,'states':list(CLIPS),'frames':packed}
    metadata_path=destination/f'{actor}-native-roster.json'; metadata_path.write_text(json.dumps(metadata,indent=2)+'\n')
    report={'status':'verified-private-candidate','actorId':actor,'sourceSha256':source['sourceSha256'],'exporterSha256':stamp['exporterSha256'],
        'frames':len(frames),'uniquePoses':{'|'.join(str(v) for v in key):len(value) for key,value in unique.items()},'repeatability':repeatability,
        'imageSha256':sha(image_path),'metadataSha256':sha(metadata_path),'imageBytes':image_path.stat().st_size,'dimensions':{'width':size,'height':atlas_height},'decodedBytes':size*atlas_height*4,
        'sourceUnchanged':sha(source_dir/source['source'])==source['sourceSha256'],'pixelReconstructionChanged':0}
    (output/'measurement.json').write_text(json.dumps(report,indent=2)+'\n'); print(json.dumps(report),flush=True)
if __name__=='__main__': main()
