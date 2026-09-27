"""Hand-keyed procedural clip library for Anim v2 (design package 7.4-7.8).

Every pose is a pure function of (clip, frame index, weapon class, hero
anthropometrics): no randomness, no wall clock, no Blender state. The
exporter solves each pose with hmh_rig_v2.solve_pose (analytic two-bone IK
for hands and feet, armature-axis deltas for the spine) and bakes plain FK
bases, so two cold passes produce identical poses.

Space: armature rest space, metres. The hero faces -Y, +X is the hero's
left, +Z is up. The exporter turns the whole rig for each of the 8 facings.
"""
from __future__ import annotations

import math

from mathutils import Matrix, Vector

from hmh_rig_v2 import frame_from_axes, rot_arm, shoulder_positions

TAU = math.tau
FWD = Vector((0.0, -1.0, 0.0))
LEFT = Vector((1.0, 0.0, 0.0))
UP = Vector((0.0, 0.0, 1.0))


def smooth(t: float) -> float:
    t = 0.0 if t < 0 else 1.0 if t > 1 else t
    return t * t * (3 - 2 * t)


def lerp(a, b, t):
    return a + (b - a) * t


def mlerp(a: Matrix, b: Matrix, t: float) -> Matrix:
    la, ra, _ = a.decompose()
    lb, rb, _ = b.decompose()
    m = ra.slerp(rb, t).to_matrix().to_4x4()
    m.translation = la.lerp(lb, t)
    return m


def keys(t: float, points):
    """Piecewise smooth interpolation over [(t, value), ...] (values may be
    floats, tuples or Vectors)."""
    if t <= points[0][0]:
        return points[0][1]
    for (t0, v0), (t1, v1) in zip(points, points[1:]):
        if t <= t1:
            s = smooth((t - t0) / (t1 - t0)) if t1 > t0 else 1.0
            if isinstance(v0, tuple):
                return tuple(lerp(a, b, s) for a, b in zip(v0, v1))
            return lerp(v0, v1, s)
    return points[-1][1]


# --------------------------------------------------------------------------
# Weapon handling classes (package 7.4) and per-weapon geometry
# --------------------------------------------------------------------------

WEAPON_CLASS = {
    'coin-blaster': 'pistol',
    'scatter-shotgun': 'rifle',
    'hash-rail': 'rifle',
    'lightning-ledger': 'rifle',
    'auto-miner': 'heavy',
    'launcher-rig': 'launcher',
    'bear-market-burner': 'flamethrower',
    'forked-standard': 'standard',
}

STANCE = {'pistol': 'neutral', 'rifle': 'staggered', 'heavy': 'wide', 'launcher': 'wide', 'flamethrower': 'wide', 'standard': 'fencing'}

# Off-hand contact on each weapon, in its grip frame (forward, up), metres.
SUPPORT = {
    'scatter-shotgun': (0.30, -0.035),
    'hash-rail': (0.36, -0.03),
    'lightning-ledger': (0.30, -0.03),
    'auto-miner': (0.13, 0.135),
    'launcher-rig': (0.25, -0.04),
    'bear-market-burner': (0.24, -0.04),
    'forked-standard': (0.40, 0.0),
}

# Aim placement of the grip frame per class: origin (x, y, z) in armature
# space, bore pitch (degrees, + raises the muzzle), chest yaw/pitch, head yaw.
AIM = {
    'pistol': {'grip': (-0.20, -0.34, 1.44), 'pitch': 0.0, 'chest': (4.0, 0.0, 0.0), 'spine': (2.0, 0.0, 0.0), 'head': (4.0, 0.0, 0.0)},
    'rifle': {'grip': (-0.10, -0.25, 1.36), 'pitch': 1.0, 'chest': (5.0, -24.0, 0.0), 'spine': (2.0, -8.0, 0.0), 'head': (6.0, 26.0, 0.0)},
    'heavy': {'grip': (-0.18, -0.16, 1.14), 'pitch': 2.0, 'chest': (-4.0, -14.0, 0.0), 'spine': (-2.0, -6.0, 0.0), 'head': (8.0, 16.0, 0.0)},
    'launcher': {'grip': (-0.14, -0.20, 1.26), 'pitch': 4.0, 'chest': (0.0, -20.0, 0.0), 'spine': (0.0, -6.0, 0.0), 'head': (6.0, 22.0, 0.0)},
    'flamethrower': {'grip': (-0.08, -0.18, 1.16), 'pitch': 0.0, 'chest': (4.0, -28.0, 0.0), 'spine': (0.0, -6.0, 0.0), 'head': (8.0, 18.0, 0.0)},
    'standard': {'grip': (-0.18, -0.06, 1.06), 'pitch': 9.0, 'chest': (4.0, -30.0, 0.0), 'spine': (2.0, -10.0, 0.0), 'head': (6.0, 34.0, 0.0)},
}


class Hero:
    """Anthropometrics measured from the rest skeleton."""

    def __init__(self, skel, grip_frame_rest: Matrix, props: dict):
        rest = skel.rest
        self.skel = skel
        self.grip_rest = grip_frame_rest            # grip frame (rig-local) at rest
        self.hand_rest = {s: rest[f'hand.{s}'].copy() for s in ('L', 'R')}
        self.hip = {s: rest[f'thigh.{s}'].translation.copy() for s in ('L', 'R')}
        self.ankle_rest = {s: rest[f'foot.{s}'].translation.copy() for s in ('L', 'R')}
        self.foot_rest = {s: rest[f'foot.{s}'].copy() for s in ('L', 'R')}
        self.ball_rest = {s: rest[f'toe.{s}'].translation.copy() for s in ('L', 'R')}
        self.shoulder = {s: rest[f'upper_arm.{s}'].translation.copy() for s in ('L', 'R')}
        self.ankle_height = (self.ankle_rest['L'].z + self.ankle_rest['R'].z) / 2
        self.leg = {s: skel.length[f'thigh.{s}'] + skel.length[f'shin.{s}'] for s in ('L', 'R')}
        self.props = props  # {'knife': (handle, tip), 'grenade': centre} in rest rig space
        self.centre_x = (self.hip['L'].x + self.hip['R'].x) / 2

    # ---- feet -------------------------------------------------------------
    def foot(self, side, position: Vector, yaw=0.0, pitch=0.0, pivot='ankle', toe=0.0, pole=None):
        """Foot target. `position` is the ground point under the ankle (z is
        the lift above the ground). pitch + lifts the toe; with pivot 'ball'
        the heel rises about the ball of the foot."""
        rest = self.foot_rest[side]
        lateral = (rest.to_3x3() @ Vector((1, 0, 0))).normalized()
        rot = Matrix.Rotation(math.radians(yaw), 3, 'Z') @ Matrix.Rotation(math.radians(-pitch), 3, lateral)
        orient = rot @ rest.to_3x3()
        ankle_rest = self.ankle_rest[side]
        ball = self.ball_rest[side]
        base = Vector((position.x, position.y, 0.0))
        if pivot == 'ball':
            ball_now = base + Matrix.Rotation(math.radians(yaw), 3, 'Z') @ Vector((ball.x - ankle_rest.x, ball.y - ankle_rest.y, 0.0))
            ball_now.z = ball.z + position.z
            ankle = ball_now + rot @ (ankle_rest - ball)
        else:
            ankle = Vector((position.x, position.y, ankle_rest.z + position.z))
        m = orient.to_4x4()
        m.translation = ankle
        knee_pole = pole if pole is not None else ankle + Matrix.Rotation(math.radians(yaw), 3, 'Z') @ Vector((0, -1.2, 0.6))
        return {'matrix': m, 'pole': knee_pole, 'toe': toe}

    def stance_feet(self, kind='neutral', bob=0.0, shift=0.0):
        """Planted idle feet for a stance, relative to the hips."""
        spread = {'neutral': 0.02, 'staggered': 0.04, 'wide': 0.08, 'fencing': 0.03}[kind]
        stagger = {'neutral': 0.03, 'staggered': 0.13, 'wide': 0.05, 'fencing': 0.22}[kind]
        yaw_l = {'neutral': 4, 'staggered': 10, 'wide': 12, 'fencing': 22}[kind]
        yaw_r = {'neutral': -6, 'staggered': -24, 'wide': -14, 'fencing': -45}[kind]
        l = Vector((self.hip['L'].x + spread + shift, self.hip['L'].y - stagger, 0))
        r = Vector((self.hip['R'].x - spread + shift, self.hip['R'].y + stagger, 0))
        return {'L': self.foot('L', l, yaw=yaw_l), 'R': self.foot('R', r, yaw=yaw_r)}

    # ---- hands ------------------------------------------------------------
    def weapon_frame(self, origin: Vector, pitch=0.0, yaw=0.0, roll=0.0) -> Matrix:
        """Grip frame world pose: columns forward, left, up; origin at the
        trigger-hand palm point."""
        rot = rot_arm(-pitch, yaw, roll)
        f = rot @ FWD
        u = rot @ UP
        l = u.cross(f)
        m = Matrix.Identity(4)
        for row in range(3):
            m[row][0], m[row][1], m[row][2], m[row][3] = f[row], l[row], u[row], origin[row]
        return m

    def right_hand_on(self, grip: Matrix, pole=None, curl=0.0):
        m = grip @ self.grip_rest.inverted() @ self.hand_rest['R']
        wrist = m.translation
        pole = pole if pole is not None else wrist + Vector((-0.55, 0.45, -0.35))
        return {'matrix': m, 'pole': pole, 'curl': curl}

    def left_hand_at(self, point: Vector, palm: Vector, fingers: Vector, pole=None, curl=0.6):
        """Left palm pressed on `point`: palm normal `palm`, fingers along
        `fingers`. The wrist sits behind the palm centre."""
        x = palm.normalized()
        y = (fingers - x * fingers.dot(x)).normalized()
        wrist = point - y * 0.055 - x * 0.028
        m = frame_from_axes(x, y, wrist)
        pole = pole if pole is not None else wrist + Vector((0.55, 0.35, -0.45))
        return {'matrix': m, 'pole': pole, 'curl': curl}

    def right_hand_at(self, point: Vector, palm: Vector, fingers: Vector, pole=None, curl=0.4):
        x = -palm.normalized()   # the right hand's +X points out of the back of the hand
        y = (fingers - x * fingers.dot(x)).normalized()
        wrist = point - y * 0.055 + x * 0.028
        m = frame_from_axes(x, y, wrist)
        pole = pole if pole is not None else wrist + Vector((-0.55, 0.35, -0.45))
        return {'matrix': m, 'pole': pole, 'curl': curl}

    def support_hand(self, grip: Matrix, weapon_id: str, curl=0.7):
        fx, fz = SUPPORT[weapon_id]
        f = grip.to_3x3() @ Vector((1, 0, 0))
        l = grip.to_3x3() @ Vector((0, 1, 0))
        u = grip.to_3x3() @ Vector((0, 0, 1))
        point = grip.translation + f * fx + u * fz
        if weapon_id == 'auto-miner':
            # Carry handle on top: palm down, fingers across to the far side.
            return self.left_hand_at(point + u * 0.02, -u, -l + f * 0.2, curl=curl)
        if weapon_id == 'forked-standard':
            return self.left_hand_at(point, -l + u * 0.2, u * 0.4 - l * 0.2 + f * 0.1, curl=curl)
        return self.left_hand_at(point - u * 0.02, u, -l + f * 0.15, curl=curl)

    # ---- props ------------------------------------------------------------
    def grenade_in(self, hand_matrix: Matrix) -> Matrix:
        """grenade_prop pose that puts the grenade's centre in the palm."""
        palm = hand_matrix @ Vector((0.0, 0.07, 0.0))
        rest_bone = self.skel.rest['grenade_prop']
        offset = self.props['grenade'] - rest_bone.translation
        m = rest_bone.copy()
        m.translation = palm - offset
        return m

    def knife_reverse(self, hand_matrix: Matrix) -> Matrix:
        """Knife in the left hand, reverse grip: blade out of the pinky side,
        edge outward."""
        handle, tip = self.props['knife']
        rest_bone = self.skel.rest['knife_prop']
        blade_rest = (tip - handle).normalized()
        palm = hand_matrix @ Vector((0.0, 0.06, 0.0))
        hand_x = hand_matrix.to_3x3() @ Vector((1, 0, 0))
        hand_z = hand_matrix.to_3x3() @ Vector((0, 0, 1))
        blade_now = (-hand_z * 0.7 - hand_x * 0.3).normalized()
        rot = blade_rest.rotation_difference(blade_now).to_matrix()
        m = (rot.to_4x4() @ Matrix.Translation(-handle)) @ rest_bone
        m = Matrix.Translation(palm) @ m
        return m


# --------------------------------------------------------------------------
# Locomotion (package 7.6). Cycle distances in world units; 1 m = WU_PER_M.
# --------------------------------------------------------------------------

WU_PER_M = 33.7  # 256 source px = 92.8 world units = 2.75 m of ortho frame

GAITS = {
    # travel axis, cycle distance (world units), stance fraction, lift, lean
    'run': {'axis': FWD, 'cycle': 160, 'stance': 0.30, 'lift': 0.30, 'lean': 10.0, 'bob': 0.045},
    'sprint': {'axis': FWD, 'cycle': 240, 'stance': 0.24, 'lift': 0.36, 'lean': 16.0, 'bob': 0.055},
    'strafe-left': {'axis': LEFT, 'cycle': 150, 'stance': 0.32, 'lift': 0.22, 'lean': 4.0, 'bob': 0.035},
    'strafe-right': {'axis': -LEFT, 'cycle': 150, 'stance': 0.32, 'lift': 0.22, 'lean': 4.0, 'bob': 0.035},
    'backpedal': {'axis': -FWD, 'cycle': 130, 'stance': 0.36, 'lift': 0.18, 'lean': -3.0, 'bob': 0.03},
}


def gait_pelvis(gait: dict, phase: float) -> dict:
    # Two bounces per cycle: lowest at each mid-stance, highest in flight.
    s = gait['stance']
    local = (phase % 0.5) / 0.5
    down = math.cos(TAU * (local - s / 2)) * 0.5 + 0.5  # 1 at mid-stance
    z = -0.05 - gait['bob'] * down + gait['bob'] * 0.35
    sway = math.sin(TAU * phase) * 0.012
    axis = gait['axis']
    lateral = Vector((-axis.y, axis.x, 0.0))
    offset = Vector((0, 0, z)) + lateral * sway
    return {'offset': tuple(offset), 'rot': (gait['lean'] * 0.35, 0.0, 0.0)}


def gait_foot(hero: Hero, side: str, gait: dict, phase: float):
    s = gait['stance']
    cycle_m = gait['cycle'] / WU_PER_M
    # Stance travel equals body travel, so a distance-driven playback plants
    # the foot with no slide. Longer cycles get a flight phase.
    axis = gait['axis']
    half = min(0.30 if axis.x != 0 else 0.38, s * cycle_m / 2)
    lateral_axis = Vector((-axis.y, axis.x, 0.0))
    p = (phase + (0.0 if side == 'L' else 0.5)) % 1.0
    hip = hero.hip[side]
    base = Vector((hip.x * 0.55 + hero.centre_x * 0.45, hip.y, 0.0))
    if axis.x != 0:
        # Strafes keep the feet apart fore and aft so the legs pass cleanly.
        base.x = hero.centre_x + (0.10 if side == 'L' else -0.10)
        base.y = hip.y + (-0.07 if side == 'L' else 0.09)
    if p < s:
        q = p / s
        along = half - 2 * half * q
        lift = 0.0
        pitch = keys(q, [(0, 10.0), (0.25, 0.0), (0.7, 0.0), (1.0, -28.0)])
        pivot = 'ball' if q > 0.7 else 'ankle'
    else:
        q = (p - s) / (1 - s)
        along = -half + 2 * half * smooth(q ** 1.25)
        lift = gait['lift'] * math.sin(math.pi * min(1.0, q * 1.15)) ** 0.85
        pitch = keys(q, [(0, -28.0), (0.35, -18.0), (0.8, 6.0), (1.0, 10.0)])
        pivot = 'ankle'
    point = base + axis * along
    point.z = lift
    if pivot == 'ball':
        point.z = 0.0
    yaw = 0.0
    pole = point + Vector((0, -1.2, 0.7))
    return hero.foot(side, point, yaw=yaw, pitch=pitch, pivot=pivot, toe=max(0.0, -pitch) * 0.6, pole=pole)


def lower_pose(hero: Hero, clip: str, index: int, frames: int, stance='neutral') -> dict:
    if clip in GAITS:
        gait = GAITS[clip]
        phase = index / frames
        return {'pelvis': gait_pelvis(gait, phase),
                'feet': {s: gait_foot(hero, s, gait, phase) for s in ('L', 'R')}}
    if clip.startswith('idle') or clip.startswith('stance-'):
        kind = stance if clip == 'idle' else clip.split('-', 1)[1]
        t = index / frames
        breath = math.sin(TAU * t)
        shift = math.sin(TAU * t + 0.6) * 0.008
        drop = {'neutral': -0.03, 'staggered': -0.05, 'wide': -0.07, 'fencing': -0.08}[kind]
        return {'pelvis': {'offset': (shift, 0.0, drop + breath * 0.006), 'rot': (0.0, 0.0, 0.0)},
                'feet': hero.stance_feet(kind)}
    if clip == 'start':
        # First 40 units from stillness: weight drops, lean in, first push.
        t = index / max(1, frames - 1)
        idle = hero.stance_feet('neutral')
        run = {s: gait_foot(hero, s, GAITS['run'], 0.05 + 0.2 * t) for s in ('L', 'R')}
        feet = {}
        for s in ('L', 'R'):
            a, b = idle[s], run[s]
            m = mlerp(a['matrix'], b['matrix'], smooth(t))
            feet[s] = {'matrix': m, 'pole': a['pole'].lerp(b['pole'], t), 'toe': b['toe'] * t}
        return {'pelvis': {'offset': (0.0, -0.04 * t, -0.03 - 0.04 * math.sin(math.pi * t)), 'rot': (6.0 * t, 0.0, 0.0)}, 'feet': feet}
    if clip == 'stop':
        t = index / max(1, frames - 1)
        idle = hero.stance_feet('neutral')
        run = {s: gait_foot(hero, s, GAITS['run'], 0.55) for s in ('L', 'R')}
        feet = {}
        for s in ('L', 'R'):
            a, b = run[s], idle[s]
            w = smooth(min(1.0, t * 1.4))
            feet[s] = {'matrix': mlerp(a['matrix'], b['matrix'], w), 'pole': a['pole'].lerp(b['pole'], w), 'toe': a['toe'] * (1 - w)}
        brace = math.sin(math.pi * min(1.0, t * 1.2))
        return {'pelvis': {'offset': (0.0, 0.03 * brace, -0.03 - 0.07 * brace), 'rot': (-5.0 * brace, 0.0, 0.0)}, 'feet': feet}
    if clip == 'dash':
        return dash_lower(hero, index)
    raise KeyError(f'unknown lower clip {clip}')


DASH_PELVIS = [(-0.10, 0.02, 8.0), (-0.18, -0.06, 18.0), (-0.24, -0.16, 24.0), (-0.25, -0.20, 24.0),
               (-0.24, -0.18, 22.0), (-0.20, -0.12, 16.0), (-0.13, -0.05, 9.0), (-0.07, 0.0, 4.0)]


def dash_lower(hero: Hero, index: int) -> dict:
    """8 active ticks: a low lunge. Legs return to locomotion on tick 8."""
    dz, dy, lean = DASH_PELVIS[index]
    t = index / 7
    front = keys(t, [(0, 0.05), (0.3, -0.42), (0.6, -0.50), (1.0, -0.20)])
    back = keys(t, [(0, 0.10), (0.3, 0.30), (0.6, 0.34), (1.0, 0.16)])
    front_lift = keys(t, [(0, 0.0), (0.15, 0.10), (0.35, 0.0), (1.0, 0.0)])
    back_pitch = keys(t, [(0, 0.0), (0.3, -35.0), (0.7, -38.0), (1.0, -10.0)])
    l = hero.foot('L', Vector((hero.hip['L'].x - 0.02, hero.hip['L'].y + front, front_lift)), yaw=6, pitch=keys(t, [(0, 0), (0.3, 8), (1, 0)]))
    r = hero.foot('R', Vector((hero.hip['R'].x + 0.02, hero.hip['R'].y + back, 0.0)), yaw=-10, pitch=back_pitch, pivot='ball', toe=-back_pitch * 0.6)
    return {'pelvis': {'offset': (0.0, dy, dz), 'rot': (lean * 0.4, 0.0, 0.0)}, 'feet': {'L': l, 'R': r}}


# --------------------------------------------------------------------------
# Upper body (merged torso + weapon), per weapon class
# --------------------------------------------------------------------------

def aim_base(hero: Hero, weapon_id: str | None):
    cls = WEAPON_CLASS.get(weapon_id, 'pistol')
    return cls, AIM[cls]


def upper_spec(hero: Hero, weapon_id: str | None, *, grip_offset=Vector((0, 0, 0)), pitch=0.0, yaw=0.0, roll=0.0,
               chest=(0, 0, 0), spine=(0, 0, 0), head=(0, 0, 0), pelvis=None, support=True, left=None, right=None,
               weapon_visible=True, grenade=None, knife=None, clav=(0, 0)):
    cls, aim = aim_base(hero, weapon_id)
    spec = {'pelvis': pelvis or {'offset': (0.0, 0.0, -0.03), 'rot': (0, 0, 0)},
            'fk': {'spine': tuple(a + b for a, b in zip(aim['spine'], spine)),
                   'chest': tuple(a + b for a, b in zip(aim['chest'], chest)),
                   'head': tuple(a + b for a, b in zip(aim['head'], head)),
                   'clavicle.L': (0.0, clav[0], 0.0), 'clavicle.R': (0.0, clav[1], 0.0)},
            'hands': {}, 'props': {'release_grip': None, 'grenade_prop': None, 'knife_prop': None}}
    if weapon_id is None:
        # Empty hands (residency fallback): relaxed ready guard.
        spec['hands']['R'] = right or hero.right_hand_at(Vector((-0.24, -0.26, 1.24)), Vector((0.4, 0, -1)), Vector((0.1, -1, 0.2)), curl=0.8)
        spec['hands']['L'] = left or hero.left_hand_at(Vector((0.20, -0.24, 1.26)), Vector((-0.4, 0, -1)), Vector((-0.1, -1, 0.2)), curl=0.8)
        spec['props']['pistol_prop'] = None
    else:
        origin = Vector(aim['grip']) + grip_offset
        grip = hero.weapon_frame(origin, pitch=aim['pitch'] + pitch, yaw=yaw, roll=roll)
        # Reach fit: slide the weapon (orientation kept) toward the chest until
        # the trigger hand and, when used, the support hand both reach it.
        shoulders = shoulder_positions(hero.skel, spec)
        skel = hero.skel
        reach = {s: skel.length[f'upper_arm.{s}'] + skel.length[f'forearm.{s}'] - 0.012 for s in ('L', 'R')}
        needs_support = right is None and left is None and cls != 'pistol' and support
        pull = (shoulders['L'] + shoulders['R']) / 2 + Vector((0.0, -0.10, -0.24))
        fit = 0.0
        for _ in range(80):
            ok = (hero.right_hand_on(grip)['matrix'].translation - shoulders['R']).length <= reach['R'] or right is not None
            if ok and needs_support:
                ok = (hero.support_hand(grip, weapon_id)['matrix'].translation - shoulders['L']).length <= reach['L']
            if ok:
                break
            step = pull - origin
            if step.length < 0.01:
                break
            origin = origin + step.normalized() * 0.01
            fit += 0.01
            grip = hero.weapon_frame(origin, pitch=aim['pitch'] + pitch, yaw=yaw, roll=roll)
        spec['fit'] = round(fit, 3)
        spec['grip'] = grip
        spec['hands']['R'] = right or hero.right_hand_on(grip)
        if left is not None:
            spec['hands']['L'] = left
        elif cls == 'pistol':
            spec['hands']['L'] = hero.left_hand_at(Vector((0.10, -0.22, 1.30)), Vector((-0.5, 0.2, -0.8)), Vector((-0.9, -0.4, 0.3)), curl=0.9)
        elif support:
            spec['hands']['L'] = hero.support_hand(grip, weapon_id)
        spec['props']['pistol_prop'] = 'rest' if weapon_visible else None
    if grenade is not None:
        spec['props']['grenade_prop'] = grenade
    if knife is not None:
        spec['props']['knife_prop'] = knife
    return spec


def run_pelvis(frame_leg: int) -> dict:
    return gait_pelvis(GAITS['run'], frame_leg / 16)


def upper_pose(hero: Hero, weapon_id: str | None, clip: str, index: int, frames: int) -> dict:
    cls, aim = aim_base(hero, weapon_id)
    t = index / max(1, frames - 1)
    loop_t = index / frames
    two_hand = cls != 'pistol'
    if clip == 'aim-idle':
        breath = math.sin(TAU * loop_t)
        sway = math.sin(TAU * loop_t + 1.1)
        return upper_spec(hero, weapon_id, grip_offset=Vector((sway * 0.004, 0, breath * 0.006)), pitch=breath * 0.6,
                          chest=(breath * 1.2, sway * 0.8, 0), head=(0, sway * 1.5, 0),
                          pelvis={'offset': (0.0, 0.0, -0.03 + breath * 0.006), 'rot': (0, 0, 0)})
    if clip == 'aim-run':
        pel = run_pelvis(index * 2)
        phase = index / frames
        bob = math.sin(TAU * phase * 2)
        swing = math.sin(TAU * phase)
        return upper_spec(hero, weapon_id, grip_offset=Vector((swing * 0.012, 0.0, bob * 0.012)), pitch=bob * 1.2,
                          chest=(GAITS['run']['lean'] * 0.5, swing * 5.0, swing * 1.5), head=(-3.0, -swing * 3.0, 0), pelvis=pel)
    if clip == 'fire':
        return fire_pose(hero, weapon_id, cls, index, frames)
    if clip in ('pump', 'spin-up', 'vent', 'charge', 'discharge', 'thrust', 'sweep'):
        return weapon_extra_pose(hero, weapon_id, cls, clip, index, frames)
    if clip == 'reload':
        return reload_pose(hero, weapon_id, cls, index, frames)
    if clip in ('equip', 'draw'):
        # Equip: pull from the back / hip and settle into aim. Draw: the fast
        # 4-frame swap (6 ticks).
        s = smooth(t)
        lift = keys(t, [(0, 0.0), (0.4, 0.10), (1, 0.0)])
        grip_off = Vector((0.10 * (1 - s), 0.26 * (1 - s), -0.30 * (1 - s) + lift))
        return upper_spec(hero, weapon_id, grip_offset=grip_off, pitch=-55 * (1 - s), roll=-30 * (1 - s),
                          chest=(keys(t, [(0, 6), (0.5, -3), (1, 0)]), 8 * (1 - s), 0), head=(0, -6 * (1 - s), 0),
                          support=s > 0.55)
    if clip == 'dash':
        return dash_upper(hero, weapon_id, cls, index)
    if clip == 'grenade':
        return grenade_pose(hero, weapon_id, cls, index)
    if clip == 'knife':
        return knife_pose(hero, weapon_id, cls, index)
    if clip in ('heavy-hit-front', 'heavy-hit-back'):
        front = clip.endswith('front')
        k = keys(t, [(0, 0.0), (0.25, 1.0), (1.0, 0.25)])
        sign = 1 if front else -1
        return upper_spec(hero, weapon_id, grip_offset=Vector((0.0, 0.06 * k * sign, 0.05 * k)), pitch=18 * k * sign,
                          chest=(-14 * k * sign, 6 * k, 4 * k), spine=(-6 * k * sign, 0, 0), head=(-18 * k * sign, 8 * k, 0),
                          pelvis={'offset': (0.0, 0.03 * k * sign, -0.03 - 0.03 * k), 'rot': (0, 0, 0)})
    raise KeyError(f'unknown upper clip {clip}')


def fire_pose(hero, weapon_id, cls, index, frames):
    # Recoil kick on frame 0, recovery over the rest.
    t = index / max(1, frames - 1)
    kick = {'pistol': (0.05, 9.0), 'rifle': (0.06, 6.0), 'heavy': (0.025, 2.5), 'launcher': (0.08, 10.0),
            'flamethrower': (0.012, 1.0), 'standard': (0.0, 0.0)}[cls]
    if weapon_id == 'launcher-rig':
        k = keys(t, [(0, 1.0), (0.25, 0.8), (0.6, 0.25), (1, 0.0)])
    elif cls in ('flamethrower',) or weapon_id == 'lightning-ledger':
        k = 0.5 + 0.5 * math.sin(TAU * index / frames)
    elif weapon_id == 'auto-miner':
        k = [1.0, 0.7, 0.45, 0.25][min(3, index)]
    else:
        k = [1.0, 0.55, 0.22, 0.0, 0.0, 0.0, 0.0, 0.0][min(7, index)]
    back, climb = kick
    shake = math.sin(index * 2.3) * 0.004 if cls in ('heavy', 'flamethrower') else 0.0
    return upper_spec(hero, weapon_id, grip_offset=Vector((shake, back * k, back * 0.35 * k)), pitch=climb * k,
                      chest=(-climb * 0.35 * k, 0, 0), head=(-climb * 0.2 * k, 0, 0))


def weapon_extra_pose(hero, weapon_id, cls, clip, index, frames):
    t = index / max(1, frames - 1)
    if clip == 'pump':
        # Shotgun: support hand racks the pump back and forward.
        pump = math.sin(math.pi * t)
        spec = upper_spec(hero, weapon_id, pitch=2.0 * pump, chest=(0, 2 * pump, 0))
        grip = spec['grip']
        f = grip.to_3x3() @ Vector((1, 0, 0))
        spec['hands']['L'] = hero.support_hand(Matrix.Translation(-f * 0.10 * pump) @ grip, weapon_id)
        spec['pump'] = -0.10 * pump
        return spec
    if clip == 'spin-up':
        return upper_spec(hero, weapon_id, grip_offset=Vector((0, 0.01 * t, 0)), chest=(-2 * t, 0, 0))
    if clip == 'vent':
        # Overheated: the muzzle dips, the off hand waves the heat off.
        dip = keys(t, [(0, 0), (0.25, 1), (0.75, 1), (1, 0)])
        wave = math.sin(TAU * t * 2)
        spec = upper_spec(hero, weapon_id, grip_offset=Vector((0.03 * dip, 0.05 * dip, -0.06 * dip)), pitch=-22 * dip,
                          chest=(6 * dip, 4 * dip, 0), head=(12 * dip, -10 * dip, 0), support=False)
        spec['hands']['L'] = hero.left_hand_at(Vector((0.02 + 0.06 * wave, -0.34, 1.18 + 0.03 * wave)), Vector((0, 0.3, -1)), Vector((-0.5, -1, 0.3)), curl=0.2)
        return spec
    if clip == 'charge':
        # Hash Rail charge loop: braced, a slow breathing tremor.
        tremor = math.sin(TAU * index / frames) * 0.004
        return upper_spec(hero, weapon_id, grip_offset=Vector((tremor, 0.012, tremor)), pitch=1.0, chest=(3.0, -2.0, 0), spine=(2.0, 0, 0))
    if clip == 'discharge':
        k = keys(t, [(0, 1.0), (0.3, 0.7), (1.0, 0.0)])
        return upper_spec(hero, weapon_id, grip_offset=Vector((0, 0.09 * k, 0.03 * k)), pitch=10 * k, chest=(-8 * k, 0, 0), head=(-5 * k, 0, 0),
                          pelvis={'offset': (0.0, 0.03 * k, -0.03 - 0.02 * k), 'rot': (0, 0, 0)})
    if clip == 'thrust':
        # War Fork thrust: strike on frames 0-3, recover after.
        k = keys(t, [(0, 0.2), (0.3, 1.0), (0.45, 1.0), (1.0, 0.0)])
        return upper_spec(hero, weapon_id, grip_offset=Vector((0.06 * k, -0.34 * k, 0.10 * k)), pitch=-6 * k,
                          chest=(10 * k, 18 * k, 0), spine=(4 * k, 6 * k, 0), head=(0, -14 * k, 0))
    if clip == 'sweep':
        a = keys(t, [(0, -1.0), (0.35, 1.0), (1.0, 0.0)])
        return upper_spec(hero, weapon_id, grip_offset=Vector((-0.10 * a, -0.14 * abs(a), 0.06)), yaw=-38 * a, pitch=-4,
                          chest=(6, -24 * a + 10, 0), spine=(2, -10 * a, 0), head=(0, 12 * a, 0))
    raise KeyError(clip)


def reload_pose(hero, weapon_id, cls, index, frames):
    """16 frames driven by reload progress (frame = floor(progress x 16))."""
    t = index / max(1, frames - 1)
    tilt = keys(t, [(0, 0), (0.15, 1), (0.85, 1), (1, 0)])
    if cls == 'pistol':
        # Mag drop, pouch reach, seat, slide.
        grip_off = Vector((0.08 * tilt, 0.16 * tilt, -0.10 * tilt))
        spec = upper_spec(hero, weapon_id, grip_offset=grip_off, pitch=28 * tilt, roll=-20 * tilt, chest=(8 * tilt, 6 * tilt, 0), head=(18 * tilt, -6 * tilt, 0))
        grip = spec['grip']
        well = grip @ Vector((-0.01, 0.0, -0.10))
        pouch = Vector((0.18, -0.02, 1.02))
        hand = keys(t, [(0.0, Vector((0.10, -0.22, 1.30))), (0.25, pouch), (0.40, pouch), (0.62, well), (0.78, well), (0.90, grip @ Vector((0.02, 0.04, 0.10))), (1.0, Vector((0.10, -0.22, 1.30)))])
        spec['hands']['L'] = hero.left_hand_at(hand, Vector((0, 0.2, 1)), Vector((-0.4, -1, 0.3)), curl=0.8)
        spec['magazine'] = t
        return spec
    if weapon_id == 'scatter-shotgun':
        # Two shells into the tube, then rack.
        spec = upper_spec(hero, weapon_id, grip_offset=Vector((0.04 * tilt, 0.08 * tilt, -0.06 * tilt)), pitch=-6 * tilt, roll=-35 * tilt,
                          chest=(8 * tilt, 4 * tilt, 0), head=(16 * tilt, -4 * tilt, 0), support=False)
        grip = spec['grip']
        port = grip @ Vector((0.18, 0.0, -0.02))
        belt = Vector((0.14, -0.10, 1.10))
        hand = keys(t, [(0, grip @ Vector((0.30, 0, -0.035))), (0.14, belt), (0.26, port), (0.36, belt), (0.50, port), (0.62, belt), (0.72, grip @ Vector((0.30, 0, -0.035))),
                        (0.84, grip @ Vector((0.20, 0, -0.035))), (1.0, grip @ Vector((0.30, 0, -0.035)))])
        spec['hands']['L'] = hero.left_hand_at(hand, Vector((0, 0.2, 1)), Vector((-0.5, -1, 0.2)), curl=0.7)
        return spec
    if cls in ('rifle', 'launcher', 'heavy', 'flamethrower'):
        # Swap the cell / box / cylinder / tank: muzzle tips up, the support
        # hand strips the old one, fetches a new one from the belt, seats it.
        up = {'rifle': 22, 'launcher': 30, 'heavy': 8, 'flamethrower': -10}[cls]
        spec = upper_spec(hero, weapon_id, grip_offset=Vector((0.05 * tilt, 0.08 * tilt, 0.02 * tilt)), pitch=up * tilt, roll=-18 * tilt,
                          chest=(6 * tilt, 6 * tilt, 0), head=(14 * tilt, -8 * tilt, 0), support=False)
        grip = spec['grip']
        well = grip @ Vector({'rifle': (0.08, 0.0, -0.08), 'launcher': (0.16, 0.0, 0.0), 'heavy': (0.02, 0.06, -0.10), 'flamethrower': (-0.05, 0.12, -0.06)}[cls])
        start = hero.support_hand(grip, weapon_id)['matrix'] @ Vector((0, 0.055, 0.0))
        belt = Vector((0.20, -0.06, 1.04)) if cls != 'flamethrower' else Vector((0.12, 0.18, 1.30))
        hand = keys(t, [(0, start), (0.18, well), (0.30, well + Vector((0.05, 0.05, -0.10))), (0.45, belt), (0.55, belt), (0.72, well), (0.86, well), (1.0, start)])
        spec['hands']['L'] = hero.left_hand_at(hand, Vector((0, 0.2, 1)), Vector((-0.4, -1, 0.2)), curl=0.75)
        return spec
    # War Fork has no reload; reuse aim.
    return upper_spec(hero, weapon_id)


def dash_upper(hero, weapon_id, cls, index):
    """12 frames: tucked for the 8 active ticks, then 4 recovery frames that
    twist back to the aim."""
    if index < 8:
        dz, dy, lean = DASH_PELVIS[index]
        tuck = keys(index / 7, [(0, 0.5), (0.3, 1.0), (0.8, 1.0), (1.0, 0.7)])
        pel = {'offset': (0.0, dy, dz), 'rot': (lean * 0.4, 0.0, 0.0)}
    else:
        r = (index - 8) / 3
        tuck = keys(r, [(0, 0.55), (1, 0.0)])
        pel = {'offset': (0.0, 0.0, -0.07 + 0.04 * r), 'rot': (0, 0, 0)}
    return upper_spec(hero, weapon_id, grip_offset=Vector((0.10 * tuck, 0.20 * tuck, -0.14 * tuck)), pitch=-28 * tuck, roll=-10 * tuck,
                      chest=(28 * tuck, 14 * tuck, 0), spine=(12 * tuck, 0, 0), head=(-10 * tuck, -12 * tuck, 0), pelvis=pel, clav=(8 * tuck, -8 * tuck))


def grenade_pose(hero, weapon_id, cls, index):
    """12 frames over 24 ticks, released on frame 3. Two-hand weapons drop the
    support grip on frame 0 and re-grip on frame 10."""
    wind = [0.5, 0.9, 1.0, 0.2, -0.4, -0.7, -0.6, -0.45, -0.3, -0.18, -0.08, 0.0][index]
    back = max(0.0, wind)
    follow = max(0.0, -wind)
    hand = Vector((0.26 + 0.06 * back - 0.14 * follow, 0.20 * back - 0.38 * follow, 1.48 + 0.24 * back - 0.08 * follow))
    fingers = Vector((0.1, -0.3 - follow, 0.9 * back - 0.4 * follow))
    left = hero.left_hand_at(hand, Vector((-0.3, -0.8 * back + 0.4 * follow, 0.2)), fingers, curl=0.8 if index < 3 else 0.1)
    spec = upper_spec(hero, weapon_id, grip_offset=Vector((0.03 * back, 0.05 * back, -0.05 * (back + follow))), pitch=-10 * (back + follow),
                      chest=(-4 * back + 10 * follow, 18 * back - 16 * follow, 0), spine=(0, 6 * back - 6 * follow, 0),
                      head=(0, -10 * back + 8 * follow, 0), left=left if (index < 10 or cls == 'pistol') else None,
                      support=index >= 10)
    if index < 3:
        spec['props']['grenade_prop'] = hero.grenade_in(left['matrix'])
    return spec


def knife_pose(hero, weapon_id, cls, index):
    """6 frames over 8 ticks: a reverse-grip offhand slash with the Pistol, a
    stock-bash with two-hand weapons, none with the War Fork."""
    a = [0.0, 0.6, 1.0, 0.7, 0.35, 0.1][index]
    if cls == 'pistol':
        swing = keys(index / 5, [(0, -1.0), (0.2, -1.0), (0.5, 0.8), (1.0, 0.3)])
        hand = Vector((0.12 - 0.34 * swing, -0.36 - 0.10 * (1 - abs(swing)), 1.36 - 0.04 * swing))
        left = hero.left_hand_at(hand, Vector((-0.2, 0.3, -1)), Vector((-0.3, -1, 0.1)), curl=1.0)
        spec = upper_spec(hero, weapon_id, grip_offset=Vector((0.02, 0.06 * a, 0)), chest=(6 * a, -22 * swing, 0), spine=(0, -8 * swing, 0),
                          head=(0, 8 * swing, 0), left=left)
        spec['props']['knife_prop'] = hero.knife_reverse(left['matrix'])
        return spec
    if cls == 'standard':
        return upper_spec(hero, weapon_id)
    # Stock bash: the whole weapon punches forward and across.
    return upper_spec(hero, weapon_id, grip_offset=Vector((0.10 * a, -0.18 * a, 0.08 * a)), pitch=-20 * a, yaw=28 * a,
                      chest=(8 * a, 22 * a, 0), spine=(2 * a, 8 * a, 0), head=(0, -12 * a, 0))


# --------------------------------------------------------------------------
# Full-body clips: death and interactions (package 7.7, 7.8)
# --------------------------------------------------------------------------

def death_pose(hero: Hero, clip: str, index: int, frames: int) -> dict:
    """death-back (hit from the front, falls backward) and death-front.
    16 frames over 60 ticks, then hold on the last frame."""
    t = index / max(1, frames - 1)
    back = clip == 'death-back'
    s = 1 if back else -1
    # Stagger (0-0.3), knees buckle (0.3-0.55), fall (0.55-0.85), settle.
    fall = keys(t, [(0, 0.0), (0.3, 0.08), (0.55, 0.3), (0.82, 1.0), (0.9, 0.96), (1.0, 1.0)])
    buckle = keys(t, [(0, 0.0), (0.3, 0.25), (0.55, 1.0), (0.82, 0.6), (1.0, 0.5)])
    stagger = keys(t, [(0, 0.0), (0.18, 1.0), (0.4, 0.6), (1.0, 0.0)])
    pelvis_pitch = -86 * fall * s
    height = hero.hip['L'].z
    drop = -(height - 0.16) * fall - 0.18 * buckle * (1 - fall)
    travel = (0.12 * stagger + 0.58 * fall) * s  # + is backward (+Y)
    spec = {'pelvis': {'offset': (0.0, travel, drop), 'rot': (pelvis_pitch * 0.9, 6 * fall, -4 * fall * s)},
            'fk': {'spine': (-10 * stagger * s + 6 * fall * s, 0, 0), 'chest': (-14 * stagger * s + 10 * fall * s, 8 * fall, 0),
                   'head': (-20 * stagger * s + 24 * fall * s * (1 if not back else -0.4), -20 * fall, 0)},
            'armFk': {'L': {'upper_arm.L': (-60 * fall * s, 0, 40 * fall), 'forearm.L': (-30 * fall, 0, 0)},
                      'R': {'upper_arm.R': (-70 * fall * s, 0, -50 * fall), 'forearm.R': (-40 * fall, 0, 0)}},
            'legFk': {'L': {'thigh.L': (-35 * buckle * s * (1 if back else -0.5) - 20 * fall, 0, 0), 'shin.L': (60 * buckle, 0, 0)},
                      'R': {'thigh.R': (-15 * buckle - 60 * fall * (1 if back else 0.2), 0, 0), 'shin.R': (40 * buckle + 20 * fall, 0, 0)}},
            'props': {'pistol_prop': None, 'release_grip': None, 'grenade_prop': None, 'knife_prop': None}}
    return spec


INTERACTION_FRAMES = {'interact-press': 12, 'interact-lever': 20, 'interact-crank': 20, 'interact-kneel': 20}


def interaction_pose(hero: Hero, clip: str, index: int) -> dict:
    """Weapon stowed, full body, authored side-on (the exporter renders the
    east and west facings). Each returns the hand contact as `handTarget`."""
    feet = hero.stance_feet('staggered')
    base = {'pelvis': {'offset': (0.0, 0.0, -0.04), 'rot': (0, 0, 0)}, 'feet': feet,
            'fk': {'spine': (4, 0, 0), 'chest': (6, 0, 0), 'head': (10, 0, 0)},
            'hands': {}, 'props': {'pistol_prop': None, 'release_grip': None, 'grenade_prop': None, 'knife_prop': None}}
    if clip == 'interact-press':
        # reach 4; press loop 4 while progress < 1; release 4.
        reach = keys(index / 11, [(0, 0.0), (3 / 11, 1.0), (7 / 11, 1.0), (1, 0.0)])
        press = math.sin(math.pi * ((index - 4) / 4)) if 4 <= index < 8 else 0.0
        button = Vector((-0.18, -0.36, 1.32))
        hand = Vector((-0.24, -0.20, 1.10)).lerp(button + Vector((0, 0.03 - 0.03 * press, 0)), reach)
        base['hands']['R'] = hero.right_hand_at(hand, Vector((0, -1, 0.1)), Vector((0.1, -0.2, 1)), curl=0.3)
        base['hands']['L'] = hero.left_hand_at(Vector((0.22, -0.10, 1.05)), Vector((-1, 0, 0)), Vector((0, -0.2, -1)), curl=0.5)
        base['fk']['chest'] = (6 + 8 * reach, 4 * reach, 0)
        base['handTarget'] = button
        return base
    if clip == 'interact-lever':
        # grab 4; strain loop 6; heave 6; release 4.
        handle = Vector((-0.10, -0.34, 1.36))
        if index < 4:
            g = index / 3
            pos = Vector((-0.20, -0.20, 1.12)).lerp(handle, smooth(g))
            lean = 4 * g
        elif index < 10:
            k = math.sin(TAU * (index - 4) / 6)
            pos = handle + Vector((0, 0.01 * k, -0.01 * k))
            lean = -6 - 3 * k
        elif index < 16:
            h = (index - 10) / 5
            pos = handle + Vector((0, 0.08 * smooth(h), -0.32 * smooth(h)))
            lean = keys(h, [(0, -8), (0.5, 10), (1, 14)])
        else:
            r = (index - 16) / 3
            pos = (handle + Vector((0, 0.08, -0.32))).lerp(Vector((-0.20, -0.20, 1.12)), smooth(r))
            lean = 14 * (1 - r)
        base['hands']['R'] = hero.right_hand_at(pos, Vector((0, -0.2, 1)), Vector((0.8, -0.5, 0)), curl=1.0)
        base['hands']['L'] = hero.left_hand_at(pos + Vector((0.10, 0.01, 0.0)), Vector((0, -0.2, 1)), Vector((-0.8, -0.5, 0)), curl=1.0)
        base['fk']['chest'] = (lean, 0, 0)
        base['fk']['spine'] = (lean * 0.5, 0, 0)
        base['pelvis']['offset'] = (0.0, 0.02 - 0.004 * lean, -0.05 - 0.003 * abs(lean))
        base['handTarget'] = handle
        return base
    if clip == 'interact-crank':
        # enter 4; hand-over-hand loop 12 (one whole turn); exit 4.
        centre = Vector((-0.10, -0.30, 1.30))
        radius = 0.11
        if index < 4:
            angle, grab = 0.0, index / 3
        elif index < 16:
            angle, grab = TAU * (index - 4) / 12, 1.0
        else:
            angle, grab = TAU, 1.0 - (index - 16) / 3
        def rim(a):
            return centre + Vector((math.cos(a) * radius, 0.0, math.sin(a) * radius))
        rest_r, rest_l = Vector((-0.22, -0.20, 1.10)), Vector((0.22, -0.18, 1.10))
        # A winch handle turned with both hands on the one grip.
        pr = rest_r.lerp(rim(angle), smooth(grab))
        pl = rest_l.lerp(rim(angle) + Vector((0.09, 0.0, 0.0)), smooth(grab))
        base['hands']['R'] = hero.right_hand_at(pr, Vector((0, -0.3, -1)), Vector((0.9, -0.3, 0)), curl=1.0)
        base['hands']['L'] = hero.left_hand_at(pl, Vector((0, -0.3, -1)), Vector((-0.9, -0.3, 0)), curl=1.0)
        twist = math.sin(angle) * 6 * grab
        base['fk']['chest'] = (14 * grab, twist, 0)
        base['fk']['spine'] = (6 * grab, twist * 0.5, 0)
        base['handTarget'] = centre
        return base
    if clip == 'interact-kneel':
        # kneel 6; work loop 8; stand 6. Right knee down, hands low in front.
        if index < 6:
            k = smooth(index / 5)
        elif index < 14:
            k = 1.0
        else:
            k = 1.0 - smooth((index - 14) / 5)
        work = math.sin(TAU * (index - 6) / 8) if 6 <= index < 14 else 0.0
        hip_drop = -0.50 * k
        l = hero.foot('L', Vector((hero.hip['L'].x, hero.hip['L'].y - 0.34 * k - 0.05, 0.0)), yaw=6)
        knee = Vector((hero.hip['R'].x + 0.02, hero.hip['R'].y + 0.10 * k, 0.0))
        r = hero.foot('R', Vector((knee.x, knee.y + 0.42 * k, 0.12 * k)), pitch=-70 * k, pole=Vector((knee.x, knee.y - 1.0, 0.0)), toe=40 * k)
        work_pt = Vector((-0.08, -0.34, 0.62)) + Vector((0.03 * work, 0.0, 0.02 * abs(work)))
        hand_r = Vector((-0.22, -0.18, 1.08 + hip_drop)).lerp(work_pt + Vector((-0.06, 0, 0)), k)
        hand_l = Vector((0.22, -0.18, 1.08 + hip_drop)).lerp(work_pt + Vector((0.07, 0.02, 0.02)), k)
        base['pelvis'] = {'offset': (0.0, 0.08 * k, hip_drop), 'rot': (8 * k, 0, 0)}
        base['feet'] = {'L': l, 'R': r}
        base['fk'] = {'spine': (16 * k, 0, 0), 'chest': (18 * k + 3 * work, 0, 0), 'head': (22 * k, 0, 0)}
        base['hands']['R'] = hero.right_hand_at(hand_r, Vector((0, 0, -1)), Vector((0.2, -1, -0.4)), curl=0.9)
        base['hands']['L'] = hero.left_hand_at(hand_l, Vector((0, 0, -1)), Vector((-0.2, -1, -0.4)), curl=0.9)
        base["handTarget"] = Vector((-0.08, -0.34, 0.62))
        return base
    raise KeyError(clip)
