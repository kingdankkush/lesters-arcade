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

## Not yet done in this session (see master list)

X-02/X-05/X-07 (backend, profiles sync, global boards), X-08 art/mint policy, contract deployment (owner key), HMH-N03 weapon models, CH-N01/N02, ST-N01..N03. Physical-device acceptance remains owner/tester work.
