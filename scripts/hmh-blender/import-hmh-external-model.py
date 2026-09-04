"""Import a committed GLB/FBX actor into the HMH production hero scene.

The four shipped heroes and the whole enemy roster are built by extruding
primitives in Python. This module is the second, additive source path described
in AAA-ROADMAP.md 1.2: a mesh authored outside the repo (ChatGPT concept sheet
to Tripo to Mixamo) is committed with its SHA-256 and normalised here into
exactly the shape the existing exporter, packer and reproducibility gates
already understand.

Everything it does is projection-only. It never touches collision, damage, AI,
spawning, RNG or progression; the runtime reads the packed atlas and its
metadata, and neither carries a bone.

Six things the deterministic render depends on happen here:

1. Height normalisation onto a parent Empty. Applying scale to an armature that
   owns actions does not scale the location fcurves, so a Mixamo hip
   translation would come out at the source model's scale. The Empty carries a
   uniform scale and a Z-only yaw, which is exactly the composition the
   exporter's per-direction `rig.rotation_euler[2]` can be layered on top of.
2. Ground-contact origin. The pivot contract is `ground-contact-center`, so the
   rest-pose bounding box is baked to put the feet at z=0 and the silhouette
   centre on the armature's own origin. Rotating the rig then spins in place
   instead of orbiting.
3. A waist split of the single skinned mesh into the `lower-body` and
   `torso-head` layer objects. Both halves keep the Armature modifier and the
   full vertex-group table, so they deform as one actor while the exporter can
   still render them independently.
4. A `weapon_socket` bone and the weapon meshes parented to it, so the weapon
   layer moves with the hand.
5. One shared toon look-dev node group whose rim colour comes from
   `hmh-light-rig.json`, so an imported actor lights like the procedural ones.
6. Action hygiene: renames applied, object-level fcurves stripped (a glTF root
   animation would fight the exporter's yaw), and the glTF NLA stash muted.

Usage as a CLI (standalone import into its own .blend):

    blender --background --factory-startup \
      --python scripts/hmh-blender/import-hmh-external-model.py -- \
      --manifest apps/hmh-reboot/assets/source/blender/<manifest>.json \
      --actor-id <actorId> \
      --output-blend .tmp/<actor>/import.blend \
      --inspection-output .tmp/<actor>/import-inspection.json

Usage as a module (from create-hmh-production-hero-pilot.py):

    report = importer.import_external_actor(manifest, pilot, repo_root, collection)
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
import re
import sys

import bmesh
import bpy
from bpy_extras import anim_utils
from mathutils import Matrix, Vector

# --- shared art direction -------------------------------------------------
# Every authored-asset pipeline reads the same rig so heroes, enemies and props
# light identically. See scripts/hmh-blender/hmh-light-rig.json.
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


LOOK_DEV_GROUP = "HMH_LookDev_v1"
LOOK_DEV_ID = "hmh-lookdev-v1"
# Three constant bands plus a hard rim. The positions and values are the whole
# look; they are here rather than in the manifest so every imported actor reads
# the same before any per-actor tuning is even proposed.
#
# The numbers were judged on a rendered sphere and cube under the shared rig,
# not derived. The band stops split the observed diffuse range of that rig into
# a readable shadow / mid / key. The rim started at blend 0.55 / threshold 0.62,
# which on curved geometry produced a fat desaturated halo rather than an edge
# accent; a narrower band at a higher threshold, carrying more of the rig's warm
# rim colour, reads as an actual light.
LOOK_DEV_BANDS = ((0.0, 0.50), (0.38, 0.78), (0.72, 1.0))
LOOK_DEV_RIM_BLEND = 0.45
LOOK_DEV_RIM_THRESHOLD = 0.80
LOOK_DEV_RIM_STRENGTH = 0.55

# Bone names that belong below the waist. Mixamo, Blender's own rigify and
# hand-named rigs all fall inside this vocabulary. `spine` is excluded because
# `spine.001` would otherwise be caught by `leg` heuristics on some rigs.
LOWER_BODY_PATTERN = re.compile(
    r"(?:hip|pelvis|upleg|thigh|shin|calf|knee|ankle|foot|toe|leg)",
    re.IGNORECASE,
)
LOWER_BODY_EXCLUDE = re.compile(r"(?:spine|chest|clavicle|shoulder|neck|head)", re.IGNORECASE)

SHADOW_RADIUS = 0.56
SHADOW_DEPTH = 0.012
SHADOW_SQUASH = 0.58
SHADOW_RGBA = (0.02, 0.03, 0.06, 0.18)
WHITE_RGBA = (1.0, 1.0, 1.0, 1.0)
BLACK_RGBA = (0.0, 0.0, 0.0, 1.0)

LIGHT_PLACEMENT = {
    "key": ((2.5, -3.2, 4.8), 3.0),
    "fill": ((-3.5, -1.0, 3.0), 2.6),
    "rim": ((2.0, 3.5, 4.0), 2.2),
}


# --- small helpers --------------------------------------------------------


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def write_lf_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")


def move_to_collection(obj, collection) -> None:
    for owner in list(obj.users_collection):
        owner.objects.unlink(obj)
    collection.objects.link(obj)


def deselect_all() -> None:
    for obj in bpy.data.objects:
        obj.select_set(False)


def enter_edit_mode(arm) -> None:
    deselect_all()
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")


def leave_edit_mode() -> None:
    bpy.ops.object.mode_set(mode="OBJECT")


# --- import ---------------------------------------------------------------


def import_model(model_path: Path, model_format: str):
    """Import the file and return only the objects it created, in name order."""
    before = {obj.name for obj in bpy.data.objects}
    fmt = model_format.lower()
    if fmt in {"glb", "gltf"}:
        bpy.ops.import_scene.gltf(
            filepath=str(model_path),
            import_pack_images=True,
            import_shading="NORMALS",
            bone_heuristic="BLENDER",
            guess_original_bind_pose=True,
            merge_vertices=False,
            import_scene_as_collection=False,
            import_select_created_objects=True,
            # Without this the importer adds a real Icosphere object as the
            # bone display shape. It carries no hmh_layer tag, so the exporter
            # never hides it and it renders on top of every layer.
            disable_bone_shape=True,
        )
    elif fmt == "fbx":
        bpy.ops.import_scene.fbx(
            filepath=str(model_path),
            use_anim=True,
            anim_offset=1.0,
            ignore_leaf_bones=True,
            automatic_bone_orientation=False,
            use_custom_props=False,
            global_scale=1.0,
        )
    else:
        raise RuntimeError(f"Unsupported source model format: {model_format}")
    created = sorted((obj for obj in bpy.data.objects if obj.name not in before), key=lambda obj: obj.name)
    if not created:
        raise RuntimeError(f"Import produced no objects: {model_path}")
    return created


def find_armature(objects):
    armatures = [obj for obj in objects if obj.type == "ARMATURE"]
    if len(armatures) != 1:
        raise RuntimeError(f"Expected exactly one armature in the source model, found {len(armatures)}")
    return armatures[0]


def skinned_meshes(objects, arm):
    """Meshes deformed by `arm`, in deterministic name order."""
    result = []
    for obj in objects:
        if obj.type != "MESH":
            continue
        if any(mod.type == "ARMATURE" and mod.object is arm for mod in obj.modifiers):
            result.append(obj)
    return sorted(result, key=lambda obj: obj.name)


def rest_bounds(arm, meshes) -> tuple[Vector, Vector]:
    """Rest-pose bounding box of `meshes`, expressed in the armature's space."""
    previous = arm.data.pose_position
    arm.data.pose_position = "REST"
    bpy.context.view_layer.update()
    to_local = arm.matrix_world.inverted()
    lowest = None
    highest = None
    for mesh in meshes:
        matrix = to_local @ mesh.matrix_world
        for vertex in mesh.data.vertices:
            point = matrix @ vertex.co
            if lowest is None:
                lowest = point.copy()
                highest = point.copy()
                continue
            for axis in range(3):
                lowest[axis] = min(lowest[axis], point[axis])
                highest[axis] = max(highest[axis], point[axis])
    arm.data.pose_position = previous
    bpy.context.view_layer.update()
    if lowest is None:
        raise RuntimeError("Source model has no mesh vertices to measure")
    return lowest, highest


def normalise_actor(arm, meshes, collection, *, target_height: float, facing_yaw: float, empty_name: str):
    """Ground the actor, centre it on its own origin, and scale via a parent Empty.

    Bone and vertex data carry the grounding translation so the armature origin
    IS the ground-contact centre: the exporter rotates the rig per direction and
    a rig whose origin sits anywhere else would orbit instead of turning.
    Scale stays on the Empty because applying it to the armature would leave
    every location fcurve at the source model's scale.
    """
    lowest, highest = rest_bounds(arm, meshes)
    height = highest.z - lowest.z
    if height <= 0.0:
        raise RuntimeError("Source model has zero height")
    delta = Vector((
        -(lowest.x + highest.x) * 0.5,
        -(lowest.y + highest.y) * 0.5,
        -lowest.z,
    ))

    enter_edit_mode(arm)
    for bone in arm.data.edit_bones:
        bone.head = bone.head + delta
        bone.tail = bone.tail + delta
    leave_edit_mode()
    shift = Matrix.Translation(delta)
    for mesh in meshes:
        # Bone-parented objects already followed their bone.
        if mesh.parent is arm and mesh.parent_type == "BONE":
            continue
        local = mesh.matrix_parent_inverse @ mesh.matrix_basis
        mesh.matrix_parent_inverse.identity()
        mesh.matrix_basis = shift @ local
    bpy.context.view_layer.update()

    scale = target_height / height
    empty = bpy.data.objects.new(empty_name, None)
    empty.empty_display_type = "PLAIN_AXES"
    empty.empty_display_size = 0.4
    collection.objects.link(empty)
    empty.scale = (scale, scale, scale)
    empty.rotation_euler[2] = math.radians(facing_yaw)
    empty.hide_render = True
    arm.parent = empty
    arm.matrix_parent_inverse.identity()
    bpy.context.view_layer.update()
    return empty, scale


# --- waist split ----------------------------------------------------------


def lower_body_group_indices(mesh_obj, arm, declared: list[str] | None) -> set[int]:
    names = set(declared or [])
    if not names:
        for bone in arm.data.bones:
            if LOWER_BODY_EXCLUDE.search(bone.name):
                continue
            if LOWER_BODY_PATTERN.search(bone.name):
                names.add(bone.name)
    if not names:
        raise RuntimeError("No lower-body bones matched; declare sourceModel.lowerBodyBones")
    indices = {group.index for group in mesh_obj.vertex_groups if group.name in names}
    if not indices:
        raise RuntimeError(f"None of the lower-body bones have vertex groups: {sorted(names)}")
    return indices


def split_skinned_mesh_at_waist(mesh_obj, arm, collection, *, actor_id: str, variant_id: str, lower_bones=None):
    """Duplicate the skinned mesh and delete the complementary faces from each half.

    A vertex belongs to the lower body when more than half of its total deform
    weight sits on a lower-body group; a face follows its majority of vertices.
    Duplicating rather than separating keeps both halves on the same Armature
    modifier and the same full vertex-group table, so the two layers deform as
    one actor.
    """
    lower_indices = lower_body_group_indices(mesh_obj, arm, lower_bones)
    mesh_data = mesh_obj.data
    bm = bmesh.new()
    bm.from_mesh(mesh_data)
    deform_layer = bm.verts.layers.deform.verify()
    lower_vertices = set()
    for vert in bm.verts:
        weights = vert[deform_layer]
        total = sum(weights.values())
        if total <= 0.0:
            continue
        lower = sum(weight for index, weight in weights.items() if index in lower_indices)
        if lower > total * 0.5:
            lower_vertices.add(vert.index)
    lower_faces = set()
    for face in bm.faces:
        hits = sum(1 for vert in face.verts if vert.index in lower_vertices)
        if hits * 2 >= len(face.verts):
            lower_faces.add(face.index)
    bm.free()
    if not lower_faces:
        raise RuntimeError("Waist split produced an empty lower body")
    if len(lower_faces) == len(mesh_data.polygons):
        raise RuntimeError("Waist split produced an empty torso")

    halves = {}
    for layer, keep in (("lower-body", lower_faces), ("torso-head", None)):
        clone = mesh_obj.copy()
        clone.data = mesh_data.copy()
        clone.name = f"{actor_id}_{variant_id}_{'LowerBody' if layer == 'lower-body' else 'TorsoHead'}"
        clone.data.name = clone.name
        collection.objects.link(clone)
        keep_faces = keep if keep is not None else (set(range(len(mesh_data.polygons))) - lower_faces)
        bm = bmesh.new()
        bm.from_mesh(clone.data)
        bm.faces.ensure_lookup_table()
        doomed = [face for face in bm.faces if face.index not in keep_faces]
        bmesh.ops.delete(bm, geom=doomed, context="FACES")
        bm.to_mesh(clone.data)
        bm.free()
        clone.data.update()
        if len(clone.data.polygons) == 0:
            raise RuntimeError(f"Waist split left {layer} with no faces")
        halves[layer] = clone

    bpy.data.objects.remove(mesh_obj, do_unlink=True)
    return halves


# --- weapon socket --------------------------------------------------------


def ensure_weapon_socket(arm, socket_name: str, parent_bone: str) -> None:
    if socket_name in arm.data.bones:
        return
    if parent_bone not in arm.data.bones:
        raise RuntimeError(f"Weapon socket parent bone is missing: {parent_bone}")
    enter_edit_mode(arm)
    parent = arm.data.edit_bones[parent_bone]
    direction = parent.vector.normalized() if parent.vector.length > 0 else Vector((0.0, -1.0, 0.0))
    bone = arm.data.edit_bones.new(socket_name)
    bone.head = parent.tail.copy()
    bone.tail = parent.tail + direction * 0.25
    bone.parent = parent
    bone.use_connect = False
    leave_edit_mode()


def attach_weapon_objects(meshes, arm, socket_name: str, patterns: list[str]):
    """Parent every matching mesh to the weapon socket bone."""
    compiled = [re.compile(pattern) for pattern in patterns]
    attached = []
    for mesh in meshes:
        if not any(pattern.search(mesh.name) for pattern in compiled):
            continue
        for modifier in [mod for mod in mesh.modifiers if mod.type == "ARMATURE"]:
            mesh.modifiers.remove(modifier)
        world = mesh.matrix_world.copy()
        mesh.parent = arm
        mesh.parent_type = "BONE"
        mesh.parent_bone = socket_name
        # The matrix_world setter solves against the evaluated parent. Without
        # this update it solves against the pre-parenting matrix and the weapon
        # lands somewhere near the actor's spine.
        bpy.context.view_layer.update()
        mesh.matrix_world = world
        attached.append(mesh)
    return attached


def add_ground_shadow(arm, collection, *, actor_id: str, variant_id: str, scale: float):
    """The same squashed disc the procedural pipeline drops under every actor.

    Built at 1/scale so the parent Empty's normalisation lands it at the shared
    world radius rather than the source model's.
    """
    inverse = 1.0 / scale
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=48,
        radius=SHADOW_RADIUS * inverse,
        depth=SHADOW_DEPTH * inverse,
        location=(0.0, 0.0, SHADOW_DEPTH * inverse),
    )
    shadow = bpy.context.object
    shadow.name = f"{actor_id}_{variant_id}_GroundShadow"
    shadow.data.name = shadow.name
    shadow.scale.y = SHADOW_SQUASH
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    material = bpy.data.materials.new(f"{actor_id}_GroundShadow")
    material.use_nodes = True
    shadow_rgba = SHADOW_RGBA
    material.diffuse_color = shadow_rgba
    principled = material.node_tree.nodes.get("Principled BSDF")
    if principled is not None:
        principled.inputs["Base Color"].default_value = shadow_rgba
        principled.inputs["Alpha"].default_value = shadow_rgba[3]
        principled.inputs["Roughness"].default_value = 0.9
    if hasattr(material, "surface_render_method"):
        material.surface_render_method = "DITHERED"
    shadow.data.materials.append(material)
    move_to_collection(shadow, collection)
    shadow.parent = arm
    shadow.matrix_parent_inverse.identity()
    return shadow


# --- look dev -------------------------------------------------------------


def ensure_look_dev_group():
    """One node group, three constant bands and one hard rim, shared by every actor.

    ShaderToRGB is EEVEE-only, which is why an imported actor renders under
    BLENDER_EEVEE. The rim colour is read from the shared light rig so the
    banding agrees with the actual key/fill/rim lights in the scene.
    """
    existing = bpy.data.node_groups.get(LOOK_DEV_GROUP)
    if existing is not None:
        return existing
    rim_color = dict((channel, color) for channel, color, _ in shared_light_channels("hero"))["rim"]
    group = bpy.data.node_groups.new(LOOK_DEV_GROUP, "ShaderNodeTree")
    group.interface.new_socket(name="Base Color", in_out="INPUT", socket_type="NodeSocketColor")
    strength = group.interface.new_socket(name="Rim Strength", in_out="INPUT", socket_type="NodeSocketFloat")
    strength.default_value = LOOK_DEV_RIM_STRENGTH
    group.interface.new_socket(name="Shader", in_out="OUTPUT", socket_type="NodeSocketShader")

    nodes = group.nodes
    links = group.links
    group_in = nodes.new("NodeGroupInput")
    group_in.location = (-900.0, 0.0)
    group_out = nodes.new("NodeGroupOutput")
    group_out.location = (600.0, 0.0)

    diffuse = nodes.new("ShaderNodeBsdfDiffuse")
    diffuse.location = (-700.0, 240.0)
    diffuse.inputs["Color"].default_value = WHITE_RGBA
    diffuse.inputs["Roughness"].default_value = 0.9
    to_rgb = nodes.new("ShaderNodeShaderToRGB")
    to_rgb.location = (-520.0, 240.0)
    links.new(diffuse.outputs["BSDF"], to_rgb.inputs["Shader"])

    bands = nodes.new("ShaderNodeValToRGB")
    bands.location = (-340.0, 240.0)
    bands.color_ramp.interpolation = "CONSTANT"
    while len(bands.color_ramp.elements) > 1:
        bands.color_ramp.elements.remove(bands.color_ramp.elements[-1])
    for index, (position, value) in enumerate(LOOK_DEV_BANDS):
        element = bands.color_ramp.elements[0] if index == 0 else bands.color_ramp.elements.new(position)
        element.position = position
        element.color = (value, value, value, 1.0)
    links.new(to_rgb.outputs["Color"], bands.inputs["Fac"])

    banded = nodes.new("ShaderNodeMixRGB")
    banded.location = (-120.0, 120.0)
    banded.blend_type = "MULTIPLY"
    banded.inputs["Fac"].default_value = 1.0
    links.new(bands.outputs["Color"], banded.inputs["Color1"])
    links.new(group_in.outputs["Base Color"], banded.inputs["Color2"])

    facing = nodes.new("ShaderNodeLayerWeight")
    facing.location = (-700.0, -220.0)
    facing.inputs["Blend"].default_value = LOOK_DEV_RIM_BLEND
    rim_ramp = nodes.new("ShaderNodeValToRGB")
    rim_ramp.location = (-520.0, -220.0)
    rim_ramp.color_ramp.interpolation = "CONSTANT"
    rim_ramp.color_ramp.elements[0].position = 0.0
    rim_ramp.color_ramp.elements[0].color = BLACK_RGBA
    rim_ramp.color_ramp.elements[1].position = LOOK_DEV_RIM_THRESHOLD
    rim_ramp.color_ramp.elements[1].color = WHITE_RGBA
    links.new(facing.outputs["Facing"], rim_ramp.inputs["Fac"])

    rim_gain = nodes.new("ShaderNodeMath")
    rim_gain.location = (-340.0, -220.0)
    rim_gain.operation = "MULTIPLY"
    links.new(rim_ramp.outputs["Color"], rim_gain.inputs[0])
    links.new(group_in.outputs["Rim Strength"], rim_gain.inputs[1])

    rim_rgb = nodes.new("ShaderNodeRGB")
    rim_rgb.location = (-340.0, -420.0)
    rim_rgb.outputs[0].default_value = tuple(rim_color) + (1.0,)
    rim_tint = nodes.new("ShaderNodeMixRGB")
    rim_tint.location = (-120.0, -300.0)
    rim_tint.blend_type = "MULTIPLY"
    rim_tint.inputs["Fac"].default_value = 1.0
    links.new(rim_rgb.outputs["Color"], rim_tint.inputs["Color1"])
    links.new(rim_gain.outputs["Value"], rim_tint.inputs["Color2"])

    combine = nodes.new("ShaderNodeMixRGB")
    combine.location = (140.0, 0.0)
    combine.blend_type = "ADD"
    combine.inputs["Fac"].default_value = 1.0
    links.new(banded.outputs["Color"], combine.inputs["Color1"])
    links.new(rim_tint.outputs["Color"], combine.inputs["Color2"])

    emission = nodes.new("ShaderNodeEmission")
    emission.location = (380.0, 0.0)
    emission.inputs["Strength"].default_value = 1.0
    links.new(combine.outputs["Color"], emission.inputs["Color"])
    links.new(emission.outputs["Emission"], group_out.inputs["Shader"])
    return group


def base_color_of(material):
    """The imported material's albedo: a texture image if it has one, else its value."""
    if not material.use_nodes or material.node_tree is None:
        return tuple(material.diffuse_color), None
    principled = next((node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None)
    if principled is None:
        return tuple(material.diffuse_color), None
    socket = principled.inputs["Base Color"]
    if socket.is_linked:
        upstream = socket.links[0].from_node
        if upstream.type == "TEX_IMAGE" and upstream.image is not None:
            return tuple(socket.default_value), upstream.image
    return tuple(socket.default_value), None


def apply_look_dev(mesh_objects, group) -> list[str]:
    """Rebuild every imported material as the shared look-dev group."""
    rebuilt = []
    for obj in mesh_objects:
        for slot in obj.material_slots:
            material = slot.material
            if material is None or material.get("hmh_look_dev") == LOOK_DEV_ID:
                continue
            base_rgba, base_image = base_color_of(material)
            material.use_nodes = True
            tree = material.node_tree
            tree.nodes.clear()
            output = tree.nodes.new("ShaderNodeOutputMaterial")
            output.location = (300.0, 0.0)
            node = tree.nodes.new("ShaderNodeGroup")
            node.node_tree = group
            node.location = (0.0, 0.0)
            node.inputs["Base Color"].default_value = base_rgba
            node.inputs["Rim Strength"].default_value = LOOK_DEV_RIM_STRENGTH
            if base_image is not None:
                texture = tree.nodes.new("ShaderNodeTexImage")
                texture.image = base_image
                texture.location = (-320.0, 0.0)
                tree.links.new(texture.outputs["Color"], node.inputs["Base Color"])
            tree.links.new(node.outputs["Shader"], output.inputs["Surface"])
            material["hmh_look_dev"] = LOOK_DEV_ID
            rebuilt.append(material.name)
    return sorted(set(rebuilt))


# --- actions --------------------------------------------------------------


def action_fcurve_groups(action):
    """Every fcurve collection in an action, slotted (4.4+) or legacy."""
    groups = []
    for layer in getattr(action, "layers", []):
        for strip in layer.strips:
            for bag in getattr(strip, "channelbags", []):
                groups.append(bag.fcurves)
    if not groups:
        legacy = getattr(action, "fcurves", None)
        if legacy is not None:
            groups.append(legacy)
    return groups


def strip_object_level_fcurves(action) -> int:
    """Remove root-node animation.

    glTF turns a scene-root animation into object-level location/rotation keys
    on the armature. Those would overwrite the yaw the exporter sets per
    direction and quietly render eight identical directions.
    """
    removed = 0
    for curves in action_fcurve_groups(action):
        for curve in list(curves):
            if not curve.data_path.startswith("pose.bones"):
                curves.remove(curve)
                removed += 1
    return removed


def bind_clip_actions(arm, pilot: dict) -> dict:
    """Rename, validate and quiet the actions the exporter will drive."""
    source_model = pilot.get("sourceModel", {})
    for imported, canonical in sorted(source_model.get("actionRenames", {}).items()):
        action = bpy.data.actions.get(imported)
        if action is None:
            raise RuntimeError(f"Source model has no action named {imported!r}")
        action.name = canonical

    clip_actions = pilot.get("clipActions", {})
    required_frames = {}
    for layer, clips in pilot["clips"].items():
        if layer == "shadow":
            continue
        for state, clip in clips.items():
            name = clip_actions.get(state)
            if name is None:
                raise RuntimeError(f"No clipActions entry for state {state!r}")
            required_frames[name] = max(required_frames.get(name, 0), clip["frames"])

    report = {}
    for name in sorted(required_frames):
        action = bpy.data.actions.get(name)
        if action is None:
            raise RuntimeError(f"Source model has no action named {name!r}")
        removed = strip_object_level_fcurves(action)
        start, end = action.frame_range
        if (end - start) < (required_frames[name] - 1):
            raise RuntimeError(
                f"Action {name!r} spans {end - start} frames, too short for {required_frames[name]} samples"
            )
        action.use_fake_user = True
        report[name] = {
            "frameStart": round(float(start), 4),
            "frameEnd": round(float(end), 4),
            "fcurveCount": sum(len(curves) for curves in action_fcurve_groups(action)),
            "objectLevelFcurvesRemoved": removed,
        }

    adt = arm.animation_data
    if adt is not None:
        # The glTF importer stashes every action in its own NLA track. An
        # unmuted stash evaluates on top of whatever the exporter assigns.
        for track in adt.nla_tracks:
            track.mute = True
        adt.action = None
    return report


# --- tagging and inspection ----------------------------------------------


def tag_object(obj, *, layer: str, actor_id: str, variant_id: str) -> None:
    obj["hmh_layer"] = layer
    obj["hmh_actor_id"] = actor_id
    obj["hmh_variant_id"] = variant_id
    obj["hmh_runtime_authority"] = "projection-only"


def weight_digest(obj) -> str:
    group_names = {group.index: group.name for group in obj.vertex_groups}
    rows = []
    for vertex in obj.data.vertices:
        for element in vertex.groups:
            name = group_names.get(element.group)
            if name is None:
                continue
            rows.append(f"{vertex.index}:{name}:{round(element.weight, 6):.6f}")
    rows.sort()
    return sha256_text("\n".join(rows))


def geometry_digest(obj) -> str:
    rows = [f"{index}:{round(v.co.x, 6):.6f},{round(v.co.y, 6):.6f},{round(v.co.z, 6):.6f}" for index, v in enumerate(obj.data.vertices)]
    rows += [f"f{poly.index}:" + ",".join(str(i) for i in poly.vertices) for poly in obj.data.polygons]
    return sha256_text("\n".join(rows))


def build_inspection(arm, objects_by_layer, actions: dict, *, actor_id: str, variant_id: str, source_sha256: str, target_height: float, facing_yaw: float, scale: float) -> dict:
    objects = {}
    for layer, members in objects_by_layer.items():
        for obj in members:
            objects[obj.name] = {
                "layer": layer,
                "vertexCount": len(obj.data.vertices),
                "faceCount": len(obj.data.polygons),
                "geometrySha256": geometry_digest(obj),
                "weightSha256": weight_digest(obj),
                "materials": sorted(slot.material.name for slot in obj.material_slots if slot.material),
            }
    canonical = {
        "actorId": actor_id,
        "variantId": variant_id,
        "armature": arm.name,
        "bones": sorted(bone.name for bone in arm.data.bones),
        "objectsByLayer": {layer: sorted(obj.name for obj in members) for layer, members in objects_by_layer.items()},
        "objects": objects,
        "actions": actions,
        "sourceSha256": source_sha256,
        "targetHeight": round(float(target_height), 6),
        "facingYawDegrees": round(float(facing_yaw), 6),
        "normalisationScale": round(float(scale), 6),
        "lookDev": LOOK_DEV_ID,
        "runtimeAuthority": "projection-only",
    }
    canonical["contentSha256"] = sha256_text(json.dumps(canonical, sort_keys=True, separators=(",", ":")))
    return canonical


# --- the whole import -----------------------------------------------------


def import_external_actor(manifest: dict, pilot: dict, repo_root: Path, collection) -> dict:
    """Import, normalise, split, socket, light and quiet one external actor."""
    source_model = pilot["sourceModel"]
    model_path = Path(repo_root) / source_model["path"]
    if not model_path.exists():
        raise RuntimeError(f"Source model is missing: {model_path}")
    digest = sha256_file(model_path)
    if digest != source_model["sourceSha256"]:
        raise RuntimeError(
            f"Source model SHA-256 mismatch for {pilot['actorId']}: manifest={source_model['sourceSha256']} file={digest}"
        )

    actor_id = pilot["actorId"]
    variant_id = pilot["variantId"]
    created = import_model(model_path, source_model["format"])
    for obj in created:
        move_to_collection(obj, collection)
    arm = find_armature(created)
    arm.name = pilot.get("armature", manifest["scene"]["armature"])
    arm.data.name = arm.name
    arm["hmh_source_sha256"] = digest
    arm["hmh_runtime_authority"] = "projection-only"
    arm["hmh_gameplay_body_profile"] = manifest["gameplayBodyProfile"]
    arm.hide_render = True
    # The exporter drives the eight render directions through
    # rig.rotation_euler[2]. glTF and FBX both hand the armature object over in
    # QUATERNION mode, where that assignment does nothing at all.
    arm.rotation_mode = "XYZ"
    # Every offset captured below (weapon socket, bone parenting, bounding box)
    # must be rest-relative, or a model that arrives already posed bakes that
    # pose into the layout.
    arm.data.pose_position = "REST"
    bpy.context.view_layer.update()

    socket_name = manifest["scene"]["weaponSocket"]
    ensure_weapon_socket(arm, socket_name, source_model.get("weaponSocketParentBone", "forearm.R"))

    meshes = [obj for obj in created if obj.type == "MESH"]
    for mesh in meshes:
        if mesh.parent is not arm:
            mesh.parent = arm
            mesh.matrix_parent_inverse = arm.matrix_world.inverted()
    weapons = attach_weapon_objects(meshes, arm, socket_name, source_model.get("weaponObjects", []))
    body_meshes = [mesh for mesh in skinned_meshes(meshes, arm) if mesh not in weapons]
    if len(body_meshes) != 1:
        raise RuntimeError(f"Expected exactly one skinned body mesh, found {len(body_meshes)}")
    if "weapon" in pilot["layers"] and not weapons:
        raise RuntimeError("The manifest declares a weapon layer but no weaponObjects matched")

    empty, scale = normalise_actor(
        arm,
        body_meshes,
        collection,
        target_height=source_model["targetHeight"],
        facing_yaw=source_model.get("facingYawDegrees", 0.0),
        empty_name=f"HMH_{actor_id}_Root",
    )
    empty["hmh_runtime_authority"] = "projection-only"

    halves = split_skinned_mesh_at_waist(
        body_meshes[0],
        arm,
        collection,
        actor_id=actor_id,
        variant_id=variant_id,
        lower_bones=source_model.get("lowerBodyBones"),
    )
    shadow = add_ground_shadow(arm, collection, actor_id=actor_id, variant_id=variant_id, scale=scale)

    objects_by_layer = {
        "shadow": [shadow],
        "lower-body": [halves["lower-body"]],
        "torso-head": [halves["torso-head"]],
        "weapon": sorted(weapons, key=lambda obj: obj.name),
    }
    objects_by_layer = {layer: members for layer, members in objects_by_layer.items() if layer in pilot["layers"]}
    for layer, members in objects_by_layer.items():
        for obj in members:
            tag_object(obj, layer=layer, actor_id=actor_id, variant_id=variant_id)

    # The exporter hides objects by hmh_actor_id and then reveals one layer at
    # a time, so anything the import left untagged would render on every layer.
    tagged = {obj.name for members in objects_by_layer.values() for obj in members}
    for obj in list(collection.objects):
        if obj.name not in tagged and obj.type in {"MESH", "CURVE", "SURFACE", "META", "FONT"}:
            obj.hide_render = True

    lit = [obj for members in objects_by_layer.values() for obj in members if obj is not shadow]
    materials = apply_look_dev(lit, ensure_look_dev_group())
    actions = bind_clip_actions(arm, pilot)
    arm.data.pose_position = "POSE"
    bpy.context.view_layer.update()

    inspection = build_inspection(
        arm,
        objects_by_layer,
        actions,
        actor_id=actor_id,
        variant_id=variant_id,
        source_sha256=digest,
        target_height=source_model["targetHeight"],
        facing_yaw=source_model.get("facingYawDegrees", 0.0),
        scale=scale,
    )
    inspection["lookDevMaterials"] = materials
    inspection["rootEmpty"] = empty.name
    return inspection


# --- standalone scene -----------------------------------------------------


def configure_import_scene(manifest: dict):
    """A minimal EEVEE scene under the shared light rig, for CLI inspection."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = manifest["render"]["frameSize"][0]
    scene.render.resolution_y = manifest["render"]["frameSize"][1]
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = manifest["render"]["exposure"]

    world = bpy.data.worlds.new("HMH Import World")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.015, 0.02, 0.05, 1.0)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.22
    scene.world = world

    camera_data = bpy.data.cameras.new("HMH_ImportCamera")
    camera = bpy.data.objects.new("HMH_ImportCamera", camera_data)
    scene.collection.objects.link(camera)
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = manifest["render"]["cameraOrthoScale"]
    camera.location = (3.6, -3.6, 4.2)
    camera.rotation_euler = (Vector((0.0, 0.0, 1.0)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = camera

    for channel, color, energy in shared_light_channels("hero"):
        location, size = LIGHT_PLACEMENT[channel]
        light_data = bpy.data.lights.new(channel.capitalize(), "AREA")
        light_data.energy = energy
        light_data.color = color
        light_data.shape = "DISK"
        light_data.size = size
        light = bpy.data.objects.new(channel.capitalize(), light_data)
        scene.collection.objects.link(light)
        light.location = location
        light.rotation_euler = (Vector((0.0, 0.0, 1.1)) - light.location).to_track_quat("-Z", "Y").to_euler()
    return scene


def blender_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--actor-id", required=True)
    parser.add_argument("--output-blend", required=True)
    parser.add_argument("--inspection-output", required=True)
    return parser.parse_args(argv)


def main() -> None:
    args = blender_args()
    manifest_path = Path(args.manifest).resolve()
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    repo_root = manifest_path.parents[5]
    pilot = next((entry for entry in manifest["pilots"] if entry["actorId"] == args.actor_id), None)
    if pilot is None:
        raise RuntimeError(f"Unknown actor: {args.actor_id}")
    if "sourceModel" not in pilot:
        raise RuntimeError(f"{args.actor_id} has no sourceModel; nothing to import")

    scene = configure_import_scene(manifest)
    collection = bpy.data.collections.new(f"Production__{pilot['actorId']}__{pilot['variantId']}")
    scene.collection.children.link(collection)
    inspection = import_external_actor(manifest, pilot, repo_root, collection)

    output_blend = Path(args.output_blend).resolve()
    output_blend.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output_blend), compress=True)
    write_lf_json(Path(args.inspection_output).resolve(), inspection)
    print(json.dumps({"status": "pass", "contentSha256": inspection["contentSha256"]}, sort_keys=True))


if __name__ == "__main__":
    main()
