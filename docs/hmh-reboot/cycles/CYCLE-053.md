# HMH AAA Continuous Improvement Cycle 053

Date: `2026-08-16`
Status: `LOCAL VISUAL BASELINE RECONCILED · TWO EXACT ZERO-DELTA PASSES · PRODUCTION/WEB3 UNCHANGED`
Branch: `reboot/hmh-aaa-continuous`
Starting HEAD: `20dca51f8d08bc799c1487b5bead4fbcd18335d6`
Baseline reconciliation commit: `b4a66b02`
Exact baseline patch SHA-256: `7cf865b02766ef8b36eed02f672dd1b09529ec040574c7ae37c15e0f9fdde132`

## Bounded slice

Resolve the two inherited release visual-signature failures before beginning new Wave 11 gameplay work. The slice had to identify the last accepted baseline authority, reproduce the change under one browser/build environment, explain the player-visible delta, preserve the visual thresholds, and finish with two exact zero-delta runs.

## RED and authority reconstruction

The current candidate reproduced the inherited RED state:

- `frontier-relay-mobile`: mean delta `1.708`, max-cell delta `42`, changed cells `79`;
- `combat-engaged-desktop`: mean delta `0.571`, max-cell delta `22`, changed cells `34`;
- the other ten scenes remained within the unchanged threshold.

Git history identifies `c4680a68` as the exact last commit that wrote the tracked visual baselines. No visual baseline file was changed after it.

A detached clean worktree used the same local Chrome/Playwright installation and rebuilt selected historical revisions before every capture. The relevant boundary was:

| Commit | Frontier desktop | Frontier mobile | Combat desktop | Verdict |
| --- | --- | --- | --- | --- |
| `428be2e4` | `0.002 / 1 / 0` | `0.005 / 1 / 0` | `0.252 / 22 / 10` | PASS |
| `cbab316e` | `0.314 / 22 / 18` | `1.793 / 42 / 77` | `0.571 / 22 / 34` | two inherited failures appear |
| `319547f5` | `0.314 / 22 / 18` | `1.708 / 42 / 79` | `0.571 / 22 / 34` | current stable signatures |
| `576b6388` | `0.340 / 22 / 21` at observed tick `91` | `1.708 / 42 / 79` | `0.571 / 22 / 34` | reproduces Cycle 051/052 blocker |
| `20dca51f` | `0.314 / 22 / 18` | `1.708 / 42 / 79` | `0.571 / 22 / 34` | same two failures |

Values are `meanDelta / maxDelta / changedCells`. The one-tick desktop observation at `576b6388` remained under threshold and does not explain either inherited failure.

## Player-visible explanation

The first failing revision is not renderer randomness or Cycle 051/052 drift. Commit `cbab316e` intentionally added canonical combo feedback and the visible cockpit combo chip. It is the first revision at which both signatures change. Commit `319547f5` later made the verified portrait HUD placement adjustment from `y=272` to `y=232`, producing the final mobile signature.

Pixel-localization between the last passing and first failing captures found:

- portrait mobile: significant (`>8`) changes were bounded to `x=8..385`, `y=132..425`, the upper cockpit/combat-status composition;
- combat desktop: significant changes were bounded to `x=366..1064`, `y=12..101`, the top cockpit/combat-status strip;
- no significant changed region extended into the lower world, terrain, actor-foot, depth-sort, or authored-prop field.

The tracked signatures were therefore stale relative to intentional, previously verified cockpit/HUD work. The baseline update is an acceptance of that explained composition, not a tolerance change.

## Reconciliation

`npm run visual:reboot:accept` refreshed all twelve signatures through the repository-owned acceptance path. Refreshing the complete scene set, rather than hand-editing only two arrays, establishes one current-candidate baseline authority and permits an exact zero-delta closure. No scene list, tick, viewport, grid, schema, tolerance, runtime source, or renderer code changed.

Two subsequent independent `npm run visual:reboot` executions each reported for all twelve scenes:

```text
meanDelta=0 · maxDelta=0 · changedCells=0 · errors=0
```

Both runs also retained non-vacuous reduced-motion evidence: `landmarkVisible=7`, `animatedSignals=0`.

## Verification

- `npm run check`: **PASS**, `342` JavaScript modules + `49` Python scripts.
- `npm run test:release`: **PASS**, `2,201` evaluated = `2,150` passed + `51` exact expected legacy failures; unexpected failures `0`.
- `npm run build`: **PASS**; HMH entry `379.0 KB`, Pixi vendor `562.4 KB`, combined initial HMH JavaScript `941.4 KB / 1.00 MB`, headroom `84.0 KB`.
- `npm run assets:verify`: **PASS**.
- `npm run contracts:check`: **PASS**.
- `npm run repo:health:strict`: **PASS**, `2,595` tracked files, SHIP budget passed.
- `npm run visual:reboot`: **PASS twice**, twelve scenes at exact zero delta on both runs.
- Read-only custom-domain probes: `/`, `/hmh-reboot/`, and `/sw.js` returned HTTP `200`; production service worker remained `lesters-arcade-v17-hmh-formation-pressure`.
- `apps/portal/src/settlement.mjs`: `SETTLEMENT_LIVE=false` remains unchanged.

## Exact-index review

The frozen staged baseline patch SHA-256 was:

```text
7cf865b02766ef8b36eed02f672dd1b09529ec040574c7ae37c15e0f9fdde132
```

Hosted Hermes delegation remained unavailable because the configured Nous provider has no access token. A first local offline review was rejected because it treated individual absolute signature-array values as tolerance metrics and falsely called already executed tests missing. A bounded correction review of the same frozen hash returned structured `PASS`, the exact hash, no findings, and no malformed JSON, schema/grid/dimension drift, or scope violation. The one-parent patch for commit `b4a66b02` matches the reviewed hash.

## Files changed

- the twelve JSON signatures under `docs/testing/VISUAL_BASELINES/hmh-reboot/`;
- this cycle ledger and the canonical continuation ledgers/handoff in a separate documentation closeout.

No screenshot, temporary worktree, browser profile, or local review artifact is tracked.

## Boundaries

- No gameplay, simulation, renderer, asset, portal, service-worker, contract, or settlement source changed.
- No tolerance, scene, viewport, target-tick, signature-grid, or expected-failure budget changed.
- Production, Preview, aliases, rollback, `main`, and remote branches were untouched.
- No push, deployment, promotion, publication, external asset upload, paid service, credential, wallet, contract, transaction, settlement, or LitVM write occurred.
- Human/zombie-only canon, fixed `60 Hz`, maximum four catch-up steps, parent authority, and all runtime caps remain unchanged.

## Next bounded slice

Begin the smallest Wave 11 Liquidator build-matrix seam: baseline versus high- and low-DPS builds using the existing boss phase, damage-window, add, and run-summary authorities. Record phase times, damage windows, add counts, per-phase damage, and defeat tick without rewriting boss AI or adding a second combat engine. Preserve ordinary weapon damage, the existing role/punish multipliers, and the fixed-tick authority.
