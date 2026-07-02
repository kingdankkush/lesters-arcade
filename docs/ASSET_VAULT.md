# Lester's Arcade asset vault

The git repo holds code, tests, contracts, docs, integrated runtime assets, manifests, QA reports, and small latency-sensitive SFX. Heavy raw/reference/source media belongs in the vault, not in git.

## Local vault root

`~/lesters-arcade-vault/`

Current folders:

- `reference/` — reference art and source inspiration that must not ship directly in runtime bundles.
- `pixellab-raw/` — PixelLab raw batches, downloads, prompt/error logs, and generation scratch output.
- `audio-masters/` — source/master music and audio files before CDN packaging.
- `video/` — source/master video files before CDN packaging.
- `superseded-art/` — replaced generated/runtime candidates retained for recovery.
- `docs-archive/` — root PDFs and generated document artifacts that do not belong in the repo root.

## Cleanup slice vault index

- `~/lesters-arcade-vault/reference/hmh/` — full former `apps/portal/assets/hard-money-heroes/reference/` tree. Copied and verified before removal.
- `~/lesters-arcade-vault/pixellab-raw/repo-droppings-zip-txt-root-docs/VAULT-MANIFEST.json` — SHA-256 manifest for removed tracked `*.zip`, `*.txt`, root PDF, and root PDF generator.

## Sync command

Remote vault sync is intentionally not configured until Justin chooses the target. Recommended default is Google Drive through `rclone`.

```bash
# Check local config and expected env vars
node scripts/vault-sync.mjs status

# After configuring rclone and choosing a remote target
LESTERS_ARCADE_VAULT_REMOTE='gdrive:lesters-arcade-vault' node scripts/vault-sync.mjs push
LESTERS_ARCADE_VAULT_REMOTE='gdrive:lesters-arcade-vault' node scripts/vault-sync.mjs check
```

## Going-forward rule

New asset waves land as:

1. raw generation output → vault or gitignored `apps/portal/assets/_staging/`
2. integrated runtime frames → atlas or curated manifest-backed runtime folder
3. manifest + QA report/contact sheet → repo
4. audio/video runtime media → CDN behind `MEDIA_BASE`, not committed as fresh large binaries

Do not place raw PixelLab output, downloaded ZIPs, prompt logs, audio masters, video masters, or reference-art dumps directly under committed `apps/portal/assets/`.
