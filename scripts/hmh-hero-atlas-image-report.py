"""Decode a PNG/WebP hero atlas and fail closed on frame bounds/coverage."""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image
from hmh_hero_frame_visibility import is_released_prop_frame

parser = argparse.ArgumentParser()
parser.add_argument('--image', required=True)
parser.add_argument('--metadata', required=True)
args = parser.parse_args()
image_path = Path(args.image)
metadata = json.loads(Path(args.metadata).read_text(encoding='utf-8'))
with Image.open(image_path) as encoded:
    encoding = encoded.format
    image = encoded.convert('RGBA')
pixels = image.tobytes()
transparent = sum(1 for alpha in pixels[3::4] if alpha == 0)
opaque = sum(1 for alpha in pixels[3::4] if alpha >= 200)
if not transparent or not opaque:
    raise RuntimeError('atlas must contain transparent and opaque pixels')
logical_hashes = {}
intentional_hidden = []
for frame in metadata['frames']:
    rect = frame['frame']
    if rect['x'] < 0 or rect['y'] < 0 or rect['x'] + rect['w'] > image.width or rect['y'] + rect['h'] > image.height:
        raise RuntimeError(f"frame outside atlas: {frame['id']}")
    decoded = image.crop((rect['x'], rect['y'], rect['x'] + rect['w'], rect['y'] + rect['h']))
    if metadata['schemaVersion'] == 2:
        orig, trim = frame['orig'], frame['trim']
        rebuilt = Image.new('RGBA', (orig['w'], orig['h']), (0, 0, 0, 0))
        rebuilt.paste(decoded, (trim['x'], trim['y']))
    else:
        rebuilt = decoded
    actual_opaque = sum(1 for alpha in rebuilt.getchannel('A').getdata() if alpha > 8)
    if is_released_prop_frame(frame):
        if metadata['schemaVersion'] != 2 or rebuilt.size != (1, 1) or rebuilt.tobytes() != b'\x00\x00\x00\x00':
            raise RuntimeError(f"released prop must be an exact transparent null cell: {frame['id']}")
        intentional_hidden.append(frame['id'])
    elif not actual_opaque:
        raise RuntimeError(f"unannotated blank actor frame: {frame['id']}")
    if actual_opaque != frame['opaquePixels']:
        raise RuntimeError(f"opaque pixel count drift: {frame['id']}")
    logical_hashes.setdefault(hashlib.sha256(rebuilt.tobytes()).hexdigest(), []).append(frame)
illegal_duplicates = [
    [frame['id'] for frame in frames]
    for frames in logical_hashes.values()
    if len(frames) > 1
    and not all(frame['layer'] == 'shadow' for frame in frames)
    and not all(is_released_prop_frame(frame) for frame in frames)
]
if illegal_duplicates:
    raise RuntimeError(f'animated decoded-frame duplicates: {illegal_duplicates[:2]}')
print(json.dumps({
    'encoding': encoding,
    'width': image.width,
    'height': image.height,
    'imageBytes': image_path.stat().st_size,
    'decodedRgbaBytes': len(pixels),
    'decodedRgbaSha256': hashlib.sha256(pixels).hexdigest(),
    'transparentPixels': transparent,
    'opaquePixels': opaque,
    'frameCount': len(metadata['frames']),
    'intentionalHiddenFrameCount': len(intentional_hidden),
    'uniqueLogicalFrames': len(logical_hashes),
    'illegalDuplicateGroups': len(illegal_duplicates),
}))
