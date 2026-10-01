# Arcade cabinet turntables (2.0), 2026-09-30

Three cabinets built from one Blender 5.1 kit (`scripts/hmh-blender/build-arcade-cabinets.py`)
and packed by `scripts/run-arcade-cabinets.py`. Presentation only.

| Cabinet | Turntable strip (16 x 384x420) | Poster | Panel source |
|---|---|---|---|
| Hard Money Heroes | 348,652 B | 29,126 B | Owner reference turnaround (`Cabinet-Panels/hard-money-heroes/hmh-cabinet-reference-turnaround.webp`) |
| Chikun's Escape | 348,934 B | 28,900 B | Committed six-view PNGs (`apps/portal/assets/generated/chikun-cabinet/`) |
| STACKED | 327,820 B | 29,206 B | Committed turnaround (`apps/portal/assets/stacked-cabinet/stacked-cabinet-turnaround-v1.png`) |

Budgets: strip <= 350 KB, poster <= 30 KB, true alpha (Cycles, transparent film). The poster
is frame 2 (45 degrees, front-right three-quarter); reduced motion keeps that same frame.

## Evidence

- `*-contact-sheet.webp`: all 16 frames plus the poster per cabinet.
- `games-desktop-1440x900*.png`, `games-phone-414x896@3*.png`, `games-desktop-reduced-motion*.png`:
  `/games` served locally from `apps/portal` after `node build.mjs`
  (`node scripts/arcade-cabinets-browser-evidence.mjs`).
- `browser-evidence.json`: 48 canvases decoded, pause control stills the animation, reduced
  motion shows only the rest frame, no horizontal overflow, no console errors.

## Owner panels still to come

Chikun and STACKED have no owner panel art yet; their panels were extracted from the committed
cabinet art. HMH panels were extracted from the owner's reference (also saved, 2048 px, as
`Cabinet-Panels/hard-money-heroes/hmh-extracted-*.png`). To replace any panel, drop the approved
flat art into `Desktop/Projects/LestersArcade-Assets/Cabinet-Panels/<game>/panel-<name>.png`
(`marquee`, `screen`, `deck`, `control-front`, `kick`, `side-left`, `side-right`, `back`), then run:

```bash
python -B -X utf8 scripts/run-arcade-cabinets.py --stage extract
# hold the heavy lock for the render stage
python -B -X utf8 scripts/run-arcade-cabinets.py --stage render
python -B -X utf8 scripts/run-arcade-cabinets.py --stage pack
python -B -X utf8 scripts/run-arcade-cabinets.py --stage sheet
```

Then update the `.catalog-static-cabinet` poster URLs in `apps/portal/portal-discovery.css`
(the test `tests/arcade-cabinets-3d.test.mjs` fails until they match).

Known limits: at the two grazing angles (67 and 292 degrees) the screen still catches some
studio light; the STACKED side art is rectified from a three-quarter view and mirrored for the
other side; the painted joysticks in the deck art sit under the modelled ones.
