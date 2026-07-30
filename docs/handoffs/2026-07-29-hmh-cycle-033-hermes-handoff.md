# Hard Money Heroes Cycle 033 Hermes continuation handoff

Date: 2026-07-29 PDT
Repository: `C:\Users\just_\Desktop\Projects\Web3 Gaming\Lesters-Arcade`
Continuation branch: `reboot/hmh-aaa-continuous`
Cycle 033 commit: `d59d838258f285fa568382c28eadbc2979117a92`
Cycle 033 exact commit patch SHA-256: `e1e438b107280f5268f242d35b31a237256a1a68d198ade6ca38e4b3e6c881b9`
Production source remains: `e8f7a73e8f23e055dd77300c2e5e7c59ec4c38e3`
Production URL: `https://lestersarcade.io`
Status: `LOCAL CERTIFIED · COMMITTED LOCALLY · NOT PUSHED · PRODUCTION UNTOUCHED BY CYCLE 033`

## Read first

1. `AGENTS.md`
2. this handoff
3. `docs/hmh-reboot/cycles/CYCLE-033.md`
4. `docs/hmh-reboot/cycles/CYCLE-032.md`
5. `docs/hmh-reboot/REFERENCE-CHARACTER-MODELS.md`
6. `docs/handoffs/2026-07-29-hmh-cycle-031-hermes-handoff.md`
7. `.hermes/plans/2026-07-23_225852-hmh-aaa-continuous-improvement-master-plan.md`

## What Cycle 033 completed

Cycle 033 created one shared, versioned ordinary-enemy hurtbox policy and routed both projectile and melee targeting through it.

Policy:

- id: `cycle-033-forgiving-ordinary-enemy-hurtbox-v1`;
- vulnerable radius scale: `0.90`;
- minimum vulnerable radius: `10`;
- capsule half-length: `8`;
- vertical target band: `4..60`;
- radius-keyed frozen profile cache;
- boss targeting remains a separate `48`-radius circle with `4..92` vertical band.

For a standard `18`-radius ordinary enemy:

- collision radius remains `18`;
- vulnerable radius changed `12.96 → 16.2`;
- seeded contacts changed `3,075 → 3,523` of `4,000`;
- seeded hit rate changed `76.875% → 88.075%`;
- measured gain: `+11.2 percentage points`;
- a `30`-unit cross-track miss remains a miss.

## TDD and determinism

RED occurred before production code because `apps/hmh-reboot/src/enemy-hurtboxes.mjs` did not exist.

GREEN requires:

- collision body preservation;
- shared projectile/melee generosity;
- bounded seeded contact-rate evidence;
- non-vacuous deliberate-miss evidence;
- identical hit events across 60, 30, and 20 fps render schedules;
- live `main.mjs` consumption;
- removal of the stale inline `0.72` duplicate.

The profile changes vulnerable geometry only. Damage, health, armor, movement, collision, separation, projectile physics, elevation, cover ordering, melee range/cooldown, enemy AI, spawn budgets, RNG, progression, visual scale, replay, and parent authority remain unchanged.

## Verification

- focused hurtbox/projectile/melee/enemy tests: `53/53`;
- release ledger: `1,787 total / 1,735 passing / 52 accepted legacy / 0 unexpected`;
- syntax: `334` JavaScript modules + `49` Python scripts;
- build: PASS;
- HMH bundle: `1,021,923 / 1,050,000 bytes`;
- production asset QA: PASS;
- visual regression: `8/8` unchanged;
- five-profile Chrome certification: PASS;
- combat desktop/mobile/bridge: PASS;
- performance p95: `7 ms` desktop and mobile;
- mobile controls: `4/4` devices;
- network: four scenarios with zero HTTP/request/console/page failures;
- projectile fuzz: `20,000` cases PASS;
- projectile soak: `3,600` ticks PASS;
- broadphase benchmark parity: PASS;
- security: `5/5`, zero findings;
- third-party sandbox: `3/3`;
- Web3 audit: `9/9`;
- Web3 live readiness: honestly `PARTIAL 3/4`;
- repository health, CDN gate, documentation links, and diff checks: PASS.

## Exact-index review

Frozen digest:

`e1e438b107280f5268f242d35b31a237256a1a68d198ade6ca38e4b3e6c881b9`

Completed verdicts:

- deterministic/gameplay correctness: PASS;
- balance/UX/performance: PASS;
- security/authority/release scope: PASS.

The first deterministic reviewer timed out without a verdict and was not counted. A focused replacement reviewer verified the unchanged frozen digest and returned PASS. Post-commit `git show --binary --format=` reproduced the exact frozen digest.

## Current Git and deployment boundary

At this handoff:

- local HEAD: Cycle 033 implementation commit `d59d838258f285fa568382c28eadbc2979117a92` before this handoff commit;
- upstream branch: production/release baseline `e8f7a73e8f23e055dd77300c2e5e7c59ec4c38e3`;
- Cycle 033 is local-only and not pushed;
- production remains `https://lestersarcade.io` on the Cycle 032/Vercel-fix release;
- no preview or production deployment occurred for Cycle 033;
- no wallet, signature, transaction, contract, or settlement action occurred;
- `SETTLEMENT_LIVE=false` remains required.

Re-read live Git and deployment state before any future push or release. Do not infer it from this handoff after another session begins.

## Next bounded slice: first enemy-family model and animation wave

Begin with a read-only native-art audit, then select the smallest coherent close-range enemy-family wave.

1. Inventory the current repository-owned Blender source, manifests, atlas metadata, authored parts, rig, and native state/direction coverage for `bagholder-rusher` and the next closest-range ordinary family.
2. Inspect full-resolution idle/run/tell/attack/hit/death contact sheets, especially first/last tell, hit, and death frames.
3. Measure decoded-frame uniqueness, silhouette readability, foot grounding, weapon/limb occlusion, and atlas budget before editing.
4. Define RED identity/detail/rig/state/decoded-frame contracts before changing Blender or generator code.
5. Preserve Cycle 032 visual scale and Cycle 033 hurtbox policy; art remains projection-only.
6. Keep enemies visibly human zombies. Do not introduce robots, vehicles, animals, mascot spheres, or primitive actor replacements.
7. Regenerate through the pinned repository-owned Blender pipeline, verify reproducibility twice, and inspect desktop/mobile crowded scenes.
8. Run the complete asset, visual, browser, combat, performance, mobile, release, security, and exact-index gates.

After the first enemy-family wave, continue animation tells/hit reactions, authored-world setpieces, movement/combat feedback, weapon DPS/TTK, XP/skill-tree balance, UI/menu polish, mobile controls/UI, and sound in separate measured cycles.

## Pipeline traps

- Do not change the frozen Cycle 033 hurtbox profile as part of an art-only enemy wave.
- Keep boss scale/hurtbox authority separate from ordinary enemies.
- Generated model output is not approved until topology, rig, identity, provenance, decoded frames, runtime budget, and visual evidence pass.
- External AI-to-3D services remain approval-gated; do not upload proprietary assets or consume credits.
- Wait for all generators to stop before auditing Git.
- Restore command-generated security/CDN report churn before staging.
- Use exactly `git diff --cached --binary | sha256sum` for an index digest.
- Any staged edit invalidates prior exact-index verdicts.
- Stop local listeners before committing.
- Do not push or deploy without explicit authorization for that release.
- LitVM transactions and contract deployment remain separately HALT-gated.
