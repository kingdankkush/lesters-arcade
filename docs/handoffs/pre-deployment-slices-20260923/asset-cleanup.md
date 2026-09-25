# Slice brief: asset-cleanup (owner decision 2026-09-25: "clean up and get rid of unused assets and code")

**Worktree:** `C:/Users/just_/lesters-arcade-wt/asset-cleanup`, branch `fable/pd-asset-cleanup`. Production is live (1.8.1); the base also contains the merged Canvas-loop cleanup (`ae635081`), which made more assets dead than the audit saw.
**Read first:** `docs/cleanup/unused-assets-audit-20260925.md` and `.json` (read-only audit by the HMH roadmap session at `60ea173a`, with two adversarial refuters per candidate), `AGENTS.md` "Repo asset hygiene", `docs/hmh-reboot/LEGACY-TEST-RETIREMENT.json`.

## Scope
1. Remove **List 1** (safe to remove) **except `apps/portal/assets/generated/chikun-ground-audio-v1`**, which the HMH roadmap session keeps for the Chikun sound pass. Apply each row's same-commit caveat (retire or rewrite unlinked docs, keep the README-linked receipts, never touch cache tokens).
2. Remove the **List 2 gate-safe subsets** (no code edit), including L2-01, the retired Tripo selector chain (150 MB, LFS pointers: delete the tracked files only, never rewrite history).
3. Remove the **partial no-edit** files inside kept folders.
4. **List 2 units that need a code/test edit:** re-audit each against this base (the Canvas cleanup may have removed their last references). Remove a unit only when every remaining reference is dead code, a doc, or a test/verify script whose only job is to check those files, and retire that code or test in the same commit.

## Hard rules
- **Re-verify every deletion yourself** before removing it: grep for the path, the basenames and template-built paths across apps/, scripts/, tests/, sdk/, docs/testing, build.mjs, vercel.json, apps/portal/sw.js, and the curated/verify inventories. Don't trust `docs/cleanup/repo-cdn-cleanup-gate.json`; the audit found its map incomplete.
- **Release-gate ledger:** `test:release` must still report exactly the 51 ledgered failures. A deletion must not create a new failure. It must also not make a ledgered failure pass or disappear, because the gate reports that as "missing ledger failure". Never edit the ledger to make that work. If a unit's removal would change a ledgered test, leave the unit and list it in the report.
- `npm run assets:verify`, `npm run check`, `npm run build` (all byte budgets), the full `npm test`, and a browser pass that loads the portal home, each game page and a game start (HMH, Chikun and STACKED Free) against a local static server serving `apps/portal`, with no 404s in the console or network.
- Commit per unit, with the bytes removed in each message. Write `docs/cleanup/asset-cleanup-20260925.json`: removed paths, bytes, files, the evidence per unit, and the units left in place with the reason.
