# HMH feel 2.1: shake, mix, hitstop, damage numbers, allocations, prewarm

Branch `claude/201-hmh-feel` on the live 2.0.0 head `f044868ff`. Source plan:
`LESTERS-ARCADE-UPGRADE-GUIDE-2026-09-30.md` §2 (Hard Money Heroes) and §5.1
(shared feel module). Owner decision for 2.1: hitstop is **presentation-only
(option b), in every mode**, so Ranked simulation and evidence are untouched.

No version, service-worker, save-schema (`2`) or bridge-version
(`hmh-bridge/v1`) change. Every new setting and message field is optional, so
an older parent or child stays valid.

## Commits

| Commit | Item |
|---|---|
| `04999862b` | 1. Trauma² shake from a shared feel module (§2.2) |
| `d17b96b6e` | 2. Master + SFX-bus compressors, 3 dB music duck under boss (§2.4.1, §2.4.4) |
| `c62e86535` | 3. Presentation-only hitstop, swarm cap, own toggle (§2.1 b) |
| `29cc8d663` | 4. Pooled damage numbers from a pre-baked glyph atlas (§2.3) |
| `6d89e8757` | fix: keep the frontier-preview pin in `destroyHmhRebootSession()` |
| `9e910f537` | 5. Per-frame allocation cleanup and GPU texture prewarm (§2.8, §2.9) |

## Shared feel modules (`apps/portal/src/feel/`)

- `trauma-shake.mjs`: STACKED's `render/board-motion.mjs` trauma model. `add()`
  adds and clamps to 1, trauma decays linearly (1.75/s by default),
  amplitude = trauma² × `maxPx`, reduced flash halves it, and a disabled shake
  returns zero. The direction comes from an integer hash of the caller's frame
  index (`hashUint32`, lowbias32), and `offset()` writes into one reused object.
- `audio-bus.mjs`: `MASTER_BUS_COMPRESSOR`, which uses STACKED's values from
  `stacked/src/sound-effects.mjs`: −16 dB threshold, knee 10, 3.5:1, attack
  3 ms, release 220 ms. Also a gentle `SFX_BUS_COMPRESSOR` (−10 dB, knee 8,
  2:1, attack 5 ms, release 150 ms), `createBusCompressor()` and `dbToGain()`.
- `hitstop.mjs`: the presentation hold (details below).
- `texture-prewarm.mjs`: a one-time GPU upload per texture source.

HMH uses them through one lazy chunk, `apps/hmh-reboot/src/hmh-feel.mjs`, which
`main.mjs` loads with `import()`. STACKED keeps its own copies for now. Moving
STACKED and Chikun onto the shared modules is follow-up work.

## 1. Trauma² shake (§2.2)

- Each old impulse magnitude becomes a linear trauma increment: `magnitude / 12`.
  12 px was the old ceiling (boss defeat). One isolated impulse peaks at
  `magnitude² / 12` px, so the old ordering holds while small kicks shrink:
  - auto-miner recoil peaks at 0.07 px;
  - pistol recoil peaks at 0.21 px;
  - a hand grenade peaks at 8.3 px;
  - the boss defeat peaks at 12 px.
- Decay is 1.75 per second, measured on the simulation tick clock, so a paused
  or captured frame is reproducible. Trauma reaches zero
  `HMH_SHAKE_SETTLE_TICKS` (35) ticks after a full impulse.
- `screenShake` and `reduceMotion` still gate the shake, and `reduceFlash`
  halves it. Shake stays on the `world` container and never touches
  `camera.shakeX/Y`, so aim is not disturbed.
- Removed: the 9-tick linear model and its per-frame `shake-x:${tick}`
  template strings.
- Tests (`tests/hmh-feel-trauma-shake.test.mjs`):
  - add, clamp and decay behaviour;
  - squared amplitude and the reduced-flash halving;
  - a reused offset object with an integer hash;
  - no measurable retained heap over 60,000 frames;
  - 10 s of auto-miner fire stays under 0.5 px, and a grenade still dominates;
  - three overlapping small hits stay under one grenade;
  - the shake is bounded and reproducible per tick.

## 2. Audio mix (§2.4.1, §2.4.4)

- **Graph:** the SFX bus feeds the gentle SFX compressor, then the master
  compressor (STACKED values), then the destination. The UI bus joins at
  master. A context with no `createDynamicsCompressor` connects straight to the
  destination, which is the old graph.
- **Music is not mastered with the SFX,** so gunfire never pumps the
  soundtrack.
- **Duck, standalone:** the child owns its music element alone, so the element
  is routed through `createMediaElementSource` into a music gain. Once routed,
  the gain node carries the level and the element plays at unity. While the
  boss HUD is engaged, the gain ramps −3 dB (`setTargetAtTime`, τ 0.12 s).
  `setMusicDuck(false)` restores the exact baseline. A context without
  `createMediaElementSource` ducks `element.volume` instead.
- **Duck, embedded:** the jukebox is one parent element shared by every
  cabinet, and STACKED already owns its single `createMediaElementSource`, so
  HMH must not source it again. Following the rule for a shared element:
  - The child adds an optional `musicDuck: true` to `game:state` while a boss
    is engaged, and sends one state message on each change.
  - The bridge accepts the field only as `true`. A missing field means no duck.
  - `hmh-reboot-portal-lifecycle` calls `onMusicDuck`.
  - `apps/portal/main.js` multiplies the jukebox element's existing volume
    path (`applyArcadeMusicVolume`) by 10^(−3/20), in the gameplay context
    only.
  - `destroyHmhRebootSession()` clears the duck.
- Tests: `tests/hmh-feel-audio-mix.test.mjs` uses a fake Web Audio context
  with dynamics and media-element nodes. It checks:
  - the graph routing;
  - parity with the STACKED compressor values;
  - the direct fallback;
  - the duck is −3 dB and settles back after 50 boss beats;
  - the element fallback;
  - bridge validation and the lifecycle callback;
  - the portal wiring.
- **Not measured here:** "rapid-fire 10 s without clipping on a master peak
  meter" needs an analyser in a real browser. The compressor is in place, but
  no peak-meter receipt was captured.

## 3. Hitstop, presentation-only (§2.1 b)

**Hold mechanics**
- In the frame loop, `simulation.update()` runs first, as before.
- Then `hmhFeel.commitHitstop(nowMs, settings)` starts a hold for the strongest
  request made during that frame's ticks. The impact frame itself still renders.
- On the next N frames, `holding()` is true. The frame loop then returns before
  `renderWorld()`, so the last presented pose stays on screen.
- The simulation keeps stepping, and the first frame after the hold draws the
  current state. N is measured as N × 1000/60 ms, so a 120 Hz display holds for
  the same time.

**Freeze values:** crit 2, kill 2, heavy kill (shotgun or launcher) 3, heavy
hit 3, boss hit 4, boss death 6.

**Swarm cap:** a request during an active hold is ignored, and at most 3 holds
start in any rolling second (a ring of start times).

**Input:** a single call site, `hmhFeel?.enemyHit(...)`, sits right after
`pushImpactVisual` in the damage loop. It receives primitive copies of the
resolved hit and writes nothing back.

**Setting**
- Pause toggle **Hit stop**, `#hmhSettingHitstop`, default on.
- It belongs to the new feel family (`hmh-setting-toggle hmh-setting-feel`)
  and uses its own `onSettingFeel` → `applyPauseFeel` path. The four pinned
  toggles and `PAUSE_SETTING_KEYS` are unchanged.
- Separate from screen shake, and off under reduced motion.
- Sent on `game:settings` as an optional `hitstop` boolean. The portal persists
  it as `gameplay.hitstop` in `'hmh-settings'` through `mergeHmhRuntimeSettings`
  and `projectHmhRuntimeSettings`, the same path as the gore setting.
- Standalone defaults it off, like screen shake, because standalone is the
  evidence-capture path.

**Telemetry** (`dataset`): `hitstopStarted`, `hitstopHeldFrames`,
`hitstopIgnored`, `hitstopMaxPerSecond`, `settingHitstop`.

### Acceptance

The real child runs through the honest-corpus harness: virtual 60 Hz clock,
a deterministic `brawler` pilot, a Ranked session, seed 424242, tick cap 2,400.
A new probe, `scripts/hmh-honest-corpus/feel-parity.mjs`, records:
- every bridge message (run events, state, score result, game over, and the
  v7 run summary);
- a chained per-tick FNV digest of the simulation stream (hero position and
  health, plus every live enemy's id, position and health).

Results:
- **Hitstop and damage numbers on vs. both off:** the evidence (90 messages)
  and the stream are byte-identical. The run reaches game over at tick 9,033.
  The on run started 84 holds and held 172 frames, with a peak of 3 holds per
  second. It spawned 168 damage numbers, with at most 4 live.
- **2.0.0 base child (`f044868ff`) vs. this branch with feel on by default:**
  byte-identical evidence and stream. The base tree was extracted with
  `git archive` into a scratch directory and run with the same probe.
- **The cap in a 30-enemy wave:** a scripted wave of 30 kills plus crits over
  40 frames keeps `peakPerSecond` ≤ 3 and never starts more than 3 holds in
  any rolling second (`tests/hmh-feel-hitstop.test.mjs`). The real run's
  telemetry peak is also 3. The scripted early run has at most 9 live enemies,
  so the 30-enemy case is proved at the module level.
- **Static checks:**
  - in the frame loop, `update` comes before `commit`, which comes before the
    hold check, which comes before the render;
  - the held branch touches no `simulation.`, `bridge.`, `recordRun` or run
    summary;
  - there is exactly one `enemyHit` call site;
  - the simulation, combat, lifecycle, run-summary and SDK summary modules
    never mention hitstop.

## 4. Damage numbers (§2.3)

**Rendering**
- Glyphs come from a pre-baked atlas. Pixi's `BitmapText` is not in the HMH
  vendor build, and adding it would cost initial bytes. `Text` re-rasterises
  on every change.
- `createDamageGlyphAtlas()` draws the ten digits once onto a canvas: white
  fill, dark outline, 24 CSS px cell, 2× resolution. It then makes one texture
  per digit, all sharing one source.

**Pool**
- 32 typed-array slots in `createDamageNumberModel`. When full, the oldest
  number is stolen.
- Each slot is a container of 5 digit sprites. A sprite's texture changes only
  when that slot's value changes.
- Drawing a full pool for 6,000 frames retains nothing measurable.

**Motion**
- Rise 28 px over 0.6 s with a cubic ease-out, then fade over the last 40%.
- Crits land at 1.3× in gold (`0xffc857`) and settle at 1.12×.
- The clock is the simulation tick plus interpolation, so hitstop freezes the
  numbers along with the world.

**Aggregation:** a hit on an enemy whose number is still fresh adds to that
number, so it counts up. The window is 180 ms, widening to 450 ms once 12
numbers are live. The counting number stays near the top of its rise.

**Layer:** the numbers sit on the stage under the HUD overlay, offset by the
world shake like the health pips.

**Setting**
- Pause toggle **Damage numbers**, `#hmhSettingDamageNumbers`, default on.
- Uses the same feel path and plumbing as hitstop (`damageNumbers`,
  `gameplay.damageNumbers`).
- Standalone defaults it off, so the visual baselines carry no numbers.

**Readability at 375 px:** see the capture below.

## 5. Allocations (§2.8) and prewarm (§2.9)

**Allocations**
- `simulation.mjs`: each callback set is iterated through a frozen snapshot
  array that is rebuilt only after an add or remove. The old code ran
  `[...set]` every tick. Ordering is the same as the spread: a callback added
  during a tick first runs on the next tick, and one removed during a tick
  still finishes that tick. The test covers this order exactly. The replay
  event is built only when a replay listener exists.
- `main.mjs`: the gamepad lookup no longer spreads the list.
- `world-production-art.mjs`: `poolableSprites()` caches each container's
  filtered sprite list. It rebuilds when the child count, first child or last
  child changes. Before, `place()` ran a `.filter` on every call, once per
  terrain surface per frame.
- 1,000 simulation ticks with step and projection callbacks retain less than
  64 KB after a forced GC.

**Prewarm**
- `prewarmTexture(renderer, texture, seen)` calls
  `renderer.texture.initSource(source)` once per source. Pixi's `prepare`
  plugin is not in the vendor.
- Every loaded enemy atlas is uploaded when Level 1 becomes enterable, before
  the player enters (`dataset.texturePrewarm`).
- A late atlas, such as the boss, is uploaded on load, before its first draw.
- The damage glyph atlas is uploaded when the feel chunk loads.
- No display object or actor is created.
- Weapon VFX banks are already GPU render textures (`generateTexture`).
- **Not done:** shader-program prewarm.
- **Not run:** the `smoke:hmh:performance` first-shot, first-grenade and
  first-boss frame-time receipt.

## Bytes (`node build.mjs`)

| | 2.0.0 base | this branch |
|---|---|---|
| HMH initial JS (entry + vendor) | 797,441 B | 799,890 B (+2,449) |
| HMH initial + shared | 996,019 B | **998,651 B** (+2,632; cap 1,048,576; 49,925 B headroom) |
| HMH entry | 326,583 B | 329,032 B |
| Lazy `hmh-feel` chunk | none | 7,153 B |
| Lazy `combat-audio` chunk (compressors, duck) | (existing) | 9,131 B |

The shake, hitstop and damage numbers live in the lazy `hmh-feel` chunk. The
compressor and duck live in the lazy `combat-audio` chunk. Initial bytes grow
only by the `main.mjs` wiring, the static prewarm helper, and the new settings
fields in the shared `hmh-player-settings` chunk.

## Tests

New tests:
- `tests/hmh-feel-trauma-shake.test.mjs`
- `tests/hmh-feel-audio-mix.test.mjs`
- `tests/hmh-feel-hitstop.test.mjs`, which includes the two-process real-child
  parity run (about 20 s)
- `tests/hmh-feel-damage-numbers.test.mjs`
- `tests/hmh-feel-alloc-prewarm.test.mjs`

Updated pins:
- `hmh-reboot-visual-feedback`: shake gate and decay now live in the feel
  chunk.
- `hmh-reboot-upgrade-cards-and-settings`: the hitstop toggle cockpit test.
- `hmh-reboot-terrain-tiles`: the cached pool.
- The actor-authority inventory and snapshot now omit `hmhFeel` and
  `callbackLists`.
- The curated runtime inventory is regenerated for the new `feel/` files.

Results:
- `node --test tests/hmh-reboot-*.test.mjs tests/hmh-feel-*.test.mjs` plus the
  touched suites passed: 1,654 / 1,654 after item 5. That set covered the
  bridge, settings, cockpit, gore, corpus, authority, terrain, frontier-preview
  and curated-inventory suites.
- `node scripts/syntax-check.mjs` passed: 1,401 JS modules and 171 Python
  scripts.
- Full `test:release` (retirement gate): 6,721 tests, 54 failed, against 51
  expected.
  - The 3 unexpected failures are timing assertions under heavy machine load
    from parallel lanes. `chikun-difficulty`'s sample took 186 s; the
    `free-card` render took 24 s; `server-relayer` saw 'pending' instead of
    'submitted'.
  - The `free-card` and `server-relayer` failures reproduce in isolation on
    this loaded machine.
  - None of the three imports a file this lane touched (Chikun, share-card and
    settlement code).
  - An earlier run of the gate, during item 5, also flagged the
    curated-inventory and frontier-preview pins. Both are fixed in `9e910f537`
    and `6d89e8757`.

## After merging `codex/visual-overhaul-200-20260929` (`aed85e132`)

- The one conflict was `scripts/hmh-honest-corpus/child-driver.mjs`. The
  merged `runChild()` takes both `connectBeforeBoot` and `settingsOverride`.
- `node build.mjs` after the merge:
  - HMH initial + shared: **1,001,455 B** of 1,048,576 (47,121 B headroom);
  - HMH initial (entry + vendor): 801,469 B;
  - HMH entry: 330,611 B;
  - STACKED initial: 581,120 B.
- `node scripts/syntax-check.mjs` passes.
- Tests: the HMH suites, the feel suites (including the real-child parity
  run), the corpus, v7, v8, determinism and settings suites ran: 1,825 passed,
  3 failed.
- All three failures come from `aed85e132` itself. Each fails on that commit
  without this lane's changes, and this lane touched none of the code involved:
  - `hmh-reboot-runtime-settings` U9/X2 looks for a
    `Liquidator: ${warning}` caption that `aed85e132`'s `main.mjs` no longer
    contains.
  - `hmh-cockpit-lazy-startup` hits `HMH_WORLD_CONTEXT is not defined`.
    `aed85e132` added `HMH_WORLD_CONTEXT?.runSummary` to
    `loadLazyRuntimeModules`, and the test evaluates that function in
    isolation.
  - `server-verify-hmh-v7` "district bosses unlock no boss achievement" fails
    after `aed85e132`'s `server/verify/hmh.mjs` change.

## Capture

Receipts are in `docs/2.0/receipts/hmh-feel-2-1/`.

**How it was captured**
- Headless Chrome ran the built child from `apps/portal`, at
  `hmh-reboot/index.html?director=1`.
- Playwright's fake clock drove `requestAnimationFrame` and `performance.now`,
  so a frame with live numbers could be held while the screenshot was taken.
  The machine was shared with other lanes, and a plain real-time capture
  missed the 0.6 s lifetime every time.
- Standalone defaults both feel settings off, so the capture first turned them
  on in the pause menu. That also exercised the toggles.

**Files**
- `desktop-pause-feel-toggles.jpg` and `mobile-375-pause-feel-toggles.jpg`:
  the pause menu with the **Hit stop** and **Damage numbers** toggles under the
  four pinned toggles, both checked, above the Gore choice.
  - Telemetry after the click: `settingHitstop=true`,
    `settingDamageNumbers=true`, `damageNumbersView=ready`.
- `desktop-damage-numbers.jpg`: a pistol hit's **3** rises off the impact
  flash on a Bagholder.
- `desktop-damage-numbers-kill.jpg`: the **3** of the killing hit over the
  falling body.
- Run telemetry:
  - 6 numbers spawned, at most 2 live;
  - 4 hitstops started, 6 frames held, at most 2 per second;
  - no page errors.
- `feel-parity.json`: the four real-child parity runs. All four have
  evidence SHA-256 `7ebe2d6139b9…` and stream digest `3637027350`.

**375 px gameplay: not captured.**
- In a 1,800-tick mobile pass, 24 numbers spawned, with at most 2 live. Every
  hit landed on an enemy outside the 375 px portrait view: the hero's
  automatic fire reaches past the narrow viewport's right edge. None of the 12
  frames had a number on screen.
- A follow-up pass that walked toward the enemies failed on a pause-panel
  timeout while the machine was loaded, and was cut at the 2.1 release
  cut-off.
- Readability at 375 px is therefore argued from size, not shown. The glyph
  cell is a fixed 24 CSS px on every viewport, and the desktop frames show the
  outline staying legible over flash, blood and road.
- Follow-up: capture a 375 px frame with an on-screen hit, and decide whether
  automatic fire should reach targets that are off-screen on a phone (that is
  a gameplay question, not a feel one).

## Out of scope / follow-ups

- STACKED and Chikun adopting the shared `feel/` modules (§5.1). Chikun's
  audio routing (§3.1) belongs to another lane.
- A master peak-meter receipt for the 10 s auto-miner no-clip check. The
  `smoke:hmh:performance` first-use frame-time receipt (§2.9 acceptance).
- SFX variants and jitter, and separate cues for shared sounds (§2.4.2–3).
- Visual baselines: standalone defaults hitstop and damage numbers off, and
  shake was already off, so `visual:reboot` frames should be unchanged. The
  gate was not re-run in this lane.
