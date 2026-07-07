# WO-81 / WO-82 / WO-79 — Animation Polish Certification

**Status:** certified runtime polish gates.  
**Module:** `apps/portal/src/hmh-wo81-82-79-animation-polish.mjs`

## Scope

- WO-81: animation principles gates
- WO-82: Lit Commando / Lit Valkyrie polish coverage
- WO-79: ambient motion / critters / signage / weather loop policy

## Certification

The certification module ties together:

- `HMH_WO81_ANIMATION_PRINCIPLES_GATES`
- `HMH_WO82_HERO_POLISH_PLAN`
- `HMH_WO79_AMBIENT_MOTION_PLAN`
- Wave 3 hero/enemy matrix gates from `buildWave3ArtMatrixReport()`

## Gate expectations

| Gate | Expected |
| --- | --- |
| WO-81 principles | anticipation, smear, impact, follow-through, loop-bob |
| WO-82 Lit hero coverage | Lit Commando and Lit Valkyrie rows have 0 missing direction cells |
| WO-79 ambient motion | hero landmarks, critters, weather, signage quotas defined |
| Legacy fallback policy | still-only / rectangle / cross-character fallbacks remain denied |

## Runtime policy

- Ambient loops are reduced-motion-safe.
- Critters stay out of boss locks.
- Weather is capped by performance budget.
- Signage animation remains blank/textless glow or flicker only.
- Hero animation polish must use real roster frames, never a different character design as a fallback.
