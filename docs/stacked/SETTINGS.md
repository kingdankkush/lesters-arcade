# STACKED settings

The in-cabinet Settings card is one closed-by-default disclosure. The Settings
tile opens it. For the design record, the preset table, the migration rules and
the gentle-glow maths, see
[SETTINGS-SIMPLIFICATION-2026-09-25.md](SETTINGS-SIMPLIFICATION-2026-09-25.md).

| Group | Setting | Default |
|---|---|---|
| Effects | Visual effects: Off · Calm · Standard · Full | Standard |
| Effects | Music world, with a motion preview | Journey |
| Play | Landing guide | on |
| Play | Board grid | on |
| Play | Left-handed buttons (touch only) | off |
| Accessibility | Reduced motion | Follows the arcade or OS setting until changed |
| Accessibility | Reduced flashes (the board glow breathes gently instead of pulsing) | on |
| Accessibility | Piece patterns | off |
| Sound | Game sounds (0 = Off) | 35% |

- Every setting is presentation-only and allowed in Ranked.
- Everything is saved by the portal under `stacked-player-settings-v1`
  (`apps/portal/src/stacked-player-settings.mjs`).
- The child keeps no settings storage of its own.
- The Effects preset also sets the backdrop scene mode (`auto` or `off`) and the
  music-reactive board.
