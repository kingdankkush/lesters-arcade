# STACKED Cycle S-11 — build and shell groundwork

Date: 2026-09-06 PDT  
Branch/base: `feature/stacked-renderer` / `a9100b37a58ade116fca420e57565c59bad38922`  
Scope: build externalization/output, dedicated Pixi vendor, child shell, CSP/cache/service worker, Node gates. No gameplay, portal registration, browser gates, deployment or commit.

## Outcome

S-11 groundwork now emits `dist/stacked/game.js` and the dedicated versioned `dist/stacked/stacked-pixi-v1.js`. Stacked imports are externalized to that file while HMH continues to use its unchanged `dist/chunks/hmh-pixi.js`. The child route has a strict iframeable CSP, revalidating dist cache policy, an atomic catch-all exclusion, and literal service-worker precache entries.

The shell is deliberately labelled as renderer groundwork and not playable. It does not import the portal registry, wallet, ethers, arcade-core, gameplay simulation, or settlement code.

## S-12 dependency status

S-12 now consumes this groundwork with a genuine bundled Pixi board renderer. The null budget state
described below is retained as S-11 history; S-12 measured and froze the first renderer caps in
`CYCLE-012.md`. A subsequent S-12 correction supplied serialized desktop/mobile strict-CSP runtime
proof; the S-11 Node-only evidence below remains the historical boundary of this groundwork cycle.
The S-12 geometry correction consumes exact S-02 dependency snapshots from `2300428b`: `stacked-sim.mjs`
and `seeded-rng.mjs`. Those two files are read-only imported dependencies, are not Renderer-owned,
and must be excluded from any Renderer patch/export because the newer canonical main copies win.

## RED / GREEN evidence

RED command:

`node --test tests/stacked-shell.test.mjs tests/stacked-bundle-budget.test.mjs`

RED result: **0 passed / 5 failed**. Failures were the missing budget export, missing shell, missing CSP/cache/precache rules, and missing build entry/vendor routing.

GREEN command:

`node --test tests/stacked-shell.test.mjs tests/stacked-bundle-budget.test.mjs`

GREEN result: **6 passed / 0 failed / 0 skipped**.

`npm.cmd run check`: **PASS**, 409 JS modules and 56 Python scripts. The four new `.mjs` source/test files are registered in `NODE_CHECK_FILES`.

## Build readback and honest blockers

`npm.cmd run build` emitted all artifacts, printed the following exact measurements, and then intentionally exited 1:

| Artifact / graph | Bytes |
| --- | ---: |
| HMH Pixi vendor | 463,115 |
| HMH static shared chunks | 66,453 |
| HMH entry + vendor | 927,616 |
| HMH true initial graph | 994,069 / 1,050,000 |
| STACKED shell entry | 1,283 |
| STACKED static shared chunks | 0 |
| STACKED dedicated Pixi vendor | 484,588 |
| STACKED shell initial graph | 485,871 |

The expected terminal error is `STACKED_ENTRY_JS_CAP has no measured baseline yet`. `STACKED_ENTRY_JS_CAP` and `STACKED_INITIAL_JS_CAP` remain `null`: this shell is not the meaningful renderer bundle required to set `measured × 1.08` caps. The build hook therefore fails closed rather than guessing a permissive cap.

`apps/stacked/src/verify-worker.mjs` is not present because its deterministic simulation/evidence dependency belongs to S-04 and is not available on this branch. No fake worker or successful worker output was added.

All four literal Stacked precache targets existed after the emitted build. Browser/CSP runtime
validation and visual inspection were **not run during S-11**, per worker instructions. The later
S-12 correction imported `pixi.js/unsafe-eval` only inside STACKED's dedicated vendor; despite the
subpath name, that module supplies Pixi's no-eval implementations and the route CSP remains strict
with no `unsafe-eval` exception. See `CYCLE-012.md` for the RED/GREEN browser evidence and the
remaining visual/geometry blockers.
The later S-12 geometry correction closes those renderer blockers with actual compositor-pixel proof;
it does not retroactively turn this S-11 shell work into browser evidence.

## Verification commands

- `node --test tests/stacked-shell.test.mjs tests/stacked-bundle-budget.test.mjs`
- `npm.cmd run check`
- `npm.cmd run build` — expected fail closed until meaningful renderer caps are frozen
- `npm.cmd test`
- `npm.cmd run design:security-audit`
- `npm.cmd run test:release`
