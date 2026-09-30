# W3d — private Pixi world movement scene

2026-09-30. The authored ten-area geometry now runs in a private Pixi scene with the real human atlas and actual fixed-step movement/collision/navigation. The regular game and Ranked entry remain unchanged. This is an executable local world inspection slice, not full combat or final area art.

## Implemented

The separate private builder and top-level loopback entry load the scene only for the exact local Free query. Scene startup waits for real WebGL initialization, the current Lit Commando atlas and actual chunked navigation before admitting play. Default, Ranked, embedded and remote paths deny the scene/assets/API before heavy loading. The only unconditional generated chunk is a byte-pinned 577 B compiler helper with empty input/import graphs.

The human uses the existing camera, InputState, touch control state and production atlas. Ground and body share uniform camera scale; blocker height/depth and ramp/bridge elevation project from the same geometry. Previous-tick actor values are detached presentation data; original simulation primitives remain unchanged. Inspection is explicitly labeled and validates body clearance before replacing navigation. Its static return-to-inspection flow is diagnostic, not pursuing AI.

Begin/Resume explicitly focus the canvas. Entering a toolbar control clears held movement without toggling pause. Pause, lost input and visibility loss clear input and stop scheduled frames until explicit resume. Closing and pagehide release display/input/nav resources. Partial Pixi initialization failures and late successful initialization, atlas decoding or navigation completion cannot revive disposed/replaced instances.

No mission, encounter, score, achievement, official session, seed/version/map registration, settlement or default main/build hook was enabled. Twenty-two protected authority files remain exact. Three new private scene files, a separate builder, one scene test and four syntax-list entries accompany the private runtime's previousActor addition.

## Verification and retained corrections

Genuine initial RED 12 (missing scene/entry/previousActor) is retained. Independent review found keyboard focus/held-input defects; a focused RED 1 reproduced them before the minimal fix. Final checks pass **13 scene + 15 actual runtime = 28 source and identical 28 isolated**, with no skips. The source copy has no Git/node_modules and empty PATH. CSS was subsequently moved from center to bottom 16 px after original04 images showed status obscuring the human; the browser binding proves that exact CSS delta against the earlier source copy and all tested JavaScript stayed identical.

Every executed browser attempt is retained. Attempt 02 built but stopped before Chrome because esbuild used a dependency junction's real path; aliases and realpaths are now both pinned. Attempt 04 completed both viewports but failed the overly broad denied-chunk assertion; the exact compiler-only helper exception was independently reviewed. Attempt 05 stopped on the last few ramp pixels because a target was exactly on the boundary. Attempt 06 moved only both bank targets 50 px inward, beyond the 20 px arrival tolerance plus 24 px body radius, keeping exact ground-height assertions and every journey.

Final 06 actual Chrome passed desktop 4 / touch 3 native journeys, eight captures, all four denial paths, focus/held-key handling, wall refusal, bridge/ramp/dry-bank movement, touch cancel, explicit pause/resume, close, reentry and pagehide. Each viewport made one visible River inspection jump; this is not a continuous cross-map walk. Blur/hidden host signals were synthetic and labeled. Touch browser dimensions are a proxy, not physical iPhone testing.

All five 1280×800 desktop and three 1242×2688 phone originals were inspected. The human is unobscured and grounded, bridge and water are distinct, and controls/footer stay contained. Source/run snapshots report 334×234 navigation cells, 36749 walkable, 156312 grid bytes and 390780 flow bytes. Initial desktop readiness was 1824 ms for Pixi+atlas+nav; desktop inspection nav 2003 ms, phone-proxy inspection 1656 ms. These are observations, not a performance acceptance result.

The private artifact was preserved byte-for-byte (31 built/atlas files, 6,148,159 B) before the normal builder replaced this worktree's dist. A fresh normal build proves 3,992 actual inputs exclude private world-v2/greybox code. Standard **visual:reboot 12/12 unchanged**, no acceptance flag, no baseline edit; all twelve originals and three enemy-crop images were reviewed. Scene mean deltas max 0.019, cell delta max 4, at most 3 changed cells; crop metrics all 0. This is tolerance-based unchanged classification, not byte-identical screenshots.

| World-worktree candidate | Initial bytes | Cap | Headroom |
| --- | ---: | ---: | ---: |
| HMH |1039992|1048576|8584|
| STACKED |576100|607000|30900|

These byte counts and default visuals apply to the World worktree only. The combined integration branch has later changes and needs its own certification. All source/browser/build/visual children and actual Chrome processes closed and were independently observed absent; HTTP servers closed and the exact owned shared marker was released. Final private PIDs 29400/49324/22472, normal PIDs 2644/10372/53544. The lossless [archive manifest](../receipts/world-w3d/archive-manifest.json) binds original reports, failures, runners, hashes, review, image identities and closure receipts. Full screenshots and the preserved compiled private artifact remain in shared local work outputs.

## Remaining

The private scene deliberately shows sparse flat-color greybox geometry. Terrain/props/final lighting, approved art-bible vertical-slice integration, whole-map streaming, full gameplay/encounters/objectives/bosses, versioned official runs, owner ten-area approval and physical iPhone XS Max heavy-load/soak performance remain open. This checkpoint is not a complete 2.0 game, final-art acceptance, release gate, Ranked end-to-end, production probe or deployment.
