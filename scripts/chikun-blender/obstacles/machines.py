"""Drone, prop plane and the coin.

Drone collision: a capsule from x 20 to x 134 at o.y, radius 19. It is a
heavy-lift delivery drone: a long body and four ducted fans whose rings fill
the capsule's rounded ends (the near pair sits lower on screen, the far pair
higher), a parcel slung underneath. Four frames spin the rotors.

Plane collision: a capsule from x 20 to x 215 at o.y, radius 22.5. A high-wing
prop plane facing left, white with red trim, no text; four propeller frames.

Coin: radius 19 (obstacle coins; ground coins are 17 and use a second
prescale). Twelve frames of a spin about the screen's vertical axis, silver
with an embossed Ł on both faces.
"""
import bpy, math, random
from mathutils import Vector, Matrix
from . import mats, geo
from . import rig
from .rig import P

ROTOR_FRAMES = 4


def drone_frame():
    return (-10, -38, 174, 70)


def drone(ctx):
    coll = ctx['coll']
    shell = mats.paint('drone-shell', '#e9ecec', rough=0.35, grime=0.12, spec=0.6)
    dark = mats.paint('drone-dark', '#2b3036', rough=0.45, grime=0.1, spec=0.5, metal=0.3)
    accent = mats.paint('drone-accent', '#ef7a2c', rough=0.35, grime=0.05, spec=0.6)
    lens = mats.paint('drone-lens', '#0e1720', rough=0.05, spec=1.0)
    parcel = mats.paint('drone-parcel', '#b98b58', rough=0.85, grime=0.12, spec=0.2, scale=0.12)
    tape = mats.paint('drone-tape', '#d9c08e', rough=0.35, spec=0.6)
    led_r = mats.emissive('drone-led-red', '#ff3b30', body='#5a1410', strength=6.0, beauty=2.5)
    led_g = mats.emissive('drone-led-green', '#39ff7a', body='#0f4a22', strength=6.0, beauty=2.5)
    blade = mats.paint('drone-blade', '#1c1f23', rough=0.4)
    blur = mats.material('drone-blur', lambda nb: dict(color=nb.rgb('#9aa4ac'), rough=0.5, alpha=0.28))
    M = geo.Mesh('drone', [shell])
    # body
    M.blob(shell, P(77, -2, 0), 1.0, squash=(40, 18, 17), displace=0.0, subdiv=3)
    M.blob(dark, P(77, -14, 4), 1.0, squash=(20, 8, 8), displace=0.0, subdiv=3)
    M.blob(mats.paint('drone-dome', '#dfe6ea', rough=0.2, spec=0.8), P(77, -20, 4), 1.0, squash=(7, 5, 6), displace=0.0, subdiv=3)
    M.box(accent, P(77, -1, -15.5), (40, 1.2, 4.2 / rig.CP), bevel=0.5)
    M.blob(dark, P(77, 6, 0), 1.0, squash=(22, 12, 7), displace=0.0, subdiv=3)
    M.blob(lens, P(58, 8, -9), 3.4, squash=(1, 0.6, 1), subdiv=2)
    # parcel slung under the body
    M.box(dark, P(77, 12, 0), (4, 4, 6), bevel=0.5)
    M.box(parcel, P(77, 18, 0), (32, 18, 12 / rig.CP), bevel=0.8)
    M.box(tape, P(77, 18, -9.1), (5, 0.5, 12.2 / rig.CP))
    body = M.done(coll)
    # arms and ducts: (x, depth) near pair lower, far pair higher on screen
    rot = []
    D = geo.Mesh('drone-ducts', [dark])
    ducts = [(22, -22), (132, -22), (22, 22), (132, 22)]
    for (x, d) in ducts:
        hub = P(x, 0, d) + Vector((0, 0, 0))
        root = P(77 + (x - 77) * 0.35, -4, d * 0.4)
        D.cylinder(dark, root, hub, 2.6, segs=10)
        # the duct ring: a short open cylinder with a thick lip
        c = hub + Vector((0, 0, -3.0))
        D.cylinder(shell, c, c + Vector((0, 0, 7.0)), 18.0, segs=40, cap=False)
        D.cylinder(dark, c + Vector((0, 0, 6.2)), c + Vector((0, 0, 7.6)), 19.0, segs=40, cap=False)
        D.cylinder(accent, c + Vector((0, 0, 1.0)), c + Vector((0, 0, 2.6)), 18.25, segs=40, cap=False)
        D.cylinder(dark, c + Vector((0, 0, 2.0)), c + Vector((0, 0, 6.0)), 3.2, segs=12)
        led = led_r if x < 77 else led_g
        D.blob(led, c + Vector((0 if x < 77 else 0, -19.2, 3.5)), 1.6, subdiv=2)
    ducts_obj = D.done(coll)
    # rotors (spun per frame) with a translucent blur disc
    for (x, d) in ducts:
        c = P(x, 0, d) + Vector((0, 0, 2.2))
        R = geo.Mesh(f'rotor-{x}-{d}', [blade])
        for k in range(3):
            a = k / 3 * math.tau
            v = Vector((math.cos(a), math.sin(a), 0))
            wv = Vector((-v.y, v.x, 0)) * 1.8
            R.quad(blade, [v * 3 - wv, v * 16.5 - wv * 0.6, v * 16.5 + wv * 0.6, v * 3 + wv])
        R.cylinder(blur, Vector((0, 0, -0.2)), Vector((0, 0, 0.2)), 16.8, segs=36)
        ro = R.done(coll, location=c)
        rot.append(ro)

    def pose(i):
        for k, ro in enumerate(rot):
            ro.rotation_euler = (0, 0, (i / ROTOR_FRAMES) * (math.tau / 3) * (1 if k % 2 else -1) + k * 0.7)
    pose(0)
    return dict(objects=[body, ducts_obj] + rot, pose=pose)


def plane_frame():
    return (-16, -44, 270, 84)


def plane(ctx):
    coll = ctx['coll']
    white = mats.paint('plane-white', '#f1f0ea', rough=0.3, grime=0.08, spec=0.7)
    red = mats.paint('plane-red', '#c7322b', rough=0.3, grime=0.08, spec=0.7)
    navy = mats.paint('plane-navy', '#233a5a', rough=0.35, grime=0.06, spec=0.6)
    glass = mats.glass('plane-glass', tint='#1f3342', sky='#a9cde0')
    metal = mats.paint('plane-metal', '#9aa3a8', rough=0.3, metal=1.0, spec=0.8)
    tyre = mats.paint('plane-tyre', '#1a1a1a', rough=0.7)
    nav_r = mats.emissive('plane-nav-red', '#ff3b30', body='#7a1c16', strength=6.0, beauty=2.0)
    nav_g = mats.emissive('plane-nav-green', '#39ff7a', body='#145a2a', strength=6.0, beauty=2.0)
    strobe = mats.emissive('plane-strobe', '#ffffff', body='#bfc4c8', strength=5.0, beauty=1.0)
    blade = mats.paint('plane-prop', '#2a2a2a', rough=0.4)
    blur = mats.material('plane-blur', lambda nb: dict(color=nb.rgb('#b8c0c6'), rough=0.5, alpha=0.3))
    M = geo.Mesh('plane', [white])
    # fuselage: rings from the nose (x 10) to the tail (x 232), centre line at y 0
    prof = [(10, 14, 0), (18, 18.5, 0), (40, 21, -1), (80, 21, -1), (120, 18.5, 0), (160, 13.5, 1.5), (200, 9, 3), (232, 4.5, 4)]
    pts = [P(x, -dy, 0) for x, r, dy in prof]
    M.tube(white, pts, [r for x, r, dy in prof], segs=24)
    # cowling and a navy cheatline on the near side
    M.cylinder(red, P(9, 0, 0), P(24, 0, 0), 15.5, r2=18.8, segs=24)
    M.cylinder(metal, P(4.5, 0, 0), P(9.5, 0, 0), 6.5, r2=14.5, segs=24)
    M.tube(navy, [P(x, -dy + 6.8, -(r - 0.6)) for (x, r, dy) in prof[1:5]], 1.6, segs=8)
    # cabin windows (near side) and windshield
    for k in range(3):
        M.box(glass, P(64 + k * 17, -6, -21.2), (12, 1.5, 10 / rig.CP), bevel=1.2)
    M.box(glass, P(44, -12, -15), (11, 12, 9 / rig.CP), bevel=1.5)
    # high wing on top of the cabin: tapered, light grey top, red tips, span +-62
    wing_top = mats.paint('plane-wing', '#dcdcd6', rough=0.35, grime=0.1, spec=0.6)
    wz = P(80, -20.5, 0).z
    import bmesh
    before = set(M.bm.faces)
    for side in (-1, 1):
        root_le, root_te, tip_le, tip_te = 57.0, 103.0, 64.0, 98.0
        vs = [M.bm.verts.new(v) for v in ((root_le, 0, wz + 1.6), (root_te, 0, wz + 1.6), (tip_te, side * 62, wz + 3.2), (tip_le, side * 62, wz + 3.2))]
        f = M.bm.faces.new(vs if side > 0 else list(reversed(vs)))
        vb = [M.bm.verts.new(v) for v in ((root_le, 0, wz - 1.6), (root_te, 0, wz - 1.6), (tip_te, side * 62, wz + 0.4), (tip_le, side * 62, wz + 0.4))]
        fb = M.bm.faces.new(list(reversed(vb)) if side > 0 else vb)
        for a, b2 in ((0, 3), (1, 2)):
            M.bm.faces.new((vs[a], vs[b2], vb[b2], vb[a]))
    M._box_uv([f for f in M.bm.faces if f not in before])
    M._tag([f for f in M.bm.faces if f not in before], wing_top, False)
    M.box(red, Vector((81, -61.5, wz + 1.8)), (34, 3, 3.6), bevel=1.0)
    M.box(red, Vector((81, 61.5, wz + 1.8)), (34, 3, 3.6), bevel=1.0)
    M.blob(nav_r, Vector((66, -63.5, wz + 2)), 1.6, subdiv=2)
    M.blob(nav_g, Vector((66, 63.5, wz + 2)), 1.6, subdiv=2)
    for side in (-1, 1):
        M.cylinder(metal, P(76, 10, side * 12), Vector((84, side * 38, wz - 1)), 1.1, segs=8)
    # tail: stabiliser and fin
    tz = P(212, -4, 0).z
    M.box(wing_top, Vector((214, 0, tz)), (22, 50, 2.4), bevel=0.8)
    M.box(red, Vector((222, 0, tz + 0.2)), (8, 50.4, 2.4), bevel=0.6)
    from mathutils import Vector as V
    finM = [V((196, -1.3, P(196, -4, 0).z)), V((232, -1.3, P(232, -4, 0).z)), V((234, -1.3, P(234, -30, 0).z)), V((222, -1.3, P(222, -31, 0).z))]
    finB = [v + V((0, 2.6, 0)) for v in finM]
    M.quad(red, finM)
    M.quad(red, list(reversed(finB)))
    M.blob(strobe, V((233, 0, P(233, -30, 0).z)), 1.5, subdiv=2)
    # landing gear
    for side in (-1, 1):
        hub = P(70, 24, side * 14)
        M.cylinder(metal, P(76, 12, side * 8), hub, 1.3, segs=8)
        M.cylinder(tyre, hub + Vector((0, -2.2, 0)), hub + Vector((0, 2.2, 0)), 5.2, segs=20)
    M.cylinder(metal, P(214, 4, 0), P(214, 10, 0), 0.9, segs=6)
    M.cylinder(tyre, P(214, 11, 0) + Vector((0, -1.2, 0)), P(214, 11, 0) + Vector((0, 1.2, 0)), 2.2, segs=14)
    body = M.done(coll)
    # propeller: two blades in the y-z plane plus a blur disc, spun per frame
    R = geo.Mesh('prop', [blade])
    for k in range(2):
        a = k * math.pi
        v = Vector((0, math.cos(a), math.sin(a)))
        wv = Vector((0, -v.z, v.y)) * 1.6
        R.quad(blade, [v * 2 - wv, v * 19 - wv * 0.5, v * 19 + wv * 0.5, v * 2 + wv])
    R.cylinder(blur, Vector((-0.3, 0, 0)), Vector((0.3, 0, 0)), 19.0, segs=36)
    R.blob(metal, Vector((-1.5, 0, 0)), 3.6, squash=(1.3, 1, 1), subdiv=2)
    prop = R.done(coll, location=P(3.5, 0, 0))

    def pose(i):
        prop.rotation_euler = (i / ROTOR_FRAMES * math.pi, 0, 0)
    pose(0)
    return dict(objects=[body, prop], pose=pose)


# ---------------------------------------------------------------- coin

COIN_FRAMES = 12


def coin_frame():
    return (-24, -24, 48, 48)


def coin(ctx):
    coll = ctx['coll']
    silver = mats.coin_metal('coin-silver', base='#f4f8f8', dark='#b4c2c6', rough=0.32)
    rim = mats.coin_metal('coin-rim', base='#cfd8db', dark='#7f9095', rough=0.28)
    emboss = mats.paint('coin-glyph', '#1f5a63', rough=0.25, grime=0.05, spec=0.7)
    R, T = 18.6, 3.6
    M = geo.Mesh('coin', [silver])
    # disc along local z (the coin axis); edge reeding as fine boxes
    M.cylinder(rim, Vector((0, 0, -T / 2)), Vector((0, 0, T / 2)), R, segs=64, bevel=0.8)
    M.cylinder(silver, Vector((0, 0, T / 2 - 0.2)), Vector((0, 0, T / 2 + 0.3)), R - 2.6, segs=64)
    M.cylinder(silver, Vector((0, 0, -T / 2 - 0.3)), Vector((0, 0, -T / 2 + 0.2)), R - 2.6, segs=64)
    # raised inner ring on both faces
    for sgn in (1, -1):
        M.tube(rim, [Vector((math.cos(a) * (R - 3.2), math.sin(a) * (R - 3.2), sgn * (T / 2 + 0.35))) for a in [k / 48 * math.tau for k in range(49)]], 0.7, segs=6, cap=False)
    coin_obj = M.done(coll)
    glyphs = []
    for sgn in (1, -1):
        cu = bpy.data.curves.new(f'coin-glyph-{sgn}', 'FONT')
        cu.body = 'Ł'
        cu.size = 26.0
        cu.extrude = 0.7
        cu.bevel_depth = 0.25
        cu.align_x = 'CENTER'; cu.align_y = 'CENTER'
        g = bpy.data.objects.new(f'coin-glyph-{sgn}', cu)
        g.data.materials.append(emboss)
        coll.objects.link(g)
        g.parent = coin_obj
        g.location = (0.6, 0.4, sgn * (T / 2 + 0.5))
        if sgn < 0:
            g.rotation_euler = (0, math.pi, 0)
        glyphs.append(g)
    # face the camera, then spin about the screen's vertical axis
    face = Matrix.Rotation(0, 4, 'X')
    toward = -rig.VIEW
    base = toward.to_track_quat('Z', 'Y').to_matrix().to_4x4()

    def pose(i):
        a = i / COIN_FRAMES * math.tau
        spin = Matrix.Rotation(a, 4, rig.UP)
        coin_obj.matrix_world = spin @ base
    pose(0)
    return dict(objects=[coin_obj] + glyphs, pose=pose)
