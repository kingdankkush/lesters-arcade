# Web3 Security Skill Notes — Slither / Foundry / Wallet Upgrade Relevance

Sources reviewed 2026-07-08:

- Chainstack Labs: `smart-contracts-audit-foundry-slither` README
- Alchemy dapp listing for Slither
- CryptoSkills: Foundry, Slither, Account Abstraction, Arbitrum, Arbitrum Stylus, Contract Addresses, EVM NFTs, Frontend UX, Hardhat, Tenderly, Semgrep Solidity
- Medium article URL was checked, but static fetch returned HTTP 403, so it was not used as evidence.

## Takeaways we should use for Lester's Arcade

### Foundry

Use Foundry as the canonical Solidity behavior/invariant test layer for WO-125+.

Useful patterns adopted here:

- Keep contract tests in Solidity under `contracts/test/*.t.sol`.
- Use `forge test` for access-control, signer, settlement, and invariant regressions.
- Configure fuzzing with high local runs: `runs = 10000`.
- Enable `via_ir = true` when the security harness hits Solidity `Stack too deep` during complex settlement tests.
- Prefer explicit, reproducible config in `foundry.toml` instead of relying on inferred defaults.

Current local gate:

```bash
npm run contracts:test
# 15 passed; 0 failed; 0 skipped
```

### Slither

Use Slither as the fast static-analysis gate, but do not treat raw Slither output as an audit report.

Useful patterns adopted here:

- Run Slither after a successful Foundry compile path.
- Filter dependency noise through `slither.config.json`.
- Keep `--fail-high` so new high-severity detector results block the gate.
- Triage findings in `docs/security/slither-triage.md`; false positives must be recorded, not ignored.

Current local gate:

```bash
npm run contracts:slither
# analyzed 18 contracts with 63 detectors, 0 result(s) found
```

### Semgrep Solidity

Not installed in this slice. Best use here is as a second static layer for project-specific invariants Slither cannot express cleanly, such as:

- No caller-controlled split config in public payment functions.
- No private-key fragments in deployment script logs.
- No `postMessage('*')` in first-party cabinet runtime once parent origin is known.
- No direct generic chain write path outside `litvm-chain-client.mjs` unless dev-flagged.

Do not use Semgrep as a Slither replacement; it is pattern matching, not EVM reasoning.

### Frontend UX / wallet integration

Applied in this slice:

- `wallet-auth.mjs` now exposes `classifyWalletError()` so wallet errors become UI state, not generic failure text.
- EIP-1193 user rejection (`4001`) and ethers `ACTION_REJECTED` are classified as `user-cancelled` with `severity: info`.
- Wrong-network, missing-wallet, and insufficient-funds states are classified separately for clear LitVM wallet copy.
- `checkRankedReadiness()` now returns `errorKind` alongside `error` for machine-readable UI handling.

Further patterns to apply after this slice:

- Treat wallet connection as a state machine: disconnected, connecting, connected, wrong-network.
- Treat transaction submission as a state machine: idle, awaiting signature, pending, confirmed/failed.
- User rejection (`4001`) is cancellation, not an error toast.
- Explorer links must use the active chain config; never hardcode Ethereum mainnet explorers for LitVM/testnet flows.
- Exact-amount approval should be the default if/when paid ranked returns; infinite approval should require explicit opt-in.

### Tenderly

Useful later for WO-131 deploy-plan validation and testnet transaction debugging, not needed for this local-only slice.

Potential use before redeploy:

- Simulate deploy/wiring transactions against a virtual testnet or fork.
- Save failed simulations for debugging.
- Verify gas and revert reasons before Justin approves a testnet deployment.

No Tenderly API calls were made in this slice.

### Contract Addresses

Relevant once paid ranked uses real ERC-20 addresses.

Rules to keep:

- Never assume token addresses match across chains.
- Distinguish native USDC from bridged USDC.e.
- Use checksummed addresses in deploy config.
- Re-verify addresses on-chain before any mainnet or real-value configuration.

### Account Abstraction

Potential future wallet UX upgrade, not a current remediation dependency.

Useful later:

- Session keys could authorize bounded gameplay actions without asking the player to sign every interaction.
- Paymasters can sponsor gas for casual/testnet sessions, but somebody still pays; this is not free gas.
- Any session key must be scoped by contract, function selectors, value limits, expiry, and usage count.

### Arbitrum / Stylus

These are not directly applicable to LitVM today, but they provide cross-chain cautions:

- L2 gas, timestamp/block semantics, and explorer/RPC behavior differ by chain.
- Do not port deployment assumptions across EVM chains without re-checking chain-specific behavior.
- Stylus is Rust/WASM on Arbitrum, not needed for Lester's current Solidity stack.

### Hardhat

Not selected. The project already uses a Node/esbuild stack and now has Foundry for Solidity behavior tests. Adding Hardhat would duplicate the contract test surface without solving a current blocker.

## Recommended next security slices

1. Add verified-session EIP-712 path to `ScoreSubmissionRegistry` and its Foundry tests.
2. Generate `IntegrityBounds.sol` from the same JS balance constants used by the client, then test contract/client bound parity.
3. Add a Semgrep custom rules folder for Lester-specific invariants.
4. Polish wallet UX state handling around LitVM network mismatch, user rejection, pending tx, and simulated/testnet badges.
5. Prepare WO-131 deploy-plan simulation only after Justin approves the WO-115 canonical path ruling.
