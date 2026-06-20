# Hard Money Heroes — Canon Spec

Status: **active first playable cabinet canon for Lester's Arcade**.
Last applied update: Claude Opus 4.8 Build-Risk Review v2.1, normalized into `docs/game-design/hard-money-heroes-build-risk-review-v2-1.md`.

## Authority

1. **Design Bible v2.0** remains the accepted content/design canon for genre, world, characters, enemies, bosses, skills, balance direction, and wallet semantics.
2. **Build-Risk Review v2.1** is the active implementation/QA/UX addendum. It wins for sequencing, P0/P1 scope, tests, exploit mitigations, board separation, guest/free UX, and LitVM/EVM setup matrix.
3. Persisted keys remain stable unless explicitly migrated: `gameId="lester-blaster"`, leaderboard keys, profile schema keys, achievement IDs, and score receipt/session IDs.
4. Older side-scroller material is deprecated as runtime direction and should be used only as theme inspiration or legacy compatibility.

## Identity

- Parent portal: **Lester's Arcade**.
- First playable cabinet title: **Hard Money Heroes**.
- Stable internal compatibility ID: `lester-blaster`.
- Active genre/display genre: **isometric-run-and-gun-roguelike**.
- World: **Crypto Wasteland -> Litecoin City**.
- Main playable character: **Lester**.
- Lilly: future unlockable HMH alternate hero/skin with same stats, hitbox, and moveset as Lester.
- Lilly's Lightning / Mempool Mayhem: roadmap-flavor future cabinets only until approved.
- Max Mempool: parked/non-canon.

## Current target slice

The next build target is **not** the full 20-minute game. It is a deterministic, local, Free Practice **6:30 Act I vertical slice** that proves the core loop.

P0 includes:

- deterministic fixed-timestep sim, single seeded RNG, input log, periodic checksums;
- genre/display-genre constants and side-scroll deprecation shims;
- Free Practice official-write boundary: zero official writes;
- isometric camera, 8-way movement, mouse aim, hold-fire, dash with i-frames;
- one Slums/Foundry biome with 6-8 chunks and validated spawn/pickup lanes;
- six P0 enemies: FUD Goblin, Trench Degen, Paper Hands, Rug Rat, Evil Banker, Gas Beast;
- The Settler, Block Breaker pickup, Litecoin Blade, Crypto Bomb;
- 12 P0 skills plus Lightning Ledger evolution;
- Warren mini-boss first, then Rug Pull Baron as Act I capstone;
- HUD, pause gate, level-up modal/reroll, boss warning, death feedback.

Explicitly out of P0: ranked/wallet submit, Acts II-III, bosses 3-10, full 40 skills, elite modifiers, achievements, global leaderboards, mobile controls, and fullscreen polish.

## Pitch

Hard Money Heroes is a 20-minute isometric roguelite survival shooter that now opens in the Crypto Wasteland before pushing Lester toward Litecoin City on the horizon. Lester fights escalating crypto-satire enemies, collects XP gems, pauses on level-up to choose from two upgrade options with one reroll, and builds toward a 20-minute Mainnet Express extraction win. Overtime is optional and uses a separate Endless board. Free play is local/practice only; ranked play is wallet-bound, explicit-submit, verifier-backed, official-leaderboard eligible, same-RNG, and never pay-to-win.

## Core rules

- Free movement on procedural isometric chunks, not side-scrolling.
- 8-way movement/aim/combat readability.
- Combat math is world-space; projection is rendering only.
- Controls: WASD/left stick movement, mouse/right stick aim, LMB/RT fire, Space/A/RB dash, F/Q/LT throw, R/X reload, Tab/RMB/Y reroll in draft, Esc/Start pause.
- One life per run in both modes; free mode has unlimited restarts, not infinite lives mid-run.
- Ranked and free use identical mechanics, RNG, drop tables, and seeds.
- Kills drop XP gems; XP curve target is `round(45 * 1.12^(level - 1))`.
- Level-up pauses simulation, offers exactly two upgrade cards plus one reroll, excludes maxed skills, and uses the sim RNG cursor only.
- During boss arenas, earned level-ups are queued and presented at safe windows.
- Dash is P0: baseline 250ms i-frames / 900ms cooldown; uptime must never reach 100%.
- Bosses create isometric arena rings instead of side-scroll scroll locks.
- 20:00 extraction is a real win; Overtime is opt-in and scored on a separate Endless board.

## 20-minute arc

| Act | Window | Biome/theme | Boss beat |
| --- | --- | --- | --- |
| I — Crypto Wasteland | 0:00-6:30 | Desert approach, ghost town, dry forest, roadside hub, oasis / mesa spurs | ~3:30 optional POI mini-boss; ~6:30 Rug Pull Baron |
| II — Litecoin City | 6:30-13:30 | Financial District + Penthouse Rain | ~10:00 mini-boss; ~13:30 Mr. NGMI |
| III — The Getaway | 13:30-20:00 | Mainnet Express | ~17:00 mini-boss; ~20:00 Quantum Hacker |
| Extraction | 20:00 | Board the train | Score snapshots to Extraction board |
| Overtime | 20:00+ | Continued score path | Separate Endless board |

## Enemy canon

Promoted/reconciled enemy list:

- FUD Goblin
- Trench Degen
- Paper Hands
- Rug Rat
- Gas Fee Wisp
- Crypto Bro
- Shill Bot
- Bot Swarm / Sybil Drones
- Honeypot Turret
- Gas Beast
- Evil Banker
- Phishing Angler
- Slippage Skater
- MEV Reaper
- Liquidation Cascade Golem
- Rugpull Summoner
- Orange-Pilled Zealot

Enemy pressure should scale via threat budget, ranged/elite mix, and attack-token caps rather than unreadable raw counts. P0 ships only the six simple Act I enemies listed above.

## Boss canon

- Warren the Spear Rider — first mini-boss wiring target and first arena-ring proof.
- The Rug Pull Baron — Act I capstone boss for the P0 slice if capacity allows.
- Mr. NGMI, The Influencer — Act II / Penthouse seam boss.
- The Quantum Hacker — Act III final / extraction gate.
- The Whale / Bit Whale — consolidated boss-pool entry.
- The Maximalist — mirror-duel boss, distinct from Orange-Pilled Zealot.
- Chain Reaper — boss-pool / wave-management entry.
- Sir FUD, Mt. Goxzilla, 51% Hydra, Tetherra, Gas Titan — P2 boss-pool entries.

## Scoring and boards

Drop side-scroll distance. Score rewards survival, kills, elite kills, bosses, combos, build depth, biome clears, power-ups, upgrades, coins/LTC pickups, capped no-damage, and Overtime.

v2.1 board model:

- Free Practice: local only, never official.
- Ranked Assist-Off: primary competitive board.
- Ranked Assist-On: inclusive official board with assist flags.
- Overtime/Endless: separate from Extraction.
- Daily Seed: optional P2 once determinism exists.

Score packet includes `score`, `components{}`, `biomeReached`, `sessionId`, `wallet`, `gameId`, `season`, `buildHash`, `gameVersion`, `seed`, `assistFlags`, `checksumRoot`, and `verifierSig`.

## UX canon

Guest users should be able to play Free Practice before connecting a wallet. Wallet connection should be framed as the way to save progress and go ranked, not as a toll before the first fun moment.

Recommended public flow:

1. Guest lands on Lester's Arcade / cabinet select.
2. HMH card has Play Free enabled.
3. Future cabinets show Coming Soon cards and info modal, never dead errors.
4. HMH detail screen explains premise, controls, run length, Free vs Ranked.
5. Free Practice starts without wallet.
6. After a run, prompt connect to save and go ranked.
7. Ranked Testnet requires wallet and LitVM chain guard pre-run and at-submit.
8. Ranked result requires explicit Submit Official Score.

Recommended copy:

- **Free Practice — no wallet, scores stay on this device.**
- **Ranked (Testnet) — connect wallet, official leaderboards. Testnet only — no real money.**
- **Submit Official Score — Records this run to the leaderboard via your wallet.**

## Wallet / Web3 canon

- Wallet is the parent identity key.
- Target testnet: LitVM LiteForge, Chain ID `4441` / `0x1159`, native `zkLTC`, HTTP RPC `https://liteforge.rpc.caldera.xyz/http`, explorer `https://liteforge.explorer.caldera.xyz`.
- Use EVM-compatible injected wallets first; mock wallet is local QA fallback only and never official.
- Free practice writes no official profile/score/achievement/transaction state.
- Ranked score submit is explicit at game-over, idempotent by `sessionId`, and verifier-signed.
- Chain guard runs before ranked start and again at submit.
- MVP anti-cheat: deterministic fixed-timestep sim, seeded RNG, input log, periodic checksums, final summary, server re-sim, verifier-signed score summary.
- Achievements are off-chain first; optional ERC-1155 claim later.
- No live funds, deploys, recurring automation, public launch changes, or heavy Litecoin commercial branding without Justin approval and brand/legal review where needed.

## Detailed docs

- Content/design canon: `docs/game-design/hard-money-heroes-design-bible-v2.md`.
- Implementation/QA addendum: `docs/game-design/hard-money-heroes-build-risk-review-v2-1.md`.
- Practical implementation handoff: `docs/handoffs/hard-money-heroes-v2-1-implementation-qa-handoff.md`.
- Original pivot capture: `docs/game-design/hard-money-heroes-isometric-roguelike-pivot.md`.
