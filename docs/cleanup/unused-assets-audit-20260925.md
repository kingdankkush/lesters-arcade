# Unused asset report for the deletion slice

- **Repo:** `C:/Users/just_/lesters-arcade-wt/hmh-design`, detached at production 1.8.1, commit `60ea173a6fbbd6957706152a1a528073d3c1d937`.
- **Mode:** read-only audit. Nothing in the repo was modified.
- **Machine-readable copy:** `unused-assets.json`, next to this file.
- **Byte basis:** working-tree bytes of git-tracked files. LFS files are counted at their smudged size. Sizes were re-measured at this commit with `git ls-files` plus `stat`.

## Totals

| List | Bytes | Files | LFS files |
|---|---:|---:|---:|
| 1. Safe to remove (adversarially verified) | **12,918,388** (12.9 MB) | 143 | 0 |
| 2. Probably safe, needs a code or test edit (whole units) | **224,562,523** (224.6 MB) | 750 | 5 |
| 2a. Of which gate-safe with no edit (subsets) | 197,634,919 (197.6 MB) | 464 | 5 |
| Partial: unreferenced or runtime-dead files inside KEEP folders, no edit | 26,707,461 (26.7 MB) | 158 | 0 |
| Partial: same, but a test, QA or verify edit is needed | 22,506,253 (22.5 MB) | 67 | 0 |
| **All candidates** (lists 1 + 2 + partial; no overlap) | **286,694,625** (286.7 MB) | 1,118 | 5 |

The 150.3 MB Tripo selector chain (L2-01) accounts for two thirds of list 2 by itself.

### Read before deleting

1. **Git history does not shrink.** Deleting from the working tree does not reduce `.git` or the Git LFS store. The 5 LFS objects in L2-01 (150.3 MB) and every blob stay in history and on the LFS server. Reclaiming them needs a history rewrite (`git filter-repo` or `git lfs migrate`, then an LFS prune, a force-push and a re-clone everywhere). That is a separate decision for the owner. It would also change every certified commit SHA and patch SHA-256 pinned in `AGENTS.md` and the handoffs. The working-tree deletion is still worth doing: it shrinks checkouts, and it shrinks every local `vercel deploy` upload, because `.vercelignore` excludes neither `assets/source` nor `docs`.
2. **Deploy impact.** `vercel.json` sets `outputDirectory: apps/portal`. Any deletion under `apps/portal/**` changes the served file set, so under `AGENTS.md` it is a new candidate that needs fresh certification. Deletions under `docs/**`, `apps/hmh-reboot/assets/source/**` and `assets-source/**` only shrink the upload.
3. **Do not trust the stale `docs/cleanup` reports.** `repo-cdn-cleanup-gate.json` marks the live production-hero atlases, the playlist and the video as `runtimeReferenced:false`, because its reference map skips `apps/hmh-reboot/src`. `disposition.md` sizes are also stale.
4. **Release-gate ledger.** `test:release` requires the observed failures to match the 51 entries in `LEGACY-TEST-RETIREMENT.json` exactly. A deletion can fail the gate in two ways: it creates a new failure, or it turns a ledgered failure into a module-load error (reported as "missing ledger failure"). List 1 has no ledger overlap. Where a list 2 unit has overlap, it is called out.

---

## 1. SAFE TO REMOVE

Every folder here has no reference from runtime, build, tests, gates or asset pipelines. Two adversarial verifiers each tried to refute that and could not: one looked at build, deploy and the service worker; the other at tests and reproducibility. Ledger overlap is **none** for every row.

| Path | Bytes | Files | LFS | Evidence summary | Same-commit caveat |
|---|---:|---:|---:|---|---|
| `apps/portal/assets/generated/chikun-flight-v1` (includes `audio/`) | 3,272,836 | 41 | 0 | Orphaned v1 flight atlases. Commit 4e2bdaec moved every loader to v2/v3. Nothing references it by path, template, SHA or blob. | The audio blobs are byte-identical to the live `chikun-flight-v2/audio`, so they free no git storage; keep the v2 copies. The URLs are public today and will 404 after the next deploy; nothing requests them. |
| `docs/qa/mobile-worlds-20260914` | 3,009,939 | 26 | 0 | QA evidence. The only link is from `docs/qa/mobile-worlds-20260914.md:17`, and that file is itself unlinked. | Retire or rewrite that `.md` in the same commit. |
| `docs/qa/combined-arcade-20260913` | 1,941,479 | 28 | 0 | Referenced only by path/SHA pins in its receipt (lines 334-446) and by prose in three handoffs. | **Keep** `docs/qa/combined-arcade-release-20260913.json`: README.md:65 links it and `docs:links` checks that link. |
| `docs/qa/arcade-discovery-20260914` | 1,775,330 | 12 | 0 | The only reference is the receipt's `evidenceDirectory` field (line 144), which no code reads. | **Do not** touch the `?v=arcade-discovery-20260914` cache token, which live HTML and tests use. |
| `apps/portal/assets/generated/chikun-ground-audio-v1` | 705,238 | 12 | 0 | Generated but never wired in. Runtime audio comes from `chikun-flight-v2/audio`. | Recommended: retire `scripts/build-chikun-ground-audio.py` and `scripts/syntax-check.mjs:951`. |
| `apps/portal/assets/generated/chikun-flight-v3/audio` | 572,888 | 9 | 0 | Byte-identical copy of the v2 audio. No code on any ref has ever loaded it. | Leaves stale prose in `pack-chikun-sheet-atlases.py:9` and `docs/chikun/CHARACTER-SHEET-PIPELINE.md:73`. |
| `apps/portal/assets/generated/hmh-pixellab-sprite-expansion-500` | 568,775 | 1 | 0 | A ledger of 500 PixelLab jobs, all `not_started`. Nothing reads it. | Retire `scripts/pixellab-hmh-sprite-expansion-500.py` and its game-design doc too, or `init` recreates the folder. The file is public today and exposes PixelLab account and usage data. |
| `docs/qa/hmh-combined-20260911` | 329,302 | 2 | 0 | Two orphan screenshots from c734333b. No reference by name, SHA or blob. | none |
| `docs/game-design/wo102-megaprop-proof` | 270,774 | 5 | 0 | Proof captures. Only the folder's own `capture-manifest.json` refers to them. | This is **not** the live `wo102-megaprop/*` or `hmh-wo102-megaprops` art. The manifest exposes the path `C:\Users\just_`. |
| `docs/qa/hmh-quality-20260911` | 262,837 | 4 | 0 | Screenshots pinned only by SHA in their receipt (lines 1846-1859). | **Keep** the receipt, which README.md:106 links. Two images are captures of a replaced production deploy and cannot be recreated; they remain in 06749b38. |
| `apps/portal/assets/generated/hmh-environment-pixellab-wave-3` | 107,158 | 2 | 0 | Empty manifest plus a job log with 0 outputs. `WAVE_3` has never been imported. | Optional: retire 3 orphan generator scripts and the wave-3 doc. |
| `docs/art/qa` | 101,832 | 1 | 0 | Mentioned only in backtick prose at `...infrastructure-wave-3-art-review.md:18`, an unlinked doc. | That doc line will dangle; nothing checks it. |
| **Total** | **12,918,388** | **143** | **0** | | |

`apps/portal/assets/generated/chikun-flight-v1/audio` (572,839 B, 9 files) also received 2 of 2 votes. It is nested inside the first row and counted there, not added again.

---

## 2. PROBABLY SAFE, NEEDS A CODE OR TEST EDIT

These folders are referenced only by dead code (mostly the retired canvas combat path and uncalled builders), by docs, or by tests and verify scripts whose only job is to check these files. None had an adversarial vote; each rests on one or more single-auditor passes. "Gate-safe subset" means the files that can be deleted with **no** edit and still keep `test:release`, `assets:verify`, `check` and `build` green. Deleting them usually leaves inert strings behind.

| ID | Unit | Bytes | Files | LFS | Gate-safe subset (bytes / files) |
|---|---|---:|---:|---:|---:|
| L2-01 | Retired static Tripo selector chain | 150,337,026 | 6 | 5 | 150,337,026 / 6 (the whole unit) |
| L2-02 | `apps/portal/assets/audio/music` | 16,386,690 | 5 | 0 | 12,996,964 / 4 |
| L2-03 | Legacy Level-1 environment trove plus its contact sheets | 11,559,847 | 158 | 0 | 10,709,049 / 145 |
| L2-04 | Legacy HMH character art: frames, stills, screens, lester-production, user-asset manifest | 17,476,781 | 445 | 0 | 9,225,280 / 251 |
| L2-05 | `apps/portal/assets/hmh-level-editor` (runtime sprite library) | 6,656,588 | 1 | 0 | none |
| L2-06 | Legacy loader payload manifests (9 folders) | 7,535,080 | 65 | 0 | 3,949,974 / 19 |
| L2-07 | Legacy canvas Level-1 world data (coherent-world, level-one-ground, wo102-megaprops) | 490,410 | 29 | 0 | 248,138 / 13 |
| L2-08 | Legacy enemy-roster atlases for the 6 native-migrated actors | 8,492,207 | 18 | 0 | 7,693,387 / 12 |
| L2-09 | Superseded `hmh-reboot-hero-selector` | 1,805,701 | 5 | 0 | none |
| L2-10 | `hmh-aaa-pixellab-quality-wave` | 371,337 | 1 | 0 | none (1 test line) |
| L2-11 | `apps/portal/assets/ads` | 359,080 | 4 | 0 | 5,211 / 2 |
| L2-12 | `docs/testing/VISUAL_BASELINES/hmh-level-1` | 2,132,011 | 3 | 0 | 1,510,125 / 2 |
| L2-13 | `docs/game-design/assets/hmh-level-1-world-blueprint-v3` | 959,765 | 10 | 0 | 959,765 / 10 |
| **Total** | | **224,562,523** | **750** | **5** | **197,634,919 / 464** |

### L2-01 Retired static Tripo selector chain (about 150 MB, all LFS)

**Paths**
- `apps/hmh-reboot/assets/source/models/tripo-selector/*.glb` (4 files, 66,967,320 B)
- `apps/hmh-reboot/assets/source/blender/hmh-tripo-selector.blend` (83,367,740 B)
- `apps/hmh-reboot/assets/source/blender/hmh-tripo-selector-sources.json`

**Why it is dead.** Since b893962e the selector renders from `models/tripo-gameplay/*.blend` (`packed-gameplay-sources`). Two tests assert that `sourceBlend` is absent and call it "the retired static scene": `hmh-reboot-tripo-selector-source.test.mjs:14` and `hmh-reboot-hero-selector-render.test.mjs:75`. No test or script names the `.blend` file or `tripo-selector/`.

**References to remove**
- `.gitattributes:27-28`: the comment plus the LFS rule for `hmh-tripo-selector.blend`.
- `docs/hmh-reboot/BLENDER-ATLAS-PIPELINE.md:203-206`: this text is already stale.
- Optional: `scripts/hmh-blender/create-hmh-tripo-selector-scene.py` together with its entry at `scripts/syntax-check.mjs:1040`.
- Optional: the dormant `static-textured-models` branch in `run-hmh-hero-selector-render.py:266-276` and `export-hmh-hero-selector.py:164`. It is safe to leave in place.

**Gate impact.** Deleting only the files breaks nothing. This is the highest-value item. It also stops `hmh-source-model-lfs-check --clean-clone` from flagging the GLBs.

### L2-02 Unplayed music

**Paths:** `apps/portal/assets/audio/music` (5 MP3s).

**Why it is dead.** Nothing plays these files. The only references are data strings in `arcade-core.mjs`.

**References to remove**
- `tests/arcade-core.test.mjs:2426, :2433-2434`: checks that `lester-and-lilly-rap-getting-lit.mp3` exists. This is live and not ledgered.
- `tests/arcade-core.test.mjs:2485`: `musicTracks.length >= 4`.
- `apps/portal/src/arcade-core.mjs:1313` and `:1457-1462`. These are runtime-source edits.
- `hard-money-heroes-user-asset-manifest.json:2737-2762`.
- Regenerate `docs/cleanup` with `npm run repo:cdn-gate`.

**Gate-safe subset.** Four files (13.0 MB) have no test check: `rise-to-the-occasion`, `litvm-going-to-the-moon-new-2`, `lester-and-lilly-rap-getting-lit-vocals` and `litvm-testnet-teaser`.

### L2-03 Legacy Level-1 environment trove

**Paths**
- `apps/portal/assets/hard-money-heroes/environment/**` (148 PNGs plus 2 manifests, 10.8 MB)
- `docs/game-design/hmh-environment-contact-sheets/` (8 files)

**Why it is dead.** `combatArt.environmentStages` starts as `{}` and is never filled (`main.js:1644`), and `buildEnvironmentStageArt` (`main.js:541`) has no caller, so no PNG is ever fetched. The `.mjs` manifest is still bundled eagerly, about 125 KB minified.

**References to remove**
- `arcade-core.mjs:4` (import) and `:72` (export).
- `main.js:173, :541, :1644, :4781-4787`, plus the `drawBackground` consumer.
- `tests/arcade-core.test.mjs:2539-2562`: the manifest test, which checks disk for `desert_approach` env-001..012.
- `tests/hmh-level-editor.test.mjs:153`, and 148 entries in `runtime-sprite-library.json` (or retire the whole editor, L2-05).
- The ingest and inventory scripts, and the `contactSheets` arrays.
- `docs/cleanup/disposition.md:37`.

**Gate-safe subset.** 136 PNGs (everything except env-001..012), the unread `hmh-environment-manifest.json`, and the 8 contact sheets.

The same applies to each stage subfolder audited on its own: `ghost_town` 3,017,376 B, `desert_approach` 2,667,137 B, `country_road` 1,986,093 B, `inner_city` 1,377,951 B, `residential_edge` 1,355,038 B. Only `desert_approach` holds test-checked files.

### L2-04 Legacy HMH character art

**Paths**
- `apps/portal/assets/hard-money-heroes/frames` (288 files, 6.37 MB)
- `apps/portal/assets/hard-money-heroes/stills` (35 files, 5.60 MB)
- `apps/portal/assets/hard-money-heroes/screens` (4 files, 2.32 MB)
- `apps/portal/assets/lester-production` (117 files, 3.10 MB)
- `hard-money-heroes-user-asset-manifest.json` (87 KB)

This covers every audited subfolder: `frames/{lester,lilly,crypto-bro,gas-beast,trench-degen,evil-banker,warren-spear-rider}`, `stills/{lester,lilly,crypto-bro,gas-beast,trench-degen,evil-banker,warren-spear-rider}`, and `lester-production/{frames/*,stills,source}`.

**Why it is dead.** The only loaders are `buildCharacterArtFromManifest` (`main.js:567`) and `buildEnemyArtFromManifest` (`main.js:656`). Nothing calls either, and `tests/hmh-load-speed.test.mjs:79-80` forbids calling them. The screens fallback at `main.js:942` can never run.

**References to remove**
- `main.js:567-598, :656-668, :942`.
- `arcade-core.mjs:1325-1455`, `:1342-1357`, `:1379`, `:1412`.
- `scripts/verify-generated-assets.mjs:7, :98-139, :264`. This is `assets:verify` inside `vercel:build` and hard-fails the production build.
- `tests/arcade-core.test.mjs`: `:1885-1937` (lester-production), `:1891` (the `assets:lester` string), `:2440-2483` (Lester and Lilly frames plus screens), `:2484-2536` (crypto-bro, gas-beast and warren frames and stills), `:2564-2572` (checks that the builders exist in `main.js`), and the `:2851/:2869` coverage report.
- `tests/hmh-level-editor.test.mjs:151-154` plus the matching editor-library entries.
- The boot-splash poster at `index.html:178` and in the `discover/*.html` pages (generated by `scripts/build-portal-pages.mjs`). It sits in the always-hidden `#officialGameIntroSplash`, so it is probably fetched on every portal load (about 578 KB). I did not confirm this in a browser.
- Scripts: `ingest-hard-money-heroes-user-assets.py`, `slice-lester-production-sprites.py` (plus `syntax-check.mjs:987`), `optimize-assets.py:34-37`, `report-hmh-animation-coverage.mjs`.
- The `hmh-hero-animation-qa` manifest, which nothing reads.

**Policy.** `stills/README.md` explicitly defers deleting the stills, so the owner has to sign off.

**Gate-safe subset.** 216 frames that no test checks on disk, 28 stills (everything except crypto-bro and gas-beast 00-02), the 6 lester-production still source sheets, and the user-asset manifest.

### L2-05 Level-editor runtime sprite library (keystone)

**Path:** `apps/portal/assets/hmh-level-editor/runtime-sprite-library.json` (6.66 MB).

**Why it is dead.** The editor boots only on localhost. 16,716 of its 17,371 `src` paths no longer exist. There is no generator in the repo, yet the file ships on every deploy.

**References to remove**
- `tests/hmh-level-editor.test.mjs`: it reads the JSON at module top level, so the whole file must be retired or rewritten.
- `hmh-level-editor-{runtime-sprite-library,assets,app,generated-library}.mjs`, `editor.html`, and their `syntax-check` entries.
- The `repo-cleanup-audit.mjs` keep-list treats this file as a runtime manifest.

**Why it matters.** Retiring the editor removes the editor-side references that currently hold L2-03, L2-04, L2-06 and L2-07 in place.

### L2-06 Legacy loader payload manifests

**Paths**

| Folder | Size | Files |
|---|---:|---:|
| `hmh-animated-roster` | 1.93 MB | 1 |
| `hmh-complete-animations` | 553 KB | 2 |
| `hmh-final-animation-completion` | 149 KB | 2 |
| `hmh-final-boss-animations` | 125 KB | 2 |
| `hmh-environment-pixellab-wave-2` | 336 KB | 2 |
| `hmh-isometric-pixellab` | 293 KB | 12 |
| `hmh-level-environment` | 52 KB | 1 |
| `hmh-curated-level-art` | 3.89 MB | 6 |
| `pixellab-calibration` | 201 KB | 37 |

All are under `apps/portal/assets/generated/`. `pixellab-calibration` includes its `lester-hero-6d6e53e2` subfolder.

**Why it is dead.** They are reachable only through `apps/portal/src/games/hmh/loader.mjs` via `ensureHMHLoaded()`. Its only caller is `main.js:6228`, on the legacy canvas branch, and `'lester-blaster'` returns into the Pixi reboot before reaching it. Almost every PNG these manifests name was archived in ddcccfa6. Their `dist/chunks/*` output still ships.

**References to remove**
- `loader.mjs:20-31, :36-49, :56-67`. esbuild fails if an import target is missing.
- In `main.js`: `:10`, `:605`, `:764`, `:878-887`, `:6228`, `:11761`, `:11764`, `:12000`, `:12679`, `:12764`, `:13185`, `:13789`.
- The `loadHMHGame` assertions at `tests/hmh-boss-and-level2-world-art.test.mjs:56-57` and `tests/hmh-wo110-boss-redo.test.mjs:57-60`. Both pass and are not ledgered.
- `games/hard-money-heroes/main.mjs:18-19`.
- `scripts/smoke-portal-flow.mjs:130-132, :185-188, :225-262`, which is part of `ship:gate`.

Per-folder extras:
- **animated-roster:** `canonical-actors.mjs`, `wave3-art-matrix.mjs`, `hmh-wo103-114-continuation.mjs`, `hmh-wo119-pixellab-aaa-wave.mjs`, `hmh-character-config.mjs:104-128` (asserted by a test), 5 design scripts, and about 22 importing tests.
- **final-animation-completion:** `syntax-check.mjs:624-625, 1010`, the editor generated library, and `hmh-encounter-visuals.mjs:258-264`.
- **final-boss-animations:** `syntax-check.mjs:629` and `global-art-census.mjs`.
- **curated-level-art:** `hmh-ground-plan.mjs:27`, a static import that is eagerly bundled; also 2 tests.
- **pixellab-calibration:** `verify-generated-assets.mjs:10-11, :202-265` (inside `vercel:build`), the editor test at `:128, :138`, `hmh-anchor-set.mjs:125-130`, and `smoke-pixellab-calibration-browser.mjs` together with `syntax-check.mjs:599`.
- **level-environment:** `build-asset-footprints.mjs:6`.

**Ledger overlap.** No ledger entry names these folders, but tolerated failures sit in files that import them: boss-and-level2 (2), wo110 (2), curated-level-art (1), terrain-polish (1), final-animation-completion (2), plus 19 in files that import `hmh-animated-roster`. Re-ledgering is required.

**Gate-safe subset**
- `complete-animations-ledger.json`. It is public and exposes raw PixelLab job IDs.
- The wave-2 jobs JSON.
- The isometric jobs JSON plus 10 `metadata.json` files.
- `hmh-curated-level-art/{hmh-curated-level-art.json, hmh-curated-ground-art.json, hmh-curated-ground-art.mjs, hmh-curated-ground-runtime.json}`.
- The JSON twins of the final-animation and final-boss manifests.

**Recommendation.** Do this unit together with the separate `retire-canvas-combat` branch.

### L2-07 Legacy canvas Level-1 world data

**Paths:** `hmh-coherent-world` (20 JSON/MJS), `hmh-level-one-ground` (6), `hmh-wo102-megaprops` (3 PNGs, including `processed/`). All are under `apps/portal/assets/generated/`.

**Why it is dead.** `main.js` imports them statically, adding about 50 KB of eager JS, but only the dead canvas loop reads them.

**References to remove**
- `main.js:66-67, :76-79, :125-128, :155, :12702-12704, :12862`.
- `hmh-ground-plan.mjs:16-24`, `hmh-level-one-ground.mjs:1-6`, `hmh-ground-selection.mjs:1`.
- `hmh-level-one-visible-runtime.mjs:83-136` plus its stamps.
- `hmh-level-one-world-v3-gameplay.mjs:417, :435`.
- `syntax-check.mjs:444, :619-634, :657`.
- About 20 tests.
- `.gitignore:60-68`.

**Ledger overlap.** 13 coherent-world entries and 3 level-one-ground entries (ledger lines 115, 120, 125) must be re-ledgered.

**Caution.** `hmh-wo119-pixellab-aaa-wave.mjs:44` reads `level1-reference-style/candidates/level1-pixellab-candidates.manifest.json` at module import time. Deleting it breaks the whole wo119 test file. I confirmed this by simulating the deletion with a preload that hides the file.

**Gate-safe subset.** 11 coherent-world JSON twins and resume ledgers plus 2 level-one-ground JSON twins.

**Recommendation.** Only as part of the canvas-combat retirement.

### L2-08 Legacy enemy-roster atlases for the 6 native-migrated actors

**Paths:** `apps/portal/assets/generated/hmh-reboot-enemy-roster/{forkrunner,liquidator-agent,whale-enforcer,gas-bomber,validator-cultist,the-liquidator}`.

**Why it is dead.** `enemyRosterAsset()` sends every actor except bagholder to `hmh-native-roster`, and there is no fallback. The runtime would also reject these JSONs (no `sourceModel`).

**References to remove**
- `tests/hmh-reboot-enemy-role-animation-profiles.test.mjs:22-26, :76-81, :121-135`.
- `tests/hmh-reboot-enemy-role-damage-profiles.test.mjs:14, :60-63`.
- `tests/hmh-reboot-enemy-role-detail.test.mjs:91, :150`.
- `tests/hmh-reboot-cycle-007-art.test.mjs:61`.

Repoint these to the native-roster JSON or retire them. Also change `hmh-enemy-roster.json` and `run-hmh-enemy-roster-pipeline.py`, because a pipeline rerun recreates these folders. Finally, `hmh-enemy-roster-metrics.json` (`totalFrames 1368`, asserted at `hmh-reboot-production-asset-qa.mjs:289-292`) must be regenerated or changed.

**Gate-safe subset.** The 6 atlas PNGs and 6 contact sheets (7.7 MB). Nothing reads them: no runtime, test, QA or `assets:verify`.

### L2-09 Superseded hero-selector atlas

**Path:** `apps/portal/assets/generated/hmh-reboot-hero-selector`.

**Why it is dead.** `main.js:32` now imports `HMH_HERO_PORTRAITS` under the old name.

**References to remove**
- `tests/hmh-reboot-hero-selector-render.test.mjs`, which also pins `BLENDER-ATLAS-PIPELINE.md:242-246`.
- `tests/hmh-selector-packed-sources.test.{mjs,py}`.
- `hmh-reboot-production-asset-qa.mjs:12, :226-260`.
- `apps/portal/src/generated/hmh-reboot-hero-selector-atlas.mjs`.
- The selector pipeline (`package.json:25-26`). Careful: `hmh-hero-portraits.py` imports its runner, and `portraits.json` hashes it.
- `syntax-check.mjs:856-857, :1043`.

**Owner decision:** this retires a Blender pipeline.

### L2-10 AAA PixelLab quality-wave ledger

**Path:** `apps/portal/assets/generated/hmh-aaa-pixellab-quality-wave`.

**Reference to remove:** `tests/hmh-wo119-pixellab-aaa-wave.test.mjs:82` (one `existsSync`, passing and not ledgered). The generator tolerates a missing file.

**Ledger overlap.** The 2 tolerated failures in that test file are unrelated to this folder.

### L2-11 Retired partner-ad art

**Path:** `apps/portal/assets/ads`.

**Reference to remove:** the dead `.ad-banner*` block at `apps/portal/styles-arcade-polish.css:1049-1162`. Since 6fe83eb6 no element matches it. The 2 SVGs have zero references.

### L2-12 Legacy WO-65 visual baselines

**Path:** `docs/testing/VISUAL_BASELINES/hmh-level-1`.

**Why it is dead.** Only the harness uses these files, and the handoffs document that harness as broken for the reboot. The current gate is `visual:reboot`.

**References to remove**
- `scripts/visual-regression.mjs`.
- `package.json:49-50`.
- `ship-gate.mjs:34`.
- `tests/visual-regression.test.mjs:21, :77`.
- `tests/hmh-level-one-world-v3-gameplay.test.mjs:256`.
- The command-name strings in `hmh-wo111-114-ship-candidate.mjs:68, 92`, which are asserted by tests.

**Gate-safe subset.** `seed-1337-spawn.png` and `seed-1337-stationary-repeat.png`, orphaned since 2026-07-09.

### L2-13 World-blueprint-v3 previews

**Path:** `docs/game-design/assets/hmh-level-1-world-blueprint-v3`.

**What refers to it.** Only the write-only generator `build-hmh-level-one-world-blueprint-v3.py` and two unlinked docs. No gate edit is needed.

**Optional edit.** Remove the `ASSET_DIR` writes from the generator (lines 20 and 811-857), or a manual `assets:hmh:level1:world-v3` run re-adds 8 PNGs.

**Owner note.** `approval-samples.png` and `seam-followup-samples.png` cannot be regenerated from the repo; the raw sources are in the private vault.

---

## 3. KEEP

These folders are referenced by runtime code, by passing release-gate tests, or by policy.

| Path | Reason |
|---|---|
| `apps/hmh-reboot/assets/source` | About 40 gate tests read it. Only the tripo-selector subset is L2-01. |
| `.../source/blender` | About 25 gate tests read the manifests, and a test hashes `hmh-held-weapons.blend`. |
| `.../source/models` | Native-roster adoption and production QA hash real LFS bytes. These are the Vercel Git-preview LFS failures. |
| `.../models/tripo-gameplay` | The 4 hero source blends. Hero-pilot test, selector `--check` and native-roster QA (real bytes). |
| `.../models/native-enemies` and `bagholder-rusher`, `forkrunner`, `liquidator-agent`, `the-liquidator`, `whale-enforcer`, `gas-bomber`, `validator-cultist` | Each blend is SHA-checked by `hmh-native-roster-adoption` and production-asset QA. Bagholder's provenance files are hash-checked, and bagholder is the base source for 4 actors. |
| `.../source/terrain` | The terrain-source-provenance test hashes all 9 files, and the bakery authenticates them. |
| `.../source/reference`, `reference/heroes` (+4 hero folders), `reference/weapons` (+11 weapon folders) | The intake, validation and no-smudge tests read every PNG and ledger (hard-coded counts of 8/11/19). DECISIONS.md:43 designates them design authority. |
| `apps/chikun/assets/source`, `.../open-air` | `chikun-open-air` and `character-sheet` tests hash the open-air blends and `native-provenance.json`. Orphans are in PA-06. |
| `apps/chikun/assets/source/ground-sky` | The only editable source for the shipped `chikun-ground-props-v1`. No gate reads it; keep it for source preservation. |
| `assets-source/hmh-barriers`, `assets-source/hmh-silver-coin` | Their `.blend` files are SHA-bound by `hmh-native-barriers` and `hmh-silver-drops` tests. |
| `apps/portal/assets/audio`, `audio/playlist`, `audio/sfx` | Live runtime audio. `assets:verify` checks the playlist. |
| `apps/portal/assets/video` | Splash and promo MP4s, posters, and the `og:image` are live. |
| `apps/portal/assets/brand` | The horizontal logo is the header, `og:image` and WalletConnect icon. |
| `apps/portal/assets/share-cards` | Serverless `og:image` art, declared in `includeFiles`. The badge copies are tested to be byte-equal. |
| `apps/portal/assets/stacked-cabinet`, `stacked-mode-select` | Live STACKED cabinet and banners, with tests. |
| `apps/portal/assets/reference` | 3 sheets are existence-tested at `arcade-core.test.mjs:2432`. |
| `apps/portal/assets/hard-money-heroes`, `cabinet`, `cabinet/rotation`, `cabinet/source` | The live HMH rotating cabinet. `assets:verify` requires the manifest, the rotation frames and `source`. |
| `generated/achievement-badges`, `generated/hmh-achievement-atlas` | Catalog badge art (profile, results, NFT metadata, share cards) and tier/avatar emblems. |
| `generated/hmh-banners`, `generated/hmh-key-art` | Live mode-select, leaderboard and key-art images. |
| `generated/hmh-barriers`, `hmh-silver-coin`, `hmh-world-decals`, `hmh-world-design`, `hmh-terrain-tiles` | Loaded at every HMH boot, and hash-tested. |
| `generated/hmh-held-weapons` (+4 hero folders) | Weapon pages lazy-load on equip. The gate hashes every file. |
| `generated/hmh-reboot-production-heroes` (+4 hero folders) | Base hero atlases load on every run and are pinned by tests. |
| `generated/hmh-hero-motion` (+4 hero folders) | Motion page for the selected hero. `hmh-hero-motion.test` hashes all 8. |
| `generated/hmh-hero-portraits` | Live character-select portraits. |
| `generated/hmh-native-roster` (+6 actor folders) | Live enemy and boss atlases. Forkrunner is on the startup gate. |
| `generated/hmh-reboot-enemy-roster`, `.../bagholder-rusher` | The bagholder atlas loads every run, and the gate reads the metrics JSON. |
| `generated/hmh-reboot-tripo-props`, `.../items` | Atlas pages load at startup, and `tripo-21..32` are live card icons. |
| `generated/hmh-reboot-authored-props`, `.../items` | The atlas loads every boot. 15 item icons are live and existence-tested. |
| `generated/hmh-reboot-mannequin` | Reachable in shipped code through `?pipelinePilot=1`. The Blender-pipeline tests hash it. |
| `generated/hmh-production-art-pass` | `ui/pause-menu-panel.png` is live via `styles.css:2924` (browser-confirmed on `/profile`). |
| `generated/sliced` | 6 icon PNGs load on every portal page, and `assets:verify` pins all 76. |
| `generated/chikun-cabinet`, `chikun-game`, `chikun-mode-select` | Live Chikun cabinet, fallback sprites (sw.js precache) and banners. |
| `generated/chikun-flight-v2`, `.../audio` | The 7 live audio cues and the sw.js-precached poster. |
| `generated/chikun-flight-v3`, `chikun-ground-motion-v1`, `chikun-ground-props-v1`, `chikun-open-air-v1` | The live Chikun character, ground and prop art, hash-tested. |
| `docs/game-design/assets` | 11 contact sheets are `existsSync`-gated by passing, unledgered tests. |
| `docs/art/anchors`, `docs/art/wo76`, `docs/hmh-reboot/assets` | Read by `hmh-anchor-set` and `commando-concepts` tests. |
| `docs/chikun` | `CHARACTER-SHEET-PIPELINE.md` is the only Chikun sheet-pipeline runbook. |

---

## PARTIAL: large unreferenced or runtime-dead files inside KEEP folders

These counts are additive. Zero-edit subsets that sit inside list 2 folders are **not** repeated here; see the list 2 table.

### No code or test edit needed (26,707,461 B, 158 files)

| ID | Files | Bytes | Note |
|---|---|---:|---|
| PA-06 | `apps/chikun/assets/source/{Chikun-Ragdoll-Parts.blend, Chikun-Sheet-Animations.glb, Chikun-Flight-Rig.blend, Chikun-Superman-Animations.glb, Chikun-30-Animations.glb}`, `ground-sky/{eagle,hawk,pelican,shiba}-motion.blend` | 15,088,729 | Only manual Blender scripts or handoffs mention them. **Owner decision** (source art). Plain git blobs. |
| PA-01 | `apps/portal/assets/video/arcade-promo-loop.gif` | 4,174,352 | Only the docs/cleanup reports mention it; publicly deployed. Regenerate `repo:cdn-gate` docs afterwards. |
| PA-04 | `generated/chikun-flight-v2/*.webp` (18 clips, **not** `poster.webp`) + `character.json` | 2,054,486 | The runtime character base is v3. **Keep `poster.webp`:** `sw.js:35` precaches it, and `addAll` is all-or-nothing. |
| PA-11 | `docs/art/wo76/` 6 PNGs (storefront all-20 QA, bank-deco contact sheet, storefront contact sheet, final-anchor-pass, approved-anchor-set.png, reroll-qa) | 1,449,641 | Only `ANCHOR_SET.md` and wo76 markdown mention them, and `docs:links` does not check those. |
| PA-08 | `generated/hmh-reboot-authored-props/hmh-authored-props-contact-sheet.png` + 92 of 107 `items/*.png` | 1,094,180 | Nothing reads them. Keep the 15 live card icons. The pipeline regenerates these. |
| PA-10 | `docs/game-design/assets/` 18 files outside blueprint-v3 and the 11 gated sheets | 939,032 | Referenced by docs, write-only generators and a dead editor URL. |
| PA-14 | `docs/chikun/chikun-sheet-clips.png`, `UPGRADE-BACKLOG.md` | 508,780 | Write-only output, and an orphan backlog. `CHARACTER-SHEET-PIPELINE.md:83` would dangle. |
| PA-12 | `apps/portal/assets/reference/lester-reference-sprites-01/02.png` | 435,158 | Byte-identical duplicates of the sheet files, so no git saving. Repoint `arcade-core.mjs:213-214` (unread strings). |
| PA-05 | `generated/chikun-flight-v2/audio/air.wav`, `audio/manifest.json` | 384,851 | Deliberately never fetched (a test guards this). |
| PA-13 | `assets-source/hmh-barriers/barrier-library.blend` (v1) | 158,493 | Superseded by v2; its SHA is referenced nowhere. |
| PA-07 | `hmh-reboot-enemy-roster/bagholder-rusher/bagholder-rusher-roster-contact-sheet.png` | 155,905 | Written by the pipeline only. |
| PA-03 | `generated/chikun-mode-select/chikun-mode-select-art.webp` | 142,716 | Swapped out in 54aab311; only a handoff mentions it. |
| PA-09 | `hmh-achievement-atlas/hmh-achievement-atlas-manifest.json` (JSON twin), `...-contact-sheet.png` | 72,549 | Every reader uses the `.mjs`. The contact sheet is only in WO-90 cert data. |
| PA-02 | `apps/portal/assets/brand/lesters-arcade-logo-stacked.png` | 48,589 | Zero references in any history. |

### Needs a test, QA or verify edit (22,506,253 B, 67 files)

| ID | Files | Bytes | Required edit |
|---|---|---:|---|
| PA-17 | 4 × `hmh-reboot-production-heroes/*/…-contact-sheet.png` | 13,285,971 | Runtime-dead but publicly deployed. Edit `hmh-production-heroes.json` `output.contactSheet`, the hero-pilot and unlockable-pilot tests, and `hmh-reboot-production-asset-qa.mjs:210-211`. Alternatively keep them and exclude them from the deploy. |
| PA-16 | 4 × `hmh-held-weapons/*/…-contact-sheet.png` | 5,672,383 | Edit `tests/hmh-reboot-held-weapon-atlas.test.mjs:330` and QA `:347-351`, or exclude them from the deploy. |
| PA-15 | `hmh-reboot-tripo-props/labelled-contact-sheet.png` + 44 unrequested `items/tripo-{01..20,33..56}.webp` | 2,109,926 | `hmh-tripo-published-image-qa.py` hash-verifies all 60 files, `tests/hmh-tripo-production-asset-qa.test.mjs:34` expects `filesVerified===60`, and `assetCount 56` is hard-coded in the QA and the runtime validator. Update the producers too. |
| PA-18 | 12 × `generated/sliced/level{1,2,3}-*.png` parallax layers | 871,790 | Edit `asset-slice-report.json`, the `>=70` threshold in `verify-generated-assets.mjs` (the count would become 64), and `arcade-core.test.mjs:1859`. **These cannot be regenerated:** 6 of the 7 slicer source sheets are missing. |
| PA-19 | `hard-money-heroes/cabinet/source/Hard-Money-Heroes-ArcadeCabinet.png` | 395,035 | Edit `verify-generated-assets.mjs:154` and the manifest `source` key (`.json` and `.mjs`), plus the ingest `SOURCE_OUT` and `optimize-assets` entries. |
| PA-20 | `generated/hmh-production-art-pass/hmh-production-art-pass.mjs` | 171,148 | Same edits as L2-06: `loader.mjs:38`, the `main.js` consumers, 2 loader tests, and `smoke-portal-flow.mjs`. Keep the PNG. |

---

## Suggested slice order for the integration owner

1. **Slice A (no code):** delete list 1, 12.9 MB. Add the recommended same-commit retirements: the ground-audio generator plus its `syntax-check:951` entry, the sprite-expansion script and doc, and the `mobile-worlds-20260914.md` doc. Add any PA "no edit" rows the owner approves; PA-06 and PA-01 need an explicit owner OK. Then run the full gate: `npm run test:release`, `check`, `assets:verify`, `build`. Recertify, because served files change.
2. **Slice B (L2-01, 150 MB):** delete the Tripo selector chain, and edit `.gitattributes:27-28` and `BLENDER-ATLAS-PIPELINE.md`. No runtime change.
3. **Slice C (small edits):** L2-02, L2-10, L2-11, L2-12, L2-13.
4. **Slice D (runtime source change, recertify):** retire the level editor (L2-05), then L2-03 and L2-04, and the boot-splash poster.
5. **Slice E:** L2-06 and L2-07, together with the existing retire-canvas-combat work, including a re-ledger of `LEGACY-TEST-RETIREMENT.json`.
6. **Slice F (owner decisions):** L2-08 (repoint the role tests to native-roster), L2-09 (selector pipeline), and deploy-exclusion versus deletion for the PA-16 and PA-17 contact sheets.

Treat any history rewrite or LFS purge as a separate owner-approved operation, not part of these slices.

## Side findings (not deletions)

- **sw.js poster.** `apps/portal/sw.js:35` precaches `chikun-flight-v2/poster.webp`, while runtime and unlockables use the v3 poster. Keep v2's poster until `sw.js` changes.
- **Dangling runtime strings.** These point at files that do not exist:
  - `main.js:866-869` (4 missing `hmh-loading-keyart-*.jpg`)
  - `arcade-core.mjs:537` (`hmh-keyart-bg.jpg`, on a dead path)
  - `styles.css:3236, :3450, :3454` (3 missing UI PNGs)
  - `scripts/hmh-blender/build-hmh-native-roster.py:219` (missing `hmh-native-weapons.json`)
- **Publicly served PixelLab data.** `hmh-pixellab-sprite-expansion-500` jobs, `hmh-complete-animations` ledger and the `hmh-aaa-pixellab-quality-wave` ledger are all served publicly. They carry account usage and raw job IDs.
- **Vercel Git previews.** They fail because `hmh-native-roster-adoption` and production-asset QA hash real LFS bytes of the native-enemy and tripo-gameplay blends. Those folders are KEEP.
- **LFS clean-clone check.** `hmh-source-model-lfs-check --clean-clone` has `MANIFEST_PATHS` without `hmh-native-roster.json`, so it would flag the six native blends.
