# Level 1 build ledger (branch `fable/hmh-gameplay`)

The running record the design package asks every slice to keep (section 1.3, "Budgets", and 9.1): the initial-JS delta, determinism changes, and the requests this branch leaves for the parent. Package: `LEVEL-1-DESIGN-PACKAGE-20260925.md`. Run summary contract: `HMH-RUN-SUMMARY-V7-CONTRACT.md`.

## Initial-JS budget

The cap is 1,048,576 B for the HMH child's entry + Pixi vendor + every chunk `game.js` imports statically (`scripts/hmh-reboot-bundle-budget.mjs`, printed by `npm run build` as "HMH initial JS + shared"). Dynamic `import()` chunks do not count. The running total must stay at or below the cap after every slice.

| Slice | Initial JS + shared (B) | Delta (B) | Headroom (B) | Notes |
|---|---|---|---|---|
| Base: `f9d6daa1` (1.8.1 + verifier v7) | 1,046,761 | – | 1,815 | |
| 1. Foundations: bundle offsets | 1,008,196 | −38,565 | 40,380 | Level-up panel, card text, boss, world-design objectives, world-design life, pacing, native world assets and the briefing become awaited dynamic imports |
| 1. Foundations: offer inside its tick, projection observer | 1,008,613 | +417 | 39,963 | |
| 1. Foundations: `HMH_WEAPON_ORDER` in the simulation, evolution tag refactor | 1,009,713 | +1,100 | 38,863 | `HMH_CHILD_EVOLUTIONS`, additive tags, armour flags |

### What the offsets moved (slice 1)

`main.mjs` starts one loader (`loadLazyRuntimeModules`) at the top of `boot()` and awaits it right after `app.init()`, before anything that calls a lazily bound function and long before the bridge or the standalone session can start a run. The chunks download while the renderer initialises. The simulation calls only resident code, so it stays synchronous and deterministic.

| Module | Kind | Why it may be lazy |
|---|---|---|
| `liquidator-boss.mjs` | boss simulation | resident before any session starts |
| `creature-presentation.mjs`, `liquidator-telegraph-renderer.mjs` | projection | render only |
| `world-design-interactions.mjs` | objective simulation (machinery, gates) | resident before any session starts |
| `world-design-pacing.mjs` | simulation | resident before any session starts |
| `world-design-life.mjs` (with `cover-break-presentation.mjs`) | projection | render only |
| `world-design-native-assets.mjs` | asset loader | presentation |
| `level-briefing.mjs` | briefing text | presentation |
| `upgrade-panel.mjs` (new; with `upgrade-card-presentation.mjs`) | level-up panel, moved out of `cockpit-ui.mjs` | UI |
| `progression-content.mjs` (new) | upgrade card text, moved out of `run-progression.mjs` | UI text; the simulation's choices carry ids and numbers only |

`tests/hmh-reboot-bundle-offsets.test.mjs` pins the static graph (esbuild, dynamic imports external), the single loader, the await order, and the text split.

## Determinism

Same-seed runs must stay identical. Gameplay slices may change results against 1.8.1; each such change is listed here.

| Slice | Change against 1.8.1 |
|---|---|
| 1. Bundle offsets | none (loading only) |
| 1. Offer timing | A level-up offer (earned, or the progression pilot's forced level) opens at the end of the tick whose XP produced it and stops that frame's catch-up. In 1.8.1 it opened after the frame, so up to three more ticks could run between the level and the panel, and how many depended on the frame partition. The offer tick is now partition-independent. |
| 1. Projection observer | none (new hook, no consumer yet) |
| 1. Weapon order and evolutions | none. `HMH_WEAPON_ORDER` is the same list, now derived from the run-summary weapon catalogue in `weapon-system.mjs`. No evolution is reachable before the Genesis Seal slice, so the additive tags and the Settler Rail armour flag change nothing yet. Deep Proof's 0.6 boss armour penetration now keys on any `boss-` target; the Liquidator (`boss-liquidator`) is the only one. |

`tests/hmh-reboot-foundations-determinism.test.mjs` is the same-seed check for this slice: a headless run of the real kernel, main.mjs's offer code, the weapon loadout, run progression and the run-summary accumulator gives one evidence digest for two runs of a seed, for render partitions 1 to 4 and two seeded mixed partitions, and with a (faulting) projection observer attached.

## Requests for the parent (outside this branch's scope)

| From slice | Request |
|---|---|
| 1 | Fence or retire the legacy parent evolution system that reuses the child's evolution ids with other meanings: `apps/portal/src/arcade-core.mjs` (weapon evolutions), `apps/portal/src/hmh-upgrade-runtime.mjs` (`evolutionScoreMultiplier`, used by `hmh-long-run-simulator.mjs`) and the legacy `apps/portal/main.js` runtime. The child now reads only `HMH_CHILD_EVOLUTIONS`; `HMH_WEAPON_EVOLUTIONS` stays byte-identical for them. |
| 1 | `apps/portal/src/hmh-run-recap.mjs` says its upgrade titles are copied from `RUN_UPGRADE_CATALOG`; they now live in `progression-content.mjs` (`RUN_UPGRADE_CONTENT`). The pin in `tests/hmh-run-recap.test.mjs` already reads the new module; only the comment is stale. |
