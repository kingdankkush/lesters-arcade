# Lester's Arcade / HMH / Chikun — 2026-09-02 live-release handoff

Date: `2026-09-02 PDT`
Runtime implementation boundary: `200757e2092b4632903affde91df53a1b56ad72a`
Public site: https://lestersarcade.io
Settlement: `SETTLEMENT_LIVE=false`

This is the current canonical release handoff. It supersedes the live checkpoint, production identity, and next-action instructions in earlier handoffs while preserving their cycle history and architecture rationale. A later documentation-only commit cannot name its own final SHA; keep that docs commit separate from the runtime implementation boundary above.

## 1. Certified Git and candidate identity

- Release branch: `hermes/hmh-cycle-070-gameplay-ui-music`
- Remote release-branch/documentation head: `12150acc939e311754eeedb3352f79362e9c85f9`
- Deployed runtime implementation boundary: `200757e2092b4632903affde91df53a1b56ad72a`
- Audit/base source: `origin/main @ a17c37cd6cb39f74758bb4e9ae0bb56d2a1e07bb`
- Exact staged binary-diff SHA-256: `0d4d74cbdd07ea58d5bce81fbc0cd7ebad62cad53fefc935dcda8a63fc161b93`
- Independent exact-patch review: digest matched; verdict `PASS`; blockers `[]`.
- Runtime commit: [`200757e2`](https://github.com/kingdankkush/Lesters-Arcade/commit/200757e2092b4632903affde91df53a1b56ad72a)

Cycle 070 restores the portal-owned Lester's Arcade soundtrack during paused HMH gameplay without adding a second playlist owner or changing deterministic gameplay authority. Active combat hides the player; pause exposes seek, volume, queue, previous/next, play/pause, mute, shuffle, elapsed time, and duration. Desktop uses a non-overlapping sidecar; portrait mobile uses a contained launcher and drawer.

## 2. Preview, production, and rollback

- Verified Preview ID: `dpl_ZJy8VnfdXa3wKWEqdDpLoCPR1L9t`
- Immutable Preview URL: https://lesters-arcade-ku4ul7bsr-justin-agent-projects.vercel.app
- Verified production ID: `dpl_HAeCyfAG6SDK5x1LruxTMix2CBmQ`
- Immutable production URL: https://lesters-arcade-5eb8u80mm-justin-agent-projects.vercel.app
- Public alias: https://lestersarcade.io
- Immediate rollback ID: `dpl_GBtodAeLfrK7hVL3HWWaZ12RHFHs`
- Rollback URL: https://lesters-arcade-8jdteejx4-justin-agent-projects.vercel.app
- Portal cache token: `hmh-aaa-cycle-070-pause-deck`
- Service-worker namespace: `lesters-arcade-v23-hmh-pause-soundtrack`
- Output root: `apps/portal`

Vercel reported both the Preview and promotion-created production deployment `Ready`. Custom-domain inspection resolved `lestersarcade.io` to `dpl_HAeCyfAG6SDK5x1LruxTMix2CBmQ`. The retained rollback deployment remained `Ready` and still served the prior `lesters-arcade-v22-hmh-landscape-character-start` service-worker marker.

### Exact hosted artifact proof

Production SHA-256 values:

- `index.html`: `af72b0e4eaa84b05510518a043a416fd23e2a2f0eb646e66b080eb0dc7e780b5`
- `styles.css`: `941bece09b287a9cd9741df01e9aeeeee6ff947611f43532b2dca74ff00f00a1`
- `sw.js`: `049242fc30e5747256388335e6e7b901caf54786ee4efe1d17d0ec6811d5b9bb`
- `src/arcade-music-transport.mjs`: `67e7a067e268848d360f0acfda111e5036986f9743fbf803b32e735c19a93e5b`
- `dist/main.js`: `969516db92addb3fa4b870b443f8215d86a4410a92c662430cc122c803c2a8bb`
- `dist/hmh-reboot/game.js`: `e44d2ffcddaccf435d25f52b2c340e2420b458842185527bd3bf681d58595fbb`

The Preview and production hashes matched for CSS, service worker, transport module, portal bundle, and HMH child bundle. Preview `index.html` differed only by Vercel's injected feedback script; production HTML contained the certified cache token.

Hosted routing/media proof:

- `/`, `/play/hard-money-heroes`, and `/hmh-reboot/index.html` returned HTTP 200 with the expected HTML content type.
- `styles.css` returned CSS and the transport module returned JavaScript.
- a production playlist MP3 byte-range request returned HTTP 206, `audio/mpeg`, and the expected `Content-Range`.
- no failed production resource entries or media decode errors were observed in clean desktop/mobile browser sessions.

## 3. Hard Money Heroes Cycle 070 verification

Local exact-candidate gates:

- release ledger: `2,282` evaluated, `2,231` passing, exactly `51` accepted legacy failures, `0` unexpected;
- syntax: `361` JavaScript modules and `49` Python scripts;
- production build: PASS;
- HMH initial JS: `948.5 KB / 1.00 MB`, `76.9 KB` headroom;
- visual regression: 12/12 scenes unchanged, zero changed cells;
- HMH browser certification: desktop, ultrawide, tablet landscape, mobile portrait, and mobile landscape PASS;
- mobile controls: 4/4 profiles PASS;
- desktop/mobile performance p95: `7 / 7 ms`;
- asset QA, repository/CDN, documentation links, security `5/5`, third-party sandbox `3/3`, and Web3 source audit `9/9` PASS;
- Web3 live readiness remained intentionally PARTIAL `3/4` because on-chain registry/economy approval is still blocked;
- desktop and portrait portal E2E: 7/7 implemented flows each, with zero page/console errors;
- network/console audit: 4/4 scenarios, zero HTTP/request/page/console errors.

`forge test` was unavailable on this Windows host. The portable contract structure check passed, no contract file changed, and this website promotion did not deploy or mutate contracts.

### Production desktop proof

A clean guest session reached HMH Free Mode, selected Lit Commando, launched the live child renderer, and entered active gameplay. The child canvas rendered at `2520 × 1223`; active combat hid the soundtrack player. On pause:

- the player appeared and expanded to a `320 × 526` desktop sidecar;
- seek and all six transport buttons remained at least 44 px in both dimensions;
- the title changed from `Hard Money Heroes — Main Theme` to `Hard Money Heroes — Mempool Mayhem` after Next;
- trusted Play started the real MP3 (`paused=false`, advancing time, contextual volume `0.385`);
- resume hid the player while audio continued from the same track/time;
- the HMH child had one visible canvas and no media or failed-resource errors.

### Production portrait-mobile proof

At `390 × 844`, the clean guest flow reached active HMH gameplay. On pause:

- the collapsed launcher was fully contained at `[318, 26, 52, 52]`;
- the expanded drawer was fully contained at `[16, 26, 358, 414.8]`;
- seek and volume were 44 px high;
- all six transport actions were `51 × 45` px;
- Next changed the track title;
- resume hid the player;
- no failed resources or media errors were observed.

## 4. Preserved authority and Mainnet boundary

- Fixed 60 Hz simulation and four-step catch-up cap are unchanged.
- RNG, replay, movement, collision, damage, enemy state, progression, save schema, session authority, and run-summary authority are unchanged.
- The portal remains the sole shared-playlist owner; HMH continues to own combat audio and gameplay.
- Parent wallet/profile/session/leaderboard/achievement/analytics/settlement authority is unchanged.
- Production serves `export const SETTLEMENT_LIVE = false;`; a true export is absent.
- No wallet signature, transaction, contract deployment, LitVM write, Mainnet activation, or real-fund movement occurred.

Website publication approval never authorizes Web3 writes. Contracts, addresses, chain/operator/verifier configuration, economy policy, settlement activation, and real funds require separate explicit review and approval.

## 5. Chikun's Escape

Chikun remains `0.5.0` / `canvas-runtime-v3`, public playable and Ranked-eligible. Cycle 070 did not change Chikun gameplay or authority. Its known open items remain written creator art rights, final owner QA, `devWallet`/revenue routing, temporary mode art, and rendered share cards. No paid entry is live.

## 6. Next safe work

1. Complete Cycle 071 exact-index review, commit, Preview, promotion, and production verification.
2. Begin reconciled Phase 0 task P-4 as its own bounded cycle: move the existing enemy roster from Workbench to EEVE...[truncated]
3. Preserve and extend the direct canonical authority tests already present for movement, encounter director, enemy archetypes, Liquidator, progression, runtime performance, run summary, and long-run balance.
4. Build the external-model importer/skinned-action schema on a throwaway committed test fixture before accepting owner-supplied hero meshes.
5. Implement one bounded deterministic town-interaction slice after Phase 0 truth/plumbing: destructible `yard-container-lock`, then a single-use `yard-medbay-cache` with minimap/prompt feedback.
6. Keep generated-art uploads/paid credits and every Web3 write separately approval-gated.

## 7. Working release sequence

```bash
git fetch origin --prune
git status --short --branch
git rev-parse HEAD origin/main origin/hermes/hmh-cycle-070-gameplay-ui-music
rm -rf apps/portal/dist
npm run vercel:build
npm run visual:reboot
# serve apps/portal on 127.0.0.1:8791 before browser certification
npm run certify:hmh:browser
npm run smoke:hmh:mobile-controls
npm run assets:qa:hmh-reboot
npm run design:security-audit
npm run design:third-party-security
npm run design:web3-audit
npm run design:web3-live
npm run smoke:portal:e2e
PORTAL_E2E_EVIDENCE_DIR=.hermes/evidence/portal-e2e-mobile npm run smoke:portal:e2e:mobile
npm run smoke:hmh:performance
npm run audit:hmh:network
npm run docs:cabinets
npm run docs:production
npm run docs:links
```

Run browser batches serially, stop task-owned listeners, freeze and independently review every runtime candidate, promote only the exact verified Preview, and retain the prior production deployment as rollback.
