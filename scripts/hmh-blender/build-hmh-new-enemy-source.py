"""Turn one owner-supplied unrigged Tripo GLB into an editable, skinned new-enemy source.

The owner's GLB is opened read-only and never modified. This derivative gets:
front-figure extraction for turnaround sheets, ground-contact normalisation,
a measured 19-bone humanoid rig matching the shipped native enemies, bone-heat
skin weights (nearest-segment fallback), role costume geometry, a palette
material for untextured bodies, and the six retargeted role actions the roster
pipeline already authors. Projection-only: no collision, damage, AI, RNG,
spawning or progression is read or written here.
"""
import argparse
import hashlib
import importlib.util
import json
import math
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Euler, Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
import hmh_enemy_poses as poses
from hmh_native_roster_poses import native_role_pose
from hmh_new_enemy_casting import CASTING, OWNER_ASSET_ROOT, casting

spec = importlib.util.spec_from_file_location("props", ROOT / "scripts/hmh-blender/create-hmh-authored-props.py")
props = importlib.util.module_from_spec(spec)
spec.loader.exec_module(props)

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--actor", required=True, choices=list(CASTING))
parser.add_argument("--output", required=True)
parser.add_argument("--source-triangles", type=int, default=60000)
args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
cast = casting(args.actor)
actor_id = args.actor
source = Path(OWNER_ASSET_ROOT) / cast["sourceFile"]
source_bytes = source.read_bytes()
source_sha = hashlib.sha256(source_bytes).hexdigest()
if source_sha != cast["sourceSha256"]:
    raise ValueError("Owner source GLB identity changed: " + cast["sourceFile"])
output = Path(args.output).resolve()
if not output.is_relative_to(ROOT / ".tmp") or output.exists():
    raise ValueError("Use a fresh private new-enemy candidate output under .tmp")
output.mkdir(parents=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 24
collection = scene.collection


def select_only(objects, active=None):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.hide_set(False)
        obj.select_set(True)
    bpy.context.view_layer.objects.active = active or objects[0]


def triangles(obj):
    return sum(len(polygon.vertices) - 2 for polygon in obj.data.polygons)


def decimate(obj, target):
    count = triangles(obj)
    if count <= target:
        return count
    select_only([obj])
    modifier = obj.modifiers.new("Source density", "DECIMATE")
    modifier.ratio = target / count
    modifier.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.data.validate(clean_customdata=False)
    return triangles(obj)


# --- import and figure extraction -----------------------------------------
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=str(source), import_pack_images=True, import_shading="NORMALS",
                          merge_vertices=True, disable_bone_shape=True)
imported = [obj for obj in bpy.data.objects if obj not in before]
meshes = [obj for obj in imported if obj.type == "MESH"]
if not meshes:
    raise RuntimeError("Owner GLB produced no meshes")
for obj in imported:
    if obj.type != "MESH":
        for child in list(obj.children):
            matrix = child.matrix_world.copy()
            child.parent = None
            child.matrix_world = matrix
select_only(meshes, meshes[0])
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
helper_names = [obj.name for obj in imported if obj.type != "MESH"]
if len(meshes) > 1:
    bpy.ops.object.join()
body = bpy.context.object
for name in helper_names:
    if name in bpy.data.objects:
        bpy.data.objects.remove(bpy.data.objects[name], do_unlink=True)
imported_triangles = triangles(body)
# A first pass keeps the sheet separation cheap; the extracted figure gets its
# own density pass below.
decimate(body, max(args.source_triangles * 4, 240000))
select_only([body])
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.separate(type="LOOSE")
bpy.ops.object.mode_set(mode="OBJECT")
parts = [obj for obj in bpy.context.selected_objects if obj.type == "MESH"]


def bounds(obj):
    corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    return Vector(tuple(min(c[a] for c in corners) for a in range(3))), Vector(tuple(max(c[a] for c in corners) for a in range(3)))


part_bounds = {obj.name: bounds(obj) for obj in parts}
tallest = max(hi.z - lo.z for lo, hi in part_bounds.values())
# Loose parts that touch (within a small tolerance) belong to one figure:
# turnaround sheets place their figures, busts and props well apart.
tolerance = tallest * 0.02
parent = list(range(len(parts)))


def find(index):
    while parent[index] != index:
        parent[index] = parent[parent[index]]
        index = parent[index]
    return index


for i in range(len(parts)):
    lo_i, hi_i = part_bounds[parts[i].name]
    for j in range(i + 1, len(parts)):
        lo_j, hi_j = part_bounds[parts[j].name]
        if all(lo_i[a] - tolerance <= hi_j[a] and lo_j[a] - tolerance <= hi_i[a] for a in range(3)):
            parent[find(i)] = find(j)
clusters = {}
for index, obj in enumerate(parts):
    clusters.setdefault(find(index), []).append(obj)
cluster_bounds = {}
for key, objects in clusters.items():
    lows = [part_bounds[o.name][0] for o in objects]
    highs = [part_bounds[o.name][1] for o in objects]
    cluster_bounds[key] = (Vector(tuple(min(v[a] for v in lows) for a in range(3))), Vector(tuple(max(v[a] for v in highs) for a in range(3))))
cluster_height = max(hi.z - lo.z for lo, hi in cluster_bounds.values())
candidate_keys = [key for key, (lo, hi) in cluster_bounds.items() if hi.z - lo.z >= 0.72 * cluster_height]
figure_key = min(candidate_keys, key=lambda key: (cluster_bounds[key][0].x + cluster_bounds[key][1].x) * 0.5)
members = clusters[figure_key]
figure = max(members, key=triangles)
lo, hi = cluster_bounds[figure_key]
discarded = [obj.name for obj in parts if obj not in members]
largest_parts = sorted(parts, key=lambda obj: -triangles(obj))[:12]
part_report = [{"triangles": triangles(obj), "kept": obj in members, "min": [round(v, 3) for v in part_bounds[obj.name][0]],
                "max": [round(v, 3) for v in part_bounds[obj.name][1]]} for obj in largest_parts]
for obj in parts:
    if obj not in members:
        bpy.data.objects.remove(obj, do_unlink=True)
select_only(members, figure)
if len(members) > 1:
    bpy.ops.object.join()
body = bpy.context.object
body.name = actor_id + " Skinned Primary Body Mesh"
body.data.name = body.name
figure_extraction = {"looseParts": len(parts), "clusters": len(clusters), "kept": len(members), "discarded": len(discarded),
                     "sheet": len(discarded) > 0, "largestParts": part_report}
source_triangles = decimate(body, args.source_triangles)
select_only([body])
bpy.ops.object.shade_smooth()

# --- normalise: feet at z=0, centred, target height -------------------------
lo, hi = bounds(body)
raw_height = hi.z - lo.z
scale = cast["height"] / raw_height
body.matrix_world = Matrix.Scale(scale, 4) @ Matrix.Translation(Vector((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z)))
select_only([body])
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
H = cast["height"]
V = np.empty(len(body.data.vertices) * 3, dtype=np.float32)
body.data.vertices.foreach_get("co", V)
V = V.reshape(-1, 3)


# --- landmark analysis ------------------------------------------------------
def band(z, half=0.012):
    mask = np.abs(V[:, 2] - z * H) < half * H
    return V[mask]


def blobs(points, gap=0.012):
    if len(points) == 0:
        return []
    order = np.argsort(points[:, 0])
    xs = points[order, 0]
    splits = np.where(np.diff(xs) > gap * H)[0] + 1
    groups = np.split(order, splits)
    result = []
    for group in groups:
        pts = points[group]
        result.append({"x": float(pts[:, 0].mean()), "y": float(pts[:, 1].mean()), "xmin": float(pts[:, 0].min()),
                       "xmax": float(pts[:, 0].max()), "ymin": float(pts[:, 1].min()), "ymax": float(pts[:, 1].max()), "count": int(len(pts))})
    return [b for b in result if b["count"] >= 4]


def torso_blob(items):
    return min(items, key=lambda b: abs(b["x"]))


arm_rows = []
for step in range(28, 88):
    z = step / 100
    items = blobs(band(z))
    torso = torso_blob(items) if items else None
    outer_l = [b for b in items if b["xmin"] > (torso["xmax"] if torso else 0) + 0.005 * H]
    outer_r = [b for b in items if b["xmax"] < (torso["xmin"] if torso else 0) - 0.005 * H]
    if torso and outer_l and outer_r and torso["count"] >= 12:
        left = max(outer_l, key=lambda b: b["x"])
        right = min(outer_r, key=lambda b: b["x"])
        arm_rows.append((z, left, right, torso))
landmarks = {"armDetected": len(arm_rows) >= 8}
if landmarks["armDetected"]:
    z_wrist = arm_rows[0][0]
    z_sep = arm_rows[-1][0]
    z_elbow = z_wrist + (z_sep - z_wrist) * 0.5
    row_at = lambda z: min(arm_rows, key=lambda row: abs(row[0] - z))
    wrist = row_at(z_wrist + 0.015)
    elbow = row_at(z_elbow)
    top = row_at(z_sep - 0.01)
    shoulder_z = min(0.83, z_sep + 0.025)
    arm = {
        "L": {"shoulder": (top[1]["x"] * 0.92, top[1]["y"], shoulder_z * H), "elbow": (elbow[1]["x"], elbow[1]["y"], z_elbow * H),
              "wrist": (wrist[1]["x"], wrist[1]["y"], (z_wrist + 0.02) * H), "hand": (wrist[1]["x"], wrist[1]["y"], (z_wrist - 0.045) * H)},
        "R": {"shoulder": (top[2]["x"] * 0.92, top[2]["y"], shoulder_z * H), "elbow": (elbow[2]["x"], elbow[2]["y"], z_elbow * H),
              "wrist": (wrist[2]["x"], wrist[2]["y"], (z_wrist + 0.02) * H), "hand": (wrist[2]["x"], wrist[2]["y"], (z_wrist - 0.045) * H)},
    }
else:
    arm = {side: {"shoulder": (s * 0.20 / 1.75 * H, 0, 0.80 * H), "elbow": (s * 0.30 / 1.75 * H, 0, 0.62 * H),
                  "wrist": (s * 0.34 / 1.75 * H, 0, 0.47 * H), "hand": (s * 0.36 / 1.75 * H, 0, 0.40 * H)} for side, s in (("L", 1), ("R", -1))}


def leg_blob(z, side):
    items = blobs(band(z))
    inner = sorted(items, key=lambda b: abs(b["x"]))[:2]
    if len(inner) < 2:
        return None
    inner.sort(key=lambda b: b["x"])
    return inner[1] if side == "L" else inner[0]


legs = {}
leg_detected = True
for side, sign in (("L", 1), ("R", -1)):
    hip = leg_blob(0.44, side)
    knee = leg_blob(0.27, side)
    ankle = leg_blob(0.08, side)
    if not (hip and knee and ankle) or (sign * hip["x"] <= 0.01 * H):
        leg_detected = False
        legs[side] = {"hip": (sign * 0.11 / 1.75 * H, 0, 0.49 * H), "knee": (sign * 0.13 / 1.75 * H, 0, 0.26 * H),
                      "ankle": (sign * 0.13 / 1.75 * H, 0, 0.05 * H), "toe": (sign * 0.13 / 1.75 * H, -0.09 * H, 0.01 * H)}
    else:
        legs[side] = {"hip": (hip["x"] * 0.9, hip["y"], 0.50 * H), "knee": (knee["x"], knee["y"], 0.27 * H),
                      "ankle": (ankle["x"], ankle["y"], 0.06 * H), "toe": (ankle["x"], ankle["y"] - 0.09 * H, 0.012 * H)}
landmarks["legDetected"] = leg_detected
neck_rows = []
for step in range(80, 94):
    items = blobs(band(step / 100))
    if len(items) == 1:
        neck_rows.append((items[0]["xmax"] - items[0]["xmin"], step / 100, items[0]["y"]))
if neck_rows:
    _, z_neck, y_neck = min(neck_rows)
    z_neck = max(0.80, min(0.90, z_neck))
else:
    z_neck, y_neck = 0.85, 0.0
torso_rows = blobs(band(0.62))
y_torso = torso_blob(torso_rows)["y"] if torso_rows else 0.0
chest_rows = blobs(band(0.70))
chest_blob = torso_blob(chest_rows) if chest_rows else {"ymin": y_torso - 0.13 * H / 1.75, "ymax": y_torso + 0.14 * H / 1.75}
head_rows = blobs(band(0.95))
y_head = torso_blob(head_rows)["y"] if head_rows else y_neck
landmarks.update({"neckZ": z_neck, "torsoY": y_torso, "rawHeight": raw_height, "scale": scale})

# --- armature ----------------------------------------------------------------
armature_data = bpy.data.armatures.new(actor_id + " Native Rig")
rig = bpy.data.objects.new(actor_id + " Native Rig", armature_data)
collection.objects.link(rig)
rig.rotation_mode = "XYZ"
select_only([rig])
bpy.ops.object.mode_set(mode="EDIT")
edit = armature_data.edit_bones
FORWARD = Vector((0, -1, 0))


def bone(name, head, tail, parent=None, roll_axis=None, deform=True):
    item = edit.new(name)
    item.head = Vector(head)
    item.tail = Vector(tail)
    if parent is not None:
        item.parent = edit[parent]
    if roll_axis is not None:
        item.align_roll(Vector(roll_axis))
    item.use_deform = deform
    return item


bone("root", (0, 0, 0), (0, 0, 0.1 * H), deform=False)
bone("pelvis", (0, y_torso, 0.50 * H), (0, y_torso, 0.57 * H), "root", FORWARD)
bone("spine", (0, y_torso, 0.57 * H), (0, y_torso, 0.63 * H), "pelvis", FORWARD)
bone("chest", (0, y_torso, 0.63 * H), (0, y_neck, z_neck * H), "spine", FORWARD)
bone("neck", (0, y_neck, z_neck * H), (0, y_neck, (z_neck + 0.035) * H), "chest", FORWARD)
bone("head", (0, y_neck, (z_neck + 0.035) * H), (0, y_head, 0.985 * H), "neck", FORWARD)
for side in ("L", "R"):
    a = arm[side]
    bone(f"upper_arm.{side}", a["shoulder"], a["elbow"], "chest", FORWARD)
    bone(f"forearm.{side}", a["elbow"], a["wrist"], f"upper_arm.{side}", FORWARD)
    bone(f"hand.{side}", a["wrist"], a["hand"], f"forearm.{side}", FORWARD)
    leg = legs[side]
    bone(f"thigh.{side}", leg["hip"], leg["knee"], "pelvis", FORWARD)
    bone(f"shin.{side}", leg["knee"], leg["ankle"], f"thigh.{side}", FORWARD)
    bone(f"foot.{side}", leg["ankle"], leg["toe"], f"shin.{side}", (0, 0, 1))
wrist_r = Vector(arm["R"]["wrist"])
bone("weapon_socket", wrist_r, wrist_r + FORWARD * 0.12 * H, "forearm.R", (0, 0, 1), deform=False)
bpy.ops.object.mode_set(mode="OBJECT")
for pose_bone in rig.pose.bones:
    pose_bone.rotation_mode = "XYZ"
height = armature_data.bones["head"].tail_local.z + 0.02
unit = H / 1.75

# --- skin weights -------------------------------------------------------------
body["hmh_actor_id"] = actor_id
body["hmh_layer"] = "body"
body["hmh_native_body"] = True
body["hmh_primary_skinned_body"] = True
select_only([body, rig], rig)
weight_method = "bone-heat"
try:
    bpy.ops.object.parent_set(type="ARMATURE_AUTO")
except RuntimeError as error:
    weight_method = "nearest-segment (" + str(error).strip() + ")"
deform_names = [b.name for b in armature_data.bones if b.use_deform]
group_index = {group.name: group.index for group in body.vertex_groups}
totals = np.zeros(len(body.data.vertices))
for vertex in body.data.vertices:
    totals[vertex.index] = sum(item.weight for item in vertex.groups if item.group in group_index.values())
unweighted = int(np.count_nonzero(totals < 1e-4))
if body.parent is not rig or unweighted > len(totals) * 0.02:
    weight_method = "nearest-segment"
    for group in list(body.vertex_groups):
        body.vertex_groups.remove(group)
    heads = np.array([armature_data.bones[n].head_local for n in deform_names])
    tails = np.array([armature_data.bones[n].tail_local for n in deform_names])
    axis = tails - heads
    length = np.maximum((axis ** 2).sum(1), 1e-9)
    distances = np.empty((len(V), len(deform_names)))
    for index in range(len(deform_names)):
        t = np.clip(((V - heads[index]) @ axis[index]) / length[index], 0, 1)
        closest = heads[index] + t[:, None] * axis[index]
        distances[:, index] = np.linalg.norm(V - closest, axis=1)
    order = np.argsort(distances, axis=1)[:, :2]
    d0 = distances[np.arange(len(V)), order[:, 0]]
    d1 = distances[np.arange(len(V)), order[:, 1]]
    blend = np.clip((d1 - d0) / (0.06 * H), 0, 1)
    w0 = 0.5 + 0.5 * blend
    groups = {name: body.vertex_groups.new(name=name) for name in deform_names}
    for index in range(len(V)):
        groups[deform_names[order[index, 0]]].add([index], float(w0[index]), "REPLACE")
        if w0[index] < 0.999:
            groups[deform_names[order[index, 1]]].add([index], float(1 - w0[index]), "REPLACE")
    modifier = next((m for m in body.modifiers if m.type == "ARMATURE"), None) or body.modifiers.new("Native skinning", "ARMATURE")
    modifier.object = rig
    body.parent = rig
    body.matrix_parent_inverse = Matrix.Identity(4)
    select_only([body])
    bpy.ops.object.vertex_group_smooth(group_select_mode="ALL", factor=0.5, repeat=4, expand=0.0)
    unweighted = 0
for group in list(body.vertex_groups):
    if group.name not in deform_names:
        body.vertex_groups.remove(group)
select_only([body])
bpy.ops.object.vertex_group_limit_total(limit=4)
bpy.ops.object.vertex_group_normalize_all(lock_active=False)
bpy.context.view_layer.update()

# --- materials -------------------------------------------------------------------
textured = any(node.type == "TEX_IMAGE" and node.image for slot in body.material_slots if slot.material and slot.material.node_tree
               for node in slot.material.node_tree.nodes)
if textured != cast["textured"]:
    raise RuntimeError("Casting texture expectation does not match the owner GLB")
if not textured:
    palette = cast["bodyPalette"]
    for slot in body.material_slots:
        if slot.material:
            bpy.data.materials.remove(slot.material)
    body.data.materials.clear()
    mat = props.material(actor_id + "_PaletteBody", palette["torso"], roughness=0.82)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    # The palette is written as a per-vertex colour (height bands plus a
    # deterministic hashed wear), so it survives decimation, the atlas bake
    # and any shader-space ambiguity.
    stops = [(0.0, palette["boot"]), (0.11, palette["leg"]), (0.50, palette["torso"]), (z_neck + 0.02, palette["skin"])]
    linear = lambda colour: np.array([v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in props.rgba(colour)[:3]])
    fraction = V[:, 2] / H
    colours = np.zeros((len(V), 4), dtype=np.float32)
    colours[:, 3] = 1
    for position_value, colour in stops:
        colours[fraction >= position_value, :3] = linear(colour)
    wear = 0.72 + 0.28 * np.abs(np.sin(V[:, 0] * 37.1 + V[:, 1] * 53.7 + V[:, 2] * 29.3) * np.cos(V[:, 2] * 71.3 + V[:, 0] * 17.9))
    colours[:, :3] *= wear[:, None]
    attribute = body.data.color_attributes.new(name="HMH_Palette", type="FLOAT_COLOR", domain="POINT")
    attribute.data.foreach_set("color", colours.reshape(-1))
    vertex_colour = nodes.new("ShaderNodeVertexColor")
    vertex_colour.layer_name = "HMH_Palette"
    links.new(vertex_colour.outputs["Color"], bsdf.inputs["Base Color"])
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 24
    noise.inputs["Detail"].default_value = 5
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.2
    bump.inputs["Distance"].default_value = 0.01
    links.new(noise.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    body.data.materials.append(mat)

# --- role costume geometry --------------------------------------------------------
accent = props.material(actor_id + "_RoleLight", cast["palette"]["accent"], metallic=0.1, emission=0.12, roughness=0.5)
primary = props.material(actor_id + "_RoleCloth", cast["palette"]["primary"], roughness=0.85)
metal = props.material(actor_id + "_Metal", "#5a5248", metallic=0.6, roughness=0.55)
brass = props.material(actor_id + "_Brass", "#b8862d", metallic=0.8, roughness=0.4)
dark = props.material(actor_id + "_Straps", "#141414", roughness=0.8)
white = props.material(actor_id + "_Stripe", "#e8e4dc", roughness=0.7)
red = props.material(actor_id + "_Warning", "#d8281e", roughness=0.7)
for material in (accent, primary, metal, brass, dark, white, red):
    node = material.node_tree.nodes.get("Principled BSDF")
    colour = tuple(node.inputs["Base Color"].default_value)
    node.inputs["Base Color"].default_value = tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in colour[:3]) + (1,)
    if material is accent:
        node.inputs["Emission Color"].default_value = node.inputs["Base Color"].default_value
gear = []


def attach(obj, bone_name):
    bpy.context.view_layer.update()
    matrix = obj.matrix_world.copy()
    obj.parent = rig
    obj.parent_type = "BONE"
    obj.parent_bone = bone_name
    obj.matrix_world = matrix
    obj.hide_render = False
    obj["hmh_actor_id"] = actor_id
    obj["hmh_layer"] = "body"
    obj["hmh_role_gear"] = True
    gear.append(obj)
    return obj


def box(name, location, size, material, bone_name="chest", rotation=(0, 0, 0)):
    return attach(props.cube(actor_id + "_" + name, location, size, material, actor_id, bevel=0.008, rotation=rotation), bone_name)


def cyl(name, location, radius, depth, material, bone_name="chest", rotation=(0, 0, 0)):
    return attach(props.cylinder(actor_id + "_" + name, location, radius, depth, material, actor_id, rotation=rotation, vertices=18), bone_name)


def ring(name, location, major, minor, material, bone_name="chest", rotation=(0, 0, 0)):
    return attach(props.torus(actor_id + "_" + name, location, major, minor, material, actor_id, rotation=rotation), bone_name)


def ball(name, location, size, material, bone_name="head"):
    return attach(props.sphere(actor_id + "_" + name, location, size, material, actor_id), bone_name)


def joint(name):
    return Vector(armature_data.bones[name].head_local)


def hood():
    # Open cloth hood stitched around the sides and back of the head, as the
    # shipped Gas Bomber / Cultist / Liquidator sources build it.
    head_low = joint("head").z
    head_top = 0.985 * H
    bands = [(head_low - 0.02, 0.19, 0.16), (head_low + 0.06, 0.20, 0.17), (head_top - 0.09, 0.19, 0.16), (head_top - 0.02, 0.14, 0.12), (head_top + 0.02, 0.03, 0.04)]
    vertices, faces, segments = [], [], 24
    for z, rx, ry in bands:
        for index in range(segments + 1):
            angle = math.radians(-35 + 250 * index / segments)
            vertices.append((rx * math.cos(angle) * unit, y_head + (0.02 + ry * math.sin(angle)) * unit, z))
    for row in range(len(bands) - 1):
        for index in range(segments):
            a = row * (segments + 1) + index
            faces.append((a, a + 1, a + segments + 2, a + segments + 1))
    mesh = bpy.data.meshes.new("Open cloth hood")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(actor_id + "_OpenHood", mesh)
    collection.objects.link(obj)
    obj.data.materials.append(primary)
    solid = obj.modifiers.new("Folded hood hem", "SOLIDIFY")
    solid.thickness = 0.015 * unit
    for face in mesh.polygons:
        face.use_smooth = True
    attach(obj, "head")


# Measured torso depth at chest height so vests, packs and straps sit on the
# actual armor surface instead of inside it.
chest_front = chest_blob["ymin"] - 0.005 * unit
chest_back = chest_blob["ymax"] + 0.005 * unit
if actor_id == "tollkeeper":
    hand = joint("hand.L")
    # Striped toll barrier carried as a riot shield on the left forearm.
    for index in range(6):
        z = hand.z - 0.30 * unit + index * 0.16 * unit
        box(f"Barrier{index}", (hand.x + 0.06 * unit, hand.y - 0.10 * unit, z), (0.05 * unit, 0.42 * unit, 0.16 * unit), red if index % 2 else white, "forearm.L")
    box("BarrierFrame", (hand.x + 0.03 * unit, hand.y - 0.10 * unit, hand.z + 0.10 * unit), (0.03 * unit, 0.46 * unit, 1.0 * unit), metal, "forearm.L")
    head = joint("head")
    ball("HardHat", (0, y_head, 0.975 * H), (0.135 * unit, 0.15 * unit, 0.055 * unit), accent)
    cyl("HatBrim", (0, y_head, 0.962 * H), 0.165 * unit, 0.014 * unit, accent, "head")
    cyl("Beacon", (0, y_head, 1.01 * H), 0.03 * unit, 0.05 * unit, red, "head")
    box("VestFront", (0, chest_front, 0.70 * H), (0.30 * unit, 0.04 * unit, 0.22 * unit), accent)
    box("VestBack", (0, chest_back, 0.70 * H), (0.30 * unit, 0.04 * unit, 0.22 * unit), accent)
    for x in (-0.08, 0.08):
        box(f"ReflectiveBand{x}", (x * unit, chest_front - 0.005 * unit, 0.70 * H), (0.04 * unit, 0.04 * unit, 0.24 * unit), white)
elif actor_id == "money-printer":
    box("PressBody", (0, chest_back + 0.12 * unit, 0.68 * H), (0.36 * unit, 0.22 * unit, 0.30 * unit), brass)
    box("PressFrame", (0, chest_back + 0.04 * unit, 0.68 * H), (0.34 * unit, 0.05 * unit, 0.34 * unit), dark)
    for z in (0.60, 0.76):
        cyl(f"Roller{z}", (0, chest_back + 0.25 * unit, z * H), 0.05 * unit, 0.38 * unit, metal, "chest", rotation=(0, math.pi / 2, 0))
    box("NoteRoll", (0.10 * unit, chest_back + 0.30 * unit, 0.86 * H), (0.12 * unit, 0.02 * unit, 0.26 * unit), accent, "chest", rotation=(0.35, 0, 0))
    box("NoteTail", (-0.14 * unit, chest_back + 0.20 * unit, 0.52 * H), (0.11 * unit, 0.02 * unit, 0.22 * unit), accent, "chest", rotation=(-0.4, 0, 0.2))
    cyl("Chimney", (0.13 * unit, chest_back + 0.14 * unit, 0.86 * H), 0.035 * unit, 0.16 * unit, brass, "chest")
    for side in (-1, 1):
        box(f"PressStrap{side}", (side * 0.12 * unit, y_torso, 0.74 * H), (0.04 * unit, 0.30 * unit, 0.03 * unit), dark)
    box("Visor", (0, y_head - 0.10 * unit, 0.92 * H), (0.20 * unit, 0.09 * unit, 0.02 * unit), accent, "head", rotation=(0.25, 0, 0))
elif actor_id == "rug-puller":
    shoulder = joint("upper_arm.L")
    rug_centre = (shoulder.x * 0.55, chest_back - 0.02 * unit, shoulder.z + 0.06 * unit)
    cyl("RolledRug", rug_centre, 0.07 * unit, 0.70 * unit, primary, "chest", rotation=(0.25, 1.15, 0))
    for offset in (-0.26, 0.26):
        ring(f"RugTie{offset}", (rug_centre[0] + offset * math.sin(1.15) * unit, rug_centre[1] - offset * 0.20 * unit, rug_centre[2] + offset * math.cos(1.15) * unit), 0.074 * unit, 0.012 * unit, accent, "chest", rotation=(0.25, 1.15, 0))
    hand = joint("hand.R")
    cyl("HookShaft", (hand.x, hand.y - 0.06 * unit, hand.z - 0.10 * unit), 0.016 * unit, 0.24 * unit, metal, "hand.R")
    ring("HookCurve", (hand.x, hand.y - 0.06 * unit, hand.z - 0.24 * unit), 0.06 * unit, 0.014 * unit, metal, "hand.R", rotation=(0, math.pi / 2, 0))
    box("Rope", (hand.x + 0.02 * unit, hand.y - 0.03 * unit, hand.z + 0.06 * unit), (0.02 * unit, 0.02 * unit, 0.20 * unit), accent, "hand.R")
elif actor_id == "pump-and-dump-bloater":
    hand = joint("hand.R")
    cyl("PumpBarrel", (hand.x, hand.y - 0.05 * unit, hand.z - 0.22 * unit), 0.035 * unit, 0.50 * unit, red, "hand.R")
    box("PumpHandle", (hand.x, hand.y - 0.05 * unit, hand.z + 0.05 * unit), (0.16 * unit, 0.03 * unit, 0.03 * unit), dark, "hand.R")
    cyl("PumpFoot", (hand.x, hand.y - 0.05 * unit, hand.z - 0.47 * unit), 0.07 * unit, 0.02 * unit, metal, "hand.R")
    box("Hose", (hand.x + 0.05 * unit, y_torso - 0.16 * unit, 0.58 * H), (0.025 * unit, 0.025 * unit, 0.30 * unit), dark, "chest", rotation=(0.3, 0.6, 0))
    ball("Bloat", (0, y_torso - 0.05 * unit, 0.59 * H), (0.27 * unit, 0.22 * unit, 0.20 * unit), primary, "spine")
    ring("BloatSeam", (0, y_torso - 0.05 * unit, 0.59 * H), 0.25 * unit, 0.012 * unit, accent, "spine")
    box("Tie", (0, y_torso - 0.24 * unit, 0.72 * H), (0.05 * unit, 0.02 * unit, 0.22 * unit), red, "chest", rotation=(0.15, 0, 0))
elif actor_id == "hodl-revenant":
    hood()
    for index in range(7):
        angle = index * math.tau / 7
        ring(f"ChainLink{index}", (math.cos(angle) * 0.24 * unit, y_torso + math.sin(angle) * 0.19 * unit, 0.66 * H - index * 0.012 * H), 0.035 * unit, 0.008 * unit, metal, "chest",
             rotation=(math.pi / 2, 0, angle))
    for side in ("L", "R"):
        wrist = joint(f"hand.{side}")
        ring(f"Shackle{side}", (wrist.x, wrist.y, wrist.z + 0.02 * unit), 0.055 * unit, 0.012 * unit, metal, f"forearm.{side}")
        cyl(f"ChainDrop{side}", (wrist.x, wrist.y, wrist.z - 0.16 * unit), 0.012 * unit, 0.30 * unit, metal, f"forearm.{side}")
    box("Padlock", (0, chest_front, 0.64 * H), (0.08 * unit, 0.04 * unit, 0.10 * unit), accent)
elif actor_id == "oracle-marksman":
    ball("OracleScope", (0.10 * unit, chest_back + 0.07 * unit, 0.79 * H), (0.055 * unit, 0.055 * unit, 0.055 * unit), accent, "chest")
    cyl("ScopeTube", (0.10 * unit, chest_back + 0.07 * unit, 0.72 * H), 0.025 * unit, 0.16 * unit, metal, "chest")
    for index in range(5):
        box(f"GhillieStrip{index}", ((-0.22 + index * 0.11) * unit, chest_back + 0.02 * unit, 0.74 * H - (index % 2) * 0.04 * H), (0.05 * unit, 0.03 * unit, 0.22 * unit), primary, "chest", rotation=(0, 0, (index - 2) * 0.12))
    box("Bipod", (-0.05 * unit, chest_back + 0.10 * unit, 0.52 * H), (0.02 * unit, 0.02 * unit, 0.28 * unit), metal, "chest", rotation=(0, 0.25, 0))
bpy.context.view_layer.update()

# --- retargeted role actions ----------------------------------------------------
profile = cast["animationProfile"]
stoop = cast["stoop"]
source_counts = {"idle": 2, "run": 24, "tell": 2, "attack": 3, "hit": 2, "death": 4}
bindings = {}


def apply_role(state, index, count):
    for pose_bone in rig.pose.bones:
        pose_bone.matrix_basis = Matrix.Identity(4)
    pose = native_role_pose(profile["kind"], profile["damageResponse"], state, index, count, stoop, boss=False)
    for name, values in pose["rotations"].items():
        target_name = "weapon_socket" if name == "prop_socket" else name
        if target_name not in rig.pose.bones:
            continue
        target = armature_data.bones[target_name].matrix_local.to_3x3().normalized()
        original = Matrix(poses.BONE_REST[name][2]).transposed()
        delta = Euler(tuple(math.radians(v) for v in values), "XYZ").to_matrix()
        rig.pose.bones[target_name].rotation_euler = (target.inverted() @ original @ delta @ original.inverted() @ target).to_euler("XYZ")
    for name, values in pose["locations"].items():
        target = armature_data.bones[name].matrix_local.to_3x3().normalized()
        original = Matrix(poses.BONE_REST[name][2]).transposed()
        rig.pose.bones[name].location = target.inverted() @ original @ Vector(values) * unit


for state, count in source_counts.items():
    action = bpy.data.actions.new("HMH_" + actor_id + "_" + state)
    rig.animation_data_create().action = action
    for index in range(count + (1 if state in {"idle", "run"} else 0)):
        sample = index % count
        frame = 1 + 24 * index / (count if state in {"idle", "run"} else count - 1)
        apply_role(state, sample, count)
        for pose_bone in rig.pose.bones:
            pose_bone.keyframe_insert("rotation_euler", frame=frame, group=pose_bone.name)
            pose_bone.keyframe_insert("location", frame=frame, group=pose_bone.name)
    action["hmh_state"] = state
    action["hmh_loop"] = state in {"idle", "run"}
    action.use_fake_user = True
    bindings[state] = action.name
rig.animation_data.action = bpy.data.actions[bindings["idle"]]
scene.frame_set(1)
for image in bpy.data.images:
    if image.type not in {"RENDER_RESULT", "COMPOSITING"} and image.size[0] and image.users:
        if max(image.size) > 2048:
            ratio = 2048 / max(image.size)
            image.scale(round(image.size[0] * ratio), round(image.size[1] * ratio))
        image.pack()
bpy.context.preferences.filepaths.save_version = 0
target = output / (actor_id + ".blend")
bpy.ops.wm.save_as_mainfile(filepath=str(target), compress=True)
receipt = {
    "schema": 1, "status": "editable-native-candidate", "actorId": actor_id, "identityForm": cast["identityForm"], "boss": False, "phaseVisuals": {},
    "baseSource": "owner-assets/" + cast["sourceFile"], "baseSha256": source_sha, "baseBytes": len(source_bytes),
    "sourceUnchanged": hashlib.sha256(source.read_bytes()).hexdigest() == source_sha,
    "casting": {"name": cast["name"], "rationale": cast["rationale"], "reference": cast["reference"], "textured": cast["textured"], "sheetFigure": cast["sheetFigure"]},
    "figureExtraction": figure_extraction, "importedTriangles": imported_triangles, "sourceTriangles": source_triangles,
    "landmarks": landmarks, "weightMethod": weight_method, "unweightedVertices": unweighted,
    "source": target.name, "sourceSha256": hashlib.sha256(target.read_bytes()).hexdigest(), "sourceBytes": target.stat().st_size,
    "armature": rig.name, "bones": len(armature_data.bones), "nativeBodyVertices": len(body.data.vertices),
    "costumeMeshes": 0, "gearMeshes": len(gear), "clipActions": bindings, "runtimeAuthority": "projection-only",
    "height": height, "animationProfile": profile, "stoop": stoop,
    "builderSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    "castingSha256": hashlib.sha256((Path(__file__).parent / "hmh_new_enemy_casting.py").read_bytes()).hexdigest(),
    "poseAuthorSha256": hashlib.sha256((Path(__file__).parent / "hmh_native_roster_poses.py").read_bytes()).hexdigest(),
    "rights": "Owner-supplied licensed model, read-only; no generation service, credit or new licence was used.",
}
(output / "source-receipt.json").write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8", newline="\n")
print(json.dumps({k: v for k, v in receipt.items() if k not in {"landmarks"}}), flush=True)
