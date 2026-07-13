# SHIP_ART_CENSUS Lock

This lock is regenerated from current runtime evidence and applies to the released **Level 1** scope defined by SHIP-4.

## Evidence

- Global JSON: `docs/art/GLOBAL_ART_CENSUS.json`
- Global Markdown: `docs/art/GLOBAL_ART_CENSUS.md`
- Canonical roster matrix: `docs/art/ROSTER_COVERAGE.md`
- Hero certification: `docs/art/HERO_ANIMATION_CERTIFICATION.md`
- Combat feedback certification: `docs/art/COMBAT_FEEDBACK_CERTIFICATION.md`
- Deterministic visual seed: `1337`
- Browser gate: `npm run visual:regression`

## Level 1 ship result

- Runtime-spawnable Level 1 actor rows: **23**
- Complete Level 1 actor rows: **23/23**
- Missing Level 1 states: **0**
- Partial Level 1 direction states: **0**
- Certified playable heroes: **4/4**
- Unresolved zero-animation runtime actors: **0**
- Combat-feedback certification: **PASS, 100/100**
- Visual seed-1337 render anchor: **exact match**

## Explicit non-ship debt

The global census remains 80/100 because four future-level city actors are partial: `bitcoin-maximalist-riot-cop`, `influencer-camera-drone`, `nft-valet`, and `stablecoin-socialite`. None appears in the generated Level 1 spawn/proxy table. They are not silently counted as complete and must be finished before their levels become playable.

The global source-policy score also counts provenance per frame reference even though each generated layer carries an explicit top-level provenance policy. That reporting limitation does not represent unlicensed runtime pixels, but the score remains visible rather than being inflated.
