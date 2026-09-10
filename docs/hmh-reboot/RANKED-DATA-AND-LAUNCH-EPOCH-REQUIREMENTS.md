# HMH ranked data, wallet achievements and launch epochs

Owner direction: 2026-09-09. This is a requirements and acceptance record, not deployed functionality or permission to broadcast. Continue visual/gameplay integration and measured balance work first. The current rollout handoff and exact-candidate release gates remain in force.

## Required product outcomes

| Requirement | Acceptance before calling it implemented |
| --- | --- |
| MetaMask, Rabby and other compatible wallets on LitVM TestNet | Parent-owned provider selection, explicit connection and account/network-change handling. Prove connected wallet identity, rejected requests, reconnect and wrong-network refusal with real providers. A simulated identity or injected test provider does not pass this gate. |
| Ranked entry costs at least `.1 zkLTC` during Testnet | Verify the charged entry amount in native-token base units against the actual network/currency contract. Separate entry price, gas estimate and any platform fee. Prove payment receipt, confirmations, cancellation/rejection/revert, duplicate-start prevention and exact wallet/game/session binding. Do not convert this requirement into USD/USDC or silently use gas cost as the entry charge. |
| Ranked session settlement | Parent issues identity/seed/build/ruleset; trusted verification validates the run before a single idempotent settlement. Read back the exact network, registry session ID, full transaction hash, score and committed data identity. Fix the known deployed ABI mismatch before claiming compatibility. |
| Every Ranked session has in-depth profile history | Durable, paginated history scoped to wallet + chain + launch epoch + game, not a bounded localStorage array. Preserve every accepted run and its detailed stats across refreshes/devices. Provide an explicit pending/failed/unverified state; never turn a missing field into a claimed observation. |
| Global leaderboard displays the best competitive stats | Derive a small presentation from verified eligible runs only. Proposed primary fields: score, survival, kills, max combo, hero and selected accuracy definition, with a link to full session detail. Resolve ranking/tie-break rules explicitly before adoption; retain provenance/source filtering before personal-best/top-N selection. No house/demo or Free score in official ranking. |
| Achievements are wallet-locked, non-transferable NFTs | Separate local eligibility from verified minting. Contract tests must reject transfers and approvals/marketplace operators, prevent duplicate claims, bind the achievement to its recipient wallet and epoch, and exercise unlock, mint, readback and metadata display. Mint/upgrade/admin authority, revocation/burn and recovery policy need a reviewed decision; no silent wallet reassignment. |
| Testnet is provisional; universal reset before Mainnet | New chain/deployment + explicit launch epoch/ruleset separates all scores, achievements, XP and unlocks. Mainnet starts fresh across clients, backend/indexer, leaderboards, profiles and achievements. Retain testnet history as clearly labelled archival data; a reset cannot erase historical blockchain transactions. A localStorage clear alone is not a universal reset. |
| Additional Ranked platform fee at Mainnet launch | Amount and fee recipient/split are not specified by the owner. Prepare configuration and exact price disclosure; do not select or activate a fee, adopt an old split proposal, or deploy/change authority without the separate approvals. |

## Existing data versus remaining work

The current canonical source is `sdk/hmh-run-summary-schema.mjs`, with producer `sdk/hmh-run-summary.mjs`. The producer emits schema version 5; the validator accepts versions 1–5. These are gameplay summary versions, not the separate parent save schema or bridge protocol.

Current captured fields include:

- identity: seed, build, mode, hero, terminal reason and tick range;
- totals: survived ticks, elapsed milliseconds, score, level, XP, in-game Litecoin pickups, current/max combo, damage dealt/taken, healing and distance;
- kills: per enemy role, per weapon, elite and boss;
- per weapon: pickups, swaps, trigger and projectile contacts, reloads, empty attempts, equipped ticks, damage, kills, crits and overkill; versioned charge and hit-distribution counters;
- grenades, every canonical collectible, upgrade offers/selections, exploration masks/cells/distance;
- versioned Lightning Ledger, Bear Market Burner and Forked Standard counters.

The profile-history slice exposes these existing validated fields without altering gameplay authority or expanding the schema. Upgrade `offered`/`selected` counts are aggregate build information, not a timestamped or ordered draft/build timeline. Any chronological upgrade history, richer combos, route/action events or additional metrics must be designed at the actual fixed-tick producer, bounded in the bridge contract, and tested for reset/replay and 60/30/20 render-partition equivalence after Codex integration.

`apps/portal/src/persistence.mjs` currently retains **50 summaries total across games, wallets and modes**. This is a local convenience cache, not a permanent ranked-session archive. The current UI explicitly discloses that limit. Source-format validation and a cached transaction hash do not cryptographically verify the local detailed payload. The profile slice keeps those stats local and parent session/receipt navigation separate.

## Proposed durable data architecture (not yet adopted)

1. Maintain the complete validated, versioned run payload in durable storage with a canonical serialization/digest and immutable session identity. Index by wallet, chain, epoch, game and session; use bounded pagination rather than retaining every run in browser memory.
2. Commit the score and detailed-payload digest/reference through the reviewed settlement contract. Display the full detailed record only with truthful availability and verification labels. An off-chain digest commitment proves integrity only when its chain receipt and verifier path are actually checked; it does not itself prove honest gameplay.
3. Build the global leaderboard as a projection of accepted sessions with frozen metric definitions and tie-break policy. Keep Free and testnet/mainnet/house sources separate.
4. Use a versioned achievement catalog and verified claim identity. Keep testnet and mainnet achievement issuance distinct so testnet tokens never imply mainnet entitlement. Review non-transferability and any administrative/recovery exceptions before mint authority is deployed.
5. Test the new-epoch cutover with stale clients, cached sessions, queued settlement, replayed claims, cross-network receipt injection and indexer reorg/retry cases. Archive rather than destroy the testnet source of truth.

## Sequencing and outstanding gates

1. Reconcile Codex's frozen world/control return, clearance and ambient combat authority.
2. Generate current canonical swarm/weapon/progression measurements; tune only demonstrated balance problems. Finish visuals/actions/physics/VFX/audio and human/device acceptance.
3. Finish the durable history/schema/verification design and reviewed epoch/fee/achievement contracts without changing current live authority.
4. Resolve deployed ABI/RPC compatibility and dry-run; exercise authorized real-wallet Testnet flows under a separately explicit transaction/settlement window.
5. Certify the exact website candidate, immutable Preview and rollback, then obtain exact-candidate promotion acceptance. Mainnet deployment, real funds, settlement activation and irreversible authority changes retain their own approval gates.

`SETTLEMENT_LIVE=false` remains unchanged. No broadcast, mint, reset, fee activation, contract deployment, commit, push or website publication is performed by this requirements record. Preserve Chikun and the STACKED pause.
