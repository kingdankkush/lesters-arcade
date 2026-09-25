# Slice brief: polish-2 (post-launch performance and copy polish)

**Worktree:** `C:/Users/just_/lesters-arcade-wt/polish-2`, branch `fable/pd-polish-2`. Production is live (1.8.1 after this brief is written; flags true).
**Read first:** the perf-lazy-hosted and live-ui-audit hand-offs (their final commit messages), `docs/qa/live-ui-audit-20260924.json`, contract §11.

## Goals and acceptance criteria

1. **ethers off the first paint.** `apps/portal/src/game-manifest.mjs` statically imports `id` (keccak256) from the vendored ethers, which puts the 392,452 B `vendor/ethers.min.js` chunk into the portal's initial JS and the Chikun child's. Remove it from first paint without changing any hash value:
   - either a small pure keccak-256 (Keccak, not SHA3-256 padding) used only for `manifestChecksum` / `manifestRegistryAnchor`, proven byte-identical to `ethers.id` / `ethers.keccak256` on a broad fixed corpus (empty string, ASCII, UTF-8 multibyte, 135/136/137-byte boundaries, long inputs) in tests;
   - or deferring those computations behind `await import()` where every caller already runs async.
   Report `node build.mjs --metafile` before/after for portal first-paint JS, `dist/main.js`, the Chikun child entry and shared chunks; the HMH child initial JS + shared (1,046,713 B) and the STACKED entry must not grow. Every existing manifest/registry test keeps passing unchanged.
2. **Signed-out mode copy.** The HMH and Chikun mode lines tell signed-out visitors "Your Lester's Arcade session is active" and "endless guest practice" (live-ui-audit follow-up). Make the signed-out, signed-in and preview variants truthful; update `tests/portal-trust-copy.test.mjs` and any other pins in the same commit.
3. **Scores banner labels.** Per-game cabinet banners on the hosted Scores page read "Verified · Weekly" for boards not fetched yet next to "No scores yet · weekly" for the one on screen. Make them consistent (either neutral until fetched, or prefetch the other two boards with the call-count pins in `tests/hosted-leaderboard.test.mjs` updated deliberately).
4. **Profile totals labels.** The hosted profile's "Verified totals" sums per-run bests ("Combo total", "Levels"). Show max-style values and labels ("Best combo", "Highest level") where a sum is misleading, sums only where they are true totals (runs, kills, lines).
5. Gate: `npm test`, `npm run check`, `npm run build`, `npm run test:release` (exactly 51), curated inventory regenerated if new src modules are added; browser check on your port with the committed live flags and a stubbed `/api`.
