"""Expand hmh-hero-anim-v2.json into concrete sets, clips and frame ids.

Pure Python (no bpy): shared by the Blender exporter and the runner so both
agree on exactly which frames a set contains.
"""
from __future__ import annotations

import copy


def weapon_set_clips(manifest: dict, weapon_id: str) -> dict:
    base = copy.deepcopy(manifest['sets']['weapon:coin-blaster']['clips'])
    template = manifest['weaponSetTemplate']
    for clip in template['omit'].get(weapon_id, []):
        base.pop(clip, None)
    for clip, spec in template['extras'].get(weapon_id, {}).items():
        base[clip] = copy.deepcopy(spec)
    return base


def expand_sets(manifest: dict, actor_id: str) -> dict:
    """{setId: {'weapon': id|None, 'clips': {layer/clip: spec}}} for one hero."""
    hero = manifest['heroes'][actor_id]
    sets = {'core': {'weapon': None, 'clips': copy.deepcopy(manifest['sets']['core']['clips'])}}
    for weapon_id in hero['weapons']:
        clips = copy.deepcopy(manifest['sets']['weapon:coin-blaster']['clips']) if weapon_id == 'coin-blaster' else weapon_set_clips(manifest, weapon_id)
        sets[f'weapon:{weapon_id}'] = {'weapon': weapon_id, 'clips': clips}
    return sets


def facings_for(manifest: dict, spec: dict) -> list[str]:
    count = spec.get('facings', 8)
    if count == 8:
        return list(manifest['directions'])
    if count == 2:
        return list(manifest['sideFacings'])
    if count == 1:
        return ['south']
    raise ValueError(f'unsupported facing count {count}')


def set_slug(set_id: str) -> str:
    return set_id.replace(':', '-')


def frame_id(actor_id: str, set_id: str, layer: str, clip: str, direction: str, index: int) -> str:
    return f'{actor_id}__{set_slug(set_id)}__{layer}__{clip}__{direction}__{index:03d}'


def expected_frames(manifest: dict, actor_id: str, set_ids: list[str] | None = None) -> list[dict]:
    sets = expand_sets(manifest, actor_id)
    rows = []
    for set_id, data in sets.items():
        if set_ids and set_id not in set_ids:
            continue
        for key, spec in data['clips'].items():
            layer, clip = key.split('/', 1)
            for direction in facings_for(manifest, spec):
                for index in range(spec['frames']):
                    fid = frame_id(actor_id, set_id, layer, clip, direction, index)
                    rows.append({'id': fid, 'filename': fid + '.png', 'set': set_id, 'layer': layer, 'clip': clip,
                                 'art': spec.get('art', clip), 'direction': direction, 'frameIndex': index,
                                 'frames': spec['frames'], 'weapon': data['weapon'] if spec.get('weapon', 0) != None else None})
    return rows
