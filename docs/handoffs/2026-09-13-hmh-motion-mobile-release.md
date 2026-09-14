# Hard Money Heroes: motion and mobile release

The owner explicitly requested publication of all completed work, with mobile performance, touch control testing and bug fixes taking priority over unfinished equipment polish. This authorizes website publication after verification. Financial activation remains disabled.

## Published scope

- Four native hero motion pages add 496 layered samples per hero: twelve-frame running, breathing/aim, reload and idle personality. Existing combat actions remain available. Only the selected hero's additional texture is loaded.
- Six native enemy sources and animation atlases replace the remaining legacy roster bodies. Bagholder retains its verified native source. Ordinary actors have 280 samples each; the boss has 840 across three phases. Idle, running, anticipation, attack, hit and death are covered.
- Eight breakable cover caches expose a passage and collectible supplies. Three fuel locations have deterministic, bounded chain explosions. Cosmetic fragments remain separate from collision and damage.
- Five core weapon reports use newly balanced attack transients, body and bass. All 37 sound files are reproducible. The actual routed sample/mix audit reports no clipping or unknown cues.
- Pause stops combat music and resume restarts it. The phone pause music deck fits its viewport.
- Collision and line-of-sight queries use conservative nearby-obstacle bounds. Frozen obstacle lists cache their spatial index and ordering. Mutable callers retain the full scan. New lists are created when cover opens. Four thousand seeded cases preserve the pre-optimization digest, including contact ordering, depenetration and line of sight.
- Large diagnostic dataset writes are loaded only in explicit evidence/debug modes. Normal play does not request that module.

## Performance evidence and limits

Crowded combat with 128 enemies reproduced the reported severe slowdown in Chrome phone/touch emulation with four-times CPU throttling. Profiling identified full-world collision scans and repeated sorting as the main cost. The collision index reduces the measured collision self time from roughly 2 seconds to 0.16 seconds in a 10-second profile.

The final profiler-free stress test measures at least ten seconds of active gameplay, automatically accepts normal upgrade choices and excludes their paused menus. At four-times CPU throttling it measured 40.57 ms mean browser frame interval, 55.5 ms p95 and 62.6 ms p99, with 117 enemies remaining and no console/page errors. Earlier 16 ms averages included time paused at a level-up menu and are superseded. Normal desktop, phone-portrait and phone-landscape emulation measured about 6.98 ms mean and 7 ms p95 on this 144 Hz host, with no dropped simulation time. These browser intervals are not a physical-phone guarantee; very slow devices can still struggle in crowded combat. The initial baseline also used a CPU profiler, so the average-frame comparison is indicative rather than a controlled speed multiplier. Enemy capacity, combat balance, movement, camera zoom, the 60 Hz simulation and four-step catch-up limit were not reduced by this optimization. [Complete active-play measurements](../testing/hmh-motion-mobile-20260913.json).

A separate neighbor-search experiment was reverted because its end-to-end result was contaminated by an unrelated Blender render and did not establish a reliable improvement. Its deterministic parity test remains useful coverage.

## Asset budgets

The four base hero textures remain 15,796,588 bytes under the existing 16 MiB total cap. The optional motion pages bring the complete four-hero texture library to 26,933,668 bytes. Each selected hero is below 8 MiB compressed and uses 32 MiB decoded for its base plus motion page. This is an explicit expansion for added motion; it is not represented as unchanged memory usage.

The active enemy texture library is 15,155,687 bytes. Legacy textures keep their 2 MiB per-file cap; the new native class uses a 4 MiB per-file cap and the complete active roster a 16 MiB cap. Ordinary and boss atlases are requested according to encounter readiness, not all decoded at initial entry. Decoded image QA independently checks bounds, opacity, animation uniqueness and the recorded reproducibility/provenance.

## Release status

**Live at https://lestersarcade.io.** Runtime source `0e858cde582f10be767c170de6f7f2588cf4e977`, deployment `dpl_8GPLKXJspe9EwDyUensJ7VaayKJ7`. [Exact release receipt](../qa/hmh-motion-mobile-release-20260913.json). Local release checks pass: 3,687 tests, 3,636 passed and exactly 51 unchanged retirement exceptions; 615 JS modules and 100 Python scripts parse; asset QA, source LFS policy, security and contract structure pass. Both portal profiles, four touch-control profiles, eight cover caches, three fuel chains, native enemy/boss presentation and actual weapon pickup/audio routes pass. STACKED passes five layouts and Chikun passes desktop and phone layouts. The cloud gate passed the same counts. Public verification passed all 122 file hashes, desktop/mobile portal flows, five STACKED layouts, Chikun desktop/mobile, and the returning-client cache update. The service worker controls the page, removes the previous release cache, preserves unrelated caches and serves the expected HMH entry bytes. Editable Blender source paths return 404.

The repository-wide strict working-tree budget still reports 938 MiB against 350 MiB because it counts editable source originals. The source-model LFS policy and runtime atlas budgets pass. Source Blender files are outside the deployed portal; the repository archival/CDN work remains open. This budget report is not represented as passing.

The latest production inspection on September 13 found Chikun Superman flight plus STACKED at `dpl_6XGH4jJa5NRDT7u33cpsxpMHSHHd`, source branch `codex/chikun-superman-flight` at `9d14b18c20c3cfe7ba1fe88789a6f61feb9c9da3`. This replaced Afterlight deployment `dpl_TFj74rNbMiBdu2p5JbrL9UQNqNFi`. The HMH release merges the newer flight update and the STACKED beta. The predecessor was rechecked immediately before promotion and is retained as rollback. The combined cache marker is `lesters-arcade-v40-hmh-fluid-mobile`.

Public GitHub source/model upload remains pending explicit authorization after automatic approval review rejected that separate disclosure. Website publication succeeded; editable source was used only as private build input.

## Retained unfinished work

New held-weapon models, native long-gun grips/reload actions and the full power-up model family are not wired into the playable runtime. Eleven draft paths are preserved, with original paths recorded, in the local ignored `.tmp/unfinished-equipment-work` directory. Earlier private bakes are retained. Do not claim those models are playable or finished.

Physical iOS/Android playtests, listener/device sound review, broader environmental audio, further world design and full original AAA acceptance remain open in the [retained backlog](hmh-playable-release-and-polish-backlog.md). This release does not claim to close all original work groups.

Native evidence: [hero motion](../testing/hmh-hero-motion/measurement.json), [enemy roster](../testing/hmh-native-roster/measurement.json). The complete legacy exception ledger is unchanged; unexpected failures must be fixed, not added to it.
