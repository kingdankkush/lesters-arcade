"""Decode one held-weapon page and fail closed on frame bounds and coverage.

Used by scripts/hmh-reboot-production-asset-qa.mjs (Blender-free, Pillow only).
"""
import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image

parser = argparse.ArgumentParser()
parser.add_argument('--image', required=True)
parser.add_argument('--metadata', required=True)
parser.add_argument('--weapon', required=True)
parser.add_argument('--page', type=int, default=0)
args = parser.parse_args()
image_path = Path(args.image)
metadata = json.loads(Path(args.metadata).read_text(encoding='utf-8'))
weapon = metadata['weapons'][args.weapon]
with Image.open(image_path) as encoded:
    encoding = encoded.format
    image = encoded.convert('RGBA')
pixels = image.tobytes()
transparent = sum(1 for alpha in pixels[3::4] if alpha == 0)
opaque = sum(1 for alpha in pixels[3::4] if alpha >= 200)
if encoding != 'WEBP' or not transparent or not opaque:
    raise RuntimeError('held-weapon page must be a WebP with transparent and opaque pixels')
declared = weapon['pages'][args.page]
if (image.width, image.height) != (declared['dimensions']['width'], declared['dimensions']['height']):
    raise RuntimeError(f'page dimensions {image.size} differ from metadata {declared["dimensions"]}')
frames = [frame for frame in weapon['frames'] if frame['page'] == args.page]
if not frames:
    raise RuntimeError('page carries no frames')
hashes = {}
for frame in frames:
    rect = frame['frame']
    if rect['x'] < 0 or rect['y'] < 0 or rect['x'] + rect['w'] > image.width or rect['y'] + rect['h'] > image.height:
        raise RuntimeError(f"frame outside page: {frame['id']}")
    decoded = image.crop((rect['x'], rect['y'], rect['x'] + rect['w'], rect['y'] + rect['h']))
    actual_opaque = sum(1 for alpha in decoded.getchannel('A').getdata() if alpha > 8)
    if actual_opaque != frame['opaquePixels']:
        raise RuntimeError(f"opaque pixel count drift: {frame['id']}")
    hashes.setdefault(hashlib.sha256(decoded.tobytes()).hexdigest(), []).append(frame['id'])
print(json.dumps({
    'encoding': encoding, 'width': image.width, 'height': image.height, 'imageBytes': image_path.stat().st_size,
    'decodedRgbaBytes': len(pixels), 'decodedRgbaSha256': hashlib.sha256(pixels).hexdigest(),
    'transparentPixels': transparent, 'opaquePixels': opaque, 'frameCount': len(frames), 'uniqueFrames': len(hashes),
}))
