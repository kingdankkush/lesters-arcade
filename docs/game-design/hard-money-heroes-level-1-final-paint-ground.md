# Hard Money Heroes Level 1 final-paint ground pass

_Last updated: 2026-06-25_

This pass adds original repo-owned final-paint terrain and animated water/shore spritesheets for Level 1. The earlier SBS CC0 ingestion remains as the geometry/fallback foundation, but these PNGs do not copy downloaded pixels.

- Runtime folder: `apps/portal/assets/generated/hmh-level-one-ground/final-paint/`
- Asset count: **21**
- Animated tiles: water ripple, Litecoin water glint, grass/dirt/sand shoreline, and grass-water bank.
- Contact sheet: `docs/game-design/assets/hmh-level-1-final-paint-ground-contact-sheet.png`

## Runtime intent

The selector now prefers `final-paint/*` tiles for Level 1 while preserving SBS CC0 tiles as fallback metadata/art. Animated water and shore spritesheets are frame-stripped in the renderer so water reads alive without touching gameplay determinism.
