"""Cold-open existing authored sources; never save or change the source files.

Inspection and export are separate modes so simplification follows measured
geometry. Runtime GLBs are an opening proof, not an approved art conversion.
"""
import argparse
import hashlib
import json
import sys
from pathlib import Path

import bpy
from bpy_extras import anim_utils
from mathutils import Matrix

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts/lib"))
from hmh_actor_pilot_paths import validate_pilot_output
ACTORS = {
    "lit-commando": {
        "source": "apps/hmh-reboot/assets/source/models/tripo-gameplay/Lit Commando - Layered Gameplay Pilot v2.blend",
        "sha256": "0c930374daccb2b9458a8600fdf3150dc51f6b5d8b4a47edcd05d92905fc6284",
        "rig": "HMH_TripoCommandoRig",
        "clips": {"idle": "HMH_Idle", "run": "HMH_Run", "aim": "HMH_Aim", "pistol-fire": "HMH_PistolFire", "hurt": "HMH_Hurt", "dash": "HMH_Dash", "melee": "HMH_Melee", "grenade": "HMH_Grenade", "death": "HMH_Death"},
    },
    "bagholder-rusher": {
        "source": "apps/hmh-reboot/assets/source/models/native-enemies/bagholder-rusher/bagholder-rusher-packed.blend",
        "sha256": "d71630544fb236ad3a165a3e9d3e3f7aa2f5bbd254311b6d8f9c7a1f92b85856",
        "rig": "bagholder-rusher Rig",
        "clips": {"idle": "HMH_Enemy_Idle", "run": "HMH_Enemy_Run", "tell": "HMH_Enemy_Tell", "attack": "HMH_Enemy_Attack", "hit": "HMH_Enemy_Hit", "death": "HMH_Enemy_Death"},
    },
}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def actor_meshes(actor_id, rig):
    # Retain authored props and equipment, never the baked ground shadow.
    return [obj for obj in bpy.data.objects if obj.type == "MESH"
            and "shadow" not in obj.name.lower()
            and (obj.get("hmh_actor_id") == actor_id
                 or any(mod.type == "ARMATURE" and mod.object == rig for mod in obj.modifiers)
                 or obj.parent == rig)]


def set_action(rig, action):
    adt = rig.animation_data or rig.animation_data_create()
    for track in adt.nla_tracks:
        track.mute = True
    adt.action = action
    slot = anim_utils.action_get_first_suitable_slot(action, "OBJECT")
    if slot is None:
        raise RuntimeError("No suitable armature action slot: " + action.name)
    adt.action_slot = slot


def evaluated_bounds(objects):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    low = [float("inf")] * 3
    high = [-float("inf")] * 3
    for obj in objects:
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        for vertex in mesh.vertices:
            point = evaluated.matrix_world @ vertex.co
            for i in range(3):
                low[i] = min(low[i], point[i])
                high[i] = max(high[i], point[i])
        evaluated.to_mesh_clear()
    return {"min": low, "max": high}


def inspect(actor_id, source, rig, meshes, spec):
    scene = bpy.context.scene
    clips = []
    for clip, action_name in spec["clips"].items():
        action = bpy.data.actions.get(action_name)
        if action is None:
            raise RuntimeError("Missing authored action " + action_name)
        set_action(rig, action)
        start, end = action.frame_range
        bounds = []
        for fraction in [0, .25, .5, .75, 1]:
            frame = start + (end - start) * fraction
            scene.frame_set(int(frame), subframe=frame % 1)
            bounds.append({"frame": frame, **evaluated_bounds(meshes)})
        clips.append({"clip": clip, "sourceAction": action_name, "frameRange": [start, end], "samples": bounds})
    set_action(rig, bpy.data.actions[spec["clips"]["idle"]])
    scene.frame_set(1)
    properties = bpy.ops.export_scene.gltf.get_rna_type().properties
    export_settings = {}
    for name in ["export_animation_mode", "export_nla_strips", "export_anim_slide_to_zero", "export_armature_object_remove", "export_force_sampling", "export_skins", "export_image_format", "export_keep_originals"]:
        prop = properties.get(name)
        if prop:
            export_settings[name] = {"type": prop.type, "default": str(prop.default)}
            if prop.type == "ENUM":
                export_settings[name]["choices"] = [item.identifier for item in prop.enum_items]
    return {"schema": 1, "classification": "unapproved-runtime-character-pilot", "actorId": actor_id,
            "source": spec["source"], "sourceSha256": digest(source), "sourceBytes": source.stat().st_size,
            "blenderVersion": bpy.app.version_string, "cameraDegreesFromVertical": 55,
            "rig": rig.name, "bones": len(rig.data.bones), "sceneFps": scene.render.fps / scene.render.fps_base,
            "meshes": [{"name": obj.name, "vertices": len(obj.data.vertices),
                        "triangles": sum(len(poly.vertices) - 2 for poly in obj.data.polygons),
                        "modifiers": [{"type": mod.type, "name": mod.name} for mod in obj.modifiers],
                        "parent": obj.parent.name if obj.parent else None,
                        "matrixWorld": [list(row) for row in obj.matrix_world]} for obj in meshes],
            "images": [{"name": image.name, "size": list(image.size), "packed": bool(image.packed_file)} for image in bpy.data.images if image.type == "IMAGE"],
            "clips": clips, "gltfSettings": export_settings}


def simplify(actor_id, rig, meshes):
    measured = []
    # These are experiment targets for one source-faithful pilot, not approved
    # production budgets. High-density Tripo props dominate the source count.
    targets = {"lower-body": 8000, "torso-head": 12000, "Handgun": 2500,
               "Release Palm": 400, "Knife": 1500, "Grenade": 1500}
    for obj in meshes:
        source_triangles = sum(len(poly.vertices) - 2 for poly in obj.data.polygons)
        target = 8000 if actor_id == "bagholder-rusher" else next(
            (count for text, count in targets.items() if text in obj.name), source_triangles)
        if obj.parent_type == "BONE":
            # Convert authored rigid equipment to a weighted mesh without
            # changing its world placement; glTF does not need bone parenting.
            bone_name = obj.parent_bone
            world = obj.matrix_world.copy()
            obj.parent = rig
            obj.parent_type = "OBJECT"
            obj.parent_bone = ""
            obj.matrix_world = world
            group = obj.vertex_groups.get(bone_name) or obj.vertex_groups.new(name=bone_name)
            group.add(list(range(len(obj.data.vertices))), 1, "REPLACE")
            modifier = obj.modifiers.new("Pilot rigid equipment skin", "ARMATURE")
            modifier.object = rig
        if source_triangles > target:
            bpy.context.view_layer.objects.active = obj
            modifier = obj.modifiers.new("Pilot measured simplification", "DECIMATE")
            modifier.ratio = target / source_triangles
            # Geometry only, ahead of deformation; skin and action stay live.
            bpy.ops.object.modifier_move_to_index(modifier=modifier.name, index=0)
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        repaired = obj.data.validate(clean_customdata=False)
        obj.data.update()
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.vertex_group_limit_total(limit=4)
        bpy.ops.object.vertex_group_normalize_all(lock_active=False)
        measured.append({"mesh": obj.name, "sourceTriangles": source_triangles,
                         "targetTriangles": target, "exportTriangles": sum(len(poly.vertices) - 2 for poly in obj.data.polygons),
                         "exportVertices": len(obj.data.vertices), "repairedInvalidGeometry": repaired})
    textures = []
    for image in bpy.data.images:
        if image.type != "IMAGE" or not image.size[0]:
            continue
        old_size = list(image.size)
        maximum = 1024 if "military+action+figure" in image.name else 512
        if max(old_size) > maximum:
            scale = maximum / max(old_size)
            image.scale(round(old_size[0] * scale), round(old_size[1] * scale))
            # Repack modified pixels; packed originals otherwise bypass glTF's
            # conversion and accidentally carry 4096px images into the pilot.
            image.pack()
        textures.append({"image": image.name, "sourceSize": old_size, "exportSize": list(image.size)})
    return {"meshes": measured, "textures": textures}


def prepare_clip_tracks(actor_id, rig, meshes, spec):
    # One NLA track per semantic clip; matching root/rig names merge into one
    # GLB animation. The source actions are evaluated and never rewritten.
    adt = rig.animation_data or rig.animation_data_create()
    for track in list(adt.nla_tracks):
        adt.nla_tracks.remove(track)
    root = rig.parent
    if root is None:
        root = bpy.data.objects.new("HMH_Pilot_Foot_Root", None)
        bpy.context.scene.collection.objects.link(root)
        rig.parent = root
        rig.matrix_parent_inverse = Matrix.Identity(4)
    root.animation_data_clear()
    for clip, action_name in spec["clips"].items():
        action = bpy.data.actions[action_name]
        set_action(rig, action)
        start, end = action.frame_range
        if root.animation_data:
            root.animation_data.action = None
        # Match the existing whole-actor native foot correction, now as an
        # independently animated parent so authored bone clips remain intact.
        root.location.z = 0
        grounding = []
        for frame in range(int(start), int(end) + 1):
            bpy.context.scene.frame_set(frame)
            root.location.z = 0
            bpy.context.view_layer.update()
            # Correct native body sinking; Commando already has authored lift.
            if actor_id == "bagholder-rusher":
                body = next(obj for obj in meshes if obj.get("hmh_primary_skinned_body"))
                root.location.z = -evaluated_bounds([body])["min"][2]
                root.keyframe_insert(data_path="location", index=2, frame=frame)
            grounding.append({"frame": frame, "offsetZ": root.location.z})
        root_action = root.animation_data.action if root.animation_data else None
        if root_action:
            root_action.name = "PilotFoot_" + clip
            root_slot = root.animation_data.action_slot
            root.animation_data.action = None
            root_track = root.animation_data.nla_tracks.new()
            root_track.name = clip
            strip = root_track.strips.new(clip, int(start), root_action)
            strip.action_slot = root_slot
            root_track.mute = True
        track = adt.nla_tracks.new()
        track.name = clip
        strip = track.strips.new(clip, int(start), action)
        strip.action_slot = anim_utils.action_get_first_suitable_slot(action, "OBJECT")
        track.mute = True
    adt.action = None
    root.location.z = 0
    return root


def export(actor_id, output, rig, meshes, spec):
    optimization = simplify(actor_id, rig, meshes)
    root = prepare_clip_tracks(actor_id, rig, meshes, spec)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in [root, rig, *meshes]:
        obj.hide_set(False)
        obj.hide_viewport = False
        obj.select_set(True)
    bpy.context.view_layer.objects.active = rig
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(output), export_format="GLB",
                              export_yup=True, export_skins=True, export_animations=True,
                              export_animation_mode="NLA_TRACKS", export_anim_slide_to_zero=True,
                              export_force_sampling=True, export_optimize_animation_size=False,
                              export_optimize_animation_keep_anim_object=True,
                              export_apply=False, export_image_format="AUTO",
                              use_selection=True, export_cameras=False, export_lights=False)
    return {"output": output.relative_to(ROOT).as_posix(), "sha256": digest(output),
            "bytes": output.stat().st_size, "optimization": optimization}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--actor", choices=list(ACTORS), required=True)
    parser.add_argument("--mode", choices=["inspect", "export"], default="inspect")
    parser.add_argument("--output", required=True)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
    # Validate before opening Blender or writing anything, not a post-write
    # digest that discovers source destruction after it already happened.
    output = validate_pilot_output(ROOT, args.actor, args.mode, args.output)
    spec = ACTORS[args.actor]
    source = ROOT / spec["source"]
    if digest(source) != spec["sha256"]:
        raise RuntimeError("Immutable source digest mismatch: " + spec["source"])
    bpy.ops.wm.open_mainfile(filepath=str(source), load_ui=False, use_scripts=False)
    rig = bpy.data.objects.get(spec["rig"])
    if rig is None or rig.type != "ARMATURE":
        raise RuntimeError("Expected authored armature missing")
    meshes = actor_meshes(args.actor, rig)
    if not meshes:
        raise RuntimeError("No authored skinned meshes")
    inspection_path = ROOT / ".tmp/hmh-actor-3d-pilot" / (args.actor + "-inspection.json")
    if args.mode == "export":
        if not inspection_path.exists():
            raise RuntimeError("Inspect immutable source before exporting")
        receipt = json.loads(inspection_path.read_text(encoding="utf-8"))
        if receipt["sourceSha256"] != spec["sha256"]:
            raise RuntimeError("Inspection source digest mismatch")
        receipt["export"] = export(args.actor, output, rig, meshes, spec)
        output = inspection_path.with_name(args.actor + "-export.json")
    else:
        receipt = inspect(args.actor, source, rig, meshes, spec)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    if digest(source) != spec["sha256"]:
        raise RuntimeError("Source changed during pilot")
    print("HMH_ACTOR_PILOT_RECEIPT=" + str(output))


if __name__ == "__main__":
    main()
