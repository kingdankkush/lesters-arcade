# Cycle 075 — bounded feedback, UI and source-reference foundations

Status: LIVE VERIFIED. Runtime `d53ed420`; deployed source `d70ad060`; production `dpl_7Ge2KAXfiSTFEzanHt6DLM6diafg`.

## Scope

This is an incremental continuation of Cycle 074 (`0199035a` handoff baseline), not completion of the entire game roadmap.

- Death confirmation reads the live reduced-motion and reduced-flash settings. Reduced motion retains a fixed-size ring but suppresses shards and the expanding cloud. Reduced flash uses a dimmer colored ring instead of hot white.
- Mobile death debris uses the existing performance profile: five shards instead of the desktop eight. Simulation, death timing, damage and reward authority are unchanged.
- Shield-absorbed hits no longer select the optional flesh-blood cloud. Gore remains opt-in through the established parent setting; no new setting or persistence authority is introduced.
- Solid and additive particle banks reuse inactive sprites across banks. Resident sprite count cannot grow to two independent high-water marks above the shared pool cap. Claimed sprites are never moved during their active frame.
- Upgrade pointer confirmation uses the same single-selection latch as keyboard/gamepad. Replaced, hidden and destroyed upgrade panels release card/disclosure listeners rather than retaining detached elements for the entire run.
- Original owner references are retained source-only: eight hero PNGs and eleven weapon/grenade PNGs, with unchanged-byte SHA-256/dimension/size provenance and Git LFS rules.
- Source-reference intake accepts either the exact PNG or a canonical LFS pointer bound to the manifest OID and byte size. An isolated no-smudge fixture runs the actual complete intake tests for all 19 records and proves forged OID/size fail.
- Blender dependency inspection recognizes `packed_files`-only data while still rejecting unpacked media and linked libraries. An on-disk LFS pointer is **not** a packed Blender texture.
- The atlas writer adds suffix-opt-in exact lossless WebP, preserving all decoded RGBA including colored transparent pixels and the established default PNG bytes. No active atlas URLs, packing, dimensions or budgets change.

## Explicitly unfinished / not shipped as runtime replacements

The Commando and sci-fi grenade `.blend`/`.glb` source experiments, their generators and source-review packages remain local WIP. Their structural reports are not likeness, animation, attachment, mobile or runtime acceptance. The other heroes and weapon concepts remain open. This slice does not claim new roads, water, level props, enemy AI, pathing, physics, boss behavior or hero art. Existing systems are regression-tested, not replaced.

## Evidence

- RED: the mixed-bank pool retained eight sprites against a four-sprite cap; death-settings resolver was absent. New upgrade tests reproduced duplicate pointer confirmations and retained detached listeners.
- RED: the real Python dependency function reported a `packed_files`-only image as external. The manifest-bound source-reference validator was absent.
- GREEN: focused effects, world-atmosphere, upgrade/settings, intake, no-smudge, packed-source and exact encoding tests passed.
- New permanent smoke: `scripts/hmh-reboot-defeat-feedback-browser-smoke.mjs`. It matches served bundle bytes, fires the real pistol at an actual roster target, observes the actual kill render branch, and freezes via the normal pause path. Desktop/mobile/reduced profiles produced respectively 8/5/0 shards for one observed kill. Zero console, page, HTTP or request errors; one canvas; no horizontal overflow.
- Full-resolution VFX captures were inspected, with separate unmodified pause/settings captures before hiding the DOM overlay for the effect view.
- Existing serial cockpit matrix, performance smoke and enemy/boss presentation smoke passed. Measured desktop and mobile-emulation p95 frame time was 8.5 ms in the existing five-second steady-state window. These are local browser measurements, not physical-phone or long-endurance certification.
- Local child entry: 464,501 bytes; initial JS including Pixi and statically imported shared chunks: 994,069 bytes. Existing caps remain unchanged. The exact release-tree and public production artifact hashes match.

## Release boundary

- Branch: `hermes/hmh-cycle-075-reference-heroes`.
- Prior production / retained rollback candidate: `dpl_6eQiyfLKrCT5aLWRjivcTGQuqWbR` (`lesters-arcade-276x61nsi-justin-agent-projects.vercel.app`), freshly inspected READY before release.
- Candidate portal token: `hmh-aaa-cycle-075-feedback-and-ui`.
- Candidate service-worker marker: `lesters-arcade-v28-hmh-feedback-and-ui`.
- No wallet, signature, transaction, contract deployment, settlement activation, paid asset purchase or Tripo generation was performed in this slice.

## Final certification

The exact staged-tree archive passed `vercel:build` with no discoverable Git metadata and Pillow 11.3.0: 2,563 tests evaluated, 2,512 passed, the same 51 expected legacy failures, zero unexpected/cancelled/skipped tests. Syntax: 400 JavaScript modules and 56 Python scripts. Production asset QA, strict archive health and current/public docs links passed. The archive-built child bundle is byte-identical to the browser-tested candidate (`40d7a61c0ed85d04c14b2f96c01c8ed41e707725a3f6b7e5e895a83c7ed49ec1`).

Twelve visual anchors, five responsive profiles and four real-touch profiles passed. Independent reviews returned PASS for the frozen runtime/source diff and Node TAP-reporter correction. Preview `dpl_8wc8CdQbyXF3BUwrcxLZ2X2XsD43` was READY, 34 artifacts matched and authenticated gameplay passed. Exact promotion created production `dpl_7Ge2KAXfiSTFEzanHt6DLM6diafg`; the public domain resolved to that ID, all 34 hashes matched, actual desktop/mobile/reduced-motion gameplay passed, and all four public network scenarios passed. The initial failed Preview was never promoted. See the [release handoff](../../handoffs/2026-09-06-hmh-cycle-075-hermes-handoff.md) for evidence, rollback and remaining scope.
