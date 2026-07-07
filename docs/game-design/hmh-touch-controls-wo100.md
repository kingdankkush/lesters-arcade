# HMH WO-100 — Touch Controls Audit + Ergonomic Redesign

## Control inventory

| Element | Layer | Function | WO-100 ruling |
|---|---|---|---|
| `#touchControls .touch-move-base` | mobile/touch overlay | Floating left/right movement stick that injects WASD movement keys | Keep. Bottom thumb arc, idle 40% opacity, active 70%. |
| `#touchControls .touch-aim-base` | mobile/touch overlay | Floating aim stick for twin-stick aim and auto-fire direction | Keep. Opposite thumb arc, idle 40% opacity, active 70%. |
| `#touchControls .touch-grenade` | mobile/touch overlay | Grenade entrypoint; tap is quick throw, hold aim is wired in WO-101 | Keep. ≥56px button above the aim stick in the thumb arc. |
| `#combatMenuIconButton` | gameplay HUD | Pause/settings/fullscreen/game menu | Keep. It has a deliberate gameplay function and remains in the top safe-area corner. |
| `#powerUpButton` | desktop sandbox controls | Practice helper that drops local tuning pickups | **Removed from `#touchControls`.** This was the mystery POWER button near grenade. It remains only in the desktop/local sandbox controls. |

## Redesign shipped

- Touch overlay opacity is now persisted via `hmh-settings.touchControlOpacity`.
- Default idle opacity is 40%; touched/active opacity is 70%.
- Movement and aim sticks set their visible origin to the first thumb contact point instead of forcing the player to reach a fixed center.
- Mobile action cluster is grenade-only; the center-bottom dead zone stays clear.
- Left-handed mode is persisted via `hmh-settings.touchLeftHanded` and mirrors movement/aim/action sides.
- The existing pause/settings panel exposes:
  - `Left-Handed On/Off`
  - `Opacity 32% / 40% / 55%` cycle

## Verification targets

- Portrait and landscape mobile layouts keep controls outside the middle-bottom sightline.
- No POWER/practice helper appears in `#touchControls`.
- The persistent menu button remains available for pause/settings/fullscreen.
