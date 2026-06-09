# Lester's Arcade — Remaining Work Plan (post wallet-routing request)

_Reanalyzed 2026-06-08. Ordered by priority + quickest-first._

## Context
App today is a single-page state machine (`officialAppStep` in main.js) served at `/`.
No URL routing. Sessions exist (`startPlaySession`) with id `${gameId}-${mode}-${uuid}`.
Settlement plumbing exists (`settlement.mjs`, `buildSettlementPlan`, `SETTLEMENT_LIVE=false` sim).
Stats tracked: kills, killsByType, totalKills, timeSurvived, finalScore, enemy/boss breakdown.

## Target navigation model (user request)
- Logged out → `/` (current homepage, perfect as-is).
- Connect wallet → on success → **Choose Your Cabinet** at `/games`.
- Select Hard Money Heroes → boots game app at `/games/hard-money-heroes`.
- Free Mode → free play (no settlement).
- Ranked → initiates zkLTC payment, creates a session, routes to
  `/games/hard-money-heroes/game-session-000000001` (zero-padded incrementing id).
- Session id is the blockchain data point + user-searchable handle.
- All stats (total kills, kills per enemy type, time survived, final score, etc.)
  → leaderboard + settled on LitVM. Tracked both per-game AND globally by the parent arcade.
- Future-proof: built so adding more games reuses `/games/<game>/game-session-<id>`.

## Work items — priority / quickest-first

### P1 — URL routing layer ✅ DONE (deployed, live-verified 0 JS errors)
### P2 — Deterministic session IDs `game-session-NNNNNNNNN` ✅ DONE (deployed)
### P3 — Per-session stat record + searchable index + global rollup ✅ DONE (deployed)

### P4 — Documentation + skills + cost report (DEFERRED until HMH nearly done)
1. Game-creation playbook doc (how HMH was built; reusable for future games).
2. New/updated skills to speed future game creation.
3. Token-cost retro: most costly steps, where we hit issues, improvements.

## Original work items (for reference)

### P1 — URL routing layer (quickest, highest navigational value)
1. Map `officialAppStep` ↔ path. `setOfficialView()` calls `pushState` with the right URL.
2. `popstate` + initial-load: parse path → set view (deep-linkable, back/forward works).
3. Vercel rewrites: all `/games/*` → `/index.html` (SPA fallback).
4. Tests: pure path<->view mapping helper (`routeForView`, `viewForPath`).

### P2 — Deterministic session IDs in `game-session-NNNNNNNNN` format
1. Add zero-padded incrementing counter (persisted in arcade state) → human/blockchain-friendly id.
2. Keep the uuid internally for uniqueness; expose the padded id as the URL/leaderboard handle.
3. Ranked session → route to `/games/hard-money-heroes/<paddedId>`.
4. Tests: id format, monotonic increment, padding.

### P3 — Per-session stat record → leaderboard + global arcade rollup
1. Ensure session record captures full stat block (kills, killsByType, timeSurvived, finalScore).
2. Confirm both the per-game record AND the parent-arcade global rollup are written.
3. Searchable-by-session-id read path (the data point users pull from chain).
4. Tests: stat completeness + dual-write.

### P4 — Documentation + skills + cost report (when HMH nearly done)
1. Game-creation playbook doc (how HMH was built; reusable for future games).
2. New/updated skills to speed future game creation.
3. Token-cost retro: most costly steps, where we hit issues, improvements.

## Risk notes
- Routing must NOT break the logged-out homepage or the internal state machine.
- Keep `SETTLEMENT_LIVE=false` (no real on-chain tx without explicit approval + deployed contracts).
- Gate every push: npm test / node --check / contracts:check / asset-verify.
