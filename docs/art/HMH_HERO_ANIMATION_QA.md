# Hard Money Heroes Hero Animation QA Baseline

**Status:** first contact-sheet QA baseline for playable hero identity and animation coverage.  
**Contact sheet:** `apps/portal/assets/generated/hmh-hero-animation-qa/hmh-hero-animation-qa-contact-sheet.png`

## Current baseline

The QA sheet compares:

- current Lester production frames
- current Lilly frames
- older expanded Lilly placeholder pack
- Lester reference sprite sheets
- Lilly teal-hair reference sheet

Manifest:

```text
apps/portal/assets/generated/hmh-hero-animation-qa/hmh-hero-animation-qa.manifest.json
```

## Lester QA

Current production Lester has strong frame coverage and readable motion:

- idle: 25 frames
- jump: 25 frames
- run: 25 frames
- walk: 25 frames

Identity read:

- The current production frames already show a blue spherical head with Litecoin-style face marking and are much closer to the intended Lester identity than the sidetracked older character direction.
- Motion readability is good for a QA baseline: silhouette, head shape, and run/walk cadence are clear.

Next needs:

- complete weapon/action states against the same identity: shoot, melee, throw/grenade, hurt, death, victory
- verify 8-direction or runtime-facing coverage for the isometric camera
- normalize pivots/feet/anchor points so hitbox and weapon origins stay stable

## Lilly / Lit Valkyrie QA

Current Lilly/Valkyrie assets are mixed:

- `hard-money-heroes/frames/lilly` has 8-frame sheets for attack, idle, jump, run, and walk, but each sampled PNG appears to contain a mini sheet/grid rather than a single cropped runtime frame. That needs slicing/cropping audit before final use.
- `hmh-expanded-pixel-pack/characters/lilly` has more states, but reads as placeholder/blockout art, not final Lilly.
- Lilly reference sheet supports the correct direction: teal hair and character identity. Glasses are still a missing high-priority identity detail.

Next needs:

- choose final Lilly identity source: teal hair + glasses
- generate or slice clean per-frame runtime PNGs, not sheet-inside-frame images
- complete states: idle, run, walk, shoot, melee, throw/grenade, hurt, death, victory
- keep Lit Valkyrie starter visually distinct from Lilly unlockable if both remain playable

## QA verdict

This contact sheet is suitable as a **baseline audit artifact**, not final art approval.

Immediate art-production priority:

1. preserve current Lester identity and fill missing combat states
2. rebuild Lilly around teal hair + glasses with real cropped gameplay frames
3. create contact sheets per hero/state/direction before any runtime swap
4. verify alpha, frame dimensions, pivots, direction mapping, and runtime state aliases before integration
