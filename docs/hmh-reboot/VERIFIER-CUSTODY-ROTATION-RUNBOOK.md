# Verifier custody and replacement runbook

Status: **SOURCE-VERIFIED RUNBOOK. NOT A DEPLOYMENT OR ROTATION AUTHORIZATION.**

This runbook applies to the current repository contracts. It does not establish that those contracts, an attestation service, or a production signing key have been deployed. The local testnet configuration currently reuses one address for several roles; that is not a recommended production custody arrangement. Do not put private keys, recovery material, tokens or connection strings in this repository, logs, review packets or browser code.

## Contract facts that determine the procedure

| Component | Current source behavior | Operational consequence |
|---|---|---|
| `GameRegistry` | `operator` and two-step `transferOperator` / `acceptOperator`; mutable `trustedVerifier` | Verify both transfer steps independently. Updating this registry's verifier does **not** rotate the score registry's immutable verifier. |
| `ScoreSubmissionRegistry` | Immutable `gameRegistry` and `trustedVerifier`; no verifier setter | Normal verifier replacement requires a new score-registry deployment and an approved address/configuration migration. There is no supported in-place rotation call. |
| Signature validation | `ecrecover`, low-S and v checks; no ERC-1271 validation | A contract-wallet/multisig address cannot simply replace the attestation signer. An EOA-compatible signing service/key is required by this implementation; ERC-1271 support would be a separate contract design/review. |
| Attestation digest | Ethereum Signed Message prefix around a payload binding registry address, chain ID, player, achievements hash and complete `VerifiedRun` | This is **not EIP-712**. Match `attestationDigest` exactly; do not double-prefix or reuse signatures across registry deployments/chains. |
| Run validity | Deadline, nonzero envelope, unique nonzero session, score bounds and approved/playable game checks | Enforce the same contract and parent-session identity before the service signs; browser-supplied score claims alone are insufficient. |
| `PaymentRouter` | Separate two-step operator transfer; one-time session-ledger wiring; all vault addresses nonzero | Score-key replacement does not imply payment-role, custody or one-time wiring changes. Keep them out of a website release. |

The [source snapshot and verified facts](WEB3-SPLIT-PROPOSAL.json) bind this runbook to current files. Revalidate before using it with a later contract version.

## Custody policy to approve before an operational signer exists

- Separate deployer, platform operator, attestation signer and payout recipients. Propose an audited hardware-backed or managed signing system with a recoverable operational process; do not invent a provider, account, service endpoint or existing installation.
- Limit signer access to the authorized server-side verifier. The child game and parent browser never receive the signing key.
- Have an owner-approved operator/custody policy, backup/recovery contacts and incident authority. A multisig can be considered for operator actions, but that does not make it a compatible score-attestation signer.
- Log public request/session identifiers, validated envelope hashes, contract/network version, decision and transaction receipts. Exclude secrets and unnecessary personal data.
- Test the exact personal-sign-compatible digest against `attestationDigest`, including wrong player, modified achievements/envelope, wrong registry, wrong chain, replay and expiry failures.
- Establish issuance-service deployment, monitoring, access control, rate limits, replay handling and recovery as separate acceptance evidence. This document does not mark such a service implemented or live.

## Routine replacement: approval-gated sequence

No step below has been executed by preparing this document.

1. **Freeze and approve the change plan.** Record the intended chain, old contract/verifier addresses, source/artifact hashes, game IDs, operator authority, replacement custody owner, cutover window and rollback policy. Verify exact deployed code/ABI and current getters with read-only calls first. Stop on RPC outage, tuple drift, unknown authority or mismatched configuration.
2. **Pause issuance and paid/ranked activation.** Keep the website on `SETTLEMENT_LIVE=false` during unverified integration. Stopping a website or signer alone does not revoke already-issued attestations. If on-chain suspension is needed, separately approve the actual operator transaction using `GameRegistry.setPlayable(gameId, false)`, then read back the affected game's state. Never claim the current score registry has a pause function.
3. **Provision replacement custody through the approved channel.** Do not generate or expose private material in an agent transcript. Confirm access, recovery and signer identity without publishing secrets.
4. **Certify a replacement score registry.** The current immutable-verifier design requires a new deployment. Run local security/contract tests, wrong-domain/replay/expiry tests and deployment-plan validation. Actual deployment, transaction costs and any mainnet/funds action require their separate approvals.
5. **Read back the new deployment.** Verify chain ID, bytecode identity, `gameRegistry()` and `trustedVerifier()`, digest behavior and current ABI reads at a recorded block. A predicted address or zero-code target does not pass.
6. **Perform the separately approved testnet canary.** Issue and submit only an owner-authorized test session, verify the resulting record and signature domain, and retain transaction/block evidence. Do not enable general ranked publication merely because local fixtures passed.
7. **Prepare website/backend cutover.** Version the network/address/ABI configuration together. Keep old ledger history source-labeled and read-only; never import legacy records as newly verified. Test session identity, cache invalidation, profile/global filtering, Free/Ranked separation and public copy.
8. **Approve and activate deliberately.** Any game re-enablement, operator/custody transaction or settlement switch requires the recorded authorization for that specific action. Read back the exact target after each write and verify a real approved flow. Website deployment approval is not signing or fund-movement approval.

## Compromise response

- Preserve logs and the affected source/configuration/deployment identities. Restrict issuance using the approved incident channel; do not erase evidence or rotate credentials through chat.
- Treat outstanding valid attestations as a separate risk until expiry or an approved game suspension is confirmed on chain.
- Do not call `GameRegistry.setTrustedVerifier` and claim the compromised score verifier was revoked; the current score-registry address remains bound to its immutable verifier.
- Use the approved replacement-deployment process. Do not restore a compromised registry/key as an automatic rollback.
- Reconcile any accepted disputed sessions explicitly. A website hide/filter is not deletion or revocation of an on-chain record.

## Website rollback versus authority rollback

Website rollback may restore a prior certified immutable deployment under the website-release authorization. It does not undo transactions, change immutable verifier identity or recover funds. If the old signer is compromised, keeping ranked/paid functionality disabled is safer than silently restoring old authority. Preserve the old ledger as labeled history and obtain a separate remediation plan for on-chain state.

## Sources and acceptance record

- [GameRegistry](../../contracts/src/GameRegistry.sol)
- [ScoreSubmissionRegistry](../../contracts/src/ScoreSubmissionRegistry.sol)
- [PaymentRouter](../../contracts/src/PaymentRouter.sol)
- [Split proposal and current economic discrepancy](WEB3-SPLIT-PROPOSAL.md)
- [Mainnet readiness roadmap](MAINNET-READINESS-ROADMAP-2026-09-01.md)

Current source checks and local contract tests are evidence for these documented APIs, not proof of custody ownership, a deployed signer, live RPC compatibility, a completed rotation, or mainnet readiness.
