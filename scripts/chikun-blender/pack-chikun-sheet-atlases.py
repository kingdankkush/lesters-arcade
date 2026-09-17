"""Pack the sheet-rig renders into the runtime atlases the Chikun character loads.

python scripts/chikun-blender/pack-chikun-sheet-atlases.py --source ../chikun-sheet

Flight clips go to apps/portal/assets/generated/chikun-flight-v3/ (poster + character.json),
ground clips to chikun-ground-motion-v1/ (character.json with per-frame bounds), ragdoll
parts to chikun-ragdoll-v1/ (manifest.json), and the provenance receipt to
apps/chikun/assets/source/native-provenance.json. Contact sheets land in docs/chikun/.
Existing flight audio under chikun-flight-v3/audio is untouched. Deterministic for a given
render directory: sheets are WEBP q88 m4 from LANCZOS 256->192 downsamples.
"""
import argparse, json, hashlib, math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
p = argparse.ArgumentParser(); p.add_argument('--source', required=True); a = p.parse_args()
source = Path(a.source).resolve()
report = json.loads((source / 'character.json').read_text())
FRAME = 192; COLUMNS = report['columns']
targets = {
    'flight': ROOT / 'apps/portal/assets/generated/chikun-flight-v3',
    'ground': ROOT / 'apps/portal/assets/generated/chikun-ground-motion-v1',
}
for path in targets.values(): path.mkdir(parents=True, exist_ok=True)
docs = ROOT / 'docs/chikun'; docs.mkdir(exist_ok=True)
font = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 17)
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()

def frame_image(clip, i):
    img = Image.open(source / 'frames' / f"{clip['name']}-{i:02}.png").convert('RGBA')
    box = img.getbbox(); assert box is not None, f"Empty render {clip['name']}-{i:02}"
    assert box[0] >= 2 and box[1] >= 2 and box[2] <= img.width - 2 and box[3] <= img.height - 2, f"{clip['name']}-{i:02} touches the frame edge: {box}"
    return img

packed = {'flight': [], 'ground': []}
contact = Image.new('RGB', (1200, math.ceil(len(report['clips']) / 5) * 240), (13, 28, 42)); draw = ImageDraw.Draw(contact)
for k, clip in enumerate(report['clips']):
    family = clip['family']; sheet = Image.new('RGBA', (COLUMNS * FRAME, math.ceil(clip['frames'] / COLUMNS) * FRAME)); hashes = []; bounds = []
    for i in range(clip['frames']):
        img = frame_image(clip, i); hashes.append(hashlib.sha256(img.tobytes()).hexdigest())
        img = img.resize((FRAME, FRAME), Image.Resampling.LANCZOS); bounds.append(list(img.getbbox()))
        sheet.paste(img, ((i % COLUMNS) * FRAME, (i // COLUMNS) * FRAME))
        if i == 5: contact.paste(img, ((k % 5) * 240 + 24, (k // 5) * 240 + 8), img)
    assert len(set(hashes)) >= 12, f"Clip is not animated: {clip['name']}"
    path = targets[family] / clip['sheet']; sheet.save(path, 'WEBP', quality=88, method=4)
    entry = {'name': clip['name'], 'frames': clip['frames'], 'fps': clip['fps'], 'loop': clip['loop'], 'sheet': clip['sheet'], 'expression': clip['expression'],
             'bytes': path.stat().st_size, 'sha256': sha(path), 'uniqueFrames': len(set(hashes))}
    if family == 'ground': entry['bounds'] = bounds
    packed[family].append(entry)
    draw.text(((k % 5) * 240 + 15, (k // 5) * 240 + 211), f"{k + 1:02}  {clip['name'].replace('_', ' ')}  ({clip['expression']})", font=font, fill=(208, 227, 223))
contact.save(docs / 'chikun-sheet-clips.png')
Image.open(source / 'frames/cruise-04.png').save(targets['flight'] / 'poster.webp', 'WEBP', quality=95)

common = {key: report[key] for key in ['flightPose', 'characterSheet', 'source', 'source_sha256', 'source_vertices', 'source_triangles', 'vertices', 'triangles', 'bones', 'expressionBones', 'expressions', 'palette', 'paintRegions', 'vertex_color_attribute', 'glow_attribute', 'character']}
flight = {'schema': 'chikun-native-character-v4', **common, 'frameSize': FRAME, 'columns': COLUMNS, 'rows': report['rows'], 'clips': packed['flight'], 'runtimeBytes': sum(c['bytes'] for c in packed['flight']), 'notes': report['notes']}
ground = {'schema': 'chikun-ground-motion-v2', 'source': 'Chikun-Sheet-Rig.blend', 'characterSheet': report['characterSheet'], 'frameSize': FRAME, 'columns': COLUMNS, 'rows': report['rows'], 'clips': packed['ground'], 'runtimeBytes': sum(c['bytes'] for c in packed['ground']), 'notes': 'Ten authored ground / flight transition actions plus the hands-in-pockets idle, rendered from the sheet rig.'}
(targets['flight'] / 'character.json').write_text(json.dumps(flight, indent=2) + '\n')
(targets['ground'] / 'character.json').write_text(json.dumps(ground, indent=2) + '\n')

# Ragdoll parts: crop each rendered limb to its alpha bounds at the 256 px render scale.
ragdoll = ROOT / 'apps/portal/assets/generated/chikun-ragdoll-v1'; ragdoll.mkdir(exist_ok=True); assets = []
for part in ['armL', 'armR', 'head', 'legL', 'legR', 'torso']:
    img = Image.open(source / 'ragdoll' / f'{part}.png').convert('RGBA'); box = img.getbbox(); assert box, part
    img = img.crop(box); path = ragdoll / f'{part}.webp'; img.save(path, 'WEBP', quality=90, method=6)
    assets.append({'name': part, 'file': path.name, 'width': img.width, 'height': img.height, 'bytes': path.stat().st_size, 'sha256': sha(path)})
(ragdoll / 'manifest.json').write_text(json.dumps({'schema': 'chikun-ragdoll-v1', 'runtimeBytes': sum(x['bytes'] for x in assets), 'assets': assets}, indent=2) + '\n')

provenance = {**flight, 'schema': 'chikun-native-character-v4', 'frameSize': 256, 'clips': [{k: c[k] for k in ['name', 'frames', 'fps', 'loop', 'sheet', 'expression']} | {'family': 'flight'} for c in packed['flight']] + [{k: c[k] for k in ['name', 'frames', 'fps', 'loop', 'sheet', 'expression']} | {'family': 'ground'} for c in packed['ground']]}
provenance.pop('runtimeBytes')
(ROOT / 'apps/chikun/assets/source/native-provenance.json').write_text(json.dumps(provenance, indent=2) + '\n')
print(json.dumps({family: {'clips': len(packed[family]), 'atlasBytes': sum(c['bytes'] for c in packed[family]), 'decodedMiB': round(sum(c['frames'] * FRAME * FRAME * 4 for c in packed[family]) / 1024 / 1024, 1)} for family in packed} | {'ragdollBytes': sum(x['bytes'] for x in assets)}, indent=2))
