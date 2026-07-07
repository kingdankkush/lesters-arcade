# Hard Money Heroes Art Pipeline

**Status:** WO-76 anchor-set pipeline draft. The anchor set is not approved yet, so this document is a gate and prompt standard, not permission to integrate generated art.

## Universal WO-76 prompt preamble

Use this preamble for every WO-76 candidate prompt and, after approval, for every later art-generation prompt:

```text
hi-bit pixel art, litecoin-city-after-dark-neon-noir-deco-v1, palette #0B0E1A #10162A #1A2138 #2B3A5C #173B72 #345D9D #4E82D8 #8CB7FF #E8ECF2 #C9D2DE #A8B4C4 #5C6B80 #2E3A4D #F1D37A #C9A34E #8C6724 #4A3514 #C9FF6A #7FE84A #3FAE3B #1F5C2E #FF78D1 #E040A0 #992B78 #4B1844 #F8FBFF #C7D0E0 #6F7B91 #11151F, night-city noir, top-left key light with local neon rim light, painterly pixel clusters, clean 1px selective dark navy outline, transparent background where applicable, readable silhouette at gameplay zoom, no text, no logos, no watermark, match the approved WO-76 anchor set
```

Until the winners are approved, replace the final clause with:

```text
match the WO-76 candidate direction and the attached seed references; this is a candidate only, not approved anchor art
```

## Tool routing

- Use the existing noir ground bake-off verdict: repo final-paint/post-process first for ground candidates.
- Use existing real generations as seed references: `hmh-production-art-pass`, `pixellab-calibration`, `level-one-final-paint-ground`, `level-two-final-city`, and `final-setpiece-kit`.
- Use PixelLab or ComfyUI only for categories that the seed audit cannot satisfy, or when a slot needs full 12-20 candidate rerolls.
- Keep raw generation output outside the deploy repo. Only approved winners, provenance, QA reports, manifests, and contact sheets enter git.

## Candidate discipline

1. Generate or collect 12-20 candidates per WO-76 slot.
2. Machine-filter before Justin sees the sheet: alpha, palette, density, text/logo/watermark, and anchor/style similarity once calibrated.
3. Build numbered contact sheets per slot.
4. HALT for Justin: pick one winner, reject all, or order rerolls with notes.
5. Only after approval: copy winners into `docs/art/anchors/`, record exact prompt/tool/settings in `docs/art/ANCHOR_SET.md`, and calibrate similarity QA.

## Hard block

No later art work order may treat a WO-76 slot as approved until `docs/art/ANCHOR_SET.md` changes from `Status: UNAPPROVED` to an approved ten-slot registry with winner provenance.
