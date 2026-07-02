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

Final full gate results are recorded in the handoff after the final local commit.

## Remaining gated work

1. CDN relocation for playlist audio, music, and video requires Justin to choose Vercel Blob, R2, Bunny, or another host.
2. Production push is halted until explicit approval because `main` auto-deploys to `lestersarcade.io`.
3. History rewrite/fresh repo reseed is halted until explicit approval because it rewrites or replaces GitHub history.
4. Deeper generated-asset pruning requires a true browser Network export/deep pass or a manifest migration that proves those assets are not loaded.
