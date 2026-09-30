"""Cold-open existing authored sources; never save or change the source files.

Inspection and export are separate modes so simplification follows measured
geometry. Runtime GLBs are an opening proof, not an approved art conversion.
"""
import argparse
import hashlib
import importlib.util
import json
import sys
from pathlib import Path

import bpy
from bpy_extras import anim_utils
from mathutils import Matrix, Vector

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
    "lilly": {
        "source": "apps/hmh-reboot/assets/source/models/tripo-gameplay/Lilly - Weighted Gameplay compact-v2.blend",
        "sha256": "5f9152e713f7c4f79e96d1f1a4415dd1fb96a2685d3d14f22a65e895c8e7d6b2",
        "rig": "HMH_TripoRig_lilly",
        "clips": {"idle": "HMH_Idle", "run": "HMH_Run", "aim": "HMH_Aim", "pistol-fire": "HMH_PistolFire", "hurt": "HMH_Hurt", "dash": "HMH_Dash", "melee": "HMH_Melee", "grenade": "HMH_Grenade", "death": "HMH_Death"},
    },
    "lit-valkyrie": {
        "source": "apps/hmh-reboot/assets/source/models/tripo-gameplay/Lit Valkyrie - Weighted Gameplay compact-v2.blend",
        "sha256": "f090f2e2a387f8ee3c2666bed1af22344f6ec82b1695bc62f1d18f1cfb8268ec",
        "rig": "HMH_TripoRig_lit-valkyrie",
        "clips": {
            "idle": "HMH_Idle",
            "run": "HMH_Run",
            "aim": "HMH_Aim",
            "pistol-fire": "HMH_PistolFire",
            "hurt": "HMH_Hurt",
            "dash": "HMH_Dash",
            "melee": "HMH_Melee",
            "grenade": "HMH_Grenade",
            "death": "HMH_Death"
        }
    },
    "lester-original": {
        "source": "apps/hmh-reboot/assets/source/models/tripo-gameplay/Lester Original - Weighted Gameplay compact-v2.blend",
        "sha256": "ed1278ea131927f9849fb62f265512a8547186fb9b9c06b08da78fb438eacc96",
        "rig": "HMH_TripoRig_lester-original",
        "clips": {
            "idle": "HMH_Idle",
            "run": "HMH_Run",
            "aim": "HMH_Aim",
            "pistol-fire": "HMH_PistolFire",
            "hurt": "HMH_Hurt",
            "dash": "HMH_Dash",
            "melee": "HMH_Melee",
            "grenade": "HMH_Grenade",
            "death": "HMH_Death"
        }
    },
    "bagholder-rusher": {
        "source": "apps/hmh-reboot/assets/source/models/native-enemies/bagholder-rusher/bagholder-rusher-packed.blend",
        "sha256": "d71630544fb236ad3a165a3e9d3e3f7aa2f5bbd254311b6d8f9c7a1f92b85856",
        "rig": "bagholder-rusher Rig",
        "clips": {"idle": "HMH_Enemy_Idle", "run": "HMH_Enemy_Run", "tell": "HMH_Enemy_Tell", "attack": "HMH_Enemy_Attack", "hit": "HMH_Enemy_Hit", "death": "HMH_Enemy_Death"},
    },
    "the-liquidator": {
        "source": "apps/hmh-reboot/assets/source/models/native-enemies/the-liquidator/the-liquidator.blend",
        "sha256": "56a9e240a8cc053f09e2ef95046bf84520ffa65ec561c5dec5e1f46c6ebed574",
        "rig": "the-liquidator Native Rig",
        "phase": "market-open",
        "groundNativeBody": True,
        "clips": {"idle": "HMH_the-liquidator_idle", "run": "HMH_the-liquidator_run", "tell": "HMH_the-liquidator_tell", "attack": "HMH_the-liquidator_attack", "hit": "HMH_the-liquidator_hit", "death": "HMH_the-liquidator_death"},
    },
}

NATIVE_ENEMY_IDS = ('forkrunner', 'liquidator-agent', 'whale-enforcer', 'gas-bomber', 'validator-cultist')
ACTORS.update({'forkrunner': {'source': 'apps/hmh-reboot/assets/source/models/native-enemies/forkrunner/forkrunner.blend', 'sha256': 'a3f56a810c4dde961c9b7d7391bd95d89603a765636a98e522395c5ba6f9dc67', 'rig': 'forkrunner Native Rig', 'clips': {'idle': 'HMH_forkrunner_idle', 'run': 'HMH_forkrunner_run', 'tell': 'HMH_forkrunner_tell', 'attack': 'HMH_forkrunner_attack', 'hit': 'HMH_forkrunner_hit', 'death': 'HMH_forkrunner_death'}, 'groundNativeBody': False}, 'liquidator-agent': {'source': 'apps/hmh-reboot/assets/source/models/native-enemies/liquidator-agent/liquidator-agent.blend', 'sha256': '6a9ac0ba9ae273be91a08cc0f717b0b3190b169b53362075eb8081ac8e0645a6', 'rig': 'liquidator-agent Native Rig', 'clips': {'idle': 'HMH_liquidator-agent_idle', 'run': 'HMH_liquidator-agent_run', 'tell': 'HMH_liquidator-agent_tell', 'attack': 'HMH_liquidator-agent_attack', 'hit': 'HMH_liquidator-agent_hit', 'death': 'HMH_liquidator-agent_death'}, 'groundNativeBody': False}, 'whale-enforcer': {'source': 'apps/hmh-reboot/assets/source/models/native-enemies/whale-enforcer/whale-enforcer.blend', 'sha256': '9e2ded2b63c852e46ea3b49349ca48f8e7fe1eb73804438ea5b306a737fefe50', 'rig': 'whale-enforcer Native Rig', 'clips': {'idle': 'HMH_whale-enforcer_idle', 'run': 'HMH_whale-enforcer_run', 'tell': 'HMH_whale-enforcer_tell', 'attack': 'HMH_whale-enforcer_attack', 'hit': 'HMH_whale-enforcer_hit', 'death': 'HMH_whale-enforcer_death'}, 'groundNativeBody': True}, 'gas-bomber': {'source': 'apps/hmh-reboot/assets/source/models/native-enemies/gas-bomber/gas-bomber.blend', 'sha256': '620289a19cb8e5a025b2c614b90bc938e8db55e846924a92e41e7c679366c6f4', 'rig': 'gas-bomber Native Rig', 'clips': {'idle': 'HMH_gas-bomber_idle', 'run': 'HMH_gas-bomber_run', 'tell': 'HMH_gas-bomber_tell', 'attack': 'HMH_gas-bomber_attack', 'hit': 'HMH_gas-bomber_hit', 'death': 'HMH_gas-bomber_death'}, 'groundNativeBody': True}, 'validator-cultist': {'source': 'apps/hmh-reboot/assets/source/models/native-enemies/validator-cultist/validator-cultist.blend', 'sha256': '202e9ff2487d989655ee3c132e19e8d828f0522bcdadab8e87387c6259658efc', 'rig': 'validator-cultist Native Rig', 'clips': {'idle': 'HMH_validator-cultist_idle', 'run': 'HMH_validator-cultist_run', 'tell': 'HMH_validator-cultist_tell', 'attack': 'HMH_validator-cultist_attack', 'hit': 'HMH_validator-cultist_hit', 'death': 'HMH_validator-cultist_death'}, 'groundNativeBody': True}})

WEIGHTED_HERO_NAMES = {"lilly": "Lilly", "lit-valkyrie": "Lit Valkyrie", "lester-original": "Lester Original"}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def actor_meshes(actor_id, rig, all_phases=False):
    # Retain authored props and equipment, never the baked ground shadow.
    meshes = [obj for obj in bpy.data.objects if obj.type == "MESH"
            and "shadow" not in obj.name.lower()
            and (obj.get("hmh_actor_id") == actor_id
                 or any(mod.type == "ARMATURE" and mod.object == rig for mod in obj.modifiers)
                 or obj.parent == rig)]
    phase = ACTORS[actor_id].get("phase")
    return [obj for obj in meshes if all_phases or not phase or not obj.get("hmh_visible_phases")
            or phase in obj["hmh_visible_phases"].split(",")]


def mesh_inventory(obj, rig):
    bone_groups = {group.index for group in obj.vertex_groups if group.name in rig.data.bones}
    influences = [sum(weight.weight > 0 for weight in vertex.groups if weight.group in bone_groups) for vertex in obj.data.vertices]
    evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = evaluated.to_mesh()
    try:
        evaluated_vertices = len(mesh.vertices)
        evaluated_triangles = sum(len(poly.vertices) - 2 for poly in mesh.polygons)
    finally:
        evaluated.to_mesh_clear()
    return {"name": obj.name, "vertices": len(obj.data.vertices),
            "triangles": sum(len(poly.vertices) - 2 for poly in obj.data.polygons),
            "evaluatedVertices": evaluated_vertices, "evaluatedTriangles": evaluated_triangles,
            "modifiers": [{"type": mod.type, "name": mod.name} for mod in obj.modifiers],
            "parent": obj.parent.name if obj.parent else None, "parentType": obj.parent_type, "parentBone": obj.parent_bone,
            "primarySkinnedBody": bool(obj.get("hmh_primary_skinned_body")), "nativeBody": bool(obj.get("hmh_native_body")),
            "weightedCostume": bool(obj.get("hmh_skinned_costume")), "roleGear": bool(obj.get("hmh_role_gear")),
            "visiblePhases": obj.get("hmh_visible_phases", ""), "hiddenRender": obj.hide_render,
            "materials": [slot.material.name if slot.material else None for slot in obj.material_slots],
            "weightedVertices": sum(count > 0 for count in influences), "blendedVertices": sum(count > 1 for count in influences),
            "maximumInfluences": max(influences, default=0), "matrixWorld": [list(row) for row in obj.matrix_world]}


def material_inventory(meshes):
    materials = {slot.material.name: slot.material for obj in meshes for slot in obj.material_slots if slot.material}
    return [{"name": name, "nodes": [{"name": node.name, "type": node.type} for node in material.node_tree.nodes] if material.node_tree else [],
             "linked": bool(material.library), "proceduralGraphNotBakedByPilot": bool(material.node_tree and any(
                 node.type in {"TEX_NOISE", "TEX_VORONOI", "BUMP", "VALTORGB"} for node in material.node_tree.nodes))}
            for name, material in sorted(materials.items())]


def preserve_authored_constant_pbr(meshes):
    # glTF cannot carry these procedural Blender wear/bump graphs. Preserve
    # authored BSDF constants in this in-memory diagnostic copy rather than
    # exporting unsupported linked colour as white. This is not a texture bake.
    records = []
    materials = {slot.material.name: slot.material for obj in meshes for slot in obj.material_slots if slot.material}
    for name, material in sorted(materials.items()):
        if not material.node_tree or not any(node.type in {"TEX_NOISE", "TEX_VORONOI", "BUMP", "VALTORGB"} for node in material.node_tree.nodes):
            continue
        bsdf = material.node_tree.nodes.get("Principled BSDF")
        if bsdf is None:
            raise RuntimeError("Measured procedural material has no authored PBR fallback: " + name)
        removed = []
        for input_name in ["Base Color", "Normal", "Roughness", "Metallic"]:
            for link in list(bsdf.inputs[input_name].links):
                removed.append({"input": input_name, "sourceNode": link.from_node.name, "sourceType": link.from_node.type})
                material.node_tree.links.remove(link)
        records.append({"material": name, "baseColorLinearRgba": list(bsdf.inputs["Base Color"].default_value),
                        "roughness": bsdf.inputs["Roughness"].default_value, "metallic": bsdf.inputs["Metallic"].default_value,
                        "removedUnsupportedLinks": removed, "proceduralWearAndBumpBaked": False})
    return records


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
        # The packed hero sources contain dense equipment. Measure its source
        # inventory once; the optimized GLB receives all 45 existing pose checks.
        for fraction in ([] if actor_id in (*WEIGHTED_HERO_NAMES, *NATIVE_ENEMY_IDS) else [0, .25, .5, .75, 1]):
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
            "phase": spec.get("phase"), "meshes": [mesh_inventory(obj, rig) for obj in meshes],
            "excludedPhaseMeshes": [mesh_inventory(obj, rig) for obj in actor_meshes(actor_id, rig, all_phases=True) if obj not in meshes],
            "materials": material_inventory(meshes),
            "rigBones": [{"name": bone.name, "parent": bone.parent.name if bone.parent else None} for bone in rig.data.bones],
            "images": [{"name": image.name, "size": list(image.size), "packed": bool(image.packed_file)} for image in bpy.data.images if image.type == "IMAGE"],
            "clips": clips, "gltfSettings": export_settings,
            "sourcePoseBoundsSampled": actor_id not in (*WEIGHTED_HERO_NAMES, *NATIVE_ENEMY_IDS)}


def simplify(actor_id, rig, meshes):
    measured = []
    # These are experiment targets for one source-faithful pilot, not approved
    # production budgets. High-density Tripo props dominate the source count.
    targets = {"lower-body": 8000, "torso-head": 12000, "Handgun": 2500,
               "Release Palm": 400, "Knife": 1500, "Grenade": 1500}
    hero_prefix = WEIGHTED_HERO_NAMES.get(actor_id)
    hero_targets = {f"{hero_prefix} | {part}": count for part, count in {
        "lower-body": 8000, "torso-head": 14000, "coin-blaster": 2500,
        "litecoin-knife": 1000, "satoshi-frag-held": 1000, "satoshi-frag-released": 1000}.items()}
    if hero_prefix and {obj.name for obj in meshes} != set(hero_targets):
        raise RuntimeError("Weighted hero source mesh ownership changed")
    body_images = {node.image.name for obj in meshes if obj.name in {f"{hero_prefix} | lower-body", f"{hero_prefix} | torso-head"}
                   for slot in obj.material_slots if slot.material and slot.material.node_tree
                   for node in slot.material.node_tree.nodes if node.type == "TEX_IMAGE" and node.image}
    for obj in meshes:
        source_triangles = sum(len(poly.vertices) - 2 for poly in obj.data.polygons)
        target = (8000 if actor_id == "bagholder-rusher" or actor_id == "the-liquidator" and obj.get("hmh_primary_skinned_body") else next(
            (count for text, count in targets.items() if text in obj.name), source_triangles))
        if hero_prefix:
            target = hero_targets[obj.name]
        if actor_id in NATIVE_ENEMY_IDS:
            if obj.get("hmh_primary_skinned_body"):
                target = 8000
            elif obj.name.startswith("rugged-rifle__tripo_part_"):
                target = {"0": 1500, "1": 1000, "2": 800}[obj.name.rsplit("_", 1)[1]]
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
        maximum = 1024 if "military+action+figure" in image.name or hero_prefix and image.name in body_images else 512
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
            if actor_id == "bagholder-rusher" or spec.get("groundNativeBody"):
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


def fit_native_head_gear(actor_id, rig, meshes):
    if actor_id not in {"forkrunner", "liquidator-agent", "gas-bomber", "validator-cultist"}:
        return []
    # These authored attachments were placed at generic standing-head heights.
    # Fit only the unsaved derivative gear to its actual weighted head, keeping
    # the original skin, bones/actions and all unrelated costume pieces intact.
    points = []
    for obj in meshes:
        if not obj.get("hmh_native_body"):
            continue
        group = obj.vertex_groups.get("head")
        if group is None:
            continue
        for vertex in obj.data.vertices:
            if sum(item.weight for item in vertex.groups if item.group == group.index) >= .8:
                points.append(obj.matrix_world @ vertex.co)
    if not points:
        raise RuntimeError("Native head anatomy unavailable for attachment fitting")
    low = Vector(tuple(min(point[a] for point in points) for a in range(3)))
    high = Vector(tuple(max(point[a] for point in points) for a in range(3)))
    records = []
    for obj in meshes:
        if obj.parent_type != "BONE" or obj.parent_bone != "head":
            continue
        original = obj.matrix_world.copy()
        bounds = [original @ Vector(corner) for corner in obj.bound_box]
        lo = Vector(tuple(min(point[a] for point in bounds) for a in range(3)))
        hi = Vector(tuple(max(point[a] for point in bounds) for a in range(3)))
        centre = (lo + hi) * .5
        if obj.name.endswith("_OpenHood"):
            target_low = Vector((low.x - .045, low.y + .08, low.z - .10))
            target_high = Vector((high.x + .045, high.y + .035, high.z + .035))
            if any(hi[a] <= lo[a] or target_high[a] <= target_low[a] for a in range(3)):
                raise RuntimeError("Degenerate native hood fit")
            scale = (target_high - target_low)
            scale = Vector(tuple(scale[a] / (hi[a] - lo[a]) for a in range(3)))
            target = (target_low + target_high) * .5
            obj.matrix_world = Matrix.Translation(target) @ Matrix.Diagonal((*scale, 1)) @ Matrix.Translation(-centre) @ original
        elif obj.name.endswith("_Visor") or actor_id == "gas-bomber" and any(token in obj.name for token in ["_Mask", "_Respirator", "_Goggle"]):
            fraction = .60 if obj.name.endswith("_Visor") else .70 if "_Goggle" in obj.name else .40
            target = Vector((centre.x, low.y - .01, low.z + (high.z - low.z) * fraction))
            obj.matrix_world = Matrix.Translation(target - centre) @ original
        else:
            continue
        records.append({"mesh": obj.name, "beforeMatrix": [list(row) for row in original],
                        "afterMatrix": [list(row) for row in obj.matrix_world], "nativeHeadMin": list(low), "nativeHeadMax": list(high)})
    bpy.context.view_layer.update()
    return records


def prepare_native_enemy(actor_id, rig, meshes):
    # Reuse the already measured native material bake. Image-textured bodies
    # and rifle parts keep their UVs; only procedural role gear shares an atlas.
    module_spec = importlib.util.spec_from_file_location("enemy_costume_pack", Path(__file__).with_name("pack-hmh-liquidator-glb.py"))
    pack = importlib.util.module_from_spec(module_spec)
    module_spec.loader.exec_module(pack)
    pack.LANE = ROOT / ".tmp/hmh-actor-3d-pilot" / (actor_id + ("-costume-headfit" if actor_id in {"forkrunner", "liquidator-agent", "gas-bomber", "validator-cultist"} else "-costume"))
    pack.LANE.mkdir(parents=True, exist_ok=False)
    if rig.animation_data:
        rig.animation_data.action = None
        for track in rig.animation_data.nla_tracks:
            track.mute = True
    applied = pack.apply_geometry(rig, meshes)
    head_fit = fit_native_head_gear(actor_id, rig, meshes)
    optimization = simplify(actor_id, rig, meshes)
    textured = [obj for obj in meshes if any(slot.material and slot.material.node_tree and any(
        node.type == "TEX_IMAGE" and node.image for node in slot.material.node_tree.nodes) for slot in obj.material_slots)]
    costume = [obj for obj in meshes if obj not in textured]
    if not costume or not textured or any(obj.get("hmh_native_body") for obj in costume):
        raise RuntimeError("Expected separate textured native body and procedural costume")
    pack.unwrap(costume)
    # Pin triangulation before baking so the tangent basis and baked pixels
    # use the same native faces exported below. The live skin modifier stays.
    for obj in costume:
        pack.selected([obj])
        modifier = obj.modifiers.new("Native costume bake triangles", "TRIANGULATE")
        if hasattr(modifier, "keep_custom_normals"):
            modifier.keep_custom_normals = True
        bpy.ops.object.modifier_move_to_index(modifier=modifier.name, index=0)
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    images, graphs = pack.bake(costume, rig)
    rig.data.pose_position = "REST"
    components = [obj.name for obj in costume]
    pack.selected(costume)
    bpy.ops.object.join()
    combined = bpy.context.object
    combined.name = actor_id + " Packed Costume"
    combined.data.materials.clear()
    material = pack.packed_material(images)
    material.name = actor_id + " Packed Native Costume"
    combined.data.materials.append(material)
    for face in combined.data.polygons:
        face.material_index = 0
    meshes = [*textured, combined]
    triangles = sum(len(face.vertices) - 2 for obj in meshes for face in obj.data.polygons)
    if triangles > 30000:
        raise RuntimeError("Packed enemy exceeds existing runtime triangle cap")
    rig.data.pose_position = "POSE"
    return meshes, {**optimization, "appliedGeometryModifiers": applied, "packedCostumeComponents": components,
                    "bakeSemantics": list(images), "nativeMaterialGraphs": graphs, "derivedHeadGearFit": head_fit, "triangles": triangles}


def export(actor_id, output, rig, meshes, spec):
    material_fallbacks = preserve_authored_constant_pbr(meshes) if actor_id == "the-liquidator" else []
    if actor_id in NATIVE_ENEMY_IDS:
        meshes, optimization = prepare_native_enemy(actor_id, rig, meshes)
    else:
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
                              export_extras=actor_id == "the-liquidator", export_tangents=actor_id in (*WEIGHTED_HERO_NAMES, *NATIVE_ENEMY_IDS),
                              use_active_scene=True,
                              use_selection=True, export_cameras=False, export_lights=False)
    return {"output": output.relative_to(ROOT).as_posix(), "sha256": digest(output),
            "bytes": output.stat().st_size, "optimization": optimization, "sourceConstantPbrFallbacks": material_fallbacks}


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
