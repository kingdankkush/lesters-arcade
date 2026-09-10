"""Strict visibility contract for the native grenade's released held prop.

This is not an empty-art waiver. Only authored weapon/grenade samples 3 and 4
of the five-sample non-looping clip may be absent. The analyzer must verify
that declared absent pixels are actually fully transparent, and still rejects
all unexplained empty bodies/weapons and all visible-frame duplication.
"""

RELEASED_PROP = 'source-prop-released'


def validate_released_weapon_frames(pilot):
    indices = pilot.get('releasedWeaponFrameIndices')
    if indices is None:
        return False
    if not isinstance(indices, list) or indices != [3, 4] or any(type(i) is not int for i in indices):
        raise ValueError('releasedWeaponFrameIndices must be exactly [3, 4]')
    clip = pilot.get('clips', {}).get('weapon', {}).get('grenade', {})
    if pilot.get('sourceModel', {}).get('format') != 'blend' or pilot.get('runtimeAuthority') != 'projection-only':
        raise ValueError('released prop visibility requires a native projection-only source')
    if clip.get('frames') != 5 or clip.get('loop') is not False:
        raise ValueError('released prop visibility requires the five-frame non-looping grenade clip')
    return True


def is_released_prop_frame(frame):
    visibility = frame.get('visibility')
    if visibility is None:
        return False
    if visibility != RELEASED_PROP or frame.get('layer') != 'weapon' or frame.get('state') != 'grenade' or type(frame.get('frameIndex')) is not int or frame['frameIndex'] not in (3, 4):
        raise ValueError('invalid released prop frame visibility')
    return True
