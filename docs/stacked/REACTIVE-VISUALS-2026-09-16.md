# STACKED reactive visuals and menu redesign (2026-09-16)

Owner direction (`docs/handoffs/owner-decisions-20260916.md`, STACKED section):
scene-based visualizer animations that transition with the music, music
reactivity on the board frame and piece glow, and a clean bespoke menu.

> Updated 2026-09-25: the settings menu, the board glow gate and persistence
> changed with the settings simplification. See
> [SETTINGS-SIMPLIFICATION-2026-09-25.md](SETTINGS-SIMPLIFICATION-2026-09-25.md).

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
deterministic for a signal sequence. Since 2026-09-25 the Effects preset
chooses the scene mode: Standard and Full run `auto`, while Calm and Off turn
the deck off. The fixed-scene select and the `Next scene` button have left the
UI. `renderer.nextScene()` and fixed `video.scene` values remain for QA only.

Budget: pools sized once (`SCENE_POOLS` desktop 254 / mobile 171 nodes),
shared contexts cloned at construction, no per-frame allocation, normal
blend only, alpha under `SCENE_CEILINGS`, beat/bass/high only move, rotate
or scale. reduceMotion freezes every scene and turns transitions into cuts.

## Music-reactive board (`apps/stacked/src/render/board-pulse.mjs`)

A 6 px ring outside the well and a 3 px halo under the active piece follow
`0.4·level + 0.6·beat` (frame) and `0.35·level + 0.65·beat` (piece), capped
at `PULSE_CEILINGS` (frame 0.20, piece 0.26, tint mix 0.35). Since
2026-09-25 the pulse is off under reduced motion, zero intensity,
`audioReactive: false` or `reactiveBoard: false`. The Calm and Off presets set
both of the last two.

Reduced flashes, which is on by default, now selects a gentle mode instead of
turning the pulse off. While live music plays, both nodes follow only the
smoothed level: `0.12 · I · (0.5 + 0.5·level)`, where `I = 0.35 + 0.65·intensity`.
Nothing goes above 0.12 alpha, the swing is at most 0.06, and there is no beat
term and no hue shift. As a result the glow shows by default.

## Shell (`apps/portal/stacked/index.html`, `game.css`)

The shell has a hero with inline SVG block art and a gradient title, the
primary actions, four tiles (Free / Ranked / Settings / Scores) and a device
score shelf.

Since 2026-09-25 the settings are one closed card grouped Effects / Play /
Accessibility / Sound, and the Settings tile toggles it. There are 9 controls
on touch and 8 on desktop. `#continueButton` stays the first focusable control
and `#volumeRange` is now the last.

## Persistence

Since 2026-09-25, `scene` and `reactiveBoard` come from the Effects preset.
They are stored with the rest of the parent player settings under
`stacked-player-settings-v1`, and the bridge accepts them as optional
presentation keys.

The old child key `stacked-visual-scenes-v1` is read by `readStackedSettings`
only while the parent settings have no saved Effects preset, which means on each
launch until the first save in the new version. It is never written or deleted,
so a rollback keeps working.

## Verification

- `node --test tests/stacked-*.test.mjs`
- `node scripts/stacked-playable-browser-smoke.mjs` (six profiles)
- `node scripts/stacked-reactive-evidence-smoke.mjs` (1280 and 390 widths;
  screenshots under `.hermes/evidence/stacked-reactive-20260916/`)
