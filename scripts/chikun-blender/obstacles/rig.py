"""Camera, light rig and render settings shared by every obstacle module.

Screen-space modelling: one Blender unit is one logical canvas pixel and the
orthographic camera is pitched 19 degrees down (the character rig's pitch) with
yaw 0, so a module can be built directly against its collision footprint.

A module works in LOCAL screen coordinates (sx, sy), y down, relative to its
anchor (the running line for grounded kinds, the obstacle's y for flyers, the
bottom edge for ceilings, the crown top for tree crowns). World <-> screen:

    sx = X,   sy = -(Y sin p + Z cos p)

so P(sx, sy, depth) is the world point on the plane Y = depth that lands on
screen point (sx, sy). A sphere of radius r projects to a circle of radius r;
a box of depth D and height H standing on the running line covers
D sin p + H cos p screen pixels.

Light: a neutral key sun from the upper left front (azimuth -35, elevation 40,
matching the scenery and Chikun's baked key), so cast light falls onto the
trailing (right) side; a cool world fill; a cool back rim that separates the
play layer from the backdrop. Colour: Standard view, Medium High Contrast look,
identical to the character rig. The runtime grade supplies the time of day.
"""
import bpy, math, os
from mathutils import Vector

PITCH = math.radians(19.0)
SP, CP = math.sin(PITCH), math.cos(PITCH)
VIEW = Vector((0.0, CP, -SP))     # camera forward
UP = Vector((0.0, SP, CP))        # camera up


def set_pitch(deg=19.0):
    """Camera pitch for the next module (default 19, the character rig's).
    Flyers high in the sky may use a shallower pitch so a wing seen from
    above does not hide the fuselage."""
    global PITCH, SP, CP, VIEW, UP
    PITCH = math.radians(deg)
    SP, CP = math.sin(PITCH), math.cos(PITCH)
    VIEW = Vector((0.0, CP, -SP))
    UP = Vector((0.0, SP, CP))


def P(sx, sy, depth=0.0):
    """World point on the plane Y = depth that projects to local screen (sx, sy)."""
    return Vector((sx, depth, (-sy - depth * SP) / CP))


def screen(v):
    return v.x, -(v.y * SP + v.z * CP)


def height_for(screen_h, depth):
    """World height of a box of the given depth whose silhouette covers screen_h."""
    return (screen_h - depth * SP) / CP


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = 'NONE'
    return scene


def setup_render(scene, width_px, height_px, samples=96, transparent=True):
    r = scene.render
    r.resolution_x, r.resolution_y, r.resolution_percentage = int(width_px), int(height_px), 100
    r.film_transparent = transparent
    r.image_settings.file_format = 'PNG'
    r.image_settings.color_mode = 'RGBA'
    r.image_settings.color_depth = '16'
    r.filter_size = 1.2
    r.engine = 'CYCLES'
    c = scene.cycles
    c.samples = samples
    c.use_adaptive_sampling = True
    c.adaptive_threshold = 0.01
    c.seed = 7
    c.use_denoising = True
    c.denoiser = 'OPENIMAGEDENOISE'
    c.denoising_input_passes = 'RGB_ALBEDO_NORMAL'
    c.transparent_max_bounces = 16
    c.max_bounces = 6
    c.diffuse_bounces = 3
    c.glossy_bounces = 3
    c.transmission_bounces = 6
    c.volume_bounces = 1
    c.caustics_reflective = False
    c.caustics_refractive = False
    c.use_camera_cull = False
    device = os.environ.get('CHIKUN_DEVICE', 'OPTIX')
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        prefs.compute_device_type = device
        prefs.get_devices()
        for d in prefs.devices:
            d.use = d.type == device
        c.device = 'GPU' if any(d.use for d in prefs.devices) else 'CPU'
    except Exception:
        c.device = 'CPU'
    vs = scene.view_settings
    vs.view_transform = 'Standard'
    vs.look = 'Medium High Contrast'
    vs.exposure = 0.0
    vs.gamma = 1.0
    scene.display_settings.display_device = 'sRGB'
    return scene


def camera(scene, frame, tier=2, samples=96):
    """Pixel-exact orthographic camera over the local screen rect frame = (x, y, w, h)."""
    fx, fy, fw, fh = frame
    cam = bpy.data.cameras.new('ObstacleCam')
    cam.type = 'ORTHO'
    cam.ortho_scale = fw
    cam.sensor_fit = 'HORIZONTAL'
    cam.clip_start = 1.0
    cam.clip_end = 20000.0
    obj = bpy.data.objects.new('ObstacleCam', cam)
    scene.collection.objects.link(obj)
    scene.camera = obj
    obj.rotation_euler = (math.pi / 2 - PITCH, 0.0, 0.0)
    obj.location = P(fx + fw / 2, fy + fh / 2, 0.0) - VIEW * 4000.0
    setup_render(scene, round(fw * tier), round(fh * tier), samples)
    return obj


def sun(scene, name, strength, azimuth, elevation, angle=3.0, color=(1.0, 0.975, 0.94)):
    light = bpy.data.lights.new(name, 'SUN')
    light.energy = strength
    light.angle = math.radians(angle)
    light.color = color
    obj = bpy.data.objects.new(name, light)
    scene.collection.objects.link(obj)
    obj.rotation_euler = (math.radians(90 - elevation), 0.0, math.radians(azimuth))
    return obj


def lights(scene, key=3.6, fill=0.42, rim=1.6, fill_color=(0.58, 0.68, 0.88), bounce=0.35):
    """Key from the upper left front, cool fill, cool back rim, warm ground bounce."""
    sun(scene, 'Key', key, -35.0, 40.0, 3.0)
    if rim > 0:
        sun(scene, 'Rim', rim, 158.0, 24.0, 6.0, (0.80, 0.88, 1.0))
    if bounce > 0:
        # Light reflected up off the ground (warm, soft), so undersides are not black.
        b = sun(scene, 'Bounce', bounce, 20.0, -35.0, 30.0, (1.0, 0.9, 0.78))
    # Sky-over-ground environment: a cool sky above, a warm dim ground below,
    # so metals and gloss reflect a plausible world instead of a flat colour.
    w = bpy.data.worlds.new('ObstacleWorld')
    scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    bg = nt.nodes['Background']
    bg.inputs['Strength'].default_value = fill
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['Generated'], sep.inputs[0])
    mr = nt.nodes.new('ShaderNodeMapRange')
    mr.inputs[1].default_value = -0.25; mr.inputs[2].default_value = 0.7
    nt.links.new(sep.outputs[2], mr.inputs[0])
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    cr = ramp.color_ramp
    cr.elements[0].position = 0.0; cr.elements[0].color = (0.16, 0.13, 0.10, 1.0)
    cr.elements[1].position = 0.32; cr.elements[1].color = (0.62, 0.64, 0.66, 1.0)
    e = cr.elements.new(1.0); e.color = (*fill_color, 1.0)
    nt.links.new(mr.outputs[0], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], bg.inputs['Color'])
    return w


def collection(scene, name='module'):
    c = bpy.data.collections.new(name)
    scene.collection.children.link(c)
    return c


def render(scene, path):
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    return path
