# HMH world polish — live

Live at https://lestersarcade.io: source `a3b2b0299b5617636f144fcb3936bac4a87e19d6`, deployment `dpl_F4d723CFGYcZDANn1rNU6Avz3cV7`, cache `lesters-arcade-v41-hmh-world-polish`. All 151 public file hashes, HMH desktop/mobile portal flows, five STACKED layouts, Chikun desktop/mobile and cache migration passed. Immediate rollback: `dpl_8GPLKXJspe9EwDyUensJ7VaayKJ7`. [Release receipt](../qa/hmh-world-polish-release-20260913.json).

The owner requested continued improvement across the game and publication after each major tested upgrade. This package improves ground materials, canopy composition, campfires and industrial ground wear. It preserves the v40 hero/enemy motion, weapon audio, breakable cover, fuel reactions, live STACKED beta and Chikun Superman flight.

## Implementation

- Rebuilt the native Blender forest-floor and industrial-slab materials. Forest litter is finer and patchier; concrete uses staggered joints and subtle weathering. Seven native materials passed repeated pixel-exact and normalized-file-exact rendering. Editable Blender source and raw producer receipts are retained outside the public portal output.
- Fixed partially opaque outer rows in terrain edge strips. Road shoulders, shore bands and scree now reach fully transparent edge pixels. The terrain v5 rebuild passes seamless/reproducible checks: 11 materials, five overlays, 3,200,055 bytes. Three additional changed PNG files have identical decoded pixels; their difference is encoding only.
- Varied native thicket tree spacing, height and root positions, retaining the same collision capsules and a continuous lower brush bank. The deterministic placement tests bound roots and count; this is a composition improvement, not completion of the full forest redesign.
- Reused the 220-mark ground-detail budget for 15 concrete fractures and eight industrial spills. Fixed district assignment against the current district-area schema. Wheel scuffs now follow road direction.
- Replaced the small campfire dot with two tapered flame shapes and gentle motion. Existing culling, four visible-fire cap and 12-ember cap remain. Reduced-motion mode holds the flames still and suppresses embers; reduced-flash mode steadies light intensity.
- Updated the portal cache to `lesters-arcade-v41-hmh-world-polish`, with resource marker `hmh-world-polish-20260913`.

## Validation and remaining acceptance

Focused RED tests demonstrated the edge-alpha, uniform-canopy, missing ground-wear and missing flame-shape defects before their fixes. The full gate passes 3,641 tests with exactly 51 unchanged retired exceptions (3,692 evaluated), plus syntax, asset, contract and documentation checks. The release receipt records browser, performance and hosted results. The first visual comparison intentionally changes five of 12 scenes; all browser error lists were empty. Desktop forest, camp, yard, market, residential and phone framing were visually reviewed before accepting replacement baselines.

Initial JavaScript is 1,047,335 / 1,048,576 bytes; the entry is 440,394 / 480,000 bytes. Future runtime features need additional splitting before expanding initial code. No simulation frequency, enemy count, spawn rules, movement, combat, collision shapes, score, replay or authority was changed by this package. `SETTLEMENT_LIVE=false`.

An enemy-neighbor selection experiment was rejected and reverted. Although its isolated computation benchmark improved, repeated active browser gameplay became slower. The unchanged v40 simulation remains. Normal-play measurements explicitly exclude paused upgrade menus and disable diagnostics; a synthetic slowed-CPU browser is not a physical-phone performance certification. Detailed measurements are retained in the world release receipt.

The final alternating 4× CPU comparison measured live v40 means of 35.18, 35.25 and 35.16 ms, versus candidate v41 means of 36.54, 35.61 and 33.87 ms. Median means differ by about 1.2%; candidate dropped-time counters were 207–291 ms versus live 144–205 ms. This supports retaining the visual package but does not establish an FPS improvement or resolve slow-device endurance performance. Unthrottled desktop and landscape pressure runs averaged approximately 7 ms with no dropped simulation time. Final local certification: 3,641 passing tests, 51 unchanged retired exceptions, 619 JS and 100 Python syntax checks, plus asset, contract and documentation gates.

Still open: native held-weapon integration and grip refinement, complete native power-up family, more varied authored environments and props, broader environmental sound design, measured listening acceptance, extended endurance profiling and physical desktop/mobile acceptance. This package does not close the full AAA roadmap. The source repository remains over its strict storage target because editable asset sources are retained; the runtime delivery budget passes.

The owner's latest direction adds objective- and boss-earned weapons/power-ups, ammo and grenade supplies, selected pickups that return after two to three minutes, stronger exploration destinations and silver spinning Litecoin XP drops. Carry those into the next gameplay package after publishing this tested world package. Audit existing deterministic rewards and parent replay before changing progression; do not interpret the thematic crypto request as authorization for transactions or settlement.

## Publication

Before promotion, production was `dpl_8GPLKXJspe9EwDyUensJ7VaayKJ7`, runtime `0e858cde582f10be767c170de6f7f2588cf4e977`, cache v40. Preserve that deployment as the immediate rollback. Recheck production immediately before promotion to avoid overwriting another game release.

The owner authorized website publication. Public GitHub upload of additional editable models/source remains a separate pending permission after automatic approval review rejected it. Local commits and private Vercel website deployment can proceed; do not claim the public source branch was pushed.
