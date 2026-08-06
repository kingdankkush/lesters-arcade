# Hard Money Heroes + Lester's Arcade — in-depth upgrade program

Date: 2026-08-03 PDT
Author: Claude Fable 5 (cycles 041-049)
Recipient: Hermes agent
Branch: `reboot/hmh-aaa-continuous` (head at authoring: `2b5caa35`)
Companion docs: `2026-08-02-hmh-cycle-049-fable-handoff.md` (production state,
operational facts), `docs/hmh-reboot/ART-DIRECTION-GAMEWORLD.md` (creative
authority), `2026-07-30-hmh-cycle-036-hermes-handoff.md` (architecture,
bridge, Web3 truth).

> **Status note (2026-08-05, updated after T1).** Fifteen of these tasks are now
> DONE, Wave 2 is complete, and two
> constraints have changed since this was written — the child bundle has 1.4 KB
> of headroom left, and the props reproducibility gate has been observed flaky.
> Read `2026-08-05-hmh-hermes-remaining-program.md` FIRST for current state,
> what remains, and the pipeline facts learned building it. The budget table in
> section 3 below is stale; the handoff has current numbers.

This document is the **task backlog**. It is grounded in a live audit taken
2026-08-03; every number below was measured, not remembered.

---

## 0. Ground rules that bound every task

Violating these wastes a whole cycle. They are not negotiable.

1. **Determinism.** Every shipped atlas/tile must regenerate byte-for-byte
   from repo-owned source (Blender scenes + Python builders + manifests).
   Hand-painted pixels, one-off AI image generation, and manual retouching
   of a shipped sheet are all forbidden. Fix the source, re-run the
   pipeline, verify reproducible.
2. **Projection-only vs simulation.** Art, VFX, particles, audio, shaders,
   animation, and LOD may never change collision, damage, AI, spawning,
   RNG, progression, or results. Anything that does is a SIMULATION change:
   RED tests first, determinism review, replay-divergence note in the ledger.
3. **Budgets (measured 2026-08-03).**
   | Budget | Used | Cap | Headroom |
   |---|---|---|---|
   | Child JS bundle | 1,040,559 B | 1,050,000 B | **9.4 KB — critical** |
   | Hero atlases (4) | 12,249,201 B | 12,582,912 B | **333 KB — 2.7%** |
   | Enemy roster atlases (7) | 7,329,734 B | 10,485,760 B | 3.1 MB |
   | Authored prop atlas (45) | 178,089 B | 524,288 B | 346 KB |
   | Hero selector atlas | 362,003 B | 524,288 B | 162 KB |
   Art is fetched at runtime and does **not** consume bundle bytes — asset
   work is the cheapest high-value work available. Code work must come with
   size accounting.
4. **Cycle discipline.** One bounded slice → RED tests → implement → full
   gates **sequentially** (never two browser smokes at once) → inspect
   visual evidence by eye → exact-index adversarial review → fix →
   re-review → commit implementation and closeout separately → push →
   promote → verify in a real browser → record deployment + rollback.
5. **Known environment traps.** Heap-delta perf assertion is high-variance
   (rerun once, never rerun-to-green anything else); serve `apps/portal` on
   8899 and pass `HMH_REBOOT_ORIGIN`; Vercel Security Checkpoint currently
   403s automated clients against production (owner must add a
   Protection-Bypass-for-Automation secret).
6. **`SETTLEMENT_LIVE=false`.** No contract deploy, transaction, or
   settlement change without a separate explicit HALT approval.

---

## 1. Terrain and ground textures

Current: `scripts/build-hmh-terrain-tiles.py` bakes 11 materials at 512px
(`hmh-terrain-tiles-v2`) — `packed-earth, red-rock, wet-bank, forest-floor,
crushed-ore, industrial-slab, road, water, shallow-water, bridge-deck,
ledge-top`. One material per district, one per surface kind. Cycle 049
raised contrast (underpaint 0.30, 5 value bands mixed 0.34, grain ×1.6,
accents ×1.35). Fringe strips (128px) blend district boundaries west→east.

**T1. Intra-district material patches** *(L)*
One flat material per district is the remaining reason ground reads
uniform. Author 2-3 sub-materials per biome (e.g. hashwood: forest-floor,
mossy-floor, needle-litter) and a deterministic patch mask so a district
reads as varied ground rather than one fill. The world contract stays the
authority; patches are projection-only.
*Files:* `build-hmh-terrain-tiles.py`, `terrain-tile-atlas.mjs`,
`world-production-art.mjs`. *Accept:* no seams, no perf regression, ground
variety visible in all 8 visual scenes.

**T2. Ground decals** *(M)*
Deterministic decal layer above tiles, below props: wheel ruts and tire
tracks on roads, scorch marks near explosive zones, dried blood/oil at
arenas, cracked mud at shorelines, footpath wear along the main route.
*Accept:* decals hug routes/POIs from the world contract, never occlude
actors, pooled sprites (no per-frame allocation).

**T3. Shore and cliff transition bands** *(M)*
Water currently meets land with a fringe only. Add authored bank bands
(wet sand → dry), foam lines at shallow edges, and rock scree skirts at
cliff bases so elevation changes read physically.

**T4. Road network materials** *(M)*
`road` is one material. Add gravel-shoulder, cracked-asphalt, and
dirt-track variants, plus centre-line/edge decals, so the main route reads
as a real road with shoulders instead of a colored ribbon.

**T5. Third bake tier evaluation** *(S, measure first)*
Evaluate 1024px for hero-visible materials only (road, water,
industrial-slab). Measure decode time and memory on mobile before
committing; 512px stays the floor for the rest.

---

## 2. 3D asset library (Blender)

Current: 45 authored props (26 world-prop, 10 power-up, 5 pickup, 4
weapon) via `scripts/hmh-blender/create-hmh-authored-props.py` +
`run-hmh-authored-props-pipeline.py` (`assets:hmh:authored-props:verify`).
Technique that ships: `prism_mesh` vertex-authored flat-shaded solids for
anything whose parts must visually join; beveled primitives for rounded
massing. 55° ortho camera, shared light rig, per-asset `frameSize`
(256px for detail props). Atlas has 346 KB of headroom — **this is where
the most visual return per byte lives.**

Hard-won: horizontal, low-lying shapes fail at the 55° camera
(`driftwood-log` failed three passes — re-concept as a vertical tidewrack
pile rather than iterating). Smooth spheres read badly; facet them.

### 2A. Nature and biome dressing

**A1. Trees, second generation** *(L)* — Currently `hashwood-pine`,
`hashwood-tree`, `dead-pine`, `hashwood-stump`. Add: birch/aspen cluster,
fallen log with root plate (vertical!), sapling thicket, burned snag,
canopy-edge tree (asymmetric, for treeline framing), and a **beacon-tree
set-piece** matching the hashwood landmark.

**A2. Plants and undergrowth** *(M)* — Nothing exists between "tree" and
"bare ground". Add: scrub bush, fern cluster, tall grass tuft, thorn
bramble, flowering weed patch, hanging vines (for ravine walls).

**A3. Rocks, cliffs, boulders** *(L)* — Only `granite-boulder` and
`moss-boulder` exist; cliffs are procedural blocker art. Add: rock spire,
layered rock shelf, scree/rubble pile, cliff-face module (tileable along a
capsule blocker), balanced/precarious boulder, ore-veined rock for mining
camp.

**A4. Water dressing** *(M)* — Only `reed-cluster`. Add: lily pads, water
grass, submerged log, stepping stones, dock post, mooring cleat, and a
wetland hummock.

### 2B. Structures, towns, and camps

**A5. Bridges, expanded** *(M)* — The proof-of-work bridge is a surface +
two rail blockers. Add authored bridge modules: stone footings/piers,
support trusses, plank deck variants (intact/damaged/missing boards),
handrail posts, warning signage, and a **rope-bridge kit** for the ravine
overlook drop.

**A6. Town / neighborhood kit** *(XL — the biggest visual win available)*
Only `miners-shack` and `watchtower` exist. Author a modular settlement
kit: shopfront with awning, two-storey tenement, corrugated lean-to,
market stall, water tower, fuel pump island, signage/billboards, porch
and stoop modules, fence-and-gate variants, streetlamp, mailbox, stacked
crates. Shared scale, pivots, and collision proxies so blocks compose.
*Then* author an actual town district (see W2).

**A7. Camp and enemy-hangout kit** *(L)* — Enemies currently spawn in
open space. Author: campfire with cook pot, bedroll cluster, sandbag
nest, scrap barricade, watch platform, ammo crate stack, banner/totem
(faction identity per enemy role), scrap-metal wall segment, cage/pen.
These make encounter arenas read as *places enemies live*.

**A8. Industrial / mining detail** *(M)* — Have `ore-cart`,
`ore-conveyor`, `loader-barrel`, `cargo-container`, `fuel-drum`. Add:
headframe module (matching the landmark), rail track segments, tipple
chute, generator/compressor, pipe runs, spoil heap, floodlight mast.

**A9. Set-piece landmarks** *(L)* — Each district's landmark
(`relay-tower`, `forked-spire`, `proof-of-work-bridge`, `hashwood-beacon`,
`mining-headframe`, `liquidation-tower`) is currently procedural blocker
art or a small prop. Author real multi-part set-pieces with a
dressing-free breathing ring, per the art doc's Death's Door rule.

**A10. Weapon and pickup models refresh** *(M)* — 4 weapon props +
5 pickups. Add models for the two planned pickups from the 036 handoff
(**Hash Rail**, **Lightning Ledger**) and a crit power-up chip (needed by
S3 below — the run-upgrade catalog is 1:1 with the ten power-up assets).

**A11. Props → dressing wiring** *(S, follows each wave)* — Every new
asset needs: roster entry in `authored-prop-atlas.mjs`
(`AUTHORED_PROP_ASSETS`), district `propIds`/`countOverride`, count-lock
test updates, and asset QA reproducible ×2.

### 2C. Characters and enemies

**A12. 256px hero escalation** *(XL, dedicated session)* — Heroes render
648 frames each at 160px into 2048² sheets; the atlas budget has **2.7%
headroom**, so this requires an explicit budget renegotiation with the
owner (~2.5× pixels) plus multi-hour renders. Do ONE hero first. Must
also regenerate the selector atlas (`assets:hmh:atlas-roster`) — the
character-select turntables are current as of Cycle 037 but frame-limited,
which is exactly why that screen reads dated.

**A13. Hero animation pass** *(L)* — Weight shift, foot planting, stride
timing, direction changes, aim offsets, weapon recoil, reload actions, hit
reactions, knockback readability, distinct death poses. Projection-only:
animation selection must follow authoritative movement state without
touching simulation timing.

**A14. Enemy visual identity wave** *(L)* — 6 ordinary roles
(`bagholder-rusher`, `forkrunner`, `liquidator-agent`, `whale-enforcer`,
`gas-bomber`, `validator-cultist`) + boss, 152 frames each, 3.1 MB of
roster headroom. Per role: silhouette distinction at swarm density,
faction colour coding, readable tells (anticipation/strike/recovery must
be visually distinct without changing simulation timing), and damage
states.

**A15. Boss presentation** *(M)* — `the-liquidator`, 456 frames, 3 phases
(`market-open` / `margin-call` / `total-liquidation`, 12,000 HP). Add
per-phase visual transformation, arena-wide telegraph art, and a phase
transition beat.

---

## 3. World design and composition

Current: 6 districts across 12,000 × 4,800 units, 38 blockers, 10 POIs,
6 encounter arenas, 6 landmarks, 75 dressing placements, winding 25-node
main route (55 s unopposed traversal), corridor-clearance tests enforced.

**W1. Density pass with the expanded library** *(M, after each asset wave)*
Raise per-district dressing counts and prop mixes; compose anchor +
satellite clusters (Nuclear Throne rule) rather than scattered singles;
respect route/arena clearance (the corridor checker is in
`tests/hmh-reboot-level-one-composition.test.mjs`).

**W2. A real town district** *(XL)* — The owner asked for towns and
neighborhoods. Options: (a) convert part of `liquidation-yard` into a
ruined neighborhood with street grid, building blocks, and alley
chokepoints; (b) extend the world bounds eastward with a 7th district.
(a) is cheaper and keeps traversal time in the 40-70 s bound; (b) needs
bounds/minimap/reveal rework. **Decide with the owner before building.**
Either way this needs A6 first.

**W3. Enemy hangouts / encampments** *(M)* — Attach the A7 camp kit to
spawn regions and arenas so enemies come *from* somewhere. Purely
dressing + spawn-point placement; no AI change.

**W4. Interior/enclosed spaces** *(L)* — Every space is currently open
ground. Add roofless enclosures (walled yards, ruined interiors) with
authored entrances — a different combat texture, and the navgrid already
handles them.

**W5. Verticality** *(M)* — Two ledges and four ramps exist. Add more
elevation: overlook platforms, sunken pits, stepped terraces. Elevation is
already authoritative in the world contract and the navgrid respects
one-way drops.

**W6. Secrets and rewards** *(M)* — Hidden caches behind destructible
cover, an optional hard-to-reach ledge cache, a lore prop set. Discovery
already persists in the minimap model.

**W7. Weather and atmosphere** *(M, projection-only)* — Drifting fog banks
in the ravine, ember drift in the yard, pollen in hashwood, light rain on
the crossing. Must stay inside the particle budget (p95 7 ms today).

**W8. Level 2 planning** *(XL)* — Level 1 is the only authored world. When
its quality bar is met, the same contract shape can carry a second world.

---

## 4. Combat

**C1. Per-weapon audio and VFX identity** *(M)* — There is **one**
`weapon-fire.ogg` for all four weapons. Author per-weapon fire, reload,
empty-click, and impact sounds; muzzle flash and shell-eject VFX per
weapon silhouette.

**C2. Impact and death feedback** *(M)* — Hit sparks by surface type,
directional blood/oil, ragdoll-ish death emphasis, screen-shake tuning per
weapon class (respect the existing reduce-motion setting).

**C3. The two planned pickups** *(L)* — **Hash Rail** (precision rail,
line penetration, scarce cells) and **Lightning Ledger** (chaining arc
weapon) from the 036 handoff, with models (A10), finite reserve ammo,
HUD/accessibility labels, and their own upgrade trees.

**C4. Melee depth** *(S)* — Melee exists but is thin and unreachable on
touch (a documented Cycle 025 gap). Either give it a real role or retire
it explicitly.

**C5. Boss fight depth** *(L)* — Authored counters, add-wave pressure,
arena use, and build checks rather than health inflation. Validate with
same-seed survival and TTK reports.

**C6. Swarm-pressure benchmark** *(M)* — The weapon benchmark
(`docs/qa/hmh-weapon-benchmark.json`, v2) covers static and moving single
targets. Extend to swarm clear time, overkill, and projectile pressure —
**this is the missing evidence for every balance decision below.**

---

## 5. Movement and controls

**M1. Controls-help overlay** *(S — highest value per hour in this list)*
Desktop weapon slots (Digit1-4) exist but are undiscoverable; the owner
never found them, which is what made the exhausted-shotgun bug fatal. Add
a controls card on the pause menu and a first-run hint.

**M2. Full action map audit** *(S)* — Keyboard: WASD/arrows, Space fire,
E/F/G, Shift dash, Escape, Digit1-4. Gamepad: mapped. Touch: MOVE/AIM
sticks, SWAP, POWER, PAUSE + double-tap dash. Document it, remove
duplicates, and expose it in-game (feeds M1).

**M3. Key rebinding + input settings** *(M)* — No rebinding exists. Add
rebinding, aim-assist toggle, stick-sensitivity, and left-handed touch
layout, persisted parent-side.

**M4. Movement feel measurement** *(M)* — Measure input-to-motion latency,
acceleration/deceleration curves, diagonal normalization, turn response,
and camera follow across all three input methods before tuning anything.

**M5. Dash polish** *(S)* — Input buffering, edge forgiveness at drops,
landing dust, clearer cooldown feedback.

**M6. Chunked navgrid build** *(M)* — The ~400 ms grid build blocks first
paint. The naive deferral into `initializeSession` **was tried and
reverted** (it dropped a touch pointer-up on iphone-13-portrait — see
CYCLE-046). The fix must slice the build across idle time *before* input
binds.

**M7. Camera work** *(M)* — Aim-based look-ahead offset, encounter
framing, subtle zoom on boss phases; must not break the visual baselines
without intent.

---

## 6. Progression, skill tree, and balancing

Current: XP curve `150 × level × (level+1)`; exactly two deterministic
choices per level-up; 10-entry `RUN_UPGRADE_CATALOG` (1:1 with the ten
power-up art assets) across power/survival/mobility/utility branches with
a repeatable mastery tail; weapon upgrade trees exist per weapon
(rateOfFire/damage/reloadSpeed with tier-3 capstones).

**S1. Long-run balance simulation — COMPLETE** *(L — unblocks S4/S5)* —
Commit `951cb8d9` certifies 192 deterministic 30-minute runs across all 4
heroes × 4 authoritative weapons × 6 authoritative enemies × 2 seeds. The
report covers levels/minute, one visible draft per applied upgrade, dead
offers, build diversity, live-combat expected-hit growth, survivability, and
upgrade timing. Final digest: `3289067f`; 192/192 valid/completed, zero dead
offers, median 2.0 levels/minute, 1.605× damage growth, and 28-second median
upgrade interval. The analytical survival result does not replace browser or
human balance evidence. Preview `dpl_13eBCtQnRDuZbfCViZeN8yHNAxbJ` was Ready;
deployed child remained raw byte-identical at 1,048,584 bytes.

**S2. XP source rebalance — COMPLETE** *(M)* — Commit `fa64070d` routes enemy
defeats, a 160-base-XP authored Litecoin token, and 5/10/20/30 no-damage combo
milestones (120/240/480/900 base XP) through one child multiplier/threshold
authority. Actual player damage and run resets clear combo state; fixed ticks,
not render rate or wall-clock, own event order. The deterministic Blender token
pipeline passed 82/82 unique frames, release passed 2,015 entries, and Ready
Preview `dpl_HC3G4bDDcJkUi3Ct4k6w3R6xpi5r` served the raw-identical 1,049,954-byte
child (46 bytes headroom).

**S3. Critical-strike branch** *(M)* — The machinery already exists
(`combat-events.mjs` seeded criticals; player hits carry
`criticalChance: 0.08`, `criticalMultiplier: 1.75`). Needs a catalog
entry, effect wiring, a new power-up art asset (A10), and count-lock
updates. Natural next skill-tree step.

**S4. Pistol depth tree** *(L)* — Per the handoff: crit chance/damage,
magazine, projectile speed/range, penetration/ricochet, elemental procs,
crowd-control capstone — with caps, stacking order, proc ownership, and
deterministic rounding in **one authoritative module** to avoid
multiplicative runaway.

**S5. Enemy band rebalance — COMPLETE** *(L)* — Commit `b785ce6f` adds
measured stat corrections, deterministic weighted role mixes, a bounded
non-stacking validator armor pulse, and a range-only shotgun correction.
Existing intervals/caps/tokens were certified against 34.24–55 player KPM;
matrix digest `6a6f21c3`. Release/browser gates passed and Ready Preview
`dpl_7NkyGHvhTqPYeQUMhEsuYkEYb79L` served the raw-identical 1,049,934-byte child.

**S6. Skill-tree UI** *(M)* — The two-card level-up is clean but there is
no way to review your build mid-run. Add a build summary to the pause menu
showing branch ranks and weapon-tree state.

---

## 7. Game UI and menus

**Measured 2026-08-03.** `apps/portal/main.js` is **15,538 lines**; CSS is
~7,160 across `styles.css` (5,065), `styles-arcade-polish.css` (1,830) and
the child's `apps/portal/hmh-reboot/styles.css` (265). The child's DOM
layer `cockpit-ui.mjs` is only 204 lines — health pips, boss bar, damage
flash and minimap are Pixi-drawn in `apps/hmh-reboot/src/main.mjs`.

Two structural facts to know before editing anything here:
- **A shared token file already exists**: `apps/portal/src/design-tokens.css`
  (106 lines: brand palette, semantic colours, rarity tiers), loaded
  blocking at `index.html:46` — but the **child stylesheet never imports
  it**, which is why the iframe HUD drifts from the portal palette.
- **The legacy canvas combat path is still present and largely dead** in
  the reboot configuration (`HMH_REBOOT_ENABLED = true`, `main.js:1694`):
  `#combatCanvas`, `renderCombatMenuActionGrid` (`main.js:3033`),
  `renderCombatSettingsPanel` (`:3586`). The child owns HUD, pause and
  level-up now. **Confirm which path you are editing before touching
  combat UI** — this is the single easiest way to waste a cycle here.

**U1. Child imports the design tokens** *(XS — do this first)*
Import `design-tokens.css` into `apps/portal/hmh-reboot/index.html` and
replace the child stylesheet's literal hexes with the variables. Small,
safe, and it makes every later UI task consistent by default.

**U2. Pause-menu music player** *(M — Priority K)* — The portal has a full
jukebox (prev/play/mute/next/shuffle/seek/queue, `main.js:1032-1290`, ~30
tracks in `src/arcade-playlist-manifest.mjs`); the child has exactly one
music control — an on/off checkbox (`cockpit-ui.mjs:73`) plus a HUD
toggle. Bring the full transport into the pause menu: track display,
play/pause, prev/next, seek, volume, and playlist access. Transport must
decouple from simulation pause; parent owns metadata, child sends intents.

**U3. Character select depth** *(M)* — Already has rotating turntables,
name, tagline, bio, starter weapon, passive, 4 stat bars (Power/Speed/
Armor/Luck from `src/hmh-character-config.mjs`) and unlock meters. Real
gaps: (a) **no side-by-side comparison** — each card renders bars in
isolation, so the 036 handoff's A10 "starting-stat comparison" is
unmet; (b) the rotator has **no `prefers-reduced-motion` guard** (the
reduce-motion blocks don't cover `.hmh-cabinet-rotator`/`.hero-card-stage`);
(c) the mobile swipe carousel has no dot/index indicator; (d) no
arrow-key navigation between cards.

**U4. Game select cabinet** *(M)* — Four entries in
`src/arcade-core.mjs:583-616`: HMH (playable, 8-frame rotating sprite),
Chikun (dev-gated, has a full 6-frame sprite), plus MWEB Invaders and
LitVM Legends which are **flat banner JPGs only**. Card metadata is thin:
status label, icon, title, one-line description. Add genre, session
length, control/mode fit, a gameplay thumbnail, and one obvious primary
action. Decide explicitly whether the two banner-only cabinets should be
visible at all pre-launch.

**U5. Splash / first-run rework** *(M)* — The splash already leads with a
looping gameplay video and two CTAs (`index.html:132-149`), which is
better than a static hero. Real gaps: **five clicks to play** (Play Free →
cabinet → mode → hero → Begin, plus an intro-splash step for HMH), and no
leaderboard teaser or social proof anywhere on the splash. Target ≤3
clicks to a running game and add one piece of live competitive proof.

**U6. Profile as a command center** *(L)* — Already substantial: wallet
identity, editable name/avatar, achievement count, trophy room, per-game
stat card with rarest badge, character collection, chain hydration
(`main.js:4621`, `:4436`). Add per-hero and per-weapon breakdowns,
personal bests, build history, and explicit Ranked-vs-Free separation
(needs D1).

**U7. Leaderboard provenance** *(M — reframed after audit)* — Rows already
show rank, name+avatar, score, kills, survive time, level, max combo,
powerups, trust badge, and an on-chain/house-score provenance marker
(`main.js:5348-5377`). The handoff's five-stat requirement is **already
met**. The real issue: `src/leaderboard-seed.mjs` mixes **seeded house
scores** into the boards (labelled, but mixed). Audit that before any
public launch and decide whether seeded entries survive.

**U8. Achievements** *(M)* — Real catalog + atlas + tier classes +
tooltips (`main.js:5041-5066`, `renderAchievementIcon:1913`). Gaps:
no unlock date, no progress-toward-locked meters, and tooltips are
CSS-only spans (not keyboard/screen-reader accessible).

**U9. In-game settings** *(S)* — Four toggles today (music, screen shake,
reduce motion, reduce flash — `PAUSE_SETTING_KEYS`, `cockpit-ui.mjs:14`).
Add volume sliders (music/SFX split), input settings (M3), and the
controls card (M1).

**U10. Portal modularization — COMPLETE (`6b9e1b42`)** *(L, enabling)* — Six
reviewed dependency-injected slices extracted route history/deep links, shell,
app dispatch, profile, leaderboard, cabinets, mode selection, character select,
and gameplay presentation. `main.js` fell 1,039 lines (15,540 → 14,501). Release
closed at 2,005 tests / 1,954 pass / 51 expected failures; portal, cockpit,
network, direct profile/scores, and Chikun dev-cabinet checks passed. The Ready
Preview is `dpl_AuFosN2dQ3WYysfWazEpkikqKAe5`. This is eager source separation,
not lazy-loading or child headroom: parent output is 1,098,361 B (+8,084 B from
P6), and the separately-built HMH child remains exactly 1,048,584 B.

**U11. Wallet UX truthfulness** *(M — has a trust dimension)* — The real
path is genuinely real: injected EIP-1193 + EIP-6963 discovery + SIWE
(`main.js:6423`, `:6169`, `src/wallet-auth.mjs`), and guest play is
first-class with wallet gating only Ranked. Two concrete problems:
(a) **`connectMockWallet` (`main.js:6187`) silently substitutes a mock
wallet when no provider exists** — a user with no wallet can believe they
connected one; make that state explicit and labelled;
(b) there is **no "connecting…" state** on the connect button, and
Settings still advertises sign-out as "Coming next" (`main.js:5401`)
although `signOutWallet` exists (`:6204`). Also explain what a signature
does *before* prompting.

**U12. Game-over surface — verified present, do not "fix"** *(note)*
The child emits `game:game-over` (`apps/hmh-reboot/src/main.mjs:2601`);
the parent handles it in
`src/hmh-reboot-portal-lifecycle.mjs:45 finalizeGameOver`, which
normalizes run stats and drives the summary. An early audit pass flagged
this as missing; it is not. Verify by playing before acting on any
contrary report.

---

## 8. Data tracking and scoring

**D1. Run-stats schema** *(L — unblocks U6/U7)* — Priority I of the 036
handoff, still unbuilt. Versioned, bounded, deterministic per-run summary:
identity/seed/hero, survival time, score, level, XP, Litecoin, max combo;
kills by role/weapon/elite/boss; shots-vs-pellets accuracy split
(trigger accuracy and pellet accuracy must be separate); damage dealt/taken;
weapon pickups/swaps/reloads/empties; grenades; power-ups; upgrades
offered/selected; distance, districts visited, POIs found, fog explored.
Integer, bounded, rate-limited across the 64 KB bridge with one final
canonical snapshot.

**D2. Analytics funnel** *(M)* — Homepage → play → hero choice → run start
→ 1-minute survival → first upgrade → first pickup → death → replay →
profile → wallet connect. Parent-owned and privacy-conscious.

**D3. Combo system** *(M)* — Max combo is a planned leaderboard stat with
no mechanic behind it. Design and implement a bounded combo with clear
feedback (feeds S2 and D1).

---

## 9. Audio

Current: 14 SFX files in `assets/audio/sfx/`, ~30 playlist tracks, 5 music
tracks. A real cue registry with voice allocation exists
(`apps/portal/src/hmh-audio-system.mjs`, 273 lines). The child's
`combat-audio.mjs` (176 lines) plays **one hardcoded track** plus 6 SFX
via `new Audio()` — notably **one `weapon-fire.ogg` for all four weapons**.

**X1. SFX library expansion** *(M)* — Per-weapon fire/reload/empty-click,
footsteps by surface material, dash, level-up, upgrade select, boss phase
cues, low-health warning, pickup variants by type, UI navigation.
**X2. Mix and ducking** *(S)* — Volume categories (music/SFX/UI),
distance attenuation, ducking under boss telegraphs. Route the child
through the existing `hmh-audio-system` registry rather than growing a
second ad-hoc player.
**X3. Music integration** *(S)* — Follows U2; preserve track and position
across portal→HMH transitions where browser policy allows.

---

## 10. Platform and hygiene

**P1. Vercel automation bypass** *(owner action)* — Restores headless live
certification and byte verification to the promote ritual.
**P2. Heap-gate hardening** *(S)* — Forced GC or median-of-N; it currently
swings −32 MB to +38 MB on near-identical builds.
**P3. Legacy asset triage** *(M)* — `apps/portal/assets/generated` is
57 MB; ~40 MB is reboot-era (heroes 23, enemies 9, terrain 5), ~17 MB is
superseded Canvas/isometric/pixellab-era art. Decide keep/retire per
directory; feeds the CDN gate.
**P4. Truthful docs pass** *(S)* — Several public-facing docs still
describe pre-041 cycles.
**P6. Legacy code triage — COMPLETE (`372c7ef9`)** *(M)* — Retired the public
pre-reboot canvas/backstage markup, animation and pointer roots, conditional
Reboot flag, and obsolete legacy browser soak. Official status writes now map
to `#officialGameStateCopy`; six portal flows pass with zero errors. The emitted
parent fell 163,521 B (13.0%) to 1,090,277 B. The child stayed 1,048,584 B,
proving that parent cleanup does not unblock child-code tasks. Remaining dead
source/selector separation belongs to U10; child headroom needs its own triage.
**P5. Visual scene coverage** *(S)* — 8 pinned scenes exist; new districts
or set-pieces need their own scenes or they ship unwatched.

---

## 11. Suggested sequencing

Dependencies matter more than priority here.

**Wave 1 — foundations (cheap, unblocks a lot):** U1 child imports tokens ·
M1 controls help · U11a label the mock-wallet state · S3 crit branch ·
P2 heap gate · A2 plants + A3 rocks (first asset wave, atlas headroom is
free).

**Wave 2 — the living world:** A1 trees · A4 water · A5 bridges · A7 camp
kit → W1 density · W3 hangouts · T1 material patches · T2 decals.

**Wave 3 — towns (decide scope with owner first):** A6 town kit → W2 town
district · A9 set-pieces · T4 roads · P5 new visual scenes.

**Wave 4 — evidence-driven balance:** C6 swarm benchmark · S1 long-run
sim → S5 enemy bands · S2 XP sources · S4 pistol tree.

**Wave 5 — characters:** A12 256px hero (budget conversation) · A13
animation · A14 enemy identity · A15 boss presentation · U3 character
select.

**Wave 6 — UI and data:** D1 run stats → U6 profile · U7 leaderboards ·
U2 pause music · U4 cabinet · U5 homepage (U10 modularization first if
these grow large).

---

## 12. Definition of done (every task)

RED test written first and observed failing · smallest coherent change ·
all gates green sequentially · visual evidence inspected at full
resolution by eye, not just by metric · exact-index adversarial review
with the geometry/values needed to recompute claims, re-reviewed after
restaging · cycle ledger written with honest gate numbers and any reverted
attempt recorded with its evidence · implementation and closeout committed
separately · production verified in a real browser · deployment ID and
rollback recorded.

Two habits from cycles 041-049 that repeatedly paid off: **write down what
failed and why** (the reverted navgrid deferral and the three-pass
driftwood failure both saved a later cycle from repeating them), and
**give the reviewer numbers to recompute rather than claims to approve**
(that is what caught the severed loop corridors, the inverted terrain
scaling, the stale flow field, and the mobile SWAP trap).
