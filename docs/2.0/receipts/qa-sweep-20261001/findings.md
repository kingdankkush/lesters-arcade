# QA sweep — ten-area world (2.0.0 live head f044868ff), 2026-10-01

Lane: QA-SWEEP, branch `claude/201-qa-sweep`. Scope: the ten-area Free world
(`?mode=free&world=ten-area`, the portal's "New Frontier (preview)"), which becomes
Level 1 next, and the paths players use to reach it.

## Method

- **Headless real child, whole world.** `scripts/hmh-honest-corpus/child-driver.mjs`
  runs the real `main.mjs` on a virtual pad with the evidence-safe hero. An A* pilot
  on the world's nav grid walked to every area centre, every cache and both mission
  rings (Meadows relay, Woods winch). It then entered the River, Bayou and Fortress
  courts and rang the Closing Bell. It logged area entry ticks, hero stalls, every
  enemy spawn (archetype, area, ground, prop/water clearance), enemies standing
  still away from the hero, and boss slot status, phases and HP. 200,000 frames.
- **Headless Chrome (GPU).**
  - Standalone child at desktop 1280×800 and phone 414×896@3 with touch, each with
    and without `actor3dPilot=1`: loading panel, HUD and pause menu.
  - An 11-minute keyboard tour of the whole world on desktop, with heap sampled
    every minute and the pause map captured mid-run and at the end.
  - Six runs (five restarts) per viewport with forced GC before each heap sample,
    plus weapon wheel, swap, grenade, dodge, reduced motion, reduced flash and
    gore off.
  - The portal path on both viewports: splash → floor → HMH → mode select → New
    Frontier → hero select → intro → play → pause → settings → restart → exit.
    Also /games, /blog, a blog post, /profile, Chikun `?course=2`, STACKED and
    /how-ranked-works.

## Bugs found and fixed

| # | Severity | Bug | Fix | Commit |
|---|---|---|---|---|
| 1 | **Critical**: freezes the run | The Arc Rifle (Lightning Ledger) froze the game in a district boss fight. From tick 52112 of the tour, every tick of the 51% Foreman fight threw `Cannot assign to read only property 'length'` and the ticker stopped. Cause: `selectLightningLedgerChain` deep-froze its shallow copies of the channel targets, which also froze the live boss's own `pendingEvents`, `pendingAttacks` and `cooldownUntil`. The same applies to any boss or enemy the beam chains through. | The chain links are now frozen shallowly; values and ids are unchanged. RED test in `hmh-reboot-lightning-ledger.test.mjs`. After the fix, the same 200k-frame tour clears the Baron (tick 39128), Lockkeeper (47072) and Foreman (60491) with zero ticker errors (`real-child-ten-area-tour-after-arc-rifle-fix.json`). | `bb06c9729` |
| 2 | **Critical**: the preview never starts | The portal's New Frontier preview never reached READY. The child stayed on "Renderer ready" for 45 s, then the host destroyed the frame, and pausing afterwards threw an uncaught `HMH reboot session is not mounted`. This happened on every headless desktop and phone attempt. Cause: the host sends its single `portal:connect` on the iframe load event, but the child only creates and starts its bridge after resolving the world context. The ten-area chunk loads lazily, so the handshake arrived first and was dropped. | `boot()` now holds window messages that arrive before the bridge listens and re-dispatches them once it does. The legacy path is the same apart from that buffering. The corpus driver gains an opt-in `connectBeforeBoot` (default off, so the corpus is unchanged) and waits for the port listener, as a real MessagePort queues messages. New `hmh-child-early-handshake.test.mjs`: RED without the fix, green with it. | `96007dbe1` |
| 3 | High: wrong map | In the ten-area world the pause field map was wrong in three ways. (a) The 20,000 × 14,000 world was squashed into the legacy 600 × 240 box. (b) It drew the legacy exploration paths and listed the legacy objective rewards ("Litecoin Sanctuary", "Scrypt Cache", "Liquidation Trap", "Warehouse Reserve", "Liquidator Vault · Arc Rifle") wherever ten-area exploration overlapped their legacy coordinates. (c) It named no area. | The map keeps the world's aspect; legacy stays exactly 600 × 240. Legacy overlays are drawn only on the legacy world. Areas the hero has explored are labelled. RED test in `hmh-world-design-field-map.test.mjs`. | `781ddf050` |
| 4 | Medium: wrong copy | Three places named the legacy world. The ten-area loading panel said "HARD MONEY HEROES / LEVEL 01 · The Forked Frontier · The relay has gone quiet…", with the legacy RELAY / RAVINE / HASHWOOD / THE YARD route. The pause title said "Forked Frontier". The portal level intro for the preview said "Level 1: The Forked Frontier … the Liquidator's yard". | One presentation table now names the world. **No brief gives this world a title. The proposed name is "The Litecoin Frontier"; the owner should confirm it.** The name lives in `WORLD_V2_PRESENTATION` in `world-v2-gameplay.mjs` and `HMH_FRONTIER_PREVIEW_COPY.intro` in the portal. While the world is a preview, the kicker reads "/ FREE PREVIEW" and the route reads MEADOWS / CITY / RIVER / FORTRESS. The portal intro restores the legacy card for ordinary runs. "Enter Level 1" is kept, because the world becomes Level 1 and harness scripts match that text. | `2bd06d378` |
| 5 | Low: wrong copy | The ten-area Liquidator defeat line said "His vault is open.", but this world places no Arc Rifle vault. | The line is now "…The exchange floor opens and a Genesis Seal drops." | `2bd06d378` |
| 6 | Low: accessibility | With critical-audio captions on, a district boss's tells and halts were captioned "Liquidator: …". | The caption now names the boss on the court; the Liquidator keeps "Liquidator:". | `2bd06d378` |

Screenshots:
- Loading panel: `before-phone-startup-forked-frontier.jpg` → `after-phone-startup.jpg`.
- Pause title and map: `before-desktop-pause-title.jpg` and `before-desktop-field-map-legacy-overlays.jpg` → `after-phone-pause-map.jpg`.
- Portal intro: `before-desktop-portal-intro.jpg`.
- Handshake: `before-desktop-portal-frontier-ready-timeout.jpg` and `portal-frontier-handshake-before.json` (child at "Renderer ready / Waiting for portal session…" with its nav grid ready, frame removed at 45.3 s) → `portal-frontier-handshake-after.json` ("Portal session connected" at 812 ms; legacy Free at 1043 ms), `after-desktop-portal-frontier-playing.jpg`, `after-phone-portal-intro.jpg`. The rerun portal sweep passes play → pause → settings → restart on both viewports, and the restarted session stays in the ten-area world.

**Legacy and Ranked safety.**
- The legacy world keeps its map model exactly as before (600 × 240, same paths and rewards), its static loading-panel copy and its captions.
- No simulation rule changed. The Arc Rifle fix changes only object freezing, not values.
- Green after the changes:
  - `hmh-world-v2-verifier-freeze` and `server-verify-hmh-honest-corpus`.
  - `server-verify-hmh-real-corpus-harness`.
  - Boss, seal, mission, progression, dodge and foundations determinism; the deterministic hash.
  - Lightning ledger, field map and level briefing.
  - Ten-area wiring and ten-area real child; the early handshake test.
  - Frontier preview, world-v2 gameplay and world-v2 runtime world.
  - Bundle offsets, banner rotation and hero identity.
  - 122 tests in total.
- `node scripts/syntax-check.mjs` passes (1389 JS modules + 171 Python scripts).
- Build: HMH initial + shared is 996,426 B (before: 996,019 B; cap: 1,048,576 B).

## Checked and clean

- **All ten areas were entered** by the headless tour, at these ticks: Meadows 0, Fortress 2592, Ridge 4577, City 6612, Coast 8020, Bayou 9702, River 13966, Pines 25195, Woods 27199, Farms 29855.
- **All ten caches and both mission rings were reached.**
- **District bosses.**
  - The Baron, Lockkeeper and Foreman each start on their threshold, lock the court (walls 2), pass their phases, die, drop their seal and reopen the court (walls 0).
  - Only one boss is alive at a time.
  - The Liquidator starts from the bell in the City exchange court: 12 lock walls, phases `market-open` → `margin-call`, HP 2295 → 1194 over the logged span.
- **All six 2.0 enemies were seen spawning in their areas:**
  - rug-puller (City, Woods)
  - money-printer (City)
  - tollkeeper (River)
  - hodl-revenant (Pines)
  - oracle-marksman (Ridge)
  - pump-and-dump-bloater (Farms)
- **No enemy spawned inside a prop, in deep water or out of bounds** (0 cases in the 200k-frame tour), and the hero never left the world bounds.
- **No memory growth across restarts** (forced GC, standalone ten-area, 25 s of play per run):
  - Desktop: 24.9 → 25.2 → 25.5 → 25.9 → 26.1 → 26.4 MiB.
  - Phone@3 with the 3D pilot: 44.6 → 50.5 → 51.4 → 51.4 → 51.7 → 51.9 MiB. The first jump is asset warm-up; after that it is about +0.3 MiB per restart.
  - The DOM stays at 528–529 nodes with one canvas.
- **11-minute stability tour** (desktop, heap every minute, no forced GC): 45, 66, 77, 71, 61, 70, 78, 88, 89, 78, 73, 88, 94 MiB. This is a GC sawtooth with no runaway growth. There were zero console errors and zero failed requests, and the simulation never left `active`.
- **Other checks passed.**
  - A restart keeps the ten-area world and its title.
  - The weapon wheel opens and closes with Tab.
  - Reduced motion, reduced flash and gore off all take effect.
  - Swap, grenade and dodge raise no errors.
  - No HMH child screen or portal page checked overflows sideways or clips text. The phone hero roster is a deliberate swipe carousel; the page itself does not scroll sideways.
  - From the entry, the objective pill reads "Press the relay switch · 22 m ↗", which is the right distance (875 units / 40) and bearing.

## Performance: phone 414×896@3, CPU throttled 4×, whole-world tour

Headless Chrome with GPU, walking the whole world under combat, rAF sampled in
5 s windows and attributed to the area the hero stood in
(`phone-4x-area-fps-tour.json`). Other lanes were running Chrome on the same machine
at the same time, so read these as indicative, not certifying.

| Area | Windows | Median fps | Worst window fps | Worst p95 frame (ms) |
|---|---|---|---|---|
| MWEB Meadows | 7 | 60.4 | 53.1 | 34.8 |
| Fork Fortress | 6 | 57.9 | 49.5 | 34.8 |
| Ledger Ridge | 8 | 49.0 | 35.1 | 55.5 |
| Litecoin City | 5 | 46.7 | 40.4 | 48.6 |
| Scrypt Bayou | 5 | 46.8 | 41.4 | 48.7 |
| Roads (between areas) | 9 | 45.3 | 27.5 | 80.4 |
| Hashwood River | 16 | 41.7 | 32.9 | 55.6 |
| Silver Coast | 5 | 41.5 | 30.6 | 55.5 |
| Hollow Pines | 6 | 39.8 | 29.4 | 62.6 |
| Halving Farms | 2 | 38.8 | 28.9 | 62.6 |
| Rugpull Woods | 9 | **28.7** | 26.1 | 76.5 |

**Below 55 fps at phone-4x:** every area except the Meadows and the Fortress.
Rugpull Woods is the worst, at a median of 28.7 fps. These are handed to the
performance owner and were not changed here.
- The horde grows with run time, so later areas also carry more enemies.
- The phone tour reached every area and cache except the Hashwood River cache
  (the River pin below).
- Heap during the phone tour: 32 → 72 → 82 → 73 → 58 → 54 → 88 → 85 MiB.
- No errors and no failed requests.

## For other lanes (not fixed here)

### Collision / terrain lanes
1. **Hero pinned at the Scrypt Bayou lock bridge's west end, (2700, 12050).**
   - The corner where ground (z 0), the `scrypt-bayou-lock-west-ramp`, the `scrypt-bayou-lock-bridge` (z 24) and the `scrypt-bayou-channel` deep-water polygon (x ≥ 2700, y 11850–12050) meet traps a hero moving east or south-east. Both the headless tour and the browser tour pinned there: the browser tour stayed about 6 minutes (`lane-bayou-pin-2700-12050.jpg`).
   - The deep-water strip draws as grass with flowers in the area art, so the player cannot see what stops them.
   - The ramp itself is fine (ground → ramp passes the hero traversal check); the bridge's side face and the water edge stop the hero.
2. **Hashwood River: the same ground/water/bridge-side pin at about (7262, 11320).** In the headless tour the hero needed about 5,000 ticks of retries before it got past.
3. **Enemies stuck at bridge ends and water edges.**
   - In the tour, 23 distinct enemies stood still (moved < 4 units in 600 ticks) while 200–1500 units from the hero, with high `stuckRecoveries` (28–182).
   - Several stood on cells the nav grid marks unwalkable. Clusters:
     - Scrypt Bayou north bridge west end, about (2658–2712, 11130).
     - Hashwood River bank at y ≈ 11320, x 6750–6832.
     - Bayou east, about (3022, 11831).
   - Enemy steering is shared, Ranked-frozen code, so this needs the ramp/bridge side geometry or a ten-area nav slice. Data: `real-child-ten-area-tour-after-arc-rifle-fix.json` (`enemyStuck`).

### Ranked v8 verifier / rules owner (design question, not changed)
4. **Boss attacks ignore `playerInvulnerable`, including dodge i-frames.** Boss strike intents (`resolveLiquidatorAttack` and the district kits through the dispatch) never check it; only enemy melee does. The evidence-safe "invulnerable" hero therefore died to the ten-area Liquidator at tick 70193. Whether a dodge should beat a boss strike is a rules choice, and changing it would alter legacy Ranked replays.

### Portal (not changed)
5. After a READY timeout the portal keeps `hmhRebootActive` true, so the pause button calls into a destroyed host and throws `HMH reboot session is not mounted` (an uncaught pageerror). Fix 2 removes the timeout this sweep hit, but the error path should still clear the active flag and show a retry.
6. Chikun `?course=2` (desktop only) logged one `Failed to load resource: 404` in the console that Playwright's response listener did not attribute to a URL. It is likely a favicon or worker request; worth one look by the Chikun owner.
