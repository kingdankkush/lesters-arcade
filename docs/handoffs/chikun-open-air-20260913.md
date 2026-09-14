# Chikun open-air flight polish — September 13, 2026

The owner authorized the tested website update and public source/artwork publication. This branch preserves the deployed HMH motion/mobile source `0e858cde582f10be767c170de6f7f2588cf4e977` and the subsequently published STACKED cabinet source `e7e28d57ba2964dfba419e4aa31804939ed142bc`. Production promotion and hosted verification remain pending until the release receipt is recorded.

## Player-facing changes

- Removed the oval daily ghost marker, dashed obstacle target and circular flight particles. Daily-best score comparisons remain local.
- Added freestanding Blender trees and animated patrol drones, alternating with gates. Air above a tree and above/below a drone is navigable. Collision uses crown circles, trunk/body capsules and gate rectangles; transparent sprite corners do not block flight.
- Preserved eighteen horizontal Superman clips, blended flight, hair/coat wind, city/mountain parallax and the day/night cycle. Slim wind streaks and restrained scoring effects keep the character readable.
- Launch/flap input survives high-refresh rendering until the next fixed simulation step. Pause discards stale input; secondary pointers and repeated keydown events do not flap.
- The shared Lester's Arcade player starts a random song on each new flight and avoids an immediate repeat. Pause/resume preserves the song and saved volume/mute choices. The child's Music button opens the shared player; mobile pause buttons have 44 px targets.
- Free retries verify fresh results without touching Ranked progress. Ranked finalization remains idempotent. Shared music changes cannot open the legacy combat menu over Chikun.

True 9:16 portrait and 16:9 landscape playfields fit the available screen. Desktop uses the full available width, with enter/exit fullscreen. Portrait uses a narrower camera and an approaching-obstacle cue; sprites remain uniformly scaled, the full vertical collision lane remains visible, and rotating a phone does not change the simulation or replay. Portrait start/results/pause controls use the taller space.

## Compatibility and source

Chikun is `0.6.0`, `canvas-runtime-v4`, with `chikun-flap-evidence-v2`. Canonical replay uses the same obstacle geometry as play. Exact v1 replay support is retained for older recordings; new Ranked submissions cannot downgrade to v1. Daily course and local comparison storage are versioned for the new obstacle layout. Child messages remain bounded and parent-owned score verification is retained. No settlement or paid-entry activation is included.

Native editable props: `apps/chikun/assets/source/open-air/`. The two runtime WebP sheets total 81,124 bytes in `apps/portal/assets/generated/chikun-open-air-v1/`. Native geometry and collision share `apps/chikun/assets/obstacle-shapes.json`; manifests record SHA-256 provenance. Build/pack scripts are under `scripts/`. Existing character sources and flight sheets remain unchanged.

## Verification

Focused Chikun/music coverage: 65 passing tests, including v1 replay, v2 deterministic collision/evidence, drone coin stability, practice retry isolation and music lifecycle. The actual browser harness controls only its test render clock to verify a launch at 240 Hz and a longer varied course, two terminal results, randomized audible playback, and pause/music/resume. Ordinary browser runs separately measure real frame pacing; controlled-clock results are not performance evidence.

Final release-gate, visual comparisons, desktop/mobile browser evidence and hosted byte checks will be linked in the release receipt. Browser mobile emulation does not claim physical iOS/Android device acceptance. The combined release uses cache marker `lesters-arcade-v42-chikun-open-air`.
