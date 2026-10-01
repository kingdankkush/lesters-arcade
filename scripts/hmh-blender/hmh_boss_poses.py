"""Authored boss action poses for the three district bosses (2.0 slice HMH-BOSSES-2-4).

Same vocabulary as `hmh_enemy_poses.py` (degrees in the shared rest skeleton's
bone-local XYZ frames, bone-local locations), extended with the boss-only
states the GLB exporter samples: a second attack variant, a super tell, the
super itself and a stagger. Idle, run, hit and death reuse the roster beats.

Everything here is projection-only. Telegraph timings, damage, phases and drops
live in the deterministic boss modules under apps/hmh-reboot/src/.
"""
from __future__ import annotations

import math

from hmh_enemy_poses import _Pose, _idle, _run, _hit, _death

BOSS_IDS = ("boss-rug-pull-baron", "boss-51-foreman", "boss-lockkeeper")

# Frames sampled per clip (idle/run loop; the rest hold their last frame).
BOSS_CLIP_FRAMES = {
    "idle": 2, "run": 24, "tell": 2, "attack": 3, "attack-2": 3,
    "super-tell": 3, "super": 4, "hit": 2, "stagger": 3, "death": 4,
}
BOSS_LOOP_CLIPS = frozenset({"idle", "run"})
BOSS_STATES = tuple(BOSS_CLIP_FRAMES)

# Damage responses from the roster table that best fit each boss body.
BOSS_DAMAGE_RESPONSE = {
    "boss-rug-pull-baron": "snapback-stumble-v1",
    "boss-51-foreman": "armored-shoulder-absorb-v1",
    "boss-lockkeeper": "staff-braced-shock-v1",
}
BOSS_STOOP = {"boss-rug-pull-baron": 0.0, "boss-51-foreman": 0.12, "boss-lockkeeper": 0.3}


# ---------------------------------------------------------------------------
# Rug Pull Baron: a showman. Cane thrust (attack), whip crack (attack-2), the
# Marquee Collapse super (both arms thrown up at the rigging, then a stamp).
# ---------------------------------------------------------------------------

def _baron_tell(p, f):
    # Rears back on the cane, free arm sweeping wide like a ringmaster's bow.
    if f == 0:
        p.torso(pitch=-14, yaw=10); p.head(pitch=6, yaw=-8)
        p.arm("R", 30, 38); p.forearm("R", -50)
        p.arm("L", -10, 62); p.forearm("L", -20)
        p.legs(10, -12); p.pelvis(lift=-0.03, forward=-0.05)
    else:
        p.torso(pitch=-22, yaw=16); p.head(pitch=10, yaw=-12)
        p.arm("R", 52, 40, -10); p.forearm("R", -70)
        p.arm("L", -4, 78, 10); p.forearm("L", -10)
        p.legs(14, -16); p.pelvis(lift=-0.05, forward=-0.08)


def _baron_attack(p, f):
    # Cane thrust: a long lunge straight at the target.
    if f == 0:
        p.torso(pitch=38, yaw=-14); p.head(pitch=4, yaw=8)
        p.arm("R", -78, 12); p.forearm("R", -6)
        p.arm("L", 40, 50); p.forearm("L", -30)
        p.legs(-34, 22, shin_left=26); p.pelvis(lift=-0.14, forward=0.20)
    elif f == 1:
        p.torso(pitch=28, yaw=-8); p.head(pitch=6, yaw=4)
        p.arm("R", -66, 14); p.forearm("R", -16)
        p.arm("L", 26, 42); p.forearm("L", -36)
        p.legs(-22, 14, shin_left=14); p.pelvis(lift=-0.10, forward=0.12)
    else:
        p.torso(pitch=12); p.head(pitch=18)
        p.arm("R", -30, 16); p.forearm("R", -50)
        p.arm("L", -6, 20); p.forearm("L", -58)
        p.legs(-8, 8); p.pelvis(lift=-0.06, forward=0.03)


def _baron_attack_2(p, f):
    # Whip crack: the left arm circles overhead and snaps down across the floor.
    if f == 0:
        p.torso(pitch=-10, yaw=-18, roll=-10); p.head(pitch=-6, yaw=10)
        p.arm("L", 96, 42, 14); p.forearm("L", -40)
        p.arm("R", -12, 34); p.forearm("R", -46)
        p.legs(12, -10); p.pelvis(lift=-0.04, forward=-0.05)
    elif f == 1:
        p.torso(pitch=34, yaw=20, roll=12); p.head(pitch=10, yaw=-6)
        p.arm("L", -70, 30); p.forearm("L", -8)
        p.arm("R", 20, 40); p.forearm("R", -40)
        p.legs(-26, 16, shin_left=16); p.pelvis(lift=-0.12, forward=0.14)
    else:
        p.torso(pitch=16, yaw=6); p.head(pitch=16)
        p.arm("L", -24, 24); p.forearm("L", -46)
        p.arm("R", -8, 22); p.forearm("R", -56)
        p.legs(-10, 8); p.pelvis(lift=-0.07, forward=0.04)


def _baron_super_tell(p, f):
    # Marquee Collapse: both arms rise to the rigging, weight sinking.
    t = f / 2
    p.torso(pitch=-16 - 10 * t); p.head(pitch=-18 - 8 * t)
    p.arm("L", 60 + 40 * t, 56, 8); p.forearm("L", -20 - 10 * t)
    p.arm("R", 60 + 40 * t, 56, -8); p.forearm("R", -20 - 10 * t)
    p.legs(-8, 8); p.pelvis(lift=-0.02 - 0.05 * t, forward=-0.03)


def _baron_super(p, f):
    # The pull: arms yank down, a stamp, then a bow while the canvas falls.
    if f == 0:
        p.torso(pitch=36); p.head(pitch=12)
        p.arm("L", -40, 20); p.forearm("L", -70)
        p.arm("R", -40, 20); p.forearm("R", -70)
        p.legs(-30, 18, shin_left=20); p.pelvis(lift=-0.16, forward=0.12)
    elif f == 1:
        p.torso(pitch=26); p.head(pitch=8)
        p.arm("L", -28, 30); p.forearm("L", -60)
        p.arm("R", -28, 30); p.forearm("R", -60)
        p.legs(-18, 10, shin_left=8); p.pelvis(lift=-0.10, forward=0.08)
    elif f == 2:
        p.torso(pitch=44, yaw=8); p.head(pitch=26)
        p.arm("L", 20, 64); p.forearm("L", -20)
        p.arm("R", -34, 12); p.forearm("R", -40)
        p.legs(-6, 6); p.pelvis(lift=-0.08, forward=0.02)
    else:
        p.torso(pitch=10); p.head(pitch=14)
        p.arm("L", -8, 24); p.forearm("L", -54)
        p.arm("R", -8, 24); p.forearm("R", -54)
        p.legs(-4, 4); p.pelvis(lift=-0.05, forward=0.0)


# ---------------------------------------------------------------------------
# 51% Foreman: hammer slam (attack), hash-cannon burst from the left forearm
# minigun (attack-2), the Machinery Cycle super (hammer to the ground, then the
# yard's presses fire).
# ---------------------------------------------------------------------------

def _foreman_tell(p, f):
    if f == 0:
        p.torso(pitch=-18, roll=-6); p.head(pitch=10)
        p.arm("R", 70, 44, -12); p.forearm("R", -46)
        p.arm("L", 24, 40); p.forearm("L", -40)
        p.legs(-8, 12); p.pelvis(lift=-0.05, forward=-0.06)
    else:
        p.torso(pitch=-28, roll=-10); p.head(pitch=16)
        p.arm("R", 96, 40, -18); p.forearm("R", -60)
        p.arm("L", 34, 46, 8); p.forearm("L", -50)
        p.legs(-12, 16); p.pelvis(lift=-0.09, forward=-0.09)


def _foreman_attack(p, f):
    # Overhead hammer slam: full-body drive, both hands on the haft.
    if f == 0:
        p.torso(pitch=52, roll=6); p.head(pitch=6)
        p.arm("R", -60, 18); p.forearm("R", -10)
        p.arm("L", -50, 30); p.forearm("L", -30)
        p.legs(-30, 20, shin_left=24); p.pelvis(lift=-0.18, forward=0.16)
    elif f == 1:
        p.torso(pitch=40, roll=4); p.head(pitch=10)
        p.arm("R", -46, 20); p.forearm("R", -26)
        p.arm("L", -38, 32); p.forearm("L", -40)
        p.legs(-18, 12, shin_left=12); p.pelvis(lift=-0.12, forward=0.10)
    else:
        p.torso(pitch=16); p.head(pitch=22)
        p.arm("R", -20, 18); p.forearm("R", -60)
        p.arm("L", -10, 24); p.forearm("L", -60)
        p.legs(-8, 8); p.pelvis(lift=-0.08, forward=0.03)


def _foreman_attack_2(p, f):
    # Hash cannon: braces the left forearm gun at the hip and sweeps.
    if f == 0:
        p.torso(pitch=8, yaw=12); p.head(pitch=4, yaw=-10)
        p.arm("L", -54, 20); p.forearm("L", -40)
        p.arm("R", 18, 36); p.forearm("R", -56)
        p.legs(14, -12); p.pelvis(lift=-0.06, forward=-0.03)
    elif f == 1:
        p.torso(pitch=4, yaw=-14); p.head(pitch=2, yaw=8)
        p.arm("L", -62, 18); p.forearm("L", -36)
        p.arm("R", 14, 34); p.forearm("R", -52)
        p.legs(12, -12); p.pelvis(lift=-0.06, forward=-0.02)
    else:
        p.torso(pitch=12); p.head(pitch=16)
        p.arm("L", -30, 18); p.forearm("L", -52)
        p.arm("R", -6, 22); p.forearm("R", -56)
        p.legs(-6, 6); p.pelvis(lift=-0.07, forward=0.02)


def _foreman_super_tell(p, f):
    # Winds the hammer behind the back with both hands; the furnace vents.
    t = f / 2
    p.torso(pitch=-20 - 12 * t, roll=-12 * t); p.head(pitch=14 + 6 * t)
    p.arm("R", 88 + 20 * t, 30, -16); p.forearm("R", -50 - 16 * t)
    p.arm("L", 60 + 20 * t, 34, 12); p.forearm("L", -50 - 10 * t)
    p.legs(-14, 18); p.pelvis(lift=-0.08 - 0.06 * t, forward=-0.10)


def _foreman_super(p, f):
    # Ground slam held low, then a rising, exhausted recovery.
    if f == 0:
        p.torso(pitch=64); p.head(pitch=4)
        p.arm("R", -56, 10); p.forearm("R", -4)
        p.arm("L", -50, 16); p.forearm("L", -12)
        p.legs(-36, 26, shin_left=34); p.pelvis(lift=-0.30, forward=0.16)
    elif f == 1:
        p.torso(pitch=58); p.head(pitch=8)
        p.arm("R", -50, 12); p.forearm("R", -10)
        p.arm("L", -46, 18); p.forearm("L", -16)
        p.legs(-30, 22, shin_left=28); p.pelvis(lift=-0.26, forward=0.14)
    elif f == 2:
        p.torso(pitch=36); p.head(pitch=16)
        p.arm("R", -34, 16); p.forearm("R", -30)
        p.arm("L", -30, 20); p.forearm("L", -34)
        p.legs(-16, 12, shin_left=12); p.pelvis(lift=-0.14, forward=0.08)
    else:
        p.torso(pitch=14); p.head(pitch=24)
        p.arm("R", -12, 18); p.forearm("R", -56)
        p.arm("L", -10, 22); p.forearm("L", -58)
        p.legs(-6, 6); p.pelvis(lift=-0.08, forward=0.02)


# ---------------------------------------------------------------------------
# Lockkeeper: key sweep (attack), chain lash (attack-2), the Winch super (the
# shoulder drum cranked, dragging the gates and the hero's footing).
# ---------------------------------------------------------------------------

def _lockkeeper_tell(p, f):
    if f == 0:
        p.torso(pitch=-12, yaw=-16, roll=-8); p.head(pitch=8, yaw=12)
        p.arm("R", 48, 54, -10); p.forearm("R", -34)
        p.arm("L", 16, 40); p.forearm("L", -40)
        p.legs(12, -10); p.pelvis(lift=-0.05, forward=-0.05)
    else:
        p.torso(pitch=-18, yaw=-26, roll=-12); p.head(pitch=12, yaw=18)
        p.arm("R", 66, 58, -14); p.forearm("R", -46)
        p.arm("L", 24, 46, 8); p.forearm("L", -50)
        p.legs(16, -14); p.pelvis(lift=-0.08, forward=-0.08)


def _lockkeeper_attack(p, f):
    # Horizontal key sweep across the floor.
    if f == 0:
        p.torso(pitch=30, yaw=28, roll=12); p.head(pitch=6, yaw=-14)
        p.arm("R", -62, 62); p.forearm("R", -8)
        p.arm("L", 24, 44); p.forearm("L", -40)
        p.legs(-26, 18, shin_left=18); p.pelvis(lift=-0.12, forward=0.14)
    elif f == 1:
        p.torso(pitch=22, yaw=14, roll=6); p.head(pitch=8, yaw=-6)
        p.arm("R", -48, 50); p.forearm("R", -20)
        p.arm("L", 12, 36); p.forearm("L", -44)
        p.legs(-16, 12, shin_left=10); p.pelvis(lift=-0.09, forward=0.09)
    else:
        p.torso(pitch=14, roll=4); p.head(pitch=22)
        p.arm("R", -20, 22); p.forearm("R", -54)
        p.arm("L", -8, 24); p.forearm("L", -58)
        p.legs(-8, 8); p.pelvis(lift=-0.07, forward=0.03)


def _lockkeeper_attack_2(p, f):
    # Chain lash: the left arm whips the chest chains out and down.
    if f == 0:
        p.torso(pitch=-8, yaw=18, roll=8); p.head(pitch=-4, yaw=-10)
        p.arm("L", 90, 40, 12); p.forearm("L", -46)
        p.arm("R", -10, 30); p.forearm("R", -50)
        p.legs(10, -12); p.pelvis(lift=-0.04, forward=-0.05)
    elif f == 1:
        p.torso(pitch=32, yaw=-16, roll=-10); p.head(pitch=10, yaw=6)
        p.arm("L", -66, 28); p.forearm("L", -10)
        p.arm("R", 18, 40); p.forearm("R", -44)
        p.legs(-24, 14, shin_left=14); p.pelvis(lift=-0.11, forward=0.13)
    else:
        p.torso(pitch=14, yaw=-4); p.head(pitch=18)
        p.arm("L", -22, 24); p.forearm("L", -48)
        p.arm("R", -8, 22); p.forearm("R", -56)
        p.legs(-10, 8); p.pelvis(lift=-0.07, forward=0.04)


def _lockkeeper_super_tell(p, f):
    # Reaches up to the shoulder drum's crank with the left hand, braces low.
    t = f / 2
    p.torso(pitch=-6 - 8 * t, yaw=12 + 10 * t, roll=-8); p.head(pitch=-8, yaw=-10)
    p.arm("L", 100 + 16 * t, 20, 10); p.forearm("L", -90 - 10 * t)
    p.arm("R", 10, 46 + 10 * t); p.forearm("R", -30 - 10 * t)
    p.legs(-10 - 6 * t, 12 + 6 * t); p.pelvis(lift=-0.06 - 0.06 * t, forward=-0.04)


def _lockkeeper_super(p, f):
    # Four crank turns: the left forearm circles, the body rocks with each pull.
    angle = (f / 4) * 2 * math.pi
    p.torso(pitch=-4 + 10 * math.sin(angle), yaw=16, roll=-6); p.head(pitch=-4, yaw=-12)
    p.arm("L", 104 + 14 * math.cos(angle), 22 + 8 * math.sin(angle), 10); p.forearm("L", -84 + 24 * math.sin(angle))
    p.arm("R", 12, 48); p.forearm("R", -34)
    p.legs(-16, 18); p.pelvis(lift=-0.10 - 0.03 * math.sin(angle), forward=-0.04)


def _stagger(p, damage_kind, f):
    # Three-frame stagger: the hit reaction, then a deeper reel, then a heavy
    # knee-bent recovery before the boss stands again.
    _hit(p, damage_kind, min(f, 1))
    if f == 1:
        p.add("chest", -10); p.add("head", -8)
        p.loc["pelvis"] = [0.0, 0.10, -0.06]
    elif f == 2:
        p.rot["chest"] = [14.0, 0.0, 0.0]; p.rot["head"] = [20.0, 0.0, 0.0]
        p.set("upper_arm.L", x=-16, y=0, z=-30); p.set("upper_arm.R", x=-16, y=0, z=30)
        p.set("forearm.L", x=-50); p.set("forearm.R", x=-50)
        p.legs(-12, 14, shin_left=22, shin_right=20)
        p.loc["pelvis"] = [0.0, -0.12, 0.0]


BEATS = {
    "boss-rug-pull-baron": {"tell": _baron_tell, "attack": _baron_attack, "attack-2": _baron_attack_2, "super-tell": _baron_super_tell, "super": _baron_super},
    "boss-51-foreman": {"tell": _foreman_tell, "attack": _foreman_attack, "attack-2": _foreman_attack_2, "super-tell": _foreman_super_tell, "super": _foreman_super},
    "boss-lockkeeper": {"tell": _lockkeeper_tell, "attack": _lockkeeper_attack, "attack-2": _lockkeeper_attack_2, "super-tell": _lockkeeper_super_tell, "super": _lockkeeper_super},
}


def boss_pose(boss_id: str, state: str, frame_index: int, frame_count: int) -> dict:
    """One authored frame in the shared rest-skeleton frames (degrees / bone-local units)."""
    if boss_id not in BEATS:
        raise RuntimeError(f"Unknown boss: {boss_id}")
    if state not in BOSS_CLIP_FRAMES:
        raise RuntimeError(f"Unknown boss visual state: {state}")
    if not 0 <= frame_index < max(frame_count, 1):
        raise RuntimeError(f"frame {frame_index} outside {state}")
    p = _Pose(BOSS_STOOP[boss_id])
    damage = BOSS_DAMAGE_RESPONSE[boss_id]
    if state == "idle":
        _idle(p, frame_index)
    elif state == "run":
        _run(p, frame_index, frame_count)
    elif state == "hit":
        _hit(p, damage, frame_index)
    elif state == "stagger":
        _stagger(p, damage, frame_index)
    elif state == "death":
        _death(p, frame_index, frame_count)
    else:
        BEATS[boss_id][state](p, frame_index)
    pose = p.out()
    if state in BOSS_LOOP_CLIPS:
        # The measured rest skeleton keeps local Y up (hmh_native_roster_poses).
        pelvis = pose["locations"].get("pelvis", [0.0, 0.0, 0.0])
        pose["locations"]["pelvis"] = [pelvis[0], pelvis[2], 0.0]
    if state == "run":
        for side in ("L", "R"):
            rotation = pose["rotations"][f"shin.{side}"]
            rotation[0] = abs(rotation[0])
    return pose
