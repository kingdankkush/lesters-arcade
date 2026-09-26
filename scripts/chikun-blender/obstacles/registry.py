"""Every obstacle sprite the kits render: kit, frame, animation and builder.

frame = (x, y, w, h) in the module's local screen coordinates (logical px):
  ground  - x from the obstacle's left edge, y from the running line (up < 0)
  flyer   - x from the obstacle's left edge, y from o.y
  crown   - x from the tree's left edge, y from the tree top (690 - height)
  ceiling - x from the obstacle's left edge, y from the rect bottom (height)
  coin    - centred on the coin
The runtime layout (apps/chikun/src/obstacle-art.mjs) positions each frame at
the same anchor, so the art lands on the collision shapes it was built for.
"""
from . import props, trees, creatures, machines, structures, terrain

PROP_W = dict(rock=76, log=112, thorn=100, hurdle=90, crate=78, shiba=110)
PROP_H = dict(rock=50, log=48, thorn=64, hurdle=76, crate=76, shiba=65)


def ground_frame(kind, pad=10, top=14, below=8):
    w, h = PROP_W[kind], PROP_H[kind]
    return (-pad, -(h + top), w + 2 * pad, h + top + below)


SPRITES = {}


def sprite(name, kit, anchor, frame, build, frames=1, kind=None, samples=None, emit=False, fps=0, note='', pitch=19.0, lights=None):
    SPRITES[name] = dict(name=name, kit=kit, anchor=anchor, frame=frame, build=build, frames=frames, kind=kind, samples=samples, emit=emit, fps=fps, note=note, pitch=pitch, lights=lights or {})


# Ground props (common kit; the runtime picks the variant by the obstacle's region)
sprite('crate-wood', 'common', 'ground', ground_frame('crate'), props.crate_wood, kind='crate')
sprite('crate-steel', 'common', 'ground', ground_frame('crate'), props.crate_steel, kind='crate')
sprite('crate-boxes', 'common', 'ground', ground_frame('crate'), props.crate_boxes, kind='crate')
sprite('hurdle-hay', 'common', 'ground', ground_frame('hurdle'), props.hurdle_hay, kind='hurdle')
sprite('hurdle-barrels', 'common', 'ground', ground_frame('hurdle'), props.hurdle_barrels, kind='hurdle')
sprite('hurdle-drums', 'common', 'ground', ground_frame('hurdle'), props.hurdle_drums, kind='hurdle')
sprite('hurdle-jersey', 'common', 'ground', ground_frame('hurdle'), props.hurdle_jersey, kind='hurdle')
sprite('hurdle-hedge', 'common', 'ground', ground_frame('hurdle'), props.hurdle_hedge, kind='hurdle')
sprite('log-oak', 'common', 'ground', ground_frame('log'), props.log_oak, kind='log')
sprite('log-mossy', 'common', 'ground', ground_frame('log'), props.log_mossy, kind='log')
sprite('log-drift', 'common', 'ground', ground_frame('log'), props.log_drift, kind='log')
sprite('log-timber', 'common', 'ground', ground_frame('log'), props.log_timber, kind='log')
sprite('rock-mossy', 'common', 'ground', ground_frame('rock', top=16), props.rock_mossy, kind='rock')
sprite('rock-coastal', 'common', 'ground', ground_frame('rock', top=16), props.rock_coastal, kind='rock')
sprite('thorn-bramble', 'common', 'ground', ground_frame('thorn'), props.thorn_bramble, kind='thorn')

# Trees: crown (anchored at the tree top) + trunk column (anchored on the running line)
for _sp in ('oak', 'maple', 'cherry', 'willow'):
    sprite(f'crown-{_sp}', 'common', 'crown', trees.crown_frame(_sp), trees.crown(_sp), kind=_sp)
    sprite(f'trunk-{_sp}', 'common', 'ground', trees.trunk_frame(_sp), trees.trunk(_sp), kind=_sp)

# Forest wall (forest kit): two column variants anchored at the column top, one undergrowth strip
sprite('forest-column-a', 'forest', 'top', trees.forest_frame(), trees.forest_column('a'), kind='forest')
sprite('forest-column-b', 'forest', 'top', trees.forest_frame(), trees.forest_column('b'), kind='forest')
sprite('forest-base', 'forest', 'ground', trees.forest_base_frame(), trees.forest_base, kind='forest')

# Creatures (common kit)
for _b in ('hawk', 'eagle', 'pelican'):
    sprite(f'bird-{_b}', 'common', 'flyer', creatures.bird_frame(), creatures.bird(_b), frames=8, fps=12, kind=_b)
sprite('shiba', 'common', 'ground', creatures.shiba_frame(), creatures.shiba, frames=creatures.SHIBA_FRAMES, fps=12, kind='shiba')

# Machines and the coin (common kit)
sprite('drone', 'common', 'flyer', machines.drone_frame(), machines.drone, frames=machines.ROTOR_FRAMES, fps=24, kind='drone', emit=True)
sprite('plane', 'common', 'flyer', machines.plane_frame(), machines.plane, frames=machines.ROTOR_FRAMES, fps=24, kind='plane', emit=True, pitch=7.0,
       note='shallower 7 degree pitch: a high wing seen from 19 degrees would hide the cabin')
sprite('coin', 'common', 'coin', machines.coin_frame(), machines.coin, frames=machines.COIN_FRAMES, fps=12, kind='coin')

# Storm cell (common kit; every region has storms)
sprite('storm', 'common', 'ceiling', terrain.storm_frame(), terrain.storm, kind='storm', samples=128, lights=dict(key=5.0, rim=2.4))

# Pits by terrain and waterfalls (region kits)
for _kit, _t in (('farmland', 'soil'), ('forest', 'loam'), ('industrial', 'concrete'), ('coast', 'tidal')):
    sprite(f'pit-{_t}', _kit, 'ground', terrain.pit_frame(), terrain.pit(_t), kind='pit')
for _kit, _v in (('forest', 'mossy'), ('coast', 'basalt')):
    sprite(f'waterfall-{_v}', _kit, 'ground', terrain.waterfall_frame(), terrain.waterfall(_v), kind='waterfall')
    sprite(f'waterfall-sheet-{_v}', _kit, 'sheet', terrain.sheet_frame(), terrain.water_sheet(_v), kind='waterfall', pitch=0.0,
           note='vertically periodic (64 px): scrolled over the curtain by the runtime')

# Buildings (region kits): facade columns on the running line, caps at the rect top
for _style in structures.STYLES:
    _kit = {'town': 'town', 'city': 'city', 'suburb': 'suburbs'}[_style.split('-')[0]]
    sprite(f'facade-{_style}', _kit, 'ground', structures.facade_frame(), structures.facade(_style), kind='town', emit=True)
    sprite(f'cap-{_style}', _kit, 'top', structures.cap_frame(), structures.cap(_style), kind='town', emit=True)

# Pipes (city: green utility riser, industrial: rusty riser)
for _kit, _p in (('city', 'pipe-green'), ('industrial', 'pipe-rust')):
    sprite(_p, _kit, 'ground', structures.pipe_frame(), structures.pipe(_p), kind='pipe')
    sprite(_p + '-cap', _kit, 'top', structures.pipe_cap_frame(), structures.pipe_cap(_p), kind='pipe')

# Canopies (low passages): forest boughs, city scaffold, industrial pipe rack
for _kit, _c in (('forest', 'canopy-forest'), ('city', 'canopy-scaffold'), ('industrial', 'canopy-rack')):
    sprite(_c, _kit, 'ceiling', structures.canopy_frame(), structures.canopy(_c), kind='canopy', emit=_c != 'canopy-forest')
