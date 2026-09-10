# Model completion authority

Owner explicitly authorized best-judgment hero/enemy/weapon models, textures, all animations, integration, polish, testing and measured game-engine upgrades. The owner explicitly permitted increasing the per-hero texture limit. This supersedes earlier unanswered texture-limit questions and stale task-list entries.

Implementation decision: adopt4MiB (4,194,304bytes) maximum per-hero gameplay texture transfer and16MiB (16,777,216bytes) for the actual four-hero combined compressed texture payload, using opt-in lossless WebP with decoded-pixel verification. The aggregate is explicitly increased from12MiB because four assets may each use their4MiB allowance; it is not reinterpreted as a one-hero request gate. Preserve648frames,2048atlas dimensions, projection scale, lazy loading, browser fallbacks, FPS/decoded-memory/total-game-payload limits and accessibility controls. Report initial selected-hero transfer and decoded GPU allocation separately. Browser/performance acceptance remains mandatory before release.

Preserve the established fixed-tick gameplay, actor IDs, save/bridge/schema and parent wallet authority. Reconcile current production before source integration; preserve newer STACKED/security changes. This permission covers art, gameplay and website delivery, not real-funds operations, contract deployments, settlement activation or credential/authority changes.

Source acceptance, visual/animation acceptance, reproducible atlas generation, runtime integration and public production remain distinct evidence gates. Existing derived models and scripts are candidates until exercised and reviewed. Never claim all roster work complete from a pilot or structural receipt.
