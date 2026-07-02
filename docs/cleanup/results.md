# Lester's Arcade repo cleanup results

_Last updated: 2026-07-02_

## Completed locally

- Created and verified a full remote mirror backup: `~/backup-lesters-arcade-20260701-233632.git`.
- Created cleanup branch: `chore/repo-slimdown`.
- Created local vault root: `~/lesters-arcade-vault/`.
- Added static asset audit tooling:
  - `npm run repo:audit`
  - `docs/cleanup/asset-reference-map.json`
  - `docs/cleanup/runtime-loaded-assets.json`
  - `docs/cleanup/disposition.md`
- Vaulted the full former HMH reference-art folder:
  - from `apps/portal/assets/hard-money-heroes/reference/`
  - to `~/lesters-arcade-vault/reference/hmh/`
  - verified with `diff -rq` before removal
- Preserved the two Lester reference PNGs used by runtime metadata as exact byte copies:
  - `apps/portal/assets/reference/lester-reference-sprites-01.png`
  - `apps/portal/assets/reference/lester-reference-sprites-02.png`
- Vaulted and removed 324 tracked droppings:
  - `*.zip`
  - `*.txt`
  - root `Lesters_Arcade_HMH_Full_Analysis.pdf`
  - root `generate_analysis_pdf.py`
  - vault manifest: `~/lesters-arcade-vault/pixellab-raw/repo-droppings-zip-txt-root-docs/VAULT-MANIFEST.json`
- Added asset-vault workflow docs: `docs/ASSET_VAULT.md`.
- Added guardrails:
  - `.gitignore` raw asset-output rules
  - `npm run repo:health`
  - `scripts/hooks/pre-commit-size-check.mjs`
  - `scripts/hooks/pre-commit`
  - local `git config core.hooksPath scripts/hooks`
- Converted `apps/portal/src/hmh-level-editor-runtime-sprite-library.mjs` from a 6.5 MB data module into a small lazy loader backed by `apps/portal/assets/hmh-level-editor/runtime-sprite-library.json`.
- Wave 3 Slice 1: vaulted 39 tracked Lester PixelLab splinter/raw-fragment dirs (`anim0`–`anim23`, `idle-2`–`idle-8`, `walk-2`–`walk-8`, `victory-2`) to `~/lesters-arcade-vault/pixellab-raw/wave3-lester-splinter-dirs-20260702-085052/` after checksum verification; the canonical animated-roster manifest referenced none of them.
- Dedupe: vaulted the full `apps/portal/assets/hmh-curated-level-kit/` source tree to `~/lesters-arcade-vault/superseded-art/hmh-curated-level-kit-full-source/`, verified it with `diff -rq`, kept the 1,216 manifest-referenced PNG subset at `apps/portal/assets/generated/hmh-curated-level-kit/source/`, and removed the old duplicate root.
- Dedupe: vaulted and removed 5,593 `hmh-animated-roster` PNGs (37.04 MiB) that were not referenced by `hmh-animated-roster.mjs` or roster ledgers. Manifest validation now reports 7,857 referenced PNGs, 0 missing, and 7,857 remaining PNGs.

## Measurements

| Metric | Before cleanup run | Current local state |
|---|---:|---:|
| Working tree including `.git` | 2.6G | not final |
| Working tree excluding `.git/node_modules/.vercel/.hermes/dist` | about 1.2G | about 667M before final commit |
| `.git` | 1.4G | 1.5G before history rewrite |
| Tracked file count | about 33,700 audited | 33,148 after local commit |

The largest remaining repo weight is still legitimate-gated work: generated/runtime assets, audio/video that needs a CDN target, and historical blobs in `.git` that require an explicit Phase 5 approval.

## Verification record

- `git clone --mirror` completed.
- `git -C ~/backup-lesters-arcade-20260701-233632.git fsck --full` passed.
- Reference vault copy verified with `diff -rq`.
- Dropping vault copy verified with SHA-256 manifest generation.
- `smoke:portal:interactions` passed against a local `apps/portal` web root using `MSYS_NO_PATHCONV=1`.
- Editor runtime sprite-library JSON fetch passed against the local `apps/portal` web root: 17,372 entries.
- Full post-structural gate passed locally: `npm test`, `npm run check`, `npm run contracts:check`, `npm run assets:verify`, and `npm run build`.
- Curated source dedupe regenerated `hmh-curated-level-kit` from the canonical subset: 1,216 source assets, 1,797 sliced ground cells, 1,022 trimmed props.
- Animated roster dedupe copied the removed files to `~/lesters-arcade-vault/pixellab-raw/hmh-animated-roster-unreferenced-20260702/VAULT-MANIFEST.json` before deletion and verified all runtime manifest frames still exist.

## Remaining gated work

1. CDN relocation for playlist audio, music, and video requires Justin to choose Vercel Blob, R2, Bunny, or another host.
2. Production push is halted until explicit approval because `main` auto-deploys to `lestersarcade.io`.
3. History rewrite/fresh repo reseed is halted until explicit approval because it rewrites or replaces GitHub history.
4. Deeper generated-asset pruning requires a true browser Network export/deep pass or a manifest migration that proves those assets are not loaded.
