"""Arcade cabinet pipeline: flat panel art -> Blender cabinet kit -> turntable sprites.

Stages (run all by default, or pick with --stage):
  extract  Pillow: crop and perspective-rectify the flat panels for each cabinet,
           upscale them (Lanczos + light unsharp mask), knock out the checker or
           matte background, and write the runtime textures the Blender kit uses
           to assets-source/arcade-cabinets-3d/<game>/.
  render   Blender 5.1 (scripts/hmh-blender/build-arcade-cabinets.py): one
           parametric upright cabinet per game, a 16-frame 360-degree turntable at
           384x420 on a transparent film, plus a poster frame. Hold the shared
           heavy lock around this stage.
  pack     Pillow: a WebP sprite strip (<= 350 KB) and a WebP poster (<= 30 KB) per
           cabinet under apps/portal/assets/generated/arcade-cabinets-3d/<game>/,
           a manifest.json with frame rects, bytes and sha256, and the generated
           browser module arcade-cabinets-3d-manifest.mjs.

Panel sources, in priority order:
  1. Owner panels: Desktop/Projects/LestersArcade-Assets/Cabinet-Panels/<game>/
     panel-<name>.png (marquee, screen, deck, control-front, kick, side-left,
     side-right, back). Drop final approved art there and re-run this script;
     any file present replaces the extracted panel of the same name.
  2. Extraction from the existing art: the owner's HMH reference turnaround
     (Cabinet-Panels/hard-money-heroes/hmh-cabinet-reference-turnaround.webp),
     the committed Chikun six-view PNGs and the committed STACKED turnaround.
Extracted HMH panels are also written to the owner store as hmh-extracted-*.png
(2048 px) so they never shadow a future owner-supplied panel-*.png.

Deterministic: fixed crop quads, fixed resamplers, Cycles with a fixed seed on CPU.
"""
import argparse, hashlib, json, os, subprocess
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OWNER_STORE = Path(os.environ.get('CABINET_PANELS_DIR', Path.home() / 'Desktop/Projects/LestersArcade-Assets/Cabinet-Panels'))
TEXTURES = ROOT / 'assets-source/arcade-cabinets-3d'
OUT = ROOT / 'apps/portal/assets/generated/arcade-cabinets-3d'
RAW = Path(os.environ.get('CABINET_RENDER_DIR', Path(os.environ.get('TEMP', '/tmp')) / 'arcade-cabinets-3d-render'))
BLENDER = os.environ.get('BLENDER', 'D:/Apps/Blender/blender.exe')
KIT = ROOT / 'scripts/hmh-blender/build-arcade-cabinets.py'
PANELS = ('marquee', 'screen', 'deck', 'control-front', 'kick', 'side-left', 'side-right', 'back')
TEXTURE_EDGE = 1024      # runtime texture long edge (what Blender samples)
OWNER_EDGE = 2048        # owner-store long edge for extracted HMH panels
FRAMES, FRAME_W, FRAME_H = 16, 384, 420
STRIP_BUDGET, POSTER_BUDGET = 350_000, 30_000
BODY_DARK = (14, 13, 18)

HMH_REF = OWNER_STORE / 'hard-money-heroes/hmh-cabinet-reference-turnaround.webp'
PORTAL = ROOT / 'apps/portal/assets'


def rect(x0, y0, x1, y1):
    return ((x0, y0), (x1, y0), (x1, y1), (x0, y1))


# Each panel is (source key, quad TL/TR/BR/BL in source pixels, kind, mirror).
# Front views are close to orthographic, so their bands are rectangles; the
# STACKED side only exists in a three-quarter view and is rectified from a
# measured parallelogram. Side panels keep their painted silhouette and are
# mapped onto the kit's side profile by bounding box.
GAMES = {
    'hard-money-heroes': {
        'title': 'Hard Money Heroes',
        'sources': {'ref': HMH_REF},
        'background': 'checker',
        'panels': {
            'marquee': ('ref', rect(98, 22, 456, 117)),
            'screen': ('ref', rect(98, 117, 456, 303)),
            'deck': ('ref', rect(98, 303, 456, 352)),
            'control-front': ('ref', rect(98, 352, 456, 404)),
            'kick': ('ref', rect(98, 404, 456, 550)),
            'side-right': ('ref', rect(1078, 9, 1385, 565), 'side'),
            'side-left': ('ref', rect(569, 568, 869, 1049), 'side'),
            'back': ('ref', rect(108, 572, 444, 1049)),
        },
    },
    'chikun': {
        'title': "Chikun's Escape",
        'sources': {v: PORTAL / f'generated/chikun-cabinet/chikun-cabinet-{v}.png' for v in ('front', 'right', 'left', 'back')},
        'background': 'alpha',
        'panels': {
            'marquee': ('front', rect(78, 62, 316, 122)),
            'screen': ('front', rect(78, 122, 316, 262)),
            'deck': ('front', rect(78, 262, 316, 298)),
            'control-front': ('front', rect(78, 298, 316, 338)),
            'kick': ('front', rect(78, 338, 316, 436)),
            'side-right': ('right', rect(55, 57, 281, 440), 'side'),
            'side-left': ('left', rect(105, 92, 318, 431), 'side'),
            'back': ('back', rect(80, 104, 305, 440)),
        },
    },
    'stacked': {
        'title': 'STACKED',
        'sources': {'atlas': PORTAL / 'stacked-cabinet/stacked-cabinet-turnaround-v1.png'},
        'background': 'matte',
        'panels': {
            'marquee': ('atlas', rect(165, 15, 405, 75)),
            'screen': ('atlas', rect(165, 75, 405, 238)),
            'deck': ('atlas', rect(165, 238, 405, 285)),
            'control-front': ('atlas', rect(165, 285, 405, 332)),
            'kick': ('atlas', rect(165, 332, 405, 488)),
            # Three-quarter back view: the side's front edge is on the right.
            'side-left': ('atlas', ((1281, 8), (1416, -6), (1416, 472), (1281, 486)), 'side-rectified'),
            'side-right': ('atlas', ((1281, 8), (1416, -6), (1416, 472), (1281, 486)), 'side-rectified', True),
            'back': ('atlas', rect(166, 522, 398, 990)),
        },
    },
}


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def rel(path):
    text = str(path).replace('\\', '/')
    root = str(ROOT).replace('\\', '/') + '/'
    if text.startswith(root):
        return text[len(root):]
    marker = '/LestersArcade-Assets/'
    return 'LestersArcade-Assets/' + text.split(marker, 1)[1] if marker in text else Path(text).name


def perspective_coeffs(quad, size):
    """Coefficients mapping output rectangle pixels to the source quad."""
    w, h = size
    dst = [(0, 0), (w, 0), (w, h), (0, h)]
    rows, rhs = [], []
    for (x, y), (u, v) in zip(dst, quad):
        rows.append([x, y, 1, 0, 0, 0, -u * x, -u * y]); rhs.append(u)
        rows.append([0, 0, 0, x, y, 1, -v * x, -v * y]); rhs.append(v)
    return np.linalg.solve(np.array(rows, float), np.array(rhs, float)).tolist()


def checker_foreground(image):
    """Flood-fill the light neutral checker from the border; the rest is art."""
    a = np.asarray(image.convert('RGB')).astype(int)
    cand = ((a.min(2) > 205) & (a.max(2) - a.min(2) < 14)).astype(np.uint8) * 255
    m = Image.fromarray(cand).copy()
    W, H = m.size
    seeds = [(x, y) for x in range(0, W, 5) for y in (0, H - 1)] + [(x, y) for y in range(0, H, 5) for x in (0, W - 1)]
    for seed in seeds:
        if m.getpixel(seed) == 255:
            ImageDraw.floodfill(m, seed, 128)
    return Image.fromarray(((np.asarray(m) != 128) * 255).astype(np.uint8))


def load_rgba(path, background):
    image = Image.open(path).convert('RGBA')
    if background == 'checker':
        image.putalpha(checker_foreground(image))
    elif background == 'matte':
        lum = np.asarray(image.convert('L')).astype(int)
        image.putalpha(Image.fromarray(((lum > 14) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5)))
    return image


def upscale(image, long_edge):
    w, h = image.size
    scale = long_edge / max(w, h)
    out = image.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
    return out.filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))


def flatten(image, color=BODY_DARK):
    base = Image.new('RGBA', image.size, (*color, 255))
    base.alpha_composite(image)
    return base.convert('RGB')


def extract_panel(source, spec):
    quad = spec[1]
    kind = spec[2] if len(spec) > 2 else 'face'
    mirror = spec[3] if len(spec) > 3 else False
    xs = [p[0] for p in quad]; ys = [p[1] for p in quad]
    w = round(max(xs) - min(xs)); h = round(max(ys) - min(ys))
    if kind == 'side-rectified':
        h = round(max(quad[3][1] - quad[0][1], quad[2][1] - quad[1][1]))
        w = round(h * 0.55)  # the kit's depth:height ratio, measured on the HMH side view
    size = (w * 4, h * 4)    # oversample the warp, then settle with Lanczos
    warped = source.transform(size, Image.PERSPECTIVE, perspective_coeffs(quad, size), Image.BICUBIC)
    warped = warped.resize((w, h), Image.LANCZOS)
    if mirror:
        warped = warped.transpose(Image.FLIP_LEFT_RIGHT)
    return warped


def owner_panel(game, name):
    path = OWNER_STORE / game / f'panel-{name}.png'
    return path if path.exists() else None


def stage_extract(games):
    for game in games:
        config = GAMES[game]
        sources = {key: load_rgba(path, config['background']) for key, path in config['sources'].items()}
        target = TEXTURES / game
        target.mkdir(parents=True, exist_ok=True)
        panels = {}
        for name in PANELS:
            spec = config['panels'][name]
            override = owner_panel(game, name)
            if override:
                panel = Image.open(override).convert('RGBA')
                origin = {'ownerPanel': rel(override), 'ownerSha256': sha256(override)}
            else:
                panel = extract_panel(sources[spec[0]], spec)
                src = config['sources'][spec[0]]
                origin = {'extractedFrom': rel(src), 'sourceSha256': sha256(src), 'quad': [list(p) for p in spec[1]],
                          'mirror': bool(spec[3]) if len(spec) > 3 else False}
            if game == 'hard-money-heroes' and not override:
                store = OWNER_STORE / game
                store.mkdir(parents=True, exist_ok=True)
                upscale(panel, OWNER_EDGE).save(store / f'hmh-extracted-{name}.png', optimize=True)
            texture = flatten(upscale(panel, TEXTURE_EDGE))
            out = target / f'panel-{name}.webp'
            texture.save(out, 'WEBP', quality=92, method=6)
            panels[name] = {'texture': rel(out), 'size': list(texture.size), 'sha256': sha256(out), **origin}
        (target / 'panels.json').write_text(json.dumps({'game': game, 'panels': panels}, indent=2) + '\n', newline='\n')
        print('EXTRACTED', game, {k: v['size'] for k, v in panels.items()})


def stage_render(games):
    RAW.mkdir(parents=True, exist_ok=True)
    for game in games:
        cmd = [BLENDER, '-b', '--factory-startup', '-noaudio', '--python', str(KIT), '--', '--game', game,
               '--textures', str(TEXTURES / game), '--out', str(RAW / game), '--frames', str(FRAMES),
               '--width', str(FRAME_W), '--height', str(FRAME_H)]
        print('RENDER', game, flush=True)
        result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')
        done = [line for line in result.stdout.splitlines() if 'CABINET_RENDER_COMPLETE' in line]
        if result.returncode != 0 or not done:
            print('\n'.join(result.stdout.splitlines()[-30:])); print(result.stderr[-3000:])
            raise SystemExit(f'blender failed for {game}')
        print(done[0], flush=True)


def alpha_bounds(image):
    return image.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()


def encode_webp(image, path, budget, qualities=(88, 84, 80, 76, 72, 68, 64, 60, 56, 52)):
    for quality in qualities:
        image.save(path, 'WEBP', quality=quality, alpha_quality=90, method=6)
        if path.stat().st_size <= budget:
            return quality
    raise SystemExit(f'{path} is {path.stat().st_size} bytes, over the {budget} byte budget')


def stage_pack(games):
    OUT.mkdir(parents=True, exist_ok=True)
    for game in games:
        raw = RAW / game
        frames = [Image.open(raw / f'frame-{i:02}.png').convert('RGBA') for i in range(FRAMES)]
        for frame in frames:
            assert frame.size == (FRAME_W, FRAME_H), frame.size
        strip = Image.new('RGBA', (FRAME_W * FRAMES, FRAME_H), (0, 0, 0, 0))
        for i, frame in enumerate(frames):
            strip.alpha_composite(frame, (i * FRAME_W, 0))
        boxes = [alpha_bounds(f) for f in frames]
        union = [min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes)]
        target = OUT / game
        target.mkdir(parents=True, exist_ok=True)
        strip_path = target / f'{game}-cabinet-turntable.webp'
        poster_path = target / f'{game}-cabinet-poster.webp'
        strip_quality = encode_webp(strip, strip_path, STRIP_BUDGET)
        poster = Image.open(raw / 'poster.png').convert('RGBA')
        poster_quality = encode_webp(poster, poster_path, POSTER_BUDGET)
        panels = json.loads((TEXTURES / game / 'panels.json').read_text())['panels']
        render_meta = json.loads((raw / 'render.json').read_text())
        manifest = {
            'schema': 1, 'id': f'{game}-cabinet-3d', 'game': game, 'title': GAMES[game]['title'],
            'kind': 'presentation-only arcade cabinet turntable',
            'frames': FRAMES, 'frameWidth': FRAME_W, 'frameHeight': FRAME_H, 'restFrame': render_meta['posterFrame'],
            'degreesPerFrame': 360 / FRAMES, 'visibleBounds': union,
            'strip': {'src': strip_path.name, 'width': FRAME_W * FRAMES, 'height': FRAME_H,
                      'bytes': strip_path.stat().st_size, 'sha256': sha256(strip_path), 'webpQuality': strip_quality},
            'poster': {'src': poster_path.name, 'width': poster.width, 'height': poster.height,
                       'bytes': poster_path.stat().st_size, 'sha256': sha256(poster_path), 'webpQuality': poster_quality},
            'rects': [[i * FRAME_W, 0, FRAME_W, FRAME_H] for i in range(FRAMES)],
            'panels': panels,
            'render': render_meta,
            'recipe': {'runner': 'scripts/run-arcade-cabinets.py', 'runnerSha256': sha256(Path(__file__)),
                       'kit': 'scripts/hmh-blender/build-arcade-cabinets.py', 'kitSha256': sha256(KIT)},
        }
        (target / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', newline='\n')
        print('PACKED', game, manifest['strip']['bytes'], manifest['poster']['bytes'], union)
    write_module()


def write_module():
    entries = []
    for game in GAMES:
        path = OUT / game / 'manifest.json'
        if not path.exists():
            continue
        m = json.loads(path.read_text())
        entries.append({'game': game, 'id': m['id'],
                        'strip': f"./assets/generated/arcade-cabinets-3d/{game}/{m['strip']['src']}?v={m['strip']['sha256'][:12]}",
                        'poster': f"/assets/generated/arcade-cabinets-3d/{game}/{m['poster']['src']}?v={m['poster']['sha256'][:12]}",
                        'bounds': m['visibleBounds'], 'rest': m['restFrame']})
    lines = [
        '// Generated by scripts/run-arcade-cabinets.py (pack stage). Do not edit by hand.',
        '// Presentation only: 16-frame Blender turntables of the three playable cabinets.',
        f'export const ARCADE_CABINET_FRAME = Object.freeze({{ width: {FRAME_W}, height: {FRAME_H}, count: {FRAMES}, durationMs: 250 }});',
        '// The rest frame is pixel-identical to the poster; reduced motion shows only that frame.',
        'const turntable = ({ game, id, strip, poster, bounds, rest }) => Object.freeze({',
        "  id, game, poster, restFrame: rest, bounds: Object.freeze(bounds), className: 'arcade-cabinet-3d-rotator',",
        '  frameDurationMs: ARCADE_CABINET_FRAME.durationMs,',
        '  frames: Object.freeze(Array.from({ length: ARCADE_CABINET_FRAME.count }, (_, index) => Object.freeze({',
        '    src: `${strip}#frame=${index * ARCADE_CABINET_FRAME.width},0,${ARCADE_CABINET_FRAME.width},${ARCADE_CABINET_FRAME.height},${ARCADE_CABINET_FRAME.width * ARCADE_CABINET_FRAME.count},${ARCADE_CABINET_FRAME.height}`,',
        '    durationMs: ARCADE_CABINET_FRAME.durationMs, rest: index === rest,',
        '  }))),',
        '});',
        'export const ARCADE_CABINETS_3D = Object.freeze({',
    ]
    for e in entries:
        lines.append(f"  '{e['game']}': turntable({json.dumps(e)}),")
    lines.append('});')
    (OUT / 'arcade-cabinets-3d-manifest.mjs').write_text('\n'.join(lines) + '\n', newline='\n')


def stage_sheet(games):
    """Contact sheet per cabinet from the shipped WebPs: 16 frames + poster on a checker."""
    sheets = ROOT / 'docs/2.0/receipts/arcade-cabinets-20260930'
    sheets.mkdir(parents=True, exist_ok=True)
    def checker(size, cell=16):
        board = Image.new('RGBA', size, (58, 58, 66, 255))
        draw = ImageDraw.Draw(board)
        for y in range(0, size[1], cell):
            for x in range((y // cell) % 2 * cell, size[0], cell * 2):
                draw.rectangle([x, y, x + cell - 1, y + cell - 1], fill=(36, 36, 42, 255))
        return board
    for game in games:
        m = json.loads((OUT / game / 'manifest.json').read_text())
        strip = Image.open(OUT / game / m['strip']['src']).convert('RGBA')
        poster = Image.open(OUT / game / m['poster']['src']).convert('RGBA')
        cols, pad = 6, 6
        rows = 3
        sheet = checker((cols * (FRAME_W + pad) + pad, rows * (FRAME_H + pad) + pad))
        draw = ImageDraw.Draw(sheet)
        tiles = [strip.crop((i * FRAME_W, 0, (i + 1) * FRAME_W, FRAME_H)) for i in range(FRAMES)] + [poster]
        for k, tile in enumerate(tiles):
            x, y = pad + (k % cols) * (FRAME_W + pad), pad + (k // cols) * (FRAME_H + pad)
            sheet.alpha_composite(tile, (x, y))
            label = 'poster' if k == FRAMES else f'{k:02} {k * 360 // FRAMES} deg' + (' rest' if k == m['restFrame'] else '')
            draw.text((x + 6, y + 6), label, fill=(255, 230, 120, 255))
        sheet.convert('RGB').save(sheets / f'{game}-contact-sheet.webp', 'WEBP', quality=86, method=6)
        print('SHEET', game, sheets / f'{game}-contact-sheet.webp')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--stage', choices=('extract', 'render', 'pack', 'sheet', 'all'), default='all')
    parser.add_argument('--game', choices=tuple(GAMES), action='append')
    args = parser.parse_args()
    games = args.game or list(GAMES)
    if args.stage in ('extract', 'all'):
        stage_extract(games)
    if args.stage in ('render', 'all'):
        stage_render(games)
    if args.stage in ('pack', 'all'):
        stage_pack(games)
    if args.stage in ('sheet', 'all'):
        stage_sheet(games)


if __name__ == '__main__':
    main()
