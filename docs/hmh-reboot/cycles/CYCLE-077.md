# Cycle 077: textured hero selection turntables

**Status: PRODUCTION VERIFIED.** Source commit `126dd58d862ae0d8c15e44c579069d1199c74fad` is live at https://lestersarcade.io.

## Delivered

- Latest owner-exported textured Tripo turntables for Lit Commando, Lit Valkyrie, Lester and Lilly.
- Eight 384px PNG directions per hero; aggregate 1,638,626 bytes, under the unchanged 2MiB total and512KiB per-hero limits.
- Separate packed static selector scene and hash-bound original GLB inputs in source-only Git LFS. No GLB/Blend is in portal delivery.
- Existing hero IDs/stats, unlocks, direction convention, grounding, keyboard/touch navigation, lazy loading and reduced motion preserved.
- Cache marker `lesters-arcade-v29-hmh-textured-heroes`; preload/script token `hmh-aaa-cycle-077-textured-heroes`.

## Verification

49 focused tests passed. Full release:2,566 tests,2,515 passed,51 explicitly accepted legacy failures,zero unexpected failures. Clean no-Git canonical-pointer host fixture passed `npm ci` and the exact Node24/Pillow11.3 Vercel build. Expanded-source and clean-host served artifacts matched. Two selector renders had zero observed RGBA drift; twelve existing visual anchors passed without baseline changes.

Final independent code and image review passed on binary diff `33c3b759d5f7eaa37b83abb2c0b16fcbb6c9a08a500e354fb2824e51cdad925a`. Provider-limited earlier attempts were not counted as acceptance.

Protected Preview:35 exact stable artifact hashes; both HTML bodies matched after removing only their exact host-injected163-byte Vercel feedback script. Public production:all37 raw artifact hashes match. Four public desktop/mobile/reduced-motion selector-to-gameplay flows passed. Four clean/warm portal/game network scenarios had zero HTTP, request, console or page errors. Actual production screenshots were inspected.

Raw expanded sources make the working-tree health metric405MB, above350MB. This failure is recorded, not waived by increasing limits: the actual pointer-only deployment fixture passes unchanged health/CDN/docs gates.

## Release boundary

- Production: `dpl_2ij5eQq1c6FYKCeXQV9Qwz1MbKnb`.
- Rollback: `dpl_7Ge2KAXfiSTFEzanHt6DLM6diafg`.
- These are static selector models, not newly rigged gameplay heroes. Gameplay skinning, nine required clips,256px atlases, enemy/weapon integration and broader game work remain open.
- No contract, wallet, settlement or real-funds operation occurred.

[Production certificate](../RELEASE-CERTIFICATION-AAA-CYCLE-077.json) · [Current handoff](../../handoffs/2026-09-06-hmh-cycle-077-hermes-handoff.md)
