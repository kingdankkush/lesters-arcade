# Slice brief: unlockables (wave 3b, after all five wave-3 slices have merged)

**Worktree:** `C:/Users/just_/lesters-arcade-wt/unlockables`, branch `fable/pd-unlockables`, based on the integration branch after wave 3 has merged.

**Read first:**
- contract `docs/handoffs/pre-deployment-interface-contract-20260922.md` (if it is missing from your worktree, read `C:/Users/just_/lesters-arcade-fable0916/docs/handoffs/pre-deployment-interface-contract-20260922.md`) §1 (A7, A22, A32), §4.3.6 (the E6 response and `preferences.cosmetics`), §6.1-§6.2, §7.7, §7.9 (the sets, budgets and hero-gate ownership), §9.1, §10, §11 (rule 5 byte budgets), §14 (rows C7, C21);
- guide §5.13 and decision D8.

Line numbers in `main.js` have drifted after wave 3. Anchor by function name.

## Goal

Cosmetic unlockables that follow the wallet across devices and work in Free Mode:
- **Phase 1** (now): granted by **earned, server-recorded achievements** and verified run counts.
- **Phase 2** (later, no code change): also granted by **held** soulbound tokens.

Sets per guide §5.13 (owner-approved D8):

| Game | Set |
| --- | --- |
| Hard Money Heroes | hero and weapon skins |
| Chikun's Escape | coats, trails, hats |
| STACKED | piece skins and visualizer scenes |

## Scope (D8 is "yes to everything proposed"; contract §7.9)

Every approved set ships working, with **no new art files**:

- **Chikun coat colours:** at least 4, using hue and saturation filters applied to the Chikun sprite at draw time.
- **Chikun trails:** at least 3, as particle colour variants.
- **Chikun hats:** at least 3 (for example a cap, a top hat and a crown), drawn procedurally from a few pixel rectangles anchored to the Chikun sprite's head each frame, in the game's pixel style.
- **STACKED piece skins:** at least 4 palette sets.
- **STACKED scene variants:** at least 3 colour grades of existing visualizers. **Never lock an existing, currently free visualizer.**
- **HMH hero skins:** at least 3 palette tints of the selected hero, and **HMH weapon skins:** at least 3 tints of weapon and projectile sprites, both applied with Pixi `tint` in the HMH child. The tint values live in the parent and travel through the child's existing init settings as one optional `cosmetics` key. **Budget: ≤ 350 B of HMH child initial JS** (the child has 2,147 B of headroom and no other slice may grow it). If the tint hook cannot fit, **stop and report to the orchestrator**, which asks the owner; never ship HMH skins as "Coming soon" on your own.
- **HMH heroes:** the existing Lester and Lilly gates on verified counts (profile-boards owns `buildCharacterUnlockMap`; you supply the cached count, acceptance 5).
- `artStatus` stays in the catalog shape for future art upgrades; every entry above is `'ready'`.

## Acceptance criteria

1. **`apps/portal/src/unlockables.mjs`** per §7.9:
   - every entry gates on an existing `available:true` achievement id from `catalogFor(gameId)` (tests check the ids exist), or on `confirmedRuns`;
   - `unlockState` returns `unlocked:true` when the id is in the earned set, in the held set, or the run gate is met;
   - an explicit `phase` comment explains that held tokens are included for phase 2.
2. **`apps/portal/src/unlockables-store.mjs`:**
   - it caches `unlocksFromProfileResponse(E6)` per wallet in `localStorage` key `lesters-arcade-unlocks-v1:<wallet>`, with a 7-day TTL and a try/catch around every access;
   - it refreshes when `lesters:wallet-session` (authenticated) or `lesters:profile-changed` fires, or after a `published` Ranked run (listen to `lesters:ranked-run` and subscribe to the handle);
   - it works in Free Mode and offline from the cache;
   - with `HOSTED_PROFILE_SYNC=false`, only default cosmetics are available, and there is no fetch.
3. **Selection UI.** `apps/portal/src/routes/unlockables-panel.mjs` (lazy) sits in the Settings route and on the player's own profile. It shows each game's slots with locked, unlocked and coming-soon states, and the achievement that unlocks each ("Earn *Reach the Coast*"), linked to the profile achievement list.
   - The selected cosmetic ids persist in `preferences.cosmetics` through `PUT /api/profile` (Bearer) when hosted, and in `localStorage` otherwise.
   - A selection is honoured only if still unlocked.
   - Keyboard and touch accessible, readable at 320 px.
4. **Child plumbing.** A selected cosmetic reaches each game through its existing `settings` channel, extended by exactly one optional key `cosmetics`:

   | Child | Validator change | `cosmetics` shape |
   | --- | --- | --- |
   | Chikun | `chikun-bridge-protocol.mjs` `validateSettings` exact keys become `musicEnabled`, `reduceMotion`, `cosmetics` | `{ coat: id\|null, trail: id\|null, hat: id\|null }`, ids from a fixed allowlist |
   | STACKED | `stacked-bridge-protocol.mjs` `validateStackedBridgeSettings` | `{ pieceSkin: id\|null, scene: id\|null }` |
   | HMH | the HMH child's init-settings validator (find it by grep in `apps/hmh-reboot/src/**` and the portal's `hmh-reboot-host.mjs`) | `{ heroTint: 0xRRGGBB\|null, weaponTint: 0xRRGGBB\|null }`, integers validated against a small allowlist sent by the parent |

   - Cosmetics never change gameplay and never touch evidence, the run summary or replay determinism. A test replays a Ranked Chikun fixture and the STACKED golden run with and without cosmetics and gets identical results, and an HMH test shows the run summary is identical with and without tints.
   - Child byte growth: STACKED entry ≤ 400 B (the entry is 27,756 B at `06ebe4ca` against a 29,000 B cap; palette data stays in lazily imported render modules) and the STACKED initial cap; HMH child initial JS ≤ 350 B. Chikun has no hard cap, but keep it lean. Record every measured delta in the final commit message.
5. **HMH hero gates:** profile-boards owns `buildCharacterUnlockMap(profile, config, { verifiedRuns })` and its tests. You only supply `verifiedRuns` from the A7 cache, so the hero select shows Lester and Lilly as unlocked on any device once earned, before E6 loads and offline. Add one test for that path. The server enforces the same gates for Ranked (contract §4.3.3 step 11), so an edited cache changes Free play only. Update `LESTER_BLASTER_UNLOCKABLES` display strings in `arcade-core.mjs` (`:2023-2033`) so every `unlock` text names a real achievement or run gate. `weapon-hashstorm` currently names a nonexistent achievement. Keep `length >= 8` (`tests/arcade-core.test.mjs:1499`).
6. **Truthful copy.** No "NFT", "soulbound" or "minting" wording in phase 1 (contract A32). Achievement-gated items say "Earn *X*".

## Files

- **You own:** contract §10.2 row unlockables. `main.js` edits are limited to:
  - (a) the Settings route render hook;
  - (b) the `mountChikunSession` init-context settings;
  - (c) the `mountStackedSession` settings;
  - (d) the HMH reboot mount's init settings (the `cosmetics` tint key only);
  - (e) one listener registration next to the results-share listener block.

  Each hunk stays at most 15 lines and is anchored by function name. Also `apps/chikun/src/main.mjs` and `character.mjs` (the coat, trail and hat draw hooks), the `apps/stacked/src/render/**` palette hooks, and in `apps/hmh-reboot/src/**` only the init-settings validator and the hero and weapon tint hook (≤ 350 B).
- **Read-only:**
  - the settlement, results and share modules;
  - `server/**`, `api/**`, `sdk/**`, and `apps/hmh-reboot/**` apart from the tint hook;
  - `buildCharacterUnlockMap` in `hmh-character-config.mjs` (profile-boards owns it; you only pass `verifiedRuns`);
  - the catalogs (achievements; request new achievement ids through the orchestrator, do not add them).

## Interfaces

- **Produced:** §7.9, and the `cosmetics` settings keys.
- **Consumed:** E6 and E7; §6.2 `catalogFor` and `achievementById`; the `lesters:*` events; `buildCharacterUnlockMap` with `verifiedRuns`.

## Plan

1. `unlockables.mjs` and the store, with tests (`tests/unlockables.test.mjs`):
   - "every gate names a real available achievement";
   - "earned server achievements unlock in phase 1; held tokens also unlock";
   - "confirmed-run gates use verified counts";
   - "cache survives reload and expires after seven days";
   - "preview mode offers defaults only and never fetches".
2. Bridge validators and child hooks (Chikun coat, trail and hat; STACKED skin and scene), with tests:
   - "settings accept only allowlisted cosmetics";
   - "cosmetics do not change a replayed Ranked result" (Chikun v6 fixture; STACKED golden run).
3. **HMH tints first as a budget spike:** add the tint hook, run `npm run build`, and check the HMH child initial JS grew by ≤ 350 B. If not, stop and report (scope section). Then the tests: "HMH tints are validated against the allowlist"; "HMH tints never change the run summary".
4. The panel UI and the `main.js` hooks, with a structural DOM test.
5. The cached `verifiedRuns` path and the unlockable strings, with one new case in `tests/hmh-ranked-recruitment.test.mjs` ("cached verified runs unlock Lester and Lilly before the profile loads") and updated `LESTER_BLASTER_UNLOCKABLES` pins.
6. Register the files in `scripts/syntax-check.mjs` immediately after `"apps/portal/src/hmh-character-config.mjs",`.

## Verification

```
node --test tests/unlockables.test.mjs tests/chikun-*.test.mjs tests/stacked-*.test.mjs tests/hmh-character-config.test.mjs tests/hmh-ranked-recruitment.test.mjs tests/arcade-core.test.mjs
npm test && npm run check && npm run contracts:check && npm run build && npm run test:release   # exactly 51
```

**Browser**, with `apps/portal` as the web root (`python -m http.server 8807 --directory apps/portal`), preview mode:
1. The Settings panel shows default cosmetics and locked items with "Earn …".
2. Chikun Free with a default coat, and STACKED Free with a default palette; HMH Free with the default hero colours.
3. The console is clean.
4. To see an unlocked cosmetic render, temporarily inject a cache entry in DevTools. Do not commit that.

## Pitfalls

- **Cosmetics must never enter evidence, replay input or the result tuple.** STACKED `stacked-sim.mjs` is purity-audited: do not touch it. Visual changes live in the render layer only.
- **The Chikun bridge validators use exact key sets**, on both parent and child. Update both sides.
- **The STACKED entry JS cap is tight** (29,000 B). Put palette data in lazily imported render modules.
- **No new art files.** Hats are drawn from pixel rectangles; HMH skins are Pixi tints. Nothing ships as "Coming soon" without the owner's approval through the orchestrator.
- **The HMH child has 2,147 B of headroom** in total, and you are the only slice allowed to spend any of it (≤ 350 B).

## Definition of done

- Acceptance criteria 1-6 hold.
- The gate shows exactly 51. Do not commit the gate JSON.
- The bundle budgets pass and the syntax-check entries are added.
- The final commit message lists the working unlockables and their gates, and the measured STACKED entry and HMH child byte deltas.
