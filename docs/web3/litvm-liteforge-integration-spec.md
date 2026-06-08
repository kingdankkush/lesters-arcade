# LitVM LiteForge Testnet — Integration Spec

Source-verified research for wiring Lester's Arcade / Hard Money Heroes to publish
player data (score, achievements, stats) on-chain to the LitVM testnet.

## Network parameters (VERIFIED)

| Field | Value | Source |
|---|---|---|
| Network name | LitVM Testnet / LiteForge Testnet | testnet.litvm.com |
| Chain ID (dec) | **4441** | testnet.litvm.com |
| Chain ID (hex) | **0x1159** | derived |
| Gas token | **zkLTC** (18 decimals) | testnet.litvm.com / explorer |
| Stack | Arbitrum Orbit + AnyTrust | testnet.litvm.com |
| RPC URL | **https://liteforge.rpc.caldera.xyz/http** | docs.litvm.com/deploy-on-testnet/hardhat |
| Explorer | **https://liteforge.explorer.caldera.xyz/** (Blockscout) | testnet.litvm.com |
| Explorer API | https://liteforge.explorer.caldera.xyz/api | docs |
| Faucet | https://testnet.litvm.com/ → "Get zkLTC" | testnet.litvm.com |
| Typical gas | ~0.3 Gwei | explorer gas tracker |

### wallet_addEthereumChain payload
```json
{
  "chainId": "0x1159",
  "chainName": "LitVM Testnet",
  "nativeCurrency": { "name": "zkLTC", "symbol": "zkLTC", "decimals": 18 },
  "rpcUrls": ["https://liteforge.rpc.caldera.xyz/http"],
  "blockExplorerUrls": ["https://liteforge.explorer.caldera.xyz"]
}
```
`wallet_switchEthereumChain`: `{ "chainId": "0x1159" }`

## Wallet approval flow
Standard EIP-1193. No LitVM-specific SDK or special gas-approval flow found —
treat as a normal EVM chain with zkLTC as native gas.
1. `eth_requestAccounts`
2. check chainId; if not `0x1159` → `wallet_switchEthereumChain`; on error 4902 → `wallet_addEthereumChain`
3. ensure zkLTC balance (else faucet link)
4. `eth_sendTransaction` (contract call) → wait for receipt → confirm on explorer

## Publishing player data — recommended pattern
Deploy our own minimal Solidity `PlayerRegistry` on LiteForge. Store the smallest
struct, emit an event each save (event-first for leaderboards/indexing).

```solidity
struct PlayerRecord {
    uint32  score;
    uint256 achievements; // bitmap
    string  name;
    uint64  longestSurvivalSec;
    uint64  lastUpdated;
}
event PlayerRecordPublished(
    address indexed player, uint32 score, uint256 achievements,
    string name, uint64 longestSurvivalSec
);
function publishRun(uint32 score, uint256 achievements, string calldata name, uint64 longestSurvivalSec) external;
```
Keep `name` short; rich stats can stay off-chain or in the event. Gas is cheap on testnet.

## Deployment (Hardhat)
```js
networks: { litvm_testnet: { url: "https://liteforge.rpc.caldera.xyz/http", chainId: 4441, accounts: [PRIVATE_KEY] } },
etherscan: { apiKey: { litvm_testnet: "" }, customChains: [{ network: "litvm_testnet", chainId: 4441,
  urls: { apiURL: "https://liteforge.explorer.caldera.xyz/api", browserURL: "https://liteforge.explorer.caldera.xyz" } }] }
```
Verification supported (Blockscout): https://liteforge.explorer.caldera.xyz/contract-verification

## Framing
LitVM = "Litecoin's EVM rollup", Hard Money narrative. Position the game:
"A browser arcade on LitVM testnet, powered by Litecoin-secured EVM infra — connect
any EVM wallet, fund gas with zkLTC, publish scores & achievements on-chain."

## UNVERIFIED / cautions
- Exact `chainName` string — use "LitVM Testnet".
- No LitVM-specific signing SDK found; standard wallet methods only.
- Live settlement still needs: dev wallet + deployed PlayerRegistry address + flip SETTLEMENT_LIVE.
