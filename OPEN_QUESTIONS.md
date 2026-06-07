# Open Questions

Updated after Claude Opus 4.8 Build-Risk Review v2.1 ingestion.

## Still needs Justin approval / external verification

- [ ] Confirm current LitVM LiteForge RPC URL, chain ID, faucet/testnet bridge, explorer, token addresses, and zkLTC faucet/balance requirements against official LitVM docs immediately before any contract deployment or real transaction flow.
- [ ] Decide first **real** paid asset for any future real-funds launch. v2/v2.1 recommendation: prototype with testnet zkLTC and keep the payment router asset-agnostic for USDC/LTC/multi-asset later. Real-fund routing requires explicit Justin approval.
- [ ] Decide entry-credit refund policy for abandoned ranked runs. v2.1 recommends forfeit with no double-charge, but refund behavior is an owner/economy decision.
- [ ] Confirm Overtime board policy. v2.1 recommends a separate Endless board so extraction-score skill expression is protected.
- [ ] Confirm competitive board identity: default Ranked Assist-Off plus inclusive Ranked Assist-On, or a different primary/combined presentation.
- [ ] Decide whether Daily Seed board is in P2 scope. v2.1 says it is cheap once determinism exists but still a product/competitive identity call.
- [ ] Decide third-party cabinet registration spec for P2: GameRegistry fields, developer/economy settings, official score records, allowed assets, moderation, revenue split, and cabinet review process.
- [ ] Confirm future cabinet roadmap status: Lilly's Lightning and Mempool Mayhem remain Coming Soon / roadmap flavor until greenlit.
- [ ] Confirm portal branding direction: lead Litecoin/LitVM identity while architecting rails for third-party cabinets later.
- [ ] Get written brand/legal sign-off before any commercial, real-funds, Litecoin-logo-heavy, Ł-heavy, LTC-denominated, or pay-to-play launch usage.

## v2.1 recommendations accepted as active build direction unless Justin changes them

- [x] Prove a deterministic 6:30 Act I vertical slice before full 20-minute breadth.
- [x] P0 is Free Practice only; ranked/wallet submit moves to P1 after the core loop is fun.
- [x] Guest users can play Free Practice before connecting a wallet.
- [x] Chain guard runs both pre-ranked-run and at ranked submit.
- [x] Main Extraction board snapshots at 20:00; Overtime uses a separate Endless board.
- [x] Dash is P0; baseline target 250ms i-frames / 900ms cooldown with uptime cap.
- [x] Boss level-ups are queued to safe windows instead of interrupting active boss patterns.
- [x] Draft/reroll uses the deterministic sim RNG cursor only, never UI RNG.
- [x] P0 enemies: FUD Goblin, Trench Degen, Paper Hands, Rug Rat, Evil Banker, Gas Beast.
- [x] P0 skills: Damage Alpha, Rate of Fire, Street Runner, Diamond Hands HP, Magnet Wallet, Frag Yield, Cold Wallet Armor, Crit Candle, Mempool Tar, Dash Settlement, Multi-Sig Burst, Chain Lightning.
- [x] First P0 evolution: Lightning Ledger.
- [x] Warren is the first boss-system proof; Rug Pull Baron is the Act I slice capstone if capacity allows.
- [x] Practice and official score boards remain separate; assist flags are recorded and surfaced transparently.
- [x] Mock wallet is QA-only and cannot submit official ranked scores.
- [x] Future cabinets are Coming Soon cards/modals, not broken/dead links.
