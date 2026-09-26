"""Render Chikun obstacle sprites, headless and reproducible (Cycles).

"D:/Apps/Blender/blender.exe" -b --factory-startup --python-exit-code 1 \
    -P scripts/chikun-blender/build-chikun-obstacles.py -- \
    --out ../chikun-render-cache/obstacles [--kit common | --only crate-wood,log-oak] [--tier 2] [--samples 96]

Each sprite is built against its collision footprint (obstacles/registry.py,
obstacle-templates.json), framed by a pixel-exact orthographic camera pitched
19 degrees like the character rig, and rendered with the key light at the upper
left. Output per sprite: OUT/<kit>/<name>/f00.png ... (16-bit RGBA lit albedo),
fNN-emit.png for sprites with lights, and meta.json (frame, frames, anchor,
Blender version, samples, render time, script SHA-256). The packer
(scripts/build-chikun-obstacle-pack.py) turns the cache into shipped WebP.
"""
import bpy, sys, time, json, hashlib
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import argparse  # noqa: E402
from chikun_lib import shading  # noqa: E402
from obstacles import rig, registry, mats  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument('--out', required=True)
ap.add_argument('--kit', default='')
ap.add_argument('--only', default='')
ap.add_argument('--tier', type=int, default=2)
ap.add_argument('--samples', type=int, default=96)
ap.add_argument('--frames', default='', help='comma list of frame indices to render (default all)')
args = ap.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])

names = [n for n in args.only.split(',') if n] or [n for n, s in registry.SPRITES.items() if not args.kit or s['kit'] == args.kit]
out_root = Path(args.out).resolve()
SCRIPTS = sorted([HERE / 'build-chikun-obstacles.py', HERE / 'chikun_lib/shading.py'] + list((HERE / 'obstacles').glob('*.py')))
script_hashes = {p.relative_to(HERE.parents[1]).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest() for p in SCRIPTS}

for name in names:
    spec = registry.SPRITES[name]
    t0 = time.time()
    scene = rig.reset()
    mats._CACHE.clear()  # materials die with the reset scene
    rig.set_pitch(spec.get('pitch', 19.0))
    shading.HAZE['far'] = 0.0
    rig.lights(scene, **spec.get('lights', {}) if isinstance(spec.get('lights'), dict) else {})
    coll = rig.collection(scene)
    ctx = dict(scene=scene, coll=coll, spec=spec, tier=args.tier)
    built = spec['build'](ctx)
    pose = None
    if isinstance(built, dict):
        pose = built.get('pose')
    rig.camera(scene, spec['frame'], args.tier, spec['samples'] or args.samples)
    out = out_root / spec['kit'] / name
    out.mkdir(parents=True, exist_ok=True)
    frames = range(spec['frames'])
    if args.frames:
        frames = [int(f) for f in args.frames.split(',') if f]
    for i in frames:
        if pose: pose(i)
        bpy.context.view_layer.update()
        shading.set_emit_only(False)
        rig.render(scene, out / f'f{i:02d}.png')
        if spec['emit']:
            world = scene.world
            strength = world.node_tree.nodes['Background'].inputs['Strength'].default_value
            world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.0
            lamps = [o for o in scene.objects if o.type == 'LIGHT' and not o.hide_render]
            for o in lamps: o.hide_render = True
            shading.set_emit_only(True)
            rig.render(scene, out / f'f{i:02d}-emit.png')
            for o in lamps: o.hide_render = False
            world.node_tree.nodes['Background'].inputs['Strength'].default_value = strength
            shading.set_emit_only(False)
    meta = dict(name=name, kit=spec['kit'], kind=spec['kind'], anchor=spec['anchor'], frame=list(spec['frame']), frames=spec['frames'], fps=spec['fps'],
                emit=spec['emit'], tier=args.tier, samples=scene.cycles.samples, blender=bpy.app.version_string, device=scene.cycles.device,
                renderSeconds=round(time.time() - t0, 2), scripts=script_hashes, note=spec['note'])
    (out / 'meta.json').write_text(json.dumps(meta, indent=1) + '\n', encoding='utf8')
    print('OBSTACLE_DONE', name, meta['renderSeconds'], flush=True)
