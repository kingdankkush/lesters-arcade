# Lester's Arcade — checkout reconciliation and the generated-art pipeline

Written 2026-08-19 by Claude Code. Every branch and merge fact below was measured that day.
This file is untracked in whatever checkout you found it in; commit it onto the integration
branch once §1 is settled.

---

## 1. Reconciliation — the answer is better than it looks

Twelve checkouts exist across three roots, on eleven branches, in four agent namespaces
(`claude/`, `hermes/`, `grok/`, plus `feature/` and `chore/`). That looks like a mess. It is
mostly already resolved.

**`claude/publish-integration` at `221bf366` is the authoritative tree.** It is **12 commits
ahead of `origin/main` and 0 behind**, and it is where today's consolidation happened: it
landed the PixelLab sprite pipeline, the Chikun daily seed / same-seed ghost / animated replay
viewer, and the Liquidator upgrade benchmark, then added publish-status and doc-drift gates.
Its README carries a continuation table pointing at the gate-verified commit `9205ad08`, where
the release ledger measured 2,276 = 2,225 + 51 expected, 0 unexpected.

Lives at `C:\Users\just_\.buzz\REPOS\Lesters-Arcade-integrate`.

### Merge status, measured with `merge-base --is-ancestor` against `221bf366`

**Already merged — nothing to recover:**

| Branch | Tip |
|---|---|
| `chore/pixellab-sprite-expansion-500` | `23f10525` |
| `hermes/hmh-world-onboarding` | `cd39b567` |
| `grok/wave11-liquidator-build-matrix` | `1c5dfee6` |
| `grok/wave11-crit-upgrade-benchmark` | `b1834262` |
| `grok/chikun-daily-challenge` | `dfb87808` |
| `claude/cabinet-status-drift-gate` | `6dbab610` |
| `feature/chikun-replay-vfx-wave` | `43ef6c99` |
| `reboot/hmh-aaa-continuous` | `b793f549` |

**Not merged — decide on each:**

| Branch | Tip | Subject |
|---|---|---|
| `hermes/wave11-crit-liquidator-benchmark` | `f3a1c2c8` | docs(hmh): close Cycle 062 crit benchmark evidence |
| `hermes/production-doc-drift-gate` | `bf968a54` | test(docs): detect production marker drift |
| `feature/chikun-public-playable` | `aee74714` | feat(chikun): add replay rhythm and impact polish |

The first two look like evidence and gate work that probably should land. The third is Chikun
and may be deliberately parked. **Do not merge any of them blind** — check whether the
integration branch already contains an equivalent change under a different commit, since the
crit benchmark and the doc gate both have near-twins in the merged set.

### Uncommitted work at risk: 37 files across four checkouts

| Checkout | Branch | Dirty files |
|---|---|---|
| `Desktop\Projects\Web3 Gaming\Lesters-Arcade-Chikun` | `feature/chikun-public-playable` | **22** |
| `Desktop\Projects\Web3 Gaming\Lesters-Arcade-hermes` | `hermes/hmh-world-onboarding` | **8** |
| `.buzz\REPOS\Lesters-Arcade-cabinet-status-gate` | `claude/cabinet-status-drift-gate` | **6** |
| `Desktop\Projects\Web3 Gaming\Lesters-Arcade` | `chore/pixellab-sprite-expansion-500` | 1 |

Two of those branches are fully merged, which means **whatever is uncommitted in them is the
only copy that exists.** Triage all 37 before any cleanup, deletion, or branch pruning.

### The stale-checkout trap, still live

`C:\Users\just_\lesters-arcade` sits on `reboot/hmh-aaa-continuous` at `b793f549` from
**2026-08-03**. Origin moved that branch on 2026-08-18. Its commit is merged so nothing is
lost, but opening that folder shows a tree fifteen days behind reality. This has already
caused a false "nothing was updated" conclusion once on this project. **Always
`git fetch && git status` before judging state, and prefer the integration checkout.**

### Recommended sequence

1. Triage the 37 uncommitted files. Commit what matters onto its own branch.
2. Rule on the three unmerged branches.
3. Run the gate suite on the integration branch: `npm run test:release`, `visual:reboot`,
   `certify:hmh:browser`, `smoke:hmh:mobile-controls`, `assets:qa:hmh-reboot`,
   `design:security-audit`, `design:web3-audit`, `smoke:portal:e2e`, `smoke:hmh:performance`.
   Legacy `visual:regression` is broken for the reboot; do not cite it.
4. Merge to `main` and push. **Promotion to production is owner-gated** and stays that way.
5. Prune the dead checkouts, last.

Two standing environment facts: `certify:hmh:browser` needs a server already running at
`127.0.0.1:8791` serving `apps/portal`, not `dist`. And Vercel's Security Checkpoint now 403s
all automated clients on lestersarcade.io, so production verification happens in a real
browser pane, not headless.

---

## 2. The art pipeline: ChatGPT → Tripo → Blender → atlases

The goal is right. Character sheets driving rigged 3D models driving better atlases is a real
upgrade over procedurally assembled geometry, and it directly attacks the 160px resolution
problem that makes the select-screen turntables read as dated.

Six things stand between here and there. None is fatal; all are cheaper to solve before
production than after.

### 2.1 You already have a sprite expansion pipeline in flight

`chore/pixellab-sprite-expansion-500` is merged, and `docs/handoffs/pixellab-access.md` exists.
**Decide up front whether Tripo replaces PixelLab, complements it, or duplicates it.** Two
parallel generated-art pipelines competing for the same atlas budget is how both end up half
finished. Read that handoff first.

### 2.2 Reproducibility is a shipped gate, and generated meshes break it

`assets:qa:hmh-reboot` fails when `reproducibleVerified` is false. The enemy roster gate
tolerates ±1 LSB on at most 8 subpixels per frame; the props pipeline is still exact. Those
gates assume geometry is **derived from a script**, so a cold rebuild reproduces it.

A Tripo mesh cannot be re-derived. Regenerating gives a different model.

**So change what "reproducible" means for this class of asset.** The generated mesh becomes a
committed input artifact with a recorded hash — stored in the repo or in
`lesters-arcade-vault\hmh-art` — and the render stays deterministic *from that fixed input*.
The gate then verifies "same mesh in, same frames out", which is both true and enforceable.
Write that policy down before the first model lands, the same way the ±1 LSB roster policy was
written down after three flaky cold rebuilds.

### 2.3 The light rig is the single source of truth, and Tripo will fight it

`scripts/hmh-blender/hmh-light-rig.json` drives all four scene scripts through
`shared_light_channels(family)`, and `tests/hmh-reboot-shared-art-direction.test.mjs` fails the
build if any pipeline hard-codes a light energy or colour again. The look is cool key, cool
fill, one warm gold rim.

Tripo returns PBR materials and baked texture maps authored under neutral studio lighting.
Dropped in as-is they will visibly diverge from everything already shipped. **Strip or override
imported materials and render through the shared rig.** Treat Tripo's output as geometry plus,
at most, a base colour — not as a finished look.

### 2.4 The 55° camera punishes models authored for a front view

Two constraints already paid for in render cycles:

- The 55° camera **turns Y depth into screen height**. A part with large Y extent projects as a
  tall band that hides what is behind it in Z.
- **Top-down readability comes from plan footprint, not elevation.**

Generative 3D optimises for the three-quarter hero view a human judges it by. That is the wrong
view. **Judge every candidate model in the actual game camera before accepting it**, and expect
to re-concept rather than iterate when one fails — the driftwood-log took three passes before
being ruled atlas-only for exactly this reason.

Also: **facet, do not smooth.** Smooth-sphere silhouettes render badly in the Workbench enemy
pipeline; that has been established twice. Tripo produces smooth organic meshes by default.

### 2.5 The atlas budget is the real cost, and this does not reduce it

Moving heroes 160px → 256px needs roughly **2.5× the current 12.6MB hero atlas**, plus
multi-hour renders. That was already scoped as needing a budget renegotiation and its own
dedicated session. Better source geometry does not change that arithmetic. Plan the resolution
jump as its own slice, separate from the pipeline swap, so a failure in one does not block the
other.

When the new atlas lands, reuse `DIRECTION_BY_SIMULATION_INDEX` rather than inventing a second
direction convention. And **never block boot on art** — keep the fallback path working.

### 2.6 Rigging changes what the pipeline outputs

Today the pipeline renders frames per direction. A rigged model lets you pose per animation
state, which is the actual win — but it means defining the animation set (idle, run, attack,
hit, death, per direction), then baking frames deterministically from named poses. Define that
set before generating characters, because it determines how the model must be rigged, and
re-rigging a batch afterwards is the expensive mistake.

### 2.7 Rights

Hard Money Heroes ships commercially under a Litecoin and LitVM association. Confirm the
commercial-use terms for both the image generator and Tripo, and record the answer in the repo
alongside the asset hashes. Do this before a batch, not after.

---

## 3. Suggested first slice

Do not start with heroes. Start with **one enemy or one prop** and drive it end to end:
character sheet, Tripo model, material strip, shared-rig render, gate pass, in-game screenshot
at the real camera. That surfaces every problem in §2 at the cost of one asset instead of a
roster.

Prove the reproducibility policy red before trusting it — a gate that cannot fail is worthless,
and this project has already shipped one that passed with both fixes reverted.

---

## §1 closeout — 2026-08-19

Re-measured with `git fetch --all --prune` against `221bf366` before acting. Every
merge fact in §1 reproduced exactly. One branch §1 did not list is also unmerged:
`hermes/u10-portal-modularization` (`61799e8a`, 2026-08-05, 5 commits, portal route
extraction, temp worktree). It is untouched here and still needs a ruling.

Also corrected: **three** of the four dirty checkouts sit on fully merged branches,
not two. Only `Lesters-Arcade-Chikun` was on an unmerged branch, and that branch is
being dropped, so its uncommitted tree was at risk as well.

### The 37 uncommitted files

| Checkout | Files | Ruling |
|---|---|---|
| `Lesters-Arcade-hermes` | 8 | 6 recovered as `cb888c24`; 2 discarded |
| `Lesters-Arcade-Chikun` | 22 | 10 recovered as `748a182a`; 12 evidence PNGs left uncommitted |
| `Lesters-Arcade-cabinet-status-gate` | 6 | all 6 discarded, superseded |
| `Lesters-Arcade` | 1 | already landed on the integration branch, no action |

**Discarded, with reasons.** The hermes checkout's
`docs/testing/hmh-reboot-test-retirement-gate.json` is a `FAIL` ledger from a run
that died with exit `1073807364` (`0xC0000374`, Windows heap corruption) and never
produced a summary; committing it would overwrite a real `PASS` record with the
output of a crash. `.tmp-cycle68.html` is a scratch shell.

The cabinet-status-gate checkout holds an earlier, narrower twin of a gate that
already merged. Integration ships `scripts/cabinet-status-doc-drift-check.mjs`
(228 lines) wired to `docs:cabinets`; the uncommitted one is
`scripts/cabinet-status-drift-check.mjs` (182 lines) wired to the same script name.
The merged version governs README, AGENTS.md and the onboarding doc, reads local
manifests, and is offline and deterministic. The uncommitted one governs one
cabinet and asserts against `https://lestersarcade.io` over the network — which
cannot pass at all, because Vercel's Security Checkpoint 403s every automated
client on that host. Its doc edit is also a regression: it replaces the merged
canonical-state table with prose. Nothing in it is worth carrying forward.

The `Lesters-Arcade` checkout's `pixellab-hmh-sprite-expansion-500.py` edit — move
the `updated_at` / `desired_asset_count` writes out of `load_jobs` into `save_jobs`,
and stop `status()` from writing — is **already byte-identical to the integration
branch**. It landed under a different commit. No action.

### The three unmerged branches — all three: drop

| Branch | Ruling | Why |
|---|---|---|
| `hermes/wave11-crit-liquidator-benchmark` | **drop** | superseded twin |
| `hermes/production-doc-drift-gate` | **drop** | payload already merged |
| `feature/chikun-public-playable` | **drop** | duplicate commits, older base |

`hermes/wave11-crit-liquidator-benchmark` writes
`apps/hmh-reboot/src/critical-liquidator-benchmark.mjs` at 135 lines. Integration
already carries that exact path at 238 lines, from the merged
`grok/wave11-crit-upgrade-benchmark` (`b1834262`), covering the punish window, the
role check and add candidates, and exporting the tuning constants the hermes
version keeps private. Same path, same exported `CRITICAL_LIQUIDATOR_BUILD_IDS`,
strictly less coverage. Merging conflicts on that file and any naive resolution
regresses the benchmark.

`hermes/production-doc-drift-gate` is already landed in substance:
`scripts/production-doc-drift-check.mjs` and
`tests/production-doc-drift-check.test.mjs` are byte-identical to integration's,
and `docs:production` is already wired in `package.json`. The only delta is four
lines of `CYCLE-060.md` metadata naming a superseded branch and an older base, with
build and release numbers from a throwaway worktree. The branch tip is 15,642 lines
behind integration. Merging it buys nothing and rewrites a cycle record to be wrong.

`feature/chikun-public-playable` is the sharpest case. `git cherry` reports both of
its commits as unmerged, because patch-ids differ — but the *content* does not.
Diffing every Chikun path between `aee74714` and the merged `43ef6c99`, and between
`7034eaeb` and the merged `be4904ee`, returns empty both times. They are the same
work committed onto a different parent chain. Scoped against integration the branch
is 705 lines *behind* on Chikun alone: it predates
`apps/portal/src/chikun-daily-challenge.mjs`, `apps/chikun/src/replay-viewer.mjs`
and their tests. Merging it adds no Chikun content and risks reintroducing an older
base. Its value was entirely in the uncommitted tree, which is now `748a182a`.

Patch-id is not a safe basis for this call. Both twins had identical `--stat` and
different patch-ids; only a path-scoped tree diff settled it.
