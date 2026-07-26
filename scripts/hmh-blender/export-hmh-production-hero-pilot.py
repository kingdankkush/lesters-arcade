from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
import sys

import bpy


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


def apply_pose(rig, layer: str, state: str, frame_index: int, frame_count: int) -> None:
    reset_pose(rig)
    phase = (2.0 * math.pi * frame_index) / max(frame_count, 1)
    progress = frame_index / max(frame_count - 1, 1)
    if state in {"dash", "melee", "grenade", "death"}:
        # Action clips are non-looping. A subtle authored root lift gives every
        # anticipation/impact/recovery frame a monotonic pixel signature while
        # preserving the silhouette choreography below.
        rig.pose.bones["root"].location.z = progress * 0.045

    if layer == "lower-body":
        if state == "idle":
            amount = -0.025 if frame_index == 0 else 0.025
            rig.pose.bones["pelvis"].location.z = amount
            rig.pose.bones["thigh.L"].rotation_euler[0] = amount * 1.5
            rig.pose.bones["thigh.R"].rotation_euler[0] = -amount * 1.5
        elif state == "run":
            stride = math.sin(phase)
            lift_left = max(0.0, math.sin(phase + math.pi / 2))
            lift_right = max(0.0, math.sin(phase - math.pi / 2))
            rig.pose.bones["pelvis"].location.z = 0.035 * abs(math.sin(phase))
            rig.pose.bones["thigh.L"].rotation_euler[0] = math.radians(34) * stride
            rig.pose.bones["thigh.R"].rotation_euler[0] = math.radians(-34) * stride
            rig.pose.bones["shin.L"].rotation_euler[0] = math.radians(-42) * lift_left
            rig.pose.bones["shin.R"].rotation_euler[0] = math.radians(-42) * lift_right
        elif state == "dash":
            rig.pose.bones["pelvis"].location.y = -0.08 - 0.05 * math.sin(progress * math.pi)
            rig.pose.bones["pelvis"].location.z = 0.04 * math.sin(progress * math.pi)
            rig.pose.bones["thigh.L"].rotation_euler[0] = math.radians(48 - 18 * progress)
            rig.pose.bones["thigh.R"].rotation_euler[0] = math.radians(-42 + 14 * progress)
            rig.pose.bones["shin.L"].rotation_euler[0] = math.radians(-36)
        elif state in {"melee", "grenade"}:
            brace = math.sin(progress * math.pi)
            sign = -1.0 if state == "melee" else 1.0
            rig.pose.bones["pelvis"].rotation_euler[2] = math.radians(sign * (8 + 18 * brace))
            rig.pose.bones["thigh.L"].rotation_euler[0] = math.radians(18 * brace)
            rig.pose.bones["thigh.R"].rotation_euler[0] = math.radians(-12 * brace)
            rig.pose.bones["pelvis"].location.z = -0.025 * brace
        elif state == "death":
            collapse = progress * progress
            rig.pose.bones["pelvis"].rotation_euler[1] = math.radians(78 * collapse)
            rig.pose.bones["pelvis"].location.x = 0.28 * collapse
            rig.pose.bones["pelvis"].location.z = -0.40 * collapse
            rig.pose.bones["thigh.L"].rotation_euler[0] = math.radians(28 * collapse)
            rig.pose.bones["thigh.R"].rotation_euler[0] = math.radians(-34 * collapse)
    elif layer == "torso-head":
        breath = 0.008 if frame_index % 2 else -0.004
        set_base_aim_pose(rig, breath)
        if state == "pistol-fire":
            recoil = (math.radians(4), math.radians(-13), math.radians(-5))[frame_index]
            rig.pose.bones["chest"].rotation_euler[0] += recoil
            rig.pose.bones["head"].rotation_euler[0] += recoil * 0.32
            rig.pose.bones["upper_arm.R"].rotation_euler[0] += recoil * 0.55
        elif state == "hurt":
            sign = -1 if frame_index == 0 else 1
            rig.pose.bones["chest"].rotation_euler[1] = math.radians(15 * sign)
            rig.pose.bones["chest"].rotation_euler[2] = math.radians(-18 * sign)
            rig.pose.bones["head"].rotation_euler[2] = math.radians(22 * sign)
            rig.pose.bones["upper_arm.L"].rotation_euler[1] = math.radians(-28 * sign)
            rig.pose.bones["upper_arm.R"].rotation_euler[1] = math.radians(24 * sign)
        elif state == "dash":
            surge = math.sin(progress * math.pi)
            rig.pose.bones["chest"].rotation_euler[0] = math.radians(-24 - 10 * surge)
            rig.pose.bones["head"].rotation_euler[0] = math.radians(14 + 8 * surge)
            rig.pose.bones["upper_arm.L"].rotation_euler[0] = math.radians(18)
            rig.pose.bones["upper_arm.R"].rotation_euler[0] = math.radians(12)
        elif state == "melee":
            swing = math.sin(progress * math.pi)
            rig.pose.bones["chest"].rotation_euler[2] = math.radians(-42 + 84 * progress)
            rig.pose.bones["upper_arm.R"].rotation_euler[1] = math.radians(-76 + 132 * progress)
            rig.pose.bones["forearm.R"].rotation_euler[1] = math.radians(-58 * swing)
            rig.pose.bones["head"].rotation_euler[2] = math.radians(-14 + 28 * progress)
        elif state == "grenade":
            arc = math.sin(progress * math.pi)
            rig.pose.bones["chest"].rotation_euler[2] = math.radians(26 - 46 * progress)
            rig.pose.bones["upper_arm.L"].rotation_euler[0] = math.radians(-18 - 112 * arc)
            rig.pose.bones["forearm.L"].rotation_euler[0] = math.radians(-22 - 96 * (1.0 - progress))
            rig.pose.bones["head"].rotation_euler[2] = math.radians(10 - 20 * progress)
        elif state == "death":
            collapse = progress * progress
            rig.pose.bones["chest"].rotation_euler[1] = math.radians(10 + 72 * collapse)
            rig.pose.bones["chest"].rotation_euler[2] = math.radians(-4 - 14 * collapse)
            rig.pose.bones["chest"].location.x = 0.04 + 0.26 * collapse
            rig.pose.bones["chest"].location.z = -0.62 * collapse
            rig.pose.bones["head"].rotation_euler[1] = math.radians(44 * collapse)
            rig.pose.bones["upper_arm.L"].rotation_euler[2] = math.radians(-58 * collapse)
            rig.pose.bones["upper_arm.R"].rotation_euler[2] = math.radians(64 * collapse)
    elif layer == "weapon":
        socket = rig.pose.bones["weapon_socket"]
        if state == "aim":
            socket.location.z = -0.003 if frame_index == 0 else 0.004
        elif state == "pistol-fire":
            socket.location.y = (0.0, 0.11, 0.035)[frame_index]
            socket.rotation_euler[0] = (0.0, math.radians(-10), math.radians(-3))[frame_index]
        elif state == "dash":
            socket.rotation_euler[0] = math.radians(-24 - 12 * math.sin(progress * math.pi))
            socket.location.y = 0.06 * progress
        elif state == "melee":
            socket.rotation_euler[2] = math.radians(-72 + 144 * progress)
            socket.rotation_euler[1] = math.radians(-38 * math.sin(progress * math.pi))
            socket.location.x = 0.11 * math.sin(progress * math.pi)
        elif state == "grenade":
            socket.rotation_euler[0] = math.radians(-12 + 42 * math.sin(progress * math.pi))
            socket.location.y = -0.035 + 0.115 * math.sin(progress * math.pi)
            socket.location.z = -0.08 - 0.05 * progress
        elif state == "death":
            collapse = progress * progress
            socket.rotation_euler[1] = math.radians(15 + 77 * collapse)
            socket.location.x = 0.04 + 0.30 * collapse
            socket.location.z = -0.04 - 0.51 * collapse


def active_actor_objects(actor_id: str):
    return [obj for obj in bpy.data.objects if obj.get("hmh_actor_id") == actor_id]


def main() -> None:
    args = blender_args()
    manifest = json.loads(Path(args.manifest).resolve().read_text(encoding="utf-8"))
    raw_output = Path(args.raw_output).resolve()
    report_output = Path(args.report_output).resolve()
    raw_output.mkdir(parents=True, exist_ok=True)

    scene = bpy.context.scene
    scene.render.resolution_x = manifest["render"]["frameSize"][0]
    scene.render.resolution_y = manifest["render"]["frameSize"][1]
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 20

    pilot = next((item for item in manifest["pilots"] if item["actorId"] == args.actor_id), None)
    if pilot is None:
        raise RuntimeError(f"Unknown production actor: {args.actor_id}")
    rig = bpy.data.objects.get(manifest["scene"]["armature"])
    if rig is None or rig.type != "ARMATURE":
        raise RuntimeError(f"Missing armature: {manifest['scene']['armature']}")
    if manifest["scene"]["weaponSocket"] not in rig.pose.bones:
        raise RuntimeError("Missing weapon_socket pose bone")

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
            for direction in manifest["directions"]:
                rig.rotation_euler[2] = math.radians(manifest["directionAngles"][direction])
                for frame_index in range(clip["frames"]):
                    apply_pose(rig, layer, state, frame_index, clip["frames"])
                    bpy.context.view_layer.update()
                    filename = f"{pilot['actorId']}__{layer}__{state}__{direction}__{frame_index:03d}.png"
                    scene.render.filepath = str(raw_output / filename)
                    bpy.ops.render.render(write_still=True)
                    rendered.append(filename)

    for obj in production_objects:
        obj.hide_render = True

    reset_pose(rig)
    rig.rotation_euler[2] = 0.0
    bpy.context.view_layer.update()
    report = {
        "status": "pass",
        "actorId": pilot["actorId"],
        "variantId": pilot["variantId"],
        "frameCount": len(rendered),
        "frames": rendered,
        "layerObjectCounts": layer_counts,
        "weaponSocket": manifest["scene"]["weaponSocket"] in rig.pose.bones,
    }
    write_lf_json(report_output, report)
    print(json.dumps({"status": "pass", "frameCount": len(rendered)}, sort_keys=True))


if __name__ == "__main__":
    main()
