from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
from collections import defaultdict
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from hmh_pipeline_lock import exclusive_pipeline_lock

ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / 'apps/hmh-reboot/assets/source/blender/hmh-authored-props.json'
EXPECTED_BLENDER_VERSION = 'Blender 5.1.2'


def args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument('--verify-reproducible', action='store_true')
    parser.add_argument('--skip-scene', action='store_true')
    parser.add_argument('--skip-render', action='store_true')
    return parser.parse_args()


def run_checked(command: list[str], label: str) -> str:
    completed = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, encoding='utf-8', errors='replace')
    if completed.returncode != 0:
        raise RuntimeError(f'{label} failed\n{completed.stdout}\n{completed.stderr}')
    print(f'[authored-props] {label}: pass')
    return completed.stdout


def write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + '\n', encoding='utf-8', newline='\n')


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def canonical(image: Image.Image) -> Image.Image:
    image = image.convert('RGBA')
    data = bytearray(image.tobytes())
    for index in range(0, len(data), 4):
        if data[index + 3] == 0:
            data[index:index + 3] = b'\0\0\0'
    return Image.frombytes('RGBA', image.size, bytes(data))


def analyse(manifest: dict, raw_dir: Path) -> list[dict]:
    threshold = manifest['render']['alphaThreshold']
    frame_size = tuple(manifest['render']['frameSize'])
    records = []
    hashes = defaultdict(list)
    expected_names = sorted(f"{asset['assetId']}.png" for asset in manifest['assets'])
    actual_names = sorted(path.name for path in raw_dir.glob('*.png'))
    if actual_names != expected_names:
        raise RuntimeError(f'Authored prop frame set mismatch: expected={expected_names} actual={actual_names}')
    for asset in manifest['assets']:
        path = raw_dir / f"{asset['assetId']}.png"
        image = canonical(Image.open(path))
        # Detail-heavy world props declare a per-asset frameSize; everything
        # else uses the manifest default.
        expected_size = tuple(asset.get('frameSize', frame_size))
        if image.size != expected_size:
            raise RuntimeError(f"{asset['assetId']} dimensions {image.size} != {expected_size}")
        alpha = image.getchannel('A')
        mask = alpha.point(lambda value: 255 if value > threshold else 0)
        bbox = mask.getbbox()
        if bbox is None:
            raise RuntimeError(f"{asset['assetId']} rendered empty")
        # Review finding (Cycle 039): corner sampling and the pivot below must
        # use the PER-ASSET frame size. Sampling the manifest default on a
        # 256px frame checked one real corner plus the frame center, and put
        # the ground pivot outside the crop entirely.
        corners = [image.getpixel(point)[3] for point in ((0,0),(expected_size[0]-1,0),(0,expected_size[1]-1),(expected_size[0]-1,expected_size[1]-1))]
        if max(corners) > threshold:
            raise RuntimeError(f"{asset['assetId']} touches a frame corner")
        digest = hashlib.sha256(image.tobytes()).hexdigest()
        hashes[digest].append(asset['assetId'])
        x0,y0,x1,y1=bbox
        # Stable authored ground pivot at the frame's horizontal center and
        # lower content edge; include it in the crop for reliable grounding.
        pivot=(expected_size[0]//2,min(expected_size[1]-4,y1))
        x0=min(x0,pivot[0]); x1=max(x1,pivot[0]+1); y1=max(y1,pivot[1]+1)
        opaque=sum(1 for value in alpha.tobytes() if value>threshold)
        # Vertical mass centroid over the trimmed silhouette, 0.0 at the top
        # edge and 1.0 at the bottom. This is the cheapest descriptor that
        # separates shapes an aspect ratio cannot: a conifer carries its mass
        # low and tapers to a point (high value), a canopy tree carries a
        # crown over a thin trunk (low value). Silhouette-variety checks use
        # it so two props with matching proportions still have to look
        # different. Deterministic: derived from the same canonical pixels as
        # sourcePixelSha256.
        alpha_bytes=alpha.tobytes()
        width_px=expected_size[0]
        weighted=0
        counted=0
        for index,value in enumerate(alpha_bytes):
            if value>threshold:
                row=index//width_px
                if y0<=row<y1:
                    weighted+=row-y0
                    counted+=1
        span=max(1,y1-y0-1)
        centroid_y=round(weighted/counted/span,6) if counted else 0.0
        records.append({'asset':asset,'image':image,'bbox':(x0,y0,x1,y1),'pivot':pivot,'sourcePixelSha256':digest,'opaquePixels':opaque,'massCentroidY':centroid_y})
    duplicates=[ids for ids in hashes.values() if len(ids)>1]
    if duplicates:
        raise RuntimeError(f'Authored prop duplicate rendered assets: {duplicates}')
    return records


def shelf_pack(records: list[dict], padding: int, max_size: int):
    size=256
    ordered=sorted(records,key=lambda item:(-(item['bbox'][3]-item['bbox'][1]),item['asset']['assetId']))
    while size<=max_size:
        x=y=padding; shelf=0; placements={}; ok=True
        for record in ordered:
            width=record['bbox'][2]-record['bbox'][0]; height=record['bbox'][3]-record['bbox'][1]
            if x+width+padding>size: x=padding; y+=shelf+padding; shelf=0
            if y+height+padding>size: ok=False; break
            placements[record['asset']['assetId']] = (x,y,width,height)
            x+=width+padding; shelf=max(shelf,height)
        if ok: return size,placements
        size*=2
    raise RuntimeError(f'Authored prop frames exceed max atlas size {max_size}')


def build_outputs(manifest: dict, records: list[dict], output_dir: Path, source_blend: Path, reproducible: bool) -> dict:
    output_dir.mkdir(parents=True,exist_ok=True)
    size,placements=shelf_pack(records,manifest['atlas']['padding'],manifest['atlas']['maxSize'])
    atlas=Image.new('RGBA',(size,size),(0,0,0,0)); frames=[]
    item_dir=output_dir/'items'; item_dir.mkdir(parents=True,exist_ok=True)
    for stale in item_dir.glob('*.png'): stale.unlink()
    for record in sorted(records,key=lambda item:item['asset']['assetId']):
        asset=record['asset']; x0,y0,x1,y1=record['bbox']; crop=record['image'].crop((x0,y0,x1,y1))
        item_path=item_dir/f"{asset['assetId']}.png"; crop.save(item_path,optimize=False,compress_level=9)
        ax,ay,width,height=placements[asset['assetId']]; atlas.alpha_composite(crop,(ax,ay))
        pivot_x=record['pivot'][0]-x0; pivot_y=record['pivot'][1]-y0
        frames.append({
            'id':asset['assetId'],'assetId':asset['assetId'],'category':asset['category'],'shape':asset['shape'],
            'itemUrl':f"./items/{asset['assetId']}.png",
            'districts':asset.get('districts',[]),'runtimeScale':asset['runtimeScale'],'frame':{'x':ax,'y':ay,'w':width,'h':height},
            'pivot':{'x':pivot_x,'y':pivot_y},'anchor':{'x':round(pivot_x/max(width,1),6),'y':round(pivot_y/max(height,1),6)},
            'opaquePixels':record['opaquePixels'],'massCentroidY':record['massCentroidY'],
            'sourcePixelSha256':record['sourcePixelSha256'],'rotated':False,'trimmed':True,
        })
    atlas_path=output_dir/'hmh-authored-props-atlas.png'; atlas.save(atlas_path,optimize=False,compress_level=9)
    metadata={
      'schemaVersion':1,'pipelineId':manifest['pipelineId'],'classification':manifest['classification'],'runtimeAuthority':manifest['runtimeAuthority'],
      'image':'./hmh-authored-props-atlas.png','cameraPitchDegrees':manifest['render']['cameraPitchDegrees'],'assetCount':len(frames),
      'categories':sorted({frame['category'] for frame in frames}),'frames':frames,
    }
    metadata_path=output_dir/'hmh-authored-props-atlas.json'; write_json(metadata_path,metadata)

    columns=5; cell=160; rows=(len(records)+columns-1)//columns
    sheet=Image.new('RGBA',(columns*cell,rows*cell),(8,13,21,255)); draw=ImageDraw.Draw(sheet); font=ImageFont.load_default()
    for index,record in enumerate(sorted(records,key=lambda item:(item['asset']['category'],item['asset']['assetId']))):
        x=(index%columns)*cell; y=(index//columns)*cell
        sheet.alpha_composite(record['image'],(x+16,y+18)); draw.text((x+8,y+4),record['asset']['assetId'].upper(),fill=(231,246,255,255),font=font)
        draw.text((x+8,y+144),record['asset']['category'],fill=(109,210,230,255),font=font)
    sheet_path=output_dir/'hmh-authored-props-contact-sheet.png'; sheet.save(sheet_path,optimize=False,compress_level=9)
    metrics={
      'schema':'hmh-authored-props-metrics-v1','status':'pass','pipelineId':manifest['pipelineId'],'blenderVersion':EXPECTED_BLENDER_VERSION.replace('Blender ',''),
      'runtimeAuthority':manifest['runtimeAuthority'],'assetCount':len(frames),'uniqueSourceFrames':len({frame['sourcePixelSha256'] for frame in frames}),
      'duplicateFrames':0,'emptyFrames':0,'transparentCornerFailures':0,'reproducibleVerified':reproducible,'atlasSize':{'width':size,'height':size},
      'sourceBlendSha256':sha256(source_blend),'manifestSha256':sha256(MANIFEST_PATH),'atlasSha256':sha256(atlas_path),'metadataSha256':sha256(metadata_path),'contactSheetSha256':sha256(sheet_path),
    }
    write_json(output_dir/'hmh-authored-props-metrics.json',metrics)
    return metrics


def main() -> None:
    options=args(); manifest=json.loads(MANIFEST_PATH.read_text(encoding='utf-8'))
    blender=Path(os.environ.get('BLENDER_EXECUTABLE',r'D:\Apps\Blender\blender.exe'))
    raw_dir=ROOT/manifest['render']['rawOutputDirectory']; raw_verify=ROOT/'.tmp/hmh-reboot-authored-props-verify'
    blend_path=ROOT/manifest['scene']['sourceBlend']; output_dir=ROOT/manifest['atlas']['outputDirectory']
    if not options.skip_scene or not options.skip_render:
        if not blender.exists(): raise FileNotFoundError(f'Blender executable not found: {blender}')
        version=run_checked([str(blender),'--version'],'blender --version').splitlines()[0].strip()
        if version!=EXPECTED_BLENDER_VERSION: raise RuntimeError(f'expected {EXPECTED_BLENDER_VERSION!r}, received {version!r}')
    if not options.skip_scene:
        run_checked([str(blender),'--background','--factory-startup','--python',str(ROOT/'scripts/hmh-blender/create-hmh-authored-props.py'),'--','--manifest',str(MANIFEST_PATH),'--source-blend',str(blend_path),'--inspection-output',str(ROOT/'.tmp/hmh-authored-props-scene.json')],'authored prop scene build')
        backup = blend_path.with_suffix(blend_path.suffix + '1')
        if backup.exists():
            backup.unlink()
    if not options.skip_render:
        run_checked([str(blender),'--background',str(blend_path),'--python',str(ROOT/'scripts/hmh-blender/export-hmh-authored-props.py'),'--','--manifest',str(MANIFEST_PATH),'--raw-output',str(raw_dir),'--report-output',str(ROOT/'.tmp/hmh-authored-props-render.json')],'authored prop render')
    records=analyse(manifest,raw_dir)
    if options.verify_reproducible:
        run_checked([str(blender),'--background',str(blend_path),'--python',str(ROOT/'scripts/hmh-blender/export-hmh-authored-props.py'),'--','--manifest',str(MANIFEST_PATH),'--raw-output',str(raw_verify),'--report-output',str(ROOT/'.tmp/hmh-authored-props-render-verify.json')],'authored prop reproducibility render')
        verify_records=analyse(manifest,raw_verify)
        first={item['asset']['assetId']:item['sourcePixelSha256'] for item in records}; second={item['asset']['assetId']:item['sourcePixelSha256'] for item in verify_records}
        if first!=second: raise RuntimeError('Authored prop reproducibility verification failed')
    metrics=build_outputs(manifest,records,output_dir,blend_path,options.verify_reproducible)
    print(json.dumps({k:metrics[k] for k in ('status','assetCount','uniqueSourceFrames','reproducibleVerified','atlasSize')},sort_keys=True))


if __name__=='__main__':
    with exclusive_pipeline_lock(ROOT/'.tmp/hmh-authored-props-pipeline.lock', 'HMH authored prop pipeline'):
        main()
