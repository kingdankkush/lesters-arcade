# Master-list progress — 2026-09-16 session

Working branch `fable/master-list-20260916`, cut from `codex/mobile-worlds-aquatic-20260914` (`17e2d1b7`, the live lineage). Source of truth for scope: `C:/Users/just_/Desktop/LESTERS-ARCADE-MASTER-REMAINING-WORK-2026-09-16.md` (IDs X-*, HMH-N*, CH-N*, ST-N*).

## Slice 1 — HMH weapon swap, weapon wheel, railgun lane (HMH-N01, HMH-N04) — committed `ee0b04d6`

- One manual weapon control. Keyboard `Q` (alternate `E`), gamepad right bumper (button 5), touch `SWAP` button on the grenade row. `weaponNext` is a buffered one-tick edge in `apps/hmh-reboot/src/input.mjs`; held input never repeats it.
- Weapon wheel: `Tab`, or the armed-weapon cockpit card (`#hmhHudWeapon`, now `role="button"`), opens `apps/hmh-reboot/src/weapon-wheel.mjs` (lazy `import()`, not in the initial bundle). The simulation holds in a new `menu` state (`DeterministicSimulation.enterMenu/leaveMenu`); a pick becomes `InputState.requestWeaponSlot(slot)` consumed by the next admitted tick, so the wheel never writes the loadout. Digits 1–8 pick, arrows/WASD move focus, Escape/Tab/backdrop close. Pause closes the wheel first. Ring radius is width-aware so the 3/9 o'clock cards fit a 320 px phone.
- Runtime: `switchWeapon()` and `nextOwnedWeaponId()` in `weapon-system.mjs` are applied inside the tick before `stepWeaponLoadout` (the same rule `grantWeaponPickup` uses), record a `swap` run event and announce the armed weapon.
- Railgun: `hash-rail` policy `pierce maxTargets 6` (Deep Proof 7, Settler Rail 8). Projectiles carry `pierceHitIds`; each tick the stepped projectile state excludes those bodies (`createProjectileState({ excludeTargetIds })`) and carries only the remaining budget; the slug ends on cover, range or budget. Damage is flat along the lane; boss health is 12,000 so the rail is never a one-shot there.
- Contract updates: bridge settings schema (`sdk/hmh-bridge-protocol.mjs`) accepts the seventh binding; cockpit help, briefing copy, touch hint; smokes `hmh-reboot-mobile-controls`, `production-hero`, `release-browser-certification` expect `['aim','move','pause','power','swap']`.
- Evidence: `tests/hmh-reboot-weapon-swap.test.mjs` (10 tests); `npm run smoke:hmh:weapon-wheel` (new, desktop + 390×844 touch, screenshots under `.hermes/evidence/hmh-reboot-weapon-wheel/`); release gate green except the README marker, now bumped to `lesters-arcade-v51-weapon-wheel`. Initial HMH JS 1,040,578 / 1,048,576 B (7.7 KB headroom; the wheel chunk is lazy).

## Slice 2 — end-of-run share for all three games (X-13)

- `apps/portal/src/share-links.mjs`: `buildShareLinks` (x.com intent, Facebook sharer, Discord copy text), `buildHmhShareText`, `buildStackedShareText`, `createShareRow` (createElement only; native share when available, X and Facebook anchors with `rel="noopener noreferrer"`, Discord copy via clipboard).
- HMH: parent game-over summary (`renderGameOverSummary` in `apps/portal/main.js`) appends the row under the recap.
- Chikun: `#shareRow` under the result actions, beside the existing `Share Run` native button (`apps/chikun/src/main.mjs renderShareRow`).
- STACKED: `#shareRow` in the results panel (`apps/stacked/src/main.mjs renderShareRow`).
- Hosts: Chikun and STACKED iframes gain `allow-popups allow-popups-to-escape-sandbox` and `web-share; clipboard-write` (first-party runtimes only; third-party manifests stay scripts-only).
- Evidence: `tests/share-links.test.mjs`.

## Slice 3 — Web3 lane, portal side (X-01, X-03, X-06 prep) — committed `e4afb4fc`

- **Fee model.** `RANKED_ENTRY_FEE_WEI = '100000000000000000'` (0.1 zkLTC, decimal wei string so it survives JSON) on every game record and paid session (`entryFeeWei`, `paymentToken: 'zkLTC'`); the legacy `entryFeeMicroUsdc` stays 0 for old saves. Ranked entry modal shows the fee row and discloses that it is charged only once verified settlement is live.
- **Settlement plan** (`apps/portal/src/settlement.mjs`): a payable `arcadeRankedEntry.openSession(sessionId, gameId)` with `valueWei` precedes the run; the score call is `submitVerifiedSession` (VerifiedRun fields, attestation fetched at settle time). ERC-20 router calls are gone. `LITVM_CONTRACT_ADDRESSES.arcadeRankedEntry` is `null` until the hardened redeploy, which keeps every fee path fail-closed.
- **Chain client** (`litvm-chain-client.mjs`): hardened ABIs (GameRegistry `entryFeeWei`, thirteen-field VerifiedRun + `bytes signature`, RankedEntry, AchievementRegistry reads), `openRankedSession` (pays exactly the registered fee), `requestVerifierAttestation` (POST `/api/attest`), `submitRankedSession` re-verifies the EIP-712 attestation against the on-chain `trustedVerifier` before the wallet spends gas, `fetchPlayerAchievements`.
- **SIWE** (`wallet-auth.mjs`, `main.js`): `isValidLogin` now recovers the signature (ethers `verifyMessage`) and requires it to match the challenged address; Ranked refuses an unauthenticated session and re-prompts once; provider events bind to the connected provider (WeakSet) and an account change drops authentication.
- **Ranked entry flow** (`main.js startOfficialMode / requestRankedEntry / startMode`): the canonical session is created before the pre-flight so the entry (when live) is paid against the same session id the score settles under; `startMode(mode, { session })` reuses it.
- **Verifier** (`api/attest.mjs`, `apps/portal/src/verifier-attestation.mjs`): Vercel Node function that signs `VerifiedRun` typed data with `VERIFIER_PRIVATE_KEY` for `SCORE_REGISTRY_ADDRESS` on chain 4441; 503 without a key, 400 on shape errors, 422 unless the HMH plausibility verdict is clean. v1 checks identity, bounds and envelope shape; server-side deterministic replay for Chikun/STACKED is the next step (needs evidence uploads).
- **Evidence:** `tests/verifier-attestation.test.mjs` (typehash parity with the contract: `0x0f060ef5…6e11`), updated `settlement`, `arcade-core`, `litvm-ranked-contract-gate`, `score-registry-abi`, `hmh-web3-settlement-audit` suites. `SETTLEMENT_LIVE` stays `false`; no funds move.

## Slice 4 — contract overhaul (X-04, X-08 contract) — committed `93ffb8f4`

- New set in `contracts/src`: `GameRegistry` (entryFeeWei, `setEntryFee`), `ArcadeRankedEntry` (payable `openSession`, exact fee, registry-derived split via `call{value}`), `ScoreSubmissionRegistry` (OpenZeppelin EIP712 "Lester's Arcade Ranked Settlement" v2, player-or-relayer submit, `isPaid` check when the game has a fee, best-score indexes, no unverified path), `AchievementRegistry` (ERC-721 soulbound, ERC-5192 `locked`, minted by the score contract, `revoke`/`burn`), `PlayerProfileRegistry` unchanged, `LestersArcadeCore` address book.
- June 2026 USDC/ERC-20 contracts archived under `contracts/archive/2026-06-legacy` (deployed addresses unchanged, read-only, never imported as verified).
- `scripts/deploy-contracts.mjs` deploys all five, sets the minter and vaults, registers three games at 0.1 zkLTC; `contracts/deploy-config.testnet.json` carries the games; `docs/web3/contract-overhaul-20260916.md` has the ABI, deploy order and owner decisions.
- Compiles clean with solc 0.8.35; `npm run contracts:check` passes; forge `SecurityBaseline.t.sol` rewritten but **not executed** (no foundry on this machine). **Nothing is deployed.**

## Slice 5 — HMH authored props at 2x density (HMH-N02 phase 1) — committed `6644d6f4`

- Audit finding: the camera draws ~2.25 CSS px per world unit at 1080p (no zoom ceiling), authored props were 1 px per unit, Tripo set pieces stack a 1.4–1.9 placement scale on top, phones add a 3x browser upscale because `resolutionCap` is 1. Sixty of 99 world props exceeded 1.5x magnification.
- Done: authored atlas re-rendered with Blender 5.1.2 at 256/512 px frames into a 2048 px page with `pixelDensity: 2`; runtimeScale divided by the density so footprints and the Tripo scale reference are unchanged.
- Not done (needs the external Tripo source root or an owner call): Tripo props at 512 px frames (56 GLBs are not in the repo), `occupancy` 0.78 → 0.95, mobile barrier tier at 256 px, mobile `resolutionCap` 1 → 2 (GPU fill-rate trade, needs device evidence), a density gate in `hmh-tripo-production-asset-qa.mjs`.

## Slice 6 — STACKED piece presentation (ST-N03) — committed `7c4c749b`

- `apps/stacked/src/render/piece-presentation.mjs`: pooled typed-array layer (288/192 slots) for the lock thud (inner well layers settle ≤ 4 px), hold/save mote streak, level-transition shimmer band, ledger-rise dust, perfect-clear sparkles, top-out crumble with a held dim, and a ~0.5 Hz danger pulse. Bands stay inside the well at ≤ 0.12 alpha (0.07 with reduceFlash); reduceMotion zeroes everything like the spark layer. Wired in `renderer.mjs` (`dataset.pieceFx*`), covered by `tests/stacked-piece-presentation.test.mjs`; the playable smoke passes on all six profiles.
- Not done: sub-tick interpolation of piece movement (the renderer receives no accumulator alpha), visualizer facelift (ST-N01), menu/UI overhaul (ST-N02).

## Slice 7 — HMH action SFX body pass (HMH-S01, HMH-S04 partial) — committed

- The owner supplied two Doom-mod sound packs (`3P Sound Pack.zip`, `dD_Weapon_Sounds.zip`). They are compiled from other mods and id Software assets with no commercial licence, so **nothing from them is copied into the repo**. Their WAV lumps were measured (RMS, sub-250 Hz share, spectral centroid, 10% decay) and used as targets for the in-repo synthesiser (`scripts/build-hmh-weapon-sfx.py`, render revision `pressure-body-v4`).
- Result: gunshots carry a low-mid body and room tail, the shotgun has a two-stage pump rack, the reload has four mechanical stages, the explosion a sub floor and debris, enemy death an original wet gib layer. Cue bytes 1.57 MB / 1.75 MB budget; reproducible; the weapon-SFX browser smoke plays every cue with zero unknown cues.
- Remaining audio work: per-weapon reload variants, boss/actor voices (HMH-S02), biome beds (S03), a listening pass on real speakers (S05).

## Slice 8 — release 1.6.0 live, Web3 recipients and runbook, adaptive phone sharpness

- 1.6.0 promoted (`dpl_7PT1JEqXYgS4jFjZvip2cMKsACMq`, receipt `docs/qa/master-list-release-20260916.json`); 97/97 public files matched; live smokes for the wheel, STACKED and Chikun Ranked pass (the Chikun smoke wallet now signs the SIWE challenge for real).
- Web3: fee recipients in `contracts/deploy-config.testnet.json` point at the owner wallet `0x07cec6Fc…8B26` for every game and vault; `docs/web3/contract-overhaul-20260916.md` ends with the eight-step deploy/enable runbook. No deployer key exists on the build machine and Vercel secret writes are not permitted from the session, so contract deployment, verifier secrets and `SETTLEMENT_LIVE` remain the key holder's steps.
- HMH: `createAdaptiveResolution` (runtime-performance.mjs) steps a fast phone from resolution 1 to 1.5 after a sustained fast window and back down for good on slow frames; emulated mobile profile stepped up with p95 7 ms.

## Slice 9 — STACKED facelift (ST-N01/N02) — committed `0399ab73`

- `apps/stacked/src/render/world-forms.mjs` plus atmosphere / visualizer-preview rework, results and settings shell in `index.html` / `game.css`; tests `stacked-world-forms`, `stacked-shell-ui`.

## Slice 10 — Chikun contextual animation (CH-N02) — committed `f62c7ae7`

- `apps/chikun/src/character.mjs` rewrite: `chikunBlendSeconds`, virtual `flare` clip, procedural springs; ragdoll handoff 0.22 s; tests chikun-facelift / chikun-polish.

## Slice 11 — contracts round 2 and per-game achievements — committed `bc145698`, `75f305ec`

- `ArcadeRankedEntry.quoteEntry` (flat fee + operator-set settlement gas reserve forwarded to `relayerVault`), `achievementRegistryByGame`, per-collection name/symbol, deploy script registers three collections, deferred activation when deployer ≠ developer. Portal `LITVM_CONTRACT_ADDRESSES.achievementRegistries` per game; audit flattens nested maps. Still **not deployed** (owner key).

## Slice 12 — hosted services and browser wiring (X-02, X-05) — committed `1ed6d307`, `b59ba268`, `6ee91b7e`, `d727ead1`, `5fcdf51b`

- `api/session.mjs` (SIWE → HMAC session token, needs `SESSION_SECRET`), `api/profile.mjs` (GET public / PUT with token; Neon HTTP SQL via `apps/portal/src/server-neon.mjs`, needs `NEON_DATABASE_URL`), `api/settle.mjs` (attest then relay with `RELAYER_PRIVATE_KEY` / `RPC_URL`; 409 already settled, 503 relayer not allowed). Fee model: `RANKED_SETTLEMENT_GAS_RESERVE_WEI` (0.02 placeholder), `rankedEntryTotalWei()`, split 1500/8500 bps.
- Browser: `apps/portal/src/profile-sync-client.mjs` (`createProfileSync`, `buildProfileDocument`, `mergeRemoteProfile`); `main.js` posts the SIWE signature to `/api/session`, pulls the wallet's profile on connect and account change, pushes after every local persist while a session exists, asks `/api/settle` first at live settlement (relayed tx hash finishes without a wallet confirmation, otherwise the attestation is submitted from the wallet), flushes and drops the session on sign-out. Ranked modal shows fee, settlement reserve and total (live quote from `quoteEntry`). All best-effort: a 503 keeps the portal local-only.
- Evidence: `tests/server-session-profile.test.mjs`, `tests/profile-sync-client.test.mjs`, `tests/ranked-entry-preflight.test.mjs`; Chikun Ranked browser smoke passes against the wired portal.

## Slice 13 — HMH destinations and the Scores page — committed `5298e43e`, `a5a606c4`

- Three gated destinations (Liquidity Haven ammo refill 120 s, Litecoin Sanctuary +30 health with the Scrypt Cache grenade, Liquidation Trap berserk 180 s behind a steam hazard), objective cap 8, digests re-pinned, 6/6 browser evidence, initial JS 1,042,652 B.
- Global Scores page: `apps/portal/src/leaderboard-view.mjs` + rewritten route: per-game banners (roving tabs, `/scores?game=`), cadence/standing tabs, name or wallet search, sortable headers, jump-to-my-rank, podium, per-game tables that collapse to cards on phones, truthful wipe/reset notice. 12 new tests; portal e2e, interactions and Chikun smokes pass.

## Slice 14 — owner question-round answers applied to HMH (see `owner-decisions-20260916.md`) — committed `134c8d12`, `eb3ff424`

- Rail lane falloff: `createProjectileState({ damageScale })`, `laneDamageScale()` with `falloff: { farScale: 0.35 }` on Hash Rail, Deep Proof and the pistol's Settler Rail evolution.
- Silver coins count toward score: `grantRunSilver()` (10 per coin × score multiplier, no XP), `silverCollected` in the snapshot.
- `pickup-banner.mjs` (tick-driven bold banner for pickups and world interactions, coalescing queue) with styles in the HMH host stylesheet; `gore-presentation.mjs` physics droplets on directional flesh hits and dismembering kills with tumbling limbs (`shouldDismember`); `createUserZoom()` for desktop wheel zoom 0.7–1.1.
- Runtime wiring in `apps/hmh-reboot/src/main.mjs` is prepared (scratchpad `wire-hmh-main.py`) and lands after the held-weapons slice releases that file.

## Slice 15 — HMH held weapons through the pistol path (HMH-N03) — committed `94f6e291`

- Seven authored weapon meshes (`apps/hmh-reboot/assets/source/blender/hmh-held-weapons.blend`) are appended into each hero's packed rig, skinned to the pistol prop bone with a slide-fitted bore axis and rendered through the hero's own camera, lights, clip actions and reload / idle-check gestures into per-hero, lazily fetched weapon pages (`apps/portal/assets/generated/hmh-held-weapons/<actor>/`, 2x density, exact WebP, ≤ 1.5 MiB per page, ≤ 8 MiB per hero). `held-weapon-atlas.mjs` + `production-hero-atlas.mjs` substitute the held frame per pose and fire the muzzle from the page's muzzle point.
- Evidence: `tests/hmh-reboot-held-weapon-atlas.test.mjs`, `npm run smoke:hmh:held-weapons` (all four heroes, desktop + touch), production asset QA section, contact sheets under `.hermes/evidence/hmh-held-weapons-20260916/`. Remaining: death keeps the native pistol frame; long guns are held one-handed (hero arm poses are locked).

## Slice 16 — STACKED reactive scenes, board pulse and menu (ST-N01/N02) — committed `e0a411a2`

- `render/music-scenes.mjs` (energy tunnel, particle drift, synthwave horizon; director crossfades on energy shifts, 64 beats, a Halving or a 40 s fallback), `render/board-pulse.mjs` (frame ring and active-piece halo within pinned alpha caps; off under reduced motion / flash or the new toggle), rebuilt menu, mode tiles, grouped settings and results with inline SVG art. Scene and pulse preferences persist device-side (`stacked-visual-scenes-v1`). Note: the board pulse is hidden while "Reduced flashes" (default on) is set.

## Slice 17 — Chikun to the sheet and one looping course (CH-N01/N02/N03) — committed `602c7898`, `de8ca47f`, `7d117e41`

- Character: native rig plus brow / beak expression bones, vertex regrade to the sheet palette with glowing mint eyes, 39 clips (idle, steep climb / dive, hit per obstacle family, expressions baked per clip), atlases regenerated within budgets (`docs/chikun/CHARACTER-SHEET-PIPELINE.md`).
- Course: `apps/portal/src/chikun-course-regions.mjs` schedules farmland → forest → town → city → industrial → suburbs → coast as one 16,320-tick lap that loops into farmland with no reset; per-region parallax, terrain and passage mixes; start-overlay teases; regions browser smoke. Evidence version bumped to v5 (old local previews no longer re-verify).

## Slice 18 — HMH runtime wiring and the hosted-sync flag — committed `f5b1c7e0`, `edc9aa90`, `1502fee5`

- `main.mjs` now applies the rail lane falloff per segment, grants score for silver, announces pickups / activated sites / secrets through the lazy banner, passes direction and dismember flags into the gore pool, and zooms with the desktop wheel. `HOSTED_PROFILE_SYNC = false` (settlement.mjs) keeps the portal from calling `/api/session` and `/api/profile` until the owner flips it with the Vercel secrets. Version 1.7.0, cache marker `lesters-arcade-v52-owner-round`.

## Release 1.7.0 — verified live 2026-09-17

- Gate `npm run vercel:build`: 3,943 tests, 3,892 pass, 51 unchanged retired exceptions; HMH initial JS headroom 2.1 KB. Promoted production `dpl_2Q1MYFG9YQWypPjs84VLKdTkwdsu` (source `69144aad`); 102/102 public files match; `/api/attest`, `/api/session`, `/api/profile`, `/api/settle` fail closed (503); live smokes pass for the weapon wheel, held weapons, Chikun Ranked and STACKED. Receipt: `docs/qa/master-list-release-20260917.json`. Rollback `dpl_7PT1JEqXYgS4jFjZvip2cMKsACMq`.
- Follow-up: the Chikun regions browser smoke passes locally but its Playwright route interception races the frame load on the live alias.

## Not yet done in this session (see master list)

X-08 art (owner), contract deployment and Vercel secrets plus the `HOSTED_PROFILE_SYNC` / `SETTLEMENT_LIVE` flips (owner key), Tripo props (no API access on the build machine), HMH interactive-area hero animations and world dressing (next art slices), STACKED portal-side persistence of scene prefs, Chikun ragdoll sever rules per new hit family. Physical-device acceptance remains owner/tester work.
