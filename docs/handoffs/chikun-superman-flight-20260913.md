# Chikun Superman flight revision

The owner corrected the animation direction: Chikun flies rightward in a horizontal Superman pose. A rough request for thirty animations is replaced by eighteen focused actions. The owner also requested trees, drones, coat and crest wind, smooth transitions, testing and live publication; public source/art publication is explicitly authorized.

## Implementation

The original colored Tripo surface is preserved. The sleeve-to-coat contact seam is separated before skinning, allowing extended arms without stretching coat triangles. The rig maps upright height to the flight axis, raises the neck to look forward, points the boots back, and gives coat tails and crest independent wind motion. All flight, climb, descent, acceleration, braking, passage, dodge and pickup variations retain the prone silhouette. A longitudinal barrel roll is used for streaks; impact, tumble and fall handle collisions.

The editable Blender file and GLB contain eighteen actions and fifteen joints. Four hundred thirty-two native frames are projected into 192-pixel WebP sheets at thirty frames per second, totaling 2,049,014 bytes. The runtime interpolates adjacent frames, crossfades from the last composed pose over 120 ms, and damps velocity-driven pitch. Weighted premultiplied compositing preserves edge opacity when transitions are interrupted. This is a Blender-rendered character presentation; the game does not run a live 3D skeleton on every phone.

Industrial gates alternate with tree canopies and drone-guarded electric fields. Their marked hazard rectangles preserve collision clarity and the canonical opening. No flight physics, score, seed, collision, parent verification, replay evidence or settlement changes are included. Trees and drones add visual variety, not new collision mechanics. Reduced motion suppresses rolls and decorative wind motion.

Flight Room uses the same compositor and all eighteen actions. The service-worker namespace is `lesters-arcade-v39-chikun-stacked`, and character/audio requests use the new versioned asset directory.

## Verification

Native inspection confirms eighteen GLB animations, one fifteen-joint skin, 432 nonempty frames inside the render bounds, and horizontal silhouettes throughout cruise/climb/descent/passage. Focused Chikun tests, build, syntax, desktop browser flow and all Flight Room controls/asset hashes pass. Further hosted and touch results are recorded in the release receipt after verification. Physical-device testing is not implied by Chrome touch emulation.

Previous production retained for rollback: `dpl_TFj74rNbMiBdu2p5JbrL9UQNqNFi`, `https://lesters-arcade-apyh3lp3o-justin-agent-projects.vercel.app`, runtime source `d7a5ad691b2fe3f34f4453b5bc39429ec2648042`.

The concurrent STACKED beta production source `98204a1c36c682a70adbb986fb6941289eed8501` is merged before promotion, preserving all three public cabinets. Shared cache conflicts are resolved with a new v39 namespace, all STACKED offline resources, and Chikun v2 poster. No STACKED gameplay changes were authored in this revision.

## Published and verified

Live production is `dpl_6XGH4jJa5NRDT7u33cpsxpMHSHHd` at `https://lestersarcade.io`, exact runtime source `9d14b18c20c3cfe7ba1fe88789a6f61feb9c9da3`. Both preview and production passed 3,641 release tests with 3,590 passes and exactly 51 unchanged documented retirement exceptions, plus assets, syntax (592 JavaScript / 88 Python), contract structure and build gates.

Public guest Free Mode, touch Ranked Mode, replay play/pause/seek and restart passed. All eighteen animations, eight audio cues, core portal/STACKED/Chikun bundles, responsive Flight Room controls, and reduced motion were verified against the public domain. Desktop and touch p95 frame intervals were about 7 ms on the test host. Four-times CPU slowdown at phone size measured 20.9 ms p95. A screenshot-guided 22-second flight cleared four obstacles and collected four coins using ordinary input.

STACKED's five-size browser play test also passed. HMH's twelve historical screenshot comparisons still differ, with zero runtime errors; its bundle matches the retained STACKED production byte for byte. No unrelated baselines were accepted. The final rollback is `dpl_3GBNYfeQrHjoGUEm91QD41WuAj83`, source `98204a1c36c682a70adbb986fb6941289eed8501`.

See [the final receipt](../qa/chikun-superman-release-20260913.json) for machine-readable evidence. The native source package and screenshots are also saved in the task's `outputs/superman-flight` directory.
