# Lester's Arcade + Hard Money Heroes — Master Build Plan (2026-06-20)

Source: Justin's directive — fix Connect Wallet + full Web3, rebuild navigation/UX,
redo enemy/hero/boss art + animations, rebuild Level 1 & 2 worlds, make the game
fully playable start→finish. Test everything.

Status legend: ⬜ TODO · 🟡 IN PROGRESS · ✅ DONE · 🔒 GATED (needs Justin/legal)

---

## EPIC A — Web3 / Wallet (the whole point of the platform)

- ⬜ A1. **Fix Connect Wallet crash.** Clicking Connect currently "glitches out" the
  site. Reproduce in-browser, capture the console error, fix the runtime fault
  (likely an unhandled rejection in the connect→chain-switch→render path or an
  injected-provider edge case). Connect must be robust with no provider, declined
  request, wrong chain, and multiple wallets (EIP-6963).
- ⬜ A2. **EIP-6963 multi-wallet discovery.** Support MetaMask, Rabby, etc. via the
  modern `eip6963:announceProvider` standard instead of only `window.ethereum`
  (which breaks when multiple wallets are installed).
- ⬜ A3. **Sign-in with Ethereum (auth).** On connect, prompt a `personal_sign`
  (SIWE-style nonce message). A valid signature = logged in. Identity (display
  name, avatar, stats, achievements) binds to the recovered address.
- ⬜ A4. **LitVM LiteForge chain guard + add/switch.** Ensure wallet is on chain
  4441; offer add/switch network; faucet link for zkLTC. (Config already present.)
- ⬜ A5. **Ranked entry = wallet signature (free, testnet).** No $0.50 LTC charge
  while pre-live; ranked costs only zkLTC gas to settle. Sign a ranked-entry
  message to start a ranked run.
- ⬜ A6. **Settle game session on-chain (LitVM testnet).** On ranked game-over,
  submit the run (score, kills, survival, achievements, sessionId) as a real
  testnet tx via the deployed contracts. `settlement.mjs` plan-builder exists;
  needs (a) deployed contracts, (b) `SETTLEMENT_LIVE=true`, (c) real tx broadcast
  + receipt + explorer link. 🔒 contract deploy is gated on Justin.
- ⬜ A7. **Read leaderboards/high-scores FROM chain.** Official boards pull from
  on-chain settled sessions keyed by wallet address (read path), with the local
  store as a cache/fallback. 🔒 depends on A6 + deployed read contracts.
- ⬜ A8. **Profile durability.** Display name + avatar + achievements persist keyed
  to the normalized wallet address; survive reconnect; mock wallet stays off
  official boards.

## EPIC B — Navigation / UX / User Flow

- ⬜ B1. **Back navigation everywhere.** Every screen (game-select, mode-select,
  character-select, level-intro, profile, leaderboards, settings) has a clear,
  consistent way back to the previous screen AND to home. (Some back buttons exist
  but flow is inconsistent.)
- ⬜ B2. **Guest-first nav, no hard lockouts.** Profile/Scores should be reachable
  for browsing as a guest (show a "connect to save" state) rather than a disabled,
  dead button while in game-select/character-select.
- ⬜ B3. **Persistent top nav** across all routed views (Home/Play · Profile ·
  Scores · Settings) with a clear active state and connect/account control.
- ⬜ B4. **Breadcrumb / title clarity.** Always show where you are and how to get
  out (e.g. "Home → Hard Money Heroes → Choose Hero").
- ⬜ B5. **Overall usability polish.** Mobile + desktop: tap targets, focus states,
  no tap-through, clear CTAs, loading states on wallet/async actions.

## EPIC C — Character & Enemy Art + Animation (8-direction, full move sets)

Approved tool: **PixelLab API** (key present in `.env`). Accepted assets must be
repo-local + manifest-ready before runtime use. Animation states per actor:
**idle · walk/run · shoot (ranged) · melee/attack · take-damage/hit · death**
(+ attack-tell for enemies). Heroes need **8 directions**.

- ⬜ C1. **Replace off-style enemy sprites.** The newer enemies (coyote pack
  runner, etc.) reuse `trench-degen` art (only 7 PNGs) and clash with the pixel
  style. Redo them as proper pixel sprites with full animation sets.
- ⬜ C2. **Complete existing enemy sprite sets.** Fill missing idle/walk/shoot/
  melee/hit/death frames for all Level 1 + Level 2 enemies.
- ⬜ C3. **Heroes (Lit Commando, Lit Valkyrie) — 8-direction full move sets.**
  Audit current coverage (commando/valkyrie have many frames but verify all
  directions × all states), fill gaps.
- ⬜ C4. **Bosses + minibosses.** Full multi-state animation coverage for each
  Level 1 + Level 2 boss/miniboss.
- ⬜ C5. **Runtime wiring + manifests.** Every new asset sliced, manifested, and
  resolved by the runtime sprite resolver (no broken/fallback art in-game).
- ⬜ C6. **Style consistency pass.** One palette/outline/scale standard so every
  actor reads as the same game.

## EPIC D — Level Design (real worlds for L1 & L2)

- ⬜ D1. **Level 1: The Crypto Wasteland — authored world.** Real handcrafted
  layout (not random scatter): districts, landmarks, pathways, traversal loops,
  cover/choke points, interactive props, set-piece encounters. Use existing +
  new assets.
- ⬜ D2. **Level 2: Litecoin City — authored world.** Same bar as L1; distinct
  biome/identity (city vs wasteland). Plan doc already exists
  (`hard-money-heroes-level-2-litecoin-city-world-plan.md`).
- ⬜ D3. **Asset-placement logic.** Deterministic, readable placement rules (no
  ugly random scatter); cosmetic-vs-sim determinism boundary respected.
- ⬜ D4. **Interactivity + pathing.** Destructibles, force zones, doors/choke
  points re-query pathing; environmental kills.
- ⬜ D5. **Level progression & completion.** Clear objective → stages → boss →
  level-complete → transition to next level. Both levels beatable.

## EPIC E — Full Playable Loop (start → finish, L1 + L2)

- ⬜ E1. **End-to-end run:** splash → (guest or connect) → cabinet → mode → hero →
  L1 world → L1 boss → L1 complete → L2 world → L2 boss → win screen.
- ⬜ E2. **Win / lose / continue states** wired with score submit (ranked) and
  free-practice paths.
- ⬜ E3. **Balance pass** so both levels are actually completable + fun.

## EPIC F — QA / Verification (every slice)

- ⬜ F1. Live browser playtest (desktop) per slice; zero console errors.
- ⬜ F2. Code-level mobile verification (portrait 9:16 + landscape 16:9).
- ⬜ F3. `npm test` + `npm run check` + contracts + smoke green before each commit.
- ⬜ F4. Incremental commits; push live on Justin's go.
- ⬜ F5. Real on-device iOS/Android pass (owed; needs Justin's devices).

---

## Sequencing (proposed)

1. **A1 wallet crash** (blocker, fast) → **A2/A3/A4** connect+SIWE+chain guard.
2. **B1–B5 navigation/UX** (high-impact, unblocks testing the rest).
3. **C art** (largest effort; PixelLab batches run in background) in parallel with
   **D level design**.
4. **A5/A6/A7 on-chain ranked + settlement** (needs contract-deploy decision).
5. **E full loop** + **F QA** continuously.

Contract deploy (A6/A7) and any real-funds/legal items stay 🔒 gated to Justin.
