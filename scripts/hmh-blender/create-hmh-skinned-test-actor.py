"""Generate a throwaway skinned GLB that stands in for an owner-supplied model.

Nothing here ships. The file exists so the external-model importer (P-1) and the
skinned exporter branch (P-2) can be proven end to end — waist split, weapon
socket, look dev, action sampling, two-run reproducibility — before the owner
spends Tripo/Mixamo credits on a real hero.

It deliberately imitates what a Tripo -> Mixamo delivery looks like rather than
what the procedural pipeline builds:

- ONE skinned body mesh, not per-part objects tagged by name. The importer has
  to find the waist itself, from vertex weights.
- NO `weapon_socket` bone. The importer has to create it under the hand bone and
  re-parent the weapon to it.
- Euler-authored actions exported through glTF, which only stores quaternions.
  They come back quaternion-keyed, which is exactly the case that makes the
  exporter's trigonometric `reset_pose` (it forces rotation_mode = "XYZ") unsafe.
- One asymmetric detail per half (a right knee pad, a left shoulder pack) so a
  mirrored run pose can never render as the same pixels from a symmetric camera.

Run headless:

    blender --background --factory-startup \
      --python scripts/hmh-blender/create-hmh-skinned-test-actor.py -- \
      --output .tmp/hmh-skinned-test-actor/hmh-skinned-test-actor.glb
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
import sys

import bmesh
import bpy
from bpy_extras import anim_utils
from mathutils import Matrix, Vector

FPS = 24
ARMATURE_NAME = "HMH_SkinnedTestRig"
BODY_NAME = "HMH_SkinnedTest_Body"
WEAPON_NAME = "HMH_Test_Pistol"

# Same names and joint positions as create-hmh-commando-concepts.py:146-160,
# minus `weapon_socket`: the importer has to add that itself.
BONES = {
    "root": ((0.0, 0.0, 0.0), (0.0, 0.0, 0.35), None),
    "pelvis": ((0.0, 0.0, 0.68), (0.0, 0.0, 0.98), "root"),
    "spine": ((0.0, 0.0, 0.98), (0.0, 0.0, 1.38), "pelvis"),
    "chest": ((0.0, 0.0, 1.28), (0.0, 0.0, 1.58), "spine"),
    "head": ((0.0, 0.0, 1.55), (0.0, 0.0, 1.92), "chest"),
    "upper_arm.L": ((-0.2, 0.0, 1.43), (-0.55, 0.0, 1.25), "chest"),
    "forearm.L": ((-0.55, 0.0, 1.25), (-0.75, -0.04, 1.08), "upper_arm.L"),
    "upper_arm.R": ((0.2, 0.0, 1.43), (0.55, 0.0, 1.25), "chest"),
    "forearm.R": ((0.55, 0.0, 1.25), (0.74, -0.04, 1.08), "upper_arm.R"),
    "thigh.L": ((-0.13, 0.0, 0.78), (-0.16, 0.0, 0.38), "pelvis"),
    "shin.L": ((-0.16, 0.0, 0.38), (-0.17, -0.05, 0.06), "thigh.L"),
    "thigh.R": ((0.13, 0.0, 0.78), (0.16, 0.0, 0.38), "pelvis"),
    "shin.R": ((0.16, 0.0, 0.38), (0.17, -0.05, 0.06), "thigh.R"),
}
# `root` never owns geometry; binding to it would drag the whole actor.
DEFORM_BONES = tuple(name for name in BONES if name != "root")

# (name, centre, half extents, material key). Boxes only: the point is a
# deterministic, human-readable, low-poly stand-in.
BODY_PARTS = (
    ("pelvis_box", (0.0, 0.0, 0.86), (0.15, 0.11, 0.16), "suit"),
    ("chest_box", (0.0, 0.0, 1.32), (0.20, 0.12, 0.28), "suit"),
    ("neck_box", (0.0, 0.0, 1.57), (0.07, 0.07, 0.05), "skin"),
    ("head_box", (0.0, 0.0, 1.73), (0.12, 0.12, 0.14), "skin"),
    ("shoulder_pack_L", (-0.30, 0.13, 1.47), (0.09, 0.06, 0.08), "accent"),
    ("upper_arm_L", (-0.38, 0.0, 1.34), (0.19, 0.07, 0.07), "suit"),
    ("forearm_L", (-0.65, -0.02, 1.17), (0.12, 0.06, 0.06), "skin"),
    ("upper_arm_R", (0.38, 0.0, 1.34), (0.19, 0.07, 0.07), "suit"),
    ("forearm_R", (0.65, -0.02, 1.17), (0.12, 0.06, 0.06), "skin"),
    ("thigh_L", (-0.145, 0.0, 0.58), (0.08, 0.08, 0.21), "suit"),
    ("shin_L", (-0.165, -0.025, 0.22), (0.07, 0.07, 0.17), "suit"),
    ("foot_L", (-0.165, -0.09, 0.04), (0.07, 0.13, 0.04), "accent"),
    ("thigh_R", (0.145, 0.0, 0.58), (0.08, 0.08, 0.21), "suit"),
    ("shin_R", (0.165, -0.025, 0.22), (0.07, 0.07, 0.17), "suit"),
    ("knee_pad_R", (0.165, -0.10, 0.40), (0.07, 0.03, 0.06), "accent"),
    ("foot_R", (0.165, -0.09, 0.04), (0.07, 0.13, 0.04), "accent"),
)
WEAPON_PART = ((0.80, -0.16, 1.02), (0.035, 0.13, 0.045))

MATERIALS = {
    "suit": ((0.09, 0.13, 0.26, 1.0), 0.62),
    "skin": ((0.55, 0.40, 0.32, 1.0), 0.78),
    "accent": ((0.72, 0.50, 0.18, 1.0), 0.45),
}
MATERIAL_ORDER = ("suit", "skin", "accent")


def blender_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("--report-output", default="")
    return parser.parse_args(argv)


def make_material(key: str):
    rgba, roughness = MATERIALS[key]
    material = bpy.data.materials.new(f"HMH_SkinnedTest_{key}")
    material.use_nodes = True
    material.diffuse_color = rgba
    node = material.node_tree.nodes.get("Principled BSDF")
    if node is not None:
        node.inputs["Base Color"].default_value = rgba
        node.inputs["Roughness"].default_value = roughness
        node.inputs["Metallic"].default_value = 0.0
    return material


def build_armature():
    armature = bpy.data.armatures.new(ARMATURE_NAME)
    rig = bpy.data.objects.new(ARMATURE_NAME, armature)
    bpy.context.scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    for name, (head, tail, parent) in BONES.items():
        bone = armature.edit_bones.new(name)
        bone.head = head
        bone.tail = tail
        if parent:
            bone.parent = armature.edit_bones[parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    return rig


def build_mesh(name: str, parts, materials):
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    slot_index = {key: index for index, key in enumerate(MATERIAL_ORDER)}
    for _, centre, half, material_key in parts:
        matrix = Matrix.Translation(Vector(centre)) @ Matrix.Diagonal(
            Vector((half[0] * 2.0, half[1] * 2.0, half[2] * 2.0, 1.0))
        )
        result = bmesh.ops.create_cube(bm, size=1.0, matrix=matrix)
        faces = {face for vert in result["verts"] for face in vert.link_faces}
        for face in faces:
            face.material_index = slot_index[material_key]
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    for key in MATERIAL_ORDER:
        mesh.materials.append(materials[key])
    return obj


def bone_segments(rig):
    return [(name, Vector(BONES[name][0]), Vector(BONES[name][1])) for name in sorted(DEFORM_BONES)]


def distance_to_segment(point: Vector, head: Vector, tail: Vector) -> float:
    axis = tail - head
    length_squared = axis.length_squared
    if length_squared <= 0.0:
        return (point - head).length
    t = max(0.0, min(1.0, (point - head).dot(axis) / length_squared))
    return (point - (head + axis * t)).length


def bind_weights(obj, rig, blend_window: float = 0.08) -> None:
    """Deterministic nearest-bone weights with a two-bone blend near joints.

    Blender's ARMATURE_AUTO heat map is not reproducible enough to pin a
    SHA-256 against, so the weights are computed here in plain Python.
    """
    segments = bone_segments(rig)
    groups = {name: obj.vertex_groups.new(name=name) for name, _, _ in segments}
    for vertex in obj.data.vertices:
        ranked = sorted(
            ((distance_to_segment(vertex.co, head, tail), name) for name, head, tail in segments),
            key=lambda entry: (round(entry[0], 6), entry[1]),
        )
        best_distance, best_name = ranked[0]
        second_distance, second_name = ranked[1]
        if second_distance - best_distance <= blend_window:
            first = 1.0 / max(best_distance, 1e-4)
            second = 1.0 / max(second_distance, 1e-4)
            total = first + second
            assignments = ((best_name, first / total), (second_name, second / total))
        else:
            assignments = ((best_name, 1.0),)
        for name, weight in assignments:
            groups[name].add([vertex.index], round(weight, 6), "REPLACE")
    modifier = obj.modifiers.new("Armature", "ARMATURE")
    modifier.object = rig
    obj.parent = rig
    obj.matrix_parent_inverse.identity()


def bind_single_bone(obj, rig, bone_name: str) -> None:
    group = obj.vertex_groups.new(name=bone_name)
    group.add([vertex.index for vertex in obj.data.vertices], 1.0, "REPLACE")
    modifier = obj.modifiers.new("Armature", "ARMATURE")
    modifier.object = rig
    obj.parent = rig
    obj.matrix_parent_inverse.identity()


# --- actions --------------------------------------------------------------


def idle_pose(frame: int) -> dict:
    # Cosine, not sine: the exporter samples a 2-frame clip at 0 and at the
    # half-period, and a sine would put both samples on the same zero crossing.
    wave = math.cos(2.0 * math.pi * frame / 24.0)
    return {
        "pelvis": {"location": (0.0, 0.0, 0.03 * wave), "rotation_euler": (0.05 * wave, 0.0, 0.0)},
        "chest": {"rotation_euler": (-0.05 * wave, 0.0, 0.0)},
        "head": {"rotation_euler": (0.03 * wave, 0.0, 0.0)},
        "thigh.L": {"rotation_euler": (0.05 * wave, 0.0, 0.0)},
        "thigh.R": {"rotation_euler": (-0.05 * wave, 0.0, 0.0)},
        "upper_arm.L": {"rotation_euler": (-0.10 * wave, 0.0, 0.0)},
        "upper_arm.R": {"rotation_euler": (0.10 * wave, 0.0, 0.0)},
    }


def run_pose(frame: int) -> dict:
    phase = 2.0 * math.pi * frame / 24.0
    # The right leg is offset by 2.1 rad rather than pi. An exact half-period
    # offset makes frame 0 and frame 12 mirror images, and a symmetric actor
    # rendered from the front would hash identically.
    other = phase + 2.1
    return {
        "pelvis": {
            "location": (0.0, 0.0, 0.04 * abs(math.sin(phase)) + 0.01 * math.cos(phase)),
            "rotation_euler": (0.0, 0.0, 0.10 * math.cos(phase)),
        },
        "chest": {"rotation_euler": (0.12, 0.0, -0.10 * math.cos(phase))},
        "thigh.L": {"rotation_euler": (0.60 * math.sin(phase), 0.0, 0.0)},
        "thigh.R": {"rotation_euler": (0.60 * math.sin(other), 0.0, 0.0)},
        "shin.L": {"rotation_euler": (-0.70 * max(0.0, math.sin(phase + math.pi / 2)), 0.0, 0.0)},
        "shin.R": {"rotation_euler": (-0.70 * max(0.0, math.sin(other + math.pi / 2)), 0.0, 0.0)},
        "upper_arm.L": {"rotation_euler": (-0.45 * math.sin(other), 0.0, 0.0)},
        "upper_arm.R": {"rotation_euler": (-0.45 * math.sin(phase), 0.0, 0.0)},
    }


def aim_pose(frame: int) -> dict:
    wave = math.cos(2.0 * math.pi * frame / 24.0)
    return {
        "chest": {"rotation_euler": (-0.08 * wave, 0.0, 0.0)},
        "head": {"rotation_euler": (0.05 * wave, 0.0, 0.0)},
        "upper_arm.L": {"rotation_euler": (-0.50 - 0.15 * wave, 0.0, -0.25)},
        "forearm.L": {"rotation_euler": (-0.60 - 0.10 * wave, 0.0, 0.20)},
        "upper_arm.R": {"rotation_euler": (-0.60 - 0.25 * wave, 0.0, 0.18)},
        "forearm.R": {"rotation_euler": (-0.70 + 0.20 * wave, 0.0, -0.16)},
    }


def death_pose(frame: int) -> dict:
    progress = frame / 30.0
    collapse = progress * progress
    return {
        "pelvis": {
            "location": (0.30 * collapse, 0.0, -0.45 * collapse),
            "rotation_euler": (0.0, 1.35 * collapse, 0.0),
        },
        "chest": {"rotation_euler": (0.0, 1.20 * collapse, -0.25 * collapse)},
        "head": {"rotation_euler": (0.0, 0.80 * collapse, 0.0)},
        "thigh.L": {"rotation_euler": (0.50 * collapse, 0.0, 0.0)},
        "thigh.R": {"rotation_euler": (-0.60 * collapse, 0.0, 0.0)},
        "shin.L": {"rotation_euler": (-0.70 * collapse, 0.0, 0.0)},
        "shin.R": {"rotation_euler": (-0.40 * collapse, 0.0, 0.0)},
        "upper_arm.L": {"rotation_euler": (0.0, 0.0, -1.00 * collapse)},
        "upper_arm.R": {"rotation_euler": (0.0, 0.0, 1.10 * collapse)},
        "forearm.R": {"rotation_euler": (-0.50 * collapse, 0.0, 0.0)},
    }


ACTION_SPECS = (
    ("HMH_Idle", 24, idle_pose),
    ("HMH_Run", 24, run_pose),
    ("HMH_Aim", 24, aim_pose),
    ("HMH_Death", 30, death_pose),
)


def author_actions(rig) -> list[str]:
    """Author every action as a slotted action, keyed on every frame.

    Keying every frame keeps the exported samples exact: the exporter picks
    frames by index, so an interpolated curve would put the two-frame clips on
    values that depend on the interpolation mode surviving the glTF round trip.
    """
    for pose_bone in rig.pose.bones:
        pose_bone.rotation_mode = "XYZ"
    adt = rig.animation_data_create()
    authored = []
    for name, length, poser in ACTION_SPECS:
        action = bpy.data.actions.new(name)
        action.use_fake_user = True
        slot = action.slots.new("OBJECT", rig.name)
        channelbag = anim_utils.action_ensure_channelbag_for_slot(action, slot)
        curves = {}
        for frame in range(length + 1):
            for bone_name, channels in sorted(poser(frame).items()):
                for channel, values in sorted(channels.items()):
                    for index, value in enumerate(values):
                        key = (bone_name, channel, index)
                        curve = curves.get(key)
                        if curve is None:
                            curve = channelbag.fcurves.new(
                                f'pose.bones["{bone_name}"].{channel}',
                                index=index,
                                group_name=bone_name,
                            )
                            curves[key] = curve
                        point = curve.keyframe_points.insert(float(frame), float(value))
                        point.interpolation = "LINEAR"
        track = adt.nla_tracks.new()
        track.name = name
        strip = track.strips.new(name, 0, action)
        if hasattr(strip, "action_slot"):
            strip.action_slot = slot
        track.mute = True
        authored.append(name)
    adt.action = None
    return authored


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    args = blender_args()
    output = Path(args.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.fps = FPS
    scene.frame_start = 0
    scene.frame_end = 30

    materials = {key: make_material(key) for key in MATERIAL_ORDER}
    rig = build_armature()
    body = build_mesh(BODY_NAME, BODY_PARTS, materials)
    bind_weights(body, rig)
    weapon = build_mesh(WEAPON_NAME, ((WEAPON_NAME, WEAPON_PART[0], WEAPON_PART[1], "accent"),), materials)
    bind_single_bone(weapon, rig, "forearm.R")
    actions = author_actions(rig)

    for obj in bpy.data.objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.export_scene.gltf(
        filepath=str(output),
        export_format="GLB",
        export_yup=True,
        export_skins=True,
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_optimize_animation_size=False,
        export_apply=False,
        use_selection=False,
    )
    report = {
        "status": "pass",
        "output": str(output),
        "sha256": sha256_file(output),
        "bytes": output.stat().st_size,
        "actions": actions,
        "objects": sorted(obj.name for obj in bpy.data.objects),
        "vertexCount": len(body.data.vertices),
        "faceCount": len(body.data.polygons),
    }
    if args.report_output:
        report_path = Path(args.report_output).resolve()
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps(report, sort_keys=True))


if __name__ == "__main__":
    main()
