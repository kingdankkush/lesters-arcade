"""Render the HMH enemy/boss roster to raw per-frame PNGs.

Poses are authored per required visual state (idle, run, tell, attack, hit,
death) so the runtime's `resolveEnemyRuntimeVisualState` has a real frame for
every state it can select. Rendering is projection-only evidence: nothing here
feeds collision, damage or AI.
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
import sys

import bpy


def blender_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--raw-output", required=True)
    parser.add_argument("--report-output", required=True)
    parser.add_argument("--actor-id", required=True)
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


def apply_pose(rig, actor: dict, state: str, frame_index: int, frame_count: int, stoop: float) -> None:
    kind = actor.get("animationProfile", {}).get("kind", "shared-roster-v1")
    if kind not in {
        "shared-roster-v1",
        "undead-straight-lunge-v1",
        "undead-shoulder-charge-v1",
        "suppression-rifle-burst-v1",
        "validator-staff-channel-v1",
    }:
        raise RuntimeError(f"Unknown enemy animation profile: {kind}")
    reset_pose(rig)
    phase = (2.0 * math.pi * frame_index) / max(frame_count, 1)
    chest = rig.pose.bones["chest"]
    head = rig.pose.bones["head"]
    pelvis = rig.pose.bones["pelvis"]

    # Every actor carries its authored stoop so zombies read hunched and
    # survivors read upright even in the neutral pose.
    chest.rotation_euler[0] = math.radians(10 * stoop)
    head.rotation_euler[0] = math.radians(6 * stoop)

    if state == "idle":
        breath = 0.012 if frame_index % 2 == 0 else -0.008
        pelvis.location.z = breath
        chest.rotation_euler[0] += math.radians(1.6 if frame_index % 2 == 0 else -1.2)
        rig.pose.bones["upper_arm.L"].rotation_euler[0] = math.radians(-8)
        rig.pose.bones["upper_arm.R"].rotation_euler[0] = math.radians(-8)
    elif state == "run":
        stride = math.sin(phase)
        lift_left = max(0.0, math.sin(phase + math.pi / 2))
        lift_right = max(0.0, math.sin(phase - math.pi / 2))
        pelvis.location.z = 0.045 * abs(math.sin(phase))
        chest.rotation_euler[0] += math.radians(8)
        rig.pose.bones["thigh.L"].rotation_euler[0] = math.radians(38) * stride
        rig.pose.bones["thigh.R"].rotation_euler[0] = math.radians(-38) * stride
        rig.pose.bones["shin.L"].rotation_euler[0] = math.radians(-46) * lift_left
        rig.pose.bones["shin.R"].rotation_euler[0] = math.radians(-46) * lift_right
        rig.pose.bones["upper_arm.L"].rotation_euler[0] = math.radians(-30) * stride
        rig.pose.bones["upper_arm.R"].rotation_euler[0] = math.radians(30) * stride
    elif state == "tell":
        # Wind-up: arms raised and chest opened so the tell reads before the
        # strike lands. Frame 1 is a held, slightly larger silhouette.
        wind = 1.0 if frame_index == 0 else 1.25
        chest.rotation_euler[0] -= math.radians(12 * wind)
        head.rotation_euler[0] -= math.radians(8 * wind)
        rig.pose.bones["upper_arm.L"].rotation_euler[0] = math.radians(-96 * wind)
        rig.pose.bones["upper_arm.R"].rotation_euler[0] = math.radians(-96 * wind)
        rig.pose.bones["forearm.L"].rotation_euler[0] = math.radians(-36)
        rig.pose.bones["forearm.R"].rotation_euler[0] = math.radians(-36)
        pelvis.location.z = 0.02 * wind
        if kind == "undead-straight-lunge-v1":
            chest.rotation_euler[0] = math.radians(-20 * wind)
            head.rotation_euler[0] = math.radians(-12 * wind)
            rig.pose.bones["upper_arm.L"].rotation_euler[0] = math.radians(-112 * wind)
            rig.pose.bones["upper_arm.R"].rotation_euler[0] = math.radians(-112 * wind)
            rig.pose.bones["forearm.L"].rotation_euler[0] = math.radians(-48)
            rig.pose.bones["forearm.R"].rotation_euler[0] = math.radians(-48)
            pelvis.location.z = -0.025 * wind
        elif kind == "undead-shoulder-charge-v1":
            chest.rotation_euler[0] = math.radians(18 * wind)
            chest.rotation_euler[1] = math.radians(-16 * wind)
            head.rotation_euler[1] = math.radians(12 * wind)
            rig.pose.bones["upper_arm.L"].rotation_euler[0] = math.radians(-34 * wind)
            rig.pose.bones["upper_arm.L"].rotation_euler[1] = math.radians(-28 * wind)
            rig.pose.bones["upper_arm.R"].rotation_euler[0] = math.radians(-72 * wind)
            rig.pose.bones["forearm.L"].rotation_euler[0] = math.radians(-58)
            rig.pose.bones["forearm.R"].rotation_euler[0] = math.radians(-30)
            rig.pose.bones["thigh.L"].rotation_euler[0] = math.radians(10 * wind)
            rig.pose.bones["thigh.R"].rotation_euler[0] = math.radians(-8 * wind)
            pelvis.location.z = -0.055 * wind
        elif kind == "suppression-rifle-burst-v1":
            chest.rotation_euler[0] = math.radians(-6 * wind)
            head.rotation_euler[0] = math.radians(-4 * wind)
            rig.pose.bones["upper_arm.L"].rotation_euler[0] = math.radians(-72 * wind)
            rig.pose.bones["upper_arm.R"].rotation_euler[0] = math.radians(-58 * wind)
            rig.pose.bones["forearm.L"].rotation_euler[0] = math.radians(-64)
            rig.pose.bones["forearm.R"].rotation_euler[0] = math.radians(-78)
            rig.pose.bones["prop_socket"].rotation_euler[0] = math.radians(-8 * wind)
            pelvis.location.z = -0.018 * wind
        elif kind == "validator-staff-channel-v1":
            chest.rotation_euler[0] = math.radians(-18 * wind)
            head.rotation_euler[0] = math.radians(-11 * wind)
            rig.pose.bones["upper_arm.L"].rotation_euler[0] = math.radians(-138 * wind)
            rig.pose.bones["forearm.L"].rotation_euler[0] = math.radians(-26)
            rig.pose.bones["upper_arm.R"].rotation_euler[0] = math.radians(-82 * wind)
            rig.pose.bones["forearm.R"].rotation_euler[0] = math.radians(-48)
            rig.pose.bones["upper_arm.R"].rotation_euler[1] = math.radians(18 * wind)
            pelvis.location.z = 0.035 * wind
    elif state == "attack":
        # Strike: fast forward commitment, then recovery lean.
        swing = (1.0, 0.35, -0.25)[frame_index]
        chest.rotation_euler[0] += math.radians(26 * swing)
        head.rotation_euler[0] += math.radians(12 * swing)
        rig.pose.bones["upper_arm.L"].rotation_euler[0] = math.radians(52 * swing)
        rig.pose.bones["upper_arm.R"].rotation_euler[0] = math.radians(52 * swing)
        rig.pose.bones["forearm.L"].rotation_euler[0] = math.radians(-24 * swing)
        rig.pose.bones["forearm.R"].rotation_euler[0] = math.radians(-24 * swing)
        rig.pose.bones["thigh.L"].rotation_euler[0] = math.radians(-14 * swing)
        pelvis.location.y = -0.05 * swing
        if kind == "undead-straight-lunge-v1":
            chest.rotation_euler[0] = math.radians(34 * swing)
            head.rotation_euler[0] = math.radians(18 * swing)
            rig.pose.bones["upper_arm.L"].rotation_euler[0] = math.radians(72 * swing)
            rig.pose.bones["upper_arm.R"].rotation_euler[0] = math.radians(72 * swing)
            rig.pose.bones["forearm.L"].rotation_euler[0] = math.radians(-32 * swing)
            rig.pose.bones["forearm.R"].rotation_euler[0] = math.radians(-32 * swing)
            pelvis.location.y = -0.10 * swing
        elif kind == "undead-shoulder-charge-v1":
            chest.rotation_euler[0] = math.radians(42 * swing)
            chest.rotation_euler[1] = math.radians(-18 * swing)
            head.rotation_euler[1] = math.radians(10 * swing)
            rig.pose.bones["upper_arm.L"].rotation_euler[0] = math.radians(18 * swing)
            rig.pose.bones["upper_arm.L"].rotation_euler[1] = math.radians(-38 * swing)
            rig.pose.bones["upper_arm.R"].rotation_euler[0] = math.radians(34 * swing)
            rig.pose.bones["forearm.L"].rotation_euler[0] = math.radians(-58 * swing)
            rig.pose.bones["forearm.R"].rotation_euler[0] = math.radians(-24 * swing)
            rig.pose.bones["thigh.L"].rotation_euler[0] = math.radians(-22 * swing)
            pelvis.location.y = -0.13 * swing
        elif kind == "suppression-rifle-burst-v1":
            recoil = (1.0, 0.60, 0.28)[frame_index]
            chest.rotation_euler[0] = math.radians(-10 * recoil)
            head.rotation_euler[0] = math.radians(-5 * recoil)
            rig.pose.bones["upper_arm.L"].rotation_euler[0] = math.radians(-68)
            rig.pose.bones["upper_arm.R"].rotation_euler[0] = math.radians(-54)
            rig.pose.bones["forearm.L"].rotation_euler[0] = math.radians(-62)
            rig.pose.bones["forearm.R"].rotation_euler[0] = math.radians(-76)
            rig.pose.bones["prop_socket"].rotation_euler[0] = math.radians(-13 * recoil)
            pelvis.location.y = 0.045 * recoil
        elif kind == "validator-staff-channel-v1":
            cast = (1.0, 0.52, -0.18)[frame_index]
            chest.rotation_euler[0] = math.radians(22 * cast)
            head.rotation_euler[0] = math.radians(10 * cast)
            rig.pose.bones["upper_arm.L"].rotation_euler[0] = math.radians(-84 + 34 * cast)
            rig.pose.bones["forearm.L"].rotation_euler[0] = math.radians(-38 + 22 * cast)
            rig.pose.bones["upper_arm.R"].rotation_euler[0] = math.radians(-48 + 72 * cast)
            rig.pose.bones["forearm.R"].rotation_euler[0] = math.radians(-32 * cast)
            rig.pose.bones["upper_arm.R"].rotation_euler[1] = math.radians(28 * cast)
            pelvis.location.y = -0.055 * cast
    elif state == "hit":
        sign = -1 if frame_index == 0 else 1
        chest.rotation_euler[1] = math.radians(18 * sign)
        chest.rotation_euler[2] = math.radians(-20 * sign)
        head.rotation_euler[2] = math.radians(24 * sign)
        rig.pose.bones["upper_arm.L"].rotation_euler[1] = math.radians(-30 * sign)
        rig.pose.bones["upper_arm.R"].rotation_euler[1] = math.radians(26 * sign)
        pelvis.location.y = 0.04
    elif state == "death":
        # Collapse over four frames: buckle, fold, drop, settle.
        progress = frame_index / max(frame_count - 1, 1)
        chest.rotation_euler[0] += math.radians(78 * progress)
        head.rotation_euler[0] += math.radians(40 * progress)
        pelvis.location.z = -0.42 * progress
        pelvis.rotation_euler[0] = math.radians(56 * progress)
        rig.pose.bones["thigh.L"].rotation_euler[0] = math.radians(-52 * progress)
        rig.pose.bones["thigh.R"].rotation_euler[0] = math.radians(-38 * progress)
        rig.pose.bones["shin.L"].rotation_euler[0] = math.radians(64 * progress)
        rig.pose.bones["shin.R"].rotation_euler[0] = math.radians(48 * progress)
        rig.pose.bones["upper_arm.L"].rotation_euler[0] = math.radians(-64 * progress)
        rig.pose.bones["upper_arm.R"].rotation_euler[0] = math.radians(-58 * progress)
    else:
        raise RuntimeError(f"Unknown enemy visual state: {state}")


def main() -> None:
    args = blender_args()
    manifest = json.loads(Path(args.manifest).resolve().read_text(encoding="utf-8"))
    raw_output = Path(args.raw_output).resolve()
    raw_output.mkdir(parents=True, exist_ok=True)

    scene = bpy.context.scene
    default_frame_size = manifest["render"]["frameSize"]
    render_scale = manifest["render"].get("renderScale", 1)
    scene.render.resolution_x = default_frame_size[0] * render_scale
    scene.render.resolution_y = default_frame_size[1] * render_scale
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 20

    camera = scene.camera
    default_ortho = manifest["render"]["cameraOrthoScale"]

    rig = bpy.data.objects.get(manifest["scene"]["armature"])
    if rig is None or rig.type != "ARMATURE":
        raise RuntimeError(f"Missing armature: {manifest['scene']['armature']}")

    all_actor_objects = [obj for obj in bpy.data.objects if obj.get("hmh_actor_id")]
    for obj in all_actor_objects:
        obj.hide_render = True

    rendered = []
    per_actor = {}
    selected_actors = [actor for actor in manifest["actors"] if actor["actorId"] == args.actor_id]
    if len(selected_actors) != 1:
        raise RuntimeError(f"Unknown enemy actor id: {args.actor_id}")
    for actor in selected_actors:
        actor_id = actor["actorId"]
        actor_objects = [obj for obj in all_actor_objects if obj.get("hmh_actor_id") == actor_id]
        if not actor_objects:
            raise RuntimeError(f"No renderable objects for {actor_id}")
        for obj in all_actor_objects:
            obj.hide_render = obj.get("hmh_actor_id") != actor_id
        # Oversized actors (the boss) frame at their own ortho scale so the
        # silhouette is never clipped by the shared camera.
        camera.data.ortho_scale = actor.get("cameraOrthoScale", default_ortho)
        # The boss carries three phase silhouettes, so it renders three times
        # the frames. Its own frame size keeps that atlas inside budget.
        actor_frame_size = actor.get("frameSize", default_frame_size)
        scene.render.resolution_x = actor_frame_size[0] * render_scale
        scene.render.resolution_y = actor_frame_size[1] * render_scale
        stoop = actor["build"]["stoop"]
        phases = list(actor.get("phaseVisuals", {})) or [None]
        count = 0
        for boss_phase in phases:
            for obj in all_actor_objects:
                same_actor = obj.get("hmh_actor_id") == actor_id
                phase_tag = obj.get("hmh_phase")
                phase_visible = phase_tag is None or phase_tag == boss_phase
                obj.hide_render = not (same_actor and phase_visible)
            for state, clip in manifest["clips"].items():
                for direction in manifest["directions"]:
                    rig.rotation_euler[2] = math.radians(manifest["directionAngles"][direction])
                    for frame_index in range(clip["frames"]):
                        apply_pose(rig, actor, state, frame_index, clip["frames"], stoop)
                        bpy.context.view_layer.update()
                        phase_token = f"__{boss_phase}" if boss_phase else ""
                        filename = f"{actor_id}__body{phase_token}__{state}__{direction}__{frame_index:03d}.png"
                        scene.render.filepath = str(raw_output / filename)
                        bpy.ops.render.render(write_still=True)
                        rendered.append(filename)
                        count += 1
        per_actor[actor_id] = count

    for obj in all_actor_objects:
        obj.hide_render = True
    reset_pose(rig)
    rig.rotation_euler[2] = 0.0
    bpy.context.view_layer.update()

    write_lf_json(Path(args.report_output).resolve(), {
        "status": "pass",
        "pipelineId": manifest["pipelineId"],
        "frameCount": len(rendered),
        "framesPerActor": per_actor,
        "states": list(manifest["clips"].keys()),
        "directions": manifest["directions"],
    })
    print(json.dumps({"status": "pass", "frameCount": len(rendered)}, sort_keys=True))


if __name__ == "__main__":
    main()
