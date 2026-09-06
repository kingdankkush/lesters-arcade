# STACKED owner decisions

All gates are open. Only the owner may answer them.

| Gate | Status | Exact ask | Blocks |
| --- | --- | --- | --- |
| G-1 | OPEN | Confirm the player-facing name for the four-line clear. | Copy sheet, ship |
| G-2 | OPEN | Approve flipping the cabinet to `playable`. | Ship |
| G-3 | OPEN | Approve enabling Ranked leaderboard writes. | Ship |
| G-4 | OPEN | Confirm the level cap (30) and combo-bonus cap (20) ship. | Nothing (frozen), but a reversal after the scoring cycle rotates every seed |
| G-5 | OPEN | Choose the Pixi vendor chunk policy: grow HMH's shared chunk from 9 exports to 16, emit a renamed `arcade-pixi-v1.js` carrying all sixteen, or give STACKED its own vendor entry; also decide whether the HMH initial-JS cap splits into vendor and per-entry caps. | Build, renderer, zones (S-11, S-12, S-13) |
| G-6 | OPEN | Decide whether to add a second `'unsafe-eval'` CSP route for Pixi's runtime program generation. | Build |
| G-7 | OPEN | Set the Ranked pause policy and decide whether an over-limit suspended run submits or is discarded. | Lifecycle, integrity |
| G-8 | OPEN | Decide whether to fix achievement scoping now or declare it a known defect; fixing it changes shipped HMH and Chikun behaviour. | Verifier registry |
| G-9 | OPEN | Confirm the season identity `stacked-season-preview-1`. | Registration |
| G-10 | OPEN | Decide the Free Mode aids: undo rewind, starting-level range, and whether a device-local medal shelf satisfies “some achievements count in Free.” | Lifecycle, achievements |
| G-11 | OPEN | Decide whether the ghost piece is on in Ranked. | Lifecycle |
| G-12 | OPEN | Choose where cabinet settings live: shared parent panel or in-cabinet pause menu. | Settings |
| G-13 | OPEN | Decide whether the new browser gates join `vercel:build` or only `ship:gate`. | Gate build-out |
| G-14 | OPEN | Approve or reject committed dev autoplay (`stackPilot=1`), code that plays the game and the only way to reach a 40-minute run in CI. | Difficulty artifact, gates |
| G-15 | OPEN | Approve deployment promotion separately for each exact deployment ID. | Ship, any deploy |
| G-16 | OPEN | Choose the online-multiplayer backend, relay operator, recurring cost, new `connect-src` origin, and whether versus rating may live server-side. | All later versus work |
| G-17 | OPEN | Decide whether destructive `pruneCadenceLeaderboards` ships in the hygiene cycle or is split out. | Leaderboard hygiene |
| G-18 | OPEN | Decide zone art scope; the count of six is frozen and only zone 0's palette is specified numerically. | Zones, gates |
| G-19 | OPEN | Choose cross-device Ranked fairness: one board with an `inputDevice` column, one board with a filter, or separate boards. | Mobile, leaderboard |

These gates do not request paid entry, non-zero fees, settlement activation, contract deployment, or production promotion.
