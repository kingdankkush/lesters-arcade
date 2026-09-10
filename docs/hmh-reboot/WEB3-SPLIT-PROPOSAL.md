# Web3 split proposal: decision required

Status: **PROPOSAL ONLY. No economic writes or settlement enablement.**

The current source contains two different economic models. A source/static-analysis PASS does not prove they are consistent with each other or with deployed contracts. There is no standalone `SplitConfig.sol`: the registry stores per-game basis points, while the current payment router uses its own hard-coded split.

| Destination | Testnet registry config | Router implementation |
|---|---:|---:|
| Developer | 7500 bps (75%) | 6000 bps (60%) |
| Platform | 2500 bps (25%) | 2000 bps (20%) |
| Liquidity | 0 bps (0%) | 1000 bps (10%) |
| Treasury | 0 bps (0%) | 1000 bps (10%) |

Both columns sum to 10000 basis points, but they are not interchangeable. The current testnet game configuration has an entry fee of **0 micro-USDC**. Do not infer a production fee or mainnet policy from this development configuration.

## Recommended disposition

Keep `SETTLEMENT_LIVE=false` and paid routes disabled. Retain the current zero-fee testnet proposal without silently rewriting either split. The owner must approve one basis-point model, recipient addresses, an entry fee and the intended network. Then reconcile registry, router, portal disclosure, test fixtures and deployed readback as a single separately approved economic change.

Do not claim `GameRegistry.updateFeeSplit` changes router behavior: the current `PaymentRouter.splitAndDisburse` does not read those registry percentages. Every router vault must be a nonzero address even when an approved category eventually has zero basis points. Do not fill undecided recipients with a deployer address or fake placeholder address.

## Acceptance before any paid activation

- An owner-approved model and recipients replace the explicit null decision fields in the [machine-readable proposal](WEB3-SPLIT-PROPOSAL.json), through a separately reviewed change.
- Known smallest-token-unit examples, rounding residue, event amounts, transfers, reentrancy and rejected recipients pass against the actual chosen implementation.
- RPC chain ID, actual bytecode, exact ABI, configured percentages, vault custody, game approval and immutable score-verifier identity are read back at a recorded block.
- A separately approved testnet canary is reconciled before any mainnet/funds approval is sought.
- Public fee/revenue copy matches the verified implementation; proposal arithmetic alone is not sufficient.

## Sources

- [Testnet configuration](../../contracts/deploy-config.testnet.json)
- [GameRegistry](../../contracts/src/GameRegistry.sol): `registerGame`, `updateFeeSplit`.
- [PaymentRouter](../../contracts/src/PaymentRouter.sol): `setDefaultVaults`, `splitAndDisburse`.
- [Verifier custody and replacement runbook](VERIFIER-CUSTODY-ROTATION-RUNBOOK.md)

Exact current source hashes and machine-checked custody facts are retained in the proposal JSON. No deployment address, contract, wallet, balance or economic configuration was changed while preparing this document.
