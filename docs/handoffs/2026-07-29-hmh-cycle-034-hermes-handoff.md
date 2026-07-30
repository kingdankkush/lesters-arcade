# Hard Money Heroes Cycle 034 Hermes continuation handoff

Date: 2026-07-29 PDT
Repository: `C:\Users\just_\Desktop\Projects\Web3 Gaming\Lesters-Arcade`
Continuation branch: `reboot/hmh-aaa-continuous`
Cycle 034 commit: `be2712e4c617152eb3f115c5ef083e3a3a173044`
Cycle 034 exact commit patch SHA-256: `540d71f3bcc9935fee4ee525e19b59806800430e6267207b65d55e403f220e50`
Production source remains: `e8f7a73e8f23e055dd77300c2e5e7c59ec4c38e3`
Production URL: `https://lestersarcade.io`
Status: `LOCAL CERTIFIED · COMMITTED LOCALLY · NOT PUSHED · PRODUCTION UNTOUCHED BY CYCLE 034`

## Read first

1. `AGENTS.md`
2. this handoff
3. `docs/hmh-reboot/cycles/CYCLE-034.md`
4. `docs/hmh-reboot/cycles/CYCLE-033.md`
5. `docs/hmh-reboot/cycles/CYCLE-032.md`
6. `docs/hmh-reboot/REFERENCE-CHARACTER-MODELS.md`
7. `.hermes/plans/2026-07-23_225852-hmh-aaa-continuous-improvement-master-plan.md`
8. `docs/hmh-reboot/AAA-CONTINUOUS-IMPROVEMENT.md`

## What Cycle 034 completed

Cycle 034 upgraded the two ordinary close-range enemy families through the repository-owned Blender pipeline while preserving all deterministic gameplay authority.

Bagholder Rusher:

- `bagholder-undead-scrapper-v1` detail kit;
- `undead-straight-lunge-v1` animation profile;
- 21 authored detail objects;
- scene complexity changed from 28 to 49 objects;
- clearer scalp wound, broken teeth, torn clothing, wraps, guards, pouches, coat tails, and debt-chain identity;
- deeper two-arm tell and stronger straight-lunge commitment.

Whale Enforcer:

- `whale-enforcer-undead-bruiser-v1` detail kit;
- `undead-shoulder-charge-v1` animation profile;
- 21 authored detail objects;
- scene complexity changed from 29 to 50 objects;
- clearer zombie face, skull/jaw damage, neck/chest armor, harnesses, bracers, knuckle plates, pouches, knee plates, and shoulder rivets;
- lowered squared tell and stronger shoulder-led charge commitment.

The shared enemy rig remains 13 bones. The generated scene contains 278 tagged objects.

## Art defect found and fixed

The first Cycle 034 Whale candidate produced isolated 4–5 pixel boot-toe fragments in four side-facing run frames. The new toe-cap objects were removed from the repository-owned Blender generator, the entire roster pipeline was regenerated, and the final per-frame alpha connected-component audit found zero tiny detached components for both upgraded actors.

The reusable `game-asset-audit` skill now requires this component audit after generated actor detail or rig changes.

## TDD, generation, and visual evidence

RED occurred before implementation:

- focused tests initially reported `5/8` passing and `3/8` failing;
- failures covered absent detail-kit identities, absent motion profiles, and absent generated provenance.

GREEN and certification:

- focused model/atlas tests: `18/18`;
- source Blender pipeline's owned same-scene two-pass reproducibility gate: PASS;
- generated frames: `1,368`;
- decoded duplicate frames: `0`;
- final target tiny disconnected components: `0`;
- all-direction audit covered idle, run, tell, attack, hit, and death;
- full desktop/mobile roster-preview evidence passed with all six ordinary enemies loaded.

Cycle 034 evidence paths:

- `.tmp/art-review/cycle-034-bagholder-rusher-before-after-final.png`
- `.tmp/art-review/cycle-034-whale-enforcer-before-after-final.png`
- `.hermes/evidence/hmh-cycle-034-enemy-detail-desktop.png`
- `.hermes/evidence/hmh-cycle-034-enemy-detail-mobile.png`

The `.tmp` and `.hermes/evidence` files are ignored local review evidence, not shipped assets.

## Budgets and gates

- total roster atlases: `6,781,314 / 10,485,760` bytes;
- Bagholder atlas: `784,249 / 2,097,152` bytes;
- Whale atlas: `1,214,257 / 2,097,152` bytes;
- HMH game bundle: `1,021,923 / 1,050,000` bytes;
- release ledger: `1,790 total / 1,738 passing / 52 accepted legacy / 0 unexpected`;
- syntax: `334` JavaScript modules and `49` Python scripts;
- visual regression: `8/8` unchanged;
- five-profile browser certification: PASS;
- mobile controls: `4/4`;
- performance p95: `7 ms` desktop and mobile;
- network: zero request, console, page, or HTTP failures;
- security: `5/5`, zero findings;
- third-party security: `3/3`;
- Web3 audit: `9/9`; live readiness remains intentionally partial;
- strict repository health, CDN, docs-link, policy, build, and diff gates: PASS.

## Exact-index review

Frozen and post-commit patch digest:

`540d71f3bcc9935fee4ee525e19b59806800430e6267207b65d55e403f220e50`

Completed exact-digest verdicts:

- deterministic/gameplay authority: PASS;
- security/performance/accessibility/release scope: PASS;
- full-resolution visual/Blender production: PASS.

The first visual subagent lacked vision credits and was correctly treated as non-certifying infrastructure failure. A separate independent Hermes `gpt-5.6-sol` session inspected all four images and returned the exact-digest PASS. Post-commit patch verification reproduced the frozen digest.

## Preserved gameplay and authority

Cycle 034 did not change:

- body collision;
- Cycle 033 ordinary-enemy hurtboxes;
- Cycle 032 ordinary/boss projection scales;
- damage, attack range, timing, AI, navigation, spawn order, budgets, RNG, fixed-step timing, replay, XP, upgrades, weapons, saves, boss authority, or player movement;
- parent authority for wallets, profiles, leaderboards, canonical sessions, official completion, analytics, and settlement;
- `SETTLEMENT_LIVE=false`;
- production or rollback deployments.

## Newly discovered continuation issue

After Cycle 034 was committed, a fresh independent scene rebuild changed 93 of 1,368 rendered
source-frame hashes even though the owned verifier had passed two renders of the same rebuilt scene.
The drift affected mostly RGB values, while only 568 alpha channel values changed across all 93 frames,
which is consistent with Blender render dithering rather than geometry or animation movement. The ordinary
pipeline command also rewrites `reproducibleVerified` to false by design and Blender rewrites the `.blend`
container, so those expected changes must be separated from real atlas drift.

Cycle 035 must start with a RED cold-scene reproducibility contract, set an explicit deterministic Blender
dithering/sample policy, and prove two separately rebuilt scenes produce byte-identical atlas PNGs and
source-pixel hashes before accepting another art regeneration. Do not describe the current verifier as a
cold-build guarantee until that contract is GREEN.

## Next bounded slice: deterministic ranged/support enemy-family model and animation wave

Audit the two remaining ordinary families without custom high-detail kits:

- `liquidator-agent`;
- `validator-cultist`.

Start read-only and select the smallest coherent wave only after full-direction evidence.

1. Inventory both actors' Blender objects, detail tags, rig bindings, atlas sizes, source metadata, and production state/direction coverage.
2. Generate full-resolution eight-direction strips for idle, run, tell, attack, hit, and death, including first/last tell and recovery frames.
3. Measure decoded uniqueness, alpha components, grounding, prop/body occlusion, face readability, and gameplay-scale role silhouette.
4. Add a RED cold-scene reproducibility test that rebuilds the Blender scene independently before each comparison render.
5. Define RED contracts for versioned detail kits and role-specific animation profiles before changing generator or source files.
6. Favor a readable ranged-agent tell/attack and a readable support/cultist cast while preserving gameplay timing, target selection, projectiles, and attack-token authority.
7. Preserve source canon: the Liquidator Agent remains a visibly human liquidation operative; the Validator Cultist remains a visibly humanoid zombie. Do not introduce robot, animal, vehicle, mascot, or primitive actor proxies.
8. Regenerate the complete roster through `npm run assets:hmh:enemy-roster`; verify with the strengthened cold-build reproducibility gate.
9. Repeat per-frame alpha connected-component checks and inspect all eight directions before accepting atlases.
10. Run complete asset, visual, browser, mobile, performance, combat, release, security, and exact-index gates.

After the ordinary roster is visually coherent, continue movement/combat feel, AI counterplay, weapon DPS/TTK, progression balance, authored setpieces, UI/mobile polish, and sound in separate measured cycles.

## Pipeline traps

- The valid generation command is `npm run assets:hmh:enemy-roster`; `npm run assets:build:hmh:enemy-roster` does not exist.
- Do not edit shipped atlas pixels manually; change repository-owned manifest/Blender source and regenerate.
- Wait for the complete pipeline to settle before inspecting Git.
- The current same-scene two-render verifier does not prove two freshly rebuilt Blender scenes are byte-identical; Cycle 035 must close this gap before accepting regenerated art.
- Treat tiny newly detached alpha components as fail-closed until visually adjudicated and source-fixed.
- Preserve the shared rig, projection contract, Cycle 032 scales, and Cycle 033 hurtboxes.
- Generated metadata now records `detailKit` and `animationProfile`; actors without custom profiles use `shared-roster-v1`.
- Restore command-generated security/CDN report churn before staging.
- Use exactly `git diff --cached --binary | sha256sum` for exact-index identity.
- Any staged edit invalidates prior reviews.
- Stop local listeners before commit.
- Do not push, preview, or deploy without separate explicit authorization.
- LitVM transactions and settlement remain separately HALT-gated.
