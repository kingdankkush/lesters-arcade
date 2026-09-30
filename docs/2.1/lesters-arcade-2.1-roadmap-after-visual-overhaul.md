# Lester's Arcade 2.1 and 2.2: the roadmap after the Visual Overhaul

*Written 2026-09-29, revised 2026-09-30 with the owner's decisions.*

**What this is:** the full plan for **after 2.0**. 2.0 (The Visual Overhaul, plus the achievements, unlockables, site and blog work) is being built by the Astra agent from two guides:
- `lesters-arcade-2.0-visual-overhaul-handoff-20260929.md`
- `lesters-arcade-2.0-achievements-unlockables-site-blog-guide.md`

Nothing here starts until the matching 2.0 work has landed, and no item here repeats 2.0 work.

**Owner decisions (2026-09-30):**
- **Yes:** 2.1a fairness and finishing, 2.1b replayability, 2.1c achievements, 2.1d arcade experience, fleshed out in full.
- **No:** seasons, events or rivals for now.
- **2.2 is Level 2 only:** new art kits, new enemies and bosses, new and rebalanced achievements, new skills, new weapons and new power-ups. **No co-op or multiplayer, and no fifth hero.**
- **Finish and optimize four partly built items:**
  - the railgun and weapon wheel;
  - gamepad support;
  - the STACKED menu redesign;
  - Hard Money Heroes controller vibration (haptics).
- **Soulbound minting waits.** The owner is still deciding where and how. Appendix A gives options, costs, wallets and steps.

**How to read it:**
- Every item says what it is, why it matters, and whether it **changes gameplay** (which means a verifier review and a version bump for Ranked) or is **presentation only**.
- The standing rules from §0 of the 2.0 handoff apply throughout.

---

## 1. What changed: the reconciliation

These earlier plans were replaced by later decisions. Nothing after 2.0 should build the old version.

| Earlier plan | Replaced by |
|---|---|
| Layout v2 inside 12,000 × 4,800 (Relay/Crossing/Yard/Ravine/Hashwood/Mining, 25 missions) | The 10-area, 20,000 × 14,000 world with about 30 missions (2.0) |
| Pre-rendered 8-direction sprite heroes; rig v2 rendered to frames | Real-time 3D heroes, enemies and bosses (2.0) |
| 24–30 hero clips | About 60 clips per hero, including cover, interaction, traversal and idle fidgets (2.0) |
| About 150 level assets | About 190, led by the art bible and a vertical slice (2.0) |
| "Litecoin Town" | Litecoin City with LitVM and Litecoin ecosystem billboards (2.0) |
| STACKED colour-match with cascades | Dropped; STACKED keeps its gameplay (2.0) |
| Owner-supplied soulbound art, one collection per game | The universal badge template plus 3D trophies; **minting deferred** (Appendix A) |
| 22 tint, coat, trail, hat, piece-skin and scene cosmetics | Removed; 12 new unlockables and the Locker (2.0) |
| The blog waits until the game updates are done | Blog engine and articles 1–4 before 2.0; article 5 with 2.0 |
| Seasons and events; rivals and following (proposed 2026-09-29) | **Not now** (owner, 2026-09-30) |
| Co-op, online versus, a fifth hero (proposed 2026-09-29) | **Not planned** (owner, 2026-09-30) |
| Ranked fee 0.1 zkLTC | 0.012 total, live since 1.8.6 |
| Preset-only avatars | Custom uploads, live since 1.9.3 |

**Already live:**
- 1.9.0: missions, the Liquidator without a timer, Genesis Seal wave 1, dodge, schema-7 verifier, Free share cards, banners;
- 1.9.1–1.9.4: share fixes, random Level 1 art, real hero stats and perks, avatars, share warm-up.

**In 2.0 (don't start here):** everything in the two 2.0 guides.

---

## 2. 2.1a: fairness, finishing and optimizing

### 2.1 The four partly built items: verify, complete, optimize

Each gets the same treatment:
1. **Audit what exists** (code, tests, live behaviour on desktop, phone and controller).
2. **Write down the gaps.**
3. **Finish them.**
4. **Measure and optimize.**
5. **Add tests** so they stay done.

**1. Hash Rail (the railgun) and the weapon wheel.** Owner direction 2026-09-16: the railgun pierces many enemies and never one-shots a boss; damage falls to 35% at maximum range; the weapon wheel has a swap button.
- **Railgun:**
  - confirm pierce count, the fall-off curve and the boss rule in the simulation (`apps/hmh-reboot/src/weapon-system.mjs`);
  - add the 2.0 visual treatment: a beam charge-up, a pierce spark per enemy, fall-off shown by beam thinning, the evolution look;
  - make sure the charge time reads clearly on the HUD;
  - benchmark it in `docs/qa/hmh-weapon-benchmark.json`.
- **Weapon wheel** (`apps/hmh-reboot/src/weapon-wheel.mjs`):
  - the full wheel on desktop (hold a key or the mouse wheel), controller (hold a bumper, pick with the stick), and phones (hold the weapon button);
  - a quick-swap tap to the last weapon; ammo and evolution state on each slot; slow-motion while open **only in Free Mode** (Ranked needs no simulation change);
  - zoom +10% / −30% on desktop per the 09-16 decision;
  - the 2.0 3D weapon models as wheel icons;
  - check the open and close animation costs nothing on phones.
- **Gameplay?** The railgun rules are gameplay: verify the current values match the verifier, and don't change them without a review. The wheel UI is presentation.

**2. Gamepad support, everywhere.**
- Standard layouts (Xbox, PlayStation, Switch Pro, generic) through the Gamepad API, with correct button labels and on-screen prompts that switch automatically between keyboard, touch and controller.
- **Every screen works without a mouse:** portal navigation, game menus, hero select, the Locker, the achievements tilt viewer (the right stick tilts), leaderboards, share screens, settings.
- **In each game:**
  - *HMH:* twin-stick aim, dodge, cover (movement-only), weapon wheel, grenades;
  - *Chikun:* jump and double jump;
  - *STACKED:* movement with repeat settings, rotation, hold, hard drop.
- **Remapping** per game, saved to the profile preferences.
- **Tests:** a controller smoke per game and per menu.

**3. The STACKED menu redesign** (owner, 09-16: "full menu redesign with bespoke art").
- **Audit:** 2.0 redesigned the results and settings screens; confirm what remains of the title, mode select and pause menus.
- **Finish:**
  - a bespoke title screen that lives inside the visualizer (the logo floats in the forward flight);
  - mode cards for Free, Ranked, versus, daily, marathon, sprint and puzzles (§3.3) with art and best scores;
  - a pause menu with stats;
  - a How to Play overlay;
  - a consistent button and type system from the art bible.
- **Optimize:** menu load time, no layout shift, 60 fps menus on phones, full keyboard and controller navigation.

**4. HMH controller vibration (haptics).**
- Use the shared `apps/portal/src/cabinet-haptics.mjs` (`createCabinetHaptics`, patterns tap, hit, death, clear, big).
- **Map it:**
  - weapon fire per weapon (a light tick for the Pistol, a heavy thump for the Launcher, a buzz for the Lightning Ledger);
  - damage taken scaled by size; dodge; cover snap;
  - grenade and explosion rumble by distance;
  - boss stomps and phase changes; level-up; pickups; death.
- **Phones:** use the Vibration API where supported; iOS has none, so keep it silent there.
- **Settings:** an intensity slider (off, low, high), respecting reduced motion.
- **Optimize:** rate-limit so heavy waves don't turn into constant buzzing; a priority system where the strongest event wins.
- **Same pass for Chikun and STACKED** if 2.0 didn't finish it.

### 2.2 Fair play and balance

- **Anti-cheat round 4** (HMH, from the 1.9.0 review):
  - a per-grenade blast kill cap;
  - secret silver claims checked;
  - objective completion times checked;
  - the four v6-forgeable achievements (Blade Master, Blade Samurai, Big Combo, Max Combo 30) closed, or re-earned under strong checks.
- **Real-run coverage for every boss:** the Liquidator plus the three 2.0 bosses. Collect real Ranked fights and confirm zero wrongful refusals; add them to the honest corpus.
- **Chikun anti-bot:** input-timing plausibility (human reaction windows, jitter patterns). Required before any real-value prize, and good hygiene now.
- **STACKED integrity:** confirm the replay budget holds with 2.0 visuals; add plausibility on piece rate (pieces per second) to flag inhuman input.
- **Balance with real data:**
  - hero win rates and scores by hero (1.9.2 stats and perks);
  - weapon usage and time-to-kill;
  - power-up pick rates;
  - enemy danger by area;
  - boss fight lengths.

  Then tune. Decide the **progression power policy** (the about −14% question) first.
- **A balance dashboard** on the owner status page: those numbers, updated from verified runs.

### 2.3 Tech health

- **Retire the legacy combat fallback** (paused branch `fable/retire-legacy-combat-fallback`, WIP `7b55284f`; the trace proof is done).
- **The startup stall budget** (3 stalls against a limit of 2) if 2.0 didn't close it.
- **The portal visual-regression script,** broken since July. Fix it and make it part of the gate.
- **Repository size:** finish moving art sources to the vault (tracked about 820 MB against a 350 MB budget).
- **Prune finished worktrees** (unlink the `node_modules` junctions first).
- **Error monitoring:** client-side error reporting (privacy-safe, no wallet data) to catch crashes on real devices.

---

## 3. 2.1b: replayability, game by game

### 3.1 Hard Money Heroes

**Finish built-but-dark content:**
1. **Prisoners live:**
   - the Field Medic, Quartermaster, Pawnbroker and OG Miner, placed in the new world with guard crews and kneel-to-unlock;
   - 3D prisoner models and cage art to the art bible, rescue animations and a "rescued" moment.
   - *Gameplay:* verifier review; `HMH_V7_RANKED_PRISONERS_LIVE` switched on with tests.
2. **Genesis Seal wave-2 evolutions** for the remaining guns, using the 2.0 weapon models. *Gameplay.*
3. **Settler Rail opt-in:** the Pistol's evolution path. *Gameplay.*

**New ways to play** (each has its own board and verifier rules; Free and Ranked):
1. **Daily Run:** one seed a day for everyone, with a fixed hero and a random modifier ("Pistol only", "night", "double elites", "glass cannon"). A share card with your daily rank.
2. **Weekly Contract:** a harder handcrafted run (a set route through 4 areas, set objectives) that changes every Monday.
3. **Bear Market difficulty:** unlocked by clearing the Liquidator. Stronger and faster enemies, elite variants and more silver; its own board.
4. **Endless Arena:** escalating waves in a boss arena after the main objectives, with a wave-count leaderboard.
5. **Practice Range** (Free only): a shooting range in MWEB Meadows to try any weapon, evolution and power-up, with target dummies and damage numbers.

**Run and exploration depth:**
1. **Post-run map:** the route taken across the 10 areas, secrets found and missed, objectives, where you fell, and a "try this path next time" hint.
2. **Briefing and recap:** a "liquidation notice" briefing with the run's modifiers, and an end recap with a **letter grade (S–D)** from score, objectives, secrets, speed and damage taken.
3. **Death recap:** what killed you, a damage breakdown by enemy, "you were 12% from the next level".
4. **The Codex:**
   - a collectible encyclopedia filled in by playing: enemies and bosses (with their 3D models and weaknesses), weapons and evolutions, power-ups, areas and lore;
   - hidden **ledger pages** (lore notes) placed in secrets across the 10 areas tell the story of the Great Liquidation.
5. **Weapon mastery:** kills per weapon earn mastery tiers (bronze to diamond) with cosmetic badges on the weapon wheel and new achievements. No stat power, so Ranked stays fair.
6. **Hero mastery:** runs, kills and clears per hero raise a mastery rank with titles and a hero-select frame. Cosmetic only.
7. **Run stats screen:** damage by weapon, accuracy, kills per area, time per area, cover time, dodges, best combo, and a timeline graph.

**Feel, HUD and accessibility:**
1. **HUD polish:**
   - an objective tracker with distance;
   - a boss health bar with phase markers;
   - optional damage numbers;
   - low-health warning (vignette and sound);
   - ammo and reload clarity;
   - a minimap showing discovered areas and the next objective.
2. **Pause menu upgrade:** the full world map, the codex, current modifiers, settings.
3. **Accessibility:**
   - aim assist on phones and controllers (adjustable; its assist values recorded so Ranked stays comparable, or Ranked uses one fixed value — a verifier decision);
   - colour-blind modes for enemy tells and pickups;
   - subtitles and visual cues for important sounds (boss tells, grenade warnings);
   - full remapping; hold-to-toggle options; screen-shake and flash intensity sliders.
4. **Photo and trailer mode:** pause, free camera, hide the HUD, depth of field, filters, a watermark. Great for marketing.
5. **Audio:** per-area ambient beds and a combat layer that fades in (the owner's jukebox rule decides if music changes); boss themes on the owner's call; a final loudness and mix pass.
6. **Onboarding:** a guided first run in MWEB Meadows teaching movement, dodge, cover, interaction, the weapon wheel and level-ups in two minutes, skippable.

### 3.2 Chikun's Escape

**New ways to play:**
1. **Missions ladder:**
   - three active missions at a time ("collect 40 coins in one run", "near-miss 10 drones", "reach the Coast without a double jump");
   - finishing missions raises a **Chikun Rank** with titles and badges;
   - new missions rotate in.
   - Presentation plus tracking; no score change.
2. **Run challenges:** three optional goals each run, with a bonus badge on the results screen.
3. **Daily top ghost:** race the verified daily leader's ghost, served safely from their replay.
4. **Region practice** (Free only): start at any region you've reached to practise it.
5. **Night Loop:** after lap 3, a night variant with lamps, fireflies and new hazard timing. *Gameplay:* a course version, replayed by version.

**Course and content** (a course version with replay by version):
1. **Fork lanes:** a safe lane vs a risky coin lane at some forks.
2. **A new region, "Snowpeak Pass":** snow, ice patches, falling icicles and a ski-lift set piece, added to the loop.
3. **More set-piece chases:** the combine harvester, a runaway tractor, a hawk dive; one per lap, seeded.
4. **Shallow water that slows you:** optional, the owner's call.

**Feel, UI and accessibility:**
1. **A death freeze-frame and share:** the funniest frame of the death animation as a shareable card.
2. **A results screen upgrade:** a route strip showing regions passed, near-miss highlights, coins, a combo graph, the best moment.
3. **Accessibility:**
   - a one-button mode (double jump by holding);
   - high-contrast obstacles;
   - audio cues for incoming hazards;
   - reduced motion.
4. **Music by region,** with layered intensity as speed rises.
5. **Real-device acceptance** on a spread of phones.

### 3.3 STACKED

**New ways to play:**
1. **Ranked daily challenge:** the 2.0 daily becomes Ranked, with a verifier review of its seed rules.
2. **Sprint (40 lines)** and **Ultra (3-minute score attack)**, each with its own board, Free and Ranked. *Gameplay:* a ruleset per mode, replayed by mode.
3. **Puzzle mode:** 60+ handcrafted puzzles ("clear the board with these 5 pieces", "make a Halving in 3 moves"), grouped into chapters with stars and achievements. Free only; a great way to teach.
4. **Replay viewer:** watch your best runs, with a timeline and speed control (Chikun already has one; reuse the pattern).

**Competitive quality of life:**
1. **Handling settings:** key repeat delay and speed, soft-drop speed, next-queue length, ghost piece style, hold toggle.
   - *Gameplay check:* handling runs inside the recorded inputs; confirm with the verifier that each setting is replay-safe, or fix Ranked to standard values.
2. **Stats:** pieces per second, lines per minute, Halvings, max combo, finesse (extra key presses), a per-game history graph.
3. **A finesse trainer** (Free): shows the optimal key presses for each placement.
4. **Special-clear recognition** (spin-style clears and perfect clears) with bonus points. *Gameplay:* a new scoring ruleset, needs owner approval; recommended for Sprint and Ultra only, so the classic Ranked board stays unchanged.

**Feel and polish:**
1. **More music tracks,** each with a matching visualizer colour theme.
2. **Accessibility:** colour-blind symbols and high contrast (2.0) confirmed on every block set, including the Litecoin Crystal unlockable.

---

## 4. 2.1c: achievements (no minting yet)

1. **New achievements for 2.0 and 2.1 content,** all made with the universal badge template:
   - *HMH:* each new boss, each area discovered, all secrets in an area, cover kills, camp clears, prisoner rescues, daily and weekly clears, Bear Market clears, Endless waves, weapon mastery tiers, codex completion;
   - *Chikun:* the missions ladder, Night Loop, Snowpeak Pass, chases survived, fork lanes;
   - *STACKED:* sprint times, Ultra scores, puzzle chapters, daily streaks, versus wins (local, Free).
2. **A rebalance pass on existing achievements** using the 2.0 rarity data:
   - fix anything unreachable, too easy or unclear;
   - make sure each tier matches its real rarity (for example a "gold" nobody earns becomes platinum);
   - keep every player's existing unlocks valid.
3. **More soulbound candidates:** the rarest new feats (for example a flawless Bear Market clear, all 60 puzzles, a sub-minute sprint) get 3D trophies. They're kept server-side like the rest until minting is decided.
4. **Achievement tracking UX:**
   - pin up to 3 achievements to track during a run (a small HUD tracker);
   - a "close to unlocking" suggestion on the profile;
   - unlock toasts on the site after a verified run.
5. **Share cards for trophies** (2.0 builds them), plus a "rarest badge" line on run share cards.
6. **Never mint the four v6-forgeable HMH achievements** unless re-earned under strong checks.

---

## 5. 2.1d: the Lester's Arcade experience

**Player hub and progression:**
1. **Arcade profile level:** XP from verified play across all three games, with a profile frame that upgrades by level and a level badge on leaderboards. Cosmetic only.
2. **A "Continue playing" row** on the homepage: your last game, mode and best score, with one-tap restart.
3. **Settings synced across games** (audio, accessibility, handling, haptics, controller layout) through profile preferences, with local fallback for guests.
4. **One accessibility centre** in the site settings that sets defaults for every game: reduced motion, flash limits, colour-blind mode, subtitles, haptics.

**Leaderboards:**
1. **Filters:** game, mode (Ranked, daily, sprint and so on), hero or region, game version, time range.
2. **A "near me" view** that jumps to your rank.
3. **Board history:** past weeks and months kept and browsable (no seasons or resets).
4. **Run pages:** each verified run's page shows its stats, route (HMH), replay (Chikun and STACKED) and share card.

**Front door and discovery:**
1. **Attract mode:** a homepage demo loop of all three games (survey K1).
2. **A first-visit tour** (15 seconds, skippable): Free play in one tap, what Ranked is, where your profile lives.
3. **Game library redesign:** new cabinet art per game from the art bible, "new" and "updated" tags, a short trailer clip per game.
4. **PWA polish:** install prompts, offline Free play for Chikun and STACKED (cached by the service worker), app-like launch on phones.
5. **A help centre and status page:** FAQ, controls per game, troubleshooting, a public status line from `/api/health`.
6. **The survey portal items:** display font (H6), subtle film grain (K3), hashed atlas names (J4b), shared keyboard and gamepad navigation (H7), if they fit the art bible.
7. **All three arcade cabinets remade as 3D models** (owner, 2026-09-30). Hard Money Heroes, Chikun's Escape and STACKED all get a new rotating cabinet built from **one shared 3D cabinet kit**. Pull this forward into an earlier release if there's room; it's independent of the game code.
   - **Why:** the current HMH cabinet shows Lester's white Litecoin "Ł" as **black**. Its white areas were keyed out as transparent when it was cut from a white background. A quick repair (filling enclosed transparent areas with white) restored the logo but left rough white fringes and specks, so the owner chose a remake. The Chikun and STACKED cabinets are also older, generated turnarounds (STACKED is a single 1.36 MB PNG), so all three are redone to one standard.
   - **How the characters and artwork stay faithful:**
     - The cabinet is simple geometry. The **likeness lives in the flat artwork** applied to it: the marquee, screen and side panels, and the control-panel plate. Generating a whole cabinet in one image is what caused the drift (and Lester's wrong face).
     - Flat art is easy to get right, and it can come straight from the approved references:
       - **HMH:** the owner's banner art (for example HMH-Extra4, all four heroes) and the character references in `Desktop/Projects/LestersArcade-Assets/` (Lester, Lilly, Lit Commando, Lit Valkyrie).
       - **Chikun:** the character sheet (white chicken, crimson mohawk, mint-green eyes, black trench coat with red lining) plus the Blender region backdrops.
       - **STACKED:** its logo, block art and visualizer scenes.
     - Where new panel art is needed, generate it with the panel prompts in `hmh-arcade-cabinet-prompts.md` (now covering all three games). The owner approves the panels before they go on.
   - **Build (Blender, `D:/Apps/Blender/blender.exe`):**
     1. **One cabinet kit:** a classic upright cabinet (body, marquee box, screen bezel, control panel, coin door, kick plate) with a slightly different silhouette per game:
        - HMH: angular, gunmetal and gold;
        - Chikun: rounded, farm-red and cream;
        - STACKED: sleek, neon-edged, deep navy.
     2. **Artwork as textures** (panels at 2048 px for crisp detail). The screen is **emissive** with a soft glow, marquees are back-lit, and there's metal trim with wear per the art bible.
     3. **One shared light rig** and camera: the three cabinets sit side by side and look like one set.
     4. **Transparent renders** (Film → Transparent, RGBA PNG); never colour-keyed, so every white stays white.
     5. **A 360° turntable** at 16 frames (a smooth spin; the current cabinets use 6) at an eye-level three-quarter camera.
     6. **Export a glTF** of each cabinet too (under 1 MB with WebP textures) for the optional interactive viewer below.
   - **Web performance (recommended approach):**

     | Option | Cost | Verdict |
     |---|---|---|
     | Pre-rendered **sprite strip** (16 frames, WebP with alpha, played with CSS `steps()`) | About 250–350 KB per cabinet, **no JavaScript library**, works in every browser | **Use this** on the homepage and game library |
     | Real-time **3D (Three.js + glTF)** | About 150 KB of library code (gzipped) plus about 1 MB model per cabinet, GPU work | Only as an opt-in "drag to spin" on each game's page, reusing the 2.0 trophy viewer, loaded on interaction |
     | Video with alpha (WebM/HEVC) | Different formats needed for Safari; decoding cost | No |

     **Loading rules:**
     - Each cabinet shows a **static poster frame** first: one WebP of 30 KB or less, with fixed dimensions so there's no layout shift and it doesn't hurt the page's first paint.
     - The strip loads **only when the cabinet scrolls into view** and the page is idle. It plays only while visible, pauses off screen, and **doesn't animate under reduced motion** (poster only).
     - Frames are about 384 × 420 px (sharp at 2× on the displayed size); AVIF optional with WebP fallback.

     **Budgets** (added to the asset checks): poster ≤ 30 KB, strip ≤ 350 KB, glTF ≤ 1 MB per cabinet; homepage LCP unaffected.
   - **Install:**
     - Replace the frames and manifests:
       - `apps/portal/assets/hard-money-heroes/cabinet/` (keep the manifest id `hard-money-heroes-arcade-cabinet-rotation`);
       - `apps/portal/assets/generated/chikun-cabinet/`;
       - `apps/portal/assets/stacked-cabinet/`.
     - Switch the site's cabinet player to the sprite-strip format; new `?v=` cache keys; `npm run assets:verify` passing with the new budgets.
     - Check the homepage, game library and game pages at desktop and phone sizes, on dark and light backgrounds.
   - **Bonus:** the same cabinet kit becomes the base of the Arcade Legend 500 trophy, the reference for the new arcade-cabinet favicon, and a future "Lester's Arcade floor" scene on the homepage.

**Content and growth** (the owner decides each outreach step):
1. **Blog cadence:** patch notes per release, a monthly "state of the arcade", deep dives (making the 3D heroes, designing the 10 areas), and player spotlights with permission.
2. **Get listed:** submit Lester's Arcade to the LitVM ecosystem directory ("Submit your app" on https://testnet.litvm.com/). Consider a quest on Arkada's LitVM campaign to bring players in.
3. **A press kit page:** logos, banners, screenshots, trailer, fact sheet.
4. **A trailer and clips** made with HMH photo mode and the replay viewers.
5. **X thread drafts** per release.

**Analytics** (owner decision): privacy-friendly, cookie-less, aggregate-only metrics (visits, game starts, completion funnels, drop-off points) to guide 2.2 balance and UX. No wallet data.

---

## 6. 2.2: Hard Money Heroes Level 2

**Scope** (owner, 2026-09-30):
- Level 2 with new art kits;
- new enemies and bosses;
- new and rebalanced achievements;
- new skills, weapons and power-ups.
- **No co-op, no multiplayer, no fifth hero.**

It reuses everything 2.0 builds: the art bible, the 3D character pipeline, the world streaming, the cover and traversal systems, the mission system and the badge template.

### 6.1 Setting (three options; the owner picks one)

| Option | Idea | Areas (6–8) |
|---|---|---|
| **A. "The Mempool Metro"** | A vast half-flooded megacity where the Great Liquidation started | Transit tunnels, neon market, flooded plaza, skyscraper rooftops, the data-centre district, the harbour container yards, the central bank tower (final boss) |
| **B. "Silicon Tundra"** | Frozen mountains beyond the Fork Fortress, where old mining rigs run hot in the snow | Snowfields, ice caves, a frozen lake, a mining town, a geothermal plant, an avalanche pass, the summit observatory |
| **C. "The Halving Badlands"** | A scorched desert frontier of mesas and ghost towns | Canyon trails, a ghost town, a salt flat, an oil field, a dam, a buried vault, a sandstorm arena |

**Recommendation: B.** It contrasts most with Level 1's greens, extends straight from the Fork Fortress, and snow, ice and heat vents give new traversal and hazard ideas.

### 6.2 What gets built

- **New art kits** to the art bible, about 120 assets: ground, elevation, foliage or ice, buildings, props, interactive elements, landmarks.
- **Six new enemies** (human survivors or zombies), each with a clear role. Example set for option B:
  - Frostbitten Miner (a slow tank that shatters);
  - Rig Tender (repairs allies);
  - Avalanche Caller (area denial);
  - Ice Sniper (long-range);
  - Heat Seeker (rushes through vents);
  - Cold Wallet Guardian (shielded).
- **Three new bosses** with arenas, phases and 3D trophies, for example the Hashrate Baron (a mining tycoon), the Glacier Warden, and the Summit Oracle (the final boss).
- **Four new weapons** with gun trees and evolutions, for example:
  - a cryo sprayer;
  - a thermal lance;
  - a mining-charge launcher;
  - a twin smart-pistol set.
- **Four new power-ups,** for example:
  - Cold Storage (freeze nearby enemies);
  - Proof of Stake (planted turret);
  - Hash Surge (fire-rate burst);
  - Airdrop (supply crate).
- **New skills:**
  - new level-up cards and gun-tree branches;
  - a new tier of upgrades that only appears on Level 2;
  - every card passes the balance and verifier review.
- **Achievements:** a new Level 2 set (bosses, areas, secrets, weapon masteries) and a rebalance pass across Level 1 with the new rarity data.
- **Structure** (owner decision):
  - Level 2 unlocks after the Level 1 Liquidator clear;
  - players choose Level 1 or Level 2 at the start;
  - separate boards per level.
- **Ranked:** a verifier map table and rules for Level 2, picked by game version; Level 1 runs keep verifying.

---

## 7. Suggested order

1. **2.1a:**
   - the four finish-and-optimize items;
   - anti-cheat round 4 and boss real-run coverage;
   - Chikun anti-bot and STACKED piece-rate plausibility;
   - balance with real data plus the dashboard;
   - tech health.
2. **2.1b:**
   - *HMH:* prisoners, wave-2 evolutions, Settler Rail, then the Daily Run, post-run map, recap, codex and practice range, then the Weekly Contract, Bear Market and Endless Arena;
   - *Chikun:* missions ladder, challenges, daily ghost, then Night Loop, fork lanes, Snowpeak Pass;
   - *STACKED:* Ranked daily, Sprint and Ultra, then puzzles, replays, handling and stats.
3. **2.1c:** new achievements and the rebalance, tracking UX, trophy share cards.
4. **2.1d:**
   - profile level, continue-playing row, synced settings, accessibility centre;
   - leaderboard filters and run pages;
   - attract mode, first-visit tour, library, PWA, help centre;
   - growth items as the owner approves.
5. **2.2:** pick the Level 2 setting → art bible addendum → greybox → kits → enemies and bosses → weapons, power-ups and skills → achievements → verifier → certification.
6. **Minting:** when the owner decides (Appendix A).

---

## 8. Decisions for the owner

| # | Decision | Recommendation |
|---|---|---|
| 1 | Railgun values stay as they are (pierce, 35% fall-off, no boss one-shot)? | Yes; only fix what doesn't match |
| 2 | Weapon-wheel slow-motion in Free Mode only | Yes |
| 3 | Aim assist in Ranked: one fixed value for everyone | Yes (fairness) |
| 4 | HMH modes order: Daily → Weekly Contract → Bear Market → Endless | Yes |
| 5 | Chikun Night Loop and Snowpeak Pass (new course versions) | Yes |
| 6 | STACKED Sprint and Ultra Ranked boards; special-clear scoring only in those modes | Yes |
| 7 | Arcade profile level (cosmetic) | Yes |
| 8 | Privacy-friendly analytics | Yes |
| 9 | Submitting to the LitVM directory and an Arkada quest | Directory yes; the quest is the owner's call |
| 10 | The Level 2 setting | B, Silicon Tundra |
| 11 | Level 2 unlocks after the Level 1 Liquidator clear, with separate boards | Yes |
| 12 | Where and how to mint soulbound trophies | See Appendix A |
| 13 | All three arcade cabinets remade in 3D, shown as sprite strips, with an optional drag-to-spin viewer on game pages | Yes (§5, item 7); it can ship ahead of 2.1 |

---

## 9. Rules that still apply (from the 2.0 handoff §0.2)

- The HMH simulation stays deterministic; presentation never changes gameplay.
- New modes and rules ship as new versions, old runs keep verifying, and Chikun and STACKED replays stay exact.
- HMH actors are human survivors or zombies only.
- Stay within the JS, performance and repository budgets; tests don't depend on git.
- No deploy without the owner's approval; no chain actions without direct approval; never touch keys.
- Lester's Arcade only; commits end with the agreed co-author line.

---

## Appendix A: soulbound trophy minting options (for the owner's decision)

**Where things stand:**
- The **AchievementRegistry contracts** (one per game) are deployed on the LiteForge testnet (chain 4441).
- `achievement_unlocks` already has `nft`, `token_id` and `mint_tx_hash` columns.
- 2.0 makes every trophy **NFT-ready**: a 3D model (glTF), a poster image, and metadata (name, description, attributes, a stable id, a model hash).
- What's missing is the decision on **where, how, who pays, and where people see them.**

### A.1 Where to mint

| Option | Pros | Cons | Recommendation |
|---|---|---|---|
| **LitVM mainnet** (when it launches) | On-brand (the Litecoin EVM rollup); our contracts and relayer already target it; very cheap gas; strongest story for the LitVM community | Timing depends on LitVM's mainnet; a smaller NFT ecosystem than the big chains | **Recommended.** Mint on LitVM mainnet at the arcade's mainnet launch |
| **LitVM LiteForge testnet** (now) | Works today, free (faucet zkLTC); good for a "testnet pioneer" collection | Testnet tokens and history may reset; no lasting value; could confuse players about what's "real" | Optional "Pioneer" test run only, clearly labelled testnet |
| **Another L2** (Base, Arbitrum One, Polygon) | Big wallets and galleries, very cheap gas | Off-brand for a Litecoin arcade; bridging identity; new contracts and relayer setup | Not recommended |
| **Ethereum mainnet** | The most prestige | Gas far too expensive per player | No |

### A.2 How to mint

- **Standard:** keep the existing AchievementRegistry design: one collection per game, **non-transferable (soulbound)** tokens.
  - The ERC-5192 "minimal soulbound" interface is a common way to signal non-transferability to wallets and galleries.
  - The ERC-721 metadata points to the poster (`image`) and the 3D model (`animation_url`, a glTF/GLB file, which several galleries can display).
- **Claim, don't airdrop:**
  - the player presses **Claim** on the trophy in their profile;
  - the server checks the unlock (verified runs only), signs a mint authorization, and the **relayer sends the mint**, as it already does for scores.
  - That's **gasless for players**, avoids minting to inactive wallets, and gives a nice moment.
- **Only strong achievements:** the soulbound set only; never the four v6-forgeable HMH ones; anti-cheat round 4 first.
- **Revocation policy:** decide up front (for example the owner can burn a trophy proven to come from a cheated run), and state it on the rules page.

### A.3 Costs (estimates; re-check at decision time)

- **Gas:** a soulbound mint is about 100,000–200,000 gas.
  - On the LiteForge testnet, base fees recently ran about 0.01–1.7 gwei, so a mint costs about **0.0002–0.0003 zkLTC or less.** That's tiny, and the relayer already pays around 0.0001–0.0007 zkLTC per score settle.
  - LitVM mainnet should be similarly cheap (an Arbitrum Orbit rollup), but **measure it at launch**.
  - Example: 1,000 claims × 150,000 gas at 1 gwei is 0.15 zkLTC in total.
- **Media storage:** about 18–25 trophies × (a 1.5 MB model + a 1024 px poster) is **about 40–60 MB in total.**
  - **IPFS** with a pinning service: typically a small monthly fee at this size.
  - **Arweave:** pay once for permanent storage, typically a modest one-off amount for about 50 MB.
  - **Our own CDN** (Vercel): no extra cost, but less decentralised.
  - **Recommendation:** Arweave or IPFS for the tokens' `image` and `animation_url`, with the Vercel copy as the fast path on the site. Check current prices before choosing.
- **Engineering:**
  - a claim API, relayer mint queue, profile claim UI, explorer links, metadata endpoint, tests and a security review;
  - the contract upgrade or redeploy if the ABI needs changes (mainnet is a fresh deploy anyway).

### A.4 Wallets and roles

| Role | Holds | Notes |
|---|---|---|
| **Owner / admin** | The contract owner rights | The owner's wallet, ideally a hardware wallet; used only for admin |
| **Minter** | Permission to mint on each registry | A dedicated wallet (or the existing relayer) with the minter role only; its key in the vault and Vercel secrets |
| **Verifier signer** | Signs mint authorizations after checking unlocks | Already exists for runs (`verifier`); can sign claims too, or use a separate key |
| **Relayer** | Pays gas for mints | Already exists and funds itself from Ranked entries; watch `estimatedSettlesLeft` |
| **Players** | Receive the tokens | Their signed-in wallet; they pay nothing |

### A.5 Where people see them (community and platforms)

1. **The Lester's Arcade profile trophy room** (built in 2.0). It's the best showcase: 3D viewer, 35° tilt, rarity.
2. **Wallets:** MetaMask, Rabby and others show NFTs in their collectibles tabs where supported, including the image and metadata.
3. **The LitVM block explorer:** every mint links to its transaction and token page.
4. **LitVM ecosystem NFT platforms:** OmniHub and NFTs2Me are both active on LitVM (from the 2026-09-29 research). Ask whether they can display soulbound collections as a non-tradeable gallery. Soulbound tokens can't be bought or sold, so listing on marketplaces isn't the goal.
5. **X:** a trophy share card (2.0) plus an "on-chain" badge linking to the token.
6. **A launch moment:** a blog post and X thread, "Lester's Arcade trophies go on chain", timed with the arcade's LitVM mainnet launch.

### A.6 Steps when the owner decides

1. Choose the chain and timing (recommended: LitVM mainnet at the arcade's mainnet launch).
2. Choose media storage (Arweave or IPFS) and upload the trophy models and posters.
3. Finalize the metadata schema, the revocation policy and the rules page text.
4. Deploy or upgrade the registries on the chosen chain with a security review, and assign the minter role.
5. Build the claim flow (API, relayer queue, profile UI) and test it end to end on testnet.
6. Run a closed claim test with owner and test wallets, then open it to players. Watch relayer funds.
7. Publish the announcement.
