# HMH AAA Continuous Improvement Cycle 041

Date: `2026-07-31`
Status: `LOCAL GATES PASSED`
Branch: `reboot/hmh-aaa-continuous`
Baseline: `c29d6300` (map-redo brief from the 2026-07-31 owner playtest)

## Scope: MAP-REDO slice 1 — biome composition

Owner verdict driving this cycle: the level read as colored bands with
scattered props, not as places. This cycle redesigns the Level 1 authored
world contract so every district is a composed place. Collision and elevation
stay authoritative in the world contract; visuals follow it.

### What changed

1. **Winding main route** — the main route was a dead-straight horizontal
   line at `y=2400` across the entire 12,000-unit map (4 distinct y values,
   all from the two existing ramp detours). It is now a 25-node winding path
   with 14 distinct y values: the relay dips south around the depot, the
   ravine climbs the switchback and drops off the overlook, the crossing
   approaches the bridge through wetland banks, hashwood winds south-north-
   south through thickets into the clearing, the mining camp climbs the
   loader deck and descends past the fenced yard, and the liquidation yard
   squeezes through a wreck-row chicane. Length 13,302 units → 55.4 s
   unopposed traversal at 240 u/s, inside the authored 40-70 s bound.
2. **Interior blocker composition, 11 → 38** — every district now has at
   least 3 interior blockers (footprint fully inside the district and inside
   the y ∈ (1,000, 3,800) interior band) instead of edge framing only:
   - *Frontier Relay*: fenced compound — depot shed (building), interior
     fence run, and a true two-post gate at the ravine seam.
   - *Rugpull Ravine*: rock spurs from both walls force the S-path; a
     boulder choke sits inside the ambush bowl as combat cover; a palisade
     closes the exit seam.
   - *Liquidity Crossing*: a west groyne funnels to the bridge; wreck row
     and fuel tanks dress the east bank; a bank fence and hashwood thicket
     gate the forest seam.
   - *Hashwood*: interior thickets shape the winding path; tree walls edge
     the clearing arena on both sides.
   - *Mining Camp*: a fenced work yard (two fence runs + shack row) south of
     the loader deck; container walls gate the liquidation seam.
   - *Liquidation Yard*: two wreck rows form the approach chicane into the
     boss arena; a terminal block shelters the new recovery pocket.
3. **Seam gates** — all five district seams now have authored structure on
   both sides of the main route with a bounded gap (594-1,002 units), so
   crossing a seam reads as passing a gate instead of walking across a
   color change.
4. **Arena cover** — all six encounter arenas now have at least one
   `combatCover` blocker within `radius + 240` of the anchor.
5. **Tenth POI: `yard-medbay-cache`** (hook `reward`, asset `bonus-life`) at
   `(11,480, 3,330)` behind the terminal block — the liquidation yard was
   the only district without a recovery pocket. Collectible and prop-atlas
   contracts updated in lockstep (9 → 10).

### Defects the review and evidence caught

The exact-index adversarial review computed full segment-to-segment corridor
distances and found three BLOCKERs my endpoint-only authoring math missed:
`yard-wreck-row-south` and `yard-wreck-row-north` severed the
liquidation-escape-loop, and `mining-yard-fence-east` severed the
mining-service-loop — loops render as full-width roads and minimap paths, so
a severed loop is a world-contract lie. Response, in order: (1) a new RED
loop-sweep test (`every loop-route segment is traversable through canonical
collision`) so the class gates automatically — the main-route sweep alone
had let this through; (2) an exhaustive corridor checker (every blocker
surface vs every route edge at width/2 + player radius); (3) geometry fixes:
both wreck rows and the east yard fence repositioned, the boulder choke
pulled off the salvage-loop centerline, the terminal block shifted east, the
bridge approach nodes retuned, and the mining-yard arena moved into the
fenced yard it names. The new gate also exposed two PRE-EXISTING defects:
the crossing-bank-loop's return leg crossed both the north bridge rail and
the deep river — the loop is now an out-and-back via the shallows, and the
bridge rails were shortened to the deck (`4,510-4,990`) so the loop's
departure clears the rail tips.

Separately, the first shed placement covered the `relay-cache` POI; the
collectible smoke's canonical `relay-cache` case failed with `enemyCount 1`
instead of `2`. Moving the POI instead was also wrong — it pulled the tour
spawn into auto-fire range of a fixed opening enemy at `(1,120, 2,400)`,
which is the same failure from the other direction. Final fix: POI stays at
`(1,250, 3,100)`; the depot shed moved to `(1,400-1,700, 3,300-3,550)`,
which keeps training-yard arena cover and clears the POI, the orientation
loop line, and the gate fence. This is why browser evidence runs on every
world-data change.

### RED coverage first

`tests/hmh-reboot-level-one-composition.test.mjs` (7 tests) encodes the
composition bar: production-supported visual kinds only, ≥3 interior
blockers per district, ≥26 blockers total, main-route windiness (≥7 distinct
y values and ≥1.08× the straight-line length), two-sided seam gates with
bounded gaps, arena combat cover, and the full place kit (landmark + arena +
recovery pocket) per district. Against the pre-cycle world it failed 6 of 7
with the exact owner complaints as messages; all 7 pass after the redesign.

### Files

- `apps/hmh-reboot/src/level-one-world.mjs` — route graph, blockers, POI.
- `apps/hmh-reboot/src/authored-prop-atlas.mjs` — tenth POI mapping; ten-POI guard.
- `apps/hmh-reboot/src/collectible-system.mjs` — ten-placement guard.
- `tests/hmh-reboot-level-one-composition.test.mjs` — new RED-first coverage.
- `tests/hmh-reboot-collectible-system.test.mjs`, `tests/hmh-reboot-authored-prop-atlas.test.mjs` — lockstep counts.
- `scripts/hmh-reboot-combat-browser-smoke.mjs` — world blocker count 11 → 38.
- `scripts/hmh-reboot-collectible-browser-smoke.mjs` — collectible remaining 9 → 10.

### Determinism note

All changes are authored world data consumed by the existing deterministic
collision/elevation/reveal modules. No simulation-step, RNG, or replay
semantics changed. The world contract remains the single authority for
visuals, collision, elevation, minimap, reveal, routes, hazards, landmarks,
and encounters.

## Gates

- check: 337 JS modules + 49 Python scripts PASS
- new composition coverage: 8/8 (RED-first: 6/7 failed pre-redesign; the
  loop-sweep test failed against the first staged geometry)
- corridor checker: ALL CORRIDORS CLEAR (every blocker surface vs every
  route edge at width/2 + 24)
- test:release: `1,826 total / 1,774 passing / 52 accepted legacy / 0 unexpected`
- build: child bundle `1,032,281 / 1,050,000` bytes (~17.3 KB headroom;
  +5.5 KB for the composition)
- visual regression: 8/8 scenes; changed scenes inspected at full
  resolution before `--accept` (winding routes, seam gates, deck-only rails)
- browser certification: five profiles (desktop, ultrawide,
  tablet-landscape, mobile-portrait, mobile-landscape) PASS
- combat browser smoke: PASS with `worldBlockers 38`
- collectible browser smoke: PASS with 10 POIs / 10 canonical cases
- mobile controls: 4 device profiles PASS
- performance: p95 `7 ms` desktop and mobile
- security audit 5/5, third-party PASS, Web3 9/9, strict repo health PASS,
  CDN gate PASS, docs links PASS

## Deployment

Committed to the continuation branch only. No push, promotion, or settlement
change under this cycle without explicit owner approval.
