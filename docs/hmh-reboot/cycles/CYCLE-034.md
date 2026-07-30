# Hard Money Heroes Cycle 034

Status: `LOCAL CERTIFIED · COMMITTED LOCALLY · NOT PUSHED · PRODUCTION UNTOUCHED`

Date: 2026-07-29 PDT
Branch: `reboot/hmh-aaa-continuous`
Baseline: `4b11e4d7ae51c4b870e2c574c156603af7396ef2`
Source commit: `be2712e4c617152eb3f115c5ef083e3a3a173044`
Exact commit patch SHA-256: `540d71f3bcc9935fee4ee525e19b59806800430e6267207b65d55e403f220e50`

## Bounded slice

Cycle 034 is the first post-Cycle-033 enemy-family model and animation wave. It upgrades the two ordinary close-range undead families without changing deterministic gameplay:

- Bagholder Rusher: new `bagholder-undead-scrapper-v1` detail kit and `undead-straight-lunge-v1` motion profile.
- Whale Enforcer: new `whale-enforcer-undead-bruiser-v1` detail kit and `undead-shoulder-charge-v1` motion profile.

The work remains projection-only. Collision bodies, Cycle 033 hurtboxes, damage, melee ranges, attack timing, AI, pathing, spawning, RNG, fixed-step simulation, progression, replay evidence, bridge authority, wallet behavior, settlement, and production deployment are unchanged.

## Baseline audit

The repository-owned Blender scene used Blender `5.1.2`, the shared 13-bone enemy rig, and reproducible manifest-driven generation.

Before Cycle 034:

| Actor | Scene objects | Role-detail objects | Main weakness |
| --- | ---: | ---: | --- |
| Bagholder Rusher | 28 | 0 | Generic block torso and limbs; weak scavenger/zombie role detail; shared attack motion |
| Whale Enforcer | 29 | 0 | Generic large block torso; minimal bruiser armor; shared attack motion |

Full eight-direction audit strips covered idle, run, tell, attack, hit, and death frames before implementation. The two actors remained humanoid, but role identity and close-range attack anticipation were materially weaker than the already upgraded Forkrunner and Gas Bomber families.

## RED

`tests/hmh-reboot-enemy-role-detail.test.mjs` added contracts for:

- Exact versioned detail-kit identities.
- Both target actors retaining `identityForm: "zombie"` in production-art authority.
- Minimum 18 authored, front-readable parts per target actor.
- Exact versioned attack-animation profiles.
- Fail-closed Blender builder and exporter dispatch.
- Generated atlas provenance for the detail and animation profiles.
- Projection-only metadata and unchanged gameplay-body authority.

Initial focused result: `5/8` passed and `3/8` failed because the manifests, builder/exporter dispatch, and generated provenance did not yet exist.

## GREEN implementation

### Bagholder Rusher

The shared rig now drives 21 authored role-detail objects:

- Scalp wound and three broken teeth.
- Torn lapels and shoulder scraps.
- Forearm wraps.
- Knee guards and boot-toe reinforcement.
- Debt pouches, torn coat tails, and a three-link chest chain.

Its attack profile deepens the two-arm wind-up, lowers the pre-lunge stance, strengthens forward commitment, and gives the contact/recovery frames a clearer straight-line silhouette.

### Whale Enforcer

The shared rig now drives 21 authored role-detail objects:

- Skull fracture and two exposed jaw teeth.
- Neck guard, three chest plates, and crossed harnesses.
- Heavy forearm bracers and knuckle plates.
- Belt pouches, knee plates, and shoulder rivets.

Its attack profile replaces the shared two-arm swing with a lowered, squared shoulder wind-up and stronger shoulder-led charge commitment.

A first rendered candidate exposed four side-facing run frames with isolated 4–5 pixel boot-toe fragments. Those two added toe-cap objects were removed, the pipeline was regenerated, and a second full 1,368-frame component audit found zero tiny detached components for either Cycle 034 actor.

### Pipeline provenance

`run-hmh-enemy-roster-pipeline.py` now records each actor's detail-kit and animation-profile provenance in atlas metadata. Actors without a custom motion profile explicitly record `shared-roster-v1`.

## Structural and visual result

| Actor | Before objects | After objects | Added detail objects |
| --- | ---: | ---: | ---: |
| Bagholder Rusher | 28 | 49 | 21 |
| Whale Enforcer | 29 | 50 | 21 |

The shared rig remains 13 bones. The full scene now contains 278 tagged actor objects.

Full-resolution before/after review covered 8 directions and representative idle, run, tell, attack, hit, and death frames. Final review found:

- Clearer humanoid zombie faces and clothing/armor layers.
- Distinct scavenger-rusher and heavy-bruiser silhouettes.
- Stronger anticipation, contact, and recovery separation.
- Preserved hit and collapse readability.
- No target-actor clipping, floating pieces, robotic/animal substitution, or directional regression.

Browser evidence:

- `.hermes/evidence/hmh-cycle-034-enemy-detail-desktop.png`
- `.hermes/evidence/hmh-cycle-034-enemy-detail-mobile.png`

Both desktop and mobile roster-preview compositions loaded all six ordinary production atlases with no browser errors, overflow, or actor clipping.

## Asset and performance budgets

| Metric | Before | Cycle 034 | Limit |
| --- | ---: | ---: | ---: |
| Bagholder atlas | 675,428 bytes | 784,249 bytes | 2,097,152 bytes |
| Whale atlas | 990,637 bytes | 1,214,257 bytes | 2,097,152 bytes |
| Total roster atlases | 6,448,834 bytes | 6,781,314 bytes | 10,485,760 bytes |
| HMH game bundle | unchanged | 1,021,923 bytes | 1,050,000 bytes |

Total roster growth is 332,480 bytes. Desktop and mobile browser performance remained at 7 ms p95.

## Certification gates

Passed before exact-index freeze:

- Focused enemy-model and atlas tests: `18/18`.
- Final Cycle 034 focused contract: `8/8`.
- Release ledger: `1,790 total / 1,738 passing / 52 accepted legacy / 0 unexpected`.
- Syntax: `334 JavaScript modules / 49 Python scripts`.
- Enemy pipeline reproducibility: `true`.
- Enemy frames: `1,368`, with `0` duplicates.
- Production asset QA: PASS; 7 roster atlases, all within per-atlas and aggregate budgets.
- Build: PASS.
- Visual regression: `8/8 unchanged`; no baseline acceptance was required.
- Enemy-detail browser smoke: desktop and mobile PASS; all six ordinary families active and loaded.
- Five-profile browser certification: PASS.
- Mobile controls: `4/4` devices passed.
- Performance: `7 ms` desktop p95 and `7 ms` mobile p95.
- Network audit: zero HTTP, request, console, or page errors.
- Security audit: `5/5`, zero findings.
- Third-party sandbox security: `3/3`.
- Web3 settlement audit: `9/9`; live readiness remains intentionally PARTIAL because real settlement is not enabled or proven.
- Strict repository health and CDN cleanup gates: PASS; no destructive cleanup occurred.
- Documentation links and AGENTS policy: PASS.
- `git diff --check`: PASS.

Exact-index review used the frozen digest
`540d71f3bcc9935fee4ee525e19b59806800430e6267207b65d55e403f220e50`.
Independent deterministic/gameplay-authority, security/performance/accessibility/release-scope,
and full-resolution visual/Blender reviews all returned exact-digest PASS with empty blocker lists.
The first visual reviewer lacked vision-model credits and was treated as non-certifying infrastructure
failure; an independent Hermes `gpt-5.6-sol` session then inspected all four source/runtime images and
returned the required exact-digest PASS. Post-commit `git show --binary --format=` reproduced the frozen digest.

## Authority preservation

Cycle 034 changes only repository-owned art source, projection-only animation generation, generated atlases/metadata, and tests/docs.

Unchanged:

- Ordinary visual scale `0.75` and boss visual scale `0.86`.
- Cycle 033 ordinary vulnerable radius scale `0.90`, minimum radius `10`, and capsule half-length `8`.
- Movement collision radius and elevation/cover ordering.
- Boss targeting and phase authority.
- Damage, attack range, tell/recovery tick counts, AI, spawn budgets, RNG, fixed-step timing, replay semantics, XP, upgrades, weapons, and saves.
- Parent authority for wallets, profiles, leaderboards, canonical sessions, official completion, analytics, and settlement.
- `SETTLEMENT_LIVE=false`.
- Production source and deployment.

## Release decision

Cycle 034 is local-only. Do not push, create or promote a Vercel deployment, change production, deploy contracts, send transactions, or enable settlement without separate explicit authorization for that exact action.
