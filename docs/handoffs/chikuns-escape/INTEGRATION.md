# Chikun's Escape — Integration Handoff

A complete, self-contained copy of the **Chikun's Escape** game (internal codename
"ARISE"), extracted from the chikun.meme site so it can be dropped into
**Lester's Arcade** and integrated by your team/agents.

This doc is written for the engineers (and coding agents) who will wire the game
into the parent app, add soul-bound-NFT achievements, and swap the backend.
It tells you what the game is, exactly what it depends on, and where every
integration seam lives (with file\:line references).

---

## 1. What this is

A **Flappy-Bird-style endless flyer**, rendered on a single HTML `<canvas>`.
You tap/click/space to flap; dodge Big Corp towers; collect coins; pass through
4 visual "zones" (chapters). It includes: coin economy, unlockable skins &
trails, power-ups, drones, bosses, a daily-challenge seed, an achievements
system, and a live leaderboard.

It is **React + TypeScript**, currently authored as a Next.js 14 client route.
The game loop, physics, rendering, audio and persistence are pure browser code —
**no Next.js-specific runtime is required** other than a few conventions noted
in §5. It runs in any React 18 app.

- **~4,000 lines** of game code total (the engine, `ArisGame.tsx`, is ~3,100).
- **Zero coupling to the rest of the chikun.meme site** — no shared components,
  no nav/footer imports. The only outbound reference is one hardcoded share URL
  (see §6, "Share URL").

---

## 2. Bundle contents

```
Chikun's Escape/
├── INTEGRATION.md            ← you are here
├── src/
│   ├── ArisGame.tsx          ← the game: engine, loop, rendering, HUD, modals (~3100 lines)
│   ├── Leaderboard.tsx       ← leaderboard UI (reads from storage/Supabase)
│   └── game/
│       ├── config.ts         ← ALL tunables + content tables (zones, skins, trails, ACHIEVEMENTS)
│       ├── storage.ts        ← save state (localStorage) + leaderboard read/write seam
│       ├── supabase.ts       ← Supabase client factory (the swappable backend)
│       ├── sprites.ts        ← image loading + bg-removal; SPRITE_SRCS asset map
│       └── audio.ts          ← WebAudio SFX + music; MUSIC_URL asset path
├── public/arise/             ← the 5 runtime assets the game loads (see §4)
│   ├── chikun-flap.png
│   ├── chikun-coast.png
│   ├── chikun-fall.png
│   ├── bigcorp-tower.png
│   └── soundtrack.mp3
├── styles/
│   ├── arise.css             ← custom CSS + UI font import (documented inline)
│   └── tailwind-tokens.js    ← custom color tokens (ink/bone/glow) to merge into tailwind.config
├── backend/
│   └── schema.sql            ← Supabase leaderboard table + RLS policies
└── reference/
    └── next-route/           ← original Next.js wrappers, for reference only
        ├── page.tsx          ← route + <meta>, mounts <ArisGame/> + <Leaderboard/>
        └── layout.tsx        ← viewport meta (disable pinch-zoom, safe-area)
```

---

## 3. Dependencies

| Package | Why | Required? |
|---|---|---|
| `react` + `react-dom` (18) | Component + hooks | **Yes** |
| `@supabase/supabase-js` (^2) | Leaderboard backend | Only if you keep Supabase (§7) |
| `lucide-react` | One icon (`Crown`) in `Leaderboard.tsx` | Easy to drop — replace with any icon/SVG |
| Tailwind CSS (3) | ~105 utility classes across the components | See §5 "Styling" |

No other runtime deps. No game engine, no physics lib — it's all hand-rolled
on canvas 2D.

---

## 4. Assets (5 files)

The game loads exactly these at runtime, by **absolute path from web root**:

| Path | Defined in | Purpose |
|---|---|---|
| `/arise/chikun-flap.png` | `src/game/sprites.ts:155` | Chikun, wings up |
| `/arise/chikun-coast.png` | `src/game/sprites.ts:156` | Chikun, gliding |
| `/arise/chikun-fall.png` | `src/game/sprites.ts:157` | Chikun, falling |
| `/arise/bigcorp-tower.png` | `src/game/sprites.ts:159` | Obstacle tower texture |
| `/arise/soundtrack.mp3` | `src/game/audio.ts:354` (`MUSIC_URL`) | Looping music |

Coins, feathers, particles, UI — all **drawn procedurally** on canvas, no image
files.

> **Porting the base path:** if Lester's Arcade serves the game under a subpath
> (e.g. `/games/chikun/`) or from a CDN, change the paths in **two places only**:
> `SPRITE_SRCS` in `sprites.ts` and `MUSIC_URL` in `audio.ts`. Consider lifting
> both to a single `ASSET_BASE` constant. Otherwise, host these 5 files at
> `/arise/…` on the arcade's domain.

---

## 5. Next.js conventions to be aware of

The game is currently a Next.js client route. When porting into the arcade's
app, mind these (all trivial):

1. **`"use client"`** — first line of `ArisGame.tsx` and `Leaderboard.tsx`.
   Keep it if the arcade is Next App Router; remove it for plain React/Vite/CRA.
2. **Env vars** — the ONLY `process.env` usage is in `src/game/supabase.ts`:
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Rename to
   your framework's convention (`VITE_…`, `import.meta.env`, etc.) if not Next.
3. **Styling** — the React UI (menus, leaderboard, HUD) has three theme
   dependencies. The **canvas game itself needs none of them** — its art is all
   hardcoded hex (`config.ts` `COLORS`) drawn on canvas, and its text is
   hardcoded `system-ui`, so gameplay looks pixel-identical anywhere.
   - **Tailwind utilities** (~105 uses: flex, text-*, rounded-*, etc.). If the
     arcade has Tailwind they just work; if not, add Tailwind or translate them.
   - **Custom Tailwind color tokens** `ink`, `bone`, `glow` (used heavily in
     `Leaderboard.tsx`, some in `ArisGame.tsx`). In stock Tailwind these classes
     resolve to nothing and the menus render colorless. **Merge
     `styles/tailwind-tokens.js` into the arcade's `tailwind.config`** to fix.
   - **UI font** (Hanken Grotesk). Now imported + scoped to `.arise-page`
     inside `styles/arise.css`, so it's self-contained — just import that file.
   Net: **import `styles/arise.css` AND merge `styles/tailwind-tokens.js`**, and
   the UI matches the original exactly.
4. **The route wrappers in `reference/next-route/` are NOT needed** if you mount
   `<ArisGame/>` yourself — they only exist to show how the original page set
   `<meta>` (SEO/OG) and the viewport (pinch-zoom disabled, safe-area). Copy the
   viewport settings from `layout.tsx` into the arcade's game page so mobile
   flap-tapping doesn't trigger browser zoom.

**Minimal mount** (in any React 18 app):

```tsx
import ArisGame from "./chikun/ArisGame";
import Leaderboard from "./chikun/Leaderboard";
import "./chikun/arise.css";

export default function ChikunGame() {
  return (
    <div className="arise-page" style={{ backgroundColor: "#2b5ede" }}>
      <ArisGame />
      <Leaderboard />   {/* optional — omit if using the arcade's own board */}
    </div>
  );
}
```

---

## 6. Integration seams (where to plug in)

These are the exact hooks your NFT/achievement/backend work will touch.

### A. Achievements — the NFT hook 🎯
The game already has a **complete achievements system**. This is almost certainly
where soul-bound-NFT minting plugs in.

- **Definitions:** `src/game/config.ts:365` — `ACHIEVEMENTS[]`, 10 achievements,
  each a pure `check(ctx) => boolean` over a run/lifetime context
  (`AchievementCtx`, `config.ts:344`). Add/edit achievements here.
- **Unlock detection:** `src/ArisGame.tsx:601` — on each death, the game builds
  the context and computes `newlyUnlocked` (achievement IDs earned this run):
  ```ts
  for (const a of ACHIEVEMENTS) {
    if (!cur.achievements.includes(a.id) && a.check(ctx)) newlyUnlocked.push(a.id);
  }
  ```
  **This `newlyUnlocked` array is your mint trigger.** Right after it's computed
  (`ArisGame.tsx:606-611`), call the arcade's wallet/mint service with the
  earned IDs. Each achievement has a stable `id` (e.g. `"century_chikun"`),
  `name`, and `description` — ready to map to on-chain metadata.
- **Persistence today:** unlocked IDs are stored in `save.achievements`
  (localStorage). For soul-bound NFTs you'll likely want the chain to be the
  source of truth — on load, reconcile `save.achievements` with the wallet's
  owned tokens.
- **Cosmetics as a second NFT surface (optional):** `SKINS` and `TRAILS`
  (`config.ts:313` / `:333`) are coin-purchased cosmetics with stable ids —
  a natural fit for tradeable (non-soul-bound) NFT cosmetics if desired.

### B. Score submission — the leaderboard write
- **`src/ArisGame.tsx:2281`** — `submitName()` calls
  `submitLeaderboardEntry({ name, score, coins, towers, zone })`.
- The implementation lives in `src/game/storage.ts:172`. The game only ever
  touches **three** leaderboard functions — swap these to point at the arcade's
  backend and everything else follows:
  - `qualifiesForLeaderboard(score)` — `storage.ts:116`
  - `submitLeaderboardEntry(entry)` — `storage.ts:172`
  - `fetchLeaderboard()` — `storage.ts:147`

### C. Currency / economy
- `save.bankedCoins` (spendable) and `save.lifetimeCoins` (never decreases) in
  `src/game/storage.ts`. If the arcade has a shared/token economy, this is where
  to bridge it.

### D. Persistence
- All save state is one localStorage key, `arise-save-v2` (`storage.ts:6`), via
  `loadSave()` / `saveState()` / `updateSave()`. Swap these three for a
  server/wallet-backed store to make progress portable across devices.

### E. Share URL (parent-site reference to change)
- `src/ArisGame.tsx:2303` hardcodes the share tweet:
  `https://www.chikun.meme/arise` and `@ChikunLTC`. Update to the arcade's URL.

---

## 7. Leaderboard backend (Supabase) — currently in, easy to swap

**Left "not sure yet" per the handoff conversation, so it's shipped intact and
functional, but cleanly isolated.**

- **How it works now:** if `NEXT_PUBLIC_SUPABASE_URL` + `…_ANON_KEY` are set,
  scores read/write a Supabase `leaderboard` table (schema + RLS in
  `backend/schema.sql`). If those env vars are **absent, the game automatically
  falls back to a local-only leaderboard** (localStorage) — so it runs with zero
  backend out of the box. See the fallback logic in `storage.ts:177-203`.
- **To keep Supabase:** run `backend/schema.sql` in a Supabase project, set the
  two env vars. Note the table has server-side RLS bounds to deter bot spam.
- **To use the arcade's backend instead:** reimplement the three functions in
  §6.B against your API. `supabase.ts` can then be deleted.
- **To go backend-less:** set no env vars — local leaderboard just works.

---

## 8. Suggested integration order

1. **Get it rendering** — mount `<ArisGame/>` (drop `<Leaderboard/>` at first),
   host the 5 assets at `/arise/…`, import `arise.css`, confirm Tailwind. Play it.
2. **Fix the base path** if assets 404 (§4).
3. **Decide the leaderboard** (§7): arcade backend, keep Supabase, or local-only.
4. **Wire achievements → NFTs** at the `newlyUnlocked` seam (§6.A).
5. **Bridge the economy / cross-device saves** if the arcade needs it (§6.C/D).
6. **Update the share URL** (§6.E) and viewport meta for mobile (§5.4).

---

## 9. Gotchas

- **Canvas is fixed 1280×720 (16:9)** and scaled via CSS to fit `--arise-vh`
  (`config.ts:10`). The frame maintains aspect ratio; letterboxing is intentional.
- **Fullscreen mode** toggles `body.is-arise-fullscreen`, whose CSS hides the
  parent app's `<header>`/`<footer>` and the `#leaderboard`. Retarget those
  selectors to the arcade's chrome, or remove them if the arcade owns fullscreen
  (see `styles/arise.css` comments).
- **Audio needs a user gesture** — music/SFX start on first tap (browser
  autoplay policy). Already handled; just don't be surprised by silence pre-tap.
- **Score share renders a PNG** client-side (`ArisGame.tsx:~2355`) via canvas —
  no server needed.
- **This bundle is a point-in-time copy.** Source of truth remains the chikun.meme
  repo (`app/arise/`). If both evolve, reconcile manually.
