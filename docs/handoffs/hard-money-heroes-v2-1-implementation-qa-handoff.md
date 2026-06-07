# Hard Money Heroes v2.1 — Implementation / QA Handoff

Status: practical build handoff after Claude Opus 4.8 Build-Risk Review v2.1.
Read first: `docs/game-design/hard-money-heroes-build-risk-review-v2-1.md`.
Content canon: `docs/game-design/hard-money-heroes-design-bible-v2.md`.

## Non-negotiable sequencing

Do not start by adding Acts II-III, ranked submit, full skill catalog, or broad art polish. The first target is a fun, deterministic, local **6:30 Act I slice** that proves Warren + Rug Pull Baron.

P0 order:

1. Deterministic fixed-timestep sim core, single seeded RNG, input log, checksums.
2. Genre guard and controls contract so the side-scroller cannot accidentally return.
3. Free/ranked official-write boundary; Free Practice writes nothing official.
4. Isometric camera, 8-way world-space movement/aim/fire/dash.
5. Slums/Foundry chunks and validated spawn/pickup lanes.
6. Six P0 enemies and threat-token director.
7. XP curve, deterministic two-card draft, reroll, 12 P0 skills, Lightning Ledger.
8. Warren mini-boss, Rug Pull Baron, MVP arena ring.
9. HUD, pause gate, boss-warning, level-up modal, death feedback.

## P0 test names to create first

- `determinism-golden`
- `fps-invariance-30-60-144`
- `genre-guard`
- `controls-contract`
- `free-write-boundary`
- `worldspace-hit`
- `dash-iframe-cap`
- `spawn-fuzz`
- `pickup-validity`
- `threat-budget`
- `tell-frame`
- `xp-curve`
- `draft-determinism`
- `no-dead-draft`
- `skill-rank`
- `cap-enforce`
- `evo-unlock`
- `arena-no-trap`
- `boss-add-budget`
- `boss-scheduler`
- `pause-gate`
- `modal-no-advance`

## P0 playable scope

Include only:

- Free Practice, fully local.
- One Slums/Foundry biome, 6-8 chunks.
- Hazards: steam grate, smelt pit, conveyor.
- Enemies: FUD Goblin, Trench Degen, Paper Hands, Rug Rat, Evil Banker, Gas Beast.
- Weapons: The Settler, Block Breaker, Litecoin Blade, Crypto Bomb.
- Skills: the 12 P0 skills in v2.1.
- Evolution: Lightning Ledger.
- Power-ups: Cold Storage, Ammo Cache, Block Breaker pickup, Cold Wallet Shield.
- Bosses: Warren first; Rug Pull Baron as capstone if capacity allows.
- UI: HUD, boss warning, pause, level-up modal, death feedback.

Exclude from P0:

- Ranked/wallet submit.
- Acts II-III.
- Full 40 skills.
- Bosses 3-10.
- Elite modifiers unless needed for internal tests.
- Achievements/leaderboards.
- Mobile controls/fullscreen polish.

## Key guardrails

- Combat math is world-space only. Rendering projection is a view concern.
- Draft/reroll uses sim RNG cursor, never UI RNG.
- Level-up during boss is queued to safe windows.
- `timeScale=0` pause gate owns timer, input, audio, projectiles, modals, and fullscreen focus recovery.
- Practice and official scores never co-mingle.
- Mock wallet is QA-only and never official.
- No real funds, mainnet path, deployment, contract transaction, recurring automation, or commercial Litecoin branding without Justin approval.

## UX migration note

The public flow should not force wallet connect before fun:

Guest arcade -> HMH detail -> Play Free immediately -> after run prompt connect to save/rank.

Ranked/Testnet uses pre-run and at-submit chain guard. Wrong-chain recovery happens in-app with `wallet_switchEthereumChain(0x1159)` and `wallet_addEthereumChain` fallback.

## LitVM constants to preserve and verify before deploy

- Network: LitVM LiteForge public testnet.
- Chain ID: `4441` / `0x1159`.
- Native gas: `zkLTC`, 18 decimals.
- RPC: `https://liteforge.rpc.caldera.xyz/http`.
- Explorer: `https://liteforge.explorer.caldera.xyz`.

Verify against official LitVM docs immediately before any deploy or real transaction flow.
