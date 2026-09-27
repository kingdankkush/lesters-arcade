"""Render two cold passes of a dark boss and pack a verified multi-page atlas (art wave 2b).

  python scripts/build-hmh-boss-roster.py render --role lockkeeper --source-directory .tmp/wave2b/drv-lk --output .tmp/wave2b/atlas-lk --run a
  python scripts/build-hmh-boss-roster.py render ... --run b
  python scripts/build-hmh-boss-roster.py pack   --role lockkeeper --source-directory .tmp/wave2b/drv-lk --output .tmp/wave2b/atlas-lk
  python scripts/build-hmh-boss-roster.py adopt  --role lockkeeper --source-directory .tmp/wave2b/drv-lk --output .tmp/wave2b/atlas-lk

`render` runs the Blender exporter once (take a Blender render slot around it).
`pack` checks that the two independent receipts agree and that every frame of
the clip plan exists, measures premultiplied repeatability against the hero
budget (8 changed visible pixels / 2 per channel / 32 total), trims frames,
shelf-packs them onto as many 2048 px pages as needed (each a lossless exact
WebP under 4 MiB, reconstruction checked pixel for pixel), writes the 128 px
mobile tier as `<page>@0.5x.webp` with the perf-step-6 recipe
(frame-isolated premultiplied Lanczos at exactly 2:1, lossy q90 with lossless
alpha), measures the body height that sets runtimeScale from the design world
size, and draws the full-size and gameplay-zoom contact sheets.
`adopt` copies the verified candidate into the repository.

Projection-only: nothing here changes collision, damage, AI, spawning, RNG,
progression or results.
"""
import argparse, hashlib, importlib.util, io, json, math, shutil, subprocess, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts/hmh-blender'))
import hmh_boss_clips as boss_clips  # noqa: E402

PIPELINE_ID = 'hmh-reboot-boss-roster-v1'
BUDGET = {'maxChangedVisiblePixels': 8, 'maxChannelDelta': 2, 'maxTotalChannelDelta': 32}
PAGE_EDGE = 2048
PAGE_MAX_BYTES = 4 * 1024 * 1024
PADDING = 2
HALF_SUFFIX = '@0.5x.webp'
HALF_WEBP = {'quality': 90, 'alpha_quality': 100, 'method': 6}
PAD_TEXELS = 3
EXPORTER = ROOT / 'scripts/hmh-blender/export-hmh-boss-roster.py'
ROSTER = ROOT / 'apps/hmh-reboot/assets/source/blender/hmh-boss-roster.json'
BLENDER = 'D:/Apps/Blender/blender.exe'


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, ROOT / path)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def load(args):
    source_dir = (ROOT / args.source_directory).resolve()
    source = json.loads((source_dir / 'source-receipt.json').read_text())
    if source['roleId'] != args.role:
        raise ValueError('boss role mismatch')
    if sha(source_dir / source['source']) != source['sourceSha256'] or not source['sourceUnchanged']:
        raise ValueError('Boss derivative proof changed')
    output = (ROOT / args.output).resolve()
    if not output.is_relative_to(ROOT / '.tmp'):
        raise ValueError('Use a private output under .tmp')
    return source_dir, source, output


def render(args):
    source_dir, source, output = load(args)
    output.mkdir(parents=True, exist_ok=True)
    stamp = {'sourceSha256': source['sourceSha256'], 'exporterSha256': sha(EXPORTER),
             'clipLibrarySha256': sha(ROOT / 'scripts/hmh-blender/hmh_boss_clips.py')}
    stamp_path = output / 'candidate.json'
    if stamp_path.exists() and json.loads(stamp_path.read_text()) != stamp:
        raise ValueError('Candidate changed; use a fresh output')
    stamp_path.write_text(json.dumps(stamp, indent=2) + '\n')
    raw = output / f'run-{args.run}'
    if raw.exists():
        raise ValueError(f'{raw} exists; remove it or use a fresh output')
    with (output / f'render-{args.run}.log').open('w') as log:
        subprocess.run([BLENDER, '--background', '--factory-startup', '--disable-autoexec', '--python-exit-code', '1',
                        '--python', str(EXPORTER), '--', '--source-directory', str(source_dir), '--output', str(raw)],
                       cwd=ROOT, stdout=log, stderr=subprocess.STDOUT, check=True)
    print(f'{args.role}: pass {args.run} complete', flush=True)


def shelf_pages(records):
    """Deterministic multi-page shelf packing: tallest first, then widest, then id."""
    order = sorted(records, key=lambda r: (-r['h'], -r['w'], r['id']))
    pages, placements = [], {}
    page, x, y, shelf = 0, 0, 0, 0
    heights = [0]
    for r in order:
        w, h = r['w'] + PADDING, r['h'] + PADDING
        if x + w > PAGE_EDGE:
            x, y, shelf = 0, y + shelf, 0
        if y + h > PAGE_EDGE:
            page += 1
            heights.append(0)
            x, y, shelf = 0, 0, 0
        placements[r['id']] = (page, x, y)
        heights[page] = max(heights[page], y + h)
        x += w
        shelf = max(shelf, h)
    return placements, [((hgt + 15) // 16) * 16 for hgt in heights]


def premultiplied(image):
    values = np.asarray(image.convert('RGBA'), dtype=np.float32) / np.float32(255)
    out = values.copy()
    out[..., :3] *= out[..., 3:4]
    return out


def half_page(page_image, rects):
    """Frame-isolated premultiplied Lanczos at exactly 2:1 (perf step 6 recipe)."""
    width, height = page_image.size
    if width % 2 or height % 2:
        raise ValueError('half-res page needs even dimensions')
    source = premultiplied(page_image)
    out = np.zeros((height // 2, width // 2, 4), dtype=np.float32)
    written = np.zeros((height // 2, width // 2), dtype=bool)
    for x, y, w, h in rects:
        hx0, hy0 = x // 2, y // 2
        hx1, hy1 = (x + w + 1) // 2, (y + h + 1) // 2
        cx0, cy0 = (hx0 - PAD_TEXELS) * 2, (hy0 - PAD_TEXELS) * 2
        cw, ch = (hx1 - hx0 + 2 * PAD_TEXELS) * 2, (hy1 - hy0 + 2 * PAD_TEXELS) * 2
        canvas = np.zeros((ch, cw, 4), dtype=np.float32)
        canvas[y - cy0:y - cy0 + h, x - cx0:x - cx0 + w] = source[y:y + h, x:x + w]
        channels = [np.asarray(Image.fromarray(canvas[..., c], mode='F').resize((cw // 2, ch // 2), Image.LANCZOS)) for c in range(4)]
        small = np.stack(channels, axis=-1)
        region = small[PAD_TEXELS:PAD_TEXELS + hy1 - hy0, PAD_TEXELS:PAD_TEXELS + hx1 - hx0]
        target = written[hy0:hy1, hx0:hx1]
        if target.any():
            raise ValueError('half-res frame footprints overlap')
        out[hy0:hy1, hx0:hx1] = region
        written[hy0:hy1, hx0:hx1] = True
    alpha = np.clip(out[..., 3:4], 0, 1)
    rgb = np.clip(out[..., :3], 0, alpha)
    rgb = np.where(alpha > 1e-6, rgb / np.maximum(alpha, 1e-6), 0)
    data = np.concatenate([rgb, alpha], axis=-1)
    data = np.clip(np.round(data * 255), 0, 255).astype(np.uint8)
    data[data[..., 3] == 0, :3] = 0
    return Image.fromarray(data, 'RGBA')


def pack(args):
    source_dir, source, output = load(args)
    roster = json.loads(ROSTER.read_text())
    entry = next(b for b in roster['bosses'] if b['roleId'] == args.role)
    a = json.loads((output / 'run-a/render-receipt.json').read_text())
    b = json.loads((output / 'run-b/render-receipt.json').read_text())
    if a != b or a['sourceSha256'] != source['sourceSha256'] or a['exporterSha256'] != sha(EXPORTER) or a['blenderVersion'] != '5.1.2' or not a['sourceUnchanged'] or a['preview']:
        raise ValueError('Independent boss receipts disagree or are stale')
    plan = boss_clips.frame_plan(args.role)
    frames = a['frames']
    if [(f['phase'], f['clip'], f['direction'], f['frameIndex']) for f in frames] != plan:
        raise ValueError('Boss clip coverage incomplete or out of order')
    for f in frames:
        if abs(f['groundResidual']) > .0001:
            raise ValueError('Boss grounding drift')
    motion = module('hero_motion', 'scripts/build-hmh-hero-motion.py')
    repeatability = motion.premultiplied_compare(output / 'run-a', output / 'run-b', [dict(f, filename=f['id'] + '.png') for f in frames])
    if any(repeatability[k] > v for k, v in BUDGET.items()):
        raise ValueError(f'Boss repeatability failed: {repeatability}')
    records, unique = [], {}
    for f in frames:
        image = Image.open(output / 'run-a' / (f['id'] + '.png')).convert('RGBA')
        if list(image.size) != f['sourceSize']:
            raise ValueError('Boss source size changed')
        data = np.array(image)
        data[data[:, :, 3] == 0, :3] = 0
        image = Image.fromarray(data)
        bbox = image.getchannel('A').getbbox()
        if not bbox or min(bbox[:2]) < 1 or bbox[2] >= image.width or bbox[3] >= image.height:
            raise ValueError('Boss frame empty or clipped: ' + f['id'])
        pixel_sha = hashlib.sha256(image.tobytes()).hexdigest()
        unique.setdefault((f['phase'], f['clip'], f['direction']), set()).add(pixel_sha)
        records.append(dict(f, image=image, bbox=bbox, w=bbox[2] - bbox[0], h=bbox[3] - bbox[1], pixelSha256=pixel_sha))
    for (phase, clip_id, direction), values in unique.items():
        count = boss_clips.BOSS_CLIPS[args.role]['clips'][clip_id]['frames']
        if len(values) < max(2, math.ceil(0.6 * count)):
            raise ValueError(f'Insufficient boss poses: {phase}/{clip_id}/{direction} {len(values)} of {count}')
    placements, heights = shelf_pages(records)
    destination = output / 'packed'
    destination.mkdir(exist_ok=True)
    pages = []
    for index, page_height in enumerate(heights):
        page = Image.new('RGBA', (PAGE_EDGE, page_height))
        rects = []
        for r in records:
            p, x, y = placements[r['id']]
            if p == index:
                page.paste(r['image'].crop(r['bbox']), (x, y))
                rects.append((x, y, r['w'], r['h']))
        name = f'{args.role}-boss-roster-{index}.webp'
        path = destination / name
        page.save(path, format='WEBP', lossless=True, exact=True, method=6, quality=100)
        if path.stat().st_size > PAGE_MAX_BYTES:
            raise ValueError(f'Boss page {index} exceeds the 4 MiB page cap')
        decoded = Image.open(path).convert('RGBA')
        for r in records:
            p, x, y = placements[r['id']]
            if p == index and decoded.crop((x, y, x + r['w'], y + r['h'])).tobytes() != r['image'].crop(r['bbox']).tobytes():
                raise ValueError('Boss atlas reconstruction changed pixels')
        half = half_page(decoded, rects)
        half_path = destination / (Path(name).stem + HALF_SUFFIX)
        buffer = io.BytesIO()
        half.save(buffer, format='WEBP', **HALF_WEBP)
        half_path.write_bytes(buffer.getvalue())
        pages.append({'image': './' + name, 'width': PAGE_EDGE, 'height': page_height, 'imageBytes': path.stat().st_size,
                      'imageSha256': sha(path), 'decodedBytes': PAGE_EDGE * page_height * 4,
                      'halfRes': {'image': './' + half_path.name, 'width': PAGE_EDGE // 2, 'height': page_height // 2,
                                  'imageBytes': half_path.stat().st_size, 'imageSha256': sha(half_path),
                                  'decodedBytes': (PAGE_EDGE // 2) * (page_height // 2) * 4}})
    first_phase = boss_clips.BOSS_CLIPS[args.role]['phases'][0]
    idle = next(r for r in records if r['phase'] == first_phase and r['clip'] == 'idle' and r['direction'] == 'south' and r['frameIndex'] == 0)
    body_height = idle['h']
    runtime_scale = round(entry['designWorldHeightPx'] / body_height, 4)
    packed = []
    for r in records:
        p, x, y = placements[r['id']]
        left, top = r['bbox'][:2]
        px, py = r['sourcePivot']
        packed.append({'id': r['id'], 'phase': r['phase'], 'clip': r['clip'], 'direction': r['direction'],
                       'frameIndex': r['frameIndex'], 'fps': r['fps'], 'loop': r['loop'], 'page': p,
                       'frame': {'x': x, 'y': y, 'w': r['w'], 'h': r['h']}, 'pivot': {'x': px - left, 'y': py - top},
                       'anchor': {'x': round((px - left) / r['w'], 6), 'y': round((py - top) / r['h'], 6)},
                       'sourceSize': {'w': r['sourceSize'][0], 'h': r['sourceSize'][1]}, 'trimmed': True, 'rotated': False,
                       'pixelSha256': r['pixelSha256']})
    metadata = {
        'schemaVersion': 1, 'pipelineId': PIPELINE_ID, 'classification': 'production-art', 'runtimeAuthority': 'projection-only',
        'status': 'dark', 'roleId': args.role, 'actorId': source['actorId'], 'identityForm': source['identityForm'], 'boss': True,
        'sourceModel': {'kind': 'tripo-boss-derivative', 'sourceSha256': source['sourceSha256'], 'baseSourceSha256': source['baseSha256'],
                        'baseSource': source['baseSource']},
        'clipLibrary': {'version': boss_clips.CLIP_LIBRARY_VERSION, 'sha256': source['clipLibrarySha256']},
        'renderContract': source['renderContract'], 'designWorldHeightPx': entry['designWorldHeightPx'],
        'measuredBodyHeightPx': body_height, 'runtimeScale': runtime_scale,
        'phases': source['clipManifest']['phases'], 'directions': list(boss_clips.DIRECTIONS_ALL),
        'clips': source['clipManifest']['clips'], 'phaseClips': source['clipManifest']['phaseClips'],
        'pages': pages, 'frames': packed,
    }
    metadata_path = destination / f'{args.role}-boss-roster.json'
    metadata_path.write_text(json.dumps(metadata, indent=1) + '\n', newline='\n')
    contact_sheets(args.role, records, runtime_scale, destination)
    report = {'status': 'verified-private-candidate', 'roleId': args.role, 'sourceSha256': source['sourceSha256'],
              'exporterSha256': a['exporterSha256'], 'frames': len(frames), 'pages': len(pages),
              'imageBytes': sum(p['imageBytes'] for p in pages), 'decodedBytes': sum(p['decodedBytes'] for p in pages),
              'halfResImageBytes': sum(p['halfRes']['imageBytes'] for p in pages),
              'halfResDecodedBytes': sum(p['halfRes']['decodedBytes'] for p in pages),
              'repeatability': repeatability, 'metadataSha256': sha(metadata_path), 'measuredBodyHeightPx': body_height,
              'runtimeScale': runtime_scale, 'pixelReconstructionChanged': 0,
              'uniquePoses': {'|'.join(k): len(v) for k, v in unique.items()}}
    (output / 'measurement.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({k: v for k, v in report.items() if k != 'uniquePoses'}), flush=True)


def contact_sheets(role, records, runtime_scale, destination):
    by_key = {(r['phase'], r['clip'], r['direction'], r['frameIndex']): r for r in records}
    table = boss_clips.BOSS_CLIPS[role]
    # Full size: every clip of every phase, south, every frame; plus idle frame 0 in eight directions per phase.
    rows = []
    for phase in table['phases']:
        rows.append((f'{phase} idle x8', [by_key[(phase, 'idle', d, 0)] for d in boss_clips.DIRECTIONS_ALL]))
        for clip_id in table['phaseClips'][phase]:
            rows.append((f'{phase} {clip_id}', [by_key[(phase, clip_id, 'south', i)] for i in range(table['clips'][clip_id]['frames'])]))
    cell = 256
    columns = max(len(frames) for _, frames in rows)
    sheet = Image.new('RGBA', (170 + cell * columns, cell * len(rows)), (58, 62, 70, 255))
    draw = ImageDraw.Draw(sheet)
    for row, (label, frames) in enumerate(rows):
        draw.text((4, row * cell + cell // 2 - 6), label, fill=(240, 240, 240, 255))
        for column, r in enumerate(frames):
            sheet.alpha_composite(r['image'], (170 + column * cell, row * cell))
    sheet.save(destination / f'{role}-contact-full.png')
    # Gameplay zoom: the idle, a tell hold and an attack beat per phase at the
    # desktop draw size (runtimeScale) and the phone size (half again), beside
    # the shipped Liquidator and Bagholder at their own runtime scales.
    liquidator_meta = json.loads((ROOT / 'apps/portal/assets/generated/hmh-native-roster/the-liquidator/the-liquidator-native-roster.json').read_text())
    liquidator_page = Image.open(ROOT / 'apps/portal/assets/generated/hmh-native-roster/the-liquidator/the-liquidator-native-roster.webp').convert('RGBA')
    lf = next(f for f in liquidator_meta['frames'] if f['state'] == 'idle' and f['direction'] == 'south' and f['frameIndex'] == 0 and f['phase'] == liquidator_meta['phases'][0])
    liquidator = liquidator_page.crop((lf['frame']['x'], lf['frame']['y'], lf['frame']['x'] + lf['frame']['w'], lf['frame']['y'] + lf['frame']['h']))
    samples = []
    for phase in table['phases']:
        clips = table['phaseClips'][phase]
        tell = next((c for c in clips if c.startswith('tell-')), 'idle')
        attack = next((c for c in clips if c.startswith('attack-')), 'idle')
        samples += [by_key[(phase, 'idle', 'south', 0)], by_key[(phase, tell, 'south', table['clips'][tell]['frames'] - 1)],
                    by_key[(phase, attack, 'south', min(1, table['clips'][attack]['frames'] - 1))]]
    zooms = [('desktop', runtime_scale), ('phone', runtime_scale * 0.6)]
    width = 40 + (len(samples) + 1) * 150
    sheet = Image.new('RGBA', (width, 2 * 190), (88, 82, 72, 255))
    draw = ImageDraw.Draw(sheet)
    for row, (label, scale) in enumerate(zooms):
        draw.text((4, row * 190 + 4), label, fill=(255, 255, 255, 255))
        ref = liquidator.resize((max(1, round(liquidator.width * 0.86 * (scale / runtime_scale))), max(1, round(liquidator.height * 0.86 * (scale / runtime_scale)))), Image.LANCZOS)
        sheet.alpha_composite(ref, (40, row * 190 + 180 - ref.height))
        draw.text((40, row * 190 + 20), 'Liquidator', fill=(255, 255, 255, 255))
        for i, r in enumerate(samples):
            crop = r['image'].crop(r['bbox'])
            small = crop.resize((max(1, round(crop.width * scale)), max(1, round(crop.height * scale))), Image.LANCZOS)
            x = 40 + (i + 1) * 150
            sheet.alpha_composite(small, (x, row * 190 + 180 - small.height))
    sheet.save(destination / f'{role}-contact-gameplay.png')


def adopt(args):
    source_dir, source, output = load(args)
    report = json.loads((output / 'measurement.json').read_text())
    if report['sourceSha256'] != source['sourceSha256'] or report['exporterSha256'] != sha(EXPORTER):
        raise ValueError('Candidate is stale')
    packed = output / 'packed'
    if sha(packed / f'{args.role}-boss-roster.json') != report['metadataSha256']:
        raise ValueError('Metadata changed after pack')
    derivative = ROOT / 'apps/hmh-reboot/assets/source/models/boss-derivatives' / args.role
    derivative.mkdir(parents=True, exist_ok=True)
    for name in (source['source'], 'source-receipt.json'):
        shutil.copyfile(source_dir / name, derivative / name)
    generated = ROOT / 'apps/portal/assets/generated/hmh-boss-roster' / args.role
    if generated.exists():
        for old in generated.iterdir():
            old.unlink()
    generated.mkdir(parents=True, exist_ok=True)
    for path in packed.iterdir():
        if path.suffix in {'.webp', '.json'}:
            shutil.copyfile(path, generated / path.name)
    evidence = ROOT / 'docs/testing/hmh-boss-roster' / args.role
    evidence.mkdir(parents=True, exist_ok=True)
    for run in ('a', 'b'):
        shutil.copyfile(output / f'run-{run}/render-receipt.json', evidence / f'run-{run}-receipt.json')
    for name in (f'{args.role}-contact-full.png', f'{args.role}-contact-gameplay.png'):
        shutil.copyfile(packed / name, evidence / name)
    shutil.copyfile(output / 'measurement.json', evidence / 'measurement.json')
    print(json.dumps({'adopted': args.role, 'pages': report['pages'], 'imageBytes': report['imageBytes']}))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['render', 'pack', 'adopt'])
    parser.add_argument('--role', required=True)
    parser.add_argument('--source-directory', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--run', choices=['a', 'b'])
    args = parser.parse_args()
    {'render': render, 'pack': pack, 'adopt': adopt}[args.command](args)


if __name__ == '__main__':
    main()
