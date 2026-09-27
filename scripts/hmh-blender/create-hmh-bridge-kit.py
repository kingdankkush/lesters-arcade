"""HMH bridge kit (Level 1 design package 2.4 and slice S4.9).

Builds the eight layout v2 crossings in seven styles from modular Blender
pieces sized to the greybox decks, saves the source scene and renders every
layer, state and sway phase at the hero camera (35 degrees below the horizon)
with the shared light rig.

Projection contract. The game draws a world point at screen (x, y - z)
(`world-space.mjs`: heightToScreenY 1). The kit is authored in game units
(x right, y south, z up) under one oblique root scaled
(S, -S / sin 35, S / cos 35). An orthographic camera pitched 35 degrees below
the horizon then reproduces the game projection exactly: a deck corner at
(x, y, z) lands on pixel ((x - x0) * density, (y - z - y0) * density). The
render report proves that per frame with projected probes, so art and
collision agree by construction rather than by eye.

Everything here is projection-only. Nothing in the kit is read by collision,
navigation, combat, spawning, RNG or results.

Usage (inside Blender 5.1):
  blender --background --factory-startup --python create-hmh-bridge-kit.py -- \
    --manifest apps/hmh-reboot/assets/source/blender/hmh-bridge-kit.json \
    --source-blend <path.blend> --raw-output <dir> --report-output <file.json> \
    [--only <crossingId>] [--scale 0.5] [--skip-render]
"""
from __future__ import annotations

import argparse
import json
import math
import random
import sys
import zlib
from pathlib import Path

import bmesh
import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

# --- shared art direction -------------------------------------------------
# Every authored-asset pipeline reads the same rig so heroes, enemies, props
# and world kits light identically. See scripts/hmh-blender/hmh-light-rig.json.
import json as _rig_json
from pathlib import Path as _RigPath


def load_shared_light_rig():
    path = _RigPath(__file__).resolve().parent / "hmh-light-rig.json"
    rig = _rig_json.loads(path.read_text(encoding="utf-8"))
    if rig.get("id") != "hmh-shared-light-rig-v1":
        raise SystemExit("unexpected light rig id: " + str(rig.get("id")))
    return rig


def shared_light_channels(family):
    rig = load_shared_light_rig()
    energy = rig["energy"][family]
    return [
        (channel, tuple(rig["colors"][channel]), energy[channel])
        for channel in ("key", "fill", "rim")
    ]


ELEVATION = math.radians(35.0)
SIN_E = math.sin(ELEVATION)
COS_E = math.cos(ELEVATION)
S = 0.01  # Blender units per game unit
LIGHT_FAMILY = "world-kit"

MESHES: dict = {}
MODULE_USE: dict = {}
CTX = {"crossing": None, "layer": "deck", "state": "static", "parent": None}
ROOT = None
COLLECTIONS: dict = {}
MATS: dict = {}


def blender_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--source-blend", required=True)
    parser.add_argument("--raw-output", required=True)
    parser.add_argument("--report-output", required=True)
    parser.add_argument("--only", default="")
    parser.add_argument("--scale", type=float, default=1.0)
    parser.add_argument("--skip-render", action="store_true")
    return parser.parse_args(argv)


def rng_for(*parts):
    return random.Random(zlib.crc32("|".join(str(p) for p in parts).encode("utf-8")))


# --- materials -------------------------------------------------------------

def _math(nt, op, a, b=None):
    node = nt.nodes.new("ShaderNodeMath")
    node.operation = op
    for index, value in enumerate((a, b)):
        if value is None:
            continue
        if isinstance(value, (int, float)):
            node.inputs[index].default_value = value
        else:
            nt.links.new(value, node.inputs[index])
    return node.outputs[0]


def _screen_coords(nt):
    """Game-screen texture space (x, y - z) plus game z, from world position.

    Laying textures in screen space keeps courses and grain undistorted on both
    the top faces and the camera-facing faces of the oblique geometry."""
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(geo.outputs["Position"], sep.inputs[0])
    u = _math(nt, "MULTIPLY", sep.outputs[0], 1.0 / S)
    a = _math(nt, "MULTIPLY", sep.outputs[1], -SIN_E / S)
    b = _math(nt, "MULTIPLY", sep.outputs[2], -COS_E / S)
    v = _math(nt, "ADD", a, b)
    game_z = _math(nt, "MULTIPLY", sep.outputs[2], COS_E / S)
    comb = nt.nodes.new("ShaderNodeCombineXYZ")
    nt.links.new(u, comb.inputs[0])
    nt.links.new(v, comb.inputs[1])
    return comb.outputs[0], game_z


def _mix(nt, a, b, fac, blend="MIX"):
    node = nt.nodes.new("ShaderNodeMix")
    node.data_type = "RGBA"
    node.blend_type = blend
    colour_inputs = [socket for socket in node.inputs if socket.type == "RGBA"]
    for socket, value in ((colour_inputs[0], a), (colour_inputs[1], b)):
        if isinstance(value, tuple):
            socket.default_value = value
        else:
            nt.links.new(value, socket)
    factor = node.inputs[0]
    if isinstance(fac, (int, float)):
        factor.default_value = fac
    else:
        nt.links.new(fac, factor)
    return [socket for socket in node.outputs if socket.type == "RGBA"][0]


def _tone(rgb, factor):
    return tuple(max(0.0, min(1.0, c * factor)) for c in rgb[:3]) + (1.0,)


def make_material(name, rgb, *, rough=0.82, metal=0.0, pattern=None, cell=(22.0, 11.0), bump=0.35,
                  variation=0.14, fog=False, emission=None, emission_strength=0.0, alpha=1.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    coords, game_z = _screen_coords(nt)
    base = _tone(rgb, 1.0)
    color = None
    height = None
    if pattern == "ashlar":
        brick = nt.nodes.new("ShaderNodeTexBrick")
        brick.offset = 0.5
        brick.inputs["Color1"].default_value = _tone(rgb, 1.08)
        brick.inputs["Color2"].default_value = _tone(rgb, 0.84)
        brick.inputs["Mortar"].default_value = _tone(rgb, 0.42)
        brick.inputs["Scale"].default_value = 1.0
        brick.inputs["Mortar Size"].default_value = 0.9
        brick.inputs["Brick Width"].default_value = cell[0]
        brick.inputs["Row Height"].default_value = cell[1]
        nt.links.new(coords, brick.inputs["Vector"])
        color = brick.outputs["Color"]
        height = _math(nt, "SUBTRACT", 1.0, brick.outputs["Fac"])
    elif pattern == "cobble":
        # Granite setts: small rectangular stones in running courses, each
        # stone its own shade.
        brick = nt.nodes.new("ShaderNodeTexBrick")
        brick.offset = 0.5
        brick.offset_frequency = 2
        brick.squash = 1.0
        brick.inputs["Color1"].default_value = _tone(rgb, 1.14)
        brick.inputs["Color2"].default_value = _tone(rgb, 0.78)
        brick.inputs["Mortar"].default_value = _tone(rgb, 0.38)
        brick.inputs["Mortar Size"].default_value = 0.7
        brick.inputs["Mortar Smooth"].default_value = 0.35
        brick.inputs["Bias"].default_value = 0.0
        brick.inputs["Brick Width"].default_value = cell[0]
        brick.inputs["Row Height"].default_value = cell[1]
        nt.links.new(coords, brick.inputs["Vector"])
        color = brick.outputs["Color"]
        height = _math(nt, "SUBTRACT", 1.0, brick.outputs["Fac"])
    elif pattern == "plate":
        brick = nt.nodes.new("ShaderNodeTexBrick")
        brick.offset = 0.0
        brick.inputs["Color1"].default_value = _tone(rgb, 1.04)
        brick.inputs["Color2"].default_value = _tone(rgb, 0.94)
        brick.inputs["Mortar"].default_value = _tone(rgb, 0.55)
        brick.inputs["Mortar Size"].default_value = 0.6
        brick.inputs["Brick Width"].default_value = cell[0]
        brick.inputs["Row Height"].default_value = cell[1]
        nt.links.new(coords, brick.inputs["Vector"])
        color = brick.outputs["Color"]
        height = _math(nt, "SUBTRACT", 1.0, brick.outputs["Fac"])
    elif pattern == "grain":
        wave = nt.nodes.new("ShaderNodeTexWave")
        wave.wave_type = "BANDS"
        wave.bands_direction = "Y" if cell[1] > cell[0] else "X"
        wave.inputs["Scale"].default_value = 1.0 / max(cell)
        wave.inputs["Distortion"].default_value = 6.0
        wave.inputs["Detail"].default_value = 3.0
        nt.links.new(coords, wave.inputs["Vector"])
        color = _mix(nt, _tone(rgb, 0.78), _tone(rgb, 1.1), wave.outputs["Fac"])
        height = wave.outputs["Fac"]
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 0.09
    noise.inputs["Detail"].default_value = 4.0
    nt.links.new(coords, noise.inputs["Vector"])
    shaded = _mix(nt, color if color is not None else base, _tone(rgb, 0.7), _math(nt, "MULTIPLY", noise.outputs["Fac"], variation * 2.2))
    info = nt.nodes.new("ShaderNodeObjectInfo")
    shaded = _mix(nt, shaded, _tone(rgb, 0.82), _math(nt, "MULTIPLY", info.outputs["Random"], variation * 1.6))
    if fog:
        # Deep gorge faces fall into shadow and fade out before their cut edge.
        fog_fac = nt.nodes.new("ShaderNodeMapRange")
        fog_fac.clamp = True
        nt.links.new(game_z, fog_fac.inputs["Value"])
        fog_fac.inputs["From Min"].default_value = -40.0
        fog_fac.inputs["From Max"].default_value = -175.0
        shaded = _mix(nt, shaded, (0.018, 0.022, 0.03, 1.0), fog_fac.outputs["Result"])
        fade = nt.nodes.new("ShaderNodeMapRange")
        fade.clamp = True
        nt.links.new(game_z, fade.inputs["Value"])
        fade.inputs["From Min"].default_value = -150.0
        fade.inputs["From Max"].default_value = -196.0
        fade.inputs["To Min"].default_value = 1.0
        fade.inputs["To Max"].default_value = 0.0
        nt.links.new(fade.outputs["Result"], bsdf.inputs["Alpha"])
    elif alpha < 1.0:
        bsdf.inputs["Alpha"].default_value = alpha
    nt.links.new(shaded, bsdf.inputs["Base Color"])
    if height is not None and bump > 0:
        bump_node = nt.nodes.new("ShaderNodeBump")
        bump_node.inputs["Strength"].default_value = bump
        bump_node.inputs["Distance"].default_value = 0.02
        nt.links.new(height, bump_node.inputs["Height"])
        nt.links.new(bump_node.outputs["Normal"], bsdf.inputs["Normal"])
    if emission is not None:
        bsdf.inputs["Emission Color"].default_value = tuple(emission) + (1.0,)
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    MATS[name] = mat
    return mat


def build_materials(rim_rgb):
    m = {}
    m["granite"] = make_material("Viaduct granite ashlar", (0.33, 0.34, 0.34), pattern="ashlar", cell=(24, 11), fog=True)
    m["granite-coping"] = make_material("Viaduct coping", (0.46, 0.47, 0.46), pattern="ashlar", cell=(34, 30), bump=0.2)
    m["cobble"] = make_material("Worn setts", (0.30, 0.29, 0.27), pattern="cobble", cell=(10.0, 6.0), rough=0.9, variation=0.2)
    m["sandstone"] = make_material("Mill sandstone", (0.52, 0.39, 0.27), pattern="ashlar", cell=(19, 9), variation=0.18)
    m["sandstone-coping"] = make_material("Mill coping", (0.62, 0.51, 0.37), pattern="ashlar", cell=(30, 26), bump=0.2)
    m["timber"] = make_material("Weathered timber", (0.40, 0.30, 0.20), pattern="grain", cell=(4, 40), variation=0.2)
    m["timber-y"] = make_material("Weathered plank", (0.40, 0.30, 0.20), pattern="grain", cell=(40, 4), variation=0.24)
    m["creosote"] = make_material("Creosote timber", (0.21, 0.15, 0.10), pattern="grain", cell=(4, 40), variation=0.2)
    m["creosote-y"] = make_material("Creosote plank", (0.30, 0.22, 0.15), pattern="grain", cell=(40, 4), variation=0.22)
    m["bark"] = make_material("Pine bark", (0.24, 0.17, 0.11), pattern="grain", cell=(3, 30), variation=0.25, bump=0.6)
    m["end-grain"] = make_material("Sawn end grain", (0.66, 0.52, 0.34), variation=0.1)
    m["rope"] = make_material("Hemp rope", (0.60, 0.50, 0.34), rough=0.95, variation=0.12)
    m["iron"] = make_material("Black iron", (0.10, 0.10, 0.11), rough=0.55, metal=0.7, variation=0.08)
    m["steel"] = make_material("Truss steel", (0.20, 0.31, 0.40), rough=0.48, metal=0.55, variation=0.16)
    m["steel-light"] = make_material("Gusset steel", (0.30, 0.42, 0.52), rough=0.45, metal=0.55, variation=0.1)
    m["steel-grey"] = make_material("Galvanized steel", (0.40, 0.42, 0.44), rough=0.42, metal=0.7, variation=0.1)
    m["gate-steel"] = make_material("Lock gate steel", (0.20, 0.26, 0.23), pattern="plate", cell=(40, 30), metal=0.5, rough=0.55)
    m["deck-plate"] = make_material("Diamond deck plate", (0.26, 0.27, 0.28), pattern="plate", cell=(24, 24), metal=0.6, rough=0.5, bump=0.25)
    m["grating"] = make_material("Steel grating", (0.19, 0.22, 0.25), pattern="plate", cell=(6, 6), metal=0.4, rough=0.55, bump=0.4)
    m["leaf-red"] = make_material("Bascule red oxide", (0.44, 0.11, 0.07), metal=0.35, rough=0.5, variation=0.12)
    m["concrete"] = make_material("Aged concrete", (0.30, 0.30, 0.29), pattern="plate", cell=(60, 30), bump=0.15, variation=0.16)
    m["asphalt"] = make_material("Highway asphalt", (0.15, 0.15, 0.16), pattern="plate", cell=(48, 400), bump=0.25, variation=0.2, rough=0.9)
    m["concrete-deck"] = make_material("Concrete deck", (0.24, 0.24, 0.235), pattern="plate", cell=(50, 250), bump=0.3, variation=0.18)
    m["brick"] = make_material("Cabin brick", (0.46, 0.22, 0.15), pattern="ashlar", cell=(10, 4.5), variation=0.18)
    m["wet"] = make_material("Wet waterline", (0.07, 0.08, 0.08), rough=0.3, variation=0.05)
    m["foam"] = make_material("Waterline foam", (0.62, 0.70, 0.74), rough=0.4, variation=0.05, alpha=0.5)
    m["hazard-yellow"] = make_material("Hazard yellow", (0.86, 0.64, 0.06), rough=0.6, variation=0.08)
    m["hazard-black"] = make_material("Hazard black", (0.06, 0.06, 0.06), rough=0.6, variation=0.05)
    m["litecoin-blue"] = make_material("Litecoin enamel", (0.04, 0.25, 0.48), rough=0.32, metal=0.15, variation=0.05)
    m["silver"] = make_material("Silver mark", (0.78, 0.82, 0.86), rough=0.3, metal=0.8, variation=0.03)
    m["brass"] = make_material("Brass padlock", (0.72, 0.55, 0.20), rough=0.35, metal=0.9, variation=0.05)
    m["chain"] = make_material("Chain steel", (0.30, 0.30, 0.32), rough=0.4, metal=0.85, variation=0.05)
    m["lamp"] = make_material("Lamp glow", rim_rgb, rough=0.4, emission=rim_rgb, emission_strength=9.0, variation=0.0)
    m["window"] = make_material("Cabin window", (0.10, 0.14, 0.18), rough=0.2, emission=rim_rgb, emission_strength=1.6, variation=0.0)
    m["moss"] = make_material("Moss", (0.22, 0.30, 0.12), rough=0.95, variation=0.25)
    m["stone"] = make_material("Bank boulder", (0.42, 0.40, 0.36), rough=0.9, variation=0.25, bump=0.5)
    m["catcher"] = make_material("Shadow catcher", (0.5, 0.5, 0.5), variation=0.0)
    return m


# --- geometry --------------------------------------------------------------

def _recalc(mesh):
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()


def _mesh(key, verts, faces):
    if key in MESHES:
        return MESHES[key]
    mesh = bpy.data.meshes.new(key)
    mesh.from_pydata(verts, [], faces)
    mesh.validate()
    _recalc(mesh)
    mesh.materials.append(None)
    MESHES[key] = mesh
    return mesh


def _link(obj, module, mat=None, bevel=0.0):
    coll = COLLECTIONS[CTX["crossing"]]
    coll.objects.link(obj)
    obj.parent = CTX["parent"] or ROOT
    obj["hmh_crossing"] = CTX["crossing"]
    obj["hmh_layer"] = CTX["layer"]
    obj["hmh_state"] = CTX["state"]
    obj["hmh_module"] = module
    if mat is not None and obj.type == "MESH":
        obj.material_slots[0].link = "OBJECT"
        obj.material_slots[0].material = mat
    if bevel > 0 and obj.type == "MESH":
        mod = obj.modifiers.new("Worn edges", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        mod.limit_method = "ANGLE"
    MODULE_USE.setdefault(CTX["crossing"], {}).setdefault(module, 0)
    MODULE_USE[CTX["crossing"]][module] += 1
    return obj


def _r(value):
    return round(float(value), 2)


def box(module, cx, cy, cz, dx, dy, dz, mat, bevel=0.0, rot=(0.0, 0.0, 0.0)):
    key = f"box:{_r(dx)}x{_r(dy)}x{_r(dz)}"
    hx, hy, hz = dx / 2, dy / 2, dz / 2
    verts = [(sx * hx, sy * hy, sz * hz) for sx in (-1, 1) for sy in (-1, 1) for sz in (-1, 1)]
    faces = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    obj = bpy.data.objects.new(module, _mesh(key, verts, faces))
    obj.location = (cx, cy, cz)
    obj.rotation_euler = rot
    return _link(obj, module, mat, min(bevel, dx / 3, dy / 3, dz / 3) if bevel else 0.0)


def boxr(module, x0, y0, z0, x1, y1, z1, mat, bevel=0.0):
    return box(module, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, abs(x1 - x0), abs(y1 - y0), abs(z1 - z0), mat, bevel)


def prism(module, poly, axis, t0, t1, mat, *, origin=(0.0, 0.0, 0.0), bevel=0.0, shared=True):
    """A 2D polygon extruded along `axis`.

    axis 'y': poly is (x, z), extruded over game y t0..t1.
    axis 'x': poly is (y, z), extruded over game x t0..t1.
    axis 'z': poly is (x, y), extruded over game z t0..t1."""
    n = len(poly)
    verts = []
    for t in (t0, t1):
        for a, b in poly:
            if axis == "y":
                verts.append((a, t, b))
            elif axis == "x":
                verts.append((t, a, b))
            else:
                verts.append((a, b, t))
    faces = [tuple(range(n)), tuple(range(2 * n - 1, n - 1, -1))]
    faces += [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)]
    key = f"prism:{axis}:{_r(t0)}:{_r(t1)}:" + ",".join(f"{_r(a)}/{_r(b)}" for a, b in poly)
    if not shared:
        key += f":{len(MESHES)}"
    obj = bpy.data.objects.new(module, _mesh(key, verts, faces))
    obj.location = origin
    return _link(obj, module, mat, bevel)


def cyl(module, a, b, r, mat, n=8):
    a, b = Vector(a), Vector(b)
    length = (b - a).length
    key = f"cyl:{_r(r)}:{_r(length)}:{n}"
    verts = []
    for z in (-length / 2, length / 2):
        for i in range(n):
            ang = 2 * math.pi * i / n
            verts.append((r * math.cos(ang), r * math.sin(ang), z))
    faces = [tuple(range(n)), tuple(range(2 * n - 1, n - 1, -1))] + [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)]
    obj = bpy.data.objects.new(module, _mesh(key, verts, faces))
    obj.location = (a + b) / 2
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = (b - a).to_track_quat("Z", "Y")
    return _link(obj, module, mat)


def rope(module, points, r, mat):
    curve = bpy.data.curves.new(module, "CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = r
    curve.bevel_resolution = 1
    curve.use_fill_caps = True
    spline = curve.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for index, p in enumerate(points):
        spline.points[index].co = (p[0], p[1], p[2], 1.0)
    curve.materials.append(mat)
    obj = bpy.data.objects.new(module, curve)
    return _link(obj, module)


def boulder(module, cx, cy, cz, sx, sy, sz, mat, seed):
    key = f"boulder:{seed}"
    if key not in MESHES:
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0)
        rng = rng_for(key)
        for v in bm.verts:
            v.co *= 0.86 + rng.random() * 0.24
        mesh = bpy.data.meshes.new(key)
        bm.to_mesh(mesh)
        bm.free()
        mesh.materials.append(None)
        MESHES[key] = mesh
    obj = bpy.data.objects.new(module, MESHES[key])
    obj.location = (cx, cy, cz)
    obj.scale = (sx, sy, sz)
    return _link(obj, module, mat)


class layer:
    def __init__(self, name, state="static", parent=None):
        self.name, self.state, self.parent = name, state, parent

    def __enter__(self):
        self.saved = dict(CTX)
        CTX["layer"], CTX["state"] = self.name, self.state
        if self.parent is not None:
            CTX["parent"] = self.parent
        return self

    def __exit__(self, *exc):
        CTX.clear()
        CTX.update(self.saved)


def hinge(name, x, y, z, rot):
    empty = bpy.data.objects.new(name, None)
    COLLECTIONS[CTX["crossing"]].objects.link(empty)
    empty.parent = ROOT
    empty.location = (x, y, z)
    empty.rotation_euler = rot
    return empty


# --- shared modules --------------------------------------------------------

def parapet_run(module, x0, x1, y, z, height, thickness, body, coping, seg=40.0):
    count = max(1, math.ceil((x1 - x0) / seg))
    step = (x1 - x0) / count
    for i in range(count):
        a = x0 + i * step
        boxr(module, a + 0.6, y - thickness / 2, z, a + step - 0.6, y + thickness / 2, z + height - 5, body, bevel=0.8)
        boxr(module + "-coping", a, y - thickness / 2 - 2, z + height - 5, a + step, y + thickness / 2 + 2, z + height, coping, bevel=0.8)


def sloped_parapet(module, xa, za, xb, zb, y, height, thickness, body, coping):
    poly = [(xa, za), (xb, zb), (xb, zb + height - 5), (xa, za + height - 5)]
    prism(module, poly, "y", y - thickness / 2, y + thickness / 2, body, shared=False)
    cap = [(xa, za + height - 5), (xb, zb + height - 5), (xb, zb + height), (xa, za + height)]
    prism(module + "-coping", cap, "y", y - thickness / 2 - 2, y + thickness / 2 + 2, coping, shared=False)


def ramp(module, x_foot, x_top, z_top, y0, y1, body, top, thickness=2.0):
    """A wedge from ground at x_foot rising to z_top at x_top (either direction)."""
    poly = [(x_foot, 0.0), (x_top, z_top), (x_top, -2.0), (x_foot, -2.0)]
    prism(module, poly, "y", y0, y1, body, shared=False)
    surface = [(x_foot, 0.05), (x_top, z_top + 0.05), (x_top, z_top - thickness), (x_foot, -thickness)]
    prism(module + "-surface", surface, "y", y0 + 3, y1 - 3, top, shared=False)


def arch_face(module, center_x, clear, top_z, crown_z, bottom_z, spring_z, y0, y1, mat, ring_mat=None, ring_y=None):
    """Spandrel block between two pier faces with a circular-segment opening.

    The opening springs at spring_z (it may lie below the cut at bottom_z,
    as on the half-drowned mill arches) and rises to crown_z. Identical spans
    share one mesh."""
    half = clear / 2
    rise = crown_z - spring_z
    radius = (half * half + rise * rise) / (2 * rise)
    zc = crown_z - radius
    start_z = max(bottom_z, spring_z)
    xi = min(half, math.sqrt(max(0.0, radius * radius - (start_z - zc) ** 2)))
    a0 = math.atan2(start_z - zc, xi)
    a1 = math.pi - a0
    steps = 18
    arc = [(radius * math.cos(a1 - (a1 - a0) * i / steps), zc + radius * math.sin(a1 - (a1 - a0) * i / steps)) for i in range(steps + 1)]
    notch = xi < half - 0.5
    poly = [(-half, top_z), (-half, start_z)] + ([(-xi, start_z)] if notch else []) + arc
    poly += ([(half, start_z)] if notch else []) + [(half, top_z)]
    clean = []
    for p in poly:
        if not clean or abs(clean[-1][0] - p[0]) > 0.01 or abs(clean[-1][1] - p[1]) > 0.01:
            clean.append(p)
    prism(module, clean, "y", y0, y1, mat, origin=(center_x, 0.0, 0.0))
    if ring_mat is not None and ring_y is not None:
        outer = radius + 8
        outer_pts = []
        for x, z in arc:
            ang = math.atan2(z - zc, x)
            outer_pts.append((outer * math.cos(ang), min(zc + outer * math.sin(ang), top_z - 0.5)))
        ring_poly = arc + list(reversed(outer_pts))
        prism(module + "-voussoirs", ring_poly, "y", ring_y, ring_y + 3, ring_mat, origin=(center_x, 0.0, 0.0))
        box(module + "-keystone", center_x, ring_y + 1.8, crown_z + 4, 9, 3.6, 12, ring_mat, bevel=0.6)


def foam_ring(module, cx, cy, z, r, mat):
    cyl(module, (cx, cy, z - 0.3), (cx, cy, z + 0.3), r, mat, n=10)


def lamp_post(module, x, y, mats, height=86):
    cyl(module + "-pole", (x, y, 0), (x, y, height), 2.6, mats["iron"], n=8)
    boxr(module + "-base", x - 6, y - 6, 0, x + 6, y + 6, 8, mats["iron"], bevel=1)
    boxr(module + "-lantern", x - 6, y - 6, height, x + 6, y + 6, height + 12, mats["lamp"], bevel=0.8)
    boxr(module + "-cap", x - 8, y - 8, height + 12, x + 8, y + 8, height + 15, mats["iron"], bevel=0.8)


def truss_plane(module, x0, x1, y, z_bottom, height, panels, m):
    top = z_bottom + height
    panel = (x1 - x0) / panels
    boxr(module + "-bottom-chord", x0, y - 6, z_bottom, x1, y + 6, z_bottom + 12, m["steel"], bevel=0.6)
    boxr(module + "-top-chord", x0 + panel, y - 7, top - 12, x1 - panel, y + 7, top, m["steel"], bevel=0.6)
    for end, sign in ((x0, 1), (x1, -1)):
        cyl(module + "-end-post", (end + sign * 3, y, z_bottom + 6), (end + sign * panel, y, top - 6), 6.0, m["steel"], n=6)
    for k in range(1, panels):
        xk = x0 + k * panel
        boxr(module + "-vertical", xk - 3.5, y - 4.5, z_bottom + 12, xk + 3.5, y + 4.5, top - 12, m["steel"], bevel=0.4)
        boxr(module + "-gusset", xk - 9, y - 7.5, z_bottom - 1, xk + 9, y + 7.5, z_bottom + 15, m["steel-light"], bevel=0.4)
        boxr(module + "-gusset", xk - 9, y - 8.5, top - 15, xk + 9, y + 8.5, top + 1, m["steel-light"], bevel=0.4)
    half = panels // 2
    for k in range(1, panels - 1):
        a = x0 + k * panel
        b = a + panel
        if k < half:
            cyl(module + "-diagonal", (a, y, top - 8), (b, y, z_bottom + 8), 3.2, m["steel"], n=6)
        else:
            cyl(module + "-diagonal", (b, y, top - 8), (a, y, z_bottom + 8), 3.2, m["steel"], n=6)


def rail_run(module, x0, x1, y, m, *, post_step=30.0, height=38.0, mat_key="steel-grey", tube=True):
    count = max(1, round((x1 - x0) / post_step))
    for i in range(count + 1):
        x = x0 + (x1 - x0) * i / count
        boxr(module + "-post", x - 2.5, y - 2.5, 0, x + 2.5, y + 2.5, height, m[mat_key], bevel=0.5)
    if tube:
        cyl(module + "-top-rail", (x0, y, height - 2), (x1, y, height - 2), 2.4, m[mat_key], n=8)
        cyl(module + "-mid-rail", (x0, y, height * 0.5), (x1, y, height * 0.5), 1.8, m[mat_key], n=8)
    else:
        boxr(module + "-top-rail", x0, y - 3.5, height - 6, x1, y + 3.5, height, m[mat_key], bevel=0.6)
        boxr(module + "-mid-rail", x0, y - 2.5, height * 0.42, x1, y + 2.5, height * 0.42 + 5, m[mat_key], bevel=0.5)


def ell_mark(module, cx, y_face, cz, size, mat):
    """A raised Litecoin 'Ł' built from bars on a south-facing plate."""
    w = size * 0.16
    boxr(module + "-stem", cx - size * 0.28, y_face, cz - size * 0.45, cx - size * 0.28 + w, y_face + 1.4, cz + size * 0.45, mat)
    boxr(module + "-foot", cx - size * 0.28, y_face, cz - size * 0.45, cx + size * 0.34, y_face + 1.4, cz - size * 0.45 + w, mat)
    bar = box(module + "-slash", cx - size * 0.2, y_face + 0.7, cz + size * 0.02, size * 0.56, 1.4, w * 0.85, mat)
    bar.rotation_euler = (0.0, math.radians(28), 0.0)


# --- crossings -------------------------------------------------------------

def build_viaduct(d, m):
    x0, y0, x1, y1 = d["rect"]
    ny, sy = y0 - 30, y1 + 30
    length = x1 - x0
    with layer("deck"):
        boxr("viaduct-slab", x0 - 12, y0 - 46, -24, x1 + 12, y1 + 46, -2, m["granite"], bevel=1.0)
        boxr("viaduct-road", x0 - 12, y0 - 16, -2, x1 + 12, y1 + 16, 0, m["cobble"])
        for ya, yb in ((y0 - 46, y0 - 16), (y1 + 16, y1 + 46)):
            boxr("viaduct-kerb", x0 - 12, ya, -2, x1 + 12, yb, 2.5, m["granite-coping"], bevel=0.8)
        parapet_run("viaduct-parapet", x0 - 12, x1 + 12, ny, 2.5, 40, 22, m["granite"], m["granite-coping"])
        for x in (x0 - 12, x1 + 12):
            boxr("viaduct-end-pillar", x - 15, ny - 15, 0, x + 15, ny + 15, 50, m["granite"], bevel=1.2)
            boxr("viaduct-end-pillar-cap", x - 18, ny - 18, 50, x + 18, ny + 18, 56, m["granite-coping"], bevel=1.2)
        # Abutments hug the gorge walls; aprons sit on the rim.
        for xa, xb in ((x0 + 18, x0 + 40), (x1 - 40, x1 - 18)):
            boxr("viaduct-abutment", xa, y0 - 58, -200, xb, y1 + 58, -24, m["granite"], bevel=1.0)
        for xa, xb in ((x0 - 60, x0 - 12), (x1 + 12, x1 + 60)):
            boxr("viaduct-apron", xa, y0 - 50, -3, xb, y1 + 50, 0.8, m["cobble"])
        inner0, inner1 = x0 + 40, x1 - 40
        spans = 3
        pier_w = 40.0
        clear = (inner1 - inner0 - (spans - 1) * pier_w) / spans
        for i in range(spans):
            left = inner0 + i * (clear + pier_w)
            arch_face("viaduct-arch-span", left + clear / 2, clear, -24, -32, -200, -32 - clear / 2, y0 - 46, y1 + 46, m["granite"], m["granite-coping"], y1 + 46)
            if i < spans - 1:
                px = left + clear + pier_w / 2
                boxr("viaduct-pier", px - pier_w / 2, y0 - 52, -200, px + pier_w / 2, y1 + 52, -24, m["granite"], bevel=1.0)
                boxr("viaduct-string-course", px - pier_w / 2 - 3, y0 - 55, -32 - clear / 2 - 4, px + pier_w / 2 + 3, y1 + 55, -32 - clear / 2, m["granite-coping"], bevel=0.8)
        boxr("viaduct-cornice", x0 - 12, y1 + 44, -8, x1 + 12, y1 + 50, -2, m["granite-coping"], bevel=0.8)
    with layer("near"):
        parapet_run("viaduct-parapet", x0 - 12, x1 + 12, sy, 2.5, 40, 22, m["granite"], m["granite-coping"])
        for x in (x0 - 12, x1 + 12):
            boxr("viaduct-end-pillar", x - 15, sy - 15, 0, x + 15, sy + 15, 50, m["granite"], bevel=1.2)
            boxr("viaduct-end-pillar-cap", x - 18, sy - 18, 50, x + 18, sy + 18, 56, m["granite-coping"], bevel=1.2)
    _ = length


def _rope_path(x0, x1, y, z_end, z_mid, lateral, n=24):
    pts = []
    for i in range(n + 1):
        t = i / n
        x = x0 + (x1 - x0) * t
        sag = (2 * t - 1) ** 2
        z = z_mid + (z_end - z_mid) * sag
        pts.append((x, y + lateral * math.sin(math.pi * t), z))
    return pts


# Winched-up halves stop just under the tower tops, leaving the gorge open.
RAISED_DEGREES = 36.0


def build_rope_bridge(d, m, sway):
    x0, y0, x1, y1 = d["rect"]
    ny, sy = y0 - 30, y1 + 30
    tw, te = x0 - 6, x1 + 6
    tower_h = 128
    frames = sway["frames"]
    amp = sway["lateralAmplitude"]
    bob = sway["verticalAmplitude"]

    def tower_posts(y):
        for x in (tw, te):
            boxr("rope-tower-post", x - 8, y - 8, 0, x + 8, y + 8, tower_h, m["timber"], bevel=1.0)
            boxr("rope-tower-footing", x - 16, y - 16, -3, x + 16, y + 16, 9, m["stone"], bevel=2.0)
            cyl("rope-tower-knee", (x, y, 70), (x + (12 if x == tw else -12), y, 50), 3.0, m["timber"], n=6)
            boxr("rope-tower-cap", x - 10, y - 10, tower_h, x + 10, y + 10, tower_h + 4, m["iron"], bevel=0.6)

    def anchors(y, side):
        for x, direction in ((tw, -1), (te, 1)):
            sx = x + direction * 96
            stake_y = y + side * 24
            boxr("rope-anchor-stake", sx - 5, stake_y - 5, -2, sx + 5, stake_y + 5, 22, m["timber"], bevel=0.8)
            boulder("rope-anchor-stone", sx - direction * 4, stake_y, 2, 13, 11, 7, m["stone"], seed=int(sx + stake_y))
            rope("rope-anchor-line", [(x, y, tower_h - 4), (sx, stake_y, 18)], 1.8, m["rope"])

    with layer("deck"):
        tower_posts(ny)
        anchors(ny, -1)
        for x in (tw, te):
            boxr("rope-landing", x - 24 if x == tw else x - 4, y0 - 40, -3, x + 4 if x == tw else x + 24, y1 + 40, 1.0, m["timber-y"])
    with layer("near"):
        tower_posts(sy)
        anchors(sy, 1)
        for x in (tw, te):
            boxr("rope-tower-crossbeam", x - 7, ny - 10, tower_h - 18, x + 7, sy + 10, tower_h - 6, m["timber"], bevel=0.8)
            cyl("rope-tower-brace", (x, ny + 4, tower_h - 20), (x, (ny + sy) / 2, tower_h - 44), 2.6, m["timber"], n=6)
            cyl("rope-tower-brace", (x, sy - 4, tower_h - 20), (x, (ny + sy) / 2, tower_h - 44), 2.6, m["timber"], n=6)

    def deck_set(phase):
        s = math.sin(phase)
        c = math.cos(phase)
        span = x1 - x0
        count = int(span // 11)
        rng = rng_for("rope-planks")
        for i in range(count + 1):
            x = x0 - 4 + (span + 8) * i / count
            t = (x - x0) / span
            env = math.sin(math.pi * min(1.0, max(0.0, t)))
            dz = -5 * env + bob * env * c
            dy = amp * env * s
            yaw = math.radians((rng.random() - 0.5) * 3.0)
            jitter_z = (rng.random() - 0.5) * 1.2
            plank = box("rope-plank", x, (y0 + y1) / 2 + dy + (rng.random() - 0.5) * 3, dz - 1.5 + jitter_z, 9, (y1 - y0) + 64, 3, m["timber-y"], bevel=0.5)
            plank.rotation_euler = (math.radians(2.0) * env * s, 0.0, yaw)
        for yy in (y0 - 24, y1 + 24):
            pts = []
            for i in range(25):
                t = i / 24
                env = math.sin(math.pi * t)
                pts.append((x0 - 6 + (span + 12) * t, yy + amp * env * s, -5 * env + bob * env * c - 4.5))
            rope("rope-stringer", pts, 2.6, m["rope"])

    def side_set(y, phase):
        s = math.sin(phase)
        c = math.cos(phase)
        span = x1 - x0
        hand = []
        for i in range(25):
            t = i / 24
            env = math.sin(math.pi * t)
            hand.append((tw + (te - tw) * t, y + amp * env * s, 42 - 6 * env + bob * env * c))
        rope("rope-hand-line", hand, 2.0, m["rope"])
        main = _rope_path(tw, te, y, tower_h - 6, 50, amp * 0.6 * s)
        rope("rope-main-cable", main, 2.8, m["rope"])
        steps = int(span // 22)
        for i in range(1, steps):
            t = i / steps
            env = math.sin(math.pi * t)
            x = x0 + span * t
            deck_z = -5 * env + bob * env * c
            top = main[round(t * 24)][2]
            yy = y + amp * env * s
            rope("rope-suspender", [(x, y + amp * 0.6 * s * env, top), (x, yy, deck_z)], 1.1, m["rope"])

    for k in range(frames):
        phase = 2 * math.pi * k / frames
        with layer("deck", f"sway-{k}"):
            deck_set(phase)
            side_set(ny, phase)
        with layer("near", f"sway-{k}"):
            side_set(sy, phase)

    with layer("moving", "raised"):
        span = x1 - x0
        half = span / 2
        rng = rng_for("rope-planks-raised")
        for hx, direction in ((x0 - 4, 1), (x1 + 4, -1)):
            pivot = hinge(f"rope-raised-hinge-{direction}", hx, 0.0, 0.0, (0.0, math.radians(-RAISED_DEGREES if direction == 1 else RAISED_DEGREES), 0.0))
            with layer("moving", "raised", parent=pivot):
                count = int(half // 11)
                for i in range(count):
                    dx = direction * (4 + i * 11)
                    plank = box("rope-plank", dx, (y0 + y1) / 2 + (rng.random() - 0.5) * 3, -1.5, 9, (y1 - y0) + 64, 3, m["timber-y"], bevel=0.5)
                    plank.rotation_euler = (0.0, 0.0, math.radians((rng.random() - 0.5) * 3))
                for yy in (y0 - 24, y1 + 24):
                    rope("rope-stringer", [(0.0, yy, -4.5), (direction * (half - 6), yy, -4.5)], 2.6, m["rope"])
            tip_x = hx + direction * (half - 6) * math.cos(math.radians(RAISED_DEGREES))
            tip_z = (half - 6) * math.sin(math.radians(RAISED_DEGREES))
            tower_x = tw if direction == 1 else te
            for y in (ny, sy):
                rope("rope-haul-line", [(tower_x, y, tower_h - 8), (tip_x, y + (6 if y == ny else -6), tip_z)], 1.8, m["rope"])
        for y in (ny, sy):
            rope("rope-main-cable", _rope_path(tw, te, y, tower_h - 6, 50, 0.0), 2.8, m["rope"])
            slack = []
            for i in range(25):
                t = i / 24
                slack.append((tw + (te - tw) * t, y, 42 - 70 * math.sin(math.pi * t)))
            rope("rope-hand-line", slack, 2.0, m["rope"])


def build_old_mill(d, m):
    x0, y0, x1, y1 = d["rect"]
    z = d["z"]
    ramp_len = d.get("rampLength", 100)
    ny, sy = y0 - 30, y1 + 30
    water = -24.0
    with layer("deck"):
        boxr("mill-slab", x0 - 4, y0 - 46, -8, x1 + 4, y1 + 46, z - 2, m["sandstone"], bevel=1.0)
        boxr("mill-road", x0 - 4, y0 - 16, z - 2, x1 + 4, y1 + 16, z, m["cobble"])
        for ya, yb in ((y0 - 46, y0 - 16), (y1 + 16, y1 + 46)):
            boxr("mill-kerb", x0 - 4, ya, z - 2, x1 + 4, yb, z + 2, m["sandstone-coping"], bevel=0.8)
        for foot, top in ((x0 - ramp_len, x0 - 4), (x1 + ramp_len, x1 + 4)):
            ramp("mill-ramp", foot, top, z, y0 - 46, y1 + 46, m["sandstone"], m["cobble"])
        parapet_run("mill-parapet", x0 - 4, x1 + 4, ny, z + 2, 34, 18, m["sandstone"], m["sandstone-coping"], seg=36)
        sloped_parapet("mill-ramp-parapet", x0 - ramp_len + 8, 2, x0 - 4, z + 2, ny, 34, 18, m["sandstone"], m["sandstone-coping"])
        sloped_parapet("mill-ramp-parapet", x1 + 4, z + 2, x1 + ramp_len - 8, 2, ny, 34, 18, m["sandstone"], m["sandstone-coping"])
        for x in (x0 - ramp_len + 8, x1 + ramp_len - 8):
            boxr("mill-newel", x - 12, ny - 12, 0, x + 12, ny + 12, 44, m["sandstone"], bevel=1.2)
            boxr("mill-newel-cap", x - 14, ny - 14, 44, x + 14, ny + 14, 49, m["sandstone-coping"], bevel=1.0)
        spans = 4
        pier_w = 34.0
        clear = (x1 - x0 - (spans - 1) * pier_w) / spans
        for i in range(spans):
            left = x0 + i * (clear + pier_w)
            arch_face("mill-arch-span", left + clear / 2, clear, -8, -12, water - 2, -34, y0 - 46, y1 + 46, m["sandstone"], m["sandstone-coping"], y1 + 46)
            if i < spans - 1:
                px = left + clear + pier_w / 2
                boxr("mill-pier", px - pier_w / 2, y0 - 46, water - 2, px + pier_w / 2, y1 + 46, -8, m["sandstone"], bevel=1.0)
                prism("mill-cutwater", [(px - pier_w / 2, y0 - 46), (px + pier_w / 2, y0 - 46), (px, y0 - 82)], "z", water - 2, -4, m["sandstone"], bevel=0.8)
                boxr("mill-cutwater-cap", px - 5, y0 - 80, -4, px + 5, y0 - 46, -1, m["sandstone-coping"], bevel=0.6)
                boxr("mill-pilaster", px - 12, y1 + 46, water - 2, px + 12, y1 + 52, z - 2, m["sandstone"], bevel=0.8)
                foam_ring("mill-foam", px, y0 - 58, water + 0.4, 20, m["foam"])
                boxr("mill-foam", px - 20, y1 + 50, water - 0.4, px + 20, y1 + 58, water + 0.4, m["foam"])
        boxr("mill-waterline", x0, y1 + 46, water - 0.5, x1, y1 + 47.5, water + 5, m["wet"])
        for x in (x0 - 4, x1 + 4):
            boxr("mill-abutment", x - 10, y0 - 50, water - 2, x + 10, y1 + 50, 0, m["sandstone"], bevel=1.0)
    with layer("near"):
        parapet_run("mill-parapet", x0 - 4, x1 + 4, sy, z + 2, 34, 18, m["sandstone"], m["sandstone-coping"], seg=36)
        sloped_parapet("mill-ramp-parapet", x0 - ramp_len + 8, 2, x0 - 4, z + 2, sy, 34, 18, m["sandstone"], m["sandstone-coping"])
        sloped_parapet("mill-ramp-parapet", x1 + 4, z + 2, x1 + ramp_len - 8, 2, sy, 34, 18, m["sandstone"], m["sandstone-coping"])
        for x in (x0 - ramp_len + 8, x1 + ramp_len - 8):
            boxr("mill-newel", x - 12, sy - 12, 0, x + 12, sy + 12, 44, m["sandstone"], bevel=1.2)
            boxr("mill-newel-cap", x - 14, sy - 14, 44, x + 14, sy + 14, 49, m["sandstone-coping"], bevel=1.0)


def build_truss(d, m):
    x0, y0, x1, y1 = d["rect"]
    z = d["z"]
    ramp_len = d.get("rampLength", 100)
    ny, sy = y0 - 30, y1 + 30
    water = -24.0
    panels = 10
    height = 100
    with layer("deck"):
        boxr("truss-deck", x0, y0 - 40, z - 4, x1, y1 + 40, z, m["asphalt"])
        for ya, yb in ((y0 - 40, y0 - 18), (y1 + 18, y1 + 40)):
            boxr("truss-kerb", x0, ya, z - 1, x1, yb, z + 2, m["steel-grey"], bevel=0.5)
        boxr("truss-fascia", x0, y1 + 36, -6, x1, y1 + 44, z - 1, m["steel"], bevel=0.5)
        panel = (x1 - x0) / panels
        for k in range(panels + 1):
            xk = x0 + k * panel
            boxr("truss-floor-beam", xk - 4, y0 - 40, -4, xk + 4, y1 + 46, z - 4, m["steel-light"], bevel=0.4)
        for x in (x0, x1):
            boxr("truss-abutment", x - 10, y0 - 56, water - 2, x + 10, y1 + 56, z - 6, m["concrete"], bevel=1.0)
            for y in (ny, sy):
                boxr("truss-bearing", x - 8, y - 10, z - 10, x + 8, y + 10, z - 4, m["iron"], bevel=0.5)
            boxr("truss-foam", x - 18, y1 + 54, water - 0.4, x + 18, y1 + 62, water + 0.4, m["foam"])
        for foot, top in ((x0 - ramp_len, x0), (x1 + ramp_len, x1)):
            ramp("truss-ramp", foot, top, z, y0 - 40, y1 + 40, m["concrete"], m["asphalt"])
            for y in (y0 - 40, y1 + 40):
                zz = z + 3
                poly = [(foot, 0.0), (top, z), (top, zz), (foot, 3.0)]
                prism("truss-ramp-kerb", poly, "y", y - 3, y + 3, m["steel-grey"], shared=False)
        truss_plane("truss-far", x0, x1, ny, z, height, panels, m)
    with layer("near"):
        truss_plane("truss-near", x0, x1, sy, z, height, panels, m)
        mid = (x0 + x1) / 2
        top = z + height
        boxr("truss-name-plate", mid - 34, sy + 7, top - 30, mid + 34, sy + 9, top - 14, m["litecoin-blue"], bevel=0.5)
        ell_mark("truss-name-mark", mid, sy + 9, top - 22, 13, m["silver"])
    with layer("overhead"):
        panel = (x1 - x0) / panels
        top = z + height
        for k in range(1, panels):
            xk = x0 + k * panel
            boxr("truss-lateral-strut", xk - 4, ny, top - 10, xk + 4, sy, top - 2, m["steel"], bevel=0.4)
        for k in range(1, panels - 1):
            a = x0 + k * panel
            b = a + panel
            cyl("truss-top-bracing", (a, ny + 6, top - 6), (b, sy - 6, top - 6), 1.8, m["steel"], n=6)
            cyl("truss-top-bracing", (a, sy - 6, top - 6), (b, ny + 6, top - 6), 1.8, m["steel"], n=6)
        for xk in (x0 + panel, x1 - panel):
            boxr("truss-portal-strut", xk - 6, ny, top - 30, xk + 6, sy, top - 14, m["steel-light"], bevel=0.5)
            for y, sign in ((ny, 1), (sy, -1)):
                cyl("truss-portal-knee", (xk, y, top - 40), (xk, y + sign * 40, top - 22), 2.4, m["steel"], n=6)


def build_trestle(d, m):
    x0, y0, x1, y1 = d["rect"]
    ny, sy = y0 - 30, y1 + 30
    water = -24.0
    width = y1 - y0
    with layer("deck"):
        bents = 5
        for i in range(bents):
            x = x0 + 16 + (x1 - x0 - 32) * i / (bents - 1)
            boxr("trestle-cap", x - 8, y0 - 50, -13, x + 8, y1 + 50, -4, m["creosote"], bevel=0.8)
            for f in (0.0, 1 / 3, 2 / 3, 1.0):
                y = y0 - 20 + (width + 40) * f
                cyl("trestle-pile", (x, y, water - 2), (x, y, -12), 6.0, m["creosote"], n=8)
                foam_ring("trestle-foam", x, y, water + 0.4, 7.5, m["foam"])
            for y_top, y_foot in ((y0 - 40, y0 - 58), (y1 + 40, y1 + 58)):
                cyl("trestle-batter-pile", (x, y_foot, water - 2), (x, y_top, -12), 5.2, m["creosote"], n=8)
                foam_ring("trestle-foam", x, y_foot, water + 0.4, 7.0, m["foam"])
            boxr("trestle-girt", x - 4, y0 - 48, -21, x + 4, y1 + 48, -16, m["creosote"], bevel=0.5)
        for j in range(7):
            y = y0 - 36 + (width + 72) * j / 6
            boxr("trestle-stringer", x0 - 6, y - 5, -4, x1 + 6, y + 5, -3, m["creosote"], bevel=0.4)
        count = int((x1 - x0 + 12) // 13)
        rng = rng_for("trestle-planks")
        for i in range(count):
            x = x0 - 6 + 6.5 + i * 13
            plank = box("trestle-plank", x, (y0 + y1) / 2 + (rng.random() - 0.5) * 4, -1.5, 11.5, width + 96, 3, m["creosote-y"], bevel=0.5)
            plank.rotation_euler = (0.0, 0.0, math.radians((rng.random() - 0.5) * 1.6))
        rail_run("trestle-rail", x0 - 4, x1 + 4, ny, m, post_step=36, mat_key="creosote", tube=False)
        for x in (x0 - 4, x1 + 4):
            boxr("trestle-sill", x - 10, y0 - 50, -6, x + 10, y1 + 50, 0.5, m["creosote"], bevel=0.8)
    with layer("near"):
        rail_run("trestle-rail", x0 - 4, x1 + 4, sy, m, post_step=36, mat_key="creosote", tube=False)
        count = max(1, round((x1 - x0 + 8) / 36))
        for i in range(count + 1):
            x = x0 - 4 + (x1 - x0 + 8) * i / count
            cyl("trestle-knee", (x, sy + 2, 18), (x, sy + 12, -2), 2.4, m["creosote"], n=6)


def build_lock_gate(d, m):
    x0, y0, x1, y1 = d["rect"]
    ny, sy = y0 - 30, y1 + 30
    water = -24.0
    gate_x = d["movingParts"]["gateX"]
    with layer("deck"):
        for xa, xb in ((x0 - 12, x0 + 22), (x1 - 22, x1 + 12)):
            boxr("lock-wall", xa, y0 - 110, water - 4, xb, y1 + 110, 3, m["granite"], bevel=1.0)
            boxr("lock-wall-coping", xa - 3, y0 - 110, 3, xb + 3, y1 + 110, 7, m["granite-coping"], bevel=0.8)
            boxr("lock-wall-waterline", xa, y1 + 109, water - 0.5, xb, y1 + 111, water + 4, m["wet"])
        boxr("lock-walkway", x0 + 4, y0 - 44, -5, x1 - 4, y1 + 44, 0, m["grating"])
        for ya, yb in ((y0 - 44, y0 - 36), (y1 + 36, y1 + 44)):
            boxr("lock-walkway-edge", x0 + 4, ya, -8, x1 - 4, yb, 1.5, m["gate-steel"], bevel=0.4)
        # Downstream mitre gate: its steel face shows under the walkway edge.
        mid = (x0 + x1) / 2
        for sign in (-1, 1):
            leaf = box("lock-gate-leaf", mid + sign * (x1 - x0 - 44) / 4, y1 + 40, (water - 6 - 8) / 2, (x1 - x0 - 44) / 2 - 2, 10, 14 - water, m["gate-steel"], bevel=0.8)
            leaf.rotation_euler = (0.0, 0.0, math.radians(sign * 6))
            for k in range(5):
                rx = mid + sign * (8 + k * (x1 - x0 - 60) / 10)
                boxr("lock-gate-rib", rx - 2.5, y1 + 45, water - 4, rx + 2.5, y1 + 48, -8, m["steel-grey"], bevel=0.3)
        boxr("lock-gate-wet", x0 + 22, y1 + 46, water - 0.5, x1 - 22, y1 + 49, water + 6, m["wet"])
        boxr("lock-foam", x0 + 22, y1 + 49, water - 0.4, x1 - 22, y1 + 60, water + 0.4, m["foam"])
        # Balance beams reach back over the lock walls onto both banks.
        for y_a, y_b in ((y0 - 34, y0 - 14), (y1 + 14, y1 + 34)):
            boxr("lock-balance-beam", x0 - 130, y_a, 6, x0 + 20, y_b, 20, m["creosote"], bevel=1.0)
            boxr("lock-balance-beam", x1 - 20, y_a, 6, x1 + 130, y_b, 20, m["creosote"], bevel=1.0)
            for x in (x0 - 118, x1 + 118):
                boxr("lock-beam-strap", x - 3, y_a - 1, 5, x + 3, y_b + 1, 21, m["iron"], bevel=0.3)
        for x in (x0 + 70, x1 - 70):
            cyl("lock-paddle-rod", (x, y1 + 26, 0), (x, y1 + 26, 30), 2.4, m["iron"], n=8)
            cyl("lock-paddle-wheel", (x - 1, y1 + 26, 30), (x + 1, y1 + 26, 30), 9.0, m["iron"], n=12)
        rail_run("lock-handrail", x0 + 4, x1 - 4, ny, m, post_step=29)
        for x in (x0 + 10, x1 - 10):
            lamp_post("lock-lamp", x, ny - 4, m)
        boxr("lock-gate-post", gate_x - 7, ny - 7, 0, gate_x + 7, ny + 7, 58, m["gate-steel"], bevel=0.8)
        boxr("lock-gate-post-cap", gate_x - 9, ny - 9, 58, gate_x + 9, ny + 9, 62, m["hazard-yellow"], bevel=0.6)
        for x in (x0 - 40, x1 + 40):
            for y in (y0 - 60, y1 + 60):
                cyl("lock-bollard", (x, y, 0), (x, y, 14), 6.5, m["iron"], n=10)
    with layer("near"):
        rail_run("lock-handrail", x0 + 4, x1 - 4, sy, m, post_step=29)
        for x in (x0 + 10, x1 - 10):
            lamp_post("lock-lamp", x, sy + 4, m)
        boxr("lock-gate-post", gate_x - 7, sy - 7, 0, gate_x + 7, sy + 7, 58, m["gate-steel"], bevel=0.8)
        boxr("lock-gate-post-cap", gate_x - 9, sy - 9, 58, gate_x + 9, sy + 9, 62, m["hazard-yellow"], bevel=0.6)

    def gate_leaf(module, y_from, y_to):
        length = abs(y_to - y_from)
        sign = 1 if y_to > y_from else -1
        with_parent = CTX["parent"]
        _ = with_parent
        stripe = 12.0
        count = int(length // stripe)
        for i in range(count):
            ya = y_from + sign * i * stripe
            boxr(module + "-top-rail", -6, min(ya, ya + sign * stripe), 44, 6, max(ya, ya + sign * stripe), 50, m["hazard-yellow" if i % 2 == 0 else "hazard-black"], bevel=0.3)
        boxr(module + "-bottom-rail", -5, min(y_from, y_to), 4, 5, max(y_from, y_to), 10, m["gate-steel"], bevel=0.4)
        boxr(module + "-stile", -6, y_to - sign * 6 - 3, 4, 6, y_to - sign * 6 + 3, 50, m["gate-steel"], bevel=0.4)
        bars = int(length // 12)
        for i in range(1, bars):
            y = y_from + sign * i * 12
            cyl(module + "-bar", (0, y, 10), (0, y, 44), 1.8, m["gate-steel"], n=6)
        cyl(module + "-brace", (0, y_from + sign * 4, 10), (0, y_to - sign * 8, 44), 2.2, m["gate-steel"], n=6)

    mid_y = (ny + sy) / 2
    with layer("moving", "chained"):
        north = hinge("lock-gate-north-closed", gate_x, ny, 0.0, (0.0, 0.0, 0.0))
        with layer("moving", "chained", parent=north):
            gate_leaf("lock-gate-leaf", 7, mid_y - ny - 1)
        south = hinge("lock-gate-south-closed", gate_x, sy, 0.0, (0.0, 0.0, 0.0))
        with layer("moving", "chained", parent=south):
            gate_leaf("lock-gate-leaf", -7, mid_y - sy + 1)
        for k, z in enumerate((20, 26, 32, 38)):
            loop = [(gate_x - 8, mid_y - 10, z), (gate_x - 9, mid_y, z + 3), (gate_x - 8, mid_y + 10, z), (gate_x + 8, mid_y + 10, z - 2), (gate_x + 9, mid_y, z + 1), (gate_x + 8, mid_y - 10, z)]
            rope("lock-chain-wrap", loop + [loop[0]], 1.6, m["chain"])
        boxr("lock-padlock", gate_x - 5, mid_y + 12, 12, gate_x + 5, mid_y + 16, 24, m["brass"], bevel=0.8)
        cyl("lock-padlock-shackle", (gate_x - 3, mid_y + 14, 24), (gate_x + 3, mid_y + 14, 24), 1.4, m["chain"], n=6)
    # Open: each leaf swings 90 degrees on its hinge post to lie along the
    # eastern approach, where its face turns toward the camera.
    for state_side, y_post, leaf_from, leaf_to, swing in (
        ("open-north", ny, 7, mid_y - ny - 1, -90), ("open-south", sy, -7, mid_y - sy + 1, 90)):
        with layer("moving", state_side):
            pivot = hinge(f"lock-gate-{state_side}", gate_x, y_post, 0.0, (0.0, 0.0, math.radians(swing)))
            with layer("moving", state_side, parent=pivot):
                gate_leaf("lock-gate-leaf", leaf_from, leaf_to)
            inward = 1 if y_post == ny else -1
            hang = [(gate_x - 8, y_post + inward * 9, 40), (gate_x - 9, y_post + inward * 11, 22), (gate_x - 8, y_post + inward * 9, 6)]
            rope("lock-chain-hanging", hang, 1.5, m["chain"])


def build_log_bridge(d, m):
    x0, y0, x1, y1 = d["rect"]
    water = -6.0
    width = y1 - y0
    with layer("deck"):
        for x in (x0 + 10, x1 - 10):
            cyl("log-sill", (x, y0 - 26, -17), (x, y1 + 26, -17), 12.0, m["bark"], n=12)
        logs = 8
        for i in range(logs):
            y = y0 - 14 + (width + 28) * i / (logs - 1)
            cyl("log-stringer", (x0 - 14, y, -14), (x1 + 14, y, -14), 11.5, m["bark"], n=12)
            for x in (x0 - 14, x1 + 14):
                cyl("log-end", (x - 0.6, y, -14), (x + 0.6, y, -14), 10.5, m["end-grain"], n=12)
        rng = rng_for("log-planks")
        count = int((x1 - x0 + 16) // 14)
        for i in range(count):
            x = x0 - 8 + 7 + i * 14
            extra_a = rng.random() * 9
            extra_b = rng.random() * 9
            ya = y0 - 4 - extra_a
            yb = y1 + 4 + extra_b
            plank = box("log-plank", x, (ya + yb) / 2, -1.5 + (rng.random() - 0.5) * 0.8, 12.5, yb - ya, 3, m["timber-y"], bevel=0.6)
            plank.rotation_euler = (0.0, 0.0, math.radians((rng.random() - 0.5) * 2.4))
        for x in (x0 - 4, x1 + 4):
            for y in (y0 - 34, y1 + 34):
                boulder("log-bank-stone", x, y, 1, 16, 12, 8, m["stone"], seed=int(x * 3 + y))
        for y in (y0 + width * 0.2, y0 + width * 0.6):
            boxr("log-ripple", x0 + 30, y - 2, water - 0.3, x1 - 30, y + 2, water + 0.3, m["foam"])


def build_bascule(d, m, leaf_angles):
    x0, y0, x1, y1 = d["rect"]
    wx, ex = x0 - 30, x1 + 30
    water = -24.0
    hinge_y = y1
    with layer("deck"):
        boxr("bascule-hinge-pier", x0 - 84, y1 + 2, water - 4, x1 + 84, y1 + 96, 0, m["concrete"], bevel=1.0)
        boxr("bascule-pier-plate", x0 - 44, y1 + 2, -1, x1 + 44, y1 + 30, 0.4, m["deck-plate"])
        for x in (x0 - 58, x1 + 58):
            boxr("bascule-trunnion-housing", x - 14, y1 - 12, 0, x + 14, y1 + 26, 26, m["leaf-red"], bevel=1.0)
            cyl("bascule-trunnion", (x - 18, hinge_y, 14), (x + 18, hinge_y, 14), 9.0, m["iron"], n=14)
        boxr("bascule-rest-pier", x0 - 64, y0 - 44, water - 4, x1 + 64, y0 + 1, 0, m["concrete"], bevel=1.0)
        boxr("bascule-leaf-seat", x0 - 44, y0 - 8, -3, x1 + 44, y0 + 1, 0.4, m["iron"], bevel=0.4)
        for i in range(10):
            x = x0 - 50 + (x1 - x0 + 100) * i / 9
            boxr("bascule-fender", x - 4, y0 + 1, water - 2, x + 4, y0 + 7, -4, m["creosote"], bevel=0.4)
        boxr("bascule-waterline", x0 - 60, y0 + 1, water - 0.5, x1 + 60, y0 + 8, water + 5, m["wet"])
        boxr("bascule-foam", x0 - 60, y0 + 8, water - 0.4, x1 + 60, y0 + 16, water + 0.4, m["foam"])
        for x in (x0 - 110, x1 + 110):
            for y in (y0 - 20, y1 + 24):
                cyl("bascule-bollard", (x, y, 0), (x, y, 14), 6.5, m["iron"], n=10)
    with layer("near"):
        cx0, cx1 = x1 + 92, x1 + 176
        cy0, cy1 = y1 + 14, y1 + 86
        boxr("bascule-cabin-walls", cx0, cy0, 0, cx1, cy1, 56, m["brick"], bevel=0.8)
        boxr("bascule-cabin-roof", cx0 - 6, cy0 - 6, 56, cx1 + 6, cy1 + 6, 63, m["concrete"], bevel=1.0)
        for wx0 in (cx0 + 10, cx0 + 36, cx0 + 62):
            boxr("bascule-cabin-window", wx0, cy1, 26, wx0 + 16, cy1 + 1.2, 44, m["window"])
        boxr("bascule-cabin-door", cx0 + 4, cy0 - 1, 0, cx0 + 4 + 0.1, cy0, 0.1, m["iron"])
        for i in range(6):
            boxr("bascule-cabin-hazard", cx0 + i * (cx1 - cx0) / 6, cy1, 2, cx0 + (i + 1) * (cx1 - cx0) / 6, cy1 + 1.4, 8, m["hazard-yellow" if i % 2 == 0 else "hazard-black"])
        for x in (x0 - 76, x1 + 76):
            lamp_post("bascule-lamp", x, y1 + 70, m, height=92)

    def leaf(state, angle):
        pivot = hinge(f"bascule-leaf-{state}", (x0 + x1) / 2, hinge_y, 0.0, (math.radians(-angle), 0.0, 0.0))
        with layer("moving", state, parent=pivot):
            length = y1 - y0 - 2
            half_w = (x1 - x0) / 2
            boxr("bascule-leaf-plate", -half_w - 44, -length, -3, half_w + 44, 0, 0, m["deck-plate"])
            for gx in (-half_w - 38, half_w + 38):
                boxr("bascule-leaf-girder", gx - 5, -length, -22, gx + 5, -14, 0.5, m["leaf-red"], bevel=0.6)
            for i in range(7):
                gy = -length + 12 + (length - 40) * i / 6
                boxr("bascule-leaf-floor-beam", -half_w - 34, gy - 4, -18, half_w + 34, gy + 4, -3, m["leaf-red"], bevel=0.4)
            stripes = 12
            for i in range(stripes):
                sx0 = -half_w - 44 + (x1 - x0 + 88) * i / stripes
                sx1 = -half_w - 44 + (x1 - x0 + 88) * (i + 1) / stripes
                boxr("bascule-leaf-tip-stripe", sx0, -length, -3, sx1, -length + 10, 0.6, m["hazard-yellow" if i % 2 == 0 else "hazard-black"])
            for gx in (-half_w - 30, half_w + 30):
                posts = 7
                for i in range(posts + 1):
                    gy = -length + 20 + (length - 40) * i / posts
                    boxr("bascule-rail-post", gx - 2.5, gy - 2.5, 0, gx + 2.5, gy + 2.5, 38, m["steel-grey"], bevel=0.4)
                cyl("bascule-rail-top", (gx, -length + 20, 36), (gx, -20, 36), 2.4, m["steel-grey"], n=8)
                cyl("bascule-rail-mid", (gx, -length + 20, 19), (gx, -20, 19), 1.8, m["steel-grey"], n=8)

    for state, angle in leaf_angles:
        with layer("moving", state):
            leaf(state, angle)


# --- rendering -------------------------------------------------------------

def configure_scene(manifest):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    render = manifest["render"]
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = render["samples"]
    scene.cycles.use_adaptive_sampling = False
    scene.cycles.use_denoising = bool(render["denoise"])
    if render["denoise"]:
        scene.cycles.denoiser = "OPENIMAGEDENOISE"
    scene.cycles.seed = 0
    scene.cycles.max_bounces = 4
    scene.render.threads_mode = "FIXED"
    scene.render.threads = render["threads"]
    scene.render.film_transparent = True
    scene.render.dither_intensity = 0.0
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 15
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = "AgX"
    for look in ("AgX - Medium High Contrast", "Medium High Contrast"):
        try:
            scene.view_settings.look = look
            break
        except TypeError:
            continue
    scene.view_settings.exposure = render["exposure"]
    world = bpy.data.worlds.new("HMH_Bridge_Kit_World")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.05, 0.06, 0.08, 1.0)
    world.node_tree.nodes["Background"].inputs[1].default_value = render["worldStrength"]
    scene.world = world

    global ROOT
    ROOT = bpy.data.objects.new("HMH_Bridge_Kit_Oblique_Root", None)
    scene.collection.objects.link(ROOT)
    ROOT.scale = (S, -S / SIN_E, S / COS_E)

    cam_data = bpy.data.cameras.new("HMH_Bridge_Kit_Camera")
    cam_data.type = "ORTHO"
    cam_data.clip_start = 0.01
    cam_data.clip_end = 2000.0
    camera = bpy.data.objects.new("HMH_Bridge_Kit_Camera", cam_data)
    camera.rotation_euler = (math.radians(90.0) - ELEVATION, 0.0, 0.0)
    scene.collection.objects.link(camera)
    scene.camera = camera

    directions = render["lightDirections"]
    for channel, color, energy in shared_light_channels(LIGHT_FAMILY):
        data = bpy.data.lights.new(f"HMH_Bridge_Kit_{channel}", type="SUN")
        data.energy = energy
        data.color = color
        data.angle = math.radians(render["sunAngleDegrees"][channel])
        obj = bpy.data.objects.new(f"HMH_Bridge_Kit_{channel}", data)
        obj.rotation_euler = Vector(directions[channel]).normalized().to_track_quat("-Z", "Y").to_euler()
        obj.location = (0.0, 0.0, 50.0)
        scene.collection.objects.link(obj)
    return scene, camera


def add_catchers(d, m):
    x0, y0, x1, y1 = d["rect"]
    under = d["under"]
    span_y = d.get("span", "x") == "y"
    with layer("catcher"):
        if span_y:
            for ya, yb in ((y0 - 260, y0 + 14), (y1 - 8, y1 + 260)):
                boxr("catcher-land", x0 - 260, ya, -1.0, x1 + 260, yb, -0.2, m["catcher"])
        else:
            for xa, xb in ((x0 - 260, x0 + 10), (x1 - 10, x1 + 260)):
                boxr("catcher-land", xa, y0 - 260, -1.0, xb, y1 + 260, -0.2, m["catcher"])
        if under in ("deep", "shallow"):
            level = -24.0 if under == "deep" else -6.0
            boxr("catcher-water", x0 - 60, y0 - 260, level - 0.8, x1 + 60, y1 + 260, level, m["catcher"])
    for obj in COLLECTIONS[CTX["crossing"]].objects:
        if obj.get("hmh_layer") == "catcher":
            obj.is_shadow_catcher = True


def game_screen_bounds(objs, depsgraph):
    xs, ys = [], []
    for obj in objs:
        if obj.type not in {"MESH", "CURVE"}:
            continue
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        mw = evaluated.matrix_world
        for v in mesh.vertices:
            w = mw @ v.co
            xs.append(w.x / S)
            ys.append(-(w.y * SIN_E + w.z * COS_E) / S)
        evaluated.to_mesh_clear()
    return min(xs), min(ys), max(xs), max(ys)


def frame_rules(d, layer_name, state):
    """Draw band, depth key and fade for one frame (see bridge-kit.mjs)."""
    x0, y0, x1, y1 = d["rect"]
    span_y = d.get("span", "x") == "y"
    near_y = y1 + 30 if not span_y else y1 + 86
    rule = {"band": "ground", "sortY": None, "fadeWhenHeroOnDeck": 1.0}
    if layer_name == "near":
        rule = {"band": "actors", "sortY": near_y, "fadeWhenHeroOnDeck": d.get("nearFade", 1.0)}
    elif layer_name == "overhead":
        rule = {"band": "overhead", "sortY": None, "fadeWhenHeroOnDeck": d.get("overheadFade", 0.25)}
    elif layer_name == "moving":
        spec = d["movingParts"]["states"][state]
        rule = {"band": spec["band"], "sortY": spec.get("sortY"), "fadeWhenHeroOnDeck": 1.0}
    return rule


def render_frames(scene, camera, manifest, decks, raw_dir, scale):
    density = manifest["render"]["pixelDensity"] * scale
    depsgraph = bpy.context.evaluated_depsgraph_get()
    frames = []
    all_objs = [o for o in bpy.data.objects if o.get("hmh_crossing")]
    for d in decks:
        cid = d["id"]
        mine = [o for o in all_objs if o["hmh_crossing"] == cid]
        combos = sorted({(o["hmh_layer"], o["hmh_state"]) for o in mine if o["hmh_layer"] != "catcher"},
                        key=lambda item: (["deck", "near", "overhead", "moving"].index(item[0]), item[1]))
        static_casters = [o for o in mine if o["hmh_state"] == "static" and o["hmh_layer"] != "catcher"]
        for layer_name, state in combos:
            visible = [o for o in mine if o["hmh_layer"] == layer_name and o["hmh_state"] == state]
            catch = layer_name == "deck" and state == "static"
            for o in all_objs:
                o.hide_render = True
            for o in static_casters:
                o.hide_render = False
                o.visible_camera = False
                o.visible_shadow = True
            for o in visible:
                o.hide_render = False
                o.visible_camera = True
                o.visible_shadow = True
            for o in mine:
                if o["hmh_layer"] == "catcher":
                    o.hide_render = not catch
                    o.visible_camera = True
            bpy.context.view_layer.update()
            depsgraph = bpy.context.evaluated_depsgraph_get()
            bx0, by0, bx1, by1 = game_screen_bounds(visible, depsgraph)
            margin = 64 if catch else 14
            # Snap to whole texels so the pixel grid maps to game units exactly.
            step = max(1.0, 1.0 / density)
            sx0 = math.floor((bx0 - margin) / step) * step
            sy0 = math.floor((by0 - margin) / step) * step
            sx1 = math.ceil((bx1 + margin) / step) * step
            sy1 = math.ceil((by1 + margin) / step) * step
            width_px = int(round((sx1 - sx0) * density))
            height_px = int(round((sy1 - sy0) * density))
            if max(width_px, height_px) > 2048 * scale + 1:
                raise RuntimeError(f"{cid} {layer_name} {state} frame {width_px}x{height_px} exceeds 2048")
            scene.render.resolution_x = width_px
            scene.render.resolution_y = height_px
            camera.data.ortho_scale = max(sx1 - sx0, sy1 - sy0) * S
            cx, cy = (sx0 + sx1) / 2, (sy0 + sy1) / 2
            center = ROOT.matrix_world @ Vector((cx, cy, 0.0))
            direction = Vector((0.0, COS_E, -SIN_E))
            camera.location = center - direction * 500.0
            bpy.context.view_layer.update()
            frame_id = f"{cid}.{layer_name}.{state}"
            path = raw_dir / f"{frame_id}.png"
            scene.render.filepath = str(path)
            bpy.ops.render.render(write_still=True)
            probes = []
            x0, y0, x1, y1 = d["rect"]
            z = d["z"]
            for px, py in ((x0, y0), (x1, y0), (x0, y1), (x1, y1), ((x0 + x1) / 2, (y0 + y1) / 2)):
                projected = world_to_camera_view(scene, camera, ROOT.matrix_world @ Vector((px, py, z)))
                probes.append({
                    "world": [px, py, z],
                    "pixel": [projected.x * width_px, (1.0 - projected.y) * height_px],
                    "expected": [(px - sx0) * density, (py - z - sy0) * density],
                })
            rules = frame_rules(d, layer_name, state)
            frames.append({
                "id": frame_id, "crossing": cid, "layer": layer_name, "state": state, "file": path.name,
                "screenOrigin": {"x": sx0, "y": sy0}, "screenSize": {"w": sx1 - sx0, "h": sy1 - sy0},
                "pixelSize": {"w": width_px, "h": height_px}, "pixelDensity": density,
                "objectCount": len(visible), "castsCatcherShadows": catch, "probes": probes, **rules,
            })
            print(f"[bridge-kit] rendered {frame_id} {width_px}x{height_px}", flush=True)
    for o in all_objs:
        o.hide_render = False
        o.visible_camera = True
    return frames


def main():
    args = blender_args()
    manifest_path = Path(args.manifest).resolve()
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    decks = [d for d in manifest["crossings"] if not args.only or d["id"] in args.only.split(",")]
    scene, camera = configure_scene(manifest)
    rig = load_shared_light_rig()
    mats = build_materials(tuple(rig["colors"]["rim"]))
    sway = manifest["sway"]
    for d in decks:
        coll = bpy.data.collections.new(f"HMH_Bridge_{d['id']}")
        scene.collection.children.link(coll)
        COLLECTIONS[d["id"]] = coll
        CTX.update({"crossing": d["id"], "layer": "deck", "state": "static", "parent": None})
        style = d["style"]
        if style == "stone-arch-viaduct":
            build_viaduct(d, mats)
        elif style == "plank-suspension":
            build_rope_bridge(d, mats, sway)
        elif style == "stone-arch":
            build_old_mill(d, mats)
        elif style == "steel-through-truss":
            build_truss(d, mats)
        elif style == "timber-trestle":
            build_trestle(d, mats)
        elif style == "steel-lock-gate":
            build_lock_gate(d, mats)
        elif style == "log-and-plank":
            build_log_bridge(d, mats)
        elif style == "steel-bascule":
            angles = [(state, spec["angleDegrees"]) for state, spec in d["movingParts"]["states"].items()]
            build_bascule(d, mats, angles)
        else:
            raise RuntimeError(f"unknown bridge style {style}")
        add_catchers(d, mats)
    blend = Path(args.source_blend).resolve()
    blend.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(blend), compress=True)
    backup = blend.with_suffix(blend.suffix + "1")
    if backup.exists():
        backup.unlink()
    frames = []
    if not args.skip_render:
        raw = Path(args.raw_output).resolve()
        raw.mkdir(parents=True, exist_ok=True)
        for stale in raw.glob("*.png"):
            stale.unlink()
        frames = render_frames(scene, camera, manifest, decks, raw, args.scale)
    inventory = {cid: dict(sorted(uses.items())) for cid, uses in sorted(MODULE_USE.items())}
    report = {
        "schema": "hmh-bridge-kit-render-report-v1",
        "blenderVersion": bpy.app.version_string,
        "cameraElevationDegrees": 35.0,
        "projection": "screen = (x, y - z) * pixelDensity; world-space.mjs heightToScreenY 1",
        "lightFamily": LIGHT_FAMILY,
        "scale": args.scale,
        "sharedMeshCount": len(MESHES),
        "moduleInventory": inventory,
        "frames": frames,
    }
    out = Path(args.report_output).resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps({"status": "pass", "frames": len(frames), "sharedMeshes": len(MESHES)}), flush=True)


if __name__ == "__main__":
    main()
