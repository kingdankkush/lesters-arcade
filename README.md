# Lester's Arcade — 1.8.4 verified live: fairer HMH Ranked, two HMH freezes fixed, faster crowds, simpler STACKED effects, jackpot UI staged

Batch release after 1.8.3. Hard Money Heroes Ranked verification refuses twelve impossible run-summary combinations (grenade kills, detonations and throws beyond what the run could produce, pickups beyond what the sites, vault and events offered, activity in zero-length runs), which closes the 1.8.x path that let a fabricated summary earn five achievements in one paid run; 68 real runs of the 1.8.3 game all still pass. Ranked HMH now ignores the `?evidenceSafe` test switch, so every Ranked run starts at its seeded level entry. Two HMH freezes are fixed (a Burner or Lightning Ledger hit on the not-yet-active Liquidator, and an ammo refill while the Ledger channels). HMH crowds render faster (pooled enemy displays and a ground drawn once instead of every frame; same-seed results unchanged). STACKED's settings become one effects preset (Reduced, Standard, Full) with an automatic scene deck. The Chikun Weekly Jackpot's pages and owner review page are in, hidden behind `JACKPOT_LIVE` (false): nothing player-facing changes for the jackpot yet. Contracts, fees and flags of the live Ranked system are unchanged.

Production deployment `dpl_61u26aJuaoPMoEGthLcqp7MTUh6N` (source `4f947386`); site/game version `1.8.4`; cache marker `lesters-arcade-v57-fair-play`. The local and Vercel gates pass 5,168 of 5,219 tests with exactly 51 unchanged retired exceptions; all 160 checked public files match and `/api/health` reports healthy. [Release receipt](docs/qa/batch-release-20260926-1.8.4.json). Rollback: Instant Rollback to `dpl_BoYxVQ4rW4zyeNUuisJv88eHLFGK` (1.8.3). Continue on `fable/master-list-20260916`.

# Lester's Arcade — 1.8.3 verified live: game version on every score, 237 MB lighter, jackpot server staged

Batch release after 1.8.2. Every verified score now shows the game version it was played on (owner decision: no testnet season resets): a Version column on the Scores boards (a chip on phones), a label per run in profile history and a line on share pages. HMH build hashes gain a cabinet segment (`HMH v0.5`); earlier hashes stay valid. About 237 MB of unreferenced generated art and dead generator scripts are removed (753 files; report `docs/cleanup/unused-assets-audit-20260925.md`). The Chikun Weekly Jackpot server is in (Neon migration 3, a keeper cron that is a recorded no-op until the jackpot contract is deployed, `/api/jackpot` answering not-configured); nothing player-facing changes for the jackpot yet and `JACKPOT_LIVE` stays false. Contracts, fees and flags of the live Ranked system are unchanged.

Production deployment `dpl_BoYxVQ4rW4zyeNUuisJv88eHLFGK` (source `f890c549`); site/game version `1.8.3`; cache marker `lesters-arcade-v56-version-column`. The local and Vercel gates pass 4,951 of 5,002 tests with exactly 51 unchanged retired exceptions; all 149 checked public files match and `/api/health` reports healthy (the weekly-jackpot cron runs as a no-op). [Release receipt](docs/qa/batch-release-20260925-1.8.3.json). Rollback to `dpl_C8Zcbk2jTmKAM8ZRqWn4TwZLo33Y` needs Ranked paused first (1.8.2 refuses the new HMH cabinet build hashes). Continue on `fable/master-list-20260916`.

# Lester's Arcade — 1.8.2 verified live: leaner portal, truthful copy, jackpot contracts staged

Batch release after 1.8.1. The portal's and Chikun's first paint no longer download the 392 KB ethers library (a small built-in Keccak-256, proven byte-identical, computes the manifest hashes), and about 5,650 lines of unreachable legacy Canvas combat code and dead shell helpers are gone from `main.js` (no behaviour change). Signed-out game lines no longer claim an active session, and profiles show real bests ("Highest level", "Best combo") next to true totals. The Chikun Weekly Jackpot contracts (`WeeklyJackpot`, test token tCHIKUN) and their dry-run deploy and operator tools are in the repo but not deployed; nothing player-facing changes for the jackpot yet. Contracts, fees and flags of the live Ranked system are unchanged.

Production deployment `dpl_C8Zcbk2jTmKAM8ZRqWn4TwZLo33Y` (source `8d11971d`); site/game version `1.8.2`; cache marker `lesters-arcade-v55-lean-portal`. The local and Vercel gates pass 4,860 of 4,911 tests with exactly 51 unchanged retired exceptions; all 145 checked public files match; the live UI audit passes 234/234 and `/api/health` reports healthy. [Release receipt](docs/qa/batch-release-20260925-1.8.2.json). Rollback: Instant Rollback to `dpl_4x5CB5EfB257TzrqvuDp9qRN66mv`. Continue on `fable/master-list-20260916`.

# Lester's Arcade — 1.8.1 verified live: post-launch polish, health monitoring, faster first load

Post-launch release on top of the verified 1.8.0 Ranked launch. The owner status page (`/owner/status.html`) and the public `/api/health` report relayer balance and estimated settlements left, the settle queue, index lag, cron outcomes and the current LiteForge base fee; every server 500 now logs a redacted cause class, and both crons record their runs (Neon migration 2). The Scores and Profile route modules load on demand, cutting `dist/main.js` by about 47 KB. A read-only audit of the live site fixed keyboard focus loss in leaderboard search and tabs, the unstyled first paint of the wallet picker, other players' profile headers, low-contrast buttons, STACKED's Ranked price line, recent-run layouts and wallet capitalisation. The simulated-wallet shell banner is restored for local previews. Contracts, fees and flags are unchanged from 1.8.0.

Production deployment `dpl_4x5CB5EfB257TzrqvuDp9qRN66mv` (source `60ea173a`); site/game version `1.8.1`; cache marker `lesters-arcade-v54-post-launch`. The local and Vercel gates pass 4,809 of 4,860 tests with exactly 51 unchanged retired exceptions; all 146 checked public files match; the live UI audit passes 234/234 and `/api/health` reports healthy. [Release receipt](docs/qa/post-launch-release-20260925.json). Rollback: Instant Rollback to `dpl_D8RR6Xm9T2ZC8ZhDMrr697WW9jMu`. Continue on `fable/master-list-20260916`.

# Lester's Arcade — 1.8.0 verified live: Ranked on LitVM LiteForge

Ranked Mode is live on the LitVM LiteForge testnet for all three games. Sign in once with a wallet (MetaMask and Rabby featured, WalletConnect on phones), pay a 0.102 zkLTC entry (0.1 zkLTC fee split 85% developer / 15% arcade, plus a 0.002 zkLTC settlement reserve), and the run starts as soon as the entry is broadcast. The arcade server checks every Ranked run (Chikun's Escape and STACKED are replayed from their inputs; Hard Money Heroes is plausibility-checked) and its relayer publishes the verified result to `ScoreSubmissionRegistry` on chain. A shared results screen follows the run on chain to "Published" with an explorer link, then offers X-first sharing (mentioning @LestersArcade, no hashtags) with a public session page and a generated score card.

Every wallet has a public profile with an on-chain display name and avatar (`PlayerProfileRegistry`), verified bests, runs and achievements, and the Scores page ranks the best verified run per wallet on Weekly, Monthly and All-time boards from the Neon index. 137 achievements (57 Hard Money Heroes, 40 Chikun's Escape, 40 STACKED) are derived and recorded by the server from verified runs; soulbound NFT minting is phase 2. Chikun's Escape is retuned to the owner's 2 to 12 minute run-length targets, and earned achievements unlock cosmetic looks in every game.

Contracts (LiteForge, chain 4441, start block 54207405): GameRegistry `0xcb0b695ebee650afcce93f566259cb477b19bf23`, PlayerProfileRegistry `0x3eb9e9f2620940496a2b8ed6f7384e6687587c94`, ArcadeRankedEntry `0x10cd09e694e2b2cd70d37f8cdddcda3ef1208190`, ScoreSubmissionRegistry `0xc5c5949a02fac9a4115df182672c0f8ceb0eaf55`, achievement collections `0xc1a383cb7521978f429424443fdd69bdd71ff737` (HMH), `0xf6cd1cf7e1accaea93accdfb911034b3e8eb6f93` (Chikun), `0x5430f8c142ca7ec8971a447cc09ae63f8860a8a7` (STACKED). Site/game version `1.8.0`; cache marker `lesters-arcade-v53-ranked-launch`. Production deployment `dpl_D8RR6Xm9T2ZC8ZhDMrr697WW9jMu` (1.8.0 launch `dpl_4CwRv1Qg1ZMNcYN5QbbNDEvMsz1T` plus a config-only fix giving the chain-index cron 300 s); runtime source `de2e6733` on `fable/master-list-20260916`. The local and Vercel gates pass 4,715 of 4,766 tests with exactly 51 unchanged retired exceptions, and all 140 checked public files and chunks match the certified local build. A live Ranked run per game settled on chain through the relayer (HMH `0x8069bb65…`, Chikun `0xe66dd1bb…`, STACKED `0x1cd3b88c…`) and reached the Neon index, the boards, the profile and the share page and card; the owner-funded test wallet is excluded from the public boards. [Release receipt](docs/qa/ranked-launch-release-20260924.json). Rollback: Vercel Instant Rollback to `dpl_2Q1MYFG9YQWypPjs84VLKdTkwdsu` (1.7.0) and the pause levers in `docs/web3/contract-overhaul-20260916.md`. Continue on `fable/master-list-20260916`.

# Lester's Arcade — 1.7.0 verified live: owner question round applied across all three games

Hard Money Heroes: every held weapon is now a real modelled gun rendered through the same Blender path as the pistol, so shotgun, minigun, launcher, rail, arc rifle, burner and the war fork sit in each hero's hands per pose. Three more gated destinations reward exploration (Liquidity Haven, Litecoin Sanctuary with the Scrypt Cache, the Liquidation Trap). The Railgun loses damage along its lane (35% at maximum range), silver coins count toward score, a brief bold banner names every pickup and world interaction, gunfire throws physics blood that lands as splats while explosives, the rail, pellets and hazards dismember, and the desktop mouse wheel zooms between 0.7x and 1.1x of the readable default.

Chikun's Escape: the character is regraded to the original sheet (white feathers, crimson crest, glowing mint eyes, black coat with red lining) with idle, steep climb and dive and per-obstacle hit poses, and the course is one looping level: farmland, forest, town, city, industrial, suburbs, coast and straight back into farmland with speed still rising. STACKED: three music-reactive backdrop scenes with a section director, a board frame and piece glow that follow the beat, and a rebuilt menu, mode tiles, grouped settings and results.

Portal and Web3 (owner decisions 2026-09-16, `docs/handoffs/owner-decisions-20260916.md`): the global Scores page has per-game banners, filters, search, sortable columns and jump-to-my-rank; the Ranked modal lists the flat 0.1 zkLTC fee, the settlement gas reserve and the quoted total. Hosted services ship dark: `/api/session`, `/api/profile` and `/api/settle` fail closed (503) until the Vercel secrets exist, the browser only calls them once `HOSTED_PROFILE_SYNC` is flipped, `SETTLEMENT_LIVE` remains false and no contract is deployed.

Runtime source `69144aad` on `fable/master-list-20260916`; production deployment `dpl_2Q1MYFG9YQWypPjs84VLKdTkwdsu` (promoted from candidate https://lesters-arcade-c355nyc8n-justin-agent-projects.vercel.app); immutable build https://lesters-arcade-nnbuoiuh3-justin-agent-projects.vercel.app; site/game version `1.7.0`; cache marker `lesters-arcade-v52-owner-round`. The local and hosted gates pass 3,892 of 3,943 tests with exactly 51 unchanged retired exceptions. All 102 checked public files and chunks match the certified local build and `/api/attest`, `/api/session`, `/api/profile` and `/api/settle` fail closed (503). Live browser smokes pass for the weapon wheel, held weapons, Chikun Ranked and STACKED. Retained rollback: `dpl_7PT1JEqXYgS4jFjZvip2cMKsACMq`. [Release receipt](docs/qa/master-list-release-20260917.json). Continue on `fable/master-list-20260916`.

# Lester's Arcade — 1.6.0 verified live: weapon wheel, sharing, Web3 groundwork

Hard Money Heroes now has one manual weapon control: **Q** (or **E**), the right bumper, or the touch **SWAP** button cycles the weapons you carry, and **Tab** or tapping the armed-weapon card in the cockpit opens a weapon wheel that freezes the run while you pick. The pistol is always one press away, so a rare gun can be held back for the Liquidator. The Railgun is now a lane weapon: one slug passes through up to six bodies (seven with Deep Proof, eight as the Settler Rail), remembers what it already hit, and stops only on cover, range, or its body budget. Bosses take the same high hit without dying to it.

All three games now share an end-of-run share row (X, Facebook, Discord copy and the native share sheet) with score and session stats. Hard Money Heroes' authored props render at twice their previous pixel density so they stop upscaling at gameplay zoom.

Web3 groundwork (owner direction 2026-09-16): Ranked Mode is priced at 0.1 zkLTC in the LitVM native token, wallet login now verifies the signed challenge and Ranked refuses an unsigned session, the settlement plan pays a native entry before the run and settles through an EIP-712 verifier attestation, and `/api/attest` signs attestations once `VERIFIER_PRIVATE_KEY` is configured. The June contracts are replaced in source by a native-fee, soulbound-achievement set (`docs/web3/contract-overhaul-20260916.md`). `SETTLEMENT_LIVE` remains false and nothing is deployed: the fee is disclosed, never charged, until the owner deploys the hardened contracts and enables settlement.

Runtime source `81a03ef6` on `fable/master-list-20260916`; production deployment `dpl_7PT1JEqXYgS4jFjZvip2cMKsACMq` (promoted from candidate `dpl_AkmKkzZKqr7scPMDe5ACU6J7tKVT`); immutable build https://lesters-arcade-hrxxa0m5v-justin-agent-projects.vercel.app; site/game version `1.6.0`; cache marker `lesters-arcade-v51-weapon-wheel`. The local and hosted gates pass 3,791 of 3,842 tests with exactly 51 unchanged retired exceptions. All 97 checked public files and chunks match the certified local build and `/api/attest` fails closed (503, verifier not configured). Retained rollback: `dpl_Gnf2tetZUqK5fsfH7Pgcy4gERe7B`. [Release receipt](docs/qa/master-list-release-20260916.json). Continue on `fable/master-list-20260916`.

# Lester's Arcade — completed updates verified live

The homepage and game browser redesign, HMH mobile optimization and world presentation, Chikun mixed flight passages, and STACKED mobile aquatic music visuals are live at https://lestersarcade.io. Chikun's repeating white-noise ambience is removed, and town, forest and canopy collisions now produce normal results and allow another run.

Runtime source `a0e6b2a5866f13c5cf3ee2a78070e9281d679b71`; deployment `dpl_Gnf2tetZUqK5fsfH7Pgcy4gERe7B`; site/game version `1.5.1`. The hosted gate passes 3,760 of 3,811 tests with exactly 51 unchanged retired exceptions. All 98 public file and route hashes match. Public desktop and 414×896 touch-layout checks cover all three collision types, exact replay results, retries and action audio with zero looping sources or runtime errors. Returning-cache migration from v49 to v50 passes. [Release receipt](docs/qa/chikun-fixes-release-20260914.json). Retained rollback: `dpl_14Wqtwjo1XZbCb6ne13cgovTd7hF`. Continue on `codex/mobile-worlds-aquatic-20260914`. Physical-device acceptance and the broader roadmap remain open.

## Homepage and discovery — preceding release

The redesigned [homepage](https://lestersarcade.io) and [cabinet browser](https://lestersarcade.io/games) are live. Existing films and artwork introduce the arcade, Free play, wallets, profiles and device-local leaderboards. All three active cabinets have equal visible height across all rotation frames, with dedicated game guides and clearer play entry. Search metadata, static page content, structured data, sitemap and a factual AI reference are included.

Runtime source `6fe83eb693bda5c36cb77f995b88d244515365f8`; deployment `dpl_6bgHFQsaZ6smUdqFNRzhc7FrsenJ`. The local and cloud release gates pass 3,742 tests with exactly 51 unchanged retirement exceptions. All 107 private/public file and route hashes match. Twenty discovery checks and seven accessibility scans pass in each environment; all three games and the returning-cache transition pass. [Release receipt](docs/qa/arcade-discovery-release-20260914.json) · [Design and verification](docs/qa/arcade-discovery-design-20260914.md). Retained rollback: `dpl_HVFN3wwuWmveoWa4CVk8b1dAnovU`. Continue on `codex/arcade-home-catalog-20260914`.

**Production cache marker:** `lesters-arcade-v57-fair-play`

# Lester's Arcade

A retro Litecoin and LitVM arcade portal with deterministic child games and approval-gated Web3 publishing.

**Repository:** https://github.com/kingdankkush/Lesters-Arcade

**Production:** https://lestersarcade.io

## Combined gameplay update — live predecessor

HMH adds seven objective-owned rewards, pause-aware supply restocks, native silver collectibles and barriers, clearer weapon names, earned hero recruitment and interaction sounds. Chikun 0.7.0 adds grounded running, jumps, flight/landing transitions, varied ground/air hazards, impact ragdolls and replay save/open. STACKED adds desktop music worlds, bounded mobile gameplay particles, richer practice medals, accessibility preferences and factual local profile counters. Startup limits remain unchanged. Source `bfcba824629c33f099af0084a398acdacfc358bd`; deployment `dpl_HVFN3wwuWmveoWa4CVk8b1dAnovU`. All 202 private/public file hashes and the cloud/browser release checks passed. [Release receipt](docs/qa/combined-gameplay-release-20260914.json). Retained rollback: `dpl_BRuxtwazwPp2LNeSxRyH1scfsQgS`. Physical-device acceptance and the broader roadmap remain open.

Preceding cache marker: `lesters-arcade-v47-combined-gameplay`.

## Preceding combined arcade release — verified live

All three completed game upgrades are live. HMH world polish is preserved; STACKED adds its rotating cabinet and music-reactive living visualizers; Chikun 0.6.0 adds open-air obstacles, portrait/fullscreen presentation, high-refresh input and shared music fixes. The shared player now reuses unchanged icons and queue nodes to eliminate repeated SVG requests. Source `dcc22ae442d68e4c2ec73d21c3e8c1079ed52a25`; deployment `dpl_BRuxtwazwPp2LNeSxRyH1scfsQgS`. All 163 public hashes and the desktop/mobile/browser/cache checks passed. [Release receipt](docs/qa/combined-arcade-release-20260913.json). Immediate rollback: `dpl_4AiDLsq5Kngz4rtjQWj6u6i9kz7P`.

Preceding cache marker: `lesters-arcade-v44-music-controls`.

Independent completion handoffs: [Hard Money Heroes](docs/handoffs/HARD-MONEY-HEROES-REMAINING-WORK-2026-09-13.md), [STACKED](docs/handoffs/STACKED-REMAINING-WORK-2026-09-13.md), and [Chikun's Escape](docs/handoffs/CHIKUN-ESCAPE-REMAINING-WORK-2026-09-13.md). Each separates completed foundations, remaining tasks, acceptance evidence and separately authorized Web3 activation.

## HMH world polish — live predecessor

Finer forest and concrete materials, smoother terrain edges, varied canopy composition, industrial ground wear and animated campfire flames are live. Source `a3b2b0299b5617636f144fcb3936bac4a87e19d6`; deployment `dpl_F4d723CFGYcZDANn1rNU6Avz3cV7`. All 151 public file hashes and the HMH, STACKED and Chikun browser flows passed. [Release receipt](docs/qa/hmh-world-polish-release-20260913.json) · [Changes and remaining work](docs/handoffs/2026-09-13-hmh-world-polish-release.md). Immediate rollback: `dpl_8GPLKXJspe9EwDyUensJ7VaayKJ7`.

**Production cache marker:** `lesters-arcade-v41-hmh-world-polish`

## Previous HMH motion and mobile release

The previous update added four hero motion pages, the six remaining native enemy animation atlases, breakable supply caches, fuel chain reactions, refined weapon sounds and a collision optimization for crowded mobile play. It preserves the live Chikun Superman flight update (`9d14b18c`) and STACKED public beta (`98204a1c`). The owner requested publication after testing. See the [HMH release handoff](docs/handoffs/2026-09-13-hmh-motion-mobile-release.md) for measured performance, verification and unfinished polish. Previous deployment `dpl_8GPLKXJspe9EwDyUensJ7VaayKJ7` served runtime source `0e858cde582f10be767c170de6f7f2588cf4e977`. All 122 public file hashes, desktop/mobile portal flows, five STACKED layouts, Chikun desktop/mobile and cache migration passed. [Release receipt](docs/qa/hmh-motion-mobile-release-20260913.json). Immediate rollback: `dpl_6XGH4jJa5NRDT7u33cpsxpMHSHHd`.

STACKED remains playable through the normal cabinet selector. Ranked Game is device-local and replay-verified, with no fees, prizes or online ranking. See [STACKED status](docs/stacked/STATUS.md). Physical-device acceptance and further polish remain open for all games.

## Chikun Superman flight

Chikun's Escape now uses eighteen Blender-authored actions built around horizontal Superman flight, smooth pose transitions, coat and crest wind, trees and drone-guarded airspace alongside industrial gates. The layered city, mountain scenery, day/night cycle and original flight sounds remain. The [Flight Room](https://lestersarcade.io/chikun/flight-room.html) lets players explore every animation.

**Previous Chikun cache marker:** `lesters-arcade-v37-chikun-afterlight`

**Previous production (rollback):** deployment `dpl_TFj74rNbMiBdu2p5JbrL9UQNqNFi`, runtime source `d7a5ad691b2fe3f34f4453b5bc39429ec2648042`. The [release receipt](docs/qa/chikun-afterlight-release-20260913.json) records the passing cloud gates and public desktop/touch-phone flows.

The revision is on `codex/chikun-superman-flight`. See the [Superman flight handoff](docs/handoffs/chikun-superman-flight-20260913.md) for implementation and verification. The prior Afterlight release is documented below. The [Chikun handoff](docs/handoffs/chikun-afterlight-20260913.md) records the scope and verification. Retained rollback: `dpl_H8HskA2fttzXpdVHc8GyAcXccd9g` ([immutable URL](https://lesters-arcade-r4w9nitiu-justin-agent-projects.vercel.app)). Canonical simulation and parent Ranked verification are preserved; `SETTLEMENT_LIVE=false`.

## Previous HMH package release (historical)

- **Source:** `1a8d4f420767f32ef97ca7952b782dce284242f0`; branch `fable/hmh-roadmap-pass-20260911`, cut from canonical `hermes/hmh-textured-rollout` at `b0ee9046`.
- **Production deployment:** `dpl_H8HskA2fttzXpdVHc8GyAcXccd9g` ([immutable URL](https://lesters-arcade-r4w9nitiu-justin-agent-projects.vercel.app)). The custom domain was read back against this exact Ready deployment.
- **Verified Preview:** `dpl_5T7VRjDCzQSo6rVEtky7cLkLRGHT` ([immutable URL](https://lesters-arcade-4qmus1ex0-justin-agent-projects.vercel.app)).
- **Retained rollback:** `dpl_E6U69q1pgn6LTw5LGdtgayXMJhyg` ([immutable URL](https://lesters-arcade-mgh1j0kip-justin-agent-projects.vercel.app)), source `cad94e7d684c450d28052de87821fc9afc5f281c`.
**Production cache marker:** `lesters-arcade-v36-hmh-package`
- **Verification:** Local `npm run vercel:build` and the Preview cloud build each passed the unchanged release gate: 3,451 tests, 3,400 passed, exactly 51 documented retirement exceptions, syntax (520 modules, 86 scripts), assets and contract structure; the promoted production build reran the same chain to Ready. All six mutable entry files read back from the public alias match the local build byte for byte; the service worker serves `lesters-arcade-v36-hmh-package`. Both portal smokes passed against production. Initial child JS 1,041,489 B of 1,048,576 B.

The combined overhaul is playable. This release adds reload presentation, enemy hit feedback, simulated Level 1 hazards, the game-over run recap and power-up timer chips on top of the insertion-point briefing; full human/device acceptance, world/animation polish, detailed enemy-crop repeatability and the brief initial atlas-loading fallback remain open. `SETTLEMENT_LIVE=false`; financial activation remains separately gated. STACKED stays paused.

[Current release receipt](docs/qa/hmh-roadmap-package-release-20260912.json) · [Roadmap reconciliation and agent scope](docs/handoffs/hmh-roadmap-reconciliation-20260911.md) · [Briefing evidence](docs/qa/hmh-roadmap-briefing-evidence-20260911.json) · [Contribution and task reconciliation](docs/handoffs/hmh-release-reconciliation-20260911.md) · [Complete polish backlog](docs/handoffs/hmh-playable-release-and-polish-backlog.md)

The [preceding release receipt](docs/qa/hmh-roadmap-pass-release-20260911.json) retains the briefing-pass evidence, the [quality-pass receipt](docs/qa/hmh-quality-release-20260911.json) the Hermes quality pass, and the [consolidated release receipt](docs/qa/hmh-consolidated-release-20260911.json) the earlier combined release. Earlier Cycle 077/080 claims are [historical](docs/handoffs/hmh-readme-release-header-before-20260910.txt). Continue from `hermes/hmh-textured-rollout` plus this branch; the retained task snapshot and full backlog preserve unfinished work.

---

## Current game roster

| Cabinet | Game ID | State | Summary |
| --- | --- | --- | --- |
| Hard Money Heroes | `lester-blaster` | Playable release; polish ongoing | Deterministic PixiJS top-down 2.5D roguelike run-and-gun with authored world, four production heroes, enemies, boss, progression, desktop/mobile/controller controls, and parent portal integration |
| Chikun's Escape | `chikun` | Public playable, Ranked-eligible (`0.9.0`) | Ground and flight gameplay through Cabinet SDK v1, with deterministic parent-seeded replay, a parent-owned daily UTC course, versioned local daily-best comparisons, replay save/open, and bounded impact presentation. Asset rights, `devWallet`, and revenue split remain open — see below |
| STACKED | `stacked` | Public playable beta (`0.2.0`) | Music-reactive falling-block game; Free practice, starting levels, touch/keyboard/controller input, replay-verified device-local Ranked preview, Free medals and restart. No fees, prizes or online ranking; physical-device review and polish remain open |
| Future cabinets | Various | Coming Soon | Portal expansion slots, not production commitments until separately approved |

---

## Product direction

Lester's Arcade is the parent account and cabinet platform. It owns:

- Wallet discovery and login.
- Player profiles and character preferences.
- Free and Ranked mode boundaries.
- Canonical session IDs, seeds, evidence, and finalization.
- Official session history.
- Daily, weekly, monthly, yearly, and all-time leaderboards.
- Achievements and profile progression.
- Analytics.
- Contract reads and player-signed transactions.
- Settlement policy.

Child games own gameplay simulation and presentation. They do not request wallets, send transactions, grant official progress, or decide settlement.

### Hard Money Heroes vision

The active HMH direction is a deterministic top-down 2.5D roguelike run-and-gun with:

- Precise keyboard/mouse, controller, and touch controls.
- Authored districts, loops, landmarks, hazards, and boss arenas.
- Controlled deterministic enemy pressure instead of random scatter.
- Truthful projectile, collision, elevation, damage, and telegraph behavior.
- Human survivors and zombies, never animal, vehicle, robot, mech, or abstract actor proxies.
- Reference-faithful detailed Blender characters derived from approved illustrated sheets and combat sprites.
- Ordinary enemies at comparable human scale, with forgiving projectile hurtboxes tuned in separate deterministic gameplay cycles.
- Deep weapons, upgrades, build synergies, bosses, achievements, and ethical replayability.
- Projection-only animation, VFX, audio, interpolation, and quality scaling.
- 60 FPS desktop and 30 FPS mobile targets with 100+ enemy pressure.
- Parent-owned profiles, sessions, leaderboards, and future verified LitVM publication.

The ongoing roadmap and certification history are maintained in [docs/handoffs/](docs/handoffs/).

---

## Major updates

## Chikun's Escape integration

Chikun entered the project through platform-extensibility work, a third-party source handoff, and Cabinet SDK integration.

Implemented:

- Canonical cabinet manifest and loader.
- Rotating transparent cabinet artwork.
- Free and Ranked-preview mode configuration.
- Fixed 60 Hz deterministic flap simulation.
- Bounded input evidence.
- Parent-provided Ranked seed, build hash, and season binding.
- Canonical replay and result verification.
- Fail-closed missing mode configuration.

Chikun launched publicly in [`54aab311`](https://github.com/kingdankkush/Lesters-Arcade/commit/54aab311a813bf4d5ce622d54633ade32dd24bf1) on 2026-08-11, which is an ancestor of the deployed production source. The cabinet is `status: 'playable'` with `publicPlayable: true` and `rankedEligible: true`, and the portal serves it at `/play/chikun`. It is the working proof that third-party Cabinet SDK onboarding produces a shippable cabinet.

Shipped since the public launch, integrated 2026-08-19:

- **Parent-owned daily course.** The parent issues one UTC daily seed, so every Free run on a given day races the same forks and a remount does not reroll the course. Ranked session seeds stay unique and parent-issued. This is a shared course, not an official Daily Seed leaderboard; official boards remain an owner product decision.
- **Same-seed ghost.** A translucent projection of the player's best local flight on that seed. Projection only: it has no collision, no score contribution, and no Ranked write.
- **Seek-safe animated replay viewer.** `Watch Replay` on the result screen plays the just-submitted flap log back on the live canvas at 60 Hz, with a scrubbable timeline, 15-tick arrow-key nudges, and space/tap pause. Reduced motion parks on the crash frame rather than autoplaying. The canonical score is already final and the viewer cannot change it.

Current canonical files:

- `apps/chikun/src/main.mjs`
- `apps/chikun/src/replay-viewer.mjs`
- `apps/portal/chikun/`
- `apps/portal/src/chikun-daily-challenge.mjs`
- `apps/portal/src/chikun-cabinet.mjs`
- `apps/portal/src/chikun-host.mjs`
- `apps/portal/src/chikun-bridge.mjs`
- `apps/portal/src/chikun-bridge-protocol.mjs`
- `apps/portal/src/chikun-portal-lifecycle.mjs`
- `apps/portal/src/games/chikun/loader.mjs`
- `apps/portal/games/chikun/game.manifest.json`
- `apps/portal/games/chikun/main.mjs`
- `apps/portal/assets/generated/chikun-cabinet/`
- `apps/portal/assets/generated/chikun-mode-select/`
- `apps/portal/assets/generated/chikun-game/`

The historical full React/Supabase source handoff was vaulted out of the active tree and remains inspectable in commit [`51def63a`](https://github.com/kingdankkush/Lesters-Arcade/commit/51def63af5ebbc84bab3b0dd51273d5c805b47b5) and [PR #2](https://github.com/kingdankkush/Lesters-Arcade/pull/2). It must not be restored without reconciling current parent authority, deterministic replay, security, persistence, and bundle constraints.

What shipped is the `0.5.0` vertical slice, not the creator's full original game. These remain open and must not be described as settled:

- Public approval and written commercial-use, modification, hosting, and redistribution rights for the creator's source art are pending (`docs/THIRD_PARTY_GAME_ONBOARDING.md`).
- `devWallet` is `null` in both `game-registry.mjs` and `game.manifest.json`, so third-party revenue routing is unwired.
- The registry revenue split is a skeleton and `entryFeeMicroUsdc` resolves to `DEFAULT_ENTRY_FEE_MICRO_USDC = 0`. No paid entry is live.

## Hard Money Heroes reboot

HMH moved away from the older monolithic Canvas/isometric/procedural prototype into a separate deterministic PixiJS child application.

The reboot now includes:

- PixiJS `8.19.0` renderer.
- Fixed 60 Hz simulation and four-step catch-up cap.
- Secure same-origin sandboxed iframe host.
- `hmh-bridge/v1` parent/child protocol with a 65,536-byte cap.
- Movement, aim, dash, touch, gamepad, collision, and elevation.
- Weapons, projectile physics, melee, grenades, combat events, lifecycle, and audio.
- Six enemy families and a deterministic encounter director.
- Liquidator boss logic.
- Authored Level 1, The Forked Frontier.
- Six districts, loops, bridge, water, ramps, ledges, hazards, POIs, minimap, and reveal data.
- Run progression and cockpit UI.
- Four approved production hero atlases.
- Production world and enemy projection layers.
- Parent-owned profile, session, leaderboard, and settlement integration.
- Release certification, Chrome/Edge matrices, security gates, network audits, soaks, and artifact-verified previews.

### AAA cycles 001-070

The bounded cycle ledger is the authoritative implementation history. Highlights:

- Cycles 001-003: observability, fixed-step input buffering, collision safety, and permanent portal E2E coverage.
- Cycles 004-006: deterministic combat/boss integrity, progression depth, production hero art, and the authored human/zombie enemy roster.
- Cycles 007-010: complete authored art integration, ledge combat correction, world composition, and bounded projectile recovery.
- Cycles 011-015: truthful Liquidator telegraphs, responsive mobile HUD, four animated hero selectors, district landmarks, and nine deterministic authored-POI collectibles.
- Cycles 016-018: grenade danger warnings, responsive upgrade disclosures, and truthful pause/settings/current-build presentation.
- Cycles 019-021: isolated desktop/mobile soaks, restart-race correction, deploy-build reproducibility, animated district signals, and Cycle 021 production promotion.
- Cycles 022-023: authored terrain materials and instantly identifiable pickup/POI models.
- Cycle 024: shared projection and detailed character/enemy body geometry.
- Cycle 025: four-control mobile layout plus five deterministic weapon capstones.
- Cycle 026: one shared light rig, mobility upgrades, and clearer current-build progression.
- Cycle 027: Forkrunner/Gas Bomber role equipment, collision-readable enemy projection scale, stable desktop/mobile roster preview, and current-candidate browser certification.
- Cycle 028: user-reference model contract for all four heroes, a 48-part Lester combat rebuild, reproducible four-hero atlas/selector regeneration, and corrected production-hero mobile/asset certification rails.
- Cycles 029-031: reference-faithful Blender rebuilds for Lilly, Lit Commando, and Lit Valkyrie.
- Cycles 032-036: projection-only zombie scale parity, forgiving deterministic hurtboxes, Bagholder Rusher and Whale Enforcer close-range readability, Liquidator Agent and Validator Cultist role art, and mobile weapon access with truthful reload/switch/overheat readability.
- Cycles 050-053: authored-nav chokepoint pressure for the heavy role, 128-body attack-token and low-FPS safety evidence, serial desktop/mobile real-browser endurance certification, and exact visual-baseline authority reconstruction.
- Cycles 054-057: the production mobile-character-start hotfix merged into continuation without promotion, the deterministic Liquidator no-hit/baseline/high-DPS/low-DPS build matrix, non-vacuous 128-body browser projectile probes, and README/agent-policy reconciliation against deployed source truth.
- Cycles 058-061: Liquidator melee-heavy and crowd-control matrix completion, height-aware authored-cover counterplay, fixed-tick production phase art and audio, and deterministic Margin Call safe-sector rotation.
- Cycles 062-065: navgrid-validated flanker lanes, the canonical Precision Ledger crit-upgrade benchmark routed through the live combat resolver into Liquidator damage, navgrid-validated ranged-role backoff and strafe lanes, and Precision Ledger selection through real Coin Blaster cadence.
- Cycles 066-067: bounded timed-power-up refresh telemetry with Liquidator-safe nuke lifecycle certification, and one shared fixed-tick timed-effect countdown driving the desktop HUD, the mobile HUD, and `aria-live` accessibility wording from a single source.
- Cycle 068: projection-only Time Dilation/Berserk silhouette and audio identity recovered onto current integration, followed by exact candidate review, full serial certification, and live production proof for HMH and Chikun.
- Cycle 070: portal-owned pause-only soundtrack transport with accessible seek/volume/queue controls, a non-overlapping desktop sidecar, a contained portrait-mobile launcher/drawer, MCP 1/2 PixelLab owner-script compatibility, exact Preview proof, and live desktop/mobile production verification.
- Cycle 071: canonical `bruiser` encounter-role truth, exported projectile budgets clamped to the live 128-projectile authority, direct cross-band tests, and source-backed reconciliation of the Fable roadmap.
- Cycle 072: the gameworld facelift. Terrain rebaked as lit micro-terrain with the 67-pixel tile grid removed, roads without the black outline, shore and scree edge bands, ground contact shadows, a real in-game HUD with developer telemetry behind `?debugHud=1`, the encounter director decoupled from the render camera, and the external-model import path for owner-supplied GLB/FBX actors.
- Cycle 073: relit enemies under the shared EEVEE rig with a repaired reproducibility gate, per-weapon combat VFX and surface-typed impacts, the grenade feedback set, tiered level-up cards with keyboard and gamepad selection and an SFX slider, ledge fronts and rock cliffs so height reads as height, a denser world with twelve spawn-point camps, source-model LFS policy, certification warm-up, chunked navgrid readiness, and a fix for stray arc lines that had shipped in the hashwood scenes.
- Cycle 074: honest bundle accounting that finally counted the hoisted shared chunks and a trimmed Pixi vendor that brought true initial JavaScript from over the cap to 993 KB, a deterministic per-district atmosphere layer, encounter framing and dash, hit and level-up beats, exaggerated enemy tells with silhouette accents and a redesigned elite treatment, crisp 384 px character-select turntables, composed landmark set-pieces with a ford band and fenced yards, a hero atlas format decision memo, and twelve weapon cues that had been silent since August now routed through the portal registry.

See the [reconciled AAA roadmap](docs/hmh-reboot/AAA-ROADMAP.md), [reference-derived character model brief](docs/hmh-reboot/REFERENCE-CHARACTER-MODELS.md), [continuous-improvement ledger](docs/hmh-reboot/AAA-CONTINUOUS-IMPROVEMENT.md), [Cycle 074](docs/hmh-reboot/cycles/CYCLE-074.md), and the [current live-release handoff](docs/handoffs/2026-08-20-lesters-arcade-hmh-chikun-live-release.md).

---

## Current release status

Cycle 075 is live and verified. Runtime implementation `d53ed420`, deployed source `d70ad060`, production `dpl_7Ge2KAXfiSTFEzanHt6DLM6diafg`. Earlier mixed Cycle 070/071 metrics are historical.

[Cycle 075](docs/hmh-reboot/cycles/CYCLE-075.md) shipped bounded feedback/UI optimization and source-reference foundations. All 34 checked Preview and public artifacts match the clean build.

- Release branch: `hermes/hmh-cycle-075-reference-heroes`, based on the verified Cycle 074 handoff `0199035a`.
- Retained rollback: `dpl_6eQiyfLKrCT5aLWRjivcTGQuqWbR` at https://lesters-arcade-276x61nsi-justin-agent-projects.vercel.app.
- Local responsive, touch, performance, visual, cockpit and enemy/boss gates passed. Hosted actual kill feedback and public network checks passed; the full host ledger has 2,512 passed and the same 51 accepted legacy failures.
- Completed source-reference foundations are not active art replacements. New Commando/grenade source experiments remain unapproved local WIP; all other hero/weapon art gates remain open.
- Tripo reference upload and use of the owner's existing subscription credits are authorized. No confirmed Tripo job or credit spend is recorded. Additional purchases, contracts, real funds and settlement remain separately gated.
- Chikun remains `0.5.0`, public playable and Ranked-eligible; its existing rights/dev-wallet/revenue boundaries above are unchanged.

Verified identities, evidence and remaining work are recorded in the [release handoff](docs/handoffs/2026-09-06-hmh-cycle-075-hermes-handoff.md).
---

## Architecture

```text
Browser
└── Lester's Arcade parent portal
    ├── Wallet/profile/session/leaderboard authority
    ├── Local persistence and canonical evidence
    ├── LitVM chain client, disabled writes by default
    └── Sandboxed HMH iframe
        └── PixiJS child runtime
            ├── Fixed-step simulation
            ├── Input/movement/collision/elevation
            ├── Combat/enemies/boss/progression
            └── Projection-only rendering and audio
```

### Core directories

```text
apps/
├── hmh-reboot/              PixiJS HMH child runtime and editable Blender sources
└── portal/                  Parent portal, child host, profiles, sessions, leaderboards, assets

contracts/
├── src/                     Solidity contracts
├── artifacts/               Compiled artifacts
├── deploy-config.testnet.json
└── deployment-record.json   June legacy deployment record

docs/
├── handoffs/                Agent handoffs
├── hmh-reboot/              Reboot design, evidence, certificates, cycle records
├── qa/                      Generated audits
└── web3/                    LitVM specs, readiness, hardened dry-run manifest

sdk/
└── hmh-bridge-protocol.mjs  Parent/child protocol contract

scripts/                     Build, QA, browser, asset, contract, and audit tooling
tests/                       Node and contract-facing regression suites
```

### HMH active code

```text
apps/hmh-reboot/src/
├── main.mjs
├── simulation.mjs
├── input.mjs
├── movement.mjs
├── aim.mjs
├── dash.mjs
├── collision.mjs
├── elevation.mjs
├── world-space.mjs
├── weapon-system.mjs
├── projectile-physics.mjs
├── melee.mjs
├── grenades.mjs
├── enemy-archetypes.mjs
├── enemy-simulation.mjs
├── enemy-combat.mjs
├── encounter-director.mjs
├── liquidator-boss.mjs
├── level-one-world.mjs
├── run-progression.mjs
├── collectible-system.mjs
├── liquidator-telegraph-renderer.mjs
├── authored-prop-atlas.mjs
├── combat-audio.mjs
├── hud-layout.mjs
├── production-hero-atlas.mjs
├── enemy-production-art.mjs
├── world-production-art.mjs
└── runtime-performance.mjs
```

### Parent platform code

```text
apps/portal/src/
├── arcade-core.mjs
├── persistence.mjs
├── session-integrity.mjs
├── leaderboard-engine.mjs
├── hmh-profile-parity.mjs
├── wallet-auth.mjs
├── settlement.mjs
├── litvm-chain-client.mjs
├── hmh-reboot-host.mjs
├── hmh-reboot-bridge.mjs
└── hmh-reboot-portal-lifecycle.mjs
```

---

## Production art

Editable Blender sources:

- `apps/hmh-reboot/assets/source/blender/hmh-character-template.blend`
- `apps/hmh-reboot/assets/source/blender/hmh-commando-concepts.blend`
- `apps/hmh-reboot/assets/source/blender/hmh-production-heroes.blend`

Production hero atlases:

- `apps/portal/assets/generated/hmh-reboot-production-heroes/lit-commando/`
- `apps/portal/assets/generated/hmh-reboot-production-heroes/lit-valkyrie/`
- `apps/portal/assets/generated/hmh-reboot-production-heroes/lester-original/`
- `apps/portal/assets/generated/hmh-reboot-production-heroes/lilly/`

Do not restore retired assets under `apps/portal/assets/generated/hmh-isometric-pixellab/` or use mannequin/prototype actors as final production art.

---

## Profiles, sessions, leaderboards, and Web3

### Functional now

- Local wallet-normalized profiles and preferences.
- Canonical session IDs, seed, build hash, season, evidence, and envelope hashes.
- Active session checkpoints and local run history.
- Free versus Ranked persistence boundaries.
- Daily, weekly, monthly, yearly, and all-time local leaderboards.
- Profile run history and local official sessions.
- Achievement and progression integration.
- Simulated/local settlement records.
- The relayed settlement client, the entry transaction and profile writes (`setProfile`) in source; the browser never signs a score submission.

### How Ranked works now

This is the launch flow in source (the [pre-deployment guide](docs/handoffs/pre-deployment-web3-guide-20260922.md) and its [interface contract](docs/handoffs/pre-deployment-interface-contract-20260922.md)). It runs only with both flags in `apps/portal/src/settlement.mjs` on; until runbook step 7 they are `false`, and Ranked is a device-local preview that makes no `/api` call and sends no transaction.

1. **Sign in.** The player picks a wallet (EIP-6963: MetaMask, Rabby; WalletConnect on lestersarcade.io), gets a server nonce from `/api/session/nonce` and signs one free SIWE message; `/api/session` returns a session token bound to the wallet and the environment.
2. **Seed ticket.** Approving the Ranked entry first asks `/api/ranked/seed` for a ticket: a random salt MAC'd to the session, wallet, game, season and build. The run's seed comes from it, so nobody can pick an easy seed or replay someone else's run.
3. **Entry.** One wallet confirmation calls `ArcadeRankedEntry.openSession` with the session key and the quoted 0.102 zkLTC (0.1 entry plus a 0.002 settlement reserve). The run starts as soon as the transaction is sent.
4. **Relayed publish.** When the run ends, the browser posts the evidence to `/api/settle`. The server replays Chikun and STACKED runs and plausibility-checks HMH runs, checks the paid entry on chain, and its relayer publishes the verified result with `submitVerifiedSession`; a retry queue and a per-minute cron finish anything that stalls. The results screen follows the run from entry to published, with explorer links.
5. **Index.** Confirmed runs, achievements and on-chain profiles live in Neon (`verified_sessions`, `achievement_unlocks`, `wallet_profiles`), indexed from the chain every five minutes. Scores (`/api/leaderboard`, best run per wallet per period) and profiles (`/api/profile`) read only that index; unlockable looks follow the recorded achievements.
6. **Share.** A published run shares `https://lestersarcade.io/s/<shareId>`, a server-rendered page with an OG card (`/api/share-card`); the X post names @LestersArcade and carries no wallet address or hashtag. Preview and practice runs share the Free template.

Evidence before launch: the [local rehearsal](docs/qa/pre-deployment-rehearsal-20260923.json) (server end to end on an in-process chain), the [step-7 dry run](docs/qa/step7-dry-run-20260923.json) (the flag flip in a throwaway worktree), and the [live-flag browser run](docs/qa/ranked-live-browser-e2e-20260923.json) (`node scripts/ranked-live-browser-e2e.mjs`: all three games in a real browser with both flags on, against the local stack). The [release receipt draft](docs/qa/ranked-launch-release-receipt-draft-20260923.json) lists what the deployment session completes.

### Not live end to end

`SETTLEMENT_LIVE` and `HOSTED_PROFILE_SYNC` remain `false`, and the hardened contracts are not deployed: `apps/portal/src/generated/litvm-addresses.mjs` holds the addresses predicted from the operator's nonces (`status: 'predicted'`). The June legacy contracts contain bytecode, but the hardened score ABI cannot decode the legacy score registry, so chain leaderboard reads fail closed.

Going live follows the deployment runbook (guide §7 as amended by contract §13), with the owner's approval at each ⚠ step: broadcast the contracts, confirm the developer wallet, make the games playable, write the renamed server secrets, flip both flags and regenerate the public copy, deploy, run the production migration, then one real Ranked run per game (`scripts/rehearse-ranked-e2e.mjs --target live`, optionally `scripts/ranked-live-browser-e2e.mjs --live`) and the live smokes.

See:

- [HMH Web3 live readiness](docs/web3/hmh-web3-live-readiness.md)
- [Contract overhaul and step-7 checklist](docs/web3/contract-overhaul-20260916.md)
- [Hardened deployment dry run](docs/web3/hardened-ranked-deployment-manifest.json)
- [Contract architecture](contracts/ARCHITECTURE.md)
- [Full Fable handoff](docs/handoffs/2026-07-24-lesters-arcade-chikun-to-hmh-reboot-fable-handoff.md)

---

## Quick start

### Requirements

- Node.js 22 or newer recommended.
- npm.
- Python 3 for the local static server and asset scripts.
- Chrome or Edge for browser certification.
- Blender 5.1.2 only when rebuilding certified HMH production heroes.
- Foundry and Slither only for their respective contract gates.

### Install and build

```bash
npm install
npm run build
```

On this Windows checkout, use npm. `pnpm run build` is blocked by a parent user-level package-manager declaration, while the repository npm build succeeds.

### Serve locally

Serve `apps/portal`, not `apps/portal/dist`:

```bash
cd apps/portal
python -m http.server 8791 --bind 127.0.0.1
```

Open:

- Portal: http://127.0.0.1:8791/
- HMH child: http://127.0.0.1:8791/hmh-reboot/index.html

### Core checks

```bash
npm run check
npm run test:release
npm run build
npm run assets:qa:hmh-reboot
npm run design:security-audit
npm run design:third-party-security
npm run design:web3-audit
npm run design:web3-live
npm run audit:hmh:network
npm run certify:hmh:browser
npm run smoke:hmh:cockpit
npm run smoke:hmh:collectibles
npm run smoke:hmh:enemy-details
npm run smoke:hmh:mobile-controls
npm run smoke:hmh:performance
npm run visual:reboot
npm run smoke:portal
npm run smoke:portal:interactions
npm run repo:health:strict
npm run repo:cdn-gate
npm run docs:links
npm run docs:production
npm run docs:cabinets
```

`docs:production` needs the network: it proves the README cache marker against the live service worker. `docs:cabinets` is offline and deterministic, so it also runs inside `npm test` and therefore inside `test:release` and the Vercel build.

---

## Next priorities

1. Continue role-specific model geometry for Bagholder Rusher, Liquidator Agent, Whale Enforcer, Cultist and boss without changing hitboxes.
2. Replace remaining simple buildings, trees, crates and landmark props with authored modular assets, then close the prop reproducibility tolerance gap.
3. Add secondary motion and combat readability to hero/enemy clips: recoil, cloth/strap follow-through, hit reactions and boss phase poses.
4. Improve combat and movement feel through test-first weapon tuning, acceleration/deceleration review, melee reach clarity, grenade cadence and progression/build balance.
5. Run real keyboard/mouse, controller and real-phone acceptance for touch ergonomics, audio balance, thermal behavior, reduced motion and motion comfort.
6. Harden portal E2E at actual mobile viewport sizes, not desktop-only emulation.
7. Resolve current/previous Vercel `dpl_...` identifiers and verify rollback before any future production request.
8. Add branch protection/CI or preserve the current manual exact-index, preview, soak and public-verification discipline.
9. Keep hardened verifier/attestation and LitVM deployment work blocked until separate explicit HALT approval.
10. Resolve Chikun's open commercial items: written art rights, a real `devWallet`, and the revenue split. The technical launch question is closed, the cabinet is public and Ranked-eligible; what remains is contractual.
11. Certify Chikun 16:9 play. `aspectSupport` declares both orientations, but only 9:16 has certification evidence under `tests/`.

---

## Safety boundaries

- Do not push ordinary work directly to `main`.
- Do not promote production without approval for the exact deployment.
- Do not deploy contracts or send LitVM transactions without explicit HALT approval.
- Do not expose private keys or verifier secrets.
- Do not let HMH child code request wallets or transact.
- Do not let Free Mode write Ranked progress.
- Do not let art, interpolation, particles, audio, or quality tiers alter simulation results.
- Do not reactivate retired/proxy actor art.
- Do not claim local or simulated settlement is on-chain settlement.
- Any runtime source change requires a fresh build, release certificate, exact-index review, preview, and artifact verification.

---

## License

UNLICENSED. Private project unless the owner explicitly changes repository or licensing policy.
