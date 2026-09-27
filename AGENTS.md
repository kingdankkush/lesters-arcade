# Lester's Arcade repository instructions

## Read order

Before changing code, read:

1. `README.md` top sections — **current release truth**: the newest release section names the site/game version, cache marker, production deployment, rollback and release branch, and links its receipt under `docs/qa/` (`batch-release-*.json` for 1.8.2 onward, `ranked-launch-release-20260924.json` for the 1.8.0 Ranked launch).
2. `docs/handoffs/pre-deployment-web3-guide-20260922.md` — Web3 architecture, service roles, ship cycle and the owner's 2026-09-22 decisions. Its section 1 ("where things stand") predates the 2026-09-24 contract deployment; the README and receipts supersede its state tables.
3. `docs/web3/weekly-jackpot-operations.md` — the Chikun Weekly Jackpot: deployed contracts, roles, operator actions and the go-live runbook whose ⚠ steps need the owner's approval in the moment.
4. `docs/handoffs/hmh-textured-rollout-progress.md` — HMH rollout checkpoint (last updated for the September 14 releases): owner authority, native source proofs and the linked complete revamp handoff that maps HMH source and evidence. Its release and deployment values are historical baselines.
5. `docs/hmh-reboot/AAA-ROADMAP.md` — standing HMH dependency order, AAA acceptance bars, completed-item reconciliation, and owner gates.
6. `docs/handoffs/2026-09-07-hmh-open-work-register-and-reprompt.md` — historical requirement register; `docs/hmh-reboot/OPEN-WORK-CURRENT-STATUS.json` is its 2026-09-08 snapshot, not current status. Read only the selected slice and its cited source, tests, identity/compatibility contract and evidence before editing.

For the selected slice, consult its owning cycle and `docs/hmh-reboot/REFERENCE-CHARACTER-MODELS.md` or `docs/hmh-reboot/COMPATIBILITY.json` as applicable. `docs/hmh-reboot/MAINNET-READINESS-ROADMAP-2026-09-01.md` and `docs/web3/contract-overhaul-20260916.md` (contract design and pause levers) cover the separately authorized Web3 scope. History, consulted only when that history is needed and not as a restart queue: the 2026-08-20 live-release handoff (`docs/handoffs/2026-08-20-lesters-arcade-hmh-chikun-live-release.md`), the Cycle 036, 049, 067, 070 and 074 handoffs, `docs/hmh-reboot/AAA-CONTINUOUS-IMPROVEMENT.md` and the cycle ledgers under `docs/hmh-reboot/cycles/`.

Older June 2026 HMH handoffs describe a superseded Canvas/isometric/procedural direction. They are historical context, not active implementation authority.

## Current game direction

STACKED 0.2.0 is public playable and Ranked-eligible. The owner approved the tested public beta on September 13, 2026; since the 1.8.0 Ranked launch (2026-09-24) its Ranked runs are replay-verified by the arcade server and published on chain like the other two cabinets (see Web3 truth). Physical-device acceptance and remaining polish stay open. Prizes, and any change to its fees or contracts, need separate owner approval.

Hard Money Heroes is a deterministic PixiJS `8.19.0` top-down 2.5D authored roguelike run-and-gun.

Preserve:

- Fixed 60 Hz simulation.
- Maximum four catch-up steps.
- Game alias `hmh`.
- Game ID `lester-blaster`.
- Profile `wo71`.
- Save schema `2`.
- Bridge `hmh-bridge/v1`.
- Maximum bridge message size `65,536` bytes.
- Parent authority for wallets, profiles, leaderboards, analytics, canonical sessions, official completion, and settlement.
- Free Mode isolation from Ranked progress.
- Same-seed deterministic behavior and replay integrity.
- Current production and rollback until explicit promotion approval.

Active HMH actors must visibly read as human survivors or zombies. Do not use animal, vehicle, robot, mech, or abstract actor proxies. Do not reactivate retired generated/isometric actor art.

Playable characters must follow `docs/hmh-reboot/REFERENCE-CHARACTER-MODELS.md`: reference-faithful detailed Blender models, ordinary enemies at comparable human scale, and hitbox changes isolated into measured deterministic gameplay cycles.

Chikun's Escape is public playable and Ranked-eligible as of `54aab311` (2026-08-11), which is an ancestor of the deployed production source. Its deterministic parent replay and SDK boundary must remain intact. It has since gained a parent-owned daily UTC course seed, local daily-best comparisons, and a seek-safe animated replay viewer; all three are projection-only and must never affect a canonical score, a Ranked write, or collision.

Publish status is now gated, not just documented. `npm run docs:cabinets` proves what `README.md`, `AGENTS.md`, and `docs/THIRD_PARTY_GAME_ONBOARDING.md` claim about a cabinet against its `game.manifest.json`, and it runs inside `npm test`. If you flip a cabinet's `status`, the docs must move in the same commit or the gate fails the build.

For Chikun's Escape, what shipped (manifest `0.9.0`) is a vertical slice, not the creator's full original game. Do not restore the vaulted React/Supabase source, and do not treat these as settled: written commercial-use, modification, hosting, and redistribution rights for the creator's art are still pending; the Chikun `devWallet` is `null` in `game.manifest.json` and `game-registry.mjs`, so no revenue reaches the creator. Chikun's Ranked entry is the same fee plus 0.002 zkLTC settlement reserve as every cabinet (0.1 zkLTC on chain until the operator's `setEntryFee` lowers it to 0.01), and the deployed on-chain split pays its 85% developer and 15% arcade shares to the owner's wallet (`contracts/deployment-record.hardened.json`); the legacy `entryFeeMicroUsdc` field still resolves to `0` and is never charged. Routing revenue to the creator, or any other third-party settlement, needs separate explicit approval.

## Git and deployment safety

- Production is released from `fable/master-list-20260916`. Work on a new branch from it (or from the branch the newest README release section names), not on the retired `reboot/hmh-aaa-continuous` continuation.
- Do not push ordinary work directly to `main`.
- Do not rewrite or discard unrelated working-tree changes.
- Do not promote a Vercel deployment without the owner's explicit approval for that release. The September 13 approvals covered the tested HMH website update and the STACKED public beta only; every other publication scope needs its own authorization. Public disclosure of additional source files and editable models is a separate permission from website publication.
- Do not deploy or redeploy contracts, send transactions, change contract authority, fees, reserves or flags, change Vercel secrets, or flip `SETTLEMENT_LIVE`, `HOSTED_PROFILE_SYNC` or `JACKPOT_LIVE` without a separate explicit owner approval for that exact action.
- Do not expose private keys, API credentials, or verifier secrets. Service keys live outside the repository; never print, paste, commit or log them.

Release process (README release sections, the ship cycle in `docs/handoffs/pre-deployment-web3-guide-20260922.md` section 1.3, and the `docs/qa/` receipts): bump the site/game version and service-worker cache marker with their pinned tests, pass the local `npm run vercel:build` release gate, upload with `npx vercel deploy --yes`, then, with the owner's approval, `npx vercel promote <candidate> --yes`. Verify the public files against the certified build and `/api/health`, then record the README release section and a receipt. Vercel Git-integration previews of branch pushes fail two HMH LFS hash tests because LFS content is not cloned, so production ships by the local upload (`docs/qa/ranked-launch-release-20260924.json`).

Release baseline at the time of this instruction (2026-09-26):

- Release branch: `fable/master-list-20260916`.
- Latest verified-live release: `1.8.4`, production deployment `dpl_61u26aJuaoPMoEGthLcqp7MTUh6N` (source `4f947386`) at https://lestersarcade.io, cache marker `lesters-arcade-v57-fair-play`, receipt `docs/qa/batch-release-20260926-1.8.4.json`, rollback `dpl_BoYxVQ4rW4zyeNUuisJv88eHLFGK` (1.8.3). Rolling back further than 1.8.3 needs Ranked paused first.
- In release: `1.8.5` (release commit `a8f81931`, cache marker `lesters-arcade-v58-smooth-crowds`). Its README section records whether it has been verified live.
- `SETTLEMENT_LIVE=true`, `HOSTED_PROFILE_SYNC=true` (`apps/portal/src/settlement.mjs`); `JACKPOT_LIVE=false` (`apps/portal/src/jackpot-config.mjs`).

Historical Cycle 029-036 anchors, kept for provenance only (continuation branch `reboot/hmh-aaa-continuous`; the Cycle 036 production deployment `dpl_5mUEBJ6dZYaW6PANwSc1SfBnJRWo` ran with `SETTLEMENT_LIVE=false`). The Cycle 029-036 ledgers under `docs/hmh-reboot/cycles/` and their handoffs under `docs/handoffs/` hold the details:

- Cycle 029 Lilly source: `3784080bf0aa79cad7cbe1c7b13a9b6f9c094109`
- Cycle 029 exact commit patch SHA-256: `9c7d2acbc9f6b5d3e2390f94b5ccc3561a9dab7d959e390d927f5e508e496132`
- Cycle 030 Lit Commando source: `d5a860d491739184a35e61fe9fd5f88c1c65743b`
- Cycle 030 exact commit patch SHA-256: `38d5588b47d24067167c0749b7c36753bd350491a8aa7a10407d92161ea34950`
- Cycle 031 Lit Valkyrie source: `45d1a25e48f0ba7f094efc0199ebb4675d8ac614`
- Cycle 031 exact commit patch SHA-256: `a3be6886f105f98be6cec7eb0ca80fed6348e4080fa31b85f856d950e2914c36`
- Cycle 032 source: `9002681fb5e91eed62cacbb8e1679201a3ae0e1a`
- Cycle 032 exact staged patch SHA-256: `c493321316ea20687be04e2d8d4f0efadf9ab1db42e1caf842422d74b6a6907a`
- Cycle 033 source: `d59d838258f285fa568382c28eadbc2979117a92`
- Cycle 033 exact commit patch SHA-256: `e1e438b107280f5268f242d35b31a237256a1a68d198ade6ca38e4b3e6c881b9`
- Cycle 034 source: `be2712e4c617152eb3f115c5ef083e3a3a173044`
- Cycle 034 exact commit patch SHA-256: `540d71f3bcc9935fee4ee525e19b59806800430e6267207b65d55e403f220e50`
- Cycle 035 source: `0e4a0cc7dbe553196b64b5181ed5cd70d3c70e9f`
- Cycle 035 exact commit patch SHA-256: `697b72230da401d5ef686cea3145fb643c9ea274ad7116377b9dbdc166aa698f`
- Cycle 036 source: `15629ebac9e1004f2b41760aedd3e67cc406f5c3`
- Cycle 036 exact commit patch SHA-256: `5fa3e71570a20d1ca5b4166df06c041e244e9a7315645ae74f797752686847d6`
- Cycle 036 closeout branch head: `802e6cd18a537c72830224e0655617841241b548`

Re-read live Git and deployment state before acting. Do not assume these values remain current in a later session.

## Runtime authority

The HMH child may own input, deterministic simulation, movement, collision, elevation, combat, AI, progression, and render projection.

The HMH child must not:

- Request wallets.
- Request signatures.
- Send transactions.
- Write parent persistence.
- Grant official achievements or Ranked status.
- Calculate or authorize settlement.
- Replace the parent-provided session identity or seed.

Art, interpolation, particles, shaders, audio, animation LOD, and quality tiers are projection-only. They may not change collision, damage, AI, spawning, RNG, progression, evidence, or results.

## Render-layer visual verification

For any render-layer change:

- Run `npm run visual:reboot` and inspect both the screenshots and machine-readable comparison metrics. Do not rely on screenshots alone.
- Verify the ground plane, prop grounding, depth sorting, collision-to-art alignment, actor readability, UI containment, and desktop/mobile framing.
- Use `npm run visual:reboot:accept` only after the visual change is intentional and reviewed.
- Commit the approved baseline update under `docs/testing/VISUAL_BASELINES/` with the source change that requires it.

## Implementation discipline

- Select one bounded vertical slice from the earliest incomplete master-plan phase.
- Audit current source, tests, runtime behavior, active art, and performance first.
- Write RED behavioral coverage before a fix or feature.
- Implement the smallest coherent deterministic change.
- Exercise the actual browser/runtime path.
- Inspect full-resolution desktop and mobile evidence.
- Measure before optimizing.
- Keep generated/runtime artifacts and docs consistent.
- Do not treat a plan, stub, static audit, synthetic wallet, or simulated receipt as a finished feature.

Keep the release byte budgets: HMH initial plus shared JavaScript at most 1,048,576 bytes and STACKED initial JavaScript at most 607,000 bytes (1.8.4 receipt: 1,047,615 B and 574,802 B). New portal or HMH UI loads through dynamic `import()`.

Any runtime, asset, routing, CSP, service-worker, or release-harness change creates a new candidate and requires fresh certification.

## Working commands

Use npm on this Windows checkout:

```bash
npm install
npm run check
npm run test:release
npm run build
npm run assets:qa:hmh-reboot
npm run design:security-audit
npm run design:third-party-security
npm run design:web3-audit
npm run design:web3-live
npm run repo:health:strict
npm run repo:cdn-gate
npm run docs:links
npm run docs:production
```

`docs:production` is the intentional network-backed production-marker check. Keep `docs:links` offline and deterministic; use the production check when certifying or reconciling a deployment.

`pnpm run build` is blocked on this machine by a parent user-level package-manager declaration. `npm run build` is the verified repository path.

Serve locally from `apps/portal`, not `apps/portal/dist`:

```bash
cd apps/portal
python -m http.server 8791 --bind 127.0.0.1
```

Portal URL: `http://127.0.0.1:8791/`

HMH URL: `http://127.0.0.1:8791/hmh-reboot/index.html`

## Web3 truth

- Ranked Mode is live on the LitVM LiteForge **testnet** (chain 4441) for all three cabinets since the 1.8.0 release on 2026-09-24 (`docs/qa/ranked-launch-release-20260924.json`). `SETTLEMENT_LIVE` and `HOSTED_PROFILE_SYNC` are `true` in `apps/portal/src/settlement.mjs`.
- The deployed contracts (GameRegistry, PlayerProfileRegistry, ArcadeRankedEntry, ScoreSubmissionRegistry and one achievement collection per cabinet) are recorded in `contracts/deployment-record.hardened.json` and generated into `apps/portal/src/generated/litvm-addresses.mjs` (`status: 'deployed'`). This is a testnet epoch; mainnet is a fresh deployment set and nothing carries over. The June legacy contracts are superseded.
- A Ranked entry is one player-signed `ArcadeRankedEntry` transaction: a 0.1 zkLTC fee plus a 0.002 zkLTC settlement reserve (0.102 zkLTC), split 85% developer and 15% arcade. The owner lowered the fee to 0.01 zkLTC on 2026-09-26 (0.012 zkLTC per run with the reserve): the release with the matching 0.012 settle floor (`server/config.mjs` `DEFAULT_MIN_PAID_WEI`) ships first, and the operator's `GameRegistry.setEntryFee` for each game follows only after it is live (`docs/handoffs/ranked-fee-20260926.md`).
- Settlement is relayed. The arcade server verifies every Ranked run (Chikun's Escape and STACKED are replayed from their inputs; Hard Money Heroes is plausibility-checked), the verifier signs an EIP-712 attestation inside the server, and the relayer publishes the result to `ScoreSubmissionRegistry`. The browser never produces a trusted attestation or signs a score submission.
- Profiles, Weekly/Monthly/All-time leaderboards and achievements are read from the Neon index of on-chain events, which a cron fills from the chain; on-chain display names and avatars live in `PlayerProfileRegistry`. Soulbound achievement NFT minting is phase 2.
- The Chikun Weekly Jackpot (`WeeklyJackpot` and the no-value test token tCHIKUN) was deployed to LiteForge on 2026-09-26 (`contracts/deployment-record.jackpot.json`, `docs/qa/jackpot-deploy-20260926.json`) but is idle: the owner put it on hold until mainnet and the $CHIKUN launch. `JACKPOT_LIVE` is `false`, the jackpot server stays unconfigured and its keeper cron is a no-op (`docs/web3/weekly-jackpot-operations.md`).

Never describe local/simulated or source-only Web3 behavior as live settlement, testnet activity as mainnet, or the Weekly Jackpot as live.
