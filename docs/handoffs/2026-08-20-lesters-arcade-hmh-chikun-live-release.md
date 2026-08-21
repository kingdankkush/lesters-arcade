# Lester's Arcade / HMH / Chikun — 2026-08-20 live-release handoff

Date: `2026-08-20 PDT`
Current implementation boundary: `aa396ee54a49406ddc29842278847eb8b607fa7e`
Public site: https://lestersarcade.io
Settlement: `SETTLEMENT_LIVE=false`

This handoff supersedes the live checkpoint, current-status, and first-action instructions in the 2026-08-13 and earlier handoffs. Keep those documents for detailed cycle history and architecture rationale.

## 1. Certified Git and runtime identity

- Integration branch at release: `claude/publish-integration`
- Remote `main` and integration branch were read back at `aa396ee5`.
- Certified runtime range base: `5bd3dfe9efc9a91a0d3c3746848d36e7b59e6b4e`
- Exact binary range SHA-256: `6d992c4abdd63b1f7100e527f84181e31b1281e61a6c85c21e3ebc182bfb9029`
- Exact review: hash-guarded independent content review, `FINDINGS: NONE`, `VERDICT: PASS`.
- The inactive local `main` pointer remained at `5bd3dfe9`; do not use that local pointer as remote truth without fetch.

A later documentation-only commit cannot name its own final SHA. Treat `aa396ee5` as the served runtime implementation boundary and keep any later docs commit/deployment identity separate.

## 2. Production and rollback

- Verified runtime production ID: `dpl_7k35eG9qYnKShLXJ5ySfV5fWJYRv`
- Immutable runtime URL: https://lesters-arcade-p8lo55m7r-justin-agent-projects.vercel.app
- Public alias: https://lestersarcade.io
- Immediate rollback ID: `dpl_DmNJPPf1q7SeG79XcgZComK32uzk`
- Rollback URL: https://lesters-arcade-9ml2rtdvk-justin-agent-projects.vercel.app
- Runtime cache marker: `lesters-arcade-v22-hmh-landscape-character-start`
- Output root: `apps/portal`

Exact production proof:

- `styles.css` SHA-256: `d4167aaf6a0ebc5e557c6d9fad5a1647844fa1065c6101db6dc20ece835e116f`
- `sw.js` SHA-256: `116a350bab8afbe308001ccf7aabf8dc688972d459c1ec5f88c2bea7623d8a0b`
- local, immutable deployment, and public alias matched for both files;
- `/`, `/hmh-reboot/index.html`, and `/play/chikun` returned HTTP 200;
- Vercel alias inspection resolved to the same runtime production deployment.

A later docs-only push may create a newer runtime-identical deployment. Re-inspect the alias; do not rewrite this historical runtime release record.

## 3. Hard Money Heroes

Current direction remains deterministic PixiJS 8.19.0 top-down 2.5D authored run-and-gun.

Latest closed cycle: **068**.

Cycle 068 closes the existing timed-effect identity seam:

- Time Dilation: clock-orbit silhouette and cool activation cue;
- Berserk Candle: spiked-ring silhouette and warm activation cue;
- both derive from the same immutable active-effect snapshot as HUD/accessibility truth;
- reduced motion stops pulsing motion;
- identity remains projection/audio only.

Final runtime evidence:

- release `2,279 / 2,228 / 51 / 0`;
- syntax `361 JS + 49 Python`;
- HMH entry `395,325 / 1,050,000` bytes;
- visual 12/12 exact zero delta;
- five-profile local and production browser certification PASS;
- mobile controls 4/4;
- desktop/mobile p95 `7 / 7 ms`;
- assets/security/Web3 source gates PASS.

No new power-up should ship without its source/art/provenance/readability packet.

## 4. Chikun's Escape

Production cabinet remains `0.5.0` / `canvas-runtime-v3`, public playable and Ranked-eligible.

Shipped and verified:

- deterministic 60 Hz core and parent replay;
- parent-owned daily Free seed;
- same-seed projection-only local ghost;
- seek-safe animated replay viewer;
- bounded 8-voice audio and four-step catch-up;
- 44 px start, HUD, pause, and result controls;
- reduced-motion flash suppression;
- 9:16 and 16:9 production certification;
- Ranked/Free desktop/mobile smoke with frame p95 `7–7.1 ms`;
- Ranked records profile/score state; Free writes neither.

Still open:

- written creator art rights and final Louie/Justin QA;
- `devWallet` and revenue routing;
- replacement of temporary mode-selection art;
- rendered share-card images;
- deterministic new obstacle family or Free-only practice modifiers as the next code-first candidate.

## 5. Lester's Arcade platform

- Parent retains wallet, profile, session, leaderboard, achievement, analytics, and settlement authority.
- Cabinet status documentation gate is offline/deterministic.
- Production marker gate is network-backed; local README/service-worker parity is now separately test-gated.
- The 844×390 HMH level-intro path keeps Begin Level fully contained and hides the jukebox only for that short intro state.
- `hermes/u10-portal-modularization` has five patch-equivalent commits already present in current `main`; do not merge it again.

## 6. Next work and approval gates

1. **Generated-art Phase 2 is locked.** Do not research, generate, upload, spend credits, or start Tripo/PixelLab work until Justin explicitly says `go`.
2. **Chikun code-first candidate:** one deterministic obstacle family with a bounded telegraph, or one Free-only practice modifier. Write RED replay/authority coverage before implementation.
3. **HMH code-first candidate:** bounded instrumentation or an already-authored seam that does not require a new asset. Do not add a power-up with placeholder art.
4. **Cleanup:** rejected dirty files, stale marker-only `REBASE_HEAD` files, branches, and worktrees still require separate cleanup approval.
5. **Web3:** no contract, wallet, settlement, testnet/mainnet, or LitVM write without separate HALT approval.

## 7. Working release sequence

```bash
git fetch origin --prune
git status --short --branch
git rev-parse HEAD origin/main origin/claude/publish-integration
npm run check
npm run test:release
npm run visual:reboot
# serve apps/portal on 127.0.0.1:8791 before browser certification
npm run certify:hmh:browser
npm run smoke:hmh:mobile-controls
npm run assets:qa:hmh-reboot
npm run design:security-audit
npm run design:web3-audit
npm run smoke:portal:e2e
npm run smoke:hmh:performance
npm run docs:cabinets
npm run docs:production
npm run docs:links
```

Run browser batches serially. `visual:regression` remains broken for the reboot and is not release evidence. Stop task-owned listeners. Exact-review every candidate. Website publication approval never authorizes Web3 writes.
