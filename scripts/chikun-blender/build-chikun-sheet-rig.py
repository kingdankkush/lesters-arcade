"""Bring the native Chikun rig to the 2026-09-16 character sheet and author every clip.

"D:/Apps/Blender/blender.exe" -b apps/chikun/assets/source/Chikun-Ground-Sky-Rig.blend --python-exit-code 1 \
    -P scripts/chikun-blender/build-chikun-sheet-rig.py -- --out ../chikun-sheet [--preview] [--no-render]

Always starts from the git-tracked Chikun-Ground-Sky-Rig.blend (owner Tripo surface, 15-bone
rig, 31 authored actions) so the pass is deterministic and idempotent, and saves the result as
Chikun-Sheet-Rig.blend beside it. The pass:

* Model: regrades the vertex paint to the sheet (white feathers, crimson crest, mint eyes with
  dark pupils, orange beak, black shirt, red lapels / lining), paints an emissive mask so the
  eyes glow, and adds three expression bones (brow.L, brow.R, beak) to the existing skeleton.
  No mesh topology changes: 31,413 vertices / 62,830 triangles stay as the owner shipped them.
* Animation: re-authors the 21 flight and 10 ground actions with the same pose code as
  scripts/build-chikun-character.py and build-chikun-ground-motion.py, layers the sheet's
  expressions over them, and adds idle, steep_climb, steep_dive and five obstacle-family hits.
* Output: 256 px transparent Cycles frames per clip under OUT/frames, ragdoll part renders under
  OUT/ragdoll, OUT/character.json, the saved .blend and Chikun-Sheet-Animations.glb.
"""
import bpy, bmesh, math, json, sys, argparse, hashlib
from pathlib import Path
from mathutils import Vector, Euler, Matrix

p = argparse.ArgumentParser()
p.add_argument('--out', required=True)
p.add_argument('--preview', action='store_true', help='render one frame per clip')
p.add_argument('--no-render', action='store_true', help='model + animation pass only')
p.add_argument('--clips', default='', help='comma-separated clip names to render (default: all)')
a = p.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
out = Path(a.out).resolve(); out.mkdir(parents=True, exist_ok=True)
frames = out / 'frames'; frames.mkdir(exist_ok=True)
ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'apps/chikun/assets/source'
assert bpy.data.filepath.replace('\\', '/').endswith('Chikun-Ground-Sky-Rig.blend'), 'Run this on the tracked Chikun-Ground-Sky-Rig.blend'

rig = bpy.data.objects['Chikun_Flight_Rig']; mesh = bpy.data.objects['Chikun_Owner_Tripo_Surface']; scene = bpy.context.scene
me = mesh.data
source_vertices = len(me.vertices); source_triangles = len(me.polygons)

def smooth(a, b, x):
    t = max(0, min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t)

def srgb(hex_value):
    """Sheet swatch (sRGB hex) to scene-linear vertex paint."""
    channels = [int(hex_value[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in channels)

# ---------------------------------------------------------------- model pass: paint
SHEET = {
    'feather': srgb('#f4f1ea'), 'crest': srgb('#c8102e'), 'lining': srgb('#a60f26'), 'eye': srgb('#6ff5b0'),
    'pupil': srgb('#0b1412'), 'beak': srgb('#f28c28'), 'coat': srgb('#141416'), 'shirt': srgb('#0c0c0e'),
}
EYES = {'L': Vector((-.059, -.086, .762)), 'R': Vector((.060, -.085, .759))}
BEAK_HINGE = Vector((0, -.105, .706))

colors = me.color_attributes['Color']
glow = me.color_attributes.get('Glow') or me.color_attributes.new(name='Glow', type='FLOAT_COLOR', domain='POINT')
for entry in glow.data: entry.color = (0, 0, 0, 1)  # a new attribute defaults to white: only the eyes may emit
counts = {}
for v in me.vertices:
    x, y, z = v.co; r, g, b, _ = colors.data[v.index].color
    mx = max(r, g, b); mn = min(r, g, b); sat = (mx - mn) / mx if mx > 0 else 0
    region = 'keep'
    eye_dist = min((v.co - c).length for c in EYES.values())
    if z > .70 and y < -.04 and eye_dist < .052 and g > r * 1.3 and g > b * 1.3: region = 'eye'
    elif z > .70 and y < -.04 and eye_dist < .046 and mx < .06: region = 'pupil'
    elif r > g * 2.2 and r > b * 2.2 and mx > .12: region = 'crest' if z > .78 else 'lining'
    elif r > g * 1.4 and g > b * 2.5 and mx > .25 and z > .64 and y < -.09: region = 'beak'
    elif mx > .45 and sat < .45: region = 'feather'
    elif .40 < z < .62 and abs(x) < .08 and y < -.04 and .025 < mx < .45 and sat < .55 and not (r > g * 2.2): region = 'shirt'
    counts[region] = counts.get(region, 0) + 1
    if region == 'keep': continue
    if region == 'eye':
        # Keep the painted iris shading as brightness so the mint stays dimensional.
        k = .6 + .4 * min(1, g / .7)
        colors.data[v.index].color = (*[c * k for c in SHEET['eye']], 1)
        glow.data[v.index].color = (1, 1, 1, 1)
        continue
    if region == 'pupil':
        colors.data[v.index].color = (*SHEET['pupil'], 1); continue
    if region == 'feather':
        # White feathers with the source's own shading retained (cheeks, ruff, gloves).
        k = .72 + .28 * min(1, mx / .8)
        colors.data[v.index].color = (*[c * k for c in SHEET['feather']], 1); continue
    if region == 'lining':
        k = .55 + .45 * min(1, r / .3)
        colors.data[v.index].color = (*[c * k for c in SHEET['lining']], 1); continue
    colors.data[v.index].color = (*SHEET[region], 1)
print('PAINT_REGIONS', json.dumps(counts), flush=True)
assert counts.get('eye', 0) > 60 and counts.get('crest', 0) > 3000 and counts.get('beak', 0) > 150, counts

# Material: sheet paint as base colour, the eye mask as a mint emitter.
mat = me.materials[0]; mat.name = 'Chikun sheet paint'
nodes = mat.node_tree.nodes; links = mat.node_tree.links
bsdf = nodes['Principled BSDF']
bsdf.inputs['Roughness'].default_value = .52; bsdf.inputs['Specular IOR Level'].default_value = .3
glow_node = nodes.new('ShaderNodeVertexColor'); glow_node.layer_name = 'Glow'; glow_node.name = 'Glow mask'
mix = nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.name = 'Eye glow colour'
mix.inputs['A'].default_value = (0, 0, 0, 1); mix.inputs['B'].default_value = (*SHEET['eye'], 1)
links.new(glow_node.outputs['Color'], mix.inputs['Factor'])
links.new(mix.outputs['Result'], bsdf.inputs['Emission Color'])
bsdf.inputs['Emission Strength'].default_value = 1.0
mat.node_tree.animation_data_clear()

# ---------------------------------------------------------------- model pass: expression bones
bpy.context.view_layer.objects.active = rig; rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
edit = rig.data.edit_bones
for name, pos in [('brow.L', (-.058, -.078, .802)), ('brow.R', (.059, -.077, .800)), ('beak', tuple(BEAK_HINGE))]:
    if name in edit: continue
    b = edit.new(name); b.head = pos; b.tail = Vector(pos) + Vector((0, 0, .04)); b.parent = edit['head']
bpy.ops.object.mode_set(mode='OBJECT')
groups = {g.name: g for g in mesh.vertex_groups}
for name in ['brow.L', 'brow.R', 'beak']:
    groups.setdefault(name, mesh.vertex_groups.new(name=name))
head_group = groups['head']
def head_weight(v):
    for g in v.groups:
        if g.group == head_group.index: return g.weight
    return 0
brow_verts = {'L': 0, 'R': 0}; beak_verts = 0
for v in me.vertices:
    x, y, z = v.co
    if y > -.03 or z < .66: continue
    hw = head_weight(v)
    if hw <= 0: continue
    for side, eye in EYES.items():
        # A lens-shaped band above the eye: the ridge the sheet draws as a heavy angry brow.
        d = Vector(((x - eye.x) / .046, (y - eye.y + .01) / .05, (z - (eye.z + .043)) / .022)).length
        if d < 1:
            w = (1 - smooth(.45, 1, d)) * .85 * hw
            groups['brow.' + side].add([v.index], w, 'REPLACE'); head_group.add([v.index], hw - w, 'REPLACE'); brow_verts[side] += 1
    rgb = colors.data[v.index].color
    if z < BEAK_HINGE.z and y < BEAK_HINGE.y + .004 and rgb[0] > rgb[1] * 1.6 and rgb[0] > .5:
        w = smooth(0, .02, BEAK_HINGE.z - z) * .95 * hw
        groups['beak'].add([v.index], w, 'REPLACE'); head_group.add([v.index], hw - w, 'REPLACE'); beak_verts += 1
print('EXPRESSION_WEIGHTS', brow_verts, beak_verts, flush=True)
assert brow_verts['L'] > 20 and brow_verts['R'] > 20 and beak_verts > 40, (brow_verts, beak_verts)

# ---------------------------------------------------------------- animation
FLIGHT = ['ready', 'takeoff', 'cruise', 'accelerate', 'climb', 'crest', 'descend', 'dive', 'brake', 'recover', 'squeeze', 'dodge_high', 'dodge_low', 'collect', 'barrel_roll', 'impact', 'tumble', 'fall', 'reverse_roll', 'corkscrew', 'victory_twirl']
FLIGHT_NEW = ['steep_climb', 'steep_dive', 'hit_tree', 'hit_storm', 'hit_drone', 'hit_bird', 'hit_wall']
GROUND = ['walk', 'run', 'jump', 'hurdle_jump', 'high_jump', 'jump_flight', 'land', 'land_roll', 'land_slide', 'ground_impact']
GROUND_NEW = ['idle']
LOOPS = {'ready', 'cruise', 'climb', 'descend', 'dive', 'squeeze', 'walk', 'run', 'idle', 'steep_climb', 'steep_dive'}
# Expression per clip: stern (default), shouting, side_eye, surprised, gritted, smug.
EXPRESSION = {
    'hit_tree': 'shouting', 'hit_storm': 'shouting', 'hit_drone': 'shouting', 'hit_bird': 'shouting', 'hit_wall': 'shouting',
    'impact': 'shouting', 'ground_impact': 'shouting', 'tumble': 'surprised', 'fall': 'surprised',
    'dive': 'gritted', 'steep_dive': 'gritted', 'squeeze': 'gritted', 'high_jump': 'gritted', 'run': 'gritted',
    'dodge_high': 'surprised', 'dodge_low': 'surprised', 'takeoff': 'surprised', 'brake': 'surprised', 'jump_flight': 'surprised',
    'collect': 'smug', 'land': 'smug', 'land_roll': 'smug', 'land_slide': 'smug', 'victory_twirl': 'smug',
    'idle': 'side_eye', 'ready': 'side_eye',
}
GLOW = {'stern': 1.0, 'side_eye': 1.0, 'gritted': 1.4, 'smug': 1.2, 'surprised': 2.2, 'shouting': 2.6}

flight_basis = Matrix(((0, 0, 1), (1, 0, 0), (0, 1, 0))).to_quaternion()
upright = Euler((0, 0, math.pi / 2), 'XYZ').to_quaternion()

def reset():
    for b in rig.pose.bones:
        b.rotation_mode = 'QUATERNION'; b.rotation_quaternion = (1, 0, 0, 0); b.location = (0, 0, 0); b.scale = (1, 1, 1)

def rot(n, x=0, y=0, z=0):
    b = rig.pose.bones[n]; basis = b.bone.matrix_local.to_quaternion()
    b.rotation_quaternion = basis.conjugated() @ Euler((x, y, z), 'XYZ').to_quaternion() @ basis

def orient(world):
    root = rig.pose.bones['root']; basis = root.bone.matrix_local.to_quaternion()
    root.rotation_quaternion = basis.conjugated() @ world @ basis

def flight_pose(name, t):
    """Verbatim prone-flight authoring from scripts/build-chikun-character.py plus the new flight clips."""
    reset()
    wave = math.sin(t * math.tau); wave2 = math.sin(t * math.tau + .8); pulse = math.sin(math.pi * t) ** 2
    ease = t * t * (3 - 2 * t)
    pitch = .015; bank = .025 * wave; extension = 1; leg = .025; head = -1.18; spread = .035; recoil = 0
    push = Vector((0, 0, 0)); squash = 1; jitter = 0; crest_up = 0
    if name == 'ready': pitch = .16; extension = .90; leg = .12; bank = .035 * wave
    elif name == 'takeoff': pitch = .16 * (1 - ease); extension = .90 + .10 * ease; leg = .12 * (1 - ease)
    elif name == 'accelerate': pitch = .045 * pulse; extension = 1 + .045 * pulse; bank = -.065 * pulse
    elif name == 'climb': pitch = .19 + .01 * wave; bank = -.045
    elif name == 'crest': pitch = .12 * (1 - ease); bank = -.025 * (1 - ease)
    elif name == 'descend': pitch = -.12 + .009 * wave; bank = .025
    elif name == 'dive': pitch = -.25 + .01 * wave; extension = 1.025
    elif name == 'brake': pitch = .11 * pulse; extension = 1 - .12 * pulse; leg = .28 * pulse; spread = .05
    elif name == 'recover': pitch = .11 * (1 - ease); extension = .88 + .12 * ease; leg = .28 * (1 - ease)
    elif name == 'squeeze': spread = .006; extension = 1.035; bank = -.06 + .01 * wave
    elif name == 'dodge_high': pitch = -.12 * pulse; bank = .17 * pulse; extension = 1 - .06 * pulse; leg = .09 * pulse
    elif name == 'dodge_low': pitch = .16 * pulse; bank = -.16 * pulse; extension = 1 + .02 * pulse; leg = .09 * pulse
    elif name == 'collect': bank = -.075 * pulse; head = -1.18 - .04 * pulse; extension = 1 + .03 * pulse
    elif name == 'barrel_roll': bank = math.tau * ease; pitch = .015
    elif name == 'reverse_roll': bank = -math.tau * ease; pitch = .015 + .06 * pulse; leg = .025 + .14 * pulse
    elif name == 'corkscrew': bank = math.tau * ease; pitch = .015 + .12 * math.sin(math.tau * t) * pulse; extension = 1 - .09 * pulse; leg = .025 + .22 * pulse
    elif name == 'victory_twirl': bank = -math.tau * ease; pitch = .015 + .12 * pulse; extension = 1 - .14 * pulse; spread = .035 + .13 * pulse; leg = .025 + .30 * pulse
    elif name == 'impact': pitch = .12 * pulse; bank = -.22 * pulse; recoil = .30 * pulse; extension = 1 - .25 * pulse; leg = .38 * pulse; head = -1.18 + .25 * pulse
    elif name == 'tumble': bank = -.22 + math.tau * ease; pitch = -.12 - .38 * ease; extension = .75 - .12 * pulse; leg = .38; head = -.93
    elif name == 'fall': bank = .55; pitch = -.65; extension = .65; leg = .26; head = -.82
    # --- sheet additions -------------------------------------------------------------
    elif name == 'steep_climb':
        # Nose high, arms locked ahead, legs trailing: the pull-up after a hard flap.
        pitch = .64 + .012 * wave; bank = -.05 + .015 * wave2; extension = 1.05; leg = .06; head = -1.3; spread = .02
    elif name == 'steep_dive':
        # Arms swept back along the coat, chin tucked: a streamlined plunge with gritted teeth.
        pitch = -.68 + .01 * wave; bank = .03 * wave; extension = .12; spread = .02; leg = .01; head = -.98; crest_up = .18
    elif name == 'hit_tree':
        # Face-first into foliage: instant crumple, arms shielding the face, shoved back, then sag.
        hit = smooth(0, .16, t); sag = smooth(.3, 1, t)
        pitch = .34 * hit - .3 * sag; bank = -.28 * hit; recoil = .42 * hit * (1 - .5 * sag); extension = 1 - .62 * hit; leg = .44 * hit + .1 * sag
        head = -1.18 + .5 * hit; spread = .28 * hit; push = Vector((-.045 * hit - .01 * sag, .02 * hit - .08 * sag, 0)); crest_up = -.3 * hit
    elif name == 'hit_storm':
        # Electrocuted: rigid star pose, crest on end, whole body buzzing at 15 Hz before it drops.
        hit = smooth(0, .12, t); drop = smooth(.62, 1, t); buzz = math.sin(t * 15 * math.tau) * hit * (1 - drop)
        pitch = .05 + .08 * buzz; bank = .06 * math.sin(t * 15 * math.tau + 1) * hit * (1 - drop) - .35 * drop; extension = 1.18 * hit * (1 - drop) + .6 * drop
        spread = .55 * hit * (1 - drop) + .1; leg = .5 * hit * (1 - drop) + .3 * drop; head = -1.18 + .15 * buzz - .25 * drop; jitter = buzz; crest_up = -.55 * hit
        push = Vector((0, .05 * hit * (1 - drop) - .12 * drop, 0))
    elif name == 'hit_drone':
        # Clipped by a rotor: the head whips back and the body spins off the impact.
        hit = smooth(0, .14, t); spin = smooth(.1, 1, t)
        bank = .32 * hit + math.tau * spin * .75; pitch = -.16 * hit - .28 * spin; extension = 1 - .55 * hit; spread = .3 * hit
        leg = .3 * hit + .28 * math.sin(t * 5 * math.tau) * hit; head = -1.18 + .72 * hit * (1 - .4 * spin); recoil = .22 * hit
        push = Vector((-.07 * hit, -.06 * spin, 0)); crest_up = -.35 * hit
    elif name == 'hit_bird':
        # Tangled with a bird: curl up, flail, and tumble sideways.
        hit = smooth(0, .15, t); roll = smooth(.12, 1, t)
        bank = -.3 * hit - math.tau * .55 * roll; pitch = .22 * hit - .4 * roll; extension = 1 - .7 * hit + .25 * math.sin(t * 6 * math.tau) * hit
        recoil = .38 * hit; leg = .55 * hit + .2 * math.sin(t * 6 * math.tau + 2) * hit; head = -1.18 + .3 * hit; spread = .35 * hit
        push = Vector((-.08 * hit, -.03 * roll, 0)); crest_up = -.2 * hit
    elif name == 'hit_wall':
        # Flattened against a pipe or wall: splat along the flight axis, splay, then peel off and slide down.
        hit = smooth(0, .12, t); slide = smooth(.4, 1, t)
        pitch = .06 * hit; bank = .04 * hit - .28 * slide; squash = 1 - .26 * hit * (1 - slide); extension = 1 - .45 * hit; spread = .48 * hit * (1 - .5 * slide)
        leg = -.22 * hit + .5 * slide; head = -1.18 + .32 * hit; recoil = .18 * hit; push = Vector((-.06 * hit, -.16 * slide, 0)); crest_up = -.25 * hit
    world = Euler((bank, -pitch, 0), 'XYZ').to_quaternion() @ flight_basis
    orient(world)
    root = rig.pose.bones['root']; root.location = push + Vector((0, .004 * wave, 0)); root.scale.y = squash; root.scale.x = root.scale.z = 1 + (1 - squash) * .55
    rot('spine', -.025 + .012 * wave + recoil, .04 * jitter, 0)
    rot('head', head + .012 * wave, .06 * jitter, -.025)
    rot('crest', .055 + .035 * wave2 + crest_up, 0, .015 * wave)
    for side, sign in [('L', -1), ('R', 1)]:
        rot('arm.' + side, -2.78 * extension + .012 * wave2, sign * spread, sign * .025)
        rig.pose.bones['arm.' + side].scale.y = 1.14
        rot('hand.' + side, -.06 + .018 * wave2, sign * .05, 0)
        rot('leg.' + side, leg + .018 * math.sin(t * math.tau + sign), sign * .015, 0)
        rot('boot.' + side, 1.02 + .035 * wave2, 0, 0)
        rot('coat.' + side, .15 + .055 * math.sin(t * math.tau + sign * .7), sign * (.05 + .025 * wave2), sign * .02)
    rot('coat.back', .18 + .055 * math.sin(t * math.tau - 1), .015 * wave, 0)

def ground_pose(name, t):
    """Verbatim upright authoring from scripts/build-chikun-ground-motion.py plus idle."""
    reset()
    wave = math.sin(t * math.tau); pulse = math.sin(math.pi * t); ease = t * t * (3 - 2 * t)
    world = upright.copy(); lean = .09; stride = .68; arm = .53; head = -.05; lift = 0
    if name == 'walk': stride = .32; arm = .28; lean = .03
    elif name in ['jump', 'hurdle_jump', 'high_jump']: stride = 0; arm = .3; lean = .10; lift = .03 * pulse
    elif name == 'jump_flight': world = upright.slerp(flight_basis, ease); stride = 0; arm = 0; lean = 0; head = -1.18 * ease
    elif name in ['land', 'land_roll', 'land_slide']:
        stride = .2 * (1 - ease); arm = .2; lean = .38 * (1 - ease); lift = -.075 * math.sin(math.pi * t) ** 2
        if name == 'land_roll': world = Euler((0, -math.tau * (1 - ease), 0), 'XYZ').to_quaternion() @ upright
        if name == 'land_slide': lean = .7 * (1 - ease); stride = .65 * (1 - ease)
    elif name == 'ground_impact': world = Euler((0, -.65 * ease, 0), 'XYZ').to_quaternion() @ upright; stride = .45; arm = 1.2; lift = -.1 * ease
    elif name == 'idle':
        # Hands in the coat pockets, weight settled on one hip, breathing, a slow side-eye scan.
        breath = math.sin(t * math.tau); stride = 0; arm = 0; lean = .015 + .012 * breath; lift = .004 * breath
        world = Euler((0, 0, .06 * math.sin(t * math.tau + .5)), 'XYZ').to_quaternion() @ upright
        head = -.08 + .02 * breath
    orient(world); rig.pose.bones['root'].location.y = lift
    rot('spine', lean); rot('head', head); rot('crest', .05 + .06 * wave)
    for side, sign in [('L', -1), ('R', 1)]:
        swing = wave * sign
        leg = stride * swing; arms = -arm * swing
        if name in ['jump', 'hurdle_jump', 'high_jump']:
            leg = (-.60 if side == 'L' else .28) * pulse; arms = -1.0 * pulse
            if name == 'hurdle_jump': leg = (-1.25 if side == 'L' else .85) * pulse; arms = -.7 * pulse
            if name == 'high_jump': leg = -.8 * pulse; arms = -2.45 * pulse
        if name == 'jump_flight': leg = .025 * ease; arms = -2.78 * ease
        if name == 'idle':
            # Elbows back, forearms into the pockets at the hips; one knee eased.
            arms = -.62; leg = (.05 if side == 'L' else -.03)
            rot('leg.' + side, leg, sign * .02); rot('boot.' + side, 0)
            rot('arm.' + side, arms, sign * .38, sign * -.06); rot('hand.' + side, 1.05, sign * -.35)
            rot('coat.' + side, .06 + .02 * math.sin(t * math.tau + sign), sign * .02)
            continue
        rot('leg.' + side, leg, sign * .015); rot('boot.' + side, .16 * max(0, -swing) if name in ['walk', 'run'] else .3 * pulse)
        rot('arm.' + side, arms, sign * .10); rot('hand.' + side, -.08 - .1 * max(0, swing))
        rot('coat.' + side, .08 + .09 * math.sin(t * math.tau + sign), sign * .025)
    rot('coat.back', .12 + .06 * wave)

def face(name, t):
    """Expression layer over the body pose. Returns the eye glow strength for this frame."""
    look = EXPRESSION.get(name, 'stern'); pulse = math.sin(math.pi * t) ** 2
    lower = .10; tilt = .10; open_ = 0; clench = 0; asym = 0; yaw = 0
    if look == 'shouting': lower = .22; tilt = .16; open_ = .55 + .25 * pulse
    elif look == 'surprised': lower = -.16; tilt = -.02; open_ = .28 + .1 * pulse
    elif look == 'gritted': lower = .26; tilt = .18; clench = 1
    elif look == 'smug': lower = .02; tilt = .08; asym = .14; open_ = .08
    elif look == 'side_eye':
        # Stern at rest, then a slow glance to the side with one brow cocked, back to stern.
        glance = smooth(.25, .42, t) * (1 - smooth(.72, .9, t)); lower = .12 - .16 * glance; tilt = .1; asym = .16 * glance; yaw = .2 * glance
    if name in ['hit_storm']: lower = -.2; tilt = -.05; open_ = .8 * (1 - smooth(.65, 1, t))
    for side, sign in [('L', -1), ('R', 1)]:
        rot('brow.' + side, lower * .5 + sign * asym * .5, sign * tilt * .5, 0)
    beak = rig.pose.bones['beak']; rot('beak', open_ * .55, 0, 0); beak.scale = (1, 1 - .18 * clench, 1)
    if yaw:
        head = rig.pose.bones['head']; basis = head.bone.matrix_local.to_quaternion()
        head.rotation_quaternion = head.rotation_quaternion @ (basis.conjugated() @ Euler((0, 0, yaw), 'XYZ').to_quaternion() @ basis)
    strength = GLOW[look]
    if name == 'hit_storm': strength = 6 * (1 - smooth(.7, 1, t)) + 1
    if look == 'shouting': strength += 1.2 * (1 - smooth(0, .4, t))
    return strength

# Rebuild every action from scratch so the expression bones are keyed on all of them.
for act in list(bpy.data.actions):
    bpy.data.actions.remove(act)
rig.animation_data_clear(); rig.animation_data_create()
clips = []; glow_keys = {}
for name in FLIGHT + FLIGHT_NEW + GROUND + GROUND_NEW:
    act = bpy.data.actions.new(name); act.use_fake_user = True; rig.animation_data.action = act
    glow_keys[name] = []
    for i in range(25):
        t = i / 24
        (ground_pose if name in GROUND + GROUND_NEW else flight_pose)(name, t)
        glow_keys[name].append(face(name, t))
        for b in rig.pose.bones:
            for prop in ['rotation_quaternion', 'location', 'scale']: b.keyframe_insert(prop, frame=i + 1, group=b.name)
    clips.append({'name': name, 'frames': 24, 'fps': 30, 'loop': name in LOOPS, 'sheet': name + '.webp', 'family': 'ground' if name in GROUND + GROUND_NEW else 'flight', 'expression': EXPRESSION.get(name, 'stern')})
rig.animation_data.action = bpy.data.actions['cruise']

# ---------------------------------------------------------------- render setup (unchanged gameplay camera)
scene.render.fps = 30; scene.frame_start = 1; scene.frame_end = 25
scene.render.engine = 'CYCLES'; scene.cycles.samples = 12; scene.cycles.use_denoising = True; scene.render.use_persistent_data = True
scene.render.resolution_x = scene.render.resolution_y = 256; scene.render.resolution_percentage = 100; scene.render.film_transparent = True
scene.camera.location = (.50, -3.5, 1.65)
bones = [b.name for b in rig.data.bones]
report = {
    'schema': 'chikun-native-character-v4', 'flightPose': 'prone-superman-right', 'characterSheet': 'owner attachment 2026-09-16',
    'source': 'Chikun-Ground-Sky-Rig.blend', 'source_sha256': hashlib.sha256((SOURCE / 'Chikun-Ground-Sky-Rig.blend').read_bytes()).hexdigest(),
    'source_vertices': source_vertices, 'source_triangles': source_triangles, 'vertices': len(me.vertices), 'triangles': len(me.polygons),
    'bones': bones, 'expressionBones': ['brow.L', 'brow.R', 'beak'], 'expressions': sorted(set(EXPRESSION.values()) | {'stern'}),
    'palette': {k: '#%02x%02x%02x' % tuple(round(255 * (c * 12.92 if c <= .0031308 else 1.055 * c ** (1 / 2.4) - .055)) for c in v) for k, v in SHEET.items()},
    'paintRegions': counts, 'vertex_color_attribute': 'Color', 'glow_attribute': 'Glow', 'frameSize': 256, 'columns': 4, 'rows': 6, 'clips': clips,
    'character': 'chikun-original',
    'notes': 'Owner Tripo surface regraded to the 2026-09-16 sheet, emissive mint eyes, three expression bones on the native rig. 39 clips: 21 flight, 7 sheet flight additions (steep climb / dive, five obstacle-family hits), 10 ground, idle.',
}
(out / 'character.json').write_text(json.dumps(report, indent=2) + '\n')
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / 'Chikun-Sheet-Rig.blend'), compress=True)
bpy.ops.object.select_all(action='DESELECT'); mesh.select_set(True); rig.select_set(True); bpy.context.view_layer.objects.active = rig
if not a.no_render:
    bpy.ops.export_scene.gltf(filepath=str(SOURCE / 'Chikun-Sheet-Animations.glb'), export_format='GLB', use_selection=True, export_animations=True, export_animation_mode='ACTIONS', export_frame_range=False, export_force_sampling=True, export_anim_slide_to_zero=True, export_all_influences=False, export_def_bones=True)
    only = {name for name in a.clips.split(',') if name}
    for clip in clips:
        if only and clip['name'] not in only: continue
        rig.animation_data.action = bpy.data.actions[clip['name']]
        for i in ([6] if a.preview else range(24)):
            scene.frame_set(i + 1); bsdf.inputs['Emission Strength'].default_value = glow_keys[clip['name']][i]
            scene.render.filepath = str(frames / f"{clip['name']}-{i:02}.png"); bpy.ops.render.render(write_still=True)
        print('CLIP_DONE', clip['name'], flush=True)
    # Ragdoll parts from the same surface so the corpse matches the living character.
    ragdoll = out / 'ragdoll'; ragdoll.mkdir(exist_ok=True)
    rig.animation_data.action = bpy.data.actions['cruise']; scene.frame_set(7); bsdf.inputs['Emission Strength'].default_value = GLOW['stern']
    lookup = {g.index: g.name for g in mesh.vertex_groups}
    def category(v):
        weights = {lookup[g.group]: g.weight for g in v.groups}; name = max(weights, key=weights.get) if weights else 'root'
        if name in ['head', 'crest', 'brow.L', 'brow.R', 'beak']: return 'head'
        if name.startswith(('arm.', 'hand.')): return 'arm' + name[-1]
        if name.startswith(('leg.', 'boot.')): return 'leg' + name[-1]
        return 'torso'
    cats = [category(v) for v in me.vertices]; parts = ['torso', 'head', 'armL', 'armR', 'legL', 'legR']
    for part in parts:
        obj = mesh.copy(); obj.data = me.copy(); bpy.context.collection.objects.link(obj); obj.name = 'Ragdoll ' + part
        bm = bmesh.new(); bm.from_mesh(obj.data); bm.verts.ensure_lookup_table()
        removed = [f for f in bm.faces if max(set(cats[v.index] for v in f.verts), key=lambda c: sum(cats[v.index] == c for v in f.verts)) != part]
        bmesh.ops.delete(bm, geom=removed, context='FACES'); bm.to_mesh(obj.data); bm.free(); obj.hide_render = True
    mesh.hide_render = True
    for part in parts:
        obj = bpy.data.objects['Ragdoll ' + part]; obj.hide_render = False; scene.render.filepath = str(ragdoll / (part + '.png')); bpy.ops.render.render(write_still=True); obj.hide_render = True
    mesh.hide_render = False
print('CHIKUN_SHEET_BUILD_COMPLETE', len(clips), flush=True)
