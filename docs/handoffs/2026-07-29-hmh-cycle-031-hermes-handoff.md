# Hard Money Heroes Cycle 031 Hermes continuation handoff

Date: 2026-07-29 PDT
Repository: `C:\Users\just_\Desktop\Projects\Web3 Gaming\Lesters-Arcade`
Continuation branch: `reboot/hmh-aaa-continuous`
Cycle 031 commit: `45d1a25e48f0ba7f094efc0199ebb4675d8ac614`
Cycle 031 exact commit patch SHA-256: `a3be6886f105f98be6cec7eb0ca80fed6348e4080fa31b85f856d950e2914c36`
Production source remains Cycle 021: `a81f1c8f830f3339ebb568de166c108e58f695d3`
Status: `LOCAL CERTIFIED · COMMITTED LOCALLY · PRODUCTION UNTOUCHED`

## Read first

1. `AGENTS.md`
2. this handoff
3. `docs/hmh-reboot/REFERENCE-CHARACTER-MODELS.md`
4. `docs/hmh-reboot/cycles/CYCLE-031.md`
5. `docs/hmh-reboot/cycles/CYCLE-030.md`
6. `docs/hmh-reboot/cycles/CYCLE-029.md`
7. `.hermes/plans/2026-07-23_225852-hmh-aaa-continuous-improvement-master-plan.md`

## What Cycle 031 completed

Lit Valkyrie's `lit-valkyrie-rambo-v1` model was rebuilt as a reference-specific human female field commando while preserving the shared production rig and projection-only runtime.

The model now includes:

- visible feminine face with separate eyes, brows, nose, mouth and restrained cheek marks;
- platinum crown, swept fringe and high ponytail;
- nine separately named, shrinking braid groups;
- bare athletic arms;
- fitted olive sleeveless shirt;
- compact black-olive cross harness;
- fingerless gloves and restrained mint wrist accents;
- charcoal cargo trousers and pockets;
- utility belt, pouches, knee protection and grounded combat boots;
- right-thigh holster with straps and visible steel grip.

Explicit exclusions remain enforced:

- no sealed helmet;
- no robot or mech treatment;
- no mascot sphere;
- no Lilly glasses;
- no teal hair.

## TDD and fail-closed contract

Cycle 031 added a RED contract before implementation. It failed because Lit Valkyrie was still `planned-bounded-model-cycle`.

The GREEN contract requires:

- `implementationStatus: cycle-031-implemented`;
- `detailKit.kind: lit-valkyrie-rambo-v1`;
- at least `55` declared authored parts;
- at least `7` named hair-lock groups;
- explicit builder dispatch;
- fail-closed authored-part and hair-count enforcement.

The manifest declares `60` minimum authored parts. Pinned Blender inspection observed:

- authored reference parts: `63`;
- named hair locks: `9`;
- rig bones: `14`;
- `weapon_socket`: present;
- external Blender libraries: `0`.

## Generated evidence

Lit Valkyrie runtime output:

- frames: `648`;
- unique animated frames: `640`;
- empty frames: `0`;
- transparent-corner failures: `0`;
- reproducibility: `0 / 0 / 0` changed pixels/channel deltas;
- atlas: `2048 × 2048`;
- atlas bytes: `2,917,618`;
- atlas SHA-256: `23a8a8f6de7c16f2257e6fac302f21d0341afad013742a4da0bdde80c77d483e`;
- contact-sheet SHA-256: `e1373cbcda9312b7e9c208515e9be6e6a49096570c4d43197950585084ca12cd`;
- source `.blend` SHA-256: `4c5d7204af743a7d5ece6da5f718bd439e1bdcc214de3c30dceeeb02309e113b`.

Four-hero aggregate:

- `12,220,253 / 12,582,912` bytes;
- remaining headroom: `362,659` bytes.

This is close to the aggregate budget. Future hero-model cycles should not add more four-hero atlas weight without a measured optimization plan.

## Verification

- Focused model/atlas/selector tests: `26/26`.
- Syntax: `332` JS modules + `49` Python scripts.
- Release ledger: `1,780` total / `1,728` passing / `52` accepted legacy / `0` unexpected.
- Build: PASS.
- HMH bundle: `1,021,358 / 1,050,000` bytes.
- Production asset QA: PASS.
- Visual regression: `8/8` unchanged.
- Desktop performance p95: `7 ms`.
- Mobile performance p95: `7 ms`.
- Five-profile Chrome certification: PASS.
- Combat desktop/mobile/bridge: PASS.
- Cockpit desktop/tablet/mobile/landscape: PASS.
- Portal E2E implemented flows: PASS.
- Four-device mobile controls: PASS.
- Network: four scenarios with zero failures.
- Security: `5/5`, zero findings.
- Third-party sandbox: `3/3`.
- Web3 settlement audit: `9/9`.
- Web3 live readiness: honestly `PARTIAL 3/4`.
- Repository health, CDN gate, documentation links and diff checks: PASS.

## Exact-index review

Frozen candidate digest:

`a3be6886f105f98be6cec7eb0ca80fed6348e4080fa31b85f856d950e2914c36`

Independent verdicts:

- deterministic/gameplay correctness: PASS;
- security/authority/release scope: PASS;
- local direct-model three-axis fallback: PASS.

The hosted visual subagent could not invoke its vision backend because that provider lacked credits. This was reviewer infrastructure failure, not a packet finding. Direct full-resolution vision inspection covered every direction and sampled action before staging; the independent local reviewer then checked the exact source/manifests/metrics supporting that visual evidence. No concrete visual blocker remained.

Post-commit `git show --binary --format=` reproduced the exact frozen digest.

## Current authority boundary

- shared gameplay body: `human-medium-collision-v1`;
- hero runtime atlas scale: `0.58`;
- ordinary enemy runtime atlas scale: `0.50`;
- fixed simulation: `60 Hz`;
- maximum catch-up steps: `4`;
- runtime art authority: `projection-only`;
- `SETTLEMENT_LIVE=false`;
- no push, merge, preview deployment or production deployment;
- no wallet, signature, transaction, contract or settlement action.

## Next bounded slice: measured actor-scale parity

Do not guess at projection scale. Begin with a read-only measurement packet:

1. Inventory hero, ordinary-enemy and boss source heights, atlas frame bounds and runtime scales.
2. Measure screen-space opaque bounds at the desktop and mobile gameplay cameras across representative directions/actions.
3. Separate ordinary human/zombie parity from intentionally larger bosses.
4. Define an acceptable parity band before changing constants.
5. Keep collision, hurt capsules, route spacing, AI and deterministic simulation unchanged.
6. Add RED tests for the chosen projection-only contract.
7. Change only projection scale if measurements prove a mismatch.
8. Re-run visual, browser, performance, release, security and exact-index gates.

Current scale constants:

- `PRODUCTION_HERO_RUNTIME_SCALE = 0.58` in `apps/hmh-reboot/src/production-hero-atlas.mjs`;
- `ENEMY_ROSTER_RUNTIME_SCALE = 0.50` in `apps/hmh-reboot/src/enemy-roster-atlas.mjs`.

Cycle 027 increased ordinary enemies from `0.42` to `0.50`. Do not discard that evidence or modify gameplay bodies inside the projection candidate.

After scale parity, run the separate enemy-hurt-capsule generosity cycle using seeded hit-rate measurements and 60/30/20 schedule equivalence. Then continue two enemy-family model waves, animation readability, authored-world, combat-balance and progression cycles.

## Pipeline traps

- The production-hero generator regenerates all four hero atlases because they share one `.blend` source.
- Shared-scene hash/provenance changes across unchanged hero pixels are intentional and must remain documented.
- Run the pinned Blender `5.1.2` pipeline twice; one render is not reproducibility evidence.
- Restore command-generated security/CDN report churn before staging.
- Use canonical digest command exactly: `git diff --cached --binary | sha256sum`.
- Any staged edit invalidates all prior exact-index verdicts.
- Stop local HTTP servers before committing.
- Do not push or deploy without explicit approval.
