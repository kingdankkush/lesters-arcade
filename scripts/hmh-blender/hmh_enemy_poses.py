"""Authored enemy roster poses, Blender-free (Cycle 074, E-3).

Every visual state the runtime can select (idle, run, tell, attack, hit, death)
is authored here as bone rotations (degrees, Blender XYZ euler in the bone's
local rest frame) and bone locations (bone-local units). The exporter applies
the result to `rig.pose.bones`; nothing here imports Blender, so the tell contract
runs on the Vercel build image the way the reproducibility helpers do.

Rig facts this table relies on (measured from the shipped .blend):

- pelvis / chest / head point straight up, so their local X is world X,
  local Y is world Z (up) and local Z is world -Y, which is the direction the
  actor faces. A pelvis `location[1]` therefore lifts or drops the body and
  `location[2]` moves it toward or away from the target.
- upper arms hang down and outward. Negative local X swings the arm forward
  and across the chest (the Cycle 073 tell), positive X swings it back and up.
  Local Z abducts the arm out to the side: negative for the left arm, positive
  for the right. The Cycle 073 wind-up used X only, which folded both arms in
  front of the torso and made "tell" the narrowest frame in every atlas; the
  anticipation here spreads the arms so the silhouette grows before the strike.
- thighs: negative local X steps the leg forward, positive back; shins bend
  with positive X.
- prop_socket points forward from the chest; positive X tips the muzzle up.

Projection-only. Collision, damage, AI, spawning and results come from
`enemy-archetypes.mjs` and never from these numbers.
"""
from __future__ import annotations

import math

ANIMATION_PROFILES = frozenset({
    "shared-roster-v1",
    "forkrunner-quick-fork-slash-v1",
    "gas-bomber-canister-lob-v1",
    "undead-straight-lunge-v1",
    "undead-shoulder-charge-v1",
    "suppression-rifle-burst-v1",
    "validator-staff-channel-v1",
})

DAMAGE_RESPONSES = frozenset({
    "shared-impact-v1",
    "snapback-stumble-v1",
    "crossed-fork-guard-break-v1",
    "rifle-shoulder-recoil-v1",
    "armored-shoulder-absorb-v1",
    "canister-protective-stagger-v1",
    "staff-braced-shock-v1",
})

VISUAL_STATES = ("idle", "run", "tell", "attack", "hit", "death")

# The boss renders three phase silhouettes into one 2 MiB atlas that sits at
# 96.6 percent of its cap, so its tell and attack beats are damped. Attack
# frames are never selected for the boss at runtime (main.mjs picks idle /
# tell / hit / death), so they are damped harder than the tell that players see.
BOSS_TELL_AMPLITUDE = 0.62
BOSS_ATTACK_AMPLITUDE = 0.5

# Rest skeleton in armature space: head, tail, local axes (columns x, y, z),
# parent. Measured with `pose_bone.bone.matrix_local` on the shipped rig.
BONE_REST = {
    "pelvis": ((0.0, 0.0, 0.86), (0.0, 0.0, 1.02), ((1, 0, 0), (0, 0, 1), (0, -1, 0)), None),
    "chest": ((0.0, 0.0, 1.02), (0.0, 0.0, 1.42), ((1, 0, 0), (0, 0, 1), (0, -1, 0)), "pelvis"),
    "head": ((0.0, 0.0, 1.42), (0.0, 0.0, 1.70), ((1, 0, 0), (0, 0, 1), (0, -1, 0)), "chest"),
    "upper_arm.L": ((0.20, 0.0, 1.34), (0.40, 0.0, 1.12), ((0.548, -0.673, 0.498), (0.673, 0.0, -0.74), (0.498, 0.74, 0.452)), "chest"),
    "forearm.L": ((0.40, 0.0, 1.12), (0.54, 0.0, 0.92), ((0.671, -0.573, 0.47), (0.573, 0.0, -0.819), (0.47, 0.819, 0.329)), "upper_arm.L"),
    "upper_arm.R": ((-0.20, 0.0, 1.34), (-0.40, 0.0, 1.12), ((0.548, 0.673, -0.498), (-0.673, 0.0, -0.74), (-0.498, 0.74, 0.452)), "chest"),
    "forearm.R": ((-0.40, 0.0, 1.12), (-0.54, 0.0, 0.92), ((0.671, 0.573, -0.47), (-0.573, 0.0, -0.819), (-0.47, 0.819, 0.329)), "upper_arm.R"),
    "thigh.L": ((0.11, 0.0, 0.86), (0.13, 0.0, 0.46), ((0.998, -0.05, 0.05), (0.05, 0.0, -0.999), (0.05, 0.999, 0.002)), "pelvis"),
    "shin.L": ((0.13, 0.0, 0.46), (0.13, 0.0, 0.06), ((1, 0, 0), (0, 0, -1), (0, 1, 0)), "thigh.L"),
    "thigh.R": ((-0.11, 0.0, 0.86), (-0.13, 0.0, 0.46), ((0.998, 0.05, -0.05), (-0.05, 0.0, -0.999), (-0.05, 0.999, 0.002)), "pelvis"),
    "shin.R": ((-0.13, 0.0, 0.46), (-0.13, 0.0, 0.06), ((1, 0, 0), (0, 0, -1), (0, 1, 0)), "thigh.R"),
    "prop_socket": ((0.0, -0.16, 1.30), (0.0, -0.34, 1.30), ((-1, 0, 0), (0, -1, 0), (0, 0, 1)), "chest"),
}
BONE_ORDER = tuple(BONE_REST)

# Points that widen a role's silhouette beyond the joints: the staff (along the
# left forearm) and the rifle (on the prop socket), in rest armature space.
SILHOUETTE_EXTRAS = {
    "validator-staff-channel-v1": (("forearm.L", (0.42, -0.10, 0.73)), ("forearm.L", (0.42, -0.10, 1.66))),
    "suppression-rifle-burst-v1": (("prop_socket", (0.16, -0.62, 1.22)), ("prop_socket", (0.16, -0.02, 1.22))),
}

# Camera basis for a south-facing frame: the roster camera sits at
# (0, -3.05, 3.91) pitched 55 degrees, so screen right is world X and screen up
# is 0.574 * Y + 0.819 * Z.
SCREEN_UP = (0.0, math.cos(math.radians(55.0)), math.sin(math.radians(55.0)))


class _Pose:
    """Accumulates one frame. Angles in degrees, locations in bone-local units."""

    def __init__(self, stoop: float):
        # Every actor carries its authored stoop so zombies read hunched and
        # survivors read upright even in the neutral pose.
        self.rot = {"chest": [10.0 * stoop, 0.0, 0.0], "head": [6.0 * stoop, 0.0, 0.0]}
        self.loc: dict[str, list[float]] = {}

    def _bone(self, name: str) -> list[float]:
        return self.rot.setdefault(name, [0.0, 0.0, 0.0])

    def set(self, name: str, x=None, y=None, z=None) -> None:
        bone = self._bone(name)
        if x is not None:
            bone[0] = float(x)
        if y is not None:
            bone[1] = float(y)
        if z is not None:
            bone[2] = float(z)

    def add(self, name: str, x=0.0, y=0.0, z=0.0) -> None:
        bone = self._bone(name)
        bone[0] += float(x)
        bone[1] += float(y)
        bone[2] += float(z)

    def torso(self, pitch=0.0, yaw=0.0, roll=0.0) -> None:
        """Chest on top of the stoop: pitch > 0 leans toward the target."""
        self.add("chest", pitch, yaw, roll)

    def head(self, pitch=0.0, yaw=0.0, roll=0.0) -> None:
        self.add("head", pitch, yaw, roll)

    def arm(self, side: str, swing: float, spread: float = 0.0, twist: float = 0.0) -> None:
        """swing < 0 reaches forward, > 0 draws back and up; spread > 0 abducts."""
        self.set(f"upper_arm.{side}", x=swing, y=twist, z=(-spread if side == "L" else spread))

    def forearm(self, side: str, bend: float) -> None:
        self.set(f"forearm.{side}", x=bend)

    def legs(self, left: float, right: float, shin_left: float = 0.0, shin_right: float = 0.0) -> None:
        """< 0 steps the leg toward the target."""
        self.set("thigh.L", x=left)
        self.set("thigh.R", x=right)
        if shin_left:
            self.set("shin.L", x=shin_left)
        if shin_right:
            self.set("shin.R", x=shin_right)

    def pelvis(self, lift: float = 0.0, forward: float = 0.0) -> None:
        """lift < 0 sinks the body; forward > 0 drives it toward the target."""
        self.loc["pelvis"] = [0.0, float(lift), float(forward)]

    def muzzle(self, tip: float) -> None:
        self.set("prop_socket", x=tip)

    def out(self) -> dict:
        return {
            "rotations": {name: [float(v) for v in values] for name, values in self.rot.items()},
            "locations": {name: [float(v) for v in values] for name, values in self.loc.items()},
        }


# ---------------------------------------------------------------------------
# Shared beats: idle, run, hit, death. Ported verbatim from the Cycle 073
# exporter so only the tell and attack beats change on the re-render.
# ---------------------------------------------------------------------------

def _idle(p: _Pose, frame_index: int) -> None:
    breath = 0.012 if frame_index % 2 == 0 else -0.008
    p.loc["pelvis"] = [0.0, 0.0, breath]
    p.add("chest", 1.6 if frame_index % 2 == 0 else -1.2)
    p.set("upper_arm.L", x=-8)
    p.set("upper_arm.R", x=-8)


def _run(p: _Pose, frame_index: int, frame_count: int) -> None:
    phase = (2.0 * math.pi * frame_index) / max(frame_count, 1)
    stride = math.sin(phase)
    lift_left = max(0.0, math.sin(phase + math.pi / 2))
    lift_right = max(0.0, math.sin(phase - math.pi / 2))
    p.loc["pelvis"] = [0.0, 0.0, 0.045 * abs(math.sin(phase))]
    p.add("chest", 8)
    p.set("thigh.L", x=38 * stride)
    p.set("thigh.R", x=-38 * stride)
    p.set("shin.L", x=-46 * lift_left)
    p.set("shin.R", x=-46 * lift_right)
    p.set("upper_arm.L", x=-30 * stride)
    p.set("upper_arm.R", x=30 * stride)


def _hit(p: _Pose, damage_kind: str, frame_index: int) -> None:
    sign = -1 if frame_index == 0 else 1
    if damage_kind == "snapback-stumble-v1":
        p.set("chest", x=-24, y=16 * sign, z=-22 * sign)
        p.set("head", x=-30, z=28 * sign)
        p.set("upper_arm.L", x=34, y=-42 * sign)
        p.set("upper_arm.R", x=28, y=38 * sign)
        p.loc["pelvis"] = [0.0, 0.09, -0.025 if frame_index == 1 else 0.015]
    elif damage_kind == "crossed-fork-guard-break-v1":
        p.set("chest", x=-12, z=34 * sign)
        p.set("head", z=-24 * sign)
        p.set("upper_arm.L", x=-82, z=-48 * sign)
        p.set("forearm.L", x=-58)
        p.set("upper_arm.R", x=-76, z=44 * sign)
        p.set("forearm.R", x=-62)
        p.loc["pelvis"] = [0.0, 0.045, -0.035]
    elif damage_kind == "rifle-shoulder-recoil-v1":
        p.set("chest", x=-10, y=28 * sign, z=-14 * sign)
        p.set("head", y=-18 * sign)
        p.set("upper_arm.L", x=-64)
        p.set("upper_arm.R", x=-52)
        p.set("forearm.L", x=-58)
        p.set("forearm.R", x=-72)
        p.set("prop_socket", x=18 * sign)
        p.loc["pelvis"] = [0.0, 0.035, 0.0]
    elif damage_kind == "armored-shoulder-absorb-v1":
        p.set("chest", x=18, y=-12 * sign, z=14 * sign)
        p.set("head", y=10 * sign)
        p.set("upper_arm.L", x=-26, y=-48 * sign)
        p.set("upper_arm.R", x=-16, y=30 * sign)
        p.set("thigh.L", x=14)
        p.set("thigh.R", x=-12)
        p.loc["pelvis"] = [0.0, 0.025, -0.065]
    elif damage_kind == "canister-protective-stagger-v1":
        p.set("chest", x=-18, z=30 * sign)
        p.set("head", x=-12, z=-18 * sign)
        p.set("upper_arm.L", x=-58, z=-32 * sign)
        p.set("forearm.L", x=-76)
        p.set("upper_arm.R", x=-92, z=38 * sign)
        p.set("forearm.R", x=-52)
        p.loc["pelvis"] = [0.0, 0.055, -0.025]
    elif damage_kind == "staff-braced-shock-v1":
        p.set("chest", x=-14, y=18 * sign, z=-28 * sign)
        p.set("head", x=-16, z=22 * sign)
        p.set("upper_arm.L", x=-122, y=-20 * sign)
        p.set("forearm.L", x=-34)
        p.set("upper_arm.R", x=-52, y=42 * sign)
        p.set("forearm.R", x=-44)
        p.loc["pelvis"] = [0.0, 0.04, 0.0]
    else:
        p.set("chest", y=18 * sign, z=-20 * sign)
        p.set("head", z=24 * sign)
        p.set("upper_arm.L", y=-30 * sign)
        p.set("upper_arm.R", y=26 * sign)
        p.loc["pelvis"] = [0.0, 0.04, 0.0]


def _death(p: _Pose, frame_index: int, frame_count: int) -> None:
    # Collapse over four frames: buckle, fold, drop, settle.
    progress = frame_index / max(frame_count - 1, 1)
    p.add("chest", 78 * progress)
    p.add("head", 40 * progress)
    p.loc["pelvis"] = [0.0, 0.0, -0.42 * progress]
    p.set("pelvis", x=56 * progress)
    p.set("thigh.L", x=-52 * progress)
    p.set("thigh.R", x=-38 * progress)
    p.set("shin.L", x=64 * progress)
    p.set("shin.R", x=48 * progress)
    p.set("upper_arm.L", x=-64 * progress)
    p.set("upper_arm.R", x=-58 * progress)


# ---------------------------------------------------------------------------
# Tell and attack beats per role profile. Each beat is (state, frame_index) ->
# a function of (pose, amplitude). Frame roles are fixed by the runtime clamp
# in enemy-roster-atlas.mjs: tell 0 = anticipation, tell 1 = held maximum for
# the rest of the tell window; attack 0 = overshoot for the front of the
# six-tick strike, attack 1 = follow-through, attack 2 = the exposed recovery
# held until the enemy is ready again.
# ---------------------------------------------------------------------------

def _shared_tell(p: _Pose, f: int, a: float) -> None:
    # Two-arm overhead smash: rear back with both arms drawn back, up and out
    # to the sides so the silhouette grows before the strike. The held frame
    # coils harder (torso, elbows, a twist through the upper arms) without the
    # hands crossing above the head, which is what narrowed the Cycle 073 tell.
    if f == 0:
        p.torso(pitch=-20 * a); p.head(pitch=12 * a)
        p.arm("L", 42 * a, 50 * a); p.arm("R", 42 * a, 50 * a)
        p.forearm("L", -34 * a); p.forearm("R", -34 * a)
        p.legs(-8 * a, 10 * a); p.pelvis(lift=-0.03 * a, forward=-0.04 * a)
    else:
        p.torso(pitch=-28 * a); p.head(pitch=18 * a)
        p.arm("L", 54 * a, 44 * a, 12 * a); p.arm("R", 54 * a, 44 * a, -12 * a)
        p.forearm("L", -56 * a); p.forearm("R", -56 * a)
        p.legs(-10 * a, 14 * a); p.pelvis(lift=-0.05 * a, forward=-0.06 * a)

def _shared_attack(p: _Pose, f: int, a: float) -> None:
    if f == 0:
        p.torso(pitch=46 * a); p.head(pitch=8 * a)
        p.arm("L", -50 * a, 62 * a); p.arm("R", -50 * a, 62 * a)
        p.forearm("L", -18 * a); p.forearm("R", -18 * a)
        p.legs(-26 * a, 16 * a, shin_left=18 * a); p.pelvis(lift=-0.13 * a, forward=0.15 * a)
    elif f == 1:
        p.torso(pitch=34 * a); p.head(pitch=10 * a)
        p.arm("L", -38 * a, 46 * a); p.arm("R", -38 * a, 46 * a)
        p.forearm("L", -32 * a); p.forearm("R", -32 * a)
        p.legs(-16 * a, 10 * a, shin_left=10 * a); p.pelvis(lift=-0.09 * a, forward=0.10 * a)
    else:
        p.torso(pitch=14 * a); p.head(pitch=22 * a)
        p.arm("L", -8 * a, 14 * a); p.arm("R", -8 * a, 14 * a)
        p.forearm("L", -62 * a); p.forearm("R", -62 * a)
        p.legs(-6 * a, 6 * a); p.pelvis(lift=-0.06 * a, forward=0.03 * a)


def _lunge_tell(p: _Pose, f: int, a: float) -> None:
    # Bagholder rusher: a bear pounce. Rears back with the eyes locked on the
    # target, claws drawn back, up and wide, knees loaded. Frame 1 is the held
    # maximum: deeper rear-back, elbows cocked, shoulders twisted open.
    if f == 0:
        p.torso(pitch=-16 * a); p.head(pitch=10 * a)
        p.arm("L", 36 * a, 56 * a); p.arm("R", 36 * a, 56 * a)
        p.forearm("L", -32 * a); p.forearm("R", -32 * a)
        p.legs(-8 * a, 12 * a); p.pelvis(lift=-0.03 * a, forward=-0.05 * a)
    else:
        p.torso(pitch=-40 * a); p.head(pitch=30 * a)
        p.arm("L", 52 * a, 40 * a, 12 * a); p.arm("R", 52 * a, 40 * a, -12 * a)
        p.forearm("L", -40 * a); p.forearm("R", -40 * a)
        p.legs(-12 * a, 18 * a); p.pelvis(lift=-0.06 * a, forward=-0.08 * a)

def _lunge_attack(p: _Pose, f: int, a: float) -> None:
    if f == 0:
        # Overshoot: full-body dive, both claws reaching straight for the target.
        p.torso(pitch=52 * a); p.head(pitch=10 * a)
        p.arm("L", -52 * a, 70 * a); p.arm("R", -52 * a, 70 * a)
        p.forearm("L", -16 * a); p.forearm("R", -16 * a)
        p.legs(-30 * a, 18 * a, shin_left=22 * a); p.pelvis(lift=-0.15 * a, forward=0.17 * a)
    elif f == 1:
        p.torso(pitch=38 * a); p.head(pitch=12 * a)
        p.arm("L", -42 * a, 52 * a); p.arm("R", -42 * a, 52 * a)
        p.forearm("L", -34 * a); p.forearm("R", -34 * a)
        p.legs(-18 * a, 12 * a, shin_left=12 * a); p.pelvis(lift=-0.10 * a, forward=0.11 * a)
    else:
        # Exposed: head hangs, arms dangle in front, body sunk after the miss.
        p.torso(pitch=14 * a); p.head(pitch=26 * a)
        p.arm("L", -8 * a, 12 * a); p.arm("R", -8 * a, 12 * a)
        p.forearm("L", -66 * a); p.forearm("R", -66 * a)
        p.legs(-6 * a, 6 * a); p.pelvis(lift=-0.07 * a, forward=0.03 * a)


def _charge_tell(p: _Pose, f: int, a: float) -> None:
    # Whale enforcer: shoulder charge. Coils with the lead shoulder dropped and
    # both fists drawn back and wide; the head stays on the player. The torso
    # yaw is kept modest because a twisted torso folds the arms out of the
    # camera plane and shrinks the silhouette the tell is meant to grow.
    if f == 0:
        p.torso(pitch=8 * a, yaw=-12 * a, roll=8 * a); p.head(pitch=4 * a, yaw=10 * a)
        p.arm("L", 34 * a, 44 * a); p.arm("R", 48 * a, 40 * a)
        p.forearm("L", -50 * a); p.forearm("R", -42 * a)
        p.legs(12 * a, -10 * a); p.pelvis(lift=-0.05 * a, forward=-0.06 * a)
    else:
        p.torso(pitch=12 * a, yaw=-12 * a, roll=12 * a); p.head(pitch=6 * a, yaw=14 * a)
        p.arm("L", 48 * a, 36 * a, 10 * a); p.arm("R", 58 * a, 44 * a, -10 * a)
        p.forearm("L", -60 * a); p.forearm("R", -52 * a)
        p.legs(16 * a, -14 * a); p.pelvis(lift=-0.08 * a, forward=-0.09 * a)

def _charge_attack(p: _Pose, f: int, a: float) -> None:
    if f == 0:
        p.torso(pitch=46 * a, yaw=18 * a, roll=-10 * a); p.head(pitch=8 * a, yaw=-6 * a)
        p.arm("L", -42 * a, 34 * a); p.arm("R", 58 * a, 34 * a)
        p.forearm("L", -20 * a); p.forearm("R", -40 * a)
        p.legs(-30 * a, 22 * a, shin_left=24 * a); p.pelvis(lift=-0.16 * a, forward=0.18 * a)
    elif f == 1:
        p.torso(pitch=34 * a, yaw=8 * a, roll=-4 * a); p.head(pitch=10 * a, yaw=-2 * a)
        p.arm("L", -30 * a, 24 * a); p.arm("R", 38 * a, 24 * a)
        p.forearm("L", -30 * a); p.forearm("R", -36 * a)
        p.legs(-18 * a, 12 * a, shin_left=12 * a); p.pelvis(lift=-0.11 * a, forward=0.11 * a)
    else:
        # Over-committed: staggered forward, head down, arms hanging wide.
        p.torso(pitch=18 * a, yaw=-6 * a, roll=2 * a); p.head(pitch=22 * a)
        p.arm("L", -6 * a, 24 * a); p.arm("R", -6 * a, 24 * a)
        p.forearm("L", -56 * a); p.forearm("R", -56 * a)
        p.legs(-8 * a, 8 * a); p.pelvis(lift=-0.07 * a, forward=0.04 * a)


def _rifle_tell(p: _Pose, f: int, a: float) -> None:
    # Liquidator agent: shoulders the rifle. Both hands stay on the weapon, so
    # this tell grows UP rather than out: the fore-grip arm extends along the
    # barrel, the stock elbow flares high, the lead foot plants and the muzzle
    # lifts onto the target. The held frame raises the muzzle further.
    if f == 0:
        p.torso(pitch=-4 * a, yaw=-6 * a); p.head(pitch=6 * a, yaw=4 * a)
        p.arm("L", -64 * a, 18 * a); p.arm("R", -30 * a, 50 * a)
        p.forearm("L", -52 * a); p.forearm("R", -86 * a)
        p.muzzle(8 * a)
        p.legs(-12 * a, 6 * a); p.pelvis(lift=-0.02 * a, forward=0.04 * a)
    else:
        p.torso(pitch=-8 * a, yaw=-10 * a); p.head(pitch=10 * a, yaw=8 * a)
        p.arm("L", -76 * a, 24 * a, -10 * a); p.arm("R", -38 * a, 66 * a, 12 * a)
        p.forearm("L", -60 * a); p.forearm("R", -98 * a)
        p.muzzle(16 * a)
        p.legs(-16 * a, 8 * a); p.pelvis(lift=-0.035 * a, forward=0.06 * a)

def _rifle_attack(p: _Pose, f: int, a: float) -> None:
    if f == 0:
        # Burst: the body rocks back and the muzzle kicks up.
        p.torso(pitch=-20 * a, yaw=-6 * a); p.head(pitch=-8 * a, yaw=4 * a)
        p.arm("L", -58 * a, 26 * a); p.arm("R", -30 * a, 50 * a)
        p.forearm("L", -54 * a); p.forearm("R", -80 * a)
        p.muzzle(28 * a)
        p.legs(-10 * a, 10 * a); p.pelvis(lift=-0.02 * a, forward=-0.07 * a)
    elif f == 1:
        p.torso(pitch=-10 * a, yaw=-4 * a); p.head(pitch=-3 * a, yaw=2 * a)
        p.arm("L", -66 * a, 24 * a); p.arm("R", -32 * a, 46 * a)
        p.forearm("L", -60 * a); p.forearm("R", -84 * a)
        p.muzzle(14 * a)
        p.legs(-12 * a, 8 * a); p.pelvis(lift=-0.02 * a, forward=-0.02 * a)
    else:
        # Exposed: rifle lowered to the hip, head down on the weapon.
        p.torso(pitch=12 * a); p.head(pitch=20 * a)
        p.arm("L", -40 * a, 14 * a); p.arm("R", -20 * a, 20 * a)
        p.forearm("L", -50 * a); p.forearm("R", -58 * a)
        p.muzzle(-30 * a)
        p.legs(-6 * a, 6 * a); p.pelvis(lift=-0.06 * a, forward=0.02 * a)


def _fork_tell(p: _Pose, f: int, a: float) -> None:
    # Forkrunner: a low coiled crouch with both forks out to the sides, the
    # rear fork cocked back and high, the lead fork low and forward-out, torso
    # rolled so both blades show against the sky.
    if f == 0:
        p.torso(pitch=-10 * a, roll=-14 * a); p.head(pitch=6 * a, roll=10 * a)
        p.arm("L", 32 * a, 46 * a); p.arm("R", -4 * a, 34 * a)
        p.forearm("L", -44 * a); p.forearm("R", -50 * a)
        p.legs(14 * a, -12 * a); p.pelvis(lift=-0.07 * a, forward=-0.04 * a)
    else:
        p.torso(pitch=-14 * a, roll=-22 * a); p.head(pitch=8 * a, roll=14 * a)
        p.arm("L", 44 * a, 48 * a, 12 * a); p.arm("R", 12 * a, 30 * a, -8 * a)
        p.forearm("L", -54 * a); p.forearm("R", -60 * a)
        p.legs(18 * a, -16 * a); p.pelvis(lift=-0.10 * a, forward=-0.06 * a)

def _fork_attack(p: _Pose, f: int, a: float) -> None:
    if f == 0:
        # Crossing slash: both forks whipped across the body toward the target.
        p.torso(pitch=32 * a, roll=30 * a); p.head(pitch=8 * a, roll=-18 * a)
        p.arm("L", -48 * a, 10 * a); p.arm("R", -52 * a, 30 * a)
        p.forearm("L", -28 * a); p.forearm("R", -34 * a)
        p.legs(-26 * a, 16 * a, shin_left=18 * a); p.pelvis(lift=-0.11 * a, forward=0.15 * a)
    elif f == 1:
        # Follow-through flings both arms wide the other way.
        p.torso(pitch=22 * a, roll=-18 * a); p.head(pitch=8 * a, roll=10 * a)
        p.arm("L", 26 * a, 62 * a); p.arm("R", -18 * a, 68 * a)
        p.forearm("L", -40 * a); p.forearm("R", -40 * a)
        p.legs(-14 * a, 10 * a, shin_left=8 * a); p.pelvis(lift=-0.07 * a, forward=0.09 * a)
    else:
        p.torso(pitch=14 * a, roll=-8 * a); p.head(pitch=22 * a, roll=4 * a)
        p.arm("L", -10 * a, 28 * a); p.arm("R", -10 * a, 28 * a)
        p.forearm("L", -50 * a); p.forearm("R", -50 * a)
        p.legs(-10 * a, 10 * a); p.pelvis(lift=-0.08 * a, forward=0.03 * a)


def _lob_tell(p: _Pose, f: int, a: float) -> None:
    # Gas bomber: the canister arm cocks far behind the head while the free arm
    # points forward-and-out at the landing spot; the torso twists away from
    # the throw just enough to read without folding the arms out of plane.
    if f == 0:
        p.torso(pitch=-18 * a, yaw=10 * a, roll=8 * a); p.head(pitch=-6 * a, yaw=-8 * a)
        p.arm("R", 88 * a, 30 * a); p.forearm("R", -64 * a)
        p.arm("L", 2 * a, 30 * a); p.forearm("L", -14 * a)
        p.legs(-10 * a, 14 * a); p.pelvis(lift=-0.04 * a, forward=-0.06 * a)
    else:
        p.torso(pitch=-26 * a, yaw=14 * a, roll=12 * a); p.head(pitch=-8 * a, yaw=-12 * a)
        p.arm("R", 98 * a, 38 * a, -12 * a); p.forearm("R", -74 * a)
        p.arm("L", 10 * a, 38 * a, 10 * a); p.forearm("L", -18 * a)
        p.legs(-14 * a, 18 * a); p.pelvis(lift=-0.06 * a, forward=-0.09 * a)

def _lob_attack(p: _Pose, f: int, a: float) -> None:
    if f == 0:
        # Release: the throwing arm whips forward-down, the free arm swings back.
        p.torso(pitch=40 * a, yaw=-22 * a, roll=-12 * a); p.head(pitch=10 * a, yaw=6 * a)
        p.arm("R", -56 * a, 44 * a); p.forearm("R", -10 * a)
        p.arm("L", 40 * a, 56 * a); p.forearm("L", -30 * a)
        p.legs(-26 * a, 16 * a, shin_left=16 * a); p.pelvis(lift=-0.12 * a, forward=0.16 * a)
    elif f == 1:
        p.torso(pitch=28 * a, yaw=-12 * a, roll=-6 * a); p.head(pitch=10 * a)
        p.arm("R", -36 * a, 32 * a); p.forearm("R", -26 * a)
        p.arm("L", 20 * a, 42 * a); p.forearm("L", -36 * a)
        p.legs(-14 * a, 10 * a, shin_left=8 * a); p.pelvis(lift=-0.08 * a, forward=0.10 * a)
    else:
        p.torso(pitch=16 * a, yaw=-4 * a); p.head(pitch=24 * a)
        p.arm("R", -8 * a, 20 * a); p.forearm("R", -60 * a)
        p.arm("L", -10 * a, 18 * a); p.forearm("L", -60 * a)
        p.legs(-6 * a, 6 * a); p.pelvis(lift=-0.07 * a, forward=0.03 * a)


def _staff_tell(p: _Pose, f: int, a: float) -> None:
    # Validator cultist: channels with the staff arm raised high and out and
    # the free arm flung wide, rising onto the toes.
    if f == 0:
        p.torso(pitch=-16 * a); p.head(pitch=-10 * a)
        p.arm("L", 54 * a, 38 * a); p.forearm("L", -26 * a)
        p.arm("R", 22 * a, 40 * a); p.forearm("R", -34 * a)
        p.legs(-8 * a, 8 * a); p.pelvis(lift=0.02 * a, forward=-0.03 * a)
    else:
        p.torso(pitch=-22 * a); p.head(pitch=-14 * a)
        p.arm("L", 70 * a, 40 * a, 12 * a); p.forearm("L", -34 * a)
        p.arm("R", 38 * a, 42 * a, -10 * a); p.forearm("R", -44 * a)
        p.legs(-10 * a, 10 * a); p.pelvis(lift=0.035 * a, forward=-0.04 * a)

def _staff_attack(p: _Pose, f: int, a: float) -> None:
    if f == 0:
        # Slam: the staff and both hands drive forward and down.
        p.torso(pitch=34 * a); p.head(pitch=12 * a)
        p.arm("L", -42 * a, 22 * a); p.forearm("L", -12 * a)
        p.arm("R", -32 * a, 34 * a); p.forearm("R", -22 * a)
        p.legs(-18 * a, 12 * a, shin_left=12 * a); p.pelvis(lift=-0.10 * a, forward=0.14 * a)
    elif f == 1:
        p.torso(pitch=24 * a); p.head(pitch=8 * a)
        p.arm("L", -56 * a, 26 * a); p.forearm("L", -20 * a)
        p.arm("R", -22 * a, 42 * a); p.forearm("R", -30 * a)
        p.legs(-10 * a, 8 * a, shin_left=6 * a); p.pelvis(lift=-0.06 * a, forward=0.08 * a)
    else:
        # Drained: leaning on the planted staff, head dropped, free arm hanging.
        p.torso(pitch=18 * a, roll=6 * a); p.head(pitch=26 * a)
        p.arm("L", -30 * a, 16 * a); p.forearm("L", -42 * a)
        p.arm("R", -6 * a, 22 * a); p.forearm("R", -56 * a)
        p.legs(-6 * a, 6 * a); p.pelvis(lift=-0.08 * a, forward=0.02 * a)


SHARED_BEATS = {"tell": _shared_tell, "attack": _shared_attack}
LUNGE_BEATS = {"tell": _lunge_tell, "attack": _lunge_attack}
CHARGE_BEATS = {"tell": _charge_tell, "attack": _charge_attack}
RIFLE_BEATS = {"tell": _rifle_tell, "attack": _rifle_attack}
FORK_BEATS = {"tell": _fork_tell, "attack": _fork_attack}
LOB_BEATS = {"tell": _lob_tell, "attack": _lob_attack}
STAFF_BEATS = {"tell": _staff_tell, "attack": _staff_attack}

BEATS_BY_PROFILE = {
    "shared-roster-v1": SHARED_BEATS,
    "undead-straight-lunge-v1": LUNGE_BEATS,
    "undead-shoulder-charge-v1": CHARGE_BEATS,
    "suppression-rifle-burst-v1": RIFLE_BEATS,
    "forkrunner-quick-fork-slash-v1": FORK_BEATS,
    "gas-bomber-canister-lob-v1": LOB_BEATS,
    "validator-staff-channel-v1": STAFF_BEATS,
}


def role_pose(kind: str, damage_kind: str, state: str, frame_index: int, frame_count: int, stoop: float,
              boss: bool = False, beats: dict | None = None) -> dict:
    """One authored frame as {"rotations": {bone: [x, y, z] degrees}, "locations": {bone: [x, y, z]}}.

    `beats` lets the exporter's fail-closed per-profile dispatch hand in the
    table it selected; when omitted the table is looked up here.
    """
    if kind not in ANIMATION_PROFILES:
        raise RuntimeError(f"Unknown enemy animation profile: {kind}")
    if damage_kind not in DAMAGE_RESPONSES:
        raise RuntimeError(f"Unknown enemy damage response: {damage_kind}")
    if state not in VISUAL_STATES:
        raise RuntimeError(f"Unknown enemy visual state: {state}")
    table = beats if beats is not None else BEATS_BY_PROFILE[kind]
    p = _Pose(stoop)
    if state == "idle":
        _idle(p, frame_index)
    elif state == "run":
        _run(p, frame_index, frame_count)
    elif state == "tell":
        table["tell"](p, frame_index, BOSS_TELL_AMPLITUDE if boss else 1.0)
    elif state == "attack":
        table["attack"](p, frame_index, BOSS_ATTACK_AMPLITUDE if boss else 1.0)
    elif state == "hit":
        _hit(p, damage_kind, frame_index)
    else:
        _death(p, frame_index, frame_count)
    return p.out()


# ---------------------------------------------------------------------------
# Silhouette projection: a small forward-kinematics pass over the rest
# skeleton so the "tell widens" contract is measurable without Blender.
# ---------------------------------------------------------------------------

def _rot_xyz(rx: float, ry: float, rz: float):
    """Blender XYZ euler as a 3x3 matrix (X applied first)."""
    cx, sx = math.cos(math.radians(rx)), math.sin(math.radians(rx))
    cy, sy = math.cos(math.radians(ry)), math.sin(math.radians(ry))
    cz, sz = math.cos(math.radians(rz)), math.sin(math.radians(rz))
    mx = ((1, 0, 0), (0, cx, -sx), (0, sx, cx))
    my = ((cy, 0, sy), (0, 1, 0), (-sy, 0, cy))
    mz = ((cz, -sz, 0), (sz, cz, 0), (0, 0, 1))
    return _mm(mz, _mm(my, mx))


def _mm(a, b):
    return tuple(tuple(sum(a[i][k] * b[k][j] for k in range(3)) for j in range(3)) for i in range(3))


def _mv(m, v):
    return tuple(sum(m[i][k] * v[k] for k in range(3)) for i in range(3))


def _transpose(m):
    return tuple(tuple(m[j][i] for j in range(3)) for i in range(3))


def _axes_matrix(axes):
    x, y, z = axes
    return tuple((x[i], y[i], z[i]) for i in range(3))


def _identity():
    return ((1, 0, 0), (0, 1, 0), (0, 0, 1))


def pose_joint_positions(pose: dict, extras=()) -> dict:
    """Posed armature-space positions of every bone tail plus extra points."""
    rotations = pose.get("rotations", {})
    locations = pose.get("locations", {})
    transforms = {None: (_identity(), (0.0, 0.0, 0.0))}
    points = {}
    for name in BONE_ORDER:
        head, tail, axes, parent = BONE_REST[name]
        m = _axes_matrix(axes)
        r = _rot_xyz(*rotations.get(name, (0.0, 0.0, 0.0)))
        w = _mm(_mm(m, r), _transpose(m))
        offset = _mv(m, tuple(locations.get(name, (0.0, 0.0, 0.0))))
        pa, pc = transforms[parent]
        # D(p) = head + offset + W (p - head); P = P_parent o D.
        a = _mm(pa, w)
        c = tuple(pc[i] + sum(pa[i][k] * (head[k] + offset[k] - _mv(w, head)[k]) for k in range(3)) for i in range(3))
        transforms[name] = (a, c)
        points[name] = tuple(c[i] + sum(a[i][k] * tail[k] for k in range(3)) for i in range(3))
    for index, (bone, point) in enumerate(extras):
        a, c = transforms[bone]
        points[f"extra{index}"] = tuple(c[i] + sum(a[i][k] * point[k] for k in range(3)) for i in range(3))
    return points


def pose_screen_extent(pose: dict, kind: str) -> dict:
    """Approximate silhouette extent of a south-facing frame in armature units.

    Joints only (limb thickness is a constant the comparison cancels), so this
    is for relative claims such as "the tell is wider than idle".
    """
    points = pose_joint_positions(pose, SILHOUETTE_EXTRAS.get(kind, ()))
    rights = [p[0] for p in points.values()]
    ups = [sum(p[i] * SCREEN_UP[i] for i in range(3)) for p in points.values()]
    hands = (points["forearm.L"], points["forearm.R"])
    return {
        "width": max(rights) - min(rights),
        "height": max(ups) - min(ups),
        "handSpan": abs(hands[0][0] - hands[1][0]),
    }
