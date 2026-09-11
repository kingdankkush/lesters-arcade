"""Render diagnostic sheets from runtime-resolved atlas frames, never source renders."""
import hashlib
import json
from pathlib import Path
import sys
from PIL import Image, ImageDraw


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def rebuild_pose(atlas, frames, frame_ids):
    """Reproduce Pixi's trim, pivot and density for independently directed layers."""
    canvas = Image.new('RGBA', (320, 320))
    for frame_id in frame_ids:
        f = frames[frame_id]
        rect = f['frame']
        crop = atlas.crop((rect['x'], rect['y'], rect['x'] + rect['w'], rect['y'] + rect['h']))
        # A common 256-pixel density makes the 216/224-pixel compact sources
        # directly comparable without changing their authored runtime scale.
        density = 256 / f.get('sourceSize', {'h': 160})['h']
        if density != 1:
            crop = crop.resize((max(1, round(crop.width * density)), max(1, round(crop.height * density))), Image.Resampling.LANCZOS)
        trim = f.get('trim', {'x': 0, 'y': 0})
        position = (round(160 + (trim['x'] - f['pivot']['x']) * density), round(256 + (trim['y'] - f['pivot']['y']) * density))
        canvas.alpha_composite(crop, position)
    return canvas


def sheet(rows, title, frames, atlas, cell_size):
    label_width, header = 170, 56
    out = Image.new('RGB', (label_width + 8 * cell_size, header + len(rows) * cell_size), '#14202a')
    draw = ImageDraw.Draw(out)
    draw.text((12, 10), title, fill='#ecf4ef')
    directions = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE']
    for i, direction in enumerate(directions):
        draw.text((label_width + i * cell_size + 5, 36), direction, fill='#bdd1ca')
    for row_index, (label, samples) in enumerate(rows):
        y = header + row_index * cell_size
        draw.text((12, y + 10), label, fill='#ecf4ef')
        for col, sample in enumerate(samples):
            pose = rebuild_pose(atlas, frames, sample['frameIds']).resize((cell_size, cell_size), Image.Resampling.LANCZOS)
            out.paste(pose, (label_width + col * cell_size, y), pose)
    return out


def main():
    plan_path, output = Path(sys.argv[1]), Path(sys.argv[2])
    plan = json.loads(plan_path.read_text(encoding='utf-8'))
    inputs = plan['inputs']
    if sha256(inputs['imagePath']) != inputs['imageSha256'] or sha256(inputs['metadataPath']) != inputs['metadataSha256']:
        raise ValueError('Atlas/metadata changed after the runtime pose plan was resolved')
    metadata = json.loads(Path(inputs['metadataPath']).read_text(encoding='utf-8'))
    frames = {frame['id']: frame for frame in metadata['frames']}
    with Image.open(inputs['imagePath']) as image:
        atlas = image.convert('RGBA')
    actor = plan['actorId']
    rows = [(f"{action['id']} {i+1}/{action['count']}", action['samples'][i*8:(i+1)*8]) for action in plan['actions'] for i in range(action['count'])]
    preview_rows = [(action['id'], action['samples'][(action['count']//2)*8:(action['count']//2+1)*8]) for action in plan['actions']]
    artifacts = []
    # 116 pixels of a 320-pixel diagnostic canvas corresponds to the actual
    # 160 / 256 * .58 hero density at camera zoom 1. Enlarged evidence is labeled.
    for name, selected_rows, cell, title in [
        ('gameplay', preview_rows, 116, f'{actor} | delivered pixels | gameplay density at camera zoom 1'),
        ('all-frames', rows, 192, f'{actor} | all animation samples | enlarged diagnostic'),
        ('waist', [(f'legs {i}; torso ->', plan['waist'][i*8:(i+1)*8]) for i in range(8)], 192, f'{actor} | independent directions | enlarged diagnostic'),
    ]:
        target = output / f'{actor}-{name}.png'
        sheet(selected_rows, title, frames, atlas, cell).save(target)
        artifacts.append({'path': target.name, 'sha256': sha256(target)})
    used = {frame_id for action in plan['actions'] for sample in action['samples'] for frame_id in sample['frameIds']}
    if used != set(frames):
        raise ValueError('Diagnostic pose table does not cover every delivered frame')
    print(json.dumps({'actorId': actor, 'imageSha256': inputs['imageSha256'], 'metadataSha256': inputs['metadataSha256'], 'planSha256': sha256(plan_path), 'frameCount': len(frames), 'coveredFrameCount': len(used), 'actions': [a['id'] for a in plan['actions']], 'independentDirectionPairs': len(plan['waist']), 'decodedRgbaBytes': atlas.width * atlas.height * 4, 'artifacts': artifacts}))


if __name__ == '__main__':
    main()
