# Hard Money Heroes WO-76 Anchor Set

**Full anchor set status: UNAPPROVED — 1/10 slots approved.**

This document is the style-lock registry for WO-76. One storefront anchor is approved, but the complete anchor set is not locked until all ten slots have Justin-approved winners and provenance.

## Approved anchors

### 1. Storefront facade — APPROVED

- **Winner:** candidate `14`
- **Anchor image:** `docs/art/anchors/storefront-facade.png`
- **Provenance:** `docs/art/anchors/storefront-facade.provenance.json`
- **Tool:** FAL.ai FLUX 2 Klein 9B via Hermes `image_generate`
- **Source URL:** `https://v3b.fal.media/files/b/0aa13cc3/4waD2VR748wOb3UScQKnI_c0orgKyb.png`
- **Runners-up:** `19`, `08`, `13`
- **Approval rationale:** strongest high-bit rainy noir facade, best wet-street atmosphere, painterly cluster density, and blank-sign storefront read.
- **Caveat:** anchor reference only. Runtime integration still needs crop/alpha/palette cleanup and manifest work in a later approved art-substitution task.

Exact prompt:

```text
WO-76 storefront-facade candidate 14. Textless blank-sign storefront only: no alphabet, no numerals, no logos, no icons, no readable markings. Hi-bit pixel art, rainy night-city noir, compact isometric 2:1 noodle bar building facade, blank cyan lightbox, deco brass corner ribs, silver vents, steam pipe, puddled pavement reflection, top-left key light and blue-magenta neon rim, painterly pixel clusters, clean selective outline, no characters, candidate only.
```

## Remaining required slots

2. Bank-district Deco corner facade.
3. Signature street tree, night-lit in planter.
4. Wet-asphalt ground family, base plus two wear variants.
5. Streetlamp plus pooled light cone prop.
6. Lit Commando repaint, single idle key pose.
7. Highest-spawn enemy redesign, key pose plus attack-tell pose.
8. Major boss key pose at true boss scale.
9. Micro-scene composition, tipped delivery cart plus spilled crates plus rat.
10. UI chrome sample, draft card frame plus HP bar segment.

## Current evidence

See `docs/art/WO76_ANCHOR_CANDIDATE_AUDIT.md` for the seed-candidate audit and `docs/art/wo76/` for storefront candidate sheets/review reports.

## Approval checklist

- [ ] 10 numbered slot contact sheets reviewed. Current: 1/10.
- [ ] Justin selects one winner per slot or requests rerolls. Current: storefront facade approved.
- [x] Storefront winner copied to `docs/art/anchors/`.
- [x] Storefront exact winning prompt, tool, settings, and seed/reference provenance recorded.
- [ ] Pipeline prompt preamble in `docs/art/PIPELINE.md` updated to reference the complete approved anchor set.
- [ ] Anchor-similarity QA calibrated so all approved anchors pass and known-bad placeholder art fails.
