# WO-90 — Placeholder Redo Certification

**Status:** complete.  
**Scope:** pickup icons, VFX/UI chrome, authored stamp art, and achievement atlas.

## Generator commands

- `npm run assets:hmh:pickup-icons`
- `npm run assets:hmh:vfx-ui-chrome`
- `npm run assets:hmh:authored-stamp-art`
- `npm run assets:hmh:achievement-atlas`

## Certified packs

| Pack | Count | Contact sheet | Verdict |
| --- | ---: | --- | --- |
| Pickup icons | 5 | `apps/portal/assets/generated/hmh-pickup-icons/hmh-pickup-icons-contact-sheet.png` | approved-runtime-ready |
| VFX/UI chrome | 9 | `apps/portal/assets/generated/hmh-vfx-ui-chrome/hmh-vfx-ui-chrome-contact-sheet.png` | approved-runtime-ready |
| Authored stamp art | 3 | `apps/portal/assets/generated/hmh-level-one-authored-stamp-art/hmh-level-one-authored-stamp-art-contact-sheet.png` | approved-runtime-ready |
| Achievement atlas | 78 atlas records | `apps/portal/assets/generated/hmh-achievement-atlas/hmh-achievement-atlas-contact-sheet.png` | approved-runtime-ready |

## Visual QA

No blockers found in the contact sheets:

- pickup icons are legible at game UI size
- VFX/UI chrome reads as clean neon arcade HUD/card/toast/minimap/touch chrome
- stamp art clearly communicates route marker, boss warning, and extraction beacon
- achievement atlas is visually consistent across tiers/unlock motifs/runtime badges

## Runtime integration

Certification module: `apps/portal/assets/generated/hmh-wo90-placeholder-redo/hmh-wo90-placeholder-redo.mjs`

Regression test: `tests/hmh-wo90-placeholder-redo.test.mjs`
