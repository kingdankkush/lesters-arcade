"""The storm cell, pits and waterfalls.

Storm collision: a 280 px rect from the top of the screen down to 440..580;
the cell is a volumetric column anchored at its bottom edge (a shelf cloud
whose base is the rect bottom). Rain and lightning are drawn by the runtime.

Pit collision: the ground is missing from x 0 to x 420 (fall below 697). The
sprite shows the hole in the ground plane (back wall and side walls falling
into darkness), crumbling lips at x 0 and x 420 on the running line's cut
face, and rims that fade out so the region's own ground shows around them.

Waterfall collision: the ground is missing from x 0 to 520 and a solid rock
column stands on x 24..496 from y 510 down. The sprite is the rock shelf with
a curtain of water and a plunge pool; a separate periodic water sheet is
scrolled over the curtain by the runtime.
"""
import bpy, bmesh, math, random
from mathutils import Vector, noise
from . import mats, geo
from .rig import P, SP, CP, height_for

STORM_H = 600.0


def storm_frame():
    return (-12, -STORM_H, 304, STORM_H + 24)


def storm(ctx):
    """A towering storm cell: billows packed into the column, softly lit from the
    upper left (subsurface cloud shading), dark and heavy toward the shelf base,
    whose lobes end on the rect bottom (local y 0)."""
    rng = random.Random('storm')
    coll = ctx['coll']
    W = 280.0
    cloud = mats.material('storm-cloud', _storm_surface)
    M = geo.Mesh('storm', [cloud])
    # interior fill (never seen through the gaps)
    for k in range(9):
        M.blob(cloud, P(W / 2, -40 - k * 66, 60), 1.0, squash=(W * 0.56, 62, 62), displace=0.1, freq=1.0, seed=900 + k, subdiv=3)
    # billows: bigger and paler high up, tighter and darker toward the base
    placed = 0
    while placed < 150:
        sy = -rng.uniform(40, STORM_H + 30)
        r = 26 + 22 * min(1.0, -sy / 400.0) * rng.uniform(0.6, 1.0)
        sx = rng.uniform(r * 0.35, W - r * 0.35)
        # sides may bulge at most ~8 px past the rect
        sx = max(r - 11, min(W - r + 11, sx))
        M.blob(cloud, P(sx, sy, rng.uniform(-10, 40)), r, displace=0.22, freq=0.9, seed=placed, subdiv=3)
        placed += 1
    # shelf base: a row of lobes whose undersides sit on y 0
    for i in range(12):
        sx = 10 + i * (W - 20) / 11 + rng.uniform(-4, 4)
        r = rng.uniform(17, 22)
        M.blob(cloud, P(sx, -r - 5 + rng.uniform(0, 2), rng.uniform(-8, 10)), r, squash=(1.25, 1, 0.85), displace=0.18, freq=1.1, seed=400 + i, subdiv=3)
    shape = M.done(coll)
    shape.hide_render = True
    # Mesh -> fog volume with a soft interior band, then billowy displacement
    vol_data = bpy.data.volumes.new('storm-volume')
    vol = bpy.data.objects.new('storm-volume', vol_data)
    coll.objects.link(vol)
    m2v = vol.modifiers.new('mesh', 'MESH_TO_VOLUME')
    m2v.object = shape
    m2v.resolution_mode = 'VOXEL_SIZE'
    m2v.voxel_size = 2.5
    m2v.interior_band_width = 9.0
    m2v.density = 1.0
    tex = bpy.data.textures.new('storm-billow', 'CLOUDS')
    tex.noise_scale = 0.45
    tex.noise_depth = 3
    disp = vol.modifiers.new('billow', 'VOLUME_DISPLACE')
    disp.texture = tex
    disp.strength = 7.0
    disp.texture_map_mode = 'GLOBAL'
    vol_data.materials.append(cloud)
    return [shape, vol]


def _storm_surface(nb):
    """Volumetric billows: each blob is a container of scattering cloud, so the
    lit side glows, the underside falls into shadow and the edges stay soft."""
    p = mats.obj(nb)
    x, y, z = nb.separate(p)
    n = nb.noise(p, scale=0.025, detail=7.0, rough=0.6, distortion=0.3)
    fine = nb.noise(p, scale=0.1, detail=4.0)
    grid = nb.new('ShaderNodeAttribute'); grid.attribute_name = 'density'
    d = nb.math('MULTIPLY', nb.math('MULTIPLY', grid.outputs['Fac'], nb.maprange(nb.math('ADD', nb.math('MULTIPLY', n, 0.75), nb.math('MULTIPLY', fine, 0.35)), 0.35, 0.75, 0.6, 1.3)), 0.34)
    zc = nb.maprange(z, -150.0, 480.0, 0.0, 1.0)
    col = nb.mix('#5d6674', '#e3e8ee', zc)
    vol = nb.new('ShaderNodeVolumePrincipled')
    nb.put(vol.inputs['Color'], col)
    vol.inputs['Anisotropy'].default_value = 0.3
    nb.put(vol.inputs['Density'], d)
    return dict(color=(0, 0, 0), alpha=0.0, volume=vol.outputs[0])


# ---------------------------------------------------------------- pits

PIT_W = 420.0
HOLE_D = 46.0      # how far the hole reaches back into the ground plane


def pit_frame():
    return (-40, -26, PIT_W + 80, 58)


TERRAINS = {
    'soil': dict(top=('#5d7d33', '#86a34a', '#a9bf63'), wall=('#6b4a2e', '#3d2817', '#8f6a44'), lip='grass'),
    'loam': dict(top=('#4a5a2a', '#6a7a3a', '#8b7a4a'), wall=('#4d3826', '#261a10', '#6d5238'), lip='grass'),
    'concrete': dict(top=('#8e8d85', '#a9a79c', '#bdbbb0'), wall=('#8a8880', '#55544f', '#a7a69a'), lip='concrete'),
    'tidal': dict(top=('#cdb27a', '#e3cc98', '#f0dfb2'), wall=('#4f5557', '#2a2f31', '#727a7b'), lip='sand'),
}


def _fade_alpha(nb, x0, x1, back, reach=12.0):
    """1 inside the hole's footprint and its immediate lips, fading to 0 `reach`
    px beyond (object x and y), so the region's own ground shows around the pit."""
    p = mats.obj(nb)
    x, y, z = nb.separate(p)
    dx = nb.math('MAXIMUM', nb.math('SUBTRACT', x0, x), nb.math('SUBTRACT', x, x1))
    dy = nb.math('SUBTRACT', y, back)
    d = nb.math('MAXIMUM', dx, dy)
    return nb.maprange(d, 4.0, 4.0 + reach, 1.0, 0.0, smooth=True)


def pit(terrain):
    def build(ctx):
        t = TERRAINS[terrain]
        rng = random.Random('pit:' + terrain)
        coll = ctx['coll']
        x0, x1 = 0.0, PIT_W

        def top_build(nb):
            p = mats.obj(nb)
            n = nb.noise(p, scale=0.12, detail=6.0)
            c = nb.ramp(n, [(0.25, t['top'][0]), (0.55, t['top'][1]), (0.85, t['top'][2])])
            return dict(color=c, rough=0.9, spec=0.2, alpha=_fade_alpha(nb, x0, x1, HOLE_D), normal=nb.bump(n, strength=0.4))

        def wall_build(nb):
            p = mats.obj(nb)
            x, y, z = nb.separate(p)
            n = nb.noise(p, scale=0.1, detail=6.0)
            strata = nb.noise(mats.scaled(nb, p, 0.03, 0.03, 0.4), scale=1.0, detail=3.0)
            c = nb.ramp(n, [(0.25, t['wall'][1]), (0.55, t['wall'][0]), (0.85, t['wall'][2])])
            c = nb.mix(c, (0, 0, 0), nb.maprange(strata, 0.45, 0.6, 0.0, 0.35))
            # the deeper, the darker: nothing lights the bottom of the hole
            c = nb.mix(c, '#07090a', nb.maprange(z, 0.0, -40.0, 0.0, 0.92, smooth=True))
            return dict(color=c, rough=0.95, spec=0.1, alpha=_fade_alpha(nb, x0, x1, HOLE_D), normal=nb.bump(nb.math('ADD', n, strata), strength=0.6))
        top = mats.material(f'pit-{terrain}-top', top_build)
        wall = mats.material(f'pit-{terrain}-wall', wall_build)
        M = geo.Mesh('pit-' + terrain, [top])
        deep = -70.0
        # ground surface around the hole (rims behind and beside it)
        M.box(top, ((x0 + x1) / 2, HOLE_D + 12, -1.5), (x1 - x0 + 80, 24, 3))
        for (a, b) in ((x0 - 40, x0), (x1, x1 + 40)):
            M.box(top, ((a + b) / 2, (HOLE_D + 24) / 2, -1.5), (b - a, HOLE_D + 24, 3))
        # walls: back wall, side walls, and the lips' cut faces on the running line
        M.box(wall, ((x0 + x1) / 2, HOLE_D + 1, deep / 2 - 1.5), (x1 - x0 + 2, 2, -deep))
        for (xx, sgn) in ((x0, -1), (x1, 1)):
            M.box(wall, (xx + sgn * 1, HOLE_D / 2, deep / 2 - 1.5), (2, HOLE_D, -deep))
            a, b = (x0 - 40, x0) if sgn < 0 else (x1, x1 + 40)
            M.box(wall, ((a + b) / 2, 1, deep / 2 - 1.5), (b - a, 2, -deep))
        # crumbling edges: clods and stones along the hole's rim
        clod = wall
        for i in range(70):
            side = rng.random()
            if side < 0.5:
                x = rng.uniform(x0 + 2, x1 - 2); y = HOLE_D + rng.uniform(-1, 2)
            else:
                x = rng.choice((x0 + rng.uniform(-3, 2), x1 + rng.uniform(-2, 3))); y = rng.uniform(1, HOLE_D)
            M.blob(clod, (x, y, rng.uniform(-3, 0)), rng.uniform(1.2, 3.0), displace=0.3, seed=i, subdiv=1)
        if t['lip'] == 'grass':
            blade = mats.grass_blades(f'pit-{terrain}-grass', t['top'][0], t['top'][1], t['top'][2])
            for i in range(420):
                r = rng.random()
                if r < 0.5:
                    x = rng.uniform(x0 - 30, x1 + 30); y = HOLE_D + rng.uniform(0, 6)
                    if x0 < x < x1: y = HOLE_D + rng.uniform(0.5, 4)
                else:
                    x = rng.choice((x0 - rng.uniform(0, 30), x1 + rng.uniform(0, 30))); y = rng.uniform(0, HOLE_D + 4)
                d = Vector((rng.uniform(-0.5, 0.5), rng.uniform(-0.7, 0.2), 1)).normalized()
                L = rng.uniform(3, 7)
                M.card(blade, Vector((x, y, 0)) + d * L / 2, 0.9, L, Vector((0, -1, 0.2)), up=d)
            # roots hanging from the lips into the hole
            root = mats.bark(f'pit-{terrain}-root', base='#5a4332', dark='#2a1d14', light='#7a624c', scale=2.0)
            for i in range(14):
                xx = rng.choice((x0 + 1.5, x1 - 1.5)) if i < 6 else rng.uniform(x0 + 10, x1 - 10)
                yy = rng.uniform(4, HOLE_D - 2) if i < 6 else HOLE_D - 0.5
                pts = [Vector((xx, yy, -1 - k * 3.2)) + Vector((rng.uniform(-1.5, 1.5), 0, 0)) for k in range(6)]
                M.tube(root, pts, [0.9 - 0.12 * k for k in range(6)], segs=5)
        elif t['lip'] == 'concrete':
            hazard = mats.stripes('pit-hazard', '#e8b73a', '#232426', width=4.0, angle=45)
            for (a, b) in ((x0 - 20, x0), (x1, x1 + 20)):
                M.box(hazard, ((a + b) / 2, (HOLE_D + 4) / 2, 0.3), (b - a, HOLE_D + 4, 0.4))
            M.box(hazard, ((x0 + x1) / 2, HOLE_D + 6, 0.3), (x1 - x0 + 40, 10, 0.4))
            rebar = mats.rust('pit-rebar', '#6a5040', amount=0.8)
            for i in range(10):
                xx = rng.choice((x0 + 1, x1 - 1)); yy = rng.uniform(3, HOLE_D - 3)
                M.cylinder(rebar, (xx, yy, -2), (xx + (4 if xx < 100 else -4) * rng.uniform(0.5, 1), yy, -8), 0.5, segs=5)
        else:
            water = mats.water('pit-tidal-water', deep='#123a48', shallow='#2e7a8a', foam='#cfe8e4')
            M.box(water, ((x0 + x1) / 2, HOLE_D / 2, -26), (x1 - x0, HOLE_D, 1))
            weed = mats.leaves('pit-weed', '#1d2d16', '#3d5222', '#6f7a30', cards=True, scale=0.5)
            for i in range(80):
                xx = rng.choice((x0 + rng.uniform(0, 3), x1 - rng.uniform(0, 3))); yy = rng.uniform(1, HOLE_D)
                M.card(weed, Vector((xx, yy, rng.uniform(-18, -2))), 1.4, 5, Vector((1 if xx < 100 else -1, 0, 0)), up=(0, 0, 1))
        return [M.done(coll)]
    return build


# ---------------------------------------------------------------- waterfalls

WF_W = 520.0
WF_TOP = 180.0      # the rock column's top is 180 px above the running line (y 510)


def waterfall_frame():
    return (-36, -(WF_TOP + 14), WF_W + 72, WF_TOP + 44)


def sheet_frame():
    return (0, 0, 240, 64)


WATERFALLS = {
    'mossy': dict(rock=[(0.2, '#3a3d36'), (0.5, '#5c6154'), (0.8, '#7f8574')], moss='#5f8a2e', top=('#4a6a2a', '#6a8a3a', '#8aa54a')),
    'basalt': dict(rock=[(0.2, '#23272a'), (0.5, '#3f4548'), (0.8, '#61696b')], moss=None, top=('#7a8a5a', '#9aa86a', '#c4c28a')),
}


def waterfall(variant):
    def build(ctx):
        v = WATERFALLS[variant]
        rng = random.Random('waterfall:' + variant)
        coll = ctx['coll']
        rock = mats.stone(f'wf-{variant}-rock', v['rock'], scale=0.035, moss=v['moss'], moss_amount=1.0, bump=1.2)
        wet = mats.stone(f'wf-{variant}-wet', v['rock'], scale=0.05, wet=True, bump=0.6)
        water = mats.water(f'wf-{variant}-water', deep='#3d8ea3', shallow='#a9dde4', foam='#f6fcfb', axis='z')
        river = mats.water(f'wf-{variant}-river', deep='#2a7a92', shallow='#6cbccb', foam='#e8f6f5', axis='z')
        foam = mats.paint(f'wf-{variant}-foam', '#f1faf9', rough=0.7, grime=0.04)
        mist = mats.material(f'wf-{variant}-mist', lambda nb: dict(color=nb.rgb('#e8f2f2'), rough=1.0, alpha=0.45))
        pool = mats.water(f'wf-{variant}-pool', deep='#0f3a48', shallow='#2e7f90', foam='#d8f0ee')
        topm = mats.leaves(f'wf-{variant}-top', *v['top'], cards=False, scale=0.3)
        x0, x1 = 24.0, WF_W - 24.0
        D = 70.0
        H = height_for(WF_TOP, D)
        M = geo.Mesh('waterfall-' + variant, [rock])
        before = set(M.bm.faces)
        ret = bmesh.ops.create_cube(M.bm, size=1.0)
        for vv in ret['verts']:
            vv.co = Vector(((vv.co.x + 0.5) * (x1 - x0) + x0, (vv.co.y + 0.5) * D, (vv.co.z + 0.5) * (H + 80) - 80))
        new = [f for f in M.bm.faces if f not in before]
        bmesh.ops.subdivide_edges(M.bm, edges=list({e for f in new for e in f.edges}), cuts=48, use_grid_fill=True)
        off = Vector((1.3, 5.1, 2.2))
        for vv in {vv for f in M.bm.faces if f not in before for vv in f.verts}:
            co = vv.co
            n1 = noise.noise(Vector((co.x * 0.025, co.y * 0.025, co.z * 0.04)) + off)
            n2 = noise.noise(Vector((co.x * 0.09, co.y * 0.09, co.z * 0.12)) + off * 2)
            # stepped strata: ledges every ~22 px that jut out and overhang
            ledge = 3.0 * (((co.z + 7 * n1) / 22.0) % 1.0)
            if co.y < 1.0:
                co.y -= 6.0 * n1 + 2.0 * n2 + ledge
            if co.z > H - 1:
                co.z += 1.5 * n1
            if co.x < x0 + 1:
                co.x -= 3 * n1
            if co.x > x1 - 1:
                co.x += 3 * n1
        M._tag([f for f in M.bm.faces if f not in before], rock, False)
        M.box(topm, ((x0 + x1) / 2, D / 2, H + 1.2), (x1 - x0 - 2, D - 2, 2.4), bevel=1.0)
        # tufts and ferns along the top edge
        fern = mats.leaves(f'wf-{variant}-fern', v['top'][0], v['top'][1], v['top'][2], cards=True, scale=0.5)
        for i in range(260):
            x = rng.uniform(x0, x1)
            if 140 < x < 380: continue
            b = Vector((x, rng.uniform(-2, 8), H + 1.5))
            d = Vector((rng.uniform(-0.6, 0.6), rng.uniform(-0.9, 0.1), rng.uniform(0.2, 1.0))).normalized()
            M.card(fern, b + d * 4, 2.2, 8, Vector((0, -1, 0.3)), up=d)
        cx0, cx1 = 150.0, 370.0
        M.box(river, ((cx0 + cx1) / 2, D / 2, H + 2.8), (cx1 - cx0, D, 1.2))
        steps = 30
        vl, vr = [], []
        for k in range(steps + 1):
            t = k / steps
            z = H + 3 - (H + 80) * t
            y = -5 - 12 * math.sin(min(1.0, t * 5) * math.pi / 2) - 3 * t
            vl.append(M.bm.verts.new((cx0 + 5 * math.sin(k * 0.7) + 8 * t, y, z)))
            vr.append(M.bm.verts.new((cx1 + 5 * math.sin(k * 0.9 + 1) - 8 * t, y, z)))
        cf = []
        for k in range(steps):
            f = M.bm.faces.new((vl[k], vr[k], vr[k + 1], vl[k + 1]))
            for loop in f.loops:
                loop[M.uv].uv = (loop.vert.co.x * 0.05, loop.vert.co.z * 0.05)
            cf.append(f)
        M._tag(cf, water, True)
        M.cylinder(foam, (cx0, -3, H + 2.4), (cx1, -3, H + 2.4), 3.6, segs=12)
        # spray at the foot: foam lumps and a translucent mist bank
        for i in range(120):
            x = rng.uniform(cx0 - 12, cx1 + 12)
            M.blob(foam, (x, rng.uniform(-26, -10), rng.uniform(-8, 4)), rng.uniform(2.5, 6), displace=0.35, seed=i, subdiv=2)
        for i in range(16):
            x = cx0 - 20 + i * (cx1 - cx0 + 40) / 15
            M.blob(mist, (x, -34, rng.uniform(0, 10)), rng.uniform(12, 18), displace=0.3, seed=200 + i, subdiv=2)
        M.box(pool, ((x0 + x1) / 2, -30, -8), (x1 - x0 + 40, 40, 1))
        for i in range(10):
            M.blob(wet, (rng.uniform(x0, x1), rng.uniform(-18, -4), rng.uniform(-6, 0)), rng.uniform(5, 10), squash=(1.3, 1, 0.7), displace=0.2, seed=40 + i, subdiv=2)
        lip = mats.soil(f'wf-{variant}-lip', base='#5a4632', dark='#2e2216', light='#7a6248')
        dark = mats.paint(f'wf-{variant}-void', '#08090a', rough=1.0)
        for (a, b) in ((-36.0, 0.0), (WF_W, WF_W + 36.0)):
            M.box(lip, ((a + b) / 2, 1, -20), (b - a, 2, 40))
        for (a, b) in ((0.0, x0), (x1, WF_W)):
            M.box(dark, ((a + b) / 2, 30, -30), (b - a + 4, 60, 60))
        return [M.done(coll)]
    return build


def water_sheet(variant):
    """A vertically periodic water sheet (64 px period) the runtime scrolls down
    over the curtain. Rendered head-on (flat), streaky and semi-transparent."""
    def build(ctx):
        coll = ctx['coll']

        def b(nb):
            p = mats.obj(nb)
            x, y, z = nb.separate(p)
            theta = nb.math('MULTIPLY', z, math.tau / 64.0)  # rendered at pitch 0: world z = -screen y
            r = 64.0 / math.tau
            vec = nb.combine(nb.math('MULTIPLY', x, 1.0), nb.math('MULTIPLY', nb.math('COSINE', theta), r), nb.math('MULTIPLY', nb.math('SINE', theta), r))
            n = nb.noise(mats.scaled(nb, vec, 0.35, 0.05, 0.05), scale=1.0, detail=6.0, distortion=0.6)
            streak = nb.maprange(n, 0.45, 0.75, 0.0, 1.0, smooth=True)
            c = nb.mix('#8fd0dc', '#f4fcfb', streak)
            return dict(color=c, rough=0.1, spec=0.7, alpha=nb.maprange(n, 0.35, 0.8, 0.15, 0.85), emit=c, emit_beauty=0.4)
        mat = mats.material('wf-sheet-' + variant, b)
        M = geo.Mesh('sheet', [mat])
        M.quad(mat, [P(-4, 68, 0), P(244, 68, 0), P(244, -4, 0), P(-4, -4, 0)])
        return [M.done(coll)]
    return build
