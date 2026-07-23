# HMH Reboot Phase 12: Weapons and Core Combat Certification

**Status:** Certified locally on `reboot/hmh-topdown-2_5d`
**Renderer:** `pixi.js@8.19.0`
**Simulation:** deterministic 60 Hz, maximum four catch-up steps
**Authority:** gameplay simulation owns outcomes; Pixi, DOM, audio, camera, HUD, and effects consume immutable outcomes only

## Scope and compatibility

Phase 12 replaces the temporary projectile calibration with a complete deterministic weapon and core-combat layer while retaining the approved HMH identifiers and values:

- pistol: `coin-blaster`
- shotgun: `scatter-shotgun`
- machine gun: `auto-miner`
- grenade launcher: retained alternate ID `launcher-rig`, firing `satoshi-frag`
- melee: `litecoin-knife`
- hand grenade: `satoshi-frag`
- retained evolutions: `settler-rail`, `hashstorm-overdrive`, `crypto-bomb-orbit`

No wallet, contract, signing, persistence, profile, achievement, scoring, analytics, or settlement authority was added to the child. Enemy deaths emit only canonical `game:run-event` requests with `eventType: "enemy-defeated"` and `value: 1`; the parent determines score and all durable outcomes. No persisted IDs, production dependencies, or production infrastructure changed.

## Checklist map

| Master-plan item | Implementation | Behavioral verification | Browser and visible evidence |
|---|---|---|---|
| Freeze weapon definitions using retained IDs and compatible values | `apps/hmh-reboot/src/weapon-system.mjs` | `tests/hmh-reboot-weapon-system.test.mjs` compares retained values and evolution IDs to portal contracts | Browser report records all four active IDs in `.hermes/evidence/hmh-reboot-phase8-combat/report.json` |
| Deterministic weapon switching, ammo, cadence, reload, heat, recoil, upgrades/evolutions | `weapon-system.mjs`; canonical keyboard/gamepad/touch fields in `input.mjs` and `touch-controls.mjs` | Weapon minute, reload, seeded spread, overheat/recovery, recoil, switching, upgrade, input, and touch tests | `scripts/hmh-reboot-combat-browser-smoke.mjs` exercises slots 1–4 and mobile WEAPON cycling |
| Projectile policies, crits, armor, shields, knockback, death, score-event interface | `projectile-physics.mjs`; `combat-events.mjs`; one-shot protocol-valid player defeat in `combat-lifecycle.mjs`; authoritative reduction in `main.mjs` | Projectile suite; stable reversed-input combat equality; nonzero shield/critical soak; protocol-valid game-over; score remains zero/non-authoritative | Desktop cover/hit smoke and combat browser smoke; debug data remains gated behind `debugGrid=1` |
| Swept melee volume, angular coverage, cooldown, one-hit rule, cover/elevation legality | `melee.mjs`; same projectile/cover geometry used for LOS | `tests/hmh-reboot-melee.test.mjs`, including moving-target sweep and explicit source elevation | Desktop and mobile melee actions recorded in browser evidence; sweep VFX is render-only |
| Fixed-cap hand grenades and launcher grenades with arc, fuse, bounce, impact, blast, falloff, self-damage, cover, and height | `grenades.mjs`; public projectile cover normal reused for bounce | `tests/hmh-reboot-grenades.test.mjs`, including tunneling, cover bounce, edge overlap, cap, replay, and inventory | Browser evidence records launcher `impact`, hand grenade `fuse`, charge 3→2, and self-damage HP 100→97 |
| One-minute per-weapon simulation, deterministic replay, low-FPS, pooling, memory, and SFX | `scripts/hmh-reboot-combat-soak.mjs`; `combat-audio.mjs`; local retained audio assets only | Repeat-hash soak, 60/30/20 FPS equality, four-step catch-up cap, audio cooldown/priority/pause tests | Desktop/mobile screenshots show HUD/effects; browser reports voice count ≤16 and no page errors |

## RED → GREEN → REFACTOR record

1. Added missing-module RED suites for weapon/combat, melee, grenades, and combat audio.
2. Confirmed each failed for the expected missing contract.
3. Implemented small pure modules with mutable fixed-cap runtime records only where allocation stability matters.
4. Integrated authoritative outcomes into `main.mjs`; Pixi/DOM/audio consume events but never feed results back.
5. Browser execution exposed and fixed:
   - melee wrapper dropping authored source elevation;
   - hand grenade cover bounce missing the public collision normal;
   - blast edge-overlap ordering time exceeding `[0,1]`;
   - runtime using `shield` instead of canonical `shieldCharges`;
   - mobile WEAPON control overlapping the status card.
6. Final death-path review exposed HP reaching zero without a terminal transition; `hmh-reboot-combat-lifecycle.test.mjs` failed RED before the one-shot protocol-valid controller and runtime integration were added.
7. Added regressions for every valid defect and reran affected gates.

## Certification results

### Focused and syntax

- Complete reboot-focused suite: **161/161 passed**.
- Phase-12 weapon/melee/grenade/audio/input/touch/shell suite: **54/54 passed** before final additions; the complete reboot suite above is authoritative.
- Syntax: **319 JS modules + 40 Python scripts passed**.

### Determinism, performance, and memory

`node --expose-gc scripts/hmh-reboot-combat-soak.mjs`

- simulated ticks: **3,600** per minute
- pistol: **112 fire events**
- shotgun: **40 fire events / 320 pellets**
- machine gun: **300 fire events** with deterministic heat cycling
- grenade launcher: **38 fire events**
- melee: **180 attacks / 180 hits**
- grenades: cap **16**, **4** dropped overload spawns, **55** detonations, **27** bounces
- combat reduction: **150** damage events, **14** shielded, **12** critical
- 60/30/20 FPS replay: identical tick, ammo, reload, and fire state; **zero dropped time**
- 250 ms stall: exactly **4** steps; **183.33333333333331 ms** reported dropped time
- clear-range 120-HP TTK: shotgun **65 ticks**, machine gun **546**, launcher **769**, pistol **1,201**
- repeat SHA-256: `6e6820f8f2d9039d8e17aca11c2001b125f10465cc44334bbc842fb1cbe0b830`
- measured runtime: **67.007 ms**
- post-GC heap delta: **+607,160 bytes**

Raw report: `.tmp/hmh-reboot-phase12-combat-soak.json`.

### Build, security, browser, and repository

- production build: **PASS**
- reboot child bundle: **823.3 KB**
- portal main bundle: **1.19 MB**
- load-speed report: **PASS**
- security audit: **PASS, 5/5 checks, zero findings**
- desktop/mobile/normal-mode projectile smoke: **PASS**, no page errors
- tracked combat browser smoke: **PASS**
  - desktop: pistol, shotgun, machine gun, launcher, melee, hand grenade, accessibility status
  - mobile: eight controls, WEAPON cycle, melee, grenade, safe bounds
  - audio voices remained ≤16
  - projectile drops remained zero
- embedded portal interaction smoke: **PASS** (`wallet-profile-free-ranked-exit`)
- visual review: desktop no blocker; mobile overlap fixed and re-reviewed with no blocker
- repository health completed; no new oversized binary or generated art asset was added

Visible evidence:

- `.hermes/evidence/hmh-reboot-phase8-combat/desktop-combat.png`
- `.hermes/evidence/hmh-reboot-phase8-combat/mobile-combat.png`
- `.hermes/evidence/hmh-reboot-phase8-combat/report.json`

### Exact full-suite retirement ledger

- total: **1,464**
- passed: **1,411**
- failed: **53**
- cancelled/skipped/todo: **0/0/0**
- expected ledger failures: **53**
- current unique failures: **53**
- missing: **0**
- unexpected: **0**
- exact match: **true**

Raw suite: `.tmp/hmh-reboot-phase12-full.log`
Comparison: `.tmp/hmh-reboot-phase12-ledger-report.json`

## Deferred by dependency order

- Dash, invulnerability, hazard legality, and the near-term ability belong to Phase 13.
- Final commando/enemy artwork and complete authored animation assets remain in later art phases. This phase introduces no animal/mechanical enemy proxies and no unapproved generated assets.
- Progression menus and full parent adapter UX remain in Phase 17/18; retained progression IDs and pure numeric contracts are connected now.
- Production replacement and deployment remain protected Phase 21/22 gates and were not touched.
