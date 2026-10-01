"""Build an editable, skinned district-boss source from an owner-supplied Tripo GLB.

Slice HMH-BOSSES-2-4. The owner's GLBs are static, unrigged Tripo meshes (some
are three-view turnaround sheets modelled as one mesh). This script:

1. imports the read-only GLB (SHA-256 checked), keeps the front figure of a
   sheet model, joins it into one textured body and decimates it to the boss
   body budget;
2. grounds, centres and scales the body to the boss height;
3. fits the 19-bone HMH native rig to measured landmarks, binds automatic
   weights and re-rests the limbs onto the shared roster skeleton directions
   so every authored pose retargets exactly like the ordinary roster;
4. adds the boss's role gear (rigid bone-parented props and a skinned garment);
5. authors the ten boss clips from `hmh_boss_poses.py`;
6. saves a private .blend under .tmp with a source receipt.

Projection-only. Nothing here touches collision, damage, AI or the run contract.
Sources stay out of Git: the archive lane copies the .blend to the owner's
LestersArcade-Assets/2.0/Source tree and only the receipt is committed.
"""
import argparse
import hashlib
import importlib.util
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Euler, Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
import hmh_enemy_poses as poses
from hmh_boss_poses import BOSS_CLIP_FRAMES, BOSS_LOOP_CLIPS, boss_pose

spec = importlib.util.spec_from_file_location('props', ROOT / 'scripts/hmh-blender/create-hmh-authored-props.py')
props = importlib.util.module_from_spec(spec); spec.loader.exec_module(props)

# The owner's read-only models. `figure` selects the standing front figure of a
# turnaround-sheet model by its share of the sheet width; None keeps everything.
BOSSES = {
    'boss-rug-pull-baron': {
        'name': 'Rug Pull Baron', 'identityForm': 'human', 'height': 2.25,
        'source': 'military soldier 3d model.glb', 'sha256': '0cbc32bdbf58d1aab9c45c03f03c0ddfe7d3616414e4a767f73f15ea932044c2',
        'figure': None, 'bodyTriangles': 15000, 'accent': '#ffb347', 'primary': '#7a1424', 'trim': '#d8a63a',
        'coatScale': 0.95,
    },
    'boss-51-foreman': {
        'name': 'The 51% Foreman', 'identityForm': 'human', 'height': 2.5,
        'source': 'armored soldier 3d model.glb', 'sha256': '10c589cbc64d8ad295c214054298e072e59ad7f00dd59b651e689ddc6f35509c',
        # Front figure of the Whiteout sheet: imported x < -0.12 (measured on a gridded front render).
        'figure': {'maxX': -0.12, 'minZ': -1.0}, 'bodyTriangles': 15000, 'accent': '#ff7a1a', 'primary': '#3b3430', 'trim': '#c98b2c',
        'prop': {'source': 'military minigun 3d model.glb', 'sha256': 'a9b386542d97b2d7a4cdec2ee8ae9596ff4bae273a68c093cd47fad97fb25188', 'triangles': 1600},
    },
    'boss-lockkeeper': {
        'name': 'The Lockkeeper', 'identityForm': 'zombie', 'height': 2.3,
        'source': 'armored soldier 3d model (1).glb', 'sha256': '2aa5a15c66588dcdfc4e98863a9497e1cf7ef86209a94e6a3c25e9c6b299ef47',
        # Front figure of the Riot Enforcer sheet: x < -0.225, above the prop row (boot soles 0.157, shield top 0.153).
        'figure': {'maxX': -0.225, 'minZ': 0.155}, 'bodyTriangles': 15000, 'accent': '#7fe08a', 'primary': '#3f4a2c', 'trim': '#8b7a4a',
        'coatScale': 1.2,
    },
}

# Shared rest skeleton directions (hmh_enemy_poses.BONE_REST head -> tail).
CANON = {name: (Vector(rest[1]) - Vector(rest[0])).normalized() for name, rest in poses.BONE_REST.items()}


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def select_only(objects, active=None):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.hide_set(False); obj.hide_viewport = False; obj.select_set(True)
    bpy.context.view_layer.objects.active = active or objects[0]


def import_glb(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path), import_pack_images=True, import_shading='NORMALS', disable_bone_shape=True)
    created = [obj for obj in bpy.data.objects if obj not in before]
    meshes = [obj for obj in created if obj.type == 'MESH']
    others = [obj for obj in created if obj.type != 'MESH']
    bpy.context.view_layer.update()
    for obj in meshes:
        world = obj.matrix_world.copy(); obj.parent = None; obj.matrix_world = world
    for obj in others: bpy.data.objects.remove(obj, do_unlink=True)
    return meshes


def join(meshes, name):
    select_only(meshes)
    bpy.ops.object.join()
    obj = bpy.context.object; obj.name = name; obj.data.name = name
    return obj


def bounds_of(obj):
    pts = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    return Vector([min(p[i] for p in pts) for i in range(3)]), Vector([max(p[i] for p in pts) for i in range(3)])


def keep_front_figure(body, region):
    """Keep the standing front figure of a turnaround-sheet mesh.

    The sheets are hundreds of loose fragments, so the figure is cut by a
    measured region (face centroids in imported metres), then loose specks
    under 1 percent of the kept height are removed.
    """
    bm = bmesh.new(); bm.from_mesh(body.data)
    doomed = [face for face in bm.faces if not (face.calc_center_median().x < region['maxX'] and face.calc_center_median().z > region['minZ'])]
    before = len(bm.faces)
    bmesh.ops.delete(bm, geom=doomed, context='FACES')
    loose = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose, context='VERTS')
    # Drop stray islands that sit wholly in the strip just above the cut (a
    # shield rim fragment grounded the first Lockkeeper export in mid-air).
    bm.verts.ensure_lookup_table(); seen = set(); stray = []
    for start in bm.verts:
        if start in seen: continue
        island = []; stack = [start]; seen.add(start)
        while stack:
            vert = stack.pop(); island.append(vert)
            for edge in vert.link_edges:
                other = edge.other_vert(vert)
                if other not in seen: seen.add(other); stack.append(other)
        if max(v.co.z for v in island) < region['minZ'] + 0.02 and len(island) < 400: stray.extend(island)
    if stray: bmesh.ops.delete(bm, geom=stray, context='VERTS')
    bm.to_mesh(body.data); bm.free(); body.data.update()
    return body, {'strayVertices': len(stray), 'sourceFaces': before, 'keptFaces': len(body.data.polygons), 'region': region}


def decimate(obj, target):
    source = sum(len(poly.vertices) - 2 for poly in obj.data.polygons)
    if source > target:
        select_only([obj])
        modifier = obj.modifiers.new('Boss body budget', 'DECIMATE'); modifier.ratio = target / source
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.data.validate(clean_customdata=False); obj.data.update()
    return source, sum(len(poly.vertices) - 2 for poly in obj.data.polygons)


def normalise(obj, height):
    select_only([obj]); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    lo, hi = bounds_of(obj)
    scale = height / (hi.z - lo.z)
    shift = Vector((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z))
    for vertex in obj.data.vertices: vertex.co = (vertex.co + shift) * scale
    obj.data.update()
    return scale


def vertices_array(obj):
    array = np.empty(len(obj.data.vertices) * 3, dtype=np.float32); obj.data.vertices.foreach_get('co', array)
    return array.reshape((-1, 3))


def landmarks(V, height):
    """Rig joint positions measured from the normalised body vertices."""
    H = height
    def median_y(mask, default=0.0):
        return float(np.median(V[mask, 1])) if mask.any() else default
    def outer_x(side, z0, z1):
        mask = (V[:, 2] >= z0) & (V[:, 2] < z1) & (side * V[:, 0] > 0)
        return float((side * V[mask, 0]).max()) if mask.any() else 0.0
    torso_y = median_y((V[:, 2] > 0.55 * H) & (V[:, 2] < 0.8 * H) & (np.abs(V[:, 0]) < 0.08 * H))
    head_y = median_y(V[:, 2] > 0.92 * H, torso_y)
    joints = {
        'root': ((0, 0, 0), (0, 0, 0.2 * H)),
        'pelvis': ((0, torso_y, 0.50 * H), (0, torso_y, 0.58 * H)),
        'spine': ((0, torso_y, 0.58 * H), (0, torso_y, 0.70 * H)),
        'chest': ((0, torso_y, 0.70 * H), (0, torso_y, 0.84 * H)),
        'neck': ((0, torso_y, 0.84 * H), (0, head_y, 0.89 * H)),
        'head': ((0, head_y, 0.89 * H), (0, head_y, 0.995 * H)),
    }
    measured = {}
    for side, s in (('L', 1), ('R', -1)):
        shoulder_w = outer_x(s, 0.84 * H, 0.9 * H)
        shoulder = Vector((s * 0.78 * shoulder_w, torso_y, 0.82 * H))
        best = None
        for z in np.arange(0.25 * H, 0.9 * H, 0.01 * H):
            x = outer_x(s, z, z + 0.01 * H)
            if best is None or x > best[0]: best = (x, z + 0.005 * H)
        tip = Vector((s * (best[0] - 0.015 * H), 0.0, best[1]))
        wrist_mask = (np.abs(V[:, 2] - tip.z) < 0.05 * H) & (s * V[:, 0] > s * tip.x - 0.08 * H)
        tip.y = median_y(wrist_mask, torso_y)
        elbow = shoulder.lerp(tip, 0.47); wrist = shoulder.lerp(tip, 0.86)
        elbow_mask = (np.abs(V[:, 2] - elbow.z) < 0.04 * H) & (np.abs(V[:, 0] - elbow.x) < 0.06 * H)
        elbow.y = median_y(elbow_mask, torso_y)
        joints[f'upper_arm.{side}'] = (tuple(shoulder), tuple(elbow))
        joints[f'forearm.{side}'] = (tuple(elbow), tuple(wrist))
        joints[f'hand.{side}'] = (tuple(wrist), tuple(tip))
        leg_mask = (V[:, 2] > 0.25 * H) & (V[:, 2] < 0.35 * H) & (s * V[:, 0] > 0.01 * H)
        leg_x = float(np.median(V[leg_mask, 0])) if leg_mask.any() else s * 0.09 * H
        leg_y = median_y(leg_mask, torso_y)
        ankle_mask = (V[:, 2] > 0.04 * H) & (V[:, 2] < 0.10 * H) & (s * V[:, 0] > 0.01 * H)
        ankle_y = median_y(ankle_mask, leg_y)
        joints[f'thigh.{side}'] = ((leg_x * 0.85, leg_y, 0.50 * H), (leg_x, leg_y, 0.28 * H))
        joints[f'shin.{side}'] = ((leg_x, leg_y, 0.28 * H), (leg_x, ankle_y, 0.06 * H))
        joints[f'foot.{side}'] = ((leg_x, ankle_y, 0.06 * H), (leg_x, ankle_y - 0.13 * H, 0.015 * H))
        measured[side] = {'shoulderWidth': shoulder_w, 'armTip': list(tip), 'legX': leg_x}
    return joints, measured


PARENTS = {'root': None, 'pelvis': 'root', 'spine': 'pelvis', 'chest': 'spine', 'neck': 'chest', 'head': 'neck',
           'upper_arm.L': 'chest', 'forearm.L': 'upper_arm.L', 'hand.L': 'forearm.L',
           'upper_arm.R': 'chest', 'forearm.R': 'upper_arm.R', 'hand.R': 'forearm.R',
           'thigh.L': 'pelvis', 'shin.L': 'thigh.L', 'foot.L': 'shin.L',
           'thigh.R': 'pelvis', 'shin.R': 'thigh.R', 'foot.R': 'shin.R'}
NON_DEFORM = {'root', 'weapon_socket'}


def build_rig(name, joints):
    armature = bpy.data.armatures.new(name); rig = bpy.data.objects.new(name, armature)
    bpy.context.scene.collection.objects.link(rig)
    select_only([rig]); bpy.ops.object.mode_set(mode='EDIT')
    for bone_name, parent in PARENTS.items():
        head, tail = joints[bone_name]
        bone = armature.edit_bones.new(bone_name); bone.head = Vector(head); bone.tail = Vector(tail)
        bone.use_deform = bone_name not in NON_DEFORM
        if parent: bone.parent = armature.edit_bones[parent]; bone.use_connect = False
    wrist = armature.edit_bones['forearm.R']
    socket = armature.edit_bones.new('weapon_socket'); socket.head = wrist.tail.copy()
    socket.tail = wrist.tail + (wrist.tail - wrist.head).normalized() * 0.18; socket.parent = wrist; socket.use_deform = False
    bpy.ops.object.mode_set(mode='OBJECT')
    rig.rotation_mode = 'XYZ'
    for bone in rig.pose.bones: bone.rotation_mode = 'XYZ'
    return rig


def nearest_segment_fill(body, rig):
    """Give any vertex the proxy transfer left unweighted its nearest deform bone."""
    V = vertices_array(body)
    segments = [(b.name, np.array(b.head_local, dtype=np.float32), np.array(b.tail_local, dtype=np.float32)) for b in rig.data.bones if b.use_deform]
    filled = 0
    for vertex in body.data.vertices:
        if any(g.weight > 1e-4 for g in vertex.groups): continue
        point = V[vertex.index]; best = None
        for name, a, b in segments:
            ab = b - a; t = float(np.clip(np.dot(point - a, ab) / max(float(np.dot(ab, ab)), 1e-9), 0, 1))
            d = float(np.linalg.norm(point - (a + ab * t)))
            if best is None or d < best[0]: best = (d, name)
        (body.vertex_groups.get(best[1]) or body.vertex_groups.new(name=best[1])).add([vertex.index], 1.0, 'REPLACE'); filled += 1
    return filled


def bind(body, rig, height, measured):
    """Bone-heat weights solved on a watertight voxel proxy, transferred to the body.

    Tripo shells are hundreds of open, overlapping fragments, so Blender's bone
    heat fails on them directly and a gated nearest-bone rule tears the torso
    whenever an arm moves. A voxel remesh of the same shape is one manifold
    surface that bone heat solves cleanly; its weights then transfer to the
    textured body by nearest face interpolation, keeping the body's UVs.
    """
    proxy = body.copy(); proxy.data = body.data.copy(); proxy.name = body.name + ' Weight Proxy'
    bpy.context.scene.collection.objects.link(proxy)
    for group in list(proxy.vertex_groups): proxy.vertex_groups.remove(group)
    select_only([proxy])
    remesh = proxy.modifiers.new('Weight proxy remesh', 'REMESH'); remesh.mode = 'VOXEL'; remesh.voxel_size = 0.012 * height; remesh.adaptivity = 0
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    proxy_triangles = sum(len(p.vertices) - 2 for p in proxy.data.polygons)
    if proxy_triangles > 120_000:
        decimate_proxy = proxy.modifiers.new('Weight proxy decimate', 'DECIMATE'); decimate_proxy.ratio = 120_000 / proxy_triangles
        bpy.ops.object.modifier_apply(modifier=decimate_proxy.name)
    select_only([proxy, rig], active=rig)
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    for name in NON_DEFORM:
        if proxy.vertex_groups.get(name): proxy.vertex_groups.remove(proxy.vertex_groups[name])
    for bone in rig.data.bones:
        if bone.use_deform and not body.vertex_groups.get(bone.name): body.vertex_groups.new(name=bone.name)
    select_only([body])
    transfer = body.modifiers.new('Proxy weights', 'DATA_TRANSFER'); transfer.object = proxy
    transfer.use_vert_data = True; transfer.data_types_verts = {'VGROUP_WEIGHTS'}; transfer.vert_mapping = 'POLYINTERP_NEAREST'
    transfer.layers_vgroup_select_src = 'ALL'; transfer.layers_vgroup_select_dst = 'NAME'
    bpy.ops.object.modifier_apply(modifier=transfer.name)
    proxy_vertices = len(proxy.data.vertices)
    bpy.data.objects.remove(proxy, do_unlink=True)
    filled = nearest_segment_fill(body, rig)
    # A failed heat solve leaves the proxy unweighted and every body vertex on
    # the rigid nearest-bone fallback; refuse that rather than ship it (a
    # 0.6 percent voxel proxy did exactly this; 1.2 percent solves).
    if filled > 0.02 * len(body.data.vertices): raise RuntimeError(f'bone heat failed on the weight proxy: {filled} vertices unweighted')
    select_only([body]); bpy.ops.object.vertex_group_limit_total(limit=4); bpy.ops.object.vertex_group_normalize_all(lock_active=False)
    modifier = body.modifiers.new('Native skinning', 'ARMATURE'); modifier.object = rig
    body.parent = rig; body.matrix_parent_inverse = Matrix.Identity(4)
    return {'method': 'voxel-proxy-bone-heat-transfer', 'proxyVertices': proxy_vertices, 'proxyTriangles': proxy_triangles,
            'nearestBoneFilled': filled, 'blended': sum(1 for v in body.data.vertices if len(v.groups) > 1), 'vertices': len(body.data.vertices)}


def re_rest(body, rig):
    """Pose the limbs onto the shared roster directions and apply that as the rest."""
    select_only([rig]); bpy.ops.object.mode_set(mode='POSE')
    record = {}
    for name in ['upper_arm.L', 'forearm.L', 'hand.L', 'upper_arm.R', 'forearm.R', 'hand.R', 'thigh.L', 'shin.L', 'thigh.R', 'shin.R']:
        bpy.context.view_layer.update()
        pb = rig.pose.bones[name]
        current = (pb.tail - pb.head).normalized()
        canon = name if name in CANON else name.replace('hand', 'forearm')
        target = CANON[canon]
        rotation = current.rotation_difference(target).to_matrix().to_4x4()
        record[name] = round(math.degrees(current.angle(target)), 2)
        pb.matrix = Matrix.Translation(pb.head) @ rotation @ Matrix.Translation(-pb.head) @ pb.matrix
    bpy.context.view_layer.update()
    bpy.ops.object.mode_set(mode='OBJECT')
    select_only([body])
    modifier = next(m for m in body.modifiers if m.type == 'ARMATURE')
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    modifier = body.modifiers.new('Native skinning', 'ARMATURE'); modifier.object = rig
    select_only([rig]); bpy.ops.object.mode_set(mode='POSE'); bpy.ops.pose.armature_apply(selected=False); bpy.ops.object.mode_set(mode='OBJECT')
    return record


def limit_textures(maximum=1024):
    records = []
    for image in bpy.data.images:
        if image.type != 'IMAGE' or not image.size[0]: continue
        before = list(image.size)
        if max(before) > maximum:
            ratio = maximum / max(before); image.scale(round(before[0] * ratio), round(before[1] * ratio))
        image.pack(); records.append({'image': image.name, 'sourceSize': before, 'size': list(image.size)})
    return records


class Gear:
    """Role gear helpers in the roster's 1.75 m body-unit convention."""

    def __init__(self, boss_id, spec, rig, unit):
        self.id, self.spec, self.rig, self.unit = boss_id, spec, rig, unit
        self.cloth = props.material(boss_id + '_Cloth', spec['primary'], roughness=.85)
        self.metal = props.material(boss_id + '_Metal', '#5a5f66', metallic=.6, roughness=.55)
        self.dark = props.material(boss_id + '_Dark', '#15181c', roughness=.8)
        self.trim = props.material(boss_id + '_Trim', spec['trim'], metallic=.75, roughness=.4)
        self.accent = props.material(boss_id + '_RoleLight', spec['accent'], metallic=.1, emission=1.6, roughness=.5)
        self.rust = props.material(boss_id + '_Rust', '#6b3f22', roughness=.9)
        for mat in (self.cloth, self.metal, self.dark, self.trim, self.accent, self.rust):
            node = mat.node_tree.nodes.get('Principled BSDF'); color = tuple(node.inputs['Base Color'].default_value)
            node.inputs['Base Color'].default_value = tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in color[:3]) + (1,)
            if mat is self.accent: node.inputs['Emission Color'].default_value = node.inputs['Base Color'].default_value
        self.count = 0

    def attach(self, obj, bone):
        bpy.context.view_layer.update(); matrix = obj.matrix_world.copy()
        obj.parent = self.rig; obj.parent_type = 'BONE'; obj.parent_bone = bone; obj.matrix_world = matrix
        obj.hide_render = False; obj['hmh_actor_id'] = self.id; obj['hmh_layer'] = 'body'; obj['hmh_role_gear'] = True
        self.count += 1
        return obj

    def u(self, values):
        return tuple(v * self.unit for v in values)

    def box(self, name, loc, size, mat=None, bone='chest', rotation=(0, 0, 0)):
        return self.attach(props.cube(f'{self.id}_{name}', self.u(loc), self.u(size), mat or self.metal, self.id, bevel=.010 * self.unit, rotation=rotation), bone)

    def cyl(self, name, loc, radius, depth, mat=None, bone='chest', rotation=(0, 0, 0), vertices=16):
        return self.attach(props.cylinder(f'{self.id}_{name}', self.u(loc), radius * self.unit, depth * self.unit, mat or self.metal, self.id, rotation=rotation, vertices=vertices), bone)

    def ring(self, name, loc, radius, thickness, mat=None, bone='chest', rotation=(0, 0, 0)):
        obj = props.torus(f'{self.id}_{name}', self.u(loc), radius * self.unit, thickness * self.unit, mat or self.trim, self.id, rotation=rotation)
        return self.attach(obj, bone)

    def cone(self, name, loc, radius, depth, mat=None, bone='head', rotation=(0, 0, 0)):
        return self.attach(props.cone(f'{self.id}_{name}', self.u(loc), radius * self.unit, depth * self.unit, mat or self.dark, self.id, rotation=rotation), bone)

    def sphere(self, name, loc, size, mat=None, bone='chest'):
        return self.attach(props.sphere(f'{self.id}_{name}', self.u(loc), self.u(size), mat or self.metal, self.id), bone)

    def bone_point(self, bone, at=0.0):
        data = self.rig.data.bones[bone]
        return (data.head_local.lerp(data.tail_local, at)) / self.unit

    def garment(self, name, bands, mat=None, scale=1.0, thickness=.012, open_front=0):
        """A skinned coat/cloak: rings of vertices weighted between pelvis, chest and thighs."""
        vertices, faces, segments = [], [], 32
        for z, rx, ry in bands:
            for i in range(segments):
                angle = i * math.tau / segments
                fold = 1 + .025 * math.sin(i * 3.0 + z * 9)
                vertices.append((rx * scale * math.cos(angle) * fold * self.unit, ry * scale * math.sin(angle) * fold * self.unit, z * self.unit))
        for band in range(len(bands) - 1):
            for i in range(segments):
                # The actor faces -Y: skip `open_front` segments either side of it.
                if open_front and min(abs(i + .5 - 24), 32 - abs(i + .5 - 24)) < open_front: continue
                a = band * segments + i; b = band * segments + (i + 1) % segments
                faces.append((a, b, b + segments, a + segments))
        mesh = bpy.data.meshes.new(name); mesh.from_pydata(vertices, [], faces); mesh.update()
        obj = bpy.data.objects.new(name, mesh); bpy.context.scene.collection.objects.link(obj)
        obj.data.materials.append(mat or self.cloth); obj.parent = self.rig
        for bone in ['pelvis', 'spine', 'chest', 'thigh.L', 'thigh.R']: obj.vertex_groups.new(name=bone)
        for i, v in enumerate(vertices):
            z = v[2] / self.unit
            if z < .8:
                thigh = 'thigh.L' if v[0] > 0 else 'thigh.R'; weight = min(.8, max(0, (.85 - z) / .7))
                obj.vertex_groups[thigh].add([i], weight, 'REPLACE'); obj.vertex_groups['pelvis'].add([i], 1 - weight, 'REPLACE')
            elif z < 1.05:
                weight = (z - .8) / .25
                obj.vertex_groups['spine'].add([i], weight, 'REPLACE'); obj.vertex_groups['pelvis'].add([i], 1 - weight, 'REPLACE')
            else:
                weight = min(1, max(0, (z - 1.05) / .3))
                obj.vertex_groups['chest'].add([i], weight, 'REPLACE'); obj.vertex_groups['spine'].add([i], 1 - weight, 'REPLACE')
        arm = obj.modifiers.new('Native skinning', 'ARMATURE'); arm.object = self.rig
        solid = obj.modifiers.new('Cloth thickness', 'SOLIDIFY'); solid.thickness = thickness * self.unit
        for polygon in mesh.polygons: polygon.use_smooth = True
        obj['hmh_actor_id'] = self.id; obj['hmh_layer'] = 'body'; obj['hmh_skinned_costume'] = True
        self.count += 1
        return obj


def baron_gear(g):
    # Ringmaster: top hat, epaulettes, long red coat with gold hem rings, cane in the
    # right hand, coiled whip on the left hip, two holstered pistols.
    head = g.bone_point('head', 1.0)
    g.cyl('HatCrown', (head.x, head.y + .01, head.z + .09), .13, .22, g.dark, 'head')
    g.cyl('HatBrim', (head.x, head.y + .01, head.z - .015), .21, .018, g.dark, 'head')
    g.ring('HatBand', (head.x, head.y + .01, head.z + .01), .132, .014, g.trim, 'head')
    g.garment(g.id + ' Weighted Coat', [(.22, .27, .19), (.55, .25, .17), (.85, .22, .16), (1.12, .24, .17), (1.34, .27, .16), (1.42, .13, .10)], scale=g.spec['coatScale'], open_front=3)
    for side in (-1, 1):
        bone = 'upper_arm.L' if side > 0 else 'upper_arm.R'; p = g.bone_point(bone, 0.0)
        g.box('Epaulette' + str(side), (p.x + side * .02, p.y, p.z + .05), (.14, .12, .035), g.trim, bone)
        for i in range(3): g.cyl('Fringe' + str(side) + str(i), (p.x + side * .07, p.y - .04 + .04 * i, p.z), .006, .10, g.trim, bone)
    g.box('LapelL', (.07, -.24, 1.24), (.06, .02, .22), g.trim, 'chest', rotation=(0, 0, .3))
    g.box('LapelR', (-.07, -.24, 1.24), (.06, .02, .22), g.trim, 'chest', rotation=(0, 0, -.3))
    g.box('Belt', (0, -.2, .86), (.27, .03, .05), g.dark, 'pelvis'); g.box('Buckle', (0, -.225, .86), (.06, .015, .05), g.trim, 'pelvis')
    for x in (-.2, .2): g.box('Holster' + str(x), (x, -.18, .78), (.055, .06, .16), g.dark, 'pelvis'); g.box('Pistol' + str(x), (x, -.20, .70), (.03, .025, .09), g.metal, 'pelvis')
    wrist = g.bone_point('hand.R', 0.2)
    g.cyl('Cane', (wrist.x, wrist.y, wrist.z - .38), .016, .95, g.dark, 'hand.R'); g.sphere('CaneKnob', (wrist.x, wrist.y, wrist.z + .10), (.045, .045, .045), g.trim, 'hand.R')
    g.ring('WhipCoil', (.25, -.06, .80), .06, .016, g.rust, 'pelvis', rotation=(0, math.pi / 2, 0))
    g.box('ChestSeal', (0, -.25, 1.15), (.07, .025, .09), g.accent, 'chest')


def foreman_gear(g, prop_glb, prop_spec):
    # Site boss: hard hat with lamp, furnace backpack with vent, hazard plates, the
    # steam hammer in the right hand and the owner's minigun slung on the left forearm.
    head = g.bone_point('head', 1.0)
    # A shallow shell over the crown, face left clear (the first fit read as a diving helmet).
    # props.sphere scales are radii: a crown shell about head width, face clear.
    g.sphere('HardHat', (head.x, head.y + .005, head.z - .025), (.078, .088, .05), g.trim, 'head')
    g.cyl('HatBrim', (head.x, head.y - .005, head.z - .05), .1, .01, g.trim, 'head')
    g.cyl('Lamp', (head.x, head.y - .085, head.z - .02), .02, .03, g.accent, 'head', rotation=(math.pi / 2, 0, 0))
    g.box('PackFrame', (0, .27, 1.16), (.36, .08, .34), g.dark)
    for side in (-1, 1): g.cyl('Boiler' + str(side), (side * .13, .33, 1.14), .1, .42, g.rust); g.cyl('Stack' + str(side), (side * .13, .33, 1.44), .035, .2, g.metal)
    g.box('FurnaceWindow', (0, .375, 1.06), (.14, .02, .09), g.accent)
    for i in range(3): g.ring('BoilerBand' + str(i), (-.13, .33, .98 + .16 * i), .102, .012, g.metal, rotation=(0, 0, 0))
    g.box('ChestPlate', (0, -.27, 1.2), (.24, .03, .2), g.metal); g.box('Gauge', (0, -.29, 1.22), (.09, .015, .09), g.accent)
    for side in (-1, 1):
        bone = 'upper_arm.L' if side > 0 else 'upper_arm.R'; p = g.bone_point(bone, 0.05)
        g.box('Pauldron' + str(side), (p.x + side * .03, p.y, p.z + .04), (.18, .2, .07), g.metal, bone)
        g.box('HazardStripe' + str(side), (p.x + side * .03, p.y - .1, p.z + .05), (.16, .015, .04), g.accent, bone)
        knee = g.bone_point('shin.L' if side > 0 else 'shin.R', 0.08)
        g.box('KneePlate' + str(side), (knee.x, knee.y - .09, knee.z), (.12, .03, .12), g.metal, 'shin.L' if side > 0 else 'shin.R')
    g.box('Belt', (0, -.2, .86), (.3, .035, .06), g.dark, 'pelvis')
    for x in (-.14, .14): g.box('Pouch' + str(x), (x, -.23, .8), (.08, .06, .1), g.rust, 'pelvis')
    wrist = g.bone_point('hand.R', 0.2)
    g.cyl('HammerHaft', (wrist.x, wrist.y, wrist.z + .28), .024, 1.0, g.dark, 'hand.R')
    g.box('HammerHead', (wrist.x, wrist.y, wrist.z + .78), (.2, .34, .2), g.rust, 'hand.R')
    g.box('HammerCore', (wrist.x, wrist.y, wrist.z + .78), (.09, .36, .09), g.accent, 'hand.R')
    for y in (-.13, .13): g.ring('HammerBand' + str(y), (wrist.x, wrist.y + y, wrist.z + .78), .11, .014, g.metal, 'hand.R', rotation=(math.pi / 2, 0, 0))
    # The owner's minigun: decimated and mounted along the left forearm as the hash cannon.
    parts = import_glb(prop_glb); gun = join(parts, g.id + '_HashCannon')
    decimate(gun, prop_spec['triangles'])
    gun.data.materials.clear(); gun.data.materials.append(g.metal)
    for face in gun.data.polygons: face.material_index = 0
    select_only([gun]); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    lo, hi = bounds_of(gun); length = max(hi - lo)
    for v in gun.data.vertices: v.co = (v.co - (lo + hi) / 2) * (.95 * g.unit / length)
    gun.data.update()
    fore = g.rig.data.bones['forearm.L']; centre = fore.head_local.lerp(fore.tail_local, .55)
    direction = (fore.tail_local - fore.head_local).normalized()
    gun.matrix_world = Matrix.Translation(centre + Vector((0.06 * g.unit, -0.02 * g.unit, -0.02 * g.unit))) @ direction.to_track_quat('-Y', 'Z').to_matrix().to_4x4()
    g.attach(gun, 'forearm.L')
    return {'prop': prop_glb.name, 'propTriangles': sum(len(p.vertices) - 2 for p in gun.data.polygons)}


def lockkeeper_gear(g):
    # Swamp warden: wide hat, moss cloak, chest chains and padlocks, the great key in
    # the right hand and the winch drum with its crank on the left shoulder.
    head = g.bone_point('head', 1.0)
    g.cone('HatCrown', (head.x, head.y, head.z + .05), .14, .2, g.dark, 'head')
    g.cyl('HatBrim', (head.x, head.y, head.z - .04), .29, .014, g.dark, 'head')
    g.garment(g.id + ' Weighted Cloak', [(.45, .29, .21), (.7, .27, .2), (.95, .26, .19), (1.15, .27, .19), (1.34, .29, .17), (1.45, .14, .11)], scale=g.spec['coatScale'], thickness=.014, open_front=4)
    for i, x in enumerate((-.16, -.05, .06, .17)):
        g.ring('ChainLink' + str(i), (x, -.25, 1.2 - .03 * (i % 2)), .04, .011, g.rust, 'chest', rotation=(math.pi / 2, 0, .4 * (i % 2)))
    for x in (-.12, .11):
        g.box('Padlock' + str(x), (x, -.26, 1.05), (.06, .03, .07), g.metal); g.ring('Shackle' + str(x), (x, -.26, 1.1), .025, .008, g.metal, rotation=(math.pi / 2, 0, 0))
    g.box('Belt', (0, -.2, .86), (.28, .03, .05), g.dark, 'pelvis')
    for x in (-.2, .2): g.box('KeyRing' + str(x), (x, -.18, .76), (.02, .06, .12), g.rust, 'pelvis')
    wrist = g.bone_point('hand.R', 0.2)
    g.cyl('KeyShaft', (wrist.x, wrist.y, wrist.z - .35), .02, 1.0, g.rust, 'hand.R')
    g.ring('KeyBow', (wrist.x, wrist.y, wrist.z + .22), .09, .025, g.rust, 'hand.R', rotation=(0, math.pi / 2, 0))
    g.box('KeyBit', (wrist.x, wrist.y - .05, wrist.z - .8), (.03, .1, .12), g.rust, 'hand.R'); g.box('KeyBit2', (wrist.x, wrist.y - .07, wrist.z - .68), (.03, .06, .05), g.rust, 'hand.R')
    shoulder = g.bone_point('upper_arm.L', 0.0)
    g.cyl('WinchDrum', (shoulder.x + .04, shoulder.y + .12, shoulder.z + .12), .09, .26, g.rust, 'chest', rotation=(0, math.pi / 2, 0))
    for x in (-.14, .14): g.cyl('DrumFlange' + str(x), (shoulder.x + .04 + x, shoulder.y + .12, shoulder.z + .12), .11, .02, g.metal, 'chest', rotation=(0, math.pi / 2, 0))
    g.cyl('CrankArm', (shoulder.x + .22, shoulder.y + .12, shoulder.z + .2), .014, .18, g.metal, 'chest'); g.cyl('CrankHandle', (shoulder.x + .22, shoulder.y + .02, shoulder.z + .29), .016, .2, g.dark, 'chest', rotation=(math.pi / 2, 0, 0))
    g.box('DrumMount', (shoulder.x + .04, shoulder.y + .08, shoulder.z), (.2, .1, .08), g.dark, 'chest')
    g.box('ChestSeal', (0, -.28, 1.22), (.06, .02, .08), g.accent, 'chest')


def author_actions(boss_id, rig, unit):
    bindings = {}
    def apply(state, index, count):
        for b in rig.pose.bones: b.matrix_basis = Matrix.Identity(4)
        pose = boss_pose(boss_id, state, index, count)
        for name, values in pose['rotations'].items():
            target_name = 'weapon_socket' if name == 'prop_socket' else name
            if target_name not in rig.pose.bones: continue
            target = rig.data.bones[target_name].matrix_local.to_3x3().normalized()
            original = Matrix(poses.BONE_REST[name][2]).transposed()
            delta = Euler(tuple(math.radians(v) for v in values), 'XYZ').to_matrix()
            rig.pose.bones[target_name].rotation_euler = (target.inverted() @ original @ delta @ original.inverted() @ target).to_euler('XYZ')
        for name, values in pose['locations'].items():
            target = rig.data.bones[name].matrix_local.to_3x3().normalized()
            original = Matrix(poses.BONE_REST[name][2]).transposed()
            rig.pose.bones[name].location = target.inverted() @ original @ Vector(values) * unit
    for state, count in BOSS_CLIP_FRAMES.items():
        loop = state in BOSS_LOOP_CLIPS
        action = bpy.data.actions.new(f'HMH_{boss_id}_{state}')
        rig.animation_data_create().action = action
        for index in range(count + (1 if loop else 0)):
            sample = index % count; frame = 1 + 24 * index / (count if loop else count - 1)
            apply(state, sample, count)
            for bone in rig.pose.bones:
                bone.keyframe_insert('rotation_euler', frame=frame, group=bone.name)
                bone.keyframe_insert('location', frame=frame, group=bone.name)
        action['hmh_state'] = state; action['hmh_loop'] = loop; action.use_fake_user = True
        bindings[state] = action.name
    rig.animation_data.action = bpy.data.actions[bindings['idle']]
    for b in rig.pose.bones: b.matrix_basis = Matrix.Identity(4)
    bpy.context.scene.frame_set(1)
    return bindings


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--boss', required=True, choices=list(BOSSES))
    parser.add_argument('--assets-root', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    spec = BOSSES[args.boss]
    assets = Path(args.assets_root)
    source = assets / spec['source']
    if sha256(source) != spec['sha256']: raise ValueError('Owner source model identity changed: ' + spec['source'])
    output = (ROOT / args.output).resolve()
    if not output.is_relative_to(ROOT / '.tmp') or output.exists(): raise ValueError('Use a fresh private boss candidate directory under .tmp')
    output.mkdir(parents=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene; scene.render.fps = 24
    meshes = import_glb(source)
    body = join(meshes, args.boss + ' Native Body')
    selection = None
    if spec['figure'] is not None: body, selection = keep_front_figure(body, spec['figure'])
    source_triangles, body_triangles = decimate(body, spec['bodyTriangles'])
    scale = normalise(body, spec['height'])
    V = vertices_array(body)
    joints, measured = landmarks(V, spec['height'])
    rig = build_rig(args.boss + ' Native Rig', joints)
    binding = bind(body, rig, spec['height'], measured)
    rest = re_rest(body, rig)
    body['hmh_actor_id'] = args.boss; body['hmh_layer'] = 'body'; body['hmh_native_body'] = True; body['hmh_primary_skinned_body'] = True
    body.hide_render = False
    for polygon in body.data.polygons: polygon.use_smooth = True
    textures = limit_textures()
    unit = spec['height'] / 1.75
    gear = Gear(args.boss, spec, rig, unit)
    prop = {}
    if args.boss == 'boss-rug-pull-baron': baron_gear(gear)
    elif args.boss == 'boss-51-foreman':
        prop_source = assets / spec['prop']['source']
        if sha256(prop_source) != spec['prop']['sha256']: raise ValueError('Owner prop model identity changed')
        prop = foreman_gear(gear, prop_source, spec['prop'])
    else: lockkeeper_gear(gear)
    bindings = author_actions(args.boss, rig, unit)
    for image in bpy.data.images:
        if image.type not in {'RENDER_RESULT', 'COMPOSITING'} and image.size[0] and image.users: image.pack()
    bpy.context.preferences.filepaths.save_version = 0
    target = output / (args.boss + '.blend'); bpy.ops.wm.save_as_mainfile(filepath=str(target), compress=True)
    gear_meshes = [o for o in bpy.data.objects if o.type == 'MESH' and o.get('hmh_role_gear')]
    receipt = {
        'schema': 1, 'status': 'editable-native-boss-candidate', 'actorId': args.boss, 'name': spec['name'], 'identityForm': spec['identityForm'], 'boss': True,
        'ownerSource': spec['source'], 'ownerSourceSha256': spec['sha256'], 'ownerSourceUnchanged': sha256(source) == spec['sha256'],
        'ownerProp': spec.get('prop'), 'figureSelection': selection, 'sourceTriangles': source_triangles, 'bodyTriangles': body_triangles,
        'normalisationScale': scale, 'height': spec['height'], 'heroHeightRatio': round(spec['height'] / 2.1, 3),
        'landmarks': measured, 'skinning': binding, 'restCorrectionDegrees': rest,
        'source': target.name, 'sourceSha256': sha256(target), 'sourceBytes': target.stat().st_size,
        'armature': rig.name, 'bones': len(rig.data.bones), 'nativeBodyVertices': len(body.data.vertices),
        'costumeMeshes': sum(bool(o.get('hmh_skinned_costume')) for o in bpy.data.objects if o.type == 'MESH'), 'gearMeshes': len(gear_meshes),
        'gearTriangles': sum(len(p.vertices) - 2 for o in gear_meshes for p in o.data.polygons), **prop,
        'textures': textures, 'clipActions': bindings, 'clipFrames': BOSS_CLIP_FRAMES, 'runtimeAuthority': 'projection-only',
        'builderSha256': sha256(Path(__file__)), 'poseAuthorSha256': sha256(Path(__file__).with_name('hmh_boss_poses.py')),
    }
    (output / 'source-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
    print('HMH_BOSS_SOURCE_RECEIPT=' + json.dumps({k: v for k, v in receipt.items() if k not in {'textures', 'landmarks'}}), flush=True)


if __name__ == '__main__':
    main()
