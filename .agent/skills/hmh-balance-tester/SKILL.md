---
name: hmh-balance-tester
description: Use when changing or certifying Hard Money Heroes weapons, enemies, bosses, drops, upgrades, pacing, difficulty, or run economy.
version: 1.0.0
license: MIT
---

# HMH Balance Tester

## Trigger
Use for numerical gameplay changes or pre-release balance certification.

## Workflow
1. State the target player experience and measurable invariant before changing values.
2. Trace the canonical balance definition and every runtime consumer. Avoid parallel hidden constants.
3. Add or update deterministic tests for damage, fire rate, reload, survivability, spawn pressure, drop rates, upgrade choices, boss phases, and extraction timing.
4. Run fixed-seed simulations across heroes, weapons, and difficulty bands. Report medians, tails, failure modes, and sample size.
5. Separate automated balance evidence from human feel approval. Never label a run fun, readable, or fair from simulation alone.
6. Test accessibility variants and mobile input constraints where they affect effective difficulty.
7. Document intentional changes and preserve replay determinism.

## Guardrails
- Do not tune solely to make a gate pass.
- Do not hide regressions by widening thresholds without design justification.
- Do not alter paid/ranked economics or contracts without explicit approval.

## Verification
- Run focused balance tests and `npm run design:playtest-sweep`.
- Run `npm run test`, `npm run check`, and `npm run build`.
- Complete a real full-run playtest on target hardware before final human sign-off.
