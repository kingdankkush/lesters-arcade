# HMH Reboot Autonomous Continuation Prompt

Copy and paste the prompt below whenever you want Hermes to continue improving the reboot.

```text
Continue the Hard Money Heroes top-down 2.5D reboot autonomously from the first incomplete item in the authoritative repository plan and active task list.

Before changing anything:
1. Inspect the actual repository, current branch, git status, HEAD, upstream reboot SHA, origin/main SHA, active plan, current tests, and relevant source. Do not trust stale summaries over current files and test output.
2. Confirm work is isolated to `reboot/hmh-topdown-2_5d` and that production/main remains unchanged.
3. Load and follow the relevant HMH, game-reboot, TDD, art, animation, level-design, audio, performance, security, and delivery skills.

Execution rules:
- Continue the first incomplete phase and keep working until it is implemented, exercised, independently reviewed, certified, committed, and pushed, or until a protected approval gate is reached.
- Use RED-GREEN-REFACTOR for deterministic gameplay, physics, collision, AI, progression, and integration behavior.
- Build working artifacts and run them. Do not stop at plans, stubs, mock output, or untested code.
- Reuse pure deterministic systems and existing authority boundaries instead of creating parallel systems.
- Keep simulation state authoritative at 60 Hz with at most four catch-up steps. Rendering, interpolation, camera smoothing, particles, and cosmetic animation must never write back into deterministic state.
- Preserve frozen IDs, persistence keys/schema, profiles, achievements, scoring semantics, analytics, ranked settlement, bridge protocol/security, and portal/Web3 authority.
- Keep PixiJS pinned exactly to 8.19.0.
- Treat visible geometry and collision as one authored contract. No invisible walls, fake elevation, tunneling, decorative bridges without traversal, or visible barriers without collision.
- Maintain independent movement/aim, desktop/mobile controls, accessibility/reduced-motion behavior, safe areas, touch lifecycle, and teardown.

Polish every phase, not only functionality:
- Artwork: cohesive silhouettes, palette, materials, scale, pivots, depth ordering, atlases, compression, and complete directional coverage.
- Animation: readable anticipation/action/recovery, locomotion continuity, hit reactions, attack timing, no frozen stills, and truthful gameplay timing.
- Physics: swept collision, depenetration, obstacle sliding, height bands, ramps, ledges, bridges, water, projectiles, knockback, and deterministic edge cases.
- Level design: authored routes, landmarks, loops, pacing, sightlines, chokepoints, encounter spaces, secrets, traversal readability, and deterministic layouts rather than random scatter.
- VFX/particles: impact readability, muzzle flashes, trails, explosions, environmental motion, layering, pooling, reduced-flash variants, and strict performance budgets.
- Sound: usable licensed/repo-owned assets, music and SFX controls, mix hierarchy, spatial cues, attack/impact feedback, mobile-safe playback, and no generated placeholders presented as final.
- UI/UX: readable HUD, touch/desktop responsiveness, liquid-glass visual language, clear menus, accessibility, and no clipped or overlapping states.
- Performance: target 60 FPS desktop, 30 FPS mobile, 100+ enemies where required, <=300 MB production payload, bounded memory, pooling, LOD, thermal safety, and fast loading.

Required certification before each verified commit:
1. Syntax/static checks and focused tests.
2. Deterministic repeat/replay checks.
3. Full suite comparison against the exact documented legacy-retirement ledger with zero unexpected failures.
4. Production build and bundle/file-budget checks.
5. Security audit and added-line credential/unsafe-pattern scan.
6. Desktop, mobile, standalone-child, and embedded-bridge browser smoke tests.
7. Visual review at desktop, mobile, and ultrawide sizes when presentation changed.
8. Performance/soak checks appropriate to the phase.
9. Independent read-only review of the exact current diff; fix blockers and rerun affected gates.
10. Confirm origin/main did not move, then make one verified commit, push only the reboot branch, and update the plan/task list.

Be proactive about defects and polish opportunities discovered during the phase. Fix in-scope issues and add regression tests rather than merely listing them. Do not reopen certified historical phases based on stale reviewer output unless current source and fresh tests reproduce the problem.

STOP and ask for explicit approval before any production replacement/deployment, paid asset generation, contract/economy/settlement change, scoring-semantic change, profile/achievement/persisted-ID migration, destructive action, or other protected gate. Never replace production v48 before the explicit content-complete approval phase.

At the end, report only verified results: what changed, exact test/build/browser/performance outcomes, review verdict, commit/push status, production SHA safety, and the next active phase.
```
