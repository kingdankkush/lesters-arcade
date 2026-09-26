# Slice brief: ranked-onboarding (owner request 2026-09-26)

**Owner request (verbatim):** "be sure to update all the game menus, readmes, game info, etc regarding all the new steps, pricing, faucet, etc. And how Ranked works. We want to convert people easily into playing, but also provide all the resourceful and helpful information they need to know how it all works, what to do, etc."

**Worktree:** `C:/Users/just_/lesters-arcade-wt/ranked-onboarding`, branch `fable/pd-ranked-onboarding`. Base: the integration head that contains the fee change (`fable/ranked-fee-001`: entry fee 0.01 zkLTC, settle floor 0.012).
**Split:** this slice owns the portal, static pages, README and docs. The in-game menus inside `apps/hmh-reboot`, `apps/chikun` and `apps/stacked` belong to the "game sections" session, which uses the canonical wording below and links to this slice's guide page. Do not edit those three folders.

## Facts (the only numbers any copy may use)

| Fact | Value | Source of truth |
|---|---|---|
| Ranked price per run | 0.012 testnet zkLTC = 0.01 entry + 0.002 to publish the score on chain | `contracts/deploy-config.testnet.json` (entryFeeWei, settlementGasReserveWei); runtime price stays quote-driven (`quoteEntry`) |
| Fee split | 85% to the game's developer, 15% to the arcade | GameRegistry split (live 2026-09-24) |
| Faucet | https://liteforge.hub.caldera.xyz, 0.05 zkLTC per request (about 4 Ranked runs) | `LITEFORGE_FAUCET_URL` in `apps/portal/src/wallet-config.mjs` |
| Chain | LitVM LiteForge testnet, chain 4441, token zkLTC (testnet, no monetary value) | `LITVM_LITEFORGE_NETWORK` |
| Wallets | any injected EVM wallet (MetaMask, Rabby, OKX, …) or WalletConnect; the site adds the network | wallet-config / Reown |
| Sign-in | one free signature, no gas | wallet-auth (SIWE) |
| Verification | Chikun and STACKED runs are replayed from their inputs on the server; HMH runs are plausibility-checked | server/verify |
| Publishing | the arcade's relayer publishes verified scores on LitVM, usually within about a minute (retries every minute) | settle + settle-retry cron |
| Boards | weekly (resets Monday 00:00 UTC) and all-time, per game; each score shows the game version it was played on | leaderboards |
| Achievements | 124 (HMH 44, Chikun 40, STACKED 40), earned from verified Ranked runs, shown on profiles | achievement catalogs |
| Free play | no wallet, never touches the chain, never ranks | contract A-rules |

Never mention the weekly jackpot (on hold until mainnet), never promise NFTs, dates, rewards or real value.

## Canonical wording (shared with the game sections session; use verbatim where it fits)

- Price: "Ranked costs 0.012 testnet zkLTC per run: 0.01 entry + 0.002 to publish your score on chain."
- Faucet: "Get free testnet zkLTC from the LiteForge faucet (0.05 per request, enough for 4 Ranked runs)."
- Free: "Free play needs no wallet and never touches the chain."
- Proof: "Ranked runs are checked by the arcade's server and published on LitVM, then appear on the leaderboards, your profile and your achievements."
- Value: "Testnet zkLTC has no monetary value."

## Acceptance criteria

1. **Single source of the static facts.** One small portal module (for example `apps/portal/src/ranked-facts.mjs`) exports the price parts, total, faucet URL and amount, chain, split, board reset, achievement count; every static surface below reads it (build-time for static pages). A test ties it to `deploy-config.testnet.json` (fee + reserve), `LITEFORGE_FAUCET_URL`, the achievement catalogs (count) and the server settle floor (`DEFAULT_MIN_PAID_WEI` = total). The runtime modal keeps using the live quote; the static copy is only a fallback and explanation.
2. **"How Ranked works" guide page** (a new static page, for example `/how-ranked-works.html`, built by `scripts/build-portal-pages.mjs` like the discover pages, indexable, in `sitemap.xml`, FAQPage + HowTo JSON-LD that matches the visible text): a short intro; a numbered 8-step path (Play Free now → connect a wallet → the site adds LitVM → get free zkLTC from the faucet → sign in with a free signature → choose Ranked and pay 0.012 → play; your run is checked → it is published: boards, profile, achievements, share card); a clear price box; a faucet call to action; "Free vs Ranked" comparison; what is verified per game; where your score shows up; an FAQ (at least: is it real money; why a wallet; why two numbers in the price; how long publishing takes; what if a payment or run fails; can I play on a phone; which wallets; what happens to my fee (85/15); weekly reset; achievements; game versions); a troubleshooting section (wrong network, not enough zkLTC, wallet asks for a high fee or refuses, payment done but result pending, run not accepted, browser closed mid-run). Retro styling matching the site; 320 px safe; accessible (headings, landmarks, focus, contrast).
3. **Homepage**: a clear primary "Play free now" and a secondary "Play Ranked" path with a 3-step strip (Connect wallet → Get free zkLTC → Play Ranked, 0.012 zkLTC) linking to the guide; structured data and meta description consistent with the facts.
4. **Mode select and game info**: each game's Free and Ranked lines state the price and link to the guide; the discover page of each game (`discover/*.html`) gets a "Ranked" section (price, what is verified for that game, boards, achievements count for that game, link to the guide).
5. **Ranked entry modal and wallet prompts**: a cost breakdown (0.01 entry + 0.002 publishing, from the live quote), "What happens next" (3 short bullets), a "Get free zkLTC" link with the per-request amount whenever the balance is below the total, and a "How Ranked works" link. The low-balance wallet chip text names the faucet amount. No behaviour change to payment, sign-in or settlement.
6. **Trust page, llms.txt, README, docs**: trust.html states the price, split, verification and faucet accurately; llms.txt gains a Ranked summary and the guide URL; README gains a short "How to play" (Free and Ranked steps, price, faucet, guide link) near the top; `docs/THIRD_PARTY_GAME_ONBOARDING.md` and other docs that state the old 0.1/0.102 numbers are corrected (search the repo for 0.1 zkLTC, 0.102, 102000000000000000 in copy and docs, not in historical receipts).
7. **Gates:** `npm test`, `npm run check`, `npm run build` (report dist/main.js and first-paint deltas; HMH child and STACKED entry must not grow), `npm run docs:links`, `npm run docs:cabinets`, `npm run test:release` (exactly 51), portal page build `--check` current; browser check of the guide page, homepage, a discover page and the Ranked modal (stubbed wallet/API) at 320, 768 and 1280 px with no console errors and no horizontal scroll.
