# Hard Money Heroes — session handoff for the next agent

Written 2026-09-12 by Claude (Fable 5.1 / Opus 5) at the end of two working sessions against the 2026-09-11 comprehensive vision roadmap. It records exactly what shipped, what is half-finished, and what is left, so another agent can pick the work up without re-deriving anything.

Two rules for whoever reads this next:

1. **Every claim here was measured, not assumed.** Where something is unverified it says so. Do not upgrade a "recorded" item to "done" without running the gate yourself.
2. **Re-verify before acting.** Fetch first, read the live branch, and re-check line numbers. Another agent (Hermes) ships from a different checkout on `hermes/*` branches, so this branch can go stale quickly.

---

## 1. Orientation

| Fact | Value |
| --- | --- |
| Repository | `https://github.com/kingdankkush/lesters-arcade` |
| Working branch | `fable/hmh-roadmap-pass-20260911` (HEAD `89917367`) |
| Cut from | `hermes/hmh-textured-rollout` at `b0ee9046` |
| Live site | `https://lestersarcade.io` |
| Live production deployment | `dpl_H8HskA2fttzXpdVHc8GyAcXccd9g` (source `1a8d4f42`) |
| Rollback target | `dpl_E6U69q1pgn6LTw5LGdtgayXMJhyg` (source `cad94e7d`) |
| Production cache marker | `lesters-arcade-v36-hmh-package` |
| Release gate on HEAD | 3,451 tests, 3,400 passed, exactly 51 documented retirement exceptions |
| Initial child JS | 1,041,489 B of a 1,048,576 B cap — **7,087 B of headroom left** |
| Tracked repository size | 696 MB (see §7, this has grown well past the recorded figure) |

### The game

Hard Money Heroes is a deterministic PixiJS 8 top-down run-and-gun inside the Lester's Arcade portal. The child game lives in `apps/hmh-reboot/src`, the parent portal in `apps/portal`. Fixed 60 Hz simulation, maximum four catch-up steps, game alias `hmh`, game id `lester-blaster`, profile `wo71`, save schema `2`, bridge `hmh-bridge/v1` with a 65,536-byte message cap. Level 1 ("The Forked Frontier") is 12000x4800 across six districts.

**The determinism rule is the one that bites.** Anything affecting damage, movement, spawning, scoring, RNG order or results must be a pure function of the integer tick plus authored data plus seeded RNG streams, so a same-seed replay matches. Art and HUD code is "projection-only" and must be unable to reach results. `Math.random` and `Date` are banned in both; use `deterministic-hash.mjs`.

### Commands that matter

```bash
npm run test:release        # the gate: must print HMH_REBOOT_TEST_RETIREMENT_GATE PASS with exactly 51 expected failures
node scripts/syntax-check.mjs
node build.mjs              # prints the HMH initial JS + shared bytes and headroom
npm run vercel:build        # the full chain Vercel runs: assets, gate, syntax, contracts, build
```

Browser smokes live in `scripts/*.mjs` and drive Playwright from `benchmarks/hmh-engine-bakeoff/node_modules` with Chrome at `C:\Program Files\Google\Chrome\Application\chrome.exe`. Serve the portal first (`python -m http.server <port> --bind 127.0.0.1 -d apps/portal`) and point `HMH_REBOOT_ORIGIN` at it. Run them one at a time; parallel runs fight over ports and the GPU.

Deploy is `npx vercel deploy --yes` for a preview, then `npx vercel promote <dpl> --yes`. Never `vercel --prod`. Promotion takes a few minutes and the alias moves only when the new production build reaches Ready.

---

## 2. What shipped in these sessions

Two releases went live. Both passed the unchanged release gate locally and in Vercel's cloud build, and both were byte-verified against the public alias afterwards.

### Release 1 — insertion-point briefing (source `cad94e7d`)

Before doing anything I reconciled the roadmap against the live source. **Most of the roadmap's owner directions were already built** in the `3e45dfa4` → `b0ee9046` lineage and the roadmap had simply been written from an older play session. Confirmed live, not rebuilt: the torso clamp (one octant, never a 360 degree spin), the wider camera (a 10 percent body-height floor, about 17 percent wider than before), face-on bust portraits on the select screen, the Level 1 loading panel, five seeded spawn points, pickup indicators, gore and corpses, six enemy archetypes, three boss phases, 85 audio files, profiles and leaderboards, and the contract set.

What I added:

- **`apps/hmh-reboot/src/level-briefing.mjs`** — per-insertion-point briefing on the loading panel: an objective, a watch-for line, the nearby supply, and one of six field tips chosen by a separate FNV-1a hash of the session seed (its own label, so it consumes no combat RNG). Later levels can supply their own table under their own `levelId`.
- **Proof that the copy is true.** `tests/hmh-level-briefing.test.mjs` checks every cited arena, point of interest and machinery site against the authored world: it must exist, sit within 1,500 units of the entry, lie on the stated 8-way compass bearing, and named weapon caches must resolve to the shipped collectible and weapon display name.
- **Spawn-safety proofs** in `tests/hmh-level-entry.test.mjs`: blocker clearance above 48 units including polygon blockers, 200 units from landmarks and 120 from set pieces, placement on the main route inside a district with two route-valid spawns, and the encounter director opening a fight under its real rules from each start. Measured opening spawn distances: relay 1,970, ravine 1,404, hashwood 1,412, mining 1,201, yard 1,304 units.

### Release 2 — the gameplay and feedback package (source `1a8d4f42`)

Five slices, each built by a separate agent in an isolated worktree, then put through three adversarial reviewers (determinism, correctness, scope), a fix round and a release-gate verifier before being merged.

| Slice | New module | What the player sees now |
| --- | --- | --- |
| **Reload presentation** | `reload-presentation.mjs` (dynamic import) | On the aim and hurt poses the weapon layer dips and tilts over the first quarter of a reload and snaps level on the completion tick; shotgun, machine gun, rail and launcher props dip with it. The cockpit card gains an amber progress bar under the pips, an ammo-low tint on the last quarter of a clip, a red reserve when the pocket cannot fill another clip, a one-frame ring pulse and a six-tick muzzle glow on completion. |
| **Enemy hit feedback** | `enemy-hit-feedback.mjs` (dynamic import) | A landed hit flashes the body pale red for two ticks, knocks it against the blow and eases back, squashes it in proportion to damage and knockback resistance, and sprays grey or blue shards off armoured, shielded or support-pulsed bodies. A hit landing during a tell or strike is visible where it never was. |
| **Simulated hazards** | `world-hazards.mjs` (static) | The ravine rockfall warns for 1.1 s with a collapsing ring and swelling slab shadows, then lands 24 damage every 5 s. The liquidation grid blinks faster and pulses 14 damage every 4 s. The hashwood spore bed slows hero and enemies to 55 percent. The mining conveyor pushes both 150 units/s along its axis. Dashing dodges the hits. |
| **Run recap** | `apps/portal/src/hmh-run-recap.mjs` + run-summary schema 6 | The game-over panel shows the cause of defeat (killer archetype, boss attack, hazard or own grenade with damage and clock), the build (weapons with kill counts, augments with ranks), milestones (level-ups, machinery operated, secrets found, boss engaged) and a run row (seed, max combo, level, survival). The Bosses metric reads the real count instead of always zero. |
| **Power-up timers** | HUD chips | Each chip carries its effect's colour and accent, drains continuously across its 600-tick window, pulses in the last two seconds with the hero aura breathing in step, pops once on a refresh, and an expiry cue plays when a buff ends. The briefing now says a repeat pickup restarts the timer rather than stacking. |

Design decisions worth knowing, because they came out of review and are easy to undo by accident:

- **The dry-fire click was removed, deliberately.** The reload brief asked for one, but the shipped input model has no manual trigger (`input.mjs` writes `fire: false` on every path; autofire is the fire request), so the click could only fire on phantom edges such as a mouse waking after idling. A test now fails if a projection trigger edge is re-added.
- **Hazards stop at 1 HP on the Liquidator.** A hazard killing blow would have bypassed the boss-defeat authority path and lost the kill from the run summary, XP and combo. Environmental kills award no XP and no attribution.
- **Run-summary schema 6 is additive.** v1 through v5 records still validate and render.
- **Determinism held.** The enemy soak hash is unchanged; the hazard schedules are pure functions of the integer tick and frozen anchors with no RNG.

### Evidence scripts corrected along the way

Four smoke scripts had drifted from the shipped game and were failing for reasons unrelated to any change. Each was proven pre-existing on the untouched base before being corrected:

- The boss-presentation smoke asserted `boss-warning.ogg` while the runtime has played `hmh-boss-phase.wav` since `3e45dfa4`.
- The combat smoke waited for a second enemy archetype while the shipped XP ramp raises a level-up offer that pauses the run at tick 732; it now accepts the upgrade while waiting.
- The collectible smoke read total run XP (which includes kill XP under the shipped opening balance) and demanded two live enemies. The pickup's own award is now published as `dataset.collectibleLastXp` and asserted directly.
- The hero-selector smoke asserted rest-frame index 6 from the retired eight-direction turntable; the select screen has shown the portrait strip since `3e45dfa4`.

---

## 3. Work in flight right now

### 3.1 Unmerged branch: `fable/wf3-selector-height-20260912` (commit `1b14cd00`)

**Status: implemented and self-gated, never independently reviewed or verified.** The reviewers and verifier for it died on a usage limit. Treat it as a candidate, not as accepted work.

It fixes the phone hero-select page, which measured 1,866 px against its own smoke's 1,800 px guard. The fix is CSS-only inside the `@media (max-width: 700px)` carousel block of `apps/portal/styles-arcade-polish.css`: the phone padding now applies to `#officialCharacterRoster .hero-card` (Cycle 013 wrote it against a `.hero-card-inner` class that is never emitted), a dead 46 px stage min-height is removed, a dead bio line-clamp is deleted, roster padding is tightened. Result 1,769 px with every other selector assertion intact. It also adds `scripts/lib/select-stylesheet-audit.mjs`, a Node-only CSS audit module with behavioural tests that catch rules written against class names nothing renders.

The implementer reported the gate passing at 3,462 tests with 51 expected failures, zero bundle delta, and both named smokes green.

**To land it:** review it (determinism is not a concern; correctness and scope are), merge it into `fable/hmh-roadmap-pass-20260911`, re-run the gate, bump the cache token, and deploy. One caveat the implementer recorded: between 421 and 700 px the card stage now falls back to the desktop 210 px height, a band the smoke profiles do not cover.

### 3.2 Three investigations complete, implementation never started

Full root-cause investigations are committed under `docs/handoffs/investigations-20260912/`. They were produced by read-only agents that cited file paths and line numbers against `89917367`; re-verify line numbers but trust the mechanisms.

- **`mobile-pause.md`** — the phone pause menu is broken and this explains exactly why. Two layers: `styles-arcade-polish.css` sets `.arcade-music-player { position: static }` inside `@media (max-width: 720px)` and wins the specificity tie because it loads after `styles.css`, so the jukebox is laid out in normal flow; the pause-deck rules set offsets but never re-assert `position`, so they are no-ops; and because `.official-app` is a flex container, the static flex item's z-index still creates a root-level stacking context above the gameplay view. The collapsed launcher lands on top of `#combatMenuIconButton` at (354, 36). There is a second, separate domino: the reboot pause branch in `main.js` never pauses the jukebox, so the e2e's "play" click pauses it instead. This is the single highest-value open fix: it is what makes five of seven mobile end-to-end flows fail.
- **`combat-smoke.md`** — maps which steps of `scripts/hmh-reboot-combat-browser-smoke.mjs` are still live and which drive retired manual controls (Digit2/3/4 weapon swaps, Space to fire, KeyE melee, KeyG grenade, Shift dash), plus the shipped telemetry that could cover the same ground through cache tours and automatic actions. It proposes a full rewrite.
- **`selector-height.md`** — the investigation behind the branch above.

### 3.3 Deferred with reasons, investigations ready

Also under `docs/handoffs/investigations-20260912/`:

- **`destructibles.md`** — the eight authored `DESTRUCTIBLES` (barricades, deadfalls, pallets, a container lock; 80 HP each) exist in `level-one-world.mjs` but nothing in the runtime references them. The investigation shows how the secret seal in `world-design-secrets.mjs` already works as a shootable world object that removes its collision blocker and refreshes navigation, which is the pattern to generalise. Deferred from the package because it collides with the hazards slice on the same `main.mjs` target-list regions.
- **`hazards.md`** — the hazards half shipped; its **explosive-zone design is still open**. Three `EXPLOSIVE_ZONES` are authored with radius and `chainCap: 4` and are art-only. The design has barrels primed by a player hit or grenade, a warned fuse, radial damage with the boss clamp, chaining, and attribution to the triggering weapon so kills award XP. Ship it with destructibles; they touch the same code.
- **`shake-and-impacts.md`** — a camera-shake intensity setting (today `screenShake` is a boolean) and impact differentiation across the five surfaces `weapon-vfx.mjs` already defines. Deferred because it touches the persisted settings schema, the bridge, the pause panel and three pinned test files for a moderate payoff.
- **`audio-weight.md`** — a metrics-driven pass on the 37 synthesised weapon cues (peak, RMS, crest factor, spectral centroid, sub-100 Hz energy, pure-Python since the Vercel image has only Pillow). **Blocked on two things:** listening acceptance is the owner's, and regenerating the WAVs needs the pinned CPython 3.12 interpreter while this machine runs 3.14.

---

## 4. Remaining work by roadmap section

Status vocabulary: **done** (shipped and gated), **partial** (some shipped), **open** (nothing built), **owner-gated** (needs a decision), **external** (needs a device, wallet, person or paid service).

| § | Area | Status | What is actually left |
| --- | --- | --- | --- |
| 5 | Playable heroes | partial | Four native heroes, nine clips each, 648 frames, 8 directions, four-layer split, 384 px portraits. Left: skinning, waist-seam, foot-planting and likeness polish. These are Blender passes plus owner visual acceptance, not code. |
| 6 | Animation and movement | partial | Torso clamp, independent leg/torso direction, interruptible actions and enemy pose refresh all ship. Left: idle personality clips, turn-in-place, coat/hair follow-through. All unbuilt, all proposals rather than commitments. |
| 7 | Camera, selection, boot, loading | done | Wider camera, bust portraits, briefing panel with per-entry copy. The phone select page height fix is the unmerged branch in §3.1. |
| 8 | Enemies | partial | Six archetypes with roles, tells, counterplay copy and six visual states; navgrid and flow-field pursuit; hit feedback and measured tell timings now ship. Left: reference sheets for the remaining roles (**owner-gated**, register `E-2`), and the stagger/armor-break *simulation* (only the feedback is projection today). |
| 9 | Liquidator boss | partial | Three phases, eight attacks, an authored plan and a deterministic endless loop past 3600 ticks. Left: multi-build balance measurement and cinematic pacing. |
| 10 | Weapons, combat, effects, gore | partial | Eight weapons with per-weapon VFX and SFX; reload presentation done. Left: native held and world models for every weapon (register `H-7`/`R-4`), the Tripo prop wave (**owner-gated**, `R-2`), impact differentiation and the shake setting (§3.3). |
| 11 | Sound design | partial | 85 audio files, 37 synthesised weapon cues with per-cue provenance and sha256, category mix caps. Left: the Doom/Duke weight pass (§3.3) — **owner-gated** on scope (`S-1`) and on listening. |
| 12 | Level 1 world | partial | Six districts, ten points of interest, six machinery sites, three discoveries, five alternate routes, campfire embers, field map, and now four simulated hazards. Left: destructibles and explosive zones (§3.3), canopy composition, yard repetition and seams, haze density (**owner-gated**, `B-11`). |
| 13 | Exploration and interactivity | done | Automatic machinery, gates, secret seal, ledge and lore rewards; controls unchanged. |
| 14 | Pickups and power-ups | done | Ten authored collectibles plus scheduled drops, indicators, and the timer chips. |
| 15 | Balance, progression, achievements | partial | Upgrade catalog, XP, combo milestones, daily and weekly Free challenges with seed sharing, achievement progress and dates, and now the post-run recap. Left: actual balance numbers, which need playtest measurement (**external**). |
| 16 | Performance and QA | partial | Bundle budget gate, load-speed report, retirement-gated suite, about thirty Playwright smokes. Left: real-phone testing (**external**), and the stale evidence in §6. |
| 17 | Profiles and durable sessions | partial | Local profile history, provenance filtering, submitted-session ledger, schema 6 recap. Left: durable server-side Ranked history — a separate unbuilt system. |
| 18 | Wallet and LitVM Testnet | **external** | Provider selection, a fresh chain-id re-check before broadcast, six deployed addresses and an ABI alignment test all exist in source. Real MetaMask and Rabby exercise needs a human with a wallet. |
| 19 | Ranked entry through settlement | **owner-gated** | See §5 — there is a live contradiction here. |
| 20 | Leaderboards and achievement NFTs | partial / external | Provenance filtering and cadence boards exist. On-chain minting readback needs a real wallet and the mint-authority decision. |
| 21 | Contracts and Mainnet | **owner-gated** | Untouched. `SETTLEMENT_LIVE=false`. |
| 22 | Lester's Arcade portal | partial | Ad-strip containment and narrow-screen work deployed. Left: the phone pause defect (§3.2), trust pages (`L-9`), banner cabinets (`L-4`), seeded house scores (`L-2`) — the last three **owner-gated**. |

---

## 5. Decisions only the owner can make

No agent should resolve these. They are recorded in `docs/hmh-reboot/OPEN-WORK-CURRENT-STATUS.json` by register id.

- **`E-2`** enemy reference sheets for the six roles plus three Liquidator phases.
- **`R-2`** the Tripo organics wave (trees, boulders, wrecks, stumps, debris).
- **`W-9`** town district: convert part of the yard, or add a seventh district.
- **`S-1`** audio expansion scope.
- **`B-11`** mining-camp haze density.
- **`L-2`** seeded house scores on public leaderboards.
- **`L-4`** banner-only cabinets visible or hidden.
- **`L-9`** trust pages: privacy, terms, support, accessibility, testnet disclaimer.
- **`N-2`** legacy asset triage, about 17 MB of superseded art.
- **`B-9`** the repository size limit (see §7).
- **`owner-playtests`** five desktop and five mobile first-time sessions.
- **`WEB3:B-1` through `B-5`** the separately gated Web3 preparation items.

### The Ranked pricing contradiction

This one needs stating plainly. The roadmap records a Testnet entry cost of at least **0.1 zkLTC**. The runtime charges nothing: `arcade-core.mjs` sets `DEFAULT_ENTRY_FEE_MICRO_USDC = 0` with the comment that Ranked is free on testnet. Meanwhile `ArcadePaymentRouter.sol` and `SessionLedger.sol` both require a non-zero entry fee. Those three facts cannot all be right. Picking the resolution is a financial decision and belongs to the owner. Nothing in these sessions touched fees, contracts, wallets or settlement.

---

## 6. Known failing or stale evidence

Reproduced on the untouched base each time, so none of it was introduced by this work. An agent picking up the repo will hit these and should not chase them as regressions.

| Script | State |
| --- | --- |
| `scripts/hmh-reboot-portal-e2e.mjs --profile=mobile` | Five of seven flows fail (`guest-free-run`, `pause-resume`, `mid-run-restart`, `settings-persistence-reload`, `guest-exit-to-splash`). Root cause fully mapped in `investigations-20260912/mobile-pause.md`. **Fix this first.** |
| `scripts/hmh-reboot-portal-e2e.mjs` desktop | `pause-resume` and `mid-run-restart` fail on the base. Same jukebox-pause domino. |
| `scripts/hmh-reboot-combat-browser-smoke.mjs` | Drives retired manual weapon keys after the roster wait. Rewrite mapped in `investigations-20260912/combat-smoke.md`. |
| `scripts/hmh-reboot-hero-selector-browser-smoke.mjs` | Mobile height guard fails at 1,866 px on the base. Fixed on the unmerged branch in §3.1. |
| `tests/arcade-core.test.mjs` "HD sprite atlas…" | One of the 51 documented retirement exceptions. Expected. Not a failure. |

Passing on the base and on HEAD: the collectible, performance, cockpit and boss-presentation smokes, and both portal smokes against production.

---

## 7. Constraints the next agent must respect

**The bundle is nearly full.** 7,087 bytes of initial-JS headroom remain. The cap counts the child entry plus the vendor chunk plus every chunk `game.js` imports statically. Measure with `node build.mjs` after every change. New presentation code should go behind `import()` so it lands in its own chunk and costs nothing against the cap.

**The repository is 696 MB tracked**, mostly Tripo `.blend` sources (four hero files at 57–86 MB each, plus an 80 MB selector scene). The register recorded 405 MB against a 350 MB limit as an open owner decision; it has since grown substantially. Worth raising with the owner before adding any more binary source.

**Do not touch without separate authorization:** contracts, settlement, wallets, fees, Mainnet, or anything that moves money. `SETTLEMENT_LIVE` stays false.

**Do not regenerate native art or audio** without a reason; the pipelines are reproducibility-gated and the Blender version is pinned at 5.1.2 at `D:/Apps/Blender/blender.exe`.

**Never use `t.skip`** — the release gate rejects skipped tests outright.

**The gate report is a merge trap.** `docs/testing/hmh-reboot-test-retirement-gate.json` is rewritten by every `npm run test:release` run, so every branch that ran the gate conflicts on it. Resolve by regenerating after the merge rather than by hand, or have implementers restore it before committing.

**Bump the cache token on every release.** There are 22 pinned locations for `hmh-package-20260912` and `lesters-arcade-v36-hmh-package` across `apps/portal/index.html`, `sw.js`, `README.md`, two smoke scripts and five test files. Tests pin them, so a partial bump fails the gate.

---

## 8. Suggested next package

Ordered by value per risk, based on what is mapped and ready:

1. **Phone pause menu** (`investigations-20260912/mobile-pause.md`). Portal-side CSS plus one `main.js` pause branch. Turns five failing mobile flows green and fixes a defect a real player hits on every phone run. Zero bundle cost.
2. **Land the selector-height branch** (§3.1). Review, merge, deploy. Zero bundle cost.
3. **Destructibles plus explosive barrels** (`destructibles.md` and the explosive-zone half of `hazards.md`). The largest remaining gameplay win: eight breakable covers with supply drops and three chainable barrel clusters, all authored already and inert today. Budget about 4,600 bytes, which fits the remaining headroom but leaves almost nothing after.
4. **Combat smoke rewrite** (`combat-smoke.md`). Scripts-only, restores real regression coverage over combat.
5. **Shake intensity and impact surfaces** (`shake-and-impacts.md`). Touches the settings schema, so do it as its own cycle.

After that the honest next step is not more code. It is the owner playing five desktop and five mobile sessions and answering the gated questions in §5, because most of what remains is either a judgement call about how the game should look and sound, or a Ranked and wallet milestone that needs a real wallet on a real device.

---

## 9. Files worth reading first

- `docs/handoffs/hmh-roadmap-reconciliation-20260911.md` — the roadmap mapped section by section against live source, including what was already shipped before these sessions.
- `docs/qa/hmh-roadmap-package-release-20260912.json` — the current release receipt: deployment ids, gate numbers, per-slice byte costs, every smoke result.
- `docs/qa/hmh-roadmap-package-evidence-20260912.json` — screenshot evidence with sha256 for the hazard warning and impact, the power-up chip states and the reload HUD.
- `docs/hmh-reboot/OPEN-WORK-CURRENT-STATUS.json` — the 99-item register with owner-gated statuses.
- `docs/handoffs/hmh-playable-release-and-polish-backlog.json` — the complete retained backlog, 55 work groups.
- `AGENTS.md` — the repository's own read order and safety rules.
