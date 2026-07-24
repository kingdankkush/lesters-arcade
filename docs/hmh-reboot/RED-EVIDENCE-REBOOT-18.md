# Red Evidence: Reboot 18

Date: 2026-07-23

## Release-browser gate

The first run of `tests/hmh-reboot-release-certification.test.mjs` failed because `scripts/hmh-reboot-release-browser-certification.mjs` did not exist.

Evidence: `.tmp/hmh-reboot-18-red.log`

The first implemented browser run then failed closed because it assumed a retained `runPendingLevels` value instead of the cockpit's established visible upgrade-panel contract. After correcting that harness assumption, exact-byte anchors exposed actual world movement between runs: 22,403 desktop pixels changed because the progression pilot could stop on different terminal ticks.

A release-only anchor was added behind the conjunction `evidenceSafe=1&releaseAnchor=1`. It starts the deterministic controller, enters upgrade mode at tick 0, stops the ticker, and renders once. Clean telemetry was separated from `debugGrid=1` behind `evidenceSafe=1&telemetry=1` so evidence does not enable debug visuals.

The fixed anchor reduced the remaining desktop variance to two pixels at one channel value, consistent with GPU raster rounding. The final gate compares decoded PNG pixels and allows at most 32 changed pixels with maximum channel delta 2. Final Chrome anchors were exact for all five profiles. Final Edge anchors were exact for four profiles; ultrawide changed two pixels at delta 1.

## Active asset gate

The first run of `tests/hmh-reboot-production-asset-qa.test.mjs` failed because `scripts/hmh-reboot-production-asset-qa.mjs` and its package command did not exist.

Evidence: `.tmp/hmh-reboot-18-asset-red.log`

The repository-wide legacy `npm run assets:qa` also failed on eight sampled actors because its 44 atlas page WebPs were intentionally removed by the approved reboot archive commit. The retained manifest reports 73,961,434 archived atlas bytes. The archive is independently recorded and hashed in `docs/hmh-reboot/ASSET-ARCHIVE.json`.

The active replacement gate now validates the four production reboot atlases and passed with 2,569,321 bytes across four 1024x1024 RGBA PNG atlases.
