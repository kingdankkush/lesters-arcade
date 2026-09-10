# STACKED — master plan

Date: 2026-09-04
Owner: Justin Pinter
Audience: every future agent (Claude, Fable, Hermes, or otherwise) and the owner
House style: `docs/hmh-reboot/AAA-ROADMAP.md`

---

## STATUS: S-01–S-03 accepted; not publicly playable

`docs/stacked/STATUS.md` is the current implementation authority. Accepted S-01 through S-03 source/security integration exists; S-04 is separately policy-blocked. S-06 and S-11/S-12 are isolated prepared candidates, not public gameplay. Hold STACKED at this accepted boundary while the textured HMH gameplay heroes ship. Do not restart accepted core work or retry policy-denied operations.

### Historical planning baseline only

The original table and measurements below describe `ff2934db`, before implementation. They are retained for design history, not current source or production truth.

| Thing | State at `ff2934db` (2026-09-04) |
| --- | --- |
| `apps/stacked/` | Does not exist. |
| `apps/portal/src/stacked-*.mjs` | None. Not one module. |
| `apps/portal/games/stacked/` | Does not exist. No manifest, no contract entry. |
| `ARCADE_GAMES`, app shell, `REGISTERED_GAMES`, both router slug maps | **No STACKED entry in any of them.** The cabinet does not exist to the portal in any form, behind any flag. |
| `tests/stacked-*.test.mjs` | None. |
| `vercel.json`, `apps/portal/sw.js`, `build.mjs` | Untouched. No `/stacked/` CSP block, no precache entry, no build target, no Pixi externalisation for a STACKED path. |
| Cabinet art, achievements, leaderboard columns, seeds, replays, saved rows | None. Zero rows anywhere. |
| `docs/stacked/` | **Documents only, and currently untracked.** This file, `STACKED-CONTRACTS.md`, `STACKED-CYCLES.md`, seven specs under `spec/`. Cycle S-01 commits them. |

Every number, table, and interface in this document set that describes **STACKED runtime behaviour**
is a **design commitment**, not a measurement of shipped behaviour. Where such a figure is derived
rather than measured, the owning document says so. No STACKED code has been run.

**One carve-out, and it is deliberate.** Figures read from or built against the working tree at
`ff2934db` **are** measurements, and an implementer should trust them rather than re-derive them:
committed artifact byte counts (`dist/chunks/hmh-pixi.js` 575,891; `dist/hmh-reboot/game.js` 398,971;
`dist/chunks/chunk-22O5W2QY.js` 63,871; `dist/chunks/chunk-2WGYLO4P.js` 655; real HMH initial JS
1,039,388), quoted source line numbers, and the one build performed for this plan — an esbuild of a
16-export `pixi-vendor.mjs` entry under `build.mjs`'s own vendor settings
(`bundle, minify, treeShaking, splitting:false, format esm, target es2020`), run 2026-09-04 against
`pixi.js@8.19.0`, giving **597,360 bytes**, from which `ARCADE_PIXI_VENDOR_CAP = 646_000` is derived.
Every one of those is named as measured in `spec/visuals.md` §1.2 and `spec/gates.md` §6.2. Everything
about how STACKED *plays* — session lengths, particle counts, frame times, replay sizes — is a
commitment.

**Nothing in this plan proposes paid entry, a non-zero `entryFeeMicroUsdc`, settlement activation,
contract deployment, or a production promotion.** Those require a separate explicit HALT approval
naming the exact action and the exact candidate.

---

## Contents

- [1. What STACKED is](#1-what-stacked-is)
- [2. Locked owner decisions](#2-locked-owner-decisions)
- [3. Document map](#3-document-map)
- [4. Area summaries](#4-area-summaries)
  - [4.1 Core mechanics and tuning](#41-core-mechanics-and-tuning)
  - [4.2 Audio-reactive particle and zone system](#42-audio-reactive-particle-and-zone-system)
  - [4.3 Mobile, touch, and responsive layout](#43-mobile-touch-and-responsive-layout)
  - [4.4 Ranked integrity and replay verification](#44-ranked-integrity-and-replay-verification)
  - [4.5 Portal integration — leaderboards, profile, achievements](#45-portal-integration--leaderboards-profile-achievements)
  - [4.6 Two Player forward-compatibility](#46-two-player-forward-compatibility)
  - [4.7 Cabinet, manifest, and verification gates](#47-cabinet-manifest-and-verification-gates)
- [5. Standing constraints](#5-standing-constraints)
- [6. Owner gates](#6-owner-gates)
- [7. Open questions for the owner](#7-open-questions-for-the-owner)
- [8. Start here](#8-start-here)

---

## 1. What STACKED is

### 1.1 The cabinet in one paragraph

STACKED is an original falling-block arcade game and the fourth first-party Lester's Arcade cabinet.
Seven tetromino pieces fall onto a 10-wide, 20-visible-row matrix; the player rotates, shifts, holds,
and drops them to complete horizontal lines. It uses guideline-shaped mechanics — SRS-style rotation
with wall kicks, a 7-bag randomizer, a hold queue, a ghost piece, lock delay, spin recognition,
back-to-back and combo bonuses — because those are the genre's grammar and players arrive already
fluent in them. It is not a clone of any specific product: the theme, the naming, the scoring
identity, the pressure mechanic, the zone progression, the audio reactivity, and the integrity model
are its own.

Solo play is indefinite until the player tops out. No win condition, no level select in Ranked, no
ending — the run ends when the board does. Two modes ship: **Free Mode**, a practice sandbox that
writes nothing anywhere, and **Ranked Mode**, one clean run against a parent-issued seed with the
full input stream recorded and re-simulated by the parent before a single point reaches a board.

The identifier is one string, `stacked`, used verbatim as manifest id, runtime `gameId`, app-shell
cabinet id, `REGISTERED_GAMES` key, URL slug, cadence-leaderboard key and profile progress key, with
a single URL alias `stack`. That is deliberate: HMH's three-identifier split costs a translation
table at every boundary and is why `official-profile-route.mjs` still carries a `s.gameId === 'hmh'`
fixup. Chikun proved the single string works; STACKED copies Chikun.

### 1.2 Theme and tone

STACKED lives in the same LitVM / Litecoin / Lester's Arcade universe as Hard Money Heroes and
carries the same goofy-gritty satire. Pieces are transactions; the board is a mempool; a completed
line is a confirmed block; the rising pressure from below is an unreconciled ledger.

This table is copied from `STACKED-CONTRACTS.md` §1.2, which owns it. Where the two ever differ, the
contract is right and this table is a bug.

| Concept | Player-facing name | Schema field / identifier |
| --- | --- | --- |
| 1-line clear | `CONFIRM` | `singles`, `clearType: 'single'` |
| 2-line clear | `BATCH` | `doubles`, `clearType: 'double'` |
| 3-line clear | `MERKLE` | `triples`, `clearType: 'triple'` |
| 4-line clear | **`HALVING`** | `quadClears`, `clearType: 'quad'` |
| Back-to-back streak | `CHAIN` (HUD `CHAIN xN`) | `maxBackToBack`, `chainActive` |
| Combo streak | `MEMPOOL` (HUD `MEMPOOL xN`) | `maxCombo`, `comboCount` |
| Spin-recognised placement | `FORK` (mini: `MINI FORK`) | `spins`, `spinClears` |
| All-clear | `GENESIS` | `perfectClears`, `allClearStreakMax` |
| **A rising garbage row** | **`REORG`** | `garbageRowsReceived`, `garbageGroups` |
| The rising-garbage system as a whole | the rising ledger *(prose only — never a shipped id)* | — |
| Defence currency | `HASHPOWER` | `hashpower` |
| Spending `HASHPOWER` to reject one `REORG` | *(no display name; the copy says "reject a REORG")* | `reorgsRejected`, **sim state only** — not a schema field |
| Visual zone milestone | `EPOCH` | `zoneReached`, `STACKED_ZONES[n].id` |

Two inversions are worth calling out because an earlier draft of this file got them backwards, and
this is the first table a newcomer reads. **`REORG` is the rising row, not the act of rejecting it**,
and **"the rising ledger" is the system, not a display name** — `LEDGER` is not a shipped string
anywhere (it also collides with the rejected `LEDGER BLOCK`). There is **no `reorgs` field**: the
42-field run summary and the 16-key `runStats` projection do not carry one, and adding one would need a
`STACKED_CABINET_VERSION` bump. Every rejected variant is listed in `STACKED-CONTRACTS.md` §1, so a
reader who meets one in an older draft knows it is dead.

Tone rule: the satire lives in the copy, never in the mechanics. A player who has never touched a
blockchain must be able to look at the board and know exactly what is happening.

### 1.3 The canonical four-line clear

**`HALVING`** is the player-facing display name — HUD, results screen, leaderboard column header,
achievement titles, copy sheet. It is still owner gate **G-1** and may change.

That it may change costs nothing, because the display name is **decoupled from every identifier**.
The technical root everywhere is `quad`: schema field `quadClears`; achievement ids
`stacked-first-quad` / `stacked-quad-10`; particle preset `quadClear`; plausibility flag code
`quad-clears-exceed-lines`; sim event `clearType: 'quad'`. A G-1 ruling that renames `HALVING`
touches copy strings and achievement titles only — zero ids, zero seeds, zero stored replays. This
is why G-1 does not block the deterministic core.

### 1.4 Where it sits on the arcade floor

| | Hard Money Heroes | Chikun's Escape | **STACKED** |
| --- | --- | --- | --- |
| Genre | Isometric run-and-gun roguelike | One-button endless flap | Falling-block arcade |
| Session shape | 10–25 min, run-based, build choices | 20 s – 3 min, instant retry | 2–40 min, indefinite until top-out |
| Skill axis | Build construction, positioning, aim | Reaction timing | Spatial planning under accelerating pressure |
| Runtime | PixiJS 8.19.0, `apps/hmh-reboot/` | Canvas 2D, `apps/chikun/` | PixiJS 8.19.0, `apps/stacked/` — shares HMH's vendor chunk |
| Identity | Split, three identifiers | Single string `chikun` | Single string `stacked` |
| Ranked integrity | Parent seed + deterministic replay | Parent seed + deterministic replay + daily challenge | Parent seed + full input stream + parent re-simulation |
| Status today | Public playable | Public playable, Ranked-eligible | Does not exist |

STACKED is the arcade's **short-session, high-repetition, pure-skill** cabinet. HMH asks for twenty
minutes and a plan. Chikun asks for thirty seconds and a reflex. STACKED sits between them and
scales: a beginner tops out in under three minutes and restarts immediately; an expert holds a board
for half an hour.

It is also the first cabinet designed around the **parent music player**. It has no soundtrack of
its own: its visual identity is driven by live frequency analysis of whatever the player already has
playing, so every track added to the playlist in future is automatically a STACKED track.

### 1.5 The naming rule, stated once

The trademarked genre name — Tetris — and the trademarked term that product uses for a four-line
clear appear in **no shipped string**: not in `gameId`, `seasonId`, achievement ids, evidence or
protocol version strings, particle preset ids, plausibility flag codes, asset filenames, UI copy, or
shipped comments. Guideline-style *mechanics* are not the trademark and are fine. This paragraph is
the only place in this document either word appears. The rule is enforced by a gate, not by
discipline: `STACKED-CONTRACTS.md` §1 pre-clears every shipped name, and the ship cycle proves
absence by running a scan.

---

## 2. Locked owner decisions

These are settled. **Do not re-litigate them; design within them.** A future session that wants to
change one is asking the owner for a new decision, not correcting a mistake.

| # | Decision | Consequence in the design |
| --- | --- | --- |
| **D-1** | **The game.** An original falling-block arcade game in the style of the modern genre. Working title **STACKED**. A Lester's Arcade cabinet, not a standalone product. | Guideline-shaped mechanics are the baseline, not a stretch goal. Arcade identity, wallet, profile, leaderboard, music and achievements are inherited from the parent portal. |
| **D-2** | **Naming / IP.** The trademarked genre name, logo, branding and its term for a four-line clear must not appear in the shipped product, its assets, its UI copy or its game ids. Guideline-style **mechanics** are fine. The four-line clear needs its own in-universe name. | Every name pre-cleared in `STACKED-CONTRACTS.md` §1. `HALVING` for display, `quad` for identifiers. A scan gate proves absence at ship. |
| **D-3** | **Scope of first ship: solo only.** Free + Ranked, full visuals, cabinet, profile and global leaderboard sections. Two Player — local and online — is **deferred**, but designed now and pre-wired. | Phase 1 ships one board, plus four structural commitments (§4.6) so versus is later a data-and-network change, not a rewrite. |
| **D-4** | **Tech.** Native first-party cabinet on **PixiJS 8.19.0**, already vendored, same as HMH. Not the third-party tooling path. | STACKED shares HMH's vendor chunk; `build.mjs`'s Pixi externaliser must be widened or the entry inlines 575,891 bytes. The cabinet still runs in a sandboxed iframe behind `postMessage`. |
| **D-5** | **Music and visuals.** Audio comes from the existing parent music player. Visuals are music-reactive via **live Web Audio analysis**, no per-track beat maps, working with any track including ones added later. | The analyser lives in the **parent**, never the iframe. Band and onset data reaches the child as `portal:audio-frame` at 30 Hz. A future playlist addition needs zero authoring. |
| **D-6** | **All audio-reactive visuals are projection-only** and may never affect simulation, RNG, scoring or results. | Structural, not procedural: the sim's only input is a `uint8` mask per tick, and a twelve-case firewall test asserts an identical `resultHash` across every tier, audio state and accessibility setting. |
| **D-7** | **Ranked integrity.** Parent-issued seed per Ranked session, full input-stream recording, deterministic re-simulation. Same discipline as HMH and Chikun. | The parent owns the seed, the child records one byte per tick, and the parent writes **its own** score, never the child's number. |
| **D-8** | **Mobile is first-class.** Full touch scheme, 9:16 portrait, reduced particle tier so mid-range phones hold 60 fps. Both 9:16 and 16:9 required by the manifest. | Portrait defaults to a HUD-strip layout, not side rails — a phone in portrait cannot satisfy the rail width constraint. A recorded manual device pass is a deliverable, not the arithmetic. |
| **D-9** | **Difficulty.** Gravity + lock-delay curve **plus** rising garbage past a threshold. Beginner 2–3 min, intermediate 4–6, expert 6–12, elite 12–30, god tier 30–40. Indefinite until topped out. | A committed regenerable model predicts 2.70 / 5.47 / 9.54 / 20.07 / 33.4 minutes, every tier inside band. It is arithmetic, not playtest data (risk R-6). |
| **D-10** | **Leaderboard rank metric.** Score is the sort key, with rich secondary stats as columns. | Five middle columns: `LINES`, `SURVIVED`, `LVL`, `COMBO`, `HALVING`. Survival ranks on **ticks**, never wall-clock seconds. |
| **D-11** | **Free vs Ranked.** Free is a practice sandbox with instant restart, a starting-level selector, optional aids, no leaderboard write, isolated from Ranked. Ranked is one clean run: parent seed, no restart, no level skip, replay recorded, leaderboard write. | Free writes **nothing** — not the profile, boards, XP, rank, achievements or official sessions — asserted field by field. The Free medal shelf is device-local. |
| **D-12** | **Visual zones.** Five to six themed zones on **one** shared particle/shader system; zones swap by **data**, not new code, and advance at survival milestones. | Six frozen zones (`genesis-vault`, `mempool-drift`, `hashrate-forge`, `scrypt-lattice`, `halving-eclipse`, `mainnet-aurora`) entering at ticks 0 / 10,800 / 25,200 / 43,200 / 64,800 / 90,000, as data in one module. |
| **D-13** | **Phase 1 extras.** An achievement set wired into the parent achievement system **is** in scope. Same-seed local ghost, results replay viewer and a daily challenge seed are **not**. | Sixteen achievements, Ranked-only by construction. Ranked input recording makes the three deferred features cheap later: the evidence exists, only the surfaces are missing. |
| **D-14** | **Two Player readiness.** Sim strictly deterministic and lockstep-capable, garbage-attack table defined as **data** now, rendering structured so two boards share one canvas. | `stacked-versus-table.mjs` ships with zero runtime importers and a test that proves it. `createStackedMatch` (`apps/portal/src/stacked-match.mjs`, scheduled in **S-03** with `tests/stacked-match.test.mjs`) takes one board and `attackTable: null`. `boardSlot[1]` is created, empty, hidden. |
| **D-15** | **Cabinet art.** Placeholder vector/SVG only, in the style of the existing placeholder cabinets. All cabinets get a consistent redo in a later art pass. No bespoke pipeline now. | Five hand-authored SVGs, no generator, nothing under `assets/generated/`. Style register is `cabinet-generic-brawler.svg`. |
| **D-16** | **The deliverable.** A committed roadmap doc in the house style of `docs/hmh-reboot/AAA-ROADMAP.md` that a coding agent reads as implementation authority. | This document set. This file is its spine. |

### 2.1 Rulings the contract froze on top of them

The seven specs were written in parallel and contradicted each other in nineteen places. Those
conflicts are **closed** in `STACKED-CONTRACTS.md`, which wins over every spec. The ones a reader is
most likely to trip over:

| Ruling | Value | Why it matters |
| --- | --- | --- |
| Board rows | `BOARD_ROWS = 24` (20 visible + 4 buffer) | Not 40. Lock-out fires at `y >= 20`, so no piece rests above row 23; 20 extra rows inflate two run-summary bounds by 67% for nothing. |
| Run tick ceiling | `STACKED_MAX_TICKS = 432_000` (2 h) | 3.4× the god-tier ceiling. Tighter truncates a legal exceptional run; looser triples every derived bound and weakens the gate's strongest check. |
| Input encoding | One `uint8` held-state mask per tick | Bits 0–7: moveLeft, moveRight, softDrop, hardDrop, rotateCW, rotateCCW, rotate180, hold. Bit 2 is the only level bit; every other edge is detected **inside** the sim. |
| Time unit | **Ticks**, everywhere | A tick is simulation, a frame is projection, and the firewall depends on never confusing them. No `*_FRAMES` constant exists. |
| Caps | `STACKED_LEVEL_CAP = 30`, `STACKED_COMBO_BONUS_CAP = 20` | Uncapped combo makes the score ceiling quadratic in clears. Consequence surfaced deliberately (G-4). |
| Evidence transport | Chunked from day one | ≤ 33 chunks of 42,000 raw bytes, in order, before `game:result`, which carries only the digest. The 65,536-byte bridge cap is not negotiable. |
| Terminal reasons | `block-out`, `lock-out`, `garbage-out`, `tick-ceiling`, `evidence-ceiling` | Field name `terminalReason`. All five are sim terminals; all five rank normally. |
| Season identity | `stacked-season-preview-1` | Dedicated, following `chikun-season-preview-1`. An HMH rollover must never reset STACKED boards. It feeds the seed, so it is frozen. |
| Quality tiers | `desktopHigh` / `desktopLow` / `mobile`; reduced motion is a **modifier** | Selected once at boot on `coarsePointer && width <= 820` — the `&&`, so a touchscreen laptop is not sent to the phone tier and the tier does not flip mid-resize. |
| Module homes | Sim `apps/portal/src/stacked-sim.mjs`; layout `stacked-layout.mjs :: layoutMatch` | Both parent-side, DOM-free, plain-Node importable. The sim's two allowed imports are asserted by test. |

All nineteen, with rejected alternatives and why each lost:
[`STACKED-CONTRACTS.md`](STACKED-CONTRACTS.md).

## 3. Document map

### 3.1 What each document owns

| Document | Owns | Does not own |
| --- | --- | --- |
| **`STACKED-MASTER-PLAN.md`** (this file) | The spine. Identity, theme, locked decisions, the seven area summaries, standing constraints, owner gates, read order. | Any constant, any sequencing decision, any implementation detail. |
| **[`STACKED-CONTRACTS.md`](STACKED-CONTRACTS.md)** | **FROZEN.** Every cross-section name, constant, identifier, payload shape. Terminology (§1), constants (§2), identity and collision checks (§3), interfaces (§4), unresolved owner decisions (§5). | Design rationale beyond why one value beat another; sequencing; implementation. |
| **[`STACKED-CYCLES.md`](STACKED-CYCLES.md)** | **Sequencing.** Twenty-two cycles S-01 … S-22, each with scope, RED tests, acceptance bar, boundaries, dependencies. Parallelization, later phases, nineteen owner gates, seventeen risks, definition of done. | Any constant, mechanic, or interface. It cites both by path. |
| **[`spec/mechanics.md`](spec/mechanics.md)** | The simulation. Board, pieces, rotation and kicks, spins, randomizer, hold, gravity, lock delay, input resolution order, clears, scoring, the rising ledger, terminals, the difficulty model, Free vs Ranked differences. | Rendering, portal wiring, transport. |
| **[`spec/visuals.md`](spec/visuals.md)** | Rendering and audio reactivity. Pixi vendoring, scene graph, frame driver, analyser graph, band normalisation, onset detection, zones, particles, quality tiers, frame-budget guard, projection firewall, flash limiter. | The simulation, input, portal surfaces. |
| **[`spec/mobile.md`](spec/mobile.md)** | Phone and tablet. Layout modes and hysteresis, the cell solver, touch state machines, gesture classification, input-layer expansion to the frozen mask, the mobile budget, the thermal governor, interruption. | The mask format, the sim, quality-tier definitions. |
| **[`spec/integrity.md`](spec/integrity.md)** | Ranked trust. What the claim is and is not, seeding, RNG substreams, the `SIC1` codec, evidence transport and ceilings, the verification path, the plausibility gate's 23 flags, the trust column and the four defects it must fix. | Scoring, rendering, the manifest. |
| **[`spec/portal.md`](spec/portal.md)** | Parent-side surfaces. Registration, the two refactors, the 42-field run summary, the 16-key `runStats` projection, leaderboard engine changes, columns, profile grid, achievements, settings, persistence. | The sim, rendering, gates. |
| **[`spec/versus.md`](spec/versus.md)** | Two Player, deferred. The frozen attack table, lockstep readiness, the match wrapper, state hashing, the two-board render tree, local 2P, the online decision, matchmaking and rating. | Anything that ships as a Phase 1 runtime path. |
| **[`spec/gates.md`](spec/gates.md)** | Reaching the arcade floor. Cabinet art, manifest and `docs:cabinets`, the test plan, evidence budget derivation, visual regression, performance and soak, CSP / service worker / security sweep, release deliverables. | Design, the sim, the schema. |

### 3.2 Precedence

```
STACKED-CONTRACTS.md      wins over everything, always
        ↓
STACKED-CYCLES.md         wins on sequencing and acceptance bars
        ↓
STACKED-MASTER-PLAN.md    wins on identity, scope, standing constraints
        ↓
spec/*.md                 win on the detail of their own area
```

Where a spec disagrees with the contract on a name, an id, or a constant, **the contract wins and
the spec is wrong and must be corrected in the same commit that reads it**. An implementer who finds
a second value for anything the contract lists has found a bug, not a choice.

Three corrections named in an earlier draft of this section — `integrity.md` §0's no-chunking premise,
`gates.md`'s quality-tier vocabulary, and `integrity.md`'s garbage-interval arithmetic — **are all
already applied**. Do not go looking for them: integrity §0 opens by declaring the in-process claim
void, gates §6.1 asserts `desktopHigh`/`desktopLow`/`mobile` with a separate `dataset.reducedMotion`
boolean, and integrity §5.1 already imports `GARBAGE_INTERVAL_FLOOR_TICKS` and computes
`floor((144000 − 3600) / 120) + 1 = 1,171`. gates.md has no §5.1 at all; the performance gate is §6.1
and the bundle gate is §6.2.

What **is** still outstanding, both now ruled in the contract, both requiring a spec edit in the commit
that reads them:

1. **The shared Pixi vendor chunk.** `visuals.md` §1.2 instructs an implementer to add seven exports
   to `apps/hmh-reboot/src/pixi-vendor.mjs`; `gates.md` §6.2 says the nine are frozen and a tenth is
   owner gate **G-5**. `STACKED-CONTRACTS.md` §2.7 now rules: the nine stay, visuals §1.2's table is
   the **priced proposal attached to G-5**, and no cycle edits that module before the gate is
   answered. The number that makes it a gate rather than a preference: real HMH initial JS is a
   measured 1,039,388 bytes against a 1,050,000 cap, so the seven exports (+21,469) put it at
   1,060,857 — over — while `assertHmhInitialJsBudget`, which never sees the two shared chunks, would
   still report the build green.
2. **Reduced motion and particles.** `gates.md` §6.1's smoke asserted `renderedParticles === 0` under
   the `reduceMotion` modifier and called that "the modifier's whole contract"; `visuals.md` §7.1, which
   owns the setting, scales particle speeds ×0.35 and lifetimes ×0.60 and keeps them rendering. Only
   `stackedEffects: 'minimal'` and guard level 3 zero the alive ceiling. `STACKED-CONTRACTS.md` §2.6
   now rules for visuals, and gates §6.1 is corrected: `0 < renderedParticles <= reducedCeiling` under
   the modifier, `=== 0` only under `minimal`.

### 3.3 When to read what

| Situation | Read |
| --- | --- |
| First contact with STACKED | This file, end to end. Then `STACKED-CONTRACTS.md` §1–§3. |
| Picking up a cycle | `STACKED-CYCLES.md` §0 and §1, then that cycle's entry, then the spec sections it cites, then the contract sections those touch. |
| About to declare a constant | `STACKED-CONTRACTS.md` §2. If it is listed, import it. If not, it is new and needs a home and a ledger note. |
| About to name anything shipped | `STACKED-CONTRACTS.md` §1 and §3. |
| Writing a bridge message or payload | `STACKED-CONTRACTS.md` §4. |
| Stuck on an owner decision | §6 below, then `STACKED-CYCLES.md` §6, then `STACKED-CONTRACTS.md` §5. |
| Wondering why a value is what it is | The owning spec. Every derived figure states its derivation. |

---

## 4. Area summaries

Seven areas. Each gives the shape of the design and the commitments that are load-bearing — the ones
whose violation breaks something silently. **These are not implementation authority**: the linked
spec is, and the contract wins over the spec. Every derivation, every table, and every second-order
number lives in the spec.

### 4.1 Core mechanics and tuning

A 10×24 board (20 visible + 4 buffer) in one `Uint8Array`, y-up, with the board bytes part of the
replay comparison. SRS-shaped rotation with three kick tables, a 7-bag randomizer, one hold swap per
lock, a Q16.16 integer gravity accumulator, level as a pure function of lines capped at 30, and lock
delay keyed to level with a step-reset on each new lowest row. Five terminal conditions, all inside
the sim, all ranking normally. The rising ledger pushes its first `REORG` at tick 3,600 and tightens
from 5 to 30 `REORG`s per minute by minute 16; `HASHPOWER` accumulates from multi-line clears and spin
clears and is spent to **reject** one `REORG`, at a price that climbs every three minutes. Because
`HASHPOWER_MAX` is 8 and the price passes 8 at tick 86,400, defence stops being possible at 24:00 and
every row lands from then on. Scoring is guideline-shaped — 100/300/500/800 bases, spin rows replacing
rather than summing, a ×1.5 `CHAIN`, a capped `MEMPOOL` term, `GENESIS` bonuses.

Free Mode adds start level 1–15, restart, undo, queue length and aid toggles, records no evidence and
writes no score. Ranked forces start level 1, fixed queue 5, ghost and ledger on, and records
evidence from tick 0.

| Load-bearing commitment | Why |
| --- | --- |
| The sim imports only `seeded-rng.mjs` and `stacked-contracts.mjs`, is DOM-free and plain-Node importable. | It is the verifier's own module. An import-graph test asserts it. |
| Input is one `uint8` held-state mask per tick; edges are detected **inside** `step()` against `prevMask`. | Makes the four catch-up steps idempotent, and means the verifier needs no host adapter. |
| DAS / ARR / DCD and every touch threshold live **outside** the sim. | Handling configuration can then never change a replay. It rides `summary.handling` as metadata. |
| One RNG draw per garbage **group**, never per row. | The gate's garbage bounds and the exact-equality checks under re-simulation both depend on it. |
| `SPAWN_DELAY_TICKS` and `LINE_CLEAR_DELAY_TICKS` are `0`. | This is what fixes `STACKED_MIN_PLACEMENT_TICKS = 2`, and therefore the piece and line ceilings the gate uses. |
| No score clamp exists in `step()`. | `score` exceeds int32 and must never pass through a 32-bit path. A clamp would silently stop an elite player's score. |
| Level is capped at 30, combo bonus at 20. | Uncapped combo makes the score ceiling quadratic in clears. Consequence, shown deliberately (G-4): above L30, the board ranks endurance with score as a skill weighting. |

The constants are validated against the owner's session bands by a committed, regenerable difficulty
model (§2, D-9). It is closed-form arithmetic with no playtest data behind it and cannot see burst
dynamics (risk R-6).

→ **[`spec/mechanics.md`](spec/mechanics.md)**

### 4.2 Audio-reactive particle and zone system

PixiJS 8.19.0. STACKED needs seven Pixi symbols HMH's nine-export vendor chunk does not carry
(`ParticleContainer`, `Particle`, `Filter`, `GlProgram`, `RenderTexture`, `Mesh`, `Geometry`); a
16-export chunk measures 597,360 bytes against today's 575,891. **How those seven arrive is owner gate
G-5 and nothing may edit `pixi-vendor.mjs` before it is answered** — the +21,469 bytes push real HMH
initial JS from a measured 1,039,388 to 1,060,857, past the 1,050,000 cap, which `gates.md` §6.2 calls
a stop and not a cap bump. Six fixed root layers under one `stackedRoot` in a fixed-height logical
space, so a mid-run resize moves board, backdrop and in-flight particles together. One structure-of-
arrays particle store across two `ParticleContainer`s with capacities 6,000 / 2,600 / 1,200 by tier
and fourteen presets. Six zones entering at fixed ticks as pure functions of tick, cross-fading over
150 ticks, with palettes, shader parameters, particle overrides and bloom envelopes as frozen data.

Audio reactivity is live: five normalised frequency bands and spectral-flux onsets sampled at a fixed
60 Hz, shipped to the child at 30 Hz as integers. Three quality tiers selected once at boot, plus a
frame-budget guard that degrades on dropped-frame ratio rather than absolute milliseconds.

| Load-bearing commitment | Why |
| --- | --- |
| The `AnalyserNode` lives in the **parent**, never the cabinet iframe. | `createMediaElementSource()` is once-per-element and permanently reroutes output; creating it in a realm the portal tears down silences arcade music for the session, for every cabinet (risk R-4). |
| The audio sampler runs at a fixed 60 Hz, never rAF-bound. | A throttled background tab would otherwise change the band statistics. |
| `portal:audio-frame` writes only into `audioReactive`, which never reaches `simulation.update()`. | The whole audio feature is projection-only by construction, not by review. |
| Sim events are drained by a strictly increasing `sequence` watermark, never re-read. | `snapshot.events[]` is a ring; a naive consumer re-emits a `HALVING`'s 260 particles every frame. |
| `app.stage.addChild` is called exactly once, into `stackedRoot`. | Keeps the two-board render tree possible without a rewrite, and keeps per-board shake, bloom and particle layers addressable. |
| Particle jitter uses a separate VFX RNG seeded `stacked-vfx:<seed>`. | A rendering feature must never advance a simulation cursor. |
| `?evidenceSafe=1` freezes audio, RNG, clock and the frame guard. | Without it the visual-regression gate is worthless: the audio-reactive projection differs on every capture. |
| An always-on flash limiter caps three flashes per second and clamps additive light. | Photosensitivity safety is not a setting; a static data test asserts palette luminance and contrast floors with no renderer running. |

The projection firewall is proved by **three tests together**, and the split matters because the
twelve-case harness does not cover everything §5's constraint 2 forbids:

| Test | Cycle | Covers |
| --- | --- | --- |
| `tests/stacked-projection-firewall.test.mjs` | S-14 | Twelve cases — three quality tiers × three audio states (absent / silent / a scripted loud sequence), plus `stackedEffects: 'minimal'`, plus the frame-budget guard pinned at level 3, plus `reduceMotion` + `reduceFlash`. All twelve `resultHash` values byte-identical **and** equal to the no-renderer `simulateStackedRun` path. |
| `tests/stacked-thermal-governor.test.mjs` | S-15 | The thermal governor's lowest and highest levels produce an identical run result **and** an identical layout cell. The governor lands a cycle after the harness and is not one of the twelve. |
| `tests/stacked-input-device-parity.test.mjs` | S-15 | One intent list from synthetic keyboard, pointer and gamepad sources produces a byte-identical result **and** byte-identical evidence. No non-keyboard input path is one of the twelve either. |

Naming all three is not pedantry: the governor and the touch path are the two mechanisms most likely to
reach into the sim during a later optimisation pass, and "a twelve-case firewall test proves it" points
an implementer at a test that would not catch either. Vendor chunk policy is gate **G-5** and zone art
scope is gate **G-18**.

→ **[`spec/visuals.md`](spec/visuals.md)**

### 4.3 Mobile, touch, and responsive layout

Two layout modes, portrait and landscape, chosen from the visual viewport with a hysteresis band
sized so collapsing browser chrome cannot flip the mode mid-run. A two-pass cell solver clamped to
14–44 CSS px. Side rails need `rail >= 1.8 × cell + 12`, which a phone in portrait never meets — 41.7
px against 67.2 on a 390×844 device — so the strip layout is the phone default and rails are a tablet
case. The board is bottom-anchored, so a short viewport clips the dimmed spawn headroom, never the 20
playfield rows.

Gesture is the default control scheme; on-screen buttons ship as an accessibility alternate that
costs 11% of portrait board area. Each pointer runs its own state machine. Every height budget
divides by 21.5 rows, not 20. Everything in this area is projection or input-layer.

| Load-bearing commitment | Why |
| --- | --- |
| A hard axis lock decided at 10 px of travel and held until `pointerup`. | The single rule that kills both hard-dropping mid-shuffle and drifting a column mid-soft-drop. |
| The snapped cell is frozen at run start against the **resolved** render resolution. | The cell sets `moveStepPx`, and `moveStepPx` *is* touch sensitivity: a thermal step-down must not move a player's controls mid-run. |
| No gesture uses a delay timer anywhere. | It is why the p95 touch-to-pixel budget lands at 56.8 ms against a 65 ms target. |
| Hard drop needs five simultaneous gates, and a spent pointer releases soft drop in the same tick. | With a 140 ms spawn lockout, this is what stops a flick bleeding into the next piece. |
| The input layer expands held directions into the frozen 8-bit mask; the sim sees only the mask. | Handling settings and device differences never travel in a replay. |
| Touch has no DAS analogue, and `STACKED_MAX_MOVE_STEPS_PER_TICK = 1` is structural. | A banked 9-step queue drains in 17 ticks; the spec corrects the contract's "≤ 9 ticks" gloss with no constant changed. |
| Rotation re-solves layout without pausing the sim; backgrounding writes a mask-0 release record. | No key is left stuck held across an interruption, and the recorded stream stays legal. |
| A suspended Ranked run may never be rewound; past the suspend limit it finalizes and **submits**. | Discarding it would make backgrounding a free retry. |

The mobile budget — 260 steady-state particles against a 1,200 pool, 40 draw calls, 11.18 ms of a
16.67 ms frame on an iPhone 11 / Pixel 6a class device — is arithmetic, not measurement (risk R-7), so
a recorded manual device pass is a required deliverable. Ranked pause policy is gate **G-7**;
cross-device fairness is gate **G-19**, and the determinism proof must never be described as a
fairness proof.

→ **[`spec/mobile.md`](spec/mobile.md)**

### 4.4 Ranked integrity and replay verification

One claim and no more: **a run is accepted only if the parent can deterministically re-simulate the
player's recorded input stream and reproduce the exact result tuple the child submitted.** That makes
a tampered run cheap to detect and a forged run expensive. It does **not** prove a human played, and
it does not stop an attacker running the real simulation headlessly over synthetic inputs, because
every check executes in JavaScript the player controls (risk R-8). Seed shopping is likewise free and
offline: a 32-bit hash over a caller-influenceable string is searchable in milliseconds, leaving no
abandoned-checkpoint signal (risk R-9). Both limits go in the product copy, not just the docs.

Evidence is one `uint8` mask per tick in the `SIC1` codec, chunked over `postMessage`, re-simulated
once by the parent, then pre-filtered by a 23-flag plausibility gate — nineteen hard rejects that are
combinatorial impossibilities or exact identities, four soft suspects that still rank.

| Load-bearing commitment | Why |
| --- | --- |
| The parent owns the seed via `deriveSessionSeed`; the child never generates, rerolls or chooses one. | The verifier recomputes the seed rather than trusting it. `startStackedRankedSession` forwards neither `urlSessionId` nor a nonce. |
| **The score written is `canonical.score` from the re-simulation**, never the number the child sent. | This is the entire point of the claim. Everything else is a pre-filter. |
| Re-simulation happens exactly once, behind an `inFlight` flag and a `finalized` latch that are never cleared. | Prevents double-writes and re-entrant submission. |
| Verdicts are consumed through `registerRunVerifier(gameId, fn)`, with `requiresRunVerifier: true`. | A forgotten registration fails loudly instead of silently ranking an unverified run — and it replaces a third hard-coded cabinet branch. |
| Evidence is chunked from day one: ≤ 33 chunks of 42,000 raw bytes, in order, before `game:result`. | The bridge cap is 65,536 bytes. The parent validates contiguity, count, magic and checksum **before any decode**. |
| The codec carries a mandatory terminator whose tick index must equal the header's. | It is what makes truncation detectable rather than silently shorter. |
| The trust verdict is persisted into the cadence row's `runStats`. | `state.sessions` is not in the snapshot, so a verdict stored there dies on reload. |
| Four trust defects are fixed together, in one cycle, with a save/restore round-trip test. | Fixing two of three produces a correct verdict nobody can see — worse than no column (risk R-13). |

Ceilings are frozen (§2.1), with stored replays under a two-replay LRU held outside the arcade
snapshot, and the tick ceiling provably fires before the evidence ceiling in every stream the
recorder can produce. The trust copy says "Replay verified", never "Verified".

→ **[`spec/integrity.md`](spec/integrity.md)**

### 4.5 Portal integration — leaderboards, profile, achievements

Four declarations in `arcade-core.mjs` — an `ARCADE_GAMES` entry, an app-shell cabinet entry, a mode-
select presentation carrying the Free starting-level range, and a `custom: {}` field on
`createEmptyGameProgress` — plus two refactors that replace hard-coded per-game branches:
`run-verifier-registry.mjs` and `game-stat-schema.mjs`. Five leaderboard columns (`LINES`,
`SURVIVED`, `LVL`, `COMBO`, `HALVING`), a ten-cell profile stat grid with a five-cadence rank strip,
and sixteen Ranked-only achievements.

The run summary is seven exact-key blocks and 42 fields: every **numeric** field is a non-negative
integer and there are no floats anywhere, with five string fields (`identity.buildHash`,
`identity.mode`, `identity.seasonId`, `identity.terminalReason`, `handling.inputDevice`) bounded by
pattern or enum. Bounds are imported from `stacked-contracts.mjs` and eleven cross-field rules are
enforced. Persistence stays at `ARCADE_PERSIST_VERSION` 3: there is no migration path, so a bump would
destroy every existing save.

| Load-bearing commitment | Why |
| --- | --- |
| One identifier, `stacked`, everywhere; the alias `stack` goes in `ARCADE_GAME_IDS_BY_SLUG` only. | The alias in the wrong map is silently inert. A missing primary slug is worse: link building falls back to HMH with no error. |
| `allowDevCabinet: DEV_CABINETS_ENABLED` lands in `beginTrackedSession` in the registration commit. | Without it `?devCabinets=1` reaches mode select and then throws. |
| Only sixteen keys are projected into a persisted cadence row (292 chars against 763). | Row size is a quota problem, and the quota is shared with profiles and avatars. |
| `pruneCadenceLeaderboards` ships early and game-agnostically. | Unpruned period buckets can silently kill persistence for **every** cabinet (risk R-12). It is destructive on existing saves, which is gate G-17. |
| `game-stat-schema.mjs` registers HMH and Chikun first, lands alone, with fixtures captured **before** the change. | Nothing in the repo snapshots that DOM today; a fixture updated in the same commit as the refactor is the warning sign (risk R-2). |
| `elapsedMs` is derived from ticks, and ranking is on ticks, never wall-clock seconds. | It is what makes pause safe in Ranked: a paused wall clock cannot inflate a derived field. |
| Durable profile stats come from `progress.stacked.custom`, never `state.sessions`. | `state.sessions` is not persisted, so a card built on it is permanently blank after reload (risk R-11). |
| `defineAchievement` gains a `gameId`, defaulting to `lester-blaster` for the 57 existing definitions. | Today a Chikun ranked run can unlock an HMH achievement. A third cabinet makes the leak untenable (gate G-8). |
| No line in the three governed docs may pair a coming-soon phrase with a word starting "stack". | Once playable, the doc-drift gate fires against ordinary English, code fences included (risk R-10). Verify by running it. |

Free Mode's medal shelf is device-local storage that never touches the profile. Player settings store
DAS/ARR/DCD in milliseconds, snap to ticks once at run start, and are editable in Ranked but applied
only from the next run.

**Wins, losses and players-defeated — where the owner's session-tracking ask landed.** Those three are
**versus-only quantities**, and STACKED Phase 1 is solo. There is no opponent, so there is no win, no
loss and nobody defeated; the only honest solo analogues (boards overtaken, players outranked) are
leaderboard-derived views of `score`, not run facts. Phase 1 therefore **reserves** them and surfaces
none of them: `summary.versus` carries `wins`, `losses`, `draws`, `garbageSent`, `garbageReceived`,
`kos` and `roundsPlayed` as validated integer zeros so the Two Player phase needs no schema migration,
and no Phase 1 UI reads them — `spec/portal.md` §7.4 states the reason plainly, that a solo-only board
showing "0-0" for every player is worse than showing nothing. They are absent from the ten profile
cells and the six leaderboard columns above **by decision, not by oversight**. When P2 lands, the
profile gains a "Record: W-L" cell rendered behind `custom.roundsPlayed > 0`, and `progress.custom`
moves from eleven keys to twelve in that same commit. If the owner meant something solo-shaped by
"players defeated", §7 question 23 asks it.

→ **[`spec/portal.md`](spec/portal.md)**

### 4.6 Two Player forward-compatibility

Two Player does not ship in Phase 1. Four structural commitments land in Phase 1 anyway so it is
later a data-and-network change rather than a rewrite: the frozen garbage attack table, a
lockstep-capable simulation behind `createStackedMatch` (`apps/portal/src/stacked-match.mjs`, shipped
in **S-03** with one board and `attackTable: null`), a two-board render tree, and reserved schema
fields — `summary.versus`, an object of seven integer zeros, and **only** there: not on the
`game:result` payload, not in `runStats`, not in `progress.custom`.

The attack table is data with the rows-per-piece ladder as its design intent: plain double 0.20,
plain triple 0.27, `HALVING` + `CHAIN` 0.50 as the baseline, full-spin single 0.80, full-spin double
1.00, `GENESIS` 1.10. `computeAttack` and `resolveGarbageExchange` ship unused and tested. Online is
rejected as P2P and deferred to an authoritative relay behind gate **G-16**; matchmaking is Glicko-2
seeded from the solo all-time board, with an asymmetric forfeit.

| Load-bearing commitment | Why |
| --- | --- |
| The attack table has zero runtime importers in Phase 1 and reaches the match wrapper by injection. | A test can then prove nothing consumes it, which is what keeps it honest data rather than dead code that drifted. `stacked-match.mjs` must not import `stacked-versus-table.mjs` for exactly this reason. |
| `createStackedMatch` ships in Phase 1, in S-03, and is the **only** thing that owns the garbage router. | It is the seam. The solo runtime never talks to the attack table; the match does. Leaving the wrapper out and adding it in P2 is the rewrite D-14 exists to prevent, so it is a scheduled cycle deliverable with its own test, not an aspiration. |
| `backToBack` is a flat `1` with `backToBackMinLines = 2`. | A flat bonus on singles makes the repeating full-spin-single loop pay 1.20 rows/piece and dominate the game. |
| Garbage is queued, not applied; hole columns are drawn at **send** time; no row is ever discarded. | Fixes the two orderings that make two clients disagree, and keeps the exchange conservative. |
| One match seed; each board derives its own `bag` stream, `garbage` is one shared match-level stream. | One seed per player would make cross-board cancellation non-deterministic. |
| One distinct input byte per fixed step, dequeued from a tick-indexed ring. | Reusing one frame's snapshot across catch-up steps is the bug that makes a lockstep sim diverge under load. |
| `boardSlot[1]` is created, empty and hidden, under a single `app.stage.addChild`. | The two-board tree exists from day one; adding a second board is then data, not surgery. |
| The render-tree test is written against **stub** display-object constructors under `node --test`. | Injected constructors have no precedent here and are the discipline most likely to be dropped; a stub test breaks instead of passing silently (risk R-17). |
| Local 2P is Free-only and never calls `recordScore`. | `recordScore` creates a profile and a progress entry *before* its ineligible-session early return. |

Lockstep is delay-based — 0 ticks locally, adaptive between 3 and 8 online, changed only between
games — with a uint32 `stateHash()` over a fixed per-board byte layout exchanged every 60 ticks. No
rollback.

→ **[`spec/versus.md`](spec/versus.md)**

### 4.7 Cabinet, manifest, and verification gates

Five hand-authored SVGs in the flat-colour style of `cabinet-generic-brawler.svg` — no generator, no
ingest script, nothing under `assets/generated/`. A manifest that ships `coming-soon` at `0.1.0` with
no README roster row and flips to `playable` / `1.0.0` in one atomic commit. **Forty-eight test
files**, enumerated in `STACKED-CONTRACTS.md` §2.10 and scheduled cycle by cycle in
`STACKED-CYCLES.md`; two of them are mandatory ship gates that may not be deferred or merged away —
`tests/stacked-projection-firewall.test.mjs` (the twelve-case `resultHash` proof) and
`tests/stacked-copy-sheet.test.mjs` (the D-2 trademark scan).
A dedicated visual-regression script over twelve scenes, a telemetry-backed performance smoke, a
40-minute soak, a new CSP bucket, three service-worker precache URLs, and a security-sweep scope
extension.

| Load-bearing commitment | Why |
| --- | --- |
| All three mode-select assets exist, or `buildGameModeSelectModel` returns `null`. | The panel then becomes the disabled "blocked safely" dead-end with no other symptom. |
| No `#frame=` fragment, `<script>`, `<foreignObject>`, `xlink:href`, raster `data:` URI or web font in any SVG. | `#frame=` routes the asset through `parseAtlasFrameRef()`'s canvas atlas blit, which breaks for vector sources. |
| If an app-shell sprite is used: exactly six identical frames at `frameDurationMs: 600`, and no `bannerArt`. | `@keyframes hmhCabinetFrame` hard-codes a 16% duty cycle for six frames; a one-frame sprite renders as a 1.67 Hz strobe. The sprite branch wins over `bannerArt`. |
| `STACKED_CABINET_VERSION` changes **only** when the simulation changes. | It feeds `buildHash` feeds the session seed: a bump rotates every seed and retires the season's replays. The manifest `version` moves freely. |
| Every new `.mjs`, source and test, is appended to `NODE_CHECK_FILES`. | The list is hand-maintained and un-globbed; an omission escapes `npm run check` silently, including inside `vercel:build`. |
| The `/stacked/(.*)` CSP bucket **and** the catch-all lookahead extension land in one commit. | Header rules match in order; an unlisted `/stacked/` inherits `frame-ancestors 'none'` and is un-iframeable with no symptom but a console violation. |
| `worker-src 'self' blob:` goes in on day one. | Pixi decodes textures on a blob worker. `'unsafe-eval'` starts absent, under gate G-6. |
| All twelve visual scenes capture at `evidenceSafe=1`; an all-zero signature is a failure. | Without the freeze the audio-reactive projection differs on every capture and the gate proves nothing. |
| The JS caps start `null` and hard-fail with a readable message until first measured. | A cap that starts permissive never gets tightened. Real HMH headroom is ~10 KB, not 75 KB (risk R-5). |

`test:soak` today is **30 minutes**, not 40 — the STACKED soak is a new script driving `stackPilot=1`
(gate **G-14**). Deliverables are this roadmap, per-cycle ledgers each with the mandatory "Honest
visual note", a five-export copy sheet that is the single home of the display name `HALVING`, a
CHANGELOG entry with the verbatim deployment-boundary paragraph, and the two decision files.

**Two files are called `DECISIONS.md` and they are not the same file.** `docs/stacked/DECISIONS.md` is
created by S-01 and holds the **nineteen owner gates** of §6, each marked open, each with its exact ask
and what it blocks; it is where an agent writes a blocked gate before stopping, and every gate
reference in this document set points at it. The repo-root `DECISIONS.md` is the existing house ledger
of contested decisions in its own four-part prose form (`## <date> — <decision>`, `Decision:`,
`Rationale:`, `Tradeoffs:`, `Revisit when:`); the ship cycle appends **five entries at minimum** to
that file, listed in `spec/gates.md` §8.4. A ship-gate reviewer counts nineteen gate records in the
first and five narrative entries in the second. The ship commit creates a new deployment candidate
requiring fresh certification, and it is **not promoted**.

→ **[`spec/gates.md`](spec/gates.md)**

---

## 5. Standing constraints

These hold in every cycle, without exception. Inherited from `AGENTS.md` and
`docs/hmh-reboot/AAA-ROADMAP.md` §1.1, sharpened for this cabinet.

**1. Parent authority is absolute.** The parent portal owns wallets, profiles, leaderboards,
analytics, canonical sessions, seeds, official completion, and settlement. The STACKED child never
requests a wallet, never signs anything, never sends a transaction, never writes parent persistence,
never grants an achievement, and never replaces or influences the parent-issued seed. The child
reports; the parent decides. The score written to a board is the parent's own re-simulation result,
not the number the child sent.

**2. Visuals are projection-only.** Art, interpolation, particles, shaders, bloom, audio reactivity,
animation LOD, quality tiers, the thermal governor, the frame-budget guard, and every accessibility
toggle may **never** change collision, RNG, spawning, scoring, evidence, or results. Enforced
structurally — the sim is a DOM-free parent-side module whose only input is a `uint8` mask per tick,
and the snapshot handed to the renderer is deeply frozen — and proved by a twelve-case firewall test.
A rendering feature that needs randomness uses the separate VFX RNG, never a sim substream.

The proof is **three tests, not one** (§4.2): `tests/stacked-projection-firewall.test.mjs`'s twelve
cases cover the three tiers, the three audio states, minimal effects, guard level 3 and the two
accessibility modifiers; `tests/stacked-thermal-governor.test.mjs` covers the governor (its lowest and
highest levels must produce an identical run result and an identical layout cell); and
`tests/stacked-input-device-parity.test.mjs` covers the non-keyboard input paths (keyboard, pointer and
gamepad must produce a byte-identical result **and** byte-identical evidence). The last two land in
S-15, one cycle after the harness, and are not among the twelve — citing only the twelve understates
the proof and points a future optimiser at the wrong test.

**3. Free and Ranked are isolated.** Free Mode never advances Ranked progress and writes **nothing**
to the profile, boards, XP, rank, achievements, or official sessions. Asserted field by field, not as
"mutates nothing". The Free medal shelf is device-local and never reaches the profile. A
profile-visible Free achievement would require a deliberate isolation exception only the owner can
authorise (G-10). Local two-player, when it arrives, is Free-only and never calls `recordScore` —
which creates a profile and a progress entry before its own ineligible-session early return.

**4. The simulation is deterministic and integer-only.** Fixed 60 Hz, maximum four catch-up steps.
Ticks, never frames. No floats in the sim, the result tuple, the run summary, or any persisted row.
No wall clock is read inside a fixed step. Same-seed determinism holds across three quality tiers,
three audio states, two accessibility modes, a pinned degradation level and three input devices, all
proved against the pure no-renderer path. Any change to rotation, kicks, the randomizer, gravity,
lock delay, scoring, the garbage curve, terminal conditions, RNG draw counts, or the input encoding
is a **simulation change**: RED tests first, a determinism review, a replay-divergence note in the
ledger.

**5. No settlement, no paid entry, no promotion.** `SETTLEMENT_LIVE = false`, `entryFeeMicroUsdc`
`0`, `devWallet` `null`. No contract deployed, no transaction sent, no authority changed, no real
funds moved, and no deployment promoted without explicit owner approval naming the exact deployment
ID (G-15). A cycle that finds itself needing one of these has left its scope.

**6. Never land on `main`.** Work branches from the certified continuation branch
(`reboot/hmh-aaa-continuous` or a branch from it). One cycle, one ledger entry under
`docs/stacked/cycles/`, one implementation commit, one closeout commit. No direct pushes to `main`,
no force-pushes over shared history.

**7. The cabinet stays `coming-soon` until the ship gate.** Manifest `status` is `coming-soon` and
app-shell `playable` is `false` from registration (S-06) through the last gate cycle (S-21). Only
S-22 flips them, under gates G-1, G-2 and G-3, in one atomic commit that also lands the README roster
row. Board slots and progress keys are built from `ARCADE_GAMES` irrespective of status, so nothing
is blocked by shipping non-playable — which is exactly why there is no reason to flip early.

**8. The freeze rule.** Nothing from S-02 onward re-opens a contract in `STACKED-CONTRACTS.md`
without a `STACKED_CABINET_VERSION` bump and an explicit note in the cycle ledger. `cabinetVersion`
feeds `buildHash` feeds the derived session seed, so a contract change **rotates every seed and
retires the season's stored replays**. That is correct behaviour and stated policy, not an accident
to be discovered when a board empties. This is risk R-1, the highest-probability failure in the plan;
its warning sign is any commit after S-01 that declares a constant `STACKED-CONTRACTS.md` §2 already
lists.

**9. Bridge and harness hygiene.** Bridge messages stay ≤ 65,536 bytes, measured as
`new TextEncoder().encode(JSON.stringify(message)).byteLength`. Every new `.mjs` — source and test —
is appended to `NODE_CHECK_FILES`. No `t.skip()`, `{ skip: true }` or `todo` in any STACKED test, and
no STACKED test enters the legacy retirement ledger. Any runtime, asset, routing, CSP,
service-worker or release-harness change creates a new deployment candidate requiring fresh
certification, and **never run two browser gates in parallel**, including across two cycles on one
machine.

**10. Honest copy.** The Ranked claim is exactly what §4.4 says it is and no more. Ship it described
as a **local, unshared, zero-fee integrity prototype**, keep the existing on-screen disclosure
verbatim, and say plainly that seed shopping is open. The trust column says "Replay verified", never
"Verified". No copy change may remove the word "prototype" or soften the disclosure without an owner
decision, and no ledger may describe a determinism proof as a fairness proof.

---

## 6. Owner gates

Only the owner can give these. Agents do every part that does not depend on the gate, write the exact
ask into `docs/stacked/DECISIONS.md`, and stop. **Do not fake, mock, or work around an owner gate.**

Full text with the reasoning for each is [`STACKED-CYCLES.md` §6](STACKED-CYCLES.md); five are also
stated as questions with options in `STACKED-CONTRACTS.md` §5.

| ID | Decision | Blocks | Recommendation |
| --- | --- | --- | --- |
| **G-1** | The player-facing name for the four-line clear. | Copy sheet, ship | `HALVING`. Decoupled from every id, so a rename touches copy only. **Does not block the deterministic core.** |
| **G-2** | Flip the cabinet to `playable`. | Ship | Only after all gates are green and a manual on-device pass is recorded. |
| **G-3** | Enable Ranked leaderboard writes. | Ship | Ship it described as what it is: a local, unshared, zero-fee integrity prototype. |
| **G-4** | Confirm the level cap (30) and combo-bonus cap (20) ship. | Nothing (frozen), but a reversal after the scoring cycle rotates every seed | Ship both. The consequence — the board ranks endurance with score as a skill weighting — should be seen, not discovered. |
| **G-5** | Pixi vendor chunk policy — grow HMH's shared chunk from 9 exports to 16, emit a renamed `arcade-pixi-v1.js` carrying all sixteen, or give STACKED its own vendor entry — and whether the HMH initial-JS cap splits into vendor + per-entry caps. **Blocking, not advisory: `pixi-vendor.mjs` may not be edited before the ruling.** | Build, renderer, zones (S-11, S-12, S-13) | **Rename rather than edit.** `/dist/chunks/` is `immutable` for a year with no content hash, so a mutated chunk cannot be relied on to reach returning browsers. Growing it in place also needs the owner to accept a real number: HMH initial JS is a measured 1,039,388 against a 1,050,000 cap, and the seven exports (+21,469) land it at 1,060,857 — which `gates.md` §6.2 calls a stop, and which `assertHmhInitialJsBudget` would not catch because it never sees the two shared chunks. |
| **G-6** | A second `'unsafe-eval'` CSP route for Pixi's runtime program generation. | Build | Author strict, run the smoke, add it only on a recorded violation with the call site quoted. Budget one extra certification pass. |
| **G-7** | Ranked pause policy, and whether an over-limit suspended run submits or is discarded. | Lifecycle, integrity | Record `pauseCount` and `pausedWallClockMs` either way and decide from data. No precedent in HMH or Chikun. |
| **G-8** | Fix achievement scoping now, or declare it a known defect. Fixing it changes shipped HMH and Chikun behaviour. | Verifier registry | Fix it, with an HMH no-regression fixture as the deliverable. A third cabinet makes the leak untenable. |
| **G-9** | Season identity, resolved as `stacked-season-preview-1`. Listed so the owner can object before registration, because it feeds the seed. | Registration | Dedicated. An HMH rollover must not reset STACKED boards. |
| **G-10** | Free Mode aids — the undo rewind, the starting-level range, and whether a device-local medal shelf satisfies "some achievements count in Free". | Lifecycle, achievements | Keep undo, keep the shelf device-local, do not breach isolation. |
| **G-11** | Ghost piece on in Ranked. | Lifecycle | On. Presentation-only and identical for every player; off makes the mode materially harder than everything players compare it to. |
| **G-12** | Where cabinet settings live — the shared parent panel, or an in-cabinet pause menu. | Settings | Registry-driven parent panel; a child menu forks the model. |
| **G-13** | Do the new browser gates join `vercel:build`, or only `ship:gate`? | Gate build-out | Ship gate only. `vercel:build` stays Node-only; a Chrome binary in the Vercel image is almost certainly not viable. |
| **G-14** | Committed dev autoplay (`stackPilot=1`) — code that plays the game, and the only way to reach a 40-minute run in CI. | Difficulty artifact, gates | Accept it now; replace it with a committed 40-minute recorded input stream once one exists. |
| **G-15** | Deployment promotion, per deployment, by ID. Standing rule, restated because three cycles each create a candidate. | Ship, any deploy | Never promote without naming the exact deployment. |
| **G-16** | Online-multiplayer backend — relay operator, recurring cost, a new `connect-src` origin, and whether versus rating may live server-side. | All later versus work | Do not start any of it before this gate. |
| **G-17** | `pruneCadenceLeaderboards` is destructive on existing HMH and Chikun saves too. Ship it in the hygiene cycle, or split it out? | Leaderboard hygiene | Ship it with the deletion disclosed in the ledger; the alternative is silent quota loss for every cabinet. |
| **G-18** | Zone art scope. The count (6) is frozen because it feeds a run-summary bound; only zone 0's palette is specified numerically. | Zones, gates | Placeholders for zones 1–5, replaced later. Palettes are data; dropping to five zones is a bound change and a version bump. |
| **G-19** | Cross-device Ranked fairness — one board with an `inputDevice` column, one board with a filter, or separate boards? | Mobile, leaderboard | One board, `handling.inputDevice` as a column. A column is reversible; a board split is not. A competitive-fairness call, not a technical one. |

**Explicitly not requested anywhere in this plan and not up for a gate here:** paid entry, a non-zero
`entryFeeMicroUsdc`, settlement activation, contract deployment, or a production promotion. Those
need a separate explicit HALT approval naming the exact action and candidate.

## 7. Open questions for the owner

None blocks a cycle today, but each should be answered before the thing it touches is frozen. Held in
full, with reasoning, in [`STACKED-CYCLES.md` §8](STACKED-CYCLES.md).

**Difficulty and feel**

1. Are the session-length bands a **median** or a **p90 ceiling**? The model predicts a median; if
   they are p90 targets, every tier's attainment parameter needs re-fitting before playtesting.
2. If beginner sessions come back short, the cleanest dial pushes beginner to about 3.2 min — outside
   the band — and barely moves intermediate. Bend the beginner band, or the
   single-clear-mints-nothing rule?
3. Does `CHAIN` stay a flat ×1.5, or become an escalating chain? One line in a frozen table, but it
   changes the intended competitive feel and the versus blowout profile.
4. A 0-line spin scores points but mints no `HASHPOWER`, to close a defence farm. Should a spin with
   no clear be worth points at all?
5. Does the I-piece's true 180 rotation ship as-is — mathematically correct, visibly a quirk — or is
   it kick-corrected to appear in place?
6. `FORK` detection uses the corner rule for the T-shaped piece and 4-way immobility for the rest,
   which accepts some flat placements as spins. Confirm guideline parity over strictness.
7. Does `rotate180` ship in Phase 1? It holds bit 6 of the frozen 8-bit alphabet; bit 7 is the last
   one, so a ninth action forces `stacked-bridge/v2`.
8. Zone milestones are derived from the session-length targets but are a feel decision. Against the
   difficulty model's own predictions — not the wider target bands — a beginner sees **1** zone, an
   intermediate 2, an expert 3, an elite 5 and only god tier reaches zone 5 `mainnet-aurora` at 25:00.
   So the zone described as "the payoff zone" is, under this model, god-tier-only content. Is that
   right, or should `mainnet-aurora` move down toward the elite prediction? (Attached to G-18; the
   zone *count* is frozen because it feeds a run-summary bound, but `entryTick` is data.)
9. **The defence wall at 24:00.** `HASHPOWER_MAX = 8` and `REORG_COST_MAX = 12` mean the price of
   rejecting a `REORG` passes what a player can ever bank at tick 86,400, so from 24 minutes onward no
   defence is possible at any skill level and costs 9–12 are inert as prices. The model passes every
   band either way (god tops out at 33.4 min against a 30–40 band). Is the hard wall the intended
   shape, or should `HASHPOWER_MAX` rise to 12 so the ladder stays live to 33 minutes, or
   `REORG_COST_MAX` drop to 8 so the formula stops where the economy does? Any change here is a
   simulation change and rotates every seed.

**Boards, trust, and what is public**

10. Should `pauseCount` / `pausedWallClockMs` be a public leaderboard column, or integrity-only?
11. Should a `rejected` run appear on the board with a Rejected badge (transparency), or never be
    written (the current design)?
12. Should abandoned-Ranked-start counts be public on the profile, or internal? They are a weak
    signal, so publishing may overstate what they catch.
13. Should the STACKED boards ship with seeded house rows, or launch empty? The current design routes
    the game tab to the local source on switch, which is a workaround for launching unseeded.
14. `STACKED_MAX_SCORE` bounds a god-tier run comfortably, but a fixed-width leaderboard column may
    want a lower display cap or different formatting.

**Scope and risk**

15. **Mid-run resume across a page kill.** Phase 1 loses a Ranked run if the tab is unloaded. The
    persistence layer has a checkpoint slot, so it is technically cheap — but it creates a
    save-scumming surface needing its own integrity design. Ship without, or fund the work?
16. Should the reduced-motion OS preference be one-directional — able to turn reduced motion **on**
    only, with no way back off from inside the cabinet?
17. Should the on-screen-button scheme be **auto-selected** on OS accessibility signals, or only
    offered? Auto-switching a control scheme is intrusive; the design defaults to offer-only.
18. Should the ethers-in-the-cabinet finding — a large dependency shipped into a sandboxed child with
    `walletAccess: false` — get its own fix cycle for Chikun, or only the forward-looking import rule
    for STACKED?
19. Should `apps/hmh-reboot/` and `apps/chikun/` join the security-sweep scope in a follow-up? The
    gate cycle deliberately adds only `apps/stacked` so it cannot surface pre-existing findings —
    which means the gate's name overstates its coverage until that cleanup happens.

**Release**

20. Should `CHANGELOG.md`'s heading sequence and `package.json`'s version be reconciled before the
    STACKED release entry?
21. Does STACKED ship as `1.0.0`, or as a labelled preview? Chikun shipped `0.5.0` as a vertical
    slice. `STACKED_CABINET_VERSION` is frozen at `0.1.0`; the roster row's stated semver and the
    manifest must move together either way, and a version bump rotates every seed.
22. Does the mode-select key art get the same placeholder treatment as the cabinet art, or reuse
    existing committed art until a real pass?

**Session tracking the owner named**

23. **"Players defeated / wins / losses."** These were named as parent-app session tracking. In a
    solo-only Phase 1 they have no referent — there is no opponent — so the design reserves them as
    validated-zero `summary.versus` fields with no surface (§4.5) and lands them for real in P2. If
    something solo-shaped was meant instead — boards overtaken during a run, players outranked on the
    all-time board at submission, a personal-best-beaten counter — say which, because each is a
    different derivation and one of them (players outranked) is a leaderboard query, not a run stat.

---

## 8. Start here

### 8.1 Read order

1. `AGENTS.md`, then the current release handoff it names. Nothing STACKED overrides the repo's
   standing rules.
2. **This file**, end to end. It is the shortest complete picture of the cabinet.
3. [`STACKED-CONTRACTS.md`](STACKED-CONTRACTS.md) §1 (terminology), §2 (constants), §3 (identity).
   Read §4 (interfaces) before writing any message or payload.
4. [`STACKED-CYCLES.md`](STACKED-CYCLES.md) §0 (current state), §1 (non-negotiables), §2 (the cycle
   map), then the entry for the cycle being picked up.
5. **[`spec/versus.md`](spec/versus.md) §7 ("Phase 1 scope — what must be in") and §8 ("what must not
   be in"), once, before starting S-02.** Four of its obligations land in Phase 1 and no cycle's Spec
   line cites §7, so it is the one section the by-path rule below would otherwise skip. It is where the
   reason lives: retrofitting the interruption matrix into a lockstep match later is a protocol change,
   not a UI change, and adding `versus` to `stacked-bridge/v1` later costs a protocol version bump and a
   parallel validator branch. §4.6 above is the summary; §7 is the argument.
6. The spec sections that cycle cites, by path. Do not read all seven specs front to back; they are
   reference, not narrative.

Where a spec disagrees with the contract, the contract wins and the spec is wrong. Correct it in the
same commit that reads it.

### 8.2 The first cycle

**S-01 — Contract freeze and identity spine.** Blocked by nothing; blocks everything.

Deliverables:

- `apps/portal/src/stacked-contracts.mjs` — every constant in `STACKED-CONTRACTS.md` §2, exported
  from exactly one module that imports nothing.
- A regenerable, byte-stable `contracts.json` artifact, so a drift is a diff rather than an argument.
- `tests/stacked-contracts.test.mjs` with a **duplicate-declaration scan** over `apps/`, `sdk/`,
  `scripts/` and `tests/`. A second declaration of any listed constant anywhere is a test failure.
- `apps/portal/src/stacked-cabinet.mjs`, a stub exporting `STACKED_CABINET_VERSION = '0.1.0'` and
  nothing else, importing **not** `arcade-core.mjs`.
- **`docs/stacked/DECISIONS.md`** — new, opening with §6's **nineteen owner gates**, each marked open,
  each carrying its exact ask and what it blocks. Every stop-and-ask instruction in this document set
  (§6 here, `STACKED-CYCLES.md` §6, `spec/integrity.md` §9, `spec/portal.md` §8.1,
  `STACKED-CONTRACTS.md` §5) tells an agent to write a blocked gate into this file and stop. If S-01
  does not create it, the entire nineteen-gate protocol has nowhere to write. It is a **different file**
  from the repo-root `DECISIONS.md`, which the ship cycle appends five narrative entries to (§4.7).
- `scripts/write-stacked-contracts.mjs` emitting a byte-stable `docs/stacked/contracts.json`.
- The `docs/stacked/` document set committed, including this file.
- Every new `.mjs` file appended to `NODE_CHECK_FILES` in `scripts/syntax-check.mjs`.

**Do not start S-02, or anything on tracks B or C, until S-01's constants module is committed, its
duplicate-declaration scan is green, and `docs/stacked/DECISIONS.md` exists with all nineteen gates
opened.** Everything downstream imports from that module, and a cycle that declares its own copy of a
constant is the failure mode this document set exists to prevent; a cycle that hits an owner gate with
nowhere to record it is the failure mode §6 exists to prevent.

After S-01 the dependency spine is:

```
pure sim → codec/replay → portal registration → build/shell → rendering →
audio reactivity → bridge/lifecycle (Free playable) → integrity →
leaderboard/profile/achievements → gates → ship
```

### 8.3 Verification commands that must pass

Every cycle. Run them sequentially, and never two browser gates at once — including across two cycles
on one machine.

| Command | What it proves | Notes |
| --- | --- | --- |
| `npm test` | The full Node suite, including every new `tests/stacked-*.test.mjs`. | `node --test tests/*.test.mjs …`. New test files need no `package.json` change. |
| `npm run check` | Syntax across `NODE_CHECK_FILES`. | Hand-maintained and un-globbed. **An omitted file passes silently**, including inside `vercel:build`. Append every new `.mjs`. |
| `npm run contracts:check` | Contract structure. | — |
| `npm run test:release` | The aggregate release ledger. | Fails on a single `skip` / `todo`, any nested failure, any stderr on import. |
| `npm run docs:cabinets` | Cabinet manifest ↔ documentation consistency. | Once the manifest is playable this becomes the "stacked" prose trap (R-10). **Run it; do not reason about it.** |
| `npm run docs:links` | Documentation link integrity. | Covers the cross-links in this document set. |
| `npm run assets:verify` | Committed asset integrity. | Cabinet art lands here. |
| `npm run design:security-audit` | Security sweep over `scopeDirs`. | `apps/stacked` is added to the scope in the gate cycle. |
| `design:third-party-security`, `design:integrity-bounds`, `design:tokens`, `repo:health:strict` | Cabinet boundary, integrity bounds, shared tokens, repo hygiene. | — |
| `npm run vercel:build` | The deployable build. | Node-only, no browser. **Keep it that way** (G-13). |

Browser gates — serial, one at a time, from the rendering cycles onward:

| Command | Scope |
| --- | --- |
| `npm run visual:responsive` | Portal DOM, including the new `stacked-mode-select` state at `/games/stacked`. |
| `npm run smoke:portal`, `smoke:portal:interactions`, `smoke:portal:e2e` | Portal behaviour with a registered cabinet. |
| `scripts/stacked-visual-regression.mjs` | Twelve STACKED scenes at `evidenceSafe=1`. New script; does not exist yet. |
| STACKED performance smoke | `#stackedStage` telemetry against the frozen budgets. New; does not exist yet. |
| STACKED 40-minute soak | `stackPilot=1`, ≥ 115,200 ticks advanced, one uninterrupted 72,000-tick run. New; `test:soak` today is 30 minutes. |
| `npm run ship:gate` | The ship cycle only. |

### 8.4 The one-line summary for a future session

STACKED does not exist yet. `STACKED-CONTRACTS.md` says what every name and number **must** be,
`STACKED-CYCLES.md` says what lands **when**, the seven specs say **how** each area works, and this
file says **what the game is and what may never change**. Start at S-01, import every constant from
one module, keep the simulation deterministic and integer-only, keep the visuals on the far side of
the projection firewall, and stop at every owner gate.
