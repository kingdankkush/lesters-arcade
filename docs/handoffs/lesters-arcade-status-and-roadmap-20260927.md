# Lester's Arcade — status, unfinished work and roadmap (2026-09-27)

This guide covers four things across the arcade and all three games: what is live, what is built but not live, what is unfinished, and what we recommend next. It was written at the end of the 2026-09-22 → 2026-09-27 program, which ran from the Web3 pre-deployment guide through the Ranked launch to seven follow-up releases, ending with 1.9.0.

**Where to look first**

- **Live site:** https://lestersarcade.io. Production is `dpl_EkYKp8FpYuPHoQRCgh7kLjd2qYnK`, site/game version **1.9.0**.
- **Player guide:** https://lestersarcade.io/how-ranked-works
- **Health:** https://lestersarcade.io/api/health (public JSON). The owner dashboard is https://lestersarcade.io/owner/status.html.
- **Code:** branch `fable/master-list-20260916`, worktree `C:\Users\just_\lesters-arcade-fable0916`.
- **Release receipts:** `docs/qa/*-release-*.json`. The newest is `docs/qa/batch-release-20260927-1.9.0.json`.
- **Contract addresses:** `contracts/deployment-record.hardened.json` (Ranked) and `contracts/deployment-record.jackpot.json` (jackpot, idle).
- **Keys:** only in `C:\Users\just_\lesters-arcade-vault\keys\` and in Vercel secrets. Never paste them anywhere.

---

## 1. At a glance

| Area | State |
|---|---|
| Ranked Mode (all three games) | **Live on LitVM LiteForge testnet** since 2026-09-24. You pay 0.012 testnet zkLTC (0.01 entry + 0.002 to publish) and play. The server verifies the run, the relayer publishes the score on chain, and it shows up on leaderboards, profiles and share pages. |
| Price and faucet | 0.012 zkLTC per run since 2026-09-27 (the entry fee dropped from 0.1 to 0.01). The LiteForge faucet (https://liteforge.hub.caldera.xyz) gives 0.05 per request, enough for about 3 runs. |
| Smart contracts | 7 Ranked contracts are deployed and working. Each entry fee splits 85% to the developer and 15% to the arcade. The jackpot contracts are deployed but idle (§6). |
| Leaderboards, profiles, share pages | Live, fed from the on-chain index. Every score shows the game version it was played on. Free runs also get share pages and stat cards (1.9.0). |
| Achievements | 124 in total (HMH 44, Chikun 40, STACKED 40), earned from verified runs and shown on profiles. Soulbound NFTs are Phase 2 and not built yet. |
| Onboarding | The "How Ranked works" guide covers 8 steps, the price, the faucet, an FAQ and troubleshooting. The same facts appear on the homepage, every game page, mode select, the Ranked entry window, the in-game menus, the trust page, llms.txt and the README, and they all come from one source. |
| Chikun Weekly $CHIKUN Jackpot | Built and tested. The testnet contracts are deployed but idle. **On hold until mainnet** by owner decision, because $CHIKUN has not launched. |
| Operations | Health API, an owner status page, three crons with zero failures, automatic settle retry, and a relayer that funds itself from entry fees. |
| Players | The first real Ranked players are on the boards (HMH: KingDankKush; Chikun: cody). |

---

## 2. Release history (this program)

| Version | Date | Production deployment | Highlights |
|---|---|---|---|
| 1.8.0 | 2026-09-24 | `dpl_D8RR6Xm9T2ZC8ZhDMrr697WW9jMu` | **Ranked launch**: contracts, Web3 sign-in, paid entry, server verification, relayed settlement, on-chain index, leaderboards, profiles, share pages and achievements. |
| 1.8.1 | 2026-09-25 | `dpl_4x5CB5EfB257TzrqvuDp9qRN66mv` | Health API and owner status page; Scores/Profile loaded on demand; live UI audit fixes. |
| 1.8.2 | 2026-09-25 | `dpl_C8Zcbk2jTmKAM8ZRqWn4TwZLo33Y` | 392 KB less on first paint; 5,650 dead lines removed; truthful copy; jackpot contracts staged. |
| 1.8.3 | 2026-09-25 | `dpl_BoYxVQ4rW4zyeNUuisJv88eHLFGK` | Game version on every score; 237 MB of unused art removed; jackpot server staged. |
| 1.8.4 | 2026-09-26 | `dpl_61u26aJuaoPMoEGthLcqp7MTUh6N` | Fairer HMH Ranked (12 checks closed the fake-achievement path); two HMH freezes fixed; STACKED settings simplified. |
| 1.8.5 | 2026-09-26 | `dpl_gmkp86XSebFfRUxvYQaQDxMq3uRw` | HMH simulation 34–50% cheaper per tick; sound effects on Web Audio (iPhone volume works); jackpot contracts deployed but idle. |
| 1.8.6 | 2026-09-27 | `dpl_Hb744XdpVmBmakPcZHFHiP86RU1B` | **Ranked for 0.012 zkLTC** (fees set on chain after the release); the How Ranked works guide and onboarding copy; docs match the live state. |
| 1.9.0 | 2026-09-27 | `dpl_EkYKp8FpYuPHoQRCgh7kLjd2qYnK` | **HMH v0.6**: missions, the Liquidator without a timer, two-card level-ups with re-rolls and gun trees, Genesis Seal evolutions, dodge, death camera, new banners. Also: schema-7 run summaries with a reviewed verifier; a stale-tab reload prompt before payment; Chikun Blender backdrops; STACKED feel and music; Free share cards; in-game Ranked copy. |

Every release passed the full release gate before it was promoted: about 5,000–5,800 tests, with the same 51 long-retired HMH art tests as the only tolerated failures. Every release was then verified live: every public file hash-matched against the local build, the API probes passed, and `/api/health` reported healthy. 1.9.0 also passed a local end-to-end Ranked run in the browser for all three games.

---

## 3. Web3: what is deployed and how money moves

**Chain:** LitVM LiteForge testnet (chain 4441, native token zkLTC). Explorer: https://liteforge.explorer.caldera.xyz. The base fee moves between about 0.01 and 1.7 gwei. Our pages and tools price transactions at 10× the current base fee with a 5 gwei floor, so wallets stop refusing them. For manual MetaMask transfers, set the max base fee to 5 gwei and the priority fee to 0. Plain transfers need the estimated gas, not a fixed 21,000.

**Ranked contracts** (deployed 2026-09-24, start block 54,207,405):

| Contract | Address |
|---|---|
| GameRegistry | `0xcb0b695ebee650afcce93f566259cb477b19bf23` |
| PlayerProfileRegistry | `0x3eb9e9f2620940496a2b8ed6f7384e6687587c94` |
| ArcadeRankedEntry | `0x10cd09e694e2b2cd70d37f8cdddcda3ef1208190` |
| ScoreSubmissionRegistry | `0xc5c5949a02fac9a4115df182672c0f8ceb0eaf55` |
| AchievementRegistry (HMH) | `0xc1a383cb7521978f429424443fdd69bdd71ff737` |
| AchievementRegistry (Chikun) | `0xf6cd1cf7e1accaea93accdfb911034b3e8eb6f93` |
| AchievementRegistry (STACKED) | `0x5430f8c142ca7ec8971a447cc09ae63f8860a8a7` |

**Wallet roles:**
- owner / developer / treasury `0x07cec6Fc…8B26` (yours);
- operator `0x6Ac08Bed…6bfF` (admin transactions);
- verifier `0x4d637a6C…20C7` (signs verified runs);
- relayer `0x494aF36e…EAf6` (pays the gas to publish scores; topped up with 0.05 zkLTC on 2026-09-26).

**A Ranked entry (0.012 zkLTC):**
- 0.010 is the entry fee. It is split on payment **85% to the game's developer wallet and 15% to the arcade treasury** (0.0085 / 0.0015; both are your wallet today).
- 0.002 goes to the relayer to pay for publishing the score. A settle costs about 0.0001–0.0007 zkLTC depending on gas, so the relayer funds itself.
- On 2026-09-27 the fee was set on chain with three `setEntryFee` transactions, sent only after the release that lowered the server's settle floor was live. The operator tool's `entry-fee` action refuses any price below that floor.

**What you can change later without redeploying:**
- the split per game (`updateFeeSplit`);
- the entry fee (`node scripts/operator-actions.mjs entry-fee <wei>`);
- the settlement reserve (`reserve <wei>`);
- whether a game is playable (`activate` / `pause-games`).

Any fee change must stay at or above the server's settle floor (`DEFAULT_MIN_PAID_WEI`).

**What you cannot change:** a game's developer wallet is fixed once the game is registered. A new game (for example Louie's) is registered with **its own developer wallet**. That wallet must sign `confirmDevWallet` itself, on `/owner/confirm-dev-wallet.html`, before the game can be made playable.

**Verification per game:**
- **Chikun and STACKED** runs are **replayed** from their inputs on the server, so their scores are exact.
- **HMH** runs are checked for **plausibility**: limits on what a run of that length and content could produce. Since 1.9.0, HMH sends the richer schema-7 run summary. The server checks it with every earlier rule plus new ones, so faked content from a later build, fake melee kills, unvisited districts and a too-short boss fight are all refused. Runs from cached older versions still verify.

---

## 4. The arcade platform (portal, server, operations)

**Shipped:**
- **Portal:**
  - homepage and cabinet browser;
  - the How Ranked works guide;
  - Web3 sign-in (injected wallets + WalletConnect);
  - Free Mode (never touches Web3);
  - the Ranked entry window, with a live price, a cost breakdown and a faucet link;
  - results screens that follow a run to "published";
  - Scores (weekly, monthly and all-time boards, version column) and Profiles;
  - share pages with Open Graph cards, for both Ranked and Free runs;
  - trust page, discovery pages, `llms.txt`.
- **Server** (Vercel functions + Neon Postgres):
  - seed tickets, which refuse stale HMH pages before any payment;
  - run verification and attestation;
  - relayed settlement with a lease, so two settles never race;
  - the chain indexer (every 5 minutes) and settle retry (every minute);
  - `/api/health`;
  - moderation (`board_excluded` for test wallets);
  - the jackpot server (switched off).
- **Neon migrations:** 1 (core), 2 (cron run records) and 3 (jackpot tables). Each one applies itself on first use.

**Operating it:**
- **Check health:** `/api/health` should show `healthy: true`, `degradedParts: []`, crons with `failures: 0`, and `relayer.estimatedSettlesLeft`.
- **Relayer:** it gains 0.002 per Ranked entry. If `estimatedSettlesLeft` ever drops below about 10, send it testnet zkLTC.
- **Deploying:** production ships only from this machine. Run `npm run vercel:build` (the full gate), then `npx vercel deploy --yes`, then `npx vercel promote <url> --yes`, and verify.
  - Vercel's cloud build runs the same gate, but without `.git`. Tests must never depend on git.
  - The automatic Git-connected previews always fail because Vercel does not download the Git LFS art. **Ignore those failure emails.**
- **Heavy jobs:** release gates on this machine are serialized with the lock folder `C:\Users\just_\lesters-arcade-wt\.locks\heavy.lock`.
- **Rollback:**
  - To 1.8.6: pause Ranked HMH first, because 1.8.6 refuses 1.9.0 run summaries.
  - Further back than 1.8.6: first set the fee back to 0.1, because older releases refuse 0.012 runs.

---

## 5. Security and fair play

- Keys never leave the vault and Vercel secrets.
- The game iframes never touch wallets. The portal and server own sessions, seeds, verification and settlement. Free Mode is isolated from Ranked.
- Test wallets are `board_excluded`, so they never rank.
- Known fair-play gaps, in priority order:
  1. **HMH, anti-cheat round 4:** one grenade can still be credited with unlimited kills (the game needs a blast cap first). Secret silver score and objective completion times are claimable.
  2. **HMH achievements forgeable in the v6 format:** "Blade Master", "Blade Samurai", "Big Combo" and "Max Combo 30". They affect profiles only, not scores or boards. Recommended: exclude them from Phase 2 NFTs until only 1.9.0+ runs count.
  3. **Chikun:** bots that read the full runtime snapshot can survive a long time. This is acceptable on testnet, but it must be hardened before any prize carries real value.
  4. **HMH Liquidator:** no real played run has yet fought him under the new rules (you chose to skip those runs). Watch for wrongly refused HMH runs.

---

## 6. Chikun Weekly $CHIKUN Jackpot (on hold until mainnet)

**What it is:** the highest verified Ranked Chikun score of each week (Monday 00:00 UTC to Monday 00:00 UTC) wins that week's funded $CHIKUN pot, paid after a 24-hour review. Staff and service wallets can never win.

**Built:**
- **Contracts:** `WeeklyJackpot` and a stand-in test token tCHIKUN, **deployed on LiteForge 2026-09-26 and idle**. The jackpot is at `0xb5c0b776a851a15f2db49dd4301f616aeee8fa0e` and tCHIKUN at `0xe4230b5aba9f9431b0f5a718b99544f69330ae9c`. The keeper key is in the vault, unfunded.
- **Server and UI:** all in the codebase, switched off (`JACKPOT_LIVE = false`, no Vercel secrets).
- **Rehearsal:** 20 scenarios (branch `fable/pd-jackpot-rehearsal`), built but not verified. It is paused.

**For mainnet** (runbook: `docs/web3/weekly-jackpot-operations.md`):
- Deploy a new instance with the real $CHIKUN token. Its `minPaidWei` must match the entry fee in force then; the testnet instance still says 0.1.
- Finish and verify the rehearsal.
- Block the service wallets and fund the keeper.
- Set the two Vercel secrets.
- Collect the calibration runs (at least 40 human runs from at least 5 people).
- Confirm the rules-page legal text.
- Fund weeks only through `/owner/jackpot.html`.

---

## 7. Hard Money Heroes

**Live (1.9.0, HMH v0.6):**
- **Level 1:** missions with objectives (switches, a winch, seals, gates) and a tracker.
- **The Liquidator:** no timer. From 10:00 you choose to fight him by ringing the Closing Bell or entering the Dark Pool.
- **Level-ups:** two cards, with re-rolls and per-gun upgrade trees.
- **Genesis Seal:** evolves a mastered gun.
- **Controls and camera:** a dodge key (desktop) and a death camera.
- **Fixes and performance:** the Lightning Ledger swap fix, smoother crowds, and about 72% less texture memory on phones.
- **Presentation:** new banners and Ranked share art, and in-game Ranked help.

**Performance:** the simulation is 34–50% cheaper per tick than 1.8.1, with bit-identical results, and render allocations are down about 40%. The target of never dropping below 30 fps on a slow phone is not yet proven. A real iPhone XS Max has not been measured.

**Unfinished, in order:**
1. **1.10.0** (planned for later this week): the Level 1 redesign (layout v2), three new bosses (Rug Pull Baron, The 51% Foreman, The Lockkeeper), six new enemies, art waves 2 and 3 (Tripo/Blender), and hero rig v2. The verifier must pick map tables by each run's game version.
2. Prisoners (built, switched off; lighting them needs verifier coverage), wave-2 evolutions, and the Settler Rail opt-in.
3. Anti-cheat round 4 (§5).
4. Performance steps 7–8: a Graphics Quality setting, the `?perf=1` overlay, and the real iPhone test.
5. The HMH performance smoke needs a 1.9.0 scenario.

**Owner decisions:**
- **Progression power policy:** see `docs/hmh-reboot/STAGE-1-GAMEPLAY-20260927.md`.
- **Casting board picks** before more Tripo credits are spent (https://claude.ai/artifact/1nnW7MaAUdR9uqc1gu9moP).
- **Combo and blade achievements:** see §5.

---

## 8. Chikun's Escape

**Live:**
- the character rebuilt to your sheet;
- one looping 7-region level with the difficulty retune;
- Ranked with 40 achievements;
- **Blender parallax backdrops for all 7 regions** (1.9.0), with day/night lighting and animated landmarks;
- in-game Ranked help;
- Free share cards.

**Unfinished:**
- obstacle art (built on `fable/chikun-visuals`; contrast needs raising first);
- region lighting and character rim light;
- a decision on the ground-audio pack;
- gateway landmarks;
- a first-run tutorial;
- real-device acceptance.

**Recommended next:** ship the obstacle art together with the lighting pass. Then add input-timing plausibility before any real-value jackpot.

---

## 9. STACKED

**Live:**
- a simplified settings card (one effects preset, and one sound slider where 0 means off);
- music-reactive scenes;
- springier board feel, haptics and a sound kit;
- music that starts with the run on a random track;
- Ranked with 40 achievements;
- in-game Ranked help;
- Free share cards.

**Unfinished and recommended:**
- sub-tick interpolation (partly landed through stacked-feel);
- local two-player versus (the simulation exists; there is no menu entry yet);
- a daily-seed Ranked challenge;
- long-session budget checks on real phones.

---

## 10. Owner actions and decisions

**Decisions (the work waits on these):**
1. **HMH achievements forgeable in the v6 format** ("Blade Master", "Blade Samurai", "Big Combo", "Max Combo 30"). Recommended: keep them visible on testnet and exclude them from Phase 2 NFTs until only 1.9.0+ runs count. The alternative is to hide them.
2. **HMH progression power policy** (STAGE-1 doc), and **casting board** picks.
3. **Jackpot:** on hold until mainnet and the $CHIKUN launch (§6).

**Money and accounts (only you):**
- The relayer funds itself. Top it up only if `/api/health` shows fewer than about 10 settles left.
- Louie: a new game of his registers with his own developer wallet. Settle his share of Chikun off chain, as planned.
- Credits: the agents ran into account usage limits several times. Keep enough headroom for release days.

**Still open from the original direction:**
- Written commercial-use, modification, hosting and redistribution rights for the original creator's art (AGENTS.md).
- Phase 2 soulbound achievement NFTs.
- Mainnet needs:
  - a fresh contract deployment;
  - a season reset (testnet boards never reset; each score shows its game version instead);
  - a new legal review before any prize carries real value.

---

## 11. Recommended next (in order)

1. **Watch 1.9.0** for a day: wrongly refused HMH runs (especially around Liquidator fights), `/api/health`, and player feedback on the new missions and the price.
2. **1.10.0:** layout v2, the new bosses and enemies, and the art waves. Each goes through its own verifier review, and each map is checked by the run's own game version.
3. **Anti-cheat round 4**, before Phase 2 NFTs or any prize.
4. **Phase 2 soulbound NFTs** on the existing AchievementRegistry contracts. Mint only achievements with strong checks.
5. **Chikun** obstacle art and lighting; **STACKED** versus mode.
6. **Housekeeping:**
   - prune the finished slice worktrees under `C:\Users\just_\lesters-arcade-wt\` (remove each `node_modules` junction with `cmd /c rmdir` first);
   - refresh the legacy portal visual-regression script, which has been broken since July;
   - commits made in these worktrees show the author "Codex" (inherited git config); set your own author if you prefer.
