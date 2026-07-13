# Hard Money Heroes Ranked Testnet Contract Migration Plan

**Status:** prepared, not approved, not deployed
**Network:** LitVM LiteForge testnet, chain ID `4441`
**Safety:** HALT before any transaction, contract deployment, address cutover, or registry write.

## Decision

A new testnet deployment is required before Hard Money Heroes Ranked Testnet can be called security-remediated.

Read-only RPC evidence collected on 2026-07-12:

- `contracts/deployment-record.json` records the active deployment on 2026-06-22.
- Critical/high source remediation landed later, on 2026-07-08.
- Deployed `ScoreSubmissionRegistry` reverts on the hardened `MAX_SCORE()` selector.
- Deployed `GameRegistry` lacks `pendingOperator()` and `trustedVerifier()`.
- Deployed `GameRegistry.totalGames()` is `0`.
- Deployed `ScoreSubmissionRegistry.totalSessions()` is `13`.
- Current source passes 15/15 Foundry tests and Slither reports 0 findings across 18 contracts and 63 detectors.

ABI compatibility is not proof of deployed security because the hardened authorization and bounds changes preserve key submission method signatures.

## Recommended release architecture

Use the free Ranked Testnet path for the Level 1 release candidate:

1. `GameRegistry`
2. `PlayerProfileRegistry`
3. `ScoreSubmissionRegistry`

Do not deploy or enable paid-entry settlement for this release candidate. Keep these source modules compiled and tested but out of the canonical deployment until paid play has an approved economy and verifier:

- `PaymentRouter`
- `ArcadePaymentRouter`
- `SessionLedger`
- `AchievementRegistry`
- `TournamentPool`
- `LestersArcadeCore`

Achievements may remain in the score submission payload and parent profile state. A separate on-chain achievement registry is not required for free ranked testnet.

## Pre-deployment code work

- [ ] Finalize canonical public/internal session IDs and their bytes32 derivation.
- [ ] Wire replay/input/event hashes into live session creation and persistence.
- [ ] Generate Solidity integrity bounds from the canonical JS model or fail CI on drift.
- [ ] Finish trusted verifier attestation flow for `submitVerifiedSession`.
- [ ] Add byte-equal ABI encoding fixtures shared by planner, client, and Solidity tests.
- [ ] Rewrite `scripts/deploy-contracts.mjs` to deploy only the three approved modules by default.
- [ ] Require an explicit opt-in flag for any dormant paid module.
- [ ] Add post-deploy read-back verification before writing `contracts/deployment-record.json`.
- [ ] Add a frontend address cutover check that refuses unknown chain IDs and incomplete records.
- [ ] Make Ranked Testnet disclosure distinguish verified from player-submitted rows.

## Old deployment archive

Before cutover:

1. Read all 13 old score rows and relevant events from the June 22 ScoreSubmissionRegistry.
2. Save a deterministic archive under `docs/web3/archives/` with:
   - old contract address
   - chain ID and block range
   - session IDs and score metadata
   - retrieval timestamp
   - source RPC URL class, not credentials
   - JSON SHA-256 checksum
3. Preserve the old deployment record as historical metadata.
4. Do not migrate old rows into the hardened registry as verified scores.
5. Label the old board archived/testnet-beta in the UI.

## Testnet deployment order

Run only after Justin explicitly approves the transaction stage.

1. Confirm chain ID `4441`, deployer address, operator address, verifier address, developer wallet, platform revenue wallet, and 75/25 metadata.
2. Deploy `GameRegistry(operator)`. Its constructor initializes `trustedVerifier` to the operator.
3. From the operator, call `GameRegistry.setTrustedVerifier(approvedVerifier)` if the verifier is a separate address.
4. Deploy `PlayerProfileRegistry()` with no constructor arguments.
5. Deploy `ScoreSubmissionRegistry(gameRegistry)`.
6. Register game ID `keccak256(bytes('lester-blaster'))` with Hard Money Heroes metadata and the approved developer wallet.
7. Have the developer wallet confirm the registration.
8. Mark the game playable only after confirmation.
9. Submit one bounded unverified test row and verify disclosure.
10. Submit one verifier-attested test row and verify `verified=true` provenance.
11. Verify duplicate session rejection, wrong signer rejection, wrong chain rejection, unplayable game rejection, oversized score rejection, duration bound rejection, achievement cap rejection, and unauthorized operator calls.
12. Read every constructor argument, operator, verifier, game record, and score row back from RPC.
13. Write a new immutable deployment record only after all checks pass.
14. Cut the frontend to the new addresses and run wallet-connected browser smoke.
15. Keep the old addresses available as archived read-only history.

## Rollback

- Frontend address cutover is the rollback boundary; contracts are not upgradeable.
- If any post-deploy gate fails, do not publish the new addresses.
- If frontend smoke fails after cutover, restore the prior address record but disable ranked submissions rather than routing new writes to the vulnerable June registry.
- Never fall back to paid settlement during rollback.

## Required verification

```bash
npm run check
npm run contracts:check
npm run contracts:compile
npm run contracts:test
npm run contracts:slither
npm run design:security-audit
npm run design:web3-audit
npm test
npm run build
npm run smoke:portal
npm run smoke:portal:interactions
```

Additional release evidence:

- Wallet-connected testnet submission in a real browser
- RPC read-back report
- Verified/unverified leaderboard provenance screenshots
- Old-registry archive checksum
- New deployment record and frontend configuration diff

## Approval gate

Justin must explicitly approve all of the following before deployment:

- Free Ranked Testnet architecture
- Three-contract deployment scope
- Deployer/operator/verifier addresses
- Game developer wallet and revenue metadata
- Archive/reset of 13 old testnet sessions
- Transaction execution on chain ID 4441

Until approval, all work remains local and read-only against LitVM.
