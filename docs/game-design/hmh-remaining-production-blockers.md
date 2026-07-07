# HMH Remaining Production Blockers — WO-90 through WO-99, Audio/AV, Device QA

This register is intentionally conservative: do **not** generate, integrate, or commit final art/animation/audio assets from these work orders until the listed upstream approvals are cleared.

## Completed safe slices in this push

- **WO-95** — ranked-match unlock gates implemented/tested.
- **WO-96 plan slice** — six-biome macro map plan and tests added. Status remains approval-gated before asset generation.

## Approval/device blockers

| Work order | Current repo status | Blocker | Allowed next action |
|---|---|---|---|
| WO-92 Hero canon ingestion | Blocked | 19 Lester/Lilly canon refs are not present in `docs/art/canon/lester/` and `docs/art/canon/lilly/`; HERO_CANON approval missing | Justin provides/commits refs, then run alpha-clean/canon doc pass |
| WO-93 Hero matrix | Blocked | Depends on approved WO-92 hero canon and contact sheets | After approval, produce key-pose contact sheets before full animation |
| WO-94 Hero animation wiring | Blocked | Depends on WO-93 runtime-ready frames/anchors | Wire manifests, prewarm, visual showcase after approved assets exist |
| WO-96 Macro map | Plan complete, not runtime replacement | Justin approval required for `hmh-wo96-level1-macro-map.md` | Review/approve or revise macro plan |
| WO-97 World asset families | Blocked | Depends on WO-96 approval and per-family contact sheets | Generate only after approved family prompts/contact sheets |
| WO-98 World assembly | Blocked | Depends on WO-97 approved ground/water/vegetation/building/vehicle/critter/POI assets | Assemble seed-1337 tour after assets exist |
| WO-99 Enemy/boss canon uplift | Blocked | Depends on approved hero canon and roster style lock | Produce silhouette contact sheets first |
| WO-90 Placeholder redo | Blocked for final integration | Needs contact-sheet approval against WO-76 anchors | Produce/approve pickup, VFX, stamp, achievement-atlas sheets before integration |
| WO-81/82/79 Animation polish | Blocked | Depends on approved hero/enemy/world art | Add principles gates and ambient loops after assets exist |
| WO-86/87/88/89 Audio/AV | Blocked for final polish | Should follow stabilized visuals; licensed/imported audio requires approval | Candidate inventory only; no final music/SFX import without approval |
| Real-device QA | Blocked on this host | No `adb`, `scrcpy`, `xcrun`, or `ios-deploy` found; no attached device bridge | Run matrix when Android/iOS device tooling is available |

## Hard guardrails

- No final art generation from generic prompts for Lester/Lilly. Justin refs are canon.
- No runtime art replacement from WO-97/98 until WO-96 is approved.
- No final audio import or recurring automation without explicit approval.
- No real-device QA claim without actual device/tool output.

## Current safe next review item

Ask Justin to review: `docs/game-design/hmh-wo96-level1-macro-map.md`.

If approved, the next shippable production slice is WO-97 contact sheets for one asset family at a time, starting with ground/water because every later prop/POI read depends on those base layers.
