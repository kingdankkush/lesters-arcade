# WO-108 Runtime Hitbox Proof

This folder captures the WO-108 runtime `debugHitboxes` integration.

- `wo108-hitbox-overlay-proof.png` shows the renderer-facing overlay model: blue body boxes, red hurt boxes, and gold boss multi-capsules.
- `wo108-hitbox-overlay-proof.json` records the deterministic runtime adapter output used for the proof sheet.

Acceptance notes:

- Enemy damage now uses sprite-derived hurt boxes through `runtimeEnemyHitbox()`.
- Boss damage now uses aggregated multi-capsules through `runtimeBossHitbox()`.
- `main.js` exposes the overlay with `?hmhDebug=hitboxes` or `?debugHitboxes=true`.
- Runtime sprite scale remains 100%; large enemies are represented by source art size plus capsule partitioning, not by shrinking the sprite.
