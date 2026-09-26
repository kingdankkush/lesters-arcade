"""Animated creatures: hawk, eagle, pelican (8-frame flap) and the shiba (idle loop).

Birds fly toward Chikun (facing left) inside a capsule from x 20 to x 90 at the
obstacle's y, radius 19 (local y 0 is o.y). Wings are hinged feather-card rigs
parented at the shoulder; a frame is a rotation about the body's long axis, so
the flap is phase-locked by the runtime (index-seeded) and never touches the
collision. The shiba stands inside x 7..103, y -65..0 facing left; its idle loop
wags the tail, lifts the head for a bark and breathes.
"""
import bpy, math, random
from mathutils import Vector, Matrix, Euler
from . import mats, geo
from .rig import P, SP, CP

BIRDS = {
    'hawk': dict(body='#7a4a2a', dark='#3e2415', light='#c89a6a', belly='#e6d2b0', head=None, beak='#3a3a3a', cere='#e3b23c', tail='#a8492a', wing=('#4a2a18', '#8a5a34', '#d8c0a0'), tip='#2a1a10', bars=0.5),
    'eagle': dict(body='#3a2616', dark='#1e130b', light='#6a4a2e', belly='#3a2616', head='#f1ede2', beak='#e8b53a', cere='#e8b53a', tail='#f1ede2', wing=('#24170e', '#4a321e', '#7a5a3a'), tip='#140d08', bars=0.0),
    'pelican': dict(body='#e9e6de', dark='#9c9a94', light='#ffffff', belly='#f4f2ec', head='#f6f4ee', beak='#e8a23a', cere='#e8a23a', tail='#e0ddd4', wing=('#8e8c86', '#d8d5cc', '#f4f2ec'), tip='#202020', bars=0.0),
}
FLAP = [58, 44, 18, -16, -44, -54, -32, 22]   # wing angle (deg, + up) per frame: slow upstroke, strong downstroke


def bird_frame():
    return (-14, -42, 138, 72)


def _wing(kind, b, side, coll, shoulder, span=30.0):
    """A wing plan-form (leading edge, tapering chord) plus fingered primaries.
    Local axes: x along the body (+ toward the tail), y outward (span), z up."""
    import bmesh
    cov = mats.ramp_by_uv(f'{kind}-wingskin', [(0.0, b['wing'][2]), (0.3, b['wing'][1]), (0.75, b['wing'][0]), (1.0, b['tip'])], axis=0, sheen=0.3, translucent=0.1)
    prim = mats.ramp_by_uv(f'{kind}-primary', [(0.0, b['wing'][0]), (0.6, b['wing'][0]), (1.0, b['tip'])], axis=0, alpha_shape='feather', sheen=0.3)
    W = geo.Mesh(f'{kind}-wing-{side}', [cov])
    steps = 12
    le, te = [], []
    for k in range(steps + 1):
        t = k / steps
        y = side * span * t
        x_le = -5 - 8 * math.sin(t * math.pi * 0.5) + 5 * t ** 4
        x_te = 25 - 13 * t ** 1.6
        # a gentle camber: the wing arcs up toward the tip
        z = 2.0 * math.sin(t * math.pi)
        le.append(W.bm.verts.new((x_le, y, z)))
        te.append(W.bm.verts.new((x_te, y, z - 0.5)))
    before = set(W.bm.faces)
    for k in range(steps):
        f = W.bm.faces.new((le[k], le[k + 1], te[k + 1], te[k]) if side > 0 else (le[k + 1], le[k], te[k], te[k + 1]))
        for loop in f.loops:
            v = loop.vert
            u = 0.0 if v in le else 1.0
            loop[W.uv].uv = (u, abs(v.co.y) / span)
    W._tag([f for f in W.bm.faces if f not in before], cov, True)
    # fingered primaries at the tip, splayed backward
    for i in range(5):
        t = i / 4
        root = Vector((-4 + 10 * t, side * span * (0.84 - 0.1 * t), 1.6))
        ang = math.radians(-18 + 32 * t)
        d = Vector((math.sin(ang), side * math.cos(ang), 0.12)).normalized()
        L = 13 - 3 * t
        wv = Vector((d.y, -d.x, 0)).normalized() * 2.8
        W.quad(prim, [root - wv, root + d * L - wv * 0.4, root + d * L + wv * 0.4, root + wv])
    return W.done(coll, location=shoulder)


def bird(kind):
    def build(ctx):
        b = BIRDS[kind]
        coll = ctx['coll']
        body_m = mats.feathers(kind + '-body', b['body'], b['dark'], b['light'], bars=b['bars'], scale=0.45)
        belly_m = mats.feathers(kind + '-belly', b['belly'], b['dark'] if kind == 'hawk' else b['belly'], '#ffffff', bars=0.6 if kind == 'hawk' else 0.0, scale=0.7)
        head_m = mats.feathers(kind + '-head', b['head'] or b['body'], b['dark'] if not b['head'] else '#cfc9bb', b['light'] if not b['head'] else '#ffffff', scale=0.5)
        beak_m = mats.paint(kind + '-beak', b['beak'], rough=0.35, grime=0.1, spec=0.6)
        eye_m = mats.paint(kind + '-eye', '#0c0c0c', rough=0.1, spec=1.0)
        iris_m = mats.paint(kind + '-iris', '#f0c030' if kind != 'pelican' else '#9ac8e0', rough=0.2, spec=0.8)
        tail_m = mats.ramp_by_uv(kind + '-tailcard', [(0.0, b['tail']), (0.8, b['tail']), (1.0, b['dark'])], axis=0, alpha_shape='feather', sheen=0.3)
        M = geo.Mesh(kind + '-body', [body_m])
        big = 1.1 if kind == 'pelican' else 1.0
        # streamlined body along x, centred at (60, 0)
        M.blob(body_m, P(60, 0, 0), 1.0, squash=(36 * big, 15, 17 * big), displace=0.03, freq=1.0, subdiv=3)
        M.blob(belly_m, P(56, 6, -5), 1.0, squash=(28, 10, 12), displace=0.03, subdiv=3)
        # neck + head
        hx, hy = (23, -6) if kind != 'pelican' else (26, -9)
        M.blob(head_m, P(hx + 11, hy + 4, 0), 1.0, squash=(13, 10, 11), displace=0.02, subdiv=3)
        M.blob(head_m, P(hx, hy, 0), 11.0 if kind != 'pelican' else 10.0, squash=(1.1, 0.95, 1.0), displace=0.02, subdiv=3)
        if kind == 'pelican':
            M.blob(beak_m, P(hx - 16, hy + 2, 0), 1.0, squash=(17, 3.6, 3.4), displace=0.0, subdiv=3)
            pouch = mats.paint('pelican-pouch', '#d9884a', rough=0.5, grime=0.1)
            M.blob(pouch, P(hx - 13, hy + 7, 0), 1.0, squash=(12.5, 4.5, 5.0), displace=0.02, subdiv=3)
        else:
            M.cylinder(beak_m, P(hx - 8, hy + 1, 0), P(hx - 18, hy + 3, 0), 4.0, r2=0.8, segs=12)
            M.blob(beak_m, P(hx - 16.5, hy + 5, 0), 2.0, squash=(1, 1, 1.5), subdiv=2)
        M.blob(iris_m, P(hx - 4, hy - 3, -9.5), 2.4, squash=(1, 0.5, 1), subdiv=2)
        M.blob(eye_m, P(hx - 4.4, hy - 3, -10.6), 1.3, squash=(1, 0.5, 1), subdiv=2)
        # tail fan: broad overlapping feathers
        for i in range(7):
            a = (i - 3) * 0.14
            base = P(86, 1, 0) + Vector((0, math.sin(a) * 4, 0))
            d = Vector((1, math.sin(a) * 1.4, 0.02)).normalized()
            wv = Vector((-d.y, d.x, 0)).normalized() * 4.6
            L = 24
            M.quad(tail_m, [base - wv * 1.2, base + d * L - wv * 1.1, base + d * L + wv * 1.1, base + wv * 1.2])
        body = M.done(coll)
        shoulder = P(50, -5, 0)
        wings = [(_wing(kind, b, side, coll, shoulder), side) for side in (-1, 1)]

        def pose(i):
            a = math.radians(FLAP[i % len(FLAP)])
            lift = -0.9 * math.sin(i / len(FLAP) * math.tau)
            body.location.z = lift / CP
            for wo, side in wings:
                wo.rotation_euler = (side * a, 0.0, 0.0)
                wo.location.z = shoulder.z + lift / CP
        pose(0)
        return dict(objects=[body] + [w for w, _ in wings], pose=pose)
    return build


# ---------------------------------------------------------------- shiba

SHIBA_FRAMES = 12


def shiba_frame():
    return (-10, -84, 130, 92)


def shiba(ctx):
    coll = ctx['coll']
    fur = mats.fur('shiba-fur', '#c8702c', '#e29a52', '#8a4516')
    cream = mats.fur('shiba-cream', '#f2e3c8', '#fff6e6', '#d8c0a0')
    dark = mats.paint('shiba-nose', '#141210', rough=0.25, spec=0.8)
    eye = mats.paint('shiba-eye', '#1a120c', rough=0.08, spec=1.0)
    collar = mats.paint('shiba-collar', '#2f6db0', rough=0.4, spec=0.6)
    tag = mats.paint('shiba-tag', '#e8c24a', rough=0.25, metal=1.0, spec=0.9)
    tongue = mats.paint('shiba-tongue', '#d45a6a', rough=0.35, spec=0.6)
    B = geo.Mesh('shiba-body', [fur])
    # body and chest
    B.blob(fur, P(62, -33, 0), 1.0, squash=(34, 17, 17), displace=0.05, subdiv=3)
    B.blob(fur, P(66, -44, 4), 1.0, squash=(26, 9, 12), displace=0.06, subdiv=3)
    B.blob(cream, P(60, -24, -4), 1.0, squash=(27, 12, 11), displace=0.04, subdiv=3)
    B.blob(cream, P(34, -32, -3), 1.0, squash=(15, 15, 17), displace=0.05, subdiv=3)
    # legs: front pair and back pair (cream socks), thick haunches
    for (x, d) in ((33, -6), (41, 7), (80, -6), (88, 7)):
        top = P(x, -28, d); bot = P(x - 1, -4, d)
        B.cylinder(fur, top, bot, 7.4, r2=6.0, segs=12)
        B.blob(cream, P(x - 2, -3, d - 1), 1.0, squash=(7.6, 6.0, 5.2), subdiv=2)
    B.blob(fur, P(84, -30, 0), 1.0, squash=(16, 15, 16), displace=0.06, subdiv=3)
    # fluffy belly fur hanging between the legs
    B.blob(cream, P(60, -17, -2), 1.0, squash=(22, 6, 9), displace=0.12, freq=1.8, subdiv=3)
    # collar
    B.cylinder(collar, P(30, -40, 0) + Vector((2, 0, 0)), P(36, -44, 0), 11.5, segs=20)
    B.blob(tag, P(27, -34, -9), 2.2, squash=(1, 0.4, 1), subdiv=2)
    body = B.done(coll)
    # head group: pivots at the neck
    neck = P(32, -44, 0)
    H = geo.Mesh('shiba-head', [fur])
    hc = Vector((22, 0, 0))
    def at(sx, sy, d=0.0):
        return P(sx, sy, d) - neck
    H.blob(fur, at(24, -50, 0), 1.0, squash=(15, 13, 14), displace=0.03, subdiv=3)
    H.blob(cream, at(20, -45, -6), 1.0, squash=(10, 9, 10), displace=0.03, subdiv=3)      # cheek
    H.blob(cream, at(11, -44, -2), 1.0, squash=(9, 7, 6.5), displace=0.02, subdiv=3)      # muzzle
    H.blob(dark, at(3.5, -46, -3), 2.8, squash=(1, 0.9, 0.8), subdiv=2)                  # nose
    H.blob(eye, at(17, -54, -11), 2.2, squash=(1, 0.6, 1.1), subdiv=2)
    H.blob(cream, at(20, -58, -10), 1.0, squash=(3.2, 1.2, 1.4), subdiv=2)                # brow dot
    H.blob(tongue, at(10, -39, -3), 1.0, squash=(3.5, 1.4, 2.8), subdiv=2)
    for (ex, d) in ((20, -6), (31, 5)):
        base = at(ex, -58, d)
        H.cylinder(fur, base, base + (P(ex - 1, -67, d) - P(ex, -58, d)), 5.2, r2=0.6, segs=12)
        H.cylinder(cream, base + Vector((0, -1.8, 0.3)), base + (P(ex - 1, -65, d - 1.8) - P(ex, -58, d)), 3.0, r2=0.3, segs=10)
    head = H.done(coll, location=neck + Vector((6.0, 0.0, 0.0)))
    # tail: a curl over the rump, pivoting at its base
    tb = P(92, -40, 4)
    T = geo.Mesh('shiba-tail', [fur])
    pts, rad = [], []
    for k in range(13):
        a = math.pi * 0.95 * k / 12
        pts.append(Vector((math.sin(a) * 9 - 2, 0, 3 + (1 - math.cos(a)) * 10)))
        rad.append(6.5 - 3.5 * k / 12)
    T.tube(fur, [p * 1.25 for p in pts], [r * 1.3 for r in rad], segs=12)
    T.blob(cream, pts[6] * 1.25 + Vector((1, -5, 0)), 1.0, squash=(5.5, 4.5, 6), subdiv=2)
    tail = T.done(coll, location=tb)

    def pose(i):
        t = i / SHIBA_FRAMES * math.tau
        tail.rotation_euler = (0.0, math.radians(14) * math.sin(t * 2), 0.0)
        bark = max(0.0, math.sin(t)) ** 3
        head.rotation_euler = (0.0, math.radians(9) * bark, 0.0)
        body.scale = (1.0, 1.0 + 0.012 * math.sin(t * 2), 1.0 + 0.018 * math.sin(t * 2))
    pose(0)
    return dict(objects=[body, head, tail], pose=pose)
