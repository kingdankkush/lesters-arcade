# Slice brief: site-copy (wave 3, parallel with ranked-client, signin-entry, results-share and profile-boards)

**Worktree:** `C:/Users/just_/lesters-arcade-wt/site-copy`, branch `fable/pd-site-copy`, based on the integration branch after waves 1 and 2 have merged.

**Read first:**
- contract `docs/handoffs/pre-deployment-interface-contract-20260922.md` (if it is missing from your worktree, read `C:/Users/just_/lesters-arcade-fable0916/docs/handoffs/pre-deployment-interface-contract-20260922.md`) §1 (A9, A27, A29, A33), §9.1 (the flags), §10.2 (row site-copy), §10.4 (rules 7 and 8), §11, §13 (step 7), §14 (row C1);
- guide §2 (rules), §3 (the player experience), §5.6 and §5.12 (what launch offers), and decisions D2, D5, D10, D15.

## Goal

Make every public statement about Ranked, profiles and leaderboards true in both states of the flags, so the step-7 flag flip cannot leave false copy live. Today the site tells players Ranked has no entry fee and sends no score transaction; the launched site charges 0.1001 zkLTC and publishes on chain.

The copy is **generated from the flags** (A33): preview wording while `SETTLEMENT_LIVE` and `HOSTED_PROFILE_SYNC` are false, launch wording once they are true. Step 7 flips the flags and re-runs `node scripts/build-portal-pages.mjs` in the same commit.

## What is false today (checked at `06ebe4ca`)

- `apps/portal/index.html:13, :22, :30` (meta, OG and Twitter descriptions) and `apps/portal/src/portal-content.mjs:3` `PORTAL_DESCRIPTION`: "device-local Ranked previews". The builder copies it into `apps/portal/discover/*.html` and `apps/portal/llms.txt`.
- `index.html:141` (scores section): "daily, weekly, monthly, yearly, and all-time scoreboards"; D2 launches Weekly, Monthly and All-time only.
- `index.html:147-149` (FAQ, generated from `PORTAL_FAQ`): "Profiles and Ranked preview results are currently device-local", "The current Ranked preview requires no entry fee and pays no prizes. No score transaction is sent."
- `apps/portal/llms.txt:11, :16` ("local Ranked previews"; "No entry fees, prizes, global rankings … or on-chain score publishing"), written by `scripts/build-portal-pages.mjs:49`.
- `apps/portal/trust.html:58`: "Live settlement is disabled in this candidate: `SETTLEMENT_LIVE=false`", pinned by `tests/portal-trust-surface.test.mjs:32`. The trust page also discloses only browser storage, while launch adds server-side storage in Neon.

## Acceptance criteria

1. **Flag-aware content.** `apps/portal/src/portal-content.mjs` exports `portalCopyFor({ settlementLive, hostedProfileSync })` returning `{ description, faq, scoresNote, trustStatus, trustStorage, llmsScope, llmsHowItWorks }`, and keeps `PORTAL_DESCRIPTION` and `PORTAL_FAQ` as the values for the **current** flags (import them from `settlement.mjs`; that module is small). The builder and any SPA view read the same source.
2. **Launch wording** (flags true) states plainly, with no hype and no hashtags:
   - Ranked costs 0.1 zkLTC plus a 0.0001 zkLTC settlement reserve on the LitVM LiteForge **testnet**, split 85% to the game's developer and 15% to the arcade; Free Mode is always free and needs no wallet;
   - Ranked runs are published on LitVM by the arcade's relayer after the server checks them: Chikun's Escape and STACKED runs are **replayed** by the server; Hard Money Heroes runs are **plausibility-checked**, not replayed (A9);
   - global Weekly, Monthly and All-time leaderboards, best score per wallet (D1, D2);
   - achievements are recorded against the wallet on the server; there is **no NFT wording** (A32);
   - failed publishes retry automatically and can be retried from the profile; testnet entries are not refunded (D10);
   - names are chosen on chain and can be hidden by moderation (A29);
   - testnet tokens have no value and there are no prizes.
3. **Preview wording** (flags false) stays truthful for today: device-local Ranked previews, no fees, nothing published.
4. **Trust page** (`trust.html`): the status line and a storage disclosure come from the builder between marker comments (for example `<!-- ranked-status:start -->` … `<!-- ranked-status:end -->`). Launch wording discloses what the server stores in Neon: the wallet address, verified Ranked sessions with their evidence (replay inputs or run summaries), achievements, on-chain profile mirrors, preferences, and HMAC'd IP buckets for rate limiting (not raw IPs). Update `tests/portal-trust-surface.test.mjs` so it checks the copy against the flags instead of pinning `SETTLEMENT_LIVE=false`.
5. **Scores section** (`index.html:139-141`): the builder renders it between markers; it names only the periods the UI offers (Weekly, Monthly, All-time) in both modes.
6. **Builder.** `scripts/build-portal-pages.mjs` renders every flag-dependent block (meta and OG/Twitter descriptions, JSON-LD description, FAQ, scores note, `llms.txt` scope and "How it works" line, and the trust page blocks) from `portalCopyFor`. It accepts an optional `--flags live|preview` override used **only** by tests and the rehearsal's step-7 dry run; without it, it reads `settlement.mjs`.
7. **Committed output equals builder output** for the current (false) flags, and a test renders the live variant to a temp directory and asserts the launch statements (fee, replay vs plausibility, Neon storage, no NFT wording, no "yearly", no "device-local") appear and the preview statements do not.

## Files

- **You own:** contract §10.2 row site-copy.
- **Read-only:** `apps/portal/index.html:63-81` and `:104-105` (signin-entry edits the Ranked modal and the Sign in button in parallel), `main.js`, every other slice's modules, `apps/portal/src/settlement.mjs` (read the flags; never change them).

## Plan

1. `portalCopyFor` and the wording for both states, with `tests/portal-copy.test.mjs`: "preview copy says device-local and no fees"; "launch copy states the fee, the split and the testnet"; "launch copy says HMH is plausibility-checked and the other games are replayed"; "launch copy discloses server-side storage"; "no copy mentions NFTs, hashtags or yearly boards". Commit.
2. The builder's marker blocks, `trust.html` markers, and the regenerated outputs for the current flags; update `tests/portal-trust-surface.test.mjs` and `tests/portal-discovery.test.mjs`. Commit.
3. The live-variant render test (acceptance 7). Commit.
4. Register new files in `scripts/syntax-check.mjs` immediately after `'scripts/build-portal-pages.mjs',`.

## Verification

```
node --test tests/portal-copy.test.mjs tests/portal-trust-surface.test.mjs tests/portal-discovery.test.mjs
node scripts/build-portal-pages.mjs && git diff --exit-code apps/portal
npm test && npm run check && npm run contracts:check && npm run build && npm run test:release   # exactly 51
```

**Browser**, with `apps/portal` as the web root (`python -m http.server 8808 --directory apps/portal`): the landing page, `/games` discover page (served from `discover/games.html` by the static server only through its file path) and `/trust.html` read correctly at 1280 px and 320 px, and the console is clean.

## Pitfalls

- **Generated files conflict easily.** signin-entry also edits `index.html` in this wave and re-runs the builder. Keep your hand edits out of `:63-81` and `:104-105`; the orchestrator regenerates the builder outputs at merge (contract §10.4 rule 8).
- **The discover pages are derived from the whole landing page**, so any `index.html` change elsewhere changes them too. Never hand-edit `discover/*.html`.
- **Do not flip the flags in a committed file.** Test the live wording through the builder's override only.
- **Keep the copy short and plain.** It is read by people deciding whether to spend testnet tokens; say what happens, what is stored, and what is not promised.

## Definition of done

- Acceptance criteria 1-7 hold; the committed pages equal the builder output.
- The gate shows exactly 51. Do not commit the gate JSON.
- The final commit message quotes the launch wording of the FAQ fee answer and the trust-page status line, so the orchestrator can show them to the owner before step 7.
