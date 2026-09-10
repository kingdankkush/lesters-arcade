# G-7 burn provenance source-correction evidence

- Date: 2026-09-08
- Branch: `hermes/hmh-textured-rollout`
- Entry HEAD: `9ce7372021a1b14a5b6910bcd0fa1d7d328d8bef`
Status: owned source seams corrected; parent runtime integration and candidate certification remain open.

## Authority traced

- Current source before this pass matched the Burner implementation in the read-only Cycle 079 encounter-pacing worktree: `bear-market-burner.mjs` SHA-256 `9120d62fe6a8b2f2643538f289d0d095d6ffed4a50b524251c2e44039e39ea57`.
- The read-only live-integration worktree carried the rejected provenance attempt: `bear-market-burner.mjs` SHA-256 `a300d6fe3676df3d3a4adeb3675c2c3022b8f934c90df0ad47d7304e2d9a386e`.
- Both withheld worktrees carried the same `combat-events.mjs` candidate, SHA-256 `57e3710746a008f7f8e490d691c275b4aa1d01955731bc04e07a7ddb9b2249a5`.
- The retained Cycle 079 round-two review rejected that attempt because `spreadBearMarketBurnerOnDefeat` admitted a neutral nearby actor and `refreshBurn` let later automatic contact replace manual-origin provenance.
- No Cycle 079 cache marker, corpse presentation, audio reuse, encounter pacing, balance, art, generated output, or unrelated source was copied.

## Corrected contracts

`bear-market-burner.mjs` now stores one boolean `provokesAmbient` on each burn. A new automatic burn starts `false`; manual contact upgrades it to `true`; no later automatic refresh can return it to `false`. Automatic burn ticks are emitted only while their target is in the caller's bounded current-eligibility set. Automatic defeat spread applies that same eligibility gate before sorting, capping, or creating any target burn state, so a neutral actor is neither returned nor inserted.

`combat-events.mjs` now validates optional hit provenance and carries it to `combat:damage`. An omitted field retains the pre-provenance manual behavior (`true`); explicit automatic origin remains `false`.

No Burner configuration or timing value changed. The existing fuel, pulse, duration, contact, active-burn, spread, scorch, and hazard caps are untouched.

## Behavioral reproduction and verification

All commands used Node `C:/Users/just_/AppData/Local/npm-cache/_npx/387698761821791d/node_modules/node/bin/node.exe` with its parent and the approved Python parent prepended to `PATH`; `NODE_TEST_CONTEXT` was removed before every Node test command.

1. Initial focused RED: `node --test tests/hmh-reboot-bear-market-burner.test.mjs` — 13 tests, 10 passed, 3 failed.
2. Sharpened focused RED: the same command — 13 tests, 10 passed, 3 failed. The defeat-spread counterexample returned `['current-hostile', 'neutral-bystander']` instead of `['current-hostile']`; the other two failures observed missing burn and damage provenance.
3. First focused GREEN: the same command — 13 tests, 13 passed.
4. Final focused GREEN after adding the partition regression: the same command — 14 tests, 14 passed.
5. Focused dependency regression across Burner runtime/summary, weapon/combat resolution, deterministic hashes, power-up lifecycle, and both live-authority Liquidator benchmarks — 61 tests, 61 passed.
6. Direct `node --check` on both changed source files and the changed test — 3 files, 3 passed.
7. Read-only canonical swarm-report contract regression, `node --test tests/hmh-reboot-swarm-benchmark.test.mjs` — 6 tests, 6 passed.
8. Final focused GREEN after routing partition damage through live combat seed 1337 — 14 tests, 14 passed.
9. Final direct syntax pass — 3 files, 3 passed.

The new G-7 test advances the real `stepBearMarketBurner` fixed-tick authority for the same 90 ticks under render partitions of 1, 2, and 3 simulation steps (60/30/20 Hz), routes its damage ticks through the live `resolveCombatHits` authority at session seed 1337, and compares complete events, combat resolution, and final snapshot. All three are equal. No alternate simulation engine was added.

## Existing canonical benchmark seams

- Weapon plus swarm: `npm run bench:hmh:weapons` invokes `scripts/hmh-reboot-weapon-benchmark.mjs`, which composes the live weapon/projectile modules and writes `docs/qa/hmh-weapon-benchmark.json`. The current checked report is pipeline `hmh-weapon-benchmark-v3`, seed `1213024323`, 24 static rows, 48 moving rows, and 16 swarm rows at pack sizes 4 and 8; SHA-256 `1a85dbfda41b1ad3587aac3dd6c35627cb036503555cab7c16873d28dbde0a3a`.
- Boss: `apps/hmh-reboot/src/critical-liquidator-benchmark.mjs` is the read-only certification seam that composes canonical progression, `stepWeaponLoadout`, `resolveCombatHits`, Liquidator role/punish logic, and boss damage authority. `tests/hmh-reboot-critical-liquidator-benchmark.test.mjs` proves same-seed 60/30/20 equality. It ran green inside the 61-test regression.

The writer-backed weapon/swarm command was deliberately not run because canonical outputs are parent-owned in this lane. Its existing JSON contract test was run read-only. The parent must regenerate and review the canonical report after runtime integration.

## Required parent integration

The current branch's `weapon-system.mjs` and `main.mjs` do not yet supply or consume the new provenance contract. To make this source correction reachable, the parent integration must:

1. Add bounded `channelProvokesAmbient` and `currentEligibleTargetIds` inputs to `stepWeaponLoadout`; forward both to `stepBearMarketBurner`; copy `pulse.provokesAmbient` onto each `weapon:flame-pulse` hit.
2. Derive those inputs from the authoritative current hostility/automatic-target set, not render state. Manual aim supplies `true`; automatic aim supplies `false` plus the current eligible IDs.
3. Copy flame-hit and burn-tick provenance onto combat hit intents. For automatic burn ticks, resolve the target only if it remains in the authoritative eligible set.
4. Pass the same current eligible IDs into `spreadBearMarketBurnerOnDefeat`. Do not pre-create a burn for a neutral bystander and attempt to suppress only its later damage.
5. Use `combat:damage.provokesAmbient` when applying the parent-owned ambient provocation transition. Preserve the existing nuke/manual behavior explicitly.

This requires parent-owned runtime edits and focused runtime/browser coverage; this worker did not edit those files.

## Invalidation and remaining gates

This is a simulation-source change and therefore creates a new uncertified candidate. Required parent gates include the runtime plumbing above, its RED/GREEN integration tests, regenerated weapon/swarm benchmark evidence, focused and full release suites, build and bundle accounting, browser gameplay proof, and fresh deployment certification if promotion is later approved. No build, browser, generator, canonical-output writer, install, upload, deployment, or chain action ran in this lane. `SETTLEMENT_LIVE=false`, fixed 60 Hz/max-four catch-up, bridge `hmh-bridge/v1`/65,536-byte cap, parent authority, current cache markers, native masters, and generated/canonical art remain untouched by this lane.
