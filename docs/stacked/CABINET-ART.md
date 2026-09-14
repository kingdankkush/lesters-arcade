# STACKED rotating cabinet

Created September 13, 2026 with built-in image generation. New original silver,
cyan and midnight cabinet artwork matches the presentation style of the existing
HMH and Chikun cabinets. It replaces STACKED's static banner on the public arcade
floor. Both game catalogs share the same immutable six-view manifest.

## Asset and provenance

- Runtime: `apps/portal/assets/stacked-cabinet/stacked-cabinet-turnaround-v1.png`
- Native output: `exec-356a8a82-bb6e-4dfd-a797-f91c17152b65.png`
- 1536 x 1024 RGB PNG, 1,362,754 bytes; one request for all six angles.
- The native generator returned a painted checkerboard rather than alpha on its
  first two attempts. The final native edit replaces that background with black.
  The renderer uses CSS screen blending to integrate it with the dark card.
  This is an RGB matte asset, not a transparent PNG.
- The original generated output is retained. No Python or manual pixel editing
  was used. The existing runtime atlas renderer selects equal-size view windows.

## Prompt set

Initial generation: one 3-column by 2-row six-view atlas of the same upright
STACKED cabinet at front, front-right, back-right, back, back-left and front-left
angles. Fixed elevated orthographic camera; consistent height and scale. Brushed
silver body, midnight front, cyan edge lighting, clear STACKED marquee, falling
block puzzle screen, glowing block mosaics and cyan/violet audio waves on sides,
coin slot, joystick and buttons, realistic rear ventilation and maintenance door.
Use the existing Chikun front-right and HMH front-right cabinets as style-only
references, not their branding or characters. No gridlines or labels.

Correction: preserve all artwork and dimensions; correct the third view to show
the back on the left and side on the right, complementing the fifth view; remove
the checkerboard to actual transparency. That alpha request was not fulfilled.

Final native edit: preserve all six views, details, lettering, positions and
lighting; replace every exterior checkerboard square with uniform pure black
RGB 0,0,0, with no gradient, scenery, floor or texture.

## Motion and boundaries

Six 600 ms frames match the existing cabinet showcase cadence. The new cabinet
uses transform/opacity animation without a JavaScript animation loop or animated
filters. A visible control pauses/resumes the cabinet floor. Reduced-motion
preferences stop rotation and float, displaying the front view. The control does
not change gameplay settings, profiles, scores, wallets or persistence.

Verification: `node --test tests/stacked-cabinet-art.test.mjs` and
`node scripts/stacked-cabinet-browser-smoke.mjs`. Browser evidence covers 320,
390, 768, 1024 and 1440 px widths, all six frames, one atlas request, pause/resume,
OS reduced-motion changes, horizontal containment, and cabinet-to-Free entry.
