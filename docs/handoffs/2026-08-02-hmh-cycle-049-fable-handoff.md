# Hard Money Heroes Cycle 049 production handoff for Hermes

Date: 2026-08-02 PDT
Author: Claude Fable 5 agent (cycles 041-049)
Recipient: Hermes agent
Continuation branch: `reboot/hmh-aaa-continuous`
Branch head at handoff: `3791abe9`
Production: <https://lestersarcade.io>
Settlement: `SETTLEMENT_LIVE=false` (unchanged, HALT-gated)

This supersedes `2026-07-30-hmh-cycle-036-hermes-handoff.md` as the current
handoff. The Cycle 036 document remains authoritative for the architecture
boundaries, bridge contract, and Web3 truth it records — none of that
changed. Read this document, then CYCLE-041 through CYCLE-049 in
`docs/hmh-reboot/cycles/`, then the 036 handoff for the standing contracts.

## 1. Production state verified 2026-08-02

| Release fact | Verified value |
| --- | --- |
| Branch head deployed | `b866c17c` (closeout `3791abe9`) |
| Production deployment ID | `dpl_A9ydUK3hgNA3GcBGMTMHC6N1v152` |
| Immutable production URL | <https://lesters-arcade-5a6xqa2nq-justin-agent-projects.vercel.app> |
| Public alias | <https://lestersarcade.io> |
| Rollback | Cycle 048 `lesters-arcade-ibu2j9z69` (`dpl_2iXBUqq2F1i9PAAE5NJu3FBdwPTY`) |
| Release ledger | `1,846 / 1,794 / 52 / 0` |
| Bundle | `1,040,559 / 1,050,000` bytes (~9.4 KB headroom — TIGHT) |
| Perf | p95 7 ms desktop and mobile; 8/8 visual scenes |

**CRITICAL environment fact:** Vercel's Security Checkpoint (bot challenge)
began 403-ing ALL automated clients on the public alias on 2026-08-02 —
curl byte-verification and headless certification against PRODUCTION are
blocked until the owner adds a Protection-Bypass-for-Automation secret
(owner action item, already flagged). Verify production through a real
browser until then. Local/preview certification is unaffected.

**The authenticated Vercel CLI in this environment CAN promote:**
`npx vercel promote <preview-url> --yes` (it rebuilds the commit against
the production environment). The owner has given standing "push live"
approval for gate-passing work — promote after gates + review, record the
deployment ID and rollback in the cycle doc.

## 2. What cycles 041-049 shipped (all live)

- **041** — Level 1 biome composition: winding 25-node main route, 11 → 38
  blockers (compounds, canyon spurs, wetland banks, thickets, fenced
  yards, wreck chicanes), seam gates, arena cover, tenth POI. Guarded by
  `tests/hmh-reboot-level-one-composition.test.mjs` incl. loop-corridor
  sweeps and an exhaustive blocker-vs-route-corridor checker.
- **042** — 512px painted terrain (`hmh-terrain-tiles-v2`); renderer scale
  is resolution-independent (`TERRAIN_TILE_REPEAT_WORLD = 66.56`).
  Octave periods are lattice CELL COUNTS — never scale them with tile size.
- **043** — Enemy navgrid + flow-field pathing (`enemy-navgrid.mjs`): 60u
  cells, 3×3 sub-cell blocker sampling, directed edges through the
  canonical elevation rules, tick-keyed refresh, per-run reset in
  `initializeSession`.
- **044** — Gameworld visual arc: `ART-DIRECTION-GAMEWORLD.md` (reference
  study → applied per-biome rules), 8 new Blender props (37 → 45;
  `driftwood-log` atlas-only after three honest failures — re-concept as a
  tidewrack pile, do not iterate the horizontal log), dressing 43 → 75
  placements, minimap fog inversion + visibility-only enemy pips +
  monotonic POI discovery (`minimap-model.mjs`), neon instrument restyle.
- **045** — Hurtbox policy v2 (`cycle-045-...-v2`: scale 1.0/min 12/half 9,
  wide-miss guard intact) + weapon benchmark v2 with 48 moving-target rows.
- **046** — Circle-blocker render fix; navgrid lazy-build attempted and
  REVERTED with evidence (naive deferral drops a pointer-up on
  iphone-13-portrait; the fix must be a CHUNKED build before input binds).
- **047** — Empty-pickup auto-fallback to pistol; cursor crosshair reticle
  (aim line removed; stage cursor hidden); grenades 34 dmg / 150 radius /
  56 knockback (parent `arcade-core.mjs` design record in lockstep);
  touch-release ground-truth guard (`endAllPointers` + touchend/cancel).
- **048** — SWAP skips exhausted weapons (mobile trap fix); launcher
  declaration truthed to the grenade it fires; shaped-charge 128 → 210;
  movement smoke isolated from combat (worldTour=mining + stillness-based
  settle) after root-causing: evidence-safe blocks damage but NOT enemy
  melee knockback, and pathing enemies shove a "stationary" test hero.
- **049** — Terrain visibility contrast step (owner's "single color"
  complaint); flow-field corner smoothing (safe diagonal blends); pistol
  cadence 2.6 → 3.0 (+14% base DPS @mid, benchmarked, parent record in
  lockstep).

## 3. Hard-won operational facts (verified this arc — believe them)

1. **Never run two browser-smoke batches concurrently.** They collide and
   produce fake failures (seen at least three times).
2. **The heap-delta perf assertion is high-variance** (observed −32 MB to
   +38 MB on near-identical builds; budget 24 MB). Treat a lone heap
   failure as a rerun-once signal; improving the gate (forced GC or
   median-of-N) is an open objective. Never rerun-until-green anything else.
3. Port 8791 is bind-blocked for some runtimes on this machine; the perf
   and certification harnesses accept `HMH_REBOOT_ORIGIN` — serve
   `apps/portal` on 8899 via `startPortalStaticServer` and pass it.
4. The `C:\Users\just_\lesters-arcade` checkout needs
   `benchmarks/hmh-engine-bakeoff` npm-installed for Playwright, and
   `.hermes/plans/` copied from the Desktop checkout for docs:links.
5. Adversarial review of the exact staged index caught real defects in
   041, 042, 043, 047, and 048. Review EVERY packet; re-review after
   restaging; give the reviewer the geometry/values to recompute, not
   claims to rubber-stamp.
6. The bundle has ~9 KB of headroom. Anything non-trivial must come with
   size accounting or a budget conversation with the owner.

## 4. Objectives (prioritized, one bounded RED-first cycle each)

### A. Characters (owner's standing quality bar: Hades)
1. **256px hero escalation** — per-asset frameSize to 256 for ONE hero
   first (Lit Commando renders best; Lester is the flagship — pick with
   the owner). Requires hero-atlas budget renegotiation (~2.5× of the
   12.6 MB total cap) and multi-hour renders: plan a dedicated session.
   Regenerate the selector turntable atlas from the same sources (A9) —
   it is current as of 037 but frame-limited to 160px, which is why the
   select screen reads dated.
2. Locomotion/animation pass (A5-6): weight shift, foot planting, aim
   offsets, recoil, distinct deaths. Projection-only; simulation timing
   untouched.

### B. Enemies and combat
3. **Skill-tree deepening (Priority D4)** — a critical-strike branch is
   the natural next step and the crit machinery already exists
   (`combat-events` seeded criticals; player hits carry
   `criticalChance: 0.08 / multiplier 1.75`). A new run-upgrade entry
   needs a new power-up asset through the authored-prop pipeline plus
   catalog/count-lock updates (the catalog is 1:1 with the ten power-up
   assets). Then: pistol pierce/ricochet and elemental branches with
   deterministic proc rules and capped stacking in ONE authoritative
   module.
4. **Balance from measurements** — the moving-target benchmark
   (docs/qa/hmh-weapon-benchmark.json) is the reference: pistol 0.141-0.18
   vs strafing rushers @mid, auto-miner the best tracker, launcher blast
   forgiving, shotgun role-limited. Build the long-run simulation the 036
   handoff demands (levels/min, TTK curves, build diversity) before any
   further value changes. Swarm-pressure benchmark extension is unbuilt.
5. Boss phases (F6): authored counters and arena use, not health inflation.

### C. Gameworld and art
6. **Macro terrain variation** — if the owner still wants more after 049's
   contrast step: intra-district material patches and blotch decals
   (deterministic bakery + renderer dressing), path decals, shore banks.
7. **Prop set-pieces** — landmark-adjacent composed clusters (the art doc's
   anchor+satellite rule); re-concept driftwood as a tidewrack pile; a
   relay gate arch; ravine rope-bridge dressing over the overlook drop.
8. Weather/atmosphere layer (projection-only): drifting fog banks, ember
   particles in the yard, pollen in hashwood — within the particle budget.

### D. Movement and game feel
9. **Chunked navgrid build** — move the ~400 ms construction off first
   paint WITHOUT the naive deferral that dropped touch input (046 ledger
   has the failed approach and evidence). Idle-slice it before input binds.
10. Dash polish: buffered inputs, edge forgiveness on drops, landing dust.

### E. Scoring, skill tree, UI
11. **Pause-menu music player (Priority K)** — full portal playlist
    transport in the pause menu; parent owns metadata; child sends
    transport intents; music decoupled from sim pause.
12. **Run-stats schema (Priority I)** — the versioned bounded run summary
    (kills by role/weapon, accuracy split trigger-vs-pellet, grenade and
    power-up telemetry) feeding profile depth and the five-stat
    leaderboard rows.
13. Minimap polish round 2: explored-area brightness tiers, landmark
    icons per kind, optional rotate-with-player setting.
14. Controls-help overlay: the desktop Digit1-4 weapon slots exist but are
    undiscoverable (the owner never found them — that is what made the
    exhausted-shotgun bug fatal).

### F. Platform
15. Owner adds the Vercel automation-bypass secret → restore headless
    live certification + byte verification to the promote ritual.
16. Harden the heap gate (forced GC / median-of-N) so it stops crying wolf.
17. Truthful-docs pass over public-facing README/production claims (036
    handoff §7.10) — several still describe pre-041 cycles.

## 5. Discipline (unchanged, and it keeps working)

Health check → one bounded slice → RED tests → implement → full gates
(sequential, never parallel) → visual evidence inspected by eye → exact-
index adversarial review → fix → re-review → commit implementation and
closeout separately → push → promote with owner's standing approval →
verify production in a real browser → record deployment + rollback in the
cycle doc. `SETTLEMENT_LIVE` stays false; no contract, transaction, or
settlement change without a separate explicit HALT approval.
