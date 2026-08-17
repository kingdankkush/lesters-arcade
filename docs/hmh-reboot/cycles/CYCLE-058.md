# HMH AAA Continuous Improvement Cycle 058

Date: `2026-08-17`
Status: `LOCAL WAVE 11 MELEE/CROWD-CONTROL MATRIX · NOT PUSHED · NOT PROMOTED`
Branch: `reboot/hmh-aaa-continuous`
Based on: `9e8d27ae` (Cycle 057 docs cleanup)

## Bounded slice

Finish the remaining named Wave 11 Liquidator build-matrix profiles: melee-heavy and crowd-control. Same evidence seam as Cycle 055. No boss rewrite, no second combat engine, no `main.mjs` import.

## Profiles

| Build | Weapon | `damagePerTick` | Distance | Boss role | Add role |
|---|---|---|---|---|---|
| `melee-heavy` | `forked-standard` | 4 | 80 | `standard-close-punish` 1.15 | none |
| `crowd-control` | `lightning-ledger` | 2 | 200 | none | `ledger-add-clear` when `activeAddIds.length >= 2` |

Crowd-control does not invent add hit points. It records `addRoleContacts` when the existing Ledger add-clear check applies. Boss damage stays the low-DPS 2/tick bucket so the TTK class matches `low-dps`.

## Measured outcomes at seed `1337`

| Build | Defeated | Defeat tick | Remaining | Punish | Adds | Add-role contacts |
|---|---|---|---|---|---|---|
| `melee-heavy` | yes | 2,609 | 0 | 0 | 3 | 0 |
| `crowd-control` | no | — | 4,788 | 60 | 6 | 1,756 |

Melee dies 385 ticks earlier than baseline (2,994) from the 1.15 close-punish, one tick before the total-liquidation super resolve at 2,610, so it never touches the punish window. Crowd-control matches low-DPS boss health and starts Ledger add-clear at the first Bad Debt wave (tick 1,845).

## Verification

| Gate | Result |
|---|---|
| focused build-matrix tests | 9/9 PASS |
| `npm run check` | PASS 344 JS + 49 Python |
| `npm run test:release` | PASS 2,216 = 2,165 passed + 51 expected |

One-step equals four-catch-up for both new profiles. No browser smoke: this is evidence-only and not imported by `main.mjs`.
