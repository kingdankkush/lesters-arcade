"""Small authored, source-only additions to the completed humanoid actions.

Aim gains a breathing cycle, fire begins in recoil, and attacks retain planted
anticipation/follow-through instead of copying a neutral pose at both ends.
Nothing here changes runtime timing, hitboxes, prop visibility or root motion.
Angles are degrees in the existing named control rig's local Euler axes.
"""
import math

POLISHED_ACTIONS = ('HMH_Aim', 'HMH_PistolFire', 'HMH_Melee', 'HMH_Grenade', 'HMH_Death')
ALL_ACTIONS = (*POLISHED_ACTIONS, 'HMH_Idle', 'HMH_Run', 'HMH_Hurt', 'HMH_Dash')


def ground_by_measured_response(pelvis, minimum_z, update):
    """Ground a skinned pose using its measured local-pelvis response."""
    before = minimum_z()
    original = pelvis.location.y
    if not math.isfinite(before) or not math.isfinite(original):
        raise ValueError('non-finite source grounding measurement')
    if abs(before) <= 0.0005:
        return before, before
    try:
        pelvis.location.y = original + 0.01
        update()
        shifted = minimum_z()
    finally:
        pelvis.location.y = original
        update()
    slope = (shifted - before) / 0.01
    if not math.isfinite(slope) or abs(slope) <= 0.2:
        raise ValueError('pelvis has no safe measured vertical response')
    after = before
    for _ in range(2):
        pelvis.location.y -= after / slope
        update()
        after = minimum_z()
        if math.isfinite(after) and abs(after) < 0.0025:
            return before, after
    pelvis.location.y = original
    update()
    raise RuntimeError('source pose could not be grounded within 2.5 mm')


def pose_offsets_degrees(action: str, progress: float) -> dict:
    if isinstance(progress, bool) or not isinstance(progress, (int, float)) or not math.isfinite(progress) or not 0 <= progress <= 1:
        raise ValueError('action progress must be finite and within [0, 1]')
    if action not in ALL_ACTIONS:
        raise ValueError(f'unknown authored action: {action}')
    t = float(progress)
    if action == 'HMH_Aim':
        breath = math.cos(2 * math.pi * t)
        return {'chest': (1.8 * breath, 0, 0), 'upper_arm.R': (2.4 * breath, 0, 0), 'forearm.R': (-2 * breath, 0, 0)}
    if action == 'HMH_PistolFire':
        recoil = 1 - 0.82 * t
        return {'chest': (-3 * recoil, 0, 0), 'upper_arm.R': (-8 * recoil, 0, 0), 'forearm.R': (10 * recoil, 0, 0), 'hand.R': (-7 * recoil, 0, 0)}
    if action == 'HMH_Melee':
        return {'thigh.R': (7 - 4 * t, 0, 0), 'thigh.L': (-5 + 2 * t, 0, 0), 'shin.R': (-8 + 4 * t, 0, 0), 'shin.L': (-6 + 3 * t, 0, 0), 'chest': (0, 0, 4 * (1 - t)), 'upper_arm.R': (0, 0, -3 - 2 * t), 'hand.R': (1 + 2 * t, 0, 4 - 7 * t)}
    if action == 'HMH_Grenade':
        step = math.sin(math.pi * t * 0.85)
        return {'thigh.R': (8 + 7 * step, 0, 0), 'thigh.L': (-6 - 3 * t, 0, 0), 'shin.R': (-10 + 3 * t, 0, 0), 'shin.L': (-6 + 2 * t, 0, 0)}
    if action == 'HMH_Death':
        onset = (1 - t) ** 2
        return {'chest': (-5 * onset, 0, 0), 'thigh.R': (5 * onset, 0, 0), 'shin.R': (-10 * onset, 0, 0)}
    return {}
