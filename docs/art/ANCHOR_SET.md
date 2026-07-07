# Hard Money Heroes WO-76 Anchor Set

**Full anchor set status: UNAPPROVED — 2/10 slots approved.**

This document is the style-lock registry for WO-76. Two anchors are approved, but the complete anchor set is not locked until all ten slots have approved winners and provenance.

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

### 2. Bank-district Deco corner facade — APPROVED

- **Winner:** candidate `09`
- **Anchor image:** `docs/art/anchors/bank-deco-corner.png`
- **Provenance:** `docs/art/anchors/bank-deco-corner.provenance.json`
- **Tool:** FAL.ai FLUX 2 Klein 9B via Hermes `image_generate`
- **Source URL:** `https://v3b.fal.media/files/b/0aa13e79/3ZYqnjqsRU9rwXfF-msbn_sCBaF95s.png`
- **Reference anchor:** approved storefront facade source URL was passed as image reference.
- **Runners-up:** `12`, `10`, `05`
- **Approval rationale:** best high-bit/noir bank-district read from the batch; the circular vault door and stepped Deco crown communicate financial landmark better than the more storefront-like variants.
- **Caveat:** anchor reference only. Runtime integration still needs crop/alpha/palette cleanup and manifest work in a later approved art-substitution task.

Exact prompt:

```text
WO-76 bank-deco-corner candidate 09. Hi-bit pixel art, high-quality bank landmark facade for Litecoin City noir. Isometric 2:1 corner with stepped Art Deco crown, blank cyan signage, brass trim, silver stone, glowing vault doorway, rain-puddled pavement, top-left key, neon rim, painterly pixel clusters, selective dark outline. Absolutely no readable text, no numbers, no symbols, no logos, no people, no watermark. Candidate only.
```

## Remaining required slots

3. Signature street tree, night-lit in planter.
4. Wet-asphalt ground family, base plus two wear variants.
5. Streetlamp plus pooled light cone prop.
6. Lit Commando repaint, single idle key pose.
7. Highest-spawn enemy redesign, key pose plus attack-tell pose.
8. Major boss key pose at true boss scale.
9. Micro-scene composition, tipped delivery cart plus spilled crates plus rat.
10. UI chrome sample, draft card frame plus HP bar segment.

## Current evidence

See `docs/art/WO76_ANCHOR_CANDIDATE_AUDIT.md` for the seed-candidate audit and `docs/art/wo76/` for candidate sheets/review reports.

## Approval checklist

- [ ] 10 numbered slot contact sheets reviewed. Current: 2/10.
- [ ] Justin/agent-with-direction selects one winner per slot or requests rerolls. Current: storefront facade and bank Deco corner approved.
- [x] Storefront winner copied to `docs/art/anchors/`.
- [x] Bank Deco winner copied to `docs/art/anchors/`.
- [x] Storefront exact winning prompt, tool, settings, and seed/reference provenance recorded.
- [x] Bank Deco exact winning prompt, tool, settings, and seed/reference provenance recorded.
- [ ] Pipeline prompt preamble in `docs/art/PIPELINE.md` updated to reference the complete approved anchor set.
- [ ] Anchor-similarity QA calibrated so all approved anchors pass and known-bad placeholder art fails.
