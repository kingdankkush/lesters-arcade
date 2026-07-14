# Chikun's Escape → Lester's Arcade SDK — integration map

**Read this alongside `INTEGRATION.md`.** That file describes the game as it
exists today (a React/Next canvas game with a Supabase leaderboard). This file
maps that game onto **Lester's Arcade's Cabinet SDK v1**, which is how it will
actually run inside the arcade. Where the two disagree, *the arcade model wins* —
the game is a guest in a sandbox and the parent owns the rails.

Sources in the arcade repo this is based on:
`docs/THIRD_PARTY_GAME_ONBOARDING.md`, `apps/portal/src/arcade-sdk.mjs`,
`apps/portal/games/hard-money-heroes/main.mjs` (reference cabinet).

---

## The one big shift

The game currently owns its leaderboard (Supabase) and its own persistence. In
the arcade it **owns neither**. It runs in a sandboxed iframe (`allow-scripts`
only — no same-origin, no `window.ethereum`, no keys) and **emits intent** via
`postMessage`; the parent verifies, enforces free/ranked, settles on-chain, and
records official state.

So the integration is mostly **deleting** the game's backend and **replacing**
it with event emission:

| Game today (this bundle) | In the arcade cabinet |
|---|---|
| `submitLeaderboardEntry()` → Supabase (`storage.ts`) | emit `arcade.scoreSubmit` (parent writes the board) |
| `game/supabase.ts`, `backend/schema.sql` | **delete** — parent owns leaderboards |
| `newlyUnlocked` achievements → localStorage (`ArisGame.tsx:601`) | emit `arcade.achievement` per id → **parent mints the soul-bound NFT** |
| `loadSave()/saveState()` localStorage as source of truth | fine for local prefs; official progress comes from parent `init(ctx)` |
| Fixed 1280×720 (16:9) canvas | must ALSO support 9:16 portrait (manifest requires both) |
| hardcoded share URL to chikun.meme | remove — parent owns social/share |

Everything else — the actual game (physics, rendering, zones, coins, skins,
particles, feel) — ports over unchanged. That's the valuable part and it's
self-contained on canvas.

---

## Target location in the repo

The chikun cabinet is **already scaffolded** and waiting:
- `apps/portal/games/chikun/main.mjs` — cabinet entry (currently a placeholder
  vertical slice). This is where the real game boots.
- `apps/portal/src/chikun-cabinet.mjs` — the slice helpers to replace/flesh out.
- `apps/portal/src/games/chikun/loader.mjs` — loads the game code.
- `games/chikun/game.manifest.json` — manifest (flip `status` to `playable`
  when done; note it currently reads "Chikun: The Flying Coin").

The game code in this bundle is **React/TSX**. The cabinet runtime is **vanilla
ES modules**. The canvas engine itself has no hard React dependency — the loop,
physics, rendering, audio and input are plain browser APIs. Porting means
lifting that engine out of `ArisGame.tsx` into an ES-module cabinet and driving
it from the SDK lifecycle, rather than from React state/effects.

---

## Event wiring (game → parent)

Follow the reference cabinet `apps/portal/games/hard-money-heroes/main.mjs`.
Build messages with `buildArcadeMessage(type, payload, { gameId, seq })` and
post to the resolved parent origin. Emit:

| Arcade event | Emit from Chikun when… | Payload | Source seam |
|---|---|---|---|
| `arcade.ready` | engine + assets loaded | `{ gameId }` | after sprite/audio preload (`sprites.ts`, `audio.ts`) |
| `arcade.sessionStart` | a run begins | `{ gameId, mode }` | on first flap / run start |
| `arcade.statUpdate` | periodically during a run | `{ gameId, score, towers, coins }` | the run's score/coins/towers counters |
| `arcade.achievement` | each id in `newlyUnlocked` | `{ gameId, achievementId }` | `ArisGame.tsx:601-611` — **the NFT hook** |
| `arcade.scoreSubmit` | run ends with score > 0 (ranked) | `{ gameId, score, coins, towers, zone }` | replaces `submitName()` at `ArisGame.tsx:2281` |
| `arcade.gameOver` | run ends | `{ gameId, score, towers, coins }` | the death handler (`ArisGame.tsx` ~line 585+) |

## Commands (parent → game)

Handle inbound `arcade.start / pause / resume / teardown` (and `resize` for
orientation). Map to the engine's existing run/pause/reset logic:
- `arcade.start` → begin session (respect `mode: free|ranked`)
- `arcade.pause` / `arcade.resume` → the engine already has a pause path; gate the loop
- `arcade.teardown` → stop RAF, release audio, remove listeners
- `resize` / orientation → relayout for 9:16 vs 16:9 (see below)

## init(ctx)

`ctx` carries display identity + `mode` + `aspect` + `reducedMotion` + `locale`
only — **no wallet, no keys** (see `buildInitContext` in `arcade-sdk.mjs`). Use:
- `ctx.player.displayName` instead of the game's name-entry prompt (drop the
  handle-input modal — the parent supplies identity).
- `ctx.reducedMotion` to drive the game's existing reduced-motion path.
- `ctx.aspect` to pick the portrait vs landscape layout.

---

## Achievements → soul-bound NFTs 🎯

This is the headline integration. The game already computes `newlyUnlocked`
(array of achievement ids) on every death at `ArisGame.tsx:601`. In the cabinet,
**emit one `arcade.achievement` per id** and the parent handles the on-chain
soul-bound mint. The 10 achievements are defined in `src/game/config.ts:365`
with stable ids (`first_flap`, `century_chikun`, …), names, and descriptions —
ready to map to token metadata. Reconcile owned tokens back into the UI at
`init()` if you want the achievements modal to reflect chain state.

`SKINS` and `TRAILS` (`config.ts:313/333`) are a second, optional NFT surface
(tradeable cosmetics) if the arcade wants it later.

---

## Dual aspect ratio (the real porting cost)

The manifest requires `["9:16", "16:9"]`. The engine is fixed 16:9
(`config.ts` `canvas: { w: 1280, h: 720 }`). Options, easiest first:
1. **Letterbox** the 16:9 field inside a 9:16 viewport (fast, ships now).
2. **Reflow** the playfield to a taller portrait aspect (more work; better feel
   on mobile, which is the arcade's primary surface for a one-button game).

---

## Security scan (gate before onboarding)

Must pass `npm run design:third-party-security`. Known things to clear in this
codebase:
- **No remote code / no undeclared network.** Removing `supabase.ts` also
  removes the game's only network calls — good. Confirm nothing else fetches.
- **No `eval` / `Function()`** — the engine doesn't use them; verify after port.
- **No wallet/`window.ethereum` access** — the game never touches it today; keep
  it that way (all wallet ops go through `arcade.requestWalletAction`).

---

## Suggested port order

1. Lift the canvas engine out of `ArisGame.tsx` into a framework-free module.
2. Boot it from `apps/portal/games/chikun/main.mjs` on `arcade.start`; emit
   `arcade.ready` after preload (mirror `hard-money-heroes/main.mjs`).
3. Delete `supabase.ts` + Supabase calls in `storage.ts`; wire `arcade.scoreSubmit`.
4. Wire `newlyUnlocked` → `arcade.achievement`.
5. Drop the name-entry modal; use `ctx.player.displayName`.
6. Add the 9:16 layout.
7. Test with `apps/portal/dev/mock-parent-harness.html`; pass the security scan.
8. Flip manifest `status` → `playable`, update `name` if desired, QA on mobile.
