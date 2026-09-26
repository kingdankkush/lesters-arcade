"""Ground props: crates, hurdles, logs, rocks and the bramble, with region variants.

Collision (chikun-ground-course.mjs): rect props cover x in [7, w - 7] and the
full height above the running line; the rock is a circle of radius 32 centred
at (38, -20). Local screen coordinates: x from the obstacle's left edge, y up
is negative, the running line is y = 0. Front faces stand at world y = 0.
"""
import math, random
from mathutils import Vector, Matrix
from . import mats, geo, fit
from .rig import P, SP, CP, height_for


def _rng(name):
    return random.Random('chikun-obstacle:' + name)


def straw_tufts(M, mat, rng, x0, x1, sy_top, count, depth=(0, 30), length=(5, 10), spread=0.9):
    """Short straw / grass blades poking out of a surface (silhouette fringe)."""
    for _ in range(count):
        x = rng.uniform(x0, x1); d = rng.uniform(*depth)
        base = P(x, sy_top, d) + Vector((0, 0, -1.0))
        L = rng.uniform(*length)
        a = rng.uniform(-spread, spread)
        tip = base + Vector((math.sin(a) * L, rng.uniform(-2, 2), math.cos(a) * L))
        n = Vector((0, -1, 0.2)).normalized()
        mid = (base + tip) / 2
        M.card(mat, mid, 0.9, L, n, up=(tip - base).normalized())


# ---------------------------------------------------------------- crates

def crate_wood(ctx):
    rng = _rng('crate-wood')
    wood = mats.wood('crate-plank', base='#b07b45', dark='#80552e', light='#cf9f68', axis='x', ring=0.55)
    wood2 = mats.wood('crate-plank-2', base='#9c6a3b', dark='#6f4826', light='#bf8f5b', axis='x', ring=0.5)
    post = mats.wood('crate-post', base='#7f5530', dark='#50331b', light='#a87a4b', axis='z', ring=0.6)
    nail = mats.paint('crate-nail', '#3a3836', rough=0.4, metal=0.8)
    red = mats.paint('apple-red', '#b8261e', rough=0.28, grime=0.1, spec=0.7)
    green = mats.paint('apple-green', '#86a82c', rough=0.3, grime=0.1, spec=0.7)
    stem = mats.paint('apple-stem', '#4a3320', rough=0.8)
    M = geo.Mesh('crate', [wood])
    D = 34.0
    H = height_for(70.0, D)
    x0, x1 = 7.0, 71.0
    rows = 4; gap = 2.0; bh = (H - gap * (rows - 1)) / rows
    for i in range(rows):
        z = i * (bh + gap)
        M.box(wood if i % 2 == 0 else wood2, (39, 1.0, z + bh / 2), (x1 - x0 - 2, 2.4, bh), bevel=0.7)
        for x in (x0 + 2.8, x1 - 2.8):
            for dz in (-bh * 0.25, bh * 0.25):
                M.cylinder(nail, (x, -1.9, z + bh / 2 + dz), (x, -1.2, z + bh / 2 + dz), 0.55, segs=6)
    dark = mats.paint('crate-inside', '#2e1f12', rough=0.9)
    M.box(dark, ((x0 + x1) / 2, D / 2, H / 2 - 1), (x1 - x0 - 4, D - 4, H - 2))
    for x in (x0 + 2.8, x1 - 2.8):
        M.box(post, (x, 1.6, H / 2), (5.6, 3.6, H + 0.6), bevel=0.8)
        M.box(post, (x, D - 2, H / 2), (5.6, 3.6, H + 0.6), bevel=0.8)
    M.box(post, ((x0 + x1) / 2, 1.8, H - 1.8), (x1 - x0, 3.8, 3.8), bevel=0.8)
    M.box(post, ((x0 + x1) / 2, D - 1.8, H - 1.8), (x1 - x0, 3.8, 3.8), bevel=0.8)
    M.box(post, ((x0 + x1) / 2, 1.8, 2.0), (x1 - x0, 3.8, 4.0), bevel=0.8)
    for i in range(30):
        x = rng.uniform(x0 + 6, x1 - 6); y = rng.uniform(5, D - 5)
        z = H - 3.0 + rng.uniform(0, 5.0) - abs(x - (x0 + x1) / 2) * 0.05
        r = rng.uniform(4.4, 5.6)
        M.blob(red if rng.random() < 0.72 else green, (x, y, z), r, squash=(1, 1, 0.9), displace=0.06, freq=0.4, seed=i, subdiv=2)
        if rng.random() < 0.6:
            M.cylinder(stem, (x, y, z + r * 0.8), (x + 0.6, y, z + r * 0.8 + 2.2), 0.45, segs=5)
    return [M.done(ctx['coll'])]


def crate_steel(ctx):
    body = mats.paint('steelcase', '#2f6190', rough=0.42, grime=0.22, spec=0.55, metal=0.4, dirt_low=(0, 12, '#3b3a36'))
    frame = mats.paint('steelcase-frame', '#2b2f33', rough=0.45, grime=0.2, metal=0.8, spec=0.6)
    hazard = mats.stripes('steelcase-hazard', '#e2b53a', '#1e1f21', width=5.0, angle=45)
    bolt = mats.paint('steelcase-bolt', '#9aa3a8', rough=0.3, metal=1.0, spec=0.8)
    M = geo.Mesh('steelcase', [body])
    D = 40.0
    H = height_for(76.0, D)
    x0, x1 = 7.0, 71.0
    M.box(body, ((x0 + x1) / 2, D / 2, H / 2), (x1 - x0 - 2, D - 2, H - 1), bevel=0.8)
    # corrugation ribs
    for i in range(9):
        x = x0 + 6 + i * (x1 - x0 - 12) / 8
        M.box(body, (x, -0.4, H / 2 + 3), (2.6, 1.4, H - 20), bevel=0.5)
    # corner castings and frame rails
    for x in (x0 + 2.5, x1 - 2.5):
        M.box(frame, (x, D / 2, H / 2), (5, D, H), bevel=0.6)
    for z in (2.5, H - 2.5):
        M.box(frame, ((x0 + x1) / 2, D / 2, z), (x1 - x0, D, 5), bevel=0.6)
    for x in (x0 + 2.5, x1 - 2.5):
        for z in (2.5, H - 2.5):
            M.box(frame, (x, -0.6, z), (6.5, 2.2, 6.5), bevel=0.8)
    # hazard band and door latch bars
    M.box(hazard, ((x0 + x1) / 2, -0.9, 9.0), (x1 - x0 - 10, 1.0, 5.0))
    for x in (x0 + 24, x0 + 40):
        M.cylinder(frame, (x, -2.2, 12), (x, -2.2, H - 8), 1.1, segs=8)
        M.box(bolt, (x, -3.2, H * 0.55), (3.6, 2.0, 5.5), bevel=0.4)
    return [M.done(ctx['coll'])]


def crate_boxes(ctx):
    rng = _rng('crate-boxes')
    card = mats.paint('cardboard', '#b98b58', rough=0.85, grime=0.12, spec=0.2, scale=0.12, bump=0.12)
    card2 = mats.paint('cardboard-dark', '#a57a4b', rough=0.85, grime=0.12, spec=0.2, scale=0.12, bump=0.12)
    tape = mats.paint('packing-tape', '#d9c08e', rough=0.35, grime=0.05, spec=0.7)
    ink = mats.paint('box-ink', '#3a2f28', rough=0.8)
    M = geo.Mesh('boxes', [card])
    # bottom box: 64 wide, 42 on screen
    D1 = 34.0; H1 = height_for(38.0, D1) + 0.0
    M.box(card, (39, D1 / 2, H1 / 2), (64, D1, H1), bevel=0.9)
    M.box(tape, (39, -0.15, H1 / 2), (8, 0.6, H1 - 1))
    M.box(tape, (39, D1 / 2, H1 + 0.1), (8, D1 - 1, 0.5))
    # arrows icon ("this side up") on the front
    for dx in (-19, -13):
        M.box(ink, (39 + dx, -0.3, H1 * 0.45), (1.4, 0.5, 8.0))
        M.box(ink, (39 + dx, -0.3, H1 * 0.45 + 4.6), (4.2, 0.5, 1.4), rot=Matrix.Rotation(0.0, 3, 'Y'))
    # two boxes on top, slightly misaligned
    D2 = 28.0
    for (x, w, sh, mat, lean) in ((24.5, 34, 38.0, card2, 0.03), (55.0, 32, 36.5, card, -0.025)):
        h = (sh) / CP
        z0 = H1
        y = D1 - D2 / 2 - 2
        faces = M.box(mat, (x, y, z0 + h / 2), (w, D2, h), bevel=0.9)
        M.box(tape, (x, y - D2 / 2 - 0.15, z0 + h / 2), (6, 0.6, h - 1))
        M.transform(faces, Matrix.Translation((x, y, z0)) @ Matrix.Rotation(lean, 4, 'Y') @ Matrix.Translation((-x, -y, -z0)))
    objs = [M.done(ctx['coll'])]
    fit.fit_vertical(objs, top=-76.0, bottom=0.0)
    return objs


# ---------------------------------------------------------------- hurdles

def hurdle_hay(ctx):
    rng = _rng('hurdle-hay')
    hay = mats.straw('hay', base='#d6ac52', dark='#9b7431', light='#f0d488')
    twine = mats.paint('twine', '#6d5236', rough=0.9)
    blade = mats.ramp_by_uv('straw-blade', [(0.0, '#a37b36'), (1.0, '#f2da8e')], axis=1, rough=0.8, alpha_shape=None)
    M = geo.Mesh('hay', [hay])
    D = 38.0
    Hb = height_for(76.0, D) / 2
    for i, (x0, x1) in enumerate(((6.5, 83.5), (8.5, 81.0))):
        z = i * Hb
        cx = (x0 + x1) / 2
        M.box(hay, (cx, D / 2 + i * 0.8, z + Hb / 2), (x1 - x0, D, Hb - 0.4), bevel=4.0, segments=3)
        for tx in (cx - (x1 - x0) * 0.26, cx + (x1 - x0) * 0.26):
            M.box(twine, (tx, D / 2 + i * 0.8, z + Hb / 2), (1.3, D + 0.9, Hb + 0.5), bevel=0.4)
    # loose straw on every edge (fringe <= 4 px)
    for _ in range(150):
        side = rng.random()
        if side < 0.45:   # top edge
            x = rng.uniform(9, 81); base = Vector((x, rng.uniform(4, D - 2), 2 * Hb - 1))
            d = Vector((rng.uniform(-1, 1), rng.uniform(-0.6, 0.2), rng.uniform(0.4, 1.0))).normalized()
        elif side < 0.7:  # left / right faces
            x = rng.choice((7.5, 82.5)); base = Vector((x, rng.uniform(4, D - 2), rng.uniform(3, 2 * Hb - 3)))
            d = Vector(((-1 if x < 40 else 1) * rng.uniform(0.5, 1), rng.uniform(-0.5, 0.5), rng.uniform(-0.4, 0.6))).normalized()
        elif side < 0.82: # front face (sparse)
            base = Vector((rng.uniform(9, 81), -0.5, rng.uniform(3, 2 * Hb - 3)))
            d = Vector((rng.uniform(-1, 1), rng.uniform(-1, -0.2), rng.uniform(-0.6, 0.6))).normalized()
        else:
            continue
        L = rng.uniform(3.0, 6.0)
        M.card(blade, base + d * L / 2, 0.5, L, Vector((0, -1, 0.25)), up=d)
    return [M.done(ctx['coll'])]


def _barrel(M, mats_, cx, R, H, y):
    staves, hoop = mats_
    segs = 28
    rings = 9
    before = set(M.bm.faces)
    import bmesh
    verts = []
    for j in range(rings + 1):
        t = j / rings
        z = t * H
        r = R * (0.9 + 0.1 * math.sin(math.pi * t))
        row = []
        for k in range(segs):
            a = k / segs * math.tau
            row.append(M.bm.verts.new((cx + math.cos(a) * r, y + math.sin(a) * r, z)))
        verts.append(row)
    for j in range(rings):
        for k in range(segs):
            k2 = (k + 1) % segs
            f = M.bm.faces.new((verts[j][k], verts[j][k2], verts[j + 1][k2], verts[j + 1][k]))
            for loop in f.loops:
                a = math.atan2(loop.vert.co.y - y, loop.vert.co.x - cx)
                loop[M.uv].uv = (a / math.tau, loop.vert.co.z / H)
    top = M.bm.faces.new(verts[-1])
    faces = [f for f in M.bm.faces if f not in before]
    M._tag(faces, staves, True)
    top.smooth = False
    for t in (0.1, 0.34, 0.66, 0.9):
        r = R * (0.9 + 0.1 * math.sin(math.pi * t)) + 0.5
        M.cylinder(hoop, (cx, y, t * H - 1.4), (cx, y, t * H + 1.4), r, segs=segs)


def hurdle_barrels(ctx):
    staves = mats.wood('barrel-stave', base='#8a5a31', dark='#4c2f18', light='#b48150', axis='z', ring=1.0)
    hoop = mats.paint('barrel-hoop', '#2d2a28', rough=0.4, metal=0.9, spec=0.6)
    M = geo.Mesh('barrels', [staves])
    R = 19.0
    H = height_for(76.0, 2 * R)
    for cx in (26.0, 64.0):
        _barrel(M, (staves, hoop), cx, R, H, R)
    return [M.done(ctx['coll'])]


def hurdle_drums(ctx):
    orange = mats.bands('drum-bands', ['#e8641f', '#e8641f', '#f1efe8', '#e8641f', '#f1efe8'], axis='z', period=9.5, rough=0.35, spec=0.6, offset=-4)
    rubber = mats.paint('drum-base', '#1c1d1f', rough=0.85)
    lamp = mats.glow('drum-lamp', '#ffb23a', strength=3.0)
    lamp_body = mats.paint('drum-lamp-body', '#2a2a2a', rough=0.5)
    M = geo.Mesh('drums', [orange])
    R = 18.6
    H = height_for(70.0, 2 * R)
    for cx in (26.0, 64.0):
        M.cylinder(rubber, (cx, R, 0), (cx, R, 6), R + 1.2, segs=28)
        M.cylinder(orange, (cx, R, 6), (cx, R, H), R, r2=R * 0.84, segs=28)
        M.cylinder(rubber, (cx, R, H), (cx, R, H + 1.4), R * 0.86, segs=28)
    # a flashing lamp on the left drum (leading drum carries the light)
    M.box(lamp_body, (26.0, R, H + 3), (4, 3, 5))
    M.cylinder(lamp, (26.0, R - 1, H + 5), (26.0, R - 1, H + 5.1), 4.2, segs=16)
    M.blob(lamp, (26.0, R - 1, H + 6.5), 3.2, squash=(1, 0.6, 1), displace=0.0, subdiv=2)
    return [M.done(ctx['coll'])]


def hurdle_jersey(ctx):
    conc = mats.concrete('jersey-concrete', color='#bdbab0', dark='#8f8c82', stains=0.35, scale=0.12)
    hazard = mats.stripes('jersey-hazard', '#e8b73a', '#232426', width=5.0, angle=45)
    refl = mats.glow('jersey-reflector', '#ff4a2a', strength=0.6)
    steel = mats.paint('jersey-loop', '#5a5f63', rough=0.4, metal=0.9, spec=0.6)
    dark = mats.paint('jersey-slot', '#26241f', rough=0.9)
    M = geo.Mesh('jersey', [conc])
    base_w, top_w = 56.0, 18.0
    H = height_for(72.0, base_w / 2 + top_w / 2)
    a = base_w / 2 - top_w / 2
    prof = [(0, 0), (0, 7), (a - 6, 18), (a - 0.8, H - 1.2), (a + 1.2, H), (base_w - a - 1.2, H), (base_w - a + 0.8, H - 1.2), (base_w - a + 6, 18), (base_w, 7), (base_w, 0)]
    M.prism(conc, prof, 7.0, 83.0)
    for x in (18, 60):
        M.box(dark, (x + 5, -0.2, 3.5), (12, 1.0, 5))
    M.prism(hazard, [(a - 1.4, H - 12), (a - 2.2, H - 4), (a - 0.9, H - 3.9), (a - 0.1, H - 11.9)], 9, 81)
    for x in (22, 68):
        pts = [(x - 4 + 8 * t, base_w / 2, H + 5.5 * math.sin(math.pi * t)) for t in [k / 8 for k in range(9)]]
        M.tube(steel, pts, 0.9, segs=6)
    M.box(refl, (14, 4.8, 13), (4.5, 1, 4.5))
    M.box(refl, (76, 4.8, 13), (4.5, 1, 4.5))
    objs = [M.done(ctx['coll'])]
    fit.fit_vertical(objs, bottom=0.0)
    return objs


def hurdle_hedge(ctx):
    from mathutils import noise
    rng = _rng('hurdle-hedge')
    plank = mats.wood('planter-wood', base='#7b5a3c', dark='#553a26', light='#9c7652', axis='x', ring=0.5)
    core = mats.paint('hedge-core', '#1b3317', rough=0.9, grime=0.3)
    card = mats.leaves('hedge-card', '#2a4b22', '#4d7e31', '#93b653', cards=True, scale=0.45, translucent=0.3)
    flower = mats.paint('hedge-flower', '#f4f1e6', rough=0.5)
    M = geo.Mesh('hedge', [plank])
    D = 34.0
    Hp = height_for(22.0, 0) - 1
    for i in range(3):
        M.box(plank, (45, 1.2, 1 + i * (Hp / 3) + Hp / 6), (76, 2.4, Hp / 3 - 0.8), bevel=0.5)
    M.box(plank, (45, D / 2, Hp / 2), (76, D, Hp))
    for x in (8.6, 81.4):
        M.box(plank, (x, 1.4, Hp / 2 + 0.5), (3.2, 3.2, Hp + 1), bevel=0.5)
    top = height_for(73.0, D - 4)
    x0, x1, y0, y1, z0 = 8.5, 81.5, 2.0, D - 2.0, Hp
    M.box(core, ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + top) / 2), (x1 - x0 - 3, y1 - y0 - 3, top - z0 - 2), bevel=3.0)

    def bump(a, b):
        return 1.1 * noise.noise(Vector((a * 0.09, b * 0.09, 3.3)))
    for _ in range(2600):
        f = rng.random()
        if f < 0.55:
            x, z = rng.uniform(x0, x1), rng.uniform(z0 + 1, top)
            p = Vector((x, y0 - 0.5 - bump(x, z) - rng.uniform(0, 1.2), z)); n = Vector((rng.uniform(-0.4, 0.4), -1, rng.uniform(-0.2, 0.6)))
        elif f < 0.85:
            x, y = rng.uniform(x0, x1), rng.uniform(y0, y1)
            p = Vector((x, y, top + 0.5 + bump(x, y) + rng.uniform(0, 1.2))); n = Vector((rng.uniform(-0.4, 0.4), rng.uniform(-0.5, 0.3), 1))
        else:
            side = rng.choice((x0, x1)); y, z = rng.uniform(y0, y1), rng.uniform(z0 + 1, top)
            sgn = -1 if side == x0 else 1
            p = Vector((side + sgn * (0.5 + rng.uniform(0, 1.2)), y, z)); n = Vector((sgn, rng.uniform(-0.4, 0.4), rng.uniform(-0.2, 0.6)))
        M.card(card, p, 2.3, 3.4, n.normalized(), twist=rng.uniform(0, 6.28))
    for i in range(14):
        M.blob(flower, (rng.uniform(x0 + 3, x1 - 3), y0 - 1.8, rng.uniform(z0 + 6, top - 4)), 0.9, displace=0.0, subdiv=1)
    objs = [M.done(ctx['coll'])]
    fit.fit_vertical(objs, bottom=0.0)
    return objs


# ---------------------------------------------------------------- logs

def _log(ctx, name, bark_mat, end_mat, R=24.0, x0=6.0, x1=106.0, yaw=0.16, stubs=2, rng=None, bend=0.0):
    """A felled log lying along x, rotated `yaw` so its leading end (left) shows the cut."""
    rng = rng or _rng(name)
    M = geo.Mesh(name, [bark_mat])
    L = (x1 - x0) / math.cos(yaw)
    a = Vector((-L / 2, 0, 0)); b = Vector((L / 2, 0, 0))
    segs = 18
    steps = 10
    before = set(M.bm.faces)
    rings = []
    for j in range(steps + 1):
        t = j / steps
        x = -L / 2 + L * t
        rr = R * (1.0 - 0.07 * t) * (1 + 0.04 * math.sin(t * 9 + 1))
        row = []
        for k in range(segs):
            ang = k / segs * math.tau
            wob = 1 + 0.05 * math.sin(ang * 3 + t * 5) + rng.uniform(-0.02, 0.02)
            row.append(M.bm.verts.new((x, math.cos(ang) * rr * wob, math.sin(ang) * rr * wob + bend * math.sin(math.pi * t))))
        rings.append(row)
    for j in range(steps):
        for k in range(segs):
            k2 = (k + 1) % segs
            f = M.bm.faces.new((rings[j][k], rings[j][k2], rings[j + 1][k2], rings[j + 1][k]))
            for loop in f.loops:
                loop[M.uv].uv = (loop.vert.co.x * 0.05, math.atan2(loop.vert.co.z, loop.vert.co.y))
    side = [f for f in M.bm.faces if f not in before]
    M._tag(side, bark_mat, True)
    capL = M.bm.faces.new(list(reversed(rings[0]))); capR = M.bm.faces.new(rings[-1])
    M._tag([capL, capR], end_mat, False)
    for _ in range(stubs):
        t = rng.uniform(0.3, 0.8); ang = rng.uniform(0.6, 2.2)
        p = Vector((-L / 2 + L * t, math.cos(ang) * R * 0.9, math.sin(ang) * R * 0.9))
        d = Vector((rng.uniform(-0.3, 0.3), math.cos(ang), math.sin(ang))).normalized()
        M.cylinder(bark_mat, p, p + d * rng.uniform(5, 8), 3.4, r2=2.4, segs=8)
        M.cylinder(end_mat, p + d * 7.9, p + d * 8.0, 2.4, segs=8)
    obj = M.done(ctx['coll'])
    obj.rotation_euler = (0, 0, yaw)
    obj.location = ((x0 + x1) / 2, R * 0.2, R)
    import bpy
    bpy.context.view_layer.update()
    obj.data.transform(obj.matrix_world); obj.matrix_world = Matrix.Identity(4)
    return obj


def _rings_mat(name, base='#c89a64', dark='#7b5530', bark='#4b3322'):
    def build(nb):
        p = mats.obj(nb)
        x, y, z = nb.separate(p)
        wv = nb.new('ShaderNodeTexWave'); wv.wave_type = 'RINGS'; wv.rings_direction = 'X'
        nb.put(wv.inputs['Vector'], p); wv.inputs['Scale'].default_value = 0.09; wv.inputs['Distortion'].default_value = 3.0; wv.inputs['Detail'].default_value = 2.0
        n = nb.noise(p, scale=0.3, detail=4.0)
        c = nb.ramp(nb.math('ADD', nb.math('MULTIPLY', wv.outputs['Fac'], 0.7), nb.math('MULTIPLY', n, 0.3)), [(0.2, dark), (0.7, base)])
        return dict(color=c, rough=0.8, spec=0.25, normal=nb.bump(wv.outputs['Fac'], strength=0.2))
    return mats.material(name, build)


def log_oak(ctx):
    bark = mats.bark('oak-log-bark', base='#5e4633', dark='#2a1c13', light='#8d735a', scale=1.0, lichen='#9aa27a', axis='x')
    ends = _rings_mat('oak-log-rings')
    o = _log(ctx, 'log-oak', bark, ends)
    objs = [o]
    fit.fit_vertical(objs, top=-48.5, bottom=0.5)
    fit.fit_horizontal(objs, 2.0, 111.0)
    return objs


def log_mossy(ctx):
    rng = _rng('log-mossy')
    bark = mats.bark('mossy-log-bark', base='#4f3d2e', dark='#221812', light='#7a6450', moss='#5f8a2e', scale=1.0, axis='x')
    ends = _rings_mat('mossy-log-rings', base='#a67e52', dark='#5f4127')
    o = _log(ctx, 'log-mossy', bark, ends, rng=rng, bend=1.5)
    fungi = mats.paint('bracket-fungus', '#d9a35a', rough=0.6, grime=0.3)
    fern = mats.leaves('fern-card', '#1f3a18', '#3c6a24', '#76a23c', cards=True, scale=0.6)
    M = geo.Mesh('log-mossy-extra', [fungi])
    for i in range(5):
        x = rng.uniform(30, 95); z = rng.uniform(12, 36)
        M.blob(fungi, (x, -2.0, z), 4.2, squash=(1.2, 0.8, 0.28), displace=0.1, seed=i, subdiv=2)
    for i in range(70):
        x = rng.choice((rng.uniform(2, 20), rng.uniform(92, 110))); d = rng.uniform(-4, 18)
        base = Vector((x, d, 0.0))
        dirv = Vector((rng.uniform(-0.8, 0.8), rng.uniform(-0.6, 0.2), rng.uniform(0.4, 1.0))).normalized()
        L = rng.uniform(7, 14)
        M.card(fern, base + dirv * L / 2, 3.4, L, Vector((0, -1, 0.3)), up=dirv)
    objs = [o, M.done(ctx['coll'])]
    fit.fit_vertical(objs, bottom=0.5)
    fit.fit_horizontal(objs, 1.0, 112.0)
    return objs


def log_drift(ctx):
    rng = _rng('log-drift')
    bark = mats.driftwood('driftwood')
    ends = _rings_mat('driftwood-rings', base='#cfc6b2', dark='#8f8676')
    o = _log(ctx, 'log-drift', bark, ends, R=24.0, yaw=0.2, stubs=3, rng=rng, bend=2.0)
    weed = mats.leaves('drift-weed', '#233a1c', '#4f5f24', '#8c8a3a', cards=True, scale=0.5)
    shell = mats.paint('drift-shell', '#efe6d6', rough=0.5, grime=0.1)
    M = geo.Mesh('drift-extra', [weed])
    for i in range(46):
        x = rng.uniform(10, 100); base = Vector((x, rng.uniform(-8, 8), rng.uniform(0, 4)))
        d = Vector((rng.uniform(-1, 1), -0.4, rng.uniform(-0.2, 0.3))).normalized()
        M.card(weed, base + d * 4, 1.6, 8, Vector((0, -0.4, 1)), up=d)
    for i in range(3):
        M.blob(shell, (rng.uniform(20, 90), -14, 2.0), 2.6, squash=(1.2, 1, 0.6), displace=0.1, seed=i, subdiv=2)
    objs = [o, M.done(ctx['coll'])]
    fit.fit_vertical(objs, top=-49.0, bottom=0.5)
    fit.fit_horizontal(objs, 2.0, 111.0)
    return objs


def log_timber(ctx):
    beam = mats.wood('timber-beam', base='#c49a62', dark='#8a6235', light='#e2c08a', axis='x', ring=1.3)
    endg = _rings_mat('timber-ends', base='#d8b07a', dark='#9a7040')
    strap = mats.paint('timber-strap', '#2a3a48', rough=0.35, metal=0.9, spec=0.7)
    M = geo.Mesh('timber', [beam])
    D = 30.0
    Ht = height_for(48.0, D)
    rows = 3; bh = Ht / rows
    for r in range(rows):
        for c in range(2):
            y = 7.5 + c * 15
            off = (r % 2) * 3.0
            M.box(beam, (56 + off - 1.5, y, r * bh + bh / 2), (96, 14.4, bh - 0.8), bevel=0.8)
            M.box(endg, (8.0 + off - 1.5 - 0.5 + 0.4, y, r * bh + bh / 2), (1.0, 13.8, bh - 1.6))
    for x in (30, 82):
        M.box(strap, (x, D / 2, Ht / 2), (2.4, D + 1.2, Ht + 1.2))
    objs = [M.done(ctx['coll'])]
    fit.fit_vertical(objs, bottom=0.0)
    return objs


# ---------------------------------------------------------------- rocks

def _boulder(ctx, name, mat, seed, extra=None):
    """A faceted boulder that fills the collision circle (r 32 at (38, -20)):
    a displaced icosphere cut by a few random planes, flat shaded, so the key
    light picks out chunky facets."""
    import bmesh
    from mathutils import noise
    rng = random.Random(f'boulder:{seed}')
    M = geo.Mesh(name, [mat])
    c = P(38.0, -20.0, 0.0)
    R = 33.0
    planes = []
    for _ in range(9):
        u = rng.uniform(-0.4, 1.0); th = rng.uniform(0, math.tau); sq = math.sqrt(1 - u * u)
        planes.append((Vector((sq * math.cos(th), sq * math.sin(th) * 0.6 - 0.4, u)).normalized(), R * rng.uniform(0.84, 0.93)))
    before = set(M.bm.faces)
    ret = bmesh.ops.create_icosphere(M.bm, subdivisions=3, radius=1.0)
    off = Vector((seed * 5.1, seed * 2.3, seed * 7.7))
    for v in ret['verts']:
        d = v.co.normalized()
        q = d * R * (1.0 + 0.07 * noise.noise(d * 1.1 + off) + 0.03 * noise.noise(d * 3.3 + off))
        for n, dist in planes:
            k = q.dot(n)
            if k > dist:
                q -= n * (k - dist)
        q.y *= 0.8
        v.co = c + q
        if v.co.z < -3.0:
            v.co.z = -3.0 + (v.co.z + 3.0) * 0.2
    faces = [f for f in M.bm.faces if f not in before]
    for f in faces:
        for loop in f.loops:
            loop[M.uv].uv = (loop.vert.co.x * 0.05, loop.vert.co.z * 0.05)
    M._tag(faces, mat, False)
    return M


def rock_mossy(ctx):
    rng = _rng('rock-mossy')
    stone = mats.stone('rock-granite', [(0.2, '#4b4f4a'), (0.5, '#7a7d74'), (0.8, '#a4a597')], scale=0.07, moss='#6f9a36', moss_amount=1.0)
    fern = mats.leaves('rock-fern', '#1f3a18', '#3c6a24', '#76a23c', cards=True, scale=0.6)
    M = _boulder(ctx, 'rock-mossy', stone, 11)
    for i in range(80):
        x = rng.choice((rng.uniform(4, 18), rng.uniform(58, 74), rng.uniform(4, 74)))
        base = Vector((x, rng.uniform(-18, 6), rng.uniform(-6, 0)))
        d = Vector((rng.uniform(-0.8, 0.8), rng.uniform(-0.5, 0.1), rng.uniform(0.5, 1.0))).normalized()
        L = rng.uniform(5, 11)
        M.card(fern, base + d * L / 2, 2.6, L, Vector((0, -1, 0.3)), up=d)
    return [M.done(ctx['coll'])]


def rock_coastal(ctx):
    rng = _rng('rock-coastal')
    stone = mats.stone('rock-basalt', [(0.2, '#2c3033'), (0.55, '#51575a'), (0.85, '#7d8584')], scale=0.08, wet=True, barnacles=('#d8d2c0', 6.0))
    weed = mats.leaves('rock-weed', '#1d2d16', '#3d5222', '#6f7a30', cards=True, scale=0.5)
    M = _boulder(ctx, 'rock-coastal', stone, 23)
    for i in range(60):
        x = rng.uniform(6, 72)
        base = Vector((x, rng.uniform(-18, 4), rng.uniform(-8, -2)))
        d = Vector((rng.uniform(-1, 1), -0.5, rng.uniform(-0.3, 0.3))).normalized()
        M.card(weed, base + d * 3.5, 1.8, 7, Vector((0, -0.4, 1)), up=d)
    return [M.done(ctx['coll'])]


# ---------------------------------------------------------------- bramble

def thorn_bramble(ctx):
    """A bramble thicket: a leafy mound with a ragged top that fills the rect,
    thorny canes arching out of it, a few berries."""
    from mathutils import noise
    rng = _rng('thorn-bramble')
    leaf = mats.paint('bramble-core', '#162616', rough=0.9, grime=0.3)
    card = mats.leaves('bramble-card', '#1f3818', '#3f6429', '#7d9d45', cards=True, scale=0.5, translucent=0.3)
    cane = mats.paint('bramble-cane', '#5a3a2c', rough=0.5, grime=0.3, spec=0.5)
    thorn = mats.paint('bramble-thorn', '#e8dcc0', rough=0.4)
    berry = mats.paint('bramble-berry', '#1d1426', rough=0.2, spec=0.9)
    red = mats.paint('bramble-berry-red', '#9b1f2c', rough=0.25, spec=0.9)
    M = geo.Mesh('bramble', [leaf])
    x0, x1, y0, y1 = 8.0, 92.0, 3.0, 30.0

    def top(x):
        return 58.0 + 4.0 * noise.noise(Vector((x * 0.07, 1.7, 0.3))) + 2.5 * noise.noise(Vector((x * 0.21, 4.1, 0.9)))

    def front(x, z):
        return y0 + 2.2 * noise.noise(Vector((x * 0.1, z * 0.1, 5.5)))
    # core: columns of dark volume under the ragged top
    for i in range(14):
        x = x0 + 3 + i * (x1 - x0 - 6) / 13
        t = top(x)
        M.box(leaf, (x, (y0 + y1) / 2 + 1, t / 2 - 1), (7.4, y1 - y0 - 2, t - 3), bevel=2.5)
    for _ in range(3400):
        f = rng.random()
        if f < 0.6:
            x = rng.uniform(x0, x1); z = rng.uniform(1, top(x) - 1)
            q = Vector((x, front(x, z) - rng.uniform(0, 2.0), z)); n = Vector((rng.uniform(-0.5, 0.5), -1, rng.uniform(-0.3, 0.7)))
        elif f < 0.88:
            x = rng.uniform(x0, x1); y = rng.uniform(y0, y1)
            q = Vector((x, y, top(x) + rng.uniform(-1.5, 1.5))); n = Vector((rng.uniform(-0.5, 0.5), rng.uniform(-0.6, 0.3), 1))
        else:
            side = rng.choice((x0, x1)); z = rng.uniform(1, top(side) - 1); sgn = -1 if side == x0 else 1
            q = Vector((side + sgn * rng.uniform(0, 2.0), rng.uniform(y0, y1), z)); n = Vector((sgn, rng.uniform(-0.4, 0.4), rng.uniform(-0.2, 0.6)))
        M.card(card, q, 2.7, 4.0, n.normalized(), twist=rng.uniform(0, 6.28))
    # a few arching thorny canes breaking the silhouette (kept within the fringe)
    for i in range(5):
        span = rng.uniform(24, 36); rise = rng.uniform(44, 60); lean = rng.uniform(-6, 8)
        x = rng.uniform(12 + span / 2, 88 - span / 2 - 8)
        pts = []
        for t in [k / 10 for k in range(11)]:
            pts.append((x + (t - 0.5) * span + lean * t * t, rng.uniform(-3.5, -1.5), 4 + rise * math.sin(math.pi * t) + rng.uniform(-1.2, 1.2)))
        M.tube(cane, pts, [1.05 - 0.06 * k for k in range(11)], segs=6)
        for k in range(1, 10):
            p = Vector(pts[k]); d = Vector((rng.uniform(-1, 1), -1, rng.uniform(-0.2, 1))).normalized()
            M.cylinder(thorn, p, p + d * 2.0, 0.55, r2=0.05, segs=5)
    for i in range(16):
        x = rng.uniform(12, 80); z = rng.uniform(12, 52)
        M.blob(berry if rng.random() < 0.6 else red, (x, -3.0, z), 1.9, displace=0.25, freq=2.0, seed=i, subdiv=2)
    objs = [M.done(ctx['coll'])]
    fit.fit_vertical(objs, bottom=0.0)
    return objs
