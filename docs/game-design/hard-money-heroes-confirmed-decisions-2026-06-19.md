# Hard Money Heroes — Confirmed Decisions (2026-06-19)

Source: Justin direct confirmation in Hermes thread. This file is the authoritative
answer to the open clarifying questions for the current Level 1 / enemy / polish pass.
When this doc and older plan docs conflict on these points, **this doc wins**.

---

## 1. Authored vs. procedural balance

- **Authored**: the world map, level design, biome/district layout, asset placement,
  and areas of interest. Levels should read as thoughtfully hand-crafted, NOT random
  scatter. Each biome/district gets deliberate, designed AOIs.
- **Procedural** (only where it makes sense): enemy spawning, power-up / item drops.
- Net: lean MORE authored than the prior hybrid plan implied. Procedural is limited to
  spawns and drops, not world/level geometry or landmark placement.

## 2. POI / level scope for this pass

- Build out the **full POI scope** — whatever it takes to make Level 1 detailed,
  crafted, and pleasant to play in. Do not ship a level that looks randomly assembled.
- All six approved Level 1 POIs are in scope: Rugpull Gulch, Dry Forest & Cave,
  Old Hashrate Camp, Oasis / Lakeside, Mesa Overlook, Crossroads Trading Post.

## 3. Level 1 structure + canon lock (CONFIRMED)

- **Level 1 = Crypto Wasteland**, the intro level. Target playtime ~**8 minutes**.
- **Extraction model** (implement this):
  - Extraction point spawns at the **8-minute** mark; player must reach it to clear
    the level, OR
  - **Early unlock**: killing all mini-bosses + the main boss (and optionally
    collecting special items at POIs) unlocks the extraction point early.
- On Level 1 completion → **loading screen for Level 2** (Justin will provide the
  Level 2 background artwork).
- **Level 2 = Litecoin City** — modern / near-future city. Districts include:
  - MimbleWimble Grove (luxury neighborhood)
  - DeFi Harbor
  - Financial District
  - Artisan District
  - Parks
  - Litecoin Plaza
  - (plus other previously-mentioned districts)
- Persisted IDs, leaderboard keys, achievement IDs, profile schema keys stay untouched.

## 4. Enemy production scope (FULL)

- Create **all** enemy sprites, art, VFX, AI behavior, and animations — for every enemy
  in the roster including new ones. Do the whole priority order, not just a subset.
- Everything must look well-designed, well-animated, and be **balanced** with the rest
  of the game: health, damage, AI patterns, telegraph timing, counterplay.

## 5. Art direction + combat polish

- **Start creating new artwork.** Existing enemies that already have full sprite kits /
  animation coverage can stay where they still hold up; new-enemy focus is on **human
  and animal** archetypes.
- Art must tie thematically to **Litecoin / blockchain / crypto / Web3 culture**.
- Continue improving **player combat feel**: shooting, bullet animations, physics,
  grenade throwing, explosions, blood/gore system. Fine-tune, add effects / better
  visuals, and optimize.

## 6. Priority order for the session

1. **Game improvement & polish first** (level design, enemies, combat feel).
2. **Then UI** — in-game UI, then website UI updates.
- Keep the work on-track; do not let pushed updates regress or break existing features.

## 7. Copy / theme reconciliation

- Remove **all** side-scroller language everywhere (served markup, news ticker, hidden
  dev codex, art captions, instructions, naming).
- The game is a **Roguelite shooter** (isometric run-and-gun). Update all game copy,
  instructions, naming, and theming to the current direction.

## 8. Commit & deploy (APPROVAL GRANTED, gated on completion)

- Review **all** uncommitted + untracked work; keep everything that genuinely advances
  these goals and fold it into the next commit(s). Commit incrementally.
- **Push live is approved** — but only **after all of the above work is done and
  verified** (`npm test`, `npm run check`, `npm run contracts:check`, and a local
  browser-console check with 0 JS errors). Deploy is the final step, not mid-stream.

---

### Standing guardrails (unchanged)

- No contract deploys, fund movement, transactions, account changes, or external posts
  without separate explicit approval. The push approval above covers the normal
  site/game code deploy only.
- Keep secrets out of files/prompts.
