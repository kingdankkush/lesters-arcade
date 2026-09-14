"""Build selected-hero motion pages from pinned native sources with two cold renders."""
from __future__ import annotations
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MOTION_CLIPS = {
    'lower-body': {'idle': {'frames': 6, 'fps': 6}, 'run': {'frames': 12, 'fps': 24}},
    'torso-head': {'aim': {'frames': 6, 'fps': 6}, 'reload': {'frames': 8, 'fps': 16, 'loop': False}, 'idle-check': {'frames': 8, 'fps': 4, 'loop': False}},
    'weapon': {'aim': {'frames': 6, 'fps': 6}, 'reload': {'frames': 8, 'fps': 16, 'loop': False}, 'idle-check': {'frames': 8, 'fps': 4, 'loop': False}},
}

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def premultiplied_compare(a, b, frames):
    maxima = [0, 0, 0]
    worst = None
    for frame in frames:
        values = []
        for directory in (a, b):
            data = np.array(Image.open(directory / frame['filename']).convert('RGBA'), dtype=np.uint32)
            data[:, :, :3] = (data[:, :, :3] * data[:, :, 3:4] + 127) // 255
            values.append(data.astype(np.int32))
        diff = np.abs(values[0] - values[1])
        row = [int(np.count_nonzero(np.any(diff, axis=2))), int(diff.max()), int(diff.sum())]
        if worst is None or tuple(row) > worst[0]: worst = (tuple(row), frame['id'])
        maxima = [max(x, y) for x, y in zip(maxima, row)]
    return dict(zip(('maxChangedVisiblePixels', 'maxChannelDelta', 'maxTotalChannelDelta'), maxima), worstFrameId=worst[1])

def analyze_motion_frames(directory, frames, frame_size, pivot, threshold):
    expected = {frame['filename'] for frame in frames}
    if {path.name for path in directory.glob('*.png')} != expected:
        raise ValueError('Motion page must contain exactly the declared frames')
    records, clips, decoded = [], {}, set()
    for frame in frames:
        image = Image.open(directory / frame['filename']).convert('RGBA')
        if image.size != frame_size: raise ValueError('Motion frame size mismatch')
        data = np.array(image)
        data[data[:, :, 3] == 0, :3] = 0
        image = Image.fromarray(data, 'RGBA')
        alpha = image.getchannel('A')
        bbox = alpha.point(lambda value: 255 if value > threshold else 0).getbbox()
        if bbox is None: raise ValueError('Empty motion frame')
        if max(int(data[y, x, 3]) for x, y in ((0, 0), (frame_size[0]-1, 0), (0, frame_size[1]-1), (frame_size[0]-1, frame_size[1]-1))) > threshold:
            raise ValueError('Motion frame clips a canvas corner')
        x0, y0, x1, y1 = bbox
        bbox = (min(x0, pivot[0]), min(y0, pivot[1]), max(x1, pivot[0]+1), max(y1, pivot[1]+1))
        pixel_hash = hashlib.sha256(image.tobytes()).hexdigest()
        key = (frame['layer'], frame['state'], frame['direction'])
        clips.setdefault(key, set()).add(pixel_hash)
        decoded.add(pixel_hash)
        records.append({**frame, 'image': image, 'bbox': bbox, 'decodedHash': pixel_hash, 'opaquePixels': int(np.count_nonzero(data[:, :, 3] > threshold))})
    for (layer, state, direction), hashes in clips.items():
        # Neutral poses may legitimately be shared across gesture boundaries.
        # Each actual cycle still has to move, and twelve running samples must
        # contain at least ten distinct poses rather than repeated frames.
        # The pistol moves inward and retraces its path while the support hand
        # completes the pouch/seat gesture: its eight samples contain four
        # spatial poses. The body gesture must still have six distinct poses.
        required = 10 if state == 'run' else 4 if layer == 'weapon' and state == 'reload' else 6 if state in ('reload', 'idle-check') else 3
        if len(hashes) < required:
            raise ValueError(f'Insufficient native motion: {layer}/{state}/{direction}: {len(hashes)} < {required}')
    return {'records': records, 'uniqueAnimatedFrameCount': len(decoded), 'uniquePosesByClip': {'|'.join(key): len(value) for key, value in clips.items()}}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--actor', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--resume', action='store_true')
    args = parser.parse_args()
    output = (ROOT / args.output).resolve()
    if not output.is_relative_to(ROOT / '.tmp') or (output.exists() and not args.resume):
        raise ValueError('Use a new isolated output, or resume the exact same candidate')
    output.mkdir(parents=True, exist_ok=True)
    sys.path.insert(0, str(ROOT / 'scripts'))
    spec = importlib.util.spec_from_file_location('pipeline', ROOT / 'scripts/run-hmh-production-hero-pilot.py')
    pipeline = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(pipeline)
    manifest = json.loads((ROOT / 'apps/hmh-reboot/assets/source/blender/hmh-production-heroes.json').read_text())
    pilot = next(p for p in manifest['pilots'] if p['actorId'] == args.actor)
    source = ROOT / pilot['sourceModel']['path']
    if digest(source) != pilot['sourceModel']['sourceSha256']:
        raise ValueError('Packed hero source hash mismatch')
    if pipeline.blender_version() != manifest['scene']['blenderVersion']:
        raise ValueError('Blender version mismatch')
    pilot['clips'] = MOTION_CLIPS
    pilot['output']['atlas'] = f'{args.actor}-motion.webp'
    pilot['output']['metadata'] = f'{args.actor}-motion.json'
    manifest['pilots'] = [pilot]
    manifest_path = output / 'manifest.json'
    serialized = json.dumps(manifest, indent=2)
    if manifest_path.exists() and manifest_path.read_text() != serialized:
        raise ValueError('Resume manifest differs from the existing candidate')
    manifest_path.write_text(serialized)
    exporter = ROOT / 'scripts/hmh-blender/export-hmh-hero-motion.py'
    exporter_hash = digest(exporter)
    stamp = output / 'exporter-sha256.txt'
    if stamp.exists() and stamp.read_text() != exporter_hash:
        raise ValueError('Resume exporter differs from the existing candidate')
    stamp.write_text(exporter_hash)
    for run in ('a', 'b'):
        raw = output / f'run-{run}'
        if args.resume and (output / f'run-{run}-receipt.json').exists(): continue
        command = [str(pipeline.BLENDER), '--background', '--disable-autoexec', str(source), '--python-exit-code', '1', '--python', str(exporter), '--', '--manifest', str(manifest_path), '--actor', args.actor, '--output', str(raw)]
        with (output / f'render-{run}.log').open('w') as log:
            subprocess.run(command, check=True, stdout=log, stderr=subprocess.STDOUT)
        print(f'{args.actor}: native motion pass {run} complete', flush=True)
    motion_pilot = {key: value for key, value in pilot.items() if key != 'releasedWeaponFrameIndices'}
    frames = pipeline.expected_frames(manifest, {**motion_pilot, 'layers': list(MOTION_CLIPS)})
    observed = premultiplied_compare(output / 'run-a', output / 'run-b', frames)
    if any(observed[key] > value for key, value in manifest['reproducibilityBudget'].items()):
        raise RuntimeError(f'Motion reproducibility failed: {observed}')
    analysis = analyze_motion_frames(output / 'run-a', frames, tuple(pilot['frameSize']), pipeline.pilot_pivot(manifest, pilot), manifest['render']['alphaThreshold'])
    packed = output / 'packed'
    packed.mkdir(exist_ok=True)
    image, metadata, dimensions = pipeline.build_atlas(manifest, pilot, analysis, packed)
    base_image = ROOT / f'apps/portal/assets/generated/hmh-reboot-production-heroes/{args.actor}/{args.actor}-production-pilot-atlas.webp'
    base_bytes = base_image.stat().st_size
    if image.stat().st_size > 4 * 1024 * 1024 or image.stat().st_size + base_bytes > 8 * 1024 * 1024:
        raise RuntimeError('Selected-hero motion transfer budget exceeded')
    data = json.loads(metadata.read_text())
    data.update(motionSchema=1, clips=MOTION_CLIPS, sourceSha256=pilot['sourceModel']['sourceSha256'], exporterSha256=exporter_hash, imageBytes=image.stat().st_size, baseImageBytes=base_bytes, imageSha256=digest(image), dimensions=dimensions)
    for frame in data['frames']: frame['motionPage'] = True
    metadata.write_text(json.dumps(data, indent=2) + '\n')
    report = {'actorId': args.actor, 'sourceSha256': digest(source), 'exporterSha256': exporter_hash, 'frames': len(frames), 'uniqueFrames': analysis['uniqueAnimatedFrameCount'], 'uniquePosesByClip': analysis['uniquePosesByClip'], 'repeatability': observed, 'imageBytes': image.stat().st_size, 'selectedHeroBytes': image.stat().st_size + base_bytes, 'dimensions': dimensions, 'imageSha256': digest(image), 'metadataSha256': digest(metadata), 'canonicalAdoption': False}
    (output / 'measurement.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2), flush=True)

if __name__ == '__main__': main()
