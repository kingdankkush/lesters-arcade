# Chikun's Escape: Afterlight

The owner supplied a Tripo OBJ with vertex colors and requested a playable-character-first visual upgrade, approximately 30 animations, parallax city/mountain scenery, a day/night cycle, obstacles and sound. The owner subsequently authorized publishing the completed work live.

## Release scope

- Owner's mesh preserved, reduced from 487,027 to approximately 60,000 triangles, smooth shaded and bound to a 15-bone flight rig. Color data remains intact; the source archive did not contain a separate UV texture.
- Thirty distinct Blender actions, a skinned GLB with all 30 clips, and 480 orthographic RGBA renders. Native source is in `apps/chikun/assets/source/`; the repeatable build and packing scripts accept explicit source/output paths.
- Thirty 192-pixel-frame WebP atlases total approximately 2.7 MB. Three concurrent loading workers, owner-character poster fallback, interpolated frame presentation and short crossfades. One registered original character; future characters can be added through the registry. Skins are not sold or unlocked by this release.
- Flight, rise, fall, braking/recovery, apex, banking, gust, pickup, streak, near-miss, impact and death states connect to the current child renderer. Arms use a restrained arc because the generated cuffs touch the coat; this is an authored game rig, not hand-retopologized production anatomy or facial blendshapes.
- A 180-second atmospheric day/night cycle, sun/moon/stars, cloud banks, three mountain depths, three cached city depths, suspension bridge, water reflections, aircraft and moving rooftop details. Scene random variation is deterministic and independent of canonical RNG.
- Illuminated metal Big Corp obstacles, inset panels, hazard stripes and rotating collectible coins. Visible obstacle edges fit the existing collision rectangles.
- Eight original synthesized sound assets: launch, flap, coin, pass, near miss, streak, impact and looping air. Audio respects parent settings, local mute and pause; event voices are capped.
- Updated start/results/HUD presentation and a public `/chikun/flight-room.html` animation viewer with all 30 moves, day/night scrub and sound audition.
- Service worker namespace advances to `lesters-arcade-v37-chikun-afterlight`.

## Preserved authority

The source baseline is the exact live deployment commit `1a8d4f420767f32ef97ca7952b782dce284242f0`. No unrelated later HMH work is included. The 60 Hz simulation, hit radius, impulse, gravity, spawning, score, evidence, parent bridge, daily seed and Ranked verification are unchanged. The result is sent immediately when canonical play ends; only the results overlay waits 1.15 seconds for the cosmetic death beat. Reduced motion displays results immediately and freezes decorative character/scene motion.

## Native assets and verification

`Chikun-Flight-Rig.blend` is editable in Blender 5.1. `Chikun-30-Animations.glb` contains 30 animations, one skin, 15 joints, vertex colors and weights. The packer verifies at least 12 unique frames per clip and every rendered frame has a nonempty alpha footprint. A separate inspection found no clipped frame bounds. The asset manifest binds every runtime atlas with SHA-256.

The focused Chikun suite passes 48 tests, including same-input/same-result simulation checks, animation bounds, terminal states, day/night continuity and real asset hashes. The desktop browser flow exercises launch/input, pause/resume, mute, game over, replay/share, restart, exit and Free isolation. Mobile and hosted release receipts are recorded separately after the final candidate is verified. Browser emulation does not substitute for a physical-device playtest.

Rollback captured before this release: `dpl_H8HskA2fttzXpdVHc8GyAcXccd9g`, `https://lesters-arcade-r4w9nitiu-justin-agent-projects.vercel.app`. Publication proof belongs in the final release receipt, not inferred from this source handoff.

## Published and verified

Live on `https://lestersarcade.io`: production `dpl_TFj74rNbMiBdu2p5JbrL9UQNqNFi`, runtime source `d7a5ad691b2fe3f34f4453b5bc39429ec2648042`. The [release receipt](../qa/chikun-afterlight-release-20260913.json) is the final publication record. Both preview and production builds passed 3,455 tests with exactly 51 documented legacy retirement exceptions, plus assets, syntax and contract structure checks.

Public desktop Free and touch-phone Ranked flows passed through cabinet selection, mode selection, launch, controls, pause/resume, sound, results, replay/share, exit, and parent profile checks. These use a synthetic test wallet and local browser records; no financial settlement was enabled. Portrait and landscape were checked, and all 30 Flight Room controls, 38 animation/audio assets, and reduced motion passed. A screenshot-guided 22-second flight cleared four obstacles and collected four coins using ordinary input, without modifying simulation or score.

The required HMH visual suite captured 12 scenes with no runtime errors, but the stored historical comparisons differ. No HMH source or assets changed, and its game bundle was byte-identical to pre-release production. No unrelated visual baselines were accepted. Physical-device testing remains outside this browser-emulation evidence.
