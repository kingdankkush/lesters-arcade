# Hard Money Heroes: motion and mobile release

The owner explicitly requested publication of all completed work, with mobile performance, touch control testing and bug fixes taking priority over unfinished equipment polish. This authorizes website publication after verification. Financial activation remains disabled.

## Candidate scope

- Four native hero motion pages add 496 layered samples per hero: twelve-frame running, breathing/aim, reload and idle personality. Existing combat actions remain available. Only the selected hero's additional texture is loaded.
- Six native enemy sources and animation atlases replace the remaining legacy roster bodies. Bagholder retains its verified native source. Ordinary actors have 280 samples each; the boss has 840 across three phases. Idle, running, anticipation, attack, hit and death are covered.
- Eight breakable cover caches expose a passage and collectible supplies. Three fuel locations have deterministic, bounded chain explosions. Cosmetic fragments remain separate from collision and damage.
- Five core weapon reports use newly balanced attack transients, body and bass. All 37 sound files are reproducible. The actual routed sample/mix audit reports no clipping or unknown cues.
- Pause stops combat music and resume restarts it. The phone pause music deck fits its viewport.
- Collision and line-of-sight queries use conservative nearby-obstacle bounds. Frozen obstacle lists cache their spatial index and ordering. Mutable callers retain the full scan. New lists are created when cover opens. Four thousand seeded cases preserve the pre-optimization digest, including contact ordering, depenetration and line of sight.
- Large diagnostic dataset writes are loaded only in explicit evidence/debug modes. Normal play does not request that module.

## Performance evidence and limits

Crowded combat with 128 enemies reproduced the reported severe slowdown in Chrome phone/touch emulation with four-times CPU throttling. Profiling identified full-world collision scans and repeated sorting as the main cost. The collision index reduces the measured collision self time from roughly 2 seconds to 0.16 seconds in a 10-second profile.

A profiler-free repeat of the retained fix measured 16.41 ms mean browser frame interval, 48.6 ms p95 and 62.6 ms p99 under four-times CPU throttling. These are browser frame intervals, not a physical-phone guarantee. The run retained 124 enemies and had no console/page errors. Frame-time spikes still matter and must remain visible in the report. Enemy numbers, combat balance, movement, camera zoom, the 60 Hz simulation and four-step catch-up limit were not reduced by this optimization.

A separate neighbor-search experiment was reverted because its end-to-end result was contaminated by an unrelated Blender render and did not establish a reliable improvement. Its deterministic parity test remains useful coverage.

## Asset budgets

The four base hero textures remain 15,796,588 bytes under the existing 16 MiB total cap. The optional motion pages bring the complete four-hero texture library to 26,933,668 bytes. Each selected hero is below 8 MiB compressed and uses 32 MiB decoded for its base plus motion page. This is an explicit expansion for added motion; it is not represented as unchanged memory usage.

The active enemy texture library is 15,155,687 bytes. Legacy textures keep their 2 MiB per-file cap; the new native class uses a 4 MiB per-file cap and the complete active roster a 16 MiB cap. Ordinary and boss atlases are requested according to encounter readiness, not all decoded at initial entry. Decoded image QA independently checks bounds, opacity, animation uniqueness and the recorded reproducibility/provenance.

## Release status

**Candidate only; not published by this HMH task yet.** All unit/release, browser, performance and hosted checks must be completed against the integrated source before replacing this status with a release receipt.

The fresh production inspection on September 13 found Chikun Afterlight at `dpl_TFj74rNbMiBdu2p5JbrL9UQNqNFi`, runtime source `d7a5ad691b2fe3f34f4453b5bc39429ec2648042`, replacing the September 12 HMH package. Preserve that newer work. The user authorized coordination with the separate STACKED task; its committed beta branch includes the Chikun implementation. Recheck the live deployment immediately before promotion.

## Retained unfinished work

New held-weapon models, native long-gun grips/reload actions and the full power-up model family are not wired into the playable runtime. Eleven draft paths are preserved, with original paths recorded, in the local ignored `.tmp/unfinished-equipment-work` directory. Earlier private bakes are retained. Do not claim those models are playable or finished.

Physical iOS/Android playtests, listener/device sound review, broader environmental audio, further world design and full original AAA acceptance remain open in the [retained backlog](hmh-playable-release-and-polish-backlog.md). This release does not claim to close all original work groups.

Native evidence: [hero motion](../testing/hmh-hero-motion/measurement.json), [enemy roster](../testing/hmh-native-roster/measurement.json). The complete legacy exception ledger is unchanged; unexpected failures must be fixed, not added to it.
