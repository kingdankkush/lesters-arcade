# HMH AAA Continuous Improvement Cycle 054

Date: `2026-08-17`
Status: `LOCAL HOTFIX MERGE · CHECK/BUILD/RELEASE PASS · NOT PUSHED · NOT PROMOTED`
Branch: `reboot/hmh-aaa-continuous`
Starting HEAD: `97d0c206cfaa83287aa57f1df0a46c83a43a8afd`
Merge commit: `afbff3048af12b72387d375c1cc3bf03d273a840`
Merged incoming: `5d4db8ee318f6a8d9f21b550ef5f18a290bfaac5` (`hotfix/hmh-mobile-character-start`)

## Bounded slice

Production was serving `5d4db8ee` (`lesters-arcade-v18-hmh-mobile-character-start`, deploy `dpl_Hm2bB5eEgnr6VvacT9xWU7SxVRJr`) while continuation sat on `97d0c206` with cycles 050–053. The hotfix is not an ancestor of the continuation line. Promoting 050–053 as they stood would have reverted the live mobile character-startup fix.

This cycle merges the production hotfix into continuation and re-checks. No promote. No push. No settlement.

## Merge

`git merge --no-ff 5d4db8ee` into `97d0c206`. `apps/hmh-reboot/src/main.mjs` auto-merged: early deferred child-bridge start plus `bridge.activate()` after nav-grid boot. Four both-edited files; three needed a cache-marker decision:

- `apps/portal/sw.js`
- `tests/hmh-load-speed.test.mjs`
- `tests/hmh-reboot-shell.test.mjs`

Cache marker advanced to `lesters-arcade-v21-hmh-character-start`. Production already used v18; local continuation already used v20.

## Verification at `afbff304`

| Gate | Result |
|---|---|
| `git merge-base --is-ancestor 5d4db8ee HEAD` | true |
| `npm run check` | PASS 342 JS + 49 Python |
| `npm run build` | PASS HMH initial JS 942.0 KB / 1.00 MB, 83.4 KB headroom |
| hotfix-related unit tests after build | PASS |
| `npm run test:release` | PASS 2,207 evaluated = 2,156 passed + 51 exact expected legacy failures |

Not re-run this cycle: `visual:reboot`, browser endurance soak, production/preview promote.

## Authority

`SETTLEMENT_LIVE=false`. Production remains `5d4db8ee` / v18 until an explicit owner promote of a certified `afbff304` (or later) candidate.
