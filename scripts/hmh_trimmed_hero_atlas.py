"""Opt-in lossless atlas trimming with Pixi schema-2 logical rectangles."""
import json
from pathlib import Path
from PIL import Image, ImageChops
from hmh_hero_frame_visibility import is_released_prop_frame


def build_trimmed_atlas(manifest, pilot, analysis, output_dir, frame_size, source_pivot, pack, save):
    records = analysis['records']
    crops, logical_images, packing = {}, {}, []
    for record in records:
        logical = record['image'].crop(record['bbox'])
        channels = logical.split()
        occupied = channels[0]
        for channel in channels[1:]:
            occupied = ImageChops.lighter(occupied, channel)
        trim = occupied.getbbox()
        if trim is None and is_released_prop_frame(record):
            if logical.size != (1, 1) or logical.getpixel((0, 0)) != (0, 0, 0, 0):
                raise RuntimeError(f"Invalid released prop null cell: {record['id']}")
            trim = (0, 0, 1, 1)
        if trim is None:
            raise RuntimeError(f"Cannot compact empty frame: {record['id']}")
        logical_images[record['id']] = logical
        crops[record['id']] = trim
        packing.append({**record, 'bbox': (0, 0, trim[2] - trim[0], trim[3] - trim[1])})
    size, placements = pack(packing, manifest['atlas']['padding'], manifest['atlas']['maxSize'])
    atlas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    frames = []
    for record in records:
        rid = record['id']
        logical = logical_images[rid]
        tx0, ty0, tx1, ty1 = crops[rid]
        x, y, width, height = placements[rid]
        atlas.paste(logical.crop(crops[rid]), (x, y))
        x0, y0, _, _ = record['bbox']
        px, py = source_pivot[0] - x0, source_pivot[1] - y0
        if not (0 <= px <= logical.width and 0 <= py <= logical.height):
            raise RuntimeError(f'Ground pivot outside logical frame: {rid}')
        frames.append({
            **{key: record[key] for key in ('id', 'layer', 'state', 'direction', 'frameIndex', 'fps', 'loop')},
            'frame': {'x': x, 'y': y, 'w': width, 'h': height}, 'rotated': False, 'trimmed': True,
            'orig': {'w': logical.width, 'h': logical.height},
            'trim': {'x': tx0, 'y': ty0, 'w': tx1 - tx0, 'h': ty1 - ty0},
            'sourceSize': {'w': frame_size[0], 'h': frame_size[1]},
            'spriteSourceSize': {'x': x0, 'y': y0, 'w': logical.width, 'h': logical.height},
            'sourcePivot': {'x': source_pivot[0], 'y': source_pivot[1]}, 'pivot': {'x': px, 'y': py},
            'anchor': {'x': round(px / logical.width, 6), 'y': round(py / logical.height, 6)},
            'opaquePixels': record['opaquePixels'], 'sourcePixelSha256': record['decodedHash'],
            **({'visibility': record['visibility']} if is_released_prop_frame(record) else {}),
        })
    atlas_path = output_dir / Path(pilot['output']['atlas']).name
    meta_path = output_dir / Path(pilot['output']['metadata']).name
    save(atlas, atlas_path)
    reconstructed = 0
    with Image.open(atlas_path) as saved:
        decoded = saved.convert('RGBA')
        for frame in frames:
            rect, orig, trim = frame['frame'], frame['orig'], frame['trim']
            rebuilt = Image.new('RGBA', (orig['w'], orig['h']), (0, 0, 0, 0))
            rebuilt.paste(decoded.crop((rect['x'], rect['y'], rect['x'] + rect['w'], rect['y'] + rect['h'])), (trim['x'], trim['y']))
            if rebuilt.tobytes() != logical_images[frame['id']].tobytes():
                raise RuntimeError(f"Trim changed source RGBA: {frame['id']}")
            reconstructed += 1
    metadata = {
        'schemaVersion': 2, 'pipelineId': manifest['pipelineId'], 'actorId': pilot['actorId'],
        'variantId': pilot['variantId'], 'animationProfile': pilot['animationProfile'],
        'classification': manifest['classification'], 'runtimeAuthority': pilot['runtimeAuthority'],
        'gameplayBodyProfile': manifest['gameplayBodyProfile'], 'image': './' + atlas_path.name,
        'directions': manifest['directions'], 'layers': pilot['layers'],
        'composition': {'independentDirections': True, 'weaponSocket': manifest['scene']['weaponSocket'], 'layerOrder': pilot['composition']},
        'nativeWeaponIds': list(pilot.get('nativeWeaponIds', [])),
        'nativeActionIds': list(pilot.get('nativeActionIds', [])),
        'frames': frames,
    }
    meta_path.write_text(json.dumps(metadata, indent=2) + '\n', encoding='utf-8', newline='\n')
    return atlas_path, meta_path, {'width': size, 'height': size, 'reconstructedFrames': reconstructed, 'reconstructionPixelDifferences': 0}
