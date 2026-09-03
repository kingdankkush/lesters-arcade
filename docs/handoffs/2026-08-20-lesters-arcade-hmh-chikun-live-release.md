# Lester's Arcade / HMH / Chikun — 2026-09-02 live-release handoff

Date: `2026-09-02 PDT`
Runtime implementation boundary: `f232817782509c49ea6e2b6f76ed9a61f82fc4b9`
Public site: https://lestersarcade.io
Settlement: `SETTLEMENT_LIVE=false`

This is the current canonical release handoff. It supersedes the live checkpoint, production identity, and next-action instructions in earlier handoffs while preserving their cycle history and architecture rationale. A later documentation-only commit cannot name its own final SHA; keep that docs commit separate from the runtime implementation boundary above.

## 1. Certified Git and candidate identity

- Release branch: `hermes/hmh-cycle-070-gameplay-ui-music`
- Remote release-branch head before this post-release closeout: `f232817782509c49ea6e2b6f76ed9a61f82fc4b9`
- Deployed runtime implementation boundary: `f232817782509c49ea6e2b6f76ed9a61f82fc4b9`
- Audit/base source: `origin/main @ a17c37cd6cb39f74758bb4e9ae0bb56d2a1e07bb`
- Exact staged binary-diff SHA-256: `e08e6e91430a02afe177add51a3cf87db0834b6997590e7998cb9a549ded7094`
- Independent exact-patch review: digest matched; verdict `PASS`; blockers `[]`.
- Runtime commit: [`f2328177`](https://github.com/kingdankkush/Lesters-Arcade/commit/f232817782509c49ea6e2b6f76ed9a61f82fc4b9)

Cycle 071 reconciles the external AAA roadmap against current source and production, classifies all 108 task IDs exactly once, canonicalizes Whale Enforcer encounter-role telemetry from `heavy` to `bruiser`, and clamps advertised late-band projectile budgets to the live runtime authority of `128`. Enemy identity/order, spawn timing, RNG, collision, damage, attack tokens, and the fixed-step loop are unchanged. Cycle 070's portal-owned pause soundtrack remains live.

## 2. Preview, production, and rollback

- Verified Preview ID: `dpl_4aBPFKqRSU8YSdJk8HoTG2JfAjeG`
- Immutable Preview URL: https://lesters-arcade-reoj4mmsi-justin-agent-projects.vercel.app
- Verified production ID: `dpl_5HbBQf21BFoPzucGvijjcefygcDS`
- Immutable production URL: https://lesters-arcade-57ws1fm9l-justin-agent-projects.vercel.app
- Public alias: https://lestersarcade.io
- Immediate rollback ID: `dpl_HAeCyfAG6SDK5x1LruxTMix2CBmQ`
- Rollback URL: https://lesters-arcade-5eb8u80mm-justin-agent-projects.vercel.app
- Portal cache token: `hmh-aaa-cycle-071-encounter-truth`
- Service-worker namespace: `lesters-arcade-v24-hmh-encounter-truth`
- Output root: `apps/portal`

Vercel reported both the Preview and promotion-created production deployment `Ready`. Custom-domain inspection resolved `lestersarcade.io` to `dpl_5HbBQf21BFoPzucGvijjcefygcDS`. The retained Cycle 070 rollback deployment `dpl_HAeCyfAG6SDK5x1LruxTMix2CBmQ` remained `Ready`.

### Exact hosted artifact proof

Production SHA-256 values:

- `index.html`: `d132e77b58a8a86113afc0e4178665b9f16b7a1dd11d363434cacb05ef75f627`
- `styles.css`: `941bece09b287a9cd9741df01e9aeeeee6ff947611f43532b2dca74ff00f00a1`
- `sw.js`: `39b4559f20e3f01c6861cf63c39e96f8a1dbd30e7385d2a409228d8d1f014d58`
- `src/arcade-music-transport.mjs`: `67e7a067e268848d360f0acfda111e5036986f9743fbf803b32e735c19a93e5b`
- `dist/main.js`: `969516db92addb3fa4b870b443f8215d86a4410a92c662430cc122c803c2a8bb`
- `dist/hmh-reboot/game.js`: `f2e6f88659a8dbc32f5662c74718cc79117cc5a52e103e53a9886519aeb99f39`
- `dist/chunks/hmh-pixi.js`: `d8bc671038603d2f523ef2b7b6cfd10d03db1366cacaff11b0562e84e0b80e10`

The Preview and production hashes matched for CSS, service worker, transport module, portal bundle, and HMH child bundle. Preview `index.html` differed only by Vercel's injected feedback script; production HTML contained the certified cache token.

Hosted routing/media proof:

- `/`, `/play/hard-money-heroes`, and `/hmh-reboot/index.html` returned HTTP 200 with the expected HTML content type.
- `styles.css` returned CSS and the transport module returned JavaScript.
- a production playlist MP3 byte-range request returned HTTP 206, `audio/mpeg`, and the expected `Content-Range`.
- no failed production resource entries or media decode errors were observed in clean desktop/mobile browser sessions.

## 3. Hard Money Heroes Cycle 071 verification

Exact-candidate gates:

- release ledger: `2,283` evaluated, `2,232` passing, exactly `51` accepted legacy failures, `0` unexpected;
- syntax: `361` JavaScript modules and `49` Python scripts;
- production build: PASS;
- HMH entry: `395,337` bytes; Pixi vendor: `575,891` bytes; combined initial JS: `971,228 / 1,050,000`; `78,772` bytes headroom;
- visual regression: 12/12 scenes unchanged, zero changed cells;
- HMH browser certification: desktop, ultrawide, tablet landscape, mobile portrait, and mobile landscape PASS;
- mobile controls: 4/4 profiles PASS;
- desktop/mobile performance p95: `7.1 / 7.0 ms`;
- asset QA, repository/CDN, documentation links, security `5/5`, third-party sandbox `3/3`, and Web3 source audit `9/9` PASS;
- Web3 live readiness remained intentionally PARTIAL `3/4` because on-chain registry/economy approval is still blocked;
- desktop and portrait portal E2E: 7/7 implemented flows each, with zero page/console errors;
- network/console audit: 4/4 scenarios, zero HTTP/request/page/console errors;
- exact staged patch digest: `e08e6e91430a02afe177add51a3cf87db0834b6997590e7998cb9a549ded7094`; independent frozen-patch review PASS with zero blockers;
- independent roadmap audit: all 108 task IDs classified once, no material misclassifications, P-4 supported as the next bounded task, and Mainnet boundaries preserved.

`forge test` was unavailable on this Windows host. The portable contract structure check passed, no contract file changed, and this website promotion did not deploy or mutate contracts.

### Production desktop and responsive proof

The hosted five-profile browser certification passed on the public production alias. Desktop, ultrawide, tablet landscape, mobile portrait (`390 × 844`), and mobile landscape all produced exact zero-delta deterministic anchors; active runs advanced fixed ticks and player position, pause froze the authoritative tick, and each profile retained one visible gameplay canvas.

### Production touch and network proof

- iPhone 13 portrait, Pixel 7 portrait, iPhone SE portrait, and iPhone 13 landscape real-pointer controls passed with zero failures;
- mobile touch controls remained contained and the HUD/run rail/minimap compositions remained inside their certified bounds;
- clean and warm portal/HMH network scenarios recorded `0` HTTP errors, request failures, console errors, and page errors;
- portal flow and interaction smokes passed against `https://lestersarcade.io` without write mode;
- `docs:production` confirmed the live service worker marker `lesters-arcade-v24-hmh-encounter-truth`.

## 4. Preserved authority and Mainnet boundary

- Fixed 60 Hz simulation and four-step catch-up cap are unchanged.
- RNG, replay, movement, collision, damage, enemy identity/order, progression, save schema, session authority, and run-summary authority are unchanged; only encounter-role labels and advertised projectile metadata were corrected.
- The portal remains the sole shared-playlist owner; HMH continues to own combat audio and gameplay.
- Parent wallet/profile/session/leaderboard/achievement/analytics/settlement authority is unchanged.
- Production serves `export const SETTLEMENT_LIVE = false;`; a true export is absent.
- No wallet signature, transaction, contract deployment, LitVM write, Mainnet activation, or real-fund movement occurred.

Website publication approval never authorizes Web3 writes. Contracts, addresses, chain/operator/verifier configuration, economy policy, settlement activation, and real funds require separate explicit review and approval.

## 5. Chikun's Escape

Chikun remains `0.5.0` / `canvas-runtime-v3`, public playable and Ranked-eligible. Cycle 071 did not change Chikun gameplay or authority. Its known open items remain written creator art rights, final owner QA, `devWallet`/revenue routing, temporary mode art, and rendered share cards. No paid entry is live.

## 6. Next safe work

1. Begin reconciled Phase 0 task P-4 as its own bounded cycle: move the existing enemy roster from Workbench to EEVEE under the shared light-rig direction/colour while retaining per-family energy, with RED manifest tests, deterministic two-run regeneration, native contact-sheet review, visual baseline re-acceptance with intent, and serial desktop/mobile browser proof.
2. Preserve and extend the direct canonical authority tests already present for movement, encounter director, enemy archetypes, Liquidator, progression, runtime performance, run summary, and long-run balance.
3. Build the external-model importer/skinned-action schema on a throwaway committed test fixture before accepting owner-supplied hero meshes.
4. Implement one bounded deterministic town-interaction slice after Phase 0 truth/plumbing: destructible `yard-container-lock`, then a single-use `yard-medbay-cache` with minimap/prompt feedback.
5. Keep generated-art uploads/paid credits and every Web3 write separately approval-gated.

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
