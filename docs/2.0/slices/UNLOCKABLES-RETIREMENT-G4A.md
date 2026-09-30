# G4a — preserve progress when replacing cosmetic selections

The explicit 2.0 retirement inventory contains the actual 25 legacy cosmetics:
eight HMH, ten Chikun and seven STACKED. Lester and Lilly are excluded. The
current catalog, unlock gates, store, routes and server behavior remain unchanged.

`planCosmeticRetirement` is an unimported pure preparation module. It returns a
detached preferences copy and an ordered list of exact cabinet/slot/ID removals.
Each removed slot falls back to the default look through the existing resolver.
The last removed slot leaves `cosmetics:{}` explicitly: the existing server writer
merges top-level JSON, so omitting that key would retain stale selections.

Selected heroes, earned history and unrelated/future preference fields are not
removed. The function accepts a JSON preferences object, not a whole profile; it
does not sanitize unknown fields or grant ownership. Invalid root containers
throw. Other malformed fields are preserved for the existing sanitizer to handle.
Repeated planning is idempotent, and neither inputs nor the current catalog change.

## Checked

Ten actual missing-module failures preceded implementation. Ten source checks and
the identical ten from an eight-file isolated copy passed with no Git, dependencies
or PATH. Independent review added a mixed-case regression to protect unrelated
empty/malformed game records when a real selection retires; final source review
is clear. Three owned children closed, were independently absent and released only
their exact shared markers. Raw output and harnesses are preserved in
[the compact receipt](../receipts/unlockables-retirement-g4a/receipt.json).

This slice changes no active runtime path or rendered page; no build/browser,
performance test, database migration or release gate was run for it. It does not
finish the reward system. Activation waits for the replacement catalog and art,
fresh-wallet/concurrent-selection merge behavior, storage migration integration,
Locker UI and their actual browser/replay checks. Do not apply this plan to stale
wallet data or retire the old catalog before replacements are ready.
