# Legacy Hard Money Heroes stills

This folder is a deprecated compatibility layer for pre-8-direction Hard Money Heroes still art. Wave 3 treats `apps/portal/assets/generated/hmh-animated-roster/hmh-animated-roster.mjs` as the canonical actor source.

Do not add new raw PixelLab output here. New actor work should follow the Wave 3 pipeline: raw generation to `~/lesters-arcade-vault/` or a gitignored staging folder, integrated frames/manifests into the canonical roster or atlases, then QA reports/contact sheets in the repo.

Deletion of these stills was deferred until the canonical roster plus atlases replaced every runtime fallback. The live HMH runtime is the Pixi reboot and no longer builds any art from this folder, so the 2026-09-25 asset cleanup removed every still that no gate reads (they remain in Git history at `0248cd4b`). The `crypto-bro` and `gas-beast` stills 00-02 stay because `tests/arcade-core.test.mjs` still checks them on disk.
