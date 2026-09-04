from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
import sys

import bpy
from bpy_extras import anim_utils


def blender_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--actor-id", required=True)
    parser.add_argument("--raw-output", required=True)
    parser.add_argument("--report-output", required=True)
    return parser.parse_args(argv)


def write_lf_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")


def reset_pose(rig) -> None:
    for pose_bone in rig.pose.bones:
        pose_bone.rotation_mode = "XYZ"
        pose_bone.matrix_basis.identity()
        pose_bone.location = (0.0, 0.0, 0.0)
        pose_bone.scale = (1.0, 1.0, 1.0)


def set_base_aim_pose(rig, breath: float = 0.0) -> None:
    rig.pose.bones["chest"].location.z = breath
    rig.pose.bones["upper_arm.L"].rotation_euler[0] = math.radians(-28)
    rig.pose.bones["upper_arm.L"].rotation_euler[2] = math.radians(-18)
    rig.pose.bones["forearm.L"].rotation_euler[0] = math.radians(-38)
    rig.pose.bones["forearm.L"].rotation_euler[2] = math.radians(18)
    rig.pose.bones["upper_arm.R"].rotation_euler[0] = math.radians(-34)
    rig.pose.bones["upper_arm.R"].rotation_euler[2] = math.radians(12)
    rig.pose.bones["forearm.R"].rotation_euler[0] = math.radians(-44)
    rig.pose.bones["forearm.R"].rotation_euler[2] = math.radians(-12)


def apply_pose(rig, layer: str, state: str, frame_index: int, frame_count: int, animation_profile: dict) -> None:
    reset_pose(rig)
    phase = (2.0 * math.pi * frame_index) / max(frame_count, 1)
    progress = frame_index / max(frame_count - 1, 1)
    idle_breath_scale = animation_profile["idleBreathScale"]
    run_stride_scale = animation_profile["runStrideScale"]
    run_lift_scale = animation_profile["runLiftScale"]
    recoil_scale = animation_profile["recoilScale"]
    hurt_scale = animation_profile["hurtScale"]
    dash_scale = animation_profile["dashScale"]
    melee_scale = animation_profile["meleeScale"]
    grenade_scale = animation_profile["grenadeScale"]
    death_side = animation_profile["deathSide"]
    if state in {"dash", "melee", "grenade", "death"}:
        # Action clips are non-looping. A subtle authored root lift gives every
        # anticipation/impact/recovery frame a monotonic pixel signature while
        # preserving the silhouette choreography below.
        rig.pose.bones["root"].location.z = progress * 0.045

    if layer == "lower-body":
        if state == "idle":
            amount = (-0.025 if frame_index == 0 else 0.025) * idle_breath_scale
            rig.pose.bones["pelvis"].location.z = amount
            rig.pose.bones["thigh.L"].rotation_euler[0] = amount * 1.5
            rig.pose.bones["thigh.R"].rotation_euler[0] = -amount * 1.5
        elif state == "run":
            stride = math.sin(phase)
            lift_left = max(0.0, math.sin(phase + math.pi / 2))
            lift_right = max(0.0, math.sin(phase - math.pi / 2))
            rig.pose.bones["pelvis"].location.z = 0.035 * run_lift_scale * abs(math.sin(phase))
            rig.pose.bones["thigh.L"].rotation_euler[0] = math.radians(34) * run_stride_scale * stride
            rig.pose.bones["thigh.R"].rotation_euler[0] = math.radians(-34) * run_stride_scale * stride
            rig.pose.bones["shin.L"].rotation_euler[0] = math.radians(-42) * run_stride_scale * lift_left
            rig.pose.bones["shin.R"].rotation_euler[0] = math.radians(-42) * run_stride_scale * lift_right
        elif state == "dash":
            rig.pose.bones["pelvis"].location.y = (-0.08 - 0.05 * math.sin(progress * math.pi)) * dash_scale
            rig.pose.bones["pelvis"].location.z = 0.04 * dash_scale * math.sin(progress * math.pi)
            rig.pose.bones["thigh.L"].rotation_euler[0] = math.radians((48 - 18 * progress) * dash_scale)
            rig.pose.bones["thigh.R"].rotation_euler[0] = math.radians((-42 + 14 * progress) * dash_scale)
            rig.pose.bones["shin.L"].rotation_euler[0] = math.radians(-36 * dash_scale)
        elif state in {"melee", "grenade"}:
            brace = math.sin(progress * math.pi)
            sign = -1.0 if state == "melee" else 1.0
            action_scale = melee_scale if state == "melee" else grenade_scale
            rig.pose.bones["pelvis"].rotation_euler[2] = math.radians(sign * (8 + 18 * brace) * action_scale)
            rig.pose.bones["thigh.L"].rotation_euler[0] = math.radians(18 * brace * action_scale)
            rig.pose.bones["thigh.R"].rotation_euler[0] = math.radians(-12 * brace * action_scale)
            rig.pose.bones["pelvis"].location.z = -0.025 * brace * action_scale
        elif state == "death":
            collapse = progress * progress
            rig.pose.bones["pelvis"].rotation_euler[1] = math.radians(78 * collapse * death_side)
            rig.pose.bones["pelvis"].location.x = 0.28 * collapse * death_side
            rig.pose.bones["pelvis"].location.z = -0.40 * collapse
            rig.pose.bones["thigh.L"].rotation_euler[0] = math.radians(28 * collapse)
            rig.pose.bones["thigh.R"].rotation_euler[0] = math.radians(-34 * collapse)
    elif layer == "torso-head":
        breath = (0.008 if frame_index % 2 else -0.004) * idle_breath_scale
        set_base_aim_pose(rig, breath)
        if state == "pistol-fire":
            recoil = (math.radians(4), math.radians(-13), math.radians(-5))[frame_index] * recoil_scale
            rig.pose.bones["chest"].rotation_euler[0] += recoil
            rig.pose.bones["head"].rotation_euler[0] += recoil * 0.32
            rig.pose.bones["upper_arm.R"].rotation_euler[0] += recoil * 0.55
        elif state == "hurt":
            sign = -1 if frame_index == 0 else 1
            rig.pose.bones["chest"].rotation_euler[1] = math.radians(15 * sign * hurt_scale)
            rig.pose.bones["chest"].rotation_euler[2] = math.radians(-18 * sign * hurt_scale)
            rig.pose.bones["head"].rotation_euler[2] = math.radians(22 * sign * hurt_scale)
            rig.pose.bones["upper_arm.L"].rotation_euler[1] = math.radians(-28 * sign * hurt_scale)
            rig.pose.bones["upper_arm.R"].rotation_euler[1] = math.radians(24 * sign * hurt_scale)
        elif state == "dash":
            surge = math.sin(progress * math.pi)
            rig.pose.bones["chest"].rotation_euler[0] = math.radians((-24 - 10 * surge) * dash_scale)
            rig.pose.bones["head"].rotation_euler[0] = math.radians((14 + 8 * surge) * dash_scale)
            rig.pose.bones["upper_arm.L"].rotation_euler[0] = math.radians(18 * dash_scale)
            rig.pose.bones["upper_arm.R"].rotation_euler[0] = math.radians(12 * dash_scale)
        elif state == "melee":
            swing = math.sin(progress * math.pi)
            rig.pose.bones["chest"].rotation_euler[2] = math.radians((-42 + 84 * progress) * melee_scale)
            rig.pose.bones["upper_arm.R"].rotation_euler[1] = math.radians((-76 + 132 * progress) * melee_scale)
            rig.pose.bones["forearm.R"].rotation_euler[1] = math.radians(-58 * swing * melee_scale)
            rig.pose.bones["head"].rotation_euler[2] = math.radians((-14 + 28 * progress) * melee_scale)
        elif state == "grenade":
            arc = math.sin(progress * math.pi)
            rig.pose.bones["chest"].rotation_euler[2] = math.radians((26 - 46 * progress) * grenade_scale)
            rig.pose.bones["upper_arm.L"].rotation_euler[0] = math.radians((-18 - 112 * arc) * grenade_scale)
            rig.pose.bones["forearm.L"].rotation_euler[0] = math.radians((-22 - 96 * (1.0 - progress)) * grenade_scale)
            rig.pose.bones["head"].rotation_euler[2] = math.radians((10 - 20 * progress) * grenade_scale)
        elif state == "death":
            collapse = progress * progress
            rig.pose.bones["chest"].rotation_euler[1] = math.radians((10 + 72 * collapse) * death_side)
            rig.pose.bones["chest"].rotation_euler[2] = math.radians(-4 - 14 * collapse)
            rig.pose.bones["chest"].location.x = (0.04 + 0.26 * collapse) * death_side
            rig.pose.bones["chest"].location.z = -0.62 * collapse
            rig.pose.bones["head"].rotation_euler[1] = math.radians(44 * collapse * death_side)
            rig.pose.bones["upper_arm.L"].rotation_euler[2] = math.radians(-58 * collapse)
            rig.pose.bones["upper_arm.R"].rotation_euler[2] = math.radians(64 * collapse)
    elif layer == "weapon":
        socket = rig.pose.bones["weapon_socket"]
        if state == "aim":
            socket.location.z = -0.003 if frame_index == 0 else 0.004
        elif state == "pistol-fire":
            socket.location.y = (0.0, 0.11, 0.035)[frame_index] * recoil_scale
            socket.rotation_euler[0] = (0.0, math.radians(-10), math.radians(-3))[frame_index] * recoil_scale
        elif state == "dash":
            socket.rotation_euler[0] = math.radians((-24 - 12 * math.sin(progress * math.pi)) * dash_scale)
            socket.location.y = 0.06 * progress * dash_scale
        elif state == "melee":
            socket.rotation_euler[2] = math.radians((-72 + 144 * progress) * melee_scale)
            socket.rotation_euler[1] = math.radians(-38 * math.sin(progress * math.pi) * melee_scale)
            socket.location.x = 0.11 * math.sin(progress * math.pi) * melee_scale
        elif state == "grenade":
            socket.rotation_euler[0] = math.radians((-12 + 42 * math.sin(progress * math.pi)) * grenade_scale)
            socket.location.y = (-0.035 + 0.115 * math.sin(progress * math.pi)) * grenade_scale
            socket.location.z = (-0.08 - 0.05 * progress) * grenade_scale
        elif state == "death":
            collapse = progress * progress
            socket.rotation_euler[1] = math.radians((15 + 77 * collapse) * death_side)
            socket.location.x = (0.04 + 0.30 * collapse) * death_side
            socket.location.z = -0.04 - 0.51 * collapse


def resolve_rig(manifest: dict, entry: dict):
    """The armature this entry renders with.

    Procedural actors share one rig named by the manifest; an imported actor
    brings its own, so the name is overridable per entry.
    """
    name = entry.get("armature", manifest["scene"]["armature"])
    rig = bpy.data.objects.get(name)
    if rig is None or rig.type != "ARMATURE":
        raise RuntimeError(f"Missing armature: {name}")
    if rig.rotation_mode != "XYZ":
        # A glTF/FBX armature object arrives in QUATERNION mode, where the
        # per-direction `rig.rotation_euler[2]` assignment below is silently
        # ignored and all eight directions render identically. Blender's
        # rotation_mode setter converts the existing value, so this preserves
        # whatever rotation the object already carried.
        rig.rotation_mode = "XYZ"
    return rig


def set_clip_action(rig, action_name: str):
    """Bind one imported action to the rig.

    Deliberately does NOT touch pose_bone.rotation_mode. Imported glTF/Mixamo
    actions key rotation_quaternion, and forcing XYZ (what reset_pose does for
    the trigonometric branch) would leave every quaternion channel unevaluated
    and freeze the actor at rest.
    """
    action = bpy.data.actions.get(action_name)
    if action is None:
        raise RuntimeError(f"Missing clip action: {action_name}")
    adt = rig.animation_data or rig.animation_data_create()
    # The glTF importer stashes every action in its own NLA track; an unmuted
    # stash would evaluate on top of the action assigned here.
    for track in adt.nla_tracks:
        track.mute = True
    adt.action = action
    slot = anim_utils.action_get_first_suitable_slot(action, "OBJECT")
    if slot is None:
        raise RuntimeError(f"Action has no object slot: {action_name}")
    adt.action_slot = slot
    return action


def sample_clip_frame(action, frame_index: int, frame_count: int, loop: bool) -> int:
    """Sample `frame_count` poses evenly across the action's own frame range.

    A looping clip stops one step short of the end so the loop does not repeat
    its first pose as its last; a one-shot clip lands exactly on the last frame.
    """
    start, end = action.frame_range
    span = float(end) - float(start)
    if span < frame_count - 1:
        raise RuntimeError(f"Action {action.name!r} spans {span} frames, too short for {frame_count} samples")
    if loop:
        offset = math.floor(span * frame_index / max(frame_count, 1))
    else:
        offset = round(span * frame_index / max(frame_count - 1, 1))
    frame = int(round(float(start) + offset))
    bpy.context.scene.frame_set(frame)
    return frame


def active_actor_objects(actor_id: str):
    return [obj for obj in bpy.data.objects if obj.get("hmh_actor_id") == actor_id]


def main() -> None:
    args = blender_args()
    manifest = json.loads(Path(args.manifest).resolve().read_text(encoding="utf-8"))
    raw_output = Path(args.raw_output).resolve()
    report_output = Path(args.report_output).resolve()
    raw_output.mkdir(parents=True, exist_ok=True)

    pilot = next((item for item in manifest["pilots"] if item["actorId"] == args.actor_id), None)
    if pilot is None:
        raise RuntimeError(f"Unknown production actor: {args.actor_id}")

    scene = bpy.context.scene
    # An imported actor can render at its own frame size; the runner scales the
    # pivot to match so the ground contact is unchanged.
    frame_size = pilot.get("frameSize", manifest["render"]["frameSize"])
    scene.render.resolution_x = frame_size[0]
    scene.render.resolution_y = frame_size[1]
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 20

    rig = resolve_rig(manifest, pilot)
    if manifest["scene"]["weaponSocket"] not in rig.pose.bones:
        raise RuntimeError("Missing weapon_socket pose bone")
    clip_actions = pilot.get("clipActions")
    skinned = bool(clip_actions)

    actor_objects = active_actor_objects(pilot["actorId"])
    if not actor_objects:
        raise RuntimeError(f"No renderable objects for {pilot['actorId']}")
    layer_counts = {layer: sum(1 for obj in actor_objects if obj.get("hmh_layer") == layer) for layer in pilot["layers"]}
    if any(count == 0 for count in layer_counts.values()):
        raise RuntimeError(f"Missing layer objects: {layer_counts}")

    production_objects = [obj for obj in bpy.data.objects if obj.get("hmh_actor_id")]
    for obj in production_objects:
        obj.hide_render = True

    rendered = []
    for layer in pilot["layers"]:
        for obj in actor_objects:
            obj.hide_render = obj.get("hmh_layer") != layer
        for state, clip in pilot["clips"][layer].items():
            action = set_clip_action(rig, clip_actions[state]) if skinned else None
            for direction in manifest["directions"]:
                rig.rotation_euler[2] = math.radians(manifest["directionAngles"][direction])
                for frame_index in range(clip["frames"]):
                    if skinned:
                        sample_clip_frame(action, frame_index, clip["frames"], clip.get("loop", True))
                    else:
                        apply_pose(rig, layer, state, frame_index, clip["frames"], pilot["animationProfile"])
                    bpy.context.view_layer.update()
                    filename = f"{pilot['actorId']}__{layer}__{state}__{direction}__{frame_index:03d}.png"
                    scene.render.filepath = str(raw_output / filename)
                    bpy.ops.render.render(write_still=True)
                    rendered.append(filename)

    for obj in production_objects:
        obj.hide_render = True

    if skinned:
        adt = rig.animation_data
        if adt is not None:
            adt.action = None
        scene.frame_set(scene.frame_start)
    else:
        reset_pose(rig)
    rig.rotation_euler[2] = 0.0
    bpy.context.view_layer.update()
    report = {
        "status": "pass",
        "actorId": pilot["actorId"],
        "variantId": pilot["variantId"],
        "animationProfile": pilot["animationProfile"],
        "mode": "clip-actions" if skinned else "trig-pose",
        "frameSize": list(frame_size),
        "frameCount": len(rendered),
        "frames": rendered,
        "layerObjectCounts": layer_counts,
        "weaponSocket": manifest["scene"]["weaponSocket"] in rig.pose.bones,
    }
    write_lf_json(report_output, report)
    print(json.dumps({"status": "pass", "frameCount": len(rendered)}, sort_keys=True))


if __name__ == "__main__":
    main()
