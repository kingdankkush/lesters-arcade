# Slice brief: perf-lazy-hosted (post-launch optimisation)

**Worktree:** `C:/Users/just_/lesters-arcade-wt/perf-lazy-hosted`, branch `fable/pd-perf-lazy-hosted`. Production is live (1.8.0), flags true.
**Read first:** contract §7.8, §10.3 (historic ranges; re-grep), §11 rule 5; profile-boards and results-share briefs; `build.mjs` bundle report.

## Goal
The profile-boards slice put the hosted Scores and Profile views inside statically imported route modules, adding about 37 KB to the initial `dist/main.js`, and signin-entry added about 13 KB. Move rarely-first-painted UI (hosted Scores view, hosted Profile view, name-claim and avatar UI, results-screen helpers if statically reachable) behind dynamic `import()` so the portal's first paint ships less JS, with no behaviour change.

## Acceptance criteria
1. Measure before/after with `node build.mjs --metafile` and report the `dist/main.js` bytes and the new lazy chunk sizes; target at least 30 KB less initial `main.js`, with no increase in the HMH child initial JS (1,046,713 B at base) or the STACKED entry.
2. The Scores and Profile routes render exactly as before in both hosted (flags true, production) and preview states: a loading state while the chunk loads, then the same DOM (existing hosted-leaderboard / hosted-profile / official-*-route tests keep passing; add tests that the chunk is loaded by dynamic import and that a failed chunk load shows a retry message instead of a blank page).
3. Deep links `/profile/<wallet>` and `/scores` still hydrate on first load.
4. Browser check: serve `apps/portal` on your port with the committed (live) flags and a stubbed `/api` (use rehearsal's local http helpers or route interception) and confirm Scores and a profile render with a clean console.
5. Gate: `npm test`, `npm run check`, `npm run build`, `npm run test:release` (51), curated inventory regenerated if new src modules are added.
