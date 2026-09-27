"""Scene, camera, light and render helpers shared by every Chikun scenery build.

One Blender unit is one logical canvas pixel at the layer's own scale, so the
strip cameras are pixel-exact: the render is (width + 2 * margin) * tier wide
and the layer's baseline row lands exactly on the spec's baseline.
"""
import bpy, json, math, sys, argparse, hashlib, os
from pathlib import Path

PITCH_DEG = 19.0  # the character rig's camera pitch
ROOT = Path(__file__).resolve().parents[3]
SPEC_PATH = ROOT / 'scripts/chikun-blender/scenery-spec.json'


def load_spec():
    return json.loads(SPEC_PATH.read_text(encoding='utf8'))


def layer_spec(spec, region, layer):
    base = dict(spec['layers'][layer])
    base.update(spec['regions'].get(region, {}).get(layer, {}))
    base['baseline'] = spec['horizonY'] + (spec['runY'] - spec['horizonY']) * base['rate'] if layer != 'front' else spec['runY']
    return base


def parse_args(extra=None):
    p = argparse.ArgumentParser()
    p.add_argument('--region', required=True)
    p.add_argument('--layer', required=True)
    p.add_argument('--out', required=True)
    p.add_argument('--tier', type=int, default=2)
    p.add_argument('--samples', type=int, default=64)
    p.add_argument('--preview', action='store_true')
    if extra: extra(p)
    return p.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = 'NONE'
    return scene


def setup_render(scene, width, height, engine='EEVEE', samples=64, transparent=True):
    r = scene.render
    r.resolution_x, r.resolution_y, r.resolution_percentage = int(width), int(height), 100
    r.film_transparent = transparent
    r.image_settings.file_format = 'PNG'
    r.image_settings.color_mode = 'RGBA'
    r.image_settings.color_depth = '8'
    r.dither_intensity = 1.0  # Blender dithers the float render into 8 bits
    r.filter_size = 1.5
    r.use_persistent_data = False
    if engine == 'CYCLES':
        r.engine = 'CYCLES'
        scene.cycles.samples = samples
        scene.cycles.seed = 7
        scene.cycles.use_denoising = True
        scene.cycles.denoiser = 'OPENIMAGEDENOISE'
        scene.cycles.transparent_max_bounces = 12
        try:
            prefs = bpy.context.preferences.addons['cycles'].preferences
            prefs.compute_device_type = 'CUDA'; prefs.get_devices()
            for d in prefs.devices: d.use = True
            scene.cycles.device = 'GPU'
        except Exception:
            scene.cycles.device = 'CPU'
    else:
        r.engine = 'BLENDER_EEVEE'
        e = scene.eevee
        e.taa_render_samples = samples
        e.use_raytracing = os.environ.get("CHIKUN_RT", "1") == "1"
        e.use_shadows = True
        e.shadow_ray_count = 2
        e.shadow_step_count = 8
        e.use_fast_gi = os.environ.get("CHIKUN_GI", "1") == "1"
        e.fast_gi_distance = 40.0
        e.fast_gi_method = 'GLOBAL_ILLUMINATION'
        e.shadow_resolution_scale = 1.0
    vs = scene.view_settings
    vs.view_transform = 'Standard'
    vs.look = 'Medium High Contrast'
    vs.exposure = 0.0
    vs.gamma = 1.0
    scene.display_settings.display_device = 'sRGB'
    return scene


def _camera(scene, name, kind):
    cam = bpy.data.cameras.new(name)
    cam.type = kind
    cam.clip_start = 1.0
    cam.clip_end = 400000.0
    obj = bpy.data.objects.new(name, cam)
    scene.collection.objects.link(obj)
    scene.camera = obj
    return obj


def strip_camera(scene, ls, spec, tier):
    """Orthographic camera pitched 19 degrees down (or the layer's `pitch`), yaw 0.
    World (x, 0, 0) with 0 <= x < width lands on the layer baseline row, column
    margin + x. Sea layers use pitch 0 so everything stands on the horizon."""
    m = spec['marginPx']
    W, H, T, B = ls['width'], ls['height'], ls['top'], ls['baseline']
    obj = _camera(scene, 'StripCamera', 'ORTHO')
    obj.data.ortho_scale = W + 2 * m
    obj.data.sensor_fit = 'HORIZONTAL'
    th = math.radians(90 - ls.get('pitch', PITCH_DEG))
    obj.rotation_euler = (th, 0, 0)
    up_y, up_z = math.cos(th), math.sin(th)
    cy = -4000.0
    cz = (B - T - H / 2 - cy * up_y) / up_z
    obj.location = (W / 2, cy, cz)
    setup_render(scene, (W + 2 * m) * tier, H * tier)
    return obj


def ground_camera(scene, spec, tier, top=556, bottom=692, focal=2000.0):
    """Perspective camera that realises the parallax model exactly: the horizon at
    spec.horizonY, a ground point at depth y scrolls at rate focal / y and sits
    130 * rate below the horizon (camera height = runY - horizonY)."""
    m = spec['marginPx']; W = spec['ground']['period']
    width, height = W + 2 * m, bottom - top
    obj = _camera(scene, 'GroundCamera', 'PERSP')
    obj.data.sensor_fit = 'HORIZONTAL'
    obj.data.sensor_width = 36.0
    obj.data.lens = focal * 36.0 / width
    obj.data.shift_y = -((height / 2) - (spec['horizonY'] - top)) / width
    obj.rotation_euler = (math.radians(90), 0, 0)
    obj.location = (W / 2, 0.0, spec['runY'] - spec['horizonY'])
    setup_render(scene, width * tier, height * tier)
    return obj, dict(top=top, bottom=bottom, focal=focal, width=width, height=height)


def front_camera(scene, ls, spec, tier):
    """Level orthographic camera looking at the ground's cut face. World z = 0 is
    the running line (runY)."""
    m = spec['marginPx']; W, H, T = ls['width'], ls['height'], ls['top']
    obj = _camera(scene, 'FrontCamera', 'ORTHO')
    obj.data.ortho_scale = W + 2 * m
    obj.data.sensor_fit = 'HORIZONTAL'
    obj.rotation_euler = (math.radians(90), 0, 0)
    obj.location = (W / 2, -4000.0, -((H / 2) - (spec['runY'] - T)))
    setup_render(scene, (W + 2 * m) * tier, H * tier)
    return obj


def sun(scene, strength=3.2, azimuth=-35.0, elevation=40.0, angle=3.0, color=(1.0, 0.985, 0.95), name='Key'):
    """Key light from the upper-left front: cast shadows fall right, onto the
    trailing side, so leading edges stay clean."""
    light = bpy.data.lights.new(name, 'SUN')
    light.energy = strength
    light.angle = math.radians(angle)
    light.color = color
    obj = bpy.data.objects.new(name, light)
    scene.collection.objects.link(obj)
    obj.rotation_euler = (math.radians(90 - elevation), 0, math.radians(azimuth))
    return obj


def world(scene, color=(0.62, 0.72, 0.9), strength=0.35):
    w = bpy.data.worlds.new('ChikunWorld')
    scene.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (*color, 1)
    bg.inputs['Strength'].default_value = strength
    return w


def collection(scene, name, parent=None):
    c = bpy.data.collections.new(name)
    (parent or scene.collection).children.link(c)
    return c


def tile_instances(scene, coll, period, copies=(-1, 1)):
    """Instance a tile collection at +-period so the render wraps without a seam."""
    out = []
    for k in copies:
        e = bpy.data.objects.new(f'{coll.name}@{k}', None)
        e.instance_type = 'COLLECTION'
        e.instance_collection = coll
        e.location = (k * period, 0, 0)
        scene.collection.objects.link(e)
        out.append(e)
    return out


def render(scene, path):
    path = Path(path); path.parent.mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    return path


def script_hashes(*paths):
    out = {}
    for p in paths:
        p = Path(p)
        out[p.relative_to(ROOT).as_posix()] = hashlib.sha256(p.read_bytes()).hexdigest()
    return out


def write_json(path, data):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(data, indent=2) + '\n', encoding='utf8')
