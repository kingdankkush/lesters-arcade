# Level 1 build ledger (branch `fable/hmh-gameplay`)

The running record the design package asks every slice to keep (section 1.3, "Budgets", and 9.1): the initial-JS delta, determinism changes, and the requests this branch leaves for the parent. Package: `LEVEL-1-DESIGN-PACKAGE-20260925.md`. Run summary contract: `HMH-RUN-SUMMARY-V7-CONTRACT.md`.

## Initial-JS budget

The cap is 1,048,576 B for the HMH child's entry + Pixi vendor + every chunk `game.js` imports statically (`scripts/hmh-reboot-bundle-budget.mjs`, printed by `npm run build` as "HMH initial JS + shared"). Dynamic `import()` chunks do not count. The running total must stay at or below the cap after every slice.

| Slice | Initial JS + shared (B) | Delta (B) | Headroom (B) | Notes |
|---|---|---|---|---|
| Base: `f9d6daa1` (1.8.1 + verifier v7) | 1,046,761 | – | 1,815 | |
| 1. Foundations: bundle offsets | 1,008,196 | −38,565 | 40,380 | Level-up panel, card text, boss, world-design objectives, world-design life, pacing, native world assets and the briefing become awaited dynamic imports |

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
