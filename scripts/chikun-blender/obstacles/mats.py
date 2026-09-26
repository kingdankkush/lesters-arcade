"""Cycles material library for the obstacle kits.

Built on chikun_lib.shading.NB. Every material keeps the scenery's EmitSwitch
group, so an emission-only pass (lit windows, LEDs, lamps) can be rendered
from the same scene. Colours are sRGB hex strings. Textures are object-space
procedurals (noise, voronoi, waves); nothing is downloaded.
"""
import bpy, math
from chikun_lib.shading import NB, srgb, _switch_group

_CACHE = {}


def material(name, build, emissive=False):
    key = name
    if key in _CACHE and _CACHE[key].name in bpy.data.materials:
        return _CACHE[key]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    tree = mat.node_tree
    for n in list(tree.nodes):
        tree.nodes.remove(n)
    nb = NB(tree)
    spec = build(nb)
    out = nb.new('ShaderNodeOutputMaterial')
    bsdf = nb.new('ShaderNodeBsdfPrincipled')
    nb.put(bsdf.inputs['Base Color'], spec.get('color', (0.5, 0.5, 0.5)))
    nb.put(bsdf.inputs['Roughness'], spec.get('rough', 0.7))
    nb.put(bsdf.inputs['Specular IOR Level'], spec.get('spec', 0.4))
    nb.put(bsdf.inputs['Metallic'], spec.get('metal', 0.0))
    if spec.get('normal') is not None:
        nb.put(bsdf.inputs['Normal'], spec['normal'])
    if spec.get('sheen'):
        nb.put(bsdf.inputs['Sheen Weight'], spec['sheen'])
        bsdf.inputs['Sheen Roughness'].default_value = 0.5
    if spec.get('coat'):
        nb.put(bsdf.inputs['Coat Weight'], spec['coat'])
    if spec.get('sss'):
        bsdf.inputs['Subsurface Weight'].default_value = spec['sss']
        bsdf.inputs['Subsurface Scale'].default_value = spec.get('sss_scale', 2.0)
    if spec.get('transmission'):
        nb.put(bsdf.inputs['Transmission Weight'], spec['transmission'])
    if spec.get('emit') is not None and not emissive:
        # Always-on glow (lamp lenses, LEDs) also in the beauty pass.
        nb.put(bsdf.inputs['Emission Color'], spec['emit'])
        nb.put(bsdf.inputs['Emission Strength'], spec.get('emit_beauty', 0.0))
    beauty = bsdf.outputs[0]
    if spec.get('translucent'):
        tr = nb.new('ShaderNodeBsdfTranslucent')
        nb.put(tr.inputs['Color'], spec.get('color', (0.5, 0.5, 0.5)))
        m = nb.new('ShaderNodeMixShader'); m.inputs[0].default_value = spec['translucent']
        nb.l.new(beauty, m.inputs[1]); nb.l.new(tr.outputs[0], m.inputs[2])
        beauty = m.outputs[0]
    ee = nb.new('ShaderNodeEmission')
    if emissive and spec.get('emit') is not None:
        nb.put(ee.inputs['Color'], spec['emit'])
        nb.put(ee.inputs['Strength'], spec.get('emit_strength', 1.0))
    else:
        ee.inputs['Color'].default_value = (0, 0, 0, 1)
        ee.inputs['Strength'].default_value = 0.0
    sw = nb.new('ShaderNodeGroup'); sw.node_tree = _switch_group()
    fm = nb.new('ShaderNodeMixShader'); nb.l.new(sw.outputs[0], fm.inputs[0])
    nb.l.new(beauty, fm.inputs[1]); nb.l.new(ee.outputs[0], fm.inputs[2])
    surface = fm.outputs[0]
    if spec.get('alpha') is not None:
        tp = nb.new('ShaderNodeBsdfTransparent')
        am = nb.new('ShaderNodeMixShader')
        nb.put(am.inputs[0], spec['alpha'])
        nb.l.new(tp.outputs[0], am.inputs[1]); nb.l.new(surface, am.inputs[2])
        surface = am.outputs[0]
    nb.l.new(surface, out.inputs['Surface'])
    if spec.get('volume') is not None:
        nb.l.new(spec['volume'], out.inputs['Volume'])
    _CACHE[key] = mat
    return mat


def obj(nb):
    return nb.texcoord().outputs['Object']


def gen(nb):
    return nb.texcoord().outputs['Generated']


def uvco(nb):
    return nb.texcoord().outputs['UV']


def scaled(nb, vec, sx, sy, sz):
    return nb.vmath('MULTIPLY', vec, (sx, sy, sz))


def up_facing(nb, lo=0.35, hi=0.75):
    z = nb.separate(nb.geometry().outputs['Normal'])[2]
    return nb.maprange(z, lo, hi, 0.0, 1.0, smooth=True)


# ---------------------------------------------------------------- library

def paint(name, color, rough=0.55, grime=0.18, edge=None, spec=0.45, metal=0.0, scale=0.08, bump=0.08, dirt_low=None):
    """Painted surface (metal, plastic, plaster) with grime and optional dirt near the ground."""
    def build(nb):
        p = obj(nb)
        n = nb.noise(p, scale=scale, detail=5.0, rough=0.6)
        fine = nb.noise(p, scale=scale * 6, detail=3.0)
        c = nb.mix(nb.rgb(color), (0, 0, 0), nb.math('MULTIPLY', nb.maprange(n, 0.35, 0.8, 0.0, 1.0), grime))
        c = nb.mix(c, (1, 1, 1), nb.math('MULTIPLY', nb.object_random(), 0.06))
        if dirt_low is not None:
            z = nb.separate(nb.new('ShaderNodeNewGeometry').outputs['Position'])[2]
            d = nb.maprange(z, dirt_low[0], dirt_low[1], 1.0, 0.0, smooth=True)
            c = nb.mix(c, dirt_low[2], nb.math('MULTIPLY', d, nb.maprange(fine, 0.3, 0.7, 0.4, 0.9)))
        normal = nb.bump(nb.math('ADD', n, nb.math('MULTIPLY', fine, 0.4)), strength=bump, distance=1.0)
        return dict(color=c, rough=rough, spec=spec, metal=metal, normal=normal)
    return material(name, build)


def emissive(name, color, body='#2a2c30', strength=2.0, beauty=0.0):
    """A light source: dark body by day, bright in the emission pass (lamps,
    windows, LEDs). `beauty` > 0 also glows faintly in the lit pass."""
    def build(nb):
        return dict(color=nb.rgb(body), rough=0.3, emit=nb.rgb(color), emit_strength=strength, emit_beauty=beauty, spec=0.6)
    return material(name, build, emissive=True)


def glow(name, color, strength=4.0):
    """Always-lit (beauty pass) light: LEDs, lamp lenses."""
    def build(nb):
        return dict(color=nb.rgb(color), rough=0.2, emit=nb.rgb(color), emit_beauty=strength, spec=0.5)
    return material(name, build)


def wood(name, base='#9a6b3f', dark='#5a3a20', light='#c79a66', axis='x', ring=0.9, scale=1.0, rough=0.7, worn=0.0):
    """Sawn wood: grain stretched along `axis`, growth-ring waves and knots."""
    def build(nb):
        p = obj(nb)
        s = {'x': (0.05, 0.9, 0.9), 'y': (0.9, 0.05, 0.9), 'z': (0.9, 0.9, 0.05)}[axis]
        q = scaled(nb, p, *(v * scale for v in s))
        n = nb.noise(q, scale=1.0, detail=6.0, rough=0.6, distortion=0.4)
        wv = nb.new('ShaderNodeTexWave'); wv.wave_type = 'BANDS'; wv.bands_direction = {'x': 'Y', 'y': 'X', 'z': 'X'}[axis]
        nb.put(wv.inputs['Vector'], q); wv.inputs['Scale'].default_value = ring; wv.inputs['Distortion'].default_value = 6.0; wv.inputs['Detail'].default_value = 3.0
        f = nb.math('ADD', nb.math('MULTIPLY', n, 0.6), nb.math('MULTIPLY', wv.outputs['Fac'], 0.4))
        f = nb.math('ADD', f, nb.math('MULTIPLY', nb.object_random(), 0.2))
        c = nb.ramp(f, [(0.2, dark), (0.55, base), (0.85, light)])
        if worn:
            g = nb.noise(p, scale=0.15, detail=4.0)
            c = nb.mix(c, '#7d7a70', nb.math('MULTIPLY', nb.maprange(g, 0.45, 0.75, 0, 1), worn))
        normal = nb.bump(f, strength=0.35, distance=1.0)
        return dict(color=c, rough=rough, spec=0.3, normal=normal)
    return material(name, build)


def bark(name, base='#5d4432', dark='#2b1d14', light='#8a7058', moss=None, scale=1.0, lichen=None, axis='z'):
    """Fibrous bark with deep furrows running along `axis` (z for standing
    trunks, x for felled logs); optional moss on top surfaces."""
    def build(nb):
        p = obj(nb)
        st = {'z': (0.45, 0.45, 0.06), 'x': (0.06, 0.45, 0.45)}[axis]
        q = scaled(nb, p, *(v * scale for v in st))
        v = nb.voronoi(q, scale=1.0, feature='DISTANCE_TO_EDGE')
        furrow = nb.maprange(v.outputs['Distance'], 0.0, 0.12, 0.0, 1.0, smooth=True)
        n = nb.noise(q, scale=2.0, detail=6.0, rough=0.65)
        f = nb.math('MULTIPLY', furrow, nb.maprange(n, 0.2, 0.8, 0.55, 1.1))
        c = nb.ramp(f, [(0.08, dark), (0.5, base), (1.0, light)])
        if lichen:
            l = nb.noise(p, scale=0.25 * scale, detail=4.0)
            c = nb.mix(c, lichen, nb.maprange(l, 0.62, 0.7, 0.0, 0.7, smooth=True))
        if moss:
            m = nb.math('MULTIPLY', up_facing(nb, 0.1, 0.6), nb.maprange(nb.noise(p, scale=0.12, detail=5.0), 0.4, 0.6, 0.0, 1.0, smooth=True))
            c = nb.mix(c, moss, m)
        normal = nb.bump(f, strength=0.9, distance=2.0)
        return dict(color=c, rough=0.92, spec=0.2, normal=normal)
    return material(name, build)


def stone(name, stops, scale=0.06, moss=None, moss_amount=1.0, wet=False, bump=0.6, barnacles=None):
    """Rock: multi-scale mottling, fine grain and faint veins (no cell pattern)."""
    def build(nb):
        p = obj(nb)
        n = nb.noise(p, scale=scale, detail=7.0, rough=0.62, distortion=0.5)
        fine = nb.noise(p, scale=scale * 9, detail=4.0, rough=0.6)
        vein = nb.noise(scaled(nb, p, 1.0, 1.0, 0.3), scale=scale * 2.5, detail=5.0, distortion=2.5)
        v = nb.maprange(nb.math('ABSOLUTE', nb.math('SUBTRACT', vein, 0.5)), 0.0, 0.025, 1.0, 0.0, smooth=True)
        f = nb.math('ADD', nb.math('MULTIPLY', n, 0.8), nb.math('MULTIPLY', fine, 0.25))
        f = nb.math('SUBTRACT', f, nb.math('MULTIPLY', v, 0.25))
        c = nb.ramp(f, stops)
        if moss:
            mn = nb.noise(p, scale=scale * 2.5, detail=5.0)
            m = nb.math('MULTIPLY', up_facing(nb, 0.15, 0.6), nb.maprange(mn, 0.35, 0.55, 0.0, moss_amount, smooth=True))
            c = nb.mix(c, nb.mix(moss, '#2e4a22', nb.maprange(fine, 0.4, 0.8, 0, 0.6)), m)
        if barnacles:
            bv = nb.voronoi(p, scale=0.9, randomness=1.0)
            dots = nb.maprange(bv.outputs['Distance'], 0.08, 0.2, 1.0, 0.0, smooth=True)
            band = nb.maprange(nb.separate(nb.new('ShaderNodeNewGeometry').outputs['Position'])[2], barnacles[1], barnacles[1] + 14, 1.0, 0.0, smooth=True)
            c = nb.mix(c, barnacles[0], nb.math('MULTIPLY', dots, band))
        normal = nb.bump(nb.math('ADD', f, nb.math('MULTIPLY', fine, 0.5)), strength=bump, distance=2.0)
        return dict(color=c, rough=0.35 if wet else 0.88, spec=0.6 if wet else 0.3, normal=normal, coat=0.35 if wet else 0.0)
    return material(name, build)


def leaves(name, dark, mid, light, cards=False, blossom=None, scale=0.35, translucent=0.25, bump=0.6):
    """Leaf clumps (blobs) or leaf cards (quads with a procedural leaf-shaped alpha)."""
    def build(nb):
        p = obj(nb)
        v = nb.voronoi(p, scale=scale * 1.8)
        n = nb.noise(p, scale=scale * 0.35, detail=5.0, rough=0.6)
        f = nb.math('ADD', nb.math('MULTIPLY', v.outputs['Distance'], 0.5), nb.math('MULTIPLY', n, 0.65))
        f = nb.math('ADD', f, nb.math('MULTIPLY', nb.object_random(), 0.15))
        # Up-facing leaves catch the sky; undersides go dark (self-shadowed crown depth).
        f = nb.math('ADD', f, nb.math('MULTIPLY', up_facing(nb, -0.3, 0.8), 0.25))
        c = nb.ramp(f, [(0.3, dark), (0.62, mid), (0.95, light)])
        if blossom:
            bn = nb.noise(p, scale=scale * 1.2, detail=3.0)
            c = nb.mix(c, blossom, nb.maprange(bn, 0.45, 0.6, 0.0, 1.0, smooth=True))
        spec = dict(color=c, rough=0.62, spec=0.35, translucent=translucent, normal=nb.bump(nb.math('ADD', v.outputs['Distance'], n), strength=bump, distance=1.5))
        if cards:
            uv = uvco(nb)
            ux, uy, _ = nb.separate(uv)
            # leaf: an ellipse pinched at both ends (u in [0,1] along the leaf)
            dx = nb.math('SUBTRACT', ux, 0.5)
            dy = nb.math('SUBTRACT', uy, 0.5)
            shape = nb.math('ADD', nb.math('MULTIPLY', nb.math('MULTIPLY', dx, dx), 4.0), nb.math('MULTIPLY', nb.math('MULTIPLY', dy, dy), 4.0))
            spec['alpha'] = nb.math('LESS_THAN', shape, 1.0)
            # midrib and a lighter edge
            rib = nb.maprange(nb.math('ABSOLUTE', dx), 0.0, 0.04, 0.85, 1.0)
            spec['color'] = nb.mix(c, (0, 0, 0), nb.math('SUBTRACT', 1.0, rib))
        return spec
    return material(name, build)


def fur(name, base, light, dark, belly=None, belly_z=None, scale=1.0):
    """Short dense fur: fine streak noise along the body, soft sheen."""
    def build(nb):
        p = obj(nb)
        q = scaled(nb, p, 0.3 * scale, 1.2 * scale, 1.2 * scale)
        n = nb.noise(q, scale=1.5, detail=8.0, rough=0.7)
        big = nb.noise(p, scale=0.05, detail=2.0)
        f = nb.math('ADD', nb.math('MULTIPLY', n, 0.55), nb.math('MULTIPLY', big, 0.45))
        c = nb.ramp(f, [(0.25, dark), (0.55, base), (0.85, light)])
        normal = nb.bump(n, strength=0.25, distance=0.6)
        return dict(color=c, rough=0.65, spec=0.3, sheen=0.6, normal=normal, sss=0.05, sss_scale=1.5)
    return material(name, build)


def feathers(name, base, dark, light, tip=None, bars=0.0, scale=1.0):
    """Body plumage: soft overlapping feather scallops (large, low contrast),
    a light-to-dark gradient over the body and optional barring."""
    def build(nb):
        p = obj(nb)
        x, y, z = nb.separate(p)
        q = scaled(nb, p, 0.5 * scale, 0.9 * scale, 0.9 * scale)
        v = nb.voronoi(q, scale=1.0, feature='F1', randomness=0.7)
        scallop = nb.maprange(v.outputs['Distance'], 0.15, 0.6, 1.0, 0.0, smooth=True)
        n = nb.noise(p, scale=0.06, detail=3.0)
        f = nb.math('ADD', nb.math('MULTIPLY', scallop, 0.25), nb.math('MULTIPLY', n, 0.75))
        c = nb.ramp(f, [(0.2, dark), (0.5, base), (0.85, light)])
        if bars:
            b = nb.math('SINE', nb.math('MULTIPLY', x, 0.8))
            c = nb.mix(c, dark, nb.math('MULTIPLY', nb.maprange(b, 0.7, 0.95, 0, 1), bars))
        normal = nb.bump(scallop, strength=0.18, distance=0.6)
        return dict(color=c, rough=0.62, spec=0.35, sheen=0.35, normal=normal)
    return material(name, build)


def ramp_by_uv(name, stops, axis=0, rough=0.6, spec=0.35, sheen=0.0, translucent=0.0, alpha_shape=None):
    """Colour along a UV axis (feather cards: base -> tip)."""
    def build(nb):
        uv = uvco(nb)
        ux, uy, _ = nb.separate(uv)
        f = ux if axis == 0 else uy
        n = nb.noise(obj(nb), scale=0.4, detail=4.0)
        c = nb.ramp(nb.math('ADD', f, nb.math('MULTIPLY', nb.math('SUBTRACT', n, 0.5), 0.12)), stops)
        spec_d = dict(color=c, rough=rough, spec=spec, sheen=sheen, translucent=translucent)
        if alpha_shape == 'feather':
            # tapered feather: width shrinks toward the tip (u -> 1), rounded end
            dy = nb.math('ABSOLUTE', nb.math('SUBTRACT', uy, 0.5))
            half = nb.math('MULTIPLY', nb.math('SUBTRACT', 1.08, nb.math('POWER', ux, 3.0)), 0.5)
            spec_d['alpha'] = nb.math('LESS_THAN', dy, half)
        return spec_d
    return material(name, build)


def straw(name, base='#d8b35a', dark='#9c7a33', light='#f1d98e'):
    def build(nb):
        p = obj(nb)
        q = scaled(nb, p, 0.08, 1.6, 1.6)
        n = nb.noise(q, scale=1.0, detail=8.0, rough=0.7, distortion=1.5)
        q2 = scaled(nb, p, 1.6, 0.08, 1.6)
        n2 = nb.noise(q2, scale=1.0, detail=6.0, rough=0.7, distortion=1.5)
        f = nb.math('MAXIMUM', n, nb.math('MULTIPLY', n2, 0.9))
        c = nb.ramp(f, [(0.3, dark), (0.55, base), (0.8, light)])
        normal = nb.bump(f, strength=0.8, distance=1.0)
        return dict(color=c, rough=0.85, spec=0.25, normal=normal)
    return material(name, build)


def stripes(name, a, b, width=10.0, angle=45.0, rough=0.5, grime=0.15, axis='xz', spec=0.4):
    """Diagonal hazard / warning stripes in object space."""
    def build(nb):
        p = obj(nb)
        x, y, z = nb.separate(p)
        u = x if axis[0] == 'x' else y
        w = z
        ca, sa = math.cos(math.radians(angle)), math.sin(math.radians(angle))
        t = nb.math('ADD', nb.math('MULTIPLY', u, ca), nb.math('MULTIPLY', w, sa))
        s = nb.math('LESS_THAN', nb.math('FRACT', nb.math('DIVIDE', t, width * 2)), 0.5)
        c = nb.mix(a, b, s)
        n = nb.noise(p, scale=0.1, detail=4.0)
        c = nb.mix(c, (0.05, 0.05, 0.05), nb.math('MULTIPLY', nb.maprange(n, 0.45, 0.8, 0, 1), grime))
        return dict(color=c, rough=rough, spec=spec, normal=nb.bump(n, strength=0.05))
    return material(name, build)


def bands(name, colors, axis='z', period=10.0, rough=0.4, spec=0.5, offset=0.0):
    """Horizontal colour bands (traffic drum, barrier reflective tape)."""
    def build(nb):
        p = obj(nb)
        comp = nb.separate(p)[{'x': 0, 'y': 1, 'z': 2}[axis]]
        f = nb.math('FRACT', nb.math('DIVIDE', nb.math('ADD', comp, offset), period * len(colors)))
        c = nb.ramp(f, [(i / len(colors), col) for i, col in enumerate(colors)], interp='CONSTANT')
        n = nb.noise(p, scale=0.15, detail=3.0)
        c = nb.mix(c, (0.05, 0.05, 0.05), nb.math('MULTIPLY', nb.maprange(n, 0.5, 0.85, 0, 1), 0.15))
        return dict(color=c, rough=rough, spec=spec)
    return material(name, build)


def concrete(name, color='#a9a699', dark='#7c7a70', stains=0.25, scale=0.05):
    """Cast concrete: soft mottling, fine aggregate speckle, vertical weather streaks."""
    def build(nb):
        p = obj(nb)
        n = nb.noise(p, scale=scale, detail=5.0, rough=0.55)
        speck = nb.voronoi(p, scale=1.1, randomness=1.0)
        sp = nb.maprange(speck.outputs['Distance'], 0.0, 0.18, 1.0, 0.0)
        c = nb.ramp(n, [(0.25, dark), (0.75, color)])
        streak = nb.noise(scaled(nb, p, 0.6, 0.6, 0.015), scale=1.0, detail=3.0)
        c = nb.mix(c, (0.12, 0.11, 0.1), nb.math('MULTIPLY', nb.maprange(streak, 0.55, 0.75, 0, 1), stains))
        c = nb.mix(c, (0.2, 0.2, 0.19), nb.math('MULTIPLY', sp, 0.35))
        return dict(color=c, rough=0.92, spec=0.2, normal=nb.bump(nb.math('ADD', n, nb.math('MULTIPLY', sp, 0.4)), strength=0.35))
    return material(name, build)


def rust(name, paint_color, rust_color='#8a4a26', amount=0.45, rough=0.6, scale=0.07, metal=0.3):
    def build(nb):
        p = obj(nb)
        n = nb.noise(p, scale=scale, detail=7.0, rough=0.65, distortion=0.4)
        streak = nb.noise(scaled(nb, p, 0.5, 0.5, 0.05), scale=1.0, detail=4.0)
        r = nb.maprange(nb.math('ADD', nb.math('MULTIPLY', n, 0.7), nb.math('MULTIPLY', streak, 0.4)), 0.55 - amount * 0.3, 0.75 - amount * 0.3, 0.0, 1.0, smooth=True)
        rc = nb.mix(rust_color, '#4a2616', nb.noise(p, scale=scale * 4, detail=3.0))
        c = nb.mix(nb.rgb(paint_color), rc, r)
        rough_v = nb.mixf(rough, 0.95, r)
        return dict(color=c, rough=rough_v, spec=0.45, metal=nb.mixf(metal, 0.0, r), normal=nb.bump(nb.math('MULTIPLY', r, n), strength=0.4))
    return material(name, build)


def glass(name, tint='#2e4a5a', sky='#9cc4d8', rough=0.08):
    """Facade glass: dark tint with a sky gradient reflection by height."""
    def build(nb):
        p = obj(nb)
        z = nb.separate(p)[2]
        n = nb.noise(p, scale=0.02, detail=2.0)
        refl = nb.maprange(nb.math('ADD', nb.math('MULTIPLY', z, 0.004), n), 0.3, 1.4, 0.0, 1.0)
        c = nb.mix(tint, sky, nb.math('MULTIPLY', refl, 0.55))
        return dict(color=c, rough=rough, spec=0.9, metal=0.3, coat=0.5)
    return material(name, build)


def cloud_volume(name, density=0.9, color='#8a93a3', scale=0.012, detail=6.0, anisotropy=0.2, bottom=None):
    """Principled volume with billowy noise density (storm cells)."""
    def build(nb):
        p = obj(nb)
        n = nb.noise(p, scale=scale, detail=detail, rough=0.55, distortion=0.2)
        d = nb.maprange(n, 0.38, 0.62, 0.0, density, smooth=True)
        vol = nb.new('ShaderNodeVolumePrincipled')
        vol.inputs['Color'].default_value = (*srgb(color), 1.0)
        vol.inputs['Anisotropy'].default_value = anisotropy
        nb.put(vol.inputs['Density'], d)
        return dict(color=(0, 0, 0), alpha=0.0, volume=vol.outputs[0])
    return material(name, build)


def water(name, deep='#1f5f78', shallow='#6cc3cf', foam='#eef7f6', axis='z', streaks=True, rough=0.06):
    def build(nb):
        p = obj(nb)
        q = scaled(nb, p, 0.35, 0.35, 0.03) if axis == 'z' else scaled(nb, p, 0.05, 0.3, 0.3)
        n = nb.noise(q, scale=1.0, detail=6.0, rough=0.6, distortion=0.8)
        c = nb.ramp(n, [(0.25, deep), (0.6, shallow), (0.8, foam)])
        return dict(color=c, rough=rough, spec=0.7, coat=0.6, normal=nb.bump(n, strength=0.4, distance=1.0))
    return material(name, build)


def soil(name, base='#6b4a2e', dark='#3d2817', light='#8f6a44', pebbles='#9a8f80', roots=None, strata=True):
    def build(nb):
        p = obj(nb)
        z = nb.separate(p)[2]
        n = nb.noise(p, scale=0.08, detail=7.0, rough=0.65)
        c = nb.ramp(n, [(0.25, dark), (0.55, base), (0.85, light)])
        if strata:
            s = nb.noise(scaled(nb, p, 0.02, 0.02, 0.35), scale=1.0, detail=3.0)
            c = nb.mix(c, nb.mix(c, (0, 0, 0), 0.35), nb.maprange(s, 0.5, 0.6, 0.0, 1.0))
        v = nb.voronoi(p, scale=0.35, randomness=1.0)
        peb = nb.maprange(v.outputs['Distance'], 0.0, 0.14, 1.0, 0.0, smooth=True)
        pv = nb.white(v.outputs['Position'])[0]
        c = nb.mix(c, pebbles, nb.math('MULTIPLY', peb, nb.math('GREATER_THAN', pv, 0.82)))
        return dict(color=c, rough=0.95, spec=0.15, normal=nb.bump(nb.math('ADD', n, nb.math('MULTIPLY', peb, 0.4)), strength=0.6, distance=1.5))
    return material(name, build)


def grass_blades(name, dark='#3f5f23', mid='#6d8f35', light='#a8bf5a'):
    """Grass/straw blade cards: colour from root (u=0) to tip (u=1), tapered alpha."""
    return ramp_by_uv(name, [(0.0, dark), (0.5, mid), (1.0, light)], axis=1, rough=0.7, translucent=0.2)


def coin_metal(name, base='#dfe6e6', dark='#8c9ea0', rough=0.22):
    def build(nb):
        p = obj(nb)
        n = nb.noise(p, scale=0.4, detail=4.0)
        c = nb.mix(dark, base, nb.maprange(n, 0.3, 0.7, 0.75, 1.0))
        return dict(color=c, rough=rough, spec=0.8, metal=0.75, normal=nb.bump(n, strength=0.03), coat=0.4)
    return material(name, build)


def driftwood(name, base='#b9b3a6', dark='#7f786c', light='#e4dfd2'):
    """Sun-bleached, sea-worn wood: long silky grain along x, dark checks."""
    def build(nb):
        p = obj(nb)
        q = scaled(nb, p, 0.03, 0.5, 0.5)
        n = nb.noise(q, scale=1.0, detail=8.0, rough=0.55, distortion=0.6)
        v = nb.voronoi(scaled(nb, p, 0.05, 0.6, 0.6), scale=1.0, feature='DISTANCE_TO_EDGE')
        check = nb.maprange(v.outputs['Distance'], 0.0, 0.04, 1.0, 0.0, smooth=True)
        c = nb.ramp(n, [(0.25, dark), (0.55, base), (0.85, light)])
        c = nb.mix(c, '#4a443c', nb.math('MULTIPLY', check, 0.7))
        return dict(color=c, rough=0.9, spec=0.2, normal=nb.bump(nb.math('SUBTRACT', n, nb.math('MULTIPLY', check, 0.5)), strength=0.5, distance=1.5))
    return material(name, build)
