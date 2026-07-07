# Hard Money Heroes Art Pipeline

**Status:** WO-76 anchor set approved as a style reference. Runtime generated-art integration still requires per-asset cleanup, manifests, and QA.

## Universal WO-76 prompt preamble

Use this preamble for every WO-76 candidate prompt and, after approval, for every later art-generation prompt:

```text
hi-bit pixel art, litecoin-city-after-dark-neon-noir-deco-v1, palette #0B0E1A #10162A #1A2138 #2B3A5C #173B72 #345D9D #4E82D8 #8CB7FF #E8ECF2 #C9D2DE #A8B4C4 #5C6B80 #2E3A4D #F1D37A #C9A34E #8C6724 #4A3514 #C9FF6A #7FE84A #3FAE3B #1F5C2E #FF78D1 #E040A0 #992B78 #4B1844 #F8FBFF #C7D0E0 #6F7B91 #11151F, night-city noir, top-left key light with local neon rim light, painterly pixel clusters, clean 1px selective dark navy outline, transparent background where applicable, readable silhouette at gameplay zoom, no text, no logos, no watermark, match the approved WO-76 anchor set
```

Approved anchor references:

- Storefront facade: `docs/art/anchors/storefront-facade.png`
- Bank-district Deco corner facade: `docs/art/anchors/bank-deco-corner.png`
- Signature street tree: `docs/art/anchors/signature-street-tree.png`
- Wet asphalt ground family: `docs/art/anchors/wet-asphalt-ground-family.png`
- Streetlamp light cone: `docs/art/anchors/streetlamp-light-cone.png`
- Lit Commando idle key pose: `docs/art/anchors/lit-commando-idle-key-pose.png`
- Highest-spawn enemy redesign: `docs/art/anchors/highest-spawn-enemy-redesign.png`
- Major boss key pose: `docs/art/anchors/major-boss-key-pose.png`
- Micro-scene composition: `docs/art/anchors/micro-scene-composition.png`
- UI chrome sample: `docs/art/anchors/ui-chrome-sample.png`

## Tool routing

- Use the existing noir ground bake-off verdict: repo final-paint/post-process first for ground candidates.
- Use existing real generations as seed references: `hmh-production-art-pass`, `pixellab-calibration`, `level-one-final-paint-ground`, `level-two-final-city`, and `final-setpiece-kit`.
- Use PixelLab or ComfyUI only for categories that the seed audit cannot satisfy, or when a slot needs full 12-20 candidate rerolls.
- Keep raw generation output outside the deploy repo. Only approved winners, provenance, QA reports, manifests, and contact sheets enter git.

## Candidate discipline

1. Prefer 12-20 candidates for a new slot when budget/time allow; use smaller final-pass batches only when Justin explicitly authorizes agent judgment to keep momentum.
2. Machine/visual-filter before approval: alpha, palette, density, text/logo/watermark, and anchor/style similarity once calibrated.
3. Build numbered contact sheets or QA sheets per slot.
4. Record the selected winner, prompt, tool, settings, and provenance in `docs/art/ANCHOR_SET.md` and adjacent `.provenance.json` files.
5. Treat approved anchors as style references only until downstream runtime art passes perform crop/alpha/palette cleanup and manifest integration.

## Runtime integration block

WO-76 is approved as a style-lock reference set. Later work orders may use these anchors for prompts and QA, but no generated asset should be swapped into runtime until that work order includes cleanup, manifest updates, tests, and visual QA.
