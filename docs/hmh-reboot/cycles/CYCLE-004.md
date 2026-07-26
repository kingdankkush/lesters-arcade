# HMH AAA Continuous Improvement Cycle 004

Date: 2026-07-25
Status: `LOCAL GATES PASSED · PREVIEW VERIFICATION PENDING · PRODUCTION UNTOUCHED`
Branch: `reboot/hmh-aaa-continuous`
Baseline: `b951d7bb`

## Objective

A gameplay-depth cycle across the master plan's Phase 3–5 and 11–13 areas:
combat physics, enemy AI pacing and fairness, boss encounter integrity,
progression/skill-tree depth, audio robustness, and animation readability.
Work was selected from three parallel source audits, and every change is a
reproduced defect or a directly authored improvement — no speculative churn.

## Preserved invariants

- PixiJS `8.19.0`; fixed `60 Hz` simulation with max four catch-up steps.
- Game alias `hmh`, game ID `lester-blaster`, profile `wo71`, save schema `2`,
  bridge `hmh-bridge/v1`, 65,536-byte bridge cap unchanged.
- No `Math.random`, `Date`, or `performance.now` introduced into simulation
  code. All new behavior is seeded or pure.
- Boss endless cadence starts only *after* the certified 3,600-tick window, so
  the authored encounter timeline is untouched.
- The enemy strike pose is carved out of the front of recovery, so total
  attack cycle length — and therefore encounter pacing — is unchanged.
- Child HMH requests no wallets, sends no transactions, writes no parent
  state. Free Mode writes no Ranked progress. `SETTLEMENT_LIVE` remains false.
- No LitVM action, no production deployment, no alias change.

## Changed source

Combat and physics:
- `apps/hmh-reboot/src/combat-events.mjs` — knockback resistance now divides
  rather than multiplies.
- `apps/hmh-reboot/src/movement.mjs` — recoil/knockback decays proportionally
  instead of at a flat `maxSpeed`-derived rate.
- `apps/hmh-reboot/src/main.mjs` — projectiles fly at chest height over the
  ground beneath them (fixes the ledge lockout); auto-aim/auto-fire honour
  height-aware line of sight; damage events read `damageApplied`; dead-target
  write-back uses `active`/`health`; boss defeat awards score, XP, and kill
  credit; hurt pose and dash leg facing wired into the hero atlas.

Enemy AI and boss:
- `apps/hmh-reboot/src/encounter-director.mjs` — a selection-class rejection
  advances the spawn ordinal, ending the ranged-cap spawn deadlock.
- `apps/hmh-reboot/src/enemy-simulation.mjs` — recovering enemies no longer
  hold attack tokens; separation impulse is bounded
  (`MAX_ENEMY_SEPARATION_STEP`); enemy state carries
  `attackRecoveryUntilTick`.
- `apps/hmh-reboot/src/enemy-combat.mjs` — new `attack` strike phase makes the
  previously unreachable strike art state real; simultaneous melee tells are
  staggered (`ENEMY_TELL_STAGGER_TICKS`) so a wave cannot stack unavoidable
  damage on one tick.
- `apps/hmh-reboot/src/liquidator-boss.mjs` — deterministic endless attack
  cadence after the authored plan; pending attacks resolve on `>= resolveTick`
  so a skipped tick cannot strand a telegraph.

Progression, audio, VFX:
- `apps/hmh-reboot/src/run-progression.mjs` — two repeatable mastery picks
  (`compound-interest`, `hardened-wallet`) give long runs a real offense/defense
  choice; the pending-level queue is capped at remaining rank capacity so no
  level can award unspendable XP.
- `apps/hmh-reboot/src/combat-audio.mjs` — rejected `play()` releases its voice;
  stale voices are age-reaped (`MAX_VOICE_LIFETIME_MS`).
- `apps/hmh-reboot/src/world-production-art.mjs` — particle telemetry reports
  the active performance profile's real budget.

Tooling and tests:
- `scripts/hmh-reboot-portal-e2e.mjs` — evidence directory is now configurable
  via `PORTAL_E2E_EVIDENCE_DIR` instead of a hardcoded cycle path.
- Tests extended: liquidator boss, encounter director, enemy combat, enemy
  simulation, weapon system, movement, projectile physics, progression UI
  adapters, combat audio, production hero atlas.

## Gameplay impact

- The Liquidator is fightable, killable, and rewarding for the first time; it
  no longer crashes the frame loop on contact or stalls at full health.
- Heavy enemies now resist knockback instead of flying farthest; weapon recoil
  and enemy knockback against the player are visible and scale with magnitude.
- Authored high ground is usable for gunfire: shots fired from a ledge now
  settle downward and connect with targets below, while the elevation contract
  still holds — a target holding high ground cannot be shot from below.
  **Melee is not fixed in this cycle** and remains height-locked (see debt).
- The player no longer auto-locks and empties clips into walls.
- Melee waves are readable and dodgeable rather than one-frame burst kills.
- Encounters keep spawning instead of dying when the ranged cap saturates.
- Long runs keep offering meaningful upgrades instead of accumulating a
  phantom pending-level counter.
- Enemy strike frames and the hero hurt pose actually render; dashes show
  moving legs facing the dash.
- Combat audio survives codec-rejecting browsers instead of going permanently
  silent.

## Release gates run on this candidate

- `npm run check` — 319 JS modules + 40 Python scripts pass.
- `npm run test:release` — `PASS tests=1648 passed=1596 expected_failures=52`,
  zero unexpected results (+21 tests vs Cycle 003).
- `npm run build` — HMH bundle 966,263 bytes, under the 1,050,000-byte gate
  (+2,522 bytes vs Cycle 003).
- `npm run assets:qa:hmh-reboot` — pass, four hero atlases, projection-only.
- `npm run design:security-audit` — PASS 5/5, zero findings.
- `npm run design:third-party-security` — PASS 3/3 sandbox suite.
- `npm run design:web3-audit` — PASS 9/9.
- `npm run repo:health:strict`, `npm run docs:links` — pass.
- `npm run design:session-analytics` — regenerated.
- `npm run audit:hmh:network` — four audits, zero failures.
- `npm run smoke:hmh:cockpit`, `smoke:hmh:performance` — zero errors.
- `npm run smoke:portal`, `smoke:portal:interactions` — pass.
- `npm run smoke:portal:e2e` — six flows pass, zero console/page errors.
- Four hero browser smokes — exit 0, desktop and mobile.
- Chrome certification — five viewport profiles, zero errors.
- Edge certification — five viewport profiles, zero errors.
- Deterministic soaks — projectile fuzz (20,000 cases, hash `8d88d351`
  unchanged), projectile soak (3,600 ticks, hash `e57ed205` unchanged),
  projectile benchmark, enemy, director/boss, combat, dash, and level-one
  world soaks all exit 0.
- Full-resolution desktop evidence inspected: hero, enemy, aim line, HUD,
  minimap render correctly with no artifacts.

Determinism note: the projectile fuzz and soak hashes are byte-identical to
Cycle 003. This is the expected result rather than a proof of safety — those
soaks exercise `projectile-physics.mjs`, which this cycle does not modify, and
the combat soak runs at `knockbackResistance: 1`, where multiply and divide
are identical. The changed behavior is covered by the new focused tests, not
by these hashes.

Not rerun this cycle: the 30-minute browser memory soak and the retained-memory
A/B investigation. The Cycle 002 retained-memory debt remains open and is
unaffected by these changes.

Visual regression: **not obtained this cycle.** Projectile tracers render from
projectile `z`, so tracer screen positions now vary slightly over ramps and
ledges where a shot settles downward — a render-layer change that should have
had a visual-regression pass. `npm run visual:regression` could not run: the
harness drives the legacy portal path and fails with `missing #hmhReadyOverlay`
because the reboot flow short-circuits `waitForPlayerReady` and never shows
that overlay. This is a pre-existing harness breakage, not a regression from
this cycle, and it is recorded as debt below. Desktop and mobile full-
resolution screenshots were inspected manually instead; no tracer, grounding,
depth-sorting, or framing artifacts were visible.

## Independent review

The exact staged index was sent for adversarial review before commit. Verdict:
**BLOCK**, with two real defects introduced by this cycle's own changes:

1. `enemy-combat.mjs` — the newly-live `attack` phase hit a previously dead
   branch that reset a token-less attacker straight to `ready`, discarding the
   authored recovery. Dashing out of an enemy's reserve range — exactly the
   authored counterplay — cancelled its punish window (attack ticks 16, 35
   instead of 16, 56). Fixed: a committed strike now falls through to recovery.
2. `main.mjs` — ground-tracking projectile `z` made the elevation band a
   tautology (the projectile's height at the target always equalled
   `targetGroundZ + 34`), deleting the elevation contract in both directions;
   a target on a 64-unit ledge became shootable from flat ground. Fixed: the
   projectile settles downward only, at a bounded rate, so ledge shots connect
   while uphill shots stay blocked. Verified across six elevation cases.

Also applied from the review: `knockbackResistance` is now validated as
strictly positive (zero would have divided into a near-infinite launch rather
than meaning "immovable"), and three unsupported claims in this document were
corrected (melee, visual regression, and the soak-hash determinism inference).

All gates were re-run against the corrected candidate.

## Known debt

- **`npm run visual:regression` is broken for the reboot runtime.** It drives
  the legacy portal path and waits for `#hmhReadyOverlay`, which the reboot
  short-circuit never renders. Pre-existing; it means no render-layer change
  in this or recent cycles has had an automated visual gate. Repointing the
  harness at the reboot flow is the next tooling slice.
- **Melee remains height-locked.** `melee.mjs` still compares an attack band
  built from `origin.z + 32` against a target band relative to the target's own
  ground, so a ledge melee cannot connect across an elevation delta. The
  projectile fix in this cycle does not extend to melee.
- **Ledge-base dead zone (new, from the projectile fix).** Falling from a
  64-unit ledge takes ~2 ticks to reach the target band, so a target within
  ~40 units of the drop edge is still unhittable by the fastest weapons
  (coin-blaster 1200, auto-miner 1320) while slower ones connect. Narrower
  than the total lockout it replaces, but a readability oddity at point-blank
  ledge range.
- **Sticky low flight across depressions (new).** `liquidity-river` sits at
  groundZ −24. Because projectile height never rises, a bullet that crosses it
  settles to z=10 and stays there. Far-bank targets still connect (8-unit
  margin), but any future target with `minZ > ~12` would be silently missed
  after a river crossing.
- The muzzle-flash VFX still hardcodes `actor.groundZ + 34` while the
  projectile path uses `PROJECTILE_FLIGHT_HEIGHT`. Same value today; drift
  risk only.
- Browser retained-memory debt from Cycle 002 (open, unchanged).
- `#combatMenuPanel` keeps a stale `data-state="paused"` attribute after a
  pause-menu restart (hidden panel, cosmetic; carried from Cycle 003).
- Deferred portal E2E flows (ranked, wallet reconnect, in-portal game-over,
  service worker) remain deferred with reasons recorded in the harness
  manifest.
- `grenades.mjs` `bounceFromBlocker` ignores `maxBounces` /
  `minimumBounceSpeed` unlike `bounceFromGround`. Bounded by the 39-tick fuse
  so it is not player-visible; recorded rather than fixed to keep this cycle's
  physics changes reviewable.
- Boss hurtbox/art coverage for the new endless cadence has not had a
  dedicated visual pass.

## Evidence

- `.hermes/evidence/hmh-aaa-cycle-004/portal-e2e/01..05*.png` (local, untracked)
- `.hermes/evidence/hmh-aaa-cycle-004/edge-certification/report.json` (local)
- `docs/hmh-reboot/RED-EVIDENCE-AAA-CYCLE-004.md`

## Deployment state

- No production change. Production remains `dpl_AvXkk8eXSGzX4jcviDNzVSsr9ap9`
  (lestersarcade.io); rollback remains `dpl_3ku2fQ42yybTB5bWoZgifX9AnAPk`.
- This cycle stops at the branch push. Preview verification for the Cycle 004
  commit requires authorized Vercel provider access, which is not available in
  this checkout.
