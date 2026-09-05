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
from bpy_extras import anim_utils

# Blender does not put the running script's directory on sys.path, and the
# authored pose table is a sibling module shared with the Node test suite.
_SCRIPT_DIR = str(Path(__file__).resolve().parent)
if _SCRIPT_DIR not in sys.path:
    sys.path.insert(0, _SCRIPT_DIR)
import hmh_enemy_poses  # noqa: E402  (Blender-free pose table, Cycle 074)


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
    """Pose the shared rig for one authored frame.

    Cycle 074 (E-3): the pose numbers live in ``hmh_enemy_poses`` (imports only
    ``math``) so the anticipation / overshoot / recovery contract is testable on
    the Vercel build image. This function keeps the fail-closed, per-profile
    dispatch visible in the exporter and applies the returned bone rotations
    (degrees) and locations to ``rig.pose.bones``.
    """
    kind = actor.get("animationProfile", {}).get("kind", "shared-roster-v1")
    damage_kind = actor.get("animationProfile", {}).get("damageResponse", "shared-impact-v1")
    if kind == "shared-roster-v1":
        beats = hmh_enemy_poses.SHARED_BEATS
    elif kind == "undead-straight-lunge-v1":
        beats = hmh_enemy_poses.LUNGE_BEATS
    elif kind == "undead-shoulder-charge-v1":
        beats = hmh_enemy_poses.CHARGE_BEATS
    elif kind == "suppression-rifle-burst-v1":
        beats = hmh_enemy_poses.RIFLE_BEATS
    elif kind == "forkrunner-quick-fork-slash-v1":
        beats = hmh_enemy_poses.FORK_BEATS
    elif kind == "gas-bomber-canister-lob-v1":
        beats = hmh_enemy_poses.LOB_BEATS
    elif kind == "validator-staff-channel-v1":
        beats = hmh_enemy_poses.STAFF_BEATS
    else:
        raise RuntimeError(f"Unknown enemy animation profile: {kind}")
    if damage_kind not in hmh_enemy_poses.DAMAGE_RESPONSES:
        raise RuntimeError(f"Unknown enemy damage response: {damage_kind}")
    reset_pose(rig)
    pose = hmh_enemy_poses.role_pose(
        kind, damage_kind, state, frame_index, frame_count, stoop,
        boss=bool(actor.get("boss", False)), beats=beats,
    )
    for bone_name, (rx, ry, rz) in pose["rotations"].items():
        rig.pose.bones[bone_name].rotation_euler = (math.radians(rx), math.radians(ry), math.radians(rz))
    for bone_name, (lx, ly, lz) in pose["locations"].items():
        rig.pose.bones[bone_name].location = (lx, ly, lz)


def resolve_rig(manifest: dict, entry: dict):
    """The armature this entry renders with.

    Procedural actors share one rig named by the manifest; an actor imported
    from a committed GLB/FBX brings its own, so the name is overridable.
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
    for track in adt.nla_tracks:
        track.mute = True
    adt.action = action
    slot = anim_utils.action_get_first_suitable_slot(action, "OBJECT")
    if slot is None:
        raise RuntimeError(f"Action has no object slot: {action_name}")
    adt.action_slot = slot
    return action


def sample_clip_frame(action, frame_index: int, frame_count: int, loop: bool) -> int:
    """Sample `frame_count` poses evenly across the action's own frame range."""
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


def main() -> None:
    args = blender_args()
    manifest = json.loads(Path(args.manifest).resolve().read_text(encoding="utf-8"))
    raw_output = Path(args.raw_output).resolve()
    raw_output.mkdir(parents=True, exist_ok=True)

    scene = bpy.context.scene
    # The engine lives in the saved .blend, not in this script. A stale scene
    # would silently render the previous engine's look into a 1,368-frame
    # atlas, so fail closed instead of trusting the committed binary.
    if scene.render.engine != manifest["render"]["engine"]:
        raise RuntimeError(
            f"scene render engine {scene.render.engine!r} does not match the manifest "
            f"engine {manifest['render']['engine']!r}; rebuild the .blend with "
            "create-hmh-enemy-roster.py before exporting"
        )
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

    rig = resolve_rig(manifest, manifest["scene"])

    all_actor_objects = [obj for obj in bpy.data.objects if obj.get("hmh_actor_id")]
    for obj in all_actor_objects:
        obj.hide_render = True

    rendered = []
    per_actor = {}
    skinned = False
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
        # An actor imported from a committed model drives named Blender actions
        # instead of the trigonometric poser below. No shipped roster actor uses
        # this yet: the roster stays Workbench/procedural until P-4.
        clip_actions = actor.get("clipActions")
        skinned = bool(clip_actions)
        if skinned:
            rig = resolve_rig(manifest, actor)
        phases = list(actor.get("phaseVisuals", {})) or [None]
        count = 0
        for boss_phase in phases:
            for obj in all_actor_objects:
                same_actor = obj.get("hmh_actor_id") == actor_id
                phase_tag = obj.get("hmh_phase")
                phase_visible = phase_tag is None or phase_tag == boss_phase
                obj.hide_render = not (same_actor and phase_visible)
            for state, clip in manifest["clips"].items():
                action = set_clip_action(rig, clip_actions[state]) if skinned else None
                for direction in manifest["directions"]:
                    rig.rotation_euler[2] = math.radians(manifest["directionAngles"][direction])
                    for frame_index in range(clip["frames"]):
                        if skinned:
                            sample_clip_frame(action, frame_index, clip["frames"], clip.get("loop", True))
                        else:
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
    if skinned:
        adt = rig.animation_data
        if adt is not None:
            adt.action = None
        scene.frame_set(scene.frame_start)
    else:
        reset_pose(rig)
    rig.rotation_euler[2] = 0.0
    bpy.context.view_layer.update()

    write_lf_json(Path(args.report_output).resolve(), {
        "status": "pass",
        "pipelineId": manifest["pipelineId"],
        "engine": scene.render.engine,
        "frameCount": len(rendered),
        "framesPerActor": per_actor,
        "states": list(manifest["clips"].keys()),
        "directions": manifest["directions"],
    })
    print(json.dumps({"status": "pass", "frameCount": len(rendered)}, sort_keys=True))


if __name__ == "__main__":
    main()
