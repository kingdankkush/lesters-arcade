"""Build the per-hero held-weapon pages (HMH-N03).

    python scripts/run-hmh-held-weapons-pipeline.py                # all heroes, all weapons
    python scripts/run-hmh-held-weapons-pipeline.py --heroes lilly  # one hero
    python scripts/run-hmh-held-weapons-pipeline.py --verify-reproducible

Steps: verify Blender 5.1.2, rebuild the weapon scene from its generator,
render every weapon in every hero's hands through that hero's own packed
source scene (opened read-only), analyse the frames, pack one lossless WebP
page per hero and weapon, and write metadata, metrics and a review contact
sheet under apps/portal/assets/generated/hmh-held-weapons/<actor>/.

With --verify-reproducible each hero is rendered twice from cold and the two
passes must agree within the hero reproducibility budget (premultiplied RGBA,
8 changed pixels / 2 per channel / 32 total per frame).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from hmh_pipeline_lock import exclusive_pipeline_lock

ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / 'apps/hmh-reboot/assets/source/blender/hmh-held-weapons.json'
EXPECTED_BLENDER_VERSION = 'Blender 5.1.2'
BLENDER = Path(os.environ.get('BLENDER_EXECUTABLE', r'D:\Apps\Blender\blender.exe'))
TEMP_ROOT = ROOT / '.tmp/hmh-held-weapons'


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--heroes', default='', help='comma-separated actor ids (default: every production hero)')
    parser.add_argument('--verify-reproducible', action='store_true')
    parser.add_argument('--skip-scene', action='store_true', help='reuse the committed weapon scene')
    parser.add_argument('--skip-render', action='store_true', help='repack from the existing raw renders')
    parser.add_argument('--parallel', type=int, default=4, help='hero renders to run at once')
    return parser.parse_args()


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding='utf-8'))


def write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + '\n', encoding='utf-8', newline='\n')


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b''):
            digest.update(chunk)
    return digest.hexdigest()


def run_checked(command: list[str], label: str, log: Path | None = None) -> str:
    completed = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, encoding='utf-8', errors='replace')
    combined = completed.stdout + completed.stderr
    if log is not None:
        log.parent.mkdir(parents=True, exist_ok=True)
        log.write_text(combined, encoding='utf-8')
    if completed.returncode != 0 or 'Traceback (most recent call last)' in combined:
        raise RuntimeError(f'{label} failed ({completed.returncode})\n{combined[-8000:]}')
    print(f'[held-weapons] {label}: pass', flush=True)
    return combined


def blender_version() -> str:
    return run_checked([str(BLENDER), '--version'], 'blender --version').splitlines()[0].strip()


def expected_frames(manifest: dict, hero_manifest: dict, actor_id: str) -> list[dict]:
    frames = []
    for weapon in manifest['weapons']:
        for state, clip in manifest['clips'].items():
            for direction in hero_manifest['directions']:
                for index in range(clip['frames']):
                    frame_id = f"{actor_id}__{weapon['weaponId']}__{state}__{direction}__{index:03d}"
                    frames.append({'id': frame_id, 'filename': frame_id + '.png', 'weaponId': weapon['weaponId'], 'state': state, 'direction': direction, 'frameIndex': index, 'fps': clip['fps'], 'loop': clip.get('loop', True)})
    return frames


def canonical_rgba(image: Image.Image) -> Image.Image:
    data = np.array(image.convert('RGBA'))
    data[data[:, :, 3] == 0, :3] = 0
    return Image.fromarray(data, 'RGBA')


def hero_frame_size(hero_manifest: dict, pilot: dict) -> int:
    size = pilot.get('frameSize', hero_manifest['render']['frameSize'])
    if size[0] != size[1]:
        raise RuntimeError(f"{pilot['actorId']} hero frame must be square: {size}")
    return int(size[0])


def held_frame_size(manifest: dict, hero_frame: int) -> tuple[int, int]:
    size = round(hero_frame * manifest['render']['coverage'] * manifest['render']['pixelDensity'])
    return (size, size)


def held_source_pivot(manifest: dict, hero_manifest: dict, pilot: dict, frame_size: tuple[int, int]) -> tuple[int, int]:
    """The hero's declared ground pivot mapped into the held frame.

    Both frames share the camera; the held frame widens the ortho scale by
    `coverage` and multiplies the resolution by coverage x pixelDensity, so a
    hero pixel (hx, hy) lands at (centre + (hx - heroCentre) x pixelDensity).
    Using the declared pivot (not a fresh projection of the origin) keeps the
    held layer glued to the hero layers even where an atlas pivot carries its
    own rounding.
    """
    hero_frame = hero_frame_size(hero_manifest, pilot)
    declared = pilot.get('sourcePivot', hero_manifest['pivot']['sourcePixels'])
    density = manifest['render']['pixelDensity']
    return (round(frame_size[0] / 2 + (declared[0] - hero_frame / 2) * density), round(frame_size[1] / 2 + (declared[1] - hero_frame / 2) * density))


def analyse(manifest: dict, raw_dir: Path, frames: list[dict], receipt: dict) -> dict:
    threshold = manifest['render']['alphaThreshold']
    frame_size = tuple(receipt['frameSize'])
    expected = sorted(frame['filename'] for frame in frames)
    actual = sorted(path.name for path in raw_dir.glob('*.png'))
    if actual != expected:
        missing = sorted(set(expected) - set(actual))[:6]
        unexpected = sorted(set(actual) - set(expected))[:6]
        raise RuntimeError(f'Held-weapon frame set mismatch: missing={missing} unexpected={unexpected}')
    receipt_by_id = {frame['id']: frame for frame in receipt['frames']}
    records = []
    hashes_by_clip = defaultdict(set)
    for frame in frames:
        image = canonical_rgba(Image.open(raw_dir / frame['filename']))
        if image.size != frame_size:
            raise RuntimeError(f"{frame['id']} rendered at {image.size}, expected {frame_size}")
        data = np.array(image)
        alpha = data[:, :, 3]
        mask = alpha > threshold
        if not mask.any():
            raise RuntimeError(f"{frame['id']} rendered empty")
        corners = [int(alpha[y, x]) for x, y in ((0, 0), (frame_size[0] - 1, 0), (0, frame_size[1] - 1), (frame_size[0] - 1, frame_size[1] - 1))]
        if max(corners) > threshold:
            raise RuntimeError(f"{frame['id']} touches a frame corner")
        rows = np.where(mask.any(axis=1))[0]
        cols = np.where(mask.any(axis=0))[0]
        bbox = (int(cols[0]), int(rows[0]), int(cols[-1]) + 1, int(rows[-1]) + 1)
        if bbox[0] == 0 or bbox[1] == 0 or bbox[2] == frame_size[0] or bbox[3] == frame_size[1]:
            raise RuntimeError(f"{frame['id']} is clipped by the frame edge: {bbox}")
        digest = hashlib.sha256(image.tobytes()).hexdigest()
        hashes_by_clip[(frame['weaponId'], frame['state'], frame['direction'])].add(digest)
        pose = receipt_by_id.get(frame['id'])
        if pose is None:
            raise RuntimeError(f"{frame['id']} has no exporter receipt entry")
        records.append({**frame, 'image': image, 'bbox': bbox, 'sourcePixelSha256': digest, 'opaquePixels': int(mask.sum()), 'grip': pose['grip'], 'muzzle': pose['muzzle']})
    for (weapon_id, state, direction), digests in hashes_by_clip.items():
        needed = 2 if manifest['clips'][state]['frames'] >= 3 else 1
        if len(digests) < needed:
            raise RuntimeError(f'Insufficient motion in {weapon_id}/{state}/{direction}: {len(digests)} distinct poses')
    return {'records': records, 'uniqueFrameCount': len({record['sourcePixelSha256'] for record in records})}


def compare_premultiplied(dir_a: Path, dir_b: Path, frames: list[dict]) -> dict:
    maxima = [0, 0, 0]
    worst = None
    for frame in frames:
        values = []
        for directory in (dir_a, dir_b):
            data = np.array(Image.open(directory / frame['filename']).convert('RGBA'), dtype=np.uint32)
            data[:, :, :3] = (data[:, :, :3] * data[:, :, 3:4] + 127) // 255
            values.append(data.astype(np.int32))
        diff = np.abs(values[0] - values[1])
        row = [int(np.count_nonzero(np.any(diff, axis=2))), int(diff.max()), int(diff.sum())]
        if worst is None or tuple(row) > worst[0]:
            worst = (tuple(row), frame['id'])
        maxima = [max(x, y) for x, y in zip(maxima, row)]
    return {'maxChangedVisiblePixels': maxima[0], 'maxChannelDelta': maxima[1], 'maxTotalChannelDelta': maxima[2], 'worstFrameId': worst[1] if worst else None}


def shelf_pack(records: list[dict], padding: int, max_size: int):
    """Shelf-pack into the smallest square page that fits; returns (size, placements)."""
    sizes = [size for size in (512, 1024, 2048) if size <= max_size]
    ordered = sorted(records, key=lambda record: (-(record['bbox'][3] - record['bbox'][1]), record['id']))
    for size in sizes:
        x = y = padding
        shelf = 0
        placements = {}
        ok = True
        for record in ordered:
            width = record['bbox'][2] - record['bbox'][0]
            height = record['bbox'][3] - record['bbox'][1]
            if x + width + padding > size:
                x = padding
                y += shelf + padding
                shelf = 0
            if y + height + padding > size or width + 2 * padding > size:
                ok = False
                break
            placements[record['id']] = (x, y, width, height)
            x += width + padding
            shelf = max(shelf, height)
        if ok:
            return size, placements
    return None


def pack_pages(records: list[dict], padding: int, max_size: int):
    """Split one weapon's frames across as many max_size pages as needed.

    A polearm's frames do not fit one 2048 page at twice the hero density, so
    frames fill pages in shelf order (tallest first) and each frame records
    the page it landed on. Deterministic: same records, same layout.
    """
    remaining = sorted(records, key=lambda record: (-(record['bbox'][3] - record['bbox'][1]), record['id']))
    pages = []
    while remaining:
        packed = shelf_pack(remaining, padding, max_size)
        if packed is not None:
            pages.append(packed)
            break
        # Fill one full page greedily in shelf order, then continue.
        x = y = padding
        shelf = 0
        placements = {}
        rest = []
        for record in remaining:
            width = record['bbox'][2] - record['bbox'][0]
            height = record['bbox'][3] - record['bbox'][1]
            if width + 2 * padding > max_size or height + 2 * padding > max_size:
                raise RuntimeError(f"{record['id']} is larger than a {max_size} page")
            if placements and x + width + padding > max_size:
                x = padding
                y += shelf + padding
                shelf = 0
            if y + height + padding > max_size:
                rest.append(record)
                continue
            placements[record['id']] = (x, y, width, height)
            x += width + padding
            shelf = max(shelf, height)
        if not placements:
            raise RuntimeError('Held-weapon page packing made no progress')
        pages.append((max_size, placements))
        remaining = rest
    return pages


def build_pages(manifest: dict, hero_manifest: dict, pilot: dict, analysis: dict, receipt: dict, output_dir: Path, blender_version_text: str, reproducible: dict | None, source_blend: Path, weapons_blend: Path) -> dict:
    actor_id = pilot['actorId']
    output_dir.mkdir(parents=True, exist_ok=True)
    for stale in output_dir.glob('*.webp'):
        stale.unlink()
    hero_frame = hero_frame_size(hero_manifest, pilot)
    frame_size = held_frame_size(manifest, hero_frame)
    if tuple(receipt['frameSize']) != frame_size or receipt.get('heroFrameSize', hero_frame) != hero_frame:
        raise RuntimeError(f"{actor_id} receipt frame size {receipt['frameSize']} does not match {frame_size} for a {hero_frame} px hero")
    origin = receipt['originPixels']
    source_pivot = held_source_pivot(manifest, hero_manifest, pilot, frame_size)
    padding = manifest['atlas']['padding']
    by_weapon = defaultdict(list)
    for record in analysis['records']:
        by_weapon[record['weaponId']].append(record)
    weapons_meta = {}
    total_bytes = 0
    for weapon in manifest['weapons']:
        weapon_id = weapon['weaponId']
        records = by_weapon[weapon_id]
        pages = pack_pages(records, padding, manifest['atlas']['maxSize'])
        page_images = [Image.new('RGBA', (size, size), (0, 0, 0, 0)) for size, _ in pages]
        page_of = {}
        placements = {}
        for page_index, (size, placed) in enumerate(pages):
            for frame_id, placement in placed.items():
                page_of[frame_id] = page_index
                placements[frame_id] = placement
        frames = []
        for record in sorted(records, key=lambda item: item['id']):
            x0, y0, x1, y1 = record['bbox']
            ax, ay, width, height = placements[record['id']]
            page_images[page_of[record['id']]].paste(record['image'].crop((x0, y0, x1, y1)), (ax, ay))
            # Logical (orig) rectangle: the crop grown to include the ground
            # pivot so the anchor stays inside [0, 1]; trim is the crop inside it.
            lx0, ly0 = min(x0, source_pivot[0]), min(y0, source_pivot[1])
            lx1, ly1 = max(x1, source_pivot[0] + 1), max(y1, source_pivot[1] + 1)
            pivot_x, pivot_y = source_pivot[0] - lx0, source_pivot[1] - ly0
            # Per-frame records carry only what varies; layer, weaponId, fps,
            # loop, sourceSize and sourcePivot are page-level constants the
            # runtime index re-derives (1624 frames per hero make that count).
            frames.append({
                'id': record['id'], 'state': record['state'], 'direction': record['direction'], 'frameIndex': record['frameIndex'],
                'page': page_of[record['id']],
                'frame': {'x': ax, 'y': ay, 'w': width, 'h': height},
                'orig': {'w': lx1 - lx0, 'h': ly1 - ly0}, 'trim': {'x': x0 - lx0, 'y': y0 - ly0, 'w': width, 'h': height},
                'spriteSourceSize': {'x': lx0, 'y': ly0, 'w': lx1 - lx0, 'h': ly1 - ly0},
                'pivot': {'x': pivot_x, 'y': pivot_y},
                'anchor': {'x': round(pivot_x / (lx1 - lx0), 6), 'y': round(pivot_y / (ly1 - ly0), 6)},
                'grip': {'x': round(record['grip'][0] - source_pivot[0], 1), 'y': round(record['grip'][1] - source_pivot[1], 1)},
                'muzzle': {'x': round(record['muzzle'][0] - source_pivot[0], 1), 'y': round(record['muzzle'][1] - source_pivot[1], 1)},
                'opaquePixels': record['opaquePixels'], 'sourcePixelSha256': record['sourcePixelSha256'],
            })
        page_records = []
        weapon_bytes = 0
        for page_index, page in enumerate(page_images):
            suffix = '' if page_index == 0 else f'-{page_index}'
            page_path = output_dir / f'{actor_id}-{weapon_id}{suffix}.webp'
            page.save(page_path, format='WEBP', lossless=True, exact=True)
            page_bytes = page_path.stat().st_size
            if page_bytes > manifest['atlas']['maxBytesPerPage']:
                raise RuntimeError(f'{actor_id}/{weapon_id} page {page_index} is {page_bytes} bytes, over {manifest["atlas"]["maxBytesPerPage"]}')
            weapon_bytes += page_bytes
            # Reconstruction proof: every frame decodes back to its canonical crop.
            with Image.open(page_path) as saved:
                decoded = np.array(saved.convert('RGBA'))
            for record in records:
                if page_of[record['id']] != page_index:
                    continue
                ax, ay, width, height = placements[record['id']]
                crop = np.array(record['image'].crop(record['bbox']))
                if not np.array_equal(decoded[ay:ay + height, ax:ax + width], crop):
                    raise RuntimeError(f'{record["id"]} did not survive the page round trip')
            page_records.append({'image': f'./{page_path.name}', 'imageBytes': page_bytes, 'imageSha256': sha256(page_path), 'dimensions': {'width': page.width, 'height': page.height}})
        total_bytes += weapon_bytes
        weapons_meta[weapon_id] = {
            'weaponId': weapon_id, 'shape': weapon['shape'], 'lengthMeters': weapon['lengthMeters'], 'fireAction': weapon['fireAction'],
            'pages': page_records, 'imageBytes': weapon_bytes,
            'frameCount': len(frames), 'frames': frames,
        }
    if total_bytes > manifest['atlas']['maxBytesPerHero']:
        raise RuntimeError(f'{actor_id} held-weapon pages total {total_bytes} bytes, over {manifest["atlas"]["maxBytesPerHero"]}')
    metadata = {
        'schemaVersion': 1, 'pipelineId': manifest['pipelineId'], 'classification': manifest['classification'], 'runtimeAuthority': manifest['runtimeAuthority'],
        'actorId': actor_id, 'variantId': pilot['variantId'], 'heroPipelineId': hero_manifest['pipelineId'],
        'heroFrameSize': hero_frame, 'heroSourcePivot': {'x': pilot['sourcePivot'][0], 'y': pilot['sourcePivot'][1]}, 'coverage': manifest['render']['coverage'], 'pixelDensity': manifest['render']['pixelDensity'],
        'frameSize': {'w': frame_size[0], 'h': frame_size[1]}, 'sourcePivot': {'x': source_pivot[0], 'y': source_pivot[1]}, 'originPixels': origin,
        'directions': hero_manifest['directions'], 'clips': {state: {'frames': clip['frames'], 'fps': clip['fps'], 'loop': clip.get('loop', True), 'native': clip['native']} for state, clip in manifest['clips'].items()},
        'gripFrame': manifest['gripFrame'], 'pistolFrame': receipt['pistolFrame'], 'calibration': receipt['calibration'],
        'sourceSha256': pilot['sourceModel']['sourceSha256'], 'weaponSceneSha256': sha256(weapons_blend), 'exporterSha256': sha256(ROOT / manifest['scene']['exporter']),
        'totalImageBytes': total_bytes, 'weapons': weapons_meta,
    }
    metadata_path = output_dir / f'{actor_id}-held-weapons.json'
    # Compact JSON: 1624 frame records per hero are machine-read, and the
    # indent would double a file the runtime fetches once per session.
    metadata_path.write_text(json.dumps(metadata, separators=(',', ':')) + '\n', encoding='utf-8', newline='\n')
    sheet_path = build_contact_sheet(manifest, hero_manifest, pilot, analysis, source_pivot, frame_size, output_dir)
    metrics = {
        'schema': 'hmh-held-weapons-metrics-v1', 'status': 'pass', 'pipelineId': manifest['pipelineId'], 'actorId': actor_id, 'blenderVersion': blender_version_text.replace('Blender ', ''),
        'runtimeAuthority': manifest['runtimeAuthority'], 'frameCount': len(analysis['records']), 'uniqueFrameCount': analysis['uniqueFrameCount'], 'weaponCount': len(weapons_meta),
        'frameSize': list(frame_size), 'pivotPixels': list(source_pivot), 'originPixels': origin, 'orthoScale': receipt['orthoScale'], 'heroOrthoScale': receipt['heroOrthoScale'],
        'reproducibility': 'pass' if reproducible else 'single-pass', 'reproducibilityMode': 'bounded-premultiplied-rgba-v1', 'reproducibilityBudget': manifest['reproducibilityBudget'], 'reproducibilityObserved': reproducible,
        'sourceBlendSha256': sha256(source_blend), 'sourceBlendBytes': source_blend.stat().st_size, 'weaponSceneSha256': metadata['weaponSceneSha256'], 'manifestSha256': sha256(MANIFEST_PATH),
        'totalImageBytes': total_bytes, 'pages': {weapon_id: {'imageBytes': meta['imageBytes'], 'pages': meta['pages']} for weapon_id, meta in weapons_meta.items()},
        'metadataSha256': sha256(metadata_path), 'contactSheetSha256': sha256(sheet_path),
    }
    write_json(output_dir / f'{actor_id}-held-weapons-metrics.json', metrics)
    return metrics


def hero_layer_crop(atlas: Image.Image, metadata: dict, frame_id: str):
    frame = next(f for f in metadata['frames'] if f['id'] == frame_id)
    rect = frame['frame']
    crop = atlas.crop((rect['x'], rect['y'], rect['x'] + rect['w'], rect['y'] + rect['h']))
    sprite = frame['spriteSourceSize']
    trim = frame.get('trim', {'x': 0, 'y': 0})
    return crop, (sprite['x'] + trim['x'], sprite['y'] + trim['y'])


def build_contact_sheet(manifest: dict, hero_manifest: dict, pilot: dict, analysis: dict, source_pivot, frame_size, output_dir: Path) -> Path:
    """Aim frame 0 of every weapon in every direction, composited over the
    shipped hero base frames at hero density, for review. The first row is
    the hero's own native Coin Blaster weapon-layer frame, the reference the
    held pages are matched against."""
    actor_id = pilot['actorId']
    hero_dir = ROOT / hero_manifest['atlas']['outputDirectory'] / actor_id
    hero_meta = read_json(hero_dir / Path(pilot['output']['metadata']).name)
    hero_atlas = Image.open(hero_dir / Path(pilot['output']['atlas']).name).convert('RGBA')
    hero_pivot = hero_meta['frames'][0]['sourcePivot']
    density = manifest['render']['pixelDensity']
    cell = (frame_size[0] // density, frame_size[1] // density)
    directions = hero_manifest['directions']
    weapons = ['coin-blaster'] + [w['weaponId'] for w in manifest['weapons']]
    header = 26
    sheet = Image.new('RGBA', (cell[0] * len(directions), header + cell[1] * len(weapons)), (8, 13, 21, 255))
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    draw.text((6, 6), f'HMH HELD WEAPONS | {actor_id.upper()} | AIM FRAME 0 OVER THE SHIPPED HERO BASE | PROJECTION ONLY', fill=(231, 246, 255, 255), font=font)
    by_id = {record['id']: record for record in analysis['records']}
    offset = (source_pivot[0] // density - hero_pivot['x'], source_pivot[1] // density - hero_pivot['y'])
    for row, weapon_id in enumerate(weapons):
        for column, direction in enumerate(directions):
            canvas = Image.new('RGBA', cell, (0, 0, 0, 0))
            hero = Image.new('RGBA', (hero_meta['frames'][0]['sourceSize']['w'], hero_meta['frames'][0]['sourceSize']['h']), (0, 0, 0, 0))
            for layer, state in (('shadow', 'idle'), ('lower-body', 'idle'), ('torso-head', 'aim')):
                crop, position = hero_layer_crop(hero_atlas, hero_meta, f'{actor_id}__{layer}__{state}__{direction}__000')
                hero.alpha_composite(crop, position)
            if weapon_id == 'coin-blaster':
                crop, position = hero_layer_crop(hero_atlas, hero_meta, f'{actor_id}__weapon__aim__{direction}__000')
                hero.alpha_composite(crop, position)
                canvas.alpha_composite(hero, offset)
            else:
                canvas.alpha_composite(hero, offset)
                record = by_id[f'{actor_id}__{weapon_id}__aim__{direction}__000']
                weapon = record['image'].resize(cell, Image.LANCZOS)
                canvas.alpha_composite(weapon)
            sheet.alpha_composite(canvas, (column * cell[0], header + row * cell[1]))
            draw.text((column * cell[0] + 6, header + row * cell[1] + 4), f'{weapon_id}{" (native)" if weapon_id == "coin-blaster" else ""} {direction}', fill=(109, 210, 230, 255), font=font)
    sheet_path = output_dir / f'{actor_id}-held-weapons-contact-sheet.png'
    sheet.save(sheet_path, optimize=False, compress_level=9)
    return sheet_path


def render_hero(manifest: dict, hero_manifest: dict, pilot: dict, raw_dir: Path, receipt_path: Path, log: Path, weapons_blend: Path) -> None:
    source = ROOT / pilot['sourceModel']['path']
    if sha256(source) != pilot['sourceModel']['sourceSha256']:
        raise RuntimeError(f"{pilot['actorId']} packed source hash mismatch")
    run_checked([
        str(BLENDER), '--background', '--disable-autoexec', str(source), '--python-exit-code', '1', '--python', str(ROOT / manifest['scene']['exporter']), '--',
        '--manifest', str(MANIFEST_PATH), '--hero-manifest', str(ROOT / manifest['heroManifest']), '--actor', pilot['actorId'],
        '--weapons-blend', str(weapons_blend), '--output', str(raw_dir), '--receipt', str(receipt_path),
    ], f"{pilot['actorId']} held-weapon render -> {raw_dir.name}", log)


def main() -> None:
    args = parse_args()
    manifest = read_json(MANIFEST_PATH)
    hero_manifest = read_json(ROOT / manifest['heroManifest'])
    pilots = hero_manifest['pilots']
    if args.heroes:
        chosen = args.heroes.split(',')
        unknown = [actor for actor in chosen if actor not in {p['actorId'] for p in pilots}]
        if unknown:
            raise SystemExit(f'Unknown heroes {unknown}')
        pilots = [p for p in pilots if p['actorId'] in chosen]
    weapons_blend = ROOT / manifest['scene']['sourceBlend']
    version = None
    if not (args.skip_scene and args.skip_render):
        if not BLENDER.exists():
            raise FileNotFoundError(f'Blender executable not found: {BLENDER}')
        version = blender_version()
        if version != EXPECTED_BLENDER_VERSION:
            raise RuntimeError(f'expected {EXPECTED_BLENDER_VERSION!r}, received {version!r}')
    if not args.skip_scene:
        run_checked([str(BLENDER), '--background', '--factory-startup', '--python-exit-code', '1', '--python', str(ROOT / manifest['scene']['generator']), '--',
                     '--manifest', str(MANIFEST_PATH), '--source-blend', str(weapons_blend), '--inspection-output', str(TEMP_ROOT / 'scene-inspection.json')], 'held-weapon scene build')
        backup = weapons_blend.with_suffix(weapons_blend.suffix + '1')
        if backup.exists():
            backup.unlink()
    passes = ['run-a', 'run-b'] if args.verify_reproducible else ['run-a']
    if not args.skip_render:
        jobs = []
        for pilot in pilots:
            for run in passes:
                actor_temp = TEMP_ROOT / pilot['actorId']
                jobs.append((pilot, actor_temp / run, actor_temp / f'{run}-receipt.json', actor_temp / f'{run}.log'))
        with ThreadPoolExecutor(max_workers=max(1, args.parallel)) as pool:
            list(pool.map(lambda job: render_hero(manifest, hero_manifest, job[0], job[1], job[2], job[3], weapons_blend), jobs))
    output_root = ROOT / manifest['atlas']['outputDirectory']
    summary = []
    for pilot in pilots:
        actor_temp = TEMP_ROOT / pilot['actorId']
        frames = expected_frames(manifest, hero_manifest, pilot['actorId'])
        receipt = read_json(actor_temp / 'run-a-receipt.json')
        if receipt['frameCount'] != len(frames):
            raise RuntimeError(f"{pilot['actorId']} receipt lists {receipt['frameCount']} frames, expected {len(frames)}")
        analysis = analyse(manifest, actor_temp / 'run-a', frames, receipt)
        observed = None
        if args.verify_reproducible:
            analyse(manifest, actor_temp / 'run-b', frames, read_json(actor_temp / 'run-b-receipt.json'))
            observed = compare_premultiplied(actor_temp / 'run-a', actor_temp / 'run-b', frames)
            budget = manifest['reproducibilityBudget']
            exceeded = [key for key in budget if observed[key] > budget[key]]
            if exceeded:
                raise RuntimeError(f"{pilot['actorId']} held-weapon reproducibility exceeded {exceeded}: {observed}")
        metrics = build_pages(manifest, hero_manifest, pilot, analysis, receipt, output_root / pilot['actorId'], version or EXPECTED_BLENDER_VERSION, observed, ROOT / pilot['sourceModel']['path'], weapons_blend)
        summary.append({key: metrics[key] for key in ('actorId', 'frameCount', 'uniqueFrameCount', 'totalImageBytes', 'reproducibility', 'reproducibilityObserved')})
        print(json.dumps(summary[-1], sort_keys=True), flush=True)
    print(json.dumps({'status': 'pass', 'heroes': len(summary)}, sort_keys=True))


if __name__ == '__main__':
    with exclusive_pipeline_lock(ROOT / '.tmp/hmh-held-weapons-pipeline.lock', 'HMH held-weapon pipeline'):
        main()
