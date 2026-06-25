# Lester's Arcade / Hard Money Heroes — AAA Quality Roadmap

> **For Hermes:** Execute phase-by-phase. Each slice follows the `hard-money-heroes-level-production` skill gate (data → runtime → tests), commits incrementally, and HALTS before `git push` (production deploy to lestersarcade.io) until Justin explicitly approves.

**Goal:** Close the gap between what the site advertises and what ships, then lift art, animation, gameplay, and the portal toward AAA studio quality — building the foundation for a multi-game Web3 arcade integrated through the LitVM testnet smart contracts and a polished website UI/UX.

**Architecture:** Single-page portal shell (`apps/portal/main.js`, 10,821 lines) hosting an isometric run-and-gun roguelike (Hard Money Heroes) plus cabinet selection, wallet flow, leaderboards, and on-chain settlement. Pure logic lives in `apps/portal/src/*.mjs` (39 test files, ~454 tests). Work proceeds from pure helpers outward into runtime wiring, every slice tested and verified before commit.

**Tech Stack:** Vanilla JS + Canvas 2D, ES modules, `node:test`, Solidity contracts on LitVM LiteForge testnet, Vercel auto-deploy on push to `main`.

**Source of truth:** Repo code = implementation truth; `docs/game-design/` = design/canon intent; LitVM docs = chain details.

---

## Ground-truth verification (done 2026-06-24)

Confirmed against current `HEAD e1e06929` before planning — the report is accurate and current:

- **Bosses absent from iso runtime:** `updateCombatStep` returns at `main.js:5942` (inside `if (combat.roguelikeRun)`) **before** `updateBoss(difficulty)` at line 5948. The 10-boss roster only runs in the dead side-scroller branch. ✔ confirmed.
- **Side-scroller physics runs every step:** gravity / `velocityY` / jump reset at `main.js:5928-5933` execute before the iso branch, then are discarded. ✔ confirmed.
- **rAF loop never gates:** `requestAnimationFrame(drawCombatScene)` self-re-registers unconditionally at `main.js:9143` and bootstraps at `10821`. `getContext('2d')` called per-frame at `9081`. ✔ confirmed.
- **RNG not seeded:** 20 `Math.random()` calls in `main.js`; only one `roguelikeRun.seed` reference (line 5533). ✔ confirmed.
- **Docs drift:** README says "208 tests"; actual is ~454 across 39 files. main.js is 10,821 lines (README says ~8,200). ✔ confirmed.
- **No build step:** `package.json` has `test` and `check` but no esbuild/Rollup/minify. Raw 493 KB main.js served as-is. ✔ confirmed.
- **No `docs/plans/` previously.** This is the first.
- **Concurrent-writer check:** running `claude.exe` processes are the Claude Desktop app's own subprocesses (no `cowork-file` path into this repo); main.js mtime/size stable across samples. Safe to edit. Re-run the check before each main.js session (skill pitfall).

---

## Verification gate (run after EVERY slice)

```bash
npm test                              # full unit suite (~454 tests)
npm run check                         # syntax check every src/*.mjs + main.js + tests + py
npm run smoke:portal:interactions     # interaction smoke contract
npm run contracts:check               # contract structure check
```

After the run, revert the transient smoke file unless its contract intentionally changed:
```bash
git checkout -- docs/game-design/hard-money-heroes-interaction-smoke-plan.json
```

**New module rule:** every new `src/*.mjs` and its `tests/*.test.mjs` MUST be appended to the `check` script in `package.json`, or it is silently unchecked. This is the most common gate gap.

**Browser verification rule:** serve `apps/portal` as web root (`cd apps/portal && python -m http.server 8791`), expose `#developerBackstage` before judging the combat surface, and confirm `#combatCanvas` has non-zero dimensions + sampled non-background pixels — do not trust the public shell alone.

**Deploy gate:** `git push origin main` = live deploy to lestersarcade.io. Commit freely (local + safe); HALT before push; verify production custom-domain + cache-busted asset URLs after any approved push.

---

# PHASE 0 — Foundation & honesty (low-risk, unblocks everything)

Cheap wins that reduce confusion, payload, and credibility risk before the deep gameplay work. None of these touch combat balance.

### Task 0.1: Reconcile docs with the build
**Objective:** Stop misleading reviewers. **Files:** `README.md`, `docs/game-design/*` referencing side-scroller/test counts/line counts.
- Replace "Metal-Slug-style side-scroller" language with "isometric run-and-gun roguelite".
- Update test count 208 → current (run `npm test`, use the real number).
- Update `main.js` line count claim to actual.
- Note boss-roster status honestly (iso bosses = in progress, see Phase 1).
- **Verify:** `git grep -nE "side-scroller|208 tests|8,200"` returns only historical/changelog context. Commit.

### Task 0.2: Replace personal Gmail with a role address — DEFERRED
**Status:** Deferred per Justin (2026-06-24). No `@lestersarcade.io` alias exists yet; `kingdankkush420@gmail.com` stays in the ad slots/footer for now. Revisit once a role alias (`ads@` / `hello@lestersarcade.io`) is created — then `git grep -n "kingdankkush420@gmail.com" apps/portal`, replace all instances, and update any smoke marker asserting the old string.

### Task 0.3: Fix the accessibility viewport (WCAG 1.4.4)
**Objective:** Restore pinch-zoom site-wide. **Files:** `index.html` viewport meta.
- Remove `user-scalable=no` / `maximum-scale=1` from the global `<meta name="viewport">`.
- If zoom must lock during active combat, do it contextually on the canvas element only, not globally.
- **Verify:** gate green; browser pinch-zoom works on guide/codex. Commit.

### Task 0.4: Gate the render loop + cache the context
**Objective:** Stop burning CPU/battery on menus. **Files:** `main.js` (`drawCombatScene` ~9079-9143).
- Cache `getContext('2d')` once at init instead of per-frame.
- Early-out the heavy draw when not in combat: `if (!combat.active && !combat.gameOver) { requestAnimationFrame(drawCombatScene); return; }` (or pause the loop entirely when canvas not visible).
- Keep the try/catch guard but add a dev-only visible error badge when it trips repeatedly (section 17 LOW).
- **Verify:** gate green; browser — menu screens idle near 0% canvas work, combat still renders. Commit.

### Task 0.5: Establish a production build (minify + tree-shake)
**Objective:** Cut payload >50% (combined with Phase 1 dead-code deletion). **Files:** `package.json`, new `build.mjs` or esbuild config, `vercel.json`.
- Add esbuild as the production bundler for `main.js` (and split modules later, Phase 6). Wire into the existing Vercel build gate.
- Content-hash the output filename OR auto-bump `CACHE_VERSION` in the service worker as part of the build, so art/code updates never serve stale.
- **Verify:** build produces a minified bundle; `npm run check` still checks source; browser loads the minified bundle and plays. Measure old/new bytes and record them. Commit.

---

# PHASE 1 — Close the integrity & credibility gaps (report P0)

The highest-impact work. After this phase the game delivers on its own pitch and the leaderboard is honest.

### Task 1.1: Route all gameplay RNG through a seeded PRNG
**Objective:** Determinism — the prerequisite for replay verification, daily seeds, and reproducible bugs. **Files:** new `src/seeded-rng.mjs` (+ test), `main.js`.
- Create a pure seeded PRNG (mulberry32 or similar) stored on `roguelikeRun.seed`.
- Replace gameplay `Math.random()` (power-up drops keyed on `(combat.frame + combat.kills) % 12`, boss super on `combat.frame % 3`, spawn selection, drop rolls) with seeded draws. Leave purely cosmetic shake on `Math.random` if it never affects sim state.
- Add module + test to `package.json` `check`.
- **Verify:** new test proves same seed → identical sequence; gate green. Commit.

### Task 1.2: Headless deterministic run smoke test
**Objective:** Lock determinism + catch iso-runtime regressions the unit tests miss. **Files:** new `tests/iso-runtime-smoke.test.mjs` or `scripts/`.
- Drive `updateRoguelikeCombatStep` headless for a fixed seed + scripted inputs over ~60 sim seconds; assert deterministic final score/kills/positions.
- Add to `package.json` `check`. **Verify:** runs green twice identically. Commit.

### Task 1.3: Remove side-scroller physics from the iso path
**Objective:** Stop computing+discarding gravity every iso step. **Files:** `main.js:5928-5933` and `updateCombatStep`.
- Move gravity/velocityY/jump/crouch ahead-of-branch logic into the legacy branch only (or guard behind `if (!combat.roguelikeRun)`).
- **Verify:** iso smoke test (1.2) unchanged; legacy path still syntactically intact (it's deleted in 1.5, but keep tests green in between). Commit.

### Task 1.4: Enemy separation + obstacle/water avoidance
**Objective:** Fix the single most visible "feels broken" issue. **Files:** new `src/enemy-steering.mjs` (+ test), `main.js` `updateRoguelikeEnemies`.
- **Separation:** pure helper summing capped inverse-distance repulsion from neighbors within ~1 tile, so the swarm spreads into a readable crescent instead of stacking on one pixel.
- **Obstacle/water avoidance:** reuse `resolvePlayerCollision` / `resolveWaterCollision` (or a "if next step blocked, slide along obstacle normal" approximation) so enemies stop clipping buildings the player must walk around.
- Keep `maxEnemiesOnMap` sane (the cap math at `main.js:5973`/`7397` allows huge blobs — verify the separation makes high counts readable, or cap lower).
- Route chase speed through the existing `calculateEnemyChaseSpeed(...)` discipline (skill pitfall: never multiply catalog speed by elite/pressure/POI in the runtime).
- **Verify:** helper tests + browser playtest at pressure — enemies spread and respect walls. Commit.

### Task 1.5: Port the 10-boss roster into the isometric runtime (THE headline fix)
**Objective:** Deliver the advertised bosses. **Files:** new `src/iso-boss-patterns.mjs` (+ test), `main.js`, possibly `hmh-campaign-levels.mjs` boss metadata.
- Extract the worth-keeping pattern bones from the dead `updateBoss`/`spawnBoss` (phase 1/2/3 escalation at 66%/33%, super moves, roster identities) into a pure iso module.
- **Translate patterns to iso, do not reuse verbatim:** "floor-shockwave" → expanding ground rings to dash through; "safe-lane-sweep" → rotating bullet sweep with a safe wedge; add telegraphed slam AoEs and body-blockable homing orbs. Reuse the grenade landing-shadow telegraph for floor decals.
- Spawn at the PROJECT.md cadence ("every 3-5 min") via the existing `scriptedBossTriggered` / `extractionPoint` / arena-lock hooks. Boss centered, clear arena, room to kite.
- Add a soft enrage timer alongside HP-gated phases.
- Distinct silhouette + intro sting + unique reward (guaranteed weapon-tree card or meta unlock) per boss.
- Keep minibosses clearly a step below (name banner + health bar, no full arena lock).
- Add module + tests to `check`. **Verify:** browser — a real telegraphed phase fight runs in iso mode; iso smoke covers a boss trigger. Commit per boss or per pattern-group.

### Task 1.6: Delete / quarantine the dead side-scroller engine
**Objective:** Shrink payload, kill the "which engine am I editing" confusion. **Files:** `main.js`.
- Only after 1.5 has ported the patterns worth keeping. Delete `updateStageDirector`, `updatePlatformingAndProps`, `updateBullets`, `updateEnemies`, `updateBoss`, `spawnEnemy`, `spawnBoss`, `spawnMiniBoss`, `beginStageEngagement`, `startNextWave`, and side-scroller `drawBackground/drawEnemies/drawBoss/drawBullets/drawPlayer`.
- Remove now-dead tests; update any that referenced the legacy path.
- **Verify:** gate green; measure main.js line/byte reduction; re-run minified bundle size from 0.5. Commit.

### Task 1.7: Server-side score verification for ranked (anti-cheat)
**Objective:** Make the paid leaderboard honest before any real-funds launch. **Files:** new serverless verifier (Vercel function), `main.js` event-log recorder, `settlement.mjs` / `SessionLedger.closeSession` path.
- Record a compact append-only event log during a run (spawn seeds, inputs at fixed-step indices, kills).
- On run end, POST log + claimed score to a serverless verifier that re-simulates the deterministic core (enabled by 1.1) and signs an EIP-712 attestation only if recomputed score matches.
- `closeSession()` requires that signature.
- **Until shipped:** label ranked "prototype, unverified" in the UI so the board's meaning stays honest.
- Also resolve **abandoned-run policy** (closed tab mid-ranked = clean forfeit, no double charge, or resume) and **mid-run chain switch / wallet lock** handling (`refreshInjectedChainId`).
- **Verify:** verifier rejects a tampered score, accepts a clean one; contract path test green; gate green. Commit. **Note: this is the gate before any paid launch — flag explicitly to Justin.**

---

# PHASE 2 — The quality leap (report P1)

Performance, game feel, and content parity. This is where it starts feeling AAA.

### Task 2.1: Render-path allocation fixes
**Objective:** Kill per-frame GC churn. **Files:** `main.js` `drawRoguelikeScene`.
- Replace the per-frame `renderList` of `{depth, draw:()=>...}` closures + `.sort()` with a reusable pre-allocated array of plain entries (indices, not closures) + insertion sort or bucketed depth bands.
- **Verify:** iso smoke green; browser frame profile shows reduced allocation. Commit.

### Task 2.2: Pre-render XP coins to a sprite atlas
**Objective:** Stop `fillText('Ł')` + canvas paths per coin per frame. **Files:** `main.js`, offscreen canvas init.
- Pre-render coin rotation frames once to an offscreen canvas / atlas; blit per coin. Keep the squash-stretch.
- **Verify:** gate green; browser with magnet build + many coins stays smooth. Commit.

### Task 2.3: Standardize timing on seconds (dt-based)
**Objective:** Remove fragile mixed frame/dt timing. **Files:** `main.js` (`attackTimer -= 1`, `invulnerableFrames`, `recoveryFramesRemaining`, cooldowns).
- Convert integer-per-step decrements to dt-scaled seconds. Unlocks future slow-mo/variable-step.
- **Verify:** iso smoke determinism holds (re-baseline if needed). Commit.

### Task 2.4: Single-pass kill loop + render interpolation + canvas resolution
**Objective:** Misc perf + crispness. **Files:** `main.js`.
- Replace double `filter` in `updateRoguelikeEnemies` with one walk (collect dead, swap-remove survivors).
- Add render interpolation (`accumulatorMs / FIXED_STEP_MS`) using prev/current positions for smooth motion on 120/144 Hz.
- Bump canvas backing resolution by DPR (capped) above the 760×340 base; cache the static night tint to an offscreen layer, recompute only dynamic light pools.
- **Verify:** gate green; browser on high-refresh display smooth, sprites crisp. Commit per sub-item.

### Task 2.5: Dash polish + gamepad support
**Objective:** Core skill expression + arcade/couch fantasy. **Files:** new/existing input abstraction, `main.js`, HUD.
- Confirm dash is bound (250ms i-frames, 900ms cooldown per DECISIONS), add a HUD cooldown ring + i-frame feedback so it reads distinct from walking.
- Wire the Gamepad API: left stick move, right stick aim, triggers fire/dash. Hoist movement magic numbers (4.15 speed, 0.45 dead zone, 0.42 collision radius) to the balance config.
- Add a subtle aim reticle + hero facing arc; soft target-lock preferring the enemy nearest the aim vector.
- **Verify:** gate green; browser + controller playtest. Commit.

### Task 2.6: Differentiated enemy behaviors + varied telegraphs
**Objective:** Make roles feel distinct. **Files:** `main.js`, enemy definitions, `combat-sprite-bridge.mjs`.
- Move the repeated `enemy.id === 'claim-jumper' || ...` checks to **data flags** on enemy definitions (`windingUp`, `burrowing`, `lunging`, `reloads`).
- Real role movement: circle-strafers orbit at `desiredDistance`, flankers approach the rear arc, `scorpion-ambusher` burrows + surfaces, `coyote-pack-runner` lunges in coordinated waves.
- Aimed-with-lead for snipers, spread fans for shooters, predictive aim for elites. Vary telegraph length + distinct visual per attack type. Give elites one unique mechanic each (shielded front / splits on death / hazard pool).
- **Verify:** behavior helper tests; browser readability. Commit per behavior group.

### Task 2.7: Hit-stop + sprite-based VFX
**Objective:** Combat juice. **Files:** `main.js`, `combat-vfx.mjs` (`productionVfxFrame`).
- Add hit-stop (freeze sim 2-3 frames on heavy hit/kill), directional knockback dust, crit scale/chromatic pop. Tie screen-shake magnitude to event weight (respecting reduce-motion, and a stronger "reduce flashing" option).
- Layer sprite-based bursts from the VFX pipeline for hits/criticals/boss phase changes; keep muzzle flash as the single static barrel flash (skill pitfall). Bigger celebratory burst on level-up/power-up.
- **Verify:** iso smoke determinism holds (hit-stop must be deterministic); browser feel check. Commit.

### Task 2.8: Level 2 content parity + authored hazard zones + minimap
**Objective:** Both levels content-complete, not one + palette swap. **Files:** `hmh-campaign-levels.mjs`, `district-generator.mjs`, `hmh-campaign-runtime.mjs`, `main.js`.
- Verify/author L2 (Litecoin City) POIs, district-specific enemy bias, landmarks, hazards (5 POIs per skill canon: Litecoin Square hub, DeFi Harbor, Financial Downtown, MimbleWimble Grove, Hashrate District).
- Place authored hazard zones using the already-coded `applyEnvironmentalForces` (heat vents, electrified cables, oil slicks, toxic clouds) per district — wire real movement/stat effects, not labels.
- Make the minimap **core** (not a power-up): directional indicators for extraction, active boss, nearby elites. Confirm landmark gameplay hooks (`toxic_cloud`, `reveal_minimap`, `disable_cameras`, `hidden_loot`) actually fire in the iso runtime.
- Verify destructible chains (`destructible-chains.mjs`) are placed + rewarding; add interactive POIs (ATM XP→buff, vendor, hackable camera, hidden stash).
- **Verify:** campaign tests (≥5 POIs, hub `lane:'hub'`, each POI telegraph + mini-boss ≥2 phases + reward + risk/reward read); browser L2 playthrough. Commit per district/system.

### Task 2.9: Clear level-up card UI + post-run breakdowns
**Objective:** Surface the best content + make scoring legible. **Files:** `main.js` level-up modal, game-over screen, `calculateLesterBlasterScore`.
- Level-up cards: show what each does, current tier, synergy hints, with reroll + banish (`rerollsRemaining`). Confirm XP curve hits intended cadence (capped kill XP per skill pitfall); add magnet radius indicator.
- Post-run score breakdown (time/kills/combos/no-damage/power-ups/difficulty/XP bonus). Live combo meter + decay timer mid-run. Build summary on game-over (skills, weapon path, `killsByType`).
- **Verify:** gate green; browser modal + game-over readable. Commit.

---

# PHASE 3 — Finish & broaden (report P2)

### Task 3.1: Coming-soon cabinet teasers + keyboard nav + onboarding example
- Each locked cabinet (Chikun, Lilly's Lightning Pinball) gets a looping teaser, one-line pitch, "notify me" capture. Arrow-key navigable grid with visible focus ring + Enter to load. Loading skeleton/blurhash for the grid. Document the third-party onboarding contract end-to-end with a working example cabinet (`chikun/loader.mjs` is the only reference).
- **Verify:** browser cabinet flow + keyboard nav. Commit.

### Task 3.2: Accessibility + options pass
- Reduced-flashing mode (stronger than reduce-motion: damps lighting pulses + crit pops; seizure safety). Text alternative for canvas. Assist mode (slower enemies, more i-frames, auto-aim) as a separate inclusive board; ranked Assist-Off stays competitive default. Options: master/music/SFX volume sliders, brightness, input remapping, left-handed touch layout. Confirm `saveGameSettings` survives hard refresh + applies before first frame. Pause menu completeness (resume/restart/options/quit-to-cabinet, sim+timer freeze together incl. level-up modal via `buildCombatPauseGate`). Modal focus trap + return-to-trigger.
- **Verify:** gate green; browser a11y checks. Commit per group.

### Task 3.3: Re-shoot iso key art + finish 8-directional sprite pass
- Re-shoot Level 1 key art as isometric Crypto Wasteland (current JPGs are legacy side-scroller parallax — they misrepresent the game on splash/cabinet). Confirm heroes + enemies have run/shoot/melee/throw/hurt/death frames per direction (real 8-dir, not 4-dir mirrored). Extend the `hero-sprite-lock.test.mjs` lock to enemies + bosses. Add squash-stretch easing on dash/hit/death + soft contact shadows. Resolve placeholder-vs-final art honestly on the live site (finish a clean first pass or keep the disclaimer; no text-artifact AI drafts representing the shipped look).
- **Verify:** sprite-lock tests; `npm run assets:verify`; browser + live PNG check after deploy. Commit.

### Task 3.4: Module split of main.js + iso integration tests + service worker UX
- Break `main.js` into ES modules (portal-shell, wallet, hud, iso-runtime, iso-render). Add offline fallback page + "new version available, refresh" toast. Confirm OG image renders 1200×630. Final doc/codex cleanup; move design-codex content out of shipped HTML to `/docs`.
- **Verify:** full gate + iso smoke after each extraction; browser regression. Commit per module.

---

## Suggested execution order (mirrors report priority, sequenced for safety)

1. **Phase 0** (all) — fast, low-risk, unblocks measurement and removes credibility/privacy/a11y gaps.
2. **Phase 1.1 → 1.2** — determinism + smoke first (foundation for everything).
3. **Phase 1.3 → 1.4** — strip iso physics, fix the swarm (most visible feel fix).
4. **Phase 1.5 → 1.6** — port bosses, then delete the dead engine.
5. **Phase 1.7** — anti-cheat (**hard gate before any paid launch**).
6. **Phase 2** in order (perf → feel → content → UI).
7. **Phase 3** to finish and broaden.

**The single strongest move this week: Phase 1.5** — the moment a real telegraphed boss phase fight runs in iso mode, the game stops advertising bosses it doesn't have.

## Per-slice discipline (every task)
- Concurrent-writer check before touching `main.js`.
- Data → runtime → tests in the same slice; add new modules+tests to `package.json` `check`.
- Run the 4-command gate; revert the transient smoke JSON.
- Commit incrementally with a clear message.
- HALT before `git push`; summarize commit count + test count + what changed + that pushing goes live; wait for explicit approval; verify production after.
