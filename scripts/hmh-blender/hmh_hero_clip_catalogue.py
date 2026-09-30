"""Authored hero clip catalogue for the shared Tripo gameplay rig.

Every value is a Blender pose-bone offset (degrees / metres) on top of the
hero's neutral standing stance; see ``hmh_clip_library.py`` for the axis
conventions. Timing is in 60 Hz ticks. Nothing here moves the root along the
ground: locomotion, height changes and facing come from the simulation, so
these clips are root-motion-free by construction (``root`` only yaws in turn
and twirl clips, and the pelvis only rises or drops in place).

The native nine clips (idle, run, aim, pistol-fire, hurt, dash, melee,
grenade, death) stay as exported by Blender; the reference poses below were
measured from them so the library reads in the same idiom.
"""
from hmh_clip_library import Clip, Key, add, merge, mirrored_clip, pose, scaled

HEROES = ("lit-commando", "lilly", "lit-valkyrie", "lester-original")
NATIVE_CLIPS = ("idle", "run", "aim", "pistol-fire", "hurt", "dash", "melee", "grenade", "death")

# ------------------------------------------------------------------ reusable partial poses
NEUTRAL = pose()
# two-handed pistol aim (measured from the native aim clip)
AIM_ARMS = pose(chest=(6.8, 0, -2), head=(-2, 0, 0), upper_arm_R=(35.4, -2, -7), forearm_R=(66, 0, 0), hand_R=(-9, 0, -2),
                upper_arm_L=(24, 0, 11), forearm_L=(72, 0, 0), hand_L=(-4, 0, 3))
# arms as in the native run mid-cycle (pistol carried low and ready)
RUN_ARMS = pose(chest=(10, 0, 0), head=(-7, 0, 0), upper_arm_R=(-8, 0, 0), forearm_R=(38, 0, 0), forearm_L=(30, 0, 0))
RUN_LEG_A = pose(thigh_R=(31, 0, 0), shin_R=(-8, 0, 0), thigh_L=(-31, 0, 0), shin_L=(-56, 0, 0), foot_L=(25, 0, 0),
                 upper_arm_L=(24, 0, 0), forearm_L=(40, 0, 0), forearm_R=(30, 0, 0), chest=(10, 0, 5), head=(-7, 0, -2), pelvis={"loc": (0, -.042, 0)})
RUN_LEG_B = pose(thigh_L=(31, 0, 0), shin_L=(-8, 0, 0), thigh_R=(-31, 0, 0), shin_R=(-56, 0, 0), foot_R=(25, 0, 0),
                 upper_arm_R=(-16, 0, 0), forearm_R=(46, 0, 0), upper_arm_L=(-24, 0, 0), forearm_L=(20, 0, 0), chest=(10, 0, -5), head=(-7, 0, 2), pelvis={"loc": (0, -.088, 0)})
# long-gun hold: right hand at the grip, left hand forward under the barrel
LONG_GUN = pose(chest=(8, 0, -6), head=(-3, 0, 4), upper_arm_R=(30, -2, -4), forearm_R=(80, 0, 0), hand_R=(-6, 0, -2),
                upper_arm_L=(48, 0, 14), forearm_L=(52, 0, 0), hand_L=(-8, 0, 6))
# crouches (pelvis drop matches thigh/shin angles so feet stay planted)
CROUCH = pose(pelvis={"loc": (0, -.40, 0)}, thigh_R=(82, 0, 4), shin_R=(-104, 0, 0), foot_R=(20, 0, 0),
              thigh_L=(82, 0, -4), shin_L=(-104, 0, 0), foot_L=(20, 0, 0), chest=(18, 0, 0), head=(-14, 0, 0))
HALF_CROUCH = scaled(CROUCH, .5)
KNEEL = pose(pelvis={"loc": (0, -.48, .02)}, thigh_R=(92, 0, 6), shin_R=(-92, 0, 0), foot_R=(0, 0, 0),
             thigh_L=(-12, 0, -4), shin_L=(-112, 0, 0), foot_L=(-30, 0, 0), chest=(14, 0, 0), head=(-8, 0, 0))
# pistol raised beside the chest, muzzle up (cover ready)
COVER_READY = pose(upper_arm_R=(22, 0, -10), forearm_R=(122, 0, 0), hand_R=(-20, 0, 0), upper_arm_L=(12, 0, 12), forearm_L=(36, 0, 0), chest=(-4, 0, 0))
TALL_COVER = merge(COVER_READY, pose(pelvis={"loc": (0, -.02, -.02)}, thigh_R=(4, 0, 6), thigh_L=(4, 0, -6), shin_R=(-8, 0, 0), shin_L=(-8, 0, 0), head=(0, 0, 0)))
SHORT_COVER = merge(CROUCH, COVER_READY, pose(chest=(10, 0, 0), head=(-6, 0, 0)))
LYING_BACK = pose(pelvis={"rot": (-86, 0, 0), "loc": (0, -.86, -.06)}, chest=(4, 0, 0), head=(6, 0, 0),
                  upper_arm_R=(20, 0, -55), forearm_R=(30, 0, 0), upper_arm_L=(20, 0, 55), forearm_L=(30, 0, 0),
                  thigh_R=(-4, 0, 6), shin_R=(-10, 0, 0), thigh_L=(-4, 0, -6), shin_L=(-4, 0, 0), foot_R=(-10, 0, 0), foot_L=(-10, 0, 0))
LYING_FRONT = pose(pelvis={"rot": (84, 0, 0), "loc": (0, -.84, .10)}, chest=(-6, 0, 0), head=(-18, 0, 0),
                   upper_arm_R=(110, 0, -30), forearm_R=(50, 0, 0), upper_arm_L=(120, 0, 30), forearm_L=(45, 0, 0),
                   thigh_R=(4, 0, 6), shin_R=(-16, 0, 0), thigh_L=(2, 0, -6), shin_L=(-6, 0, 0))
# hurt flinch from the native hurt clip
FLINCH = pose(chest=(-3, 1.8, 1.6), head=(-1.8, 0, -2.3), upper_arm_R=(27, -2, -7), forearm_R=(56, 0, 0), hand_R=(-7.4, 0, -2),
              upper_arm_L=(19.7, 0, 11), forearm_L=(59, 0, 0), hand_L=(-3.3, 0, 3))


def K(tick, *poses, ease="in-out"):
    return Key(tick, merge(*poses) if poses else {}, ease)


def clip(name, ticks, keys, category, **flags):
    return Clip(name, ticks, tuple(keys), category, **flags)


def wobble(tick, amount, seed):
    """Small breathing/sway offsets so long holds are not frozen."""
    s = 1 if seed % 2 else -1
    return pose(chest=(amount * .6, 0, s * amount * .3), head=(-amount * .4, 0, -s * amount * .2))


# ------------------------------------------------------------------ movement
def movement():
    clips = []
    clips.append(clip("run-start", 14, [K(0), K(6, pose(chest=(16, 0, 0), head=(-8, 0, 0), pelvis={"loc": (0, -.03, .02)}, thigh_L=(-12, 0, 0), thigh_R=(24, 0, 0), shin_R=(-30, 0, 0), upper_arm_L=(14, 0, 0), forearm_L=(30, 0, 0), forearm_R=(24, 0, 0)), ease="out"),
                                        K(14, RUN_LEG_A)], "movement", blend_in=2, blend_out=2, note="lean into the first stride; ends on the run cycle's first pose"))
    clips.append(clip("run-stop", 16, [K(0, RUN_LEG_B, ease="linear"),
                                       K(7, pose(chest=(-6, 0, 0), head=(4, 0, 0), pelvis={"loc": (0, -.06, -.03)}, thigh_R=(28, 0, 6), shin_R=(-22, 0, 0), foot_R=(8, 0, 0), thigh_L=(-10, 0, -6), shin_L=(-26, 0, 0), upper_arm_R=(12, 0, -8), forearm_R=(40, 0, 0), upper_arm_L=(12, 0, 8), forearm_L=(40, 0, 0)), ease="out"),
                                       K(16, NEUTRAL)], "movement", blend_in=2, blend_out=3, note="braking plant with the front foot, settles to idle"))
    side = pose(chest=(6, 0, -4), head=(-4, 0, 0), upper_arm_R=(-6, 0, -4), forearm_R=(40, 0, 0), upper_arm_L=(-6, 0, 4), forearm_L=(40, 0, 0))
    strafe = clip("strafe-l", 40, [K(0, side, pose(thigh_L=(4, 0, 26), shin_L=(-10, 0, 0), thigh_R=(2, 0, 2), pelvis={"loc": (.02, -.03, 0)})),
                                   K(10, side, pose(thigh_L=(6, 0, 12), shin_L=(-24, 0, 0), thigh_R=(2, 0, 8), shin_R=(-6, 0, 0), pelvis={"loc": (.05, -.05, 0)})),
                                   K(20, side, pose(thigh_L=(2, 0, -2), thigh_R=(4, 0, 26), shin_R=(-10, 0, 0), pelvis={"loc": (.03, -.03, 0)})),
                                   K(30, side, pose(thigh_L=(2, 0, -6), shin_L=(-6, 0, 0), thigh_R=(6, 0, 8), shin_R=(-24, 0, 0), pelvis={"loc": (-.01, -.05, 0)}))],
                  "movement", loop=True, blend_in=4, blend_out=4, note="side step to the hero's left; torso and pistol stay square")
    clips.append(strafe)
    clips.append(mirrored_clip(strafe, "strafe-r", "side step to the hero's right (mirror of strafe-l)"))
    back = pose(chest=(-6, 0, 0), head=(3, 0, 0), upper_arm_R=(20, 0, -6), forearm_R=(60, 0, 0), hand_R=(-8, 0, -2), upper_arm_L=(16, 0, 8), forearm_L=(62, 0, 0))
    clips.append(clip("back-pedal", 40, [K(0, back, pose(thigh_R=(-22, 0, 0), shin_R=(-30, 0, 0), foot_R=(12, 0, 0), thigh_L=(18, 0, 0), shin_L=(-10, 0, 0), pelvis={"loc": (0, -.03, 0)}), ease="linear"),
                                         K(10, back, pose(thigh_R=(-6, 0, 0), shin_R=(-8, 0, 0), thigh_L=(4, 0, 0), shin_L=(-16, 0, 0), pelvis={"loc": (0, -.06, 0)}), ease="linear"),
                                         K(20, back, pose(thigh_L=(-22, 0, 0), shin_L=(-30, 0, 0), foot_L=(12, 0, 0), thigh_R=(18, 0, 0), shin_R=(-10, 0, 0), pelvis={"loc": (0, -.03, 0)}), ease="linear"),
                                         K(30, back, pose(thigh_L=(-6, 0, 0), shin_L=(-8, 0, 0), thigh_R=(4, 0, 0), shin_R=(-16, 0, 0), pelvis={"loc": (0, -.06, 0)}), ease="linear")],
                      "movement", loop=True, blend_in=4, blend_out=4, note="retreating shuffle facing the aim direction"))
    turn = clip("turn-l", 16, [K(0, pose(root=(0, -70, 0), chest=(4, 0, 0), thigh_L=(6, 0, 20), shin_L=(-14, 0, 0), thigh_R=(-4, 0, 0), pelvis={"loc": (0, -.03, 0)}), ease="linear"),
                               K(8, pose(root=(0, -28, 0), chest=(6, 0, 6), thigh_L=(14, 0, 8), shin_L=(-24, 0, 0), thigh_R=(-8, 0, 10), shin_R=(-10, 0, 0), pelvis={"loc": (0, -.05, 0)}), ease="out"),
                               K(16, NEUTRAL)], "movement", blend_in=2, blend_out=3, note="in-place turn to the left; the sim already faces the new heading so the body catches up")
    clips.append(turn)
    clips.append(mirrored_clip(turn, "turn-r", "in-place turn to the right (mirror of turn-l)"))
    clips.append(clip("pivot", 20, [K(0, pose(root=(0, -170, 0), chest=(14, 0, 0), head=(-6, 0, 0), thigh_R=(24, 0, 8), shin_R=(-30, 0, 0), thigh_L=(-14, 0, -8), shin_L=(-16, 0, 0), pelvis={"loc": (0, -.06, 0)}), ease="linear"),
                                    K(7, pose(root=(0, -100, 0), chest=(12, 0, 14), thigh_R=(30, 0, 24), shin_R=(-44, 0, 0), thigh_L=(-6, 0, -18), shin_L=(-24, 0, 0), pelvis={"loc": (0, -.08, 0)}), ease="in"),
                                    K(14, pose(root=(0, -24, 0), chest=(8, 0, 4), thigh_R=(12, 0, 10), shin_R=(-20, 0, 0), thigh_L=(-4, 0, -6), shin_L=(-14, 0, 0), pelvis={"loc": (0, -.04, 0)}), ease="out"),
                                    K(20, NEUTRAL)], "movement", blend_in=2, blend_out=3, note="sharp 180 degree plant-and-swing"))
    return clips


# ------------------------------------------------------------------ evasion
def evasion():
    clips = []
    tuck_arms = pose(upper_arm_R=(70, 0, -20), forearm_R=(120, 0, 0), upper_arm_L=(70, 0, 20), forearm_L=(120, 0, 0), head=(20, 0, 0))
    tuck_legs = pose(thigh_R=(100, 0, 4), shin_R=(-126, 0, 0), thigh_L=(100, 0, -4), shin_L=(-126, 0, 0), foot_R=(16, 0, 0), foot_L=(16, 0, 0))
    clips.append(clip("dodge-roll", 30, [K(0, HALF_CROUCH, pose(chest=(26, 0, 0), head=(-6, 0, 0))),
                                         K(6, tuck_arms, tuck_legs, pose(chest=(30, 0, 0), pelvis={"rot": (50, 0, 0), "loc": (0, -.52, .08)}), ease="in"),
                                         K(12, tuck_arms, tuck_legs, pose(chest=(30, 0, 0), pelvis={"rot": (150, 0, 0), "loc": (0, -.72, .06)}), ease="linear"),
                                         K(18, tuck_arms, tuck_legs, pose(chest=(30, 0, 0), pelvis={"rot": (250, 0, 0), "loc": (0, -.70, 0)}), ease="linear"),
                                         K(24, HALF_CROUCH, pose(chest=(24, 0, 0), head=(-10, 0, 0), pelvis={"rot": (340, 0, 0), "loc": (0, -.32, -.04)}, upper_arm_R=(30, 0, -10), forearm_R=(60, 0, 0), upper_arm_L=(30, 0, 10), forearm_L=(60, 0, 0)), ease="out"),
                                         K(30, NEUTRAL)], "evasion", blend_in=2, blend_out=3, interruptible=False, note="forward shoulder roll; a full pelvis revolution in place"))
    clips.append(clip("stumble", 24, [K(0, pose(chest=(22, 0, 6), head=(-10, 0, -6), thigh_R=(28, 0, 6), shin_R=(-16, 0, 0), thigh_L=(-18, 0, -4), shin_L=(-30, 0, 0), upper_arm_R=(-30, 0, -30), forearm_R=(20, 0, 0), upper_arm_L=(50, 0, 40), forearm_L=(30, 0, 0), pelvis={"loc": (.02, -.08, .06)}), ease="linear"),
                                      K(9, pose(chest=(30, 0, -8), head=(-16, 0, 8), thigh_L=(34, 0, -8), shin_L=(-20, 0, 0), thigh_R=(-10, 0, 8), shin_R=(-36, 0, 0), upper_arm_L=(-24, 0, 36), forearm_L=(24, 0, 0), upper_arm_R=(56, 0, -46), forearm_R=(30, 0, 0), pelvis={"loc": (-.03, -.10, .08)}), ease="out"),
                                      K(17, pose(chest=(10, 0, 2), head=(-6, 0, 0), thigh_R=(12, 0, 4), shin_R=(-20, 0, 0), thigh_L=(2, 0, -4), shin_L=(-10, 0, 0), upper_arm_R=(16, 0, -14), forearm_R=(40, 0, 0), upper_arm_L=(16, 0, 14), forearm_L=(40, 0, 0), pelvis={"loc": (0, -.05, .02)}), ease="out"),
                                      K(24, NEUTRAL)], "evasion", blend_in=2, blend_out=3, note="tripped forward, arms flail, feet catch up"))
    clips.append(clip("knockdown", 36, [K(0, FLINCH, ease="linear"),
                                        K(8, pose(chest=(-22, 0, 4), head=(-14, 0, 0), upper_arm_R=(60, 0, -50), forearm_R=(40, 0, 0), upper_arm_L=(60, 0, 50), forearm_L=(40, 0, 0), thigh_R=(20, 0, 6), shin_R=(-30, 0, 0), thigh_L=(-6, 0, -6), shin_L=(-40, 0, 0), pelvis={"rot": (-24, 0, 0), "loc": (0, -.18, -.10)}), ease="in"),
                                        K(20, pose(chest=(10, 0, 0), head=(14, 0, 0), upper_arm_R=(40, 0, -60), forearm_R=(20, 0, 0), upper_arm_L=(40, 0, 60), forearm_L=(20, 0, 0), thigh_R=(30, 0, 8), shin_R=(-40, 0, 0), thigh_L=(20, 0, -8), shin_L=(-30, 0, 0), pelvis={"rot": (-84, 0, 0), "loc": (0, -.82, -.12)}), ease="in"),
                                        K(28, LYING_BACK, pose(head=(12, 0, 0), thigh_R=(6, 0, 8), shin_R=(-16, 0, 0)), ease="out"),
                                        K(36, LYING_BACK)], "evasion", blend_in=2, blend_out=0, interruptible=False, note="thrown onto the back; ends lying, get-up continues from this pose"))
    clips.append(clip("get-up", 40, [K(0, LYING_BACK, ease="linear"),
                                     K(10, pose(pelvis={"rot": (-60, 0, 0), "loc": (0, -.70, -.02)}, chest=(30, 0, 0), head=(4, 0, 0), upper_arm_R=(-40, 0, -40), forearm_R=(10, 0, 0), upper_arm_L=(-40, 0, 40), forearm_L=(10, 0, 0), thigh_R=(50, 0, 6), shin_R=(-70, 0, 0), thigh_L=(50, 0, -6), shin_L=(-70, 0, 0)), ease="in-out"),
                                     K(22, CROUCH, pose(pelvis={"rot": (0, 0, 0), "loc": (0, -.44, .04)}, upper_arm_R=(40, 0, -20), forearm_R=(60, 0, 0), upper_arm_L=(40, 0, 20), forearm_L=(60, 0, 0), chest=(28, 0, 0), head=(-16, 0, 0)), ease="in-out"),
                                     K(32, HALF_CROUCH, pose(chest=(8, 0, 0), head=(-4, 0, 0)), ease="out"),
                                     K(40, NEUTRAL)], "evasion", blend_in=0, blend_out=3, interruptible=False, note="roll to a crouch and stand"))
    clips.append(clip("stun", 60, [K(0, pose(chest=(6, 0, -8), head=(-8, 0, 12), upper_arm_R=(-6, 0, -6), forearm_R=(24, 0, 0), upper_arm_L=(-6, 0, 6), forearm_L=(24, 0, 0), thigh_R=(8, 0, 4), shin_R=(-16, 0, 0), thigh_L=(8, 0, -4), shin_L=(-16, 0, 0), pelvis={"loc": (.03, -.05, 0)})),
                                   K(15, pose(chest=(10, 4, 0), head=(4, 0, -4), upper_arm_R=(-6, 0, -6), forearm_R=(24, 0, 0), upper_arm_L=(-6, 0, 6), forearm_L=(24, 0, 0), thigh_R=(8, 0, 4), shin_R=(-16, 0, 0), thigh_L=(8, 0, -4), shin_L=(-16, 0, 0), pelvis={"loc": (0, -.06, .02)})),
                                   K(30, pose(chest=(6, 0, 8), head=(-8, 0, -12), upper_arm_R=(-6, 0, -6), forearm_R=(24, 0, 0), upper_arm_L=(-6, 0, 6), forearm_L=(24, 0, 0), thigh_R=(8, 0, 4), shin_R=(-16, 0, 0), thigh_L=(8, 0, -4), shin_L=(-16, 0, 0), pelvis={"loc": (-.03, -.05, 0)})),
                                   K(45, pose(chest=(2, -4, 0), head=(-12, 0, 4), upper_arm_R=(-6, 0, -6), forearm_R=(24, 0, 0), upper_arm_L=(-6, 0, 6), forearm_L=(24, 0, 0), thigh_R=(8, 0, 4), shin_R=(-16, 0, 0), thigh_L=(8, 0, -4), shin_L=(-16, 0, 0), pelvis={"loc": (0, -.04, -.02)}))],
                      "evasion", loop=True, blend_in=4, blend_out=4, interruptible=False, note="dazed sway with the head circling"))
    airborne = pose(chest=(6, 0, 0), head=(-6, 0, 0), upper_arm_R=(40, 0, -70), forearm_R=(30, 0, 0), upper_arm_L=(40, 0, 70), forearm_L=(30, 0, 0), thigh_R=(24, 0, 6), shin_R=(-46, 0, 0), thigh_L=(10, 0, -6), shin_L=(-30, 0, 0), foot_R=(-10, 0, 0), foot_L=(-10, 0, 0))
    clips.append(clip("fall", 30, [K(0, airborne), K(15, airborne, pose(chest=(10, 0, 0), thigh_R=(14, 0, 6), shin_R=(-30, 0, 0), thigh_L=(20, 0, -6), shin_L=(-40, 0, 0), upper_arm_R=(50, 0, -76), upper_arm_L=(50, 0, 76)))],
                      "evasion", loop=True, blend_in=3, blend_out=2, note="airborne balance; height comes from the simulation"))
    clips.append(clip("land", 18, [K(0, airborne, ease="linear"),
                                   K(5, CROUCH, pose(chest=(26, 0, 0), head=(-12, 0, 0), upper_arm_R=(30, 0, -30), forearm_R=(50, 0, 0), upper_arm_L=(30, 0, 30), forearm_L=(50, 0, 0), pelvis={"loc": (0, -.34, .02)}), ease="in"),
                                   K(11, HALF_CROUCH, pose(chest=(10, 0, 0)), ease="out"),
                                   K(18, NEUTRAL)], "evasion", blend_in=1, blend_out=3, note="impact squash and recovery"))
    return clips


# ------------------------------------------------------------------ cover
def cover():
    clips = []
    clips.append(clip("cover-enter-tall", 12, [K(0), K(6, HALF_CROUCH, pose(chest=(8, 0, 0), upper_arm_R=(20, 0, -10), forearm_R=(90, 0, 0)), ease="out"), K(12, TALL_COVER)],
                      "cover", blend_in=2, blend_out=2, note="snap back to the wall, pistol comes up to the chest"))
    clips.append(clip("cover-enter-short", 14, [K(0), K(7, HALF_CROUCH, COVER_READY, pose(chest=(22, 0, 0)), ease="in"), K(14, SHORT_COVER)],
                      "cover", blend_in=2, blend_out=2, note="duck behind low cover"))
    tall_l = clip("cover-idle-tall-l", 90, [K(0, TALL_COVER, pose(head=(0, 34, 0))), K(30, TALL_COVER, pose(head=(-2, 30, 2)), wobble(30, 2, 1)), K(60, TALL_COVER, pose(head=(0, 36, -2)), wobble(60, 2, 2))],
                  "cover", loop=True, blend_in=4, blend_out=4, note="back to the wall, watching the left edge")
    clips.append(tall_l)
    clips.append(mirrored_clip(tall_l, "cover-idle-tall-r", "back to the wall, watching the right edge (mirror)"))
    clips.append(clip("cover-idle-short", 90, [K(0, SHORT_COVER), K(30, SHORT_COVER, wobble(30, 2.5, 1), pose(pelvis={"loc": (0, -.41, 0)})), K(60, SHORT_COVER, wobble(60, 2.5, 2))],
                      "cover", loop=True, blend_in=4, blend_out=4, note="crouched behind low cover"))
    shuffle = clip("cover-shuffle-l", 40, [K(0, TALL_COVER, pose(thigh_L=(4, 0, 24), shin_L=(-12, 0, 0), pelvis={"loc": (.02, -.04, -.02)})),
                                          K(10, TALL_COVER, pose(thigh_L=(6, 0, 10), shin_L=(-22, 0, 0), thigh_R=(4, 0, 8), shin_R=(-8, 0, 0), pelvis={"loc": (.05, -.06, -.02)})),
                                          K(20, TALL_COVER, pose(thigh_R=(4, 0, 24), shin_R=(-12, 0, 0), pelvis={"loc": (.03, -.04, -.02)})),
                                          K(30, TALL_COVER, pose(thigh_R=(6, 0, 10), shin_R=(-22, 0, 0), thigh_L=(4, 0, -6), shin_L=(-8, 0, 0), pelvis={"loc": (-.01, -.06, -.02)}))],
                   "cover", loop=True, blend_in=4, blend_out=4, note="sidestep along the wall to the left")
    clips.append(shuffle)
    clips.append(mirrored_clip(shuffle, "cover-shuffle-r", "sidestep along the wall to the right (mirror)"))
    lean_l = pose(chest=(6, 0, -22), head=(-2, 10, 12), pelvis={"loc": (.10, -.04, -.02)}, root=(0, 18, 0), thigh_L=(6, 0, 18), shin_L=(-14, 0, 0), thigh_R=(2, 0, -6))
    peek = clip("cover-peek-fire-l", 24, [K(0, TALL_COVER, ease="linear"),
                                          K(7, lean_l, AIM_ARMS, ease="out"),
                                          K(9, lean_l, AIM_ARMS, pose(chest=(3, 0, -22), upper_arm_R=(27, -2, -7), forearm_R=(76, 0, 0), hand_R=(-16, 0, -2)), ease="hold"),
                                          K(15, lean_l, AIM_ARMS, ease="out"),
                                          K(24, TALL_COVER)], "cover", blend_in=2, blend_out=2, note="lean out of the left edge, fire, return")
    clips.append(peek)
    clips.append(mirrored_clip(peek, "cover-peek-fire-r", "lean out of the right edge, fire, return (mirror)"))
    popup = merge(HALF_CROUCH, AIM_ARMS, pose(pelvis={"loc": (0, -.18, 0)}, chest=(12, 0, -2)))
    clips.append(clip("cover-popup-fire", 24, [K(0, SHORT_COVER, ease="linear"), K(7, popup, ease="out"),
                                               K(9, popup, pose(chest=(8, 0, -2), upper_arm_R=(27, -2, -7), forearm_R=(76, 0, 0), hand_R=(-16, 0, -2)), ease="hold"),
                                               K(15, popup, ease="out"), K(24, SHORT_COVER)], "cover", blend_in=2, blend_out=2, note="rise over low cover, fire, drop back"))
    blind = merge(TALL_COVER, pose(upper_arm_R=(48, 0, -84), forearm_R=(6, 0, 0), hand_R=(0, 0, -10), head=(0, 30, 0), chest=(-4, 0, -6)))
    clips.append(clip("cover-blind-fire", 24, [K(0, TALL_COVER, ease="linear"), K(6, blind, ease="out"),
                                               K(9, blind, pose(upper_arm_R=(44, 0, -84), forearm_R=(14, 0, 0)), ease="hold"),
                                               K(12, blind, ease="out"), K(15, blind, pose(upper_arm_R=(44, 0, -84), forearm_R=(14, 0, 0)), ease="hold"),
                                               K(24, TALL_COVER)], "cover", blend_in=2, blend_out=2, note="gun arm out past the edge, head turned away, two pulses"))
    clips.append(clip("cover-reload", 40, [K(0, TALL_COVER), K(10, TALL_COVER, pose(upper_arm_L=(44, 0, 18), forearm_L=(112, 0, 0), hand_L=(-20, 0, 0), head=(14, 0, 0))),
                                           K(18, TALL_COVER, pose(upper_arm_L=(48, 0, 18), forearm_L=(122, 0, 0), hand_L=(-30, 0, 0), head=(16, 0, 0)), ease="in"),
                                           K(26, TALL_COVER, pose(upper_arm_L=(40, 0, 16), forearm_L=(96, 0, 0), hand_L=(-10, 0, 0), head=(12, 0, 0)), ease="out"),
                                           K(40, TALL_COVER)], "cover", blend_in=2, blend_out=3, note="magazine swap at the chest"))
    clips.append(clip("cover-hit", 14, [K(0, TALL_COVER, ease="linear"), K(4, TALL_COVER, pose(chest=(-12, 0, 4), head=(-10, 0, -6), pelvis={"loc": (0, -.03, -.04)}), ease="out"), K(14, TALL_COVER)],
                      "cover", blend_in=1, blend_out=2, note="flinch against the wall"))
    clips.append(clip("cover-leave-step", 14, [K(0, TALL_COVER, ease="linear"), K(7, HALF_CROUCH, pose(chest=(10, 0, 0), thigh_R=(30, 0, 4), shin_R=(-20, 0, 0)), ease="out"), K(14, NEUTRAL)],
                      "cover", blend_in=2, blend_out=2, note="step away from the wall"))
    clips.append(clip("cover-leave-run", 16, [K(0, TALL_COVER, ease="linear"), K(8, pose(chest=(16, 0, 0), head=(-8, 0, 0), thigh_R=(24, 0, 0), shin_R=(-30, 0, 0), thigh_L=(-12, 0, 0), forearm_R=(30, 0, 0), upper_arm_L=(14, 0, 0), forearm_L=(30, 0, 0), pelvis={"loc": (0, -.03, .02)}), ease="out"), K(16, RUN_LEG_A)],
                      "cover", blend_in=2, blend_out=2, note="push off the wall into the run cycle"))
    tuck_arms = pose(upper_arm_R=(70, 0, -20), forearm_R=(120, 0, 0), upper_arm_L=(70, 0, 20), forearm_L=(120, 0, 0), head=(20, 0, 0))
    tuck_legs = pose(thigh_R=(100, 0, 4), shin_R=(-126, 0, 0), thigh_L=(100, 0, -4), shin_L=(-126, 0, 0))
    clips.append(clip("cover-leave-roll", 30, [K(0, SHORT_COVER, ease="linear"),
                                               K(6, tuck_arms, tuck_legs, pose(chest=(30, 0, 0), pelvis={"rot": (50, 0, 0), "loc": (0, -.52, .08)}), ease="in"),
                                               K(12, tuck_arms, tuck_legs, pose(chest=(30, 0, 0), pelvis={"rot": (150, 0, 0), "loc": (0, -.72, .06)}), ease="linear"),
                                               K(18, tuck_arms, tuck_legs, pose(chest=(30, 0, 0), pelvis={"rot": (250, 0, 0), "loc": (0, -.70, 0)}), ease="linear"),
                                               K(24, HALF_CROUCH, pose(chest=(24, 0, 0), pelvis={"rot": (340, 0, 0), "loc": (0, -.32, -.04)}, upper_arm_R=(30, 0, -10), forearm_R=(60, 0, 0), upper_arm_L=(30, 0, 10), forearm_L=(60, 0, 0)), ease="out"),
                                               K(30, NEUTRAL)], "cover", blend_in=2, blend_out=3, interruptible=False, note="roll out from crouched cover"))
    return clips


# ------------------------------------------------------------------ traversal
def traversal():
    clips = []
    reach = pose(upper_arm_R=(166, 0, -14), forearm_R=(6, 0, 0), upper_arm_L=(166, 0, 14), forearm_L=(6, 0, 0), chest=(-6, 0, 0), head=(-22, 0, 0))
    clips.append(clip("mantle", 40, [K(0, reach, pose(pelvis={"loc": (0, .04, 0)}, foot_R=(-20, 0, 0), foot_L=(-20, 0, 0))),
                                     K(10, pose(upper_arm_R=(120, 0, -14), forearm_R=(80, 0, 0), upper_arm_L=(120, 0, 14), forearm_L=(80, 0, 0), chest=(24, 0, 0), head=(-14, 0, 0), thigh_R=(96, 0, 10), shin_R=(-110, 0, 0), thigh_L=(20, 0, -6), shin_L=(-30, 0, 0), pelvis={"loc": (0, .10, .04)}), ease="in"),
                                     K(22, pose(upper_arm_R=(70, 0, -20), forearm_R=(30, 0, 0), upper_arm_L=(70, 0, 20), forearm_L=(30, 0, 0), chest=(40, 0, 0), head=(-20, 0, 0), thigh_R=(90, 0, 14), shin_R=(-70, 0, 0), thigh_L=(60, 0, -10), shin_L=(-110, 0, 0), pelvis={"loc": (0, -.06, .10)}), ease="in-out"),
                                     K(32, HALF_CROUCH, pose(chest=(14, 0, 0), upper_arm_R=(20, 0, -14), forearm_R=(40, 0, 0), upper_arm_L=(20, 0, 14), forearm_L=(40, 0, 0), pelvis={"loc": (0, -.20, .04)}), ease="out"),
                                     K(40, NEUTRAL)], "traversal", blend_in=2, blend_out=3, interruptible=False, note="reach, pull, knee up, step over; the sim supplies the vertical travel"))
    clips.append(clip("vault", 30, [K(0, HALF_CROUCH, pose(chest=(28, 0, 0), head=(-14, 0, 0), upper_arm_R=(80, 0, -16), forearm_R=(10, 0, 0), upper_arm_L=(80, 0, 16), forearm_L=(10, 0, 0))),
                                    K(10, pose(chest=(46, 0, 0), head=(-20, 0, 0), upper_arm_R=(96, 0, -20), forearm_R=(4, 0, 0), upper_arm_L=(96, 0, 20), forearm_L=(4, 0, 0), thigh_R=(104, 0, 12), shin_R=(-120, 0, 0), thigh_L=(96, 0, -12), shin_L=(-116, 0, 0), pelvis={"loc": (0, .14, .06)}), ease="in"),
                                    K(18, pose(chest=(24, 0, 0), head=(-10, 0, 0), upper_arm_R=(40, 0, -30), forearm_R=(20, 0, 0), upper_arm_L=(40, 0, 30), forearm_L=(20, 0, 0), thigh_R=(40, 0, 8), shin_R=(-50, 0, 0), thigh_L=(30, 0, -8), shin_L=(-40, 0, 0), pelvis={"loc": (0, .02, .02)}), ease="linear"),
                                    K(24, CROUCH, pose(chest=(20, 0, 0), upper_arm_R=(24, 0, -24), forearm_R=(40, 0, 0), upper_arm_L=(24, 0, 24), forearm_L=(40, 0, 0), pelvis={"loc": (0, -.30, 0)}), ease="in"),
                                    K(30, NEUTRAL)], "traversal", blend_in=2, blend_out=3, interruptible=False, note="hands down, legs tuck over low cover, land"))
    clips.append(clip("drop", 24, [K(0, pose(chest=(8, 0, 0), head=(6, 0, 0), thigh_R=(30, 0, 6), shin_R=(-20, 0, 0), foot_R=(-16, 0, 0), thigh_L=(-6, 0, -6), upper_arm_R=(20, 0, -50), forearm_R=(30, 0, 0), upper_arm_L=(20, 0, 50), forearm_L=(30, 0, 0))),
                                   K(10, pose(chest=(4, 0, 0), head=(4, 0, 0), thigh_R=(16, 0, 8), shin_R=(-30, 0, 0), thigh_L=(16, 0, -8), shin_L=(-30, 0, 0), foot_R=(-14, 0, 0), foot_L=(-14, 0, 0), upper_arm_R=(40, 0, -70), forearm_R=(24, 0, 0), upper_arm_L=(40, 0, 70), forearm_L=(24, 0, 0)), ease="linear"),
                                   K(16, CROUCH, pose(chest=(24, 0, 0), upper_arm_R=(30, 0, -30), forearm_R=(50, 0, 0), upper_arm_L=(30, 0, 30), forearm_L=(50, 0, 0), pelvis={"loc": (0, -.32, .02)}), ease="in"),
                                   K(24, NEUTRAL)], "traversal", blend_in=2, blend_out=3, note="short hop down with a landing squash"))
    return clips


# ------------------------------------------------------------------ weapons
def weapons():
    clips = []
    kick_light = pose(chest=(4, 0, -2), upper_arm_R=(30, -2, -7), forearm_R=(74, 0, 0), hand_R=(-15, 0, -2), upper_arm_L=(20, 0, 11), forearm_L=(78, 0, 0))
    clips.append(clip("fire-rifle", 10, [K(0, LONG_GUN, pose(chest=(3, 0, -6), upper_arm_R=(24, -2, -4), forearm_R=(86, 0, 0), hand_R=(-12, 0, -2), upper_arm_L=(42, 0, 14), forearm_L=(58, 0, 0)), ease="linear"), K(10, LONG_GUN)],
                      "weapon", blend_in=1, blend_out=2, note="two-handed rifle shot, light kick; poses the coin blaster as the stand-in prop"))
    clips.append(clip("fire-shotgun", 16, [K(0, LONG_GUN, pose(chest=(-6, 0, -6), head=(2, 0, 4), upper_arm_R=(16, -2, -4), forearm_R=(92, 0, 0), hand_R=(-16, 0, -2), upper_arm_L=(36, 0, 14), forearm_L=(64, 0, 0), pelvis={"loc": (0, -.02, -.03)}), ease="linear"),
                                           K(5, LONG_GUN, ease="out"),
                                           K(10, LONG_GUN, pose(upper_arm_L=(40, 0, 14), forearm_L=(72, 0, 0), hand_L=(-12, 0, 6)), ease="in-out"),
                                           K(16, LONG_GUN)], "weapon", blend_in=1, blend_out=2, note="heavy kick then a pump with the left hand"))
    braced = merge(LONG_GUN, pose(chest=(12, 0, -6), head=(-6, 0, 4), thigh_R=(18, 0, 8), shin_R=(-28, 0, 0), thigh_L=(-8, 0, -8), shin_L=(-16, 0, 0), pelvis={"loc": (0, -.06, .02)}))
    clips.append(clip("fire-heavy", 20, [K(0, braced, ease="linear"), K(4, braced, pose(chest=(9, 0, -6), upper_arm_R=(26, -2, -4), forearm_R=(84, 0, 0)), ease="linear"),
                                         K(8, braced, ease="linear"), K(12, braced, pose(chest=(9, 0, -6), upper_arm_R=(26, -2, -4), forearm_R=(84, 0, 0)), ease="linear"),
                                         K(16, braced, ease="linear"), K(20, braced, pose(chest=(9, 0, -6), upper_arm_R=(26, -2, -4), forearm_R=(84, 0, 0)), ease="linear")],
                      "weapon", loop=True, blend_in=2, blend_out=2, note="braced sustained fire, shaking at 15 Hz"))
    shoulder = pose(chest=(0, 0, -10), head=(-4, 0, 10), upper_arm_R=(84, 0, -30), forearm_R=(126, 0, 0), hand_R=(-20, 0, 0), upper_arm_L=(70, 0, 20), forearm_L=(60, 0, 0), hand_L=(-10, 0, 10),
                    thigh_R=(12, 0, 8), shin_R=(-20, 0, 0), thigh_L=(-6, 0, -8), shin_L=(-12, 0, 0), pelvis={"loc": (0, -.04, 0)})
    clips.append(clip("fire-launcher", 24, [K(0, shoulder, ease="linear"), K(3, shoulder, pose(chest=(-14, 0, -10), head=(2, 0, 10), pelvis={"loc": (0, -.06, -.06)}, upper_arm_R=(76, 0, -30)), ease="out"),
                                            K(12, shoulder, pose(chest=(-4, 0, -10), pelvis={"loc": (0, -.05, -.02)}), ease="in-out"), K(24, shoulder)],
                      "weapon", blend_in=2, blend_out=3, note="shoulder-mounted launch with a backward kick"))
    clips.append(clip("recoil-light", 8, [K(0, kick_light, ease="linear"), K(8, AIM_ARMS)], "weapon", blend_in=1, blend_out=1, note="pistol-class kick layered on aim"))
    clips.append(clip("recoil-heavy", 14, [K(0, AIM_ARMS, pose(chest=(-8, 0, -2), head=(4, 0, 0), upper_arm_R=(22, -2, -7), forearm_R=(84, 0, 0), hand_R=(-22, 0, -2), upper_arm_L=(14, 0, 11), forearm_L=(84, 0, 0), thigh_R=(-8, 0, 0), shin_R=(-10, 0, 0), pelvis={"loc": (0, -.03, -.05)}), ease="linear"),
                                           K(6, AIM_ARMS, pose(chest=(2, 0, -2), pelvis={"loc": (0, -.02, -.02)}), ease="out"), K(14, AIM_ARMS)], "weapon", blend_in=1, blend_out=2, note="heavy kick with a half step back"))
    chest_gun = pose(chest=(6, 0, -4), head=(16, 0, -6), upper_arm_R=(46, 0, -12), forearm_R=(112, 0, 0), hand_R=(-10, 0, 22))
    clips.append(clip("reload-pistol", 30, [K(0, AIM_ARMS, ease="linear"), K(6, chest_gun, pose(upper_arm_L=(30, 0, 16), forearm_L=(96, 0, 0), hand_L=(-20, 0, 0)), ease="out"),
                                            K(12, chest_gun, pose(upper_arm_L=(38, 0, 18), forearm_L=(120, 0, 0), hand_L=(-34, 0, 0)), ease="in"),
                                            K(18, chest_gun, pose(upper_arm_L=(44, 0, 16), forearm_L=(108, 0, 0), hand_L=(-8, 0, 0), hand_R=(-14, 0, 24)), ease="out"),
                                            K(23, chest_gun, pose(upper_arm_L=(40, 0, 14), forearm_L=(98, 0, 0), hand_L=(-6, 0, 0), hand_R=(-6, 0, 20)), ease="in"),
                                            K(30, AIM_ARMS)], "weapon", blend_in=2, blend_out=2, note="magazine drop, insert, rack"))
    low_gun = pose(chest=(10, 0, -8), head=(20, 0, 6), upper_arm_R=(16, 0, -6), forearm_R=(70, 0, 0), hand_R=(-6, 0, 0))
    clips.append(clip("reload-long", 50, [K(0, LONG_GUN, ease="linear"), K(8, low_gun, pose(upper_arm_L=(20, 0, 14), forearm_L=(30, 0, 0)), ease="out"),
                                          K(18, low_gun, pose(upper_arm_L=(-6, 0, 14), forearm_L=(36, 0, 0), hand_L=(-20, 0, 0)), ease="in-out"),
                                          K(28, low_gun, pose(upper_arm_L=(34, 0, 12), forearm_L=(84, 0, 0), hand_L=(-24, 0, 0)), ease="in"),
                                          K(36, low_gun, pose(upper_arm_L=(44, 0, 12), forearm_L=(70, 0, 0), hand_L=(-8, 0, 0), head=(14, 0, 8)), ease="out"),
                                          K(42, low_gun, pose(upper_arm_L=(30, 0, 12), forearm_L=(90, 0, 0), hand_L=(-4, 0, 0)), ease="in"),
                                          K(50, LONG_GUN)], "weapon", blend_in=2, blend_out=3, note="long-gun reload at the hip, charging handle at the end"))
    clips.append(clip("reload-heavy", 70, [K(0, LONG_GUN, ease="linear"), K(12, HALF_CROUCH, low_gun, pose(upper_arm_L=(20, 0, 14), forearm_L=(40, 0, 0), chest=(22, 0, -6)), ease="out"),
                                           K(26, HALF_CROUCH, low_gun, pose(upper_arm_L=(50, 0, 10), forearm_L=(96, 0, 0), hand_L=(-30, 0, 0), chest=(22, 0, -2), head=(24, 0, 0)), ease="in-out"),
                                           K(38, HALF_CROUCH, low_gun, pose(upper_arm_L=(46, 0, 10), forearm_L=(80, 0, 0), hand_L=(10, 0, 0), chest=(20, 0, -2), head=(22, 0, 0)), ease="in-out"),
                                           K(50, HALF_CROUCH, low_gun, pose(upper_arm_L=(52, 0, 10), forearm_L=(92, 0, 0), hand_L=(-20, 0, 0), chest=(20, 0, -6), head=(20, 0, 4)), ease="in-out"),
                                           K(60, low_gun, pose(upper_arm_L=(36, 0, 12), forearm_L=(70, 0, 0)), ease="out"), K(70, LONG_GUN)],
                      "weapon", blend_in=2, blend_out=3, note="crouched belt swap on the heavy"))
    clips.append(clip("weapon-swap", 18, [K(0, AIM_ARMS, ease="linear"), K(5, pose(chest=(6, 0, -6), head=(4, 0, 8), upper_arm_R=(-24, 0, -14), forearm_R=(50, 0, 0), hand_R=(10, 0, 0), upper_arm_L=(8, 0, 8), forearm_L=(24, 0, 0)), ease="out"),
                                          K(11, pose(chest=(6, 0, -4), head=(0, 0, 4), upper_arm_R=(10, 0, -10), forearm_R=(100, 0, 0), hand_R=(-10, 0, 0), upper_arm_L=(14, 0, 8), forearm_L=(40, 0, 0)), ease="in-out"),
                                          K(18, AIM_ARMS)], "weapon", blend_in=1, blend_out=2, note="stow at the hip, draw the next weapon to aim"))
    return clips


# ------------------------------------------------------------------ melee, grenade
def melee():
    clips = []
    legs = pose(thigh_R=(7, 0, 0), shin_R=(-8, 0, 0), thigh_L=(-5, 0, 0), shin_L=(-6, 0, 0), pelvis={"loc": (0, .012, 0)}, upper_arm_L=(-12, 0, 0), forearm_L=(72, 0, 0))
    clips.append(clip("melee-1", 20, [K(0, legs, pose(chest=(9, 0, 6), upper_arm_R=(46, 0, -44), forearm_R=(80, 0, 0), hand_R=(-6, 0, 4)), ease="linear"),
                                      K(4, legs, pose(chest=(9, 0, 10), upper_arm_R=(60, 0, -50), forearm_R=(84, 0, 0), hand_R=(-6, 0, 6)), ease="out"),
                                      K(10, legs, pose(chest=(10, -4, -34), upper_arm_R=(26, 0, 24), forearm_R=(40, 0, 0), hand_R=(-4, 0, 18), thigh_R=(16, 0, 0), thigh_L=(-12, 0, 0)), ease="in"),
                                      K(20, legs, pose(chest=(9, 0, -10), upper_arm_R=(30, 0, 0), forearm_R=(50, 0, 0), hand_R=(-4, 0, 6)))],
                      "melee", blend_in=1, blend_out=2, prop="knife", note="fast forehand slash"))
    clips.append(clip("melee-2", 22, [K(0, legs, pose(chest=(9, 0, -12), upper_arm_R=(30, 0, 34), forearm_R=(70, 0, 0), hand_R=(-4, 0, 20)), ease="linear"),
                                      K(5, legs, pose(chest=(8, 0, -22), upper_arm_R=(40, 0, 44), forearm_R=(84, 0, 0), hand_R=(-4, 0, 26)), ease="out"),
                                      K(11, legs, pose(chest=(10, 4, 28), upper_arm_R=(50, 0, -52), forearm_R=(30, 0, 0), hand_R=(-6, 0, -10), thigh_L=(14, 0, 0), thigh_R=(-10, 0, 0)), ease="in"),
                                      K(22, legs, pose(chest=(9, 0, 8), upper_arm_R=(34, 0, -20), forearm_R=(50, 0, 0), hand_R=(-4, 0, 0)))],
                      "melee", blend_in=1, blend_out=2, prop="knife", note="backhand return slash"))
    clips.append(clip("melee-finisher", 36, [K(0, legs, pose(chest=(9, 0, 4), upper_arm_R=(46, 0, -44), forearm_R=(80, 0, 0), hand_R=(-6, 0, 4)), ease="linear"),
                                             K(8, pose(chest=(-12, 0, 6), head=(-10, 0, 0), upper_arm_R=(156, 0, -12), forearm_R=(64, 0, 0), hand_R=(-30, 0, 0), upper_arm_L=(20, 0, 20), forearm_L=(60, 0, 0), thigh_R=(-14, 0, 0), shin_R=(-20, 0, 0), thigh_L=(10, 0, 0), pelvis={"loc": (0, -.02, -.04)}), ease="out"),
                                             K(14, pose(chest=(46, 0, 4), head=(-20, 0, 0), upper_arm_R=(84, 0, 0), forearm_R=(16, 0, 0), hand_R=(-10, 0, 0), upper_arm_L=(30, 0, 30), forearm_L=(40, 0, 0), thigh_R=(46, 0, 4), shin_R=(-34, 0, 0), thigh_L=(-26, 0, -4), shin_L=(-14, 0, 0), foot_L=(20, 0, 0), pelvis={"loc": (0, -.12, .10)}), ease="in"),
                                             K(24, pose(chest=(40, 0, 2), head=(-16, 0, 0), upper_arm_R=(80, 0, 0), forearm_R=(20, 0, 0), hand_R=(-10, 0, 0), upper_arm_L=(30, 0, 30), forearm_L=(40, 0, 0), thigh_R=(44, 0, 4), shin_R=(-34, 0, 0), thigh_L=(-24, 0, -4), shin_L=(-14, 0, 0), foot_L=(20, 0, 0), pelvis={"loc": (0, -.12, .10)}), ease="hold"),
                                             K(36, legs, pose(chest=(9, 0, 0), upper_arm_R=(36, 0, -14), forearm_R=(60, 0, 0)))],
                      "melee", blend_in=1, blend_out=3, prop="knife", interruptible=False, note="overhead stab with a lunge, held on impact"))
    return clips


def grenade():
    clips = []
    stagger = pose(thigh_R=(12, 0, 0), shin_R=(-9, 0, 0), thigh_L=(-7, 0, 0), shin_L=(-5, 0, 0), pelvis={"loc": (0, .014, 0)}, upper_arm_L=(-10, 0, 0), forearm_L=(28, 0, 0))
    clips.append(clip("throw-short", 28, [K(0, stagger, pose(chest=(4, 0, -6), head=(-4, 0, 0), upper_arm_R=(-46, 0, -12), forearm_R=(12, 0, 0), hand_R=(6, 0, 0)), ease="linear"),
                                          K(8, stagger, pose(chest=(0, 0, -10), head=(-6, 0, 0), upper_arm_R=(-56, 0, -14), forearm_R=(10, 0, 0), hand_R=(10, 0, 0)), ease="out"),
                                          K(14, stagger, pose(chest=(8, 0, 8), head=(-6, 0, 0), upper_arm_R=(58, 0, -12), forearm_R=(2, 0, 0), hand_R=(-16, 0, 0), thigh_L=(10, 0, 0), thigh_R=(-6, 0, 0)), ease="in"),
                                          K(20, stagger, pose(chest=(6, 0, 12), upper_arm_R=(80, 0, -10), forearm_R=(6, 0, 0), hand_R=(-20, 0, 0), thigh_L=(14, 0, 0), thigh_R=(-8, 0, 0)), ease="out"),
                                          K(28, stagger, pose(chest=(2, 0, 0), upper_arm_R=(24, 0, -13), forearm_R=(-10, 0, 0), hand_R=(-10, 0, 0)))],
                      "grenade", blend_in=1, blend_out=2, prop="frag", prop_release_tick=14, note="underhand lob, grenade leaves the hand at tick 14"))
    clips.append(clip("throw-long", 34, [K(0, stagger, pose(chest=(-4, 0, -6), head=(-4, 0, 0), upper_arm_R=(70, 0, -20), forearm_R=(50, 0, 0), hand_R=(3, 0, 0)), ease="linear"),
                                         K(10, stagger, pose(chest=(-7.4, 0, -14), head=(-5, 0, 0), upper_arm_R=(118, 0, -28), forearm_R=(32, 0, 0), hand_R=(3, 0, 0), thigh_R=(14, 0, 0), thigh_L=(-10, 0, 0)), ease="out"),
                                         K(18, stagger, pose(chest=(6, 0, 10), head=(-2, 0, 0), upper_arm_R=(66, 0, -22), forearm_R=(38, 0, 0), hand_R=(21, 0, 0), thigh_L=(22, 0, 0), shin_L=(-12, 0, 0), thigh_R=(-14, 0, 0), pelvis={"loc": (0, .014, .04)}), ease="in"),
                                         K(26, stagger, pose(chest=(10, 0, 16), upper_arm_R=(30, 0, -14), forearm_R=(-6, 0, 0), hand_R=(-10, 0, 0), thigh_L=(20, 0, 0), shin_L=(-10, 0, 0), thigh_R=(-12, 0, 0), pelvis={"loc": (0, .014, .04)}), ease="out"),
                                         K(34, stagger, pose(chest=(2, 0, 2), upper_arm_R=(24, 0, -13), forearm_R=(-10, 0, 0), hand_R=(-10, 0, 0)))],
                      "grenade", blend_in=1, blend_out=2, prop="frag", prop_release_tick=18, note="overhand throw with a step, release at tick 18"))
    return clips


# ------------------------------------------------------------------ damage, deaths
def damage():
    clips = []
    base = merge(FLINCH)
    clips.append(clip("hit-front", 12, [K(0, base, pose(chest=(-14, 0, 2), head=(-12, 0, -2), thigh_R=(-10, 0, 0), shin_R=(-12, 0, 0), pelvis={"loc": (0, -.02, -.05)}), ease="linear"),
                                        K(4, base, pose(chest=(-8, 2, 2), head=(-6, 0, -2), pelvis={"loc": (0, -.02, -.03)}), ease="out"), K(12, AIM_ARMS)],
                      "damage", blend_in=1, blend_out=2, note="struck from the front, thrown back"))
    clips.append(clip("hit-back", 12, [K(0, base, pose(chest=(16, 0, -2), head=(14, 0, 2), thigh_L=(10, 0, 0), shin_L=(-10, 0, 0), upper_arm_R=(40, -2, -7), upper_arm_L=(34, 0, 11), pelvis={"loc": (0, -.03, .05)}), ease="linear"),
                                       K(4, base, pose(chest=(10, 0, -2), head=(8, 0, 0), pelvis={"loc": (0, -.02, .03)}), ease="out"), K(12, AIM_ARMS)],
                      "damage", blend_in=1, blend_out=2, note="struck from behind, folds forward"))
    hit_left = clip("hit-left", 12, [K(0, base, pose(chest=(-2, 2, 16), head=(-2, 0, 12), pelvis={"loc": (-.04, -.02, 0)}, thigh_R=(4, 0, 12), shin_R=(-10, 0, 0)), ease="linear"),
                                     K(4, base, pose(chest=(-2, 2, 10), head=(-2, 0, 6), pelvis={"loc": (-.03, -.02, 0)}), ease="out"), K(12, AIM_ARMS)],
                    "damage", blend_in=1, blend_out=2, note="struck on the hero's left, bends away to the right")
    clips.append(hit_left)
    clips.append(mirrored_clip(hit_left, "hit-right", "struck on the hero's right (mirror)"))
    return clips


def deaths():
    clips = []
    clips.append(clip("death-front", 60, [K(0, pose(chest=(12, 0, 0), head=(-6, 0, 0), upper_arm_R=(20, 0, -10), forearm_R=(30, 0, 0), upper_arm_L=(20, 0, 10), forearm_L=(30, 0, 0)), ease="linear"),
                                          K(14, pose(chest=(34, 0, 4), head=(-12, 0, 0), thigh_R=(50, 0, 6), shin_R=(-96, 0, 0), thigh_L=(46, 0, -6), shin_L=(-90, 0, 0), upper_arm_R=(40, 0, -20), forearm_R=(40, 0, 0), upper_arm_L=(40, 0, 20), forearm_L=(40, 0, 0), pelvis={"rot": (18, 0, 0), "loc": (0, -.44, .02)}), ease="in"),
                                          K(30, LYING_FRONT, pose(pelvis={"rot": (80, 0, 0), "loc": (0, -.80, .10)}, chest=(-4, 0, 0), head=(-12, 0, 0)), ease="in"),
                                          K(36, LYING_FRONT, ease="out"), K(60, LYING_FRONT)],
                      "death", blend_in=2, blend_out=0, interruptible=False, prop="none", note="knees buckle, falls face down"))
    clips.append(clip("death-back", 60, [K(0, pose(chest=(-12, 0, 0), head=(-8, 0, 0), upper_arm_R=(30, 0, -20), forearm_R=(20, 0, 0), upper_arm_L=(30, 0, 20), forearm_L=(20, 0, 0)), ease="linear"),
                                         K(12, pose(chest=(-26, 0, 4), head=(-14, 0, 0), thigh_R=(30, 0, 8), shin_R=(-40, 0, 0), thigh_L=(10, 0, -8), shin_L=(-20, 0, 0), upper_arm_R=(50, 0, -50), forearm_R=(30, 0, 0), upper_arm_L=(50, 0, 50), forearm_L=(30, 0, 0), pelvis={"rot": (-30, 0, 0), "loc": (0, -.30, -.12)}), ease="in"),
                                         K(28, LYING_BACK, pose(pelvis={"rot": (-84, 0, 0), "loc": (0, -.84, -.06)}, thigh_R=(14, 0, 8), shin_R=(-26, 0, 0), head=(16, 0, 0)), ease="in"),
                                         K(36, LYING_BACK, ease="out"), K(60, LYING_BACK)],
                      "death", blend_in=2, blend_out=0, interruptible=False, prop="none", note="thrown backwards onto the back"))
    clips.append(clip("death-explode", 60, [K(0, pose(chest=(-20, 0, 6), head=(-16, 0, 0), upper_arm_R=(60, 0, -80), forearm_R=(10, 0, 0), upper_arm_L=(60, 0, 80), forearm_L=(10, 0, 0), thigh_R=(20, 0, 24), thigh_L=(20, 0, -24), pelvis={"loc": (0, .04, -.04)}), ease="linear"),
                                            K(10, pose(chest=(-34, 0, 10), head=(-20, 0, 8), upper_arm_R=(90, 0, -90), forearm_R=(6, 0, 0), upper_arm_L=(90, 0, 90), forearm_L=(6, 0, 0), thigh_R=(40, 0, 30), shin_R=(-30, 0, 0), thigh_L=(30, 0, -30), shin_L=(-20, 0, 0), pelvis={"rot": (-40, 0, 0), "loc": (0, .30, -.18)}), ease="out"),
                                            K(24, LYING_BACK, pose(pelvis={"rot": (-84, 0, 0), "loc": (0, -.70, -.16)}, upper_arm_R=(40, 0, -80), upper_arm_L=(30, 0, 70), thigh_R=(20, 0, 20), shin_R=(-30, 0, 0), thigh_L=(-6, 0, -20), head=(20, 0, 10)), ease="in"),
                                            K(30, LYING_BACK, pose(pelvis={"rot": (-86, 0, 0), "loc": (0, -.86, -.16)}, upper_arm_R=(40, 0, -80), upper_arm_L=(30, 0, 70), thigh_R=(16, 0, 20), shin_R=(-26, 0, 0), thigh_L=(-6, 0, -20), head=(20, 0, 10)), ease="out"),
                                            K(60, LYING_BACK, pose(pelvis={"rot": (-86, 0, 0), "loc": (0, -.86, -.16)}, upper_arm_R=(40, 0, -80), upper_arm_L=(30, 0, 70), thigh_R=(16, 0, 20), shin_R=(-26, 0, 0), thigh_L=(-6, 0, -20), head=(20, 0, 10)))],
                      "death", blend_in=1, blend_out=0, interruptible=False, prop="none", note="blown off the feet, sprawls on the back"))
    return clips


# ------------------------------------------------------------------ ceremony, interaction, hazard
def ceremony():
    clips = []
    clips.append(clip("spawn", 40, [K(0, KNEEL, pose(chest=(24, 0, 0), head=(20, 0, 0), upper_arm_R=(30, 0, -10), forearm_R=(70, 0, 0), upper_arm_L=(40, 0, 10), forearm_L=(60, 0, 0)), ease="linear"),
                                    K(12, KNEEL, pose(chest=(16, 0, 0), head=(-10, 0, 0), upper_arm_R=(30, 0, -10), forearm_R=(70, 0, 0), upper_arm_L=(40, 0, 10), forearm_L=(60, 0, 0)), ease="in-out"),
                                    K(28, HALF_CROUCH, pose(chest=(6, 0, 0), head=(-6, 0, 0), upper_arm_R=(20, 0, -8), forearm_R=(50, 0, 0), upper_arm_L=(16, 0, 8), forearm_L=(40, 0, 0)), ease="in-out"),
                                    K(40, NEUTRAL)], "ceremony", blend_in=0, blend_out=3, interruptible=False, note="kneeling touchdown, look up, rise"))
    hero_pose = pose(chest=(-8, 0, 4), head=(-14, 0, -4), upper_arm_R=(168, 0, -16), forearm_R=(10, 0, 0), hand_R=(-20, 0, 0), upper_arm_L=(110, 0, 24), forearm_L=(100, 0, 0), hand_L=(-20, 0, 0),
                     thigh_R=(-8, 0, 6), shin_R=(-4, 0, 0), thigh_L=(20, 0, -8), shin_L=(-14, 0, 0), pelvis={"loc": (.02, -.02, .02)})
    clips.append(clip("victory", 90, [K(0, pose(chest=(6, 0, 0), upper_arm_R=(40, 0, -20), forearm_R=(80, 0, 0), upper_arm_L=(30, 0, 20), forearm_L=(70, 0, 0), thigh_L=(10, 0, -4), pelvis={"loc": (0, -.06, 0)}), ease="linear"),
                                      K(12, hero_pose, pose(pelvis={"loc": (.02, .02, .02)}), ease="out"),
                                      K(20, hero_pose, ease="in-out"),
                                      K(40, hero_pose, pose(upper_arm_L=(100, 0, 24), forearm_L=(110, 0, 0), pelvis={"loc": (.02, -.03, .02)}), ease="in-out"),
                                      K(52, hero_pose, pose(pelvis={"loc": (.02, .01, .02)}), ease="in-out"),
                                      K(90, hero_pose, wobble(90, 2, 1))], "ceremony", blend_in=2, blend_out=4, interruptible=False, note="pistol thrust overhead, fist pump, hold"))
    spread = pose(chest=(-10, 0, 0), head=(-18, 0, 0), upper_arm_R=(64, 0, -74), forearm_R=(12, 0, 0), hand_R=(-20, 0, 0), upper_arm_L=(64, 0, 74), forearm_L=(12, 0, 0), hand_L=(-20, 0, 0), foot_R=(-18, 0, 0), foot_L=(-18, 0, 0), pelvis={"loc": (0, .05, 0)})
    clips.append(clip("level-up", 60, [K(0, HALF_CROUCH, pose(chest=(14, 0, 0), head=(6, 0, 0), upper_arm_R=(20, 0, -14), forearm_R=(60, 0, 0), upper_arm_L=(20, 0, 14), forearm_L=(60, 0, 0)), ease="linear"),
                                       K(14, spread, ease="out"), K(26, spread, pose(pelvis={"loc": (0, .03, 0)}, head=(-14, 0, 0)), ease="in-out"),
                                       K(38, spread, pose(pelvis={"loc": (0, .05, 0)}), ease="in-out"),
                                       K(50, pose(chest=(-2, 0, 0), head=(-6, 0, 0), upper_arm_R=(30, 0, -30), forearm_R=(40, 0, 0), upper_arm_L=(30, 0, 30), forearm_L=(40, 0, 0)), ease="in-out"),
                                       K(60, NEUTRAL)], "ceremony", blend_in=2, blend_out=3, note="arms flung wide, rising on the toes"))
    slide = pose(chest=(16, 0, 6), head=(-10, 0, -6), thigh_R=(84, 0, 10), shin_R=(-14, 0, 0), foot_R=(16, 0, 0), thigh_L=(66, 0, -10), shin_L=(-124, 0, 0), foot_L=(30, 0, 0), pelvis={"loc": (.03, -.46, .06)},
                 upper_arm_L=(40, 0, 30), forearm_L=(40, 0, 0), hand_L=(-20, 0, 0))
    clips.append(clip("multikill", 48, [K(0, HALF_CROUCH, pose(chest=(20, 0, 0), upper_arm_R=(30, 0, -10), forearm_R=(60, 0, 0)), ease="linear"),
                                        K(8, slide, pose(upper_arm_R=(50, 0, -20), forearm_R=(90, 0, 0), hand_R=(-10, 0, 0)), ease="out"),
                                        K(16, slide, pose(upper_arm_R=(110, 0, -20), forearm_R=(110, 0, 0), hand_R=(-20, 0, 0), chest=(10, 0, 8)), ease="out"),
                                        K(24, slide, pose(upper_arm_R=(96, 0, -18), forearm_R=(120, 0, 0), hand_R=(-20, 0, 0), chest=(12, 0, 8)), ease="in-out"),
                                        K(36, HALF_CROUCH, pose(chest=(12, 0, 0), upper_arm_R=(40, 0, -14), forearm_R=(80, 0, 0), upper_arm_L=(20, 0, 14), forearm_L=(50, 0, 0)), ease="in-out"),
                                        K(48, NEUTRAL)], "ceremony", blend_in=2, blend_out=3, note="knee slide with a fist pump after a multi-kill from cover"))
    return clips


def interaction():
    clips = []
    push = pose(chest=(16, 0, 0), head=(-8, 0, 0), upper_arm_R=(72, 0, -16), forearm_R=(18, 0, 0), hand_R=(-16, 0, 0), upper_arm_L=(72, 0, 16), forearm_L=(18, 0, 0), hand_L=(-16, 0, 0),
                thigh_L=(22, 0, -4), shin_L=(-14, 0, 0), thigh_R=(-12, 0, 4), shin_R=(-4, 0, 0), foot_R=(16, 0, 0), pelvis={"loc": (0, -.05, .04)})
    clips.append(clip("interact-door", 30, [K(0, pose(chest=(6, 0, 0), upper_arm_R=(40, 0, -14), forearm_R=(40, 0, 0), upper_arm_L=(40, 0, 14), forearm_L=(40, 0, 0)), ease="linear"),
                                            K(10, push, pose(upper_arm_R=(60, 0, -16), forearm_R=(40, 0, 0), upper_arm_L=(60, 0, 16), forearm_L=(40, 0, 0), pelvis={"loc": (0, -.04, .02)}), ease="out"),
                                            K(20, push, pose(chest=(22, 0, 0), pelvis={"loc": (0, -.06, .09)}), ease="in"),
                                            K(30, pose(chest=(4, 0, 0), upper_arm_R=(20, 0, -10), forearm_R=(30, 0, 0), upper_arm_L=(20, 0, 10), forearm_L=(30, 0, 0)))],
                      "interaction", blend_in=2, blend_out=3, prop="none", note="two-handed door push"))
    clips.append(clip("interact-lever", 30, [K(0, pose(chest=(4, 0, -4), head=(-10, 0, 4), upper_arm_R=(110, 0, -16), forearm_R=(20, 0, 0), hand_R=(-10, 0, 0), upper_arm_L=(10, 0, 8), forearm_L=(30, 0, 0)), ease="linear"),
                                             K(8, pose(chest=(0, 0, -6), head=(-14, 0, 6), upper_arm_R=(124, 0, -18), forearm_R=(14, 0, 0), hand_R=(-16, 0, 0), upper_arm_L=(10, 0, 8), forearm_L=(30, 0, 0), pelvis={"loc": (0, .02, 0)}), ease="out"),
                                             K(18, HALF_CROUCH, pose(chest=(24, 0, -4), head=(-4, 0, 4), upper_arm_R=(36, 0, -12), forearm_R=(66, 0, 0), hand_R=(-10, 0, 0), upper_arm_L=(14, 0, 8), forearm_L=(40, 0, 0), pelvis={"loc": (0, -.16, .02)}), ease="in"),
                                             K(30, pose(chest=(4, 0, 0), upper_arm_R=(20, 0, -10), forearm_R=(40, 0, 0), upper_arm_L=(10, 0, 8), forearm_L=(30, 0, 0)))],
                      "interaction", blend_in=2, blend_out=3, prop="none", note="reach up and haul the lever down"))
    hold = pose(chest=(10, 0, 0), head=(6, 0, 0), thigh_R=(6, 0, 6), shin_R=(-10, 0, 0), thigh_L=(6, 0, -6), shin_L=(-10, 0, 0), pelvis={"loc": (0, -.04, 0)})
    def crank(x_r, z_r, x_l, z_l, twist):
        return merge(hold, pose(upper_arm_R=(x_r, 0, z_r), forearm_R=(44, 0, 0), hand_R=(-10, 0, 0), upper_arm_L=(x_l, 0, z_l), forearm_L=(44, 0, 0), hand_L=(-10, 0, 0), chest=(10, 0, twist)))
    clips.append(clip("interact-valve", 60, [K(0, crank(40, -4, 62, 4, -6), ease="linear"), K(15, crank(62, -14, 62, 24, 0), ease="linear"),
                                             K(30, crank(62, 4, 40, 4, 6), ease="linear"), K(45, crank(40, 14, 40, -14, 0), ease="linear")],
                      "interaction", loop=True, blend_in=3, blend_out=3, prop="none", note="two-handed wheel crank"))
    clips.append(clip("interact-button", 20, [K(0, pose(chest=(4, 0, -4), upper_arm_R=(70, 0, -12), forearm_R=(20, 0, 0), hand_R=(-10, 0, 0), upper_arm_L=(6, 0, 8), forearm_L=(24, 0, 0)), ease="linear"),
                                              K(8, pose(chest=(8, 0, -6), upper_arm_R=(84, 0, -12), forearm_R=(6, 0, 0), hand_R=(-16, 0, 0), upper_arm_L=(6, 0, 8), forearm_L=(24, 0, 0), pelvis={"loc": (0, -.01, .03)}), ease="in"),
                                              K(12, pose(chest=(8, 0, -6), upper_arm_R=(84, 0, -12), forearm_R=(6, 0, 0), hand_R=(-16, 0, 0), upper_arm_L=(6, 0, 8), forearm_L=(24, 0, 0), pelvis={"loc": (0, -.01, .03)}), ease="hold"),
                                              K(20, pose(chest=(2, 0, 0), upper_arm_R=(20, 0, -10), forearm_R=(30, 0, 0), upper_arm_L=(6, 0, 8), forearm_L=(24, 0, 0)))],
                      "interaction", blend_in=2, blend_out=2, prop="none", note="press a wall button"))
    clips.append(clip("pickup", 30, [K(0, HALF_CROUCH, pose(chest=(22, 0, 4), head=(-4, 0, 0), upper_arm_R=(30, 0, -10), forearm_R=(20, 0, 0), upper_arm_L=(10, 0, 10), forearm_L=(40, 0, 0)), ease="linear"),
                                     K(10, CROUCH, pose(chest=(34, 0, 6), head=(-6, 0, 0), upper_arm_R=(66, 0, -10), forearm_R=(6, 0, 0), hand_R=(-10, 0, 0), upper_arm_L=(20, 0, 12), forearm_L=(60, 0, 0), pelvis={"loc": (0, -.42, .04)}), ease="in"),
                                     K(16, CROUCH, pose(chest=(34, 0, 6), head=(-6, 0, 0), upper_arm_R=(60, 0, -10), forearm_R=(30, 0, 0), hand_R=(-16, 0, 0), upper_arm_L=(20, 0, 12), forearm_L=(60, 0, 0), pelvis={"loc": (0, -.42, .04)}), ease="out"),
                                     K(30, pose(chest=(2, 0, 0), upper_arm_R=(30, 0, -10), forearm_R=(90, 0, 0), hand_R=(-10, 0, 0), upper_arm_L=(6, 0, 8), forearm_L=(30, 0, 0)))],
                      "interaction", blend_in=2, blend_out=3, prop="none", note="crouch, grab, stand with the item"))
    return clips


def hazard():
    clips = []
    wade = pose(chest=(8, 0, 0), head=(-6, 0, 0), upper_arm_R=(20, 0, -44), forearm_R=(34, 0, 0), upper_arm_L=(20, 0, 44), forearm_L=(34, 0, 0))
    clips.append(clip("water-wade", 48, [K(0, wade, pose(thigh_R=(52, 0, 4), shin_R=(-76, 0, 0), foot_R=(-10, 0, 0), thigh_L=(-14, 0, -4), shin_L=(-12, 0, 0), pelvis={"loc": (0, -.04, 0)}, chest=(8, 0, 6)), ease="in-out"),
                                         K(12, wade, pose(thigh_R=(16, 0, 4), shin_R=(-20, 0, 0), thigh_L=(-2, 0, -4), shin_L=(-16, 0, 0), pelvis={"loc": (0, -.08, 0)}), ease="in-out"),
                                         K(24, wade, pose(thigh_L=(52, 0, -4), shin_L=(-76, 0, 0), foot_L=(-10, 0, 0), thigh_R=(-14, 0, 4), shin_R=(-12, 0, 0), pelvis={"loc": (0, -.04, 0)}, chest=(8, 0, -6)), ease="in-out"),
                                         K(36, wade, pose(thigh_L=(16, 0, -4), shin_L=(-20, 0, 0), thigh_R=(-2, 0, 4), shin_R=(-16, 0, 0), pelvis={"loc": (0, -.08, 0)}), ease="in-out")],
                      "hazard", loop=True, blend_in=4, blend_out=4, note="high-knee slog through water, arms out for balance"))
    clips.append(clip("hazard-flinch", 16, [K(0, pose(chest=(-12, 0, 6), head=(-6, 0, 16), upper_arm_L=(112, 0, 20), forearm_L=(104, 0, 0), hand_L=(-20, 0, 0), upper_arm_R=(24, 0, -10), forearm_R=(60, 0, 0), thigh_R=(-16, 0, 4), shin_R=(-24, 0, 0), thigh_L=(8, 0, -4), pelvis={"loc": (0, -.06, -.06)}), ease="linear"),
                                            K(6, pose(chest=(-8, 0, 4), head=(-4, 0, 12), upper_arm_L=(100, 0, 20), forearm_L=(110, 0, 0), hand_L=(-20, 0, 0), upper_arm_R=(24, 0, -10), forearm_R=(60, 0, 0), thigh_R=(-10, 0, 4), shin_R=(-14, 0, 0), pelvis={"loc": (0, -.04, -.04)}), ease="out"),
                                            K(16, NEUTRAL)], "hazard", blend_in=1, blend_out=2, note="shield the face and hop back from a hazard"))
    return clips


# ------------------------------------------------------------------ idle fidgets (presentation only)
def fidgets():
    clips = []
    relaxed = pose(pelvis={"loc": (.03, -.01, 0)}, thigh_L=(2, 0, -8), shin_L=(-6, 0, 0), thigh_R=(-2, 0, 2))
    # Lit Commando
    shoulder = merge(relaxed, pose(chest=(-5, 0, 0), head=(0, -12, 0), upper_arm_R=(36, 0, -16), forearm_R=(142, 0, 0), hand_R=(-32, 0, 0), upper_arm_L=(4, 0, 6), forearm_L=(20, 0, 0)))
    clips.append(clip("fidget-shoulder-pose", 150, [K(0), K(20, shoulder, ease="out"), K(60, shoulder, wobble(60, 2, 1)), K(100, shoulder, wobble(100, 2, 2), pose(head=(-4, 8, 0))), K(130, shoulder, ease="in-out"), K(150, NEUTRAL)],
                      "fidget", blend_in=6, blend_out=6, heroes=("lit-commando",), note="gun rested on the shoulder, scanning"))
    phone = merge(relaxed, pose(head=(4, 0, 10), upper_arm_L=(60, 0, 16), forearm_L=(140, 0, 0), hand_L=(-24, 0, 0), upper_arm_R=(4, 0, -6), forearm_R=(20, 0, 0)))
    clips.append(clip("fidget-flip-phone", 180, [K(0), K(18, relaxed, pose(upper_arm_L=(30, 0, 16), forearm_L=(110, 0, 0), hand_L=(-24, 0, 0), head=(14, 0, 4)), ease="out"),
                                                 K(30, relaxed, pose(upper_arm_L=(34, 0, 16), forearm_L=(116, 0, 0), hand_L=(-40, 0, 0), head=(16, 0, 4)), ease="in-out"),
                                                 K(48, phone, ease="in-out"), K(100, phone, wobble(100, 1.5, 1)), K(140, phone, wobble(140, 1.5, 2), pose(head=(2, 0, 12))),
                                                 K(160, relaxed, pose(upper_arm_L=(30, 0, 16), forearm_L=(100, 0, 0), hand_L=(-10, 0, 0), head=(12, 0, 2)), ease="in-out"), K(180, NEUTRAL)],
                      "fidget", blend_in=6, blend_out=6, prop="none", heroes=("lit-commando",), note="checks an old flip phone"))
    knuckles = merge(relaxed, pose(chest=(6, 0, 0), head=(14, 0, 0), upper_arm_R=(46, 0, -10), forearm_R=(104, 0, 0), hand_R=(0, 30, 0), upper_arm_L=(46, 0, 10), forearm_L=(104, 0, 0), hand_L=(0, -30, 0)))
    stretch = merge(relaxed, pose(chest=(-8, 0, 0), head=(-14, 0, 0), upper_arm_R=(170, 0, -12), forearm_R=(8, 0, 0), hand_R=(-10, 0, 0), upper_arm_L=(170, 0, 12), forearm_L=(8, 0, 0), hand_L=(-10, 0, 0), pelvis={"loc": (0, .02, 0)}))
    clips.append(clip("fidget-knuckles-stretch", 160, [K(0), K(20, knuckles, ease="out"), K(34, knuckles, pose(hand_R=(0, 44, 0), hand_L=(0, -44, 0), chest=(7, 0, 0)), ease="in"),
                                                       K(40, knuckles, pose(hand_R=(0, 20, 0), hand_L=(0, -20, 0)), ease="out"), K(60, knuckles, wobble(60, 1, 1)),
                                                       K(84, stretch, ease="in-out"), K(110, stretch, pose(chest=(-10, 0, 3), pelvis={"loc": (.02, .03, 0)}), ease="in-out"),
                                                       K(140, relaxed, pose(upper_arm_R=(30, 0, -20), forearm_R=(40, 0, 0), upper_arm_L=(30, 0, 20), forearm_L=(40, 0, 0)), ease="in-out"), K(160, NEUTRAL)],
                      "fidget", blend_in=6, blend_out=6, prop="none", heroes=("lit-commando",), note="cracks knuckles, stretches overhead"))
    salute = merge(pose(chest=(-6, 0, 0), head=(0, 0, 0), upper_arm_R=(84, 0, -44), forearm_R=(132, 0, 0), hand_R=(0, 0, 24), upper_arm_L=(-2, 0, 2), forearm_L=(6, 0, 0), thigh_L=(0, 0, -2), thigh_R=(0, 0, 2)))
    clips.append(clip("fidget-salute", 120, [K(0), K(14, salute, pose(upper_arm_R=(70, 0, -40), forearm_R=(120, 0, 0)), ease="out"), K(22, salute, ease="in"), K(80, salute, wobble(80, 1, 1)),
                                             K(100, pose(chest=(-2, 0, 0), upper_arm_R=(20, 0, -14), forearm_R=(40, 0, 0)), ease="in-out"), K(120, NEUTRAL)],
                      "fidget", blend_in=6, blend_out=6, prop="none", heroes=("lit-commando",), note="stands to attention and salutes"))
    # Lit Valkyrie
    selfie = merge(pose(pelvis={"loc": (.05, -.02, 0)}, thigh_R=(2, 0, 8), thigh_L=(4, 0, -12), shin_L=(-10, 0, 0), chest=(-4, 0, 6), head=(-6, 8, -10),
                        upper_arm_L=(124, 0, 26), forearm_L=(12, 0, 0), hand_L=(-24, 0, 0), upper_arm_R=(14, 0, -8), forearm_R=(30, 0, 0)))
    clips.append(clip("fidget-selfie", 150, [K(0), K(22, selfie, ease="out"), K(50, selfie, pose(upper_arm_R=(62, 0, -22), forearm_R=(124, 0, 0), hand_R=(-10, 0, 20), head=(-8, 10, -14)), ease="in-out"),
                                             K(80, selfie, pose(upper_arm_R=(62, 0, -22), forearm_R=(124, 0, 0), hand_R=(-10, 0, 20), head=(-4, 6, -8), chest=(-4, 0, 8)), ease="in-out"),
                                             K(110, selfie, pose(head=(10, 4, -4), upper_arm_L=(60, 0, 20), forearm_L=(110, 0, 0)), ease="in-out"), K(150, NEUTRAL)],
                      "fidget", blend_in=6, blend_out=6, prop="none", heroes=("lit-valkyrie",), note="takes a selfie, checks it"))
    hair = pose(upper_arm_R=(112, 0, -42), forearm_R=(132, 0, 0), hand_R=(20, 0, 0), chest=(-2, 0, -4))
    band = pose(upper_arm_R=(104, 0, -30), forearm_R=(142, 0, 0), hand_R=(10, 0, 0), upper_arm_L=(104, 0, 30), forearm_L=(142, 0, 0), hand_L=(10, 0, 0), chest=(-4, 0, 0), head=(-6, 0, 0))
    clips.append(clip("fidget-hair-flip", 120, [K(0), K(16, hair, pose(head=(4, 0, -22)), ease="out"), K(26, hair, pose(head=(-10, 0, 18), upper_arm_R=(96, 0, -56), chest=(-4, 0, 6)), ease="in"),
                                                K(40, hair, pose(head=(-2, 0, 4)), ease="out"), K(60, band, ease="in-out"), K(82, band, pose(hand_R=(0, 0, 10), hand_L=(0, 0, -10), head=(-8, 0, 0)), ease="in-out"),
                                                K(100, pose(upper_arm_R=(30, 0, -14), forearm_R=(50, 0, 0), upper_arm_L=(30, 0, 14), forearm_L=(50, 0, 0)), ease="in-out"), K(120, NEUTRAL)],
                      "fidget", blend_in=6, blend_out=6, prop="none", heroes=("lit-valkyrie",), note="hair flip, headband fix"))
    lunge = pose(thigh_R=(56, 0, 6), shin_R=(-62, 0, 0), foot_R=(6, 0, 0), thigh_L=(-36, 0, -4), shin_L=(-8, 0, 0), foot_L=(30, 0, 0), pelvis={"loc": (0, -.36, .06)}, chest=(22, 0, 0), head=(-14, 0, 0),
                 upper_arm_R=(62, 0, -12), forearm_R=(40, 0, 0), hand_R=(-16, 0, 0), upper_arm_L=(62, 0, 12), forearm_L=(40, 0, 0), hand_L=(-16, 0, 0))
    clips.append(clip("fidget-sprinter-stretch", 160, [K(0), K(24, lunge, ease="out"), K(48, lunge, pose(pelvis={"loc": (0, -.42, .06)}, thigh_R=(60, 0, 6), shin_R=(-70, 0, 0)), ease="in-out"),
                                                       K(66, lunge, ease="in-out"), K(84, lunge, pose(pelvis={"loc": (0, -.42, .06)}, thigh_R=(60, 0, 6), shin_R=(-70, 0, 0)), ease="in-out"),
                                                       K(104, lunge, ease="in-out"), K(134, HALF_CROUCH, pose(chest=(10, 0, 0), upper_arm_R=(20, 0, -10), forearm_R=(40, 0, 0), upper_arm_L=(20, 0, 10), forearm_L=(40, 0, 0)), ease="in-out"), K(160, NEUTRAL)],
                      "fidget", blend_in=6, blend_out=6, prop="none", heroes=("lit-valkyrie",), note="sprinter's lunge stretch with two bounces"))
    chew = merge(relaxed, pose(chest=(2, 0, 0), head=(-6, 0, 0)))
    clips.append(clip("fidget-bubble-gum", 140, [K(0), K(16, chew, ease="out"), K(28, chew, pose(head=(-6, 0, 3)), ease="in-out"), K(40, chew, pose(head=(-6, 0, -3)), ease="in-out"),
                                                 K(52, chew, pose(head=(-5, 0, 2)), ease="in-out"), K(70, chew, pose(head=(-10, 0, 0), chest=(0, 0, 0)), ease="in-out"), K(96, chew, pose(head=(-12, 0, 0)), ease="in-out"),
                                                 K(100, chew, pose(head=(-2, 0, 4)), ease="in"), K(116, chew, pose(upper_arm_L=(60, 0, 12), forearm_L=(138, 0, 0), hand_L=(-10, 0, 0), head=(2, 0, 2)), ease="in-out"), K(140, NEUTRAL)],
                      "fidget", blend_in=6, blend_out=6, heroes=("lit-valkyrie",), note="chews, blows a bubble, pops it and wipes"))
    # Lester
    flip = merge(relaxed, pose(upper_arm_R=(30, 0, -10), forearm_R=(110, 0, 0), hand_R=(20, 0, 0), head=(14, 0, 4)))
    clips.append(clip("fidget-coin-flip", 150, [K(0), K(18, flip, ease="out"), K(30, flip, pose(hand_R=(30, 0, 0)), ease="in-out"), K(34, flip, pose(hand_R=(-34, 0, 0), forearm_R=(118, 0, 0), head=(0, 0, 2)), ease="out"),
                                                K(50, flip, pose(hand_R=(-10, 0, 0), forearm_R=(112, 0, 0), head=(-26, 0, 0)), ease="in-out"), K(66, flip, pose(hand_R=(0, 0, 0), forearm_R=(104, 0, 0), head=(-12, 0, 0)), ease="in"),
                                                K(74, flip, pose(hand_R=(10, 0, 0), forearm_R=(92, 0, 0), head=(12, 0, 4)), ease="out"), K(100, flip, pose(forearm_R=(96, 0, 0), head=(22, 0, 10), chest=(2, 0, 4)), ease="in-out"),
                                                K(124, flip, pose(forearm_R=(96, 0, 0), head=(20, 0, 8)), ease="in-out"), K(150, NEUTRAL)],
                      "fidget", blend_in=6, blend_out=6, prop="none", heroes=("lester-original",), note="flips a Litecoin, watches it, catches it"))
    sit = pose(pelvis={"loc": (0, -.56, 0)}, thigh_R=(92, 0, 58), shin_R=(-124, 0, 0), foot_R=(-10, 0, 0), thigh_L=(92, 0, -58), shin_L=(-124, 0, 0), foot_L=(-10, 0, 0), chest=(-2, 0, 0), head=(-4, 0, 0),
               upper_arm_R=(32, 0, -22), forearm_R=(62, 0, 0), hand_R=(-40, 0, 0), upper_arm_L=(32, 0, 22), forearm_L=(62, 0, 0), hand_L=(-40, 0, 0))
    clips.append(clip("fidget-meditate", 180, [K(0), K(30, CROUCH, pose(pelvis={"loc": (0, -.46, 0)}, upper_arm_R=(20, 0, -14), forearm_R=(50, 0, 0), upper_arm_L=(20, 0, 14), forearm_L=(50, 0, 0)), ease="in-out"),
                                               K(52, sit, ease="in-out"), K(80, sit, pose(pelvis={"loc": (0, -.50, 0)}), ease="in-out"), K(108, sit, pose(pelvis={"loc": (0, -.54, 0)}), ease="in-out"),
                                               K(130, sit, pose(pelvis={"loc": (0, -.50, 0)}), ease="in-out"), K(160, CROUCH, pose(pelvis={"loc": (0, -.44, 0)}, chest=(20, 0, 0), upper_arm_R=(20, 0, -14), forearm_R=(50, 0, 0), upper_arm_L=(20, 0, 14), forearm_L=(50, 0, 0)), ease="in-out"), K(180, NEUTRAL)],
                      "fidget", blend_in=6, blend_out=6, prop="none", heroes=("lester-original",), note="sits cross-legged and floats"))
    book = merge(relaxed, pose(head=(26, 0, 0), chest=(4, 0, 0), upper_arm_R=(44, 0, -8), forearm_R=(100, 0, 0), hand_R=(0, 20, 0), upper_arm_L=(44, 0, 8), forearm_L=(100, 0, 0), hand_L=(0, -20, 0)))
    clips.append(clip("fidget-read-book", 160, [K(0), K(20, book, ease="out"), K(60, book, wobble(60, 1.5, 1)), K(74, book, pose(hand_R=(0, 20, 26), forearm_R=(96, 0, 0)), ease="in-out"),
                                                K(86, book, pose(hand_R=(0, 20, -8)), ease="in-out"), K(96, book, ease="in-out"), K(130, book, wobble(130, 1.5, 2), pose(head=(24, 0, 4))),
                                                K(160, NEUTRAL)], "fidget", blend_in=6, blend_out=6, prop="none", heroes=("lester-original",), note="reads a Hard Money book, turns a page"))
    polish = merge(relaxed, pose(head=(0, 0, 8), chest=(-2, 0, -4), upper_arm_R=(120, 0, -32), forearm_R=(140, 0, 0), hand_R=(0, 0, 10), upper_arm_L=(4, 0, 6), forearm_L=(16, 0, 0)))
    clips.append(clip("fidget-polish-head", 140, [K(0), K(20, polish, ease="out"), K(34, polish, pose(upper_arm_R=(126, 0, -46), forearm_R=(136, 0, 0)), ease="in-out"), K(48, polish, pose(upper_arm_R=(112, 0, -40), forearm_R=(146, 0, 0)), ease="in-out"),
                                                  K(62, polish, pose(upper_arm_R=(126, 0, -46), forearm_R=(136, 0, 0)), ease="in-out"), K(76, polish, pose(upper_arm_R=(112, 0, -40), forearm_R=(146, 0, 0)), ease="in-out"),
                                                  K(92, polish, pose(head=(-6, 0, 10)), ease="in-out"), K(116, relaxed, pose(upper_arm_R=(30, 0, -14), forearm_R=(50, 0, 0), head=(0, 0, 4)), ease="in-out"), K(140, NEUTRAL)],
                      "fidget", blend_in=6, blend_out=6, prop="none", heroes=("lester-original",), note="polishes his round head"))
    # Lilly
    glasses = merge(relaxed, pose(upper_arm_R=(92, 0, -22), forearm_R=(142, 0, 0), hand_R=(8, 0, 0), head=(2, 0, 0)))
    tablet = merge(relaxed, pose(head=(22, 0, 2), chest=(3, 0, 0), upper_arm_L=(36, 0, 16), forearm_L=(102, 0, 0), hand_L=(-32, 0, 0), upper_arm_R=(42, 0, -10), forearm_R=(100, 0, 0), hand_R=(0, 0, 0)))
    clips.append(clip("fidget-glasses-tablet", 160, [K(0), K(16, glasses, ease="out"), K(26, glasses, pose(hand_R=(16, 0, 0), head=(-2, 0, 0)), ease="in-out"), K(44, tablet, ease="in-out"),
                                                     K(60, tablet, pose(hand_R=(-12, 0, 0)), ease="in-out"), K(72, tablet, pose(hand_R=(6, 0, 0)), ease="in-out"), K(84, tablet, pose(hand_R=(-12, 0, 0), head=(20, 0, -2)), ease="in-out"),
                                                     K(110, tablet, pose(head=(18, 0, 4)), ease="in-out"), K(136, relaxed, pose(upper_arm_L=(20, 0, 12), forearm_L=(60, 0, 0), upper_arm_R=(20, 0, -10), forearm_R=(50, 0, 0)), ease="in-out"), K(160, NEUTRAL)],
                      "fidget", blend_in=6, blend_out=6, prop="none", heroes=("lilly",), note="pushes up her glasses, checks a tablet"))
    typing = merge(relaxed, pose(head=(10, 0, 0), chest=(5, 0, 0), upper_arm_R=(52, 0, -8), forearm_R=(78, 0, 0), hand_R=(-10, 0, 0), upper_arm_L=(52, 0, 8), forearm_L=(78, 0, 0), hand_L=(-10, 0, 0)))
    keys = [K(0), K(18, typing, ease="out")]
    for i in range(10):
        t = 24 + i * 9
        keys.append(K(t, typing, pose(hand_R=(-10 + (14 if i % 2 else -6), 0, 0), hand_L=(-10 + (-6 if i % 2 else 14), 0, 0), upper_arm_R=(52 + (3 if i % 3 == 0 else 0), 0, -8), upper_arm_L=(52 + (3 if i % 3 == 1 else 0), 0, 8)), ease="linear"))
    keys += [K(126, typing, pose(head=(6, 0, 6)), ease="in-out"), K(150, NEUTRAL)]
    clips.append(clip("fidget-air-code", 150, keys, "fidget", blend_in=6, blend_out=6, prop="none", heroes=("lilly",), note="types code in the air"))
    cup = merge(relaxed, pose(upper_arm_L=(22, 0, 10), forearm_L=(92, 0, 0), hand_L=(-20, 0, 0), upper_arm_R=(4, 0, -6), forearm_R=(20, 0, 0)))
    clips.append(clip("fidget-sip-coffee", 140, [K(0), K(18, cup, ease="out"), K(40, cup, pose(upper_arm_L=(40, 0, 16), forearm_L=(138, 0, 0), hand_L=(-30, 0, 0), head=(-10, 0, 0), chest=(-2, 0, 0)), ease="in-out"),
                                                 K(58, cup, pose(upper_arm_L=(42, 0, 16), forearm_L=(142, 0, 0), hand_L=(-34, 0, 0), head=(-14, 0, 0), chest=(-3, 0, 0)), ease="in-out"),
                                                 K(84, cup, pose(upper_arm_L=(40, 0, 16), forearm_L=(138, 0, 0), hand_L=(-30, 0, 0), head=(-10, 0, 0), chest=(-2, 0, 0)), ease="in-out"),
                                                 K(104, cup, pose(head=(2, 0, 4)), ease="in-out"), K(140, NEUTRAL)],
                      "fidget", blend_in=6, blend_out=6, prop="none", heroes=("lilly",), note="sips coffee"))
    twirl_arms = pose(upper_arm_R=(20, 0, -34), forearm_R=(20, 0, 0), upper_arm_L=(20, 0, 34), forearm_L=(20, 0, 0), chest=(-4, 0, 0), head=(-6, 0, 0))
    flare = pose(coat_tail_R=(-34, 0, -10), coat_tail_L=(-34, 0, 10))
    clips.append(clip("fidget-coat-twirl", 120, [K(0), K(14, twirl_arms, pose(root=(0, 0, 0), pelvis={"loc": (0, -.04, 0)}, thigh_R=(6, 0, 8), shin_R=(-12, 0, 0)), ease="in"),
                                                 K(28, twirl_arms, flare, pose(root=(0, 90, 0), pelvis={"loc": (0, -.02, 0)}), ease="linear"),
                                                 K(42, twirl_arms, scaled(flare, 1.2), pose(root=(0, 180, 0), pelvis={"loc": (0, .01, 0)}), ease="linear"),
                                                 K(56, twirl_arms, flare, pose(root=(0, 270, 0), pelvis={"loc": (0, -.02, 0)}), ease="linear"),
                                                 K(70, twirl_arms, scaled(flare, .5), pose(root=(0, 360, 0), pelvis={"loc": (0, -.04, 0)}, thigh_L=(6, 0, -8), shin_L=(-12, 0, 0)), ease="out"),
                                                 K(90, pose(root=(0, 360, 0), chest=(-5, 0, 6), head=(-4, 0, -8), pelvis={"loc": (.03, -.02, 0)}, thigh_L=(4, 0, -10), shin_L=(-8, 0, 0), upper_arm_R=(24, 0, -14), forearm_R=(60, 0, 0), upper_arm_L=(10, 0, 20), forearm_L=(30, 0, 0)), ease="in-out"),
                                                 K(120, pose(root=(0, 360, 0)))],
                      "fidget", blend_in=6, blend_out=6, heroes=("lilly",), note="full coat twirl into a pose"))
    return clips


def all_clips():
    clips = [*movement(), *evasion(), *cover(), *traversal(), *weapons(), *melee(), *grenade(), *damage(), *deaths(), *ceremony(), *interaction(), *hazard(), *fidgets()]
    names = [c.name for c in clips]
    if len(set(names)) != len(names):
        raise ValueError("duplicate clip names in the catalogue")
    if set(names) & set(NATIVE_CLIPS):
        raise ValueError("catalogue collides with native clip names")
    return clips


def clips_for_hero(hero):
    if hero not in HEROES:
        raise ValueError("unknown hero " + hero)
    return [c for c in all_clips() if c.heroes is None or hero in c.heroes]


def fidgets_for_hero(hero):
    return [c.name for c in clips_for_hero(hero) if c.category == "fidget"]


if __name__ == "__main__":
    for c in all_clips():
        print(f"{c.name:26s} {c.category:12s} {c.ticks:4d}t loop={int(c.loop)} in/out={c.blend_in}/{c.blend_out} prop={c.prop:7s} samples={c.sample_count()} {'' if c.heroes is None else c.heroes}")
    print(len(all_clips()), "clips")
