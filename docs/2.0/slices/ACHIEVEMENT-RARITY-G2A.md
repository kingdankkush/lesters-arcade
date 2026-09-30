# G2a: public achievement rarity snapshot

The read-only service is implemented and locally checked. It is not deployed, and profile display, new achievements, trophies, reward migration and badge art remain open.

`GET /api/achievements/stats?game=chikun` accepts the existing canonical cabinet aliases. It returns each currently available achievement's distinct eligible unlock-wallet count and the game's distinct verified Ranked-player count. The denominator covers all verified seasons and queue statuses: the existing verification queue inserts the verified row and its unlocks atomically, before score publication. A publication delay does not revoke verification. Both counts exclude board-excluded wallets and chain-mismatched runs. The numerator also requires matching earning-session ID, wallet and game. Private wallet/session data is never returned.

Fewer than twenty eligible players yields the count and `Early`, without a percentage. At twenty or more, exact unrounded thresholds are Common≥50%, Uncommon≥20%, Rare≥5%, Epic≥1%, Legendary<1%. The server takes both cohorts in one SQL snapshot. Successes cache publicly for five minutes with five minutes of stale revalidation; malformed inputs and failures use no-store. Invalid aggregates fail instead of pretending the population is zero.

## Checked evidence

- Genuine eight-case missing-feature RED; then eight pure cases pass in an exact two-file copy with empty PATH, no .git and no node_modules. Six absent SQL/API cases retain their RED outcome before implementation.
- Fourteen actual classifier, in-memory PostgreSQL query and production HTTP-adapter tests pass. Six scoped source parses pass. Independent source review passes.
- The review prompted a sharper invalid earning-session case: the same eligible wallet earns a different game's run. The expanded three-query suite passes; unchanged classifier/API source and their prior GREEN evidence are reused.
- Chrome 154 enters the actual local Guest portal and fetches the real adapter through HTTP. Three cabinet snapshots, rejected wallet query, conflicting game query and rejected POST all pass. The fixture has synthetic records only. No production index, keys, transactions, score publication or physical phone is involved.
- Actual Chrome exits with code zero; browser server, HTTP server, database and children close. Matching owned markers release. Before/after source and protected authority hashes agree.

The new server files and tests are registered with the syntax check, and the API has the standard ten-second function budget. No game rendering or game bundle source changed in this slice; no new build or full release gate is claimed. Future release certification must include this endpoint. No game/site version changed.

Exact raw evidence, original failed outcomes, runners and source pins are archived under `../receipts/achievement-rarity/receipt.json`. The archive stores compressed original bytes and separately verifies their original and stored hashes.
