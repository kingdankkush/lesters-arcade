"""Parametric upright arcade cabinet kit and 16-frame turntable. Blender 5.1.

Run through scripts/run-arcade-cabinets.py (render stage), or directly:
  blender -b --factory-startup --python scripts/hmh-blender/build-arcade-cabinets.py -- \
    --game hard-money-heroes --textures assets-source/arcade-cabinets-3d/hard-money-heroes \
    --out <dir> [--frames 16 --width 384 --height 420]

One kit for every cabinet: a classic upright whose stepped side profile was
measured from the owner's HMH reference (marquee box, recessed angled screen,
control deck with a vertical control-panel front, recessed kick panel). The body
is the profile extruded between two side slabs; the slabs' edge faces are the
T-moulding in each game's colours. Flat panel art is applied as image textures:
marquee and screen are emissive (back-lit marquee, glowing CRT), side art is
projected onto the outer slab faces by the side view's bounding box.

Writes frame-00.png .. frame-15.png (RGBA, transparent film), poster.png and
render.json (settings plus sha256 of every texture and this script).
Presentation only; nothing here touches gameplay.
"""
import bpy, bmesh, math, json, hashlib, sys, argparse
from pathlib import Path
from mathutils import Vector, Matrix
from bpy_extras.object_utils import world_to_camera_view

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
parser = argparse.ArgumentParser()
parser.add_argument('--game', required=True)
parser.add_argument('--textures', required=True)
parser.add_argument('--out', required=True)
parser.add_argument('--frames', type=int, default=16)
parser.add_argument('--width', type=int, default=384)
parser.add_argument('--height', type=int, default=420)
parser.add_argument('--samples', type=int, default=96)
parser.add_argument('--poster-frame', type=int, default=2)
parser.add_argument('--build-only', action='store_true', help='build and fit the camera, then stop (no render)')
args = parser.parse_args(argv)
TEX = Path(args.textures).resolve()
OUT = Path(args.out).resolve()
OUT.mkdir(parents=True, exist_ok=True)

# --- Per-game dressing ------------------------------------------------------
# trimFront runs along the front profile of each side (the stepped edge you see
# from the front); trimTop covers the roof and back edges. HMH follows the
# reference: blue on the player's left, gold on the right.
GAME = {
    'hard-money-heroes': {
        'trim': {'left': ((0.05, 0.22, 0.95), (0.95, 0.66, 0.12)), 'right': ((0.95, 0.66, 0.12), (0.05, 0.22, 0.95))},
        'trimMetal': 0.55, 'trimGlow': 0.0,
        'sticks': [(0.125, (0.85, 0.04, 0.03)), (0.62, (0.85, 0.04, 0.03))],
        'screenGlow': 1.35, 'marqueeGlow': 1.15,
    },
    'chikun': {
        'trim': {'left': ((0.80, 0.06, 0.07), (0.93, 0.86, 0.70)), 'right': ((0.80, 0.06, 0.07), (0.93, 0.86, 0.70))},
        'trimMetal': 0.1, 'trimGlow': 0.0,
        'sticks': [(0.12, (0.85, 0.04, 0.03))],
        'screenGlow': 1.35, 'marqueeGlow': 1.15,
    },
    'stacked': {
        'trim': {'left': ((0.05, 0.85, 1.0), (1.0, 0.12, 0.78)), 'right': ((0.05, 0.85, 1.0), (1.0, 0.12, 0.78))},
        'trimMetal': 0.2, 'trimGlow': 2.2,
        'sticks': [(0.215, (0.05, 0.55, 1.0))],
        'screenGlow': 1.45, 'marqueeGlow': 1.25,
    },
}[args.game]

# --- Kit dimensions (metres) -----------------------------------------------
H = 1.80                 # overall height
D = 0.987                # depth (305/556 of height on the HMH side view)
W = 1.34                 # width (398/534 of height on the HMH front view)
T = 0.045                # side slab thickness, the T-moulding width
WC = W - 2 * T           # body width between the slabs
# Side profile as (depth fraction from the front, height fraction), measured on
# the HMH right-side view (bounding box 1078,9 - 1385,565 of the reference).
PROFILE = [
    (0.295, 0.996),  # 0 roof, front
    (1.000, 0.888),  # 1 roof, back
    (1.000, 0.000),  # 2 floor, back
    (0.085, 0.000),  # 3 floor, front (kick)
    (0.085, 0.288),  # 4 kick top
    (0.007, 0.317),  # 5 control-panel front, bottom
    (0.000, 0.410),  # 6 control-panel front, top
    (0.039, 0.428),  # 7 deck front
    (0.223, 0.522),  # 8 deck back / screen bottom
    (0.334, 0.773),  # 9 screen top
    (0.213, 0.838),  # 10 marquee bottom
    (0.275, 0.986),  # 11 marquee top
]
# Edge i joins PROFILE[i] -> PROFILE[i+1]. Body faces per edge:
BODY_EDGE = ['dark', 'back', 'dark', 'kick', 'dark', 'control-front', 'dark', 'deck', 'screen', 'underside', 'marquee', 'dark']
FRONT_EDGES = {3, 4, 5, 6, 7, 8, 9, 10, 11}

def P(u, v):
    """Profile fraction -> (y, z). The front faces -Y; the pivot is the footprint centre."""
    return (-D / 2 + u * D, v * H)

# --- Scene -----------------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = args.samples
scene.cycles.seed = 0
scene.cycles.use_animated_seed = False
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 6
scene.render.resolution_x = args.width
scene.render.resolution_y = args.height
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.image_settings.color_depth = '8'
scene.render.dither_intensity = 0
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'
world = bpy.data.worlds.new('Studio')
scene.world = world
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.06, 0.06, 0.075, 1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.0

def principled(name, color=(0.02, 0.02, 0.025), rough=0.5, metal=0.0, image=None, glow=0.0, glow_color=None, spec=0.3):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nodes, links = m.node_tree.nodes, m.node_tree.links
    bsdf = nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    # Low specular keeps the large studio key from washing printed art to white.
    bsdf.inputs['Specular IOR Level'].default_value = spec
    if image:
        tex = nodes.new('ShaderNodeTexImage')
        tex.image = bpy.data.images.load(str(image), check_existing=True)
        tex.interpolation = 'Cubic'
        tex.extension = 'EXTEND'
        links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
        if glow:
            links.new(tex.outputs['Color'], bsdf.inputs['Emission Color'])
    else:
        bsdf.inputs['Base Color'].default_value = (*color, 1)
        if glow:
            bsdf.inputs['Emission Color'].default_value = (*(glow_color or color), 1)
    bsdf.inputs['Emission Strength'].default_value = glow
    return m

texture = lambda name: TEX / f'panel-{name}.webp'
MAT = {
    'dark': principled('Cabinet laminate', (0.018, 0.017, 0.022), 0.62, spec=0.25),
    'underside': principled('Marquee underside', (0.03, 0.03, 0.04), 0.6),
    'marquee': principled('Back-lit marquee', image=texture('marquee'), rough=0.5, glow=GAME['marqueeGlow'], spec=0.08),
    'screen': principled('CRT screen', image=texture('screen'), rough=0.5, glow=GAME['screenGlow'], spec=0.05),
    'deck': principled('Control deck', image=texture('deck'), rough=0.55, spec=0.1),
    'control-front': principled('Control panel front', image=texture('control-front'), rough=0.5, spec=0.2),
    'kick': principled('Kick panel', image=texture('kick'), rough=0.55, spec=0.2),
    'back': principled('Back panel', image=texture('back'), rough=0.65, spec=0.2),
    'side-left': principled('Left side art', image=texture('side-left'), rough=0.5, spec=0.22),
    'side-right': principled('Right side art', image=texture('side-right'), rough=0.5, spec=0.22),
}
def trim_material(name, color):
    return principled(name, color, rough=0.28, metal=GAME['trimMetal'], glow=GAME['trimGlow'], glow_color=color)

root = bpy.data.objects.new('Cabinet turntable', None)
scene.collection.objects.link(root)

def new_object(name, bm, materials):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    for m in materials:
        mesh.materials.append(m)
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    obj.parent = root
    for poly in mesh.polygons:
        poly.use_smooth = False
    return obj

# --- Body: the profile extruded between the slabs ---------------------------
def body():
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    order = ['dark', 'underside', 'marquee', 'screen', 'deck', 'control-front', 'kick', 'back']
    pts = []
    for u, v in PROFILE:
        # Recess the body behind the slab edges so the moulding stands proud.
        if u < 1:
            u = u + 0.03 * (1 - u)
        if v > 0.85:
            v = v - 0.006
        pts.append(P(u, v))
    xl, xr = -WC / 2, WC / 2
    for i, kind in enumerate(BODY_EDGE):
        (y0, z0), (y1, z1) = pts[i], pts[(i + 1) % len(pts)]
        verts = [bm.verts.new((xl, y0, z0)), bm.verts.new((xr, y0, z0)), bm.verts.new((xr, y1, z1)), bm.verts.new((xl, y1, z1))]
        face = bm.faces.new(verts)
        face.material_index = order.index(kind)
        # Texture v runs from the lower end of the face (0) to the higher end (1).
        upper = (y1, z1) if z1 >= z0 else (y0, z0)
        for loop in face.loops:
            x, y, z = loop.vert.co
            vv = 1.0 if abs(y - upper[0]) < 1e-6 and abs(z - upper[1]) < 1e-6 else 0.0
            uu = (x - xl) / WC
            if kind == 'back':
                uu = 1 - uu  # seen from behind
            loop[uv].uv = (uu, vv)
    # The profile runs clockwise seen from +X, so these quads already face outward.
    bm.normal_update()
    return new_object('Cabinet body', bm, [MAT[k] for k in order])

# --- Side slabs with T-moulding edges ---------------------------------------
def slab(side):
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    sign = 1 if side == 'right' else -1
    x_out, x_in = sign * W / 2, sign * WC / 2
    front, top = GAME['trim'][side]
    mats = [MAT[f'side-{side}'], MAT['dark'], trim_material(f'{side} moulding front', front), trim_material(f'{side} moulding roof', top)]
    outer = [bm.verts.new((x_out, *P(u, v))) for u, v in PROFILE]
    inner = [bm.verts.new((x_in, *P(u, v))) for u, v in PROFILE]
    cap_out = bm.faces.new(outer if side == 'right' else list(reversed(outer)))
    cap_out.material_index = 0
    for loop in cap_out.loops:
        _, y, z = loop.vert.co
        u = (y + D / 2) / D
        loop[uv].uv = (u if side == 'right' else 1 - u, z / H)
    cap_in = bm.faces.new(list(reversed(inner)) if side == 'right' else inner)
    cap_in.material_index = 1
    n = len(PROFILE)
    for i in range(n):
        j = (i + 1) % n
        quad = [outer[i], outer[j], inner[j], inner[i]]
        face = bm.faces.new(quad if side == 'left' else list(reversed(quad)))
        face.material_index = 2 if i in FRONT_EDGES else (1 if i == 2 else 3)
        for k, loop in enumerate(face.loops):
            loop[uv].uv = (k % 2, k // 2)
    bmesh.ops.triangulate(bm, faces=[cap_out, cap_in])
    bm.normal_update()
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    obj = new_object(f'{side} side panel', bm, mats)
    bevel = obj.modifiers.new('Rounded moulding', 'BEVEL')
    bevel.width = 0.012
    bevel.segments = 3
    bevel.limit_method = 'ANGLE'
    bevel.angle_limit = math.radians(25)
    bevel.harden_normals = False
    return obj

def joysticks():
    (y0, z0), (y1, z1) = P(*PROFILE[7]), P(*PROFILE[8])
    t = 0.32
    y, z = y0 + (y1 - y0) * t, z0 + (z1 - z0) * t
    for idx, (fraction, color) in enumerate(GAME['sticks']):
        x = -WC / 2 + fraction * WC
        ball_mat = principled(f'Joystick ball {idx}', color, rough=0.18)
        shaft_mat = principled(f'Joystick shaft {idx}', (0.55, 0.56, 0.6), rough=0.25, metal=0.9)
        bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.008, depth=0.075, location=(x, y + 0.02, z + 0.0375 + 0.01))
        shaft = bpy.context.object; shaft.parent = root; shaft.data.materials.append(shaft_mat)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=0.032, location=(x, y + 0.02, z + 0.085 + 0.01))
        ball = bpy.context.object; ball.parent = root; ball.data.materials.append(ball_mat)
        bpy.ops.object.shade_smooth()
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.03, depth=0.012, location=(x, y + 0.02, z + 0.012))
        dust = bpy.context.object; dust.parent = root; dust.data.materials.append(MAT['dark'])

body(); slab('left'); slab('right'); joysticks()

# --- Studio light rig: the art bible's upper-left key ------------------------
def area(name, location, energy, size, color=(1, 1, 1)):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy = energy; data.size = size; data.color = color; data.shape = 'DISK'
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (Vector((0, 0, H * 0.5)) - Vector(location)).to_track_quat('-Z', 'Y').to_euler()
area('Key upper-left', (-2.6, -3.0, 3.6), 900, 2.6)
area('Fill right', (3.0, -2.2, 1.5), 260, 3.0, (0.92, 0.95, 1.0))
area('Rim back', (1.6, 3.2, 3.0), 650, 2.0)
area('Rim back-left', (-2.4, 2.6, 2.2), 380, 2.0)

# --- Camera, auto-fitted over the whole turn ---------------------------------
cam_data = bpy.data.cameras.new('Turntable camera')
cam_data.lens = 70
cam_data.sensor_fit = 'VERTICAL'
cam = bpy.data.objects.new('Turntable camera', cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
ELEVATION = math.radians(9)
TARGET = Vector((0, 0, H * 0.5))

def place_camera(distance):
    cam.location = TARGET + Vector((0, -math.cos(ELEVATION), math.sin(ELEVATION))) * distance
    cam.rotation_euler = (TARGET - cam.location).to_track_quat('-Z', 'Y').to_euler()

def angle(frame):
    return -frame * 2 * math.pi / args.frames  # frame 1 turns the right side toward the camera

def projected_bounds():
    deps = bpy.context.evaluated_depsgraph_get()
    xs, ys = [], []
    for frame in range(args.frames):
        root.rotation_euler = (0, 0, angle(frame))
        bpy.context.view_layer.update()
        for obj in root.children:
            ev = obj.evaluated_get(deps)
            for v in ev.data.vertices:
                p = world_to_camera_view(scene, cam, ev.matrix_world @ v.co)
                xs.append(p.x); ys.append(p.y)
    root.rotation_euler = (0, 0, 0)
    return min(xs), max(xs), min(ys), max(ys)

distance = 6.0
cam_data.shift_x = cam_data.shift_y = 0
for _ in range(6):
    place_camera(distance)
    bpy.context.view_layer.update()
    x0, x1, y0, y1 = projected_bounds()
    need = max((x1 - x0) / 0.94, (y1 - y0) / 0.94)
    distance *= need
place_camera(distance)
bpy.context.view_layer.update()
x0, x1, y0, y1 = projected_bounds()
aspect = args.width / args.height
cam_data.shift_x = ((x0 + x1) / 2 - 0.5) * aspect  # shift is in units of the larger sensor side
cam_data.shift_y = ((y0 + y1) / 2 - 0.5)
if aspect > 1:
    cam_data.shift_x, cam_data.shift_y = (x0 + x1) / 2 - 0.5, ((y0 + y1) / 2 - 0.5) / aspect

# --- Render ------------------------------------------------------------------
if args.build_only:
    print('CABINET_BUILD_ONLY', args.game, round(distance, 4), [round(v, 4) for v in (x0, x1, y0, y1)])
    raise SystemExit(0)
for frame in range(args.frames):
    root.rotation_euler = (0, 0, angle(frame))
    scene.render.filepath = str(OUT / f'frame-{frame:02}.png')
    bpy.ops.render.render(write_still=True)
poster = OUT / 'poster.png'
poster.write_bytes((OUT / f'frame-{args.poster_frame:02}.png').read_bytes())

sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
meta = {
    'blender': bpy.app.version_string, 'engine': 'CYCLES', 'device': 'CPU', 'samples': args.samples, 'seed': 0,
    'denoiser': 'OpenImageDenoise', 'viewTransform': 'Standard', 'filmTransparent': True,
    'resolution': [args.width, args.height], 'frames': args.frames, 'posterFrame': args.poster_frame,
    'lens': cam_data.lens, 'elevationDegrees': 9, 'cameraDistance': round(distance, 4),
    'kitDimensionsMetres': {'height': H, 'depth': D, 'width': W, 'mouldingWidth': T},
    'textures': {p.name: sha(p) for p in sorted(TEX.glob('panel-*.webp'))},
    'kitSha256': sha(Path(__file__)),
}
(OUT / 'render.json').write_text(json.dumps(meta, indent=2) + '\n', newline='\n')
print('CABINET_RENDER_COMPLETE', args.game, json.dumps({'distance': meta['cameraDistance']}))
