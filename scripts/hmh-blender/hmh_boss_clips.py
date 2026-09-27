"""Boss clip library for the dark district bosses (art wave 2b), Blender-free.

The shipped roster contract (six states x eight directions x three phases in
one page) cannot carry a boss's kit: LEVEL-1-DESIGN-PACKAGE 4.1 asks for a full
phase-1 clip set, reduced re-baked subsets for phases 2 and 3, and south-only
intro, transition and death clips. This module is that table for the 51%
Foreman (4.5) and the Lockkeeper (4.6), keyed by their v7 role ids, plus the
pose for every sampled frame.

Poses are authored as keyframed channel sets and eased between keys. Every
tell winds up past its held pose and settles back (a back-ease overshoot), so
the anticipation reads before the hold. Angles follow `hmh_enemy_poses`
conventions (degrees in the shipped semantic rest frames; the derivative
builder retargets them into the Tripo rig's own rest axes):

- torso / head pitch > 0 leans toward the target; yaw turns; roll tips.
- arm swing < 0 reaches forward, > 0 draws back and up; spread > 0 abducts.
- forearm bend < 0 flexes the elbow.
- thigh < 0 steps the leg toward the target; shin > 0 bends the knee.
- lift < 0 sinks the pelvis; fwd > 0 drives it toward the target.

Projection-only. Collision, damage, AI, spawning, RNG and results come from the
boss simulation modules and never from these numbers.
"""
from __future__ import annotations

import math

from hmh_enemy_poses import _Pose

CLIP_LIBRARY_VERSION = 1
DIRECTIONS_ALL = ("south", "south-east", "east", "north-east", "north", "north-west", "west", "south-west")
DIRECTIONS_SOUTH = ("south",)

# ---------------------------------------------------------------------------
# Easing and keyframes
# ---------------------------------------------------------------------------

def _smooth(t: float) -> float:
    return t * t * (3.0 - 2.0 * t)


def _out_back(t: float, s: float = 1.9) -> float:
    t -= 1.0
    return t * t * ((s + 1.0) * t + s) + 1.0


def _in_quad(t: float) -> float:
    return t * t


def _out_quad(t: float) -> float:
    return 1.0 - (1.0 - t) * (1.0 - t)


EASES = {"smooth": _smooth, "back": _out_back, "in": _in_quad, "out": _out_quad, "linear": lambda t: t}

CHANNELS = (
    "tp", "ty", "tr",            # torso pitch / yaw / roll
    "hp", "hy", "hr",            # head pitch / yaw / roll
    "las", "lsp", "ltw", "lfb",  # left arm swing / spread / twist, forearm bend
    "ras", "rsp", "rtw", "rfb",  # right arm
    "thl", "thr", "shl", "shr",  # thighs and shins
    "pp",                        # pelvis pitch (hips follow)
    "lift", "fwd",               # pelvis location
    "sock",                      # weapon socket tip
)


def keyed(t: float, keys) -> dict:
    """keys: [(time, {channel: value}, ease_into_this_key)], times ascending in [0, 1]."""
    if t <= keys[0][0]:
        return dict(keys[0][1])
    for (t0, a, _), (t1, b, ease) in zip(keys, keys[1:]):
        if t <= t1:
            u = 0.0 if t1 == t0 else (t - t0) / (t1 - t0)
            w = EASES[ease](u)
            names = set(a) | set(b)
            return {n: a.get(n, 0.0) + (b.get(n, 0.0) - a.get(n, 0.0)) * w for n in names}
    return dict(keys[-1][1])


def _merge(*parts: dict) -> dict:
    out: dict = {}
    for part in parts:
        for name, value in part.items():
            out[name] = out.get(name, 0.0) + value
    return out


def _to_pose(channels: dict, stoop: float) -> dict:
    p = _Pose(stoop)
    c = {name: float(channels.get(name, 0.0)) for name in CHANNELS}
    p.torso(c["tp"], c["ty"], c["tr"])
    p.head(c["hp"], c["hy"], c["hr"])
    p.arm("L", c["las"], c["lsp"], c["ltw"])
    p.arm("R", c["ras"], c["rsp"], c["rtw"])
    p.forearm("L", c["lfb"])
    p.forearm("R", c["rfb"])
    p.legs(c["thl"], c["thr"], c["shl"], c["shr"])
    if c["pp"]:
        p.set("pelvis", x=c["pp"])
    p.pelvis(lift=c["lift"], forward=c["fwd"])
    if c["sock"]:
        p.set("prop_socket", x=c["sock"])
    return p.out()


# ---------------------------------------------------------------------------
# Shared locomotion builders
# ---------------------------------------------------------------------------

def _breath(t: float, base: dict, amount: float = 1.0) -> dict:
    s = math.sin(2.0 * math.pi * t)
    return _merge(base, {"tp": 1.8 * s * amount, "hp": -1.2 * s * amount, "lift": 0.010 * s * amount,
                         "las": 2.0 * s * amount, "ras": 1.5 * s * amount})


def _stomp(t: float, base: dict, stride: float, bob: float, sway: float, arm_l: float, arm_r: float) -> dict:
    phase = 2.0 * math.pi * t
    s = math.sin(phase)
    lift_l = max(0.0, math.sin(phase + math.pi / 2))
    lift_r = max(0.0, math.sin(phase - math.pi / 2))
    # Heavy gait: the body drops on each foot strike (twice per cycle).
    drop = abs(math.cos(phase))
    return _merge(base, {
        "thl": stride * s, "thr": -stride * s,
        "shl": 1.15 * stride * lift_l, "shr": 1.15 * stride * lift_r,
        "tr": sway * s, "ty": 0.5 * sway * s, "hr": -0.6 * sway * s,
        "lift": -bob * drop, "fwd": 0.02,
        "las": -arm_l * s, "ras": arm_r * s,
    })


def _hit(t: float, base: dict, heavy: float) -> dict:
    return keyed(t, [
        (0.0, base, "smooth"),
        (0.35, _merge(base, {"tp": -16 * heavy, "hp": -20 * heavy, "tr": 8 * heavy, "las": 18 * heavy, "ras": 14 * heavy,
                             "lfb": -12, "rfb": -12, "lift": 0.03, "fwd": -0.05}), "out"),
        (1.0, _merge(base, {"tp": -5 * heavy, "hp": -6 * heavy, "fwd": -0.02}), "smooth"),
    ])


# ---------------------------------------------------------------------------
# The Lockkeeper (4.6): barrel-chested human, the windlass key in the right fist
# ---------------------------------------------------------------------------

LK_BASE = {"lsp": -18, "rsp": -14, "las": -6, "ras": -14, "rfb": -34, "lfb": -10}


def lk_idle(t):
    lean = 1.5 * math.sin(2 * math.pi * t)
    # The head turn runs a quarter cycle off the breath so no two samples repeat.
    return _merge(_breath(t, LK_BASE, 1.2), {"tr": lean, "hy": 6 * math.cos(2 * math.pi * t)})


def lk_walk(t):
    return _stomp(t, _merge(LK_BASE, {"tp": 6}), stride=26, bob=0.035, sway=6, arm_l=18, arm_r=6)


def lk_hit(t):
    return _hit(t, LK_BASE, 1.0)


def lk_halt(t):
    # Threshold halt: plants the key and heaves up, chest out, head back.
    return keyed(t, [
        (0.0, LK_BASE, "smooth"),
        (0.30, _merge(LK_BASE, {"tp": -14, "hp": -22, "ras": -34, "rsp": 12, "rfb": -10, "las": 34, "lsp": 38, "lfb": -30,
                                "lift": 0.05}), "back"),
        (1.0, _merge(LK_BASE, {"tp": -10, "hp": -16, "ras": -30, "rsp": 10, "rfb": -12, "las": 26, "lsp": 30, "lfb": -30,
                               "lift": 0.03}), "smooth"),
    ])


LK_LOB_WIND = {"tp": -10, "ty": 22, "hy": -16, "las": 92, "lsp": 34, "lfb": -70, "thl": 8, "thr": -12, "lift": -0.04, "fwd": -0.05}


def lk_tell_timelock(t):
    # Wind-up for the three-charge lob: the left arm cocks back high, past the
    # hold, then settles on the held pose for the rest of the tell.
    return keyed(t, [
        (0.0, LK_BASE, "smooth"),
        (0.45, _merge(LK_BASE, {k: v * 1.3 for k, v in LK_LOB_WIND.items()}), "back"),
        (1.0, _merge(LK_BASE, LK_LOB_WIND), "smooth"),
    ])


def lk_attack_timelock(t):
    return keyed(t, [
        (0.0, _merge(LK_BASE, LK_LOB_WIND), "smooth"),
        (0.35, _merge(LK_BASE, {"tp": 22, "ty": -20, "hy": 10, "las": -108, "lsp": 18, "lfb": -6, "thl": -22, "thr": 10,
                                "shl": 12, "lift": -0.06, "fwd": 0.10}), "in"),
        (1.0, _merge(LK_BASE, {"tp": 10, "ty": -8, "las": -40, "lsp": 10, "lfb": -24, "thl": -8, "fwd": 0.04}), "out"),
    ])


LK_SWEEP_WIND = {"ty": 30, "tr": -8, "hy": -14, "ras": 46, "rsp": 52, "rfb": -20, "las": -30, "lsp": 20, "thl": -10, "thr": 14,
                 "lift": -0.06}


def lk_tell_sweep(t):
    return keyed(t, [
        (0.0, LK_BASE, "smooth"),
        (0.5, _merge(LK_BASE, {k: v * 1.28 for k, v in LK_SWEEP_WIND.items()}), "back"),
        (1.0, _merge(LK_BASE, LK_SWEEP_WIND), "smooth"),
    ])


def lk_attack_sweep(t):
    return keyed(t, [
        (0.0, _merge(LK_BASE, LK_SWEEP_WIND), "smooth"),
        (0.4, _merge(LK_BASE, {"ty": -46, "tr": 10, "tp": 12, "hy": 18, "ras": -66, "rsp": 34, "rfb": -8, "las": 26, "lsp": 34,
                               "thl": -18, "thr": 18, "shl": 10, "lift": -0.08, "fwd": 0.06}), "in"),
        (1.0, _merge(LK_BASE, {"ty": -18, "tp": 6, "ras": -30, "rsp": 18, "rfb": -20, "las": 8, "lsp": 16, "fwd": 0.02}), "out"),
    ])


LK_HAUL_UP = {"tp": -12, "hp": -18, "las": -150, "lsp": 8, "lfb": -24, "ras": -140, "rsp": 4, "rfb": -30, "lift": 0.04}


def lk_tell_tide(t):
    # Grabs the sluice lever overhead: both arms reach high, past and back.
    return keyed(t, [
        (0.0, LK_BASE, "smooth"),
        (0.5, _merge(LK_BASE, {k: v * 1.15 for k, v in LK_HAUL_UP.items()}), "back"),
        (1.0, _merge(LK_BASE, LK_HAUL_UP), "smooth"),
    ])


def lk_attack_tide(t):
    # Looping haul: pull down with the whole back, then reach up again.
    pull = 0.5 - 0.5 * math.cos(2 * math.pi * t)
    down = {"tp": 30, "hp": 10, "las": -62, "lsp": 16, "lfb": -60, "ras": -58, "rsp": 12, "rfb": -62, "thl": -14, "thr": 12,
            "shl": 18, "shr": 10, "lift": -0.10, "fwd": -0.04}
    return {n: LK_BASE.get(n, 0.0) + LK_HAUL_UP.get(n, 0.0) + (down.get(n, 0.0) - LK_HAUL_UP.get(n, 0.0)) * pull
            for n in set(LK_HAUL_UP) | set(down) | set(LK_BASE)}


LK_SWAP_TAUT = {"tp": -18, "hp": 6, "las": -64, "lsp": 6, "lfb": -30, "ras": -58, "rsp": 4, "rfb": -34, "thl": -16, "thr": 18,
                "shr": 10, "lift": -0.05, "fwd": -0.08}


def lk_tell_swap(t):
    return keyed(t, [
        (0.0, LK_BASE, "smooth"),
        (0.5, _merge(LK_BASE, {k: v * 1.25 for k, v in LK_SWAP_TAUT.items()}), "back"),
        (1.0, _merge(LK_BASE, LK_SWAP_TAUT), "smooth"),
    ])


def lk_attack_swap(t):
    return keyed(t, [
        (0.0, _merge(LK_BASE, LK_SWAP_TAUT), "smooth"),
        (0.3, _merge(LK_BASE, {"tp": -30, "hp": -12, "las": 36, "lsp": 30, "lfb": -60, "ras": 30, "rsp": 26, "rfb": -62,
                               "thl": 10, "thr": -8, "lift": 0.03, "fwd": -0.12}), "in"),
        (1.0, _merge(LK_BASE, {"tp": 8, "las": -10, "ras": -16, "fwd": 0.03}), "out"),
    ])


def lk_stagger(t):
    return keyed(t, [
        (0.0, LK_BASE, "smooth"),
        (0.3, _merge(LK_BASE, {"tp": -24, "hp": -26, "tr": 14, "las": 60, "lsp": 60, "lfb": -40, "ras": 20, "rsp": 50,
                               "thl": 18, "thr": -20, "shr": 16, "lift": -0.04, "fwd": -0.14}), "out"),
        (1.0, _merge(LK_BASE, {"tp": 16, "hp": 14, "tr": -6, "las": -12, "lsp": 18, "ras": -24, "thl": -10, "shl": 18,
                               "lift": -0.08, "fwd": -0.06}), "smooth"),
    ])


def lk_intro(t):
    # Bursts from the hut, hunched, then rises and thumps the key down.
    return keyed(t, [
        (0.0, _merge(LK_BASE, {"tp": 34, "hp": 20, "thl": -30, "thr": 20, "shl": 30, "shr": 26, "lift": -0.16, "fwd": -0.1,
                               "las": -30, "lsp": 30}), "smooth"),
        (0.35, _merge(LK_BASE, {"tp": 8, "thl": -26, "thr": 14, "shl": 12, "lift": -0.02, "fwd": 0.12, "las": -20}), "out"),
        (0.62, _merge(LK_BASE, {"tp": -14, "hp": -14, "ras": -120, "rsp": 20, "rfb": -30, "las": 30, "lsp": 34, "lift": 0.05}), "back"),
        (0.8, _merge(LK_BASE, {"tp": 22, "hp": 8, "ras": -40, "rsp": 16, "rfb": -6, "thl": -16, "shl": 14, "lift": -0.07,
                               "fwd": 0.05}), "in"),
        (1.0, _merge(LK_BASE, {"tp": 6, "ras": -30, "rsp": 12, "rfb": -10}), "smooth"),
    ])


def lk_transition_1(t):
    # Chains the gates: heaves the key overhead and hauls it down across.
    return keyed(t, [
        (0.0, LK_BASE, "smooth"),
        (0.4, _merge(LK_BASE, {"tp": -18, "hp": -16, "ty": 20, "ras": -150, "rsp": 20, "las": -140, "lsp": 16, "lift": 0.05}), "back"),
        (0.75, _merge(LK_BASE, {"tp": 30, "ty": -24, "ras": -46, "rsp": 26, "las": -40, "lsp": 20, "thl": -14, "shl": 16,
                                "lift": -0.1, "fwd": 0.05}), "in"),
        (1.0, _merge(LK_BASE, {"tp": 10, "ras": -24}), "smooth"),
    ])


def lk_transition_2(t):
    # Kicks the downstream sluices open: a big right-leg kick with overshoot.
    return keyed(t, [
        (0.0, LK_BASE, "smooth"),
        (0.35, _merge(LK_BASE, {"tp": -10, "thr": 32, "shr": 70, "lsp": 36, "las": 20, "lift": 0.02}), "back"),
        (0.6, _merge(LK_BASE, {"tp": -22, "thr": -84, "shr": 4, "lsp": 44, "las": 34, "rsp": 20, "lift": -0.02, "fwd": 0.04}), "in"),
        (1.0, _merge(LK_BASE, {"tp": 4, "thr": -10}), "smooth"),
    ])


def lk_death(t):
    # Sinks to his knees, the key clangs down, he slumps.
    return keyed(t, [
        (0.0, _merge(LK_BASE, {"tp": -10, "hp": -18}), "smooth"),
        (0.35, _merge(LK_BASE, {"tp": 14, "hp": 10, "thl": -60, "thr": -54, "shl": 100, "shr": 96, "lift": -0.42, "fwd": 0.02,
                                "ras": -30, "rsp": 20}), "in"),
        (0.6, _merge(LK_BASE, {"tp": 30, "hp": 22, "thl": -64, "thr": -60, "shl": 108, "shr": 104, "lift": -0.52, "fwd": 0.06,
                               "ras": 12, "rsp": 44, "rfb": -4, "las": -20, "lsp": 30}), "back"),
        (1.0, _merge(LK_BASE, {"tp": 46, "hp": 34, "tr": 8, "thl": -66, "thr": -62, "shl": 110, "shr": 106, "lift": -0.56,
                               "fwd": 0.10, "ras": 8, "rsp": 48, "rfb": -2, "las": -10, "lsp": 26, "lfb": -20}), "smooth"),
    ])


# ---------------------------------------------------------------------------
# The 51% Foreman (4.5): hunched zombie, drill gauntlet on the right forearm
# ---------------------------------------------------------------------------

FM_BASE = {"tp": 8, "hp": -10, "lsp": -16, "rsp": -8, "las": -8, "ras": -18, "rfb": -26, "lfb": -16}


def fm_idle(t):
    s = math.sin(2 * math.pi * t)
    return _merge(_breath(t, FM_BASE, 1.4), {"hy": 10 * s, "hp": 2 * math.cos(2 * math.pi * t), "rfb": 2 * s})


def fm_walk(t):
    return _stomp(t, _merge(FM_BASE, {"tp": 12}), stride=24, bob=0.045, sway=8, arm_l=16, arm_r=10)


def fm_hit(t):
    return _hit(t, FM_BASE, 0.85)


def fm_halt(t):
    # Over-pressure power stance: arms flare, chest up, the drill raised.
    return keyed(t, [
        (0.0, FM_BASE, "smooth"),
        (0.35, _merge(FM_BASE, {"tp": -18, "hp": -18, "las": 20, "lsp": 52, "lfb": -60, "ras": -40, "rsp": 50, "rfb": -70,
                                "thl": -8, "thr": 8, "lift": -0.05}), "back"),
        (1.0, _merge(FM_BASE, {"tp": -12, "hp": -12, "las": 14, "lsp": 44, "lfb": -56, "ras": -32, "rsp": 42, "rfb": -64,
                               "lift": -0.04}), "smooth"),
    ])


FM_CHARGE_WIND = {"tp": 34, "hp": -10, "ras": 40, "rsp": 12, "rfb": -44, "las": 24, "lsp": 28, "lfb": -40, "thl": -20,
                  "thr": 26, "shl": 26, "shr": 8, "lift": -0.12, "fwd": -0.08}


def fm_tell_charge(t):
    # Head down, drill cocked back past the hold, knees loaded.
    return keyed(t, [
        (0.0, FM_BASE, "smooth"),
        (0.5, _merge(FM_BASE, {k: v * 1.3 for k, v in FM_CHARGE_WIND.items()}), "back"),
        (1.0, _merge(FM_BASE, FM_CHARGE_WIND), "smooth"),
    ])


def fm_attack_charge(t):
    # Charge loop: bull run with the drill thrust forward.
    base = _merge(FM_BASE, {"tp": 30, "hp": -8, "ras": -70, "rsp": 6, "rfb": -6, "las": 10, "lsp": 22, "lfb": -50,
                            "lift": -0.06, "fwd": 0.06})
    return _stomp(t, base, stride=34, bob=0.05, sway=5, arm_l=24, arm_r=4)


def fm_tell_flurry(t):
    return keyed(t, [
        (0.0, FM_BASE, "smooth"),
        (0.5, _merge(FM_BASE, {"ty": 32, "tp": 6, "ras": 34, "rsp": 36, "rfb": -80, "las": -24, "lsp": 20, "thr": 16,
                               "thl": -10, "lift": -0.06}), "back"),
        (1.0, _merge(FM_BASE, {"ty": 24, "tp": 4, "ras": 26, "rsp": 30, "rfb": -72, "las": -18, "lsp": 16, "thr": 12,
                               "thl": -8, "lift": -0.05}), "smooth"),
    ])


def fm_attack_flurry(t):
    # Three quick drill jabs across the front.
    jab = abs(math.sin(3 * math.pi * t))
    yaw = 24 * math.cos(3 * math.pi * t)
    return _merge(FM_BASE, {"ty": -yaw, "tp": 12 + 8 * jab, "ras": -30 - 50 * jab, "rsp": 12 + 10 * (1 - jab),
                            "rfb": -60 + 54 * jab, "las": 6, "lsp": 20, "thl": -14 * jab, "fwd": 0.08 * jab, "lift": -0.05})


def fm_tell_blowoff(t):
    # Tank vents: crouches, arms spread wide and low, chest compressed.
    return keyed(t, [
        (0.0, FM_BASE, "smooth"),
        (0.5, _merge(FM_BASE, {"tp": 30, "hp": 16, "las": 20, "lsp": 64, "lfb": -30, "ras": 16, "rsp": 62, "rfb": -30,
                               "thl": -20, "thr": 20, "shl": 36, "shr": 36, "lift": -0.18}), "back"),
        (1.0, _merge(FM_BASE, {"tp": 24, "hp": 12, "las": 16, "lsp": 54, "lfb": -28, "ras": 12, "rsp": 52, "rfb": -28,
                               "thl": -16, "thr": 16, "shl": 30, "shr": 30, "lift": -0.14}), "smooth"),
    ])


def fm_attack_blowoff(t):
    # Explodes upward: chest and arms thrown open.
    return keyed(t, [
        (0.0, _merge(FM_BASE, {"tp": 24, "lsp": 54, "rsp": 52, "shl": 30, "shr": 30, "lift": -0.14}), "smooth"),
        (0.3, _merge(FM_BASE, {"tp": -26, "hp": -30, "las": 40, "lsp": 84, "lfb": -10, "ras": 36, "rsp": 82, "rfb": -12,
                               "lift": 0.06}), "in"),
        (1.0, _merge(FM_BASE, {"tp": -6, "hp": -8, "las": 10, "lsp": 30, "ras": 6, "rsp": 26}), "out"),
    ])


FM_SEIZE_WIND = {"tp": -16, "hp": -12, "las": -140, "lsp": 20, "lfb": -30, "ras": -120, "rsp": 16, "rfb": -40, "lift": 0.04}


def fm_tell_seize(t):
    # Both arms raised to slam a valve wheel red.
    return keyed(t, [
        (0.0, FM_BASE, "smooth"),
        (0.5, _merge(FM_BASE, {k: v * 1.18 for k, v in FM_SEIZE_WIND.items()}), "back"),
        (1.0, _merge(FM_BASE, FM_SEIZE_WIND), "smooth"),
    ])


def fm_attack_seize(t):
    return keyed(t, [
        (0.0, _merge(FM_BASE, FM_SEIZE_WIND), "smooth"),
        (0.3, _merge(FM_BASE, {"tp": 46, "hp": 18, "las": -40, "lsp": 16, "lfb": -10, "ras": -30, "rsp": 12, "rfb": -14,
                               "thl": -20, "thr": 16, "shl": 30, "shr": 18, "lift": -0.18, "fwd": 0.08}), "in"),
        (1.0, _merge(FM_BASE, {"tp": 22, "hp": 10, "las": -20, "ras": -24, "shl": 10, "lift": -0.06, "fwd": 0.03}), "out"),
    ])


def fm_tell_plant(t):
    # 51% Attack plant: drives the drill into the floor, braced.
    return keyed(t, [
        (0.0, FM_BASE, "smooth"),
        (0.4, _merge(FM_BASE, {"tp": -10, "hp": -14, "ras": -150, "rsp": 20, "rfb": -20, "las": 30, "lsp": 40, "lift": 0.05}), "back"),
        (0.75, _merge(FM_BASE, {"tp": 52, "hp": 18, "ras": -52, "rsp": 8, "rfb": -2, "las": 20, "lsp": 44, "lfb": -30,
                                "thl": -34, "thr": 30, "shl": 50, "shr": 30, "lift": -0.26, "fwd": 0.06}), "in"),
        (1.0, _merge(FM_BASE, {"tp": 48, "hp": 16, "ras": -50, "rsp": 8, "rfb": -4, "las": 18, "lsp": 40, "lfb": -28,
                               "thl": -30, "thr": 26, "shl": 46, "shr": 28, "lift": -0.24, "fwd": 0.05}), "smooth"),
    ])


def fm_attack_plant(t):
    # Plant loop: the drill hammers, the body shudders.
    # One shudder per loop, phase-shifted so every sample differs.
    shudder = math.sin(2 * math.pi * t + 0.6)
    return _merge(FM_BASE, {"tp": 48 + 3 * shudder, "hp": 16 - 4 * shudder, "tr": 3 * shudder, "ras": -50, "rsp": 8,
                            "rfb": -4 + 3 * shudder, "las": 18, "lsp": 40 + 6 * shudder, "lfb": -28, "thl": -30,
                            "thr": 26, "shl": 46, "shr": 28, "lift": -0.24 + 0.02 * shudder, "fwd": 0.05})


def fm_jammed(t):
    # Drill stuck in a headframe leg: wrenching back and forth.
    w = math.sin(2 * math.pi * t)
    return _merge(FM_BASE, {"tp": 20 - 12 * w, "ty": 18 * w, "hp": 10, "ras": -84 + 10 * w, "rsp": 4, "rfb": -4,
                            "las": -60 - 12 * w, "lsp": 10, "lfb": -30, "thl": -24, "thr": 30, "shl": 20,
                            "lift": -0.08, "fwd": -0.06 * w})


def fm_scalded(t):
    # Kneels venting.
    return keyed(t, [
        (0.0, FM_BASE, "smooth"),
        (0.4, _merge(FM_BASE, {"tp": 34, "hp": 26, "thl": -64, "thr": 10, "shl": 100, "shr": 80, "lift": -0.34,
                               "las": -40, "lsp": 20, "lfb": -60, "ras": -30, "rsp": 26}), "back"),
        (1.0, _merge(FM_BASE, {"tp": 30, "hp": 22, "tr": 4, "thl": -60, "thr": 8, "shl": 96, "shr": 78, "lift": -0.32,
                               "las": -44, "lsp": 18, "lfb": -64, "ras": -26, "rsp": 24}), "smooth"),
    ])


def fm_stagger(t):
    return keyed(t, [
        (0.0, FM_BASE, "smooth"),
        (0.3, _merge(FM_BASE, {"tp": -22, "hp": -24, "tr": -12, "las": 50, "lsp": 56, "ras": 20, "rsp": 46, "rfb": -40,
                               "thl": 16, "thr": -18, "shr": 14, "fwd": -0.12}), "out"),
        (1.0, _merge(FM_BASE, {"tp": 22, "hp": 16, "tr": 6, "las": -20, "ras": -30, "thl": -12, "shl": 16, "lift": -0.07,
                               "fwd": -0.05}), "smooth"),
    ])


def fm_intro(t):
    # Shoulders the cage gate open, cracks his neck, the lamp flickers on.
    return keyed(t, [
        (0.0, _merge(FM_BASE, {"tp": 20, "ty": 34, "las": -100, "lsp": 40, "lfb": -30, "thl": -12, "thr": 20, "lift": -0.06}), "smooth"),
        (0.35, _merge(FM_BASE, {"tp": 26, "ty": -24, "las": -40, "lsp": 70, "lfb": -10, "thl": -24, "shl": 16, "fwd": 0.1,
                                "lift": -0.08}), "back"),
        (0.6, _merge(FM_BASE, {"tp": -6, "hp": -8, "hr": 26}), "smooth"),
        (0.8, _merge(FM_BASE, {"tp": -6, "hp": -8, "hr": -26}), "back"),
        (1.0, _merge(FM_BASE, {"tp": 6}), "smooth"),
    ])


def fm_transition_1(t):
    # Tanks over-pressurise: a power stance with overshoot.
    return fm_halt(t)


def fm_transition_2(t):
    # The tank ruptures: thrown forward by the blast, then rises.
    return keyed(t, [
        (0.0, FM_BASE, "smooth"),
        (0.25, _merge(FM_BASE, {"tp": 48, "hp": 30, "las": 40, "lsp": 60, "ras": 30, "rsp": 56, "thl": -26, "shl": 30,
                                "lift": -0.14, "fwd": 0.16}), "out"),
        (0.7, _merge(FM_BASE, {"tp": -20, "hp": -26, "las": 30, "lsp": 70, "lfb": -60, "ras": -30, "rsp": 60, "rfb": -70,
                               "lift": 0.02}), "back"),
        (1.0, _merge(FM_BASE, {"tp": -8, "hp": -10, "lsp": 20, "rsp": 18}), "smooth"),
    ])


def fm_death(t):
    # The drill seizes, the keys spill, he topples forward onto his knees and chest.
    return keyed(t, [
        (0.0, _merge(FM_BASE, {"tp": -16, "hp": -26, "las": 30, "lsp": 50, "ras": -60, "rsp": 20, "rfb": -70}), "smooth"),
        (0.3, _merge(FM_BASE, {"tp": 10, "hp": 12, "thl": -56, "thr": -50, "shl": 96, "shr": 92, "lift": -0.40,
                               "las": 0, "lsp": 30, "ras": -40, "rsp": 16, "rfb": -30}), "in"),
        (0.65, _merge(FM_BASE, {"tp": 50, "hp": 30, "pp": 20, "thl": -60, "thr": -56, "shl": 104, "shr": 100, "lift": -0.52,
                                "fwd": 0.08, "las": -50, "lsp": 30, "ras": -56, "rsp": 20}), "back"),
        (1.0, _merge(FM_BASE, {"tp": 64, "hp": 38, "pp": 32, "thl": -62, "thr": -58, "shl": 108, "shr": 104, "lift": -0.62,
                               "fwd": 0.16, "las": -70, "lsp": 34, "lfb": -10, "ras": -66, "rsp": 26, "rfb": -10}), "smooth"),
    ])


# ---------------------------------------------------------------------------
# Clip tables
# ---------------------------------------------------------------------------
# frames, playback fps, loop, directions, and the pose function. `kind` groups
# clips for the runtime binder: locomotion, tell, attack, reaction, cinematic.

def _clip(function, frames, fps, *, loop=False, south=False, kind="attack", attack=None):
    return {"function": function, "frames": frames, "fps": fps, "loop": loop,
            "directions": DIRECTIONS_SOUTH if south else DIRECTIONS_ALL, "kind": kind, "attackKind": attack}


BOSS_CLIPS = {
    "lockkeeper": {
        "actorId": "lockkeeper",
        "stoop": 0.10,
        "phases": ("lock-open", "lock-flood", "spillway"),
        "clips": {
            "idle": _clip(lk_idle, 6, 6, loop=True, kind="locomotion"),
            "walk": _clip(lk_walk, 8, 12, loop=True, kind="locomotion"),
            "hit": _clip(lk_hit, 3, 12, kind="reaction"),
            "halt": _clip(lk_halt, 5, 10, kind="reaction"),
            "stagger": _clip(lk_stagger, 4, 10, kind="reaction"),
            "tell-timelock": _clip(lk_tell_timelock, 5, 10, kind="tell", attack="hashed-timelock"),
            "attack-timelock": _clip(lk_attack_timelock, 4, 16, kind="attack", attack="hashed-timelock"),
            "tell-sweep": _clip(lk_tell_sweep, 5, 10, kind="tell", attack="windlass-sweep"),
            "attack-sweep": _clip(lk_attack_sweep, 5, 16, kind="attack", attack="windlass-sweep"),
            "tell-tide": _clip(lk_tell_tide, 4, 8, kind="tell", attack="tide-release"),
            "attack-tide": _clip(lk_attack_tide, 5, 10, loop=True, kind="attack", attack="tide-release"),
            "tell-swap": _clip(lk_tell_swap, 5, 8, kind="tell", attack="atomic-swap"),
            "attack-swap": _clip(lk_attack_swap, 4, 14, kind="attack", attack="atomic-swap"),
            "intro": _clip(lk_intro, 12, 12, south=True, kind="cinematic"),
            "transition-1": _clip(lk_transition_1, 10, 12, south=True, kind="cinematic"),
            "transition-2": _clip(lk_transition_2, 10, 12, south=True, kind="cinematic"),
            "death": _clip(lk_death, 12, 10, south=True, kind="cinematic"),
        },
        # Phase 1 carries the full kit; phases 2 and 3 re-bake a reduced subset
        # in their own dressing and fall back to earlier phases for the rest.
        "phaseClips": {
            "lock-open": ("idle", "walk", "hit", "halt", "stagger", "tell-timelock", "attack-timelock", "tell-sweep",
                          "attack-sweep", "tell-tide", "attack-tide", "intro", "transition-1"),
            "lock-flood": ("idle", "walk", "hit", "halt", "tell-swap", "attack-swap", "tell-timelock", "attack-timelock",
                           "transition-2"),
            "spillway": ("idle", "walk", "hit", "tell-timelock", "attack-timelock", "tell-tide", "attack-tide", "death"),
        },
    },
    "fifty-one-percent-foreman": {
        "actorId": "fifty-one-percent-foreman",
        "stoop": 0.35,
        "phases": ("day-shift", "hashrate-surge", "majority-rule"),
        "clips": {
            "idle": _clip(fm_idle, 6, 6, loop=True, kind="locomotion"),
            "walk": _clip(fm_walk, 8, 10, loop=True, kind="locomotion"),
            "hit": _clip(fm_hit, 3, 12, kind="reaction"),
            "halt": _clip(fm_halt, 5, 10, kind="reaction"),
            "stagger": _clip(fm_stagger, 4, 10, kind="reaction"),
            "jammed": _clip(fm_jammed, 4, 8, loop=True, kind="reaction"),
            "scalded": _clip(fm_scalded, 4, 8, kind="reaction"),
            "tell-charge": _clip(fm_tell_charge, 5, 10, kind="tell", attack="drill-charge"),
            "attack-charge": _clip(fm_attack_charge, 6, 16, loop=True, kind="attack", attack="drill-charge"),
            "tell-flurry": _clip(fm_tell_flurry, 4, 10, kind="tell", attack="drill-flurry"),
            "attack-flurry": _clip(fm_attack_flurry, 5, 16, kind="attack", attack="drill-flurry"),
            "tell-blowoff": _clip(fm_tell_blowoff, 5, 10, kind="tell", attack="blow-off"),
            "attack-blowoff": _clip(fm_attack_blowoff, 4, 14, kind="attack", attack="blow-off"),
            "tell-seize": _clip(fm_tell_seize, 4, 8, kind="tell", attack="valve-seize"),
            "attack-seize": _clip(fm_attack_seize, 4, 14, kind="attack", attack="valve-seize"),
            "tell-plant": _clip(fm_tell_plant, 6, 10, kind="tell", attack="fifty-one-percent-attack"),
            "attack-plant": _clip(fm_attack_plant, 4, 12, loop=True, kind="attack", attack="fifty-one-percent-attack"),
            "intro": _clip(fm_intro, 12, 12, south=True, kind="cinematic"),
            "transition-1": _clip(fm_transition_1, 8, 12, south=True, kind="cinematic"),
            "transition-2": _clip(fm_transition_2, 10, 12, south=True, kind="cinematic"),
            "death": _clip(fm_death, 12, 10, south=True, kind="cinematic"),
        },
        "phaseClips": {
            "day-shift": ("idle", "walk", "hit", "halt", "stagger", "jammed", "scalded", "tell-charge", "attack-charge",
                          "tell-flurry", "attack-flurry", "tell-blowoff", "attack-blowoff", "tell-seize", "attack-seize",
                          "intro", "transition-1"),
            "hashrate-surge": ("idle", "walk", "hit", "halt", "tell-charge", "attack-charge", "tell-plant", "attack-plant",
                               "transition-2"),
            "majority-rule": ("idle", "walk", "hit", "tell-charge", "attack-charge", "death"),
        },
    },
}


def sample_time(clip: dict, index: int) -> float:
    count = clip["frames"]
    return index / count if clip["loop"] else index / max(count - 1, 1)


def boss_pose(role_id: str, clip_id: str, index: int) -> dict:
    table = BOSS_CLIPS[role_id]
    clip = table["clips"][clip_id]
    channels = clip["function"](sample_time(clip, index))
    return _to_pose(channels, table["stoop"])


def frame_plan(role_id: str):
    """Every (phase, clip, direction, frameIndex) the atlas must contain, in render order."""
    table = BOSS_CLIPS[role_id]
    plan = []
    for phase in table["phases"]:
        for clip_id in table["phaseClips"][phase]:
            clip = table["clips"][clip_id]
            for direction in clip["directions"]:
                for index in range(clip["frames"]):
                    plan.append((phase, clip_id, direction, index))
    return plan


def clip_manifest(role_id: str) -> dict:
    """JSON-safe clip table for receipts and runtime metadata."""
    table = BOSS_CLIPS[role_id]
    return {
        "clipLibraryVersion": CLIP_LIBRARY_VERSION,
        "phases": list(table["phases"]),
        "clips": {cid: {"frames": c["frames"], "fps": c["fps"], "loop": c["loop"], "directions": list(c["directions"]),
                        "kind": c["kind"], "attackKind": c["attackKind"]} for cid, c in table["clips"].items()},
        "phaseClips": {phase: list(ids) for phase, ids in table["phaseClips"].items()},
    }


if __name__ == "__main__":
    import json
    for role in BOSS_CLIPS:
        print(role, len(frame_plan(role)))
    print(json.dumps(boss_pose("lockkeeper", "tell-sweep", 2))[:200])
