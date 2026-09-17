# STACKED reactive visuals and menu redesign (2026-09-16)

Owner direction (`docs/handoffs/owner-decisions-20260916.md`, STACKED section):
scene-based visualizer animations that transition with the music, music
reactivity on the board frame and piece glow, and a clean bespoke menu.

## Scene deck (`apps/stacked/src/render/music-scenes.mjs`)

Three looks on the `layerBackdrop` layer under the existing music worlds:

| Scene | Drivers |
| --- | --- |
| Energy tunnel | level sets ring flight speed; beat twists and swells the polygon rings; bass and high stretch the spokes |
| Particle drift | level and bass set outward speed and streak length; beat swells the motes; high brightens and enlarges them |
| Synthwave horizon | level sets grid scroll speed; bass and beat breathe the striped sun; high tints the sun toward the accent and enlarges the twinkling stars |

The section director crossfades (1.4 s) to the next scene when the fast
energy envelope drifts from the slow one for 1.2 s, every 64 beats, on a
Halving (four-line clear) or after 40 s, never inside a 9 s hold. It is
deterministic for a signal sequence. `Backdrop scene` in settings picks
`auto`, one fixed scene or `off`; `Next scene` cycles manually.

Budget: pools sized once (`SCENE_POOLS` desktop 254 / mobile 171 nodes),
shared contexts cloned at construction, no per-frame allocation, normal
blend only, alpha under `SCENE_CEILINGS`, beat/bass/high only move, rotate
or scale. reduceMotion freezes every scene and turns transitions into cuts.

## Music-reactive board (`apps/stacked/src/render/board-pulse.mjs`)

A 6 px ring outside the well and a 3 px halo under the active piece follow
`0.4·level + 0.6·beat` (frame) and `0.35·level + 0.65·beat` (piece), capped
at `PULSE_CEILINGS` (frame 0.20, piece 0.26, tint mix 0.35). The
`Music-reactive board` toggle defaults on; the pulse is off under reduced
motion, reduced flashes (the shipped default) or `React to music` off.

## Shell (`apps/portal/stacked/index.html`, `game.css`)

Hero with inline SVG block art and gradient title, primary actions, four
tiles (Free / Ranked / Settings / Scores), device score shelf, and settings
grouped Gameplay / Visuals / Accessibility / Audio. Every existing id and
data hook is kept; `#continueButton` stays the first and `#soundToggle` the
last focusable control so the dialog focus trap and smokes are unchanged.

## Persistence

The parent bridge validates an exact preference key set, so `scene` and
`reactiveBoard` are stored by the child under `stacked-visual-scenes-v1`
on this device and re-applied after every `portal:settings` echo. Moving
them into `stacked-player-settings.mjs` is a portal-side follow-up.

## Verification

- `node --test tests/stacked-*.test.mjs`
- `node scripts/stacked-playable-browser-smoke.mjs` (six profiles)
- `node scripts/stacked-reactive-evidence-smoke.mjs` (1280 and 390 widths;
  screenshots under `.hermes/evidence/stacked-reactive-20260916/`)
