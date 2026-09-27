"""Render one Chikun scenery layer for one region, headless and reproducible.

"D:/Apps/Blender/blender.exe" -b --factory-startup --python-exit-code 1 \
    -P scripts/chikun-blender/build-chikun-scenery.py -- \
    --region farmland --layer mid --out ../chikun-render-cache [--tier 2] [--samples 64]

Layers: far, mid, near (orthographic strips, 19 degree pitch like the character
rig), ground (a perspective render whose rows the packer cuts into per-rate
bands) and front (the running line's cut face). Each run writes
OUT/<region>/<layer>.png (8-bit dithered RGBA lit albedo), OUT/<region>/<layer>-emit.png
(emission-only pass, when the layer has lights) and OUT/<region>/<layer>.json.
The render cache lives outside the repository; the packer turns it into the
shipped WebP assets and records the script hashes for provenance.
"""
import bpy, sys, importlib, time, json
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from chikun_lib import core, shading  # noqa: E402

args = core.parse_args()
spec = core.load_spec()
region_mod = importlib.import_module('regions.' + args.region)
scene = core.reset()
layer = args.layer
out_dir = Path(args.out).resolve() / args.region
out_dir.mkdir(parents=True, exist_ok=True)

meta = dict(region=args.region, layer=layer, tier=args.tier, blender=bpy.app.version_string, samples=args.samples)
if layer == 'ground':
    cam, info = core.ground_camera(scene, spec, args.tier)
    meta['camera'] = info
elif layer == 'front':
    ls = core.layer_spec(spec, args.region, layer)
    core.front_camera(scene, ls, spec, args.tier)
    meta['layer'] = ls
else:
    ls = core.layer_spec(spec, args.region, layer)
    core.strip_camera(scene, ls, spec, args.tier)
    meta['layer'] = ls
scene.eevee.taa_render_samples = args.samples

ctx = dict(scene=scene, spec=spec, tier=args.tier, layer=layer, region=args.region)
built = region_mod.build(layer, ctx) or {}
meta.update({k: v for k, v in built.items() if k not in ('emissive', 'sprites', 'anchors')})

t = time.time()
# Animated landmark parts (e.g. the windmill sails) render as separate sprites.
sprites = built.get('sprites', [])
sprite_names = {n for sp in sprites for n in sp['objects']}
for o in scene.objects:
    if o.name in sprite_names: o.hide_render = True
shading.set_emit_only(False)
core.render(scene, out_dir / f'{layer}.png')
if built.get('emissive'):
    world = scene.world
    strength = world.node_tree.nodes['Background'].inputs['Strength'].default_value
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.0
    hidden = [o for o in scene.objects if o.type == 'LIGHT' and not o.hide_render]
    for o in hidden: o.hide_render = True
    shading.set_emit_only(True)
    scene.eevee.use_raytracing = False
    core.render(scene, out_dir / f'{layer}-emit.png')
    for o in hidden: o.hide_render = False
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = strength
    shading.set_emit_only(False)
    scene.eevee.use_raytracing = core.os.environ.get('CHIKUN_RT', '1') == '1'
    meta['emissive'] = True
if sprites:
    from bpy_extras.object_utils import world_to_camera_view
    from mathutils import Vector
    saved = {o.name: o.hide_render for o in scene.objects}
    meta['sprites'] = []
    for sp in sprites:
        for o in scene.objects:
            if o.type in ('LIGHT', 'CAMERA'): continue
            o.hide_render = o.name not in sp['objects']
        core.render(scene, out_dir / f"{layer}-sprite-{sp['id']}.png")
        uv = world_to_camera_view(scene, scene.camera, Vector(sp['pivot']))
        rx, ry = scene.render.resolution_x, scene.render.resolution_y
        meta['sprites'].append(dict(id=sp['id'], pivotPx=[uv.x * rx, (1 - uv.y) * ry], motion=sp.get('motion', 'spin'), speed=sp.get('speed', 0.25)))
    for o in scene.objects: o.hide_render = saved[o.name]
if built.get('anchors'):
    # Screen positions of runtime effects (the lighthouse beam) in render pixels.
    from bpy_extras.object_utils import world_to_camera_view
    from mathutils import Vector
    rx, ry = scene.render.resolution_x, scene.render.resolution_y
    meta['anchors'] = []
    for an in built['anchors']:
        uv = world_to_camera_view(scene, scene.camera, Vector(an['at']))
        meta['anchors'].append(dict(id=an['id'], kind=an.get('kind', an['id']), pivotPx=[uv.x * rx, (1 - uv.y) * ry]))
meta['renderSeconds'] = round(time.time() - t, 2)
meta['scripts'] = core.script_hashes(Path(__file__), HERE / 'chikun_lib/core.py', HERE / 'chikun_lib/shading.py', HERE / 'chikun_lib/kit.py', HERE / 'chikun_lib/periodic.py', HERE / f'regions/{args.region}.py', HERE / 'regions/common.py', HERE / 'regions/groundkit.py', HERE / 'regions/urbankit.py', core.SPEC_PATH)
core.write_json(out_dir / f'{layer}.json', meta)
print('SCENERY_DONE', args.region, layer, meta['renderSeconds'], flush=True)
