# Hard Money Heroes AAA Readiness Review

Generated: 2026-07-08T18:11:56Z  
Repository baseline: `cc9e85e6` (`hmh-aaa-art-v24` production cache token)

## Verdict

Hard Money Heroes is **live, playable, and substantially upgraded**, but it is **not yet AAA-complete** by the current art/animation/security checklist.

The shipped production site is serving the latest wallet/security frontend and the Level 1 runtime has working authored world/pathing/asset systems. However, the art QA and roster reports still show enough missing native animation, partial actors, zero-animation bosses/minibosses, pickup icon gaps, and QA failures that we should call the current state a polished playable alpha/beta slice rather than final AAA quality.

## Live/pushed status

- Live domain: `https://lestersarcade.io/`
- Production HTML cache token verified: `hmh-aaa-art-v24`
- Old token absent: `ui-chrome-v21`
- Stable live wallet markers verified in split chunk:
  - `user-cancelled`
  - `wrong-network`
  - `insufficient-funds`
  - `No wallet connected`
- Representative production assets return HTTP 200 and readable bytes:
  - PixelLab Lester runtime manifest
  - HMH isometric PixelLab wave manifest
  - HMH production art-pass manifest
  - HMH animated roster manifest
  - Hard Money Heroes MP3 theme

## Gates run in this pass

Passed:

- `npm run assets:verify`
- `npm test` — 1039 passing, 0 failing
- `npm run check`
- `npm run vercel:build`
- `npm run smoke:portal`
- `npm run smoke:portal:interactions`
- `npm run design:web3-audit` — PASS, 9/9
- `npm run design:security-audit` — PASS, 0 findings
- `npm run contracts:test` — 15 passing, 0 failing
- `npm run contracts:slither` — 18 contracts, 63 detectors, 0 results
- `npm run design:audit`
- `npm run design:roster`
- `npm run design:wave3-art`
- `npm run design:art-census`
- `npm run design:art-repair`
- `npm run design:art-redo`

Known non-ship-blocking but not-AAA-green result:

- `npm run assets:qa` writes current QA artifacts but reports 8/8 sampled actors failing strict Sprite QA. This is expected by the existing script while Wave 3 fills gaps, but it means art is not final AAA.

## Current evidence from reports

### Global art census

- Compliance score: 74/100
- Total assets: 10,134
- Runtime actors: 37
- Runtime complete actors: 21
- Runtime partial actors: 12
- Runtime zero-animation actors: 4
- Runtime unresolved zero-animation actors: 0 after current defer/repair policy

### Roster coverage

- Actors in canonical manifest: 37
- Complete actors: 21
- Partial actors: 12
- Zero-animation actors: 4
- Level 1 runtime-spawnable enemy rows: 23

Important partial/zero-animation rows still visible in the reports:

- Bosses/minibosses:
  - `bit-whale-boss` — zero-animation
  - `chain-reaper-boss` — zero-animation
  - `rugpull-summoner` — zero-animation
  - `warren-spear-rider` — zero-animation miniboss
  - `whale-dumper-boss` — partial
  - `bridge-exploiter` — partial
  - `plaza-warden` — partial
  - `the-obfuscator` — partial
- Heroes:
  - `lester` — partial; missing dash/victory in role matrix
  - `lilly` — partial; missing dash/victory
  - `lit-commando` — partial; missing dash
  - `lit-valkyrie` — partial; missing dash/victory
- Enemies:
  - `bitcoin-maximalist-riot-cop` — partial
  - `influencer-camera-drone` — partial
  - `nft-valet` — partial
  - `stablecoin-socialite` — partial

### Animation coverage

- Missing hero animated state count: 16
- Missing enemy animated state count: 25
- Runtime-derived enemy readability states: 25
- Runtime missing enemy states: 0

Important nuance: runtime readability fallbacks are currently preventing hard visual holes, but they are not replacement native sprite work. They keep the game playable/readable while the remaining animation sheets are produced.

### Art redo queue

- Total redo items: 55
- P0 items: 19
- P1 items: 36
- Items needing manifest/replacement: 10

P0 buckets:

- Pickups:
  - bonus life
  - hash rail core
  - block-time dilation
  - green-candle berserk
  - liquidation nuke
- Achievements:
  - diamond/gold/mythic/platinum badge atlas rows
  - boss unlock motif
  - level-clear unlock motif
  - skill unlock motif
- VFX:
  - coin pickup pop
  - grenade explosion ring
  - level-up burst
  - achievement unlock burst
- UI chrome:
  - combat HUD frame/stat chips
  - level-up card frame
  - achievement toast frame

## Web3/security status

Green for current testnet/free-ranked posture:

- Wallet error classification is live and distinguishes user cancellation, wrong network, missing wallet, and insufficient funds.
- Security static audit is PASS with 0 findings.
- Web3 settlement audit is PASS with 9/9 checks.
- Foundry security baseline passes 15/15 tests.
- Slither reports 0 findings across 18 contracts and 63 detectors.

Still blocked before real-value / paid-ranked / mainnet posture:

- Live readiness is PARTIAL, 3/4 gates passed.
- Blocked gate: on-chain registry/economy.
- Requires approval/finalization of:
  - GameRegistry cabinet approval path
  - SplitConfig/economy settings
  - legal/brand/economy policy for real-value launch

## Remaining tasks to reach AAA-complete

1. Replace zero-animation and partial boss/miniboss rows with full native sprite sets.
   - Highest priority: `warren-spear-rider`, `rugpull-summoner`, `bit-whale-boss`, `chain-reaper-boss`, plus phase/hit/death gaps on existing bosses.
2. Complete hero native animation coverage.
   - Add/verify dash for all playable heroes.
   - Add victory where missing.
   - Decide whether old coverage report requirements for crouch/fall should be retired or fulfilled for the isometric build.
3. Replace runtime-derived readability fallbacks with native frames.
   - Attack tells, spawn-ins, hit reactions, death sequences, and mini-boss enrage states should become authored frames rather than reused readable proxies.
4. Finish pickup icon manifest coverage.
   - 10 pickup IDs still need manifested icons or explicit keep/defer rulings.
5. Finish P0 VFX wiring and polish.
   - Coin pop, grenade ring, level-up burst, and achievement burst need final runtime use and visual validation.
6. Finish P0 UI chrome integration.
   - Combat HUD frame/stat chips, level-up cards, and achievement toasts need final visual QA in gameplay, not just manifest existence.
7. Bring Sprite QA to green.
   - Current strict QA reports are useful evidence but still fail on sampled actors due palette/transparency/pivot/tell-duration/completeness issues.
8. Perform a real long-form playtest pass.
   - At least 20-minute survival route, enemy density, pickup readability, boss/mini-boss encounters, collision/pathing, and performance under late swarm.
9. Decide Web3 HALT items before any real-value deployment.
   - Settlement architecture ruling.
   - Wrapper/unused contract ruling.
   - Tournament funding/refund ruling.
   - License/proprietary policy ruling.
10. Re-run production smoke after the next visual runtime change.
   - If app JS/CSS changes, bump the cache token again and verify the custom domain serves the new token/chunks.

## Recommended next slice

Do not start with broad new content. The next highest-value AAA slice is:

1. Finish native animation for the four zero-animation/critical partial Level 1 rows.
2. Wire one full pass of P0 pickup/VFX/UI chrome that is visible during the first 90 seconds of play.
3. Run Sprite QA, smoke, full test/build, and browser visual capture.
4. Only then bump cache token and push production.
