"""Render Hero Anim v2 frames for one hero (design package 7.3-7.11).

Runs inside the hero's packed source scene, opened read-only and never
saved. Builds HMH_HumanRig_v2 in memory, appends the repository-owned held
weapons, solves every pose from the procedural clip library and renders the
requested sets. Writes a receipt with per-frame sockets (muzzle, grip,
support, offhand), foot contacts and interaction hand targets, all in master
pixels, plus rig and grip measurements.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import sys

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Matrix, Vector
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts/hmh-blender'))
import hmh_rig_v2 as rigv2  # noqa: E402
import hmh_anim_v2_clips as clips  # noqa: E402
import hmh_anim_v2_sets as sets  # noqa: E402


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def args_parse():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument('--manifest', required=True)
    p.add_argument('--actor', required=True)
    p.add_argument('--output', required=True)
    p.add_argument('--sets', default='')
    p.add_argument('--clips', default='', help='iteration aid: layer/clip keys to render')
    p.add_argument('--directions', default='')
    p.add_argument('--frames', default='', help='iteration aid: frame indices')
    p.add_argument('--probe', action='store_true', help='solve every pose, measure, render nothing')
    return p.parse_args(argv)


def main():
    args = args_parse()
    manifest = json.loads(Path(args.manifest).read_text(encoding='utf-8'))
    hero_manifest = json.loads((ROOT / manifest['heroManifest']).read_text(encoding='utf-8'))
    held_manifest = json.loads((ROOT / manifest['heldWeapons']).read_text(encoding='utf-8'))
    template = json.loads((ROOT / manifest['rigTemplate']).read_text(encoding='utf-8'))
    hero_entry = manifest['heroes'][args.actor]
    landmarks = json.loads((ROOT / hero_entry['landmarks']).read_text(encoding='utf-8'))
    pilot = next(p for p in hero_manifest['pilots'] if p['actorId'] == args.actor)
    hero_exporter = load_module('hero_exporter', ROOT / 'scripts/hmh-blender/export-hmh-production-hero-pilot.py')
    held_exporter = load_module('held_exporter', ROOT / 'scripts/hmh-blender/export-hmh-held-weapons.py')
    rig = hero_exporter.resolve_rig(hero_manifest, pilot)
    if rig.name != landmarks['sourceArmature']:
        raise RuntimeError(f'Unexpected source armature {rig.name}')
    scene = bpy.context.scene
    camera = scene.camera
    if camera is None or camera.data.type != 'ORTHO':
        raise RuntimeError('Hero scene camera must be orthographic')
    for track in (rig.animation_data.nla_tracks if rig.animation_data else []):
        track.mute = True
    if rig.animation_data:
        rig.animation_data.action = None

    actor_objects = hero_exporter.active_actor_objects(args.actor)
    body = [o for o in actor_objects if o.get('hmh_layer') in ('lower-body', 'torso-head')]
    pistol = held_exporter.find_pistol(args.actor)
    anchor = held_manifest['pistolGripAnchorAboutMean']
    grip_rest, grip_report = held_exporter.pistol_frame(rig, pistol, held_manifest['scene']['weaponBone'], anchor)

    # Prop rest geometry (rig space) for re-homing the knife and grenade.
    def verts_rig(obj):
        co = np.empty(len(obj.data.vertices) * 3)
        obj.data.vertices.foreach_get('co', co)
        co = co.reshape(-1, 3)
        m = np.array(rig.matrix_world.inverted() @ obj.matrix_world)
        return co @ m[:3, :3].T + m[:3, 3]
    knife = next(o for o in actor_objects if o.get('hmh_layer') == 'weapon' and o.vertex_groups.get('knife_prop'))
    grenade = next(o for o in actor_objects if o.get('hmh_layer') == 'weapon' and o.vertex_groups.get('grenade_prop'))
    kv = verts_rig(knife)
    palm_r = np.array(rig.data.bones['hand.R'].head_local.lerp(rig.data.bones['hand.R'].tail_local, 0.45))
    near = kv[np.linalg.norm(kv - palm_r, axis=1) < 0.05]
    handle = near.mean(axis=0) if len(near) else kv.mean(axis=0)
    tip = kv[np.argmax(np.linalg.norm(kv - handle, axis=1))]
    props = {'knife': (Vector(handle.tolist()), Vector(tip.tolist())), 'grenade': Vector(verts_rig(grenade).mean(axis=0).tolist())}

    rig_report = rigv2.build_rig_v2(rig, body, template, landmarks)
    skel = rigv2.Skeleton(rig)
    hero = clips.Hero(skel, grip_rest, props)

    requested_sets = [s for s in args.sets.split(',') if s] or None
    rows = sets.expected_frames(manifest, args.actor, requested_sets)
    if args.clips:
        keep = set(args.clips.split(','))
        rows = [r for r in rows if f"{r['layer']}/{r['clip']}" in keep]
    if args.directions:
        keep = set(args.directions.split(','))
        rows = [r for r in rows if r['direction'] in keep]
    if args.frames:
        keep = {int(x) for x in args.frames.split(',')}
        rows = [r for r in rows if r['frameIndex'] in keep]

    weapon_ids = sorted({r['weapon'] for r in rows if r['weapon'] and r['weapon'] != 'coin-blaster'})
    weapon_objects = {}
    if weapon_ids:
        weapon_objects = held_exporter.append_weapons(ROOT / held_manifest['scene']['sourceBlend'], weapon_ids)
        for weapon_id, obj in weapon_objects.items():
            held_exporter.skin_to_rig(obj, rig, grip_rest, held_manifest['scene']['weaponBone'])
            obj['hmh_actor_id'] = args.actor
            obj['hmh_layer'] = 'weapon'
            obj['hmh_v2_weapon'] = weapon_id
    muzzles = {w['weaponId']: Vector(w['muzzle']) for w in held_manifest['weapons']}
    muzzles['coin-blaster'] = Vector((max(0.12, grip_report['pistolExtentCanonical'][1][0]), 0.0, 0.06))

    # Canvas: the hero's pixel density on a wider frame.
    coverage = float(manifest['render']['coverage'])
    hero_frame = int(pilot['frameSize'][0])
    size = round(hero_frame * coverage)
    if (size - hero_frame) % 2:
        size += 1
    camera.data.ortho_scale = camera.data.ortho_scale * size / hero_frame
    scene.render.resolution_x = scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.image_settings.color_depth = '8'
    scene.render.image_settings.compression = 20
    pad = (size - hero_frame) // 2
    pivot = [pilot['sourcePivot'][0] + pad, pilot['sourcePivot'][1] + pad]

    output = Path(args.output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    all_actor = [o for o in bpy.data.objects if o.get('hmh_actor_id')]

    def show(layer, weapon_id):
        for obj in all_actor:
            role = obj.get('hmh_layer')
            if layer == 'lower':
                visible = role == 'lower-body'
            elif layer == 'shadow':
                visible = role == 'shadow'
            else:
                visible = role == 'torso-head' or (layer == 'full' and role == 'lower-body')
                if role == 'weapon':
                    v2 = obj.get('hmh_v2_weapon')
                    if v2:
                        visible = v2 == weapon_id
                    else:
                        visible = obj.get('hmh_runtime_weapon_id') != 'coin-blaster' or weapon_id == 'coin-blaster'
            obj.hide_render = not visible

    def px(point_rig: Vector):
        world = rig.matrix_world @ point_rig
        v = world_to_camera_view(scene, camera, world)
        return [round(v.x * size - pivot[0], 2), round((1.0 - v.y) * size - pivot[1], 2)]

    receipt_frames = []
    measurements = {'maxReach': {}, 'maxSupportGripError': 0.0, 'footSlide': {}}
    cache = {}
    direction_angles = hero_manifest['directionAngles']
    for row in rows:
        key = (row['set'], row['layer'], row['clip'], row['frameIndex'])
        if key not in cache:
            weapon_id = row['weapon']
            layer, clip, index, frames = row['layer'], row['art'], row['frameIndex'], row['frames']
            if layer == 'lower':
                spec = clips.lower_pose(hero, clip, index, frames)
                spec.setdefault('props', {})
            elif layer == 'upper':
                spec = clips.upper_pose(hero, weapon_id, clip, index, frames)
            elif layer == 'full':
                spec = clips.death_pose(hero, clip, index, frames) if clip.startswith('death') else clips.interaction_pose(hero, clip, index)
            else:
                spec = {'props': {}}
            bases, info, pose = rigv2.solve_pose(skel, spec)
            sockets = {}
            if 'grip' in spec and weapon_id:
                grip = spec['grip']
                sockets['grip'] = grip.translation.copy()
                sockets['muzzle'] = grip @ muzzles[weapon_id]
                if weapon_id in clips.SUPPORT:
                    fx, fz = clips.SUPPORT[weapon_id]
                    sockets['support'] = grip @ Vector((fx, 0.0, fz))
            sockets['offhand'] = pose['offhand_socket'].translation.copy()
            contacts = {}
            if layer in ('lower', 'full'):
                for side in ('L', 'R'):
                    ankle = pose[f'foot.{side}'].translation
                    contacts['foot' + side] = Vector((ankle.x, ankle.y, 0.0))
            for k, v in info.items():
                measurements['maxReach'][k] = max(measurements['maxReach'].get(k, 0.0), round(v, 5))
                if v > 0.005:
                    ck = f"{row['set']}/{layer}/{clip}/{k}"
                    measurements.setdefault('reachByClip', {})[ck] = max(measurements.get('reachByClip', {}).get(ck, 0.0), round(v, 4))
            if 'grip' in spec and 'L' in spec.get('hands', {}) and weapon_id in clips.SUPPORT and clip in ('aim-idle', 'aim-run', 'fire'):
                support_point = spec['grip'] @ Vector((clips.SUPPORT[weapon_id][0], 0.0, clips.SUPPORT[weapon_id][1]))
                palm = pose['hand.L'] @ Vector((0.028, 0.055, 0.0))
                measurements['maxSupportGripError'] = max(measurements['maxSupportGripError'], round((palm - support_point).length, 5))
            hand_target = None
            if spec.get('handTarget') is not None:
                palms = [pose[f'hand.{s}'] @ Vector((0.0, 0.055, 0.0)) for s in ('L', 'R') if s in spec.get('hands', {})]
                hand_target = sum(palms, Vector((0, 0, 0))) / len(palms)
                measurements.setdefault('handTargetError', {})[clip] = max(measurements.get('handTargetError', {}).get(clip, 0.0), round((hand_target - spec['handTarget']).length, 4))
            if 'fit' in spec and spec['fit'] > 0:
                ck = f"{row['set']}/{clip}"
                measurements.setdefault('weaponFit', {})[ck] = max(measurements.get('weaponFit', {}).get(ck, 0.0), spec['fit'])
            cache.clear()
            cache[key] = (bases, sockets, contacts, hand_target)
        bases, sockets, contacts, hand_target = cache[key]
        rigv2.apply_bases(rig, bases)
        rig.rotation_euler[2] = math.radians(direction_angles[row['direction']])
        show(row['layer'], row['weapon'])
        bpy.context.view_layer.update()
        frame = {'id': row['id'], 'sockets': {k: px(v) for k, v in sockets.items()}}
        if contacts:
            frame['contacts'] = {k: px(v) for k, v in contacts.items()}
        if hand_target is not None:
            frame['handTarget'] = px(hand_target)
            frame['handTargetWorld'] = [round(hand_target.x, 4), round(hand_target.y, 4), round(hand_target.z, 4)]
        receipt_frames.append(frame)
        if not args.probe:
            scene.render.filepath = str(output / row['filename'])
            bpy.ops.render.render(write_still=True)
    receipt = {'actorId': args.actor, 'rig': rig_report, 'gripFrame': grip_report, 'frameSize': [size, size], 'pivot': pivot,
               'heroFrameSize': hero_frame, 'coverage': coverage, 'frames': receipt_frames, 'measurements': measurements,
               'runtimeAuthority': 'projection-only', 'sourceSaved': False,
               'clipLibrarySha256': hashlib.sha256((ROOT / 'scripts/hmh-blender/hmh_anim_v2_clips.py').read_bytes()).hexdigest(),
               'rigModuleSha256': hashlib.sha256((ROOT / 'scripts/hmh-blender/hmh_rig_v2.py').read_bytes()).hexdigest()}
    (output.parent / (output.name + '-receipt.json')).write_text(json.dumps(receipt, indent=1), encoding='utf-8')
    print(json.dumps({'status': 'pass', 'frames': len(receipt_frames), 'measurements': measurements}), flush=True)


if __name__ == '__main__':
    main()
