# HMH AAA Continuous Improvement Cycle 051

Date: `2026-08-16`
Status: `LOCAL SOURCE VERIFIED · PRE-EXISTING VISUAL BASELINE DRIFT OPEN · PREVIEW/PRODUCTION UNCHANGED`
Branch: `reboot/hmh-aaa-continuous`
Baseline: `576b6388` (Cycle 050 documentation closeout)

## Scope: truthful 128-body endurance pressure evidence

1. **One read-only endurance seam** — `runEnemyEnduranceSoak(...)` drives the existing fixed-tick enemy population, collision/traversal safety, attack-token resolver, Auto Miner weapon authority, projectile flight resolver, and combat-effect lifetime compaction. It does not add gameplay AI, a second combat engine, or runtime simulation state.
2. **Non-vacuous 100+ body pressure** — the certified fixture keeps `128` active enemies for `360` fixed ticks across two continuous `180`-tick windows. It records body/threat occupancy, all four attack-token families, active projectiles, retained effects, collision contacts, attack events, pool insertions/drops, and per-cycle peaks.
3. **Independent caps preserved** — the fixture uses the endurance director's `192` body, `640` threat, `220` projectile-budget, `320` effect-budget, and `6/5/4/2` family-token contract while comparing active presentation pools against the unchanged runtime caps of `128` projectiles and `64` combat effects. Runtime projectile/effect limits and the 12-tick effect lifetime now have one immutable source in `runtime-performance.mjs`; browser behavior is unchanged.
4. **Determinism and low-FPS safety** — same-seed reports are byte-for-byte equal; seed `1338` diverges from seed `1337`; one-step and four-catch-up frame partitions are equal. The blocker fixture performs every canonical safety step, produces real blocker contacts, and fails on any per-step teleport beyond movement plus bounded separation authority.
5. **Cache invalidation** — child entry bytes changed by `+103`, so the local service-worker marker advances from `v18-hmh-heavy-chokepoints` to `v19-hmh-endurance-pressure`. No deployment consumed that marker.

Replay note: no gameplay authority, tuning, RNG order, actor state, or save/bridge schema changed. This is a benchmark and shared-constant-source slice.

## TDD evidence

RED was observed before implementation:

- `tests/hmh-reboot-enemy-endurance-soak.test.mjs` failed because `scripts/hmh-reboot-enemy-endurance-soak.mjs` did not exist;
- the runtime projectile/effect caps were private literals in `main.mjs`, so benchmark evidence had no shared immutable source;
- the existing enemy benchmark had no attack-token, projectile-pressure, effect-pressure, recurring-cycle, seed-divergence, or low-FPS partition fields.

GREEN coverage now includes:

- exact `128`-body occupancy over `46,080` canonical safety steps;
- body/threat maxima within independent caps;
- all melee/ranged/area/support token families occupied non-vacuously;
- real projectile/effect peaks within unchanged runtime pools;
- two recurring windows with attack, projectile, and effect activity;
- same-seed equality, different-seed divergence, one-versus-four fixed-step partition equality;
- blocker contacts, no teleport, and fail-closed malformed seed/body/cycle/catch-up inputs.

## Verified local evidence

- Focused endurance + performance suites: `10 / 10` PASS.
- Post-build shell suite: `12 / 12` PASS.
- Syntax: `341 JavaScript modules + 49 Python scripts` PASS.
- Release retirement ledger: `2,199 evaluated = 2,148 passed + 51 exact expected legacy failures`; unexpected failures `0`.
- Enemy benchmark: PASS; existing broadphase reduction remained `90.45%`. Endurance report for seed `1337`:
  - bodies `128 / 192`, threat `496 / 640`;
  - attack tokens `17 / 17`, including family peaks `6 / 5 / 4 / 2`;
  - projectiles `8 / 128`; effects `12 / 64`;
  - `46,080` canonical safety steps, `4,475` blocker contacts, `148` attack events;
  - `46` projectile spawns and `148` effect insertions, with `0` projectile drops, `0` effect drops, and `0` teleport violations;
  - cycle events `56` then `92`; canonical digest `2e38a09a`; different-seed digest `2de9efbe`.
- Thirty-minute deterministic long-run certification: PASS.
- Build: PASS; HMH entry `384,919` bytes, exactly `103` bytes over baseline HEAD; Pixi vendor remained `575,891` bytes; aggregate initial HMH JavaScript `960,810 / 1,048,576` bytes; headroom `87,766` bytes.
- Portal interaction smoke and contract structure gate: PASS.
- Local Chrome enemy-detail smoke: desktop + portrait mobile PASS; six production archetypes, one canvas, no overflow, zero reported runtime errors.
- Five-profile browser certification: desktop, ultrawide, tablet landscape, portrait mobile, and landscape mobile PASS; every anchor pair had `0` changed pixels and touch/control geometry remained contained.
- Browser performance: desktop/mobile p95 `8.2 / 8.1 ms`; retained-heap deltas `-97,631 / -4,384,170` bytes; zero steady-state long tasks and zero runtime errors. Boot-only long tasks remained separately reported.
- Four-scenario local network/console audit: PASS; `213` total responses, `0` HTTP errors, request failures, console errors, or page errors.

A combined Node invocation of the load-speed and shell files failed once because the load-speed suite rebuilds and atomically replaces `dist` while the shell suite stats the child bundle. This is the known test-process race, not a candidate failure: the project build and the shell suite passed serially.

Two attempted commands from stale handoff wording (`npm run design:hmh:long-run` and `npm run fuzz:hmh:enemies`) did not exist. The actual current command `npm run design:long-run` passed. No enemy fuzz script exists in this checkout; focused property coverage remains in the test suite.

## Open certification blocker

`npm run visual:reboot` consistently reports two baseline-signature failures that this benchmark-only slice did not create:

- `frontier-relay-mobile`: mean delta `1.708`, max-cell delta `42`, changed cells `79`;
- `combat-engaged-desktop`: mean delta `0.571`, max-cell delta `22`, changed cells `34`.

The exact same two signatures and metrics reproduced after building and running the visual gate from an isolated clean worktree at baseline HEAD `576b6388`. Therefore they are inherited baseline drift, not a Cycle 051 visual regression. Baselines were not weakened or accepted without review. This prevents a full visual PASS and remains an explicit next-run blocker.

Independent hosted review was unavailable because Hermes delegation could not authenticate to the configured Nous provider. No timeout, partial output, or unavailable reviewer was counted as PASS. Exact-index review and local commit remain pending.

## Boundaries

- Production, Preview, aliases, rollback, and `main` were not changed.
- No branch was pushed and no deployment or promotion occurred.
- No wallet, key, contract, settlement, transaction, RPC write, paid/external AI service, asset upload, or LitVM action occurred.
- Parent authority and `SETTLEMENT_LIVE=false` remain unchanged.
- No generated art or approved authored asset was replaced.

## Recommended next bounded slice

Finish Wave 10 evidence closure with a serial desktop/mobile **100+ active-body browser endurance** route that reads the same token/projectile/effect pressure fields over wall-clock time, captures frame/heap/network errors, and does not grant gameplay authority to evidence code. In parallel, diagnose the two inherited visual signatures against the last accepted baseline commit; do not accept new baselines until the player-visible difference is reviewed. After those gates, freeze and obtain an exact-index review for Cycle 051 before committing.
