# Slice brief: live-ui-audit (post-launch verification and polish)

**Worktree:** `C:/Users/just_/lesters-arcade-wt/live-ui-audit`, branch `fable/pd-live-ui-audit`. Production is live at https://lestersarcade.io (1.8.0, flags true).
**Read first:** `docs/qa/ranked-launch-release-20260924.json`, contract §7.3-§7.9, guide §3 (acceptance criteria).

## Goal
Audit the live player-facing Web3 UI on production with a real browser (Playwright, READ-ONLY: never sign, never send a transaction, never call a write endpoint) and fix every defect found in code.

## What to check on production (desktop 1440x1000 and phone 390x844)
- Home and game pages: Sign in button and wallet picker open (no wallet: install links / deep links), Ranked mode entry points, launch copy (0.102 zkLTC, no NFT wording, no hashtags), console clean.
- `/scores`: Weekly (default) / Monthly / All-time tabs, reset time, per-game banners, empty-state "Be the first on this week's board" with Play Ranked (the only real rows belong to an excluded test wallet), search input, no Daily/Yearly/House/Local Preview remnants.
- `/profile/0x8841ae6244dba71f620de450e71b0ef7e0cce824` (the test wallet; excluded from boards but its profile is public): verified bests per game, run counts, recent sessions with explorer tx links, achievements list (24 recorded) with badge art and tiers, no "device-local" or NFT wording, no standing shown for an excluded wallet.
- Share pages `/s/220fb144c4b2d70dfda79bfdd343656a45470b77208ee1d586ee049ff27ffcb5`, `/s/d3dade04aafc0f4fac101ddd33010c37d58a38c141e038a17c6072c3079d8671`, `/s/187f063ae968b349339f38c0f2a48c4b85aa100e4a20df8a996629f8e9464a8a`: page renders, tags correct, card images load, Play buttons route correctly, 320 px layout.
- Accessibility basics on these views: keyboard focus order, visible focus, contrast of key text, button labels.

## Deliverables
1. `docs/qa/live-ui-audit-20260924.json` + screenshots summary (paths in the OS temp dir or scratchpad; do not commit large images).
2. Each defect fixed in code with a test (or a pinned-text update), committed separately; cosmetic polish in keeping with the retro CRT arcade look. Nothing that changes contracts, secrets or flags.
3. Gate: `npm test`, `npm run check`, `npm run build`, `npm run test:release` (51).
