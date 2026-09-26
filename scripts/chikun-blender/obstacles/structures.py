"""Buildings (town, city, suburb), pipes and the canopies.

Building collision: three 150 px rects side by side, heights H, H - 38, H with
H in [220, 340]. Each rect is drawn as a facade column anchored on the running
line and cropped at the rect top, then a cap (roof line) anchored at the rect
top covers the crop. Caps stay inside the rect except thin rooftop details (at
most 10 px above). Windows get an emission pass (lit at night by the runtime).

Pipe collision: a 95 px rect, height 120 to 230, on the running line: a shaft
column cropped at the top plus a cap. Canopy collision: a 330 px rect from the
top of the screen down to 440..580: a column anchored at its bottom edge.
"""
import bpy, math, random
from mathutils import Vector, Matrix
from . import mats, geo
from .rig import P, SP, CP, height_for

FLOOR = 52.0        # screen px per upper floor
GROUND = 72.0       # screen px of the ground floor
FACADE_H = 352.0


def facade_frame():
    return (-6, -FACADE_H, 162, FACADE_H + 8)


def cap_frame():
    return (-6, -14, 162, 66)


# ---------------------------------------------------------------- facade materials

def brick(name, color='#9a4a32', mortar='#cfc4b0', scale=1.0, dark=None):
    def build(nb):
        p = mats.obj(nb)
        x, y, z = nb.separate(p)
        br = nb.new('ShaderNodeTexBrick')
        nb.put(br.inputs['Vector'], nb.combine(x, z, y))
        br.inputs['Scale'].default_value = 0.16 * scale
        br.inputs['Mortar Size'].default_value = 0.035
        br.inputs['Brick Width'].default_value = 0.5
        br.inputs['Row Height'].default_value = 0.2
        br.offset = 0.5
        c1 = nb.mix(color, dark or '#6f3322', nb.noise(p, scale=0.5, detail=2.0))
        nb.put(br.inputs['Color1'], c1)
        nb.put(br.inputs['Color2'], nb.mix(color, '#ffffff', 0.12))
        nb.put(br.inputs['Mortar'], nb.rgb(mortar))
        n = nb.noise(p, scale=0.05, detail=4.0)
        c = nb.mix(br.outputs['Color'], (0.05, 0.05, 0.05), nb.math('MULTIPLY', nb.maprange(n, 0.5, 0.8, 0, 1), 0.2))
        return dict(color=c, rough=0.85, spec=0.2, normal=nb.bump(nb.math('SUBTRACT', 1.0, br.outputs['Fac']), strength=0.35, distance=0.6))
    return mats.material(name, build)


def stone_blocks(name, color='#cdb58f', mortar='#a8936f'):
    def build(nb):
        p = mats.obj(nb)
        x, y, z = nb.separate(p)
        br = nb.new('ShaderNodeTexBrick')
        nb.put(br.inputs['Vector'], nb.combine(x, z, y))
        br.inputs['Scale'].default_value = 0.055
        br.inputs['Mortar Size'].default_value = 0.02
        br.inputs['Brick Width'].default_value = 0.7
        br.inputs['Row Height'].default_value = 0.3
        n = nb.noise(p, scale=0.2, detail=5.0)
        nb.put(br.inputs['Color1'], nb.mix(color, '#8f7a58', nb.math('MULTIPLY', n, 0.5)))
        nb.put(br.inputs['Color2'], nb.mix(color, '#e8d8b8', 0.3))
        nb.put(br.inputs['Mortar'], nb.rgb(mortar))
        return dict(color=br.outputs['Color'], rough=0.9, spec=0.2, normal=nb.bump(nb.math('ADD', nb.math('SUBTRACT', 1.0, br.outputs['Fac']), nb.math('MULTIPLY', n, 0.3)), strength=0.4, distance=0.8))
    return mats.material(name, build)


def siding(name, color='#a9d6c3', pitch=4.2):
    """Clapboard: overlapping horizontal boards (sawtooth bump along z)."""
    def build(nb):
        p = mats.obj(nb)
        z = nb.separate(p)[2]
        f = nb.math('FRACT', nb.math('DIVIDE', z, pitch))
        n = nb.noise(p, scale=0.1, detail=3.0)
        c = nb.mix(nb.rgb(color), (0, 0, 0), nb.math('MULTIPLY', nb.maprange(f, 0.0, 0.18, 0.35, 0.0), 1.0))
        c = nb.mix(c, (1, 1, 1), nb.math('MULTIPLY', n, 0.06))
        return dict(color=c, rough=0.6, spec=0.35, normal=nb.bump(f, strength=0.5, distance=0.5))
    return mats.material(name, build)


def plaster(name, color='#e8dcc0', grime=0.18):
    return mats.paint(name, color, rough=0.9, grime=grime, spec=0.2, scale=0.05, bump=0.1, dirt_low=(0, 30, '#6a5c48'))


def roof_tiles(name, color='#46505a', rows=4.5, cols=7.0):
    """Slate / shingle / terracotta courses on a sloped roof plane (object x, z)."""
    def build(nb):
        p = mats.obj(nb)
        x, y, z = nb.separate(p)
        along = nb.math('ADD', z, nb.math('MULTIPLY', y, 1.0))
        row = nb.math('FLOOR', nb.math('DIVIDE', along, rows))
        fz = nb.math('FRACT', nb.math('DIVIDE', along, rows))
        off = nb.math('MULTIPLY', nb.math('FRACT', nb.math('MULTIPLY', row, 0.5)), cols)
        fx = nb.math('FRACT', nb.math('DIVIDE', nb.math('ADD', x, off), cols))
        rnd = nb.white(nb.combine(nb.math('FLOOR', nb.math('DIVIDE', nb.math('ADD', x, off), cols)), row, 0))[0]
        c = nb.mix(color, '#000000', nb.math('MULTIPLY', rnd, 0.25))
        c = nb.mix(c, '#000000', nb.maprange(fz, 0.0, 0.2, 0.45, 0.0))
        c = nb.mix(c, '#000000', nb.maprange(nb.math('MINIMUM', fx, nb.math('SUBTRACT', 1.0, fx)), 0.0, 0.05, 0.4, 0.0))
        return dict(color=c, rough=0.6, spec=0.4, normal=nb.bump(fz, strength=0.4, distance=0.6))
    return mats.material(name, build)


def curtain_glass(name, tint='#27485a', sky='#9fc6d6', mull='#2a3036', cell=(12.0, 13.0)):
    """Glass curtain wall with mullions; lit panels come from a separate emissive layer."""
    def build(nb):
        p = mats.obj(nb)
        x, y, z = nb.separate(p)
        fx = nb.math('FRACT', nb.math('DIVIDE', x, cell[0]))
        fz = nb.math('FRACT', nb.math('DIVIDE', z, cell[1]))
        m = nb.math('MAXIMUM', nb.maprange(nb.math('MINIMUM', fx, nb.math('SUBTRACT', 1.0, fx)), 0.0, 0.07, 1.0, 0.0), nb.maprange(nb.math('MINIMUM', fz, nb.math('SUBTRACT', 1.0, fz)), 0.0, 0.06, 1.0, 0.0))
        n = nb.noise(p, scale=0.01, detail=2.0)
        rnd = nb.white(nb.combine(nb.math('FLOOR', nb.math('DIVIDE', x, cell[0])), nb.math('FLOOR', nb.math('DIVIDE', z, cell[1])), 0))[0]
        refl = nb.maprange(nb.math('ADD', nb.math('MULTIPLY', z, 0.003), nb.math('ADD', nb.math('MULTIPLY', n, 0.8), nb.math('MULTIPLY', rnd, 0.25))), 0.3, 1.6, 0.0, 1.0)
        g = nb.mix(tint, sky, nb.math('MULTIPLY', refl, 0.6))
        c = nb.mix(g, mull, m)
        return dict(color=c, rough=nb.mixf(0.06, 0.4, m), spec=0.9, metal=nb.mixf(0.2, 0.8, m), coat=0.5)
    return mats.material(name, build)


# ---------------------------------------------------------------- styles

STYLES = {
    # town (cobbles, deep night)
    'town-timber': dict(wall='timber', color='#eadcbc', trim='#3b2a20', win=('cols', 3), shutters=None, base='#8e8272', awning=('#b8322b', '#efe6d4'), sign='pretzel', cap='mansard', roof='#48525e', floors_trim='#3b2a20'),
    'town-terracotta': dict(wall='plaster', color='#c8683f', trim='#efe2c6', win=('cols', 3), shutters='#3e7c7a', base='#9a5a3a', awning=('#3e7c4a', '#efe6d4'), sign='cup', cap='terracotta', roof='#a8462c', balcony='#2a2a2a'),
    'town-stone': dict(wall='stone', color='#d2bb92', trim='#b39c74', win=('arch', 3), shutters=None, base='#8f7a58', awning=('#2f4f7a', '#e6e0d0'), sign='book', cap='balustrade', roof='#8f7a58'),
    # city (asphalt, night into dawn)
    'city-glass': dict(wall='curtain', color='#27485a', trim='#2a3036', base='#2a3036', lobby=True, cap='parapet-glass', roof='#3a4046'),
    'city-brick': dict(wall='brick', color='#8a4432', trim='#d8cbb4', win=('cols', 3), base='#2c2f33', neon='#ff4fa8', fire_escape=True, cap='parapet-brick', roof='#5a3a30'),
    'city-concrete': dict(wall='concrete', color='#a7a69a', trim='#6b6d6a', win=('ribbon', 0), base='#3a3d40', neon='#3fe3ff', cap='parapet-concrete', roof='#7c7b72'),
    # suburbs (pavement, afternoon into golden hour)
    'suburb-mint': dict(wall='siding', color='#a9d6c3', trim='#f6f2e8', win=('cols', 2), shutters='#4f6f86', base='#8c8a84', porch=True, cap='shingle', roof='#5b6470'),
    'suburb-butter': dict(wall='siding', color='#f2da8b', trim='#fbf7ee', win=('bay', 2), shutters=None, base='#8c8a84', porch=True, cap='falsefront', roof='#7a6a5a'),
    'suburb-blush': dict(wall='brick', color='#c98470', trim='#f7f3ea', win=('cols', 2), shutters='#2f4a3a', base='#8c8a84', garage=True, cap='flat-coping', roof='#6a5a58'),
}


def _wall_mat(st, key):
    kind = st['wall']
    if kind == 'timber':
        return mats.material(key + '-wall', _timber_builder(st['color'], st['trim']))
    if kind == 'plaster':
        return plaster(key + '-wall', st['color'])
    if kind == 'stone':
        return stone_blocks(key + '-wall', st['color'])
    if kind == 'brick':
        return brick(key + '-wall', st['color'], mortar='#cfc4b0' if 'city' in key else '#efe6d8')
    if kind == 'siding':
        return siding(key + '-wall', st['color'])
    if kind == 'concrete':
        return mats.concrete(key + '-wall', color=st['color'], dark='#85847a', stains=0.3, scale=0.08)
    return curtain_glass(key + '-wall', st['color'])


def _timber_builder(color, timber):
    def build(nb):
        p = mats.obj(nb)
        x, y, z = nb.separate(p)
        n = nb.noise(p, scale=0.06, detail=4.0)
        base = nb.mix(nb.rgb(color), (0.1, 0.08, 0.06), nb.math('MULTIPLY', nb.maprange(n, 0.5, 0.8, 0, 1), 0.2))
        sp, fh, tw = 25.0, FLOOR / CP, 1.6
        px = nb.math('FRACT', nb.math('DIVIDE', x, sp)); pz = nb.math('FRACT', nb.math('DIVIDE', nb.math('SUBTRACT', z, GROUND / CP), fh))
        post = nb.math('LESS_THAN', nb.math('MINIMUM', nb.math('MULTIPLY', px, sp), nb.math('MULTIPLY', nb.math('SUBTRACT', 1.0, px), sp)), tw)
        beam = nb.math('LESS_THAN', nb.math('MINIMUM', nb.math('MULTIPLY', pz, fh), nb.math('MULTIPLY', nb.math('SUBTRACT', 1.0, pz), fh)), tw)
        brace = nb.math('LESS_THAN', nb.math('ABSOLUTE', nb.math('SUBTRACT', nb.math('MULTIPLY', px, sp), nb.math('MULTIPLY', nb.math('SUBTRACT', 1.0, pz), sp))), tw * 1.1)
        fr = nb.math('MINIMUM', nb.math('ADD', nb.math('ADD', post, beam), nb.math('MULTIPLY', brace, nb.math('LESS_THAN', pz, 0.45))), 1.0)
        above = nb.math('GREATER_THAN', z, GROUND / CP)
        c = nb.mix(base, timber, nb.math('MULTIPLY', fr, above))
        return dict(color=c, rough=0.85, spec=0.2, normal=nb.bump(nb.math('MULTIPLY', fr, above), strength=0.4, distance=0.8))
    return build


def _glass_pair(key):
    dark = mats.glass(key + '-glass', tint='#1d2a33', sky='#8fb3c4')
    def lit_build(nb):
        return dict(color=nb.rgb('#2a2a26'), rough=0.08, spec=0.9, coat=0.5, emit=nb.rgb('#ffcf86'), emit_strength=2.2)
    lit = mats.material(key + '-glass-lit', lit_build, emissive=True)
    return dark, lit


def facade(style):
    def build(ctx):
        st = STYLES[style]
        rng = random.Random('facade:' + style)
        coll = ctx['coll']
        wall = _wall_mat(st, style)
        trim = mats.paint(style + '-trim', st['trim'], rough=0.6, grime=0.1)
        base_m = mats.paint(style + '-base', st['base'], rough=0.8, grime=0.25, dirt_low=(0, 20, '#3a332a'))
        glass, glass_lit = _glass_pair(style)
        shop = mats.emissive(style + '-shop', '#ffc27a', body='#3a2e22', strength=2.6)
        M = geo.Mesh(style, [wall])
        W = 150.0
        D = 60.0
        Hz = height_for(FACADE_H, 0) + 4
        g = GROUND / CP
        fz = FLOOR / CP
        # wall body (upper floors) and a base course
        # the wall face stands at y = 3 so frames, sills and glass sit proud of it
        M.box(wall, (W / 2, D / 2 + 3, g + (Hz - g) / 2), (W, D, Hz - g))
        M.box(base_m, (W / 2, D / 2 + 3, g / 2), (W, D, g))
        # floor trims / string courses
        z = g
        while z < Hz:
            M.box(trim, (W / 2, -0.8, z + 0.9), (W + 1.5, 2.4, 1.8), bevel=0.4)
            z += fz
        # upper windows
        kind, n = st.get('win', ('cols', 3))
        z = g
        lit_count = 0
        while z + fz <= Hz + fz:
            if st['wall'] == 'curtain':
                break
            if kind == 'ribbon':
                M.box(glass_lit if rng.random() < 0.5 else glass, (W / 2, -0.2, z + fz * 0.52), (W - 16, 1.2, fz * 0.42), bevel=0.3)
                for k in range(7):
                    M.box(trim, (12 + k * (W - 24) / 6, -1.4, z + fz * 0.52), (2.2, 2.6, fz * 0.46), bevel=0.3)
            else:
                cols = n
                ww = 24.0 if cols == 3 else 30.0
                for k in range(cols):
                    cx = W * (k + 0.5) / cols
                    wz0, wh = z + fz * 0.2, fz * 0.58
                    lit = rng.random() < 0.55
                    gm = glass_lit if lit else glass
                    if kind == 'bay' and k == 0:
                        # a projecting bay window
                        M.box(trim, (cx, -6, wz0 + wh / 2), (ww + 10, 12, wh + 6), bevel=0.6)
                        M.box(gm, (cx, -12.3, wz0 + wh / 2), (ww, 1.0, wh - 2), bevel=0.3)
                        continue
                    # recess, glass, frame, sill, mullion
                    # dark reveal behind the pane (the wall face is at y 3), glass just in front of it
                    M.box(mats.paint(style + '-reveal', '#2a2622', rough=0.9), (cx, 2.4, wz0 + wh / 2), (ww + 1, 1.0, wh + 1))
                    M.box(gm, (cx, 1.6, wz0 + wh / 2), (ww - 1, 0.6, wh - 1))
                    if kind == 'arch':
                        # a round-headed window: half-disc of glass under a moulded arch
                        rr = ww / 2
                        arc = [(cx + math.cos(a) * (rr + 0.6), -0.4, wz0 + wh + math.sin(a) * (rr + 0.6)) for a in [k2 / 16 * math.pi for k2 in range(17)]]
                        M.tube(trim, arc, 1.3, segs=8)
                        fan = [Vector((cx, 1.6, wz0 + wh))] + [Vector((cx + math.cos(a) * rr, 1.6, wz0 + wh + math.sin(a) * rr)) for a in [k2 / 16 * math.pi for k2 in range(17)]]
                        for k2 in range(16):
                            M.quad(gm, [fan[0], fan[k2 + 1], fan[k2 + 2], fan[0] + Vector((0, 0.001, 0))])
                        M.box(mats.paint(style + '-reveal', '#2a2622', rough=0.9), (cx, 2.4, wz0 + wh + rr / 2), (ww + 1, 1.0, rr))
                    for sgn in (-1, 1):
                        M.box(trim, (cx + sgn * (ww / 2 + 0.8), -0.4, wz0 + wh / 2), (1.8, 2.6, wh + 2))
                    M.box(trim, (cx, -0.4, wz0 + wh + 0.9), (ww + 3, 2.6, 1.8))
                    M.box(trim, (cx, -1.6, wz0 - 0.9), (ww + 5, 4.0, 1.8), bevel=0.4)
                    M.box(trim, (cx, 1.0, wz0 + wh / 2), (1.2, 1.6, wh))
                    M.box(trim, (cx, 1.0, wz0 + wh * 0.55), (ww, 1.6, 1.0))
                    if st.get('shutters'):
                        sh = mats.paint(style + '-shutter', st['shutters'], rough=0.6, grime=0.15)
                        for sgn in (-1, 1):
                            M.box(sh, (cx + sgn * (ww / 2 + 6.5), -0.8, wz0 + wh / 2), (9, 1.6, wh), bevel=0.4)
                    if st.get('balcony') and k == 1:
                        rail = mats.paint(style + '-rail', st['balcony'], rough=0.4, metal=0.8)
                        M.box(trim, (cx, -7, wz0 - 1.5), (ww + 16, 14, 2.2), bevel=0.4)
                        for b in range(9):
                            M.box(rail, (cx - (ww + 14) / 2 + b * (ww + 14) / 8, -13.2, wz0 + 4), (0.9, 0.9, 11))
                        M.box(rail, (cx, -13.2, wz0 + 9.5), (ww + 16, 1.2, 1.2))
                    if style == 'town-timber':
                        box_m = mats.paint('flower-box', '#6b4a30', rough=0.8)
                        fl = mats.paint('flowers', '#d8445a', rough=0.6)
                        M.box(box_m, (cx, -3.5, wz0 - 3), (ww, 6, 4))
                        for f in range(7):
                            M.blob(fl if f % 2 else mats.paint('flowers-2', '#f2c14a', rough=0.6), (cx - ww / 2 + 2 + f * (ww - 4) / 6, -5, wz0 - 0.6), 1.9, displace=0.3, subdiv=1)
                    lit_count += lit
            z += fz
        if st['wall'] == 'curtain':
            # the curtain wall itself; lit panels are emissive boxes just behind the glass
            M.box(wall, (W / 2, -0.4, g + (Hz - g) / 2), (W, 1.0, Hz - g))
            for fl in range(int((Hz - g) / 13) + 1):
                for c in range(12):
                    if rng.random() < 0.4:
                        M.box(glass_lit, (6 + c * 12, 0.6, g + fl * 13 + 6.5), (10.5, 0.4, 11.5))
            for k in range(7):
                M.box(trim, (k * W / 6, -1.4, g + (Hz - g) / 2), (2.6, 2.4, Hz - g))
        if st.get('fire_escape'):
            steel = mats.paint(style + '-escape', '#1e2124', rough=0.5, metal=0.8)
            z = g + fz * 0.15
            while z < Hz:
                M.box(steel, (W * 0.5, -9, z), (W * 0.62, 18, 1.2))
                M.box(steel, (W * 0.5, -17.6, z + 5), (W * 0.62, 0.8, 0.8))
                for b in range(10):
                    M.box(steel, (W * 0.19 + b * W * 0.62 / 9, -17.6, z + 2.5), (0.6, 0.6, 5))
                M.cylinder(steel, (W * 0.24, -12, z), (W * 0.76, -12, z + fz), 0.7, segs=6)
                z += fz
        # ground floor: shopfront, door, awning, sign
        if st.get('lobby'):
            M.box(shop, (W / 2, 1.0, g * 0.45), (W - 10, 0.6, g * 0.8))
            steel = mats.paint(style + '-canopy', '#2a3036', rough=0.4, metal=0.8)
            M.box(steel, (W / 2, -9, g * 0.86), (W - 20, 18, 2.6), bevel=0.5)
            for k in range(6):
                M.box(trim, (8 + k * (W - 16) / 5, -0.8, g * 0.42), (2.2, 2.4, g * 0.84))
        elif st.get('garage'):
            door = siding(style + '-garage', '#f2efe6', pitch=6.0)
            M.box(door, (W * 0.62, -0.5, g * 0.42), (W * 0.62, 1.2, g * 0.8), bevel=0.4)
            M.box(glass_lit, (W * 0.16, 0.8, g * 0.5), (16, 0.6, g * 0.4))
            M.box(trim, (W * 0.16, -0.6, g * 0.5), (19, 1.6, g * 0.44))
        elif st.get('porch'):
            wood = mats.paint(style + '-porch', st['trim'], rough=0.6, grime=0.1)
            floor = mats.wood(style + '-deck', base='#8a6a4a', dark='#5a4230', light='#a88a66', axis='x', ring=0.5)
            M.box(floor, (W / 2, -12, 7), (W - 4, 24, 3.2), bevel=0.5)
            M.box(wood, (W / 2, -12, g * 0.92), (W - 2, 26, 3.2), bevel=0.6)
            M.box(mats.paint(style + '-porchroof', st['roof'] if 'roof' in st else '#5b6470', rough=0.6), (W / 2, -12, g * 0.98), (W + 2, 28, 2.4), bevel=0.4)
            for k in range(4):
                M.cylinder(wood, (6 + k * (W - 12) / 3, -22, 8), (6 + k * (W - 12) / 3, -22, g * 0.9), 2.0, segs=10)
            for b in range(22):
                M.box(wood, (4 + b * (W * 0.42) / 21, -23, 13), (1.1, 1.1, 12))
            M.box(wood, (4 + W * 0.21, -23, 19), (W * 0.42, 1.6, 1.4))
            M.box(glass_lit, (W * 0.72, 0.8, g * 0.46), (26, 0.6, g * 0.44))
            M.box(trim, (W * 0.72, -0.4, g * 0.46), (29, 1.6, g * 0.48))
            door = mats.paint(style + '-door', '#7a3b36' if 'mint' in style else '#2f4a6a', rough=0.5)
            M.box(door, (W * 0.5, 0.4, g * 0.4), (15, 1.2, g * 0.72), bevel=0.4)
        else:
            M.box(shop, (W * 0.33, 1.0, g * 0.46), (W * 0.5, 0.6, g * 0.52))
            M.box(trim, (W * 0.33, -0.6, g * 0.46), (W * 0.5 + 4, 1.8, g * 0.56), bevel=0.3)
            for k in range(3):
                M.box(trim, (W * 0.08 + k * W * 0.125, -1.0, g * 0.46), (1.4, 1.6, g * 0.52))
            door = mats.paint(style + '-door', '#2e3c34', rough=0.5)
            M.box(door, (W * 0.78, 0.2, g * 0.4), (18, 1.2, g * 0.74), bevel=0.4)
            M.box(glass_lit, (W * 0.78, -0.6, g * 0.62), (10, 0.4, g * 0.2))
            if st.get('awning'):
                a1, a2 = st['awning']
                aw = mats.stripes(style + '-awning', a1, a2, width=4.0, angle=90)
                prof = [(0, g * 0.86), (-16, g * 0.7), (-16, g * 0.64), (0, g * 0.8)]
                M.prism(aw, prof, W * 0.04, W * 0.62)
            if st.get('neon'):
                neon = mats.glow(style + '-neon', st['neon'], strength=5.0)
                M.box(mats.paint(style + '-signbox', '#15181c', rough=0.5), (W * 0.33, -1.6, g * 0.9), (W * 0.46, 2.4, 8), bevel=0.6)
                for k in range(5):
                    M.box(neon, (W * 0.16 + k * W * 0.085, -3.0, g * 0.9), (W * 0.05, 0.8, 3.2), bevel=0.3)
            if st.get('sign'):
                iron = mats.paint(style + '-iron', '#1e1e1e', rough=0.4, metal=0.8)
                gold = mats.paint(style + '-signgold', '#d6a93a', rough=0.35, metal=0.8)
                M.box(iron, (W * 0.9, -10, g * 1.02), (1.2, 20, 1.2))
                M.cylinder(gold, (W * 0.9, -18, g * 0.86), (W * 0.9, -16.6, g * 0.86), 7.5, segs=24)
                icon = mats.paint(style + '-icon', '#2a1e14', rough=0.5)
                if st['sign'] == 'cup':
                    M.box(icon, (W * 0.9, -18.3, g * 0.85), (6, 0.6, 6), bevel=0.6)
                elif st['sign'] == 'pretzel':
                    M.tube(icon, [(W * 0.9 + 4 * math.cos(a), -18.3, g * 0.86 + 4 * math.sin(2 * a)) for a in [k / 16 * math.tau for k in range(17)]], 0.9, segs=6, cap=False)
                else:
                    M.box(icon, (W * 0.9, -18.3, g * 0.86), (8, 0.6, 5.5), bevel=0.3)
        return [M.done(coll)]
    return build


def cap(style):
    """The roof line anchored at the rect top (local y 0 = rect top). The front
    wall top sits at y 46; the roof (or parapet) fills 0..46 across the full
    width, so the rect's top corners are covered."""
    def build(ctx):
        st = STYLES[style]
        rng = random.Random('cap:' + style)
        coll = ctx['coll']
        W = 150.0
        wall = _wall_mat(st, style + '-cap')
        trim = mats.paint(style + '-cap-trim', st['trim'], rough=0.6, grime=0.12)
        glass, glass_lit = _glass_pair(style + '-cap')
        M = geo.Mesh(style + '-cap', [wall])
        base_z = P(0, 50, 0).z
        top_z = P(0, 0, 0).z
        kind = st['cap']
        if kind in ('mansard', 'terracotta', 'shingle'):
            tiles = roof_tiles(style + '-tiles', st['roof'], rows=4.0 if kind != 'terracotta' else 3.4, cols=6.0 if kind != 'terracotta' else 4.0)
            # wall band under the eaves, then a steep roof plane rising back to the ridge line (y 0)
            M.box(wall, (W / 2, 20, base_z + 3), (W, 40, 10))
            M.box(trim, (W / 2, -1.5, P(0, 40, 0).z), (W + 4, 5, 2.6), bevel=0.6)
            depth_back = 34.0
            ridge_z = P(0, 0, depth_back).z
            eave_z = P(0, 38, 0).z
            M.prism(tiles, [(-3.5, eave_z), (depth_back, ridge_z), (depth_back + 6, ridge_z - 4), (6, eave_z - 6)], -2, W + 2)
            # a dormer window in the middle of the roof
            dz = P(0, 20, 12).z
            M.box(wall, (W * 0.5, 10, dz), (22, 18, 16), bevel=0.4)
            M.box(glass_lit if kind != 'shingle' else glass, (W * 0.5, 0.6, dz - 1), (13, 0.6, 10))
            M.box(tiles, (W * 0.5, 8, dz + 10), (26, 22, 3.0), bevel=0.8)
            # chimney (thin detail above the rect top, under 10 px)
            ch = mats.paint(style + '-chimney', '#8a5a44' if kind != 'shingle' else '#7a6a62', rough=0.8, grime=0.3)
            cz = P(0, -8, depth_back).z
            M.box(ch, (W * 0.8, depth_back - 4, (ridge_z + cz) / 2), (10, 8, cz - ridge_z + 16), bevel=0.5)
            M.box(trim, (W * 0.8, depth_back - 4, cz + 1), (12, 10, 2.2), bevel=0.4)
        elif kind == 'balustrade':
            M.box(wall, (W / 2, 20, (base_z + top_z) / 2), (W, 40, top_z - base_z))
            M.box(trim, (W / 2, -2.5, P(0, 34, 0).z), (W + 6, 7, 4.5), bevel=0.8)
            M.box(trim, (W / 2, -1.2, P(0, 4, 0).z), (W + 2, 4, 3.2), bevel=0.6)
            for k in range(15):
                M.cylinder(trim, (5 + k * (W - 10) / 14, -0.6, P(0, 30, 0).z), (5 + k * (W - 10) / 14, -0.6, P(0, 6, 0).z), 2.2, r2=1.6, segs=10)
            for x in (4, W - 4):
                M.box(trim, (x, -1.5, P(0, 18, 0).z), (7, 6, 26), bevel=0.6)
                M.blob(trim, (x, -1.5, P(0, -5, 0).z), 3.2, squash=(1, 1, 1.3), subdiv=2)
        elif kind.startswith('parapet') or kind in ('falsefront', 'flat-coping'):
            # a thin parapet wall: its top face stays a sliver, the roof deck behind is hidden
            M.box(wall, (W / 2, 3, (base_z + top_z) / 2 - 1), (W, 6, top_z - base_z))
            M.box(trim, (W / 2, -1.5, P(0, 3, 0).z), (W + 4, 6, 3.6), bevel=0.6)
            if kind == 'falsefront':
                for k in range(9):
                    M.box(trim, (6 + k * (W - 12) / 8, -2.5, P(0, 9, 0).z), (3, 4, 5), bevel=0.4)
                M.box(trim, (W / 2, -1.0, P(0, 24, 0).z), (W * 0.5, 2, 12), bevel=0.4)
            if kind == 'parapet-glass':
                steel = mats.paint(style + '-steel', '#2a3036', rough=0.4, metal=0.8)
                M.box(curtain_glass(style + '-capglass'), (W / 2, -0.4, (base_z + top_z) / 2), (W, 1, top_z - base_z - 4))
                M.cylinder(steel, (W * 0.3, 10, top_z - 4), (W * 0.3, 10, P(0, -9, 10).z), 0.8, segs=6)
                red = mats.glow(style + '-beacon', '#ff3030', strength=3.0)
                M.blob(red, (W * 0.3, 10, P(0, -9, 10).z), 1.3, subdiv=2)
            if kind in ('parapet-brick', 'parapet-concrete'):
                ac = mats.paint(style + '-ac', '#b8bcbc', rough=0.4, metal=0.5)
                for x in (W * 0.25, W * 0.7):
                    # rooftop units behind the parapet: their tops peek at most ~8 px above the rect
                    az = P(0, -8, 22).z
                    M.box(ac, (x, 22, az - 6), (18, 10, 12), bevel=0.8)
                    M.box(mats.paint(style + '-fan', '#3a3e42', rough=0.5), (x, 22, az + 0.1), (12, 7, 0.4))
            if kind == 'parapet-concrete':
                band = mats.glow(style + '-band', '#bfe8ff', strength=0.8)
                M.box(band, (W / 2, -0.8, P(0, 20, 0).z), (W - 10, 1.0, 1.4))
        objs = [M.done(coll)]
        return objs
    return build


# ---------------------------------------------------------------- pipes

PIPE_H = 240.0


def pipe_frame():
    return (-8, -PIPE_H, 111, PIPE_H + 8)


def pipe_cap_frame():
    return (-10, -16, 115, 50)


PIPES = {
    'pipe-rust': dict(paint='#c8662e', rust=0.55, band=True, color='#6a3a22'),
    'pipe-green': dict(paint='#3d6b5a', rust=0.2, band=False, color='#2a4a40'),
}


def pipe(style):
    def build(ctx):
        st = PIPES[style]
        coll = ctx['coll']
        body = mats.rust(style + '-body', st['paint'], amount=st['rust'])
        flange = mats.rust(style + '-flange', '#5c5f60', amount=st['rust'] * 0.8, metal=0.8)
        conc = mats.concrete(style + '-plinth', color='#b0ada2', dark='#86837a', scale=0.1)
        hazard = mats.stripes(style + '-hazard', '#e8b73a', '#232426', width=5.0, angle=45)
        wheel = mats.paint(style + '-wheel', '#b8322b', rough=0.4, spec=0.6)
        M = geo.Mesh(style, [body])
        R = 43.0
        cx = 47.5
        top = P(cx, -PIPE_H - 10, R).z
        M.cylinder(body, (cx, R, 0.0), (cx, R, top), R, segs=48)
        # concrete plinth
        M.box(conc, (cx, R, 5), (95 + 4, 2 * R + 4, 10), bevel=1.2)
        # flanges every ~52 px with bolts
        z = 30.0
        bolt = mats.paint(style + '-bolt', '#8f969a', rough=0.3, metal=1.0)
        while z < top:
            M.cylinder(flange, (cx, R, z - 2.5), (cx, R, z + 2.5), R + 3.2, segs=48, bevel=0.8)
            for k in range(10):
                a = math.pi * (0.1 + 0.8 * k / 9) + math.pi
                M.cylinder(bolt, (cx + math.cos(a) * (R + 2), R + math.sin(a) * (R + 2), z + 2.5), (cx + math.cos(a) * (R + 2), R + math.sin(a) * (R + 2), z + 4.0), 1.1, segs=6)
            z += 55.0
        if st['band']:
            M.cylinder(hazard, (cx, R, 16), (cx, R, 24), R + 0.4, segs=48, cap=False)
        # valve wheel on the near face
        vz = 62.0
        M.cylinder(flange, (cx, 0.5, vz), (cx, -8, vz), 3.2, segs=12)
        M.tube(wheel, [(cx + 11 * math.cos(a), -8.5, vz + 11 * math.sin(a)) for a in [k / 24 * math.tau for k in range(25)]], 1.6, segs=8, cap=False)
        for k in range(4):
            a = k / 4 * math.tau
            M.cylinder(wheel, (cx, -8.5, vz), (cx + 10 * math.cos(a), -8.5, vz + 10 * math.sin(a)), 0.9, segs=6)
        # a gauge
        M.cylinder(mats.paint(style + '-gauge', '#f0ede0', rough=0.3), (cx + 22, 0.0, 110), (cx + 22, -4, 110), 5.5, segs=20)
        return [M.done(coll)]
    return build


def pipe_cap(style):
    """Top of the pipe: a heavy flange and a vent cowl whose top edge is the rect top."""
    def build(ctx):
        st = PIPES[style]
        coll = ctx['coll']
        body = mats.rust(style + '-capbody', st['paint'], amount=st['rust'])
        flange = mats.rust(style + '-capflange', '#5c5f60', amount=st['rust'] * 0.8, metal=0.8)
        dark = mats.paint(style + '-mouth', '#141414', rough=0.9)
        M = geo.Mesh(style + '-cap', [body])
        R = 43.0
        cx = 47.5
        # the rim of the open top: its back edge lands on y 0
        rim_z = P(cx, 0, 2 * R + 3).z
        M.cylinder(body, (cx, R, rim_z - 40), (cx, R, rim_z - 4), R, segs=48)
        M.cylinder(flange, (cx, R, rim_z - 5), (cx, R, rim_z), R + 3.5, segs=48, bevel=0.8)
        M.cylinder(dark, (cx, R, rim_z + 0.05), (cx, R, rim_z + 0.3), R - 3, segs=48)
        M.cylinder(flange, (cx, R, rim_z - 26), (cx, R, rim_z - 21), R + 3.2, segs=48, bevel=0.8)
        return [M.done(coll)]
    return build


# ---------------------------------------------------------------- canopies

CANOPY_H = 600.0


def canopy_frame():
    return (-10, -CANOPY_H, 350, CANOPY_H + 16)


def canopy(style):
    def build(ctx):
        rng = random.Random('canopy:' + style)
        coll = ctx['coll']
        W = 330.0
        if style == 'canopy-forest':
            from .trees import clump_mat, foliage_volume
            from mathutils import noise
            core = clump_mat('canopy-core', '#0b170b', '#132613', '#223e1f')
            cards = [(mats.leaves('canopy-leaf', '#1d3a19', '#3a6a28', '#7faa47', cards=True, scale=0.4, translucent=0.14), 0.5),
                     (mats.leaves('canopy-leaf-2', '#243d1a', '#4c6f2a', '#94b456', cards=True, scale=0.4, translucent=0.14), 0.3),
                     (mats.leaves('canopy-leaf-3', '#162d18', '#2c5231', '#5b864d', cards=True, scale=0.4, translucent=0.12), 0.35)]
            bark = mats.bark('canopy-bark', base='#4a3a2c', dark='#1e1510', light='#6d5b49', moss='#4f7a2a', scale=1.0, axis='x')
            vine = mats.leaves('canopy-vine', '#2a4a1e', '#5a8a34', '#a8c860', cards=True, scale=0.5, translucent=0.15)
            M = geo.Mesh(style, [core])
            off = Vector((5.1, 2.2, 0.8))
            for gy in range(18):
                for gx in range(9):
                    M.blob(core, P(gx * (W / 8) + rng.uniform(-6, 6), -42 - gy * 34 + rng.uniform(-4, 4), 60), rng.uniform(28, 34), displace=0.25, freq=1.4, seed=2000 + gy * 9 + gx, subdiv=2)
            for (y0, y1) in ((-170, -120), (-360, -300)):
                M.tube(bark, [P(-12, y0, 12), P(W * 0.5, (y0 + y1) / 2 - 10, 6), P(W + 12, y1, 12)], [16, 12, 9], segs=16)

            def bottom_edge(x):
                # the underside hangs in lobes: at most ~8 px below the rect bottom, a few px above
                return 1.5 + 5.0 * noise.noise(Vector((x * 0.045, 0.7, 0.0)) + off) + 2.0 * abs(noise.noise(Vector((x * 0.14, 2.3, 0.0)) + off))

            def inside(q):
                sx, sy = q.x, -(q.y * SP + q.z * CP)
                if sx < -6 or sx > W + 6 or sy < -CANOPY_H - 20: return None
                b = bottom_edge(sx)
                if sy > b: return None
                front = lobes(sx, sy)
                if q.y < front or q.y > 46: return None
                d_front, d_bot, d_side = q.y - front, (b - sy) * 0.9, min(sx + 6, W + 6 - sx)
                d = min(d_front, d_bot, d_side)
                if d == d_front:
                    gx = (lobes(sx + 2, sy) - lobes(sx - 2, sy)) / 4; gy = (lobes(sx, sy + 2) - lobes(sx, sy - 2)) / 4
                    nrm = Vector((-gx * 2.2, -1, gy * 2.2))
                else:
                    nrm = Vector((0, -0.4, -0.6)) if d == d_bot else Vector((-1 if sx < W / 2 else 1, -0.3, 0))
                return (d, nrm.normalized())

            def lobes(sx, sy):
                return -10.0 * abs(noise.noise(Vector((sx * 0.022, sy * 0.02, 1.9)) + off)) ** 0.7 * 1.6 + 2.0 * noise.noise(Vector((sx * 0.08, sy * 0.08, 4.0)) + off) + 8.0
            box = (-8, -4, P(0, 20, 0).z - 10, W + 8, 44, P(0, -CANOPY_H - 30, 0).z + 10)
            foliage_volume(M, cards, rng, inside, box, 150000, size=(3.6, 5.2), keep=0.22, clump=0.04, seed=41)
            # hanging vines along the underside (thin, <= 14 px below the rect)
            for i in range(60):
                sx = rng.uniform(2, W - 2)
                start = P(sx, bottom_edge(sx) - 2, rng.uniform(-6, 2))
                L = rng.uniform(4, 11)
                for k in range(int(L / 2.2)):
                    qv = start + Vector((rng.uniform(-0.4, 0.4), 0, -(k * 2.2) / CP))
                    M.card(vine, qv, 1.6, 3.2, Vector((0, -1, 0.1)), up=(0, 0, 1))
            return [M.done(coll)]
        if style == 'canopy-scaffold':
            steel = mats.paint('scaffold-steel', '#b7bdc0', rough=0.35, metal=0.9, spec=0.7)
            plank = mats.wood('scaffold-plank', base='#b08a54', dark='#7a5a34', light='#d0ab74', axis='x', ring=0.6)
            net_mat = mats.material('scaffold-net', lambda nb: dict(color=nb.mix('#1f6b4a', '#2f8a5e', nb.noise(mats.obj(nb), scale=0.1, detail=2.0)), rough=0.8, alpha=0.8))
            tape = mats.stripes('scaffold-tape', '#e8b73a', '#1f2022', width=5.0, angle=45)
            lamp = mats.emissive('scaffold-lamp', '#ffd89a', body='#e8e0c8', strength=4.0, beauty=0.5)
            M = geo.Mesh(style, [steel])
            # netting over the whole column
            M.box(net_mat, (W / 2, 4, P(0, -CANOPY_H / 2, 4).z), (W + 6, 0.6, CANOPY_H / CP + 20))
            M.box(mats.paint('scaffold-back', '#243029', rough=0.9), (W / 2, 30, P(0, -CANOPY_H / 2, 30).z), (W + 4, 2, CANOPY_H / CP + 20))
            lvl = 0
            for y in range(0, int(CANOPY_H) + 60, 60):
                sy = -y - 2
                z = P(0, sy, -4).z
                M.box(plank, (W / 2, -6, z), (W + 8, 14, 3.4), bevel=0.4)
                M.box(steel, (W / 2, -13.5, z + 1.6), (W + 10, 1.6, 1.6))
                M.box(steel, (W / 2, -13.5, z + 16), (W + 10, 1.4, 1.4))
                if y == 0:
                    M.box(tape, (W / 2, -14.4, z - 3), (W + 8, 0.8, 5.5))
                    for x in range(12, int(W), 55):
                        M.box(lamp, (x, -12, z - 3.5), (8, 5, 2.2), bevel=0.4)
                lvl += 1
            for x in range(0, int(W) + 1, 55):
                M.cylinder(steel, (x, -13.5, P(0, 12, -13.5).z), (x, -13.5, P(0, -CANOPY_H - 20, -13.5).z), 1.6, segs=10)
                for y in range(0, int(CANOPY_H), 60):
                    a = P(x, -y - 2, -13.5); b2 = P(min(W, x + 55), -y - 58, -13.5)
                    if x + 55 <= W + 1:
                        M.cylinder(steel, a, b2, 1.0, segs=6)
            # chains hanging below the lowest deck (<= 14 px)
            chain = mats.paint('scaffold-chain', '#6a6e70', rough=0.4, metal=1.0)
            for x in (40, 170, 290):
                for k in range(5):
                    M.tube(chain, [(x + 1.4 * math.cos(a), -14, P(0, 2 + k * 2.4, -14).z + 1.4 * math.sin(a)) for a in [j / 10 * math.tau for j in range(11)]], 0.45, segs=5, cap=False)
            return [M.done(coll)]
        # industrial pipe rack
        steel = mats.rust('rack-steel', '#2f5a86', amount=0.3, metal=0.7)
        ibeam = mats.paint('rack-beam', '#34393d', rough=0.45, metal=0.8)
        hazard = mats.stripes('rack-hazard', '#e8b73a', '#1f2022', width=6.0, angle=45)
        pipes = [mats.rust('rack-pipe-a', '#9a9e9a', amount=0.35, metal=0.6), mats.rust('rack-pipe-b', '#c8662e', amount=0.4), mats.rust('rack-pipe-c', '#3d6b5a', amount=0.3)]
        lamp = mats.emissive('rack-lamp', '#ffb04a', body='#3a342a', strength=4.0, beauty=0.6)
        M = geo.Mesh(style, [steel])
        M.box(mats.paint('rack-back', '#262b2e', rough=0.9, grime=0.3), (W / 2, 40, P(0, -CANOPY_H / 2, 40).z), (W + 4, 2, CANOPY_H / CP + 20))
        # trusses: posts, cross beams, diagonals
        for x in (6, W / 2, W - 6):
            M.box(ibeam, (x, 0, P(0, -CANOPY_H / 2, 0).z), (7, 7, CANOPY_H / CP + 30))
        y = 0
        while y < CANOPY_H + 40:
            z = P(0, -y - 5, 0).z
            M.box(ibeam, (W / 2, 0, z), (W + 10, 8, 7))
            y += 90
        for k in range(8):
            z0 = P(0, -k * 90 - 5, 0).z; z1 = P(0, -k * 90 - 95, 0).z
            M.cylinder(steel, (8, -2, z0), (W / 2 - 4, -2, z1), 1.6, segs=6)
            M.cylinder(steel, (W / 2 + 4, -2, z1), (W - 8, -2, z0), 1.6, segs=6)
        # pipe runs across the column
        for i in range(26):
            sy = -rng.uniform(18, CANOPY_H - 10)
            r = rng.uniform(4, 9)
            d = rng.uniform(6, 34)
            z = P(0, sy, d).z
            M.cylinder(rng.choice(pipes), (-12, d, z), (W + 12, d, z), r, segs=16)
        # the bottom beam with hazard stripes, lamps, hooks
        zb = P(0, -7, -2).z
        M.box(hazard, (W / 2, -6.5, zb), (W + 10, 1.0, 11))
        for x in (40, 160, 280):
            M.box(lamp, (x, -6, zb - 6.5), (10, 5, 2.2), bevel=0.4)
        chain = mats.paint('rack-chain', '#6a6e70', rough=0.4, metal=1.0)
        for x in (100, 220):
            for k in range(4):
                M.tube(chain, [(x + 1.4 * math.cos(a), -4, P(0, 2 + k * 2.4, -4).z + 1.4 * math.sin(a)) for a in [j / 10 * math.tau for j in range(11)]], 0.45, segs=5, cap=False)
            M.tube(chain, [(x + 3 * math.cos(a), -4, P(0, 12, -4).z + 3 * math.sin(a)) for a in [j / 12 * math.pi + math.pi for j in range(13)]], 0.9, segs=6, cap=False)
        return [M.done(coll)]
    return build
