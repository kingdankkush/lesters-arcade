# Frozen Frontier polish contribution — September 11, 2026

This is an integration contribution, not a live release receipt. The owner requested completion and publication. The task **Polish and launch game overhaul** owns the single combined integration and publication in `C:/Users/just_/Documents/Codex/2026-09-10/ple/work/release`; this task will not publish a competing deployment. Reconcile this contribution against `06749b38` (live runtime `67b9f450`).

The original checkout started at `5d8c4a1c` and imported 68 quality-pass paths. The frozen contribution preserves the newer upstream pause/upgrade behavior, isolated runtime boss-aim regression and verified release history. Unchanged native Blender files are restored to their exact Git LFS pointers after rendering; the source objects were not edited.

Delivered changes:

- Hero lower body follows aim beyond 45 degrees; dash, melee, grenade and death use coherent full-body facing. Backpedal animation reverses the run sequence.
- The camera shows approximately 20 percent more world width on desktop, with a restrained wider view on small landscape screens.
- Four native, face-level upper-body portraits replace the gun-holding selector rotation. Five rendered angles play in a restrained eight-step turn. Cold Blender repeat renders passed; all four lossless sheets total 1,971,714 bytes, below the 2 MiB combined limit.
- Level 1 has a real asset-loading briefing, current movement/grenade bindings, route and equipment tips, entry location and an explicit Enter Level 1 action. Survival time and health stay frozen until entry. Reading an already-ready briefing beyond 20 seconds does not produce a false load warning.
- Five spawn locations are selected deterministically from the parent seed without consuming gameplay randomness. Opening enemies and exploration reveal start around that selected entry.
- Nearby available pickups receive ground rings, light columns and chevrons. Offscreen, future and collected items are excluded; reduced motion produces steady indicators.
- Ordinary enemies have varied cosmetic stride phases. Corpse animation starts on death; boss anticipation, strike, recovery, hit and death presentation follow their actual events and face the player.
- Optional gore adds bounded, expiring ground blood and debris; shield impacts produce no blood and reduced motion removes flying fragments. Turning gore off clears it immediately.
- Nine additional original PCM cues extend the previous 28 to 37: enemy death, melee/ranged warnings, boss phase/hit/death, dash and dirt/road footsteps. The generator, manifest and runtime routing stay aligned. These are original generated effects, not extracted Doom or Duke Nukem recordings.
- Optional diagnostics/world-tour and combat audio imports preserve the startup budget. The final integrator must retain these import boundaries when merging terrain work.

Evidence at freeze:

- 215 focused behavioral checks pass, including startup/restart, real runtime boss aiming, all torso-direction combinations, spawn walkability, portrait contracts, pickup bounds, creature timing, gore bounds and sound routing. No failures, skips or cancellations.
- Production hero/enemy/prop decoder audit and native portrait check pass after restoring unchanged source pointers.
- Last production build passes: entry 426,397 / 480,000 bytes; initial aggregate including shared chunks 1,027,233 / 1,048,576 bytes. A final combined build is required after integration.
- Syntax validation passed for 515 JavaScript and 84 Python files before final small binding/pause reconciliation edits; final combined validation is required.
- Original-sample audio audit: 37 cues, 1,390,778 bytes, no clipping or unknown cues in the 154-event overlapping mix, peak 0.22493, maximum seven simultaneous voices. This is not human listening or device loudness acceptance.
- Browser review covered parent Free launch, the new selector, desktop and 390-by-844 mobile briefings, ready-state waiting at tick zero, entry into combat and zero console errors in the observed flow.
- The existing visual harness completed all 12 scenes without runtime errors; all full images and metrics were reviewed. Camera/framing changes are intentional; ground/prop alignment and UI containment remain readable. Terrain seams, repeating yard surfaces and canopy bands remain visible and are covered by the other task's newer terrain contribution. Pickup markers are visible in the ravine and mining scenes.
- The visual comparison reports changed scenes against the preceding camera baseline. Baselines are deliberately not accepted in this intermediate contribution: the final combined terrain/camera candidate needs fresh screenshot review, acceptance and repeat comparison. The historical detailed enemy-crop repeatability warning remains open.
- The full release suite was interrupted by new user turns and has **not** certified this frozen contribution. The unchanged 51-entry retirement ledger must be enforced by the final integrated release gate.

Local evidence is in the originating workspace's `work` logs, `work/game-source/.hermes/evidence/hmh-reboot-visual/current`, and `outputs/level-1-briefing-mobile.png`. The committed audio audit is `docs/qa/hmh-frontier-action-audio-20260911.json`.

Merge seams: `apps/hmh-reboot/src/main.mjs`, portal intro HTML, syntax registry and service-worker version. The final integrator owns the combined service-worker marker; both contributions proposed v34 independently. Keep its newer terrain URLs, materials, decals and ground renderer. The generated curated-level-kit runtime adds the portrait module to its scanned source paths and should be regenerated after integration.

This slice does not complete all weapon rigs, native enemy/boss replacements, hero likeness/skinning acceptance, late-run balance, physical-device performance or final sound mixing. Preserve all 55 work groups, 99 original register IDs and 22 paused STACKED IDs in the existing backlog. Financial activation remains disabled.
