# STACKED music auto-play on game start (2026-09-26)

Owner request: the arcade music player must auto-play when a STACKED game
begins, with the starting track randomized.

## Root cause

The parent started STACKED music with `void startArcadeMusicForGame('stacked')`
at the end of `mountStackedSession`, after `await import('./src/stacked-host.mjs')`
(and, for Ranked, after the wallet modal). Its `play()` therefore ran outside the
Free/Ranked click's transient user activation. Default Chromium usually allowed
it through sticky activation; a strict autoplay policy (Safari/iOS, Chromium
`--autoplay-policy=user-gesture-required`) rejected it with `NotAllowedError`
once the chunk import was slow, and the rejection was swallowed. Nothing on the
parent reacted to the child's first `game:state` `running`, so the run stayed
silent. Hard Money Heroes was unaffected because `beginOfficialLevel` starts its
music synchronously in the click.

The `stacked` queue, the random start (`chooseArcadeMusicStartIndex`) and the
mute/music setting were checked and are not causes.

## Fix (parent presentation only; nothing in `apps/stacked/**`)

- `startOfficialMode` (main.js): for STACKED, right after the challenge request
  and before any await, a Free click calls `startArcadeMusicForGame('stacked')`
  synchronously, the same pattern as HMH. It picks a random track of the STACKED
  queue (never the previous one when the queue has more than one song) and its
  `play()` runs inside the click's user activation.
- A Ranked click can still be cancelled at the wallet or entry modal, so it only
  calls `blessArcadeMusicElement()`: a muted `play()` in the click that unlocks
  the shared element (WebKit and Chromium keep an element unlocked after one
  user-gesture play), then pauses and rewinds it unless a real start claimed the
  element first. Skipped when music is playing or muted. The mount then starts
  the song.
- `apps/portal/src/stacked-run-music.mjs`, one instance per mounted session
  (modelled on `chikun-run-music.mjs`):
  - `mount()` keeps a song that is already playing (moving the queue context to
    STACKED), starts a random track if the player is paused and music is on, and
    only follows the queue context when music is off or muted.
  - On the first `running` of the session it plays only if the element is still
    paused and music is on. It never switches a playing track. Later states
    (pause, resume, score ticks, game over) do nothing.
  - `dispose()` runs in `destroyStackedSession`. Run Again and a new Free/Ranked
    click remount, so each game gets a fresh instance and a fresh random track.

Music never reads or writes the run, seed, input evidence or result. Hard Money
Heroes and Chikun music paths are unchanged.

## Evidence

- `tests/stacked-run-music.test.mjs`: click-started song kept at mount and run
  start, paused player started at mount, a blocked start retried once on the
  first running, later states ignored, a playing track never switched, music
  off, disposal, no-repeat random start, the main.js wiring (Free start and
  Ranked bless before the first await of `startOfficialMode`), and HMH's
  synchronous start in `beginOfficialLevel`.
- `npm run smoke:stacked:music` (`scripts/stacked-music-autoplay-browser-smoke.mjs`,
  build first): system Chrome with the default and the
  `--autoplay-policy=user-gesture-required` policy, the stacked-host chunk held
  back 6 s, two sessions per browser (four runs). No Playwright evaluate runs
  between the Free click and the run going live, so no synthetic activation is
  handed to the page. At running + 1 s the music must be playing unmuted on a
  STACKED queue track, the click-started song must still be playing, the first
  audible `play()` must have run with user activation, and no audible `play()`
  may be rejected. The two sessions of a browser start on different tracks and
  the four runs on at least two. The strict browser then plays a Hard Money
  Heroes Free level and requires its music playing on the HMH queue. Report:
  `.tmp/stacked-music-autoplay/report.json`.

## Known follow-ups

- Pausing STACKED does not pause the arcade music (HMH does). Unchanged here.
- Under a strict policy the analyser `AudioContext` (`stacked-audio.mjs`) may stay
  suspended, so the visualizer can fall back to ambient while the music itself
  plays through the element's direct output.
- Ranked was not browser-probed (needs a real wallet); it goes through the
  click-time bless and the mount start.
