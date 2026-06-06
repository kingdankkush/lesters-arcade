# LitVM Research Notes

Sources checked on 2026-06-04:

- https://docs.litvm.com/overview/architecture
- https://docs.litvm.com/integrations/partners
- https://www.litvm.com/blog/introducing-litvm-litecoins-zk-omnichain

## Current understanding from docs

LitVM is described as a modular Litecoin EVM rollup stack combining:

- Arbitrum Orbit / Arbitrum Nitro execution
- Succinct SP1 zkVM validity proofs
- Espresso shared sequencer
- BitcoinOS Grail Bridge for Litecoin ↔ LitVM
- Arbitrum Bridge for Ethereum/EVM assets
- zkLTC as native gas token

## Why it matters for Lester's Arcade

- EVM compatibility supports MetaMask/Rabby and Solidity contracts.
- Low-cost execution supports micro-entry arcade fees.
- BitcoinOS Grail Bridge/zkLTC gives Litecoin-native identity and bridging relevance.
- Arbitrum/Ethereum bridge support may make USDC/ETH style payments easier for early users.
- Espresso sequencing and ZK proofing are infrastructure advantages, not things the game directly controls.

## Deployment blockers to verify later

- Chain ID
- RPC URL
- Explorer URL
- Faucet
- Token addresses
- Stablecoin support
- Testnet bridge UX
- Mainnet rollout status
