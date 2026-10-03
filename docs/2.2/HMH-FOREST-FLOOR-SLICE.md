# Pines and Woods forest-floor kit — October 3

Local slice inspected in actual desktop and phone viewports. This adds a low forest-floor layer, replacing walk-through thorn balls and vine loops in Hollow Pines and Rugpull Woods. It preserves every existing blocking tree/structure source, ID, anchor, height and ground elevation. No new tree trunks, blockers, world geometry, rules, objectives or simulation randomness were introduced. Full forest-biome and centre-landmark acceptance remain open.

Reviewed the owner's actual L16 dead-root/cemetery reference and L30 forest-track reference at original resolution, the existing Woods centre/camp screenshots, and native Evergreen, Conifer Trio, Dead Oak and Fern previews. The available Pines flow screenshots were stale greybox; they cannot serve as current art evidence. Root will capture the real centre after this kit loads.

The shared page contains fallen broadleaf litter, grey/brown needles and broken twigs, low fern/moss beds and moss with small roots. It reuses the archived B1-04 fern **mesh** and B1-50 evergreen packed colour image for neutral bark, plus authored native low geometry. Archived native tree assets remain the existing bank canopy; their placements were deliberately retained because open-ground trunks have checked-in collision authority. Maximum fern height is 18 cm. The source archive was loaded read-only and its hashes were checked unchanged after rendering.

The first native sheet was self-rejected: oversized polygon leaves/moss and cyan flecks from the evergreen material did not fit the references. One bounded corrective bake made the ground detail finer and neutralised the reused bark image. No paid generation occurred. Source PNGs and native `.blend` are outside Git under `outputs/native-forest-floor/`; only two WebP tiers and their receipt ship.

| Runtime page | Dimensions | Encoded | Decoded |
|---|---:|---:|---:|
| forest-ground-details.webp | 1024×256 | 117,552 B | 1,048,576 B |
| forest-ground-details@0.5x.webp | 512×128 | 37,794 B | 262,144 B |

Pines has 71 new floor patches, including 17 within the portrait arrival bounds; Woods has 188, including 23 within those bounds. Irregular low beds frame the routes and replace existing tangled walk-through plants. Entire transparent frames are checked against routes, roads, solids, water, spawn and interactive-site clearance. Only the noninteractive area-centre label is excluded from the decorative guard. Existing tree and structure identities are numerically compared to pre-slice baselines.

The page is acquired only for an area using its frames, shared through the existing reference-counted cache, and released with the area. Strict tier dimensions reject malformed pages. Full and half pages preserve world-space patch size, including Pixi's half-resolution texture-unit convention. Total ground allocation remains below the 8 MiB cap: Pines **7,733,248 B**, Woods **6,422,528 B**. Pines consolidates the maintenance/service-path dirt grain into the existing gravel grain, with a softer halo, to avoid another 1,310,720 B ground tile pair. Kit canopy pages and collision geometry are unchanged.

Tests started RED for missing near forest beds, then passed **53/53** across the focused native receipt, placement, plans, schema, renderer, binding and terrain suites. Tests cover exact blocking-card identity, full-frame clearance, phone-visible bed counts, world immutability, loaded page ownership, both half-resolution conventions, malformed-page cleanup, provenance and runtime asset hashes. Existing Woods coverage now counts low native patches together with upright understory. Fixture texture dimensions were updated without weakening production guards. Module/Python syntax and whitespace checks passed.

Native children were closed and the token-owned heavy lock released: initial Blender 29728/packer 28964; corrective Blender 40816/packer 28592, all exit 0. No browser, build, commit or deployment occurred in this lane.

Owning files: `scripts/build-hmh-forest-floor.py`, `world-v2-area-plans/forest-floor.mjs`, the Pines/Woods plans, forest detail-frame/cache glue in the area-art renderer/schema, `tests/hmh-forest-floor-kit.test.mjs`, runtime `hmh-art-target/forest-ground-details*`. Root owns syntax registry and progress reconciliation.

Root reviewed both area centres in the real game at desktop/phone resolution, with ready art and no page errors. Evidence: root `outputs/22-forest-lod-cover-routes/pines-*` and `woods-*`, timestamped 26-scene receipt. Acceptance is limited to a better initial litter/understory layer; full canopy/landmark quality, authored cemetery/root/ruin props, terrain transitions, wooded-bank coverage and versioned layout work remain open. Physical phone frame time is unproven. This bounded floor pass does not complete either forest biome or the ten-area world.
