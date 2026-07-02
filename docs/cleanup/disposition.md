# Lester's Arcade repo cleanup disposition

_Last updated: 2026-07-02_

## Safety net and baseline

- Remote mirror backup: `~/backup-lesters-arcade-20260701-233632.git` (`git fsck --full` passed).
- Working branch: `chore/repo-slimdown`.
- Vault root created: `~/lesters-arcade-vault/`.
- Initial measurement from this cleanup run: working tree `2.6G` including `.git`; file count `35,852` excluding `.git`; git pack size about `1.39 GiB`.
- Current local measurement after safe vault moves: working tree about `667M` excluding `.git/node_modules/.vercel/.hermes/dist`; `.git` about `1.5G`; tracked files `33,148` after commit.

## Audit deliverables

- Static reference map: `docs/cleanup/asset-reference-map.json`.
- Runtime keep-list proxy: `docs/cleanup/runtime-loaded-assets.json`.
- Browser note: no DevTools Network export is committed yet. The JSON keep-list is a conservative static runtime/manifest proxy plus `smoke:portal:interactions` validation, so Phase 2 deletes beyond the safe reference-art/raw-dropping moves still require browser network capture.

## Disposition table

| Folder | Verdict | Notes |
|---|---|---|
| `assets/hard-money-heroes/reference/` (267 B, 1 files) | **VAULTED LOCALLY** | Runtime refs: 0; pipeline refs: 1. Original 388 MB reference tree copied and checksum-verified at `~/lesters-arcade-vault/reference/hmh/`; only a README remains. Exact Lester runtime reference bytes were preserved as `assets/reference/lester-reference-sprites-01.png` and `-02.png`, and `arcade-core.mjs` now points there. |
| `assets/generated/` (268 MB, 20231 files) | **SPLIT / KEEP UNTIL BROWSER DEEP PASS** | Runtime refs: 20173; pipeline refs: 58. Static scan still finds many generated assets through runtime manifests, especially the 6.6 MB editor sprite library. Raw `.zip` downloads and `.txt` prompt/error logs were vaulted and removed; remaining PNGs/manifests need browser network evidence before pruning. |
| `assets/generated/hmh-animated-roster/` (96 MB, 13712 files) | **KEEP NOW / FUTURE ATLAS** | Runtime refs: 13712; pipeline refs: 0. Runtime roster manifest references this set. Do not prune without replacing with packed atlases or a dynamic loaded subset. |
| `assets/generated/hmh-level-environment/` (88 MB, 148 files) | **KEEP NOW** | Runtime refs: 148; pipeline refs: 0. Referenced by runtime/editor manifests. Needs a separate manifest rewrite before any split. |
| `assets/hmh-curated-level-kit/` (114 MB, 11833 files) | **DEDUPE LATER** | Runtime refs: 11833; pipeline refs: 0. Raw curated source is still the live `src` target for generated manifest entries. Generated copy carries manifests/derived assets, but runtime tests assert the source path. Needs a deliberate manifest-path migration, not a delete. |
| `assets/generated/hmh-curated-level-kit/` (34 MB, 2825 files) | **KEEP CANONICAL MANIFESTS** | Runtime refs: 2825; pipeline refs: 0. Manifest-bearing generated copy; keep. |
| `assets/audio/playlist/` (81 MB, 27 files) | **CDN GATED** | Runtime refs: 26; pipeline refs: 1. All playlist tracks remain hardcoded in `arcade-playlist-manifest.mjs`; move only after Justin chooses Vercel Blob/R2/Bunny and CDN URLs exist. |
| `assets/audio/music/` (17 MB, 5 files) | **CDN OR PRUNE AFTER USE AUDIT** | Runtime refs: 5; pipeline refs: 0. Five tracks are referenced by source/runtime map. |
| `assets/audio/sfx/` (143 KB, 15 files) | **KEEP** | Runtime refs: 14; pipeline refs: 0. Small latency-sensitive SFX; one unreferenced file estimate only. |
| `assets/video/` (16 MB, 6 files) | **CDN GATED** | Runtime refs: 3; pipeline refs: 0. Three files are runtime referenced (`arcade-splash-loop.mp4`, poster, HMH intro); three are unreferenced candidates. Upload choice required before deletion. |
| `assets/lester-production/` (9.8 MB, 117 files) | **KEEP** | Runtime refs: 117; pipeline refs: 0. Repo-local production sprite manifest assets. |
| `assets/brand/` (419 KB, 2 files) | **KEEP / REVIEW** | Runtime refs: 0; pipeline refs: 0. Small brand art, no static runtime refs found. |
| `assets/ads/` (351 KB, 4 files) | **KEEP / REVIEW** | Runtime refs: 0; pipeline refs: 0. Small ad art, no static runtime refs found. |
| `assets/reference/` (7.6 MB, 5 files) | **KEEP** | Runtime refs: 5; pipeline refs: 0. Now includes exact Lester reference copies used by `arcade-core.mjs`. |
| `assets/hard-money-heroes/environment/` (59 MB, 150 files) | **KEEP NOW** | Runtime refs: 149; pipeline refs: 0. Runtime/static map still references environment manifest assets. |
| `assets/hard-money-heroes/stills/` (45 MB, 34 files) | **KEEP NOW** | Runtime refs: 34; pipeline refs: 0. Runtime static map references stills. |

## Executed local cleanup in this slice

- Vaulted `apps/portal/assets/hard-money-heroes/reference/` to `~/lesters-arcade-vault/reference/hmh/` and verified with `diff -rq` before removal.
- Preserved the two `arcade-core.mjs` Lester reference PNGs byte-for-byte under `apps/portal/assets/reference/` and repointed runtime metadata there.
- Vaulted and removed 324 tracked root/download droppings (`*.zip`, `*.txt`, root PDF/script) to `~/lesters-arcade-vault/pixellab-raw/repo-droppings-zip-txt-root-docs/` with a SHA-256 `VAULT-MANIFEST.json`.

## Expected remaining savings

- CDN gate: playlist audio (~81 MB), music (~17 MB), and runtime video (~12 MB of the 16 MB folder) after a CDN target is chosen and URLs are wired.
- Structural gate: convert `src/hmh-level-editor-runtime-sprite-library.mjs` (6.6 MB) to fetched JSON before deeper generated-asset pruning.
- History rewrite gate: current `.git` remains large until Justin explicitly approves Phase 5 (`git filter-repo` or fresh repo reseed).

## Do not delete yet

- Do not delete `assets/hmh-curated-level-kit/` yet. The generated manifest's live `src` entries still point at it, and tests assert that path.
- Do not delete generated PNG folders based only on static ref counts. The editor/runtime sprite-library still references many `downloads/*.png` files even after raw `.zip`/`.txt` droppings were removed.
- Do not push this branch or rewrite history without explicit approval; `main` auto-deploys to production.
