# Chikun's Escape 🐔🎮 — game handoff bundle

Self-contained copy of the **Chikun's Escape** canvas game, packaged for
integration into **Lester's Arcade**.

**→ If you're integrating this into Lester's Arcade, start with
[`ARCADE_SDK_MAPPING.md`](./ARCADE_SDK_MAPPING.md)** — it maps the game onto the
Cabinet SDK (sandboxed iframe, `arcade.*` events, parent-owned leaderboard,
achievements → soul-bound NFTs) and points at the already-scaffolded
`apps/portal/games/chikun/` target.

**→ For the game itself** — what it is, its dependencies, and every integration
seam with `file:line` refs — see [`INTEGRATION.md`](./INTEGRATION.md).

Quick map:
- `src/` — all game code (React + TypeScript). `ArisGame.tsx` is the engine.
- `public/arise/` — the 5 runtime assets (host at `/arise/…`).
- `styles/arise.css` — custom CSS + the UI font (self-contained).
- `styles/tailwind-tokens.js` — custom color tokens (`ink`/`bone`/`glow`) to merge into the arcade's `tailwind.config` so the menus keep their colors.
- `backend/schema.sql` — Supabase leaderboard schema (optional; game falls back to local).
- `reference/next-route/` — original Next.js wrappers, for reference only.

Runs in any React 18 app. No game engine, no server required to play.
